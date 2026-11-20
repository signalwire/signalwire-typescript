/**
 * Continuity: carry a conversation across a switch between voice and chat.
 */

import type { AgentBase } from '../../AgentBase.js';
import { LegStore } from './legs.js';

/** One turn of a conversation, as the platform's `convo` and call log hold it. */
export type Turn = Record<string, unknown>;

function objectOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Which medium a request belongs to: `"voice"` or `"chat"`.
 *
 * The platform sends `conversation_type` on the SWML request; it may also have
 * been copied into user variables or global data for a later tool request that
 * doesn't carry it. Anything unrecognised is voice, because voice is where
 * getting it wrong is audible.
 * @param body - The request.
 * @returns The medium.
 */
export function mediumOf(body: Record<string, unknown> | null | undefined): string {
  const d = body ?? {};
  const kind =
    d['conversation_type'] ||
    objectOf(objectOf(d['vars'])['userVariables'])['conversation_type'] ||
    objectOf(d['global_data'])['conversation_type'] ||
    'voice';
  return String(kind).trim().toLowerCase() === 'chat' ? 'chat' : 'voice';
}

/**
 * Enforce the convo tool-pairing rule: every assistant `tool_calls` turn must
 * be followed by a `tool` result for each call id, and every `tool` result
 * must answer a call that is present. Orphan results are dropped, and an
 * assistant turn whose results did not survive is dropped (an unanswered call
 * is an invalid request). Plain turns pass through untouched.
 * @param convo - The turns.
 * @returns The turns, paired.
 */
export function pairTools(convo: readonly Turn[]): Turn[] {
  const resultIds = new Set(
    convo.filter((m) => m['role'] === 'tool' && m['tool_call_id']).map((m) => m['tool_call_id']),
  );
  const out: Turn[] = [];
  const keptCallIds = new Set<unknown>();
  for (const m of convo) {
    const calls = m['tool_calls'];
    if (m['role'] === 'assistant' && Array.isArray(calls) && calls.length > 0) {
      const kept = (calls as Record<string, unknown>[]).filter((tc) => resultIds.has(tc['id']));
      if (kept.length === 0) continue;
      for (const tc of kept) keptCallIds.add(tc['id']);
      out.push({ ...m, tool_calls: kept });
    } else if (m['role'] === 'tool') {
      if (keptCallIds.has(m['tool_call_id'])) out.push(m);
    } else {
      out.push(m);
    }
  }
  return out;
}

/**
 * The trailing system directive after a medium switch.
 * @param prev - The medium switched from.
 * @param now - The medium switched to.
 * @returns The directive.
 */
export function defaultSwitchNote(prev: string, now: string): string {
  return (
    `The conversation has just switched from ${prev} to ${now}. Everything ` +
    `above was already handled on ${prev}. Do NOT re-answer, re-explain, or ` +
    `re-search anything above. Briefly acknowledge the switch to ${now}, then ` +
    'ask what they would like to look at next.'
  );
}

/**
 * The user turn recording the switch the caller just made.
 * @param now - The medium switched to.
 * @returns The turn's text.
 */
export function defaultSwitchTurn(now: string): string {
  return `I want to switch to ${now}.`;
}

/** Options for {@link buildSeed}. */
export interface BuildSeedOptions {
  /** Whether tool calls and results are carried. Default true. */
  includeTools?: boolean;
  /** The trailing system directive after the switch. */
  switchNote?: (prev: string, now: string) => string;
  /** The user turn recording the switch. */
  switchTurn?: (now: string) => string;
}

function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
  return !!value;
}

/**
 * Build the `convo` seed for a resuming leg from the prior legs.
 *
 * Seeds from the LATEST leg that has a dialog: each leg launched WITH the
 * accumulated convo, so concatenating every leg would duplicate it and make the
 * model re-answer. Dedupes, enforces tool pairing, then appends two trailing
 * turns: a user turn recording the switch the caller just made (so the step's
 * focus lines up with the switch, not the old question) and a system directive
 * not to re-answer.
 * @param legs - The prior legs.
 * @param nowMedium - The medium now.
 * @param opts - `includeTools`, `switchNote` and `switchTurn`.
 * @returns The convo, or `[]` when there is nothing to carry.
 */
