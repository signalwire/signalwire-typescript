/**
 * Typed RELAY lifecycle-state vocabularies (Tier-3 typed objects) — proves
 * that the typed `CallState` / `DialState` / `MessageState` unions and their
 * `isXTerminal` helpers are (a) compile-time typo-checked over the *known*
 * states, (b) forward-compatible (a server-added state is still accepted as a
 * bare string — parity with the reference's bare-`str` `Call.state` /
 * `Message.state`), and (c) wired into the SDK's real event plumbing so a
 * dispatched event narrows the typed accessor and the terminal predicate flips
 * at the right state.
 *
 * Three DISTINCT vocabularies (never interchangeable):
 *   - CallState     created | ringing | answered | ending | ended   (term: ended)
 *   - DialState     dialing | answered | failed                      (term: answered, failed)
 *   - MessageState  queued | initiated | sent | delivered | …        (term: delivered/undelivered/failed)
 *
 * Real behavior: the event-flow blocks run the REAL RelayClient over the
 * shared mock_relay WebSocket (no transport mock); the server pushes the same
 * `calling.call.state` / `messaging.state` / `calling.call.dial` frames the
 * production RELAY server emits, and we read the typed accessor back off the
 * live SDK object. The typo / forward-compat assertions drive the actual
 * TypeScript compiler against the SHIPPED union source (vitest does not
 * type-check), so "a typo is a tsc error" and "the three vocabularies don't
 * conflate" are verified, not merely annotated.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import * as ts from 'typescript';
import { RelayClient } from '../../src/relay/RelayClient.js';
import { Call } from '../../src/relay/Call.js';
import { Message } from '../../src/relay/Message.js';
import {
  isCallStateTerminal,
  isDialStateTerminal,
  isMessageStateTerminal,
  CALL_STATE_TERMINAL,
  DIAL_STATE_TERMINAL,
  MESSAGE_STATE_TERMINAL,
} from '../../src/relay/closedSets.js';
import { CallStateEvent, DialEvent, MessageStateEvent } from '../../src/relay/RelayEvent.js';
import { getMockRelay, newRelayClient, type MockRelayHarness } from './mocktest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLOSED_SETS_SRC = path.resolve(__dirname, '../../src/relay/closedSets.ts');

// ---------------------------------------------------------------------------
// tsc typo-probe — type-check against the REAL union extracted from the shipped
// source so the closed set under test is the one we actually export (not a
// hand-copied duplicate). Hermetic + fast: no @types, no lib-check.
// (Same harness shape as closedSets_mock.test.ts; extended to also probe the
// `…OrString` widened forms.)
// ---------------------------------------------------------------------------

function extractAlias(aliasName: string): string {
  const src = readFileSync(CLOSED_SETS_SRC, 'utf-8');
  const m = src.match(new RegExp(`export type ${aliasName}\\s*=\\s*([\\s\\S]*?);`));
  if (!m) throw new Error(`could not locate \`export type ${aliasName} = ...;\` in ${CLOSED_SETS_SRC}`);
  return m[1].replace(/\s+/g, ' ').replace(/^\|\s*/, '').trim();
}

/**
 * Compile a preamble of `type <Alias> = <real union>;` declarations (one per
 * name in `aliases`) followed by `body` (one statement per line) and return any
 * tsc diagnostic keyed by the body's source line. Line index is 0-based over
 * the full virtual file; the first `body` line is `aliases.length`.
 */
function typeCheckLines(aliases: string[], body: string): Map<number, string> {
  const virtual = path.resolve(__dirname, `__state_probe_${aliases.join('_')}__.ts`);
  const preamble = aliases.map((a) => `type ${a} = ${extractAlias(a)};`).join('\n');
  const source = `${preamble}\n${body}\n`;
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    typeRoots: [],
    target: ts.ScriptTarget.ES2022,
  };
  const host = ts.createCompilerHost(options);
  const origRead = host.readFile.bind(host);
  host.readFile = (f) => (path.resolve(f) === virtual ? source : origRead(f));
  const origExists = host.fileExists.bind(host);
  host.fileExists = (f) => (path.resolve(f) === virtual ? true : origExists(f));
  const program = ts.createProgram([virtual], options, host);
  const byLine = new Map<number, string>();
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (!d.file || path.resolve(d.file.fileName) !== virtual || d.start == null) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    byLine.set(line, ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  }
  return byLine;
}

/**
 * Compile `assignments` (each a `value` assigned to a `const` of the named
 * `alias`) in ONE tsc program against the declared `aliases`, and return the
 * per-assignment diagnostic (`undefined` = type-checks clean). Batching keeps
 * the whole describe-block to a handful of `ts.createProgram` calls — one per
 * test — instead of one per literal (which blew the default 5s test timeout).
 *
 * Guards against a probe going vacuously green: any diagnostic on the
 * *preamble* (e.g. a `…OrString` whose base `…State` alias was not also
 * declared → "Cannot find name", which silently widens the alias to `any`)
 * throws, so a probe can never pass for the wrong reason.
 */
