/**
 * ChatGateway: what a browser holding a publishable key can and cannot do.
 * Pins the boundary that makes a key safe to put in a page (what the browser
 * may name, what the gateway replaces, what the caps limit) against an
 * in-process stub chat service. Mirrors signalwire-python
 * tests/unit/ai_chat/test_gateway.py.
 */

import { Hono } from 'hono';
import { AIChatClient } from '../../src/ai-chat/AIChatClient.js';
import {
  ChatGateway,
  GatewayRejection,
  MAX_USER_METADATA_BYTES,
  type ChatGatewayOptions,
} from '../../src/ai-chat/ChatGateway.js';
import { AgentBase } from '../../src/AgentBase.js';

const CONFIG_URL = 'https://agent.example.com/swml';
const KEY = 'pk_test_key';
const SHOP = 'https://shop.example.com';

interface Sent {
  method: string;
  params: Record<string, unknown>;
  id: string;
}

/** A stub chat service that records what the gateway sent. */
function stubService(opts: { padded?: boolean } = {}) {
  const seen: Sent[] = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Sent;
    seen.push(body);
    const result = {
      chat: { response: opts.padded ? 'slow reply' : 'hi there' },
      create_conversation: { status: 'created', initial_message: 'Hi, I am Sigmond.' },
      chat_log: {
        chat_log: [
          { role: 'system', content: 'secret prompt' },
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hi there' },
        ],
      },
    }[body.method] ?? { status: 'ended' };
    const json = JSON.stringify({ jsonrpc: '2.0', result, id: body.id });
    if (!opts.padded) return new Response(json, { status: 200 });
    // Padded the way the real service pads a slow turn.
    const chunks = [' '.repeat(16), ' '.repeat(16), ' '.repeat(16), json];
    const stream = new ReadableStream<Uint8Array>({
      async pull(c) {
        await new Promise((r) => setTimeout(r, 5));
        const next = chunks.shift();
        if (next === undefined) c.close();
        else c.enqueue(new TextEncoder().encode(next));
      },
    });
    return new Response(stream, { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  const client = new AIChatClient({ project: 'p', token: 't', url: 'http://svc/', fetchImpl });
  return { seen, client };
}

function makeGateway(
  svc = stubService(),
  overrides: Partial<ChatGatewayOptions> = {},
): ChatGateway {
  return new ChatGateway({
    configUrl: CONFIG_URL,
    key: KEY,
    allowedOrigins: [SHOP],
    client: svc.client,
    secret: 'test-secret',
    ...overrides,
  });
}

function rejection(fn: () => unknown): GatewayRejection {
  try {
    fn();
  } catch (err) {
    if (err instanceof GatewayRejection) return err;
    throw err;
  }
  throw new Error('expected a GatewayRejection');
}

const prep = (gw: ChatGateway, body: Record<string, unknown>, origin: string | null = SHOP) =>
  gw.prepare(body, { origin, key: KEY });

// ── Handles ──────────────────────────────────────────────────────────

describe('handles', () => {
  it('round-trips a handle', () => {
    const gw = makeGateway();
    expect(gw.readHandle(gw.mintHandle())).toMatch(/^chat-/);
  });

  it('refuses a tampered signature with 403', () => {
    const gw = makeGateway();
    const tampered = gw.mintHandle().split('.')[0] + '.AAAA';
    expect(rejection(() => gw.readHandle(tampered)).status).toBe(403);
  });

  it('refuses a handle from a gateway with another secret', () => {
    const gw = makeGateway();
    const other = makeGateway(stubService(), { secret: 'different' });
    expect(rejection(() => gw.readHandle(other.mintHandle())).status).toBe(403);
  });

  it('refuses an expired handle with 403', () => {
    const gw = makeGateway(stubService(), { handleTtl: -1 });
    const err = rejection(() => gw.readHandle(gw.mintHandle()));
    expect(err.status).toBe(403);
    expect(err.reason).toBe('expired handle');
  });

  it.each(['', 'not-a-handle', 'a.b.c', '!!!.!!!', 42, null])(
    'refuses garbage without saying why: %j',
    (bad) => {
      expect(() => makeGateway().readHandle(bad as string)).toThrow(GatewayRejection);
    },
  );

  it('carries a conversation id that contains colons', () => {
    const gw = makeGateway();
    expect(gw.readHandle(gw.mintHandle('a:b:c'))).toBe('a:b:c');
  });
});

// ── Origin and key ───────────────────────────────────────────────────

describe('origin', () => {
  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://app.localhost',
    'http://[::1]:3000',
  ])('allows localhost without listing: %s', (origin) => {
    const gw = makeGateway();
    gw.checkOrigin(origin);
    // The exemption is for localhost only.
    expect(() => gw.checkOrigin('https://evil.example.com')).toThrow(GatewayRejection);
  });

  it('allows a listed origin, with or without a trailing slash, and nothing that only starts like it', () => {
    const gw = makeGateway(stubService(), { allowedOrigins: [`${SHOP}/`] });
    gw.checkOrigin(SHOP);
    gw.checkOrigin(`${SHOP}/`);
    expect(() => gw.checkOrigin('https://shop.example.com.evil.test')).toThrow(GatewayRejection);
  });

  it('refuses an unlisted origin with 403', () => {
    expect(rejection(() => makeGateway().checkOrigin('https://evil.example.com')).status).toBe(403);
  });

  it('allows a missing origin, but not an unrecognised one', () => {
    const gw = makeGateway();
    gw.checkOrigin(null);
    gw.checkOrigin(undefined);
    expect(() => gw.checkOrigin('not a url')).toThrow(GatewayRejection);
  });
});

