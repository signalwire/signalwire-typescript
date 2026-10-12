/**
 * An application's own middleware may read the request body (c.req.json(),
 * c.req.text(), c.req.arrayBuffer()) before the request reaches ChatGateway
 * or HandoffRouter. Hono caches what it read, so the routes must read the body
 * through that cache, and still apply the size limit to it.
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { AIChatClient } from '../../src/ai-chat/AIChatClient.js';
import { ChatGateway, MAX_REQUEST_BODY_BYTES } from '../../src/ai-chat/ChatGateway.js';
import { HandoffRouter } from '../../src/ai-chat/HandoffRouter.js';

const KEY = 'pk_test_key';

type Reader = 'json' | 'text' | 'arrayBuffer';

/** Middleware that reads the body the way an application might, then passes it on. */
const readFirst =
  (how: Reader, seen: unknown[]) =>
  async (c: Context, next: Next): Promise<void> => {
    seen.push(await c.req[how]());
    await next();
  };

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
  return {
    seen,
    client: new AIChatClient({ project: 'p', token: 't', url: 'http://svc/', fetchImpl }),
  };
}

function setup(how: Reader) {
  const svc = stubService();
  const gateway = new ChatGateway({
    configUrl: 'https://agent.example.com/swml',
    key: KEY,
    client: svc.client,
    secret: 'test-secret',
  });
  const said: Array<[string, string]> = [];
  const handoff = new HandoffRouter({
    gateway,
    sendMessage: (callId, text) => {
      said.push([callId, text]);
      return true;
    },
  });
  handoff.register('n', { conversationId: 'conv-root', callId: 'call-9' });
  const readByMiddleware: unknown[] = [];
  const app = new Hono();
  // Covers /chat itself as well as the handoff routes under it.
  app.use('/chat/*', readFirst(how, readByMiddleware));
  app.route('/chat', gateway.router());
  app.route('/chat', handoff.router());
  const post = (path: string, body: string) =>
    app.request(`/chat${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body,
    });
  return { svc, said, readByMiddleware, post };
}

const oversized = (fields: Record<string, unknown>) =>
  JSON.stringify({ ...fields, pad: 'x'.repeat(MAX_REQUEST_BODY_BYTES) });

describe.each<Reader>(['json', 'text', 'arrayBuffer'])(
  'a body the middleware already read with c.req.%s()',
  (how) => {
    it('reaches the gateway', async () => {
      const { svc, readByMiddleware, post } = setup(how);
      const r = await post('', JSON.stringify({ message: 'hello' }));
      expect(r.status).toBe(200);
      expect(readByMiddleware).toHaveLength(1);
      expect(svc.seen.at(-1)!.params['message']).toBe('hello');
    });

    it('is still refused by the gateway when oversized', async () => {
      const { svc, post } = setup(how);
      const r = await post('', oversized({ message: 'hello' }));
      expect(r.status).toBe(413);
      expect(await r.json()).toEqual({ error: 'request too large' });
      expect(svc.seen).toEqual([]);
    });

    it('reaches /say', async () => {
      const { said, post } = setup(how);
      const r = await post('/say', JSON.stringify({ nonce: 'n', text: 'hi' }));
      expect(r.status).toBe(200);
      expect(said).toEqual([['call-9', 'hi']]);
    });

    it('reaches /handoff', async () => {
      const { post } = setup(how);
      const r = await post('/handoff', JSON.stringify({ nonce: 'n' }));
      expect(r.status).toBe(200);
      expect(typeof (await r.json()).handle).toBe('string');
    });

    it.each(['/handoff', '/escalate', '/say'])(
      'is still refused by %s when oversized',
      async (path) => {
        const { said, post } = setup(how);
        const r = await post(path, oversized({ nonce: 'n', text: 'hi', handle: 'h' }));
        expect(r.status).toBe(413);
        expect(await r.json()).toEqual({ error: 'request too large' });
        expect(said).toEqual([]);
      },
    );
  },
);

/** Resolves to the response, or to 'pending' if it doesn't settle in time. */
const settled = (r: Promise<Response>, ms = 2000): Promise<Response | 'pending'> =>
  Promise.race([r, new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), ms))]);

describe('a request that middleware cloned and reads after the handler', () => {
  // clone() tees the body, and cancelling one branch of a tee waits for the
  // other. The middleware can't read its clone until the handler returns, so
  // a refusal that waited on the cancellation never came.
  function setupCloning() {
    const gateway = new ChatGateway({
      configUrl: 'https://agent.example.com/swml',
      key: KEY,
      client: stubService().client,
      secret: 'test-secret',
    });
    const handoff = new HandoffRouter({ gateway, sendMessage: () => true });
    handoff.register('n', { conversationId: 'conv-root', callId: 'call-9' });
    const clonedLengths: number[] = [];
    const app = new Hono();
    app.use('/chat/*', async (c: Context, next: Next) => {
      const clone = c.req.raw.clone();
      await next();
      clonedLengths.push((await clone.text()).length);
    });
    app.route('/chat', gateway.router());
    app.route('/chat', handoff.router());
    // No Content-Length, so the size is found by reading.
    const post = async (path: string, body: string): Promise<Response> =>
      app.request(`/chat${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body,
      });
    return { clonedLengths, post };
  }

  it.each(['', '/say', '/handoff', '/escalate'])(
    'answers an oversized body on %s with 413 instead of hanging',
    async (path) => {
      const { clonedLengths, post } = setupCloning();
      const body = oversized({ message: 'hello', nonce: 'n', text: 'hi', handle: 'h' });
      const r = await settled(post(path, body));
      expect(r).not.toBe('pending');
      expect((r as Response).status).toBe(413);
      expect(await (r as Response).json()).toEqual({ error: 'request too large' });
      expect(clonedLengths).toEqual([body.length]);
    },
  );

  it('still serves a normal body', async () => {
    const { clonedLengths, post } = setupCloning();
    const body = JSON.stringify({ nonce: 'n', text: 'hi' });
    const r = await settled(post('/say', body));
    expect((r as Response).status).toBe(200);
    expect(clonedLengths).toEqual([body.length]);
  });
});

