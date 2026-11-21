/**
 * Operations beside the rest of an agent: tools it didn't make, other layers'
 * steps and conscience, routers, platform actions, optional and prefilled
 * identity, one field at a time.
 */

import { AgentBase } from '../../src/AgentBase.js';
import { FunctionResult } from '../../src/FunctionResult.js';
import {
  type CallContext,
  type IdentifyOptions,
  Operations,
  ServiceAgent,
} from '../../src/operations/agent.js';
import {
  Change,
  Field,
  Operation,
  Refuse,
  type Values,
  Write,
} from '../../src/operations/model.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';
import type { Loose } from './helpers.js';

const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });
const ops = (sim: CallSimulator): Loose => sim.globalData['ops'];
const strings = (v: unknown): string[] => (v as string[] | null) ?? [];
const ARRAY_OF_STRINGS = { type: 'array', items: { type: 'string' } };
const paramsOf = (agent: AgentBase): Record<string, unknown> =>
  (agent as unknown as { params: Record<string, unknown> }).params;

function bookingAgent(identify: Partial<IdentifyOptions> = {}): ServiceAgent {
  const agent = new ServiceAgent({
    name: 'bistro',
    role: 'You take bookings for a bistro.',
    suppressLogs: true,
  });
  agent.identify({
    anyOf: [['phone']],
    find: (_call, keys) => (keys['phone'] === '555' ? 'g1' : null),
    describe: () => 'Guest g1',
    ...identify,
  });
  agent.writesWith(() => null);
  class Book extends Operation {
    static override description = 'Book a table.';
    static override beforeIdentity = true;
    static override askInOrder = true;
    party = new Field('integer', 'How many people.', { ask: 'How many people is it for?' });
    when = new Field('string', 'The day and time.', { ask: 'What day and time?' });
    override prepare(_call: CallContext, f: Values): Change {
      return new Change({
        readBack: `A table for ${String(f['party'])} at ${String(f['when'])}. Shall I book it?`,
        touches: [`slot:${String(f['when'])}`],
        writes: [new Write('book', { party: f['party'], when: f['when'] })],
      });
    }
  }
  class CancelBooking extends Operation {
    static override description = 'Cancel their booking.';
    override prepare(): Change {
      return new Change({
        readBack: 'Cancel your booking. Shall I?',
        touches: ['booking'],
        writes: [new Write('cancel')],
      });
    }
  }
  agent.operation(Book, { tool: 'book_table' });
  agent.operation(CancelBooking, { tool: 'cancel_booking' });
  return agent;
}

