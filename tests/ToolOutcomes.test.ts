/**
 * What the model gets back from a tool, from signalwire-python 3.8.0: vouched
 * arguments, refusals, crashes, and handler results that aren't a SWAIG result
 * yet. A tool result the model reads as an outcome must match what happened:
 * a crash can come after the work was done, so it reports the outcome as
 * unknown; a handler that declines says what is true; and data without a
 * response is the data, not "Function completed successfully".
 */
import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';
import {
  SwaigFunction,
  ToolRefusal,
  VOUCHED_PARAMETER,
  VOUCHED_PROMPT,
  TOOL_ERROR_PROMPT,
  settleResult,
} from '../src/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;

const ZIP = {
  type: 'object',
  properties: { zip: { type: 'string', description: 'ZIP' } },
  required: ['zip'],
} as const;

function agent(): AgentBase {
  const a = new AgentBase({ name: 'outcomes', route: '/', basicAuth: ['u', 'p'] });
  a.setPromptText('x');
  return a;
}

function rendered(a: AgentBase, name: string): Json {
  const main = JSON.parse(a.renderSwml())['sections']['main'] as Json[];
  const ai = main.find((v) => 'ai' in v)!['ai'] as Json;
  return (ai['SWAIG']['functions'] as Json[]).find((f) => f['function'] === name)!;
}

/** Run a tool the way the /swaig route does. */
async function run(a: AgentBase, name: string, args: Json): Promise<Json> {
  const fn = a.getTool(name) as SwaigFunction;
  return (await fn._executeAs(a, args, {} as never)) as Json;
}

describe('a vouched tool', () => {
  it('shows the model a required boolean, without changing the definition', () => {
    const a = agent();
    const params = JSON.parse(JSON.stringify(ZIP));
    a.defineTool({
      name: 'find_store',
      description: 'Find a store',
      parameters: params,
      handler: () => 'ok',
      vouched: true,
    });
    const parameters = rendered(a, 'find_store')['parameters'];
    expect(parameters['properties'][VOUCHED_PARAMETER]['type']).toBe('boolean');
    expect(parameters['required']).toEqual(['zip', VOUCHED_PARAMETER]);
    expect(VOUCHED_PARAMETER in params.properties).toBe(false);
  });

  it("isn't added to a tool that isn't vouched", () => {
    const a = agent();
    a.defineTool({
      name: 'find_store',
      description: 'Find a store',
      parameters: ZIP,
      handler: () => 'ok',
    });
    expect(VOUCHED_PARAMETER in rendered(a, 'find_store')['parameters']['properties']).toBe(false);
  });

  it.each([
    { zip: '10001' },
    { zip: '10001', [VOUCHED_PARAMETER]: false },
    { zip: '10001', [VOUCHED_PARAMETER]: 'true' },
  ])("doesn't run the handler unless vouched: %j", async (args) => {
    const calls: Json[] = [];
    const a = agent();
    a.defineTool({
      name: 'find_store',
      description: 'Find a store',
      parameters: ZIP,
      vouched: true,
      handler: (x) => {
        calls.push(x);
        return 'ok';
      },
    });
    const result = await run(a, 'find_store', args);
    expect(calls).toEqual([]);
    expect(result['response']).toEqual({
      tool_result: 'find_store was not run.',
      tool_prompt: VOUCHED_PROMPT,
    });
  });

  it('runs the handler without the argument when vouched', async () => {
    const calls: Json[] = [];
    const a = agent();
    a.defineTool({
      name: 'find_store',
      description: 'Find a store',
      parameters: ZIP,
      vouched: true,
      handler: (x) => {
        calls.push(x);
        return new FunctionResult('Store 12');
      },
    });
    const result = await run(a, 'find_store', { zip: '10001', [VOUCHED_PARAMETER]: true });
    expect(calls).toEqual([{ zip: '10001' }]);
    expect(result['response']).toBe('Store 12');
  });

  it('follows the same rule in execute()', async () => {
    const fn = new SwaigFunction({
      name: 'find_store',
      description: 'Find a store',
      parameters: ZIP,
      vouched: true,
      handler: () => new FunctionResult('Store 12'),
    });
    expect(((await fn.execute({ zip: '1' })) as Json)['response']['tool_result']).toBe(
      'find_store was not run.',
    );
    expect(((await fn.execute({ zip: '1', [VOUCHED_PARAMETER]: true })) as Json)['response']).toBe(
      'Store 12',
    );
  });

  it('is taken by defineTypedTool', () => {
    const a = agent();
    a.defineTypedTool({
      name: 'find_store',
      description: 'Find a store',
      vouched: true,
      handler: (zip: string) => `ok ${zip}`,
    });
    expect(rendered(a, 'find_store')['parameters']['required']).toContain(VOUCHED_PARAMETER);
  });
});

