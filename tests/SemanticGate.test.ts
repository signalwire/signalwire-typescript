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
  _checkGatedFunction,
  _cjsonPrintedLength,
  applyGateFields,
  gateDefinitions,
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
    expect(() => gateDefinitions([g], 'refund')).toThrow('on_fail.response.tool_result is missing');
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
    expect(() => gateDefinitions(gates as never, 'refund')).toThrow(reason);
  });

  it('prefixes each refusal with the function name', () => {
    expect(() => gateDefinitions([], 'refund')).toThrow(/^refund: gates must hold/);
  });

  it('refuses gates that are not a list', () => {
    expect(() => gateDefinitions(gate() as never, 'refund')).toThrow(
      'refund: gates must be a list',
    );
  });

  it('accepts the limits themselves', () => {
    const gates = Array.from({ length: MAX_GATES }, (_, i) => gate({ id: `g${i}` }));
    gates[0] = gate({
      id: 'x'.repeat(64),
      question: 'q'.repeat(8192),
      threshold: 1,
      criteria: { true: 't'.repeat(2048), false: 'f' },
    });
    expect(gateDefinitions(gates, 'refund')).toHaveLength(8);
  });

  it('accepts an on_fail of exactly 8192 bytes of compact JSON', () => {
    // {"response":"..."} is 15 bytes around the text
    const onFail = { response: 'x'.repeat(8192 - 15) };
    expect(JSON.stringify(onFail)).toHaveLength(8192);
    expect(gateDefinitions([gate({ on_fail: onFail })], 'refund')).toHaveLength(1);
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
    expect(() => gateDefinitions([gate()], name)).toThrow('hook or built-in function name');
  });

  it('returns copies, not the caller objects', () => {
    const input = gate();
    const [out] = gateDefinitions([input], 'refund');
    (out!['on_fail'] as Record<string, unknown>)['response'] = 'changed';
    expect((input['on_fail'] as Record<string, unknown>)['response']).toBe('refund was not run.');
  });
});

describe('applyGateFields', () => {
  it('normalizes SemanticGate objects into the objects the platform reads', () => {
    const fields: Record<string, unknown> = {
      gates: [new SemanticGate('Q?', 0.5, 'no')],
      gate_fillers: { 'en-US': ['One moment.'] },
    };
    applyGateFields(fields, 'refund');
    expect(fields).toEqual({
      gates: [{ question: 'Q?', threshold: 0.5, on_fail: { response: 'no' } }],
      gate_fillers: { 'en-US': ['One moment.'] },
    });
  });

  it('drops an omitted gates, and an omitted or null gate_fillers', () => {
    const fields: Record<string, unknown> = { gates: undefined, gate_fillers: null, other: 1 };
    applyGateFields(fields, 'refund');
    expect(fields).toEqual({ other: 1 });
  });

  it('refuses gates: null, which the platform refuses rather than run the function ungated', () => {
    expect(() => applyGateFields({ gates: null }, 'refund')).toThrow(
      'refund: gates must be a list',
    );
  });

  it('refuses gate_fillers without gates', () => {
    expect(() => applyGateFields({ gate_fillers: { 'en-US': ['x'] } }, 'refund')).toThrow(
      'refund: gate_fillers needs gates',
    );
  });

  it('refuses gate_fillers that are not an object', () => {
    expect(() => applyGateFields({ gates: [gate()], gate_fillers: ['x'] }, 'refund')).toThrow(
      "gate_fillers must map a language code, 'auto' or 'default' to a list of phrases",
    );
  });
});

