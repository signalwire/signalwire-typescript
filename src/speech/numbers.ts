/**
 * Numbers as an English text-to-speech voice should say them.
 *
 * The platform normalizes text before its pronunciation rules run, so a bare
 * number is already words by then: `addPronunciation` can't make "10001" read
 * digit by digit. Give the model, or a `say` action, the words instead.
 */

const DIGITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
] as const;
const TEENS = [
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
] as const;
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

// Currency: [major singular, major plural, minor singular, minor plural, minor
// units per major]; null minor for a currency without one
const CURRENCIES: Record<string, [string, string, string | null, string | null, number]> = {
  USD: ['dollar', 'dollars', 'cent', 'cents', 100],
  CAD: ['dollar', 'dollars', 'cent', 'cents', 100],
  AUD: ['dollar', 'dollars', 'cent', 'cents', 100],
  NZD: ['dollar', 'dollars', 'cent', 'cents', 100],
  EUR: ['euro', 'euros', 'cent', 'cents', 100],
  GBP: ['pound', 'pounds', 'penny', 'pence', 100],
  MXN: ['peso', 'pesos', 'centavo', 'centavos', 100],
  INR: ['rupee', 'rupees', 'paisa', 'paise', 100],
  JPY: ['yen', 'yen', null, null, 1],
};

/**
 * `n` in English words: `numberWords(1405)` is "one thousand four hundred five".
 * @param n - A whole number, as a safe integer or a bigint.
 * @returns The words.
 * @throws Error for a number that isn't whole, or of a quadrillion or more.
 */
export function numberWords(n: number | bigint): string {
  let value: bigint;
  if (typeof n === 'bigint') {
    value = n;
  } else if (typeof n === 'number' && Number.isSafeInteger(n)) {
    value = BigInt(n);
  } else {
    throw new Error(`numberWords takes a whole number, got ${String(n)}`);
  }
  if (value < 0n) return `minus ${numberWords(-value)}`;
  if (value === 0n) return 'zero';
  if (value >= 1000n ** BigInt(SCALES.length)) throw new Error(`${value} is too large to say`);
  const parts: string[] = [];
  for (let scale = SCALES.length - 1; scale >= 0; scale--) {
    const chunk = Number((value / 1000n ** BigInt(scale)) % 1000n);
    if (chunk) {
      parts.push(belowThousand(chunk));
      if (SCALES[scale]) parts.push(SCALES[scale]!);
    }
  }
  return parts.join(' ');
}

function belowThousand(n: number): string {
  const words: string[] = [];
  if (n >= 100) {
    words.push(DIGITS[Math.floor(n / 100)]!, 'hundred');
    n %= 100;
  }
  if (n >= 20) {
    words.push(TENS[Math.floor(n / 10)]! + (n % 10 ? `-${DIGITS[n % 10]}` : ''));
  } else if (n >= 10) {
    words.push(TEENS[n - 10]!);
  } else if (n) {
    words.push(DIGITS[n]!);
  }
  return words.join(' ');
}

/** Options for {@link sayDigits} and {@link sayLastDigits}. */
export interface SayDigitsOptions {
  /** The word for 0, such as "oh". Default "zero". */
  zero?: string;
}

/**
 * The digits in `text`, one word each, as a voice should read a ZIP code, an
 * account number or a phone number.
 *
 * `sayDigits('415-555-0192')` is "four one five, five five five, zero one nine
 * two": with `group` left out, the groups are the ones the text has, separated
 * by anything that isn't a digit. `group` 3 splits the digits into threes;
 * `[3, 3, 4]` into those sizes, the rest in a last group. A comma between
 * groups makes the voice pause.
 *
 * @param text - The digits, with any separators.
 * @param group - The group size, or the sizes in order.
 * @param opts - `zero`, the word for 0.
 * @returns The words, or "" when `text` has no digits.
 * @throws Error for a group size that isn't a positive whole number.
 */
export function sayDigits(
  text: string | number | bigint,
  group?: number | readonly number[],
  opts: SayDigitsOptions = {},
): string {
  const str = String(text);
  let groups: string[];
  if (group === undefined) {
    groups = str.match(/\d+/g) ?? [];
  } else {
    const digits = str.replace(/\D/g, '');
    const sizes = typeof group === 'number' ? [group] : [...group];
    if (sizes.length === 0 || sizes.some((s) => !Number.isInteger(s) || s < 1)) {
      throw new Error(`group sizes must be positive, got ${JSON.stringify(group)}`);
    }
    groups = [];
    let position = 0;
    while (position < digits.length) {
      const index = groups.length;
      let size: number;
      if (typeof group === 'number') size = group;
      else if (index < sizes.length) size = sizes[index]!;
      else size = digits.length - position; // the rest, in a last group
      groups.push(digits.slice(position, position + size));
      position += size;
    }
  }
  const names = [opts.zero ?? 'zero', ...DIGITS.slice(1)];
  return groups
    .filter((g) => g)
    .map((g) => [...g].map((d) => names[Number(d)]).join(' '))
    .join(', ');
}

