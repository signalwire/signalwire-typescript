/**
 * Outbound calls: a Dialer that dials only once every check passes (consent
 * on record, the callee's own calling hours).
 */

/** The fields of a {@link Callee}. */
export interface CalleeFields {
  /** Their number, in E.164 form. */
  number: string;
  /** Their time zone, an IANA name such as `"America/Chicago"`: the hours they may be called are theirs. */
  zone: string;
  /** What the call is about, passed to the agent as query parameters of its URL. */
  data?: Readonly<Record<string, unknown>>;
}

/** The person to be called. */
export class Callee {
  /** Their number, in E.164 form. */
  readonly number: string;
  /** Their time zone, an IANA name such as `"America/Chicago"`. */
  readonly zone: string;
  /** What the call is about, passed to the agent as query parameters of its URL. */
  readonly data: Readonly<Record<string, unknown>>;

  /**
   * @param number - Their number, in E.164 form.
   * @param zone - Their time zone, an IANA name such as `"America/Chicago"`.
   * @param data - What the call is about, passed to the agent as query parameters of its URL.
   */
  constructor(number: string, zone: string, data: Readonly<Record<string, unknown>> = {}) {
    this.number = number;
    this.zone = zone;
    this.data = Object.freeze({ ...data });
    Object.freeze(this);
  }
}

/** Thrown by `Dialer.place` instead of dialing: a check objected. */
export class NotPlaced extends Error {
  /** The person who wasn't called. */
  readonly callee: Callee;
  /** Why not: the first check's objection. */
  readonly reason: string;

  /**
   * @param callee - The person who wasn't called.
   * @param reason - Why not.
   */
  constructor(callee: Callee, reason: string) {
    super(`not calling ${callee.number}: ${reason}`);
    this.name = 'NotPlaced';
    this.callee = callee;
    this.reason = reason;
  }
}

/** `check(callee, now)` returns why the call can't be placed now, or null. */
export type Check = (callee: Callee, now: Date) => string | null | undefined;

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** A local time as `[hours, minutes, seconds, microseconds]`, compared as the reference's `time` is. */
type Clock = [number, number, number, number];

function clockOf(text: string, name: string): Clock {
  const m = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/.exec(text);
  const clock: Clock | null = m
    ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0), Number((m[4] ?? '').padEnd(6, '0'))]
    : null;
  if (clock === null || clock[0] > 23 || clock[1] > 59 || clock[2] > 59) {
    throw new Error(`${name} must be a time of day such as '09:00' or '20:30:00', got '${text}'`);
  }
  return clock;
}

function compareClocks(a: Clock, b: Clock): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
  return 0;
}

/** The callee's local weekday (Monday 0) and clock at `now`. */
function localOf(callee: Callee, now: Date): { weekday: number; clock: Clock } {
  const parts = Object.fromEntries(
    zoneFormat(callee)
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    weekday: WEEKDAYS.indexOf(String(parts['weekday'])),
    clock: [
      Number(parts['hour']),
      Number(parts['minute']),
      Number(parts['second']),
      now.getUTCMilliseconds() * 1000,
    ],
  };
}

function zoneFormat(callee: Callee): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: callee.zone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
  } catch {
    throw new Error(
      `'${callee.zone}' isn't a time zone; give an IANA name such as 'America/Chicago'`,
    );
  }
}

/**
 * A check that the callee's own clock is within `start`..`end` (and on one of
 * `days`, Monday 0 to Sunday 6, when given).
 * @param start - The earliest local time a call may start, such as `'09:00'`.
 * @param end - The latest local time a call may start, such as `'20:00'`.
 * @param opts - `days`: the weekdays calls may be placed on; null for every day.
 * @returns The check.
 * @throws {Error} For a time that isn't one.
 */
export function callingHours(
  start: string,
  end: string,
  opts: { days?: readonly number[] | null } = {},
): Check {
  const from = clockOf(start, 'start');
  const to = clockOf(end, 'end');
  const allowed = opts.days ? new Set(opts.days) : null;
  return (callee, now) => {
    const local = localOf(callee, now);
    if (allowed !== null && !allowed.has(local.weekday)) {
      return `not a calling day where they are (${WEEKDAYS[local.weekday]} in ${callee.zone})`;
    }
    if (compareClocks(from, local.clock) > 0 || compareClocks(local.clock, to) > 0) {
      const hhmm = `${String(local.clock[0]).padStart(2, '0')}:${String(local.clock[1]).padStart(2, '0')}`;
      return `outside the calling hours, it is ${hhmm} in ${callee.zone}`;
    }
    return null;
  };
}

/**
 * A check that `lookup(callee)` is true: consent on record. False is
 * withdrawn consent, null none on record; either stops the call.
 * @param lookup - The consent on record for a callee.
 * @returns The check.
 */
export function consented(lookup: (callee: Callee) => boolean | null | undefined): Check {
  return (callee) => {
    const given = lookup(callee);
    if (given === null || given === undefined) return 'no consent on record';
    return given ? null : 'consent withdrawn';
  };
}

