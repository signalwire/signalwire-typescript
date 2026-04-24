/**
 * Wire-shape guard tests.
 *
 * Ensure that `calling.play`, `calling.play_and_collect`, `calling.connect`,
 * `calling.refer`, `calling.tap`, and `calling.dial` serialize their play
 * items and device descriptors into the nested `params: {...}` wire form
 * that the RELAY platform requires.
 *
 * Regressing these will produce `-32602 Invalid parameters` against the
 * live server — same failure mode that prompted this guard to exist.
 */

import { describe, expect, it } from 'vitest';
import { Call, type RelayClientLike } from '../../src/relay/Call.js';
import {
  normalizeDevice,
  normalizeDevicePlan,
  normalizePlayItem,
  normalizePlayItems,
} from '../../src/relay/normalize.js';

function captureClient(): {
  client: RelayClientLike;
  last: () => { method: string; params: Record<string, unknown> } | null;
} {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  return {
    client: {
      async execute(method, params) {
        calls.push({ method, params });
        return {};
      },
    },
    last: () => calls.at(-1) ?? null,
  };
}

function makeCall(client: RelayClientLike): Call {
  return new Call(client, 'c1', 'n1', 'p1', 'default', { state: 'answered' });
}

describe('normalize helpers', () => {
  it('nests flat play items under params', () => {
    expect(normalizePlayItem({ type: 'tts', text: 'hi', language: 'en-US' })).toEqual({
      type: 'tts',
      params: { text: 'hi', language: 'en-US' },
    });
    expect(normalizePlayItem({ type: 'audio', url: 'https://x' })).toEqual({
      type: 'audio',
      params: { url: 'https://x' },
    });
    expect(normalizePlayItem({ type: 'silence', duration: 2 })).toEqual({
      type: 'silence',
      params: { duration: 2 },
    });
  });

  it('passes through already-nested play items', () => {
    const nested = { type: 'tts', params: { text: 'hi' } };
    expect(normalizePlayItem(nested)).toBe(nested);
  });

  it('renames phone to/from to to_number/from_number', () => {
    expect(normalizeDevice({ type: 'phone', to: '+1', from: '+2' })).toEqual({
      type: 'phone',
      params: { to_number: '+1', from_number: '+2' },
    });
  });

  it('leaves sip to/from alone (URIs, not numbers)', () => {
    expect(normalizeDevice({ type: 'sip', to: 'sip:a@x', from: 'sip:b@x' })).toEqual({
      type: 'sip',
      params: { to: 'sip:a@x', from: 'sip:b@x' },
    });
  });

  it('passes through already-nested device descriptors', () => {
    const nested = { type: 'phone', params: { to_number: '+1', from_number: '+2' } };
    expect(normalizeDevice(nested)).toBe(nested);
  });

  it('normalizes 2D dial plan', () => {
    expect(
      normalizeDevicePlan([[{ type: 'phone', to: '+1', from: '+2' }]]),
    ).toEqual([[{ type: 'phone', params: { to_number: '+1', from_number: '+2' } }]]);
  });

  it('normalizePlayItems maps across an array', () => {
    expect(
      normalizePlayItems([
        { type: 'tts', text: 'a' },
        { type: 'silence', duration: 1 },
      ]),
    ).toEqual([
      { type: 'tts', params: { text: 'a' } },
      { type: 'silence', params: { duration: 1 } },
    ]);
  });
});

describe('Call methods emit nested wire shape', () => {
  it('play() nests tts text under params', async () => {
    const { client, last } = captureClient();
    await makeCall(client).play([{ type: 'tts', text: 'hello' }]);
    const sent = last()!;
    expect(sent.method).toBe('calling.play');
    expect(sent.params.play).toEqual([{ type: 'tts', params: { text: 'hello' } }]);
  });

  it('playAndCollect() nests play items', async () => {
    const { client, last } = captureClient();
    await makeCall(client).playAndCollect(
      [{ type: 'tts', text: 'PIN?' }],
      { digits: { max: 4 } },
    );
    const sent = last()!;
    expect(sent.method).toBe('calling.play_and_collect');
    expect(sent.params.play).toEqual([{ type: 'tts', params: { text: 'PIN?' } }]);
  });

  it('connect() normalizes devices and ringback', async () => {
    const { client, last } = captureClient();
    await makeCall(client).connect(
      [[{ type: 'phone', to: '+1', from: '+2' }]],
      { ringback: [{ type: 'ringtone', name: 'us' }] },
    );
    const sent = last()!;
    expect(sent.method).toBe('calling.connect');
    expect(sent.params.devices).toEqual([
      [{ type: 'phone', params: { to_number: '+1', from_number: '+2' } }],
    ]);
    expect(sent.params.ringback).toEqual([
      { type: 'ringtone', params: { name: 'us' } },
    ]);
  });

  it('refer() normalizes the device', async () => {
    const { client, last } = captureClient();
    await makeCall(client).refer({ type: 'sip', to: 'sip:a@x' });
    const sent = last()!;
    expect(sent.method).toBe('calling.refer');
    expect(sent.params.device).toEqual({
      type: 'sip',
      params: { to: 'sip:a@x' },
    });
  });

  it('tap() normalizes the destination device', async () => {
    const { client, last } = captureClient();
    await makeCall(client).tap(
      { type: 'audio', direction: 'listen' },
      { type: 'stream', url: 'wss://x' },
    );
    const sent = last()!;
    expect(sent.method).toBe('calling.tap');
    expect(sent.params.device).toEqual({
      type: 'stream',
      params: { url: 'wss://x' },
    });
  });
});
