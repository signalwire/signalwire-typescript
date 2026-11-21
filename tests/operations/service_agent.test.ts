/**
 * ServiceAgent end to end through the CallSimulator: a small shop with an
 * account lookup, cancel, return, exchange and address operations.
 */

import { type CallContext, ServiceAgent } from '../../src/operations/agent.js';
import {
  Change,
  Field,
  Operation,
  Refuse,
  type Values,
  Write,
  WriteFailed,
} from '../../src/operations/model.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';
import type { Loose } from './helpers.js';

type Order = { status: string; items: Record<string, number>; paid: string };
const ORDERS: Record<string, Order> = {};
const WRITES: [string, Record<string, unknown>][] = [];
const FAIL_ON = new Set<string>();
const FAIL_IDS = new Set<string>();
const KEYS: string[] = [];

function freshOrders(): void {
  for (const k of Object.keys(ORDERS)) delete ORDERS[k];
  Object.assign(ORDERS, {
    '#W1': { status: 'pending', items: { a: 10.0, b: 20.0 }, paid: 'card' },
    '#W2': { status: 'pending', items: { c: 5.0 }, paid: 'card' },
    '#W3': { status: 'delivered', items: { d: 30.0, e: 40.0 }, paid: 'card' },
  });
  WRITES.length = 0;
  FAIL_ON.clear();
  FAIL_IDS.clear();
  KEYS.length = 0;
}

