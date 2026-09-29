/**
 * Size limits on ChatGateway and HandoffRouter. Whoever holds the key (or
 * can load the page) chooses how large each request is, and a chat message
 * or /say text becomes a billed turn, so the body and the message are
 * bounded. Mirrors the size-limit tests in signalwire-python
 * tests/unit/ai_chat/test_gateway.py and test_handoff.py.
 */

import { Hono } from 'hono';
import { AIChatClient } from '../../src/ai-chat/AIChatClient.js';
import {
  ChatGateway,
  GatewayRejection,
  MAX_MESSAGE_BYTES,
  MAX_REQUEST_BODY_BYTES,
  MAX_USER_METADATA_BYTES,
} from '../../src/ai-chat/ChatGateway.js';
import { HandoffRouter } from '../../src/ai-chat/HandoffRouter.js';
import * as sdk from '../../src/index.js';

const KEY = 'pk_test_key';
const SHOP = 'https://shop.example.com';
const HEADERS = {
  Authorization: `Bearer ${KEY}`,
  Origin: SHOP,
  'Content-Type': 'application/json',
};

/** A stub chat service that records what the gateway sent. */
function stubService() {
  const seen: Array<{ method: string; params: Record<string, unknown> }> = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      method: string;
      params: Record<string, unknown>;
      id: string;
    };
    seen.push(body);
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', result: { response: 'hi there' }, id: body.id }),
      { status: 200 },
    );
  }) as unknown as typeof globalThis.fetch;
  const client = new AIChatClient({ project: 'p', token: 't', url: 'http://svc/', fetchImpl });
  return { seen, client };
}

function makeGateway(
  svc = stubService(),
  overrides: { maxNewConversations?: number; maxTurns?: number } = {},
) {
  return new ChatGateway({
    configUrl: 'https://agent.example.com/swml',
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

/** A body that counts how much of it was read. */
function countingStream(total: number, chunk = 1024) {
  const state = { read: 0 };
  let left = total;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(c) {
        if (left <= 0) {
          c.close();
          return;
        }
        const n = Math.min(chunk, left);
        left -= n;
        state.read += n;
        c.enqueue(new Uint8Array(n).fill(0x20));
      },
    },
    // Nothing is pulled until the body is read.
    { highWaterMark: 0 },
  );
  return { stream, state };
}

describe('exports', () => {
  it('exports both limits from the package index, beside MAX_USER_METADATA_BYTES', () => {
    expect(sdk.MAX_MESSAGE_BYTES).toBe(8 * 1024);
    expect(sdk.MAX_REQUEST_BODY_BYTES).toBe(64 * 1024);
    expect(sdk.MAX_USER_METADATA_BYTES).toBe(MAX_USER_METADATA_BYTES);
  });
});

describe('ChatGateway message limit', () => {
  const prep = (gw: ChatGateway, body: Record<string, unknown>) =>
    gw.prepare(body, { origin: null, key: KEY });

  it('refuses a message over the limit with 413', () => {
    const err = rejection(() =>
      prep(makeGateway(), { message: 'x'.repeat(MAX_MESSAGE_BYTES + 1) }),
    );
    expect(err.status).toBe(413);
    expect(err.reason).toBe('message too large');
  });

  it('passes a message at the limit', () => {
    const atLimit = 'x'.repeat(MAX_MESSAGE_BYTES);
    const [, params] = prep(makeGateway(), { message: atLimit });
    expect(params['message']).toBe(atLimit);
  });

  it('counts UTF-8 bytes, not characters', () => {
    const wide = 'é'.repeat(MAX_MESSAGE_BYTES / 2 + 1);
    expect(wide.length).toBeLessThan(MAX_MESSAGE_BYTES);
    expect(rejection(() => prep(makeGateway(), { message: wide })).status).toBe(413);
  });

  it('mints nothing for an oversized message', () => {
    const gw = makeGateway(stubService(), { maxNewConversations: 1 });
    rejection(() => prep(gw, { message: 'x'.repeat(MAX_MESSAGE_BYTES + 1) }));
    const [, , minted] = prep(gw, { message: 'hi' });
    expect(minted).not.toBeNull();
  });

  it('charges no turn for an oversized message', () => {
    const gw = makeGateway(stubService(), { maxTurns: 1 });
    const handle = gw.mintHandle();
    const err = rejection(() => prep(gw, { message: 'x'.repeat(MAX_MESSAGE_BYTES + 1), handle }));
    expect(err.status).toBe(413);
    const [, params] = prep(gw, { message: 'hi', handle });
    expect(params['message']).toBe('hi');
  });
});

describe('ChatGateway request body limit', () => {
  const app = (gw: ChatGateway) => new Hono().route('/chat', gw.router());

  it('refuses an oversized body before parsing it', async () => {
    // Not valid JSON, so a 413 rather than a 400 shows the size came first.
    const svc = stubService();
    const r = await app(makeGateway(svc)).request('/chat', {
      method: 'POST',
      headers: HEADERS,
      body: '{'.repeat(MAX_REQUEST_BODY_BYTES + 1),
    });
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'request too large' });
    expect(r.headers.get('access-control-allow-origin')).toBe(SHOP);
    expect(svc.seen).toEqual([]);
  });

  it('refuses a declared Content-Length over the limit without reading the body', async () => {
    const svc = stubService();
    const { stream, state } = countingStream(16);
    const r = await app(makeGateway(svc)).request('/chat', {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Length': String(MAX_REQUEST_BODY_BYTES + 1) },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'request too large' });
    expect(state.read).toBe(0);
    expect(svc.seen).toEqual([]);
  });

  it('counts a body with no Content-Length as it arrives, and stops reading past the limit', async () => {
    const svc = stubService();
    const { stream, state } = countingStream(MAX_REQUEST_BODY_BYTES * 4);
    const r = await app(makeGateway(svc)).request('/chat', {
      method: 'POST',
      headers: HEADERS,
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'request too large' });
    expect(state.read).toBeLessThan(MAX_REQUEST_BODY_BYTES * 2);
    expect(svc.seen).toEqual([]);
  });

  it('refuses an oversized message over HTTP, with no handle minted', async () => {
    const svc = stubService();
    const r = await app(makeGateway(svc)).request('/chat', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ message: 'x'.repeat(MAX_MESSAGE_BYTES + 1) }),
    });
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'message too large' });
    expect(r.headers.get('x-chat-handle')).toBeNull();
    expect(svc.seen).toEqual([]);
  });

  it('accepts a full message and a full metadata bag together', async () => {
    const svc = stubService();
    const bag = { junk: 'y'.repeat(MAX_USER_METADATA_BYTES - 20) };
    const r = await app(makeGateway(svc)).request('/chat', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ message: 'x'.repeat(MAX_MESSAGE_BYTES), user_meta_data: bag }),
    });
    expect(r.status).toBe(200);
    expect(svc.seen.at(-1)!.params['message']).toBe('x'.repeat(MAX_MESSAGE_BYTES));
  });
});

