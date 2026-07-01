import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseFunctionParams, inferSchema } from '../src/TypeInference.js';
import { getLogger } from '../src/Logger.js';

/**
 * Hardening tests for #19369: the schema inferrer must never emit a
 * wrong-but-plausible schema. It must either parse correctly OR return null
 * and emit a loud, actionable warning telling the author to use an explicit
 * schema.
 */

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // The inferrer logs through getLogger('TypeInference'); spy on that instance.
  const log = getLogger('TypeInference');
  warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('paren-depth parameter extraction', () => {
  it('keeps a call-expression default that contains parens intact', () => {
    // `= makeGreeting()` must not be truncated at the inner `)`.
    const src = 'function f(name, greeting = makeGreeting()) {}';
    const params = parseFunctionParams(src);
    expect(params.map((p) => p.name)).toEqual(['name', 'greeting']);
    expect(params[1]!.defaultValue).toBe('makeGreeting()');
  });

  it('keeps a string default that contains a close paren', () => {
    const src = 'function f(a, b = "(x)") {}';
    const params = parseFunctionParams(src);
    expect(params.map((p) => p.name)).toEqual(['a', 'b']);
    expect(params[1]!.defaultValue).toBe('"(x)"');
  });

  it('keeps a string default that contains a comma', () => {
    const src = "function f(a, b = 'x,y', c) {}";
    const params = parseFunctionParams(src);
    expect(params.map((p) => p.name)).toEqual(['a', 'b', 'c']);
    expect(params[1]!.defaultValue).toBe("'x,y'");
  });

  it('strips line comments inside the parameter list', () => {
    const src = 'function f(\n  a, // the a param\n  b\n) {}';
    const params = parseFunctionParams(src);
    expect(params.map((p) => p.name)).toEqual(['a', 'b']);
  });

  it('strips block comments inside the parameter list', () => {
    const src = 'function f(a /* first */, b /* second */) {}';
    const params = parseFunctionParams(src);
    expect(params.map((p) => p.name)).toEqual(['a', 'b']);
  });

  it('does not split on => inside an arrow default', () => {
    const src = 'function f(cb = () => 1, x) {}';
    const params = parseFunctionParams(src);
    expect(params.map((p) => p.name)).toEqual(['cb', 'x']);
    expect(params[0]!.defaultValue).toBe('() => 1');
  });
});

describe('inferSchema correct parses (parens / strings / calls in defaults)', () => {
  it('infers from a call-expression default without truncation (string fallback)', () => {
    const src = 'function f(name, greeting = makeGreeting()) {}';
    // Use a Function whose toString returns this source.
    const fn = makeFnWithSource(src);
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.paramNames).toEqual(['name', 'greeting']);
    // `name` has no default -> required; `greeting` has a (non-literal) default.
    expect(schema!.required).toEqual(['name']);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('infers a string type from a paren-containing string default', () => {
    const src = 'function f(a = "(x)") {}';
    const fn = makeFnWithSource(src);
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.parameters['a']!.type).toBe('string');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('inferSchema detect-and-refuse', () => {
  it('refuses a rest parameter (null + warn)', () => {
    const fn = (...rest: unknown[]) => rest;
    const schema = inferSchema(fn);
    expect(schema).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/rest parameter/i);
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/defineTypedTool/);
  });

  it('refuses an object-destructuring parameter (null + warn)', () => {
    const src = 'function f({ a, b }) {}';
    const fn = makeFnWithSource(src);
    const schema = inferSchema(fn);
    expect(schema).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/destructuring/i);
  });

  it('refuses an array-destructuring parameter (null + warn)', () => {
    const src = 'function f([a, b]) {}';
    const fn = makeFnWithSource(src);
    const schema = inferSchema(fn);
    expect(schema).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/destructuring/i);
  });

  it('refuses a native/bound function (null + warn)', () => {
    // Simulate a native function source.
    const fn = makeFnWithSource('function () { [native code] }');
    const schema = inferSchema(fn);
    expect(schema).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/native or bound/i);
  });

  it('refuses a genuinely native bound function', () => {
    const bound = parseFunctionParams.bind(null);
    const schema = inferSchema(bound as unknown as (...a: never[]) => unknown);
    expect(schema).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('refuses a minified handler with multiple single-char params (null + warn)', () => {
    const src = 'function f(e, t, n) { return e + t + n; }';
    const fn = makeFnWithSource(src);
    const schema = inferSchema(fn);
    expect(schema).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(String(warnSpy.mock.calls[0][0])).toMatch(/minif/i);
  });

  it('refuses an unbalanced/unextractable parameter list (null + warn)', () => {
    const src = 'function f(a, b';
    const fn = makeFnWithSource(src);
    const schema = inferSchema(fn);
    expect(schema).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});

describe('inferSchema accepts the legitimate cases unchanged', () => {
  it('parses a normal typed handler', () => {
    const fn = (city: string, days = 5) => `${city} ${days}`;
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.paramNames).toEqual(['city', 'days']);
    expect(schema!.required).toEqual(['city']);
    expect(schema!.parameters['days']!.type).toBe('integer');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not flag a single single-char param as minified', () => {
    const fn = (x = 1) => x;
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

/**
 * Build a function value whose `.toString()` returns the given source text,
 * so we can exercise the source-text parser with shapes TypeScript would
 * otherwise reject at the call site (destructuring, native code, etc).
 */
function makeFnWithSource(source: string): (...a: never[]) => unknown {
  const fn = (() => undefined) as unknown as (...a: never[]) => unknown;
  fn.toString = () => source;
  return fn;
}
