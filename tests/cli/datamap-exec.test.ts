/**
 * swaig-test's DataMap simulator runs a data_map as the platform does.
 * Mirrors signalwire-python tests/unit/cli/test_datamap_templates.py and
 * test_datamap_exec_arrays.py, plus the expression and fallback steps.
 */

import { executeDataMap, expandTemplate } from '../../src/cli/datamap-exec.js';
import { DataMap } from '../../src/DataMap.js';
import { FunctionResult } from '../../src/FunctionResult.js';

const DATA = {
  args: { city: 'New York', target: 'Sales' },
  meta_data: { table: { sales: '+15551234567' } },
  array: [{ joke: 'ha' }],
};

describe('expandTemplate', () => {
  it.each([
    ['${args.city}', 'New York'],
    ['%{args.city}', 'New York'],
    ['${lc:args.city}', 'new york'],
    ['${enc:args.city}', 'New%20York'],
    // The platform has no enc:url helper: it reads url:args.city as a path
    ['${enc:url:args.city}', '<MISSING:url:args.city>'],
    ['${lc:enc:args.city}', 'new%20york'],
    ['${meta_data.table.${lc:args.target}}', '+15551234567'],
    ['${array[0].joke}', 'ha'],
    ['${args.missing}', '<MISSING:args.missing>'],
    ['${array[5].joke}', '<MISSING:array[5].joke>'],
    ['@{expr 1 + 2}', '@{expr 1 + 2}'],
    // enc: encodes what FreeSWITCH's switch_url_encode encodes; / ! ' ( ) * stay
    ['${enc:args.odd}', "a/b!'()*"],
  ])('%s -> %s', (template, expected) => {
    expect(expandTemplate(template, { ...DATA, args: { ...DATA.args, odd: "a/b!'()*" } })).toBe(
      expected,
    );
  });
});

/** A fetch that answers with `payload` (JSON) and `status`, recording what it was sent. */
function fakeFetch(payload: unknown, status = 200) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchImpl = async (url: string, init: { method: string; body?: string }) => {
    calls.push({ url, method: init.method, body: init.body });
    return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
      status,
    });
  };
  return { calls, fetchImpl };
}

const weather = (output: unknown) => ({
  function: 'get_weather',
  data_map: {
    webhooks: [{ url: 'https://api.example.com/w?q=${lc:enc:args.city}', method: 'GET', output }],
  },
});

