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
    ['${enc:url:args.city}', ''],
    ['${lc:enc:args.city}', 'new%20york'],
    ['${meta_data.table.${lc:args.target}}', '+15551234567'],
    ['${array[0].joke}', 'ha'],
    ['${args.missing}', ''],
    ['${array[5].joke}', ''],
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
    expect(result).toEqual({ response: '' });
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

  it("returns the platform's generic error when every webhook fails with no fallback output", async () => {
    const { fetchImpl } = fakeFetch('not json', 500);
    const fn = { data_map: { webhooks: [{ url: 'https://x', method: 'GET', output: 'ok' }] } };
    expect(await executeDataMap(fn, {}, { fetchImpl })).toEqual({
      response: 'There was an error processing this request.',
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
    const body = seen[0]!.body!;
    expect(body.startsWith('data=')).toBe(true);
    expect(JSON.parse(decodeURIComponent(body.slice('data='.length)))).toEqual({ a: 'x y' });
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
      response: 'London: 61 []',
    });
  });

  it('hints at ${input.args.x} when ${args.x} is missing in a webhook stage', async () => {
    const lines: string[] = [];
    await executeDataMap(
      weather({ response: '${args.city}' }),
      { city: 'x' },
      { ...fakeFetch({}), log: (l) => void lines.push(l) },
    );
    expect(lines.join('\n')).toContain('write ${input.args.city}');
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
      response: '1kg 2kg []',
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
      response: 'fallback 7 []',
    });
    expect(calls[0]!.url).toBe('https://x/7');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ id: '7', via_input: '' });

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
    expect(await executeDataMap(fn, { city: 'Paris' })).toEqual({ response: '[]' });
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
      response: '[a][b]',
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
    ).toEqual({ response: '' });
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

  it('formats a North American number with fmt_ph, as the platform does', () => {
    expect(expandTemplate('${fmt_ph:args.phone}', data)).toBe('(202) 555-0143');
    expect(expandTemplate('${enc:fmt_ph:args.phone}', data)).toBe('(202)%20555-0143');
  });

  it('leaves another number as it is with fmt_ph, and says so', async () => {
    const lines: string[] = [];
    const fn = { data_map: { output: { response: 'Call ${fmt_ph:args.phone}' } } };
    expect(
      await executeDataMap(fn, { phone: '+442079460958' }, { log: (l) => void lines.push(l) }),
    ).toEqual({ response: 'Call +442079460958' });
    expect(lines.join('\n')).toContain('formats only North American numbers');
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
    expect(calls[0]!.url).toBe('https://api.example.com/w?q=');
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

/**
 * mod_openai actions.c takes `expressions` and `webhooks` as a list or as a
 * single object. A single expression runs as a one-element list
 * (get_input_from_expressions). A single webhook runs differently
 * (get_input_from_webhooks): its require_args and error_keys aren't checked,
 * and a failed request doesn't fail it, so its output reads the error
 * response.
 */
describe('a single expression or webhook object, as the platform takes it', () => {
  it('runs a single top-level expression object', async () => {
    const fn = {
      data_map: {
        expressions: {
          string: '${args.cmd}',
          pattern: '^start',
          output: { response: 'Starting' },
          'nomatch-output': { response: 'Unknown ${args.cmd}' },
        },
      },
    };
    expect(await executeDataMap(fn, { cmd: 'start' })).toEqual({ response: 'Starting' });
    expect(await executeDataMap(fn, { cmd: 'stop' })).toEqual({ response: 'Unknown stop' });
  });

  it("runs a single expression object in a webhook's expressions", async () => {
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://x',
            expressions: { string: '${status}', pattern: '^ok$', output: { response: 'fine' } },
          },
        ],
        output: { response: 'fallback' },
      },
    };
    expect(await executeDataMap(fn, {}, fakeFetch({ status: 'ok' }))).toEqual({
      response: 'fine',
    });
  });

  it('requests a single webhook object and reads its response', async () => {
    const { calls, fetchImpl } = fakeFetch({ temp: 61 });
    const fn = {
      data_map: {
        webhooks: {
          url: 'https://w/${args.city}',
          output: { response: '${temp} in ${input.args.city}' },
        },
      },
    };
    expect(await executeDataMap(fn, { city: 'Oslo' }, { fetchImpl })).toEqual({
      response: '61 in Oslo',
    });
    expect(calls.map((c) => c.url)).toEqual(['https://w/Oslo']);
  });

  it("doesn't check a single webhook's require_args", async () => {
    const { calls, fetchImpl } = fakeFetch({ v: 1 });
    const fn = {
      data_map: {
        webhooks: { url: 'https://x', require_args: ['zip'], output: { response: 'v ${v}' } },
        output: { response: 'fallback' },
      },
    };
    expect(await executeDataMap(fn, {}, { fetchImpl })).toEqual({ response: 'v 1' });
    expect(calls).toHaveLength(1);
  });

  it("doesn't fail a single webhook on its error_keys or a body that isn't JSON", async () => {
    const fn = {
      data_map: {
        webhooks: {
          url: 'https://x',
          error_keys: ['error'],
          output: { response: 'error=${error} parse_error=${parse_error} raw=${raw_response}' },
        },
        output: { response: 'fallback' },
      },
    };
    expect(await executeDataMap(fn, {}, fakeFetch({ error: 'down' }))).toEqual({
      response: 'error=down parse_error= raw=',
    });
    expect(await executeDataMap(fn, {}, fakeFetch('oops'))).toEqual({
      response: 'error= parse_error=true raw=oops',
    });
  });

  it('uses the fallback for a single webhook with neither output nor expressions', async () => {
    const { calls, fetchImpl } = fakeFetch({ v: 1 });
    const fn = { data_map: { webhooks: { url: 'https://x' }, output: { response: 'fallback' } } };
    expect(await executeDataMap(fn, {}, { fetchImpl })).toEqual({ response: 'fallback' });
    expect(calls).toHaveLength(0);
  });
});

