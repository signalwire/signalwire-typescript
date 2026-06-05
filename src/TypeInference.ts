/**
 * TypeInference - Runtime schema inference and typed handler wrapping.
 *
 * Extracts parameter names and default values from function source code,
 * infers JSON Schema types from defaults, and creates wrapper functions
 * that unpack args dicts into named positional parameters.
 */

import type { SwaigHandler } from './SwaigFunction.js';
import type { FunctionResult } from './FunctionResult.js';

/**
 * A typed SWAIG tool handler: a function the SDK introspects and wraps so it
 * receives the AI-extracted arguments as *named positional parameters* (any
 * arity, optionally with a trailing `rawData` record) rather than the raw
 * `(args, rawData)` pair of {@link SwaigHandler}.
 *
 * This is the precise replacement for the bare `Function` type at the
 * typed-tool sites: it constrains the value to a *callable whose return is a
 * valid SWAIG result* (a {@link FunctionResult}, a `{ response }`-style record,
 * or a string — sync or async), which `Function` does not — so a non-callable,
 * or a callable returning `void`/`boolean`/etc., is now a compile-time error.
 *
 * Parameters are `...args: never[]` rather than `...unknown[]`: the handler's
 * real parameters are user-named with arbitrary types (`(city: string, days =
 * 5) => …`) and are recovered from `fn.toString()` by {@link inferSchema}, so
 * the type must accept *any* concrete positional list. Under
 * `strictFunctionTypes`, `never[]` makes the parameter position accept any
 * function (every param type is a supertype of `never`) while still pinning the
 * return type — exactly "callable returning a SWAIG result, params don't
 * matter". (`...unknown[]` would wrongly REJECT a `(city: string) => …` handler,
 * defeating the purpose.)
 */
export type TypedToolHandler = (
  ...args: never[]
) => FunctionResult | Record<string, unknown> | string | Promise<FunctionResult | Record<string, unknown> | string>;

/**
 * A function the SDK *introspects* (reads `fn.toString()` to recover parameter
 * names/defaults) but whose return value it does not consume. `inferSchema`
 * only inspects the parameter list, so — unlike {@link TypedToolHandler} — its
 * input is return-agnostic. Still a precise improvement over the bare
 * `Function`: it is a *callable* (rejecting non-functions) with an arbitrary
 * concrete parameter list (`...args: never[]` accepts any), and any return.
 * Every {@link TypedToolHandler} is assignable to it.
 */
export type IntrospectableFn = (...args: never[]) => unknown;

/** A parsed function parameter with optional default value. */
export interface ParsedParam {
  name: string;
  defaultValue?: string;
}

/** Result of schema inference from a function. */
export interface InferredSchema {
  /** JSON Schema properties keyed by parameter name. */
  parameters: Record<string, { type: string; description?: string }>;
  /** List of required parameter names (those without defaults). */
  required: string[];
  /** Ordered parameter names (excluding rawData). */
  paramNames: string[];
  /** Whether the function accepts a rawData parameter. */
  hasRawData: boolean;
}

/**
 * Parse function parameter names and default values from source code.
 *
 * Handles arrow functions, regular functions, and method shorthand.
 *
 * @param source - The function source text, typically from `fn.toString()`.
 * @returns An array of `{ name, defaultValue? }` records in declaration order.
 *   Returns an empty array if no parameter list is present.
 */
