import { describe, it, expect, vi } from 'vitest';
import { Message } from '../../src/relay/Message.js';
import { RelayEvent } from '../../src/relay/RelayEvent.js';

describe('Message', () => {
  it('initializes with defaults', () => {
    const msg = new Message();
    expect(msg.messageId).toBe('');
    expect(msg.state).toBe('');
    expect(msg.isDone).toBe(false);
    expect(msg.result).toBeNull();
  });

  it('initializes with options', () => {
    const msg = new Message({
      messageId: 'm1',
      direction: 'outbound',
      fromNumber: '+111',
      toNumber: '+222',
      body: 'Hello',
      state: 'queued',
    });
    expect(msg.messageId).toBe('m1');
    expect(msg.fromNumber).toBe('+111');
    expect(msg.body).toBe('Hello');
    expect(msg.state).toBe('queued');
  });

  it('dispatches state events and updates state', async () => {
    const msg = new Message({ messageId: 'm1', state: 'queued' });
    const events: string[] = [];
    msg.on(async (e) => { events.push((e.params.message_state as string) || ''); });

    await msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'initiated' },
    });
    expect(msg.state).toBe('initiated');
    expect(msg.isDone).toBe(false);

    await msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'sent' },
    });
    expect(msg.state).toBe('sent');
    expect(msg.isDone).toBe(false);

    expect(events).toEqual(['initiated', 'sent']);
  });

  it('resolves on terminal state (delivered)', async () => {
    const msg = new Message({ messageId: 'm1', state: 'queued' });

    const waitPromise = msg.wait();

    await msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'delivered' },
    });

    const event = await waitPromise;
    expect(msg.isDone).toBe(true);
    expect(msg.state).toBe('delivered');
    expect(msg.result).not.toBeNull();
    expect(event).toBeInstanceOf(RelayEvent);
  });

  it('resolves on terminal state (failed)', async () => {
    const msg = new Message({ messageId: 'm1', state: 'queued' });

    await msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'failed', reason: 'invalid number' },
    });

    expect(msg.isDone).toBe(true);
    expect(msg.state).toBe('failed');
    expect(msg.reason).toBe('invalid number');
  });

  it('resolves on terminal state (undelivered)', async () => {
    const msg = new Message({ messageId: 'm1' });

    await msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'undelivered' },
    });

    expect(msg.isDone).toBe(true);
    expect(msg.state).toBe('undelivered');
  });

  it('fires on_completed callback', async () => {
    const msg = new Message({ messageId: 'm1' });
    const cb = vi.fn();
    msg._onCompleted = cb;

    await msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'delivered' },
    });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(RelayEvent);
  });

  it('does not resolve twice', async () => {
    const msg = new Message({ messageId: 'm1' });
    const cb = vi.fn();
    msg._onCompleted = cb;

    await msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'delivered' },
    });
    await msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'delivered' },
    });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('handles listener errors gracefully', async () => {
    const msg = new Message({ messageId: 'm1' });
    msg.on(() => { throw new Error('handler crash'); });

    // Should not throw
    await msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'delivered' },
    });

    expect(msg.isDone).toBe(true);
  });

  it('wait with timeout resolves normally', async () => {
    const msg = new Message({ messageId: 'm1' });

    // Dispatch immediately
    const dispatchPromise = msg._dispatchEvent({
      event_type: 'messaging.state',
      params: { message_id: 'm1', message_state: 'delivered' },
    });
    await dispatchPromise;

    const event = await msg.wait(5);
    expect(event).toBeInstanceOf(RelayEvent);
  });

  it('wait with timeout rejects on timeout', async () => {
    const msg = new Message({ messageId: 'm1' });

    // timeout is in seconds (0.01s = 10ms)
    await expect(msg.wait(0.01)).rejects.toThrow('timed out');
  });

  it('toString returns human-readable string', () => {
    const msg = new Message({ messageId: 'm1', direction: 'outbound', state: 'sent', fromNumber: '+111', toNumber: '+222' });
    const s = msg.toString();
    expect(s).toContain('m1');
    expect(s).toContain('outbound');
  });
});
