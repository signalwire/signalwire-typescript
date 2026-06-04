/**
 * Closed-set option typing for RELAY Call commands — proves that the typed
 * union value and the bare-string value produce the IDENTICAL wire frame, and
 * that a typo'd literal is a COMPILE-time error.
 *
 * Covers the two clean, user-facing closed sets on the Call command surface:
 *   - playTTS / promptTTS  `gender`     → TtsGender   ('male' | 'female')
 *   - detectFax            `tone`       → FaxTone      ('CED' | 'CNG')
 *
 * (play()'s `direction` is an unvalidated passthrough in the Python reference —
 * relay/call.py play(): Optional[str], no closed set — so it stays a bare
 * string, consistent with the other ports.)
 *
 * Same idiom as tests/skills/SkillName.test.ts: the union types are erased at
 * runtime, so the value placed on the wire is identical to passing a string —
 * parity with the Python reference's bare-`str` `play_tts(gender=...)`,
 * `detect_fax(tone=...)`.
 *
 * Real behavior: every command is issued by the REAL RelayClient over the
 * shared mock_relay WebSocket (no transport mock); we read the journaled
 * `calling.<verb>` frame back and assert the typed and string forms emit
 * byte-for-byte the same params. The typo assertions drive the actual
 * TypeScript compiler (vitest does not type-check) so "a typo is a tsc error"
 * is verified, not merely annotated.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { RelayClient } from '../../src/relay/RelayClient.js';
import { Call } from '../../src/relay/Call.js';
import type {
  TtsGender,
  FaxTone,
} from '../../src/relay/closedSets.js';
import { getMockRelay, newRelayClient, type MockRelayHarness } from './mocktest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLOSED_SETS_SRC = path.resolve(__dirname, '../../src/relay/closedSets.ts');

// ---------------------------------------------------------------------------
// tsc typo-probe — type-check `body` against the REAL union extracted from the
// shipped source so the closed set under test is the one we actually export
// (not a hand-copied duplicate). Hermetic + fast: no @types, no lib-check.
// ---------------------------------------------------------------------------

function extractUnion(aliasName: string): string {
  const src = readFileSync(CLOSED_SETS_SRC, 'utf-8');
  const m = src.match(new RegExp(`export type ${aliasName}\\s*=\\s*([\\s\\S]*?);`));
  if (!m) throw new Error(`could not locate \`export type ${aliasName} = ...;\` in ${CLOSED_SETS_SRC}`);
  return m[1].replace(/\s+/g, ' ').replace(/^\|\s*/, '').trim();
}

/**
 * Compile `type <Alias> = <real union>;` followed by `body` (one statement per
 * line) and return any tsc diagnostic keyed by the body's source line. Line 0
 * is the alias declaration, so `body` line N maps to file line N+1.
 */
function typeCheckLines(aliasName: string, body: string): Map<number, string> {
  const virtual = path.resolve(__dirname, `__closedset_probe_${aliasName}__.ts`);
  const source = `type ${aliasName} = ${extractUnion(aliasName)};\n${body}\n`;
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

/** Assert: the valid literal type-checks clean and the typo is a tsc error. */
function assertTypoRejected(aliasName: string, good: string, typo: string): void {
  const errs = typeCheckLines(
    aliasName,
    `const ok: ${aliasName} = '${good}'; void ok;\n` +
    `const bad: ${aliasName} = '${typo}'; void bad;`,
  );
  expect(errs.get(1)).toBeUndefined(); // valid literal is clean
  const typoError = errs.get(2);
  expect(typoError).toBeDefined();
  expect(typoError!).toMatch(new RegExp(`not assignable to type '${aliasName}'`));
}

// ---------------------------------------------------------------------------
// Live-call harness (mirrors convenience_mock.test.ts)
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
  const call = captured.call!;
  call.state = 'answered';
  return call;
}

/** Latest journaled frame's params for `method` (polls up to 2s). */
async function lastFrameParams(method: string): Promise<Record<string, any>> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const entries = await mock.journalRecv(method);
    if (entries.length > 0) return entries[entries.length - 1]!.frame.params;
    if (Date.now() >= deadline) throw new Error(`no ${method} frame landed in journal within 2s`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

// ---------------------------------------------------------------------------
// TtsGender — playTTS / promptTTS gender option
// ---------------------------------------------------------------------------

describe('TtsGender closed set (playTTS / promptTTS gender)', () => {
  it('typed TtsGender and bare string emit the identical gender on the wire', async () => {
    // The typed value is just the canonical wire string (types erase).
    const typed: TtsGender = 'female';

    const callTyped = await answeredInboundCall('cs-gender-typed');
    await callTyped.playTTS('hi', { gender: typed });
    const pTyped = await lastFrameParams('calling.play');
    expect(pTyped.play[0].params.gender).toBe('female');

    const callStr = await answeredInboundCall('cs-gender-str');
    await callStr.playTTS('hi', { gender: 'female' });
    const pStr = await lastFrameParams('calling.play');
    // Byte-for-byte identical media entry whether typed or string.
    expect(pStr.play[0].params.gender).toBe(pTyped.play[0].params.gender);
    expect(pStr.play[0]).toEqual(pTyped.play[0]);
  });

  it('promptTTS carries the typed gender through play_and_collect identically', async () => {
    const typed: TtsGender = 'male';
    const call = await answeredInboundCall('cs-gender-prompt');
    await call.promptTTS('pin?', { digits: { max: 4 } }, { gender: typed });
    const p = await lastFrameParams('calling.play_and_collect');
    expect(p.play[0].params.gender).toBe('male');
  });

  it('still accepts an arbitrary (forward-compat) gender string — Python str parity', async () => {
    // The `(string & {})` arm widens the param back to string at the type
    // level, so a value outside the literal set is accepted and forwarded.
    const call = await answeredInboundCall('cs-gender-open');
    await call.playTTS('hi', { gender: 'neutral' });
    const p = await lastFrameParams('calling.play');
    expect(p.play[0].params.gender).toBe('neutral');
  });

  it('rejects a typo’d gender at COMPILE time', () => {
    assertTypoRejected('TtsGender', 'female', 'femal');
    // Documentary call-site marker of the same guarantee.
    // @ts-expect-error — typo'd gender must not satisfy TtsGender
    const bad: TtsGender = 'femal';
    void bad;
  });
});

// ---------------------------------------------------------------------------
// FaxTone — detectFax() tone option
// ---------------------------------------------------------------------------

describe('FaxTone closed set (detectFax tone)', () => {
  it('typed FaxTone and bare string emit the identical detect tone', async () => {
    const typed: FaxTone = 'CED';

    const callTyped = await answeredInboundCall('cs-tone-typed');
    await callTyped.detectFax({ tone: typed });
    const pTyped = await lastFrameParams('calling.detect');
    expect(pTyped.detect.type).toBe('fax');
    expect(pTyped.detect.params.tone).toBe('CED');

    const callStr = await answeredInboundCall('cs-tone-str');
    await callStr.detectFax({ tone: 'CED' });
    const pStr = await lastFrameParams('calling.detect');
    expect(pStr.detect.params.tone).toBe(pTyped.detect.params.tone);
    expect(pStr.detect).toEqual(pTyped.detect);
  });

  it('rejects a typo’d tone at COMPILE time', () => {
    assertTypoRejected('FaxTone', 'CNG', 'CDN');
    // @ts-expect-error — typo'd tone must not satisfy FaxTone
    const bad: FaxTone = 'CDN';
    void bad;
  });
});
