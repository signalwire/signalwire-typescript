/**
 * Lessons 4 and 5 of the multi-agent tutorial: the tools and patterns in
 * tutorial/multi_agents/advanced_agent.ts and extending_agents.ts. Two tests
 * here are also the lesson's testing examples, quoted by region.
 */

import { execFileSync } from 'node:child_process';
import type { AgentBase } from '../../src/index.js';

type Json = Record<string, unknown>;

/** The parts of a SWML document these tests read. */
interface Swml {
  sections: {
    main: {
      ai?: {
        SWAIG: { functions: { function: string }[] };
        languages: { name: string; code: string; voice?: string }[];
        prompt: { pom: { title: string }[] };
      };
    }[];
  };
}
const USER = 'tutorial-user';
const PASS = 'tutorial-pass';
const AUTH = { Authorization: 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64') };

let savedEnv: NodeJS.ProcessEnv;
let advanced: AgentBase;
let extending: typeof import('../../tutorial/multi_agents/extending_agents.js');

beforeAll(async () => {
  savedEnv = { ...process.env };
  process.env['SIGNALWIRE_LOG_MODE'] = 'off';
  process.env['SWML_BASIC_AUTH_USER'] = USER;
  process.env['SWML_BASIC_AUTH_PASSWORD'] = PASS;
  process.env['INTERACTIONS_DB'] = ':memory:';
  process.env['ORDER_WEBHOOK_SECRET'] = 'hook-secret';
  delete process.env['WEATHER_API_KEY'];
  delete process.env['REVIEWS_API_URL'];
  delete process.env['PARTNER_API_KEY'];
  delete process.env['INVENTORY_API_URL'];
  advanced = (await import('../../tutorial/multi_agents/advanced_agent.js')).agent;
  extending = await import('../../tutorial/multi_agents/extending_agents.js');
});
afterAll(() => {
  process.env = savedEnv;
  vi.restoreAllMocks();
});

/** Run one of an agent's tools the way the SWAIG endpoint does, and return its response. */
async function run(agent: AgentBase, name: string, args: Json, rawData: Json = {}) {
  const fn = agent.getTool(name);
  if (!fn) throw new Error(`no tool ${name}`);
  return (await fn.execute(args, { call_id: 'call-1', ...rawData })) as Json;
}
const text = async (agent: AgentBase, name: string, args: Json, rawData: Json = {}) =>
  String((await run(agent, name, args, rawData))['response']);

describe('Lesson 4: advanced_agent.ts', () => {
  // region: unit-test
  it('calculates the price with tax', async () => {
    const fn = advanced.getTool('calculate_price')!;
    const result = await fn.execute({ amount: 100, tax_rate: 0.08 });
    expect(result['response']).toBe('The total price is $108.00 ($100.00 + $8.00 tax)');

    // The tax rate is optional, and defaults to 8%
    const noRate = await fn.execute({ amount: 50 });
    expect(noRate['response']).toContain('$54.00');
  });
  // endregion: unit-test

  // region: integration-test
  it('serves SWML that lists calculate_price, and refuses a request without credentials', async () => {
    const app = advanced.getApp();
    expect((await app.request('/')).status).toBe(401);

    const res = await app.request('/', { headers: AUTH });
    expect(res.status).toBe(200);
    const swml = (await res.json()) as Swml;
    const ai = swml.sections.main.find((verb) => verb.ai)!.ai!;
    const names = ai.SWAIG.functions.map((f) => f.function);
    expect(names).toContain('calculate_price');
  });
  // endregion: integration-test

  it('runs calculate_price through swaig-test', () => {
    const out = execFileSync(
      'npx',
      [
        'tsx',
        'src/cli/swaig-test.ts',
        'tutorial/multi_agents/advanced_agent.ts',
        '--exec',
        'calculate_price',
        '--amount',
        '100',
      ],
      { encoding: 'utf8', env: { ...process.env, SIGNALWIRE_LOG_MODE: 'off' } },
    );
    expect(out).toContain('The total price is $108.00 ($100.00 + $8.00 tax)');
  });

  it('declares required parameters and the four parameter types', () => {
    const order = advanced.getTool('create_order')!.toSwaig('http://x') as Json;
    expect((order['parameters'] as Json)['required']).toEqual(['customer_name', 'items']);
    const quote = advanced.getTool('quote_upgrade')!.toSwaig('http://x') as Json;
    const props = (quote['parameters'] as { properties: Record<string, { type: string }> })
      .properties;
    expect(Object.values(props).map((p) => p.type)).toEqual([
      'string',
      'integer',
      'number',
      'boolean',
    ]);
  });

  it('stores the checked product in global data', async () => {
    const found = await run(advanced, 'check_inventory', { product_id: 'GPU-4070' });
    expect(found['response']).toBe('Product GPU-4070 is in stock (5 units)');
    expect(found['action']).toEqual([
      { set_global_data: { last_checked_product: 'GPU-4070', stock_level: 5 } },
    ]);
    const missing = await run(advanced, 'check_inventory', { product_id: 'CASE-1' });
    expect(missing['action']).toBeUndefined();
  });

  it('handles errors: invalid input, an expected failure and a clean success', async () => {
    expect(await text(advanced, 'process_order', { order_id: 'A1' })).toBe(
      'Invalid order ID format',
    );
    expect(await text(advanced, 'process_order', { order_id: 'TEST-123' })).toBe(
      'Order processing failed: Test orders cannot be processed',
    );
    expect(await text(advanced, 'process_order', { order_id: 'ORD-12345' })).toBe(
      'Order ORD-12345 processed successfully',
    );
  });

  it('reports every validation problem at once', async () => {
    expect(await text(advanced, 'update_customer', { email: 'nope', phone: '555' })).toBe(
      'Validation failed: Customer ID is required, Invalid email format, Phone number must be at least 10 digits',
    );
    expect(await text(advanced, 'update_customer', { customer_id: 'C1', email: 'a@b.co' })).toBe(
      'Customer updated successfully',
    );
  });

  it('says an unconfigured external service is not configured, without calling it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await text(advanced, 'fetch_product_reviews', { product_id: 'X' })).toBe(
      'The review service is not configured.',
    );
    expect(await text(advanced, 'check_partner_stock', { sku: 'X' })).toBe(
      'The partner API is not configured.',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('caches product lookups', async () => {
    const t0 = Date.now();
    await text(advanced, 'get_product_info', { product_id: 'RAM-1' });
    const first = Date.now() - t0;
    const t1 = Date.now();
    expect(await text(advanced, 'get_product_info', { product_id: 'RAM-1' })).toBe(
      'Product RAM-1: 16GB DDR5 memory kit',
    );
    expect(first).toBeGreaterThanOrEqual(190);
    expect(Date.now() - t1).toBeLessThan(100);
  });

  it('runs independent lookups together, sanitizes search input, and limits callers', async () => {
    expect(await text(advanced, 'get_full_info', { customer_id: 'C9' })).toBe(
      'Found 2 orders for a gold customer who prefers email',
    );
    expect(await text(advanced, 'safe_search', { query: 'rtx; DROP TABLE' })).toBe(
      'Found 0 results: ',
    );
    expect(await text(advanced, 'safe_search', { query: 'RTX <4090>' })).toBe(
      'Found 1 results: RTX 4090',
    );
    expect(await text(advanced, 'safe_search', { query: '!!!' })).toBe('Invalid search query');
    const caller = { caller_id_num: '+15550001111' };
    for (let i = 0; i < 10; i++) {
      expect(await text(advanced, 'limited_function', {}, caller)).toBe(
        'Function executed successfully',
      );
    }
    expect(await text(advanced, 'limited_function', {}, caller)).toBe(
      'Rate limit exceeded. Please try again later.',
    );
    expect(await text(advanced, 'limited_function', {}, { caller_id_num: '+15550002222' })).toBe(
      'Function executed successfully',
    );
  });

  it('serves /status without credentials', async () => {
    const res = await advanced.getApp().request('/status');
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json)['status']).toBe('healthy');
  });
});

