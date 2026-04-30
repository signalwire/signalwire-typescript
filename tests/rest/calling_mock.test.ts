/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_calling_mock.py.
 *
 * Every command in CallingNamespace is exercised here with a real
 * RestClient wired to the in-process mock_signalwire server. Each test:
 *
 *   1. Calls the SDK method (no transport patching).
 *   2. Asserts on the response body shape that the mock returns from the spec.
 *   3. Asserts on mock.last() so we know the SDK sent the right wire request
 *      — method, path, command field, and (where applicable) the id and any
 *      keyword params.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';

const CALLS_PATH = '/api/calling/calls';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---------------------------------------------------------------------------
// Lifecycle commands
// ---------------------------------------------------------------------------

describe('Calling lifecycle', () => {
  it('test_update', async () => {
    const body = await client.calling.update({ id: 'call-1', state: 'hold' });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.matched_route).not.toBeNull();
    expect(last.body.command).toBe('update');
    expect('id' in last.body).toBe(false);
    expect(last.body.params.id).toBe('call-1');
    expect(last.body.params.state).toBe('hold');
  });

  it('test_transfer', async () => {
    const body = await client.calling.transfer('call-123', {
      destination: '+15551234567',
      from_number: '+15559876543',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.transfer');
    expect(last.body.id).toBe('call-123');
    expect(last.body.params.destination).toBe('+15551234567');
    expect(last.body.params.from_number).toBe('+15559876543');
  });

  it('test_disconnect', async () => {
    const body = await client.calling.disconnect('call-456', { reason: 'busy' });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.disconnect');
    expect(last.body.id).toBe('call-456');
    expect(last.body.params.reason).toBe('busy');
  });
});

// ---------------------------------------------------------------------------
// Play commands
// ---------------------------------------------------------------------------

describe('Calling play', () => {
  it('test_play_pause', async () => {
    const body = await client.calling.playPause('call-1', { control_id: 'ctrl-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.play.pause');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('ctrl-1');
  });

  it('test_play_resume', async () => {
    const body = await client.calling.playResume('call-1', { control_id: 'ctrl-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.play.resume');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('ctrl-1');
  });

  it('test_play_stop', async () => {
    const body = await client.calling.playStop('call-1', { control_id: 'ctrl-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.play.stop');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('ctrl-1');
  });

  it('test_play_volume', async () => {
    const body = await client.calling.playVolume('call-1', { control_id: 'ctrl-1', volume: 2.5 });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.play.volume');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.volume).toBe(2.5);
  });
});

// ---------------------------------------------------------------------------
// Record commands
// ---------------------------------------------------------------------------

describe('Calling record', () => {
  it('test_record', async () => {
    const body = await client.calling.record('call-1', { record: { format: 'mp3' } });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.record');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.record).toEqual({ format: 'mp3' });
  });

  it('test_record_pause', async () => {
    const body = await client.calling.recordPause('call-1', { control_id: 'rec-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.record.pause');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('rec-1');
  });

  it('test_record_resume', async () => {
    const body = await client.calling.recordResume('call-1', { control_id: 'rec-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.record.resume');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('rec-1');
  });
});

// ---------------------------------------------------------------------------
// Collect commands
// ---------------------------------------------------------------------------

describe('Calling collect', () => {
  it('test_collect', async () => {
    const body = await client.calling.collect('call-1', { initial_timeout: 5, digits: { max: 4 } });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.collect');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.initial_timeout).toBe(5);
  });

  it('test_collect_stop', async () => {
    const body = await client.calling.collectStop('call-1', { control_id: 'col-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.collect.stop');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('col-1');
  });

  it('test_collect_start_input_timers', async () => {
    const body = await client.calling.collectStartInputTimers('call-1', { control_id: 'col-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.collect.start_input_timers');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('col-1');
  });
});

// ---------------------------------------------------------------------------
// Detect / tap / stream / denoise / transcribe
// ---------------------------------------------------------------------------

describe('Calling detect', () => {
  it('test_detect', async () => {
    const body = await client.calling.detect('call-1', { detect: { type: 'machine', params: {} } });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.detect');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.detect.type).toBe('machine');
  });

  it('test_detect_stop', async () => {
    const body = await client.calling.detectStop('call-1', { control_id: 'det-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.detect.stop');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('det-1');
  });
});

describe('Calling tap', () => {
  it('test_tap', async () => {
    const body = await client.calling.tap('call-1', {
      tap: { type: 'audio' },
      device: { type: 'rtp' },
    });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.tap');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.tap).toEqual({ type: 'audio' });
  });

  it('test_tap_stop', async () => {
    const body = await client.calling.tapStop('call-1', { control_id: 'tap-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.tap.stop');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('tap-1');
  });
});

describe('Calling stream', () => {
  it('test_stream', async () => {
    const body = await client.calling.stream('call-1', { url: 'wss://example.com/audio' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.stream');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.url).toBe('wss://example.com/audio');
  });

  it('test_stream_stop', async () => {
    const body = await client.calling.streamStop('call-1', { control_id: 'stream-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.stream.stop');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('stream-1');
  });
});

describe('Calling denoise', () => {
  it('test_denoise', async () => {
    const body = await client.calling.denoise('call-1');
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.denoise');
    expect(last.body.id).toBe('call-1');
  });

  it('test_denoise_stop', async () => {
    const body = await client.calling.denoiseStop('call-1', { control_id: 'dn-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.denoise.stop');
    expect(last.body.id).toBe('call-1');
  });
});

describe('Calling transcribe', () => {
  it('test_transcribe', async () => {
    const body = await client.calling.transcribe('call-1', {
      language: 'en-US',
      transcribe: { engine: 'google' },
    });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.transcribe');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.language).toBe('en-US');
  });

  it('test_transcribe_stop', async () => {
    const body = await client.calling.transcribeStop('call-1', { control_id: 'tr-1' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.transcribe.stop');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.control_id).toBe('tr-1');
  });
});

// ---------------------------------------------------------------------------
// AI commands
// ---------------------------------------------------------------------------

describe('Calling AI', () => {
  it('test_ai_hold', async () => {
    const body = await client.calling.aiHold('call-1');
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.ai_hold');
    expect(last.body.id).toBe('call-1');
  });

  it('test_ai_unhold', async () => {
    const body = await client.calling.aiUnhold('call-1');
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.ai_unhold');
    expect(last.body.id).toBe('call-1');
  });

  it('test_ai_stop', async () => {
    const body = await client.calling.aiStop('call-1');
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.ai.stop');
    expect(last.body.id).toBe('call-1');
  });
});

// ---------------------------------------------------------------------------
// Live transcribe / translate
// ---------------------------------------------------------------------------

describe('Calling live transcribe / translate', () => {
  it('test_live_transcribe', async () => {
    const body = await client.calling.liveTranscribe('call-1', { language: 'en-US' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.live_transcribe');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.language).toBe('en-US');
  });

  it('test_live_translate', async () => {
    const body = await client.calling.liveTranslate('call-1', {
      source_language: 'en',
      target_language: 'es',
    });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.live_translate');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.source_language).toBe('en');
    expect(last.body.params.target_language).toBe('es');
  });
});

// ---------------------------------------------------------------------------
// Fax commands
// ---------------------------------------------------------------------------

describe('Calling fax', () => {
  it('test_send_fax_stop', async () => {
    const body = await client.calling.sendFaxStop('call-1');
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.send_fax.stop');
    expect(last.body.id).toBe('call-1');
  });

  it('test_receive_fax_stop', async () => {
    const body = await client.calling.receiveFaxStop('call-1');
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.receive_fax.stop');
    expect(last.body.id).toBe('call-1');
  });
});

// ---------------------------------------------------------------------------
// SIP refer + custom user_event
// ---------------------------------------------------------------------------

describe('Calling misc (refer / user_event)', () => {
  it('test_refer', async () => {
    const body = await client.calling.refer('call-1', { to: 'sip:other@example.com' });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.refer');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.to).toBe('sip:other@example.com');
  });

  it('test_user_event', async () => {
    const body = await client.calling.userEvent('call-1', {
      event_name: 'my-event',
      payload: { foo: 'bar' },
    });
    expect(typeof body).toBe('object');
    expect('id' in body).toBe(true);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe(CALLS_PATH);
    expect(last.body.command).toBe('calling.user_event');
    expect(last.body.id).toBe('call-1');
    expect(last.body.params.event_name).toBe('my-event');
    expect(last.body.params.payload).toEqual({ foo: 'bar' });
  });
});