describe('middleware that reads the body after the handler', () => {
  // The route used to read the body with c.req.json(), which fills Hono's
  // body cache, so middleware could read it again after next().
  function setupAfter(how: Reader) {
    const svc = stubService();
    const gateway = new ChatGateway({
      configUrl: 'https://agent.example.com/swml',
      key: KEY,
      client: svc.client,
      secret: 'test-secret',
    });
    const said: string[] = [];
    const handoff = new HandoffRouter({
      gateway,
      sendMessage: (_callId, text) => {
        said.push(text);
        return true;
      },
    });
    handoff.register('n', { conversationId: 'conv-root', callId: 'call-9' });
    const readAfter: unknown[] = [];
    const app = new Hono();
    app.use('/chat/*', async (c: Context, next: Next) => {
      await next();
      readAfter.push(await c.req[how]());
    });
    app.route('/chat', gateway.router());
    app.route('/chat', handoff.router());
    const post = (path: string, body: string) =>
      app.request(`/chat${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body,
      });
    return { svc, said, readAfter, post };
  }

  const decoded = (value: unknown): string =>
    value instanceof ArrayBuffer
      ? new TextDecoder().decode(value)
      : typeof value === 'string'
        ? value
        : JSON.stringify(value);

  describe.each<Reader>(['json', 'text', 'arrayBuffer'])('with c.req.%s()', (how) => {
    it('lets the gateway answer and the middleware read the body', async () => {
      const { svc, readAfter, post } = setupAfter(how);
      const body = JSON.stringify({ message: 'hello' });
      const r = await post('', body);
      expect(r.status).toBe(200);
      expect(svc.seen.at(-1)!.params['message']).toBe('hello');
      expect(readAfter.map(decoded)).toEqual([body]);
    });

    it.each([
      ['/say', { nonce: 'n', text: 'hi' }],
      ['/handoff', { nonce: 'n' }],
      ['/escalate', { handle: 'not-a-handle' }],
    ])('lets %s answer and the middleware read the body', async (path, fields) => {
      const { readAfter, post } = setupAfter(how);
      const body = JSON.stringify(fields);
      const r = await post(path, body);
      expect(r.status).toBeLessThan(500);
      expect(readAfter.map(decoded)).toEqual([body]);
    });
  });
});
