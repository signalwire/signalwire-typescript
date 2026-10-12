/**
 * A shared `registry`, such as one backed by a cache, returns a copy of an
 * entry rather than the stored object. The router must write every change
 * back, or the registry records neither a typing slot nor its refund and the
 * per-call cap can be passed. Mirrors TestCopyingRegistry in
 * signalwire-python tests/unit/ai_chat/test_handoff.py.
 */

import { Hono } from 'hono';
import { AIChatClient } from '../../src/ai-chat/AIChatClient.js';
import { ChatGateway } from '../../src/ai-chat/ChatGateway.js';
import { HandoffRouter, NonceEntry } from '../../src/ai-chat/HandoffRouter.js';

const copy = (e: NonceEntry): NonceEntry =>
  new NonceEntry(e.conversationId, e.callId, e.issuedAt, e.messages, e.redeemed);

/** Stores and returns copies, as a registry backed by shared storage does. */
class CopyingRegistry extends Map<string, NonceEntry> {
  override get(key: string): NonceEntry | undefined {
    const value = super.get(key);
    return value ? copy(value) : undefined;
  }

  override set(key: string, value: NonceEntry): this {
    return super.set(key, copy(value));
  }

  /** The stored entry itself, for assertions. */
  stored(key: string): NonceEntry | undefined {
    return super.get(key);
  }
}

function makeGateway(): ChatGateway {
  return new ChatGateway({
    configUrl: 'https://agent.example.com/swml',
    key: 'pk_test',
    secret: 's'.repeat(32),
    client: new AIChatClient({ project: 'p', token: 't', url: 'https://service.example.invalid/' }),
  });
}

describe('HandoffRouter with a registry that returns copies', () => {
  it('records a delivered message, so the per-call cap holds', async () => {
    const sent: string[] = [];
    const registry = new CopyingRegistry();
    const router = new HandoffRouter({
      gateway: makeGateway(),
      sendMessage: (_callId, text) => {
        sent.push(text);
        return true;
      },
      maxMessagesPerCall: 1,
      registry,
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(await router.say('n', 'first')).toBe(true);
    expect(registry.stored('n')!.messages).toBe(1);
    expect(await router.say('n', 'over the cap')).toBe(false);
    expect(sent).toEqual(['first']);
  });

  it('gives a failed delivery its slot back', async () => {
    const attempts: string[] = [];
    const registry = new CopyingRegistry();
    const router = new HandoffRouter({
      gateway: makeGateway(),
      sendMessage: (_callId, text) => {
        attempts.push(text);
        if (attempts.length === 1) throw new Error('platform unavailable');
        return true;
      },
      maxMessagesPerCall: 1,
      registry,
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(await router.say('n', 'first')).toBe(false);
    expect(registry.stored('n')!.messages).toBe(0);
    expect(await router.say('n', 'again')).toBe(true);
    expect(await router.say('n', 'over the cap')).toBe(false);
    expect(attempts).toEqual(['first', 'again']);
  });

  it("keeps other requests' slots when one delivery fails", async () => {
    // Two overlapping /say requests take both slots; the first fails after
    // the second has taken its slot. The refund must decrement the stored
    // count, not write back the failed request's stale copy.
    let releaseFirst!: () => void;
    const registry = new CopyingRegistry();
    const router = new HandoffRouter({
      gateway: makeGateway(),
      sendMessage: async (_callId, text) => {
        if (text === 'first') {
          await new Promise<void>((r) => (releaseFirst = r));
          throw new Error('platform unavailable');
        }
        return true;
      },
      maxMessagesPerCall: 2,
      registry,
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    const first = router.say('n', 'first');
    expect(await router.say('n', 'second')).toBe(true);
    expect(registry.stored('n')!.messages).toBe(2);
    releaseFirst();
    expect(await first).toBe(false);
    expect(registry.stored('n')!.messages).toBe(1);
    expect(await router.say('n', 'third')).toBe(true);
    expect(await router.say('n', 'over the cap')).toBe(false);
  });

  it("doesn't refund into a registration that replaced the one the slot came from", async () => {
    let releaseFirst!: () => void;
    const registry = new CopyingRegistry();
    const router = new HandoffRouter({
      gateway: makeGateway(),
      sendMessage: async () => {
        await new Promise<void>((r) => (releaseFirst = r));
        throw new Error('platform unavailable');
      },
      registry,
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    const pending = router.say('n', 'first');
    // A different registration now holds the nonce, with a message of its own.
    registry.set('n', new NonceEntry('c', 'call-2', 0, 1));
    releaseFirst();
    expect(await pending).toBe(false);
    expect(registry.stored('n')!.messages).toBe(1);
  });

  it('keeps a redeemed nonce redeemed', async () => {
    const router = new HandoffRouter({ gateway: makeGateway(), registry: new CopyingRegistry() });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(await router.redeem('n')).not.toBeNull();
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    expect(await router.redeem('n')).toBeNull();
  });

  it('holds the cap over HTTP', async () => {
    const router = new HandoffRouter({
      gateway: makeGateway(),
      sendMessage: () => true,
      maxMessagesPerCall: 1,
      registry: new CopyingRegistry(),
    });
    router.register('n', { conversationId: 'c', callId: 'call-1' });
    const app = new Hono().route('/chat', router.router());
    const say = (text: string) =>
      app.request('/chat/say', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce: 'n', text }),
      });
    expect((await say('first')).status).toBe(200);
    expect((await say('second')).status).toBe(404);
  });
});
