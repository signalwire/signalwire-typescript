/**
 * Money in an operations agent: exact amounts, written as the reference's
 * `Decimal` writes them, and a formatter for each currency.
 */

import { AgentBase } from '../../src/AgentBase.js';
import { CallContext, Operations } from '../../src/operations/agent.js';
import { Change, Field, Operation, type Values, Write } from '../../src/operations/model.js';
import { Dec } from '../../src/operations/decimal.js';
import { amountOf, checkCurrency, formatMoney } from '../../src/operations/money.js';
import type { MoneyFormat } from '../../src/operations/record.js';
import { CallSimulator } from '../../src/testing/CallSimulator.js';
import type { Loose } from './helpers.js';

describe('formatMoney', () => {
  it.each([
    [54.04, 'USD', '$54.04'],
    ['1234.5', 'EUR', '€1,234.50'],
    [5404.4, 'JPY', '¥5,404'],
    ['1.2345', 'KWD', 'KWD 1.235'],
    [54.04, 'CHF', 'CHF 54.04'],
    [12, 'CAD', 'CA$12.00'],
    [54.04, 'XOF', '54.04 XOF'],
    [54, 'XOF', '54 XOF'],
    [54.04, null, '54.04'],
    [54.5, null, '54.50'],
    [54, null, '54'],
    [-5, 'USD', '-$5.00'],
    [0.125, 'USD', '$0.13'],
    [0.1 + 0.2, 'USD', '$0.30'],
    [12345678n, 'USD', '$12,345,678.00'],
  ] as const)('%s %s is %s', (amount, currency, text) => {
    expect(formatMoney(amount, currency)).toBe(text);
  });

  it('takes an ISO code and a number', () => {
    for (const bad of ['usd', 'US', 'DOLLARS', '']) {
      expect(() => formatMoney(1, bad)).toThrow(/ISO 4217/);
      expect(() => new Operations({ role: 'r', currency: bad })).toThrow(/ISO 4217/);
    }
    expect(() => formatMoney('ten', 'USD')).toThrow(Error);
    expect(() => formatMoney(true, 'USD')).toThrow(TypeError);
    expect(() => formatMoney(Number.NaN, 'USD')).toThrow(Error);
    expect(() => formatMoney(null, 'USD')).toThrow(TypeError);
  });
});

describe('amountOf', () => {
  it('writes amounts as Decimal writes them', () => {
    expect(amountOf(54.04)).toBe('54.04');
    expect(amountOf('2.50')).toBe('2.50');
    expect(amountOf('-0')).toBe('-0');
    expect(amountOf('1e3')).toBe('1E+3');
    expect(amountOf('0.0000001')).toBe('1E-7');
    expect(amountOf('1_000')).toBe('1000');
    expect(amountOf(7n)).toBe('7');
  });

  it("rounds results to Decimal's 28-digit context", () => {
    expect(formatMoney('1.00499999999999999999999999999', 'USD')).toBe('$1.01');
    expect(Dec.ZERO.plus(Dec.parse('0.12345678901234567890123456789')!).toString()).toBe(
      '0.1234567890123456789012345679',
    );
    expect(Dec.parse('9'.repeat(29))!.abs().toString()).toBe('1.000000000000000000000000000E+29');
    expect(Dec.parse('-2.5')!.negated().toString()).toBe('2.5');
    expect(() => formatMoney(`1${'0'.repeat(27)}`, 'USD')).toThrow(/more digits/);
  });

  it('reads Unicode decimal digits, as Decimal does', () => {
    expect(amountOf('١٢.٣٤')).toBe('12.34');
    expect(formatMoney('１２.３４', 'USD')).toBe('$12.34');
    expect(amountOf('𝟏𝟐.𝟓')).toBe('12.5');
    expect(amountOf('\u00a012\u2003')).toBe('12');
  });

  it('negates a zero to a plain zero, as Decimal does', () => {
    expect(Dec.parse('-0')!.negated().toString()).toBe('0');
    expect(Dec.parse('0.00')!.negated().toString()).toBe('0.00');
    expect(Dec.ZERO.plus(Dec.parse('-0')!).toString()).toBe('0');
    expect(Dec.parse('-0')!.plus(Dec.parse('-0')!).toString()).toBe('-0');
  });
});

