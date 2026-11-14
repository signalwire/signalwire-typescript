/**
 * Python 3.9.0 (#182): a tool named where the step doesn't offer it, reset
 * settings that do nothing, and the no_barge_next_response action. The model
 * reads a tool's name in step text and may call a tool it doesn't have; a step
 * with a reset is terminal (the platform runs the reset in place of its text);
 * a context's consolidate/full_reset/user_prompt act only with a system prompt.
 */
import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { Logger } from '../src/Logger.js';
import { SemanticGate, namedTools } from '../src/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose log fields
type Json = Record<string, any>;

function agent(tools: string[] = ['find_store', 'place_order', 'help']): AgentBase {
  const a = new AgentBase({ name: 'mentions', route: '/', basicAuth: ['u', 'p'] });
  a.setPromptText('x');
  for (const name of tools) a.defineTool({ name, description: name, handler: () => 'ok' });
  return a;
}

function warnings(a: AgentBase, event?: string): Array<[string, Json]> {
  const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  try {
    a.renderSwml();
    a.renderSwml();
    return warn.mock.calls
      .map((c) => [String(c[0]), (c[1] ?? {}) as Json] as [string, Json])
      .filter(([name]) => event === undefined || name === event);
  } finally {
    warn.mockRestore();
  }
}
const mentions = (a: AgentBase) => warnings(a, 'tool_named_but_not_offered').map(([, w]) => w);

describe('tool_named_but_not_offered', () => {
  it('finds names in step text, criteria and the context prompt', () => {
    const a = agent();
    const ctx = a.defineContexts().addContext('default');
    ctx.setPrompt('You take orders. Call place_order only after a read-back.');
    ctx
      .addStep('greet')
      .setText('Greet them, then use find_store.')
      .setFunctions(['find_store'])
      .setStepCriteria('place_order has been called');
    ctx.addStep('confirm').setText('Confirm, then call place_order.').setFunctions(['place_order']);
    const warned = new Set(mentions(a).map((w) => `${w['step']}|${w['where']}|${w['function']}`));
    expect(warned).toEqual(
      new Set(['greet|criteria|place_order', 'greet|context prompt|place_order']),
    );
  });

  it('finds names in gate outputs and gather questions', () => {
    const a = agent([]);
    a.defineTool({ name: 'find_store', description: 'Find', handler: () => 'ok' });
    a.defineTool({
      name: 'place_order',
      description: 'Order',
      handler: () => 'ok',
      gates: [
        new SemanticGate('Q?', 0.8, 'place_order was not run. Call find_store first.', { id: 'g' }),
      ],
    });
    const step = a
      .defineContexts()
      .addContext('default')
      .addStep('confirm')
      .setText('Confirm.')
      .setFunctions(['place_order']);
    step.setGatherInfo({ outputKey: 'o' });
    step.addGatherQuestion({
      key: 'zip',
      question: 'Your ZIP? Use find_store.',
      functions: ['find_store'],
    });
    step.addGatherQuestion({ key: 'size', question: 'Size? Then find_store.' });
    const warned = new Set(mentions(a).map((w) => `${w['where']}|${w['function']}`));
    expect(warned).toEqual(
      new Set(['place_order gate g on_fail|find_store', 'gather question size|find_store']),
    );
  });

  it('counts a one-word name only as code', () => {
    const a = agent();
    a.defineContexts()
      .addContext('default')
      .addStep('greet')
      .setText('Offer help. If stuck, call `help`.')
      .setFunctions(['find_store']);
    expect(mentions(a).map((w) => [w['where'], w['function']])).toEqual([['text', 'help']]);
  });

  it('skips a step that inherits its functions', () => {
    const a = agent();
    a.defineContexts().addContext('default').addStep('greet').setText('Use place_order.');
    expect(mentions(a)).toEqual([]);
  });
});

describe('namedTools', () => {
  it('matches underscore names as whole words and one-word names as code', () => {
    const tools = ['place_order', 'help', 'order'];
    expect(namedTools('Call place_order now', tools)).toEqual(new Set(['place_order']));
    expect(namedTools('replace_orders and place_order_x', tools)).toEqual(new Set());
    expect(namedTools('ask for help, then help()', tools)).toEqual(new Set(['help']));
    expect(namedTools('your order', tools)).toEqual(new Set());
    expect(namedTools('use `order`', tools)).toEqual(new Set(['order']));
    expect(namedTools(null, tools)).toEqual(new Set());
    expect(namedTools('a.b(', ['a.b'])).toEqual(new Set(['a.b']));
  });
});

describe('resets that do nothing as written', () => {
  it('reports a step with a reset as terminal', () => {
    const a = agent([]);
    const ctx = a.defineContexts().addContext('default');
    ctx.addStep('hand_off').setText('Never shown.').setResetSystemPrompt("You're support.");
    ctx.addStep('after').setText('After.');
    expect(warnings(a).map(([name, w]) => [name, w['step']])).toEqual([
      ['step_reset_is_terminal', 'hand_off'],
    ]);
  });

  it("reports a context's reset settings without a system prompt", () => {
    const a = agent([]);
    const builder = a.defineContexts();
    builder.addContext('default').addStep('s').setText('S');
    builder
      .addContext('billing')
      .setConsolidate(true)
      .setUserPrompt('Billing.')
      .addStep('b')
      .setText('B');
    builder
      .addContext('support')
      .setConsolidate(true)
      .setSystemPrompt('Support.')
      .addStep('p')
      .setText('P');
    expect(warnings(a).map(([name, w]) => [name, w['context'], w['settings']])).toEqual([
      ['context_reset_without_system_prompt', 'billing', ['consolidate', 'user_prompt']],
    ]);
  });

  it('warns once across per-request copies', async () => {
    const a = agent([]);
    a.defineContexts()
      .addContext('default')
      .addStep('end')
      .setText('End.')
      .setResetConsolidate(true);
    a.setDynamicConfigCallback(() => {});
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    try {
      for (let i = 0; i < 2; i++) {
        await a.getApp().request('/', { headers: { Authorization: 'Basic ' + btoa('u:p') } });
      }
      expect(warn.mock.calls.filter((c) => c[0] === 'step_reset_is_terminal')).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('noBargeNextResponse', () => {
  it('adds the action', () => {
    expect(new FunctionResult('Read it back.').noBargeNextResponse().toDict().action).toEqual([
      { no_barge_next_response: true },
    ]);
  });
});
