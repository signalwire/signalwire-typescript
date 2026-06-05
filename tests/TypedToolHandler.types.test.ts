/**
 * Type-level + runtime proof for the precise `TypedToolHandler` signature that
 * replaced the bare `Function` type at the three typed-tool sites:
 *   - TypeInference.inferSchema(fn)
 *   - TypeInference.createTypedHandlerWrapper(fn, …)
 *   - AgentBase.defineTypedTool({ handler })
 *
 * The bare `Function` accepted ANY callable (and only a callable in the loosest
 * sense) — including ones that return nothing usable as a SWAIG result, and it
 * offered no parameter/return guidance. The precise `TypedToolHandler` is
 *
 *     (...args: unknown[]) =>
 *       FunctionResult | Record<string, unknown> | string | Promise<…>
 *
 * so a non-callable, or a callable whose return can't be a SWAIG result, is now
 * a COMPILE-time error, while every legitimate handler shape still type-checks.
 *
 * vitest does not type-check, so the rejection/acceptance guarantees are driven
 * through the real TypeScript compiler against the EXACT alias text extracted
 * from the shipped source (no hand-copied duplicate). A trailing runtime block
 * drives the real inference/wrapper/registration path with a valid handler so
 * the type and the behavior are both exercised.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { inferSchema, createTypedHandlerWrapper, type TypedToolHandler } from '../src/TypeInference.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TYPE_INFERENCE_SRC = path.resolve(__dirname, '../src/TypeInference.ts');

/** Extract the exact `export type TypedToolHandler = …;` body from the shipped source. */
function extractTypedToolHandler(): string {
  const src = readFileSync(TYPE_INFERENCE_SRC, 'utf-8');
  const m = src.match(/export type TypedToolHandler\s*=\s*([\s\S]*?);/);
  if (!m) throw new Error(`could not locate \`export type TypedToolHandler = …;\` in ${TYPE_INFERENCE_SRC}`);
  return m[1].replace(/\s+/g, ' ').trim();
}

/**
 * Compile a minimal `FunctionResult` shim + the REAL `TypedToolHandler` alias +
 * `body` (one statement per line); return diagnostics keyed by body line.
 * Header is 2 lines (shim class + alias), so body line N → file line N+2.
 * Hermetic: no @types, no lib-check.
 */
function typeCheckHandler(body: string): Map<number, string> {
  const virtual = path.resolve(__dirname, '__typed_handler_probe__.ts');
  const source =
    `declare class FunctionResult { private __brand: 'fr'; }\n` +
    `type TypedToolHandler = ${extractTypedToolHandler()};\n` +
    `${body}\n`;
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

describe('TypedToolHandler — precise typed-tool handler signature', () => {
  it('accepts every legitimate handler shape (string / record / FunctionResult / async)', () => {
    const errs = typeCheckHandler(
      `const h1: TypedToolHandler = (city: string) => 'ok'; void h1;\n` +                        // line 0 → diag 2
      `const h2: TypedToolHandler = (city: string, n = 1) => ({ response: 'ok' }); void h2;\n` + // line 1 → diag 3
      `const h3: TypedToolHandler = () => new FunctionResult(); void h3;\n` +                    // line 2 → diag 4
      `const h4: TypedToolHandler = async (q: string) => 'later'; void h4;`,                     // line 3 → diag 5
    );
    expect(errs.get(2)).toBeUndefined(); // string return
    expect(errs.get(3)).toBeUndefined(); // record return
    expect(errs.get(4)).toBeUndefined(); // FunctionResult return
    expect(errs.get(5)).toBeUndefined(); // async (Promise) return
  });

  it('REJECTS a non-callable (the bare `Function` would too — but as `unknown`, not a SWAIG result)', () => {
    const errs = typeCheckHandler(
      `const notFn: TypedToolHandler = 42; void notFn;\n` +              // line 0 → diag 2
      `const obj: TypedToolHandler = { run() {} }; void obj;`,           // line 1 → diag 3
    );
    expect(errs.get(2)).toBeDefined();
    expect(errs.get(2)!).toMatch(/not assignable to type 'TypedToolHandler'/);
    expect(errs.get(3)).toBeDefined();
  });

  it('REJECTS a callable whose return cannot be a SWAIG result (void / boolean)', () => {
    const errs = typeCheckHandler(
      `const voidH: TypedToolHandler = (city: string): void => { void city; }; void voidH;\n` + // line 0 → diag 2
      `const boolH: TypedToolHandler = (city: string): boolean => true; void boolH;`,           // line 1 → diag 3
    );
    // A `() => void` / `() => boolean` is NOT assignable to a handler whose
    // declared return is FunctionResult | record | string | Promise<…>.
    expect(errs.get(2)).toBeDefined();
    expect(errs.get(2)!).toMatch(/not assignable to type 'TypedToolHandler'/);
    expect(errs.get(3)).toBeDefined();
    expect(errs.get(3)!).toMatch(/not assignable to type 'TypedToolHandler'/);
  });

  it('runtime: a valid typed handler drives inferSchema + wrapper for real', () => {
    const captured: unknown[] = [];
    const handler: TypedToolHandler = (city: string, days = 5) => {
      captured.push(city, days);
      return new FunctionResult(`Weather for ${city}, ${days}`);
    };
    const schema = inferSchema(handler);
    expect(schema).not.toBeNull();
    expect(schema!.paramNames).toEqual(['city', 'days']);
    expect(schema!.required).toEqual(['city']);

    const wrapped = createTypedHandlerWrapper(handler, schema!.paramNames, schema!.hasRawData);
    const out = wrapped({ city: 'NYC', days: 3 }, {});
    expect(captured).toEqual(['NYC', 3]);
    expect(out).toBeInstanceOf(FunctionResult);
  });

  it('runtime: defineTypedTool accepts the typed handler and the wrapped tool executes it', async () => {
    const agent = new AgentBase({ name: 'typed-handler-test', route: '/t' } as any);
    const captured: unknown[] = [];
    agent.defineTypedTool({
      name: 'greet',
      description: 'Greet someone by name',
      handler: (name: string, excited = false) => {
        captured.push(name, excited);
        return new FunctionResult(excited ? `HI ${name}!` : `hi ${name}`);
      },
    });
    const tool = agent.getTool('greet');
    expect(tool).toBeDefined();
    expect(tool!.isTypedHandler).toBe(true);
    const result = await tool!.execute({ name: 'Ada', excited: true });
    expect(captured).toEqual(['Ada', true]);
    // The handler's FunctionResult flows through to the SWAIG response.
    expect(JSON.stringify(result)).toContain('HI Ada!');

    // Inline documentary marker against the REAL `defineTypedTool` parameter
    // type (not an extracted alias): a non-callable `handler` is a compile-time
    // error. Contextually typed so the `@ts-expect-error` is meaningful — it
    // exercises the actual public signature. (vitest does not type-check, so
    // the *enforced* guarantee is the tsc probe above; this is documentation
    // that stays honest under a tests typecheck.)
    type DefineTypedToolOpts = Parameters<typeof agent.defineTypedTool>[0];
    const badOpts: DefineTypedToolOpts = {
      name: 'x',
      description: 'x',
      // @ts-expect-error — a number is not a TypedToolHandler
      handler: 123,
    };
    void badOpts;
  });
});