describe('key', () => {
  it.each([null, undefined, '', 'pk_wrong', 'pk_test_key_longer'])(
    'refuses a missing or wrong key with 401: %j',
    (bad) => {
      expect(rejection(() => makeGateway().checkKey(bad)).status).toBe(401);
    },
  );

  it('falls back to SIGNALWIRE_CHAT_GATEWAY_KEY, then generates one', () => {
    const svc = stubService();
    process.env['SIGNALWIRE_CHAT_GATEWAY_KEY'] = 'pk_from_env';
    try {
      expect(new ChatGateway({ configUrl: CONFIG_URL, client: svc.client }).key).toBe(
        'pk_from_env',
      );
    } finally {
      delete process.env['SIGNALWIRE_CHAT_GATEWAY_KEY'];
    }
    expect(new ChatGateway({ configUrl: CONFIG_URL, client: svc.client }).key).toMatch(
      /^pk_[A-Za-z0-9_-]{32}$/,
    );
  });

  it('shares handles across gateways through SIGNALWIRE_CHAT_GATEWAY_SECRET', () => {
    const svc = stubService();
    process.env['SIGNALWIRE_CHAT_GATEWAY_SECRET'] = 'shared';
    try {
      const a = new ChatGateway({ configUrl: CONFIG_URL, client: svc.client });
      const b = new ChatGateway({ configUrl: CONFIG_URL, client: svc.client });
      expect(b.readHandle(a.mintHandle('conv'))).toBe('conv');
    } finally {
      delete process.env['SIGNALWIRE_CHAT_GATEWAY_SECRET'];
    }
  });

  it('requires a configUrl', () => {
    expect(() => new ChatGateway({ configUrl: '', client: stubService().client })).toThrow(
      /configUrl is required/,
    );
  });
});

// ── What the browser may ask for ─────────────────────────────────────