describe('a request that does not complete, as the platform reports it', () => {
  const failing = async () => {
    throw new Error('connection refused');
  };

  it("gives a single webhook object's output http_code 0 and parse_error", async () => {
    const fn = {
      data_map: {
        webhooks: { url: 'https://x', output: { response: '${http_code} ${parse_error}' } },
      },
    };
    expect(await executeDataMap(fn, {}, { fetchImpl: failing })).toEqual({
      response: '0 true',
    });
  });

  it('still fails a webhook in a list', async () => {
    const fn = {
      data_map: {
        webhooks: [{ url: 'https://x', output: { response: 'ok' } }],
        output: { response: 'fallback' },
      },
    };
    expect(await executeDataMap(fn, {}, { fetchImpl: failing })).toEqual({
      response: 'fallback',
    });
  });
});

/**
 * The simulator follows the platform where it used to differ on purpose
 * (mod_openai actions.c process_data_map and the swaig function call's
 * post_data, swaig.c _expand_jsonvars and get_json_object). Mirrors
 * signalwire-python's tests/unit/cli/test_datamap_exec_platform.py and
 * test_datamap_templates.py (9e07f0f).
 */
describe('the platform, where the simulator used to differ', () => {
  it('puts the call data at the root, meta_data from the function, and merges prompt_vars into the root', async () => {
    const fn = {
      function: 'lookup',
      meta_data: { contacts: { sales: '+12025550143' } },
      data_map: {
        output: {
          response:
            '${global_data.tenant}|${caller_id_num}|${time_of_day}|${prompt_vars.time_of_day}|' +
            '${meta_data.contacts.${lc:args.dept}}|${function}',
        },
      },
    };
    const callData = {
      global_data: { tenant: 'acme' },
      caller_id_num: '+15551230000',
      prompt_vars: { time_of_day: 'evening' },
    };
    expect(await executeDataMap(fn, { dept: 'Sales' }, { callData, log: () => {} })).toEqual({
      response: 'acme|+15551230000|evening|evening|+12025550143|lookup',
    });
  });

  it("adds prompt_vars, global_data and input to a webhook's response data", async () => {
    const { calls, fetchImpl } = fakeFetch({ temp: 61 });
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://api.example.com/${global_data.tenant}/w',
            output: {
              response:
                '${temp} ${global_data.tenant} ${prompt_vars.time_of_day} ${input.caller_id_num} ${input.args.city}',
            },
          },
        ],
      },
    };
    const callData = {
      global_data: { tenant: 'acme' },
      caller_id_num: '+15551230000',
      prompt_vars: { time_of_day: 'morning' },
    };
    expect(await executeDataMap(fn, { city: 'Oslo' }, { fetchImpl, callData })).toEqual({
      response: '61 acme morning +15551230000 Oslo',
    });
    expect(calls[0]!.url).toBe('https://api.example.com/acme/w');
  });

  it("expands a matched webhook expression's result a second time, and a webhook output once", async () => {
    const fn = (hook: Record<string, unknown>) => ({
      data_map: { webhooks: [{ url: 'https://x', ...hook }] },
    });
    const callData = { global_data: { secret: 's3cret' } };
    const args = { q: '${global_data.secret}' };
    const expressions = [
      { string: '${status}', pattern: 'ok', output: { response: '${input.args.q}' } },
    ];
    expect(
      await executeDataMap(fn({ expressions }), args, { ...fakeFetch({ status: 'ok' }), callData }),
    ).toEqual({ response: 's3cret' });
    expect(
      await executeDataMap(fn({ output: { response: '${input.args.q}' } }), args, {
        ...fakeFetch({ status: 'ok' }),
        callData,
      }),
    ).toEqual({ response: '${global_data.secret}' });
  });

  it('expands a template once: a value that holds a template is inserted as it is', async () => {
    const fn = { data_map: { output: { response: 'You said ${args.text}' } } };
    expect(
      await executeDataMap(
        fn,
        { text: '${global_data.secret}' },
        {
          callData: { global_data: { secret: 's3cret' } },
        },
      ),
    ).toEqual({ response: 'You said ${global_data.secret}' });
  });

  it('matches names without regard to ASCII case', async () => {
    expect(expandTemplate('${ARGS.City}', { args: { city: 'Oslo' } })).toBe('Oslo');
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://x',
            require_args: ['ZIP'],
            error_keys: ['Error'],
            output: { response: '${temp} ${input.args.zip}' },
          },
        ],
        output: { response: 'fallback' },
      },
    };
    expect(await executeDataMap(fn, { zip: '0150' }, fakeFetch({ Temp: 61 }))).toEqual({
      response: '61 0150',
    });
    expect(await executeDataMap(fn, { zip: '0150' }, fakeFetch({ ERROR: 'down' }))).toEqual({
      response: 'fallback',
    });
  });

  it('inserts a number as cJSON prints it, and an object into a string breaks the output', async () => {
    const fn = weather({ response: '${temp} ${count}' });
    expect(await executeDataMap(fn, { city: 'x' }, fakeFetch({ temp: 72.5, count: 3 }))).toEqual({
      response: '72.500000 3',
    });
    const broken = await executeDataMap(
      weather({ response: 'Data: ${data}' }),
      { city: 'x' },
      fakeFetch({ data: { a: 1 } }),
    );
    expect((broken as { error: string }).error).toContain("isn't valid JSON");
  });

  it('reads a response as cJSON does: trailing text ignored, control characters in strings kept', async () => {
    const fn = weather({ response: '${v}' });
    expect(await executeDataMap(fn, { city: 'x' }, fakeFetch('{"v": "a\tb"} trailing'))).toEqual({
      response: 'a\tb',
    });
  });

  it('keeps a response key that a foreach output_key names, as the platform adds after it', async () => {
    const fn = {
      data_map: {
        webhooks: [
          {
            url: 'https://x',
            foreach: { input_key: 'items', output_key: 'list', append: '${this}' },
            output: { response: '${list}' },
          },
        ],
      },
    };
    expect(await executeDataMap(fn, {}, fakeFetch({ items: ['a'], list: 'server' }))).toEqual({
      response: 'server',
    });
  });

  it('sends credentials in the url as basic authentication, and the platform user agent', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl = async (url: string, init: { headers: Record<string, string> }) => {
      seen.push({ url, headers: init.headers });
      return new Response('{}');
    };
    const fn = {
      data_map: { webhooks: [{ url: 'https://user:pa%40ss@x.example.com/w', output: 'ok' }] },
    };
    await executeDataMap(fn, {}, { fetchImpl });
    expect(seen[0]!.url).toBe('https://x.example.com/w');
    expect(seen[0]!.headers['Authorization']).toBe(
      `Basic ${Buffer.from('user:pa@ss').toString('base64')}`,
    );
    expect(seen[0]!.headers['User-Agent']).toBe('SignalWire-CallFabric/1.0');
  });

  it('uses nomatch-output for a pattern that is not valid', async () => {
    const fn = {
      data_map: {
        expressions: [
          {
            string: 'x',
            pattern: '(',
            output: { response: 'yes' },
            'nomatch-output': { response: 'no' },
          },
        ],
      },
    };
    expect(await executeDataMap(fn, {}, { log: () => {} })).toEqual({ response: 'no' });
  });
});
