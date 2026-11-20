/**
 * Money in an operations agent: exact amounts, written as the reference's
 * `Decimal` writes them, and a formatter for each currency.
 */

import { amountOf, checkCurrency, formatMoney } from '../../src/operations/money.js';

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
});

describe('checkCurrency', () => {
  it('passes a code through and null as null', () => {
    expect(checkCurrency('EUR')).toBe('EUR');
    expect(checkCurrency(null)).toBeNull();
    expect(() => checkCurrency('euros')).toThrow(/ISO 4217/);
  });
});
