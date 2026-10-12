/**
 * The semantic gate params on the agent, and the actions that go with gates:
 * setSemanticState and changeVoice. Mirrors the Python SDK's
 * TestFunctionResultActions and TestSemanticGateParams.
 */
import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;

function paramsOf(agent: AgentBase): Json {
  const doc = JSON.parse(agent.renderSwml()) as Json;
  return doc['sections']['main'].find((v: Json) => 'ai' in v)['ai']['params'] ?? {};
}

function agent(): AgentBase {
  const a = new AgentBase({ name: 'gated', route: '/', basicAuth: ['u', 'p'] });
  a.setPromptText('Gated.');
  return a;
}

describe('FunctionResult actions for gates', () => {
  it('changeVoice sends change_voice', () => {
    expect(new FunctionResult('ok').changeVoice('elevenlabs.rachel').toDict()['action']).toEqual([
      { change_voice: 'elevenlabs.rachel' },
    ]);
  });

  it.each(['', '   '])('changeVoice refuses an empty voice: %j', (voice) => {
    expect(() => new FunctionResult('ok').changeVoice(voice)).toThrow(
      'voice must be a non-empty string',
    );
  });

  it('setSemanticState replaces global_data.semantic_state whole', () => {
    const result = new FunctionResult('ok')
      .setSemanticState({ order: { item: 'large pepperoni', confirmed: true } })
      .setSemanticState({});
    expect(result.toDict()['action']).toEqual([
      {
        set_global_data: {
          semantic_state: { order: { item: 'large pepperoni', confirmed: true } },
        },
      },
      { set_global_data: { semantic_state: {} } },
    ]);
  });
});

describe('setSemanticGates', () => {
  it('sends each param', () => {
    const a = agent().setSemanticGates({ enabled: false, timeoutMs: 4000, history: 30 });
    expect(paramsOf(a)).toMatchObject({
      semantic_gates_enabled: false,
      semantic_gate_timeout_ms: 4000,
      semantic_gate_history: 30,
    });
  });

  it('leaves out the params it is not given, keeping the platform default', () => {
    const params = paramsOf(agent().setSemanticGates({ history: 0 }));
    expect(params['semantic_gate_history']).toBe(0);
    expect(params).not.toHaveProperty('semantic_gates_enabled');
    expect(params).not.toHaveProperty('semantic_gate_timeout_ms');
    expect(paramsOf(agent().setSemanticGates())).not.toHaveProperty('semantic_gates_enabled');
  });

  it('accepts the ends of each range', () => {
    const params = paramsOf(agent().setSemanticGates({ timeoutMs: 500, history: 100 }));
    expect(params['semantic_gate_timeout_ms']).toBe(500);
    expect(params['semantic_gate_history']).toBe(100);
    expect(
      paramsOf(agent().setSemanticGates({ timeoutMs: 10000 }))['semantic_gate_timeout_ms'],
    ).toBe(10000);
  });

  it.each<[Record<string, unknown>, string]>([
    [{ timeoutMs: 499 }, 'timeout_ms must be an integer from 500 to 10000, got 499'],
    [{ timeoutMs: 10001 }, 'timeout_ms must be an integer from 500 to 10000, got 10001'],
    [{ timeoutMs: 2500.5 }, 'timeout_ms must be an integer from 500 to 10000, got 2500.5'],
    [{ timeoutMs: '2500' }, 'timeout_ms must be an integer from 500 to 10000, got "2500"'],
    [{ history: -1 }, 'history must be an integer from 0 to 100, got -1'],
    [{ history: 101 }, 'history must be an integer from 0 to 100, got 101'],
    [{ history: true }, 'history must be an integer from 0 to 100, got true'],
    [{ enabled: 'yes' }, 'enabled must be a boolean, got "yes"'],
  ])('refuses %j', (opts, message) => {
    expect(() => agent().setSemanticGates(opts as never)).toThrow(message);
  });

  it('changes nothing when it refuses a value', () => {
    const a = agent();
    expect(() => a.setSemanticGates({ enabled: false, timeoutMs: 1 })).toThrow();
    expect(paramsOf(a)).not.toHaveProperty('semantic_gates_enabled');
  });
});
