/**
 * Tool middleware and the dedupe of transport retries, from
 * signalwire-python 3.8.0. SignalWire sends a tool request again, with the
 * same body, after a timeout, a failed connection or a 5xx (webhook.c). The
 * retry carries the first request's tool_call_id; a call the model makes again
 * gets a new one, and some calls carry none (actions.c). So a retry is the same
 * call_id, tool_call_id and function, and only that is answered from the first
 * attempt.
 */
import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { ResendDedupe, ToolRefusal, type CallNext } from '../src/index.js';
import type { SwaigFunction } from '../src/SwaigFunction.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose results
type Json = Record<string, any>;

function agent(): AgentBase {
  const a = new AgentBase({ name: 'middleware', route: '/', basicAuth: ['u', 'p'] });
  a.setPromptText('x');
  return a;
}

const raw = (toolCallId: string | null = 'tc-1', callId = 'call-1'): Json => ({
  call_id: callId,
  ...(toolCallId === null ? {} : { tool_call_id: toolCallId }),
});

async function run(a: AgentBase, name: string, args: Json, rawData: Json): Promise<Json> {
  return (await (a.getTool(name) as SwaigFunction)._executeAs(a, args, rawData as never)) as Json;
}

describe('tool middleware', () => {
  it('runs in order around the handler', async () => {
    const seen: string[] = [];
    const outer = (name: string, args: Json, r: Json, next: CallNext) => {
      seen.push(`outer ${name}`);
      const city = String(args['city']);
      return next({ ...args, city: city[0]!.toUpperCase() + city.slice(1) }, r);
    };
    const inner = async (_n: string, args: Json, r: Json, next: CallNext) => {
      seen.push(`inner ${args['city']}`);
      const result = await next(args, r);
      seen.push('inner after');
      return result;
    };
    const a = agent().addToolMiddleware(outer);
    a.defineTool({
      name: 'weather',
      description: 'Weather',
      middleware: [inner],
      handler: (args) => {
        seen.push(`handler ${args['city']}`);
        return new FunctionResult(`Sunny in ${args['city']}`);
      },
    });
    expect((await run(a, 'weather', { city: 'rome' }, raw()))['response']).toBe('Sunny in Rome');
    expect(seen).toEqual(['outer weather', 'inner Rome', 'handler Rome', 'inner after']);
  });

  it('can answer without the handler', async () => {
    const calls: Json[] = [];
    const a = agent().addToolMiddleware(
      (name) => new FunctionResult(undefined, false, `${name} was not run: the store is closed.`),
    );
    a.defineTool({ name: 'order', description: 'Order', handler: (x) => void calls.push(x) });
    expect((await run(a, 'order', {}, raw()))['response']).toEqual({
      tool_result: 'order was not run: the store is closed.',
    });
    expect(calls).toEqual([]);
  });

  it('makes a refusal or a crash in middleware an outcome', async () => {
    const refused = agent().addToolMiddleware(() => {
      throw new ToolRefusal('order was not run.', 'Ask for the account first.');
    });
    refused.defineTool({ name: 'order', description: 'Order', handler: () => 'x' });
    const crashed = agent().addToolMiddleware(() => {
      throw new Error('secret');
    });
    crashed.defineTool({ name: 'order', description: 'Order', handler: () => 'x' });
    expect((await run(refused, 'order', {}, raw()))['response']['tool_prompt']).toBe(
      'Ask for the account first.',
    );
    const result = await run(crashed, 'order', {}, raw());
    expect(result['response']['tool_result']).toMatch(/^order failed before it finished/);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('wraps an async handler too', async () => {
    const a = agent().addToolMiddleware(async (_n, args, r, next) => {
      const result = (await next(args, r)) as Json;
      return new FunctionResult(`${result['response']} (checked)`);
    });
    a.defineTool({
      name: 'weather',
      description: 'Weather',
      handler: async () => new FunctionResult('Sunny'),
    });
    expect((await run(a, 'weather', {}, raw()))['response']).toBe('Sunny (checked)');
  });

  it("doesn't change the agent when a per-request copy adds middleware", async () => {
    const a = agent();
    const seen: string[] = [];
    a.addPerCallConfig((_q, _b, _h, copy) => {
      copy.addToolMiddleware((_n, args, r, next) => {
        seen.push('copy');
        return next(args, r);
      });
    });
    a.defineTool({ name: 'ping', description: 'Ping', secure: false, handler: () => 'pong' });
    await a.getApp().request('/swaig', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa('u:p'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ function: 'ping', argument: { parsed: [{}] } }),
    });
    expect(seen).toEqual(['copy']);
    await run(a, 'ping', {}, raw(null));
    expect(seen).toEqual(['copy']);
  });

  it("takes a skill's middleware as a tool option, not a wire field", async () => {
    const { SkillBase } = await import('../src/skills/SkillBase.js');
    const seen: string[] = [];
    const mw = (_n: string, args: Json, r: Json, next: CallNext) => {
      seen.push('skill');
      return next(args, r);
    };
    class Logged extends SkillBase {
      static override SKILL_NAME = 'logged';
      static override SKILL_DESCRIPTION = 'Logged';
      constructor() {
        super({ swaig_fields: { middleware: [mw] } });
      }
      getTools(): import('../src/skills/SkillBase.js').SkillToolDefinition[] {
        return [{ name: 'ping', description: 'Ping', handler: () => 'pong' }];
      }
    }
    const a = agent();
    await a.addSkill(new Logged());
    await run(a, 'ping', {}, raw());
    expect(seen).toEqual(['skill']);
    expect(a.renderSwml()).not.toContain('middleware');
  });
});

