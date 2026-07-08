/**
 * LogLevel closed-set typing — proves the typed level accepted by
 * `setGlobalLogLevel` produces the IDENTICAL filtering behavior as the bare
 * string, and that a typo'd literal is a COMPILE-time error.
 *
 * `setGlobalLogLevel` is a TS addition (the Python reference logger has no
 * `set_log_level`; see PORT_ADDITIONS.md), so the canonical closed set is this
 * port's own: 'debug' | 'info' | 'warn' | 'error' (note 'warn', matching the
 * `Logger.warn()` method and the internal severity table).
 *
 * Real behavior: a real Logger emits through the real console sink; we capture
 * the actually-emitted lines and assert the typed `LogLevel` and the bare
 * string gate output to the same threshold. No transport is involved (the
 * Logger has none); the only mock is the console sink, exactly as the existing
 * tests/Logger.test.ts does. The typo assertion drives the real TypeScript
 * compiler (vitest does not type-check) so the claim is verified, not annotated.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import {
  getLogger,
  setGlobalLogLevel,
  setGlobalLogColor,
  setGlobalLogFormat,
  setGlobalLogStream,
  suppressAllLogs,
  resetLoggingConfiguration,
} from '../src/Logger.js';
import type { LogLevel } from '../src/Logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGGER_SRC = path.resolve(__dirname, '../src/Logger.ts');

// ---------------------------------------------------------------------------
// tsc typo-probe — extract the REAL LogLevel union from the shipped source so
// the closed set under test is the one actually exported. Hermetic + fast.
// ---------------------------------------------------------------------------

/**
 * `LogLevel` is `keyof typeof LEVELS`. tsc can't resolve that without the
 * surrounding module, so the probe substitutes the literal union derived from
 * the `LEVELS` object literal in the shipped source — i.e. it still checks the
 * real, shipped key set rather than a hand-copied duplicate.
 */
function realLogLevelUnion(): string {
  const src = readFileSync(LOGGER_SRC, 'utf-8');
  const m = src.match(/const LEVELS\s*=\s*\{([^}]*)\}/);
  if (!m) throw new Error('could not locate `const LEVELS = { ... }` in ' + LOGGER_SRC);
  const keys = [...m[1]!.matchAll(/(\w+)\s*:/g)].map((k) => `'${k[1]}'`);
  if (keys.length === 0) throw new Error('no level keys parsed from LEVELS in ' + LOGGER_SRC);
  return keys.join(' | ');
}

function typeCheckLines(body: string): Map<number, string> {
  const virtual = path.resolve(__dirname, '__loglevel_probe__.ts');
  const source = `type LogLevel = ${realLogLevelUnion()};\n${body}\n`;
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

// ---------------------------------------------------------------------------
// Real emit capture
// ---------------------------------------------------------------------------

let spyDebug: ReturnType<typeof vi.spyOn>;
let spyInfo: ReturnType<typeof vi.spyOn>;
let spyWarn: ReturnType<typeof vi.spyOn>;
let spyError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  spyDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
  spyInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
  spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
  setGlobalLogColor(false);
  setGlobalLogFormat('text');
  setGlobalLogStream('stdout');
  suppressAllLogs(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  setGlobalLogLevel('info');
  resetLoggingConfiguration();
});

/**
 * Drive a logger through all four severities and return the set of severities
 * that actually emitted a line, given the current global level.
 */
function emittedSeverities(name: string): Set<string> {
  spyDebug.mockClear();
  spyInfo.mockClear();
  spyWarn.mockClear();
  spyError.mockClear();
  const log = getLogger(name);
  log.debug('d');
  log.info('i');
  log.warn('w');
  log.error('e');
  const out = new Set<string>();
  if (spyDebug.mock.calls.length) out.add('debug');
  if (spyInfo.mock.calls.length) out.add('info');
  if (spyWarn.mock.calls.length) out.add('warn');
  if (spyError.mock.calls.length) out.add('error');
  return out;
}

describe('LogLevel closed-set typing (setGlobalLogLevel)', () => {
  it('typed LogLevel and bare string gate output to the identical threshold', () => {
    // The typed value is the canonical level string (types erase at runtime).
    const typed: LogLevel = 'warn';

    setGlobalLogLevel(typed);
    const viaTyped = emittedSeverities('loglevel-typed');

    setGlobalLogLevel('warn');
    const viaString = emittedSeverities('loglevel-string');

    // At 'warn', only warn+error emit — and the typed and string paths agree
    // exactly (concrete behavioral proof, not a nullness check).
    expect([...viaTyped].sort()).toEqual(['error', 'warn']);
    expect([...viaString].sort()).toEqual([...viaTyped].sort());
  });

  it('each typed level filters exactly as its rank dictates', () => {
    setGlobalLogLevel('debug' satisfies LogLevel);
    expect([...emittedSeverities('ll-d')].sort()).toEqual(['debug', 'error', 'info', 'warn']);

    setGlobalLogLevel('error' satisfies LogLevel);
    expect([...emittedSeverities('ll-e')].sort()).toEqual(['error']);
  });

  it('rejects an off-spec level at COMPILE time — the open `(string & {})` arm is closed', () => {
    // setGlobalLogLevel's parameter used to carry a `(string & {})` arm that
    // accepted any string; it is now the closed, port-owned set. An off-spec
    // level is a compile error, not a silently-accepted runtime no-op. Proven
    // two ways. (1) The real shipped `LogLevel` union rejects the off-spec literal:
    const errs = typeCheckLines(`const x: LogLevel = 'trace'; void x;`);
    expect(errs.get(1)).toBeDefined();
    expect(errs.get(1)!).toMatch(/not assignable to type 'LogLevel'/);
    // (2) The call site itself rejects it — the param is closed, not `| string`.
    // If the open arm were still present, this `@ts-expect-error` would itself
    // be an unused-directive compile error, so the test fails loudly either way.
    // @ts-expect-error — 'trace' is not a LogLevel; the open arm is gone.
    setGlobalLogLevel('trace');
    setGlobalLogLevel('info'); // restore a valid level for subsequent tests
  });

  it('rejects a typo’d level at COMPILE time, accepts the correct one', () => {
    const errs = typeCheckLines(
      `const good: LogLevel = 'debug'; void good;\n` + `const bad: LogLevel = 'debgu'; void bad;`,
    );
    expect(errs.get(1)).toBeUndefined();
    const typoError = errs.get(2);
    expect(typoError).toBeDefined();
    expect(typoError!).toMatch(/not assignable to type 'LogLevel'/);

    // Documentary call-site marker of the same guarantee.
    // @ts-expect-error — typo'd level must not satisfy LogLevel
    const bad: LogLevel = 'debgu';
    void bad;
  });
});