export function parseFunctionParams(source: string): ParsedParam[] {
  // Extract the parameter list between the first set of parens
  // Handle: function f(a, b) {}, (a, b) => {}, async (a, b) => {}
  const match = source.match(/^[^(]*\(([^)]*)\)/);
  if (!match) return [];

  const paramStr = match[1].trim();
  if (!paramStr) return [];

  const params: ParsedParam[] = [];
  // Split on commas, but respect nested structures (not needed for simple params)
  let depth = 0;
  let current = '';
  for (let i = 0; i < paramStr.length; i++) {
    const ch = paramStr[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      params.push(parseOneParam(current.trim()));
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) {
    params.push(parseOneParam(current.trim()));
  }

  return params;
}

function parseOneParam(param: string): ParsedParam {
  // Strip TypeScript type annotations: `name: type = default` or `name: type`
  // We need to handle `name = default` and `name: Type = default`
  const eqIdx = param.indexOf('=');
  if (eqIdx !== -1) {
    const beforeEq = param.slice(0, eqIdx).trim();
    const defaultValue = param.slice(eqIdx + 1).trim();
    // beforeEq might be "name: Type" — extract just the name
    const name = extractParamName(beforeEq);
    return { name, defaultValue };
  }
  // No default — might have type annotation
  const name = extractParamName(param);
  return { name };
}

function extractParamName(expr: string): string {
  // Handle "name: Type" — take everything before the colon
  const colonIdx = expr.indexOf(':');
  if (colonIdx !== -1) {
    return expr.slice(0, colonIdx).trim();
  }
  return expr.trim();
}

/**
 * Infer a JSON Schema from a function's parameters.
 *
 * Extracts parameter names and infers JSON Schema types from default-value
 * literals:
 *
 * - Number literals → `"integer"` (whole numbers) or `"number"` (decimals)
 * - String literals → `"string"`
 * - Boolean literals → `"boolean"`
 * - No default → `"string"` (and the parameter is marked required)
 *
 * @param fn - The function to inspect. Arrow functions, regular functions, and
 *   method shorthand all work. Typed as {@link IntrospectableFn} because only
 *   the parameter list is read — the handler's return is irrelevant to schema
 *   inference (a {@link TypedToolHandler} satisfies this).
 * @returns An {@link InferredSchema} describing the parameters, or `null` when
 *   the function looks like an old-style `(args, rawData)` SWAIG handler (in
 *   which case no inference is attempted).
 */
export function inferSchema(fn: IntrospectableFn): InferredSchema | null {
  const source = fn.toString();
  const parsed = parseFunctionParams(source);

  if (parsed.length === 0) {
    return { parameters: {}, required: [], paramNames: [], hasRawData: false };
  }

  // Detection heuristic: if the function looks like an old-style handler
  // with (args, rawData) or (args) pattern, return null
  if (parsed.length <= 2) {
    const firstName = parsed[0].name;
    if (firstName === 'args' || firstName === 'arguments') {
      // This is likely old-style (args, rawData) — skip inference
      return null;
    }
  }

  // Check if last param is rawData
  const hasRawData = parsed.length > 0 && parsed[parsed.length - 1].name === 'rawData';
  const schemaParams = hasRawData ? parsed.slice(0, -1) : parsed;

  const parameters: Record<string, { type: string; description?: string }> = {};
  const required: string[] = [];
  const paramNames: string[] = [];

  for (const p of schemaParams) {
    paramNames.push(p.name);
    const inferredType = inferTypeFromDefault(p.defaultValue);
    parameters[p.name] = { type: inferredType, description: `The ${p.name} parameter` };
    if (p.defaultValue === undefined) {
      required.push(p.name);
    }
  }

  return { parameters, required, paramNames, hasRawData };
}

function inferTypeFromDefault(defaultValue?: string): string {
  if (defaultValue === undefined) return 'string';

  const trimmed = defaultValue.trim();

  // Boolean
  if (trimmed === 'true' || trimmed === 'false') return 'boolean';

  // Number: integer vs float
  if (/^-?\d+$/.test(trimmed)) return 'integer';
  if (/^-?\d+\.\d+$/.test(trimmed)) return 'number';

  // String (quoted)
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith('`') && trimmed.endsWith('`'))) {
    return 'string';
  }

  // Default fallback
  return 'string';
}

/**
 * Create a wrapper function that adapts a typed handler to the standard
 * `(args, rawData) => result` SWAIG handler signature.
 *
 * The wrapper extracts named parameters from the args dict and passes them
 * as positional arguments to the original function.
 *
 * @param fn - The typed handler whose parameters match `paramNames` in order.
 * @param paramNames - Ordered list of parameter names extracted from `fn`,
 *   produced by {@link inferSchema}.
 * @param hasRawData - When `true`, the raw-data record is appended as the
 *   final positional argument to mirror the old-style handler shape.
 * @returns A {@link SwaigHandler} suitable for registration with
 *   {@link AgentBase.defineTool}.
 */
export function createTypedHandlerWrapper(
  fn: TypedToolHandler,
  paramNames: string[],
  hasRawData: boolean,
): SwaigHandler {
  return (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
    const positionalArgs = paramNames.map((name) => args[name]);
    if (hasRawData) {
      positionalArgs.push(rawData);
    }
    // This wrapper is the type-erasure boundary: at runtime we spread the
    // AI-supplied args positionally into the handler. `TypedToolHandler`'s
    // `...args: never[]` deliberately accepts any concrete parameter list at
    // the *definition* site (so `(city: string) => …` is assignable), which
    // means we can't statically pass `unknown` values here — exactly what the
    // bare `Function` type erased implicitly. Cast to a permissive call
    // signature for this one dynamic dispatch.
    return (fn as (...a: unknown[]) => ReturnType<TypedToolHandler>)(...positionalArgs);
  };
}
