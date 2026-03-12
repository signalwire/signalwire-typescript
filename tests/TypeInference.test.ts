import { describe, it, expect } from 'vitest';
import { parseFunctionParams, inferSchema, createTypedHandlerWrapper } from '../src/TypeInference.js';
import { SwaigFunctionResult } from '../src/SwaigFunctionResult.js';

describe('parseFunctionParams', () => {
  it('parses arrow function with defaults', () => {
    const fn = (city: string, count = 5) => { return city + count; };
    const params = parseFunctionParams(fn.toString());
    expect(params.length).toBe(2);
    expect(params[0].name).toBe('city');
    expect(params[0].defaultValue).toBeUndefined();
    expect(params[1].name).toBe('count');
    expect(params[1].defaultValue).toBe('5');
  });

  it('parses regular function', () => {
    function myFunc(city: string, count: number) { return city + count; }
    const params = parseFunctionParams(myFunc.toString());
    expect(params.length).toBe(2);
    expect(params[0].name).toBe('city');
    expect(params[1].name).toBe('count');
  });

  it('parses function with no params', () => {
    const fn = () => 'hello';
    const params = parseFunctionParams(fn.toString());
    expect(params.length).toBe(0);
  });

  it('parses function with string default', () => {
    const fn = (name = 'world') => name;
    const params = parseFunctionParams(fn.toString());
    expect(params.length).toBe(1);
    expect(params[0].name).toBe('name');
    // JS runtime may use single or double quotes in Function.toString()
    expect(params[0].defaultValue).toMatch(/^['"]world['"]$/);
  });

  it('parses function with boolean default', () => {
    const fn = (verbose = true) => verbose;
    const params = parseFunctionParams(fn.toString());
    expect(params.length).toBe(1);
    expect(params[0].name).toBe('verbose');
    expect(params[0].defaultValue).toBe('true');
  });
});

describe('inferSchema', () => {
  it('infers schema from arrow function with defaults', () => {
    const fn = (city: string, count = 5, verbose = true) => {};
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.paramNames).toEqual(['city', 'count', 'verbose']);
    expect(schema!.parameters['city'].type).toBe('string');
    expect(schema!.parameters['count'].type).toBe('integer');
    expect(schema!.parameters['verbose'].type).toBe('boolean');
    expect(schema!.required).toEqual(['city']);
  });

  it('returns null for old-style (args, rawData) handler', () => {
    const fn = (args: Record<string, unknown>, rawData: Record<string, unknown>) => {};
    const schema = inferSchema(fn);
    expect(schema).toBeNull();
  });

  it('returns null for old-style (args) handler', () => {
    const fn = (args: Record<string, unknown>) => {};
    const schema = inferSchema(fn);
    expect(schema).toBeNull();
  });

  it('detects rawData parameter and excludes from schema', () => {
    const fn = (city: string, count = 5, rawData: Record<string, unknown>) => {};
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.hasRawData).toBe(true);
    expect(schema!.paramNames).toEqual(['city', 'count']);
    expect(schema!.parameters['rawData']).toBeUndefined();
  });

  it('no rawData when last param is not rawData', () => {
    const fn = (city: string, count = 5) => {};
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.hasRawData).toBe(false);
    expect(schema!.paramNames).toEqual(['city', 'count']);
  });

  it('returns empty schema for no-param function', () => {
    const fn = () => {};
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.paramNames).toEqual([]);
    expect(schema!.required).toEqual([]);
  });

  it('infers string type from string default', () => {
    const fn = (greeting = 'hello') => greeting;
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.parameters['greeting'].type).toBe('string');
    expect(schema!.required).toEqual([]);
  });

  it('infers number type from float default', () => {
    const fn = (temp = 98.6) => temp;
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.parameters['temp'].type).toBe('number');
  });

  it('params without defaults are required', () => {
    const fn = (city: string, state: string) => {};
    const schema = inferSchema(fn);
    expect(schema).not.toBeNull();
    expect(schema!.required).toEqual(['city', 'state']);
  });
});

describe('createTypedHandlerWrapper', () => {
  it('unpacks args dict into positional params', () => {
    const captured: unknown[] = [];
    const fn = (city: string, count: number) => {
      captured.push(city, count);
      return new SwaigFunctionResult('ok');
    };
    const wrapper = createTypedHandlerWrapper(fn, ['city', 'count'], false);
    wrapper({ city: 'NYC', count: 3 }, {});
    expect(captured).toEqual(['NYC', 3]);
  });

  it('passes rawData when hasRawData is true', () => {
    const captured: unknown[] = [];
    const fn = (city: string, rawData: Record<string, unknown>) => {
      captured.push(city, rawData);
      return new SwaigFunctionResult('ok');
    };
    const wrapper = createTypedHandlerWrapper(fn, ['city'], true);
    const rawData = { call_id: '123' };
    wrapper({ city: 'LA' }, rawData);
    expect(captured).toEqual(['LA', rawData]);
  });

  it('missing args default to undefined', () => {
    const captured: unknown[] = [];
    const fn = (city: string, count: number) => {
      captured.push(city, count);
      return new SwaigFunctionResult('ok');
    };
    const wrapper = createTypedHandlerWrapper(fn, ['city', 'count'], false);
    wrapper({ city: 'SF' }, {});
    expect(captured).toEqual(['SF', undefined]);
  });

  it('does not pass rawData when hasRawData is false', () => {
    const captured: unknown[] = [];
    const fn = (...allArgs: unknown[]) => {
      captured.push(...allArgs);
      return new SwaigFunctionResult('ok');
    };
    const wrapper = createTypedHandlerWrapper(fn, ['city'], false);
    wrapper({ city: 'Boston' }, { call_id: 'abc' });
    expect(captured).toEqual(['Boston']);
  });
});
