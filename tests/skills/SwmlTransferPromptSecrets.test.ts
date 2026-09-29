/**
 * swml_transfer shows the model its destinations. A destination URL carries
 * the target agent's basic-auth credentials, which must not reach the model;
 * the regex keys read as names. Found by the Phase 6 multi-agent tutorial.
 */
import { AgentBase } from '../../src/AgentBase.js';
import { SwmlTransferSkill } from '../../src/skills/builtin/swml_transfer.js';

describe('swml_transfer keeps credentials away from the model', () => {
  it("doesn't put a destination URL's credentials in the prompt or the tool description", async () => {
    const agent = new AgentBase({ name: 'triage', route: '/', basicAuth: ['u', 'p'] });
    agent.promptAddSection('Role', { body: 'Route the caller.' });
    await agent.addSkill(
      new SwmlTransferSkill({
        transfers: {
          '/sales/i': { url: 'https://agent:s3cret-pass@pc.example.com/sales' },
          '/support/i': { url: 'https://agent:s3cret-pass@pc.example.com/support' },
        },
      }),
    );
    const ai = JSON.parse(agent.renderSwml()).sections.main.find((v: { ai?: unknown }) => v.ai).ai;
    const modelFacing = JSON.stringify({
      prompt: ai.prompt,
      functions: (ai.SWAIG.functions as Array<Record<string, unknown>>).map((f) => ({
        description: f.description,
        parameters: f.parameters,
      })),
    });
    expect(modelFacing).not.toContain('s3cret-pass');
    expect(modelFacing).toContain('pc.example.com/sales');
    expect(modelFacing).not.toContain('/sales/i');
  });
});