function write(call: CallContext, w: Write): void {
  KEYS.push(call.writeKey);
  if (FAIL_ON.has(w.name) || FAIL_IDS.has(String(w.args['order_id']))) {
    throw new WriteFailed(`${w.name} was refused`);
  }
  WRITES.push([w.name, { ...w.args }]);
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const strings = (v: unknown): string[] => (v as string[] | null) ?? [];
const ARRAY_OF_STRINGS = { type: 'array', items: { type: 'string' } };

function delivered(orderId: string): Order {
  const order = ORDERS[orderId];
  if (!order || order.status !== 'delivered')
    throw new Refuse(`${orderId} isn't a delivered order.`);
  return order;
}

class Cancel extends Operation {
  static override description = 'Cancel pending orders.';
  static override combine = ['reason'];
  order_ids = new Field(ARRAY_OF_STRINGS, 'The orders to cancel.');
  reason = new Field(['no longer needed', 'ordered by mistake'], 'Why.', {
    ask: 'Why are they cancelling?',
  });

  override prepare(_call: CallContext, f: Values): Change {
    const orders = strings(f['order_ids'])
      .filter((o) => o in ORDERS)
      .map((o) => [o, ORDERS[o]!] as const);
    const late = orders.filter(([, order]) => order.status !== 'pending').map(([o]) => o);
    if (late.length > 0) {
      throw new Refuse(`${late.join(', ')} can't be cancelled: only pending orders can.`);
    }
    const refund = orders.map(([, order]) => sum(Object.values(order.items)));
    return new Change({
      readBack: `Cancel ${orders.map(([o]) => o).join(' and ')}, refunding $${sum(refund).toFixed(2)}. Shall I go ahead?`,
      touches: orders.map(([o]) => `order:${o}`),
      writes: orders.map(([o]) => new Write('cancel', { order_id: o, reason: f['reason'] })),
      money: refund.map((r) => -r),
      done: orders.map(([o]) => `${o} is cancelled.`),
    });
  }
}

class Return extends Operation {
  static override description = 'Return items of a delivered order.';
  static override combine = ['refund_to'];
  order_id = new Field('string', 'The delivered order.');
  items = new Field(ARRAY_OF_STRINGS, 'The items to return.');
  refund_to = new Field('string', 'Where the refund goes.', {
    ask: 'Should the refund go to the card or a gift card?',
  });

  override prepare(_call: CallContext, f: Values): Change {
    const orderId = String(f['order_id']);
    const order = delivered(orderId);
    const items = strings(f['items']);
    const refund = sum(items.map((i) => order.items[i]!));
    return new Change({
      readBack: `Return ${items.join(', ')} from ${orderId}, $${refund.toFixed(2)} to ${String(f['refund_to'])}. Shall I?`,
      touches: [`order:${orderId}`, ...items.map((i) => `item:${i}`)],
      writes: [new Write('return', { order_id: orderId, items: [...items], to: f['refund_to'] })],
      money: [-refund],
      done: `The return of ${items.join(', ')} is requested.`,
    });
  }

  override conflictsWith(other: string, mine: Change, theirs: Change): string | null {
    if (other === 'exchange' && theirs.touches.includes(mine.touches[0]!)) {
      return 'a delivered order takes one return or one exchange, not both';
    }
    return null;
  }

  override without(args: Record<string, unknown>, gone: ReadonlySet<string>) {
    const items = strings(args['items']).filter((i) => !gone.has(`item:${i}`));
    return items.length > 0 ? { ...args, items } : null;
  }
}

class Exchange extends Operation {
  static override description = 'Exchange items of a delivered order for other options.';
  order_id = new Field('string', 'The delivered order.');
  items = new Field(ARRAY_OF_STRINGS, 'The items to exchange.');

  override prepare(_call: CallContext, f: Values): Change {
    const orderId = String(f['order_id']);
    delivered(orderId);
    const items = strings(f['items']);
    return new Change({
      readBack: `Exchange ${items.join(', ')} in ${orderId}. Shall I?`,
      touches: [`order:${orderId}`, ...items.map((i) => `item:${i}`)],
      writes: [new Write('exchange', { order_id: orderId, items: [...items] })],
    });
  }
}

class Address extends Operation {
  static override description = 'Change where pending orders ship.';
  static override goesBefore = ['cancel'];
  order_ids = new Field(ARRAY_OF_STRINGS, 'The pending orders.');
  address = new Field('string', 'The new address.');

  override without(args: Record<string, unknown>, gone: ReadonlySet<string>) {
    const left = strings(args['order_ids']).filter((o) => !gone.has(`order:${o}`));
    return left.length > 0 ? { ...args, order_ids: left } : null;
  }

  override prepare(_call: CallContext, f: Values): Change {
    const ids = strings(f['order_ids']);
    return new Change({
      readBack: `Ship ${ids.join(' and ')} to ${String(f['address'])}. Shall I?`,
      touches: ids.map((o) => `order:${o}`),
      writes: ids.map((o) => new Write('address', { order_id: o, address: f['address'] })),
    });
  }
}

function noAccount(): never {
  throw new Refuse('No account was found with that.', 'Ask them to spell it.');
}

function buildAgent(): ServiceAgent {
  const agent = new ServiceAgent({
    name: 'shop',
    role: 'You answer the phone for a small shop.',
    currency: 'USD',
    suppressLogs: true,
  });
  agent.identify({
    anyOf: [['email'], ['name', 'zip']],
    find: (_call, keys) =>
      keys['email'] === 'a@b.c' || keys['zip'] === '12345' ? 'u1' : noAccount(),
    describe: () => 'Ann, orders #W1 #W2 #W3',
  });
  agent.writesWith(write);
  agent.transferWith(() => null);
  agent.lookup("An order's items and status.", {
    fields: { order_id: new Field('string', "The order's id.") },
  })(function order_details(_call, { order_id }) {
    const order = ORDERS[String(order_id ?? '')];
    if (order === undefined) throw new Refuse(`${String(order_id)} isn't one of their orders.`);
    return `${String(order_id)}: ${order.status}, items ${Object.keys(order.items).join(', ')}.`;
  });
  agent.operation(Cancel, { tool: 'cancel_order' });
  agent.operation(Return, { tool: 'return_items' });
  agent.operation(Exchange, { tool: 'exchange_items' });
  agent.operation(Address, { tool: 'change_address' });
  return agent;
}

const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });
const ops = (sim: CallSimulator): Loose => sim.globalData['ops'];

async function identified(): Promise<CallSimulator> {
  freshOrders();
  const s = new CallSimulator(buildAgent());
  s.caller("Hi, it's ann, a@b.c");
  const found = await s.call('find_account', {
    email: 'a@b.c',
    asked_for: 'cancel an order',
    data_supplied_by_user: true,
  });
  expect(found.ran).toBe(true);
  expect(found.response).toContain('Found their account');
  expect(s.step).toBe('main');
  return s;
}

