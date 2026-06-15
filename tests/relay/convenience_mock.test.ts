/**
 * Real-mock-backed tests for the typed Call convenience methods
 * (playTTS / playAudio / playSilence / playRingtone / detectDigit /
 * detectAnsweringMachine / detectFax / promptTTS / promptAudio /
 * waitForAnswered / waitForRinging / waitForEnding).
 *
 * Mirrors the signalwire-python call.play_/detect_/prompt_/wait_for_
 * convenience surface (restored in the Python reference).
 *
 * Each test drives the REAL RelayClient over the shared mock_relay
 * WebSocket (no transport mock) and asserts the journaled `calling.<verb>`
 * command frame carries the exact RELAY media/params shape the Python
 * reference emits. The wait-for-state tests assert the already-reached-state
 * short-circuit (and the block-then-resolve path for a not-yet-reached state).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { RelayClient } from '../../src/relay/RelayClient.js';
import { Call } from '../../src/relay/Call.js';
import { PlayAction, DetectAction, CollectAction } from '../../src/relay/Action.js';
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
    try {
      await client.disconnect();
    } catch {
      /* ignore */
    }
  }
});

// ---------------------------------------------------------------------------
// Helpers — establish an answered inbound call we can issue convenience
// methods on, then read back the journaled command frame.
// ---------------------------------------------------------------------------