describe('Operations beside the rest of an agent', () => {
  it('starts in main with optional identity and gates only what needs it', async () => {
    const sim = new CallSimulator(bookingAgent({ required: false }));
    expect(sim.step).toBe('main');
    expect(sim.offered()).toContain('find_account');
    expect(JSON.stringify((sim as Loose).contexts)).not.toContain('identify');
    const refused = await sim.call('cancel_booking', said({}));
    expect(refused.response).toContain("Their account isn't found yet.");
    const first = await sim.call('book_table', said({ party: null, when: null }));
    const prompt = first.toolPrompt ?? '';
    expect(prompt.startsWith('Ask them: How many people is it for?')).toBe(true);
    expect(prompt).not.toContain('What day');
    const booked = await sim.call('book_table', said({ party: 2, when: 'Friday at 7' }));
    expect(booked.ran).toBe(true);
    expect(sim.step).toBe('confirm');
    const found = await sim.call('find_account', said({ phone: '555', asked_for: '' }));
    expect(found.response).toContain('Found their account');
    expect(sim.step).toBe('confirm'); // identify doesn't move the call
  });

  it('starts the call identified with a prefill', async () => {
    const agent = bookingAgent({
      prefill: (requestData) => ({ phone: requestData['caller_id_num'] }),
    });
    const known: Loose = await agent.ops.prefilled({ caller_id_num: '555' });
    expect(known['ops']['account_id']).toBe('g1');
    expect(known['ops']['account']).toBe('Guest g1');
    expect(await agent.ops.prefilled({ caller_id_num: '000' })).toBeNull();
    const mods: Loose = await agent.onSwmlRequest({ caller_id_num: '555' });
    expect(mods['global_data']['ops']['account_id']).toBe('g1');
    const sim = new CallSimulator(agent, { globalData: mods['global_data'] });
    expect(sim.step).toBe('main');
    const out = await sim.call('cancel_booking', said({}));
    expect(out.ran).toBe(true);
    expect(sim.step).toBe('confirm');
  });

  it("writes a prefilled account's description as str() does", async () => {
    const agent = bookingAgent({
      prefill: () => ({ phone: '555' }),
      describe: () => ({ tier: 'gold', active: true }),
    });
    const known: Loose = await agent.ops.prefilled({});
    expect(known['ops']['account']).toBe("{'tier': 'gold', 'active': True}");
  });

  it("puts tools it didn't make in the generated steps", async () => {
    const agent = bookingAgent();
    agent.defineTool({
      name: 'weather',
      description: "Today's weather.",
      parameters: {},
      handler: () => new FunctionResult('Sunny.'),
    });
    agent.defineTool({
      name: 'menu',
      description: 'The menu.',
      parameters: {},
      handler: () => new FunctionResult('Soup.'),
    });
    agent.offer(['weather'], { beforeIdentity: true });
    agent.offer(['menu'], { steps: ['main'] });
    const sim = new CallSimulator(agent);
    expect(sim.step).toBe('identify');
    expect(sim.offered()).toContain('weather');
    expect(sim.offered()).not.toContain('menu');
    await sim.call('find_account', said({ phone: '555', asked_for: '' }));
    expect(sim.offered()).toEqual(expect.arrayContaining(['weather', 'menu']));
    // Not where a change waits for a yes, unless named there
    const steps = Object.fromEntries(
      (agent.defineContexts().toDict() as Loose)['default']['steps'].map((s: Loose) => [s.name, s]),
    );
    expect(steps['confirm']['functions']).not.toContain('weather');
  });

  it('routes to destinations, ungated, with a connect', async () => {
    const agent = new ServiceAgent({ name: 'front', role: 'You route calls.', suppressLogs: true });
    const numbers: Record<string, string> = { sales: '+15550001', support: '+15550002' };
    agent.transferWith((_call, _summary, to) => new FunctionResult().connect(numbers[to!]!), {
      destinations: { sales: 'buying something new', support: 'help with something they have' },
      gated: false,
      tool: 'route_call',
      notice: 'Connecting you now.',
    });
    const sim = new CallSimulator(agent);
    expect(sim.offered()).toContain('route_call');
    const fn: Loose = sim.functions['route_call'];
    expect(fn['gates']).toBeFalsy();
    expect(fn['parameters']['properties']['to']['enum']).toEqual(['sales', 'support']);
    const out = await sim.call('route_call', { summary: 'wants to buy', to: 'sales' });
    expect(out.response).toBe('The call is being transferred to sales.');
    const text = JSON.stringify(out.actions);
    expect(text).toContain('Connecting you now.');
    expect(text).toContain('+15550001');
    const wrong: FunctionResult = await (agent.ops as Loose).transferHandler(
      { summary: '', to: 'billing' },
      { global_data: {} },
    );
    expect((wrong.toDict().response as Loose)['tool_result']).toContain(
      "isn't one of the places it goes",
    );
  });

  it('lets a refused transfer move the call', async () => {
    const agent = new ServiceAgent({ name: 'bistro2', role: 'r', suppressLogs: true });
    agent.transferWith(
      (call) => {
        call.go('message');
        throw new Refuse('The host stand is closed.', 'Offer to take a message.');
      },
      { gated: false },
    );
    agent.phase('message', 'Take a message.', []);
    const sim = new CallSimulator(agent);
    const out = await sim.call('transfer_to_human', { summary: 'wants the host' });
    expect(out.response).toBe('The host stand is closed.');
    expect(sim.step).toBe('message');
  });

  it('adds platform actions last', async () => {
    const agent = new ServiceAgent({ name: 'bye', role: 'r', suppressLogs: true });
    agent.writesWith(() => null);
    class Finish extends Operation {
      static override description = 'Say goodbye and end the call.';
      static override confirm = false;
      override prepare(call: CallContext): Change {
        call.act(new FunctionResult().say('Goodbye!').hangup());
        return new Change({ readBack: '', done: 'Ending the call.' });
      }
    }
    agent.operation(Finish, { tool: 'finish' });
    const out = await new CallSimulator(agent).call('finish', said({}));
    expect(
      (out.actions as Record<string, unknown>[]).map((a) => Object.keys(a)[0]).slice(-2),
    ).toEqual(['say', 'hangup']);
  });

  it('installs beside another layer', () => {
    const agent = new AgentBase({ name: 'both', route: '/both', suppressLogs: true });
    agent.setParam('conscience', '${global_data.infobot.now}');
    const ctx = agent.defineContexts().addContext('default');
    ctx
      .addStep('main')
      .addSection('Knowledge', 'Answer from search_knowledge.')
      .setFunctions(['search_knowledge']);
    agent.defineTool({
      name: 'search_knowledge',
      description: 'Search the knowledge base.',
      parameters: {},
      handler: () => new FunctionResult('...'),
    });
    const service = new Operations({ role: 'You help customers.' });
    service.writesWith(() => null);
    class Cancel extends Operation {
      static override description = 'Cancel an order.';
      override prepare(): Change {
        return new Change({ readBack: 'Cancel it. Shall I?' });
      }
    }
    service.operation(Cancel, { tool: 'cancel_order' });
    service.install(agent);
    const contexts = agent.defineContexts().toDict() as Loose;
    const main = contexts['default']['steps'].find((s: Loose) => s.name === 'main');
    expect(main['functions'].slice(0, 2)).toEqual(['search_knowledge', 'cancel_order']);
    const text = JSON.stringify(main);
    expect(text).toContain('Answer from search_knowledge.');
    expect(text).toContain('cancel_order');
    expect(paramsOf(agent)['conscience']).toBe(
      '${global_data.infobot.now}\n\n${global_data.ops.now}',
    );
  });

  it('has no change rule without operations, and a record only for the medium', async () => {
    const faq = (extra: { medium?: string } = {}) => {
      const agent = new ServiceAgent({
        name: 'faq',
        role: 'You answer questions.',
        suppressLogs: true,
        ...extra,
      });
      agent.lookup('Opening hours.', { fields: {} })(function hours() {
        return '9 to 5.';
      });
      return agent;
    };
    const found = faq();
    const sim = new CallSimulator(found);
    expect(found.renderSwml()).not.toContain('Nothing changes until');
    expect(ops(sim)['medium']).toBe('');
    expect(sim.params['conscience']).toBe('${global_data.ops.now}');
    const chat: Loose = await found.ops.prefilled({ conversation_type: 'chat' });
    expect(chat['ops']['now']).toBe('This is a chat.');
    const given = new CallSimulator(faq({ medium: 'voice' }));
    // Nothing to keep
    expect('ops' in given.globalData).toBe(false);
    expect('conscience' in given.params).toBe(false);
  });

  it('passes fillers by language through', () => {
    const agent = new ServiceAgent({ name: 'es', role: 'r', suppressLogs: true });
    agent.lookup('Hours.', {
      fields: {},
      fillers: { 'es-ES': ['Un momento.'], 'en-US': ['One moment.'] },
    })(function hours() {
      return '9 a 5.';
    });
    const fn: Loose = new CallSimulator(agent).functions['hours'];
    expect(fn['fillers']).toEqual({ 'es-ES': ['Un momento.'], 'en-US': ['One moment.'] });
  });
});

