/**
 * Semantic gates: building them, and the platform's rules for them.
 *
 * The platform refuses a whole function when any of its gates breaks a rule
 * (mod_openai semantic_gates.c), so the SDK checks gates by the same rules when
 * a tool is defined. These tests follow those rules one by one, as the Python
 * SDK's test_semantic_gates.py does.
 */
import { FunctionResult } from '../src/FunctionResult.js';
import {
  SemanticGate,
  _applyGateFields,
  _gateDefinitions,
  MAX_GATES,
  RESERVED_FUNCTION_NAMES,
} from '../src/SemanticGate.js';

function gate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    question: 'Has the caller asked for a refund in `conversation`?',
    threshold: 0.9,
    on_fail: { response: 'refund was not run.' },
    ...overrides,
  };
}

describe('SemanticGate', () => {
  it('takes a string on_fail as the response', () => {
    expect(new SemanticGate('Q in `conversation`?', 0.9, 'refund was not run.').toDict()).toEqual({
      question: 'Q in `conversation`?',
      threshold: 0.9,
      on_fail: { response: 'refund was not run.' },
    });
  });

  it('writes every field, in the order the platform documents', () => {
    const result = new FunctionResult(
      undefined,
      false,
      'cancel_account was not run.',
      'Ask the caller to confirm that they want to cancel.',
    ).updateGlobalData({ cancel_attempted: true });
    const dict = new SemanticGate(
      'Has the caller explicitly asked to cancel in `conversation`?',
      0.95,
      result,
      {
        trueMeans: 'The caller says they want to cancel.',
        falseMeans: 'The caller asked about cancelling, or said something else.',
        id: 'explicit_request',
      },
    ).toDict();
    expect(dict).toEqual({
      id: 'explicit_request',
      question: 'Has the caller explicitly asked to cancel in `conversation`?',
      criteria: {
        true: 'The caller says they want to cancel.',
        false: 'The caller asked about cancelling, or said something else.',
      },
      threshold: 0.95,
      on_fail: {
        response: {
          tool_result: 'cancel_account was not run.',
          tool_prompt: 'Ask the caller to confirm that they want to cancel.',
        },
        action: [{ set_global_data: { cancel_attempted: true } }],
      },
    });
    expect(Object.keys(dict)).toEqual(['id', 'question', 'criteria', 'threshold', 'on_fail']);
  });

  it('keeps post_process with actions', () => {
    const result = new FunctionResult('not run.', true).updateGlobalData({ a: 1 });
    const onFail = new SemanticGate('Q?', 0.5, result).toDict()['on_fail'] as Record<
      string,
      unknown
    >;
    expect(onFail['post_process']).toBe(true);
  });

  it('leaves post_process out without actions', () => {
    const onFail = new SemanticGate('Q?', 0.5, new FunctionResult('not run.', true)).toDict()[
      'on_fail'
    ];
    expect(onFail).toEqual({ response: 'not run.' });
  });

  it('refuses a result without a response, which would read as a success', () => {
    expect(
      () => new SemanticGate('Q?', 0.5, new FunctionResult().updateGlobalData({ a: 1 })),
    ).toThrow('on_fail needs a response');
    expect(() => new SemanticGate('Q?', 0.5, '')).toThrow('on_fail needs a response');
  });

  it('refuses a tool_prompt without a tool_result when the gate is defined', () => {
    const g = new SemanticGate(
      'Q?',
      0.5,
      new FunctionResult(undefined, false, undefined, 'Ask again.'),
    );
    expect(() => _gateDefinitions([g], 'refund')).toThrow(
      'on_fail.response.tool_result is missing',
    );
  });

  it('copies on_fail, so a later change to the source does not reach the gate', () => {
    const onFail = { response: 'no' };
    const g = new SemanticGate('Q?', 0.5, onFail);
    const dict = g.toDict();
    (dict['on_fail'] as Record<string, unknown>)['response'] = 'changed';
    expect(g.toDict()['on_fail']).toEqual({ response: 'no' });
  });
});

