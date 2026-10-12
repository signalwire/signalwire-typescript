/**
 * Penny, layer 1: the reservation book's rules, with no agent at all.
 *
 * These tests import reservations.ts and nothing from the SDK. That is the
 * substitution test from Lesson 1: the rules hold whatever sends the requests.
 */

import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';

import {
  LargePartyError,
  LockedOutError,
  PolicyError,
  resolveDate,
  resolveTime,
} from '../../tutorial/full-guardrails-agent/reservations.js';
import { Clock, TUESDAY_3PM, at, count, newStore } from './penny-helpers.js';

const TUESDAY = '2026-09-22';

function setUp() {
  const clock = new Clock(TUESDAY_3PM);
  const store = newStore(clock);
  const book = (callId = 'call-1', party = 4, when = 'friday', time = '7:30 pm', option = 1) => {
    store.findOptions(callId, party, when, time, 'Maria Rivera');
    const proposal = store.holdOption(callId, option);
    return store.confirm(callId, proposal.revision).code;
  };
  return { clock, store, book };
}

/** The PolicyError `work` throws. Fails the test if it throws nothing. */
function refusal(work: () => unknown): PolicyError {
  try {
    work();
  } catch (err) {
    if (err instanceof PolicyError) return err;
    throw err;
  }
  throw new Error('expected a PolicyError');
}

