/**
 * Fallback voices, the default voice, duration strings, and calling.error's
 * voice fields (signalwire-python 3.13.0), gather questions the platform
 * says itself (3.14.0), and the agent's own voice and fallback voice (3.15.0).
 */

import { AgentBase } from '../src/AgentBase.js';
import { GatherInfo, GatherQuestion } from '../src/ContextBuilder.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { SchemaUtils } from '../src/SchemaUtils.js';
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

describe("Python's rules, where a value is checked or written", () => {
  it("reads whole numbers with Unicode digits and Python's whitespace", () => {
    const e = (v: unknown) =>
      CallingErrorEvent.fromPayload({ event_type: 'calling.error', params: { stall_ms: v } })
        .stallMs;
    expect([
      e('٤٢'),
      e('４２'),
      e('۴_۲'),
      e('42\u0085'),
      e('\uFEFF42'),
      e('_1'),
      e('1__0'),
    ]).toEqual([42, 42, 42, 42, null, null, null]);
  });

  it('refuses the separators int() refuses around a number', () => {
    for (const sep of ['\u001c', '\u001d', '\u001e', '\u001f']) {
      for (const v of [`${sep}42`, `42${sep}`]) {
        expect(
          CallingErrorEvent.fromPayload({ event_type: 'calling.error', params: { stall_ms: v } })
            .stallMs,
        ).toBeNull();
      }
    }
  });

  it("writes a structured field as Python's str() does", () => {
    const event = CallingErrorEvent.fromPayload({
      event_type: 'calling.error',
      params: { error: { reason: 'stall', retry: true }, recovery: [] },
    });
    expect(event.error).toBe("{'reason': 'stall', 'retry': True}");
    expect(event.recovery).toBe('[]');
  });

  it('keeps a __proto__ language code as a key', () => {
    const a = agent().setDefaultVoice(JSON.parse('{"__proto__":["rime.spore"]}'));
    const main = mainOf(a.renderSwml());
    const set = main.find((v) => 'set' in v).set;
    expect(JSON.stringify(set)).toBe('{"default_voice":{"__proto__":["rime.spore"]}}');
  });

  it("counts blank as Python's strip() does", () => {
    for (const blank of ['\u0085', '\u001c']) {
      expect(() => new FunctionResult('ok').changeVoice(blank)).toThrow(/non-empty/);
      expect(() => new FunctionResult('ok').hold(undefined, blank)).toThrow(/duration/);
    }
    expect(new FunctionResult('ok').changeVoice('\uFEFF').toDict().action).toEqual([
      { change_voice: '\uFEFF' },
    ]);
  });

  it("names a bad value as Python's repr() does", () => {
    expect(() => new FunctionResult('ok').changeVoice([null as unknown as string])).toThrow(
      'got None',
    );
    expect(() => agent().setDefaultVoice({ es: [] })).toThrow(
      "default_voice['es'] must name at least one voice",
    );
  });
});

describe('gather questions the platform says itself', () => {
  it('a gather can have the platform say its questions', () => {
    const a = agent();
    const step = a
      .defineContexts()
      .addContext('default')
      .addStep('intake')
      .setText('Gather their details.');
    step.setGatherInfo({ sayQuestions: true });
    step.addGatherQuestion({ key: 'name', question: "What's your name?" });
    step.addGatherQuestion({ key: 'reason', question: 'What can we help with?', say: false });
    const gather = aiOf(a).prompt.contexts.default.steps[0].gather_info;
    expect(gather.say_questions).toBe(true);
    expect('say' in gather.questions[0]).toBe(false);
    expect(gather.questions[1].say).toBe(false);
  });

  it("leaves say_questions out unless it's on, and keeps a question's say", () => {
    const off = new GatherInfo().addQuestion({ key: 'k', question: 'Q?' }).toDict();
    expect('say_questions' in off).toBe(false);
    const on = new GatherInfo({ sayQuestions: true })
      .addQuestion({ key: 'k', question: 'Q?', say: true })
      .toDict();
    expect(on.say_questions).toBe(true);
    expect(on.questions[0]).toEqual({ key: 'k', question: 'Q?', say: true });
  });

  it('exposes say on a question, undefined meaning the gather decides', () => {
    expect(new GatherQuestion({ key: 'k', question: 'Q?' }).say).toBeUndefined();
    expect(new GatherQuestion({ key: 'k', question: 'Q?', say: false }).say).toBe(false);
  });
});

describe("the agent's voice and fallback voice", () => {
  it("are the ai verb's own", () => {
    const a = agent().setAgentVoice(CHAIN).setFallbackVoice('gcloud.en-US-Neural2-C');
    const ai = aiOf(a);
    expect(ai.voice).toEqual(CHAIN);
    expect(ai.fallback_voice).toBe('gcloud.en-US-Neural2-C');
    a.setAgentVoice(null).setFallbackVoice(null);
    expect('voice' in aiOf(a) || 'fallback_voice' in aiOf(a)).toBe(false);
  });

  it('are checked like every voice field', () => {
    expect(() => agent().setAgentVoice('  ')).toThrow(
      'voice must be a non-empty string, or a list of them',
    );
    expect(() => agent().setFallbackVoice([])).toThrow(
      'fallback_voice must name at least one voice',
    );
    expect(() => agent().setFallbackVoice(Array(9).fill('rime.spore'))).toThrow(
      'fallback_voice takes at most 8 voices',
    );
    expect(aiOf(agent().setAgentVoice(['rime.spore'])).voice).toEqual(['rime.spore']);
  });

  it('are carried by the per-request copy, and a change there stays on it', async () => {
    const a = agent().setAgentVoice('rime.spore').setFallbackVoice(CHAIN);
    a.setDynamicConfigCallback((_q, _b, _h, copy) => {
      (copy as AgentBase).setFallbackVoice('rime.luna');
    });
    const auth = `Basic ${Buffer.from('u:p').toString('base64')}`;
    const [, , body] = await a.handleRequest(
      'POST',
      'http://localhost/',
      { authorization: auth },
      {},
    );
    const ai = mainOf(body).find((v) => 'ai' in v).ai;
    expect(ai.voice).toBe('rime.spore');
    expect(ai.fallback_voice).toBe('rime.luna');
    expect(aiOf(a).fallback_voice).toEqual(CHAIN);
  });

  it("pass the ai verb's key check, which the schema doesn't list yet", () => {
    const schema = new SchemaUtils();
    const ai = { prompt: { text: 'Hi' }, voice: CHAIN, fallback_voice: 'rime.spore' };
    expect(schema.validateVerb('ai', ai)).toEqual({ valid: true, errors: [] });
    expect(schema.validateVerb('ai', { ...ai, voise: 'x' }).valid).toBe(false);
  });
});
