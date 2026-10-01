/**
 * The Copper Pot reservation book: every business rule, and no SignalWire import.
 *
 * This module decides what is available, what a party may book, who has proved
 * they own a reservation, what is on hold, and what is committed. The voice
 * agent can only *ask* it to do those things. If the language model were swapped
 * for a web form tomorrow, every rule here would still hold.
 *
 * It uses Node's built-in SQLite module (node:sqlite), so it needs Node.js
 * 22.16 or later and no package.
 *
 * Copyright (c) 2025 SignalWire. Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { randomInt } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const RESTAURANT_TZ = 'America/New_York';

// region: policy
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
// endregion: policy

// Short, speakable facts the agent may look up. Nothing here is a promise the
// kitchen or the host stand has to keep, so it is safe to say verbatim.
export const HOUSE_FACTS: Record<string, string> = {
  hours:
    'Dinner is served Tuesday through Sunday, with seatings from 5 PM to 8:30 PM. We are closed on Mondays.',
  location: "We're at 14 Worcester Street, across from the old train station.",
  parking: 'There is free street parking after 6 PM and a paid garage half a block away.',
  dress_code: 'There is no dress code. Come as you are.',
  large_parties:
    'Parties larger than six are booked by our events team, who can arrange a private room.',
  cancellation_policy: 'You can cancel any time before your reservation at no charge.',
  dietary:
    'The kitchen can adapt most dishes for vegetarian, vegan and gluten-free diets. Mention allergies to your server.',
};

const CODE_ALPHABET = 'ACDEFHJKMNPQRTUVWXY34679'; // no 0/O, 1/I, 2/Z, 5/S or 8/B to mishear
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
// prettier-ignore
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
// prettier-ignore
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
  october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const FILLER = new Set(['on', 'the', 'for', 'this', 'coming', 'day', 'night', 'evening', 'of']);

/**
 * A request the house cannot honor.
 *
 * `fact` is what is true; `ask` is what the agent should do about it.
 * Handlers pass them to the model as tool_result and tool_prompt.
 */
export class PolicyError extends Error {
  constructor(
    readonly fact: string,
    readonly ask: string,
  ) {
    super(fact);
    this.name = new.target.name;
  }
}

/** The party is bigger than the phone line may book. */
export class LargePartyError extends PolicyError {}

/** Too many failed verification attempts on this call. */
export class LockedOutError extends PolicyError {}

// -----------------------------------------------------------------------------
// Calendar days and the restaurant's clock
// -----------------------------------------------------------------------------

/** A calendar day, written as an ISO date such as "2026-09-25". */
export type Day = string;

const DAY_MS = 86_400_000;

function dayOf(year: number, month: number, day: number): Day | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null; // February 30th rolls into March
  return date.toISOString().slice(0, 10);
}

function parts(day: Day): [number, number, number] {
  const [year, month, date] = day.split('-').map(Number);
  return [year ?? 0, month ?? 0, date ?? 0];
}

/** The day `count` days after `day`. */
export function addDays(day: Day, count: number): Day {
  const [year, month, date] = parts(day);
  return new Date(Date.UTC(year, month - 1, date) + count * DAY_MS).toISOString().slice(0, 10);
}

