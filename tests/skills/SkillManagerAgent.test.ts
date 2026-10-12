/**
 * agent.skillManager.loadSkill() / loadSkillByName() register the skill on
 * the agent, as Python's SkillManager.load_skill() does
 * (core/skill_manager.py: register_tools, add_hints, update_global_data,
 * prompt_add_section).
 */

import { AgentBase } from '../../src/AgentBase.js';
import { SkillBase, type SkillToolDefinition } from '../../src/skills/SkillBase.js';
import { SkillManager } from '../../src/skills/SkillManager.js';
import { SkillRegistry } from '../../src/skills/SkillRegistry.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

class LookupSkill extends SkillBase {
  static override SKILL_NAME = 'agent_lookup_skill';
  static override SKILL_DESCRIPTION = 'Looks things up.';

  override getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'lookup_thing',
        description: 'Look a thing up.',
        parameters: {},
        handler: () => new FunctionResult('found it'),
      },
    ];
  }

  protected override _getPromptSections() {
    return [{ title: 'Lookup', body: 'Use lookup_thing to look things up.' }];
  }

  override getHints(): string[] {
    return ['lookup'];
  }

  override getGlobalData(): Record<string, unknown> {
    return { lookup_enabled: true };
  }
}

beforeAll(() => suppressAllLogs(true));

function aiBlock(agent: AgentBase): Record<string, unknown> {
  const swml = agent.renderSwml('call-1') as unknown;
  const doc = (typeof swml === 'string' ? JSON.parse(swml) : swml) as {
    sections: { main: Record<string, Record<string, unknown>>[] };
  };
  return doc.sections.main.find((v) => 'ai' in v)!['ai']!;
}

function expectRegistered(agent: AgentBase): void {
  expect(agent.getTools().map((t) => t.name)).toContain('lookup_thing');
  const ai = aiBlock(agent);
  const functions = (ai['SWAIG'] as { functions: { function: string }[] }).functions;
  expect(functions.map((f) => f.function)).toContain('lookup_thing');
  expect(JSON.stringify(ai['prompt'])).toContain('Use lookup_thing to look things up.');
  expect(ai['hints']).toContain('lookup');
  expect(
    (ai['params'] as Record<string, unknown> | undefined)?.['global_data'] ?? ai['global_data'],
  ).toMatchObject({
    lookup_enabled: true,
  });
}

describe('agent.skillManager', () => {
  afterEach(() => {
    SkillRegistry.getInstance().unregister('agent_lookup_skill');
  });

  it('loadSkill registers the tools, prompt, hints and global data on the agent', async () => {
    const agent = new AgentBase({ name: 'a', route: '/' });
    expect(await agent.skillManager.loadSkill(LookupSkill)).toEqual([true, '']);
    expect(agent.hasSkill('agent_lookup_skill')).toBe(true);
    expectRegistered(agent);
  });

  it('loadSkillByName registers the skill on the agent', async () => {
    SkillRegistry.getInstance().register(LookupSkill);
    const agent = new AgentBase({ name: 'a', route: '/' });
    expect(await agent.skillManager.loadSkillByName('agent_lookup_skill')).toEqual([true, '']);
    expectRegistered(agent);
  });

  it('the tool answers a SWAIG request to the agent', async () => {
    const agent = new AgentBase({ name: 'a', route: '/', basicAuth: ['u', 'p'] });
    await agent.skillManager.loadSkill(LookupSkill);
    const functions = (aiBlock(agent)['SWAIG'] as { functions: Record<string, string>[] })
      .functions;
    const hook = new URL(functions.find((f) => f['function'] === 'lookup_thing')!['web_hook_url']!);
    const res = await agent.getApp().request(`/swaig${hook.search}`, {
      method: 'POST',
      headers: {
        authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        function: 'lookup_thing',
        call_id: 'call-1',
        argument: { parsed: [{}] },
      }),
    });
    expect(((await res.json()) as { response: string }).response).toBe('found it');
  });

  it('a standalone manager still only records the skill', async () => {
    const manager = new SkillManager();
    expect(await manager.loadSkill(LookupSkill)).toEqual([true, '']);
    expect(manager.hasSkill('agent_lookup_skill')).toBe(true);
  });

  it('a second load of a single-instance skill still fails', async () => {
    const agent = new AgentBase({ name: 'a', route: '/' });
    await agent.skillManager.loadSkill(LookupSkill);
    const [ok, message] = await agent.skillManager.loadSkill(LookupSkill);
    expect(ok).toBe(false);
    expect(message).toContain('does not support multiple instances');
  });
});
