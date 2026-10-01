/**
 * tscProbe.ts — the shared, LIB-CACHED tsc typo-probe used by every
 * compile-time test in the suite.
 *
 * Those tests drive the REAL TypeScript compiler against the shipped source so
 * "a typo is a tsc error" is verified rather than annotated (vitest does not
 * type-check, and `tests/` is excluded from tsconfig). Each probe compiles a
 * small virtual file and reads back the diagnostics on it.
 *
 * ## Why the compiler host is cached (a real defect, not a micro-optimisation)
 *
 * A fresh `ts.createCompilerHost()` per probe re-reads and re-PARSES the whole
 * default lib (`lib.es2022.d.ts` and its `/// <reference>` chain) from disk on
 * every single call. Measured in this repo with these exact options: ~330-500ms
 * per `ts.createProgram`, IDLE. A describe block with six probes therefore
 * burned ~2-3s of vitest's 5s per-test budget on redundant lib parsing before
 * evaluating a line of the assertion — so those tests only passed while the
 * machine was quiet, and blew the timeout under concurrent load. A test that
 * needs the world to itself to be true is a broken test; the assertion was
 * never the problem, the setup cost was.
 *
 * Six copies of the identical uncached harness had been pasted across the
 * suite (states_mock, closedSets_mock, SwmlBuilder, LogLevel, SkillName,
 * TypedToolHandler) plus a tsconfig-derived seventh (SkillToolInference). Two
 * of those files had already been papered over with `{ timeout: 30000 }`, which
 * hid the cost instead of removing it; with the shared host the hermetic probes
 * run in 12-28ms and need no extended timeout at all.
 *
 * Hoisting the host to module scope and memoizing parsed `SourceFile`s drops
 * every probe after the first from ~378ms to ~4ms — the lib is read once per
 * test process instead of once per probe, which is what "hermetic + fast"
 * always intended. The virtual file is never cached (its content differs per
 * probe and is supplied fresh each call), so probes cannot bleed into one
 * another.
 *
 * Caching parsed lib files cannot make a probe vacuously green: the lib
 * declarations are identical across probes by construction, and the assertion
 * under test is a diagnostic on the VIRTUAL file, which is re-parsed every
 * time. `tests/tscProbe.negative.test.ts` pins that directly — a known bad
 * literal must still produce a diagnostic after the cache is warm.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The HERMETIC option set: no `@types` auto-inclusion, no lib-check. Used by
 * every probe that inlines the type under test as a local alias.
 */
const HERMETIC_OPTIONS: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
  typeRoots: [],
  target: ts.ScriptTarget.ES2022,
};

/** The repo's OWN tsconfig options, for probes that import real `src/` modules. */
function repoTsconfigOptions(): ts.CompilerOptions {
  const configPath = ts.findConfigFile(REPO_ROOT, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) throw new Error('tsconfig.json not found');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  return { ...parsed.options, noEmit: true, skipLibCheck: true };
}

/** A compiler host bound to one option set, with its parsed lib memoized. */
interface CachedProbe {
  options: ts.CompilerOptions;
  host: ts.CompilerHost;
  /** Set immediately before each `createProgram`; read by the host overrides. */
  state: { virtualPath: string; virtualSource: string };
}

function makeCachedProbe(options: ts.CompilerOptions): CachedProbe {
  const sourceFileCache = new Map<string, ts.SourceFile | undefined>();
  const base = ts.createCompilerHost(options);
  const baseGetSourceFile = base.getSourceFile.bind(base);
  const baseReadFile = base.readFile.bind(base);
  const baseFileExists = base.fileExists.bind(base);
  const state = { virtualPath: '', virtualSource: '' };

  const host: ts.CompilerHost = {
    ...base,
    getSourceFile(fileName, languageVersion, onError, shouldCreate) {
      // The probe's own file is ALWAYS re-parsed: its content differs per call.
      if (path.resolve(fileName) === state.virtualPath) {
        return ts.createSourceFile(fileName, state.virtualSource, languageVersion, true);
      }
      if (!sourceFileCache.has(fileName)) {
        sourceFileCache.set(
          fileName,
          baseGetSourceFile(fileName, languageVersion, onError, shouldCreate),
        );
      }
      return sourceFileCache.get(fileName);
    },
    readFile: (f) =>
      path.resolve(f) === state.virtualPath ? state.virtualSource : baseReadFile(f),
    fileExists: (f) => (path.resolve(f) === state.virtualPath ? true : baseFileExists(f)),
  };
  return { options, host, state };
}

let hermeticProbe: CachedProbe | undefined;
let repoConfigProbe: CachedProbe | undefined;

/** The two option sets a probe can run under. */
export type ProbeMode = 'hermetic' | 'repo-tsconfig';

function probeFor(mode: ProbeMode): CachedProbe {
  if (mode === 'repo-tsconfig') {
    repoConfigProbe ??= makeCachedProbe(repoTsconfigOptions());
    return repoConfigProbe;
  }
  hermeticProbe ??= makeCachedProbe(HERMETIC_OPTIONS);
  return hermeticProbe;
}

/**
 * Compile `source` as the virtual file `fileName` and return every diagnostic
 * ON THAT FILE. Diagnostics elsewhere (in the lib, or in imported `src/`
 * modules) are not the probe's subject and are filtered out.
 *
 * @param fileName - Absolute path for the virtual file. Unique per probe shape,
 *   so a diagnostic is unambiguously attributable.
 * @param source - The complete virtual file content (preamble + body).
 * @param mode - `'hermetic'` (default) for a self-contained probe;
 *   `'repo-tsconfig'` when the probe imports real `src/` modules and needs the
 *   shipped module/lib resolution.
 */
export function probeDiagnostics(
  fileName: string,
  source: string,
  mode: ProbeMode = 'hermetic',
): ts.Diagnostic[] {
  const probe = probeFor(mode);
  const resolved = path.resolve(fileName);
  probe.state.virtualPath = resolved;
  probe.state.virtualSource = source;
  const program = ts.createProgram([resolved], probe.options, probe.host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && path.resolve(d.file.fileName) === resolved);
}

/**
 * As {@link probeDiagnostics}, but keyed by the diagnostic's 0-based source
 * line — the shape most probes want ("is line N an error, and what did it say").
 */
export function diagnosticsByLine(
  fileName: string,
  source: string,
  mode: ProbeMode = 'hermetic',
): Map<number, string> {
  const byLine = new Map<number, string>();
  for (const d of probeDiagnostics(fileName, source, mode)) {
    if (d.start == null || !d.file) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    byLine.set(line, ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  }
  return byLine;
}

// Warm the hermetic lib cache at MODULE LOAD, not inside whichever test happens
// to run first. The one-time default-lib parse is ~300ms-2.6s depending on
// machine load; charged to a test it is an unbudgeted tax on an arbitrary
// assertion (and was a third of the 5s timeout), while at import time vitest
// accounts for it as module setup, where it belongs. Every probe then measures
// only its own compile. Deliberately not lazy — the point is that no test pays
// it. ('repo-tsconfig' stays lazy: only one file uses it, and building it here
// would tax every test file that imports this module.)
diagnosticsByLine(
  // A path no probe uses, so it cannot collide with a real probe's file.
  path.resolve(REPO_ROOT, 'tests/__tscprobe_warmup__.ts'),
  "type __Warm = 'a'; const __w: __Warm = 'a'; void __w;\n",
);