describe('prepare', () => {
  it('always sends its own config_url', () => {
    const [, params] = prep(makeGateway(), { message: 'hi', config_url: 'https://evil/swml' });
    expect(params['config_url']).toBe(CONFIG_URL);
  });

  it("doesn't let the browser name the conversation", () => {
    const gw = makeGateway();
    const [, params, minted] = prep(gw, { message: 'hi', id: 'someone-elses-chat' });
    expect(params['id']).not.toBe('someone-elses-chat');
    expect(minted).not.toBeNull();
    expect(gw.readHandle(minted!)).toBe(params['id']);
  });

  it.each(['chat_log', 'summarize', 'delete', 'create_conversation', 42])(
    'refuses any other method with 400: %j',
    (method) => {
      expect(rejection(() => prep(makeGateway(), { method, message: 'hi' })).status).toBe(400);
    },
  );

  it('mints on the first chat and reuses the handle after', () => {
    const gw = makeGateway();
    const [, first, minted] = prep(gw, { message: 'one' });
    const [, second, again] = prep(gw, { message: 'two', handle: minted });
    expect(again).toBeNull();
    expect(second['id']).toBe(first['id']);
  });

  it('needs a handle for end and log', () => {
    expect(rejection(() => prep(makeGateway(), { method: 'end' })).reason).toBe(
      'end requires a handle',
    );
    expect(rejection(() => prep(makeGateway(), { method: 'log' })).reason).toBe(
      'log requires a handle',
    );
  });

  it('maps end to end_conversation', () => {
    const gw = makeGateway();
    const handle = gw.mintHandle();
    expect(prep(gw, { method: 'end', handle })).toEqual([
      'end_conversation',
      { id: gw.readHandle(handle) },
      null,
    ]);
  });

  it.each([null, '', '   ', 5])('refuses an empty message: %j', (message) => {
    expect(rejection(() => prep(makeGateway(), { message })).reason).toBe('message is required');
  });

  it('starts a conversation with no message', () => {
    const gw = makeGateway();
    const [method, params, minted] = prep(gw, { method: 'start' });
    expect(method).toBe('create_conversation');
    expect(params).toEqual({ id: gw.readHandle(minted!), config_url: CONFIG_URL });
  });

  it('scopes log to the handle, not the body', () => {
    const gw = makeGateway();
    const handle = gw.mintHandle();
    expect(prep(gw, { method: 'log', handle, id: 'someone-elses-chat' })).toEqual([
      'chat_log',
      { id: gw.readHandle(handle) },
      null,
    ]);
  });

  it('checks the key before anything else', () => {
    expect(
      rejection(() => makeGateway().prepare({ method: 'nope' }, { origin: SHOP, key: 'bad' }))
        .status,
    ).toBe(401);
  });
});

// ── The caps ─────────────────────────────────────────────────────────

describe('caps', () => {
  it('limits new conversations per window', () => {
    const gw = makeGateway(stubService(), { maxNewConversations: 3 });
    for (let i = 0; i < 3; i++) prep(gw, { message: 'hi' }, null);
    expect(rejection(() => prep(gw, { message: 'hi' }, null)).status).toBe(429);
  });

  it('limits turns per conversation', () => {
    const gw = makeGateway(stubService(), { maxTurns: 2 });
    const handle = gw.mintHandle();
    for (let i = 0; i < 2; i++) prep(gw, { message: 'hi', handle }, null);
    expect(rejection(() => prep(gw, { message: 'hi', handle }, null)).status).toBe(429);
  });

  it("doesn't stop one conversation when another reaches its cap", () => {
    const gw = makeGateway(stubService(), { maxTurns: 1 });
    const a = gw.mintHandle();
    const b = gw.mintHandle();
    prep(gw, { message: 'hi', handle: a }, null);
    prep(gw, { message: 'hi', handle: b }, null);
    expect(() => prep(gw, { message: 'again', handle: a }, null)).toThrow(GatewayRejection);
  });
});

// ── Transcript ───────────────────────────────────────────────────────