/** The REST calling surface a {@link Dialer} needs. */
export interface DialClient {
  calling: {
    dial(from: string, to: string, options?: Record<string, unknown>): unknown;
  };
}

/** Options for a {@link Dialer}. */
export interface DialerOptions {
  /** The number calls come from. */
  fromNumber: string;
  /** The agent's URL; the callee's `data` goes on it as query parameters, for the agent's per-request configuration. */
  url?: string | null;
  /** A SWML document to run instead of an agent at a URL. */
  swml?: Readonly<Record<string, unknown>> | null;
  /** What must pass before a call is placed, in order: the first objection stops it. */
  checks?: readonly Check[];
  /** How long to ring, in seconds; the platform's default when null. */
  timeout?: number | null;
  /** Where the platform posts the call's progress. */
  statusUrl?: string | null;
  /** Which progress events to post, such as `['answered', 'ended']`. */
  statusEvents?: readonly string[] | null;
}

/**
 * Places outbound calls to an agent, once every check passes.
 *
 * @example
 * ```ts
 * const dialer = new Dialer(new RestClient(), {
 *   fromNumber: '+15550001111',
 *   url: 'https://agents.example.com/reminders',
 *   checks: [consented((c) => CONSENT[c.number]), callingHours('09:00', '20:00')],
 * });
 * try {
 *   await dialer.place(new Callee('+15557654321', 'America/Los_Angeles', { appointment: 'a1' }));
 * } catch (e) {
 *   if (e instanceof NotPlaced) console.log(e.reason);
 * }
 * ```
 */
export class Dialer {
  private readonly client: DialClient;
  private readonly from: string;
  private readonly url: string | null;
  private readonly swml: Record<string, unknown> | null;
  private readonly checks: Check[];
  private readonly timeout: number | null;
  private readonly statusUrl: string | null;
  private readonly events: string[] | null;

  /**
   * @param client - A `RestClient`.
   * @param opts - `fromNumber`, `url` or `swml`, and `checks`, `timeout`,
   *   `statusUrl` and `statusEvents`.
   * @throws {Error} Unless exactly one of `url` and `swml` is given.
   */
  constructor(client: unknown, opts: DialerOptions) {
    const url = opts.url ?? null;
    const swml = opts.swml ?? null;
    if ((url === null) === (swml === null)) {
      throw new Error('Dialer takes url (an agent) or swml (a document), one of them');
    }
    this.client = client as DialClient;
    this.from = opts.fromNumber;
    this.url = url;
    this.swml = swml ? { ...swml } : null;
    this.checks = [...(opts.checks ?? [])];
    this.timeout = opts.timeout ?? null;
    this.statusUrl = opts.statusUrl ?? null;
    this.events = opts.statusEvents && opts.statusEvents.length > 0 ? [...opts.statusEvents] : null;
  }

  /**
   * Why a call to `callee` can't be placed now, or null when every check passes.
   * @param callee - The person to be called.
   * @param now - The time to check at, for tests. Defaults to the current time.
   * @returns The first objection, or null.
   * @throws {Error} For a callee whose zone isn't a time zone.
   */
  whyNot(callee: Callee, now?: Date | null): string | null {
    zoneFormat(callee);
    const when = now ?? new Date();
    if (!(when instanceof Date) || Number.isNaN(when.getTime())) {
      throw new TypeError('now must be a Date');
    }
    for (const check of this.checks) {
      const reason = check(callee, when);
      if (reason) return reason;
    }
    return null;
  }

  /**
   * Dial `callee` once every check passes; throws {@link NotPlaced} with the
   * first objection otherwise, and makes no request.
   * @param callee - The person to be called.
   * @param now - The time to check at, for tests.
   * @returns The platform's answer to the dial.
   */
  async place(callee: Callee, now?: Date | null): Promise<unknown> {
    const reason = this.whyNot(callee, now);
    if (reason) throw new NotPlaced(callee, reason);
    const options: Record<string, unknown> = {};
    if (this.url !== null) {
      const query = Object.entries(callee.data)
        .map(([k, v]) => `${quotePlus(k)}=${quotePlus(pyStr(v))}`)
        .join('&');
      options['url'] = query
        ? `${this.url}${this.url.includes('?') ? '&' : '?'}${query}`
        : this.url;
    } else {
      options['swml'] = this.swml;
    }
    if (this.statusUrl) options['status_url'] = this.statusUrl;
    if (this.events) options['status_events'] = this.events;
    if (this.timeout !== null) options['extras'] = { timeout: this.timeout };
    return await this.client.calling.dial(this.from, callee.number, options);
  }
}

/** Text as the reference's `urlencode` quotes it: only letters, digits and `_.-~` stay, a space is `+`. */
function quotePlus(text: string): string {
  return encodeURIComponent(text)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

/** A value as the reference's `str()` writes it, for the query string. */
function pyStr(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
