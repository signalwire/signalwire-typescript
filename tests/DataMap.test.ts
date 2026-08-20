import { describe, it, expect, afterEach } from 'vitest';
import {
  DataMap,
  createSimpleApiTool,
  createExpressionTool,
  setAllowedEnvPrefixes,
} from '../src/DataMap.js';
import { FunctionResult } from '../src/FunctionResult.js';

describe('DataMap', () => {
  it('basic builder produces valid swaig function', () => {
    const dm = new DataMap('get_weather')
      .purpose('Get weather')
      .parameter('location', 'string', 'City name', { required: true })
      .webhook('GET', 'https://api.weather.com?q=${location}')
      .output(new FunctionResult('Weather: ${response.temp}'));

    const fn = dm.toSwaigFunction();
    expect(fn['function']).toBe('get_weather');
    expect(fn['description']).toBe('Get weather');
    expect((fn['parameters'] as Record<string, unknown>)['required']).toEqual(['location']);
    const dataMap = fn['data_map'] as Record<string, unknown>;
    expect(dataMap['webhooks']).toBeDefined();
  });

  it('description is alias for purpose', () => {
    const dm = new DataMap('fn').description('desc');
    expect(dm.toSwaigFunction()['description']).toBe('desc');
  });

  it('default description when purpose not set', () => {
    const dm = new DataMap('my_fn');
    dm.webhook('GET', 'https://example.com').output(new FunctionResult('ok'));
    expect(dm.toSwaigFunction()['description']).toBe('Execute my_fn');
  });

  it('parameter with enum', () => {
    const dm = new DataMap('fn').parameter('color', 'string', 'A color', { enum: ['red', 'blue'] });
    const params = dm.toSwaigFunction()['parameters'] as Record<string, unknown>;
    const props = params['properties'] as Record<string, Record<string, unknown>>;
    expect(props['color']!['enum']).toEqual(['red', 'blue']);
  });

  it('expression-based tool', () => {
    const dm = new DataMap('ctrl')
      .purpose('Control playback')
      .parameter('cmd', 'string', 'Command')
      .expression('${args.cmd}', /start.*/, new FunctionResult('Starting'))
      .expression('${args.cmd}', 'stop', new FunctionResult('Stopping'));

    const fn = dm.toSwaigFunction();
    const dataMap = fn['data_map'] as Record<string, unknown>;
    const exprs = dataMap['expressions'] as Record<string, unknown>[];
    expect(exprs.length).toBe(2);
    expect(exprs[0]!['pattern']).toBe('start.*');
    expect(exprs[1]!['pattern']).toBe('stop');
  });

  it('expression with nomatch output', () => {
    const dm = new DataMap('fn').expression(
      '${args.x}',
      'yes',
      new FunctionResult('matched'),
      new FunctionResult('no match'),
    );
    const fn = dm.toSwaigFunction();
    const exprs = (fn['data_map'] as Record<string, unknown>)['expressions'] as Record<
      string,
      unknown
    >[];
    expect(exprs[0]!['nomatch-output']).toEqual({ response: 'no match' });
  });

  // Was `webhook with body and headers`, which read the `body` key back and
  // asserted its contents — pinning a schema-forbidden key as correct. It now
  // asserts `params`, the contract key the engine actually reads.
  it('webhook with params and headers', () => {
    const dm = new DataMap('search')
      .purpose('Search docs')
      .webhook('POST', 'https://api.docs.com/search', {
        headers: { Authorization: 'Bearer TOKEN' },
      })
      .params({ query: '${query}', limit: 3 })
      .output(new FunctionResult('Found: ${response.title}'));

    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks[0]!['method']).toBe('POST');
    expect(webhooks[0]!['headers']).toEqual({ Authorization: 'Bearer TOKEN' });
    expect(webhooks[0]!['params']).toEqual({ query: '${query}', limit: 3 });
    expect(webhooks[0]).not.toHaveProperty('body');
  });

  it('webhook with params', () => {
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .params({ key: 'val' })
      .output(new FunctionResult('ok'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)[
      'webhooks'
    ] as Record<string, unknown>[];
    expect(webhooks[0]!['params']).toEqual({ key: 'val' });
  });

  it('foreach', () => {
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .foreach({ input_key: 'results', output_key: 'out', append: '${this.title}\n' })
      .output(new FunctionResult('${out}'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)[
      'webhooks'
    ] as Record<string, unknown>[];
    expect(webhooks[0]!['foreach']).toEqual({
      input_key: 'results',
      output_key: 'out',
      append: '${this.title}\n',
    });
  });

  it('multiple webhooks with fallback', () => {
    const dm = new DataMap('multi')
      .purpose('Search')
      .webhook('GET', 'https://primary.com')
      .output(new FunctionResult('Primary: ${response.title}'))
      .webhook('GET', 'https://fallback.com')
      .output(new FunctionResult('Fallback: ${response.title}'))
      .fallbackOutput(new FunctionResult('All APIs failed'));

    const fn = dm.toSwaigFunction();
    const dataMap = fn['data_map'] as Record<string, unknown>;
    expect((dataMap['webhooks'] as unknown[]).length).toBe(2);
    expect(dataMap['output']).toEqual({ response: 'All APIs failed' });
  });

  it('error keys on webhook', () => {
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .errorKeys(['error', 'message'])
      .output(new FunctionResult('ok'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)[
      'webhooks'
    ] as Record<string, unknown>[];
    expect(webhooks[0]!['error_keys']).toEqual(['error', 'message']);
  });

  it('global error keys', () => {
    const dm = new DataMap('fn').globalErrorKeys(['err']);
    dm.webhook('GET', 'https://example.com').output(new FunctionResult('ok'));
    const dataMap = dm.toSwaigFunction()['data_map'] as Record<string, unknown>;
    expect(dataMap['error_keys']).toEqual(['err']);
  });

  it('throws if output/params/foreach called without webhook', () => {
    const dm = new DataMap('fn');
    expect(() => dm.output(new FunctionResult('x'))).toThrow('Must add webhook');
    expect(() => dm.params({})).toThrow('Must add webhook');
    expect(() => dm.foreach({ input_key: 'a', output_key: 'b', append: 'c' })).toThrow(
      'Must add webhook',
    );
  });

  it('webhookExpressions', () => {
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .webhookExpressions([
        { string: '${response.status}', pattern: 'ok', output: { response: 'good' } },
      ])
      .output(new FunctionResult('ok'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)[
      'webhooks'
    ] as Record<string, unknown>[];
    // The full expression entry must round-trip — content shape, not just
    // existence — so a stub that wrote an empty array would still fail.
    expect(webhooks[0]!['expressions']).toEqual([
      { string: '${response.status}', pattern: 'ok', output: { response: 'good' } },
    ]);
  });

  it('webhook with advanced options', () => {
    const dm = new DataMap('fn')
      .webhook('POST', 'https://example.com', {
        formParam: 'data',
        inputArgsAsParams: true,
        requireArgs: ['query'],
      })
      .output(new FunctionResult('ok'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)[
      'webhooks'
    ] as Record<string, unknown>[];
    expect(webhooks[0]!['form_param']).toBe('data');
    expect(webhooks[0]!['input_args_as_params']).toBe(true);
    expect(webhooks[0]!['require_args']).toEqual(['query']);
  });
});

describe('createSimpleApiTool', () => {
  it('creates a simple API tool', () => {
    const dm = createSimpleApiTool({
      name: 'weather',
      url: 'https://api.weather.com?q=${location}',
      responseTemplate: 'Temp: ${response.temp}',
      parameters: { location: { type: 'string', description: 'City', required: true } },
    });
    const fn = dm.toSwaigFunction();
    expect(fn['function']).toBe('weather');
    const params = fn['parameters'] as Record<string, unknown>;
    expect(params['required']).toEqual(['location']);
  });

  // `body` is not a valid webhook key: porting-sdk/schema.json `$defs/Webhook`
  // declares exactly ten properties (error_keys, expressions, foreach, headers,
  // input_args_as_params, method, output, params, require_args, url) under
  // `unevaluatedProperties: {"not": {}}`, and neither engine reader
  // (mod_openai/actions.c parse_webhook, mod_openai/bedrock.c
  // bedrock_parse_webhook) looks up "body". Accepting the option and forwarding
  // it into an unread key silently lost the caller's data.
  it('has no body option — passing one is a compile error', () => {
    // Type layer: `body` is rejected by excess-property checking on the literal.
    createSimpleApiTool({
      name: 'poster',
      url: 'https://api.example.com/search',
      responseTemplate: 'Found: ${response.title}',
      method: 'POST',
      // @ts-expect-error `body` is not part of createSimpleApiTool's options
      body: { query: '${args.q}' },
    });

    // Runtime layer: even a cast-through caller gets no `body` on the wire.
    const opts = {
      name: 'poster',
      url: 'https://api.example.com/search',
      responseTemplate: 'Found: ${response.title}',
      method: 'POST',
      body: { query: '${args.q}' },
    };
    const dm = createSimpleApiTool(opts as Parameters<typeof createSimpleApiTool>[0]);
    const emitted = dm.toSwaigFunction();
    const webhooks = (emitted['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks[0]).not.toHaveProperty('body');
  });

  it('emits no body key and stays inside the schema.json webhook properties', () => {
    const dm = createSimpleApiTool({
      name: 'poster',
      url: 'https://api.example.com/search',
      responseTemplate: 'Found: ${response.title}',
      parameters: { q: { type: 'string', description: 'Query', required: true } },
      method: 'POST',
      headers: { Authorization: 'Bearer TOKEN' },
      errorKeys: ['error'],
    });

    const emitted = dm.toSwaigFunction();
    const webhooks = (emitted['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks.length).toBe(1);
    expect(webhooks[0]).not.toHaveProperty('body');

    const allowed = new Set([
      'error_keys',
      'expressions',
      'foreach',
      'headers',
      'input_args_as_params',
      'method',
      'output',
      'params',
      'require_args',
      'url',
    ]);
    const outside = Object.keys(webhooks[0]!).filter((k) => !allowed.has(k));
    expect(outside).toEqual([]);
  });
});

describe('createExpressionTool', () => {
  it('creates expression-based tool', () => {
    const dm = createExpressionTool({
      name: 'ctrl',
      patterns: {
        '${args.cmd}': ['start', new FunctionResult('Starting')],
      },
    });
    const fn = dm.toSwaigFunction();
    const exprs = (fn['data_map'] as Record<string, unknown>)['expressions'] as Record<
      string,
      unknown
    >[];
    expect(exprs.length).toBe(1);
  });
});

// ── Pass 3: DataMap enhancements ──────────────────────────────────

describe('DataMap - registerWithAgent', () => {
  it('registers DataMap with an agent-like object', () => {
    const registered: Record<string, unknown>[] = [];
    const mockAgent = {
      registerSwaigFunction(fn: Record<string, unknown>) {
        registered.push(fn);
      },
    };
    const dm = new DataMap('my_tool')
      .purpose('Test tool')
      .webhook('GET', 'https://example.com')
      .output(new FunctionResult('ok'));

    dm.registerWithAgent(mockAgent);
    expect(registered.length).toBe(1);
    expect(registered[0]!['function']).toBe('my_tool');
  });

  it('registerWithAgent returns this for chaining', () => {
    const mockAgent = { registerSwaigFunction() {} };
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .output(new FunctionResult('ok'));
    expect(dm.registerWithAgent(mockAgent)).toBe(dm);
  });
});

describe('DataMap - ENV expansion', () => {
  it('expands ${ENV.*} variables in webhook URLs', () => {
    const saved = process.env['SWML_TEST_API_KEY'];
    process.env['SWML_TEST_API_KEY'] = 'secret123';
    try {
      const dm = new DataMap('fn')
        .enableEnvExpansion()
        .purpose('Test')
        .webhook('GET', 'https://api.example.com?key=${ENV.SWML_TEST_API_KEY}')
        .output(new FunctionResult('ok'));
      const fn = dm.toSwaigFunction();
      const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
        string,
        unknown
      >[];
      expect(webhooks[0]!['url']).toBe('https://api.example.com?key=secret123');
    } finally {
      if (saved) process.env['SWML_TEST_API_KEY'] = saved;
      else delete process.env['SWML_TEST_API_KEY'];
    }
  });

  it('missing ENV vars expand to empty string', () => {
    delete process.env['SWML_NONEXISTENT_VAR_12345'];
    const dm = new DataMap('fn')
      .enableEnvExpansion()
      .webhook('GET', 'https://api.example.com?key=${ENV.SWML_NONEXISTENT_VAR_12345}')
      .output(new FunctionResult('ok'));
    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks[0]!['url']).toBe('https://api.example.com?key=');
  });

  it('no expansion when enableEnvExpansion not called', () => {
    process.env['TEST_NO_EXPAND'] = 'should-not-appear';
    try {
      const dm = new DataMap('fn')
        .webhook('GET', 'https://api.example.com?key=${ENV.TEST_NO_EXPAND}')
        .output(new FunctionResult('ok'));
      const fn = dm.toSwaigFunction();
      const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
        string,
        unknown
      >[];
      expect(webhooks[0]!['url']).toBe('https://api.example.com?key=${ENV.TEST_NO_EXPAND}');
    } finally {
      delete process.env['TEST_NO_EXPAND'];
    }
  });

  it('expands ENV vars in descriptions and outputs', () => {
    process.env['SWML_SERVICE_NAME'] = 'MyService';
    try {
      const dm = new DataMap('fn')
        .enableEnvExpansion()
        .purpose('Call ${ENV.SWML_SERVICE_NAME} API')
        .webhook('GET', 'https://example.com')
        .output(new FunctionResult('ok'));
      const fn = dm.toSwaigFunction();
      expect(fn['description']).toBe('Call MyService API');
    } finally {
      delete process.env['SWML_SERVICE_NAME'];
    }
  });

  it('enableEnvExpansion returns this for chaining', () => {
    const dm = new DataMap('fn');
    expect(dm.enableEnvExpansion()).toBe(dm);
  });
});

describe('DataMap - ENV prefix whitelist', () => {
  afterEach(() => {
    // Reset to defaults
    setAllowedEnvPrefixes(['SIGNALWIRE_', 'SWML_', 'SW_']);
    delete process.env['SIGNALWIRE_TEST_VAR'];
    delete process.env['SWML_TEST_VAR'];
    delete process.env['DATABASE_URL'];
    delete process.env['SECRET_KEY'];
  });

  it('SIGNALWIRE_ prefix expanded by default', () => {
    process.env['SIGNALWIRE_TEST_VAR'] = 'sw_value';
    const dm = new DataMap('fn')
      .enableEnvExpansion()
      .webhook('GET', 'https://example.com?key=${ENV.SIGNALWIRE_TEST_VAR}')
      .output(new FunctionResult('ok'));
    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks[0]!['url']).toBe('https://example.com?key=sw_value');
  });

  it('SWML_ prefix expanded by default', () => {
    process.env['SWML_TEST_VAR'] = 'swml_value';
    const dm = new DataMap('fn')
      .enableEnvExpansion()
      .webhook('GET', 'https://example.com?key=${ENV.SWML_TEST_VAR}')
      .output(new FunctionResult('ok'));
    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks[0]!['url']).toBe('https://example.com?key=swml_value');
  });

  it('DATABASE_URL not expanded by default', () => {
    process.env['DATABASE_URL'] = 'postgres://secret@host/db';
    const dm = new DataMap('fn')
      .enableEnvExpansion()
      .webhook('GET', 'https://example.com?db=${ENV.DATABASE_URL}')
      .output(new FunctionResult('ok'));
    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks[0]!['url']).toBe('https://example.com?db=');
  });

  it('setAllowedEnvPrefixes overrides defaults', () => {
    setAllowedEnvPrefixes(['DATABASE_']);
    process.env['DATABASE_URL'] = 'postgres://host/db';
    process.env['SIGNALWIRE_TEST_VAR'] = 'should_not_expand';
    const dm = new DataMap('fn')
      .enableEnvExpansion()
      .webhook('GET', 'https://example.com?db=${ENV.DATABASE_URL}&sw=${ENV.SIGNALWIRE_TEST_VAR}')
      .output(new FunctionResult('ok'));
    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks[0]!['url']).toBe('https://example.com?db=postgres://host/db&sw=');
  });

  it('empty prefix list allows all vars', () => {
    setAllowedEnvPrefixes([]);
    process.env['SECRET_KEY'] = 'mysecret';
    const dm = new DataMap('fn')
      .enableEnvExpansion()
      .webhook('GET', 'https://example.com?key=${ENV.SECRET_KEY}')
      .output(new FunctionResult('ok'));
    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks[0]!['url']).toBe('https://example.com?key=mysecret');
  });

  it('per-instance setAllowedEnvPrefixes overrides global', () => {
    process.env['DATABASE_URL'] = 'postgres://host/db';
    const dm = new DataMap('fn')
      .enableEnvExpansion()
      .setAllowedEnvPrefixes(['DATABASE_'])
      .webhook('GET', 'https://example.com?db=${ENV.DATABASE_URL}')
      .output(new FunctionResult('ok'));
    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<
      string,
      unknown
    >[];
    expect(webhooks[0]!['url']).toBe('https://example.com?db=postgres://host/db');
  });
});

/**
 * `DataMap.body()` is GONE — the key it wrote is invalid, not merely ignored.
 *
 * Owner-ruled 2026-07-29, extending the ruling behind `createSimpleApiTool`'s
 * dropped `body` OPTION (this port's a11f4d4, reference f171ce3) from the helper
 * PARAMETER to the public BUILDER METHOD. The same three sources condemn both:
 *
 * - `porting-sdk/schema.json` `$defs/Webhook` declares exactly ten properties
 *   (error_keys, expressions, foreach, headers, input_args_as_params, method,
 *   output, params, require_args, url) under `unevaluatedProperties: {"not": {}}`
 *   — `body` is not among them, so emitting it is a SCHEMA VIOLATION.
 * - `mod_openai/actions.c:735-739` and `bedrock.c:4920-4926` read url, method,
 *   form_param, `params` and `headers` and nothing else; `grep -n '"body"'`
 *   across both files returns ZERO matches.
 * - So the method's only possible effect was producing an invalid document while
 *   silently discarding the caller's payload.
 *
 * `params()` is the correct method for POST/PUT request data — it writes the
 * `params` key, which IS in the contract and IS read.
 */
describe('DataMap body() builder removed', () => {
  it('body() is gone from the DataMap prototype', () => {
    expect('body' in DataMap.prototype).toBe(false);
  });

  it('params() still writes the contract key (positive control)', () => {
    const dm = new DataMap('t')
      .webhook('POST', 'https://x.test')
      .params({ q: '${query}' })
      .output(new FunctionResult('ok'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)[
      'webhooks'
    ] as Record<string, unknown>[];
    expect(webhooks[0]!['params']).toEqual({ q: '${query}' });
    expect(webhooks[0]).not.toHaveProperty('body');
  });
});
