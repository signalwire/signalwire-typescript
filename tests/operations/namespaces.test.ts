/**
 * Namespaces: a second Operations (or the agent's own tools and steps) beside
 * the first, and install adding to the agent's own setup.
 */

import { AgentBase } from '../../src/AgentBase.js';
import { type CallContext, Operations, ServiceAgent } from '../../src/operations/agent.js';
import { Change, Field, Operation, type Values, Write } from '../../src/operations/model.js';
import { RECORD_VERSION } from '../../src/operations/record.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';
import type { Loose } from './helpers.js';

const WRITES: [string, Record<string, unknown>][] = [];
const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });
const privateOf = (agent: AgentBase): Loose => agent as Loose;
const toolNames = (agent: AgentBase) => new Set(agent.getRegisteredTools().map((t) => t.name));

function service(
  namespace: string | null,
  kind: string,
  extra: Partial<ConstructorParameters<typeof Operations>[0]> = {},
): Operations {
  const ops = new Operations({ role: `You handle ${kind}.`, namespace, ...extra });
  ops.writesWith((_call, w) => {
    WRITES.push([w.name, { ...w.args }]);
  });
  class ChangeIt extends Operation {
    static override description = 'Change something.';
    what = new Field('string', 'What to change.');
    override prepare(_call: CallContext, f: Values): Change {
      return new Change({
        readBack: `Change the ${kind} ${String(f['what'])}. Shall I?`,
        touches: [`${kind}:${String(f['what'])}`],
        writes: [new Write(`${kind}_write`, { what: f['what'] })],
      });
    }
  }
  ops.operation(ChangeIt, { tool: `change_${kind}`, kind });
  return ops;
}

