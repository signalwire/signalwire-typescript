/**
 * Fallback voices, the default voice, duration strings, and calling.error's
 * voice fields (signalwire-python 3.13.0).
 */

import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { CallingErrorEvent } from '../src/relay/RelayEvent.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML
type Json = any;

const CHAIN = ['elevenlabs.rachel:eleven_turbo_v2_5', 'rime.spore', 'gcloud.en-US-Neural2-F'];

function agent(): AgentBase {
  const a = new AgentBase({ name: 'v', suppressLogs: true, basicAuth: ['u', 'p'] });
  a.promptAddSection('Role', { body: 'You help.' });
  return a;
}

const mainOf = (swml: string): Json[] => JSON.parse(swml).sections.main;
const aiOf = (a: AgentBase): Json => mainOf(a.renderSwml()).find((v) => 'ai' in v).ai;

describe('fallback voices', () => {
  it('takes a list of voices for a language, as sent', () => {
    const language = aiOf(agent().addLanguage({ name: 'English', code: 'en-US', voice: CHAIN }))
      .languages[0];
    expect(language.voice).toEqual(CHAIN);
    expect('engine' in language || 'model' in language).toBe(false);
    const one = agent().addLanguage({
      name: 'English',
      code: 'en-US',
      voice: 'elevenlabs.josh:eleven_turbo_v2_5',
    });
    expect(aiOf(one).languages[0]).toEqual({
      name: 'English',
      code: 'en-US',
      voice: 'josh',
      engine: 'elevenlabs',
      model: 'eleven_turbo_v2_5',
    });
    expect(() =>
      agent().addLanguage({ name: 'English', code: 'en-US', voice: CHAIN, engine: 'elevenlabs' }),
    ).toThrow(/engine and model are for one voice/);
    expect(() =>
      agent().addLanguage({
        name: 'English',
        code: 'en-US',
        voice: Array.from({ length: 9 }, (_, i) => `rime.v${i}`),
      }),
    ).toThrow(/at most 8/);
    expect(() =>
      agent().addLanguage({ name: 'English', code: 'en-US', voice: ['rime.spore', ''] }),
    ).toThrow(/non-empty/);
  });

  it.each([
    ['rime.spore'],
    [CHAIN],
    [{ es: ['elevenlabs.lucia', 'rime.luna'], default: 'rime.spore' }],
  ])('sets the default voice just before the ai verb: %j', async (voice) => {
    const a = agent().setDefaultVoice(voice);
    const main = mainOf(a.renderSwml());
    const at = main.findIndex((v) => 'ai' in v);
    expect(main[at - 1]).toEqual({ set: { default_voice: voice } });
    // A per-request copy renders it the same way
    a.setDynamicConfigCallback(() => undefined);
    const auth = `Basic ${Buffer.from('u:p').toString('base64')}`;
    const [, , body] = await a.handleRequest(
      'POST',
      'http://localhost/',
      { authorization: auth },
      {},
    );
    const copied = mainOf(body);
    const atCopy = copied.findIndex((v) => 'ai' in v);
    expect(copied[atCopy - 1]).toEqual({ set: { default_voice: voice } });
    expect(mainOf(agent().renderSwml()).some((v) => 'set' in v)).toBe(false);
  });

  it('checks a default voice by language', () => {
    expect(() => agent().setDefaultVoice({ '': 'rime.spore' })).toThrow(/codes/);
    expect(() =>
      agent().setDefaultVoice({ default: Array.from({ length: 9 }, (_, i) => `rime.v${i}`) }),
    ).toThrow(/at most 8/);
    expect(() => agent().setDefaultVoice({})).toThrow(/at least one language/);
    expect(
      mainOf(agent().setDefaultVoice('rime.spore').setDefaultVoice(null).renderSwml()).some(
        (v) => 'set' in v,
      ),
    ).toBe(false);
  });

  it('takes a list in changeVoice', () => {
    expect(new FunctionResult('ok').changeVoice(CHAIN).toDict().action).toEqual([
      { change_voice: CHAIN },
    ]);
    expect(new FunctionResult('ok').changeVoice('rime.spore').toDict().action).toEqual([
      { change_voice: 'rime.spore' },
    ]);
    expect(() => new FunctionResult('ok').changeVoice([])).toThrow(Error);
  });

  it('takes durations for the speech timeouts and hold', () => {
    const r = new FunctionResult('ok').setEndOfSpeechTimeout('1.5s').setSpeechEventTimeout(800);
    expect(r.toDict().action).toEqual([
      { end_of_speech_timeout: '1.5s' },
      { speech_event_timeout: 800 },
    ]);
    expect(new FunctionResult('ok').hold(undefined, '2m').toDict().action).toEqual([
      { hold: '2m' },
    ]);
    expect(new FunctionResult('ok').hold(undefined, 1200).toDict().action).toEqual([{ hold: 900 }]);
    expect(() => new FunctionResult('ok').hold(undefined, ' ')).toThrow(/duration/);
  });
});

describe('CallingErrorEvent', () => {
  it('carries the voice that failed and the one that took over', () => {
    const event = CallingErrorEvent.fromPayload({
      event_type: 'calling.error',
      params: {
        call_id: 'c1',
        error: 'ai: Speech error\n',
        error_reason: 'voice_runtime_error',
        engine: 'elevenlabs',
        language_code: 'en-US',
        voice: 'rachel',
        model: 'eleven_turbo_v2_5',
        fallback_engine: 'rime',
        fallback_language_code: 'en-US',
        fallback_voice: 'spore',
        fallback_model: '',
        fallback_index: 1,
        fallback_source: 'voice',
      },
    });
    expect([
      event.errorReason,
      event.voice,
      event.fallbackVoice,
      event.fallbackIndex,
      event.fallbackSource,
    ]).toEqual(['voice_runtime_error', 'rachel', 'spore', 1, 'voice']);
    expect(event.fatal).toBe(false);
    expect(event.stallMs).toBeNull();
    const fatal = CallingErrorEvent.fromPayload({
      event_type: 'calling.error',
      params: {
        error: 'ai: no usable TTS voice.\n',
        fatal: true,
        error_reason: 'voice_unrecoverable',
      },
    });
    expect(fatal.fatal).toBe(true);
    expect(fatal.fallbackIndex).toBeNull();
  });

  it('reads whole numbers as int() does, and a bool as none', () => {
    const e = (v: unknown) =>
      CallingErrorEvent.fromPayload({ event_type: 'calling.error', params: { stall_ms: v } })
        .stallMs;
    expect([e(1500), e(2.7), e('42'), e('4_2'), e(true), e('3.5'), e(null)]).toEqual([
      1500,
      2,
      42,
      42,
      null,
      null,
      null,
    ]);
    expect(
      CallingErrorEvent.fromPayload({ event_type: 'calling.error', params: { fatal: 'true' } })
        .fatal,
    ).toBe(false);
  });
});