describe('visibleMessages and lastActivity', () => {
  it('keeps only the dialogue, with timestamps in seconds', () => {
    const raw = [
      { role: 'system', content: 'You are Sigmond. Secret instructions.' },
      { role: 'user', content: 'hi', timestamp: 123 },
      { role: 'assistant', content: null, tool_calls: [{ id: 'call_1' }] },
      { role: 'tool', content: '{"internal": "result"}' },
      { role: 'assistant', content: 'Hello!', timestamp: 124 },
      { role: 'assistant', content: '   ' },
    ];
    const out = ChatGateway.visibleMessages(raw);
    expect(out).toEqual([
      { role: 'user', content: 'hi', timestamp: 123 / 1_000_000 },
      { role: 'assistant', content: 'Hello!', timestamp: 124 / 1_000_000 },
    ]);
    const blob = JSON.stringify(out);
    expect(blob).not.toContain('Secret instructions');
    expect(blob).not.toContain('tool_calls');
    expect(blob).not.toContain('internal');
  });

  it('reports seconds, not microseconds', () => {
    const ts = 1_786_258_737_756_596;
    const msgs = [{ role: 'user', content: 'hi', timestamp: ts }];
    expect(ChatGateway.visibleMessages(msgs)[0]!['timestamp']).toBeCloseTo(1_786_258_737.756596, 5);
    expect(ChatGateway.lastActivity(msgs)).toBeCloseTo(1_786_258_737.756596, 5);
  });

  it('takes the newest message of any role for lastActivity', () => {
    expect(
      ChatGateway.lastActivity([
        { role: 'user', content: 'first', timestamp: 1_000_000 },
        { role: 'assistant', content: 'second', timestamp: 3_000_000 },
        { role: 'tool', content: 'internal', timestamp: 5_000_000 },
      ]),
    ).toBe(5);
  });

  it('returns null, not 0, when nothing is dated', () => {
    expect(ChatGateway.lastActivity([{ role: 'user', content: 'hi' }])).toBeNull();
    expect(ChatGateway.lastActivity([])).toBeNull();
    expect(ChatGateway.lastActivity(null)).toBeNull();
    expect(ChatGateway.lastActivity([{ role: 'user', timestamp: 'not a number' }])).toBeNull();
  });

  it('reports the service default timeout when none is set', () => {
    expect(makeGateway().effectiveTimeout).toBe(3600);
    expect(makeGateway(stubService(), { conversationTimeout: 900 }).effectiveTimeout).toBe(900);
  });

  it('degrades a junk transcript to empty', () => {
    expect(ChatGateway.visibleMessages([])).toEqual([]);
    expect(ChatGateway.visibleMessages(null)).toEqual([]);
    expect(ChatGateway.visibleMessages(['not an object', { role: 'user' }])).toEqual([]);
  });
});

// ── Page context ─────────────────────────────────────────────────────

const PAGE = {
  capabilities: { widget: 'signalwire-address', medium: 'chat' },
  metadata: { page: { url: 'https://shop.example.com/pricing', title: 'Pricing' } },
};

describe('user_meta_data', () => {
  it('reaches the create params', () => {
    const [method, params] = prep(makeGateway(), { method: 'start', user_meta_data: PAGE });
    expect(method).toBe('create_conversation');
    expect(params['user_meta_data']).toEqual(PAGE);
  });

  it('is sent on chat turns too', () => {
    const gw = makeGateway();
    const [, , handle] = prep(gw, { method: 'start', user_meta_data: PAGE });
    const moved = { metadata: { page: { url: 'https://shop.example.com/docs' } } };
    const [, later] = prep(gw, { message: 'and now?', handle, user_meta_data: moved });
    expect(later['user_meta_data']).toEqual(moved);
  });

  it.each([{}, { user_meta_data: null }, { user_meta_data: {} }])(
    'is left out when absent, null or empty: %j',
    (extra) => {
      const [, params] = prep(makeGateway(), { method: 'start', ...extra });
      expect(params).not.toHaveProperty('user_meta_data');
    },
  );

  it.each(['a string', 42, ['a', 'list'], true])('must be an object: %j', (bad) => {
    const err = rejection(() => prep(makeGateway(), { method: 'start', user_meta_data: bad }));
    expect(err.status).toBe(400);
    expect(err.reason).toBe('user_meta_data must be an object');
  });

  it('is limited in size', () => {
    const fat = { junk: 'x'.repeat(MAX_USER_METADATA_BYTES + 1) };
    expect(
      rejection(() => prep(makeGateway(), { method: 'start', user_meta_data: fat })).status,
    ).toBe(413);
  });

  it('counts non-ASCII characters as their escaped size', () => {
    // 1400 'é' serialize to 8,400 bytes escaped (as the reference measures), 2,800 as UTF-8.
    const accented = { note: 'é'.repeat(1400) };
    expect(
      rejection(() => prep(makeGateway(), { method: 'start', user_meta_data: accented })).status,
    ).toBe(413);
  });

  it('refuses a value that cannot be serialized', () => {
    const err = rejection(() =>
      prep(makeGateway(), { method: 'start', user_meta_data: { n: BigInt(1) } }),
    );
    expect(err.reason).toBe('user_meta_data must be JSON-serializable');
  });

  it('is refused before a new conversation is charged', () => {
    const gw = makeGateway(stubService(), { maxNewConversations: 1 });
    expect(() => prep(gw, { method: 'start', user_meta_data: 'nope' }, null)).toThrow(
      GatewayRejection,
    );
    const [, , minted] = prep(gw, { method: 'start' }, null);
    expect(minted).not.toBeNull();
  });

  it("can't replace the id or config_url the gateway sets", () => {
    const gw = makeGateway();
    const hostile = { id: 'someone-elses-chat', config_url: 'https://evil/swml' };
    const [, params, minted] = prep(gw, { message: 'hi', user_meta_data: hostile });
    expect(params['id']).toBe(gw.readHandle(minted!));
    expect(params['config_url']).toBe(CONFIG_URL);
    expect(params['user_meta_data']).toEqual(hostile);
  });
});

