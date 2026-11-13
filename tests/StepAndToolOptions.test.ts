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