describe('refusals and crashes', () => {
  it("returns a refusal as the handler's own outcome", async () => {
    const a = agent();
    a.defineTool({
      name: 'place_order',
      description: 'Place the order',
      handler: () => {
        throw new ToolRefusal(
          'place_order was not run: the item is out of stock.',
          'Offer the caller the similar items in stock.',
        );
      },
    });
    expect((await run(a, 'place_order', {}))['response']).toEqual({
      tool_result: 'place_order was not run: the item is out of stock.',
      tool_prompt: 'Offer the caller the similar items in stock.',
    });
  });

  it('reports a crash as an unknown outcome, without the exception', async () => {
    const a = agent();
    a.defineTool({
      name: 'charge',
      description: 'Charge the card',
      handler: () => {
        throw new Error('db password rejected for user admin');
      },
    });
    const result = await run(a, 'charge', {});
    expect(result['response']).toEqual({
      tool_result: 'charge failed before it finished, so whether it took effect is unknown.',
      tool_prompt: TOOL_ERROR_PROMPT,
    });
    expect(JSON.stringify(result)).not.toContain('password');
  });

  it('treats an async handler the same', async () => {
    const a = agent();
    a.defineTool({
      name: 'lookup',
      description: 'Look up',
      handler: async () => {
        throw new ToolRefusal('lookup was not run: no account matches.');
      },
    });
    a.defineTool({
      name: 'charge',
      description: 'Charge',
      handler: async () => {
        throw new Error('boom');
      },
    });
    expect((await run(a, 'lookup', {}))['response']).toEqual({
      tool_result: 'lookup was not run: no account matches.',
    });
    expect((await run(a, 'charge', {}))['response']['tool_result']).toMatch(
      /^charge failed before it finished/,
    );
  });

  it("doesn't pass a refusal to the onError hooks", async () => {
    const hook = vi.fn(() => new FunctionResult('hooked'));
    const a = agent();
    a.defineTool({
      name: 'lookup',
      description: 'Look up',
      onError: hook,
      handler: () => {
        throw new ToolRefusal('no.');
      },
    });
    expect((await run(a, 'lookup', {}))['response']).toEqual({ tool_result: 'no.' });
    expect(hook).not.toHaveBeenCalled();
  });

  it('still lets an onError hook answer a crash', async () => {
    const a = agent();
    a.defineTool({
      name: 'charge',
      description: 'Charge',
      onError: () => new FunctionResult('handled'),
      handler: () => {
        throw new Error('boom');
      },
    });
    expect((await run(a, 'charge', {}))['response']).toBe('handled');
  });

  it("still uses a tool's own errorMessage for a crash", async () => {
    const a = agent();
    a.defineTool({
      name: 'charge',
      description: 'Charge',
      errorMessage: 'Charging is down.',
      handler: () => {
        throw new Error('boom');
      },
    });
    expect((await run(a, 'charge', {}))['response']).toBe('Charging is down.');
  });
});

describe('handler results', () => {
  it.each([
    [{ response: 'Done.' }, { response: 'Done.' }],
    [{ action: [{ say: 'Hi' }] }, { action: [{ say: 'Hi' }] }],
    [{ balance: 12.5, currency: 'USD' }, { response: '{"balance":12.5,"currency":"USD"}' }],
    [{}, { response: 'lookup returned no result, so whether it took effect is unknown.' }],
  ])('makes %j a result or its data', async (returned, expected) => {
    expect(settleResult('lookup', returned)).toEqual(expected);
    const fn = new SwaigFunction({
      name: 'lookup',
      description: 'Look up',
      handler: () => ({ ...returned }),
    });
    expect(await fn.execute({})).toEqual(expected);
  });

  it('keeps "Function executed successfully" for nothing returned', async () => {
    expect((settleResult('lookup', undefined) as FunctionResult).toDict()).toEqual({
      response: 'Function executed successfully',
    });
    const fn = new SwaigFunction({
      name: 'lookup',
      description: 'Look up',
      handler: (() => undefined) as never,
    });
    expect(await fn.execute({})).toEqual({ response: 'Function executed successfully' });
  });
});