describe('the platform rules', () => {
  const nine = Array.from({ length: 9 }, (_, i) => gate({ id: `g${i}` }));
  it.each<[unknown[], string]>([
    [[], 'gates must hold 1 to 8 gates, not 0'],
    [nine, 'gates must hold 1 to 8 gates, not 9'],
    [[gate({ gate: 'x' })], "gate 1: unknown key 'gate'"],
    [[gate({ Threshold: 0.5 })], "gate 1: unknown key 'Threshold'"],
    [[gate({ question: '' })], 'gate 1: question is missing or empty'],
    [[gate({ question: 'é'.repeat(4097) })], 'gate 1: question is longer than 8192 bytes'],
    [[gate({ threshold: 0 })], 'threshold must be a number above 0 and at most 1'],
    [[gate({ threshold: 1.01 })], 'threshold must be a number above 0 and at most 1'],
    [[gate({ threshold: true })], 'threshold must be a number above 0 and at most 1'],
    [[gate({ threshold: '0.9' })], 'threshold must be a number above 0 and at most 1'],
    [[gate({ threshold: Number.NaN })], 'threshold must be a number above 0 and at most 1'],
    [[{ question: 'Q?', threshold: 0.5 }], 'gate 1: on_fail is missing'],
    [[gate({ on_fail: 'no' })], 'gate 1: on_fail must be an object'],
    [[gate({ on_fail: ['no'] })], 'gate 1: on_fail must be an object'],
    [[gate({ on_fail: {} })], 'gate 1: on_fail.response is missing'],
    [[gate({ on_fail: { response: '' } })], 'gate 1: on_fail.response is empty'],
    [
      [gate({ on_fail: { response: { tool_prompt: 'x' } } })],
      'on_fail.response.tool_result is missing or empty',
    ],
    [
      [gate({ on_fail: { response: { tool_result: 'no', tool_prompt: 1 } } })],
      'on_fail.response.tool_prompt must be a string',
    ],
    [
      [gate({ on_fail: { response: 'no', action: { say: 'x' } } })],
      'on_fail.action must be an array',
    ],
    [[gate({ on_fail: { response: 'é'.repeat(4100) } })], 'on_fail is larger than 8192 bytes'],
    [[gate({ criteria: {} })], 'criteria must be an object with true and/or false'],
    [[gate({ criteria: { yes: 'x' } })], "criteria has an unknown key 'yes'"],
    [[gate({ criteria: { true: '' } })], 'criteria.true must be a non-empty string'],
    [[gate({ criteria: { false: 'x'.repeat(2049) } })], 'criteria.false is longer than 2048 bytes'],
    [[gate({ id: 'has space' })], 'id must be 1 to 64 letters, digits or underscores'],
    [[gate({ id: 'x'.repeat(65) })], 'id must be 1 to 64 letters, digits or underscores'],
    [[gate({ id: 7 })], 'id must be 1 to 64 letters, digits or underscores'],
    [[gate({ id: 'same' }), gate({ id: 'same' })], "gate 2: id 'same' is already used by gate 1"],
    // An explicit id equal to a generated one is a collision too
    [[gate(), gate({ id: 'gate_1' })], "gate 2: id 'gate_1' is already used by gate 1"],
    [['not a gate'], 'gate 1: must be an object'],
  ])('refuses %#: %s', (gates, reason) => {
    expect(() => _gateDefinitions(gates, 'refund')).toThrow(reason);
  });

  it('prefixes each refusal with the function name', () => {
    expect(() => _gateDefinitions([], 'refund')).toThrow(/^refund: gates must hold/);
  });

  it('refuses gates that are not a list', () => {
    expect(() => _gateDefinitions(gate(), 'refund')).toThrow('refund: gates must be a list');
  });

  it('accepts the limits themselves', () => {
    const gates = Array.from({ length: MAX_GATES }, (_, i) => gate({ id: `g${i}` }));
    gates[0] = gate({
      id: 'x'.repeat(64),
      question: 'q'.repeat(8192),
      threshold: 1,
      criteria: { true: 't'.repeat(2048), false: 'f' },
    });
    expect(_gateDefinitions(gates, 'refund')).toHaveLength(8);
  });

  it('accepts an on_fail of exactly 8192 bytes of compact JSON', () => {
    // {"response":"..."} is 15 bytes around the text
    const onFail = { response: 'x'.repeat(8192 - 15) };
    expect(JSON.stringify(onFail)).toHaveLength(8192);
    expect(_gateDefinitions([gate({ on_fail: onFail })], 'refund')).toHaveLength(1);
  });

  it.each([
    'startup_hook',
    'hangup_hook',
    'check_for_input',
    'end_call',
    'hangup',
    'wait_for_user',
    'next_step',
    'change_context',
    'pause_conversation',
  ])('refuses gates on %s, a hook or built-in name', (name) => {
    expect(RESERVED_FUNCTION_NAMES.has(name)).toBe(true);
    expect(() => _gateDefinitions([gate()], name)).toThrow('hook or built-in function name');
  });

  it('returns copies, not the caller objects', () => {
    const input = gate();
    const [out] = _gateDefinitions([input], 'refund');
    (out!['on_fail'] as Record<string, unknown>)['response'] = 'changed';
    expect((input['on_fail'] as Record<string, unknown>)['response']).toBe('refund was not run.');
  });
});

describe('_applyGateFields', () => {
  it('normalizes SemanticGate objects into the objects the platform reads', () => {
    const fields: Record<string, unknown> = {
      gates: [new SemanticGate('Q?', 0.5, 'no')],
      gate_fillers: { 'en-US': ['One moment.'] },
    };
    _applyGateFields(fields, 'refund');
    expect(fields).toEqual({
      gates: [{ question: 'Q?', threshold: 0.5, on_fail: { response: 'no' } }],
      gate_fillers: { 'en-US': ['One moment.'] },
    });
  });

  it('drops an undefined or null gates and gate_fillers', () => {
    const fields: Record<string, unknown> = { gates: null, gate_fillers: undefined, other: 1 };
    _applyGateFields(fields, 'refund');
    expect(fields).toEqual({ other: 1 });
  });

  it('refuses gate_fillers without gates', () => {
    expect(() => _applyGateFields({ gate_fillers: { 'en-US': ['x'] } }, 'refund')).toThrow(
      'refund: gate_fillers needs gates',
    );
  });

  it('refuses gate_fillers that are not an object', () => {
    expect(() => _applyGateFields({ gates: [gate()], gate_fillers: ['x'] }, 'refund')).toThrow(
      "gate_fillers must map a language code, 'auto' or 'default' to a list of phrases",
    );
  });
});
