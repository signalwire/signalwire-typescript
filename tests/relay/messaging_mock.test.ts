/**
 * Real-mock-backed tests for messaging (`sendMessage` + inbound).
 *
 * Translated 1:1 from
 *   signalwire-python/tests/unit/relay/test_messaging_mock.py
 *
 * The messaging schemas are permissive (the C# server forwards JObject
 * to the messaging gateway), so the mock validates the wire frame loosely.
 * We still assert the SDK builds the right `messaging.send` shape AND that
 * inbound `messaging.receive` and outbound `messaging.state` events drive
 * the typed Message lifecycle correctly.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { RelayClient } from '../../src/relay/RelayClient.js';
import { Message } from '../../src/relay/Message.js';
import { getMockRelay, newRelayClient, type MockRelayHarness } from './mocktest.js';

let client: RelayClient;
let mock: MockRelayHarness;

beforeEach(async () => {
  mock = await getMockRelay();
  await mock.reset();
  process.env.RELAY_MAX_CONNECTIONS = '16';
  ({ client } = await newRelayClient());
});

afterEach(async () => {
  if (client) {
    try { await client.disconnect(); } catch { /* ignore */ }
  }
});

// ---------------------------------------------------------------------------
// send_message — outbound
// ---------------------------------------------------------------------------

describe('Messaging — outbound send', () => {
  it('test_send_message_journals_messaging_send', async () => {
    const msg = await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      body: 'hello',
      tags: ['t1', 't2'],
    });
    expect(msg).toBeInstanceOf(Message);
    expect(msg.messageId).not.toBe('');
    expect(msg.body).toBe('hello');
    const [entry] = await mock.journalRecv('messaging.send');
    const p = entry!.frame.params;
    expect(p.to_number).toBe('+15551112222');
    expect(p.from_number).toBe('+15553334444');
    expect(p.body).toBe('hello');
    expect(p.tags).toEqual(['t1', 't2']);
  });

  it('test_send_message_with_media_only', async () => {
    const msg = await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      media: ['https://media.example/cat.jpg'],
    });
    expect(msg).toBeInstanceOf(Message);
    const [entry] = await mock.journalRecv('messaging.send');
    const p = entry!.frame.params;
    expect(p.media).toEqual(['https://media.example/cat.jpg']);
    // The Python test allows either no body or empty body; check the same.
    expect(p.body == null || p.body === '').toBe(true);
  });

  it('test_send_message_includes_context', async () => {
    await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      body: 'hi',
      context: 'custom-ctx',
    });
    const [entry] = await mock.journalRecv('messaging.send');
    expect(entry!.frame.params.context).toBe('custom-ctx');
  });

  it('test_send_message_returns_initial_state_queued', async () => {
    const msg = await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      body: 'hi',
    });
    expect(msg.state).toBe('queued');
    expect(msg.isDone).toBe(false);
  });

  it('test_send_message_resolves_on_delivered', async () => {
    const msg = await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      body: 'hi',
    });
    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'messaging.state',
        params: {
          message_id: msg.messageId,
          message_state: 'delivered',
          from_number: '+15553334444',
          to_number: '+15551112222',
          body: 'hi',
        },
      },
    });
    const event = await msg.wait(5);
    expect(msg.state).toBe('delivered');
    expect(msg.isDone).toBe(true);
    expect(event.params.message_state).toBe('delivered');
  });

  it('test_send_message_resolves_on_undelivered', async () => {
    const msg = await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      body: 'hi',
    });
    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'messaging.state',
        params: {
          message_id: msg.messageId,
          message_state: 'undelivered',
          reason: 'carrier_blocked',
        },
      },
    });
    await msg.wait(5);
    expect(msg.state).toBe('undelivered');
    expect(msg.reason).toBe('carrier_blocked');
  });

  it('test_send_message_resolves_on_failed', async () => {
    const msg = await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      body: 'hi',
    });
    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'messaging.state',
        params: {
          message_id: msg.messageId,
          message_state: 'failed',
          reason: 'spam',
        },
      },
    });
    await msg.wait(5);
    expect(msg.state).toBe('failed');
  });

  it('test_send_message_intermediate_state_does_not_resolve', async () => {
    const msg = await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      body: 'hi',
    });
    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'messaging.state',
        params: {
          message_id: msg.messageId,
          message_state: 'sent',
        },
      },
    });
    for (let i = 0; i < 100; i++) {
      if (msg.state === 'sent') break;
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(msg.state).toBe('sent');
    expect(msg.isDone).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Inbound messages
// ---------------------------------------------------------------------------

describe('Messaging — inbound', () => {
  it('test_inbound_message_fires_on_message_handler', async () => {
    let received = false;
    const seen: { msg?: Message } = {};
    const receivedPromise = new Promise<void>((resolve) => {
      client.onMessage(async (msg) => {
        seen.msg = msg;
        received = true;
        resolve();
      });
    });

    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'messaging.receive',
        params: {
          message_id: 'in-msg-1',
          context: 'default',
          direction: 'inbound',
          from_number: '+15551110000',
          to_number: '+15552220000',
          body: 'hello back',
          media: [],
          segments: 1,
          message_state: 'received',
          tags: ['incoming'],
        },
      },
    });

    await Promise.race([
      receivedPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);

    expect(received).toBe(true);
    const m = seen.msg!;
    expect(m.messageId).toBe('in-msg-1');
    expect(m.direction).toBe('inbound');
    expect(m.fromNumber).toBe('+15551110000');
    expect(m.toNumber).toBe('+15552220000');
    expect(m.body).toBe('hello back');
    expect(m.tags).toEqual(['incoming']);
  });
});

// ---------------------------------------------------------------------------
// State progression — full pipeline
// ---------------------------------------------------------------------------

describe('Messaging — state progression', () => {
  it('test_full_message_state_progression', async () => {
    const msg = await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      body: 'full pipeline',
    });

    // Push intermediate "sent".
    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'messaging.state',
        params: {
          message_id: msg.messageId,
          message_state: 'sent',
        },
      },
    });
    for (let i = 0; i < 100; i++) {
      if (msg.state === 'sent') break;
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(msg.state).toBe('sent');

    // Then "delivered".
    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'messaging.state',
        params: {
          message_id: msg.messageId,
          message_state: 'delivered',
        },
      },
    });
    await msg.wait(5);
    expect(msg.state).toBe('delivered');
  });
});