/** 0 for Monday through 6 for Sunday. */
export function weekday(day: Day): number {
  const [year, month, date] = parts(day);
  return (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7;
}

const WALL_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: RESTAURANT_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** What the restaurant's clock reads at `instant`: the day, and seconds since midnight. */
function wallClock(instant: Date): { day: Day; seconds: number } {
  const field = (type: string): number =>
    Number(WALL_CLOCK.formatToParts(instant).find((p) => p.type === type)?.value ?? 0);
  return {
    day: dayOf(field('year'), field('month'), field('day')) ?? '',
    seconds: field('hour') * 3600 + field('minute') * 60 + field('second'),
  };
}

// -----------------------------------------------------------------------------
// Speaking and hearing dates, times and codes
// -----------------------------------------------------------------------------

// region: resolve-date
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
// endregion: resolve-date

/** The first date on or after today that falls on `day` of its month. */
function nextDayOfMonth(day: number, today: Day): Day | null {
  let [year, month] = parts(today);
  for (let i = 0; i < 13; i++) {
    const candidate = dayOf(year, month, day);
    if (candidate !== null && candidate >= today) return candidate;
    [year, month] = month === 12 ? [year + 1, 1] : [year, month + 1];
  }
  return null;
}

/** The next `month`/`day` on or after today. */
function upcoming(month: number, day: number, today: Day): Day | null {
  const [year] = parts(today);
  const candidate = dayOf(year, month, day);
  if (candidate !== null && candidate < today) return dayOf(year + 1, month, day);
  return candidate;
}

/**
 * Minutes after midnight for "7:30 pm", "19:30" or "7", or null.
 *
 * Dinner only: a bare "7:30" means 7:30 in the evening.
 */
export function resolveTime(text: string): number | null {
  const t = (text || '').toLowerCase().replaceAll('.', '').replaceAll("o'clock", '').trim();
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/.exec(t);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const meridiem = m[3];
  if (hour > 23 || minute > 59) return null;
  if ((meridiem === 'pm' || meridiem === 'p') && hour < 12) hour += 12;
  else if ((meridiem === 'am' || meridiem === 'a') && hour === 12) hour = 0;
  else if (meridiem === undefined && hour >= 1 && hour <= 11) hour += 12;
  return hour * 60 + minute;
}

/** "Friday, September 25". */
export function spokenDate(day: Day): string {
  const [, month, date] = parts(day);
  const name = WEEKDAYS[weekday(day)]!;
  return `${name[0]!.toUpperCase()}${name.slice(1)}, ${MONTH_NAMES[month - 1]} ${date}`;
}

/** "7:30 PM", or "7 PM" on the hour. */
export function spokenTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return minute ? `${hour12}:${String(minute).padStart(2, '0')} ${suffix}` : `${hour12} ${suffix}`;
}

/** "K7QP4M" becomes "K 7 Q P 4 M", so text-to-speech reads it one character at a time. */
export function spokenCode(code: string): string {
  return [...code].join(' ');
}