describe('the resend dedupe', () => {
  function countingAgent(gate?: Promise<void>): [AgentBase, string[]] {
    const runs: string[] = [];
    const a = agent();
    a.defineTool({
      name: 'charge',
      description: 'Charge',
      handler: async (_args, r) => {
        runs.push(String((r as Json)['tool_call_id'] ?? ''));
        if (gate) await gate;
        return new FunctionResult(`Charged, run ${runs.length}`);
      },
    });
    return [a, runs];
  }

  it('answers a retry after the first finished with its result', async () => {
    const [a, runs] = countingAgent();
    const first = await run(a, 'charge', {}, raw('tc-1'));
    const retry = await run(a, 'charge', {}, raw('tc-1'));
    expect(runs).toEqual(['tc-1']);
    expect(retry).toEqual(first);
    expect(first).toEqual({ response: 'Charged, run 1' });
  });

  it('has a retry while the first is running wait for it', async () => {
    let release!: () => void;
    const [a, runs] = countingAgent(new Promise<void>((r) => (release = r)));
    const first = run(a, 'charge', {}, raw('tc-1'));
    const retry = run(a, 'charge', {}, raw('tc-1'));
    await new Promise((r) => setTimeout(r, 10));
    release();
    expect(await Promise.all([first, retry])).toEqual([
      { response: 'Charged, run 1' },
      { response: 'Charged, run 1' },
    ]);
    expect(runs).toEqual(['tc-1']);
  });

  it.each([
    [raw('tc-1'), raw('tc-2')],
    [raw('tc-1', 'call-1'), raw('tc-1', 'call-2')],
    [raw(null), raw(null)],
  ])('runs other calls: %j then %j', async (first, second) => {
    const [a, runs] = countingAgent();
    await run(a, 'charge', {}, first);
    await run(a, 'charge', {}, second);
    expect(runs).toHaveLength(2);
  });

  it('can be turned off and on', async () => {
    const [a, runs] = countingAgent();
    a.setToolResendDedupe(false);
    await run(a, 'charge', {}, raw('tc-1'));
    await run(a, 'charge', {}, raw('tc-1'));
    expect(runs).toHaveLength(2);
    a.setToolResendDedupe(true);
    await run(a, 'charge', {}, raw('tc-9'));
    await run(a, 'charge', {}, raw('tc-9'));
    expect(runs).toHaveLength(3);
  });

  it('is shared by per-request copies', async () => {
    const [a, runs] = countingAgent();
    const copy = (a as unknown as { createEphemeralCopy: () => AgentBase }).createEphemeralCopy;
    const first = copy.call(a);
    const second = copy.call(a);
    await run(first, 'charge', {}, raw('tc-1'));
    await run(second, 'charge', {}, raw('tc-1'));
    expect(runs).toEqual(['tc-1']);
  });

  it('drops old results', async () => {
    const dedupe = new ResendDedupe(0);
    const runs: number[] = [];
    const next: CallNext = async () => {
      runs.push(1);
      return 'ok';
    };
    await dedupe.handle('charge', {}, raw('tc-1'), next);
    await dedupe.handle('charge', {}, raw('tc-1'), next);
    expect(runs).toHaveLength(2);
  });

  it('never drops an attempt that is still running (found in review)', async () => {
    const dedupe = new ResendDedupe(600, 1);
    const runs: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const next =
      (id: string): CallNext =>
      async () => {
        runs.push(id);
        await gate;
        return id;
      };
    const a = dedupe.handle('t', {}, raw('A'), next('A'));
    const b = dedupe.handle('t', {}, raw('B'), next('B'));
    const retryA = dedupe.handle('t', {}, raw('A'), next('A'));
    release();
    expect(await Promise.all([a, b, retryA])).toEqual(['A', 'B', 'A']);
    expect(runs).toEqual(['A', 'B']);
  });

  it('keeps a handler failure as the outcome, and runs again after a middleware failure (found in review)', async () => {
    const runs: number[] = [];
    const a = agent();
    a.defineTool({
      name: 'charge',
      description: 'Charge',
      handler: async () => {
        runs.push(1);
        throw new Error('boom');
      },
    });
    const first = await run(a, 'charge', {}, raw('tc-1'));
    const retry = await run(a, 'charge', {}, raw('tc-1'));
    expect(runs).toHaveLength(1);
    expect(retry).toEqual(first);

    let fail = true;
    const b = agent().addToolMiddleware((_n, args, r, next) => {
      if (fail) {
        fail = false;
        throw new Error('flaky');
      }
      return next(args, r);
    });
    const bRuns: number[] = [];
    b.defineTool({ name: 'charge', description: 'Charge', handler: () => void bRuns.push(1) });
    await run(b, 'charge', {}, raw('tc-1'));
    await run(b, 'charge', {}, raw('tc-1'));
    expect(bRuns).toHaveLength(1);
  });
});
