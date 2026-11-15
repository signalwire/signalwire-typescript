/**
 * CallSimulator, from signalwire-python 3.8.0: an agent's tools through a
 * simulated call, checked as the platform checks them: the current step's
 * function list, the semantic gates, and each result's actions on the call's
 * state.
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentBase } from '../../src/AgentBase.js';
import { DataMap } from '../../src/DataMap.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import {
  CallSimulator,
  Proposal,
  RequestRecorder,
  callerTurns,
  type ToolMiddleware,
} from '../../src/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose request JSON
type Json = Record<string, any>;

const ITEM = {
  type: 'object',
  properties: { item: { type: 'string', description: 'The item' } },
  required: ['item'],
};

function bare(): AgentBase {
  const agent = new AgentBase({ name: 't', route: '/', basicAuth: ['u', 'p'] });
  agent.setPromptText('x');
  return agent;
}

function shop(): AgentBase {
  const agent = bare();
  const order = new Proposal('place_order', { declineTool: 'change_order' });
  agent.setGlobalData({ store: 'Main Street' });
  agent.defineTool({
    name: 'review_order',
    description: 'Read the order back',
    parameters: ITEM,
    handler: (args, raw) =>
      order
        .propose(`That's ${String(args['item'])}. Is that right?`, {
          rawData: raw,
          details: { item: args['item'] },
        })
        .swmlChangeStep('confirm'),
  });
  agent.defineTool({
    name: 'place_order',
    description: 'Place the order',
    handler: (_args, raw) => {
      const item = String((raw as Json)['global_data']['semantic_state']['item']);
      return order.complete(`The ${item} is ordered.`).swmlChangeStep('done');
    },
    gates: order.confirmGates(),
  });
  agent.defineTool({
    name: 'change_order',
    description: 'Change the order',
    handler: () => new FunctionResult('What would you like instead?').swmlChangeStep('take_order'),
  });
  agent.defineTool({
    name: 'hang_up',
    description: 'End the call',
    handler: () => new FunctionResult('Goodbye.').hangup(),
  });
  const ctx = agent.defineContexts().addContext('default');
  ctx.addStep('take_order').setText('Take the order.').setFunctions(['review_order']);
  ctx.addStep('confirm').setText('Confirm it.').setFunctions(['place_order', 'change_order']);
  ctx.addStep('done').setText('Say goodbye.').setFunctions(['hang_up']);
  return agent;
}

describe('steps', () => {
  it('starts in the first step', () => {
    const sim = new CallSimulator(shop());
    expect([sim.context, sim.step]).toEqual(['default', 'take_order']);
    expect(sim.offered()).toEqual(['review_order']);
    expect(sim.globalData).toEqual({ store: 'Main Street' });
  });

  it("doesn't run a tool the step doesn't offer", async () => {
    const refused = await new CallSimulator(shop()).call('place_order');
    expect([refused.ran, refused.blockedBy]).toEqual([false, 'step']);
    expect(refused.response).toBe(
      "Nothing ran: place_order isn't available at this point in the call. " +
        'The steps that offer it: confirm. The tools available now are: review_order.\n',
    );
  });

  it('answers an unknown tool', async () => {
    expect((await new CallSimulator(shop()).call('refund')).response).toBe(
      'Nothing ran: there is no tool named refund. The tools available now are: review_order.\n',
    );
  });

  it("uses the agent's own unavailable response", async () => {
    const agent = shop();
    agent.setParam(
      'unavailable_function_response',
      "${function} can't run here (${steps}); use ${tools}.",
    );
    expect((await new CallSimulator(agent).call('place_order')).response).toBe(
      "place_order can't run here (confirm); use review_order.",
    );
  });
});

describe('the confirm flow', () => {
  it('places the order on a yes', async () => {
    const sim = new CallSimulator(shop(), { gates: () => true });
    sim.caller('A large tea, please.');
    const review = await sim.call('review_order', { item: 'a large tea' });
    expect(review.ran).toBe(true);
    expect(sim.step).toBe('confirm');
    const said = sim.callLog
      .filter((e) => e['role'] === 'assistant' && e['content'])
      .map((e) => e['content']);
    expect(said.at(-1)).toBe("That's a large tea. Is that right?");
    expect((sim.semanticState as Json)['proposal']).toBe("That's a large tea. Is that right?");
    expect(sim.waitingForUser).toBe(true);
    sim.caller('Yes.');
    const placed = await sim.call('place_order');
    expect(placed.ran).toBe(true);
    expect(sim.step).toBe('done');
    expect(sim.semanticState).toEqual({ done: 'The a large tea is ordered.' });
  });

  it('is blocked by a gate that fails', async () => {
    const sim = new CallSimulator(shop(), {
      gates: (gate) => (gate['id'] === 'agreed' ? 0.2 : 0.99),
    });
    await sim.call('review_order', { item: 'a tea' });
    sim.caller('Hmm, what sizes are there?');
    const blocked = await sim.call('place_order');
    expect([blocked.ran, blocked.blockedBy]).toEqual([false, 'agreed']);
    expect(blocked.response).toBe(
      'place_order was not run. The caller has not said yes to this change.',
    );
    // The platform expands the gate's output from the call's data
    expect(blocked.toolPrompt ?? '').toContain('"That\'s a tea. Is that right?"');
    expect(sim.chaining).toBe(false);
    expect(sim.step).toBe('confirm');
  });

  it('is blocked by an unclear gate', async () => {
    const sim = new CallSimulator(shop(), { gates: () => 'unclear' });
    await sim.call('review_order', { item: 'a tea' });
    expect((await sim.call('place_order')).blockedBy).toBe('answered');
  });

  it('awaits an async gate callback', async () => {
    const sim = new CallSimulator(shop(), { gates: async () => false });
    await sim.call('review_order', { item: 'a tea' });
    expect((await sim.call('place_order')).blockedBy).toBe('answered');
  });
});

describe('actions', () => {
  it('ends the call on a hangup', async () => {
    const sim = new CallSimulator(shop());
    await sim.call('review_order', { item: 'a tea' });
    await sim.call('place_order');
    await sim.call('hang_up');
    expect(sim.ended).toBe(true);
    await expect(sim.call('hang_up')).rejects.toThrow(/ended/);
  });

  it('toggles functions', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'unlock',
      description: 'Unlock',
      handler: () =>
        new FunctionResult('ok').toggleFunctions([
          { function: 'secret', active: true },
          { function: 'unlock', active: false },
        ]),
    });
    agent.defineTool({ name: 'secret', description: 'Secret', handler: () => 'shh' });
    const sim = new CallSimulator(agent);
    expect(sim.offered()).toEqual(['unlock', 'secret']);
    await sim.call('unlock');
    expect(sim.offered()).toEqual(['secret']);
  });

  it('unsets global data', async () => {
    const agent = bare();
    agent.setGlobalData({ a: 1, b: 2 });
    agent.defineTool({
      name: 'forget',
      description: 'Forget',
      handler: () => new FunctionResult('ok').removeGlobalData('a'),
    });
    const sim = new CallSimulator(agent);
    await sim.call('forget');
    expect(sim.globalData).toEqual({ b: 2 });
  });
});

describe('requests', () => {
  it("gives the handler a request like the platform's", async () => {
    const seen: Json[] = [];
    const agent = bare();
    agent.defineTool({
      name: 'find_store',
      description: 'Find',
      needsConversation: true,
      handler: (_args, raw) => {
        seen.push(raw as Json);
        return 'Store 12';
      },
    });
    const sim = new CallSimulator(agent, { callId: 'call-9' });
    sim.caller('My ZIP is 10001.');
    await sim.call('find_store', { zip: '10001' });
    const raw = seen[0]!;
    expect([raw['function'], raw['call_id']]).toEqual(['find_store', 'call-9']);
    expect(raw['argument']['parsed']).toEqual([{ zip: '10001' }]);
    expect(String(raw['tool_call_id'])).toMatch(/^call-9-tool-/);
    expect(callerTurns(raw)).toEqual(['My ZIP is 10001.']);
  });

  it('needs a stub for a DataMap tool', async () => {
    const agent = bare();
    agent.registerSwaigFunction(
      new DataMap('weather')
        .description('Weather')
        .webhook('GET', 'https://api.example.com/w')
        .output(new FunctionResult('Sunny'))
        .toSwaigFunction(),
    );
    await expect(new CallSimulator(agent).call('weather')).rejects.toThrow(/stub/);
    const stubbed = new CallSimulator(agent, { stubs: { weather: () => 'Sunny in Rome' } });
    expect((await stubbed.call('weather')).response).toBe('Sunny in Rome');
  });

  it('replays recorded requests', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'sim-')), 'requests.jsonl');
    const agent = shop();
    const recorder = new RequestRecorder(path);
    agent.addToolMiddleware(recorder.middleware);
    await new CallSimulator(agent).call('review_order', { item: 'a tea' });
    expect(recorder.requests).toHaveLength(1);
    const replayed = await new CallSimulator(agent).replay(RequestRecorder.load(path));
    expect(replayed.map((r) => [r.name, r.args])).toEqual([['review_order', { item: 'a tea' }]]);
    expect(replayed[0]!.response).toBe("Read back to the caller: That's a tea. Is that right?");
  });
});

describe('navigation', () => {
  it('follows valid steps', async () => {
    const agent = bare();
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('one').setText('One').setValidSteps(['next']);
    ctx.addStep('two').setText('Two').setValidSteps(['one']);
    const sim = new CallSimulator(agent);
    expect(sim.offered()).toContain('next_step');
    expect((await sim.call('next_step', { step: 'next' })).ran).toBe(true);
    expect(sim.step).toBe('two');
    expect((await sim.call('next_step', { step: 'two' })).ran).toBe(false);
    expect((await sim.call('next_step', { step: 'one' })).ran).toBe(true);
    expect(sim.step).toBe('one');
  });
});

describe('marks', () => {
  it('keeps a mark with its place in the log', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'read_back',
      description: 'Read back',
      handler: () => new FunctionResult('Read it back.').setSemanticGateMark('read_back'),
    });
    const sim = new CallSimulator(agent);
    sim.caller('A tea.');
    await sim.call('read_back');
    sim.caller('Yes.');
    const since = sim.callLog.slice(sim.marks.get('read_back'));
    expect(since.filter((e) => e['role'] === 'user').map((e) => e['content'])).toEqual(['Yes.']);
  });

  it('keeps sixteen marks', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'mark',
      description: 'Mark',
      parameters: { type: 'object', properties: { name: { type: 'string' } } },
      handler: (args) => new FunctionResult('ok').setSemanticGateMark(String(args['name'])),
    });
    const sim = new CallSimulator(agent);
    for (let n = 0; n < 17; n++) await sim.call('mark', { name: `m${n}` });
    expect(sim.marks.size).toBe(16);
    expect(sim.marks.has('m0')).toBe(false);
  });
});

describe("the platform's reply", () => {
  it("doesn't name the current step among the steps that offer it", async () => {
    const agent = bare();
    agent.defineTool({ name: 'lookup', description: 'Look up', handler: () => 'ok' });
    agent.defineTool({ name: 'other', description: 'Other', handler: () => 'ok' });
    const ctx = agent.defineContexts().addContext('default');
    // A step that lists a tool and is in it has used it up; no other step offers it
    ctx.addStep('one').setText('One').setFunctions(['lookup', 'other']);
    const sim = new CallSimulator(agent, { globalData: {} });
    sim['toggled'].set('lookup', false);
    expect((await sim.call('lookup')).response).toBe(
      "Nothing ran: lookup isn't available at this point in the call. " +
        'The tools available now are: other.\n',
    );
  });

  it('says when no tools are available', async () => {
    const agent = bare();
    agent.defineTool({ name: 'lookup', description: 'Look up', handler: () => 'ok' });
    agent.defineContexts().addContext('default').addStep('one').setText('One').setFunctions('none');
    expect((await new CallSimulator(agent).call('lookup')).response).toBe(
      "Nothing ran: lookup isn't available at this point in the call. No tools are available now.\n",
    );
  });
});

describe('the TypeScript dispatch (found in review)', () => {
  it('runs tools as the /swaig route does: the hook, middleware and outcome rules', async () => {
    class Hooked extends AgentBase {
      override onFunctionCall(name: string): Record<string, unknown> | void {
        if (name === 'intercepted') return { response: 'from the hook' };
      }
    }
    const agent = new Hooked({ name: 'h', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('x');
    const order: string[] = [];
    const mw: ToolMiddleware = async (name, args, raw, next) => {
      order.push(name);
      return await next(args, raw);
    };
    agent.addToolMiddleware(mw);
    agent.defineTool({ name: 'intercepted', description: 'x', handler: () => 'handler' });
    agent.defineTool({
      name: 'crashes',
      description: 'x',
      handler: () => {
        throw new Error('boom');
      },
    });
    const sim = new CallSimulator(agent);
    expect((await sim.call('intercepted')).response).toBe('from the hook');
    const crashed = await sim.call('crashes');
    expect(crashed.response).toBe(
      'crashes failed before it finished, so whether it took effect is unknown.',
    );
    expect(order).toEqual(['crashes']);
  });

  it('keeps the recorded file in request order', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'sim-')), 'requests.jsonl');
    const recorder = new RequestRecorder(path, { limit: 2 });
    const next = async () => 'ok';
    await Promise.all(
      ['a', 'b', 'c'].map((name) => recorder.handle(name, {}, { call_id: 'x' }, next)),
    );
    expect(RequestRecorder.load(path).map((r) => r['function'])).toEqual(['a', 'b', 'c']);
    expect(recorder.requests.map((r) => r['function'])).toEqual(['b', 'c']);
    expect(readFileSync(path, 'utf-8').endsWith('\n')).toBe(true);
  });
});

describe('the third checkpoint review (found in review)', () => {
  it('replays a request with flat arguments as the /swaig route reads it', async () => {
    const seen: Json[] = [];
    const agent = bare();
    agent.defineTool({
      name: 'echo',
      description: 'Echo',
      handler: (args) => {
        seen.push(args);
        return 'ok';
      },
    });
    const replayed = await new CallSimulator(agent).replay([
      { function: 'echo', argument: null, arguments: { item: 'tea' } },
    ]);
    expect(replayed[0]!.args).toEqual({ item: 'tea' });
    expect(seen).toEqual([{ item: 'tea' }]);
  });

  it('offers and runs a tool named __proto__', async () => {
    const agent = bare();
    agent.defineTool({ name: '__proto__', description: 'Odd', handler: () => 'ran' });
    const sim = new CallSimulator(agent);
    expect(sim.offered()).toEqual(['__proto__']);
    expect((await sim.call('__proto__')).response).toBe('ran');
  });
});

describe('checkToolMentions (Python 3.9.0)', () => {
  it("fails a result naming a tool the step it leaves the call in doesn't offer", async () => {
    const { ToolMentionError } = await import('../../src/index.js');
    const agent = bare();
    agent.defineTool({
      name: 'find_store',
      description: 'Find',
      handler: () =>
        new FunctionResult(undefined, false, 'Store 12.', 'Now call place_order.').swmlChangeStep(
          'pick',
        ),
    });
    agent.defineTool({ name: 'place_order', description: 'Order', handler: () => 'ok' });
    agent.defineTool({
      name: 'pick_time',
      description: 'Pick',
      handler: () => new FunctionResult('Picked. Next, place_order.').swmlChangeStep('order'),
    });
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('find').setText('Find.').setFunctions(['find_store']);
    ctx.addStep('pick').setText('Pick.').setFunctions(['pick_time']);
    ctx.addStep('order').setText('Order.').setFunctions(['place_order']);
    const sim = new CallSimulator(agent, { checkToolMentions: true });
    const failed = sim.call('find_store');
    await expect(failed).rejects.toBeInstanceOf(ToolMentionError);
    await expect(failed).rejects.toThrow("names place_order, which step 'pick'");
    // Naming the tool of the step the result moves the call to is fine
    expect((await sim.call('pick_time')).ran).toBe(true);
    // Off by default
    await new CallSimulator(agent).call('find_store');
  });
});

// Python 3.10.0: what the model gets after each step's history mode, the
// "spoken" mode, and the dialogue a gate judges (mod_openai STEP_HISTORY.md;
// check_steps runs before every request)
const contents = (sim: CallSimulator) => sim.modelView().map((e) => e['content']);

describe('modelView', () => {
  function modeAgent(mode: string | null): AgentBase {
    const agent = bare();
    agent.setGlobalData({ store: 'Main Street' });
    agent.defineTool({
      name: 'lookup',
      description: 'Look up',
      handler: () =>
        new FunctionResult(
          undefined,
          false,
          'Order 7 is a tea.',
          'Tell the caller.',
        ).swmlChangeStep('next'),
    });
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('first').setText('Look it up.').setFunctions(['lookup']);
    const second = ctx.addStep('next').setText('Help at ${global_data.store}.');
    if (mode) second.setHistory(mode);
    return agent;
  }

  async function runMode(mode: string | null): Promise<Array<[unknown, unknown]>> {
    const sim = new CallSimulator(modeAgent(mode));
    sim.caller("Where's my order?");
    await sim.call('lookup');
    sim.caller('Thanks.');
    return sim.modelView().map((e) => [e['role'], e['content'] || '<tool call>']);
  }

  it('clears old instructions by default', async () => {
    expect(await runMode(null)).toEqual([
      ['user', "Where's my order?"],
      ['assistant', '<tool call>'],
      ['tool', 'Order 7 is a tea.'],
      ['system', 'Tell the caller.'],
      ['system', 'Help at Main Street.'],
      ['user', 'Thanks.'],
    ]);
  });

  it('keeps everything under keep', async () => {
    expect((await runMode('keep'))[0]).toEqual(['system', 'Look it up.']);
  });

  it('hides everything before the entering exchange under hide', async () => {
    expect(await runMode('hide')).toEqual([
      ['assistant', '<tool call>'],
      ['tool', 'Order 7 is a tea.'],
      ['system', 'Tell the caller.'],
      ['system', 'Help at Main Street.'],
      ['user', 'Thanks.'],
    ]);
  });

  it('keeps the call and the reply for a post_process change', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'lookup',
      description: 'Look up',
      handler: () => new FunctionResult('Order 7.', true).swmlChangeStep('next'),
    });
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('first').setText('Look it up.').setFunctions(['lookup']);
    ctx.addStep('next').setText('Next.').setHistory('hide');
    const sim = new CallSimulator(agent);
    sim.caller("Where's my order?");
    await sim.call('lookup');
    expect(sim.step).toBe('first');
    sim.agentSays('Order 7 is on its way.');
    expect(sim.step).toBe('next');
    sim.caller('Thanks.');
    expect(contents(sim)).toEqual(['', 'Order 7.', 'Order 7 is on its way.', 'Thanks.', 'Next.']);
  });

  it('holds post_process actions for the reply, a newer result replacing them', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'finish',
      description: 'Finish',
      handler: () => new FunctionResult('Done.', true).hangup(),
    });
    agent.defineTool({
      name: 'bye',
      description: 'Bye',
      handler: () => new FunctionResult('Bye.', true).say('Goodbye.'),
    });
    const sim = new CallSimulator(agent);
    await sim.call('finish');
    expect(sim.ended).toBe(false);
    await sim.call('bye');
    sim.agentSays('Thanks for calling.');
    expect(sim.ended).toBe(false);
    expect(sim.callLog.at(-1)!['content']).toBe('Goodbye.');
  });

  it('keeps a say before the change in the same result, held after the result', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'confirm',
      description: 'Confirm',
      handler: () =>
        new FunctionResult('Read back.').say("That's a large tea.").swmlChangeStep('next'),
    });
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('first').setText('Take the order.').setFunctions(['confirm']);
    ctx.addStep('next').setText('Confirm.').setHistory('hide');
    const sim = new CallSimulator(agent);
    sim.caller('A large tea.');
    await sim.call('confirm');
    expect(contents(sim)).toEqual(['', 'Read back.', 'Confirm.', "That's a large tea."]);
    sim.caller('Yes.');
    expect(contents(sim).slice(-2)).toEqual(["That's a large tea.", 'Yes.']);
  });

  it('keeps calls chained after a post_process call', async () => {
    const make = () => {
      const agent = bare();
      agent.defineTool({
        name: 'lookup',
        description: 'Look up',
        handler: () => new FunctionResult('Order 7.', true).swmlChangeStep('next'),
      });
      agent.defineTool({
        name: 'price',
        description: 'Price',
        handler: () => new FunctionResult('Four dollars.'),
      });
      agent.defineTool({
        name: 'check',
        description: 'Check',
        handler: () => new FunctionResult('Checked.', true).swmlChangeStep('next'),
      });
      const ctx = agent.defineContexts().addContext('default');
      ctx.addStep('first').setText('Look it up.').setFunctions(['lookup', 'price', 'check']);
      ctx.addStep('next').setText('Next.').setHistory('hide');
      return agent;
    };
    let sim = new CallSimulator(make());
    await sim.call('lookup');
    await sim.call('price');
    sim.agentSays('Order 7 is four dollars.');
    expect(contents(sim)).toEqual([
      '',
      'Order 7.',
      '',
      'Four dollars.',
      'Order 7 is four dollars.',
      'Next.',
    ]);
    sim = new CallSimulator(make());
    await sim.call('lookup');
    await sim.call('check');
    sim.agentSays('All set.');
    expect(contents(sim)).toEqual(['', 'Checked.', 'All set.', 'Next.']);
  });

  it('expands the step text again when a value changes, in place', async () => {
    const agent = modeAgent(null);
    agent.defineTool({
      name: 'move',
      description: 'Move',
      handler: () => new FunctionResult('Moved.').updateGlobalData({ store: 'Elm Street' }),
    });
    agent.defineContexts().getContext('default')!.getStep('next')!.setFunctions(['move']);
    const sim = new CallSimulator(agent);
    await sim.call('lookup');
    await sim.call('move');
    const view = contents(sim);
    expect(view.filter((c) => c === 'Help at Elm Street.')).toHaveLength(1);
    expect(view).not.toContain('Help at Main Street.');
    expect(sim.callLog.filter((e) => e['content'] === 'Help at Main Street.')).toHaveLength(1);
  });

  it('brings back what isolate hid at an end step', async () => {
    const agent = modeAgent('isolate');
    const ctx = agent.defineContexts().getContext('default')!;
    ctx.addStep('done').setText('Done.').setEnd(true);
    agent.defineTool({
      name: 'finish',
      description: 'Finish',
      handler: () => new FunctionResult('ok').swmlChangeStep('done'),
    });
    ctx.getStep('next')!.setFunctions(['finish']);
    const sim = new CallSimulator(agent);
    sim.caller("Where's my order?");
    await sim.call('lookup');
    expect(sim.modelView()[0]!['content']).toBe('');
    await sim.call('finish');
    expect(sim.modelView()[0]!['content']).toBe("Where's my order?");
  });

  it('keeps the text an end step went in with', async () => {
    const agent = modeAgent(null);
    agent.defineTool({
      name: 'move',
      description: 'Move',
      handler: () => new FunctionResult('Moved.').updateGlobalData({ store: 'Elm Street' }),
    });
    agent
      .defineContexts()
      .getContext('default')!
      .getStep('next')!
      .setFunctions(['move'])
      .setEnd(true);
    const sim = new CallSimulator(agent);
    await sim.call('lookup');
    await sim.call('move');
    expect(contents(sim)).toContain('Help at Main Street.');
  });

  it('restores what isolate hid when the step is left', async () => {
    const agent = modeAgent('isolate');
    const ctx = agent.defineContexts().getContext('default')!;
    ctx.addStep('after').setText('After.');
    agent.defineTool({
      name: 'move_on',
      description: 'Move',
      handler: () => new FunctionResult('ok').swmlChangeStep('after'),
    });
    ctx.getStep('next')!.setFunctions(['move_on']);
    const sim = new CallSimulator(agent);
    sim.caller("Where's my order?");
    await sim.call('lookup');
    expect(contents(sim)).toEqual([
      '',
      'Order 7 is a tea.',
      'Tell the caller.',
      'Help at Main Street.',
    ]);
    await sim.call('move_on');
    sim.caller('Bye.');
    const view = contents(sim);
    expect(view[0]).toBe("Where's my order?");
    expect(view.slice(-2)).toEqual(['After.', 'Bye.']);
  });
});

describe('the spoken history mode', () => {
  it('drops the work and keeps the talk', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'lookup',
      description: 'Look up',
      handler: () => new FunctionResult(undefined, false, 'Order 7 is a tea.', 'Tell the caller.'),
    });
    agent.defineTool({
      name: 'finish',
      description: 'Finish',
      handler: () => new FunctionResult('Lookup finished.').swmlChangeStep('next'),
    });
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('first').setText('Look it up.').setFunctions(['lookup', 'finish']);
    ctx.addStep('next').setText('Next request.').setHistory('spoken');
    const sim = new CallSimulator(agent);
    sim.caller("Where's my order? And my balance.");
    await sim.call('lookup');
    sim.agentSays("It's a tea.");
    await sim.call('finish');
    expect(sim.modelView().map((e) => [e['role'], e['content'] || '<tool call>'])).toEqual([
      ['user', "Where's my order? And my balance."],
      ['assistant', "It's a tea."],
      // The exchange that entered the step stays: it's the step's start
      ['assistant', '<tool call>'],
      ['tool', 'Lookup finished.'],
      ['system', 'Next request.'],
    ]);
  });

  it('keeps a say when its call goes', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'lookup',
      description: 'Look up',
      handler: () => new FunctionResult('Order 7.').say('Your order is on its way.'),
    });
    agent.defineTool({
      name: 'finish',
      description: 'Finish',
      handler: () => new FunctionResult('Done.').swmlChangeStep('next'),
    });
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('first').setText('Look it up.').setFunctions(['lookup', 'finish']);
    ctx.addStep('next').setText('Next.').setHistory('spoken');
    const sim = new CallSimulator(agent);
    sim.caller('Where is it?');
    await sim.call('lookup');
    await sim.call('finish');
    expect(contents(sim)).toEqual([
      'Where is it?',
      '',
      'Done.',
      'Next.',
      'Your order is on its way.',
    ]);
  });

  it("doesn't let a later isolate bring back what spoken took", async () => {
    const agent = bare();
    agent.defineTool({
      name: 'lookup',
      description: 'Look up',
      handler: () => new FunctionResult('Order 7.').swmlChangeStep('talk'),
    });
    agent.defineTool({
      name: 'confirm',
      description: 'Confirm',
      handler: () => new FunctionResult('Read back.').swmlChangeStep('confirm'),
    });
    agent.defineTool({
      name: 'done',
      description: 'Done',
      handler: () => new FunctionResult('Done.').swmlChangeStep('after'),
    });
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('first').setText('Look up.').setFunctions(['lookup']);
    ctx.addStep('talk').setText('Talk.').setHistory('spoken').setFunctions(['confirm']);
    ctx.addStep('confirm').setText('Confirm.').setHistory('isolate').setFunctions(['done']);
    ctx.addStep('after').setText('After.');
    const sim = new CallSimulator(agent);
    sim.caller("Where's my order?");
    await sim.call('lookup');
    sim.caller('Cancel it.');
    await sim.call('confirm');
    expect(contents(sim)).toEqual(['', 'Read back.', 'Confirm.']);
    await sim.call('done');
    const view = contents(sim);
    expect(view.slice(0, 3)).toEqual(["Where's my order?", '', 'Order 7.']);
    expect(view).toContain('Cancel it.');
  });
});

describe('gateConversation', () => {
  function shopSim(mode?: string): CallSimulator {
    const agent = shop();
    if (mode) agent.defineContexts().getContext('default')!.getStep('confirm')!.setHistory(mode);
    return new CallSimulator(agent);
  }

  it('is the spoken turns the model sees', async () => {
    const sim = shopSim();
    sim.caller('A tea, and my balance later.');
    await sim.call('review_order', { item: 'a tea' });
    sim.caller('Yes.');
    expect(sim.gateConversation()).toEqual([
      'user: A tea, and my balance later.',
      "assistant: That's a tea. Is that right?",
      'user: Yes.',
    ]);
    expect(sim.gateConversation({ history: 1 })).toEqual(['user: Yes.']);
  });

  it("takes the caller's earlier words from gates too under hide", async () => {
    const sim = shopSim('hide');
    sim.caller('A tea, and my balance later.');
    await sim.call('review_order', { item: 'a tea' });
    sim.caller('Yes.');
    expect(sim.gateConversation()).toEqual([
      "assistant: That's a tea. Is that right?",
      'user: Yes.',
    ]);
  });

  it('keeps them under spoken', async () => {
    const sim = shopSim('spoken');
    sim.caller('A tea, and my balance later.');
    await sim.call('review_order', { item: 'a tea' });
    sim.caller('Yes.');
    expect(sim.gateConversation()[0]).toBe('user: A tea, and my balance later.');
  });

  it('starts a proposal at its read-back', async () => {
    const sim = shopSim();
    sim.caller('A tea, and my balance later.');
    await sim.call('review_order', { item: 'a tea' });
    sim.caller('Yes.');
    expect(sim.gateConversation({ dialogue: 'proposal' })).toEqual([
      "assistant: That's a tea. Is that right?",
      'user: Yes.',
    ]);
  });

  it('starts at a mark', () => {
    const sim = new CallSimulator(bare());
    sim.caller('Earlier words.');
    sim['apply']({ action: [{ semantic_gate_mark: 'rb', say: 'Is that right?' }] });
    sim.caller('Yes.');
    expect(sim.gateConversation({ since: 'rb' })).toEqual([
      'assistant: Is that right?',
      'user: Yes.',
    ]);
    expect(sim.gateConversation({ since: 'unset' })[0]).toBe('user: Earlier words.');
  });

  it('puts a say before the state in the same result in the proposal', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'review',
      description: 'Review',
      handler: () =>
        new FunctionResult('Read back.')
          .say("That's a tea. Is that right?")
          .setSemanticState({ proposal: 'a tea' }),
    });
    const sim = new CallSimulator(agent);
    sim.caller('A tea, and my balance later.');
    await sim.call('review');
    sim.caller('Yes.');
    expect(sim.gateConversation({ dialogue: 'proposal' })).toEqual([
      "assistant: That's a tea. Is that right?",
      'user: Yes.',
    ]);
  });

  it('puts a say before the mark in the same result after it', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'review',
      description: 'Review',
      handler: () =>
        new FunctionResult('Read back.').say('Is that right?').setSemanticGateMark('rb'),
    });
    const sim = new CallSimulator(agent);
    sim.caller('Earlier words.');
    await sim.call('review');
    sim.caller('Yes.');
    expect(sim.gateConversation({ since: 'rb' })).toEqual([
      'assistant: Is that right?',
      'user: Yes.',
    ]);
  });
});

describe('the platform at 7afb159 (found in review)', () => {
  function toStep(target: Json): AgentBase {
    const agent = bare();
    agent.defineTool({
      name: 'go',
      description: 'Go',
      handler: () => new FunctionResult('Done').swmlChangeStep('last'),
    });
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('first').setText('First.').setFunctions(['go']);
    const last = ctx.addStep('last').setText('This is the end text');
    if (target['end']) last.setEnd(true);
    if (target['history']) last.setHistory(String(target['history']));
    if (target['reset']) last.setResetSystemPrompt('New base prompt');
    return agent;
  }

  it('gives an end step no history pass (step_management.c)', async () => {
    const sim = new CallSimulator(toStep({ end: true, history: 'hide' }));
    sim.caller('Please also check my balance');
    await sim.call('go');
    expect(contents(sim)).toEqual([
      'First.',
      'Please also check my balance',
      '',
      'Done',
      'This is the end text',
    ]);
    expect(sim.gateConversation()).toEqual(['user: Please also check my balance']);
  });

  it("puts an end step's text before its context's prompt, as the engine does", async () => {
    const agent = toStep({ end: true });
    agent.defineContexts().getContext('default')!.setPrompt('You take orders.');
    const sim = new CallSimulator(agent);
    await sim.call('go');
    expect(contents(sim)).toContain('This is the end text\n\nYou take orders.');
    expect(contents(sim)).toContain('You take orders.\n\nFirst.');
  });

  it("doesn't simulate past a reset step, whose text the platform never sends", async () => {
    const sim = new CallSimulator(toStep({ reset: true }));
    await sim.call('go');
    expect(sim.callLog.map((e) => e['content'])).not.toContain('This is the end text');
    expect(() => sim.modelView()).toThrow(/has a reset, which the simulator doesn't model/);
    expect(() => sim.gateConversation()).toThrow(/has a reset/);
  });

  it('judges the window once semantic_state is removed', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'propose',
      description: 'Propose',
      handler: () => new FunctionResult('ok').say('A tea?').setSemanticState({ item: 'tea' }),
    });
    agent.defineTool({
      name: 'drop',
      description: 'Drop',
      handler: () => new FunctionResult('ok').removeGlobalData('semantic_state'),
    });
    const sim = new CallSimulator(agent);
    sim.caller('Remember my earlier question');
    await sim.call('propose');
    sim.caller('No');
    await sim.call('drop');
    expect(sim.gateConversation({ dialogue: 'proposal' })).toEqual(sim.gateConversation());
    expect(sim.gateConversation()[0]).toBe('user: Remember my earlier question');
  });

  it('starts a new proposal when the state is reordered, as the engine compares it', async () => {
    const agent = bare();
    agent.defineTool({
      name: 'first',
      description: 'First',
      handler: () =>
        new FunctionResult('ok').say('First readback').setSemanticState({ item: 'tea', price: 5 }),
    });
    agent.defineTool({
      name: 'again',
      description: 'Again',
      handler: () =>
        new FunctionResult('ok').say('Fresh readback').setSemanticState({ price: 5, item: 'tea' }),
    });
    const sim = new CallSimulator(agent);
    await sim.call('first');
    sim.caller('Yes');
    await sim.call('again');
    expect(sim.gateConversation({ dialogue: 'proposal' })).toEqual(['assistant: Fresh readback']);
  });
});
