/**
 * FrontDeskAgent: departments, appointments, messages and answers from
 * documents, through the CallSimulator.
 */

import { Appointments, Slot } from '../../src/operations/appointments.js';
import { InfoBotKnowledge } from '../../src/operations/infobot/knowledge.js';
import { Messages } from '../../src/operations/messages.js';
import { Department, FrontDeskAgent } from '../../src/prefabs/index.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';

function desk(billingOpen = true): FrontDeskAgent {
  return new FrontDeskAgent({
    role: 'You answer the phone for Bayside Dental.',
    departments: {
      billing: new Department('questions about a bill', '+15550100001', async () => billingOpen),
      'the hygienist': new Department('questions about a cleaning', '+15550100002'),
    },
    appointments: new Appointments({
      openings: () => [new Slot('s1', 'Tuesday at 2 pm')],
      book: () => null,
    }),
    messages: new Messages({ save: () => null }),
    knowledge: new InfoBotKnowledge({ search: () => [{ content: 'We open at 8.', score: 1 }] }),
    callerId: '+15550100000',
    suppressLogs: true,
  });
}

describe('FrontDeskAgent', () => {
  it('offers every part it was given', () => {
    const sim = new CallSimulator(desk());
    expect(sim.offered()).toEqual(
      expect.arrayContaining([
        'transfer_to_human',
        'find_openings',
        'book_appointment',
        'take_message',
        'search_knowledge',
      ]),
    );
    const fn = sim.functions['transfer_to_human'] as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(fn['parameters']['properties']['to']['enum']).toEqual(['billing', 'the hygienist']);
    // Callers say where to go
    expect(fn['gates']).toBeFalsy();
  });

  it('puts a caller through to a department taking calls', async () => {
    const sim = new CallSimulator(desk());
    const out = await sim.call('transfer_to_human', { summary: 'a bill', to: 'billing' });
    const text = JSON.stringify(out.actions);
    expect(text).toContain('+15550100001');
    expect(text).toContain('+15550100000');
    expect(out.response).toBe('The call is being transferred to billing.');
  });

  it('offers a message for a closed department', async () => {
    const sim = new CallSimulator(desk(false));
    const out = await sim.call('transfer_to_human', { summary: 'a bill', to: 'billing' });
    expect(out.response).toBe("billing isn't taking calls now.");
    expect(out.toolPrompt).toBe('Tell them, and offer to take a message with take_message.');
    expect(JSON.stringify(out.actions)).not.toContain('+15550100001');
  });

  it('asks how else to help without messages', async () => {
    const agent = new FrontDeskAgent({
      role: 'r',
      departments: { billing: new Department('bills', '+15550100001', () => false) },
      deskWording: { closed: '{department} está cerrado ahora.' },
      suppressLogs: true,
    });
    const out = await new CallSimulator(agent).call('transfer_to_human', {
      summary: 'x',
      to: 'billing',
    });
    expect(out.response).toBe('billing está cerrado ahora.');
    expect(out.toolPrompt).toBe('Tell them, and ask how else you can help.');
    expect(
      () => new FrontDeskAgent({ role: 'r', deskWording: { open: 'x' }, suppressLogs: true }),
    ).toThrow(/FrontDeskAgent\.WORDING/);
  });

  it('offers knowledge before the caller is identified', async () => {
    const agent = desk();
    agent.identify({ anyOf: [['phone']], find: () => 'p1' });
    const sim = new CallSimulator(agent);
    expect(sim.step).toBe('identify');
    expect(sim.offered()).toContain('search_knowledge');
    expect((await sim.call('search_knowledge', { query: 'hours' })).response).toContain(
      'We open at 8.',
    );
  });

  it('has a name and words of its own', () => {
    expect(desk().name).toBe('front_desk');
    expect(FrontDeskAgent.WORDING['closed']).toBe("{department} isn't taking calls now.");
  });
});