describe('on_fail as the platform reads it (cJSON)', () => {
  it('measures numbers as cJSON prints them, not as JSON.stringify does', () => {
    // 0.5 is "0.5" in JSON but "0.500000" from cJSON: 5 bytes more
    const pad = (n: number) => ({
      response: 'x'.repeat(n),
      action: [{ set_global_data: { amount: 0.5 } }],
    });
    const base = JSON.stringify(pad(0)).length;
    const atLimit = pad(8192 - base);
    expect(JSON.stringify(atLimit)).toHaveLength(8192);
    expect(_cjsonPrintedLength(atLimit)).toBe(8197);
    expect(() => gateDefinitions([gate({ on_fail: atLimit })], 'refund')).toThrow(
      'on_fail is larger than 8192 bytes',
    );
  });

  it('accepts what cJSON prints shorter than JSON.stringify does', () => {
    // 1.23456789 prints as 1.234568
    const value = {
      response: 'x',
      action: [{ set_global_data: { amount: 1.23456789 } }],
    };
    expect(_cjsonPrintedLength(value)).toBe(JSON.stringify(value).length - 2);
    const big = { ...value, response: 'x'.repeat(8192 - _cjsonPrintedLength(value) + 1) };
    expect(JSON.stringify(big).length).toBeGreaterThan(8192);
    expect(_cjsonPrintedLength(big)).toBe(8192);
    expect(gateDefinitions([gate({ on_fail: big })], 'refund')).toHaveLength(1);
  });

  it('counts escapes, control characters and multibyte text as cJSON does', () => {
    expect(_cjsonPrintedLength('a"b')).toBe(6);
    expect(_cjsonPrintedLength('\u0001')).toBe(8);
    expect(_cjsonPrintedLength('é')).toBe(4);
    expect(_cjsonPrintedLength('/')).toBe(3);
    expect(_cjsonPrintedLength([1, true, null])).toBe('[1,true,null]'.length);
    expect(_cjsonPrintedLength({ a: -2 })).toBe('{"a":-2}'.length);
    expect(_cjsonPrintedLength(1e-7)).toBe('0.000000'.length);
  });

  it('finds response and action without regard to case, as cJSON does', () => {
    expect(gateDefinitions([gate({ on_fail: { Response: 'no' } })], 'refund')).toHaveLength(1);
    expect(() =>
      gateDefinitions([gate({ on_fail: { response: 'no', ACTION: {} } })], 'refund'),
    ).toThrow('on_fail.action must be an array');
    expect(() =>
      gateDefinitions([gate({ on_fail: { response: { Tool_Result: '' } } })], 'refund'),
    ).toThrow('on_fail.response.tool_result is missing or empty');
  });

  it('keeps the gate and criteria keys exact', () => {
    expect(() => gateDefinitions([gate({ Question: 'Q?' })], 'refund')).toThrow(
      "unknown key 'Question'",
    );
    expect(() => gateDefinitions([gate({ criteria: { True: 'x' } })], 'refund')).toThrow(
      "criteria has an unknown key 'True'",
    );
  });

  it.each<[Record<string, unknown>, string]>([
    [{ question: 'Q\0?' }, 'question contains a NUL character'],
    [{ question: '\0' }, 'question contains a NUL character'],
    [{ on_fail: { response: 'no\0' } }, 'on_fail contains a NUL character'],
    [{ criteria: { true: 'yes\0' } }, 'criteria.true contains a NUL character'],
    [{ question: 'Q \uD800?' }, 'question contains an unpaired surrogate'],
    [{ on_fail: { response: 'no \uDC00' } }, 'on_fail contains an unpaired surrogate'],
  ])('refuses text the platform would read differently: %j', (overrides, reason) => {
    expect(() => gateDefinitions([gate(overrides)], 'refund')).toThrow(reason);
  });

  it('accepts a well-formed surrogate pair', () => {
    expect(gateDefinitions([gate({ question: 'Q 😀?' })], 'refund')).toHaveLength(1);
  });
});

describe('on_fail from a FunctionResult', () => {
  it('refuses an empty result and an action-only result', () => {
    expect(() => new SemanticGate('Q?', 0.5, new FunctionResult())).toThrow(
      'on_fail needs a response',
    );
    expect(() => new SemanticGate('Q?', 0.5, new FunctionResult().addAction('say', 'hi'))).toThrow(
      'on_fail needs a response',
    );
  });

  it('takes a structured response', () => {
    const result = new FunctionResult(undefined, false, 'not run.', 'Ask again.');
    expect(new SemanticGate('Q?', 0.5, result).onFail).toEqual({
      response: { tool_result: 'not run.', tool_prompt: 'Ask again.' },
    });
  });

  it('takes an explicitly written "Action completed." as the response', () => {
    const result = new FunctionResult('Action completed.');
    expect(new SemanticGate('Q?', 0.5, result).onFail).toEqual({ response: 'Action completed.' });
  });
});

describe('_checkGatedFunction', () => {
  const fn = (overrides: Record<string, unknown> = {}) => ({
    function: 'refund',
    description: 'Refund an order',
    web_hook_url: 'https://example.com/swaig',
    gates: [gate()],
    ...overrides,
  });

  it('passes a complete gated function', () => {
    expect(() => _checkGatedFunction(fn())).not.toThrow();
  });

  it('takes purpose for description, and data_map or the default URL for web_hook_url', () => {
    expect(() =>
      _checkGatedFunction(fn({ description: undefined, purpose: 'Refund an order' })),
    ).not.toThrow();
    expect(() =>
      _checkGatedFunction(fn({ web_hook_url: undefined, data_map: { output: {} } })),
    ).not.toThrow();
    expect(() =>
      _checkGatedFunction(fn({ web_hook_url: undefined }), 'https://example.com/swaig'),
    ).not.toThrow();
  });

  it.each<[Record<string, unknown>]>([
    [{ description: undefined }],
    [{ description: '' }],
    [{ web_hook_url: undefined }],
  ])('refuses a gated function the platform would not register: %j', (overrides) => {
    expect(() => _checkGatedFunction(fn(overrides))).toThrow(
      'a gated function needs a name, a description, and a web_hook_url or data_map',
    );
  });

  it('checks the gates under the name that is sent', () => {
    expect(() => _checkGatedFunction(fn({ function: 'end_call' }))).toThrow(
      'gates are not supported on end_call',
    );
  });

  it('leaves an ungated function alone', () => {
    const plain = { function: 'refund', description: 'Refund' };
    _checkGatedFunction(plain);
    expect(plain).toEqual({ function: 'refund', description: 'Refund' });
  });
});
