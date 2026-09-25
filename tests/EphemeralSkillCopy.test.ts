import { describe, it, expect } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';
import { SkillBase, type SkillToolDefinition } from '../src/skills/SkillBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

/** Test skill that adds a tool and prompt section. */
class EphemeralTestSkill extends SkillBase {
  static override SKILL_NAME = 'ephemeral_test';
  static override SKILL_DESCRIPTION = 'Ephemeral test';

  getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'ephemeral_tool',
        description: 'A tool from ephemeral test skill',
        handler: () => new FunctionResult('ephemeral result'),
      },
    ];
  }
  protected override _getPromptSections() {
    return [{ title: 'Ephemeral Section', body: 'ephemeral body' }];
  }
}

describe('Ephemeral Skill Copy', () => {
  it('ephemeral copy has same skill tools registered', async () => {
    const agent = new AgentBase({
      name: 'eph-agent',
      route: '/',
      basicAuth: ['user', 'pass'],
    });
    agent.setPromptText('You are a test assistant.');

    await agent.addSkill(new EphemeralTestSkill());

    // Verify original has the tool
    const tools = agent.getRegisteredTools();
    expect(tools.some((t) => t.name === 'ephemeral_tool')).toBe(true);

    // Render SWML with dynamic config callback to test ephemeral copy
    let ephemeralToolNames: string[] = [];
    agent.setDynamicConfigCallback((_qp, _body, _headers, copy) => {
      ephemeralToolNames = copy.getRegisteredTools().map((t) => t.name);
    });

    // Trigger SWML rendering via getApp()
    const app = agent.getApp();
    const response = await app.request('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from('user:pass').toString('base64'),
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    expect(ephemeralToolNames).toContain('ephemeral_tool');
  });

  it('ephemeral copy renders SWML with skill tools', async () => {
    const agent = new AgentBase({
      name: 'eph-agent2',
      route: '/',
      basicAuth: ['user', 'pass'],
    });
    agent.setPromptText('You are a test assistant.');
    await agent.addSkill(new EphemeralTestSkill());

    let ephemeralSwml = '';
    agent.setDynamicConfigCallback((_qp, _body, _headers, copy) => {
      ephemeralSwml = copy.renderSwml();
    });

    const app = agent.getApp();
    await app.request('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from('user:pass').toString('base64'),
      },
      body: JSON.stringify({}),
    });

    expect(ephemeralSwml).toBeTruthy();
    const parsed = JSON.parse(ephemeralSwml) as {
      sections: { main: Record<string, unknown>[] };
    };
    const aiBlock = parsed.sections.main.find((v) => v.ai) as {
      ai: { SWAIG?: { functions?: { function: string }[] } };
    };
    expect(aiBlock).toBeDefined();
    const funcs = aiBlock.ai.SWAIG?.functions ?? [];
    expect(funcs.some((f) => f.function === 'ephemeral_tool')).toBe(true);
  });

  it('swaigFields are merged into tool definitions', async () => {
    const agent = new AgentBase({
      name: 'sf-agent',
      route: '/',
      basicAuth: ['user', 'pass'],
    });
    agent.setPromptText('Test');
    await agent.addSkill(new EphemeralTestSkill({ swaig_fields: { wait_file: 'hold.mp3' } }));

    const swml = JSON.parse(agent.renderSwml()) as {
      sections: { main: Record<string, unknown>[] };
    };
    const aiBlock = swml.sections.main.find((v) => v.ai) as {
      ai: { SWAIG: { functions: { function: string; wait_file?: string }[] } };
    };
    const funcs = aiBlock.ai.SWAIG.functions;
    const ephTool = funcs.find((f) => f.function === 'ephemeral_tool');
    expect(ephTool).toBeDefined();
    expect(ephTool!.wait_file).toBe('hold.mp3');
  });

  describe('the copy inherits loaded skills', () => {
    class CountingSkill extends SkillBase {
      static override SKILL_NAME = 'counting_skill';
      static override SKILL_DESCRIPTION = 'Counts setup calls';
      static setups = 0;
      static cleanups = 0;
      override async setup(): Promise<boolean> {
        CountingSkill.setups++;
        return true;
      }
      override async cleanup(): Promise<void> {
        CountingSkill.cleanups++;
      }
      getTools(): SkillToolDefinition[] {
        return [
          { name: 'counted', description: 'counted', handler: () => new FunctionResult('ok') },
        ];
      }
    }

    const auth = { Authorization: 'Basic ' + Buffer.from('user:pass').toString('base64') };

    it("runs a skill's setup once, however many requests are served", async () => {
      CountingSkill.setups = 0;
      const agent = new AgentBase({ name: 'inherit', route: '/', basicAuth: ['user', 'pass'] });
      agent.setPromptText('inherit');
      await agent.addSkill(new CountingSkill());
      const seen: string[][] = [];
      agent.setDynamicConfigCallback((_q, _b, _h, copy) => {
        seen.push(copy.listSkills().map((s) => s.name));
      });
      for (let i = 0; i < 3; i++) {
        expect((await agent.getApp().request('/', { headers: auth })).status).toBe(200);
      }
      expect(CountingSkill.setups).toBe(1);
      expect(seen).toEqual([['counting_skill'], ['counting_skill'], ['counting_skill']]);
    });

    it('adding an inherited skill again is a no-op that lets the callback go on', async () => {
      CountingSkill.setups = 0;
      const agent = new AgentBase({ name: 'readd', route: '/', basicAuth: ['user', 'pass'] });
      agent.setPromptText('readd');
      await agent.addSkill(new CountingSkill());
      agent.setDynamicConfigCallback(async (_q, _b, _h, copy) => {
        await copy.addSkill(new CountingSkill());
        copy.setPromptText('configured after the skill');
      });
      const res = await agent.getApp().request('/', { headers: auth });
      const swml = await res.json();
      const ai = swml.sections.main.find((v: Record<string, unknown>) => 'ai' in v).ai;
      expect(ai.prompt.text).toBe('configured after the skill');
      expect(CountingSkill.setups).toBe(1);
    });

    it('removing an inherited skill on the copy leaves the agent and the instance alone', async () => {
      CountingSkill.cleanups = 0;
      const agent = new AgentBase({ name: 'inherit2', route: '/', basicAuth: ['user', 'pass'] });
      agent.setPromptText('inherit');
      await agent.addSkill(new CountingSkill());
      let removedOnCopy: boolean | undefined;
      agent.setDynamicConfigCallback(async (_q, _b, _h, copy) => {
        await copy.removeSkillByName('counting_skill');
        removedOnCopy = !copy.hasSkill('counting_skill');
      });
      await agent.getApp().request('/', { headers: auth });
      expect(removedOnCopy).toBe(true);
      expect(agent.hasSkill('counting_skill')).toBe(true);
      expect(CountingSkill.cleanups).toBe(0);
    });
  });

  it('keeps a POM prompt structured on the copy, with the sections a callback adds', async () => {
    const agent = new AgentBase({ name: 'pom-copy', route: '/', basicAuth: ['user', 'pass'] });
    agent.promptAddSection('Role', { body: 'You help.' });
    agent.setDynamicConfigCallback((_q, _b, _h, copy) => {
      copy.promptAddSection('Tenant', { body: 'Acme' });
    });
    const res = await agent.getApp().request('/', {
      headers: { Authorization: 'Basic ' + Buffer.from('user:pass').toString('base64') },
    });
    const swml = await res.json();
    const ai = swml.sections.main.find((v: Record<string, unknown>) => 'ai' in v).ai;
    expect(ai.prompt.text).toBeUndefined();
    expect(ai.prompt.pom.map((s: { title: string }) => s.title)).toEqual(['Role', 'Tenant']);
    // The agent's own prompt is unchanged.
    expect(agent.getPromptPom()!.map((s) => s['title'])).toEqual(['Role']);
  });

  describe('the POM copy is independent and complete', () => {
    const auth = { Authorization: 'Basic ' + Buffer.from('user:pass').toString('base64') };
    const promptText = async (agent: AgentBase, query = '') => {
      const res = await agent.getApp().request(`/${query}`, { headers: auth });
      const swml = await res.json();
      return JSON.stringify(
        swml.sections.main.find((v: Record<string, unknown>) => 'ai' in v).ai.prompt,
      );
    };

    it("doesn't carry a bullet one request added into the next request or the agent", async () => {
      const agent = new AgentBase({ name: 'bullets', route: '/', basicAuth: ['user', 'pass'] });
      agent.promptAddSection('Rules', { bullets: ['be polite'] });
      agent.setDynamicConfigCallback((query, _b, _h, copy) => {
        if (query['note']) copy.promptAddToSection('Rules', { bullet: query['note'] });
      });
      expect(await promptText(agent, '?note=caller-a-secret')).toContain('caller-a-secret');
      expect(await promptText(agent)).not.toContain('caller-a-secret');
      expect(JSON.stringify(agent.getPromptPom())).not.toContain('caller-a-secret');
    });

    it('keeps subsections at every depth, with their numbering', async () => {
      const agent = new AgentBase({ name: 'deep', route: '/', basicAuth: ['user', 'pass'] });
      agent.promptAddSection('Top', { body: 'top' });
      agent.promptManager
        .getPomBuilder()!
        .getSection('Top')!
        .addSubsection({ title: 'Child', body: 'child', numbered: true })
        .addSubsection({ title: 'Grandchild', body: 'MANDATORY_DEEP_INSTRUCTION' });
      const before = JSON.stringify(agent.getPromptPom());
      agent.setDynamicConfigCallback(() => undefined);
      const served = await promptText(agent);
      expect(served).toContain('MANDATORY_DEEP_INSTRUCTION');
      expect(served).toContain(JSON.stringify(JSON.parse(before)).slice(1, -1));
    });
  });
});