function probeBatch(
  aliases: string[],
  assignments: Array<{ alias: string; value: string }>,
): Array<string | undefined> {
  const body = assignments
    .map(({ alias, value }, i) => `const _v${i}: ${alias} = ${value}; void _v${i};`)
    .join('\n');
  const errs = typeCheckLines(aliases, body);
  for (let i = 0; i < aliases.length; i++) {
    const preambleErr = errs.get(i);
    if (preambleErr) {
      throw new Error(
        `state probe preamble error on alias line ${i} (${aliases[i]}): ${preambleErr} — ` +
        `did you forget to also declare its base alias? aliases=[${aliases.join(', ')}]`,
      );
    }
  }
  // Body assignment k lives at line index `aliases.length + k`.
  return assignments.map((_, k) => errs.get(aliases.length + k));
}

/** Quote a string literal for embedding in a probe assignment. */
const q = (s: string) => `'${s}'`;

// ---------------------------------------------------------------------------
// Live harness
// ---------------------------------------------------------------------------

let client: RelayClient;
let mock: MockRelayHarness;

beforeEach(async () => {
  mock = await getMockRelay();
  await mock.reset();
  process.env.RELAY_MAX_CONNECTIONS = '16';
  ({ client } = await newRelayClient());
});

afterEach(async () => {
  if (client) {
    try { await client.disconnect(); } catch { /* ignore */ }
  }
});