describe('executeDataMap webhooks', () => {
  it('reads an object response from the root', async () => {
    const { calls, fetchImpl } = fakeFetch({ current: { temp_f: 72 } });
    const result = await executeDataMap(
      weather({ response: "It's ${current.temp_f} degrees" }),
      { city: 'New York' },
      { fetchImpl },
    );
    expect(result).toEqual({ response: "It's 72 degrees" });
    expect(calls[0]!.url).toBe('https://api.example.com/w?q=new%20york');
  });

  it('hints when ${response.<field>} does not resolve', async () => {
    const { fetchImpl } = fakeFetch({ current: { temp_f: 72 } });
    const lines: string[] = [];
    const result = await executeDataMap(
      weather({ response: '${response.current.temp_f}' }),
      { city: 'x' },
      { fetchImpl, log: (l) => void lines.push(l) },
    );
    expect(JSON.stringify(result)).toContain('<MISSING:response.current.temp_f>');
    expect(lines.join('\n')).toContain('not ${response.<field>}');
  });

  it.each([undefined, ['error'], 'error'])(
    'puts an array response under array (error_keys %j)',
    async (errorKeys) => {
      const { fetchImpl } = fakeFetch([{ joke: 'Why did the webhook cross the road?' }]);
      const fn = {
        data_map: {
          webhooks: [
            {
              url: 'https://jokes.example.com',
              method: 'GET',
              output: { response: 'Joke: ${array[0].joke}' },
              ...(errorKeys ? { error_keys: errorKeys } : {}),
            },
          ],
          output: { response: 'The joke service failed.' },
        },
      };
      const result = await executeDataMap(fn, {}, { fetchImpl });
      expect(result).toEqual({ response: 'Joke: Why did the webhook cross the road?' });
    },
  );

  it('fails a webhook on an error key in an object response, and uses the fallback', async () => {
    const { fetchImpl } = fakeFetch({ error: 'down' });
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://x.example.com',
            method: 'GET',
            error_keys: ['error'],
            output: { response: 'ok' },
          },
        ],
        output: { response: 'The service failed.' },
      },
    };
    expect(await executeDataMap(fn, {}, { fetchImpl })).toEqual({
      response: 'The service failed.',
    });
  });

  it('fails a webhook on a body that is not JSON, but not on a non-2xx status', async () => {
    const fn = (url: string) => ({
      data_map: {
        webhooks: [{ url, method: 'GET', output: { response: 'ok ${http_code}' } }],
        output: { response: 'fallback' },
      },
    });
    expect(await executeDataMap(fn('https://a'), {}, fakeFetch({ ok: 1 }, 503))).toEqual({
      response: 'ok 503',
    });
    expect(await executeDataMap(fn('https://a'), {}, fakeFetch('not json'))).toEqual({
      response: 'fallback',
    });
  });

  it('sends params as the expanded JSON body', async () => {
    const { calls, fetchImpl } = fakeFetch({ id: 7 });
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://api.example.com/orders',
            method: 'POST',
            params: { item: '${args.item}', qty: '${args.qty}' },
            output: { response: 'Order ${id}' },
          },
        ],
      },
    };
    expect(await executeDataMap(fn, { item: 'tea', qty: 2 }, { fetchImpl })).toEqual({
      response: 'Order 7',
    });
    expect(JSON.parse(calls[0]!.body!)).toEqual({ item: 'tea', qty: '2' });
  });

  it('runs foreach over a response array', async () => {
    const { fetchImpl } = fakeFetch({ items: [{ t: 'a' }, { t: 'b' }, { t: 'c' }] });
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://x',
            method: 'GET',
            foreach: { input_key: 'items', output_key: 'list', max: 2, append: '[${this.t}]' },
            output: { response: 'Items: ${list}' },
          },
        ],
      },
    };
    expect(await executeDataMap(fn, {}, { fetchImpl })).toEqual({ response: 'Items: [a][b]' });
  });

  it('expands templates inside nested output values', async () => {
    const { fetchImpl } = fakeFetch({ name: 'Ann' });
    const fn = weather({
      response: 'Found ${name}',
      action: [{ set_global_data: { customer: '${name}' } }],
    });
    expect(await executeDataMap(fn, { city: 'x' }, { fetchImpl })).toEqual({
      response: 'Found Ann',
      action: [{ set_global_data: { customer: 'Ann' } }],
    });
  });

  it('returns an error when every webhook fails with no fallback output', async () => {
    const { fetchImpl } = fakeFetch('not json', 500);
    const fn = { data_map: { webhooks: [{ url: 'https://x', method: 'GET', output: 'ok' }] } };
    expect(await executeDataMap(fn, {}, { fetchImpl })).toEqual({
      error: 'All webhooks failed and no fallback output defined',
      status: 'failed',
    });
  });
});

describe('executeDataMap expressions', () => {
  const fn = {
    data_map: {
      expressions: [
        {
          string: '${args.command}',
          pattern: '^start',
          output: { response: 'Starting', action: [{ say: 'go' }] },
          'nomatch-output': { response: 'Unknown command ${args.command}' },
        },
      ],
    },
  };

  it('produces output when the expanded string matches the pattern', async () => {
    expect(await executeDataMap(fn, { command: 'start now' })).toEqual({
      response: 'Starting',
      action: [{ say: 'go' }],
    });
  });

  it('produces nomatch-output when it does not', async () => {
    expect(await executeDataMap(fn, { command: 'stop' })).toEqual({
      response: 'Unknown command stop',
    });
  });

  it('does not reach the network for a refused private address', async () => {
    const result = await executeDataMap(
      {
        data_map: {
          webhooks: [{ url: 'http://127.0.0.1/x', method: 'GET', output: 'ok' }],
          output: 'refused',
        },
      },
      {},
    );
    expect(result).toBe('refused');
  });
});

