/**
 * Type-level proof for `defineSkillTool<P, R>` — the `getTools()`-level
 * counterpart to `SWMLService.defineTool`'s schema→handler-args inference.
 *
 * A skill returns its tools as `SkillToolDefinition[]`, whose `handler` field is
 * the loose `SwaigHandler` (`args: Record<string, unknown>`). Wrapping an entry
 * in `defineSkillTool` captures its `parameters` (`P`) and `required` (`R`) via
 * `const` type parameters and feeds them through `ToolArgs`, so the handler's
 * `args` is precise:
 *   - a `required` string prop → `args.x: string` (present, non-optional),
 *   - an `enum` prop → its literal union,
 *   - a non-required prop → optional (`| undefined`),
 *   - a loose pre-built `Record` schema → open `Record<string, unknown>` args
 *     (so existing dynamic-schema skills keep their prior untyped behavior).
 *
 * vitest does not type-check, so these guarantees are driven through the real
 * TypeScript compiler against a probe that imports the SHIPPED `defineSkillTool`
 * (no hand-copied duplicate of the inference types). The probe uses
 * `@ts-expect-error` markers: each must FIRE (the line is a genuine type error),
 * proving the inferred `args` is precise rather than `any`/open.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { probeDiagnostics } from './tscProbe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Type-check `body` as a module that imports the real `defineSkillTool`,
 * resolved against the repo's own tsconfig (so module/lib settings match the
 * shipped build). Returns the diagnostics, separating the expected
 * `@ts-expect-error` reports (TS2578 "unused '@ts-expect-error'") from real
 * errors so the test can assert each marker actually fired.
 */
function typeCheckProbe(body: string): ts.Diagnostic[] {
  const virtual = path.resolve(__dirname, '__skill_tool_probe__.ts');
  // 'repo-tsconfig': this probe IMPORTS real `src/` modules (SkillBase,
  // FunctionResult) and their transitive graph, so it needs the shipped
  // module/lib resolution rather than the hermetic option set.
  //
  // This is the ONE probe whose cost is irreducible: type-checking the real
  // `src/` graph is the point of the test. Measured 2026-07-30 it lands at ~9s
  // per probe on an idle box (the "~0.5-1.3s" this comment used to claim is
  // stale — the `src/` graph has grown since). The explicit `timeout` below is
  // therefore a genuine budget for real work, NOT the papering-over that the
  // hermetic probes had — those were re-parsing the default lib on every call
  // and are now 12-28ms with no extended timeout at all. (See tests/tscProbe.ts.)
  return probeDiagnostics(virtual, body, 'repo-tsconfig');
}

describe('defineSkillTool — schema→args inference', () => {
  it(
    'infers required/optional/enum args precisely (every @ts-expect-error fires)',
    // Budget sized to MEASURED cost, not to a guess: these two probes spawn a
    // real `tsc` program over the shipped `src/` graph and land at ~9s each on
    // an IDLE box (17.7s for the pair). At the former 30s that left barely 1.7x
    // headroom, so when run-ci schedules gates concurrently the worker gets
    // starved and the test times out on wall-clock rather than on anything it
    // asserts. 120s restores real margin under load while still failing fast
    // enough that a genuinely hung compile is caught rather than hanging CI.
    { timeout: 120000 },
    () => {
      // Each `@ts-expect-error` asserts a genuine type error on the next line. If
      // the inference were `any`/open, the marker would be "unused" (TS2578) and
      // surface as a real diagnostic below.
      const diags = typeCheckProbe(
        `import { defineSkillTool } from '${path.resolve(REPO_ROOT, 'src/skills/SkillBase').replace(/\\/g, '/')}';\n` +
          `import { FunctionResult } from '${path.resolve(REPO_ROOT, 'src/FunctionResult').replace(/\\/g, '/')}';\n` +
          `defineSkillTool({\n` +
          `  name: 't', description: 'd',\n` +
          `  parameters: {\n` +
          `    query: { type: 'string', description: 'q' },\n` +
          `    mode: { type: 'string', description: 'm', enum: ['a', 'b'] as const },\n` +
          `    page: { type: 'integer', description: 'p' },\n` +
          `  },\n` +
          `  required: ['query'],\n` +
          `  handler: (args) => {\n` +
          `    const q: string = args.query; void q;\n` + // required string — OK
          `    const m: 'a' | 'b' | undefined = args.mode; void m;\n` + // enum literal, optional — OK
          `    const p: number | undefined = args.page; void p;\n` + // integer, optional — OK
          `    // @ts-expect-error required prop is never undefined\n` +
          `    const bad1: undefined = args.query; void bad1;\n` +
          `    // @ts-expect-error enum prop is narrowed, not an arbitrary string\n` +
          `    const bad2: 'c' = args.mode!; void bad2;\n` +
          `    return new FunctionResult('ok');\n` +
          `  },\n` +
          `});\n`,
      );
      // No real errors: the only diagnostics permitted are the (now-satisfied)
      // expect-errors, which TypeScript reports as zero remaining diagnostics when
      // they fire. Any leftover diagnostic is a genuine failure of the inference.
      const real = diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      expect(real).toEqual([]);
    },
  );

  it(
    'a loose pre-built Record schema degrades to open args (no false errors)',
    // Budget sized to MEASURED cost, not to a guess: these two probes spawn a
    // real `tsc` program over the shipped `src/` graph and land at ~9s each on
    // an IDLE box (17.7s for the pair). At the former 30s that left barely 1.7x
    // headroom, so when run-ci schedules gates concurrently the worker gets
    // starved and the test times out on wall-clock rather than on anything it
    // asserts. 120s restores real margin under load while still failing fast
    // enough that a genuinely hung compile is caught rather than hanging CI.
    { timeout: 120000 },
    () => {
      // Dynamic-schema skills (claude_skills / mcp_gateway / swml_transfer) build
      // `parameters` imperatively as a `Record`, so it cannot be read at the type
      // level — args must fall back to the open record, NOT error.
      const diags = typeCheckProbe(
        `import { defineSkillTool } from '${path.resolve(REPO_ROOT, 'src/skills/SkillBase').replace(/\\/g, '/')}';\n` +
          `import { FunctionResult } from '${path.resolve(REPO_ROOT, 'src/FunctionResult').replace(/\\/g, '/')}';\n` +
          `const dynamic: Record<string, unknown> = { foo: { type: 'string' } };\n` +
          `defineSkillTool({\n` +
          `  name: 't', description: 'd',\n` +
          `  parameters: dynamic,\n` +
          `  handler: (args) => {\n` +
          `    const v: unknown = args['foo']; void v;\n` + // open-record access — OK
          `    return new FunctionResult('ok');\n` +
          `  },\n` +
          `});\n`,
      );
      const real = diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      expect(real).toEqual([]);
    },
  );
});
