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
  const configPath = ts.findConfigFile(REPO_ROOT, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) throw new Error('tsconfig.json not found');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true, skipLibCheck: true };
  const host = ts.createCompilerHost(options);
  const origRead = host.readFile.bind(host);
  host.readFile = (f) => (path.resolve(f) === virtual ? body : origRead(f));
  const origExists = host.fileExists.bind(host);
  host.fileExists = (f) => (path.resolve(f) === virtual ? true : origExists(f));
  const program = ts.createProgram([virtual], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && path.resolve(d.file.fileName) === virtual);
}

describe('defineSkillTool — schema→args inference', () => {
  it(
    'infers required/optional/enum args precisely (every @ts-expect-error fires)',
    { timeout: 30000 },
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
    { timeout: 30000 },
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