describe('found in review', () => {
  it('times out a webhook whose body stalls after the headers', async () => {
    const fetchImpl = async () =>
      new Response(new ReadableStream({ pull: () => new Promise<void>(() => undefined) }), {
        status: 200,
      });
    const fn = {
      data_map: {
        webhooks: [{ url: 'https://slow', method: 'GET', output: 'ok' }],
        output: { response: 'timed out' },
      },
    };
    expect(await executeDataMap(fn, {}, { fetchImpl, timeoutSeconds: 0.05 })).toEqual({
      response: 'timed out',
    });
  });

  it('fails a webhook when an error key is present, whatever its value, as the platform does', async () => {
    const fn = {
      data_map: {
        webhooks: [{ url: 'https://x', method: 'GET', error_keys: ['errors'], output: 'fine' }],
        output: 'failed',
      },
    };
    expect(await executeDataMap(fn, {}, fakeFetch({ errors: [] }))).toBe('failed');
    expect(await executeDataMap(fn, {}, fakeFetch({ errors: {} }))).toBe('failed');
    expect(await executeDataMap(fn, {}, fakeFetch({ errors: null }))).toBe('failed');
    expect(await executeDataMap(fn, {}, fakeFetch({ errors: false }))).toBe('failed');
    expect(await executeDataMap(fn, {}, fakeFetch({ result: 1 }))).toBe('fine');
  });
});

