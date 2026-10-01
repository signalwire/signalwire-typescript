/**
 * Shared test helpers for Penny, the full-guardrails tutorial agent
 * (tutorial/full-guardrails-agent/): a clock the tests control, a fresh
 * reservation book, and a simulated call that drives the agent's HTTP app
 * as SignalWire does.
 *
 * None of this places a phone call. It proves the rules and the configuration;
 * speech, timing and the live platform still need a real call.
 */

import { createHmac } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resetLoggingConfiguration } from '../../src/index.js';
import { ReservationStore } from '../../tutorial/full-guardrails-agent/reservations.js';

// The agent refuses to start without real secrets; these are throwaway test values.
export const TEST_ENV = {
  SWML_BASIC_AUTH_USER: 'penny',
  SWML_BASIC_AUTH_PASSWORD: 'test-password',
  SIGNALWIRE_SIGNING_KEY: 'test-signing-key',
  SIGNALWIRE_SWAIG_SECRET: 'test-swaig',
  PENNY_HOST_NUMBER: '+15555550100',
  PENNY_SMS_FROM: '+15555550199',
};
Object.assign(process.env, TEST_ENV);
process.env['SIGNALWIRE_LOG_MODE'] ??= 'off';
resetLoggingConfiguration(); // re-reads SIGNALWIRE_LOG_MODE, so the SDK stays quiet

export type Json = Record<string, unknown>;

// region: clock
/** 3 PM on Tuesday, September 22, 2026, in the restaurant's time zone (EDT). */
export const TUESDAY_3PM = new Date('2026-09-22T15:00:00-04:00');

/** That Tuesday, or another day that week, at another time. */
export function at(hour: number, minute = 0, second = 0, day = 22): Date {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return new Date(`2026-09-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}-04:00`);
}

/** A clock the tests can move: the store reads `clock.now` whenever it needs the time. */
export class Clock {
  constructor(public now: Date = TUESDAY_3PM) {}

  advance(seconds: number): void {
    this.now = new Date(this.now.getTime() + seconds * 1000);
  }
}

export function newStore(clock: Clock = new Clock()): ReservationStore {
  const dir = mkdtempSync(join(tmpdir(), 'penny-'));
  return new ReservationStore(join(dir, 'test.sqlite3'), () => clock.now);
}
// endregion: clock

/** How many rows a table holds, read straight from the book's SQLite file. */
export async function count(store: ReservationStore, table: string): Promise<number> {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(store.path, { readOnly: true });
  try {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    return row.n;
  } finally {
    db.close();
  }
}

export const AUTH = {
  Authorization:
    'Basic ' +
    Buffer.from(`${TEST_ENV.SWML_BASIC_AUTH_USER}:${TEST_ENV.SWML_BASIC_AUTH_PASSWORD}`).toString(
      'base64',
    ),
};

/** The app an agent serves: `serve()` hands this same `getApp()` to the HTTP server. */
interface Served {
  getApp(): { request(path: string, init?: RequestInit): Response | Promise<Response> };
}

/** The ai verb of a SWML document. */
export function aiVerb(swml: Json): Json {
  const main = (swml['sections'] as { main: Json[] }).main;
  const verb = main.find((v) => 'ai' in v);
  if (!verb) throw new Error('no ai verb in the SWML');
  return verb['ai'] as Json;
}

// region: served-app
/** Fetch the SWML over HTTP from the app Penny serves, as SignalWire would. */
export async function servedSwml(penny: Served, callId = 'call-1'): Promise<Json> {
  const res = await penny.getApp().request(`/penny?call_id=${callId}`, { headers: AUTH });
  if (res.status !== 200) throw new Error(`GET /penny returned ${res.status}`);
  return (await res.json()) as Json;
}
// endregion: served-app

/** Extra fields the platform sends with a tool request. */
export interface CallData {
  global_data?: Json;
  caller_id_num?: string;
}

