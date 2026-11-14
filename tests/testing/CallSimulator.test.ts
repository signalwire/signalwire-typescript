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
    expect(sim.callLog.at(-2)!['content']).toBe("That's a large tea. Is that right?");
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