function addressAndItemsAgent(): ServiceAgent {
  const agent = new ServiceAgent({ name: 'orders', role: 'r', suppressLogs: true });
  agent.writesWith(() => null);
  class Address extends Operation {
    static override description = "Change the order's address.";
    street = new Field('string', 'The new street address.');
    override prepare(_call: CallContext, f: Values): Change {
      return new Change({
        readBack: `Ship it to ${String(f['street'])}. Shall I?`,
        touches: ['order:1'],
        writes: [new Write('address')],
      });
    }
  }
  class Items extends Operation {
    static override description = "Change the order's items.";
    color = new Field('string', 'The color they want.');
    address_too = new Field('boolean', 'Whether they also want the address changed.');
    override prepare(call: CallContext, f: Values): Change {
      const history = (call.data['history'] as Record<string, unknown>[] | undefined) ?? [];
      const settled = history.some((h) => h['kind'] === 'address');
      return new Change({
        readBack: `Make it ${String(f['color'])}. Shall I?`,
        touches: ['order:1', 'item:1'],
        writes: [new Write('items')],
        after: f['address_too'] && !settled ? 'address' : null,
        afterWhy: 'the items change last',
      });
    }
  }
  agent.operation(Address, { tool: 'change_address' });
  agent.operation(Items, { tool: 'change_items' });
  return agent;
}

