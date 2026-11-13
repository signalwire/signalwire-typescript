/**
 * The agent settings and actions semantic gates gained in signalwire-python
 * 3.8.0: the agent's gate dialogue, the unavailable-function reply, and the
 * gate-mark and back-to-back-functions actions.
 */
import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

const params = (agent: AgentBase) =>
  (agent as unknown as { params: Record<string, unknown> }).params;

describe('the agent gate dialogue', () => {
  it('sets semantic_gate_dialogue', () => {
    const agent = new AgentBase({ name: 'a' }).setSemanticGates({
      dialogue: 'proposal',
      history: 8,
    });
    expect(params(agent)).toMatchObject({
      semantic_gate_dialogue: 'proposal',
      semantic_gate_history: 8,
    });
  });

  it.each(['recent', 'Proposal', 1])('refuses %j', (dialogue) => {
    expect(() =>
      new AgentBase({ name: 'a' }).setSemanticGates({ dialogue: dialogue as 'window' }),
    ).toThrow('dialogue must be one of');
  });
});

describe('setUnavailableFunctionResponse', () => {
  it('sets unavailable_function_response', () => {
    const agent = new AgentBase({ name: 'a' }).setUnavailableFunctionResponse(
      "Nothing ran: ${function} isn't offered now. Use one of ${tools}.",
    );
    expect(String(params(agent)['unavailable_function_response'])).toMatch(/^Nothing ran/);
  });

  it('refuses empty text', () => {
    expect(() => new AgentBase({ name: 'a' }).setUnavailableFunctionResponse('')).toThrow();
  });
});

describe('the gate-mark action', () => {
  it('sets semantic_gate_mark', () => {
    expect(
      new FunctionResult('Read it back.').setSemanticGateMark('read_back').toDict().action,
    ).toEqual([{ semantic_gate_mark: 'read_back' }]);
  });

  it.each(['no spaces allowed', '', 'x'.repeat(65)])('refuses %j', (name) => {
    expect(() => new FunctionResult('x').setSemanticGateMark(name)).toThrow('mark name');
  });
});

describe('backToBackFunctions', () => {
  it.each([
    [undefined, true],
    [true, true],
    [false, false],
    ['forever', 'forever'],
  ] as const)('sends %j as %j', (value, sent) => {
    const result =
      value === undefined
        ? new FunctionResult('x').backToBackFunctions()
        : new FunctionResult('x').backToBackFunctions(value);
    expect(result.toDict().action).toEqual([{ back_to_back_functions: sent }]);
  });

  it.each(['always', 1, null])('refuses %j', (value) => {
    expect(() => new FunctionResult('x').backToBackFunctions(value as unknown as boolean)).toThrow(
      'back_to_back_functions takes',
    );
  });
});

describe('refreshStep', () => {
  it('enters the current step again', () => {
    const result = new FunctionResult('Added the drink.')
      .updateGlobalData({ order_total: '$14.50' })
      .refreshStep('take_order');
    expect(result.toDict().action).toEqual([
      { set_global_data: { order_total: '$14.50' } },
      { change_step: 'take_order' },
    ]);
  });
});
