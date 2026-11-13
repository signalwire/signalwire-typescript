/**
 * What a caller spelled, from the recognizer's text, from signalwire-python
 * 3.8.0: letter by letter, with letter names, "X as in Word", the NATO
 * alphabet, "double", digits and the symbols of an email address.
 */
import { readSpelled, spellingVariants, spokenEmail } from '../../src/index.js';

const SMITH = ['S', 'M', 'I', 'T', 'H'];

describe('readSpelled', () => {
  it.each([
    's m i t h',
    'S as in Sam, M as in Mary, i t h',
    'sierra mike india tango hotel',
    'ess em eye tee aitch',
    'smith',
    'S-M-I-T-H',
  ])('reads %j as SMITH', (said) => {
    expect(readSpelled(said)).toEqual(SMITH);
  });

  it('reads double and drops capital', () => {
    expect(readSpelled('capital j o double l y')).toEqual(['J', 'O', 'L', 'L', 'Y']);
    expect(readSpelled('double you a')).toEqual(['W', 'A']);
  });

  it('reads digits and oh', () => {
    expect(readSpelled('one two oh four 5')).toEqual(['1', '2', 'O', '4', '5']);
    expect(readSpelled('one two oh four', { ohIsZero: true })).toEqual(['1', '2', '0', '4']);
    expect(readSpelled('123')).toEqual(['1', '2', '3']);
  });

  it('reads symbols', () => {
    expect(readSpelled('a dot b at c dash d underscore e')).toEqual([
      'A',
      '.',
      'B',
      '@',
      'C',
      '-',
      'D',
      '_',
      'E',
    ]);
  });

  it('reads nothing spelled as nothing', () => {
    expect(readSpelled('')).toEqual([]);
  });

  it("doesn't take an object's own names as letters", () => {
    expect(readSpelled('constructor')).toEqual([...'CONSTRUCTOR']);
  });
});

describe('spokenEmail', () => {
  it.each([
    ['john dot smith at example dot com', 'john.smith@example.com'],
    ['j o h n underscore smith at example dot co dot uk', 'john_smith@example.co.uk'],
    ['John.Smith@Example.com', 'john.smith@example.com'],
    ['john . smith @ example . com', 'john.smith@example.com'],
    ['anna at sign gmail dot com', 'anna@gmail.com'],
    ['b as in boy o b at example dot com', 'bob@example.com'],
    ['sales dash team at example dot org', 'sales-team@example.org'],
    ['bravo oscar bravo one two at example dot net', 'bob12@example.net'],
    ['double l at example dot com', 'll@example.com'],
  ])('reads %j', (said, address) => {
    expect(spokenEmail(said)).toBe(address);
  });
});

describe('spellingVariants', () => {
  it('gives the fewest changes first', () => {
    expect(spellingVariants(SMITH, { S: 'F', M: 'N' })).toEqual([
      'SMITH',
      'FMITH',
      'SNITH',
      'FNITH',
    ]);
  });

  it('varies only the positions in doubt', () => {
    expect(spellingVariants(SMITH, { S: 'F', M: 'N' }, { positions: [0] })).toEqual([
      'SMITH',
      'FMITH',
    ]);
  });

  it('takes a group with several', () => {
    expect(spellingVariants(['B'], { B: ['D', 'P', 'B'] })).toEqual(['B', 'D', 'P']);
    expect(spellingVariants(['B'], new Map([['B', ['D']]]))).toEqual(['B', 'D']);
  });

  it('stops at the limit', () => {
    const groups = Object.fromEntries(SMITH.map((u) => [u, 'XYZ']));
    expect(spellingVariants(SMITH, groups, { limit: 7 })).toHaveLength(7);
  });

  it('gives the units as heard without groups', () => {
    expect(spellingVariants(SMITH, {})).toEqual(['SMITH']);
  });

  it('orders the changes as the reference does', () => {
    // itertools.combinations then itertools.product, the last varying fastest
    expect(spellingVariants(['A', 'B', 'C'], { A: 'a', B: 'bB2', C: 'c' })).toEqual([
      'ABC',
      'aBC',
      'AbC',
      'A2C',
      'ABc',
      'abC',
      'a2C',
      'aBc',
      'Abc',
      'A2c',
      'abc',
      'a2c',
    ]);
  });
});