describe('fix pass', () => {
  it('uses the no-match output DataMap.expression() writes, under the key the platform reads', async () => {
    const fn = new DataMap('command')
      .parameter('command', 'string', 'The command')
      .expression(
        '${args.command}',
        '^start',
        new FunctionResult('Starting'),
        new FunctionResult('Unknown command ${args.command}'),
      )
      .toSwaigFunction();
    expect(await executeDataMap(fn, { command: 'start now' })).toEqual({ response: 'Starting' });
    expect(await executeDataMap(fn, { command: 'stop' })).toEqual({
      response: 'Unknown command stop',
    });
  });

  it("evaluates a webhook's expressions against the response, after foreach and before output", async () => {
    const fn = new DataMap('order_status')
      .parameter('id', 'string', 'Order id')
      .webhook('GET', 'https://api.example.com/orders/${args.id}')
      .foreach({ input_key: 'items', output_key: 'names', append: '${this.name} ' })
      .webhookExpressions([
        {
          string: '${status}',
          pattern: '^shipped$',
          output: { response: 'Order ${input.args.id} shipped: ${names}' },
        },
      ])
      .output(new FunctionResult('Order ${input.args.id} is ${status}'))
      .toSwaigFunction();
    const shipped = fakeFetch({ status: 'shipped', items: [{ name: 'tea' }] });
    expect(await executeDataMap(fn, { id: '7' }, shipped)).toEqual({
      response: 'Order 7 shipped: tea ',
    });
    const pending = fakeFetch({ status: 'pending', items: [] });
    expect(await executeDataMap(fn, { id: '7' }, pending)).toEqual({
      response: 'Order 7 is pending',
    });
  });

  it("falls back to the data_map output when a webhook's expressions don't match and it has no output", async () => {
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://x',
            method: 'GET',
            expressions: [{ string: '${status}', pattern: '^ok$', output: { response: 'fine' } }],
          },
        ],
        output: { response: 'no match' },
      },
    };
    expect(await executeDataMap(fn, {}, fakeFetch({ status: 'bad' }))).toEqual({
      response: 'no match',
    });
  });

  it('ignores error_keys on the data_map itself, as the platform does', async () => {
    const fn = new DataMap('lookup')
      .webhook('GET', 'https://x')
      .output(new FunctionResult('found ${name}'))
      .globalErrorKeys(['error'])
      .fallbackOutput(new FunctionResult('failed'))
      .toSwaigFunction();
    expect((fn['data_map'] as Record<string, unknown>)['error_keys']).toEqual(['error']);
    expect(await executeDataMap(fn, {}, fakeFetch({ name: 'Ann', error: 'x' }))).toEqual({
      response: 'found Ann',
    });
  });

  it("expands a foreach append with the webhook's template data as well as this", async () => {
    const fn = new DataMap('list')
      .parameter('unit', 'string', 'Unit')
      .webhook('GET', 'https://x')
      .foreach({
        input_key: 'items',
        output_key: 'list',
        append: '${this.n}${input.args.unit} of ${store}; ',
      })
      .output(new FunctionResult('${list}'))
      .toSwaigFunction();
    const { fetchImpl } = fakeFetch({ store: 'Main', items: [{ n: 1 }, { n: 2 }] });
    expect(await executeDataMap(fn, { unit: 'kg' }, { fetchImpl })).toEqual({
      response: '1kg of Main; 2kg of Main; ',
    });
  });

  it('sends params as a POST body whatever the method, as the platform does', async () => {
    const fn = new DataMap('search')
      .parameter('query', 'string', 'Query')
      .webhook('GET', 'https://api.example.com/search')
      .params({ q: '${args.query}', limit: 5 })
      .output(new FunctionResult('${total} results'))
      .toSwaigFunction();
    const { calls, fetchImpl } = fakeFetch({ total: 3 });
    expect(await executeDataMap(fn, { query: 'tea' }, { fetchImpl })).toEqual({
      response: '3 results',
    });
    expect(calls[0]!.method).toBe('POST');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ q: 'tea', limit: 5 });
  });

  it('merges the arguments into params with input_args_as_params', async () => {
    const fn = new DataMap('create')
      .parameter('name', 'string', 'Name')
      .webhook('GET', 'https://api.example.com/create', { inputArgsAsParams: true })
      .output(new FunctionResult('ok'))
      .toSwaigFunction();
    const { calls, fetchImpl } = fakeFetch({});
    await executeDataMap(fn, { name: 'Ann' }, { fetchImpl });
    expect(calls[0]!.method).toBe('POST');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ name: 'Ann' });

    const withParams = new DataMap('create')
      .webhook('POST', 'https://api.example.com/create', { inputArgsAsParams: true })
      .params({ source: 'phone', name: 'default' })
      .output(new FunctionResult('ok'))
      .toSwaigFunction();
    const second = fakeFetch({});
    await executeDataMap(withParams, { name: 'Ann' }, second);
    expect(JSON.parse(second.calls[0]!.body!)).toEqual({ source: 'phone', name: 'Ann' });
  });

  it('sends params as one form field with form_param', async () => {
    const fn = new DataMap('form')
      .webhook('POST', 'https://api.example.com/form', { formParam: 'data' })
      .params({ a: '${args.a}' })
      .output(new FunctionResult('ok'))
      .toSwaigFunction();
    const seen: { headers: Record<string, string>; body?: string }[] = [];
    const fetchImpl = async (
      _url: string,
      init: { method: string; headers: Record<string, string>; body?: string },
    ) => {
      seen.push({ headers: init.headers, body: init.body });
      return new Response('{}');
    };
    await executeDataMap(fn, { a: 'x y' }, { fetchImpl });
    expect(seen[0]!.body).toBe(`data=${encodeURIComponent(JSON.stringify({ a: 'x y' }))}`);
    expect(seen[0]!.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('matches expression patterns case-insensitively, as the platform wraps them in /.../i', async () => {
    const fn = (pattern: string) => ({
      data_map: {
        expressions: [
          { string: '${args.cmd}', pattern, output: { response: 'yes' } },
          { string: '', pattern: '.*', output: { response: 'no' } },
        ],
      },
    });
    expect(await executeDataMap(fn('^start'), { cmd: 'START now' })).toEqual({ response: 'yes' });
    // A leading PCRE (?i) is accepted
    expect(await executeDataMap(fn('(?i)^start'), { cmd: 'Start' })).toEqual({ response: 'yes' });
    // A /.../ pattern takes its own flags, so it is case-sensitive without i
    expect(await executeDataMap(fn('/^start/'), { cmd: 'START' })).toEqual({ response: 'no' });
    expect(await executeDataMap(fn('/^start/i'), { cmd: 'START' })).toEqual({ response: 'yes' });
  });
});

/**
 * The template data of each stage, as the platform builds it (mod_openai
 * actions.c): url, params, top-level expressions and the data_map's own
 * output read the call data, which has `args` at its root; a webhook's
 * output, expressions and foreach read the response, with the call data
 * under `input`.
 */
describe('stage template data, as the platform builds it', () => {
  it("reads the arguments as ${input.args.x} in a webhook's output, where ${args.x} is missing", async () => {
    const fn = weather({ response: '${input.args.city}: ${temp} [${args.city}]' });
    const { fetchImpl } = fakeFetch({ temp: 61 });
    expect(await executeDataMap(fn, { city: 'London' }, { fetchImpl })).toEqual({
      response: 'London: 61 [<MISSING:args.city>]',
    });
  });

  it('hints at ${input.args.x} when ${args.x} is missing in a webhook stage', async () => {
    const lines: string[] = [];
    await executeDataMap(
      weather({ response: '${args.city}' }),
      { city: 'x' },
      { ...fakeFetch({}), log: (l) => void lines.push(l) },
    );
    expect(lines.join('\n')).toContain('${input.args.<name>}');
  });

  it("reads ${input.args.x} in a webhook's expressions and foreach", async () => {
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://x',
            foreach: {
              input_key: 'items',
              output_key: 'list',
              append: '${this.n}${input.args.unit} ',
            },
            expressions: [
              {
                string: '${input.args.mode}',
                pattern: '^list$',
                output: { response: '${list}[${args.mode}]' },
              },
            ],
          },
        ],
      },
    };
    const { fetchImpl } = fakeFetch({ items: [{ n: 1 }, { n: 2 }] });
    expect(await executeDataMap(fn, { unit: 'kg', mode: 'list' }, { fetchImpl })).toEqual({
      response: '1kg 2kg [<MISSING:args.mode>]',
    });
  });

  it('reads ${args.x} in the url, params, top-level expressions and fallback output, where input is empty', async () => {
    const { calls, fetchImpl } = fakeFetch('not json');
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://x/${args.id}',
            method: 'POST',
            params: { id: '${args.id}', via_input: '${input.args.id}' },
            output: { response: 'never' },
          },
        ],
        output: { response: 'fallback ${args.id} [${input.args.id}]' },
      },
    };
    expect(await executeDataMap(fn, { id: '7' }, { fetchImpl })).toEqual({
      response: 'fallback 7 [<MISSING:input.args.id>]',
    });
    expect(calls[0]!.url).toBe('https://x/7');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ id: '7', via_input: '<MISSING:input.args.id>' });

    const expr = {
      data_map: {
        expressions: [
          { string: '${args.id}', pattern: '7', output: { response: 'id ${args.id}' } },
        ],
      },
    };
    expect(await executeDataMap(expr, { id: '7' })).toEqual({ response: 'id 7' });
  });

  it('does not put the arguments at the root', async () => {
    const fn = {
      data_map: {
        expressions: [{ string: '${city}', pattern: '.*', output: { response: '[${city}]' } }],
      },
    };
    expect(await executeDataMap(fn, { city: 'Paris' })).toEqual({ response: '[<MISSING:city>]' });
  });

  it('sends header values as written, without expanding templates', async () => {
    const seen: Record<string, string>[] = [];
    const fetchImpl = async (
      _url: string,
      init: { method: string; headers: Record<string, string> },
    ) => {
      seen.push(init.headers);
      return new Response('{}');
    };
    const fn = {
      data_map: {
        webhooks: [
          { url: 'https://x', headers: { 'X-Id': '${args.id}' }, output: { response: 'ok' } },
        ],
      },
    };
    await executeDataMap(fn, { id: '7' }, { fetchImpl });
    expect(seen[0]!['X-Id']).toBe('${args.id}');
  });

  it('reads negative array indexes from the end', () => {
    expect(expandTemplate('${array[-1].joke}', { array: [{ joke: 'a' }, { joke: 'b' }] })).toBe(
      'b',
    );
  });
});

