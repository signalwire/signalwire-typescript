/**
 * Real-mock-backed tests for inbound calls (server-initiated).
 *
 * Translated 1:1 from
 *   signalwire-python/tests/unit/relay/test_inbound_call_mock.py
 *
 * The mock's `POST /__mock__/inbound_call` endpoint pushes a
 * `calling.call.receive` frame to the SDK — exactly what the production
 * RELAY server emits when a phone call arrives in a context the SDK
 * subscribed to.
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

function statePushFrame(
  callId: string,
  callState: string,
  opts: { tag?: string; direction?: string } = {},
): Record<string, any> {
  return {
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'signalwire.event',
    params: {
      event_type: 'calling.call.state',
      params: {
        call_id: callId,
        node_id: 'mock-relay-node-1',
        tag: opts.tag ?? '',
        call_state: callState,
        direction: opts.direction ?? 'inbound',
        device: {
          type: 'phone',
          params: {
            from_number: '+15551110000',
            to_number: '+15552220000',
          },
        },
      },
    },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000, stepMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  throw new Error('waitFor: predicate never became true');
}

// ---------------------------------------------------------------------------
// Basic inbound-call handler dispatch
// ---------------------------------------------------------------------------

describe('Inbound call — handler dispatch', () => {
  it('test_on_call_handler_fires_with_call_object', async () => {
    const seen: Call[] = [];
    const handlerDone = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        seen.push(call);
        resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-handler', from_number: '+15551110000', to_number: '+15552220000' });
    await Promise.race([
      handlerDone,
      new Promise((_, reject) => setTimeout(() => reject(new Error('handler not called')), 5000)),
    ]);
    expect(seen.length).toBe(1);
    expect(seen[0]).toBeInstanceOf(Call);
    expect(seen[0]!.callId).toBe('c-handler');
  });

  it('test_inbound_call_object_has_correct_call_id_and_direction', async () => {
    const seen: { callId?: string; direction?: string } = {};
    const done = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        seen.callId = call.callId;
        seen.direction = call.direction;
        resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-dir' });
    await Promise.race([
      done,
      new Promise((_, reject) => setTimeout(() => reject(new Error('handler timed out')), 5000)),
    ]);
    expect(seen.callId).toBe('c-dir');
    expect(seen.direction).toBe('inbound');
  });

  it('test_inbound_call_carries_from_to_in_device', async () => {
    const seen: { device?: any } = {};
    const done = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        seen.device = call.device;
        resolve();
      });
    });
    await mock.inboundCall({
      call_id: 'c-from-to',
      from_number: '+15551112233',
      to_number: '+15554445566',
    });
    await Promise.race([
      done,
      new Promise((_, reject) => setTimeout(() => reject(new Error('handler timed out')), 5000)),
    ]);
    const params = (seen.device?.params ?? {}) as Record<string, any>;
    expect(params.from_number).toBe('+15551112233');
    expect(params.to_number).toBe('+15554445566');
  });

  it('test_inbound_call_initial_state_is_created', async () => {
    const seen: { state?: string } = {};
    const done = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        seen.state = call.state;
        resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-state' });
    await Promise.race([
      done,
      new Promise((_, reject) => setTimeout(() => reject(new Error('handler timed out')), 5000)),
    ]);
    expect(seen.state).toBe('created');
  });
});

// ---------------------------------------------------------------------------
// Handler answers — calling.answer journaled
// ---------------------------------------------------------------------------

describe('Inbound call — answer / hangup / pass', () => {
  it('test_answer_in_handler_journals_calling_answer', async () => {
    const answeredP = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        await call.answer();
        resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-ans' });
    await answeredP;
    // Allow round-trip to land.
    await new Promise((r) => setTimeout(r, 100));
    const answers = await mock.journalRecv('calling.answer');
    expect(answers.length).toBeGreaterThan(0);
    expect(answers[answers.length - 1]!.frame.params.call_id).toBe('c-ans');
  });

  it('test_answer_then_state_event_advances_call_state', async () => {
    const captured: { call?: Call } = {};
    const handlerReturned = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        captured.call = call;
        await call.answer();
        resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-ans-state' });
    await handlerReturned;

    await mock.push(statePushFrame('c-ans-state', 'answered'));
    await waitFor(() => captured.call?.state === 'answered', 3000);
    expect(captured.call!.state).toBe('answered');
  });

  it('test_hangup_in_handler_journals_calling_end', async () => {
    const hungP = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        await call.hangup('busy');
        resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-hangup' });
    await hungP;
    await new Promise((r) => setTimeout(r, 100));

    const ends = await mock.journalRecv('calling.end');
    expect(ends.length).toBeGreaterThan(0);
    const p = ends[ends.length - 1]!.frame.params;
    expect(p.call_id).toBe('c-hangup');
    expect(p.reason).toBe('busy');
  });

  it('test_pass_in_handler_journals_calling_pass', async () => {
    const passedP = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        await call.pass();
        resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-pass' });
    await passedP;
    await new Promise((r) => setTimeout(r, 100));

    const passes = await mock.journalRecv('calling.pass');
    expect(passes.length).toBeGreaterThan(0);
    expect(passes[passes.length - 1]!.frame.params.call_id).toBe('c-pass');
  });
});

// ---------------------------------------------------------------------------
// Multiple inbound calls — independent state
// ---------------------------------------------------------------------------

describe('Inbound call — multiple calls', () => {
  it('test_multiple_inbound_calls_in_sequence_each_unique_object', async () => {
    const seen: Call[] = [];
    const both = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        seen.push(call);
        if (seen.length === 2) resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-seq-1' });
    await new Promise((r) => setTimeout(r, 100));
    await mock.inboundCall({ call_id: 'c-seq-2' });
    await both;
    expect(seen[0]!.callId).toBe('c-seq-1');
    expect(seen[1]!.callId).toBe('c-seq-2');
    expect(seen[0]).not.toBe(seen[1]);
  });

  it('test_multiple_inbound_calls_no_state_bleed', async () => {
    const callsById: Record<string, Call> = {};
    const both = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        callsById[call.callId] = call;
        await call.answer();
        if (Object.keys(callsById).length === 2) resolve();
      });
    });
    await mock.inboundCall({ call_id: 'cb-1' });
    await new Promise((r) => setTimeout(r, 50));
    await mock.inboundCall({ call_id: 'cb-2' });
    await both;

    await mock.push(statePushFrame('cb-1', 'answered'));
    await waitFor(() => callsById['cb-1']?.state === 'answered', 3000);
    expect(callsById['cb-1']!.state).toBe('answered');
    expect(callsById['cb-2']!.state).not.toBe('answered');
  });
});

// ---------------------------------------------------------------------------
// Scripted state sequences
// ---------------------------------------------------------------------------

describe('Inbound call — scripted state sequences', () => {
  it('test_scripted_state_sequence_advances_call', async () => {
    const captured: { call?: Call } = {};
    const handlerDone = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        captured.call = call;
        await call.answer();
        resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-scripted' });
    await handlerDone;

    await mock.push(statePushFrame('c-scripted', 'answered'));
    await mock.push(statePushFrame('c-scripted', 'ended'));
    await waitFor(() => captured.call?.state === 'ended', 3000);
    expect(captured.call!.state).toBe('ended');
    // Ended calls are dropped from the registry.
    expect((client as any)._calls.has('c-scripted')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Handler patterns: async, sync, raise
// ---------------------------------------------------------------------------

describe('Inbound call — handler patterns', () => {
  it('test_async_handler_completes_normally', async () => {
    const seen: { callId?: string } = {};
    const fired = new Promise<void>((resolve) => {
      client.onCall(async (call) => {
        await new Promise((r) => setTimeout(r, 10));
        seen.callId = call.callId;
        resolve();
      });
    });
    await mock.inboundCall({ call_id: 'c-async' });
    await fired;
    expect(seen.callId).toBe('c-async');
  });

  it('test_handler_exception_does_not_crash_client', async () => {
    const fired = new Promise<void>((resolve) => {
      client.onCall(async (_call) => {
        resolve();
        throw new Error('intentional from handler');
      });
    });
    await mock.inboundCall({ call_id: 'c-raise' });
    await fired;
    await new Promise((r) => setTimeout(r, 100));
    expect((client as any)._connected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scenario_play — full inbound flow
// ---------------------------------------------------------------------------

describe('Inbound call — scenario_play', () => {
  it('test_scenario_play_full_inbound_flow', async () => {
    const captured: { call?: Call } = {};
    let handlerStarted = false;
    client.onCall(async (call) => {
      captured.call = call;
      handlerStarted = true;
      await call.answer();
    });

    const timeline = [
      {
        push: {
          frame: {
            jsonrpc: '2.0',
            id: randomUUID(),
            method: 'signalwire.event',
            params: {
              event_type: 'calling.call.receive',
              params: {
                call_id: 'c-scen',
                node_id: 'mock-relay-node-1',
                tag: '',
                call_state: 'created',
                direction: 'inbound',
                device: {
                  type: 'phone',
                  params: {
                    from_number: '+15551110000',
                    to_number: '+15552220000',
                  },
                },
                context: 'default',
              },
            },
          },
        },
      },
      { expect_recv: { method: 'calling.answer', timeout_ms: 5000 } },
      { push: { frame: statePushFrame('c-scen', 'answered') } },
      { sleep_ms: 50 },
      { push: { frame: statePushFrame('c-scen', 'ended') } },
    ];
    const result = await mock.scenarioPlay(timeline);
    expect(result.status).toBe('completed');
    expect(handlerStarted).toBe(true);

    await waitFor(() => captured.call?.state === 'ended', 3000);
    expect(captured.call!.state).toBe('ended');
  });
});

// ---------------------------------------------------------------------------
// Wire shape — calling.call.receive
// ---------------------------------------------------------------------------

describe('Inbound call — wire shape', () => {
  it('test_inbound_call_journal_send_records_calling_call_receive', async () => {
    const handlerDone = new Promise<void>((resolve) => {
      client.onCall(async (_call) => { resolve(); });
    });
    await mock.inboundCall({ call_id: 'c-wire' });
    await handlerDone;

    const sends = await mock.journalSend('calling.call.receive');
    expect(sends.length).toBeGreaterThan(0);
    const inner = sends[sends.length - 1]!.frame.params.params;
    expect(inner.call_id).toBe('c-wire');
    expect(inner.direction).toBe('inbound');
  });
});

// ---------------------------------------------------------------------------
// Inbound without a registered handler — does not crash
// ---------------------------------------------------------------------------

describe('Inbound call — no handler', () => {
  it('test_inbound_without_handler_does_not_crash', async () => {
    // Disconnect the auto-fixture client; build a fresh client without handler.
    await client.disconnect();
    const fresh = new RelayClient({
      project: 'p',
      token: 't',
      host: mock.relayHost,
      scheme: 'ws',
      contexts: ['default'],
    });
    await fresh.connect();
    try {
      await mock.inboundCall({ call_id: 'c-nohandler' });
      await new Promise((r) => setTimeout(r, 200));
      expect((fresh as any)._connected).toBe(true);
    } finally {
      await fresh.disconnect();
    }
    // Reassign so afterEach disconnect doesn't double-close fresh.
    client = fresh;
  });
});
