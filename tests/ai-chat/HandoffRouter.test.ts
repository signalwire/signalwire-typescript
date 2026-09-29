/**
 * HandoffRouter: moving one conversation between voice and text. The browser
 * side is fixed (the address widget calls /handoff, /escalate and /say on its
 * gateway URL), so these tests pin the server side. Three properties matter
 * most: a nonce proves the browser placed the call and an unknown one gets
 * the same answer as an expired one; a medium doesn't start until the one it
 * replaces is recorded; typing repeats but is capped. Mirrors
 * signalwire-python tests/unit/ai_chat/test_handoff.py.
 */

import { Hono } from 'hono';
import { AIChatClient } from '../../src/ai-chat/AIChatClient.js';
import { ChatGateway } from '../../src/ai-chat/ChatGateway.js';
import { HandoffRouter, NonceEntry } from '../../src/ai-chat/HandoffRouter.js';
import { AgentBase } from '../../src/AgentBase.js';

type Event = [string, ...unknown[]];

function makeGateway(allowedOrigins: string[] = []): ChatGateway {
  return new ChatGateway({
    configUrl: 'https://agent.example.com/swml',
    key: 'pk_test',
    secret: 's'.repeat(32),
    allowedOrigins,
    client: new AIChatClient({ project: 'p', token: 't', url: 'https://service.example.invalid/' }),
  });
}