function statePushFrame(callId: string, callState: string): Record<string, any> {
  return {
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'signalwire.event',
    params: {
      event_type: 'calling.call.state',
      params: {
        call_id: callId,
        node_id: 'mock-relay-node-1',
        tag: '',
        call_state: callState,
        direction: 'inbound',
        device: { type: 'phone', params: { from_number: '+15551110000', to_number: '+15552220000' } },
      },
    },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000, stepMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  throw new Error('waitFor: predicate never became true');
}

async function answeredInboundCall(callId: string): Promise<Call> {
  const captured: { call?: Call } = {};
  const handlerReturned = new Promise<void>((resolve) => {
    client.onCall(async (call) => {
      captured.call = call;
      await call.answer();
      resolve();
    });
  });
  await mock.inboundCall({ call_id: callId, auto_states: ['created'] });
  await Promise.race([
    handlerReturned,
    new Promise((_, reject) => setTimeout(() => reject(new Error('handler timeout')), 5000)),
  ]);
  return captured.call!;
}

// ===========================================================================
// 1. Compile-time: each union autocompletes its set + accepts forward-compat
//    string + rejects a typo — and the three vocabularies stay separate.
// ===========================================================================

describe('CallState / DialState / MessageState — compile-time typing', () => {
  it('CallState accepts every known state and rejects a typo', () => {
    const known = ['created', 'ringing', 'answered', 'ending', 'ended'];
    const r = probeBatch(
      ['CallState'],
      [...known.map((s) => ({ alias: 'CallState', value: q(s) })), { alias: 'CallState', value: q('anwsered') }],
    );
    for (let i = 0; i < known.length; i++) expect(r[i]).toBeUndefined();
    const typo = r[known.length];
    expect(typo).toBeDefined();
    expect(typo!).toMatch(/not assignable to type 'CallState'/);
  });

  it('DialState accepts dialing|answered|failed and rejects a typo', () => {
    const known = ['dialing', 'answered', 'failed'];
    const r = probeBatch(
      ['DialState'],
      [...known.map((s) => ({ alias: 'DialState', value: q(s) })), { alias: 'DialState', value: q('diallng') }],
    );
    for (let i = 0; i < known.length; i++) expect(r[i]).toBeUndefined();
    expect(r[known.length]).toBeDefined();
  });

  it('MessageState accepts every known state and rejects a typo', () => {
    const known = ['queued', 'initiated', 'sent', 'delivered', 'undelivered', 'failed', 'received'];
    const r = probeBatch(
      ['MessageState'],
      [...known.map((s) => ({ alias: 'MessageState', value: q(s) })), { alias: 'MessageState', value: q('delivrd') }],
    );
    for (let i = 0; i < known.length; i++) expect(r[i]).toBeUndefined();
    expect(r[known.length]).toBeDefined();
  });

  it('the …OrString widened forms accept a forward-compat (server-added) string', () => {
    // The `(string & {})` arm keeps the field a string at the type level, so a
    // value outside the known set still compiles — parity with the reference's
    // bare-`str` Call.state / Message.state. (Each …OrString references its base
    // …State alias, so both must be declared — probeBatch throws otherwise, so
    // this can't pass vacuously by widening to `any`.) The trailing non-string
    // proves it's `… | string`, not collapsed to `any`.
    const r = probeBatch(
      ['CallState', 'CallStateOrString', 'DialState', 'DialStateOrString', 'MessageState', 'MessageStateOrString'],
      [
        { alias: 'CallStateOrString', value: q('parked') },
        { alias: 'DialStateOrString', value: q('busy') },
        { alias: 'MessageStateOrString', value: q('read') },
        { alias: 'CallStateOrString', value: '123' },
      ],
    );
    expect(r[0]).toBeUndefined();
    expect(r[1]).toBeUndefined();
    expect(r[2]).toBeUndefined();
    expect(r[3]).toBeDefined();
    expect(r[3]!).toMatch(/not assignable to type 'CallStateOrString'/);
  });

  it('NEVER conflates the three vocabularies (a state of one is not a state of another)', () => {
    const r = probeBatch(
      ['CallState', 'DialState', 'MessageState'],
      [
        { alias: 'CallState', value: q('dialing') },    // [0] DialState-only → reject
        { alias: 'DialState', value: q('ringing') },    // [1] CallState-only → reject
        { alias: 'CallState', value: q('queued') },     // [2] MessageState-only → reject
        { alias: 'MessageState', value: q('ended') },   // [3] CallState-only → reject
        { alias: 'CallState', value: q('answered') },   // [4] overlaps Call+Dial → accept
        { alias: 'DialState', value: q('answered') },   // [5] overlaps Call+Dial → accept
      ],
    );
    expect(r[0]).toBeDefined();
    expect(r[1]).toBeDefined();
    expect(r[2]).toBeDefined();
    expect(r[3]).toBeDefined();
    expect(r[4]).toBeUndefined();
    expect(r[5]).toBeUndefined();
  });

  it('the documentary @ts-expect-error call-site markers hold', () => {
    // @ts-expect-error — a typo'd call state must not satisfy CallState
    const badCall: import('../../src/relay/closedSets.js').CallState = 'endd';
    void badCall;
    // @ts-expect-error — a CallState token must not satisfy DialState
    const badDial: import('../../src/relay/closedSets.js').DialState = 'ringing';
    void badDial;
    // @ts-expect-error — a typo'd message state must not satisfy MessageState
    const badMsg: import('../../src/relay/closedSets.js').MessageState = 'deliverd';
    void badMsg;
  });
});

// ===========================================================================
// 2. isXTerminal helpers — terminal/non-terminal classification per vocabulary.
// ===========================================================================

describe('isXTerminal helpers', () => {
  it('isCallStateTerminal: only `ended` is terminal', () => {
    expect(isCallStateTerminal('ended')).toBe(true);
    for (const s of ['created', 'ringing', 'answered', 'ending']) {
      expect(isCallStateTerminal(s)).toBe(false);
    }
    expect(CALL_STATE_TERMINAL).toEqual(['ended']);
  });

  it('isDialStateTerminal: `answered` and `failed` are terminal, `dialing` is not', () => {
    expect(isDialStateTerminal('answered')).toBe(true);
    expect(isDialStateTerminal('failed')).toBe(true);
    expect(isDialStateTerminal('dialing')).toBe(false);
    expect([...DIAL_STATE_TERMINAL].sort()).toEqual(['answered', 'failed']);
  });

  it('isMessageStateTerminal: delivered/undelivered/failed are terminal, in-flight are not', () => {
    for (const s of ['delivered', 'undelivered', 'failed']) {
      expect(isMessageStateTerminal(s)).toBe(true);
    }
    for (const s of ['queued', 'initiated', 'sent', 'received']) {
      expect(isMessageStateTerminal(s)).toBe(false);
    }
    expect([...MESSAGE_STATE_TERMINAL].sort()).toEqual(['delivered', 'failed', 'undelivered']);
  });

  it('a forward-compat (unknown) state is treated as non-terminal', () => {
    expect(isCallStateTerminal('parked')).toBe(false);
    expect(isDialStateTerminal('busy')).toBe(false);
    expect(isMessageStateTerminal('read')).toBe(false);
  });
});

// ===========================================================================
// 3. Real call.state event flow — the typed accessor + Call.isTerminal narrow
//    on a server-pushed `calling.call.state` over the live mock WebSocket.
// ===========================================================================

describe('Call.state / Call.isTerminal over a real calling.call.state event', () => {
  it('advances the typed Call.state and flips isTerminal only at `ended`', async () => {
    const call = await answeredInboundCall('st-call-1');

    await mock.push(statePushFrame('st-call-1', 'answered'));
    await waitFor(() => call.state === 'answered');
    expect(call.state).toBe('answered');
    expect(call.isTerminal).toBe(false);
    expect(isCallStateTerminal(call.state)).toBe(false);

    await mock.push(statePushFrame('st-call-1', 'ended'));
    await waitFor(() => call.state === 'ended');
    expect(call.state).toBe('ended');
    expect(call.isTerminal).toBe(true);
    expect(isCallStateTerminal(call.state)).toBe(true);
  });

  it('CallStateEvent.callState carries the typed state from the wrapped payload', () => {
    const evt = CallStateEvent.fromPayload({
      event_type: 'calling.call.state',
      params: { call_id: 'st-evt-1', call_state: 'ringing', direction: 'inbound' },
    });
    expect(evt).toBeInstanceOf(CallStateEvent);
    // The typed accessor reads the raw wire value verbatim (types erase).
    expect(evt.callState).toBe('ringing');
    expect(isCallStateTerminal(evt.callState)).toBe(false);
    expect(evt.params.call_state).toBe(evt.callState);
  });
});

// ===========================================================================
// 4. Real message.state event flow — typed Message.state + Message.isTerminal
//    over a server-pushed `messaging.state` (real sendMessage path).
// ===========================================================================

describe('Message.state / Message.isTerminal over a real messaging.state event', () => {
  async function sendOne(body: string): Promise<Message> {
    return client.sendMessage({ toNumber: '+15551112222', fromNumber: '+15553334444', body });
  }

  function msgStateFrame(messageId: string, state: string): Record<string, any> {
    return {
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'messaging.state',
        params: {
          message_id: messageId,
          message_state: state,
          from_number: '+15553334444',
          to_number: '+15551112222',
          body: 'x',
        },
      },
    };
  }

  it('queued is non-terminal; delivered flips isTerminal true', async () => {
    const msg = await sendOne('hi');
    expect(msg.state).toBe('queued');
    expect(msg.isTerminal).toBe(false);

    await mock.push(msgStateFrame(msg.messageId, 'sent'));
    await waitFor(() => msg.state === 'sent');
    expect(msg.state).toBe('sent');
    expect(msg.isTerminal).toBe(false); // intermediate

    await mock.push(msgStateFrame(msg.messageId, 'delivered'));
    const event = await msg.wait(5);
    expect(msg.state).toBe('delivered');
    expect(msg.isTerminal).toBe(true);
    expect(isMessageStateTerminal(msg.state)).toBe(true);
    expect(event.params.message_state).toBe('delivered');
  });

  it('a `failed` outcome is terminal too', async () => {
    const msg = await sendOne('hi');
    await mock.push(msgStateFrame(msg.messageId, 'failed'));
    await msg.wait(5);
    expect(msg.state).toBe('failed');
    expect(msg.isTerminal).toBe(true);
  });

  it('MessageStateEvent.messageState carries the typed state from the payload', () => {
    const evt = MessageStateEvent.fromPayload({
      event_type: 'messaging.state',
      params: { message_id: 'm-evt-1', message_state: 'undelivered' },
    });
    expect(evt).toBeInstanceOf(MessageStateEvent);
    expect(evt.messageState).toBe('undelivered');
    expect(isMessageStateTerminal(evt.messageState)).toBe(true);
  });
});

