/**
 * What only a call can do says so in a chat: a payment, putting through.
 */

import { ServiceAgent } from '../../src/operations/agent.js';
import { Messages } from '../../src/operations/messages.js';
import { Charge, Payments } from '../../src/operations/payments.js';
import { Department, FrontDeskAgent, PersonalAssistantAgent } from '../../src/prefabs/index.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';

const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });

async function inChat(agent: ServiceAgent): Promise<CallSimulator> {
  return new CallSimulator(agent, {
    globalData: (await agent.ops.prefilled({ conversation_type: 'chat' }))!,
  });
}

const noSwml = (actions: unknown[]) =>
  !(actions as Record<string, unknown>[]).some((a) => 'SWML' in a);

describe('in a chat', () => {
  it("doesn't take a payment", async () => {
    const agent = new ServiceAgent({ name: 'b', role: 'r', currency: 'USD', suppressLogs: true });
    agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.spore' });
    new Payments({
      connectorUrl: 'https://pay.example.com/c',
      charge: () => new Charge('5', 'x'),
    }).addTo(agent);
    const out = await (await inChat(agent)).call('take_payment', said({ paying_for: '1' }));
    expect(out.response).toBe('A card payment is taken on a call, not in a chat.');
    expect(out.toolPrompt).toBe('Tell them, and offer to take it when they call.');
  });

  it('puts nobody through', async () => {
    const assistant = new PersonalAssistantAgent({
      role: 'r',
      owner: 'Ann',
      reach: '+15550100001',
      messages: new Messages({ save: () => null }),
      suppressLogs: true,
    });
    let out = await (
      await inChat(assistant)
    ).call('put_through', said({ name: 'Bo', reason: 'lunch' }));
    expect(out.response).toBe("Ann can't be put through from a chat.");
    expect(out.toolPrompt).toBe('Tell them, and offer to take a message with take_message.');
    expect(noSwml(out.actions)).toBe(true);
    const desk = new FrontDeskAgent({
      role: 'r',
      departments: { billing: new Department('bills', '+15550100001') },
      suppressLogs: true,
    });
    out = await (await inChat(desk)).call('transfer_to_human', { summary: 'x', to: 'billing' });
    expect(out.response).toBe("billing can't be reached from a chat.");
    expect(noSwml(out.actions)).toBe(true);
  });
});
