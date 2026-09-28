/**
 * swaig-test's DataMap simulator runs a data_map as the platform does.
 * Mirrors signalwire-python tests/unit/cli/test_datamap_templates.py and
 * test_datamap_exec_arrays.py, plus the expression and fallback steps.
 */

import { executeDataMap, expandTemplate } from '../../src/cli/datamap-exec.js';

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
    ['${enc:url:args.city}', 'New%20York'],
    ['${lc:enc:args.city}', 'new%20york'],
    ['${meta_data.table.${lc:args.target}}', '+15551234567'],
    ['${array[0].joke}', 'ha'],
    ['${args.missing}', '<MISSING:args.missing>'],
    ['${array[5].joke}', '<MISSING:array[5].joke>'],
    ['@{expr 1 + 2}', '@{expr 1 + 2}'],
    ['${enc:args.odd}', 'a%2Fb%21%27%28%29%2A'],
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

  it('fails a webhook on a non-2xx status or a body that is not JSON', async () => {
    const fn = (url: string) => ({
      data_map: {
        webhooks: [{ url, method: 'GET', output: { response: 'ok' } }],
        output: { response: 'fallback' },
      },
    });
    expect(await executeDataMap(fn('https://a'), {}, fakeFetch({ ok: 1 }, 503))).toEqual({
      response: 'fallback',
    });
    expect(await executeDataMap(fn('https://a'), {}, fakeFetch('not json'))).toEqual({
      response: 'fallback',
    });
  });

  it('tries the next webhook after one fails', async () => {
    let n = 0;
    const fetchImpl = async () => {
      n += 1;
      return n === 1 ? new Response('{}', { status: 500 }) : new Response('{"v": "second"}');
    };
    const fn = {
      data_map: {
        webhooks: [
          { url: 'https://one', method: 'GET', output: { response: 'one ${v}' } },
          { url: 'https://two', method: 'GET', output: { response: 'two ${v}' } },
        ],
      },
    };
    expect(await executeDataMap(fn, {}, { fetchImpl })).toEqual({ response: 'two second' });
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
    const { fetchImpl } = fakeFetch({}, 500);
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
          nomatch_output: { response: 'Unknown command ${args.command}' },
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

  it('produces nomatch_output when it does not', async () => {
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

  it('treats an empty list or object under an error key as no error, as the reference does', async () => {
    const fn = (payload: unknown) => ({
      data_map: {
        webhooks: [{ url: 'https://x', method: 'GET', error_keys: ['errors'], output: 'fine' }],
        output: 'failed',
      },
      payload,
    });
    expect(await executeDataMap(fn({}), {}, fakeFetch({ errors: [] }))).toBe('fine');
    expect(await executeDataMap(fn({}), {}, fakeFetch({ errors: {} }))).toBe('fine');
    expect(await executeDataMap(fn({}), {}, fakeFetch({ errors: ['bad'] }))).toBe('failed');
  });
});