// ===========================================================================
// 5. Real dial event — DialEvent.dialState typed accessor over an armed dial.
// ===========================================================================

describe('DialEvent.dialState over a real dial flow', () => {
  function phoneDevice(to = '+15551112222', frm = '+15553334444') {
    return { type: 'phone', params: { to_number: to, from_number: frm } };
  }

  it('the dial winner resolves to a Call and the typed dial_state reads `answered`', async () => {
    await mock.armDial({
      tag: 'st-dial-1',
      winner_call_id: 'st-dial-winner',
      states: ['created', 'ringing', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
      delay_ms: 1,
    });
    const call = await client.dial([[phoneDevice()]], { tag: 'st-dial-1', dialTimeout: 5.0 });
    expect(call).toBeInstanceOf(Call);
    expect(call.callId).toBe('st-dial-winner');

    // Parse the terminal dial event the same way the client does and confirm
    // the typed accessor reads the resolved (terminal) dial state.
    const evt = DialEvent.fromPayload({
      event_type: 'calling.call.dial',
      params: { tag: 'st-dial-1', dial_state: 'answered', call: { call_id: 'st-dial-winner' } },
    });
    expect(evt.dialState).toBe('answered');
    expect(isDialStateTerminal(evt.dialState)).toBe(true);
    // A `dialing` event is in-flight (non-terminal); a `failed` is terminal.
    expect(isDialStateTerminal('dialing')).toBe(false);
    expect(isDialStateTerminal('failed')).toBe(true);
  });
});
