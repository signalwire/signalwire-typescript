/**
 * Phases, state, the caller's screen, and changes with no read-back: a game.
 */

import { type CallContext, ServiceAgent } from '../../src/operations/agent.js';
import {
  Change,
  Field,
  Operation,
  Refuse,
  type Values,
  Write,
} from '../../src/operations/model.js';
import { CallSimulator, type SimulatedCall } from '../../src/testing/CallSimulator.js';
import type { Loose } from './helpers.js';

const DECK = [10, 7, 5, 9];
const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });
const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function game(): ServiceAgent {
  const agent = new ServiceAgent({
    name: 'dealer',
    role: 'You deal blackjack.',
    suppressLogs: true,
  });
  agent.writesWith(() => null);
  class Bet extends Operation {
    static override description = 'Place a bet and deal.';
    static override confirm = false;
    amount = new Field('integer', 'The bet, in chips.');
    override prepare(call: CallContext, f: Values): Change {
      const amount = Number(f['amount']);
      const chips = (call.state['chips'] as number | undefined) ?? 100;
      if (amount > chips) throw new Refuse("That's more chips than they have.");
      Object.assign(call.state, { bet: amount, hand: [DECK[0], DECK[1]], chips });
      call.show({ type: 'deal', hand: call.state['hand'] });
      call.go('playing');
      return new Change({
        readBack: '',
        writes: [new Write('bet', { amount })],
        done: `Bet ${amount}; dealt 10 and 7.`,
      });
    }
  }
  class Hit extends Operation {
    static override description = 'Take another card.';
    static override confirm = false;
    override prepare(call: CallContext): Change {
      const hand = (call.state['hand'] as number[] | undefined) ?? [];
      if (hand.length === 0) throw new Refuse('No hand is in play.');
      hand.push(DECK[hand.length]!);
      call.state['hand'] = hand;
      call.show({ type: 'card', card: hand.at(-1) });
      if (total(hand) > 21) {
        call.go('betting');
        return new Change({ readBack: '', done: `Drew ${hand.at(-1)}: bust at ${total(hand)}.` });
      }
      return new Change({ readBack: '', done: `Drew ${hand.at(-1)}: ${total(hand)}.` });
    }
  }
  agent.operation(Bet, { tool: 'place_bet' });
  agent.operation(Hit, { tool: 'hit' });
  agent.phase('betting', "Ask how much they'd like to bet, and call place_bet.", ['place_bet'], {
    initial: true,
  });
  agent.phase('playing', 'They can hit or stand. Call hit when they want a card.', ['hit']);
  return agent;
}

function events(out: SimulatedCall): unknown[] {
  return (out.actions as Record<string, unknown>[])
    .map((a) => a['SWML'])
    .filter((swml) => swml && JSON.stringify(swml).includes('user_event'));
}

describe('phases and the screen', () => {
  it('keeps state, shows the screen, and reads nothing back', async () => {
    const sim = new CallSimulator(game());
    expect(sim.step).toBe('betting');
    expect(sim.offered()).toEqual(['place_bet']);
    const bet = await sim.call('place_bet', said({ amount: 10 }));
    expect(bet.ran).toBe(true);
    expect(bet.response).toBe('Done. Bet 10; dealt 10 and 7.');
    expect(sim.step).toBe('playing');
    const ops: Loose = sim.globalData['ops'];
    expect(ops['state']['hand']).toEqual([10, 7]);
    expect(events(bet)).toHaveLength(1);
    expect(ops['history'].at(-1)['outcome']).toBe('made');
    const first = (bet.actions as Record<string, unknown>[]).map((a) => Object.keys(a)[0]);
    // The tool's state goes ahead of its step
    expect(first.indexOf('set_global_data')).toBeLessThan(first.indexOf('change_step'));
    const hit = await sim.call('hit', said({}));
    expect(hit.response).toBe('Done. Drew 5: bust at 22.');
    expect(sim.step).toBe('betting');
  });

  it('keeps the phase on a refusal', async () => {
    const sim = new CallSimulator(game());
    const out = await sim.call('place_bet', said({ amount: 500 }));
    expect(out.response).toBe("Nothing is changed: That's more chips than they have.");
    expect(sim.step).toBe('betting');
    expect('hand' in ((sim.globalData['ops'] as Loose)['state'] ?? {})).toBe(false);
  });

  it("fails on a phase's unknown tool", () => {
    const agent = new ServiceAgent({ name: 'x', role: 'r', suppressLogs: true });
    agent.phase('p', 'text', ['nope']);
    expect(() => agent.compile()).toThrow(/nope/);
  });

  it('has one step for an info-only bot', async () => {
    const agent = new ServiceAgent({
      name: 'info',
      role: 'You answer questions about the shop.',
      suppressLogs: true,
    });
    agent.lookup('Opening hours for a day.', { fields: { day: new Field('string', 'The day.') } })(
      function hours(call, { day }) {
        call.show({ type: 'hours', day });
        return `${String(day)}: 9 to 5.`;
      },
    );
    const sim = new CallSimulator(agent);
    expect(sim.step).toBe('main');
    expect(sim.offered()).toEqual(['hours']);
    const out = await sim.call('hours', { day: 'Monday' });
    expect(out.response).toBe('Monday: 9 to 5.');
    expect(events(out)).toHaveLength(1);
    expect(agent.preview()).not.toContain('confirm');
  });
});