// ── Over HTTP ────────────────────────────────────────────────────────

const HEADERS = {
  Authorization: `Bearer ${KEY}`,
  Origin: SHOP,
  'Content-Type': 'application/json',
};

function http(gw: ChatGateway) {
  const app = new Hono().route('/chat', gw.router());
  return (body: unknown, headers: Record<string, string> = HEADERS) =>
    app.request('/chat', { method: 'POST', headers, body: JSON.stringify(body) });
}

describe('router', () => {
  it('forwards a chat with its own config_url and id, then ends it', async () => {
    const svc = stubService();
    const gw = makeGateway(svc);
    const post = http(gw);
    const r = await post({ message: 'hello' });
    expect(r.status).toBe(200);
    const handle = r.headers.get('x-chat-handle')!;
    expect(JSON.parse(await r.text()).result.response).toBe('hi there');
    expect(r.headers.get('access-control-allow-origin')).toBe(SHOP);
    const sent = svc.seen.at(-1)!.params;
    expect(sent['config_url']).toBe(CONFIG_URL);
    expect(sent['id']).toBe(gw.readHandle(handle));
    expect(JSON.stringify(sent)).not.toContain('token');

    const ended = await post({ method: 'end', handle });
    expect(ended.status).toBe(200);
    expect(await ended.json()).toEqual({ status: 'ended' });
    expect(svc.seen.at(-1)!.method).toBe('end_conversation');
  });

  it('reuses the handle on a second turn, with no new one minted', async () => {
    const svc = stubService();
    const gw = makeGateway(svc);
    const post = http(gw);
    const handle = (await post({ message: 'one' })).headers.get('x-chat-handle')!;
    const second = await post({ message: 'two', handle });
    expect(second.headers.get('x-chat-handle')).toBeNull();
    expect(svc.seen.at(-1)!.params['id']).toBe(gw.readHandle(handle));
  });

  it('refuses a bad key with 401', async () => {
    const r = await http(makeGateway())({ message: 'hi' }, { Authorization: 'Bearer nope' });
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: 'bad key' });
  });

  it('refuses an unlisted origin with 403 and no CORS headers', async () => {
    const r = await http(makeGateway())(
      { message: 'hi' },
      { Authorization: `Bearer ${KEY}`, Origin: 'https://evil.test' },
    );
    expect(r.status).toBe(403);
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers a bad JSON body or a non-object body with 400', async () => {
    const app = new Hono().route('/chat', makeGateway().router());
    const bad = await app.request('/chat', { method: 'POST', headers: HEADERS, body: '{nope' });
    expect(bad.status).toBe(400);
    expect((await http(makeGateway())(['a'])).status).toBe(400);
  });

  it("answers a listed origin's preflight", async () => {
    const app = new Hono().route('/chat', makeGateway().router());
    const r = await app.request('/chat', { method: 'OPTIONS', headers: { Origin: SHOP } });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe(SHOP);
    expect(r.headers.get('access-control-expose-headers')).toContain('X-Chat-Handle');
    expect(r.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
  });

  it('gives no CORS headers to an unlisted origin preflight', async () => {
    const app = new Hono().route('/chat', makeGateway().router());
    const r = await app.request('/chat', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.test' },
    });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('starts, then reads back only the visible transcript', async () => {
    const svc = stubService();
    const gw = makeGateway(svc);
    const post = http(gw);
    const started = await post({ method: 'start' });
    expect(started.status).toBe(200);
    expect(await started.json()).toEqual({
      greeting: 'Hi, I am Sigmond.',
      status: 'created',
      timeout: 3600,
    });
    const handle = started.headers.get('x-chat-handle')!;
    const replay = await post({ method: 'log', handle });
    expect(await replay.json()).toEqual({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hi there' },
      ],
      timeout: 3600,
      last_activity: null,
    });
    expect(svc.seen.at(-1)!.params['id']).toBe(gw.readHandle(handle));
  });

  it('sends the configured timeout on start and chat, and reports it', async () => {
    const svc = stubService();
    const post = http(makeGateway(svc, { conversationTimeout: 900 }));
    const started = await post({ method: 'start' });
    expect((await started.json()).timeout).toBe(900);
    expect(svc.seen.at(-1)).toMatchObject({
      method: 'create_conversation',
      params: { conversation_timeout: 900 },
    });
    await post({ message: 'hi', handle: started.headers.get('x-chat-handle') });
    expect(svc.seen.at(-1)).toMatchObject({
      method: 'chat',
      params: { conversation_timeout: 900 },
    });
  });

  it('sends user_meta_data to the service on start and on chat', async () => {
    const svc = stubService();
    const post = http(makeGateway(svc));
    const started = await post({ method: 'start', user_meta_data: PAGE });
    expect(svc.seen.at(-1)!.params['user_meta_data']).toEqual(PAGE);
    await post({
      message: 'hi',
      handle: started.headers.get('x-chat-handle'),
      user_meta_data: PAGE,
    });
    expect(svc.seen.at(-1)).toMatchObject({ method: 'chat', params: { user_meta_data: PAGE } });
  });

  it('answers a malformed user_meta_data with a clean 400', async () => {
    const r = await http(makeGateway())({
      method: 'start',
      user_meta_data: ['not', 'an', 'object'],
    });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'user_meta_data must be an object' });
  });
});

describe('streaming', () => {
  it('relays the keepalive padding rather than holding it back', async () => {
    const r = await http(makeGateway(stubService({ padded: true })))({ message: 'hi' });
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text.startsWith(' ')).toBe(true);
    expect(JSON.parse(text).result.response).toBe('slow reply');
  });

  it('passes chunks on as they arrive', async () => {
    const r = await http(makeGateway(stubService({ padded: true })))({ message: 'hi' });
    const reader = r.body!.getReader();
    const first = await reader.read();
    // The first chunk is padding alone: the reply hasn't been produced yet.
    expect(new TextDecoder().decode(first.value).trim()).toBe('');
    await reader.cancel();
  });
});

describe('mounted on an agent', () => {
  it('serves the gateway under the prefix, outside the agent auth', async () => {
    const svc = stubService();
    const gw = makeGateway(svc);
    const agent = new AgentBase({ name: 'a', route: '/', basicAuth: ['u', 'p'] });
    agent.mount(gw.router(), { prefix: '/chat' });
    const r = await agent.getApp().request('/chat/', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ method: 'start' }),
    });
    expect(r.status).toBe(200);
    expect(r.headers.get('x-chat-handle')).toBeTruthy();
  });
});
