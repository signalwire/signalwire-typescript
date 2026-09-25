/**
 * FunctionResult's structured response, hold routing and RPC global data.
 *
 * Mirrors signalwire-python 350fcca (tool_result/tool_prompt, hold(prompt,
 * timeout, step, timeout_step), rpc_ai_message global_data and
 * rpc_ai_global_data) and 2d0c6c5 (execute_swml's transfer beside the SWML
 * document; tap direction speak/listen/both, always emitted). The wire shapes
 * asserted here are the reference's to_dict() output.
 */

import { FunctionResult } from '../src/FunctionResult.js';

describe('structured response', () => {
  it('setToolResponse sends { tool_result, tool_prompt } as the response', () => {
    const r = new FunctionResult().setToolResponse(
      '3 seats left',
      'Tell the caller how many seats are left.',
    );
    expect(r.toDict()).toEqual({
      response: {
        tool_result: '3 seats left',
        tool_prompt: 'Tell the caller how many seats are left.',
      },
    });
  });

  it('includes only the fields that are set', () => {
    expect(new FunctionResult().setToolResponse(undefined, 'Say goodbye.').toDict()).toEqual({
      response: { tool_prompt: 'Say goodbye.' },
    });
    expect(new FunctionResult().setToolResponse('status: done').toDict()).toEqual({
      response: { tool_result: 'status: done' },
    });
  });

  it('treats an empty structured response as no response', () => {
    expect(new FunctionResult().setToolResponse().toDict()).toEqual({
      response: 'Action completed.',
    });
  });

  it('takes the structured form from the constructor', () => {
    expect(new FunctionResult(undefined, false, 'r', 'p').toDict()).toEqual({
      response: { tool_result: 'r', tool_prompt: 'p' },
    });
    expect(new FunctionResult({ tool_prompt: 'p' }).toDict()).toEqual({
      response: { tool_prompt: 'p' },
    });
  });

  it('setResponse replaces the structured form with a string', () => {
    const r = new FunctionResult().setToolResponse('r', 'p').setResponse('plain');
    expect(r.toDict()).toEqual({ response: 'plain' });
    expect(r.response).toBe('plain');
  });
});

describe('hold', () => {
  const holdAction = (r: FunctionResult) =>
    (r.toDict().action as Record<string, unknown>[])[0]!['hold'];

  it('keeps the bare timeout forms: hold(), hold(120), clamped to 0-900', () => {
    expect(holdAction(new FunctionResult().hold())).toBe(300);
    expect(holdAction(new FunctionResult().hold(120))).toBe(120);
    expect(holdAction(new FunctionResult().hold(5000))).toBe(900);
    expect(holdAction(new FunctionResult().hold(-5))).toBe(0);
  });

  it('a prompt becomes the structured response and turns on post_process', () => {
    const d = new FunctionResult()
      .hold('Tell the caller you are placing them on hold.', 120)
      .toDict();
    expect(d).toEqual({
      response: {
        tool_result: 'status: on hold',
        tool_prompt: 'Tell the caller you are placing them on hold.',
      },
      action: [{ hold: 120 }],
      post_process: true,
    });
  });

  it('routes to steps when the hold ends', () => {
    const d = new FunctionResult()
      .hold('Tell the caller you are checking.', 5000, 'back_with_agent', 'take_a_message')
      .toDict();
    expect(d.action).toEqual([
      { hold: { timeout: 900, step: 'back_with_agent', timeout_step: 'take_a_message' } },
    ]);
  });

  it('emits only the step it is given', () => {
    const d = new FunctionResult().hold(undefined, 60, undefined, 'take_a_message').toDict();
    expect(d.action).toEqual([{ hold: { timeout: 60, timeout_step: 'take_a_message' } }]);
  });
});

describe('RPC to another call', () => {
  const rpcParams = (r: FunctionResult) =>
    JSON.parse(JSON.stringify(r.toDict())) as Record<string, unknown>;

  it('rpcAiMessage with text sends role and message_text, as before', () => {
    const d = JSON.stringify(
      rpcParams(new FunctionResult().rpcAiMessage('call-abc', 'Take a message.')),
    );
    expect(d).toContain('"role":"system"');
    expect(d).toContain('"message_text":"Take a message."');
    expect(d).not.toContain('global_data');
  });

  it('rpcAiMessage with only global data sends no role or message', () => {
    const d = JSON.stringify(
      rpcParams(new FunctionResult().rpcAiMessage('call-abc', null, 'system', { decline: 'no' })),
    );
    expect(d).toContain('"global_data":{"decline":"no"}');
    expect(d).not.toContain('message_text');
    expect(d).not.toContain('"role"');
  });

  it('rpcAiGlobalData is rpcAiMessage with only global data', () => {
    expect(new FunctionResult().rpcAiGlobalData('c', { k: 1 }).toDict()).toEqual(
      new FunctionResult().rpcAiMessage('c', undefined, 'system', { k: 1 }).toDict(),
    );
  });

  it('refuses an RPC message with neither text nor data', () => {
    expect(() => new FunctionResult().rpcAiMessage('c')).toThrow(
      'rpc_ai_message needs message_text, global_data, or both',
    );
  });
});

describe('wire fixes', () => {
  it('execute_swml puts transfer beside the SWML document', () => {
    const d = new FunctionResult()
      .executeSwml({ version: '1.0.0', sections: { main: [] } }, true)
      .toDict();
    expect(d.action).toEqual([
      { SWML: { version: '1.0.0', sections: { main: [] } }, transfer: 'true' },
    ]);
  });

  it('tap always sends its direction, both by default', () => {
    const tapParams = (r: FunctionResult) =>
      (
        ((r.toDict().action as Record<string, unknown>[])[0]!['SWML'] as Record<string, unknown>)[
          'sections'
        ] as { main: Record<string, Record<string, unknown>>[] }
      ).main[0]!['tap']!;
    expect(tapParams(new FunctionResult().tap({ uri: 'rtp://10.0.0.1:5004' }))['direction']).toBe(
      'both',
    );
    expect(
      tapParams(new FunctionResult().tap({ uri: 'ws://x', direction: 'listen' }))['direction'],
    ).toBe('listen');
  });

  it('tap refuses a direction the engine does not accept', () => {
    expect(() =>
      new FunctionResult().tap({ uri: 'ws://x', direction: 'hear' as unknown as 'listen' }),
    ).toThrow("direction must be one of ['speak', 'listen', 'both']");
  });
});