function setup() {
  const gateway = makeGateway();
  const events: Event[] = [];
  const handoff = new HandoffRouter({
    gateway,
    captureLeg: async (conversationId, medium) => {
      await Promise.resolve(); // a real await
      events.push(['capture', conversationId, medium]);
      return true;
    },
    endCall: (callId) => void events.push(['end_call', callId]),
    sendMessage: (callId, text) => {
      events.push(['say', callId, text]);
      return true;
    },
  });
  const app = new Hono().route('/chat', handoff.router());
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(`/chat${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  return { gateway, events, handoff, post };
}

describe('/handoff', () => {
  it('returns a handle the gateway can read', async () => {
    const { handoff, post, gateway } = setup();
    handoff.register('n1', { conversationId: 'conv-root', callId: 'call-9' });
    const r = await post('/handoff', { nonce: 'n1' });
    expect(r.status).toBe(200);
    expect(gateway.readHandle((await r.json()).handle)).toBeTruthy();
  });

  it('ends the call before capturing the leg', async () => {
    const { handoff, post, events } = setup();
    handoff.register('n1', { conversationId: 'conv-root', callId: 'call-9' });
    await post('/handoff', { nonce: 'n1' });
    expect(events).toEqual([
      ['end_call', 'call-9'],
      ['capture', 'conv-root', 'voice'],
    ]);
  });

  it('names a new leg with a dotted id', async () => {
    const { handoff, post, gateway } = setup();
    handoff.register('n1', { conversationId: 'conv-root', callId: 'call-9' });
    const r = await post('/handoff', { nonce: 'n1' });
    expect(gateway.readHandle((await r.json()).handle)).toBe('conv-root.1');
  });

  it('increments leg ids', () => {
    const { handoff } = setup();
    expect(handoff.nextConversationId('root.2')).toBe('root.3');
    expect(handoff.nextConversationId('root')).toBe('root.1');
    expect(handoff.nextConversationId('chat-a.b')).toBe('chat-a.b.1');
  });

  it('uses a nonce once', async () => {
    const { handoff, post } = setup();
    handoff.register('n1', { conversationId: 'conv-root', callId: 'call-9' });
    expect((await post('/handoff', { nonce: 'n1' })).status).toBe(200);
    expect((await post('/handoff', { nonce: 'n1' })).status).toBe(404);
  });

  it('answers a used nonce and an unknown one the same way', async () => {
    const { handoff, post } = setup();
    handoff.register('n1', { conversationId: 'conv-root', callId: 'call-9' });
    await post('/handoff', { nonce: 'n1' });
    const spent = await post('/handoff', { nonce: 'n1' });
    const unknown = await post('/handoff', { nonce: 'never-existed' });
    expect(spent.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(await spent.json()).toEqual(await unknown.json());
  });

  it("doesn't redeem an expired nonce", async () => {
    const expired = new HandoffRouter({ gateway: makeGateway(), nonceTtl: -1 });
    expired.register('n1', { conversationId: 'conv-root', callId: 'call-9' });
    expect(await expired.redeem('n1')).toBeNull();
  });

  it.each([{}, { nonce: 5 }, 'not an object'])('refuses a missing nonce: %j', async (body) => {
    expect((await setup().post('/handoff', body)).status).toBe(404);
  });

  it('keeps nonces in a supplied registry', async () => {
    const registry = new Map<string, NonceEntry>();
    const router = new HandoffRouter({ gateway: makeGateway(), registry });
    router.register('n1', { conversationId: 'c', callId: 'call-1' });
    expect(registry.get('n1')).toMatchObject({
      conversationId: 'c',
      callId: 'call-1',
      messages: 0,
    });
    await router.redeem('n1');
    // Kept as a tombstone until it would have expired.
    expect(registry.get('n1')).toMatchObject({ redeemed: true });
  });
});

describe('/escalate', () => {
  it('captures the chat leg before returning', async () => {
    const { gateway, post, events } = setup();
    const handle = gateway.mintHandle('conv-root.5');
    expect((await post('/escalate', { handle })).status).toBe(200);
    expect(events).toEqual([['capture', 'conv-root.5', 'chat']]);
  });

  it('refuses a forged handle with 404', async () => {
    expect((await setup().post('/escalate', { handle: 'forged' })).status).toBe(404);
  });

  it('answers a missing handle with 400', async () => {
    expect((await setup().post('/escalate', {})).status).toBe(400);
  });
});

describe('/say', () => {
  it('delivers trimmed text to the call the nonce names', async () => {
    const { handoff, post, events } = setup();
    handoff.register('n2', { conversationId: 'conv-root', callId: 'call-9' });
    expect((await post('/say', { nonce: 'n2', text: '  hello  ' })).status).toBe(200);
    expect(events).toEqual([['say', 'call-9', 'hello']]);
  });

  it('can be repeated', async () => {
    const { handoff, post } = setup();
    handoff.register('n2', { conversationId: 'conv-root', callId: 'call-9' });
    for (let i = 0; i < 3; i++) {
      expect((await post('/say', { nonce: 'n2', text: 'x' })).status).toBe(200);
    }
  });

  it('is capped per call', async () => {
    const router = new HandoffRouter({
      gateway: makeGateway(),
      sendMessage: () => true,
      maxMessagesPerCall: 2,
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(await router.say('n', 'one')).toBe(true);
    expect(await router.say('n', 'two')).toBe(true);
    expect(await router.say('n', 'three')).toBe(false);
  });

  it('refuses empty text', async () => {
    const { handoff, post } = setup();
    handoff.register('n2', { conversationId: 'conv-root', callId: 'call-9' });
    expect((await post('/say', { nonce: 'n2', text: '   ' })).status).toBe(404);
  });

  it("can't inject with an unknown nonce", async () => {
    expect((await setup().post('/say', { nonce: 'guessed', text: 'hello' })).status).toBe(404);
  });

  it('is off when no sender is configured', async () => {
    const router = new HandoffRouter({ gateway: makeGateway() });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(await router.say('n', 'hello')).toBe(false);
  });

  it("doesn't count a failed delivery", async () => {
    let fail = true;
    const router = new HandoffRouter({
      gateway: makeGateway(),
      sendMessage: () => {
        if (fail) throw new Error('call gone');
        return true;
      },
      maxMessagesPerCall: 1,
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(await router.say('n', 'one')).toBe(false);
    fail = false;
    expect(await router.say('n', 'one')).toBe(true);
  });
});

describe('capture failures', () => {
  it("doesn't block the switch when the capture times out", async () => {
    const gateway = makeGateway();
    const router = new HandoffRouter({
      gateway,
      captureLeg: () => new Promise<boolean>(() => undefined),
      captureTimeout: 0.05,
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    const handle = await router.redeem('n');
    expect(gateway.readHandle(handle!)).toBe('c.1');
  });

  it("doesn't block the switch when the capture throws", async () => {
    const gateway = makeGateway();
    const router = new HandoffRouter({
      gateway,
      captureLeg: () => {
        throw new Error('storage down');
      },
      endCall: () => {
        throw new Error('already gone');
      },
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(gateway.readHandle((await router.redeem('n'))!)).toBe('c.1');
  });
});

describe('origin', () => {
  it("refuses an origin the gateway doesn't allow, on every route", async () => {
    const gateway = makeGateway(['https://shop.example.com']);
    const app = new Hono().route('/chat', new HandoffRouter({ gateway }).router());
    for (const path of ['/handoff', '/escalate', '/say']) {
      const r = await app.request(`/chat${path}`, {
        method: 'POST',
        headers: { Origin: 'https://evil.test', 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(r.status).toBe(403);
    }
  });
});

describe('mounted beside the gateway on an agent', () => {
  it('serves both at the same prefix', async () => {
    const gateway = makeGateway();
    const handoff = new HandoffRouter({ gateway });
    handoff.register('n1', { conversationId: 'conv', callId: 'call-1' });
    const agent = new AgentBase({ name: 'a', route: '/', basicAuth: ['u', 'p'] });
    agent.mount(gateway.router(), { prefix: '/chat' });
    agent.mount(handoff.router(), { prefix: '/chat' });
    const app = agent.getApp();
    const redeemed = await app.request('/chat/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce: 'n1' }),
    });
    expect(gateway.readHandle((await redeemed.json()).handle)).toBe('conv.1');
    const preflight = await app.request('/chat', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' },
    });
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });
});

describe('found in review', () => {
  it("doesn't let concurrent /say requests exceed the per-call cap", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    const sent: string[] = [];
    const router = new HandoffRouter({
      gateway: makeGateway(),
      sendMessage: async (_callId, text) => {
        await gate;
        sent.push(text);
        return true;
      },
      maxMessagesPerCall: 1,
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    const results = Promise.all([1, 2, 3, 4, 5].map((i) => router.say('n', `m${i}`)));
    release();
    expect((await results).filter(Boolean)).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it("treats a sender returning false as not delivered, and doesn't count it", async () => {
    let result = false;
    const router = new HandoffRouter({
      gateway: makeGateway(),
      sendMessage: () => result,
      maxMessagesPerCall: 1,
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(await router.say('n', 'one')).toBe(false);
    result = true;
    expect(await router.say('n', 'one')).toBe(true);
  });

  it('answers preflights and sends CORS headers to an allowed origin on every route', async () => {
    const gateway = makeGateway(['https://shop.example.com']);
    const handoff = new HandoffRouter({ gateway, sendMessage: () => true });
    handoff.register('n1', { conversationId: 'conv', callId: 'call-1' });
    const app = new Hono().route('/chat', handoff.router());
    const origin = 'https://shop.example.com';
    for (const path of ['/handoff', '/escalate', '/say']) {
      const preflight = await app.request(`/chat${path}`, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
      });
      expect(preflight.status, path).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin'), path).toBe(origin);
      expect(preflight.headers.get('access-control-allow-headers'), path).toContain('Content-Type');
    }
    const said = await app.request('/chat/say', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce: 'n1', text: 'hi' }),
    });
    expect(said.status).toBe(200);
    expect(said.headers.get('access-control-allow-origin')).toBe(origin);
    const refused = await app.request('/chat/handoff', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.test' },
    });
    expect(refused.headers.get('access-control-allow-origin')).toBeNull();
  });
});
