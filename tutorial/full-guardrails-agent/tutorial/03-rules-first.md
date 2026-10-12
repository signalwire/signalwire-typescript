# Lesson 3: The Rules First

The first file you write for a guardrailed agent doesn't import SignalWire at all. `reservations.ts` is the reservation book: every business rule, every record, and every check. The agent will only ever *ask* it to do things.

## Table of Contents

1. [Setting Up](#setting-up)
2. [The House Policy](#the-house-policy)
3. [Dates Are Code's Job](#dates-are-codes-job)
4. [Finding Tables Without Revealing Them](#finding-tables-without-revealing-them)
5. [Holding a Table](#holding-a-table)
6. [Confirming Exactly Once](#confirming-exactly-once)
7. [Try It](#try-it)
8. [Testing the Rules](#testing-the-rules)

---

## Setting Up

Penny lives in this repository, in `tutorial/full-guardrails-agent`, and uses the SDK from the repository's own source. Install the repository's packages once, from its root:

```bash
npm install
```

Run every command in these lessons from the repository root. There, `tsx` runs TypeScript files directly, and `@signalwire/sdk` resolves to the SDK in `src/`.

The reservation book needs no package. It uses two things Node.js ships with:

- **`node:sqlite`** stores the book in one SQLite file. Node.js 22.16 is the first release with both the module unflagged and its `timeout` option, which Penny uses to wait for a busy database.
- **`Intl.DateTimeFormat`** reads the clock in the restaurant's time zone, `America/New_York`, from the time zone data built into Node.js.

`node:sqlite` is synchronous. Each of Penny's queries takes a fraction of a millisecond, so a handler that calls the book returns quickly. A slower database belongs behind an asynchronous driver.

## The House Policy

Everything the house decides lives in plain constants at the top of `reservations.ts`. The model will never see any of them:

<!-- include: tutorial/full-guardrails-agent/reservations.ts#policy -->
```typescript
// The whole house policy. The model is never shown any of it.
export const TABLES = { T1: 2, T2: 2, T3: 2, T4: 4, T5: 4, T6: 4, T7: 6, T8: 6 };
export const SEATINGS = Array.from({ length: 8 }, (_, i) => 17 * 60 + 30 * i); // 5:00 PM to 8:30 PM, every 30 minutes
export const DINING_MINUTES = 90; // a table is busy for 90 minutes after seating
export const MAX_PHONE_PARTY = 6; // larger parties are booked by the events team
export const MAX_EXTRA_SEATS = 2; // never seat a party of 2 at a 6-top
export const BOOKING_WINDOW_DAYS = 30;
export const CLOSED_WEEKDAYS = new Set([0]); // Monday
export const SAME_DAY_LEAD_MINUTES = 30; // no seating sooner than 30 minutes from now
export const HOLD_SECONDS = 300; // a proposal holds its table for 5 minutes
export const MAX_VERIFY_ATTEMPTS = 3;
export const HOST_STAND_HOURS = [16 * 60, 22 * 60] as const; // a person answers 4 PM to 10 PM, Tuesday to Sunday
export const SMS_RESEND_SECONDS = 120; // a repeat request sooner than this is a duplicate
export const MAX_SMS_PER_BOOKING = 3;
```

Changing a rule means changing one line here. It never means editing a prompt and hoping.

Rules the agent can't satisfy throw a `PolicyError` carrying two strings: `fact` (what is true) and `ask` (what the agent should do about it). In Lesson 6, handlers turn those into the two things they tell the model.

## Dates Are Code's Job

Ask a language model what "next Friday" is and it will answer confidently, and sometimes wrongly. So Penny's model never does calendar arithmetic. It passes along the caller's own words, and code resolves them:

<!-- include: tutorial/full-guardrails-agent/reservations.ts#resolve-date --> <!-- snippet: no-compile an excerpt of reservations.ts that calls the module's own helpers -->
```typescript
/**
 * Turn the caller's own words for a date into a date, or null.
 *
 * The model passes along what the caller said ("next Friday", "the 26th");
 * code does the calendar arithmetic, and the caller confirms the result when
 * it is read back. The model never does date math.
 */
export function resolveDate(text: string, today: Day): Day | null {
  let t = (text || '').toLowerCase().replace(/[,.]/g, ' ');
  t = t.replace(/(\d+)(st|nd|rd|th)\b/g, '$1');
  let words = t.split(/\s+/).filter((w) => w && !FILLER.has(w));
  if (words.length === 0) return null;
  const joined = words.join(' ');

  if (joined === 'today' || joined === 'tonight') return today;
  if (joined === 'tomorrow') return addDays(today, 1);

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(joined);
  if (iso) return dayOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const strictlyAfter = words[0] === 'next';
  if (strictlyAfter) words = words.slice(1);
  const prefixes = WEEKDAYS.map((d) => d.slice(0, 3));
  if (words.length === 1 && prefixes.includes(words[0]!.slice(0, 3))) {
    let ahead = (prefixes.indexOf(words[0]!.slice(0, 3)) - weekday(today) + 7) % 7;
    if (ahead === 0 && strictlyAfter) ahead = 7;
    return addDays(today, ahead);
  }

  const numeric = /^(\d{1,2})[/-](\d{1,2})$/.exec(joined);
  if (numeric) return upcoming(Number(numeric[1]), Number(numeric[2]), today);

  const month = words.map((w) => MONTHS[w]).find((m) => m !== undefined);
  const day = words
    .filter((w) => /^\d+$/.test(w))
    .map(Number)
    .find((d) => d >= 1 && d <= 31);
  if (day !== undefined && month !== undefined) return upcoming(month, day, today);
  if (day !== undefined && words.length === 1) {
    // "the 26th" alone means the next 26th.
    return nextDayOfMonth(day, today);
  }
  return null;
}
```

A calendar day is a `Day`: an ISO date string such as `"2026-09-25"`. Strings compare in date order, store as they are in SQLite, and can't carry a time zone by accident.

"Next Friday" is ambiguous even between people. Code picks one reading, and the ambiguity is settled the way a human host would settle it. Penny reads the resulting date back ("Friday, September 25"), and the caller confirms or corrects it. Code produces the canonical answer, and the caller checks it.

## Finding Tables Without Revealing Them

`findOptions` validates the request, then looks for free tables near the requested time:

<!-- include: tutorial/full-guardrails-agent/reservations.ts#find-options --> <!-- snippet: no-compile a method of ReservationStore, excerpted from reservations.ts -->
```typescript
/**
 * Up to three bookable seatings near the requested time.
 *
 * Tables are chosen here and never leave this module: the caller and the
 * model only ever see option numbers.
 */
findOptions(
  callId: string,
  partySize: unknown,
  dateText: unknown,
  timeText: unknown,
  name: unknown,
): [Request, Option[]] {
  const [party, day, wanted, cleanName] = this.validateRequest(
    partySize,
    dateText,
    timeText,
    name,
  );
  return this.tx((db) => {
    this.session(db, callId);
    // A new search supersedes this call's old proposal.
    db.prepare("UPDATE holds SET status='released' WHERE call_id=? AND status='live'").run(
      callId,
    );
    const options: Option[] = [];
    const nearby = SEATINGS.filter(
      (s) => Math.abs(s - wanted) <= 60 && !this.tooSoon(day, s),
    ).sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b);
    for (const seating of nearby) {
      const fits = Object.entries(TABLES)
        .filter(([, cap]) => party <= cap && cap <= party + MAX_EXTRA_SEATS)
        .sort(([ta, ca], [tb, cb]) => ca - cb || ta.localeCompare(tb));
      const table = fits.find(([tid]) => this.tableFree(db, tid, day, seating, callId));
      if (table) options.push(new Option(options.length + 1, table[0], day, seating));
      if (options.length === 3) break;
    }
    const request = { party_size: party, day, start: wanted, name: cleanName };
    db.prepare('UPDATE sessions SET request=?, offers=? WHERE call_id=?').run(
      JSON.stringify(request),
      JSON.stringify(
        options.map((o) => ({
          number: o.number,
          table_id: o.tableId,
          day: o.day,
          start: o.start,
        })),
      ),
      callId,
    );
    return [new Request(party, day, wanted, cleanName), options];
  });
}
```

Look at what comes back: numbered `Option`s. Each one carries a `tableId`, but the handler in Lesson 6 only ever passes the number and the time to the model. Table IDs never leave this module, so the model can't ask for "table 7" or promise a window seat. The offers are stored against the call, which also means one call can't hold an option another call was offered.

Every write runs inside `tx`, a helper that starts a transaction with `BEGIN IMMEDIATE`, and commits or rolls back. `BEGIN IMMEDIATE` takes the database's write lock at the start, so two requests that arrive together are handled one after the other.

## Holding a Table

When the caller picks an option, the table is held for five minutes and becomes a numbered proposal:

<!-- include: tutorial/full-guardrails-agent/reservations.ts#hold-option --> <!-- snippet: no-compile a method of ReservationStore, excerpted from reservations.ts -->
```typescript
/**
 * Reserve one offered option for HOLD_SECONDS and return a numbered proposal.
 *
 * Re-holding the option this call already holds returns the same proposal,
 * so a model that fires the tool twice changes nothing.
 */
holdOption(callId: string, number: unknown): Proposal {
  if (typeof number !== 'number' || !Number.isInteger(number)) {
    throw new PolicyError('No option number was given.', "Ask which option they'd like.");
  }
  return this.tx((db) => {
    const session = this.session(db, callId);
    const offer = (JSON.parse(session.offers) as Offer[]).find((o) => o.number === number);
    if (offer === undefined) {
      throw new PolicyError(
        `There is no option ${number} on the list that was offered.`,
        'Offer the options again by number.',
      );
    }
    const request = JSON.parse(session.request) as { party_size: number; name: string };
    const nowTs = this.now().getTime() / 1000;
    const live = db
      .prepare("SELECT * FROM holds WHERE call_id=? AND status='live' AND expires_at > ?")
      .get(callId, nowTs) as HoldRow | undefined;
    if (
      live &&
      live.table_id === offer.table_id &&
      live.start === offer.start &&
      live.day === offer.day
    ) {
      return ReservationStore.proposal(live);
    }
    db.prepare("UPDATE holds SET status='released' WHERE call_id=? AND status='live'").run(
      callId,
    );
    this.checkNotice(offer.day, offer.start);
    if (!this.tableFree(db, offer.table_id, offer.day, offer.start, callId)) {
      throw new PolicyError(
        'That seating was just taken by another guest.',
        'Apologize and check availability again.',
      );
    }
    const revision = session.proposal_counter + 1;
    db.prepare('UPDATE sessions SET proposal_counter=? WHERE call_id=?').run(revision, callId);
    const inserted = db
      .prepare(
        'INSERT INTO holds (call_id, table_id, day, start, party_size, name, revision, ' +
          "expires_at, status) VALUES (?,?,?,?,?,?,?,?, 'live')",
      )
      .run(
        callId,
        offer.table_id,
        offer.day,
        offer.start,
        request.party_size,
        request.name,
        revision,
        nowTs + HOLD_SECONDS,
      );
    const row = db
      .prepare('SELECT * FROM holds WHERE id=?')
      .get(inserted.lastInsertRowid) as unknown as HoldRow;
    return ReservationStore.proposal(row);
  });
}
```

Four properties matter here:

- **Holds are exclusive.** Another call can't be offered or hold a table this call is holding.
- **Holding the same option twice changes nothing.** Models sometimes fire a tool twice, and a repeat returns the same proposal.
- **Every new hold gets a new revision number.** If the caller changes their mind, the old proposal can no longer be confirmed.
- **The notice rule is checked again.** An option offered at 4:29 for a 5 PM seating can't be held at 4:32, because it's no longer 30 minutes away. `confirm` checks it once more. A rule checked only when something is offered can be dodged by waiting.

## Confirming Exactly Once

`confirm` is where a booking happens:

<!-- include: tutorial/full-guardrails-agent/reservations.ts#confirm --> <!-- snippet: no-compile a method of ReservationStore, excerpted from reservations.ts -->
```typescript
/**
 * Commit the proposal the caller agreed to, exactly once.
 *
 * `revision` binds the commitment to the proposal that was read back:
 * if anything changed since, the old revision no longer commits.
 */
confirm(callId: string, revision: unknown): Reservation {
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
    throw new PolicyError(
      'No proposal revision was given.',
      'Read back the current proposal and ask the caller to confirm it.',
    );
  }
  return this.tx((db) => {
    this.session(db, callId);
    const done = db
      .prepare(
        'SELECT r.* FROM reservations r JOIN holds h ON r.hold_id = h.id ' +
          'WHERE h.call_id=? AND h.revision=?',
      )
      .get(callId, revision) as ReservationRow | undefined;
    if (done) return ReservationStore.reservation(done); // a repeated confirm returns the same booking
    const hold = db
      .prepare("SELECT * FROM holds WHERE call_id=? AND status='live' ORDER BY id DESC LIMIT 1")
      .get(callId) as HoldRow | undefined;
    if (hold === undefined) {
      throw new PolicyError('No table is on hold.', 'Check availability again.');
    }
    if (hold.revision !== revision) {
      throw new PolicyError(
        'The proposal changed since it was read back.',
        'Read back the current proposal and ask again.',
      );
    }
    if (hold.expires_at <= this.now().getTime() / 1000) {
      db.prepare("UPDATE holds SET status='released' WHERE id=?").run(hold.id);
      throw new PolicyError('The hold on that table expired.', 'Check availability again.');
    }
    this.checkNotice(hold.day, hold.start);
    const code = ReservationStore.newCode(db);
    db.prepare(
      'INSERT INTO reservations (code, hold_id, call_id, table_id, day, start, ' +
        "party_size, name, status) VALUES (?,?,?,?,?,?,?,?, 'confirmed')",
    ).run(code, hold.id, callId, hold.table_id, hold.day, hold.start, hold.party_size, hold.name);
    db.prepare("UPDATE holds SET status='confirmed' WHERE id=?").run(hold.id);
    const row = db.prepare('SELECT * FROM reservations WHERE code=?').get(code);
    return ReservationStore.reservation(row as unknown as ReservationRow);
  });
}
```

The `revision` ties the booking to the exact proposal the caller heard. A confirm with a stale revision is refused. A repeated confirm returns the same booking instead of making a second. The database's `UNIQUE` constraint on `hold_id` backs that up, even if two confirms race.

## Try It

You can drive the rules directly, with no agent. Save this as `tutorial/full-guardrails-agent/try-rules.ts`:

<!-- snippet: no-compile imports ./reservations.js, so it compiles only saved next to reservations.ts -->
```typescript
import { ReservationStore } from './reservations.js';

const store = new ReservationStore('tutorial/full-guardrails-agent/scratch.sqlite3');
const [request, options] = store.findOptions('call-1', 4, 'Friday', '7:30 PM', 'Maria Rivera');
console.log(request.spoken(), options.map((option) => option.spoken()));
const proposal = store.holdOption('call-1', 1);
const booking = store.confirm('call-1', proposal.revision);
console.log(booking.code, store.confirm('call-1', proposal.revision).code); // the same code twice
```

Run it to search, hold and book, then confirm the same proposal a second time:

```bash
npx tsx tutorial/full-guardrails-agent/try-rules.ts
```

The output looks like this. Your dates follow your calendar, and your confirmation code will differ:

```text
a table for 4 on Friday, October 2 around 7:30 PM, under Maria Rivera [ 'option 1, 7:30 PM', 'option 2, 7 PM', 'option 3, 8 PM' ]
VQAUXM VQAUXM
```

The second confirm returned the same code, and the book holds one reservation. Delete `try-rules.ts` and `scratch.sqlite3` when you're done.

## Testing the Rules

`tests/tutorial/penny-rules.test.ts` exercises the reservation book with a clock the tests control. Run only that layer:

```bash
npx vitest run tests/tutorial/penny-rules
```

Here are the two tests that prove a booking happens once, including four confirms racing on worker threads. Each thread opens its own connection to the same SQLite file, waits until all four are ready, then confirms:

<!-- include: tests/tutorial/penny-rules.test.ts#test-idempotent --> <!-- snippet: no-compile an excerpt of penny-rules.test.ts, which vitest runs with its helpers -->
```typescript
it('books once when a proposal is confirmed twice', async () => {
  const { store } = setUp();
  store.findOptions('call-1', 4, 'friday', '7:30pm', 'Rivera');
  const proposal = store.holdOption('call-1', 1);
  const first = store.confirm('call-1', proposal.revision);
  expect(store.confirm('call-1', proposal.revision)).toEqual(first);
  expect(await count(store, 'reservations')).toBe(1);
});

it('books once when four threads confirm at the same moment', async () => {
  const { store } = setUp();
  store.findOptions('call-1', 4, 'friday', '7:30pm', 'Rivera');
  const proposal = store.holdOption('call-1', 1);
  const ready = new SharedArrayBuffer(4);
  const codes = await Promise.all(
    [1, 2, 3, 4].map(
      () =>
        new Promise<string>((resolve, reject) => {
          const worker = new Worker(new URL('./penny-race-worker.ts', import.meta.url), {
            execArgv: ['--import', 'tsx'],
            workerData: {
              path: store.path,
              now: TUESDAY_3PM.getTime(),
              revision: proposal.revision,
              ready,
              threads: 4,
            },
          });
          worker.once('message', resolve);
          worker.once('error', reject);
        }),
    ),
  );
  expect(new Set(codes).size).toBe(1);
  expect(await count(store, 'reservations')).toBe(1);
});
```

These tests never load a model or an agent. That's the substitution test from Lesson 1, passed: the rules hold no matter what sends the requests. A test in the same file checks that `reservations.ts` imports only Node.js built-ins, so the rules can't come to depend on the SDK.

## Key Takeaways

- Put every business rule in a module with no SignalWire import, and test it first
- The model passes along the caller's words, code interprets them, and the caller confirms the result
- Revisions tie a commitment to exactly what was read back, and idempotency makes repeats harmless

## Review Questions

1. Why does `findOptions` return option numbers rather than table IDs to the agent?
2. What happens if the model calls `confirm_booking` with a revision from two proposals ago?
3. Which constant would you change to stop same-day bookings less than an hour out?

## Next Steps

The rules are done and tested. Next, build the agent around them, starting with the parts that must never depend on the model. Continue with [Lesson 4: The Agent Shell](04-the-shell.md).

---

[Previous: Design Before Code](02-design-first.md) | [Overview](README.md) | [Next: The Agent Shell](04-the-shell.md)
