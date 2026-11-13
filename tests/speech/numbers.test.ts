/**
 * Numbers as a voice should say them, from signalwire-python 3.8.0.
 *
 * The platform normalizes text before its pronunciation rules run, so a bare
 * number reaches the rules as words already: a ZIP code given as digits is
 * read "ten thousand one". These functions give the words instead.
 */
import { numberWords, sayDigits, sayLastDigits, sayMoney } from '../../src/index.js';

describe('numberWords', () => {
  it.each([
    [0, 'zero'],
    [7, 'seven'],
    [13, 'thirteen'],
    [40, 'forty'],
    [42, 'forty-two'],
    [100, 'one hundred'],
    [105, 'one hundred five'],
    [1405, 'one thousand four hundred five'],
    [2_000_034, 'two million thirty-four'],
    [-12, 'minus twelve'],
    [
      999_999_999_999_999,
      'nine hundred ninety-nine trillion nine hundred ninety-nine billion nine hundred ' +
        'ninety-nine million nine hundred ninety-nine thousand nine hundred ninety-nine',
    ],
  ])('says %s', (n, words) => {
    expect(numberWords(n)).toBe(words);
  });

  it('takes a bigint', () => {
    expect(numberWords(1405n)).toBe('one thousand four hundred five');
  });

  it.each([10 ** 15, 10n ** 15n, 1.5, Number.NaN, true, '3'])('refuses %s', (n) => {
    expect(() => numberWords(n as number)).toThrow();
  });
});

describe('sayDigits', () => {
  it("reads the text's own groups", () => {
    expect(sayDigits('415-555-0192')).toBe('four one five, five five five, zero one nine two');
    expect(sayDigits('10001')).toBe('one zero zero zero one');
    expect(sayDigits(90210)).toBe('nine zero two one zero');
  });

  it('reads given groups, the rest in a last group', () => {
    expect(sayDigits('123456', 2)).toBe('one two, three four, five six');
    expect(sayDigits('4155550192', [3, 3])).toBe(
      'four one five, five five five, zero one nine two',
    );
  });

  it('takes a null group as no group, as the reference takes None', () => {
    expect(sayDigits('415-555', null)).toBe('four one five, five five five');
  });

  it('can say zero as oh', () => {
    expect(sayDigits('1007', undefined, { zero: 'oh' })).toBe('one oh oh seven');
  });

  it('gives nothing without digits', () => {
    expect(sayDigits('none')).toBe('');
  });

  it.each([0, [3, 0], [], 1.5, true])('refuses the group %j', (group) => {
    expect(() => sayDigits('123', group as number)).toThrow();
  });
});

describe('sayLastDigits', () => {
  it('reads the last digits', () => {
    expect(sayLastDigits('4111 1111 1111 1234')).toBe('one two three four');
    expect(sayLastDigits('5551009', 2, { zero: 'oh' })).toBe('oh nine');
    expect(sayLastDigits('12', 4)).toBe('one two');
  });

  it('refuses a count that is not positive', () => {
    expect(() => sayLastDigits('1234', 0)).toThrow();
  });
});

describe('sayMoney', () => {
  it.each([
    [14.5, 'USD', 'fourteen dollars and fifty cents'],
    [1, 'USD', 'one dollar'],
    ['0.05', 'USD', 'five cents'],
    [0.005, 'USD', 'one cent'], // half up
    [0, 'USD', 'zero dollars'],
    ['2.01', 'gbp', 'two pounds and one penny'],
    [-3.5, 'EUR', 'minus three euros and fifty cents'],
    [1500, 'JPY', 'one thousand five hundred yen'],
    [99.99, 'CAD', 'ninety-nine dollars and ninety-nine cents'],
  ])('says %s %s', (amount, currency, words) => {
    expect(sayMoney(amount, currency)).toBe(words);
  });

  it('rounds from the decimal text, half up, as a decimal does', () => {
    // 2.675 is 2.67499999... as a binary double; its text is 2.675
    expect(sayMoney(2.675)).toBe('two dollars and sixty-eight cents');
    expect(sayMoney('1e-7')).toBe('zero dollars');
    expect(sayMoney(-0.001)).toBe('zero dollars');
    expect(sayMoney(12n)).toBe('twelve dollars');
    expect(sayMoney(' 1_000.5 ')).toBe('one thousand dollars and fifty cents');
    expect(sayMoney('1e-999999999')).toBe('zero dollars');
  });

  it.each([
    ['ten', 'USD'],
    [Number.NaN, 'USD'],
    [Number.POSITIVE_INFINITY, 'USD'],
    [true, 'USD'],
    ['.', 'USD'],
    [5, 'XYZ'],
    [5, 'constructor'],
    ['1e999999999', 'USD'],
    [10 ** 15, 'USD'],
  ])('refuses %s %s', (amount, currency) => {
    expect(() => sayMoney(amount as number, currency)).toThrow();
  });
});

describe('the third checkpoint review (found in review)', () => {
  it('reads Unicode decimal digits, as the reference does', () => {
    expect(sayDigits('1٢3４')).toBe('one two three four');
    expect(sayDigits('𝟏𝟐')).toBe('one two');
    expect(sayLastDigits('１２３４')).toBe('one two three four');
    expect(sayMoney('１２３４')).toBe('one thousand two hundred thirty-four dollars');
    expect(sayMoney('٣.٥٠')).toBe('three dollars and fifty cents');
  });

  it('says a zero amount at once, whatever its exponent', () => {
    const started = Date.now();
    expect(sayMoney('0e2000000')).toBe('zero dollars');
    expect(sayMoney('0e9999999999999999')).toBe('zero dollars');
    expect(Date.now() - started).toBeLessThan(50);
  });
});
