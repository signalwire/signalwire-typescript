/**
 * The words an operations agent generates come from DEFAULT_WORDING, and any
 * of them can be replaced: checked when the service is made, filled in when used.
 */

import { AgentBase } from '../../src/AgentBase.js';
import { type CallContext, Operations } from '../../src/operations/agent.js';
import {
  Change,
  Field,
  Operation,
  Refuse,
  type Values,
  Write,
} from '../../src/operations/model.js';
import {
  DEFAULT_WORDING,
  _Wording as Wording,
  placeholders,
} from '../../src/operations/wording.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';
import type { Loose } from './helpers.js';

describe('DEFAULT_WORDING', () => {
  it('fills in every default with only its own placeholders', () => {
    for (const [key, text] of Object.entries(DEFAULT_WORDING)) {
      expect(key).toBe(key.toLowerCase());
      expect(typeof text).toBe('string');
      for (const p of placeholders(text)) expect(p).toMatch(/^[a-z_]+$/);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_WORDING)).toBe(true);
  });
});

describe('placeholders', () => {
  it('finds each placeholder once and skips platform variables', () => {
    expect(placeholders('{a} ${global_data.x} {b} {a} ${c}')).toEqual(['a', 'b']);
  });
});

describe('Wording', () => {
  it('fails on an unknown key', () => {
    expect(() => new Wording(DEFAULT_WORDING, { 'step.mian': 'x' }, 'Operations')).toThrow(
      "Operations has no wording 'step.mian'; the keys are those of DEFAULT_WORDING",
    );
  });

  it("fails on a placeholder its default doesn't have", () => {
    expect(
      () => new Wording(DEFAULT_WORDING, { 'step.main': '{order} {help}' }, 'Operations'),
    ).toThrow(/\{order\}.*can use \{account\}, \{help\}/);
  });

  it('sorts placeholders as the reference does', () => {
    expect(() => new Wording({ k: '{a} {a_b}' }, { k: '{zz} {z}' }, 'X')).toThrow(
      "wording 'k' has {zz}, {z}, which it can't fill (it can use {a_b}, {a})",
    );
    expect(() => new Wording({ k: 'plain' }, { k: '{x}' }, 'X')).toThrow('(it can use none)');
  });

  it('fails on an override that is not a string', () => {
    expect(
      () =>
        new Wording(DEFAULT_WORDING, { 'step.main': 3 } as unknown as Record<string, string>, 'X'),
    ).toThrow(TypeError);
  });

  it('can drop placeholders and keeps platform variables', () => {
    const w = new Wording(
      DEFAULT_WORDING,
      { 'step.main': 'Help. Today: ${global_data.today}' },
      'X',
    );
    expect(w.say('step.main', {})).toBe('Help. Today: ${global_data.today}');
  });

  it('fills in placeholders, and fails on one with no value', () => {
    const w = new Wording({ k: 'Hi {name}, ${x}' }, null, 'X');
    expect(w.say('k', { name: 'Sam' })).toBe('Hi Sam, ${x}');
    expect(w.template('k')).toBe('Hi {name}, ${x}');
    expect(() => w.say('k')).toThrow(/needs \{name\}/);
  });

  it('joins items in running text', () => {
    const w = new Wording(DEFAULT_WORDING, { 'list.and': ' y ' }, 'X');
    expect(w.joined([])).toBe('');
    expect(w.joined(['a', ''])).toBe('a');
    expect(w.joined(['a', 'b', 'c'])).toBe(`a${DEFAULT_WORDING['list.comma']}b y c`);
  });
});

const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });

function shop(wording?: Record<string, string>): Operations {
  const ops = new Operations({ role: 'You run a shop.', wording });
  ops.writesWith(() => null);
  ops.transferWith(() => null);
  class Cancel extends Operation {
    static override description = 'Cancel an order.';
    order_id = new Field('string', 'The order.');
    override prepare(_call: CallContext, f: Values): Change {
      const id = String(f['order_id']);
      if (id === '#shipped') throw new Refuse('Nothing can change once it ships.');
      return new Change({
        readBack: `Cancel ${id}. Shall I?`,
        touches: [id],
        writes: [new Write('cancel', { order_id: id })],
      });
    }
  }
  ops.operation(Cancel, { tool: 'cancel_order' });
  return ops;
}

const agentOf = () => new AgentBase({ name: 't', suppressLogs: true });

describe('wording in a service', () => {
  it('reaches the steps, tools, results and notice', async () => {
    const ops = shop({
      'step.main': 'Atiende lo que pidan. {help}',
      'tool.confirm': 'Haz el cambio leído, cuando digan que sí.',
      'decline.then': 'Diles que queda como estaba.',
      'transfer.notice': 'Un momento, le paso con una persona.',
      'list.and': ' y ',
    });
    const agent = ops.install(agentOf());
    const steps = Object.fromEntries(
      (agent.defineContexts().toDict() as Loose)['default']['steps'].map((s: Loose) => [s.name, s]),
    );
    expect(steps['main']['text'].startsWith('Atiende lo que pidan. To make a change')).toBe(true);
    const sim = new CallSimulator(agent);
    expect((sim.functions['confirm_change'] as Loose)['description']).toBe(
      'Haz el cambio leído, cuando digan que sí.',
    );
    await sim.call('cancel_order', said({ order_id: '#1' }));
    const declined = await sim.call('decline_change', { change: 'cancel' });
    expect((declined.toolPrompt ?? '').startsWith('Diles que queda como estaba.')).toBe(true);
    sim.caller('I want a person');
    const moved = await sim.call('transfer_to_human', { summary: 'wants a person' });
    expect(JSON.stringify(moved.actions)).toContain('Un momento, le paso con una persona.');
  });

  it('can drop placeholders and keep platform variables', () => {
    const agent = shop({ 'step.main': 'Help them. Today: ${global_data.today}' }).install(
      agentOf(),
    );
    const main = (agent.defineContexts().toDict() as Loose)['default']['steps'][0];
    expect(main['text']).toBe('Help them. Today: ${global_data.today}');
  });

  it('fails on an unknown key or placeholder when the service is made', () => {
    expect(() => shop({ 'step.mian': 'x' })).toThrow("no wording 'step.mian'");
    expect(() => new Operations({ role: 'r', wording: { 'step.main': '{order} {help}' } })).toThrow(
      /\{order\}.*can use \{account\}, \{help\}/,
    );
    expect(
      () =>
        new Operations({
          role: 'r',
          wording: { 'step.main': 3 } as unknown as Record<string, string>,
        }),
    ).toThrow(TypeError);
  });

  it("prefixes a refusal of the developer's own", async () => {
    const sim = new CallSimulator(shop({ 'refused.prefix': 'Sin cambios: ' }).install(agentOf()));
    const out = await sim.call('cancel_order', said({ order_id: '#shipped' }));
    expect(out.response).toBe('Sin cambios: Nothing can change once it ships.');
  });

  it('takes a plain filler list for every language', () => {
    const ops = shop();
    ops.lookup('Hours.', { fields: {}, fillers: ['One moment.'] })(function hours() {
      return '9 to 5.';
    });
    const sim = new CallSimulator(ops.install(agentOf()));
    expect((sim.functions['hours'] as Loose)['fillers']).toEqual({ default: ['One moment.'] });
  });
});
