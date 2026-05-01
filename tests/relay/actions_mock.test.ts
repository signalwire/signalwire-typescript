/**
 * Real-mock-backed tests for Action classes.
 *
 * Translated 1:1 from
 *   signalwire-python/tests/unit/relay/test_actions_mock.py
 *
 * For each major action (Play, Record, Detect, Collect, PlayAndCollect, Pay,
 * Fax, Tap, Stream, Transcribe, AI), we drive the SDK against the mock and
 * assert:
 *
 *   1. The on-wire `calling.<verb>` frame carries node_id/call_id/control_id.
 *   2. Mock-pushed state events progress the action.
 *   3. Terminal state events resolve `await action.wait()`.
 *   4. `action.stop()` (and pause/resume/volume where applicable) journals
 *      the right sub-command frame.
 *   5. `onCompleted` callback fires on terminal events.
 *   6. The play_and_collect gotcha — only the collect-side terminal event
 *      resolves (a play(finished) earlier doesn't).
 *   7. The detect gotcha — detect resolves on first `detect` payload, not
 *      on a state(finished).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { RelayClient } from '../../src/relay/RelayClient.js';
import { Call } from '../../src/relay/Call.js';
import {
  AIAction,
  CollectAction,
  DetectAction,
  FaxAction,
  PayAction,
  PlayAction,
  RecordAction,
  StandaloneCollectAction,
  StreamAction,
  TapAction,
  TranscribeAction,
} from '../../src/relay/Action.js';
import { RelayEvent } from '../../src/relay/RelayEvent.js';
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
// Helpers — establish an inbound call we can issue actions on
// ---------------------------------------------------------------------------

async function answeredInboundCall(callId = 'act-call-1'): Promise<Call> {
  const captured: { call?: Call } = {};
  const handlerReturned = new Promise<void>((resolve) => {
    client.onCall(async (call) => {
      captured.call = call;
      await call.answer();
      resolve();
    });
  });
  await mock.inboundCall({ call_id: callId, auto_states: ['created'] });
  await Promise.race([
    handlerReturned,
    new Promise((_, reject) => setTimeout(() => reject(new Error('handler timeout')), 5000)),
  ]);
  const call = captured.call!;
  call.state = 'answered';
  return call;
}

// ---------------------------------------------------------------------------
// PlayAction
// ---------------------------------------------------------------------------

describe('PlayAction', () => {
  it('test_play_journals_calling_play', async () => {
    const call = await answeredInboundCall('call-play');
    await call.play(
      [{ type: 'tts', params: { text: 'hi' } }],
      { controlId: 'play-ctl-1' },
    );
    const [entry] = await mock.journalRecv('calling.play');
    const p = entry!.frame.params;
    expect(p.call_id).toBe('call-play');
    expect(p.control_id).toBe('play-ctl-1');
    expect(p.play[0].type).toBe('tts');
  });

  it('test_play_resolves_on_finished_event', async () => {
    const call = await answeredInboundCall('call-play-fin');
    await mock.armMethod('calling.play', [
      { emit: { state: 'playing' }, delay_ms: 1 },
      { emit: { state: 'finished' }, delay_ms: 5 },
    ]);
    const action = await call.play(
      [{ type: 'silence', params: { duration: 1 } }],
      { controlId: 'play-ctl-fin' },
    );
    expect(action).toBeInstanceOf(PlayAction);
    const event = await action.wait(5);
    expect(action.isDone).toBe(true);
    expect(event.params.state).toBe('finished');
  });

  it('test_play_stop_journals_play_stop', async () => {
    const call = await answeredInboundCall('call-play-stop');
    const action = await call.play(
      [{ type: 'silence', params: { duration: 60 } }],
      { controlId: 'play-ctl-stop' },
    );
    await action.stop();
    const stops = await mock.journalRecv('calling.play.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('play-ctl-stop');
  });

  it('test_play_pause_resume_volume_journal', async () => {
    const call = await answeredInboundCall('call-play-prv');
    const action = await call.play(
      [{ type: 'silence', params: { duration: 60 } }],
      { controlId: 'play-ctl-prv' },
    );
    await action.pause();
    await action.resume();
    await action.volume(-3.0);

    expect((await mock.journalRecv('calling.play.pause')).length).toBeGreaterThan(0);
    expect((await mock.journalRecv('calling.play.resume')).length).toBeGreaterThan(0);
    const vol = await mock.journalRecv('calling.play.volume');
    expect(vol.length).toBeGreaterThan(0);
    expect(vol[vol.length - 1]!.frame.params.volume).toBe(-3.0);
  });

  it('test_play_on_completed_callback_fires', async () => {
    const call = await answeredInboundCall('call-play-cb');
    await mock.armMethod('calling.play', [
      { emit: { state: 'finished' }, delay_ms: 1 },
    ]);
    let callbackFired = false;
    const seen: { e?: RelayEvent } = {};
    const cbPromise = new Promise<void>((resolve) => {
      const onDone = (event: RelayEvent) => {
        seen.e = event;
        callbackFired = true;
        resolve();
      };
      call.play(
        [{ type: 'silence', params: { duration: 1 } }],
        { controlId: 'play-ctl-cb', onCompleted: onDone },
      ).then((action) => action.wait(5));
    });
    await Promise.race([
      cbPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('cb timeout')), 3000)),
    ]);
    expect(callbackFired).toBe(true);
    expect(seen.e!.params.state).toBe('finished');
  });
});

// ---------------------------------------------------------------------------
// RecordAction
// ---------------------------------------------------------------------------

describe('RecordAction', () => {
  it('test_record_journals_calling_record', async () => {
    const call = await answeredInboundCall('call-rec');
    await call.record({ format: 'mp3' }, { controlId: 'rec-ctl-1' });
    const [entry] = await mock.journalRecv('calling.record');
    const p = entry!.frame.params;
    expect(p.call_id).toBe('call-rec');
    expect(p.control_id).toBe('rec-ctl-1');
    expect(p.record.audio.format).toBe('mp3');
  });

  it('test_record_resolves_on_finished_event', async () => {
    const call = await answeredInboundCall('call-rec-fin');
    await mock.armMethod('calling.record', [
      { emit: { state: 'recording' }, delay_ms: 1 },
      { emit: { state: 'finished', url: 'http://r.wav' }, delay_ms: 5 },
    ]);
    const action = await call.record({ format: 'wav' }, { controlId: 'rec-ctl-fin' });
    expect(action).toBeInstanceOf(RecordAction);
    const event = await action.wait(5);
    expect(event.params.state).toBe('finished');
  });

  it('test_record_stop_journals_record_stop', async () => {
    const call = await answeredInboundCall('call-rec-stop');
    const action = await call.record({ format: 'wav' }, { controlId: 'rec-ctl-stop' });
    await action.stop();
    const stops = await mock.journalRecv('calling.record.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('rec-ctl-stop');
  });
});

// ---------------------------------------------------------------------------
// DetectAction — gotcha: resolves on first detect payload
// ---------------------------------------------------------------------------

describe('DetectAction', () => {
  it('test_detect_resolves_on_first_detect_payload', async () => {
    const call = await answeredInboundCall('call-det');
    await mock.armMethod('calling.detect', [
      {
        emit: { detect: { type: 'machine', params: { event: 'MACHINE' } } },
        delay_ms: 1,
      },
      { emit: { state: 'finished' }, delay_ms: 10 },
    ]);
    const action = await call.detect(
      { type: 'machine', params: {} },
      { controlId: 'det-ctl-1' },
    );
    expect(action).toBeInstanceOf(DetectAction);
    const event = await action.wait(5);
    expect(event.params.detect?.type).toBe('machine');
  });

  it('test_detect_stop_journals_detect_stop', async () => {
    const call = await answeredInboundCall('call-det-stop');
    const action = await call.detect(
      { type: 'fax', params: {} },
      { controlId: 'det-stop' },
    );
    await action.stop();
    const stops = await mock.journalRecv('calling.detect.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('det-stop');
  });
});

// ---------------------------------------------------------------------------
// CollectAction (play_and_collect) — gotcha: ignore play(finished)
// ---------------------------------------------------------------------------

describe('CollectAction (play_and_collect)', () => {
  it('test_play_and_collect_journals_play_and_collect', async () => {
    const call = await answeredInboundCall('call-pac');
    await call.playAndCollect(
      [{ type: 'tts', params: { text: 'Press 1' } }],
      { digits: { max: 1 } },
      { controlId: 'pac-ctl-1' },
    );
    const [entry] = await mock.journalRecv('calling.play_and_collect');
    const p = entry!.frame.params;
    expect(p.call_id).toBe('call-pac');
    expect(p.play[0].type).toBe('tts');
    expect(p.collect.digits.max).toBe(1);
  });

  it('test_play_and_collect_resolves_on_collect_event_only', async () => {
    const call = await answeredInboundCall('call-pac-go');
    const action = await call.playAndCollect(
      [{ type: 'silence', params: { duration: 1 } }],
      { digits: { max: 1 } },
      { controlId: 'pac-go' },
    );
    expect(action).toBeInstanceOf(CollectAction);
    // play(finished) MUST NOT resolve.
    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'calling.call.play',
        params: { call_id: 'call-pac-go', control_id: 'pac-go', state: 'finished' },
      },
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(action.isDone).toBe(false);

    // Now the actual collect event — resolves.
    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'calling.call.collect',
        params: {
          call_id: 'call-pac-go',
          control_id: 'pac-go',
          result: { type: 'digit', params: { digits: '1' } },
        },
      },
    });
    const event = await action.wait(2);
    expect(event.eventType).toBe('calling.call.collect');
    expect(event.params.result?.type).toBe('digit');
  });

  it('test_play_and_collect_stop_journals_pac_stop', async () => {
    const call = await answeredInboundCall('call-pac-stop');
    const action = await call.playAndCollect(
      [{ type: 'silence', params: { duration: 1 } }],
      { digits: { max: 1 } },
      { controlId: 'pac-stop' },
    );
    await action.stop();
    const stops = await mock.journalRecv('calling.play_and_collect.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('pac-stop');
  });
});

// ---------------------------------------------------------------------------
// StandaloneCollectAction
// ---------------------------------------------------------------------------

describe('StandaloneCollectAction', () => {
  it('test_collect_journals_calling_collect', async () => {
    const call = await answeredInboundCall('call-col');
    const action = await call.collect({ digits: { max: 4 }, controlId: 'col-ctl' });
    expect(action).toBeInstanceOf(StandaloneCollectAction);
    const [entry] = await mock.journalRecv('calling.collect');
    expect(entry!.frame.params.digits).toEqual({ max: 4 });
    expect(entry!.frame.params.control_id).toBe('col-ctl');
  });

  it('test_collect_stop_journals_collect_stop', async () => {
    const call = await answeredInboundCall('call-col-stop');
    const action = await call.collect({ digits: { max: 4 }, controlId: 'col-stop' });
    await action.stop();
    const stops = await mock.journalRecv('calling.collect.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('col-stop');
  });
});

// ---------------------------------------------------------------------------
// PayAction
// ---------------------------------------------------------------------------

describe('PayAction', () => {
  it('test_pay_journals_calling_pay', async () => {
    const call = await answeredInboundCall('call-pay');
    await call.pay('https://pay.example/connect', {
      controlId: 'pay-ctl',
      chargeAmount: '9.99',
    });
    const [entry] = await mock.journalRecv('calling.pay');
    const p = entry!.frame.params;
    expect(p.payment_connector_url).toBe('https://pay.example/connect');
    expect(p.control_id).toBe('pay-ctl');
    expect(p.charge_amount).toBe('9.99');
  });

  it('test_pay_returns_pay_action', async () => {
    const call = await answeredInboundCall('call-pay-act');
    const action = await call.pay('https://pay.example/connect', { controlId: 'pay-act' });
    expect(action).toBeInstanceOf(PayAction);
    expect(action.controlId).toBe('pay-act');
  });

  it('test_pay_stop_journals_pay_stop', async () => {
    const call = await answeredInboundCall('call-pay-stop');
    const action = await call.pay('https://pay.example/connect', { controlId: 'pay-stop' });
    await action.stop();
    const stops = await mock.journalRecv('calling.pay.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('pay-stop');
  });
});

// ---------------------------------------------------------------------------
// FaxAction
// ---------------------------------------------------------------------------

describe('FaxAction', () => {
  it('test_send_fax_journals_calling_send_fax', async () => {
    const call = await answeredInboundCall('call-sfax');
    await call.sendFax('https://docs.example/test.pdf', {
      identity: '+15551112222',
      controlId: 'sfax-ctl',
    });
    const [entry] = await mock.journalRecv('calling.send_fax');
    const p = entry!.frame.params;
    expect(p.document).toBe('https://docs.example/test.pdf');
    expect(p.identity).toBe('+15551112222');
    expect(p.control_id).toBe('sfax-ctl');
  });

  it('test_receive_fax_returns_fax_action', async () => {
    const call = await answeredInboundCall('call-rfax');
    const action = await call.receiveFax({ controlId: 'rfax-ctl' });
    expect(action).toBeInstanceOf(FaxAction);
  });
});

// ---------------------------------------------------------------------------
// TapAction
// ---------------------------------------------------------------------------

describe('TapAction', () => {
  it('test_tap_journals_calling_tap', async () => {
    const call = await answeredInboundCall('call-tap');
    await call.tap(
      { type: 'audio' },
      { type: 'rtp', params: { addr: '203.0.113.1', port: 4000 } },
      { controlId: 'tap-ctl' },
    );
    const [entry] = await mock.journalRecv('calling.tap');
    const p = entry!.frame.params;
    expect(p.tap).toEqual({ type: 'audio' });
    expect(p.device.params.port).toBe(4000);
    expect(p.control_id).toBe('tap-ctl');
  });

  it('test_tap_stop_journals_tap_stop', async () => {
    const call = await answeredInboundCall('call-tap-stop');
    const action = await call.tap(
      { type: 'audio' },
      { type: 'rtp', params: { addr: '203.0.113.1', port: 4000 } },
      { controlId: 'tap-stop' },
    );
    expect(action).toBeInstanceOf(TapAction);
    await action.stop();
    const stops = await mock.journalRecv('calling.tap.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('tap-stop');
  });
});

// ---------------------------------------------------------------------------
// StreamAction
// ---------------------------------------------------------------------------

describe('StreamAction', () => {
  it('test_stream_journals_calling_stream', async () => {
    const call = await answeredInboundCall('call-strm');
    await call.stream('wss://stream.example/audio', {
      codec: 'OPUS@48000h',
      controlId: 'strm-ctl',
    });
    const [entry] = await mock.journalRecv('calling.stream');
    const p = entry!.frame.params;
    expect(p.url).toBe('wss://stream.example/audio');
    expect(p.codec).toBe('OPUS@48000h');
    expect(p.control_id).toBe('strm-ctl');
  });

  it('test_stream_stop_journals_stream_stop', async () => {
    const call = await answeredInboundCall('call-strm-stop');
    const action = await call.stream('wss://stream.example/audio', { controlId: 'strm-stop' });
    expect(action).toBeInstanceOf(StreamAction);
    await action.stop();
    const stops = await mock.journalRecv('calling.stream.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('strm-stop');
  });
});

// ---------------------------------------------------------------------------
// TranscribeAction
// ---------------------------------------------------------------------------

describe('TranscribeAction', () => {
  it('test_transcribe_journals_calling_transcribe', async () => {
    const call = await answeredInboundCall('call-tr');
    const action = await call.transcribe({ controlId: 'tr-ctl' });
    expect(action).toBeInstanceOf(TranscribeAction);
    const [entry] = await mock.journalRecv('calling.transcribe');
    expect(entry!.frame.params.control_id).toBe('tr-ctl');
  });

  it('test_transcribe_stop_journals_transcribe_stop', async () => {
    const call = await answeredInboundCall('call-tr-stop');
    const action = await call.transcribe({ controlId: 'tr-stop' });
    await action.stop();
    const stops = await mock.journalRecv('calling.transcribe.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('tr-stop');
  });
});

// ---------------------------------------------------------------------------
// AIAction
// ---------------------------------------------------------------------------

describe('AIAction', () => {
  it('test_ai_journals_calling_ai', async () => {
    const call = await answeredInboundCall('call-ai');
    const action = await call.ai({
      prompt: { text: 'You are helpful.' },
      controlId: 'ai-ctl',
    });
    expect(action).toBeInstanceOf(AIAction);
    const [entry] = await mock.journalRecv('calling.ai');
    const p = entry!.frame.params;
    expect(p.prompt).toEqual({ text: 'You are helpful.' });
    expect(p.control_id).toBe('ai-ctl');
  });

  it('test_ai_stop_journals_ai_stop', async () => {
    const call = await answeredInboundCall('call-ai-stop');
    const action = await call.ai({
      prompt: { text: 'You are helpful.' },
      controlId: 'ai-stop',
    });
    await action.stop();
    const stops = await mock.journalRecv('calling.ai.stop');
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[stops.length - 1]!.frame.params.control_id).toBe('ai-stop');
  });
});

// ---------------------------------------------------------------------------
// General — control_id correlation across multiple concurrent actions
// ---------------------------------------------------------------------------

describe('Concurrent actions', () => {
  it('test_concurrent_play_and_record_route_independently', async () => {
    const call = await answeredInboundCall('call-multi');
    const playAction = await call.play(
      [{ type: 'silence', params: { duration: 60 } }],
      { controlId: 'ctl-play-x' },
    );
    const recordAction = await call.record({ format: 'wav' }, { controlId: 'ctl-rec-y' });
    expect(playAction.controlId).toBe('ctl-play-x');
    expect(recordAction.controlId).toBe('ctl-rec-y');

    // Push a finished event for ONLY the play.
    await mock.push({
      jsonrpc: '2.0',
      id: randomUUID(),
      method: 'signalwire.event',
      params: {
        event_type: 'calling.call.play',
        params: { call_id: 'call-multi', control_id: 'ctl-play-x', state: 'finished' },
      },
    });
    await playAction.wait(2);
    expect(playAction.isDone).toBe(true);
    expect(recordAction.isDone).toBe(false);
  });
});