async function answeredInboundCall(callId = 'conv-call-1'): Promise<Call> {
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

function bareEventFrame(eventType: string, params: Record<string, any>): Record<string, any> {
  return {
    jsonrpc: '2.0',
    id: randomUUID(),
    method: 'signalwire.event',
    params: { event_type: eventType, params },
  };
}

/** Poll the recv journal for `method` and return the latest frame's params. */
async function lastFrameParams(method: string): Promise<Record<string, any>> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const entries = await mock.journalRecv(method);
    if (entries.length > 0) return entries[entries.length - 1]!.frame.params;
    if (Date.now() >= deadline) {
      throw new Error(`no ${method} frame landed in journal within 2s`);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

// ---------------------------------------------------------------------------
// Play family — play [{type,params}] over calling.play
// ---------------------------------------------------------------------------

describe('Call.playTTS', () => {
  it('emits a tts media entry with nested params and top-level volume', async () => {
    const call = await answeredInboundCall('conv-ptts');
    const action = await call.playTTS('hello world', {
      language: 'en-US',
      gender: 'female',
      voice: 'Polly.Joanna',
      volume: 3.5,
    });
    expect(action).toBeInstanceOf(PlayAction);
    const p = await lastFrameParams('calling.play');
    expect(p.call_id).toBe('conv-ptts');
    expect(p.volume).toBe(3.5);
    expect(p.play[0].type).toBe('tts');
    expect(p.play[0].params.text).toBe('hello world');
    expect(p.play[0].params.language).toBe('en-US');
    expect(p.play[0].params.gender).toBe('female');
    expect(p.play[0].params.voice).toBe('Polly.Joanna');
  });

  it('omits unset optional params (only text, no volume)', async () => {
    const call = await answeredInboundCall('conv-ptts2');
    await call.playTTS('bare');
    const p = await lastFrameParams('calling.play');
    expect(p).not.toHaveProperty('volume');
    expect(p.play[0].params.text).toBe('bare');
    expect(p.play[0].params).not.toHaveProperty('language');
    expect(p.play[0].params).not.toHaveProperty('gender');
    expect(p.play[0].params).not.toHaveProperty('voice');
  });
});

describe('Call.playAudio', () => {
  it('emits an audio media entry carrying url with optional volume', async () => {
    const call = await answeredInboundCall('conv-paud');
    const action = await call.playAudio('https://example.com/a.mp3', { volume: -2.0 });
    expect(action).toBeInstanceOf(PlayAction);
    const p = await lastFrameParams('calling.play');
    expect(p.volume).toBe(-2.0);
    expect(p.play[0].type).toBe('audio');
    expect(p.play[0].params.url).toBe('https://example.com/a.mp3');
  });
});

describe('Call.playSilence', () => {
  it('emits a silence media entry carrying duration', async () => {
    const call = await answeredInboundCall('conv-psil');
    const action = await call.playSilence(2.5);
    expect(action).toBeInstanceOf(PlayAction);
    const p = await lastFrameParams('calling.play');
    expect(p.play[0].type).toBe('silence');
    expect(p.play[0].params.duration).toBe(2.5);
  });
});

describe('Call.playRingtone', () => {
  it('emits a ringtone media entry carrying name + duration with optional volume', async () => {
    const call = await answeredInboundCall('conv-prng');
    const action = await call.playRingtone('us', { duration: 4.0, volume: 1.0 });
    expect(action).toBeInstanceOf(PlayAction);
    const p = await lastFrameParams('calling.play');
    expect(p.volume).toBe(1.0);
    expect(p.play[0].type).toBe('ringtone');
    expect(p.play[0].params.name).toBe('us');
    expect(p.play[0].params.duration).toBe(4.0);
  });

  it('omits duration from ringtone params when unset', async () => {
    const call = await answeredInboundCall('conv-prng2');
    await call.playRingtone('gb');
    const p = await lastFrameParams('calling.play');
    expect(p.play[0].params.name).toBe('gb');
    expect(p.play[0].params).not.toHaveProperty('duration');
  });
});

// ---------------------------------------------------------------------------
// Detect family — detect {type,params} over calling.detect
// ---------------------------------------------------------------------------

describe('Call.detectDigit', () => {
  it('emits a digit detect object with nested digits and top-level timeout', async () => {
    const call = await answeredInboundCall('conv-ddig');
    const action = await call.detectDigit({ digits: '123', timeout: 7.0 });
    expect(action).toBeInstanceOf(DetectAction);
    const p = await lastFrameParams('calling.detect');
    expect(p.call_id).toBe('conv-ddig');
    expect(p.timeout).toBe(7.0);
    expect(p.detect.type).toBe('digit');
    expect(p.detect.params.digits).toBe('123');
  });

  it('omits digits from detect params when unset', async () => {
    const call = await answeredInboundCall('conv-ddig2');
    await call.detectDigit();
    const p = await lastFrameParams('calling.detect');
    expect(p.detect.type).toBe('digit');
    expect(p.detect.params).not.toHaveProperty('digits');
  });
});

describe('Call.detectAnsweringMachine', () => {
  it('emits a machine detect object carrying only provided params', async () => {
    const call = await answeredInboundCall('conv-damd');
    const action = await call.detectAnsweringMachine({
      initialTimeout: 5.0,
      endSilenceTimeout: 1.0,
      detectInterruptions: true,
      timeout: 30.0,
    });
    expect(action).toBeInstanceOf(DetectAction);
    const p = await lastFrameParams('calling.detect');
    expect(p.timeout).toBe(30.0);
    expect(p.detect.type).toBe('machine');
    expect(p.detect.params.initial_timeout).toBe(5.0);
    expect(p.detect.params.end_silence_timeout).toBe(1.0);
    expect(p.detect.params.detect_interruptions).toBe(true);
    // Params the caller did not set must be absent (only-provided-keys).
    expect(p.detect.params).not.toHaveProperty('machine_voice_threshold');
    expect(p.detect.params).not.toHaveProperty('machine_words_threshold');
    expect(p.detect.params).not.toHaveProperty('detect_message_end');
  });
});

describe('Call.detectFax', () => {
  it('emits a fax detect object carrying the nested tone', async () => {
    const call = await answeredInboundCall('conv-dfax');
    const action = await call.detectFax({ tone: 'CED' });
    expect(action).toBeInstanceOf(DetectAction);
    const p = await lastFrameParams('calling.detect');
    expect(p.detect.type).toBe('fax');
    expect(p.detect.params.tone).toBe('CED');
  });
});

// ---------------------------------------------------------------------------
// Prompt family — play [{type,params}] + collect over calling.play_and_collect
// ---------------------------------------------------------------------------

describe('Call.promptTTS', () => {
  it('emits a tts media entry plus the caller collect on play_and_collect', async () => {
    const call = await answeredInboundCall('conv-rtts');
    const collect = { digits: { max: 3 } };
    const action = await call.promptTTS('enter pin', collect, {
      voice: 'en-US-Neural',
      volume: 2.0,
    });
    expect(action).toBeInstanceOf(CollectAction);
    const p = await lastFrameParams('calling.play_and_collect');
    expect(p.volume).toBe(2.0);
    expect(p.play[0].type).toBe('tts');
    expect(p.play[0].params.text).toBe('enter pin');
    expect(p.play[0].params.voice).toBe('en-US-Neural');
    expect(p.collect.digits.max).toBe(3);
  });
});

describe('Call.promptAudio', () => {
  it('emits an audio media entry plus the caller collect on play_and_collect', async () => {
    const call = await answeredInboundCall('conv-raud');
    const collect = { speech: { end_silence_timeout: 1 } };
    const action = await call.promptAudio('https://example.com/prompt.wav', collect);
    expect(action).toBeInstanceOf(CollectAction);
    const p = await lastFrameParams('calling.play_and_collect');
    expect(p.play[0].type).toBe('audio');
    expect(p.play[0].params.url).toBe('https://example.com/prompt.wav');
    expect(p.collect.speech.end_silence_timeout).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Wait-for-state family — already-reached-state short-circuit
// ---------------------------------------------------------------------------

describe('Call.waitForAnswered', () => {
  it('short-circuits immediately when already answered (no state event needed)', async () => {
    const call = await answeredInboundCall('conv-wfa');
    expect(call.state).toBe('answered');
    // No state event is ever pushed: if the method blocked, the race timer
    // would win and reject. Because the call is already at the target it must
    // resolve right away with the synthesized current state.
    const ev = await Promise.race([
      call.waitForAnswered(),
      new Promise<RelayEvent>((_, reject) =>
        setTimeout(
          () => reject(new Error('waitForAnswered blocked instead of short-circuiting')),
          1000,
        ),
      ),
    ]);
    expect(ev).toBeInstanceOf(RelayEvent);
    expect(ev.eventType).toBe('calling.call.state');
    expect(ev.params.call_state).toBe('answered');
  });
});

describe('Call.waitForRinging', () => {
  it('short-circuits when already past ringing (answered > ringing)', async () => {
    const call = await answeredInboundCall('conv-wfr');
    const ev = await Promise.race([
      call.waitForRinging(),
      new Promise<RelayEvent>((_, reject) =>
        setTimeout(
          () => reject(new Error('waitForRinging blocked instead of short-circuiting')),
          1000,
        ),
      ),
    ]);
    expect(ev.eventType).toBe('calling.call.state');
    // Synthesized event reports the *current* state, which is past ringing.
    expect(ev.params.call_state).toBe('answered');
  });
});

describe('Call.waitForEnding', () => {
  it('blocks then resolves on an ending state event (ending > answered)', async () => {
    const call = await answeredInboundCall('conv-wfe');
    // "ending" is past "answered" → must NOT short-circuit; it blocks until
    // an ending state event arrives.
    const waiting = call.waitForEnding(3000);
    // Push the ending state shortly after the wait begins.
    setTimeout(() => {
      void mock.push(
        bareEventFrame('calling.call.state', {
          call_id: 'conv-wfe',
          call_state: 'ending',
          direction: 'inbound',
        }),
      );
    }, 100);
    const ev = await waiting;
    expect(ev.eventType).toBe('calling.call.state');
    expect(ev.params.call_state).toBe('ending');
  });
});