/** The webhook flow of mod_openai's get_input_from_webhooks and parse_webhook. */
describe('webhook flow, as the platform runs it', () => {
  /** A fetch that answers each call from `bodies` in turn, recording what it was sent. */
  function sequence(...bodies: string[]) {
    const calls: { url: string; method: string; body?: string }[] = [];
    const fetchImpl = async (url: string, init: { method: string; body?: string }) => {
      calls.push({ url, method: init.method, body: init.body });
      return new Response(bodies[calls.length - 1] ?? '{}');
    };
    return { calls, fetchImpl };
  }

  const twoWebhooks = (first: Record<string, unknown> = {}) => ({
    data_map: {
      webhooks: [
        { url: 'https://one', error_keys: ['error'], output: { response: 'one ${v}' }, ...first },
        { url: 'https://two', output: { response: 'two ${v}' } },
      ],
      output: { response: 'fallback' },
    },
  });

  it('stops at the first webhook that replies, even one that fails its error_keys', async () => {
    const seq = sequence('{"error": "down"}', '{"v": "second"}');
    expect(await executeDataMap(twoWebhooks(), {}, seq)).toEqual({ response: 'fallback' });
    expect(seq.calls.map((c) => c.url)).toEqual(['https://one']);
  });

  it('does not try the next webhook after a body that is not JSON', async () => {
    const seq = sequence('oops', '{"v": "second"}');
    expect(await executeDataMap(twoWebhooks(), {}, seq)).toEqual({ response: 'fallback' });
    expect(seq.calls).toHaveLength(1);
  });

  it('skips a webhook whose require_args are all absent, and tries the next', async () => {
    const seq = sequence('{"v": "second"}');
    const fn = twoWebhooks({ require_args: ['zip', 'street'] });
    expect(await executeDataMap(fn, { city: 'x' }, seq)).toEqual({ response: 'two second' });
    expect(seq.calls.map((c) => c.url)).toEqual(['https://two']);
    // Any one of the named arguments is enough
    const any = sequence('{"v": "first"}');
    expect(await executeDataMap(fn, { street: 'Main' }, any)).toEqual({ response: 'one first' });
  });

  it('skips a webhook with neither output nor expressions, and tries the next', async () => {
    const seq = sequence('{"v": "second"}');
    const fn = {
      data_map: {
        webhooks: [
          { url: 'https://one' },
          { url: 'https://two', output: { response: 'two ${v}' } },
        ],
      },
    };
    expect(await executeDataMap(fn, {}, seq)).toEqual({ response: 'two second' });
    expect(seq.calls.map((c) => c.url)).toEqual(['https://two']);
  });

  it('sends a GET unless the method is POST or there are params, and never sends body', async () => {
    const hook = (extra: Record<string, unknown>) => ({
      data_map: { webhooks: [{ url: 'https://x', output: 'ok', ...extra }] },
    });
    const methods: string[] = [];
    for (const extra of [
      {},
      { method: 'PUT' },
      { method: 'DELETE' },
      { method: 'PATCH', body: { a: 1 } },
      { method: 'post' },
    ]) {
      const seq = sequence('{}');
      await executeDataMap(hook(extra), {}, seq);
      methods.push(seq.calls[0]!.method);
      expect(seq.calls[0]!.body).toBeUndefined();
    }
    expect(methods).toEqual(['GET', 'GET', 'GET', 'GET', 'POST']);
  });

  it('reads a scalar foreach element as this itself', async () => {
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://x',
            foreach: { input_key: 'tags', output_key: 'list', append: '[${this}${this.value}]' },
            output: { response: '${list}' },
          },
        ],
      },
    };
    expect(await executeDataMap(fn, {}, fakeFetch({ tags: ['a', 'b'] }))).toEqual({
      response: '[a<MISSING:this.value>][b<MISSING:this.value>]',
    });
  });

  it('reads the foreach input_key as a path, and max as the platform does', async () => {
    const fn = (foreach: Record<string, unknown>) => ({
      data_map: {
        webhooks: [{ url: 'https://x', foreach, output: { response: '${list}' } }],
      },
    });
    const body = { data: { items: [{ n: 1 }, { n: 2 }, { n: 3 }] } };
    const base = { input_key: 'data.items', output_key: 'list', append: '${this.n}' };
    expect(await executeDataMap(fn(base), {}, fakeFetch(body))).toEqual({ response: '123' });
    expect(await executeDataMap(fn({ ...base, max: '2' }), {}, fakeFetch(body))).toEqual({
      response: '12',
    });
    expect(await executeDataMap(fn({ ...base, max: 0 }), {}, fakeFetch(body))).toEqual({
      response: '123',
    });
    // Without append (or input_key, or output_key) there is no foreach
    expect(
      await executeDataMap(
        fn({ input_key: 'data.items', output_key: 'list' }),
        {},
        fakeFetch(body),
      ),
    ).toEqual({ response: '<MISSING:list>' });
  });
});

