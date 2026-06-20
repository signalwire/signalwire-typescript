/**
 * TypeInference - Runtime schema inference and typed handler wrapping.
 *
 * Extracts parameter names and default values from function source code,
 * infers JSON Schema types from defaults, and creates wrapper functions
 * that unpack args dicts into named positional parameters.
 */

import type { SwaigHandler } from './SwaigFunction.js';
import type { FunctionResult } from './FunctionResult.js';
import { getLogger } from './Logger.js';

const log = getLogger('TypeInference');

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
) =>
  | FunctionResult
  | Record<string, unknown>
  | string
  | Promise<FunctionResult | Record<string, unknown> | string>;

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

/**
 * Strip line (`//`) and block (`/* *\/`) comments from function source so the
 * parameter extractor never mistakes commented-out text for real syntax.
 * String and template literals are preserved verbatim (a `//` inside a string
 * is data, not a comment).
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    // String / template literals — copy through untouched.
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = src[i];
        out += c;
        if (c === '\\') {
          // Copy the escaped char too.
          i++;
          if (i < n) out += src[i];
          i++;
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    // Line comment.
    if (ch === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // Block comment.
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Extract the source text of the parameter list — the content between the
 * function's opening `(` and its matching close `)` — tracking bracket nesting
 * depth and skipping over string/template-literal content so a `)` inside a
 * default value (e.g. `= makeGreeting()` or `= "(x)"`) does not prematurely
 * terminate the list.
 *
 * @param source - Comment-stripped function source.
 * @returns The raw parameter-list text (without the enclosing parens), or
 *   `null` when no balanced parameter list can be found (unbalanced/garbled).
 */
function extractParamList(source: string): string | null {
  const open = source.indexOf('(');
  if (open === -1) return null;

  let depth = 0;
  let i = open;
  const n = source.length;
  for (; i < n; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < n) {
        const c = source[i];
        if (c === '\\') {
          i += 2;
          continue;
        }
        if (c === quote) break;
        i++;
      }
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0 && ch === ')') {
        return source.slice(open + 1, i);
      }
      // A close-bracket that drops us below the param-list paren means the
      // input is unbalanced/unextractable.
      if (depth < 0) return null;
    }
  }
  // Reached EOF without closing the parameter list.
  return null;
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
  const clean = stripComments(source);
  const paramListText = extractParamList(clean);
  if (paramListText === null) return [];

  const paramStr = paramListText.trim();
  if (!paramStr) return [];

  return splitParamList(paramStr).map((raw) => parseOneParam(raw.trim()));
}

/**
 * Split a parameter-list string on top-level commas, respecting nested
 * brackets and skipping over string/template-literal content (so a comma inside
 * a default like `= { a: 1, b: 2 }` or `= "a,b"` does not split a param).
 */
