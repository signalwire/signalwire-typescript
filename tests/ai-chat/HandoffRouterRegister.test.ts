/**
 * HandoffRouter.register() is called from the per-call config callback, which
 * runs on every SWML fetch for the call. Re-registering the same nonce must
 * not reset the call's typed-message count, revive a redeemed nonce, or move
 * the nonce to another call.
 */

import { AIChatClient } from '../../src/ai-chat/AIChatClient.js';
import { ChatGateway } from '../../src/ai-chat/ChatGateway.js';
import { HandoffRouter, NonceEntry } from '../../src/ai-chat/HandoffRouter.js';
import { AgentBase } from '../../src/AgentBase.js';
import { userVariables } from '../../src/capabilities.js';

function makeGateway(): ChatGateway {
  return new ChatGateway({
    configUrl: 'https://agent.example.com/swml',
    key: 'pk_test',
    secret: 's'.repeat(32),
    client: new AIChatClient({ project: 'p', token: 't', url: 'https://service.example.invalid/' }),
  });
}

/** An agent that registers the call's nonce the way docs/ai_chat.md shows. */
function setup(options: { maxMessagesPerCall?: number } = {}) {
  const gateway = makeGateway();
  const sent: Array<[string, string]> = [];
  const handoff = new HandoffRouter({
    gateway,
    sendMessage: (callId, text) => {
      sent.push([callId, text]);
      return true;
    },
    ...options,
  });
  const agent = new AgentBase({ name: 'a', route: '/', basicAuth: ['u', 'p'] });
  agent.addPerCallConfig((_query, body) => {
    const nonce = userVariables(body)['handoff_nonce'];
    const callId = (body as { call?: { call_id?: string } }).call?.call_id;
    if (typeof nonce !== 'string' || !callId) return;
    handoff.register(nonce, { conversationId: callId, callId });
  });
  agent.mount(gateway.router(), { prefix: '/chat' });
  agent.mount(handoff.router(), { prefix: '/chat' });
  const app = agent.getApp();
  const auth = `Basic ${Buffer.from('u:p').toString('base64')}`;
  const fetchSwml = (nonce: string, callId: string) =>
    app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        call: { call_id: callId },
        vars: { userVariables: { handoff_nonce: nonce } },
      }),
    });
  const post = (path: string, body: unknown) =>
    app.request(`/chat${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { handoff, sent, fetchSwml, post };
}

describe('HandoffRouter.register is idempotent', () => {
  it("doesn't reset the per-call message cap when the SWML request is sent again", async () => {
    const { fetchSwml, post, sent } = setup({ maxMessagesPerCall: 1 });
    expect((await fetchSwml('n1', 'call-1')).status).toBe(200);
    expect((await post('/say', { nonce: 'n1', text: 'one' })).status).toBe(200);
    expect((await post('/say', { nonce: 'n1', text: 'two' })).status).toBe(404);
    expect((await fetchSwml('n1', 'call-1')).status).toBe(200);
    expect((await post('/say', { nonce: 'n1', text: 'three' })).status).toBe(404);
    expect(sent).toEqual([['call-1', 'one']]);
  });

  it("doesn't make a redeemed nonce redeemable again", async () => {
    const { fetchSwml, post } = setup();
    await fetchSwml('n1', 'call-1');
    expect((await post('/handoff', { nonce: 'n1' })).status).toBe(200);
    await fetchSwml('n1', 'call-1');
    expect((await post('/handoff', { nonce: 'n1' })).status).toBe(404);
    expect((await post('/say', { nonce: 'n1', text: 'hi' })).status).toBe(404);
  });

  it("doesn't move a live nonce to another call", async () => {
    const { fetchSwml, post, sent } = setup();
    await fetchSwml('n1', 'call-1');
    await fetchSwml('n1', 'call-2');
    expect((await post('/say', { nonce: 'n1', text: 'hi' })).status).toBe(200);
    expect(sent).toEqual([['call-1', 'hi']]);
  });

  it('keeps the registration time, so the TTL counts from the first registration', () => {
    const registry = new Map<string, NonceEntry>();
    const router = new HandoffRouter({ gateway: makeGateway(), registry });
    router.register('n1', { conversationId: 'c', callId: 'call-1' });
    const issuedAt = registry.get('n1')!.issuedAt;
    router.register('n1', { conversationId: 'c', callId: 'call-1' });
    expect(registry.get('n1')!.issuedAt).toBe(issuedAt);
  });

  it('keeps a redeemed nonce as a tombstone until it would have expired', async () => {
    const registry = new Map<string, NonceEntry>();
    const router = new HandoffRouter({ gateway: makeGateway(), registry });
    router.register('n1', { conversationId: 'c', callId: 'call-1' });
    expect(await router.redeem('n1')).not.toBeNull();
    expect(registry.get('n1')).toMatchObject({ redeemed: true });
    router.register('n1', { conversationId: 'c', callId: 'call-1' });
    expect(await router.redeem('n1')).toBeNull();

    // Once the TTL passes the tombstone is pruned, and the nonce is free again.
    registry.get('n1')!.issuedAt -= router.nonceTtl + 1;
    router.register('n1', { conversationId: 'c', callId: 'call-1' });
    expect(registry.get('n1')).toMatchObject({ redeemed: false, messages: 0 });
  });
});
