/**
 * Real-mock-backed tests for outbound calls (`RelayClient.dial`).
 *
 * Translated 1:1 from
 *   signalwire-python/tests/unit/relay/test_outbound_call_mock.py
 *
 * The dial flow is the most fragile RELAY surface: `calling.dial` returns
 * a plain 200 with NO call_id; the actual call info arrives via subsequent
 * `calling.call.state` (per leg) and `calling.call.dial` (with the winner)
 * events keyed by `tag`. These tests run the real SDK against the mock so
 * the wire shape AND the SDK's tag-based reassembly are both validated.
 *
 * The mock's `/__mock__/scenarios/dial` endpoint scripts the entire dance
 * (winner state events + per-loser state events + final dial event with
 * `dial_winner: true`).
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

function phoneDevice(to = '+15551112222', frm = '+15553334444') {
  return { type: 'phone', params: { to_number: to, from_number: frm } };
}

// ---------------------------------------------------------------------------
// Happy-path dial
// ---------------------------------------------------------------------------

describe('Dial — happy path', () => {
  it('test_dial_resolves_to_call_with_winner_id', async () => {
    await mock.armDial({
      tag: 't-happy',
      winner_call_id: 'winner-1',
      states: ['created', 'ringing', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
      delay_ms: 1,
    });
    const call = await client.dial(
      [[phoneDevice()]],
      { tag: 't-happy', dialTimeout: 5.0 },
    );
    expect(call).toBeInstanceOf(Call);
    expect(call.callId).toBe('winner-1');
    expect(call.tag).toBe('t-happy');
    expect(call.state).toBe('answered');
    expect(call.direction).toBe('outbound');
  });

  it('test_dial_journal_records_calling_dial_frame', async () => {
    await mock.armDial({
      tag: 't-frame',
      winner_call_id: 'winner-frame',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
    });
    await client.dial(
      [[phoneDevice()]],
      { tag: 't-frame', dialTimeout: 5.0 },
    );
    const [entry] = await mock.journalRecv('calling.dial');
    const p = entry!.frame.params;
    expect(p.tag).toBe('t-frame');
    expect(Array.isArray(p.devices)).toBe(true);
    expect(p.devices[0][0].type).toBe('phone');
  });

  it('test_dial_with_max_duration_in_frame', async () => {
    await mock.armDial({
      tag: 't-md',
      winner_call_id: 'winner-md',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
    });
    await client.dial(
      [[phoneDevice()]],
      { tag: 't-md', maxDuration: 300, dialTimeout: 5.0 },
    );
    const [entry] = await mock.journalRecv('calling.dial');
    expect(entry!.frame.params.max_duration).toBe(300);
  });

  it('test_dial_auto_generates_uuid_tag_when_omitted', async () => {
    // Tag is auto-generated; we don't know it upfront, so push the answer
    // event after observing it in the journal.
    const seenTag: { v?: string } = {};
    const pusher = (async () => {
      for (let i = 0; i < 200; i++) {
        const entries = await mock.journalRecv('calling.dial');
        if (entries.length > 0) {
          seenTag.v = entries[entries.length - 1]!.frame.params.tag as string;
          break;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      if (!seenTag.v) return;
      await mock.push({
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'signalwire.event',
        params: {
          event_type: 'calling.call.dial',
          params: {
            tag: seenTag.v,
            node_id: 'node-mock-1',
            dial_state: 'answered',
            call: {
              call_id: 'auto-tag-winner',
              node_id: 'node-mock-1',
              tag: seenTag.v,
              device: phoneDevice(),
              dial_winner: true,
            },
          },
        },
      });
    })();
    let call: Call;
    try {
      call = await client.dial([[phoneDevice()]], { dialTimeout: 5.0 });
    } finally {
      await pusher;
    }
    expect(call!.callId).toBe('auto-tag-winner');
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(uuidRe.test(seenTag.v ?? '')).toBe(true);
    expect(call!.tag).toBe(seenTag.v);
  });
});

// ---------------------------------------------------------------------------
// Failure paths
// ---------------------------------------------------------------------------

describe('Dial — failure paths', () => {
  it('test_dial_failed_raises_relay_error', async () => {
    const pusher = (async () => {
      for (let i = 0; i < 200; i++) {
        if ((await mock.journalRecv('calling.dial')).length > 0) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      await mock.push({
        jsonrpc: '2.0',
        id: randomUUID(),
        method: 'signalwire.event',
        params: {
          event_type: 'calling.call.dial',
          params: {
            tag: 't-fail',
            node_id: 'node-mock-1',
            dial_state: 'failed',
            call: {},
          },
        },
      });
    })();
    try {
      await expect(
        client.dial([[phoneDevice()]], { tag: 't-fail', dialTimeout: 5.0 }),
      ).rejects.toThrow(/Dial failed/);
    } finally {
      await pusher;
    }
  });

  it('test_dial_timeout_when_no_dial_event', async () => {
    await expect(
      client.dial([[phoneDevice()]], { tag: 't-timeout', dialTimeout: 0.5 }),
    ).rejects.toThrow(/timed out/);
  });
});

// ---------------------------------------------------------------------------
// Parallel dial — winner + losers
// ---------------------------------------------------------------------------

describe('Dial — winner / losers', () => {
  it('test_dial_winner_carries_dial_winner_true', async () => {
    await mock.armDial({
      tag: 't-winner',
      winner_call_id: 'WIN-ID',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
      losers: [
        { call_id: 'LOSE-A', states: ['created', 'ended'] },
        { call_id: 'LOSE-B', states: ['created', 'ended'] },
      ],
    });
    const call = await client.dial(
      [[phoneDevice()]],
      { tag: 't-winner', dialTimeout: 5.0 },
    );
    expect(call.callId).toBe('WIN-ID');

    const sends = await mock.journalSend('calling.call.dial');
    expect(sends.length).toBeGreaterThan(0);
    const finals = sends.filter((e) => e.frame.params?.params?.dial_state === 'answered');
    expect(finals.length).toBe(1);
    const inner = finals[0]!.frame.params.params;
    expect(inner.call.dial_winner).toBe(true);
    expect(inner.call.call_id).toBe('WIN-ID');
  });

  it('test_dial_losers_get_state_events', async () => {
    await mock.armDial({
      tag: 't-losers',
      winner_call_id: 'WIN-2',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
      losers: [{ call_id: 'L1', states: ['created', 'ended'] }],
    });
    await client.dial(
      [[phoneDevice()]],
      { tag: 't-losers', dialTimeout: 5.0 },
    );
    const stateEvents = await mock.journalSend('calling.call.state');
    const loserStates = stateEvents
      .filter((e) => e.frame.params.params?.call_id === 'L1')
      .map((e) => e.frame.params.params);
    expect(loserStates.some((s: any) => s.call_state === 'ended')).toBe(true);
  });

  it('test_dial_losers_cleaned_up_from_calls_dict', async () => {
    await mock.armDial({
      tag: 't-cleanup',
      winner_call_id: 'WIN-CL',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
      losers: [{ call_id: 'LOSE-CL', states: ['created', 'ended'] }],
    });
    const call = await client.dial(
      [[phoneDevice()]],
      { tag: 't-cleanup', dialTimeout: 5.0 },
    );
    await new Promise((r) => setTimeout(r, 200));
    const calls = (client as any)._calls as Map<string, Call>;
    expect(calls.has('LOSE-CL')).toBe(false);
    expect(calls.has(call.callId)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Devices shape on the wire
// ---------------------------------------------------------------------------

describe('Dial — devices shape', () => {
  it('test_dial_devices_serial_two_legs_on_wire', async () => {
    await mock.armDial({
      tag: 't-serial',
      winner_call_id: 'WIN-SER',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
    });
    const devs = [
      [
        phoneDevice('+15551110001'),
        phoneDevice('+15551110002'),
      ],
    ];
    await client.dial(devs, { tag: 't-serial', dialTimeout: 5.0 });
    const [entry] = await mock.journalRecv('calling.dial');
    const params = entry!.frame.params;
    expect(params.devices.length).toBe(1);
    expect(params.devices[0].length).toBe(2);
    expect(params.devices[0][0].params.to_number).toBe('+15551110001');
  });

  it('test_dial_devices_parallel_two_legs_on_wire', async () => {
    await mock.armDial({
      tag: 't-par',
      winner_call_id: 'WIN-PAR',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
    });
    const devs = [
      [phoneDevice('+15551110001')],
      [phoneDevice('+15551110002')],
    ];
    await client.dial(devs, { tag: 't-par', dialTimeout: 5.0 });
    const [entry] = await mock.journalRecv('calling.dial');
    expect(entry!.frame.params.devices.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// State transitions during dial
// ---------------------------------------------------------------------------

describe('Dial — state progression', () => {
  it('test_dial_records_call_state_progression_on_winner', async () => {
    await mock.armDial({
      tag: 't-prog',
      winner_call_id: 'WIN-PROG',
      states: ['created', 'ringing', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
    });
    const call = await client.dial(
      [[phoneDevice()]],
      { tag: 't-prog', dialTimeout: 5.0 },
    );
    const stateEvents = await mock.journalSend('calling.call.state');
    const winnerStates = stateEvents
      .filter((e) => e.frame.params.params?.call_id === 'WIN-PROG')
      .map((e) => e.frame.params.params.call_state);
    expect(winnerStates).toContain('created');
    expect(winnerStates).toContain('ringing');
    expect(winnerStates).toContain('answered');
    expect(call.state).toBe('answered');
  });
});

// ---------------------------------------------------------------------------
// After dial — call object is usable
// ---------------------------------------------------------------------------

describe('Dial — usable call after answer', () => {
  it('test_dialed_call_can_send_subsequent_command', async () => {
    await mock.armDial({
      tag: 't-after',
      winner_call_id: 'WIN-AFTER',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
    });
    const call = await client.dial(
      [[phoneDevice()]],
      { tag: 't-after', dialTimeout: 5.0 },
    );
    await call.hangup();
    const ends = await mock.journalRecv('calling.end');
    expect(ends.length).toBeGreaterThan(0);
    expect(ends[ends.length - 1]!.frame.params.call_id).toBe('WIN-AFTER');
  });

  it('test_dialed_call_can_play', async () => {
    await mock.armDial({
      tag: 't-play',
      winner_call_id: 'WIN-PLAY',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
    });
    const call = await client.dial(
      [[phoneDevice()]],
      { tag: 't-play', dialTimeout: 5.0 },
    );
    await call.play([{ type: 'tts', params: { text: 'hi' } }]);
    const plays = await mock.journalRecv('calling.play');
    expect(plays.length).toBeGreaterThan(0);
    const p = plays[plays.length - 1]!.frame.params;
    expect(p.call_id).toBe('WIN-PLAY');
    expect(p.play[0].type).toBe('tts');
  });
});

// ---------------------------------------------------------------------------
// Tag preservation
// ---------------------------------------------------------------------------

describe('Dial — tag preservation', () => {
  it('test_dial_preserves_explicit_tag', async () => {
    await mock.armDial({
      tag: 'my-very-explicit-tag-99',
      winner_call_id: 'WIN-T',
      states: ['created', 'answered'],
      node_id: 'node-mock-1',
      device: phoneDevice(),
    });
    const call = await client.dial(
      [[phoneDevice()]],
      { tag: 'my-very-explicit-tag-99', dialTimeout: 5.0 },
    );
    expect(call.tag).toBe('my-very-explicit-tag-99');
  });
});

// ---------------------------------------------------------------------------
// JSON-RPC envelope
// ---------------------------------------------------------------------------

describe('Dial — JSON-RPC envelope', () => {
  it('test_dial_uses_jsonrpc_2_0', async () => {
    await mock.armDial({
      tag: 't-rpc',
      winner_call_id: 'W',
      states: ['created', 'answered'],
      node_id: 'n',
      device: phoneDevice(),
    });
    await client.dial([[phoneDevice()]], { tag: 't-rpc', dialTimeout: 5.0 });
    const [entry] = await mock.journalRecv('calling.dial');
    expect(entry!.frame.jsonrpc).toBe('2.0');
    expect(entry!.frame.method).toBe('calling.dial');
    expect(entry!.frame.id).toBeDefined();
    expect(entry!.frame.params).toBeDefined();
  });
});