describe('Penny rules: the reservation book, with no agent', () => {
  it('imports nothing from the SDK', () => {
    const source = readFileSync(
      new URL('../../tutorial/full-guardrails-agent/reservations.ts', import.meta.url),
      'utf8',
    );
    const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((name) => name!.startsWith('node:'))).toBe(true);
  });

  it("turns the caller's words into dates in code", () => {
    expect(resolveDate('Friday', TUESDAY)).toBe('2026-09-25');
    expect(resolveDate('tomorrow night', TUESDAY)).toBe('2026-09-23');
    expect(resolveDate('the 26th', TUESDAY)).toBe('2026-09-26');
    expect(resolveDate('the 21st', TUESDAY)).toBe('2026-10-21'); // next month's
    expect(resolveDate('the 31st', TUESDAY)).toBe('2026-10-31'); // skips September
    expect(resolveDate('Sept. 26th', TUESDAY)).toBe('2026-09-26');
    expect(resolveDate('9/26', TUESDAY)).toBe('2026-09-26');
    expect(resolveDate('next Tuesday', TUESDAY)).toBe('2026-09-29');
    expect(resolveDate("whenever you're free", TUESDAY)).toBeNull();
  });

  it('reads dinner times', () => {
    expect(resolveTime('7:30 PM')).toBe(19 * 60 + 30);
    expect(resolveTime('19:30')).toBe(19 * 60 + 30);
    expect(resolveTime('7')).toBe(19 * 60);
    expect(resolveTime('noon')).toBeNull();
  });

  it('offers the nearest free seatings', () => {
    const { store } = setUp();
    const [request, options] = store.findOptions('call-1', 4, 'friday', '7:30 pm', 'Rivera');
    expect(request.day).toBe('2026-09-25');
    expect(options.map((o) => o.start)).toEqual([19 * 60 + 30, 19 * 60, 20 * 60]);
    expect(options.every((o) => ['T4', 'T5', 'T6', 'T7', 'T8'].includes(o.tableId))).toBe(true);
  });

  it('refuses what the house policy forbids', () => {
    const { store } = setUp();
    expect(() => store.findOptions('call-1', 8, 'friday', '7pm', 'Big Group')).toThrow(
      LargePartyError,
    );
    for (const [when, fact] of [
      ['monday', 'closed on Mondays'],
      ['2026-09-01', 'already passed'],
      ['2026-12-25', '30 days ahead'],
      ['soonish', "couldn't be understood"],
    ] as const) {
      expect(refusal(() => store.findOptions('call-1', 2, when, '7pm', 'Rivera')).fact).toContain(
        fact,
      );
    }
  });

  it('needs thirty minutes notice on the same day', () => {
    const { clock, store } = setUp();
    clock.now = at(18, 50);
    let [, options] = store.findOptions('call-1', 2, 'tonight', '7pm', 'Rivera');
    expect(Math.min(...options.map((o) => o.start))).toBe(19 * 60 + 30);
    // Seconds count: at 4:30:59, a 5 PM seating is under 30 minutes away
    clock.now = at(16, 30, 59);
    [, options] = store.findOptions('call-2', 2, 'today', '5 PM', 'Rivera');
    expect(options.map((o) => o.start)).not.toContain(17 * 60);
  });

  it('keeps a held table from other callers', () => {
    const { store } = setUp();
    // Only two tables seat six, so two holds at 7 PM leave nothing near 7 PM.
    for (const callId of ['call-1', 'call-2']) {
      store.findOptions(callId, 6, 'friday', '7pm', 'Group');
      store.holdOption(callId, 1);
    }
    const [, options] = store.findOptions('call-3', 6, 'friday', '7pm', 'Group');
    expect(options).toEqual([]);
  });

  it("can't hold or book a seating that became too close to book", async () => {
    const { clock, store } = setUp();
    clock.now = at(16, 29);
    const [, options] = store.findOptions('call-1', 2, 'today', '5 PM', 'Rivera');
    const five = options.find((o) => o.start === 17 * 60)!; // 31 minutes away when offered
    clock.now = at(16, 32);
    expect(() => store.holdOption('call-1', five.number)).toThrow(PolicyError);
    // Held in time, but confirmed too late
    clock.now = at(16, 29);
    store.findOptions('call-2', 2, 'today', '5 PM', 'Rivera');
    const proposal = store.holdOption('call-2', 1);
    clock.now = at(16, 31);
    expect(() => store.confirm('call-2', proposal.revision)).toThrow(PolicyError);
    expect(await count(store, 'reservations')).toBe(0);
  });

  it('lets a hold expire', async () => {
    const { clock, store } = setUp();
    store.findOptions('call-1', 6, 'friday', '7pm', 'Group');
    const proposal = store.holdOption('call-1', 1);
    clock.advance(301);
    expect(refusal(() => store.confirm('call-1', proposal.revision)).fact).toContain('expired');
    expect(await count(store, 'reservations')).toBe(0);
  });

  it('changes nothing when a hold is repeated', () => {
    const { store } = setUp();
    store.findOptions('call-1', 4, 'friday', '7:30pm', 'Rivera');
    const first = store.holdOption('call-1', 1);
    expect(store.holdOption('call-1', 1)).toEqual(first);
  });

  it('confirms only the proposal read back', async () => {
    const { store } = setUp();
    store.findOptions('call-1', 4, 'friday', '7:30pm', 'Rivera');
    const old = store.holdOption('call-1', 1);
    store.holdOption('call-1', 2); // the caller changed their mind
    expect(refusal(() => store.confirm('call-1', old.revision)).fact).toContain('changed');
    expect(await count(store, 'reservations')).toBe(0);
  });

  // region: test-idempotent
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
  // endregion: test-idempotent

  it('keeps options with the call that searched', () => {
    const { store } = setUp();
    store.findOptions('call-1', 4, 'friday', '7:30pm', 'Rivera');
    expect(() => store.holdOption('call-2', 1)).toThrow(PolicyError);
  });

  it('never says which half of a verification was wrong', () => {
    const { store, book } = setUp();
    const code = book();
    const wrongCode = refusal(() => store.verify('call-2', 'ZZZZZZ', 'Rivera'));
    const wrongName = refusal(() => store.verify('call-3', code, 'Smith'));
    expect(wrongCode.fact).toBe(wrongName.fact);
  });

  it('locks verification after three misses', () => {
    const { store, book } = setUp();
    const code = book();
    for (let i = 0; i < 2; i++) {
      const refused = refusal(() => store.verify('call-2', 'ZZZZZZ', 'Rivera'));
      expect(refused.constructor).toBe(PolicyError); // not locked yet
    }
    expect(() => store.verify('call-2', 'ZZZZZZ', 'Rivera')).toThrow(LockedOutError);
    // Even the right answer, once locked
    expect(() => store.verify('call-2', code, 'Rivera')).toThrow(LockedOutError);
  });

  it('verifies with the last name or the full name', () => {
    const { store, book } = setUp();
    const code = book();
    expect(store.verify('call-2', code.toLowerCase(), 'rivera').code).toBe(code);
    expect(store.verify('call-3', [...code].join(' '), 'Maria Rivera').code).toBe(code);
    expect(() => store.verify('call-4', code, 'Smith')).toThrow(PolicyError);
  });

  it('needs verification on this call to cancel', () => {
    const { store, book } = setUp();
    const code = book();
    store.verify('call-2', code, 'Rivera');
    expect(() => store.requestCancel('call-3')).toThrow(PolicyError); // another call proved nothing
  });

  it('cancels only with the staged revision, and only once', () => {
    const { store, book } = setUp();
    const code = book();
    store.verify('call-2', code, 'Rivera');
    const [, revision] = store.requestCancel('call-2');
    expect(() => store.confirmCancel('call-2', revision + 1)).toThrow(PolicyError);
    expect(store.confirmCancel('call-2', revision).status).toBe('cancelled');
    expect(store.confirmCancel('call-2', revision).status).toBe('cancelled');
  });

  it('takes a message only with a real callback number, and saves it once', async () => {
    const { store } = setUp();
    expect(() => store.saveMessage('call-1', 'Ana', '555-12', 'Please call')).toThrow(PolicyError);
    const first = store.saveMessage('call-1', 'Ana', '(555) 123-4567', 'Please call');
    store.saveMessage('call-1', 'Someone Else', '5559999999', 'Different');
    expect(store.saveMessage('call-1', 'Ana', '5551234567', 'x')).toEqual(first);
    expect(await count(store, 'messages')).toBe(1);
  });

  it('knows the host stand hours', () => {
    const { clock, store } = setUp();
    expect(store.hostStandOpen()).toBe(false); // Tuesday 3 PM
    clock.now = at(17);
    expect(store.hostStandOpen()).toBe(true);
    clock.now = at(17, 0, 0, 21); // Monday
    expect(store.hostStandOpen()).toBe(false);
  });

  it('writes call records from the store', () => {
    const { store, book } = setUp();
    book('call-1');
    expect(store.recordCallEnd('call-1', 12)).toBe('booked');
    expect(store.recordCallEnd('call-9', 3)).toBe('no_change');
  });
});