export function normalizeCode(text: unknown): string {
  return String(text ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// -----------------------------------------------------------------------------
// Values handed to the agent
// -----------------------------------------------------------------------------

export class Option {
  constructor(
    readonly number: number, // what the model and caller see
    readonly tableId: string, // what they never see
    readonly day: Day,
    readonly start: number,
  ) {}

  spoken(): string {
    return `option ${this.number}, ${spokenTime(this.start)}`;
  }
}

export class Request {
  constructor(
    readonly partySize: number,
    readonly day: Day,
    readonly start: number,
    readonly name: string,
  ) {}

  spoken(): string {
    return (
      `a table for ${this.partySize} on ${spokenDate(this.day)} ` +
      `around ${spokenTime(this.start)}, under ${this.name}`
    );
  }
}

export class Proposal {
  constructor(
    readonly revision: number,
    readonly day: Day,
    readonly start: number,
    readonly partySize: number,
    readonly name: string,
  ) {}

  spoken(): string {
    return (
      `a table for ${this.partySize} on ${spokenDate(this.day)} ` +
      `at ${spokenTime(this.start)}, under ${this.name}`
    );
  }
}

export class Reservation {
  constructor(
    readonly code: string,
    readonly day: Day,
    readonly start: number,
    readonly partySize: number,
    readonly name: string,
    readonly status: string,
  ) {}

  spoken(): string {
    return (
      `a table for ${this.partySize} on ${spokenDate(this.day)} ` +
      `at ${spokenTime(this.start)}, under ${this.name}`
    );
  }
}

// -----------------------------------------------------------------------------
// The store
// -----------------------------------------------------------------------------

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
    call_id TEXT PRIMARY KEY,
    draft TEXT NOT NULL DEFAULT '{}',
    request TEXT NOT NULL DEFAULT '{}',
    offers TEXT NOT NULL DEFAULT '[]',
    proposal_counter INTEGER NOT NULL DEFAULT 0,
    verified_code TEXT,
    verify_failures INTEGER NOT NULL DEFAULT 0,
    cancel_revision INTEGER,
    cancel_counter INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS holds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id TEXT NOT NULL,
    table_id TEXT NOT NULL,
    day TEXT NOT NULL,
    start INTEGER NOT NULL,
    party_size INTEGER NOT NULL,
    name TEXT NOT NULL,
    revision INTEGER NOT NULL,
    expires_at REAL NOT NULL,
    status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reservations (
    code TEXT PRIMARY KEY,
    hold_id INTEGER UNIQUE,
    call_id TEXT,
    table_id TEXT NOT NULL,
    day TEXT NOT NULL,
    start INTEGER NOT NULL,
    party_size INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    sms_requests INTEGER NOT NULL DEFAULT 0,
    sms_requested_at REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS messages (
    call_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    callback TEXT NOT NULL,
    body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS call_records (
    call_id TEXT PRIMARY KEY,
    turns INTEGER NOT NULL,
    outcome TEXT NOT NULL
);
`;

interface SessionRow {
  call_id: string;
  draft: string;
  request: string;
  offers: string;
  proposal_counter: number;
  verified_code: string | null;
  verify_failures: number;
  cancel_revision: number | null;
  cancel_counter: number;
}

interface HoldRow {
  id: number;
  call_id: string;
  table_id: string;
  day: Day;
  start: number;
  party_size: number;
  name: string;
  revision: number;
  expires_at: number;
  status: string;
}

interface ReservationRow {
  code: string;
  day: Day;
  start: number;
  party_size: number;
  name: string;
  status: string;
  sms_requests: number;
  sms_requested_at: number;
}

interface Offer {
  number: number;
  table_id: string;
  day: Day;
  start: number;
}

/** The details a caller has asked for so far. Each one is caller input until checked. */
export type Draft = Record<'party_size' | 'date' | 'time' | 'name', unknown>;

const DRAFT_KEYS = ['party_size', 'date', 'time', 'name'] as const;

const isBlank = (value: unknown): boolean => value === undefined || value === null || value === '';

/**
 * The system of record. One SQLite file; every write is a transaction.
 *
 * State is keyed by `callId` so it survives restarts and never depends on
 * what the conversation remembers. A call id correlates a session; it is not
 * proof of who is calling.
 */
export class ReservationStore {
  private readonly db: DatabaseSync;

  constructor(
    readonly path: string,
    readonly clock: () => Date = () => new Date(),
  ) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    this.db.exec(SCHEMA);
  }

  /** Run `work` in one write transaction: all of it commits, or none of it does. */
  private tx<T>(work: (db: DatabaseSync) => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work(this.db);
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** Close the database. The store can't be used afterwards. */
  close(): void {
    this.db.close();
  }

  private static checkCall(callId: unknown): asserts callId is string {
    if (typeof callId !== 'string' || !callId || callId.length > 256) {
      throw new Error('Missing or invalid call context.');
    }
  }

  private session(db: DatabaseSync, callId: string): SessionRow {
    ReservationStore.checkCall(callId);
    db.prepare('INSERT OR IGNORE INTO sessions (call_id) VALUES (?)').run(callId);
    return db
      .prepare('SELECT * FROM sessions WHERE call_id=?')
      .get(callId) as unknown as SessionRow;
  }

  private now(): Date {
    return this.clock();
  }

  /** The restaurant's date today. */
  today(): Day {
    return wallClock(this.now()).day;
  }

  // ---------------------------------------------------------------------------
  // Availability
  // ---------------------------------------------------------------------------

  private tableFree(
    db: DatabaseSync,
    tableId: string,
    day: Day,
    start: number,
    callId: string,
  ): boolean {
    const busy = db
      .prepare(
        "SELECT 1 FROM reservations WHERE table_id=? AND day=? AND status='confirmed' " +
          'AND ABS(start - ?) < ?',
      )
      .get(tableId, day, start, DINING_MINUTES);
    const held = db
      .prepare(
        "SELECT 1 FROM holds WHERE table_id=? AND day=? AND status='live' AND call_id<>? " +
          'AND expires_at > ? AND ABS(start - ?) < ?',
      )
      .get(tableId, day, callId, this.now().getTime() / 1000, start, DINING_MINUTES);
    return busy === undefined && held === undefined;
  }

  /**
   * Whether a seating starts less than SAME_DAY_LEAD_MINUTES from now.
   *
   * Both sides are wall-clock times in the restaurant's zone. Seatings are in
   * the evening, hours away from a daylight-saving change, so that's exact.
   */
  private tooSoon(day: Day, start: number): boolean {
    const now = wallClock(this.now());
    const [ny, nm, nd] = parts(now.day);
    const [sy, sm, sd] = parts(day);
    const nowAt = Date.UTC(ny, nm - 1, nd) / 1000 + now.seconds;
    const startsAt = Date.UTC(sy, sm - 1, sd) / 1000 + start * 60;
    return startsAt < nowAt + SAME_DAY_LEAD_MINUTES * 60;
  }

  /** Refuse a seating that is no longer far enough ahead to book. */
  private checkNotice(day: Day, start: number): void {
    if (this.tooSoon(day, start)) {
      throw new PolicyError(
        'That seating is too soon to book now.',
        'Apologize and check availability again.',
      );
    }
  }

  private validateRequest(
    partySize: unknown,
    dateText: unknown,
    timeText: unknown,
    name: unknown,
  ): [number, Day, number, string] {
    let party = partySize;
    if (typeof party === 'string' && /^\s*\d+\s*$/.test(party)) party = Number(party);
    if (typeof party !== 'number' || !Number.isInteger(party) || party < 1) {
      throw new PolicyError(
        "The party size wasn't a number of people.",
        'Ask how many people will be dining.',
      );
    }
    if (party > MAX_PHONE_PARTY) {
      throw new LargePartyError(
        `Parties larger than ${MAX_PHONE_PARTY} are booked by the events team.`,
        'Explain that, and offer to connect them with a person.',
      );
    }
    const today = this.today();
    const day = resolveDate(String(dateText ?? ''), today);
    if (day === null) {
      throw new PolicyError(
        "That date couldn't be understood.",
        "Ask for the date again, for example 'Friday' or 'September 26'.",
      );
    }
    if (day < today) {
      throw new PolicyError(
        `${spokenDate(day)} has already passed.`,
        'Ask for a date from today onward.',
      );
    }
    if (day > addDays(today, BOOKING_WINDOW_DAYS)) {
      throw new PolicyError(
        `Reservations open ${BOOKING_WINDOW_DAYS} days ahead.`,
        'Ask for a date within the next month.',
      );
    }
    if (CLOSED_WEEKDAYS.has(weekday(day))) {
      const [, month, date] = parts(day);
      throw new PolicyError(
        `We're closed on Mondays, and ${MONTH_NAMES[month - 1]} ${date} is a Monday.`,
        'Ask for another date.',
      );
    }
    const start = resolveTime(String(timeText ?? ''));
    if (start === null) {
      throw new PolicyError(
        "That time couldn't be understood.",
        "Ask what time they'd like, for example '7:30 PM'.",
      );
    }
    const cleanName = String(name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');
    if (!cleanName || cleanName.length > 60) {
      throw new PolicyError(
        'The reservation needs a name.',
        'Ask for the name for the reservation.',
      );
    }
    return [party, day, start, cleanName];
  }

  // region: find-options
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
  // endregion: find-options

  // region: update-draft
  /**
   * Apply a correction to what this call has asked for, and return the result.
   *
   * The draft is kept whether or not a search passes the rules, so a correction
   * to a refused search isn't lost. The first search starts from `gathered`.
   */
  updateDraft(
    callId: string,
    changes: Record<string, unknown>,
    gathered: Record<string, unknown>,
  ): Draft {
    return this.tx((db) => {
      let draft = JSON.parse(this.session(db, callId).draft) as Draft;
      if (Object.keys(draft).length === 0) {
        draft = Object.fromEntries(DRAFT_KEYS.map((key) => [key, gathered[key] ?? null])) as Draft;
      }
      for (const key of DRAFT_KEYS) {
        if (!isBlank(changes[key])) draft[key] = changes[key];
      }
      db.prepare('UPDATE sessions SET draft=? WHERE call_id=?').run(JSON.stringify(draft), callId);
      return draft;
    });
  }
  // endregion: update-draft

  /** Forget this call's booking in progress, so a new one starts from gathered answers. */
  resetRequest(callId: string): void {
    this.tx((db) => {
      this.session(db, callId);
      db.prepare("UPDATE sessions SET draft='{}', request='{}', offers='[]' WHERE call_id=?").run(
        callId,
      );
      db.prepare("UPDATE holds SET status='released' WHERE call_id=? AND status='live'").run(
        callId,
      );
    });
  }

  // region: hold-option
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
  // endregion: hold-option

  private static proposal(row: HoldRow): Proposal {
    return new Proposal(row.revision, row.day, row.start, row.party_size, row.name);
  }

  private static reservation(row: ReservationRow): Reservation {
    return new Reservation(row.code, row.day, row.start, row.party_size, row.name, row.status);
  }

  // region: confirm
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
  // endregion: confirm

  private static newCode(db: DatabaseSync): string {
    for (;;) {
      const code = Array.from(
        { length: 6 },
        () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
      ).join('');
      if (db.prepare('SELECT 1 FROM reservations WHERE code=?').get(code) === undefined)
        return code;
    }
  }

  /** The most recent reservation this call created, if any. */
  bookingForCall(callId: string): Reservation | null {
    ReservationStore.checkCall(callId);
    return this.tx((db) => {
      const row = db
        .prepare(
          "SELECT * FROM reservations WHERE call_id=? AND status='confirmed' " +
            'ORDER BY rowid DESC LIMIT 1',
        )
        .get(callId) as ReservationRow | undefined;
      return row ? ReservationStore.reservation(row) : null;
    });
  }

  // region: request-sms
  /**
   * Record a request to text a booking, and say whether to send it.
   *
   * The platform sends the text after the tool returns, so nothing here can
   * know it arrived. A repeat within SMS_RESEND_SECONDS is a duplicate and
   * isn't sent. After that, a caller who didn't get it may ask again, up to
   * MAX_SMS_PER_BOOKING times. Returns "send", "duplicate" or "limit".
   */
  requestSms(code: string): 'send' | 'duplicate' | 'limit' {
    const now = this.now().getTime() / 1000;
    return this.tx((db) => {
      const row = db
        .prepare('SELECT sms_requests, sms_requested_at FROM reservations WHERE code=?')
        .get(code) as unknown as ReservationRow;
      if (row.sms_requests >= MAX_SMS_PER_BOOKING) return 'limit';
      if (row.sms_requests && now - row.sms_requested_at < SMS_RESEND_SECONDS) return 'duplicate';
      db.prepare(
        'UPDATE reservations SET sms_requests = sms_requests + 1, sms_requested_at = ? WHERE code=?',
      ).run(now, code);
      return 'send';
    });
  }
  // endregion: request-sms

  // ---------------------------------------------------------------------------
  // Managing an existing reservation
  // ---------------------------------------------------------------------------

  // region: verify
  /**
   * Bind a reservation to this call if the caller knows its code and name.
   *
   * A wrong answer never says which half was wrong, and the third failure
   * on a call locks the lookup for the rest of that call.
   */
  verify(callId: string, codeText: unknown, lastName: unknown): Reservation {
    const failures = this.tx((db) => {
      const session = this.session(db, callId);
      if (session.verify_failures >= MAX_VERIFY_ATTEMPTS) {
        throw new LockedOutError(
          'Too many attempts on this call.',
          "Say you can't look it up by phone right now, and offer a person.",
        );
      }
      const row = db
        .prepare('SELECT * FROM reservations WHERE code=?')
        .get(normalizeCode(codeText)) as ReservationRow | undefined;
      const said = String(lastName ?? '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .join(' ');
      const onFile = row ? row.name.toLowerCase().split(/\s+/).filter(Boolean) : [];
      if (row && said && (said === onFile.join(' ') || said === onFile.at(-1))) {
        db.prepare('UPDATE sessions SET verified_code=?, cancel_revision=NULL WHERE call_id=?').run(
          row.code,
          callId,
        );
        return ReservationStore.reservation(row);
      }
      const count = session.verify_failures + 1;
      db.prepare('UPDATE sessions SET verify_failures=? WHERE call_id=?').run(count, callId);
      return count;
    });
    if (failures instanceof Reservation) return failures;
    // Thrown after the transaction commits, so the failed attempt is counted.
    if (failures >= MAX_VERIFY_ATTEMPTS) {
      throw new LockedOutError(
        'Too many attempts on this call.',
        "Say you can't look it up by phone right now, and offer a person.",
      );
    }
    throw new PolicyError(
      "That code and last name don't match a reservation.",
      'Ask the caller to check the code and say it again.',
    );
  }
  // endregion: verify

  // region: verified
  /** Every manage operation starts here: what has *this* call verified? */
  private verified(db: DatabaseSync, callId: string): [SessionRow, ReservationRow] {
    const session = this.session(db, callId);
    if (!session.verified_code) {
      throw new PolicyError(
        "This call hasn't verified a reservation.",
        'Ask for the confirmation code and last name first.',
      );
    }
    const row = db
      .prepare('SELECT * FROM reservations WHERE code=?')
      .get(session.verified_code) as unknown as ReservationRow;
    return [session, row];
  }
  // endregion: verified

  verifiedReservation(callId: string): Reservation {
    return this.tx((db) => ReservationStore.reservation(this.verified(db, callId)[1]));
  }

  // region: cancel
  /** Stage a cancellation and return the revision that must confirm it. */
  requestCancel(callId: string): [Reservation, number] {
    return this.tx((db) => {
      const [session, row] = this.verified(db, callId);
      if (row.status === 'cancelled') {
        throw new PolicyError(
          'That reservation is already cancelled.',
          "Tell the caller, and ask if there's anything else.",
        );
      }
      const revision = session.cancel_counter + 1;
      db.prepare('UPDATE sessions SET cancel_counter=?, cancel_revision=? WHERE call_id=?').run(
        revision,
        revision,
        callId,
      );
      return [ReservationStore.reservation(row), revision];
    });
  }

  /** Cancel, but only the staged cancellation the caller agreed to. */
  confirmCancel(callId: string, revision: unknown): Reservation {
    return this.tx((db) => {
      const [session, row] = this.verified(db, callId);
      if (row.status === 'cancelled') return ReservationStore.reservation(row); // a repeated confirm is harmless
      if (typeof revision !== 'number' || session.cancel_revision !== revision) {
        throw new PolicyError(
          "There's no matching cancellation waiting to be confirmed.",
          'Read the reservation back and ask whether to cancel it.',
        );
      }
      db.prepare("UPDATE reservations SET status='cancelled' WHERE code=?").run(row.code);
      db.prepare('UPDATE sessions SET cancel_revision=NULL WHERE call_id=?').run(callId);
      const cancelled = db.prepare('SELECT * FROM reservations WHERE code=?').get(row.code);
      return ReservationStore.reservation(cancelled as unknown as ReservationRow);
    });
  }
  // endregion: cancel

  keepReservation(callId: string): Reservation {
    return this.tx((db) => {
      const [, row] = this.verified(db, callId);
      db.prepare('UPDATE sessions SET cancel_revision=NULL WHERE call_id=?').run(callId);
      return ReservationStore.reservation(row);
    });
  }

  // ---------------------------------------------------------------------------
  // Messages, the host stand, and call records
  // ---------------------------------------------------------------------------

  /** Store one message per call; saving again returns the first one. */
  saveMessage(
    callId: string,
    name: string,
    callback: string,
    body: string,
  ): { name: string; callback: string; body: string } {
    const digits = (callback || '').replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      throw new PolicyError(
        "The callback number didn't have enough digits.",
        'Ask for a callback number including the area code.',
      );
    }
    const clean = (text: string): string => (text || '').split(/\s+/).filter(Boolean).join(' ');
    const [cleanName, cleanBody] = [clean(name), clean(body)];
    if (!cleanName || !cleanBody) {
      throw new PolicyError(
        'The message needs a name and a few words.',
        'Ask for whatever is missing.',
      );
    }
    return this.tx((db) => {
      this.session(db, callId);
      db.prepare('INSERT OR IGNORE INTO messages VALUES (?,?,?,?)').run(
        callId,
        cleanName.slice(0, 60),
        digits,
        cleanBody.slice(0, 500),
      );
      const row = db.prepare('SELECT * FROM messages WHERE call_id=?').get(callId) as {
        name: string;
        callback: string;
        body: string;
      };
      return { name: row.name, callback: row.callback, body: row.body };
    });
  }

  hostStandOpen(): boolean {
    const now = wallClock(this.now());
    const minute = Math.floor(now.seconds / 60);
    return (
      !CLOSED_WEEKDAYS.has(weekday(now.day)) &&
      HOST_STAND_HOURS[0] <= minute &&
      minute < HOST_STAND_HOURS[1]
    );
  }

  /** Write what actually happened on this call, from the store, not the transcript. */
  recordCallEnd(callId: string, turns: number): string {
    return this.tx((db) => {
      this.session(db, callId);
      let outcome: string;
      if (
        db.prepare("SELECT 1 FROM reservations WHERE call_id=? AND status='confirmed'").get(callId)
      ) {
        outcome = 'booked';
      } else if (
        db
          .prepare(
            'SELECT 1 FROM sessions s JOIN reservations r ON r.code = s.verified_code ' +
              "WHERE s.call_id=? AND r.status='cancelled'",
          )
          .get(callId)
      ) {
        outcome = 'cancelled';
      } else if (db.prepare('SELECT 1 FROM messages WHERE call_id=?').get(callId)) {
        outcome = 'message';
      } else {
        outcome = 'no_change';
      }
      db.prepare('INSERT OR REPLACE INTO call_records VALUES (?,?,?)').run(
        callId,
        Math.trunc(turns),
        outcome,
      );
      return outcome;
    });
  }

  /** Add one known reservation (code K7QP4M, Rivera) so the manage flow can be tried. */
  seedDemo(): string | null {
    return this.tx((db) => {
      if (db.prepare('SELECT 1 FROM reservations').get()) return null;
      let day = addDays(this.today(), 2);
      while (CLOSED_WEEKDAYS.has(weekday(day))) day = addDays(day, 1);
      db.prepare(
        'INSERT INTO reservations (code, hold_id, call_id, table_id, day, start, ' +
          "party_size, name, status) VALUES ('K7QP4M', NULL, 'seed', 'T4', ?, ?, 4, " +
          "'Maria Rivera', 'confirmed')",
      ).run(day, 19 * 60);
      return 'K7QP4M';
    });
  }
}
