/**
 * Real-mock-backed tests for SDK event dispatch / routing.
 *
 * Translated 1:1 from
 *   signalwire-python/tests/unit/relay/test_event_dispatch_mock.py
 *
 * Focus: edge cases in the SDK's recv loop and event router that don't fit
 * neatly into per-action / per-call test files.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { RelayClient } from '../../src/relay/RelayClient.js';
import { Call } from '../../src/relay/Call.js';
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
// Helpers
// ---------------------------------------------------------------------------

async function answeredCall(callId = 'evt-call-1'): Promise<Call> {
  const captured: { call?: Call } = {};
  const handlerDone = new Promise<void>((resolve) => {
    client.onCall(async (call) => {
      captured.call = call;
      await call.answer();
      resolve();
    });
  });
  await mock.inboundCall({ call_id: callId, auto_states: ['created'] });
  await Promise.race([
    handlerDone,
    new Promise((_, reject) => setTimeout(() => reject(new Error('handler timeout')), 5000)),
  ]);
  const call = captured.call!;
  call.state = 'answered';
  return call;
}

function bareEventFrame(eventType: string, params: Record<string, any>): Record<string, any> {
  return {
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'signalwire.event',
    params: { event_type: eventType, params },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000, stepMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

// ---------------------------------------------------------------------------
// Sub-command journaling
// ---------------------------------------------------------------------------

describe('Event dispatch — sub-command journaling', () => {
  it('test_record_pause_journals_record_pause', async () => {
    const call = await answeredCall('ec-rec-pa');
    const action = await call.record({ format: 'wav' }, { controlId: 'ec-rec-pa-1' });
    await action.pause('continuous');
    const pauses = await mock.journalRecv('calling.record.pause');
    expect(pauses.length).toBeGreaterThan(0);
    const p = pauses[pauses.length - 1]!.frame.params;
    expect(p.control_id).toBe('ec-rec-pa-1');
    expect(p.behavior).toBe('continuous');
  });

  it('test_record_resume_journals_record_resume', async () => {
    const call = await answeredCall('ec-rec-re');
    const action = await call.record({ format: 'wav' }, { controlId: 'ec-rec-re-1' });
    await action.resume();
    const resumes = await mock.journalRecv('calling.record.resume');
    expect(resumes.length).toBeGreaterThan(0);
    expect(resumes[resumes.length - 1]!.frame.params.control_id).toBe('ec-rec-re-1');
  });

  it('test_collect_start_input_timers_journals_correctly', async () => {
    const call = await answeredCall('ec-col-sit');
    const action = await call.collect({
      digits: { max: 4 },
      startInputTimers: false,
      controlId: 'ec-col-sit-1',
    });
    await action.startInputTimers();
    const starts = await mock.journalRecv('calling.collect.start_input_timers');
    expect(starts.length).toBeGreaterThan(0);
    expect(starts[starts.length - 1]!.frame.params.control_id).toBe('ec-col-sit-1');
  });

  it('test_play_volume_carries_negative_value', async () => {
    const call = await answeredCall('ec-pvol');
    const action = await call.play(
      [{ type: 'silence', params: { duration: 60 } }],
      { controlId: 'ec-pvol-1' },
    );
    await action.volume(-5.5);
    const vol = await mock.journalRecv('calling.play.volume');
    expect(vol.length).toBeGreaterThan(0);
    expect(vol[vol.length - 1]!.frame.params.volume).toBe(-5.5);
  });
});

// ---------------------------------------------------------------------------
// Unknown event types — recv loop survives
// ---------------------------------------------------------------------------

describe('Event dispatch — unknown / malformed events', () => {
  it('test_unknown_event_type_does_not_crash', async () => {
    await mock.push(bareEventFrame('nonsense.unknown', { foo: 'bar' }));
    await new Promise((r) => setTimeout(r, 100));
    expect((client as any)._connected).toBe(true);
  });

  it('test_event_with_bad_call_id_is_dropped', async () => {
    await mock.push(bareEventFrame('calling.call.play', {
      call_id: 'no-such-call-bogus',
      control_id: 'stranger',
      state: 'playing',
    }));
    await new Promise((r) => setTimeout(r, 100));
    expect((client as any)._connected).toBe(true);
  });

  it('test_event_with_empty_event_type_is_dropped', async () => {
    await mock.push(bareEventFrame('', { call_id: 'x' }));
    await new Promise((r) => setTimeout(r, 100));
    expect((client as any)._connected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Multi-action concurrency: 3 actions on one call
// ---------------------------------------------------------------------------

describe('Event dispatch — multi-action concurrency', () => {
  it('test_three_concurrent_actions_resolve_independently', async () => {
    const call = await answeredCall('ec-3acts');
    const play1 = await call.play(
      [{ type: 'silence', params: { duration: 60 } }],
      { controlId: '3a-p1' },
    );
    const play2 = await call.play(
      [{ type: 'silence', params: { duration: 60 } }],
      { controlId: '3a-p2' },
    );
    const rec = await call.record({ format: 'wav' }, { controlId: '3a-r1' });

    // Fire only play1's finished.
    await mock.push(bareEventFrame('calling.call.play', {
      call_id: 'ec-3acts', control_id: '3a-p1', state: 'finished',
    }));
    await play1.wait(2);
    expect(play1.isDone).toBe(true);
    expect(play2.isDone).toBe(false);
    expect(rec.isDone).toBe(false);

    // Fire play2's.
    await mock.push(bareEventFrame('calling.call.play', {
      call_id: 'ec-3acts', control_id: '3a-p2', state: 'finished',
    }));
    await play2.wait(2);
    expect(play2.isDone).toBe(true);
    expect(rec.isDone).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Event ACK round-trip — server-pushed events get ack frames back
// ---------------------------------------------------------------------------

describe('Event dispatch — event ACK', () => {
  it('test_event_ack_sent_back_to_server', async () => {
    const evtId = 'evt-ack-test-1';
    await mock.push({
      jsonrpc: '2.0',
      id: evtId,
      method: 'signalwire.event',
      params: {
        event_type: 'calling.call.play',
        params: { call_id: 'anything', control_id: 'x', state: 'playing' },
      },
    });
    await new Promise((r) => setTimeout(r, 200));

    const j = await mock.journal();
    const acks = j.filter((e) =>
      e.direction === 'recv'
      && e.frame.id === evtId
      && 'result' in e.frame,
    );
    expect(acks.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Tag-based dial routing — call.call_id nested
// ---------------------------------------------------------------------------

describe('Event dispatch — tag-based dial routing', () => {
  it('test_dial_event_routes_via_tag_when_no_top_level_call_id', async () => {
    // Build our own client so we can disconnect cleanly.
    await client.disconnect();
    client = new RelayClient({
      project: 'p',
      token: 't',
      host: mock.relayHost,
      scheme: 'ws',
      contexts: ['default'],
    });
    await client.connect();

    await mock.armDial({
      tag: 'ec-tag-route',
      winner_call_id: 'WINTAG',
      states: ['created', 'answered'],
      node_id: 'n',
      device: { type: 'phone', params: {} },
    });
    const call = await client.dial(
      [[{ type: 'phone', params: { to_number: '+1', from_number: '+2' } }]],
      { tag: 'ec-tag-route', dialTimeout: 5.0 },
    );
    expect(call.callId).toBe('WINTAG');

    // Verify the dial event the mock pushed had no top-level call_id —
    // only call.call_id nested.
    const sends = await mock.journalSend('calling.call.dial');
    expect(sends.length).toBeGreaterThan(0);
    const inner = sends[sends.length - 1]!.frame.params.params;
    expect('call_id' in inner).toBe(false);
    expect(inner.call.call_id).toBe('WINTAG');
  });
});

// ---------------------------------------------------------------------------
// Server ping handling
// ---------------------------------------------------------------------------

describe('Event dispatch — server ping', () => {
  it('test_server_ping_acked_by_sdk', async () => {
    const pingId = 'ping-test-1';
    await mock.push({
      jsonrpc: '2.0',
      id: pingId,
      method: 'signalwire.ping',
      params: {},
    });
    await new Promise((r) => setTimeout(r, 200));

    const j = await mock.journal();
    const pongs = j.filter((e) =>
      e.direction === 'recv'
      && e.frame.id === pingId
      && 'result' in e.frame,
    );
    expect(pongs.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Authorization state — captured for reconnect
// ---------------------------------------------------------------------------

describe('Event dispatch — authorization state', () => {
  it('test_authorization_state_event_captured', async () => {
    await mock.push(bareEventFrame(
      'signalwire.authorization.state',
      { authorization_state: 'test-auth-state-blob' },
    ));
    await waitFor(() => (client as any)._authorizationState === 'test-auth-state-blob', 2000);
    expect((client as any)._authorizationState).toBe('test-auth-state-blob');
  });
});

// ---------------------------------------------------------------------------
// Calling.error event — does not raise into the SDK
// ---------------------------------------------------------------------------

describe('Event dispatch — calling.error', () => {
  it('test_calling_error_event_does_not_crash', async () => {
    await mock.push(bareEventFrame('calling.error', { code: '5001', message: 'synthetic error' }));
    await new Promise((r) => setTimeout(r, 100));
    expect((client as any)._connected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// State event for an answered call updates Call.state
// ---------------------------------------------------------------------------

describe('Event dispatch — state events', () => {
  it('test_call_state_event_updates_state', async () => {
    const call = await answeredCall('ec-stt');
    await mock.push(bareEventFrame('calling.call.state', {
      call_id: 'ec-stt', call_state: 'ending', direction: 'inbound',
    }));
    await waitFor(() => call.state === 'ending', 2000);
    expect(call.state).toBe('ending');
  });

  it('test_call_listener_fires_on_event', async () => {
    const call = await answeredCall('ec-list');
    const seen: any[] = [];
    const fired = new Promise<void>((resolve) => {
      call.on('calling.call.play', (event) => {
        seen.push(event);
        resolve();
      });
    });
    await mock.push(bareEventFrame('calling.call.play', {
      call_id: 'ec-list', control_id: 'x', state: 'playing',
    }));
    await Promise.race([
      fired,
      new Promise((_, reject) => setTimeout(() => reject(new Error('listener timeout')), 2000)),
    ]);
    expect(seen[0].eventType).toBe('calling.call.play');
  });
});