/** One simulated call against Penny's HTTP app: signed tool requests with this call's tokens. */
export class Call {
  private tokens: Record<string, string> | null = null;

  constructor(
    readonly penny: Served,
    readonly callId: string = 'call-1',
  ) {}

  /** The per-call token SignalWire would use for `fn`, from this call's SWML. */
  async token(fn: string): Promise<string> {
    if (this.tokens === null) {
      const functions = (aiVerb(await servedSwml(this.penny, this.callId))['SWAIG'] as Json)[
        'functions'
      ] as Json[];
      this.tokens = Object.fromEntries(
        functions.map((f) => [
          String(f['function']),
          new URL(String(f['web_hook_url'])).searchParams.get('__token') ?? '',
        ]),
      );
    }
    return this.tokens[fn] ?? '';
  }

  /** POST /penny/swaig, signed as SignalWire signs it. */
  async invoke(
    fn: string,
    args: Json = {},
    data: CallData = {},
    opts: { sign?: boolean; auth?: boolean; token?: string; callId?: string | null } = {},
  ): Promise<{ status: number; body: Json }> {
    const path = `/penny/swaig?__token=${opts.token ?? (await this.token(fn))}`;
    const body = JSON.stringify({
      function: fn,
      ...(opts.callId === null ? {} : { call_id: opts.callId ?? this.callId }),
      argument: { parsed: [args], raw: JSON.stringify(args) },
      global_data: data.global_data ?? {},
      ...(data.caller_id_num ? { caller_id_num: data.caller_id_num } : {}),
    });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.auth !== false) Object.assign(headers, AUTH);
    if (opts.sign !== false) {
      headers['X-SignalWire-Sha256-Signature'] = createHmac(
        'sha256',
        TEST_ENV.SIGNALWIRE_SIGNING_KEY,
      )
        .update(`http://localhost${path}${body}`)
        .digest('hex');
    }
    const res = await this.penny.getApp().request(path, { method: 'POST', headers, body });
    const text = await res.text();
    const isJson = res.headers.get('content-type')?.includes('application/json');
    return { status: res.status, body: isJson ? (JSON.parse(text) as Json) : { text } };
  }

  /** A tool's response body, which must come back with 200. */
  async tool(fn: string, args: Json = {}, data: CallData = {}): Promise<Json> {
    const { status, body } = await this.invoke(fn, args, data);
    if (status !== 200) throw new Error(`${fn} returned ${status}: ${JSON.stringify(body)}`);
    return body;
  }
}

// What a tool result tells the model, and what it tells the platform.
export const toolResult = (result: Json): string =>
  String((result['response'] as { tool_result?: string }).tool_result);
export const toolPrompt = (result: Json): string =>
  String((result['response'] as { tool_prompt?: string }).tool_prompt);
export const actions = (result: Json): Json[] => (result['action'] as Json[] | undefined) ?? [];

/** Each action's kind: a SWML action counts as its verb, and `transfer` is a flag, not an action. */
export function actionKeys(result: Json): string[] {
  return actions(result).flatMap((act) =>
    'SWML' in act
      ? Object.keys((act['SWML'] as { sections: { main: Json[] } }).sections.main[0]!)
      : Object.keys(act).filter((k) => k !== 'transfer'),
  );
}

/** The UI events a result sends. */
export function events(result: Json): Json[] {
  return actions(result)
    .map((act) => (act['SWML'] as { sections: { main: Json[] } } | undefined)?.sections.main[0])
    .filter((verb): verb is Json => verb !== undefined && 'user_event' in verb)
    .map((verb) => (verb['user_event'] as { event: Json }).event);
}

/** Where a result moves the conversation, if anywhere. */
export function movedTo(result: Json): string | undefined {
  const act = actions(result).find((a) => 'change_step' in a || 'change_context' in a);
  return act ? String(act['change_step'] ?? act['change_context']) : undefined;
}
