/**
 * Values put in words as the reference's Python puts them.
 */

import { _pyRepr, _pyStr, _pyTruthy } from '../../src/operations/pystr.js';

describe('pyStr', () => {
  it.each([
    [null, 'None'],
    [true, 'True'],
    [1.5, '1.5'],
    [1e-7, '1e-07'],
    [0.0001, '0.0001'],
    [1e21, '1000000000000000000000'],
    [-2.5e-10, '-2.5e-10'],
    [Number.NaN, 'nan'],
    ['text', 'text'],
    [['a', 'b'], "['a', 'b']"],
    [{ urgent: true, n: null }, "{'urgent': True, 'n': None}"],
    [["it's", 'say "hi"', `both ' and "`], `["it's", 'say "hi"', 'both \\' and "']`],
    [['tab\there', '\u0007', 'é', ' '], "['tab\\there', '\\x07', 'é', '\\u2028']"],
  ] as const)('writes %j as %s', (value, text) => {
    expect(_pyStr(value)).toBe(text);
  });

  it('quotes a string in repr', () => {
    expect(_pyRepr('a')).toBe("'a'");
  });

  it('is false where Python is', () => {
    for (const v of [null, undefined, false, 0, Number.NaN, '', [], {}, new Map(), 0n]) {
      expect(_pyTruthy(v)).toBe(false);
    }
    for (const v of [true, 1, 'x', [0], { a: 0 }, new Date()]) expect(_pyTruthy(v)).toBe(true);
  });
});
