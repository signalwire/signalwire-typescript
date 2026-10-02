/**
 * Gates on every way to define a tool: defineTool, defineTypedTool, a raw
 * function definition, a skill's tools and a DataMap. Each is checked by the
 * platform's rules when it's defined, and once more as it's sent.
 */
import { AgentBase } from '../src/AgentBase.js';
import { DataMap } from '../src/DataMap.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { SemanticGate } from '../src/SemanticGate.js';
import { SwaigFunction } from '../src/SwaigFunction.js';
import { SkillBase, type SkillToolDefinition } from '../src/skills/SkillBase.js';

const AUTH = `Basic ${Buffer.from('u:p').toString('base64')}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;

function agent(): AgentBase {
  const a = new AgentBase({ name: 'gated', route: '/', basicAuth: ['u', 'p'] });
  a.setPromptText('Gated tools.');
  return a;
}

function functionsOf(doc: Json): Record<string, Json> {
  const ai = doc['sections']['main'].find((v: Json) => 'ai' in v)['ai'];
  return Object.fromEntries(ai['SWAIG']['functions'].map((f: Json) => [f['function'], f]));
}

const rendered = (a: AgentBase) => functionsOf(JSON.parse(a.renderSwml()));

async function served(a: AgentBase): Promise<Record<string, Json>> {
  const res = await a.getApp().request('/', { headers: { Authorization: AUTH } });
  expect(res.status).toBe(200);
  return functionsOf(await res.json());
}

function rawGate(overrides: Json = {}): Json {
  return {
    question: 'Has the caller asked for a refund in `conversation`?',
    threshold: 0.9,
    on_fail: { response: 'refund was not run.' },
    ...overrides,
  };
}

const refundGate = () =>
  new SemanticGate(
    'Has the caller asked for a refund in `conversation`?',
    0.9,
    'refund was not run.',
    {
      id: 'asked',
    },
  );

const handler = () => new FunctionResult('done');

describe('defineTool', () => {
  it('renders gates and gate_fillers on the function, also when served', async () => {
    const a = agent();
    a.defineTool({
      name: 'refund',
      description: 'Refund an order',
      handler,
      gates: [refundGate()],
      gateFillers: { 'en-US': ['Let me check.'] },
    });
    for (const fns of [rendered(a), await served(a)]) {
      expect(fns['refund']!['gates']).toEqual([
        {
          id: 'asked',
          question: 'Has the caller asked for a refund in `conversation`?',
          threshold: 0.9,
          on_fail: { response: 'refund was not run.' },
        },
      ]);
      expect(fns['refund']!['gate_fillers']).toEqual({ 'en-US': ['Let me check.'] });
    }
  });

  it('refuses a bad gate at once', () => {
    expect(() =>
      agent().defineTool({
        name: 'refund',
        description: 'Refund',
        handler,
        gates: [rawGate({ threshold: 2 })],
      }),
    ).toThrow('refund: gate 1: threshold must be a number above 0 and at most 1');
  });

  it('refuses gate fillers without gates', () => {
    expect(() =>
      agent().defineTool({
        name: 'refund',
        description: 'Refund',
        handler,
        gateFillers: { 'en-US': ['One moment.'] },
      }),
    ).toThrow('refund: gate_fillers needs gates');
  });

  it('checks gates passed through extraFields, under the name the function is sent with', () => {
    expect(() =>
      agent().defineTool({
        name: 'refund',
        description: 'Refund',
        handler,
        extraFields: { function: 'end_call', gates: [rawGate()] },
      }),
    ).toThrow('gates are not supported on end_call');
  });

  it('takes fillers keyed by "auto", with wait scripts', () => {
    const a = agent();
    a.defineTool({
      name: 'lookup',
      description: 'Look up an order',
      handler,
      fillers: {
        auto: ['One moment.', ['Still looking.', 'Almost there.']],
        default: ['Hold on.'],
      },
    });
    expect(rendered(a)['lookup']!['fillers']).toEqual({
      auto: ['One moment.', ['Still looking.', 'Almost there.']],
      default: ['Hold on.'],
    });
  });

  it('checks a function once more as it is sent', () => {
    const a = agent();
    a.defineTool({ name: 'refund', description: 'Refund', handler, gates: [rawGate()] });
    const fn = a.getTool('refund') as SwaigFunction;
    // A later change to the function is caught when the SWML is rendered
    (fn.extraFields['gates'] as Json[])[0]!['threshold'] = 5;
    expect(() => a.renderSwml()).toThrow('refund: gate 1: threshold must be');
  });
});

describe('defineTypedTool', () => {
  it('takes gates and gate fillers', () => {
    const a = agent();
    a.defineTypedTool({
      name: 'refund',
      description: 'Refund an order',
      handler: (order: string) => new FunctionResult(`refunded ${order}`),
      gates: [refundGate()],
      gateFillers: { default: ['Checking.'] },
    });
    const fn = rendered(a)['refund']!;
    expect(fn['gates'][0]['id']).toBe('asked');
    expect(fn['gate_fillers']).toEqual({ default: ['Checking.'] });
  });
});

describe('a raw function definition', () => {
  it('is checked, and the caller object is left as it was', () => {
    const a = agent();
    const gate = refundGate();
    const raw = {
      function: 'refund',
      description: 'Refund',
      data_map: { output: { response: 'ok' } },
      gates: [gate],
    };
    a.registerSwaigFunction(raw);
    expect(raw.gates[0]).toBe(gate);
    expect(rendered(a)['refund']!['gates'][0]).toEqual(gate.toDict());
    expect(() =>
      agent().registerSwaigFunction({
        function: 'refund',
        description: 'Refund',
        data_map: {},
        gates: [rawGate({ on_fail: {} })],
      }),
    ).toThrow('refund: gate 1: on_fail.response is missing');
  });

  it('refuses gates: null, which the platform refuses rather than run ungated', () => {
    expect(() =>
      agent().registerSwaigFunction({
        function: 'refund',
        description: 'Refund',
        data_map: {},
        gates: null,
      }),
    ).toThrow('refund: gates must be a list');
  });

  it('refuses a gated definition without a description when it is registered', () => {
    expect(() =>
      agent().registerSwaigFunction({ function: 'refund', data_map: {}, gates: [rawGate()] }),
    ).toThrow('refund: a gated function needs a description');
  });

  it('checks a definition whose gates key is written in another case, as the platform reads it', () => {
    expect(() =>
      agent().registerSwaigFunction({
        function: 'refund',
        description: 'Refund',
        data_map: {},
        Gates: [rawGate({ threshold: 0 })],
      }),
    ).toThrow('refund: gate 1: threshold must be');
  });
});

describe('a skill', () => {
  class GatedSkill extends SkillBase {
    static override SKILL_NAME = 'gated_skill';
    static override SKILL_DESCRIPTION = 'Gated tools';
    getTools(): SkillToolDefinition[] {
      return [
        {
          name: 'own_gate',
          description: 'A tool with its own gate',
          handler,
          gates: [rawGate({ id: 'tool_level' })],
        },
        { name: 'skill_gate', description: 'A tool using the skill default', handler },
      ];
    }
  }

  it("keeps a tool's own gates over the skill's default, and applies the default otherwise", async () => {
    const a = agent();
    await a.addSkill(new GatedSkill({ swaig_fields: { gates: [rawGate({ id: 'skill_level' })] } }));
    const fns = rendered(a);
    expect(fns['own_gate']!['gates'].map((g: Json) => g['id'])).toEqual(['tool_level']);
    expect(fns['skill_gate']!['gates'].map((g: Json) => g['id'])).toEqual(['skill_level']);
  });

  it("keeps a tool's own extraFields, gates and webhook credentials included", async () => {
    class ExtraFieldsSkill extends SkillBase {
      static override SKILL_NAME = 'extra_fields_skill';
      static override SKILL_DESCRIPTION = 'Tools with their own extra fields';
      getTools(): SkillToolDefinition[] {
        const tool = {
          name: 'refund',
          description: 'Refund an order',
          handler,
          extraFields: {
            gates: [rawGate({ id: 'own' })],
            web_hook_auth_user: 'external_user',
            web_hook_auth_password: 'external_password',
          },
        };
        return [tool as SkillToolDefinition];
      }
    }
    const a = agent();
    await a.addSkill(
      new ExtraFieldsSkill({
        swaig_fields: { web_hook_auth_user: 'skill_user', meta_data_token: 't' },
      }),
    );
    const fn = rendered(a)['refund']!;
    expect(fn['gates'].map((g: Json) => g['id'])).toEqual(['own']);
    expect(fn['web_hook_auth_user']).toBe('external_user');
    expect(fn['web_hook_auth_password']).toBe('external_password');
    expect(fn['meta_data_token']).toBe('t');
  });

  it('refuses a skill default the platform would refuse', async () => {
    await expect(
      agent().addSkill(new GatedSkill({ swaig_fields: { gates: [rawGate({ threshold: 0 })] } })),
    ).rejects.toThrow('skill_gate: gate 1: threshold must be');
  });
});

describe('a DataMap', () => {
  it('takes gates and gate fillers', () => {
    const fn = new DataMap('refund')
      .purpose('Refund an order')
      .gate(refundGate())
      .gate(rawGate({ id: 'second' }))
      .gateFillers({ 'en-US': ['Checking.'] })
      .fallbackOutput(new FunctionResult('refunded'))
      .toSwaigFunction();
    expect((fn['gates'] as Json[]).map((g) => g['id'])).toEqual(['asked', 'second']);
    expect(fn['gate_fillers']).toEqual({ 'en-US': ['Checking.'] });
  });

  it('refuses a bad gate when the function is built', () => {
    const map = new DataMap('refund').purpose('Refund').gate(rawGate({ id: 'bad id' }));
    expect(() => map.toSwaigFunction()).toThrow(
      'refund: gate 1: id must be 1 to 64 letters, digits or underscores',
    );
  });

  it('refuses gate fillers without gates', () => {
    expect(() =>
      new DataMap('refund')
        .purpose('Refund')
        .gateFillers({ default: ['x'] })
        .toSwaigFunction(),
    ).toThrow('refund: gate_fillers needs gates');
  });

  it('checks gates after environment variables are expanded', () => {
    process.env['SIGNALWIRE_GATE_TEST_QUESTION'] = 'q'.repeat(8193);
    try {
      const map = new DataMap('refund')
        .purpose('Refund')
        .enableEnvExpansion()
        .gate(rawGate({ question: '${ENV.SIGNALWIRE_GATE_TEST_QUESTION}' }));
      expect(() => map.toSwaigFunction()).toThrow('question is longer than 8192 bytes');
    } finally {
      delete process.env['SIGNALWIRE_GATE_TEST_QUESTION'];
    }
  });

  it('renders on the agent', () => {
    const a = agent();
    new DataMap('refund')
      .purpose('Refund an order')
      .gate(refundGate())
      .fallbackOutput(new FunctionResult('refunded'))
      .registerWithAgent(a);
    expect(rendered(a)['refund']!['gates'][0]['id']).toBe('asked');
  });
});

describe('a per-request copy', () => {
  it("keeps the agent's gates, and a change on the copy doesn't reach the agent", async () => {
    const a = agent();
    a.defineTool({ name: 'refund', description: 'Refund', handler, gates: [refundGate()] });
    a.addPerCallConfig((_q, _b, _h, copy) => {
      const fn = copy.getTool('refund') as SwaigFunction;
      (fn.extraFields['gates'] as Json[])[0]!['question'] = 'Changed on the copy?';
    });
    const fns = await served(a);
    expect(fns['refund']!['gates'][0]['question']).toBe('Changed on the copy?');
    expect(rendered(a)['refund']!['gates'][0]['question']).toBe(
      'Has the caller asked for a refund in `conversation`?',
    );
  });
});