/**
 * The last `n` digits of `text`, one word each: for "a card ending in ..." or
 * "the account ending in ...".
 *
 * `sayLastDigits('4111 1111 1111 1234')` is "one two three four".
 *
 * @param text - The number, with any separators.
 * @param n - How many of its last digits. Default 4.
 * @param opts - `zero`, the word for 0.
 * @returns The words, or "" when `text` has no digits.
 * @throws Error for an `n` that isn't a positive whole number.
 */
export function sayLastDigits(
  text: string | number | bigint,
  n = 4,
  opts: SayDigitsOptions = {},
): string {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
    throw new Error(`n must be a positive whole number, got ${String(n)}`);
  }
  const digits = String(text).replace(/\D/g, '');
  return sayDigits(digits.slice(-n), n, opts);
}

/**
 * An amount of money in words: `sayMoney(14.5)` is "fourteen dollars and fifty
 * cents".
 *
 * The amount is rounded to the currency's smallest unit, half up, from its
 * decimal text, so `sayMoney(0.125)` is "thirteen cents" and `sayMoney('2.675')`
 * "two dollars and sixty-eight cents". The currencies are USD, CAD, AUD, NZD,
 * EUR, GBP, MXN, INR and JPY.
 *
 * @param amount - The amount, in the currency's major unit (dollars, not
 *   cents): a number, a bigint, or a decimal string such as "14.50".
 * @param currency - The ISO 4217 code. Default "USD".
 * @returns The words, such as "one dollar", "five cents" or "minus two pounds
 *   and one penny".
 * @throws Error for an amount that isn't a finite number, or another currency.
 */
export function sayMoney(amount: number | bigint | string, currency = 'USD'): string {
  const names = CURRENCIES[currency.toUpperCase()];
  if (names === undefined) {
    throw new Error(
      `sayMoney doesn't know ${JSON.stringify(currency)}; it takes ${JSON.stringify(Object.keys(CURRENCIES).sort())}`,
    );
  }
  const [majorOne, majorMany, minorOne, minorMany, perMajor] = names;
  const parsed = parseDecimal(amount);
  if (parsed === null) throw new Error(`amount must be a number, got ${String(amount)}`);
  // Past a quadrillion it can't be said; checked before the math, so an
  // exponent such as 1e999999999 is refused rather than computed
  if (parsed.digits && String(parsed.digits).length + parsed.exponent > 16) {
    throw new Error(`${String(amount)} is too large to say`);
  }
  const minorTotal = roundHalfUp(parsed.digits * BigInt(perMajor), parsed.exponent);
  const major = minorTotal / BigInt(perMajor);
  const minor = minorTotal % BigInt(perMajor);
  const parts: string[] = [];
  if (major || !minor || minorOne === null) {
    parts.push(`${numberWords(major)} ${major === 1n ? majorOne : majorMany}`);
  }
  if (minor && minorOne !== null && minorMany !== null) {
    parts.push(`${numberWords(minor)} ${minor === 1n ? minorOne : minorMany}`);
  }
  const words = parts.join(' and ');
  return parsed.negative && minorTotal ? `minus ${words}` : words;
}

/** `|amount|` as `digits * 10 ** exponent`, with its sign; null when it isn't a finite number. */
function parseDecimal(
  amount: unknown,
): { negative: boolean; digits: bigint; exponent: number } | null {
  if (typeof amount === 'bigint') {
    return { negative: amount < 0n, digits: amount < 0n ? -amount : amount, exponent: 0 };
  }
  if (typeof amount === 'number' && !Number.isFinite(amount)) return null;
  if (typeof amount !== 'number' && typeof amount !== 'string') return null;
  // A number's shortest text, as Python's str() gives a float's; underscores
  // between digits are allowed, as Python's Decimal allows them
  const text = String(amount)
    .trim()
    .replace(/(?<=\d)_(?=\d)/g, '');
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) return null;
  const whole = m[2] ?? '';
  const fraction = m[3] ?? '';
  return {
    negative: m[1] === '-',
    digits: BigInt(whole + fraction || '0'),
    exponent: Number(m[4] ?? 0) - fraction.length,
  };
}

/** `digits * 10 ** exponent` rounded to a whole number, half up. */
function roundHalfUp(digits: bigint, exponent: number): bigint {
  if (exponent >= 0) return digits * 10n ** BigInt(exponent);
  // Below a tenth of a unit it rounds to 0, however small
  if (-exponent > String(digits).length + 1) return 0n;
  const divisor = 10n ** BigInt(-exponent);
  const quotient = digits / divisor;
  return 2n * (digits % divisor) >= divisor ? quotient + 1n : quotient;
}
