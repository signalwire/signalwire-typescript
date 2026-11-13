/**
 * Step and tool options the platform reads, from signalwire-python 3.8.0:
 * expected_answer (speech_detect.c expected_answer_json), the steps that offer
 * a tool, and, in later sections, nullable optional arguments and native tools.
 */
import { AgentBase } from '../src/AgentBase.js';
import {
  GatherQuestion,
  Step,
  expectedAnswer,
  MAX_EXPECTED_DIGITS,
} from '../src/ContextBuilder.js';
import { Logger } from '../src/Logger.js';

describe('expected_answer', () => {
  it('sends an exact count', () => {
    expect(
      new Step('zip').setText('Ask for the ZIP code.').setExpectedAnswer(5).toDict()
        .expected_answer,
    ).toEqual({ digits: 5 });
  });

  it('sends a range', () => {
    const step = new Step('pin')
      .setText('Ask for the PIN.')
      .setExpectedAnswer(undefined, { minDigits: 4, maxDigits: 6 });
    expect(step.toDict().expected_answer).toEqual({ min_digits: 4, max_digits: 6 });
  });

  it('sends none when unset', () => {
    expect('expected_answer' in new Step('s').setText('t').toDict()).toBe(false);
  });

  it("sends a gather question's own", () => {
    const step = new Step('collect').setText('t');
    step.setGatherInfo({ outputKey: 'caller' });
    step.addGatherQuestion({
      key: 'zip',
      question: 'Your ZIP code?',
      expectedAnswer: { digits: 5 },
    });
    step.addGatherQuestion({ key: 'name', question: 'Your name?' });
    const questions = step.toDict().gather_info!.questions as Array<Record<string, unknown>>;
    expect(questions[0]!['expected_answer']).toEqual({ digits: 5 });
    expect('expected_answer' in questions[1]!).toBe(false);
  });

  it.each([
    [[0], 'digits must be a whole number from 1 to 64'],
    [[65], 'digits must be a whole number from 1 to 64'],
    [[2.5], 'digits must be a whole number from 1 to 64'],
    [[5, { maxDigits: 6 }], 'not both'],
    [[undefined, { minDigits: 4 }], 'needs digits, or both min_digits and max_digits'],
    [[], 'needs digits, or both min_digits and max_digits'],
    [[undefined, { minDigits: 6, maxDigits: 4 }], 'min_digits (6) must be at most max_digits (4)'],
  ] as const)('refuses %j', (args, message) => {
    expect(() => (expectedAnswer as (...a: unknown[]) => unknown)(...args)).toThrow(message);
  });

  it.each([{}, { digit: 5 }, { digits: 5, extra: 1 }, '5'])(
    'checks a question dict: refuses %j',
    (given) => {
      expect(
        () =>
          new GatherQuestion({
            key: 'zip',
            question: 'ZIP?',
            expectedAnswer: given as { digits: number },
          }),
      ).toThrow('expected_answer must be');
    },
  );

  it('exports the limit', () => {
    expect(MAX_EXPECTED_DIGITS).toBe(64);
  });
});

