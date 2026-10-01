/**
 * The NEGATIVE CONTROL for the shared tsc typo-probe (`./tscProbe.ts`).
 *
 * The probe caches the parsed default lib across `ts.createProgram` calls so a
 * compile-only test does not pay ~330-500ms of redundant lib parsing per
 * assertion. A cache is exactly the kind of change that can silently turn a
 * type-error probe into a no-op — if a warm program stopped reporting
 * diagnostics on the virtual file, every "a typo is a tsc error" assertion in
 * `closedSets_mock.test.ts` and `states_mock.test.ts` would pass VACUOUSLY, and
 * nothing else in the suite would notice.
 *
 * So this file asserts the probe still FAILS on input it must reject, both cold
 * and warm, and that a diagnostic is attributed to the right line.
 */

import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnosticsByLine } from './tscProbe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const probePath = (n: string) => path.resolve(__dirname, `__tscprobe_negctl_${n}__.ts`);

describe('tscProbe negative control — a cached compiler host still reports real errors', () => {
  it('reports a diagnostic on an off-union literal, on the correct line', () => {
    const errs = diagnosticsByLine(
      probePath('bad'),
      [
        "type Probe = 'alpha' | 'beta';",
        "const ok: Probe = 'alpha'; void ok;",
        "const bad: Probe = 'gamma'; void bad;",
        '',
      ].join('\n'),
    );
    // Line 1 (the valid literal) is clean; line 2 (the off-union one) is not.
    expect(errs.get(1)).toBeUndefined();
    expect(errs.get(2)).toBeDefined();
    expect(errs.get(2)).toContain('gamma');
  });

  it('still reports it after the lib cache is WARM (the regression the cache could cause)', () => {
    // Compile a clean program first so every lib SourceFile is memoized...
    const warm = diagnosticsByLine(
      probePath('warm'),
      ["type Probe = 'alpha' | 'beta';", "const ok: Probe = 'beta'; void ok;", ''].join('\n'),
    );
    expect(warm.size).toBe(0);

    // ...then re-run the failing probe against that warm cache.
    const errs = diagnosticsByLine(
      probePath('badwarm'),
      ["type Probe = 'alpha' | 'beta';", "const bad: Probe = 'delta'; void bad;", ''].join('\n'),
    );
    expect(errs.get(1)).toBeDefined();
    expect(errs.get(1)).toContain('delta');
  });

  it('does not leak one probe body into the next (the virtual file is never cached)', () => {
    // Same virtual PATH, different content: the second compile must see the
    // second body. If the virtual file were memoized like the lib files, this
    // would report the FIRST body's (absent) error and pass for the wrong reason.
    const reused = probePath('reused');
    const first = diagnosticsByLine(
      reused,
      ["type Probe = 'alpha';", "const ok: Probe = 'alpha'; void ok;", ''].join('\n'),
    );
    expect(first.size).toBe(0);

    const second = diagnosticsByLine(
      reused,
      ["type Probe = 'alpha';", "const bad: Probe = 'omega'; void bad;", ''].join('\n'),
    );
    expect(second.get(1)).toBeDefined();
    expect(second.get(1)).toContain('omega');
  });
});