describe('HandoffRouter size limits', () => {
  function setup() {
    const events: Array<[string, string]> = [];
    const handoff = new HandoffRouter({
      gateway: makeGateway(),
      captureLeg: () => true,
      sendMessage: (callId, text) => {
        events.push([callId, text]);
        return true;
      },
    });
    const app = new Hono().route('/chat', handoff.router());
    const post = (path: string, body: BodyInit) =>
      app.request(`/chat${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    return { handoff, events, post };
  }

  it('refuses /say text over the message limit with 413', async () => {
    const { handoff, events, post } = setup();
    handoff.register('n', { conversationId: 'conv-root', callId: 'call-9' });
    const r = await post(
      '/say',
      JSON.stringify({ nonce: 'n', text: 'x'.repeat(MAX_MESSAGE_BYTES + 1) }),
    );
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'message too large' });
    expect(events).toEqual([]);
  });

  it('answers oversized text the same way whether or not the nonce exists', async () => {
    const { post } = setup();
    const r = await post(
      '/say',
      JSON.stringify({ nonce: 'never-existed', text: 'x'.repeat(MAX_MESSAGE_BYTES + 1) }),
    );
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'message too large' });
  });

  it('accepts /say text at the limit', async () => {
    const { handoff, events, post } = setup();
    handoff.register('n', { conversationId: 'conv-root', callId: 'call-9' });
    const text = 'x'.repeat(MAX_MESSAGE_BYTES);
    const r = await post('/say', JSON.stringify({ nonce: 'n', text }));
    expect(r.status).toBe(200);
    expect(events).toEqual([['call-9', text]]);
  });

  it('refuses oversized text in say() called directly', async () => {
    const { handoff, events } = setup();
    handoff.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(await handoff.say('n', 'x'.repeat(MAX_MESSAGE_BYTES + 1))).toBe(false);
    expect(events).toEqual([]);
  });

  it.each(['/handoff', '/escalate', '/say'])('refuses an oversized body on %s', async (path) => {
    const { post } = setup();
    const r = await post(path, ' '.repeat(MAX_REQUEST_BODY_BYTES + 1));
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'request too large' });
  });

  it('leaves the nonce redeemable after an oversized /handoff', async () => {
    const { handoff, post } = setup();
    handoff.register('n', { conversationId: 'conv-root', callId: 'call-9' });
    const padded = `{"nonce": "n", "pad": "${'x'.repeat(MAX_REQUEST_BODY_BYTES)}"}`;
    expect((await post('/handoff', padded)).status).toBe(413);
    expect((await post('/handoff', JSON.stringify({ nonce: 'n' }))).status).toBe(200);
  });
});