function itemsAgent(name: string): ServiceAgent {
  const agent = new ServiceAgent({ name, role: 'r', suppressLogs: true });
  agent.writesWith(() => null);
  class Items extends Operation {
    static override description = "Change the order's items.";
    static override combine: readonly string[] = [];
    items = new Field(ARRAY_OF_STRINGS, 'The items to change.');
    override prepare(_call: CallContext, f: Values): Change {
      const items = strings(f['items']);
      return new Change({
        readBack: `Change ${items.join(', ')}. Shall I?`,
        touches: ['order:1'],
        writes: [new Write('items', { items: [...items] })],
      });
    }
  }
  agent.operation(Items, { tool: 'change_items' });
  return agent;
}

describe('changes that wait for others', () => {
  it('keeps a change after another and offers it once that one is settled', async () => {
    const sim = new CallSimulator(addressAndItemsAgent());
    const held = await sim.call('change_items', said({ color: 'red', address_too: true }));
    expect(
      held.response.startsWith(
        'Not read to them yet: the address change they asked for goes first, since the',
      ),
    ).toBe(true);
    expect(held.toolPrompt ?? '').toContain('Call change_address now');
    expect(sim.step).toBe('main');
    expect(ops(sim)['queued'].map((q: Loose) => q.kind)).toEqual(['items']);
    expect(ops(sim)['waiting']).toEqual({});
    await sim.call('change_address', said({ street: '1 Main St' }));
    expect(sim.step).toBe('confirm');
    expect(ops(sim)['queued'].map((q: Loose) => q.kind)).toEqual(['items']);
    sim.caller('Yes.');
    const done = await sim.call('confirm_change', { change: 'address' });
    expect(done.toolPrompt ?? '').toContain(
      'call change_items again for the change set aside: "Make it red. Shall I?"',
    );
    const again = await sim.call('change_items', said({ color: 'red', address_too: true }));
    expect(sim.step, again.response).toBe('confirm');
    expect(ops(sim)['queued']).toEqual([]);
  });

  it('turns chaining back on in every generated result, and asks for the rest after a change', async () => {
    const sim = new CallSimulator(addressAndItemsAgent());
    const out = await sim.call('change_address', said({ street: '1 Main St' }));
    expect(out.actions[0]).toEqual({ back_to_back_functions: 'forever' });
    sim.caller('Yes.');
    const done = await sim.call('confirm_change', { change: 'address' });
    expect(done.actions[0]).toEqual({ back_to_back_functions: 'forever' });
    expect(done.toolPrompt ?? '').toContain(
      "anything else in this call that isn't done yet, call its tool now",
    );
  });

  it('says what to add for an as_well with nothing new', async () => {
    const sim = new CallSimulator(itemsAgent('orders3'));
    await sim.call('change_items', said({ items: ['a'] }));
    const same = await sim.call('change_items', said({ items: ['a'], as_well: true }));
    expect(same.response.startsWith('Nothing is added')).toBe(true);
    expect(same.toolPrompt ?? '').toContain('what else they asked for');
    const again = await sim.call('change_items', said({ items: ['a'] }));
    // Asked again as it is, without as_well
    expect(again.response).toContain("That's the change already read back");
    const more = await sim.call('change_items', said({ items: ['b'], as_well: true }));
    expect(more.response).toContain('Change a, b. Shall I?');
  });

  it('says in a read-back what to do with more asked for', async () => {
    const sim = new CallSimulator(itemsAgent('orders4'));
    const first = await sim.call('change_items', said({ items: ['a'] }));
    const prompt = first.toolPrompt ?? '';
    expect(first.response).toContain('Change a. Shall I?');
    expect(prompt).toContain('as_well: true');
    expect(prompt).toContain('call its tool again with what they want');
    expect(prompt).not.toContain('want a change, call decline_change');
    expect(prompt).toContain('decline_change');
    expect(prompt).toContain('answer it, then ask again whether to go ahead');
  });

  it('merges, asks about or replaces a second change held for the same things', async () => {
    const agent = new ServiceAgent({ name: 'orders2', role: 'r', suppressLogs: true });
    agent.writesWith(() => null);
    class Address extends Operation {
      static override description = "Change the order's address.";
      street = new Field('string', 'The new street address.');
      override prepare(_call: CallContext, f: Values): Change {
        return new Change({
          readBack: `Ship it to ${String(f['street'])}. Shall I?`,
          touches: ['order:1'],
          writes: [new Write('address')],
        });
      }
    }
    class Items extends Operation {
      static override description = "Change the order's items.";
      static override combine: readonly string[] = [];
      items = new Field(ARRAY_OF_STRINGS, 'The items to change.');
      address_too = new Field('boolean', 'Whether they also want the address changed.');
      override prepare(call: CallContext, f: Values): Change {
        const history = (call.data['history'] as Record<string, unknown>[] | undefined) ?? [];
        const settled = history.some((h) => h['kind'] === 'address');
        const items = strings(f['items']);
        return new Change({
          readBack: `Change ${items.join(', ')}. Shall I?`,
          touches: ['order:1', ...items.map((i) => `item:${i}`)],
          writes: [new Write('items', { items: [...items] })],
          after: f['address_too'] && !settled ? 'address' : null,
        });
      }
    }
    agent.operation(Address, { tool: 'change_address' });
    agent.operation(Items, { tool: 'change_items' });
    const sim = new CallSimulator(agent);
    const queuedItems = () => ops(sim)['queued'].map((q: Loose) => q.args.items);
    await sim.call('change_items', said({ items: ['a'], address_too: true }));
    const asked = await sim.call('change_items', said({ items: ['b'], address_too: true }));
    expect(asked.response).toContain('already set aside for after another');
    expect(asked.toolPrompt ?? '').toContain('as_well');
    expect(queuedItems()).toEqual([['a']]); // nothing lost while asking
    await sim.call('change_items', said({ items: ['b'], address_too: true, as_well: true }));
    expect(queuedItems()).toEqual([['a', 'b']]);
    await sim.call('change_items', said({ items: ['c'], address_too: true, as_well: false }));
    expect(queuedItems()).toEqual([['c']]); // in place of it
    await sim.call('change_address', said({ street: '1 Main St' }));
    sim.caller('Yes.');
    const done = await sim.call('confirm_change', { change: 'address' });
    expect(done.toolPrompt ?? '').toContain(
      'call change_items again for the change set aside: "Change c. Shall I?"',
    );
  });
});