describe('the new options and outcome rules on every entry point (found in review)', () => {
  it("takes a skill's vouched, nullable_optional and needs_conversation as tool options", async () => {
    const { SkillBase } = await import('../src/skills/SkillBase.js');
    class Shop extends SkillBase {
      static override SKILL_NAME = 'shop';
      static override SKILL_DESCRIPTION = 'Shop';
      constructor() {
        super({ swaig_fields: { vouched: true, nullable_optional: true } });
      }
      getTools(): import('../src/skills/SkillBase.js').SkillToolDefinition[] {
        return [
          {
            name: 'find_store',
            description: 'Find a store',
            parameters: { zip: { type: 'string' }, note: { type: 'string' } },
            required: ['zip'],
            needs_conversation: true,
            handler: () => 'ok',
          },
          { name: 'plain', description: 'Plain', vouched: false, handler: () => 'ok' },
        ];
      }
    }
    const a = agent();
    await a.addSkill(new Shop());
    const fn = a.getTool('find_store') as SwaigFunction;
    expect(fn.vouched).toBe(true);
    expect(fn.nullableOptional).toBe(true);
    expect(fn.needsConversation).toBe(true);
    expect('vouched' in fn.extraFields).toBe(false);
    expect((a.getTool('plain') as SwaigFunction).vouched).toBe(false);
    expect((await run(a, 'find_store', { zip: '1' }))['response']['tool_result']).toBe(
      'find_store was not run.',
    );
  });

  it("applies the vouched check and outcome rules to a plain SWMLService's tools", async () => {
    const { SWMLService } = await import('../src/SWMLService.js');
    const svc = new SWMLService({ name: 'svc', route: '/', basicAuth: ['u', 'p'] });
    svc.defineTool({
      name: 'charge',
      description: 'Charge',
      vouched: true,
      handler: () => 'charged',
    });
    const res = await svc.getApp().request('/swaig', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa('u:p'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ function: 'charge', argument: { parsed: [{}] } }),
    });
    expect(((await res.json()) as Json)['response']['tool_result']).toBe('charge was not run.');
  });

  it('accepts handlers that return nothing, in every entry point', async () => {
    const a = agent();
    a.defineTool({ name: 'sync_void', description: 'x', handler: () => {} });
    a.defineTool({ name: 'async_void', description: 'x', handler: async () => {} });
    a.defineTool({ name: 'nothing', description: 'x', handler: () => null });
    a.defineTypedTool({ name: 'typed_void', description: 'x', handler: () => {} });
    for (const name of ['sync_void', 'async_void', 'nothing', 'typed_void']) {
      expect((await run(a, name, {}))['response'], name).toBe('Function executed successfully');
    }
  });

  it("doesn't change the caller's schema however often it's rendered", () => {
    const params = {
      type: 'object',
      properties: {
        item: { type: 'string' },
        size: { type: ['string', 'null'], enum: ['s', null] },
      },
      required: ['item'],
    };
    const before = JSON.stringify(params);
    const a = agent().setNullableOptionalParameters();
    a.defineTool({
      name: 'add',
      description: 'Add',
      parameters: params,
      vouched: true,
      handler: () => 'ok',
    });
    const first = rendered(a, 'add')['parameters'];
    const second = rendered(a, 'add')['parameters'];
    expect(JSON.stringify(params)).toBe(before);
    expect(second).toEqual(first);
    expect(first['properties']['size']['type']).toEqual(['string', 'null']);
    expect(first['properties']['size']['enum']).toEqual(['s', null]);
  });
});

describe('the second checkpoint review (found in review)', () => {
  it("keeps a skill tool's camel-case options (getTools() may return SwaigFunctionOptions)", async () => {
    const { SkillBase } = await import('../src/skills/SkillBase.js');
    class Camel extends SkillBase {
      static override SKILL_NAME = 'camel';
      static override SKILL_DESCRIPTION = 'Camel';
      getTools(): import('../src/skills/SkillBase.js').SkillToolDefinition[] {
        const tool: import('../src/SwaigFunction.js').SwaigFunctionOptions = {
          name: 'order',
          description: 'Order',
          parameters: { type: 'object', properties: { size: { type: 'string' } } },
          nullableOptional: true,
          needsConversation: true,
          handler: (args) => `size ${String(args['size'])}`,
        };
        return [tool as unknown as import('../src/skills/SkillBase.js').SkillToolDefinition];
      }
    }
    const a = agent();
    await a.addSkill(new Camel());
    const fn = a.getTool('order') as SwaigFunction;
    expect(fn.nullableOptional).toBe(true);
    expect(fn.needsConversation).toBe(true);
    expect(rendered(a, 'order')['parameters']['properties']['size']['type']).toEqual([
      'string',
      'null',
    ]);
    expect((await run(a, 'order', { size: null }))['response']).toBe('size undefined');
  });

  it('gives data holding a bigint as the data, not as a failure', async () => {
    expect(settleResult('lookup', { balance: 1n, nested: { id: 12345678901234567890n } })).toEqual({
      response: '{"balance":"1","nested":{"id":"12345678901234567890"}}',
    });
    const fn = new SwaigFunction({
      name: 'lookup',
      description: 'Look up',
      handler: () => ({ balance: 1n }),
    });
    expect(((await fn.execute({})) as Json)['response']).toBe('{"balance":"1"}');
  });
});
