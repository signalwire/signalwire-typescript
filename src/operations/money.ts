/**
 * Money as an operations agent states it: amounts kept exactly (as decimal
 * strings), in the currency each change gives, or the service's.
 * {@link formatMoney} writes an amount the way the model reads it, for the
 * currencies in {@link CURRENCIES} and any other ISO 4217 code;
 * `Operations({ moneyFormat })` replaces it.
 */

import { _Dec as Dec } from './decimal.js';

/**
 * The currencies {@link formatMoney} writes with a symbol or code before the
 * amount and their own number of decimal places: code to `[what goes before
 * the amount, digits after the point]`. A symbol several currencies share is
 * written so it isn't ambiguous (`CA$`, `A$`).
 */
export const CURRENCIES: Readonly<Record<string, readonly [string, number]>> = Object.freeze({
  USD: ['$', 2],
  EUR: ['€', 2],
  GBP: ['£', 2],
  JPY: ['¥', 0],
  CNY: ['CN¥', 2],
  CAD: ['CA$', 2],
  AUD: ['A$', 2],
  NZD: ['NZ$', 2],
  MXN: ['MX$', 2],
  BRL: ['R$', 2],
  HKD: ['HK$', 2],
  INR: ['₹', 2],
  KRW: ['₩', 0],
  ILS: ['₪', 2],
  PHP: ['₱', 2],
  VND: ['₫', 0],
  CHF: ['CHF ', 2],
  SEK: ['SEK ', 2],
  NOK: ['NOK ', 2],
  DKK: ['DKK ', 2],
  PLN: ['PLN ', 2],
  CZK: ['CZK ', 2],
  HUF: ['HUF ', 2],
  SGD: ['SGD ', 2],
  ZAR: ['ZAR ', 2],
  AED: ['AED ', 2],
  SAR: ['SAR ', 2],
  TRY: ['TRY ', 2],
  THB: ['THB ', 2],
  CLP: ['CLP ', 0],
  COP: ['COP ', 2],
  ISK: ['ISK ', 0],
  KWD: ['KWD ', 3],
  BHD: ['BHD ', 3],
  JOD: ['JOD ', 3],
  OMR: ['OMR ', 3],
} as const);

/** An amount of money as the module takes one. */
export type Amount = number | bigint | string;

/** @internal An amount as an exact decimal. */
export function _decimalOf(value: unknown): Dec {
  if (typeof value === 'boolean') throw new TypeError("an amount of money can't be a bool");
  let text: string;
  if (value instanceof Dec) return value;
  if (typeof value === 'bigint') text = value.toString();
  else if (typeof value === 'number') {
    // By its shortest decimal form, so 54.04 stays 54.04
    if (!Number.isFinite(value)) throw new Error(`${String(value)} isn't an amount of money`);
    text = String(value);
  } else if (typeof value === 'string') text = value;
  else {
    const kind = value === null ? 'None' : typeof value;
    throw new TypeError(`an amount of money is a number or a string, not ${kind}`);
  }
  const amount = Dec.parse(text);
  if (amount === null) throw new Error(`${JSON.stringify(value)} isn't an amount of money`);
  return amount;
}

/**
 * An amount as an exact decimal string: from a number (by its shortest decimal
 * form, so `54.04` stays `"54.04"`), a bigint or a numeric string. Written as
 * the reference's `Decimal` writes it.
 * @param value - The amount.
 * @returns The amount as a decimal string.
 * @throws {TypeError} For a boolean or a value that isn't a number or a string.
 * @throws {Error} For a value that isn't an amount, or isn't finite.
 */
export function amountOf(value: unknown): string {
  return _decimalOf(value).toString();
}

/**
 * A currency code as given, once it's checked to be three capital letters (ISO 4217).
 * @param code - The code, or null.
 * @returns The code.
 * @throws {Error} For anything but three capital letters.
 */
export function checkCurrency(code: string | null | undefined): string | null {
  if (code === undefined || code === null) return null;
  if (typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) {
    throw new Error(
      `currency ${JSON.stringify(code)} must be an ISO 4217 code, three capital letters such as 'EUR'`,
    );
  }
  return code;
}

/**
 * An amount as the model reads it: `$54.04`, `€54.04`, `¥5,404`, `CHF 54.04`.
 * A currency not in {@link CURRENCIES} goes after the amount (`54.04 XOF`).
 * With no currency the amount stands alone, with its cents when it has any
 * (`54.04`, `54`).
 * @param amount - The amount: a number, a bigint or a numeric string.
 * @param currency - Its ISO 4217 code, or null.
 * @returns The amount in words.
 */
export function formatMoney(amount: unknown, currency?: string | null): string {
  let value = _decimalOf(amount);
  const sign = value.sign() < 0 ? '-' : '';
  value = value.abs();
  const code = checkCurrency(currency);
  const known = code !== null ? CURRENCIES[code] : undefined;
  if (known) return `${sign}${known[0]}${value.toGrouped(known[1])}`;
  const plain = value.toGrouped(value.isInteger() ? 0 : Math.max(2, value.places()));
  return code ? `${sign}${plain} ${code}` : `${sign}${plain}`;
}
