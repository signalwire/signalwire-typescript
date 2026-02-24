import { describe, it, expect } from 'vitest';
import { SwaigFunctionResult } from '../src/SwaigFunctionResult.js';

describe('SwaigFunctionResult', () => {
  it('returns default response when empty', () => {
    const r = new SwaigFunctionResult();
    expect(r.toDict()).toEqual({ response: 'Action completed.' });
  });

  it('stores response from constructor', () => {
    const r = new SwaigFunctionResult('hello');
    expect(r.toDict()).toEqual({ response: 'hello' });
  });

  it('supports setResponse', () => {
    const r = new SwaigFunctionResult().setResponse('hi');
    expect(r.toDict()).toEqual({ response: 'hi' });
  });

  it('supports addAction chaining', () => {
    const r = new SwaigFunctionResult('ok')
      .addAction('hangup', true)
      .addAction('stop', true);
    const d = r.toDict();
    expect(d.response).toBe('ok');
    expect(d.action).toEqual([{ hangup: true }, { stop: true }]);
  });

  it('supports addActions', () => {
    const r = new SwaigFunctionResult('ok').addActions([
      { set_global_data: { k: 'v' } },
      { play: { url: 'music.mp3' } },
    ]);
    expect((r.toDict().action as unknown[]).length).toBe(2);
  });

  it('includes post_process only when true and actions present', () => {
    const r1 = new SwaigFunctionResult('hi', true);
    expect(r1.toDict()).toEqual({ response: 'hi' }); // no actions = no post_process

    const r2 = new SwaigFunctionResult('hi', true).hangup();
    expect(r2.toDict().post_process).toBe(true);

    const r3 = new SwaigFunctionResult('hi', false).hangup();
    expect(r3.toDict().post_process).toBeUndefined();
  });

  it('connect builds correct SWML', () => {
    const r = new SwaigFunctionResult('transferring').connect('+15551234567');
    const act = (r.toDict().action as Record<string, unknown>[])[0];
    expect(act['transfer']).toBe('true');
    const swml = act['SWML'] as Record<string, unknown>;
    expect(swml['version']).toBe('1.0.0');
  });

  it('connect with from address', () => {
    const r = new SwaigFunctionResult('t').connect('+1555', false, '+1666');
    const act = (r.toDict().action as Record<string, unknown>[])[0];
    expect(act['transfer']).toBe('false');
    const swml = act['SWML'] as Record<string, unknown>;
    const sections = swml['sections'] as Record<string, unknown[]>;
    const main = sections['main'][0] as Record<string, Record<string, string>>;
    expect(main['connect']['from']).toBe('+1666');
  });

  it('swmlTransfer', () => {
    const r = new SwaigFunctionResult('ok').swmlTransfer('https://example.com', 'bye', false);
    const act = (r.toDict().action as Record<string, unknown>[])[0];
    expect(act['transfer']).toBe('false');
  });

  it('hangup / stop / hold', () => {
    const r = new SwaigFunctionResult('bye').hangup().stop().hold(60);
    const acts = r.toDict().action as Record<string, unknown>[];
    expect(acts[0]).toEqual({ hangup: true });
    expect(acts[1]).toEqual({ stop: true });
    expect(acts[2]).toEqual({ hold: 60 });
  });

  it('hold clamps timeout', () => {
    const r = new SwaigFunctionResult().hold(9999);
    expect((r.toDict().action as Record<string, unknown>[])[0]).toEqual({ hold: 900 });
  });

  it('waitForUser variants', () => {
    expect(new SwaigFunctionResult('w').waitForUser().toDict().action)
      .toEqual([{ wait_for_user: true }]);
    expect(new SwaigFunctionResult('w').waitForUser({ answerFirst: true }).toDict().action)
      .toEqual([{ wait_for_user: 'answer_first' }]);
    expect(new SwaigFunctionResult('w').waitForUser({ timeout: 10 }).toDict().action)
      .toEqual([{ wait_for_user: 10 }]);
    expect(new SwaigFunctionResult('w').waitForUser({ enabled: false }).toDict().action)
      .toEqual([{ wait_for_user: false }]);
  });

  it('say / playBackgroundFile / stopBackgroundFile', () => {
    const r = new SwaigFunctionResult('ok')
      .say('hello')
      .playBackgroundFile('music.mp3')
      .playBackgroundFile('bg.mp3', true)
      .stopBackgroundFile();
    const acts = r.toDict().action as Record<string, unknown>[];
    expect(acts[0]).toEqual({ say: 'hello' });
    expect(acts[1]).toEqual({ playback_bg: 'music.mp3' });
    expect(acts[2]).toEqual({ playback_bg: { file: 'bg.mp3', wait: true } });
    expect(acts[3]).toEqual({ stop_playback_bg: true });
  });

  it('speech hints', () => {
    const r = new SwaigFunctionResult('ok')
      .addDynamicHints(['word1', { pattern: 'w', replace: 'W' }])
      .clearDynamicHints()
      .setEndOfSpeechTimeout(500)
      .setSpeechEventTimeout(200);
    const acts = r.toDict().action as Record<string, unknown>[];
    expect(acts.length).toBe(4);
    expect(acts[1]).toEqual({ clear_dynamic_hints: {} });
    expect(acts[2]).toEqual({ end_of_speech_timeout: 500 });
    expect(acts[3]).toEqual({ speech_event_timeout: 200 });
  });

  it('global data / metadata', () => {
    const r = new SwaigFunctionResult('ok')
      .updateGlobalData({ key: 'val' })
      .removeGlobalData(['key'])
      .setMetadata({ m: 1 })
      .removeMetadata('m');
    const acts = r.toDict().action as Record<string, unknown>[];
    expect(acts[0]).toEqual({ set_global_data: { key: 'val' } });
    expect(acts[1]).toEqual({ unset_global_data: ['key'] });
    expect(acts[2]).toEqual({ set_meta_data: { m: 1 } });
    expect(acts[3]).toEqual({ unset_meta_data: 'm' });
  });

  it('swmlChangeStep / swmlChangeContext', () => {
    const r = new SwaigFunctionResult('ok').swmlChangeStep('step2').swmlChangeContext('ctx2');
    const acts = r.toDict().action as Record<string, unknown>[];
    expect(acts[0]).toEqual({ change_step: 'step2' });
    expect(acts[1]).toEqual({ change_context: 'ctx2' });
  });

  it('swmlUserEvent', () => {
    const r = new SwaigFunctionResult('ok').swmlUserEvent({ type: 'test', val: 1 });
    const acts = r.toDict().action as Record<string, unknown>[];
    expect(acts[0]).toEqual({
      SWML: {
        sections: { main: [{ user_event: { event: { type: 'test', val: 1 } } }] },
        version: '1.0.0',
      },
    });
  });

  it('switchContext simple string', () => {
    const r = new SwaigFunctionResult('ok').switchContext({ systemPrompt: 'new prompt' });
    expect((r.toDict().action as Record<string, unknown>[])[0]).toEqual({
      context_switch: 'new prompt',
    });
  });

  it('switchContext advanced object', () => {
    const r = new SwaigFunctionResult('ok').switchContext({
      systemPrompt: 'sp',
      userPrompt: 'up',
      consolidate: true,
    });
    expect((r.toDict().action as Record<string, unknown>[])[0]).toEqual({
      context_switch: { system_prompt: 'sp', user_prompt: 'up', consolidate: true },
    });
  });

  it('toggleFunctions / enableFunctionsOnTimeout / updateSettings', () => {
    const r = new SwaigFunctionResult('ok')
      .toggleFunctions([{ function: 'fn1', active: false }])
      .enableFunctionsOnTimeout()
      .updateSettings({ temperature: 0.5 });
    const acts = r.toDict().action as Record<string, unknown>[];
    expect(acts[0]).toEqual({ toggle_functions: [{ function: 'fn1', active: false }] });
    expect(acts[1]).toEqual({ functions_on_speaker_timeout: true });
    expect(acts[2]).toEqual({ settings: { temperature: 0.5 } });
  });

  it('simulateUserInput / enableExtensiveData / replaceInHistory', () => {
    const r = new SwaigFunctionResult('ok')
      .simulateUserInput('hi')
      .enableExtensiveData()
      .replaceInHistory('replaced');
    const acts = r.toDict().action as Record<string, unknown>[];
    expect(acts[0]).toEqual({ user_input: 'hi' });
    expect(acts[1]).toEqual({ extensive_data: true });
    expect(acts[2]).toEqual({ replace_in_history: 'replaced' });
  });

  it('sendSms', () => {
    const r = new SwaigFunctionResult('sent').sendSms({
      toNumber: '+1555',
      fromNumber: '+1666',
      body: 'hi',
    });
    const acts = r.toDict().action as Record<string, unknown>[];
    const swml = acts[0]['SWML'] as Record<string, unknown>;
    expect(swml['version']).toBe('1.0.0');
  });

  it('sendSms throws without body or media', () => {
    expect(() => {
      new SwaigFunctionResult().sendSms({ toNumber: '+1', fromNumber: '+2' });
    }).toThrow('Either body or media must be provided');
  });

  it('recordCall / stopRecordCall', () => {
    const r = new SwaigFunctionResult('ok')
      .recordCall({ format: 'mp3', stereo: true })
      .stopRecordCall('ctrl1');
    expect((r.toDict().action as unknown[]).length).toBe(2);
  });

  it('tap / stopTap', () => {
    const r = new SwaigFunctionResult('ok')
      .tap({ uri: 'wss://example.com' })
      .stopTap();
    expect((r.toDict().action as unknown[]).length).toBe(2);
  });

  it('joinRoom', () => {
    const r = new SwaigFunctionResult('ok').joinRoom('room1');
    const acts = r.toDict().action as Record<string, unknown>[];
    const swml = acts[0]['SWML'] as Record<string, unknown>;
    const sections = swml['sections'] as Record<string, unknown[]>;
    expect((sections['main'][0] as Record<string, unknown>)['join_room']).toEqual({ name: 'room1' });
  });

  it('sipRefer', () => {
    const r = new SwaigFunctionResult('ok').sipRefer('sip:user@example.com');
    const acts = r.toDict().action as Record<string, unknown>[];
    const swml = acts[0]['SWML'] as Record<string, unknown>;
    const sections = swml['sections'] as Record<string, unknown[]>;
    expect((sections['main'][0] as Record<string, unknown>)['sip_refer']).toEqual({ to_uri: 'sip:user@example.com' });
  });

  it('joinConference simple', () => {
    const r = new SwaigFunctionResult('ok').joinConference('conf1');
    const acts = r.toDict().action as Record<string, unknown>[];
    const swml = acts[0]['SWML'] as Record<string, unknown>;
    const sections = swml['sections'] as Record<string, unknown[]>;
    expect((sections['main'][0] as Record<string, unknown>)['join_conference']).toBe('conf1');
  });

  it('joinConference with options', () => {
    const r = new SwaigFunctionResult('ok').joinConference('conf1', { muted: true });
    const acts = r.toDict().action as Record<string, unknown>[];
    const swml = acts[0]['SWML'] as Record<string, unknown>;
    const sections = swml['sections'] as Record<string, unknown[]>;
    const params = (sections['main'][0] as Record<string, unknown>)['join_conference'] as Record<string, unknown>;
    expect(params['name']).toBe('conf1');
    expect(params['muted']).toBe(true);
  });

  it('executeRpc', () => {
    const r = new SwaigFunctionResult('ok').executeRpc({
      method: 'ai_message',
      callId: 'call-1',
      params: { role: 'system', message_text: 'hi' },
    });
    expect((r.toDict().action as unknown[]).length).toBe(1);
  });

  it('rpcDial / rpcAiMessage / rpcAiUnhold', () => {
    const r = new SwaigFunctionResult('ok')
      .rpcDial('+1555', '+1666', 'https://example.com/swml')
      .rpcAiMessage('call-1', 'hello')
      .rpcAiUnhold('call-1');
    expect((r.toDict().action as unknown[]).length).toBe(3);
  });

  it('executeSwml with string', () => {
    const swml = JSON.stringify({ version: '1.0.0', sections: { main: [] } });
    const r = new SwaigFunctionResult('ok').executeSwml(swml, true);
    const acts = r.toDict().action as Record<string, unknown>[];
    const action = acts[0]['SWML'] as Record<string, unknown>;
    expect(action['transfer']).toBe('true');
  });

  it('static payment helpers', () => {
    const action = SwaigFunctionResult.createPaymentAction('Say', 'Enter card');
    expect(action).toEqual({ type: 'Say', phrase: 'Enter card' });

    const prompt = SwaigFunctionResult.createPaymentPrompt('payment-card-number', [action]);
    expect(prompt['for']).toBe('payment-card-number');

    const param = SwaigFunctionResult.createPaymentParameter('k', 'v');
    expect(param).toEqual({ name: 'k', value: 'v' });
  });

  it('setPostProcess', () => {
    const r = new SwaigFunctionResult('hi').setPostProcess(true).hangup();
    expect(r.toDict().post_process).toBe(true);
  });
});