describe('Lesson 5: extending_agents.ts', () => {
  it('leaves the weather skill out without WEATHER_API_KEY, and adds two search instances', () => {
    const names = extending.agent.getTools().map((t) => t.name);
    expect(names).not.toContain('get_weather');
    expect(names).toContain('search_products');
    expect(names).toContain('search_troubleshooting');
  });

  it('calls the weather API with the key, and reads its response', async () => {
    process.env['WEATHER_API_KEY'] = 'test-key';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ current: { temp_f: 71.2, condition: { text: 'Sunny' } } })),
      );
    try {
      const { AgentBase } = await import('../../src/index.js');
      const weatherAgent = new AgentBase({ name: 'weather', route: '/' });
      await weatherAgent.addSkill(new extending.WeatherSkill());
      expect(await text(weatherAgent, 'get_weather', { location: 'Austin' })).toBe(
        'Current weather in Austin: 71.2°F, Sunny',
      );
      const url = new URL(String(fetchSpy.mock.calls[0]![0]));
      expect(url.origin + url.pathname).toBe('https://api.weatherapi.com/v1/current.json');
      expect(url.searchParams.get('key')).toBe('test-key');
      expect(url.searchParams.get('q')).toBe('Austin');
    } finally {
      fetchSpy.mockRestore();
      delete process.env['WEATHER_API_KEY'];
    }
  });

  it('keeps preferences per call', async () => {
    const a = extending.agent;
    await run(a, 'remember_preference', { key: 'budget', value: '$1500' }, { call_id: 'A' });
    expect(await text(a, 'recall_preference', { key: 'budget' }, { call_id: 'A' })).toBe(
      'Your budget is $1500',
    );
    expect(await text(a, 'recall_preference', { key: 'budget' }, { call_id: 'B' })).toBe(
      "I don't have your budget on record",
    );
  });

  it('saves and reads interaction history in SQLite', async () => {
    const a = extending.agent;
    expect(await text(a, 'get_history', { customer_id: 'C1' })).toBe(
      'No previous interactions found',
    );
    await run(a, 'save_interaction', {
      customer_id: 'C1',
      interaction_type: 'quote',
      details: 'Quoted a $2000 gaming build',
    });
    expect(await text(a, 'get_history', { customer_id: 'C1' })).toMatch(
      /^Previous interactions:\n- quote on \d{4}-\d\d-\d\dT.*: Quoted a \$2000 gaming build$/,
    );
  });

  it('stores customer data in global data, and reads it back from a later request', async () => {
    const a = extending.agent;
    const stored = await run(a, 'set_customer_data', { key: 'name', value: 'Jordan' });
    const globalData = ((stored['action'] as Json[])[0] as Json)['set_global_data'] as Json;
    expect(globalData).toEqual({ customer_name: 'Jordan' });
    expect(await text(a, 'get_customer_data', { key: 'name' }, { global_data: globalData })).toBe(
      'name: Jordan',
    );
  });

  it('builds an order over several calls', async () => {
    const a = extending.agent;
    const raw = { call_id: 'order-call' };
    expect(await text(a, 'confirm_order', {}, raw)).toBe('No active order');
    await run(a, 'start_order', {}, raw);
    expect(await text(a, 'confirm_order', {}, raw)).toBe('Add items before confirming');
    await run(a, 'add_item', { item: 'RTX 4070' }, raw);
    expect(await text(a, 'add_item', { item: '32GB DDR5', quantity: 2 }, raw)).toBe(
      'Added 2x 32GB DDR5. Current order: 1x RTX 4070, 2x 32GB DDR5.',
    );
    expect(await text(a, 'confirm_order', {}, raw)).toBe('Order confirmed. Total: $747.00');
    expect(await text(a, 'confirm_order', {}, raw)).toBe('No active order');
  });

  it('flags a VIP in global data', async () => {
    const vip = await run(extending.agent, 'check_customer_status', { customer_id: 'C100' });
    expect(vip['response']).toBe('Customer status: platinum');
    expect(vip['action']).toEqual([
      { set_global_data: { customer_status: 'platinum', is_vip: true } },
    ]);
  });

  it('accepts an order webhook with the secret, and processes it after answering', async () => {
    const app = extending.agent.getApp();
    const post = (secret: string) =>
      app.request('/webhook/order_update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-webhook-secret': secret },
        body: JSON.stringify({ order_id: 'ORD-1', status: 'shipped' }),
      });
    expect((await post('wrong')).status).toBe(403);
    const res = await post('hook-secret');
    expect(await res.json()).toEqual({ status: 'received' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(extending.orderUpdates).toContainEqual({ order_id: 'ORD-1', status: 'shipped' });
  });

  it('queues a task, and the worker completes it', async () => {
    await run(extending.agent, 'queue_task', { task_type: 'email_quote', data: 'to Jordan' });
    await vi.waitFor(
      () => expect(extending.completedTasks.map((t) => t.type)).toContain('email_quote'),
      { timeout: 3000 },
    );
  });

  it('picks the persona per request, without touching other requests', async () => {
    const app = extending.agent.getApp();
    const swml = async (query: string) => {
      const res = await app.request(`/?call_id=p${query}`, { headers: AUTH });
      const doc = (await res.json()) as Swml;
      return doc.sections.main.find((v) => v.ai)!.ai!;
    };
    const pro = await swml('&persona=professional');
    expect(pro.languages).toEqual([{ name: 'English', code: 'en-US', voice: 'rime.cove' }]);
    const plain = await swml('');
    expect(plain.languages).toEqual([{ name: 'English', code: 'en-US', voice: 'rime.marsh' }]);
    const styles = plain.prompt.pom.filter((s) => s.title === 'Voice Style');
    expect(styles).toHaveLength(1);
  });

  it('replaces the whole system prompt with switchContext', async () => {
    const body = await run(extending.agent, 'set_explanation_mode', { mode: 'simple' });
    // With only a system prompt, the action's value is the prompt itself
    expect(body['action']).toEqual([
      {
        context_switch:
          'You are a helpful assistant for our PC products. Explain everything in simple, non-technical terms.',
      },
    ]);
  });

  it('retries with backoff, and opens the circuit breaker after repeated failures', async () => {
    let calls = 0;
    const flaky = async () => {
      calls += 1;
      if (calls < 3) throw new Error('temporary');
      return 'ok';
    };
    expect(await extending.retryWithBackoff(flaky, 3, 1)).toBe('ok');
    expect(calls).toBe(3);
    await expect(
      extending.retryWithBackoff(() => Promise.reject(new Error('down')), 2, 1),
    ).rejects.toThrow('down');

    const breaker = new extending.CircuitBreaker(2, 60_000);
    const failing = () => Promise.reject(new Error('down'));
    await expect(breaker.call(failing)).rejects.toThrow('down');
    await expect(breaker.call(failing)).rejects.toThrow('down');
    await expect(breaker.call(async () => 'ok')).rejects.toThrow('Circuit breaker is open');
  });

  it('builds agents from a configuration, and rejects an unknown type', async () => {
    const sales = await extending.createAgent('sales', {
      languages: [{ name: 'English', code: 'en-US', voice: 'rime.marsh' }],
    });
    expect(sales.route).toBe('/sales');
    await expect(extending.createAgent('billing')).rejects.toThrow('Unknown agent type: billing');
  });

  it('serves the multilingual agent with three languages', () => {
    const swml = JSON.parse(extending.multilingual.renderSwml('c1')) as Swml;
    const ai = swml.sections.main.find((v) => v.ai)!.ai!;
    expect(ai.languages.map((l) => l.code)).toEqual(['en-US', 'es-MX', 'fr-FR']);
  });
});