describe('checkCurrency', () => {
  it('passes a code through and null as null', () => {
    expect(checkCurrency('EUR')).toBe('EUR');
    expect(checkCurrency(null)).toBeNull();
    expect(() => checkCurrency('euros')).toThrow(/ISO 4217/);
  });
});

const said = (args: Record<string, unknown>) => ({ ...args, data_supplied_by_user: true });

function tillOps(extra: { currency?: string; moneyFormat?: MoneyFormat } = {}): Operations {
  const ops = new Operations({ role: 'You run a till.', ...extra });
  ops.writesWith(() => null);
  class Move extends Operation {
    static override description = 'Refund or charge an amount.';
    amount = new Field('string', 'The amount, less than 0 to refund.');
    currency = new Field('string', "Its currency code, if not the till's.", { required: false });
    what = new Field('string', "What it's for.");
    override prepare(_call: CallContext, f: Values): Change {
      return new Change({
        readBack: `Move ${String(f['amount'])} for ${String(f['what'])}. Shall I?`,
        touches: [String(f['what'])],
        writes: [new Write('move', { amount: f['amount'] })],
        money: [f['amount'] as string],
        currency: f['currency'] as string | null,
      });
    }
  }
  ops.operation(Move, { tool: 'move_money' });
  return ops;
}

const till = (extra: { currency?: string; moneyFormat?: MoneyFormat } = {}) =>
  tillOps(extra).install(new AgentBase({ name: 't', suppressLogs: true }));

async function settleMove(
  sim: CallSimulator,
  amount: string,
  what: string,
  currency: string | null = null,
) {
  await sim.call('move_money', said({ amount, what, currency }));
  sim.caller('yes');
  return sim.call('confirm_change', { change: 'move' });
}

describe('money in a call', () => {
  it('keeps totals for each currency apart', async () => {
    const sim = new CallSimulator(till({ currency: 'USD' }));
    await settleMove(sim, '-10', 'a');
    await settleMove(sim, '5', 'b', 'EUR');
    const out = await settleMove(sim, '-2.50', 'c');
    expect(
      out.response.endsWith(
        'In all, the changes made in this call come to $12.50 back to them and €5.00 charged.',
      ),
    ).toBe(true);
    const ops: Loose = sim.globalData['ops'];
    expect(ops['history'].map((h: Loose) => [h.money, h.currency])).toEqual([
      ['-10', 'USD'],
      ['5', 'EUR'],
      ['-2.50', 'USD'],
    ]);
    expect(ops['v']).toBe(1);
  });

  it('states amounts alone without a currency', async () => {
    const sim = new CallSimulator(till());
    await settleMove(sim, '-10', 'a');
    const out = await settleMove(sim, '-2.5', 'b');
    expect(out.response.endsWith('come to 12.50 back to them.')).toBe(true);
    expect((sim.globalData['ops'] as Loose)['history'][0]['currency']).toBe('');
  });

  it('writes the totals with moneyFormat', async () => {
    const sim = new CallSimulator(
      till({ currency: 'EUR', moneyFormat: (amount, code) => `${amount} ${String(code)} netos` }),
    );
    await settleMove(sim, '-10', 'a');
    const out = await settleMove(sim, '-2.5', 'b');
    expect(out.response).toContain('12.5 EUR netos back to them');
  });

  it("fails a change whose money it can't state when it's built", async () => {
    const ops = tillOps();
    const move = ops._operations.get('move')!;
    const call = new CallContext(ops, {});
    await expect(ops._prepare(call, move, { amount: 'ten', what: 'a' })).rejects.toThrow(
      /Move\.prepare returned a Change whose money/,
    );
    await expect(
      ops._prepare(call, move, { amount: '1', what: 'b', currency: 'euros' }),
    ).rejects.toThrow(/ISO 4217/);
  });
});
