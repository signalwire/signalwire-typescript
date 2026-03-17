/**
 * TypeInference - Runtime schema inference and typed handler wrapping.
 *
 * Extracts parameter names and default values from function source code,
 * infers JSON Schema types from defaults, and creates wrapper functions
 * that unpack args dicts into named positional parameters.
 */

import type { SwaigHandler } from './SwaigFunction.js';

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
 * Returns an array of { name, defaultValue? } objects.
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
 * Returns null if the function appears to be an old-style `(args, rawData)` handler.
 * Otherwise, extracts parameter names and infers types from default values:
 * - Number literals → "integer" (for integers) or "number" (for floats)
 * - String literals → "string"
 * - Boolean literals → "boolean"
 * - No default → "string" (and marked required)
 */
export function inferSchema(fn: Function): InferredSchema | null {
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
 * The wrapper extracts named parameters from the args dict and passes
 * them as positional arguments to the original function.
 */
export function createTypedHandlerWrapper(
  fn: Function,
  paramNames: string[],
  hasRawData: boolean,
): SwaigHandler {
  return (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
    const positionalArgs = paramNames.map((name) => args[name]);
    if (hasRawData) {
      positionalArgs.push(rawData);
    }
    return fn(...positionalArgs);
  };
}