function splitParamList(paramStr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < paramStr.length; i++) {
    const ch = paramStr[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      current += ch;
      i++;
      while (i < paramStr.length) {
        const c = paramStr[i];
        current += c;
        if (c === '\\') {
          i++;
          if (i < paramStr.length) current += paramStr[i];
          i++;
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        i++;
      }
      i--; // outer loop will re-increment
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function parseOneParam(param: string): ParsedParam {
  // Strip TypeScript type annotations: `name: type = default` or `name: type`
  // We need to handle `name = default` and `name: Type = default`.
  const eqIdx = findAssignmentEquals(param);
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

/**
 * Find the index of the default-value assignment `=`, ignoring `==`, `===`,
 * `=>`, `>=`, `<=`, `!=` and any `=` inside string/template literals or nested
 * brackets. Returns -1 if there is no top-level assignment.
 */
function findAssignmentEquals(param: string): number {
  let depth = 0;
  for (let i = 0; i < param.length; i++) {
    const ch = param[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < param.length) {
        const c = param[i];
        if (c === '\\') {
          i += 2;
          continue;
        }
        if (c === quote) break;
        i++;
      }
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === '=' && depth === 0) {
      const prev = param[i - 1];
      const next = param[i + 1];
      // Skip ==, ===, =>, >=, <=, !=
      if (next === '=' || next === '>') continue;
      if (prev === '=' || prev === '>' || prev === '<' || prev === '!') continue;
      return i;
    }
  }
  return -1;
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

  // Refuse native / bound functions outright: their source is
  // `function () { [native code] }` (or similar) — there is no real parameter
  // list to recover, so any inferred schema would be a fabrication.
  if (/\{\s*\[native code\]\s*\}/.test(source)) {
    log.warn(
      'Cannot infer a SWAIG parameter schema from a native or bound function ' +
        '(its source is opaque). Register this tool with defineTypedTool and an ' +
        'explicit `parameters` JSON Schema instead.',
    );
    return null;
  }

  const clean = stripComments(source);
  const paramListText = extractParamList(clean);
  if (paramListText === null) {
    log.warn(
      'Could not extract a balanced parameter list from the handler source — ' +
        'the inferred schema would be unreliable. Register this tool with ' +
        'defineTypedTool and an explicit `parameters` JSON Schema instead.',
    );
    return null;
  }

  const parsed = parseFunctionParams(source);

  if (parsed.length === 0) {
    return { parameters: {}, required: [], paramNames: [], hasRawData: false };
  }

  // Detect-and-refuse parameter shapes we cannot faithfully turn into a JSON
  // Schema. Emitting a wrong-but-plausible schema would silently advertise
  // garbage parameters to the AI, so we bail and require an explicit schema.
  for (const p of parsed) {
    const name = p.name;
    if (name.startsWith('...')) {
      log.warn(
        `Cannot infer a SWAIG parameter schema: the handler uses a rest ` +
          `parameter ('${name}'), which has no fixed shape. Register this tool ` +
          `with defineTypedTool and an explicit \`parameters\` JSON Schema instead.`,
      );
      return null;
    }
    if (name.startsWith('{') || name.startsWith('[')) {
      log.warn(
        'Cannot infer a SWAIG parameter schema: the handler uses a ' +
          'destructuring parameter pattern, whose property names/types cannot ' +
          'be recovered reliably from source. Register this tool with ' +
          'defineTypedTool and an explicit `parameters` JSON Schema instead.',
      );
      return null;
    }
    if (name === '' || !/^[A-Za-z_$][\w$]*$/.test(name)) {
      log.warn(
        `Cannot infer a SWAIG parameter schema: a parameter name ('${name}') ` +
          `is not a plain identifier and could not be parsed. Register this tool ` +
          `with defineTypedTool and an explicit \`parameters\` JSON Schema instead.`,
      );
      return null;
    }
  }

  // Detection heuristic: if the function looks like an old-style handler
  // with (args, rawData) or (args) pattern, return null
  if (parsed.length <= 2) {
    const firstName = parsed[0]?.name;
    if (firstName === 'args' || firstName === 'arguments') {
      // This is likely old-style (args, rawData) — skip inference
      return null;
    }
  }

  // Check if last param is rawData
  const hasRawData = parsed.length > 0 && parsed[parsed.length - 1]!.name === 'rawData';
  const schemaParams = hasRawData ? parsed.slice(0, -1) : parsed;

  // Minification heuristic: a build step that mangles handler names produces
  // multiple single-character parameters. The recovered names ('e', 't', …)
  // would NOT match the AI's argument keys, so the schema is unreliable.
  const singleChar = schemaParams.filter((p) => p.name.length === 1);
  if (singleChar.length >= 2) {
    log.warn(
      'The handler has multiple single-character parameter names ' +
        `(${singleChar.map((p) => `'${p.name}'`).join(', ')}), which usually means ` +
        'the build minified it. The inferred schema is unreliable — register this ' +
        'tool with defineTypedTool and an explicit `parameters` JSON Schema instead.',
    );
    return null;
  }

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
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
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