describe('the steps that offer a tool', () => {
  function agentWithSteps(everyStepLists: boolean): AgentBase {
    const agent = new AgentBase({ name: 'options', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('x');
    for (const name of ['find_store', 'place_order', 'audit_log']) {
      agent.defineTool({ name, description: name, handler: () => 'ok' });
    }
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('greet').setText('Greet').setFunctions(['find_store']);
    const collect = ctx.addStep('collect').setText('Collect');
    if (everyStepLists) collect.setFunctions('none');
    collect.setGatherInfo({ outputKey: 'order' });
    collect.addGatherQuestion({ key: 'item', question: 'What item?', functions: ['place_order'] });
    ctx.addStep('confirm').setText('Confirm').setFunctions(['place_order']);
    return agent;
  }

  const builder = (agent: AgentBase) => agent.defineContexts();

  it('names the steps that list the tool', () => {
    const agent = agentWithSteps(true);
    expect(builder(agent).stepsOffering('place_order')).toEqual([
      ['default', 'collect'],
      ['default', 'confirm'],
    ]);
    expect(builder(agent).stepsOffering('find_store')).toEqual([['default', 'greet']]);
    expect(builder(agent).stepsOffering('audit_log')).toEqual([]);
  });

  it('logs a tool no step offers, once', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    try {
      const agent = agentWithSteps(true);
      agent.renderSwml();
      agent.renderSwml();
      const calls = warn.mock.calls.filter((c) => c[0] === 'tool_offered_by_no_step');
      expect(calls).toHaveLength(1);
      expect(calls[0]![1]).toMatchObject({ function: 'audit_log' });
    } finally {
      warn.mockRestore();
    }
  });

  it("doesn't warn when a step inherits its functions", () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    try {
      agentWithSteps(false).renderSwml();
      expect(warn.mock.calls.filter((c) => c[0] === 'tool_offered_by_no_step')).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });
});

const SIZES = {
  type: 'object',
  properties: {
    item: { type: 'string', description: 'The item' },
    size: { type: 'string', enum: ['small', 'large'], description: 'Size' },
    note: { type: ['string'], description: 'A note' },
    extras: { anyOf: [{ type: 'string' }, { type: 'array' }] },
  },
  required: ['item'],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;

function toolsAgent(): AgentBase {
  const a = new AgentBase({ name: 'options', route: '/', basicAuth: ['u', 'p'] });
  a.setPromptText('x');
  return a;
}
function fnOf(a: AgentBase, name: string): Json {
  const main = JSON.parse(a.renderSwml())['sections']['main'] as Json[];
  const ai = main.find((v) => 'ai' in v)!['ai'] as Json;
  return (ai['SWAIG']['functions'] as Json[]).find((f) => f['function'] === name)!;
}
async function call(a: AgentBase, name: string, args: Json): Promise<Json> {
  const fn = a.getTool(name) as import('../src/SwaigFunction.js').SwaigFunction;
  return (await fn._executeAs(a, args, {} as never)) as Json;
}

describe('nullable optional arguments', () => {
  function define(a: AgentBase, calls: Json[], nullableOptional?: boolean): void {
    a.defineTool({
      name: 'add_item',
      description: 'Add an item',
      parameters: JSON.parse(JSON.stringify(SIZES)),
      ...(nullableOptional === undefined ? {} : { nullableOptional }),
      handler: (args) => {
        calls.push(args);
        return 'added';
      },
    });
  }

  it('lets optional arguments take null', () => {
    const a = toolsAgent();
    define(a, [], true);
    const properties = fnOf(a, 'add_item')['parameters']['properties'];
    expect(properties['item']).toEqual(SIZES.properties.item);
    expect(properties['size']['type']).toEqual(['string', 'null']);
    expect(properties['size']['enum']).toEqual(['small', 'large', null]);
    expect(properties['note']['type']).toEqual(['string', 'null']);
    expect(properties['extras']).toEqual(SIZES.properties.extras);
  });

  it('hands a null to the handler as an argument not given', async () => {
    const calls: Json[] = [];
    const a = toolsAgent();
    define(a, calls, true);
    await call(a, 'add_item', { item: 'tea', size: null, note: 'hot' });
    expect(calls).toEqual([{ item: 'tea', note: 'hot' }]);
  });

  it('covers tools defined before the agent default', async () => {
    const calls: Json[] = [];
    const a = toolsAgent();
    define(a, calls);
    a.setNullableOptionalParameters();
    expect(fnOf(a, 'add_item')['parameters']['properties']['size']['type']).toEqual([
      'string',
      'null',
    ]);
    await call(a, 'add_item', { item: 'tea', size: null });
    expect(calls).toEqual([{ item: 'tea' }]);
  });

  it('lets a tool opt out of the agent default', async () => {
    const calls: Json[] = [];
    const a = toolsAgent().setNullableOptionalParameters();
    define(a, calls, false);
    expect(fnOf(a, 'add_item')['parameters']['properties']['size']['type']).toBe('string');
    await call(a, 'add_item', { item: 'tea', size: null });
    expect(calls).toEqual([{ item: 'tea', size: null }]);
  });

  it('is off by default', () => {
    const a = toolsAgent();
    define(a, []);
    expect(fnOf(a, 'add_item')['parameters']).toEqual(SIZES);
  });
});

describe('a native tool', () => {
  it('is sent with the native url', () => {
    const a = toolsAgent();
    a.defineTool({ name: 'lookup', description: 'Look up', handler: () => 'ok' });
    a.defineNativeTool('end_call', 'End the call once the order is placed.', {
      type: 'object',
      properties: { reason: { type: 'string' } },
    });
    const native = fnOf(a, 'end_call');
    expect(native['web_hook_url']).toBe('native');
    expect(native['description']).toBe('End the call once the order is placed.');
    expect(native['parameters']['properties']).toEqual({ reason: { type: 'string' } });
    expect(fnOf(a, 'lookup')['web_hook_url']).not.toBe('native');
  });

  it("can't have its url overridden", () => {
    const a = toolsAgent();
    a.defineNativeTool('end_call', 'End the call', undefined, {
      web_hook_url: 'https://x.example',
    });
    expect(fnOf(a, 'end_call')['web_hook_url']).toBe('native');
  });
});

describe('needsConversation', () => {
  it('turns on swaig_post_conversation when the SWML is rendered', () => {
    const a = toolsAgent();
    a.defineTool({
      name: 'check',
      description: 'Check',
      needsConversation: true,
      handler: () => 'ok',
    });
    const main = JSON.parse(a.renderSwml())['sections']['main'] as Json[];
    expect(main.find((v) => 'ai' in v)!['ai']['params']['swaig_post_conversation']).toBe(true);
  });

  it('leaves an explicit false alone', () => {
    const a = toolsAgent();
    a.setParam('swaig_post_conversation', false);
    a.defineTool({
      name: 'check',
      description: 'Check',
      needsConversation: true,
      handler: () => 'ok',
    });
    const main = JSON.parse(a.renderSwml())['sections']['main'] as Json[];
    expect(main.find((v) => 'ai' in v)!['ai']['params']['swaig_post_conversation']).toBe(false);
  });
});

describe('the unoffered-tool warning with per-request copies (found in review)', () => {
  it('is logged once across requests, not once per request', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    try {
      const agent = new AgentBase({ name: 'options', route: '/', basicAuth: ['u', 'p'] });
      agent.setPromptText('x');
      agent.defineTool({ name: 'audit_log', description: 'Audit', handler: () => 'ok' });
      agent.defineContexts().addContext('default').addStep('only').setText('Hi').setFunctions([]);
      agent.setDynamicConfigCallback(() => {});
      const auth = { Authorization: 'Basic ' + btoa('u:p') };
      for (let i = 0; i < 2; i++) {
        expect((await agent.getApp().request('/', { headers: auth })).status).toBe(200);
      }
      expect(warn.mock.calls.filter((c) => c[0] === 'tool_offered_by_no_step')).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });
});