describe('namespaces', () => {
  it('names everything it generates', () => {
    const ops = service('billing', 'plan');
    ops.identify({ anyOf: [['email']], find: () => 'a1' });
    ops.transferWith(() => null);
    class Note extends Operation {
      static override description = 'Add a note.';
      static override guidance = 'Ask what the note says.';
      override prepare(): Change {
        return new Change({ readBack: 'Add it?', writes: [] });
      }
    }
    ops.operation(Note);
    const agent = ops.install(new AgentBase({ name: 't', suppressLogs: true }));
    const tools = toolNames(agent);
    for (const t of [
      'confirm_billing_change',
      'decline_billing_change',
      'billing_transfer_to_human',
      'billing_find_account',
      'change_plan',
    ]) {
      expect(tools.has(t)).toBe(true);
    }
    for (const t of ['confirm_change', 'decline_change', 'transfer_to_human', 'find_account']) {
      expect(tools.has(t)).toBe(false);
    }
    const contexts = agent.defineContexts().toDict() as Loose;
    const steps = new Set(contexts['default']['steps'].map((s: Loose) => s.name));
    expect(steps).toEqual(
      new Set(['billing_identify', 'billing_main', 'billing_confirm', 'billing_note']),
    );
    expect('billing_transferred' in contexts).toBe(true);
    const record = privateOf(agent).globalData['billing'];
    expect(record['v']).toBe(RECORD_VERSION);
    expect(RECORD_VERSION).toBe(1);
    expect('ops' in privateOf(agent).globalData).toBe(false);
    expect(privateOf(agent).params['conscience']).toContain('${global_data.billing.now}');
    const main = contexts['default']['steps'].find((s: Loose) => s.name === 'billing_main');
    expect(main['text']).toContain('${global_data.billing.account}');
  });

  it('leaves the names plain without one', () => {
    const agent = service(null, 'plan').install(new AgentBase({ name: 't', suppressLogs: true }));
    expect(toolNames(agent).has('confirm_change')).toBe(true);
    expect(toolNames(agent).has('decline_change')).toBe(true);
    expect(privateOf(agent).globalData['ops']['v']).toBe(RECORD_VERSION);
  });

  it('must be lower case words', () => {
    for (const bad of ['Billing', '1st', 'bill-ing', '']) {
      expect(() => new Operations({ role: 'r', namespace: bad })).toThrow(/namespace/);
    }
  });

  it('says how to fix a second service without one', () => {
    const agent = service(null, 'plan').install(new AgentBase({ name: 't', suppressLogs: true }));
    expect(() => service(null, 'order').install(agent)).toThrow(/namespace/);
  });

  it('keeps two services on one agent apart', async () => {
    WRITES.length = 0;
    const agent = new AgentBase({ name: 't', suppressLogs: true });
    const billing = service('billing', 'plan');
    const orders = service('orders', 'order');
    // Each offers the other's tools in its own steps (named as generated: "main", "confirm")
    billing.offer(['change_order', 'confirm_orders_change', 'decline_orders_change'], {
      steps: ['main', 'confirm'],
    });
    orders.offer(['change_plan', 'confirm_billing_change', 'decline_billing_change'], {
      steps: ['main', 'confirm'],
    });
    billing.install(agent);
    orders.install(agent);
    const sim = new CallSimulator(agent);
    expect(sim.step).toBe('billing_main'); // the first service's main step starts the call
    await sim.call('change_plan', said({ what: 'gold' }));
    expect(sim.step).toBe('billing_confirm');
    await sim.call('change_order', said({ what: '#1' }));
    expect((sim.globalData['billing'] as Loose)['waiting']['kind']).toBe('plan');
    expect((sim.globalData['orders'] as Loose)['waiting']['kind']).toBe('order');
    expect(sim.step).toBe('orders_confirm');
    // The yes the platform's gate heard is to the orders read-back: billing's is read again, nothing written
    sim.caller('yes');
    const again = await sim.call('confirm_billing_change', { change: 'plan' });
    expect(again.response).toContain('read to them again');
    expect(WRITES).toEqual([]);
    sim.caller('yes');
    const done = await sim.call('confirm_billing_change', { change: 'plan' });
    expect(done.ran).toBe(true);
    expect(WRITES).toEqual([['plan_write', { what: 'gold' }]]);
  });

  it("adds to the agent's own sections and keeps its initial step", () => {
    const agent = new AgentBase({ name: 't', suppressLogs: true });
    agent.promptAddSection('Role', { body: 'You work for Acme.' });
    agent.promptAddSection('Rules', { bullets: ['Be kind.', 'Never guess.'] });
    const ctx = agent.defineContexts().addContext('default');
    ctx.addStep('welcome').setText('Greet them.');
    ctx.setInitialStep('welcome');
    service(null, 'plan', { rules: ['Never guess.', 'Read changes back.'] }).install(agent);
    const sections = agent.pom!.toDict();
    expect(sections.map((s) => s.title)).toEqual(['Role', 'Rules']);
    expect(sections[0]!.body).toBe('You work for Acme.\n\nYou handle plan.');
    expect(sections[1]!.bullets).toEqual(['Be kind.', 'Never guess.', 'Read changes back.']);
    expect(new CallSimulator(agent).step).toBe('welcome');
  });

  it('moves call.go("main") to the namespaced main step', async () => {
    const ops = service('billing', 'plan');
    ops.phase('intro', 'Say hello.', null, { initial: true });
    ops.lookup('Their plan.', { tool: 'plan_info' })(function planInfo(call) {
      call.go('main');
      return 'Gold.';
    });
    const sim = new CallSimulator(ops.install(new AgentBase({ name: 't', suppressLogs: true })));
    expect(sim.step).toBe('intro');
    await sim.call('plan_info', {});
    expect(sim.step).toBe('billing_main');
  });

  it('reads the record from global data for recordText', () => {
    const ops = service('billing', 'plan');
    expect(ops.recordText({ billing: { asked: 'a new plan' } })).toBe(
      'What they asked for: a new plan',
    );
    expect(ops.recordText({})).toBe('');
  });

  it('passes Operations options on from ServiceAgent', () => {
    const agent = new ServiceAgent({
      name: 'shop',
      role: 'You run a shop.',
      namespace: 'shop',
      rules: ['One rule.'],
      suppressLogs: true,
    });
    expect(agent.ops._names.record).toBe('shop');
    expect((agent.ops as Loose).rules).toEqual(['One rule.']);
  });
});