/**
 * The prefix helpers of mod_openai's _expand_jsonvars (swaig.c): `lc:`,
 * `fmt_ph:` and `enc:`, matched case-insensitively at the start of the
 * template. The platform collects them and applies fmt_ph, then lc, then enc,
 * whatever order they are written in. Anything else before a colon is part of
 * the path.
 */
describe('prefix helpers, as the platform parses them', () => {
  const data = { args: { city: 'New York', where: 'A B:C', phone: '+12025550143' } };

  it('applies lc before enc whatever the written order', () => {
    expect(expandTemplate('${lc:enc:args.where}', data)).toBe('a%20b%3Ac');
    expect(expandTemplate('${enc:lc:args.where}', data)).toBe('a%20b%3Ac');
  });

  it('matches helper names case-insensitively', () => {
    expect(expandTemplate('${LC:args.city}', data)).toBe('new york');
    expect(expandTemplate('${Enc:args.city}', data)).toBe('New%20York');
  });

  it('recognizes fmt_ph, leaving the number as it is and saying so', async () => {
    expect(expandTemplate('${fmt_ph:args.phone}', data)).toBe('+12025550143');
    const lines: string[] = [];
    const fn = { data_map: { output: { response: 'Call ${fmt_ph:args.phone}' } } };
    expect(await executeDataMap(fn, data.args, { log: (l) => void lines.push(l) })).toEqual({
      response: 'Call +12025550143',
    });
    expect(lines.join('\n')).toContain('fmt_ph');
  });

  it('reads enc:url: as enc: and the path url:args.city, which is missing, and says why', async () => {
    const lines: string[] = [];
    const { calls, fetchImpl } = fakeFetch({ temp: 61 });
    const fn = {
      data_map: {
        webhooks: [
          { url: 'https://api.example.com/w?q=${enc:url:args.city}', output: { response: 'ok' } },
        ],
      },
    };
    await executeDataMap(fn, data.args, { fetchImpl, log: (l) => void lines.push(l) });
    expect(calls[0]!.url).toBe('https://api.example.com/w?q=<MISSING:url:args.city>');
    const said = lines.join('\n');
    expect(said).toContain('"url:" is not a template helper');
    expect(said).toContain('${enc:args.city}');
  });
});

