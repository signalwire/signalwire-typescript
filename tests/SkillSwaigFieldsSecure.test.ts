/**
 * swaig_fields.secure on a skill sets whether its tools need a token, as in
 * Python, where SkillBase.define_tool passes swaig_fields to define_tool as
 * arguments (core/skill_base.py:59-79).
 */

import { AgentBase } from '../src/AgentBase.js';
import { DateTimeSkill } from '../src/skills/builtin/datetime.js';
import { suppressAllLogs } from '../src/Logger.js';

beforeAll(() => suppressAllLogs(true));

const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');

async function agentWith(swaigFields?: Record<string, unknown>): Promise<AgentBase> {
  const agent = new AgentBase({ name: 'a', route: '/', basicAuth: ['u', 'p'] });
  await agent.addSkill(new DateTimeSkill(swaigFields ? { swaig_fields: swaigFields } : {}));
  return agent;
}

async function callWithoutToken(agent: AgentBase): Promise<string> {
  const res = await agent.getApp().request('/swaig', {
    method: 'POST',
    headers: { authorization: AUTH, 'content-type': 'application/json' },
    body: JSON.stringify({
      function: 'get_current_time',
      call_id: 'call-1',
      argument: { parsed: [{}] },
    }),
  });
  return ((await res.json()) as { response: string }).response;
}

function renderedTool(agent: AgentBase): Record<string, unknown> {
  const swml = agent.renderSwml('call-1') as unknown;
  const doc = (typeof swml === 'string' ? JSON.parse(swml) : swml) as {
    sections: { main: Record<string, { SWAIG: { functions: Record<string, unknown>[] } }>[] };
  };
  const ai = doc.sections.main.find((v) => 'ai' in v)!['ai']!;
  return ai.SWAIG.functions.find((f) => f['function'] === 'get_current_time')!;
}

describe('swaig_fields.secure', () => {
  it('secure: false lets the tool run without a token', async () => {
    const agent = await agentWith({ secure: false });
    expect(await callWithoutToken(agent)).toMatch(/current time/i);
    const tool = renderedTool(agent);
    expect(String(tool['web_hook_url'] ?? '')).not.toContain('__token');
    expect(tool).not.toHaveProperty('secure');
  });

  it('a skill without it still needs a token', async () => {
    const agent = await agentWith();
    expect(await callWithoutToken(agent)).toMatch(/security token/i);
    expect(String(renderedTool(agent)['web_hook_url'])).toContain('__token');
  });

  it('other swaig_fields keys still go into the definition', async () => {
    const agent = await agentWith({ secure: false, wait_file: 'hold.mp3' });
    expect(renderedTool(agent)['wait_file']).toBe('hold.mp3');
  });
});