describe('ServiceAgent', () => {
  let sim: CallSimulator;
  beforeEach(async () => {
    sim = await identified();
  });

  it('generates its steps and tools', () => {
    const agent = buildAgent();
    const text = agent.preview();
    expect(text).toContain('== default/identify');
    expect(text).toContain('== default/main');
    expect(text).toContain('== default/confirm');
    expect(text).toContain('cancel_order (Cancel pending orders)');
    const s = new CallSimulator(agent);
    expect(s.step).toBe('identify');
    expect(new Set(s.offered())).toEqual(new Set(['find_account', 'transfer_to_human']));
    expect(ops(s)['now']).toBe('');
  });

  it('needs the account first', async () => {
    freshOrders();
    const s = new CallSimulator(buildAgent());
    const miss = await s.call('find_account', {
      email: 'x@y.z',
      asked_for: '',
      data_supplied_by_user: true,
    });
    expect(miss.response).toContain('No account was found');
    const partial = await s.call('find_account', {
      name: 'Ann',
      asked_for: '',
      data_supplied_by_user: true,
    });
    expect(partial.response).toContain('it takes their email, or their name and zip');
  });

  it('reads a cancel back, takes the yes, and records it', async () => {
    const proposed = await sim.call(
      'cancel_order',
      said({ order_ids: ['#W1'], reason: 'no longer needed' }),
    );
    expect(proposed.ran).toBe(true);
    expect(sim.step).toBe('confirm');
    expect(ops(sim)['waiting']['read_back']).toMatch(/^Cancel #W1, refunding \$30\.00/);
    expect(ops(sim)['now']).toContain('Waiting for their answer');
    sim.caller('yes');
    const done = await sim.call('confirm_change', { change: 'cancel' });
    expect(done.ran).toBe(true);
    expect(done.response).toMatch(/^Done\. #W1 is cancelled\./);
    expect(WRITES).toEqual([['cancel', { order_id: '#W1', reason: 'no longer needed' }]]);
    expect(sim.step).toBe('main');
    const last = ops(sim)['history'].at(-1);
    expect(last['outcome']).toBe('made');
    // A JS number has no float form: -30.0 is -30 (the reference writes "-30.0")
    expect(last['money']).toBe('-30');
    expect(last['currency']).toBe('USD');
  });

  it('asks for a missing reason rather than guessing it', async () => {
    const asked = await sim.call('cancel_order', said({ order_ids: ['#W1'], reason: 'not said' }));
    expect(asked.toolPrompt ?? '').toContain('Why are they cancelling?');
    expect(sim.step).toBe('main');
    expect(ops(sim)['waiting']).toEqual({});
  });

  it('refuses by rule', async () => {
    const refused = await sim.call(
      'cancel_order',
      said({ order_ids: ['#W3'], reason: 'no longer needed' }),
    );
    expect(refused.response).toBe(
      "Nothing is changed: #W3 can't be cancelled: only pending orders can.",
    );
  });

  it('is vouched', async () => {
    const out = await sim.call('cancel_order', {
      order_ids: ['#W1'],
      reason: 'no longer needed',
      data_supplied_by_user: false,
    });
    expect(!out.ran || (out.toolPrompt ?? '').includes('Get the answer')).toBe(true);
  });

  it('asks about as_well, then merges', async () => {
    await sim.call('cancel_order', said({ order_ids: ['#W1'], reason: 'no longer needed' }));
    const asked = await sim.call(
      'cancel_order',
      said({ order_ids: ['#W1', '#W2'], reason: 'no longer needed' }),
    );
    expect(asked.toolPrompt ?? '').toContain('as_well');
    const merged = await sim.call(
      'cancel_order',
      said({ order_ids: ['#W2'], reason: 'no longer needed', as_well: true }),
    );
    expect(merged.response).toContain('added to the cancel change');
    expect(ops(sim)['waiting']['read_back']).toMatch(/^Cancel #W1 and #W2, refunding \$35\.00/);
    expect(ops(sim)['history'].at(-1)['outcome']).toBe('replaced');
  });

  it('replaces a narrowed request without asking', async () => {
    await sim.call('cancel_order', said({ order_ids: ['#W1', '#W2'], reason: 'no longer needed' }));
    const narrowed = await sim.call(
      'cancel_order',
      said({ order_ids: ['#W2'], reason: 'no longer needed' }),
    );
    expect(narrowed.ran).toBe(true);
    expect(narrowed.response).toContain('takes the place');
    expect(ops(sim)['waiting']['read_back']).toMatch(/^Cancel #W2,/);
  });

  it('takes over on a conflict and keeps the rest', async () => {
    await sim.call('return_items', said({ order_id: '#W3', items: ['d', 'e'], refund_to: 'card' }));
    const swapped = await sim.call(
      'exchange_items',
      said({ order_id: '#W3', items: ['d'], as_well: false }),
    );
    expect(swapped.response).toContain('takes the place of the return change');
    expect(ops(sim)['waiting']['kind']).toBe('exchange');
    expect(ops(sim)['queued'][0]['read_back']).toMatch(/^Return e from #W3/);
  });

  it('refuses a conflict asked for as well', async () => {
    await sim.call('return_items', said({ order_id: '#W3', items: ['d'], refund_to: 'card' }));
    const both = await sim.call(
      'exchange_items',
      said({ order_id: '#W3', items: ['e'], as_well: true }),
    );
    expect(both.response).toContain("can't have both");
    expect(ops(sim)['waiting']['kind']).toBe('return');
  });

  it('reads an unrelated request now and sets the waiting one aside', async () => {
    await sim.call('cancel_order', said({ order_ids: ['#W1'], reason: 'no longer needed' }));
    const other = await sim.call(
      'return_items',
      said({ order_id: '#W3', items: ['d'], refund_to: 'card' }),
    );
    expect(other.response).toContain('kept for after this one');
    expect(ops(sim)['waiting']['kind']).toBe('return');
    sim.caller('yes');
    const done = await sim.call('confirm_change', { change: 'return' });
    expect(done.toolPrompt ?? '').toContain(
      'call cancel_order again for the change set aside: "Cancel #W1',
    );
  });

  it('keeps the waiting change first when it goes before', async () => {
    await sim.call('change_address', said({ order_ids: ['#W1'], address: '1 Main St' }));
    const later = await sim.call(
      'cancel_order',
      said({ order_ids: ['#W1'], reason: 'no longer needed' }),
    );
    expect(later.response).toContain('Kept for right after the change waiting');
    expect(ops(sim)['waiting']['kind']).toBe('address');
    expect(ops(sim)['queued'][0]['kind']).toBe('cancel');
  });

  it('confirms only the change waiting', async () => {
    await sim.call('cancel_order', said({ order_ids: ['#W1'], reason: 'no longer needed' }));
    const wrong = await sim.call('confirm_change', { change: 'return' });
    expect(wrong.response).toContain('the change waiting for their answer is the cancel change');
    expect(WRITES).toEqual([]);
  });

  it('declines', async () => {
    await sim.call('cancel_order', said({ order_ids: ['#W1'], reason: 'no longer needed' }));
    const no = await sim.call('decline_change', { change: 'cancel' });
    expect(no.ran).toBe(true);
    expect(no.toolPrompt ?? '').toContain('left as it was');
    expect(ops(sim)['history'].at(-1)['outcome']).toBe('declined');
    expect(ops(sim)['waiting']).toEqual({});
    expect(sim.step).toBe('main');
  });

  it('counts only what went through on a partial failure', async () => {
    FAIL_ON.add('cancel');
    await sim.call('cancel_order', said({ order_ids: ['#W1'], reason: 'no longer needed' }));
    sim.caller('yes');
    const out = await sim.call('confirm_change', { change: 'cancel' });
    expect(out.response).toMatch(/^The change didn't go through: cancel was refused\./);
    const last = ops(sim)['history'].at(-1);
    expect(last['money']).toBe('0');
    expect([last['outcome'], last['reason']]).toEqual(['not made', 'cancel was refused']);
  });

  it('totals two changes', async () => {
    await sim.call('cancel_order', said({ order_ids: ['#W1'], reason: 'no longer needed' }));
    sim.caller('yes');
    await sim.call('confirm_change', { change: 'cancel' });
    await sim.call('return_items', said({ order_id: '#W3', items: ['d'], refund_to: 'card' }));
    sim.caller('yes');
    const out = await sim.call('confirm_change', { change: 'return' });
    expect(out.response).toContain(
      'In all, the changes made in this call come to $60.00 back to them.',
    );
  });

  it('refuses a change before the account is found', async () => {
    freshOrders();
    const s = new CallSimulator(buildAgent());
    // As if a step moved without identity
    (s as unknown as { enterStep(name: string): void }).enterStep('main');
    const out = await s.call(
      'cancel_order',
      said({ order_ids: ['#W1'], reason: 'no longer needed' }),
    );
    expect(out.response).toContain("Their account isn't found yet.");
  });

  it("says a lookup's refusal whole", async () => {
    const out = await sim.call('order_details', { order_id: '#W9' });
    expect(out.response).toBe("#W9 isn't one of their orders.");
  });

  it('keeps all of the waiting change for an as_well within it', async () => {
    await sim.call('return_items', said({ order_id: '#W3', items: ['d', 'e'], refund_to: 'card' }));
    await sim.call(
      'return_items',
      said({ order_id: '#W3', items: ['d'], refund_to: 'card', as_well: true }),
    );
    const items = String(ops(sim)['waiting']['read_back']).split('Return ')[1]!.split(' from')[0]!;
    expect(items).toContain('d');
    expect(items).toContain('e');
  });

  it("sets the read-back's state before its say", async () => {
    const out = await sim.call(
      'cancel_order',
      said({ order_ids: ['#W1'], reason: 'no longer needed' }),
    );
    const actions = out.actions as Record<string, unknown>[];
    const says = actions.flatMap((a, i) => ('say' in a ? [i] : []));
    const states = actions.flatMap((a, i) =>
      'semantic_state' in ((a['set_global_data'] as Record<string, unknown>) ?? {}) ? [i] : [],
    );
    expect(says.length).toBeGreaterThan(0);
    expect(states.length).toBeGreaterThan(0);
    expect(states[0]!).toBeLessThan(says[0]!);
    for (const i of says) expect('set_global_data' in actions[i]!).toBe(false);
  });

  it('gives every write in a call its own key', async () => {
    for (const order of ['#W1', '#W2']) {
      await sim.call('cancel_order', said({ order_ids: [order], reason: 'no longer needed' }));
      sim.caller('yes');
      await sim.call('confirm_change', { change: 'cancel' });
    }
    expect(KEYS.length).toBe(2);
    expect(new Set(KEYS).size).toBe(2);
  });

  it('narrows a change set aside to give way to a newer one', async () => {
    await sim.call('change_address', said({ order_ids: ['#W1', '#W2'], address: '1 Main St' }));
    await sim.call('return_items', said({ order_id: '#W3', items: ['d'], refund_to: 'card' }));
    expect(ops(sim)['queued'][0]['read_back']).toMatch(/^Ship #W1 and #W2 to 1 Main St/);
    const out = await sim.call('change_address', said({ order_ids: ['#W1'], address: '2 Oak St' }));
    expect(out.response).toContain('set aside for later is now only this');
    const queued = (ops(sim)['queued'] as Record<string, unknown>[]).filter(
      (q) => q['kind'] === 'address',
    );
    expect(queued.map((q) => q['read_back'])).toEqual(['Ship #W2 to 1 Main St. Shall I?']);
  });

  it('says what went through first when one done line is for the whole change', async () => {
    freshOrders();
    const agent = new ServiceAgent({ name: 'shop2', role: 'r', suppressLogs: true });
    agent.writesWith(write);
    class CancelBoth extends Operation {
      static override description = 'Cancel pending orders.';
      order_ids = new Field(ARRAY_OF_STRINGS, 'The orders.');
      override prepare(_call: CallContext, f: Values): Change {
        const ids = strings(f['order_ids']);
        return new Change({
          readBack: `Cancel ${ids.join(' and ')}. Shall I?`,
          touches: ids,
          writes: ids.map((o) => new Write('cancel', { order_id: o })),
          done: 'Both are cancelled.',
        });
      }
    }
    agent.operation(CancelBoth, { tool: 'cancel_order', kind: 'cancel' });
    const s = new CallSimulator(agent);
    await s.call('cancel_order', said({ order_ids: ['#W1', '#W2'] }));
    FAIL_IDS.add('#W2');
    s.caller('yes');
    const out = await s.call('confirm_change', { change: 'cancel' });
    expect(out.response).toContain('What went through first: cancel (order_id #W1).');
    expect(ops(s)['history'].at(-1)['writes_made']).toEqual([
      { name: 'cancel', args: { order_id: '#W1' } },
    ]);
  });

  it('writes nothing for a yes to an earlier read-back', async () => {
    await sim.call('cancel_order', said({ order_ids: ['#W1'], reason: 'no longer needed' }));
    sim.globalData['semantic_state'] = { proposal: 'Cancel #W2. Shall I?', revision: 1 };
    sim.caller('yes');
    const out = await sim.call('confirm_change', { change: 'cancel' });
    expect(out.response).toContain('their yes was to an earlier read-back');
    expect(WRITES).toEqual([]);
    expect((sim.globalData['semantic_state'] as Record<string, unknown>)['proposal']).toBe(
      ops(sim)['waiting']['read_back'],
    );
  });
});