export function buildSeed(
  legs: readonly Record<string, unknown>[],
  nowMedium: string,
  opts: BuildSeedOptions = {},
): Turn[] {
  const includeTools = opts.includeTools ?? true;
  const switchNote = opts.switchNote ?? defaultSwitchNote;
  const switchTurn = opts.switchTurn ?? defaultSwitchTurn;
  let dialog: Turn[] = [];
  let prev = '';
  for (const leg of [...(legs ?? [])].reverse()) {
    const turns = leg['turns'];
    if (Array.isArray(turns) && turns.length > 0) {
      dialog = turns as Turn[];
      prev = String(leg['medium'] || '');
      break;
    }
  }
  if (dialog.length === 0) return [];

  let convo: Turn[] = [];
  const seen = new Set<string>();
  for (const t of dialog) {
    const role = t['role'];
    if (!includeTools && (role === 'tool' || truthy(t['tool_calls']))) continue;
    const content = truthy(t['content']) ? t['content'] : '';
    if (
      (role === 'user' || role === 'assistant' || role === 'system') &&
      !String(content).trim() &&
      !truthy(t['tool_calls'])
    ) {
      continue;
    }
    const key = JSON.stringify([
      role ?? null,
      content,
      JSON.stringify(truthy(t['tool_calls']) ? t['tool_calls'] : ''),
      truthy(t['tool_call_id']) ? t['tool_call_id'] : '',
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    const m: Turn = { role, content };
    if (truthy(t['tool_calls'])) m['tool_calls'] = t['tool_calls'];
    if (truthy(t['tool_call_id'])) m['tool_call_id'] = t['tool_call_id'];
    convo.push(m);
  }

  convo = pairTools(convo);
  if (convo.length === 0) return [];

  // A leg recorded without its medium: the other of the two
  prev = prev || (nowMedium === 'voice' ? 'chat' : 'voice');
  convo.push({ role: 'user', content: switchTurn(nowMedium) });
  convo.push({ role: 'system', content: switchNote(prev, nowMedium) });
  return convo;
}

/**
 * The conversation id for a request: the chat `conversation_id`, else the
 * platform call id. Never a page-supplied value.
 * @param rawData - The request.
 * @returns The id, or `""`.
 */
export function defaultConversationId(rawData: Record<string, unknown> | null | undefined): string {
  const d = rawData ?? {};
  return String(d['conversation_id'] || objectOf(d['call'])['call_id'] || d['call_id'] || '');
}

/** Options for {@link Continuity}. */
export interface ContinuityOptions {
  /** Where the legs are kept; defaults to a new {@link LegStore}. */
  store?: LegStore | null;
  /** Whether tool calls and results are carried across. Default true. */
  includeTools?: boolean;
  /** The trailing system directive after a switch. */
  switchNote?: (prev: string, now: string) => string;
  /** The user turn recording a switch. */
  switchTurn?: (now: string) => string;
  /** The conversation id for a request, in place of {@link defaultConversationId}. */
  resolveId?: ((rawData: Record<string, unknown>) => string) | null;
  /** Gets the whole conversation so far at each leg's end: `{ conversation_id, legs }`. May be async. */
  report?: ((report: Record<string, unknown>) => unknown) | null;
  /** Global data for the call from its SWML request, such as who the visitor is; null for none. */
  visitorContext?:
    ((body: Record<string, unknown>) => Record<string, unknown> | null | undefined) | null;
}

/**
 * Carry a conversation across a voice/chat switch.
 *
 * Install on any agent: on each request it seeds the resuming leg with the
 * prior dialog (via {@link buildSeed}), and at each leg's end it records that
 * leg's transcript and medium so the next one can continue. Persistence is a
 * {@link LegStore} (swap its backend with `store.setStore`); the medium comes
 * from {@link mediumOf}, and the turns recording the switch from `switchTurn`
 * and `switchNote`.
 *
 * It works through the agent's per-request configuration callbacks, after the
 * ones the agent has when it's installed, so set the agent's own first.
 */
export class Continuity {
  private readonly _store: LegStore;
  private readonly includeTools: boolean;
  private readonly switchNote: (prev: string, now: string) => string;
  private readonly switchTurn: (now: string) => string;
  private readonly resolveId: ContinuityOptions['resolveId'];
  private readonly report: ContinuityOptions['report'];
  private readonly visitorContext: ContinuityOptions['visitorContext'];

  /** @param opts - `store`, `includeTools`, `switchNote`, `switchTurn`, `resolveId`, `report` and `visitorContext`. */
  constructor(opts: ContinuityOptions = {}) {
    this._store = opts.store ?? new LegStore();
    this.includeTools = opts.includeTools ?? true;
    this.switchNote = opts.switchNote ?? defaultSwitchNote;
    this.switchTurn = opts.switchTurn ?? defaultSwitchTurn;
    this.resolveId = opts.resolveId ?? null;
    this.report = opts.report ?? null;
    this.visitorContext = opts.visitorContext ?? null;
  }

  /** Where the legs are kept. */
  get store(): LegStore {
    return this._store;
  }

  /**
   * The conversation id for a request.
   * @param rawData - The request.
   * @returns The id, or `""`.
   */
  resolveConversationId(rawData: Record<string, unknown> | null | undefined): string {
    return (this.resolveId ?? defaultConversationId)(rawData ?? {});
  }

  /**
   * Seed each request and record each leg; the agent's own per-request callbacks still run, first.
   * @param agent - The agent.
   * @returns The agent.
   */
  install<A extends AgentBase = AgentBase>(agent: A): A {
    agent.addPerCallConfig((queryParams, body, headers, copy) =>
      this.seedCallback(queryParams, body, headers, copy),
    );
    agent.onCallEnd((callLog, rawData) =>
      this.captureLeg(callLog, rawData as unknown as Record<string, unknown>),
    );
    return agent;
  }

  private async seedCallback(
    _queryParams: Record<string, string>,
    bodyIn: Record<string, unknown>,
    _headers: Record<string, string>,
    agent: AgentBase,
  ): Promise<void> {
    const body = bodyIn ?? {};
    if (this.visitorContext) {
      const ctx = this.visitorContext(body);
      if (ctx && Object.keys(ctx).length > 0) agent.setGlobalData(ctx);
    }
    // Kept in global_data, so the request at the leg's end, which may not
    // carry it, records the leg's medium
    const kind = body['conversation_type'];
    if (kind) agent.updateGlobalData({ conversation_type: kind });
    const cid = this.resolveConversationId(body);
    if (!cid) return;
    const legs = await this._store.legs(LegStore.rootId(cid));
    const convo = buildSeed(legs, mediumOf(body), {
      includeTools: this.includeTools,
      switchNote: this.switchNote,
      switchTurn: this.switchTurn,
    });
    if (convo.length > 0) agent.setParams({ convo });
  }

  private async captureLeg(
    callLog: Record<string, unknown>[] | null | undefined,
    rawData: Record<string, unknown>,
  ): Promise<void> {
    const cid = this.resolveConversationId(rawData);
    if (!cid) return;
    const turns = (callLog ?? []).filter(
      (t) =>
        typeof t === 'object' &&
        t !== null &&
        ['user', 'assistant', 'system', 'tool'].includes(t['role'] as string),
    );
    const root = LegStore.rootId(cid);
    await this._store.record(root, { cid, medium: mediumOf(rawData), turns });
    // Hand the whole conversation so far to the report sink. The record is
    // complete at every leg end (the last one covers the full conversation),
    // so a sink can simply keep the latest. Default: no report.
    if (this.report)
      await this.report({ conversation_id: root, legs: await this._store.legs(root) });
  }
}