/**
 * `enc:` is FreeSWITCH's switch_url_encode (swaig.c _expand_jsonvars): it
 * encodes control and non-ASCII bytes and the characters of
 * SWITCH_URL_UNSAFE, leaves every other printable ASCII character, and doesn't
 * encode a `%` that already starts an uppercase `%XX`.
 */
describe('enc:, as the platform encodes', () => {
  const enc = (value: string) => expandTemplate('${enc:args.v}', { args: { v: value } });

  it('encodes the characters of SWITCH_URL_UNSAFE', () => {
    expect(enc(' "#%&+:;<=>?@[\\]^`{|}\r\n')).toBe(
      '%20%22%23%25%26%2B%3A%3B%3C%3D%3E%3F%40%5B%5C%5D%5E%60%7B%7C%7D%0D%0A',
    );
  });

  it('leaves other printable ASCII characters as they are', () => {
    expect(enc("a/b,c$d!e'f(g)h*i~j-k_l.m")).toBe("a/b,c$d!e'f(g)h*i~j-k_l.m");
  });

  it('encodes non-ASCII bytes, and control characters', () => {
    expect(enc('café\t')).toBe('caf%C3%A9%09');
  });

  it('does not encode a % that starts an uppercase %XX', () => {
    expect(enc('50%2F50 %zz %2f')).toBe('50%2F50%20%25zz%20%252f');
  });
});
