/**
 * The exported option types must be the ones the methods take.
 *
 * `DialOptions` and `SendMessageOptions` are exported from the package root, so
 * user code that types its options with them must type-check when passed to
 * `RelayClient.dial()` / `RelayClient.sendMessage()`. The compile-time checks
 * run under `tsc --project tsconfig.test.json` (scripts/run-lint.sh); the
 * runtime checks confirm the fields reach the wire.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import { RelayClient } from '../../src/relay/RelayClient.js';
import type { DialOptions, SendMessageOptions } from '../../src/index.js';
import { MockWebSocket } from './helpers.js';

function createClient(): { client: RelayClient; ws: MockWebSocket } {
  const ws = new MockWebSocket();
  const client = new RelayClient({
    project: 'test-project',
    token: 'test-token',
    host: 'relay.test.com',
    contexts: ['default'],
  });
  client._wsFactory = () => {
    ws.autoAuthenticate();
    return ws as unknown as ReturnType<NonNullable<RelayClient['_wsFactory']>>;
  };
  return { client, ws };
}

describe('exported RELAY option types', () => {
  it('DialOptions is the type dial() takes', () => {
    expectTypeOf<NonNullable<Parameters<RelayClient['dial']>[1]>>().toEqualTypeOf<DialOptions>();
  });

  it('SendMessageOptions is the type sendMessage() takes', () => {
    expectTypeOf<Parameters<RelayClient['sendMessage']>[0]>().toEqualTypeOf<SendMessageOptions>();
  });

  it('a DialOptions value drives dial() on the wire', async () => {
    const { client, ws } = createClient();
    await client.connect();

    const opts: DialOptions = { tag: 'typed-tag', maxDuration: 30, dialTimeout: 0.05 };
    const dialed = client.dial(
      [[{ type: 'phone', params: { to_number: '+1', from_number: '+2' } }]],
      opts,
    );
    await new Promise((r) => setTimeout(r, 10));
    const req = ws.getAllSent().find((m) => m.method === 'calling.dial');
    ws.receiveMessage({ jsonrpc: '2.0', id: req!.id, result: { code: '200', message: 'Dialing' } });

    await expect(dialed).rejects.toThrow('Dial timed out');
    const params = req!.params as Record<string, unknown>;
    expect(params.tag).toBe('typed-tag');
    expect(params.max_duration).toBe(30);

    await client.disconnect();
  });

  it('a SendMessageOptions value with region and onCompleted drives sendMessage()', async () => {
    const { client, ws } = createClient();
    await client.connect();

    const completed: string[] = [];
    const opts: SendMessageOptions = {
      toNumber: '+222',
      fromNumber: '+111',
      body: 'Hi',
      region: 'us',
      onCompleted: (event) => {
        completed.push(event.params.message_state as string);
      },
    };
    const sent = client.sendMessage(opts);
    await new Promise((r) => setTimeout(r, 10));
    const req = ws.getAllSent().find((m) => m.method === 'messaging.send');
    expect((req!.params as Record<string, unknown>).region).toBe('us');
    ws.receiveMessage({
      jsonrpc: '2.0',
      id: req!.id,
      result: { code: '200', message_id: 'm-typed' },
    });
    await sent;

    ws.receiveMessage({
      jsonrpc: '2.0',
      id: 'st-typed',
      method: 'signalwire.event',
      params: {
        event_type: 'messaging.state',
        params: { message_id: 'm-typed', message_state: 'delivered' },
      },
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(completed).toEqual(['delivered']);

    await client.disconnect();
  });
});
