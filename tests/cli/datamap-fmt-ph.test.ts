/**
 * The simulator's fmt_ph helper, as the platform formats a phone number: with
 * libphonenumber, parsed with US as the default region, in the national
 * format, and INVALID NUMBER for a number it can't validate (mod_openai
 * numbers.cpp format_number, called from swaig.c _expand_jsonvars). The
 * simulator formatted only North American numbers and left anything else as
 * it was. With the optional libphonenumber-js package it now does what the
 * platform does; without it, it keeps the North American formatting and says
 * on stderr when it leaves a value unformatted. Mirrors signalwire-python
 * tests/unit/cli/test_datamap_fmt_ph.py (71dbba8).
 */

import { _setPhoneNumbers, executeDataMap, expandTemplate } from '../../src/cli/datamap-exec.js';

const fmt = (phone: string) => expandTemplate('${fmt_ph:args.phone}', { args: { phone } });

describe('fmt_ph with libphonenumber-js installed', () => {
  it('gives INVALID NUMBER for a number it cannot validate', () => {
    expect(fmt('12')).toBe('INVALID NUMBER');
    expect(fmt('not a number')).toBe('INVALID NUMBER');
    expect(fmt('(555) 555-5555')).toBe('INVALID NUMBER');
  });

  it('formats a valid number in its national format, reading one without a country code as US', () => {
    expect(fmt('+1 650 253 0000')).toBe('(650) 253-0000');
    expect(fmt('2025550143')).toBe('(202) 555-0143');
    expect(fmt('+44 20 7031 3000')).toBe('020 7031 3000');
  });

  // libphonenumber-js leaves out alphabetic numbers; the platform's
  // libphonenumber maps the letters of a number with three or more of them
  // to keypad digits (PhoneNumberUtil::Normalize)
  it('formats a vanity number, its letters read as keypad digits', () => {
    expect(fmt('+1 412 535 abcd')).toBe('(412) 535-2223');
    expect(fmt('1-800-FLOWERS')).toBe('(800) 356-9377');
    expect(fmt('CALL 1-800-FLOWERS')).toBe('(800) 356-9377');
    expect(fmt('+1 800 MY APPLE')).toBe('(800) 692-7753');
  });

  it("keeps a vanity number's extension", () => {
    expect(fmt('1-800-flowers ext. 12')).toBe('(800) 356-9377 ext. 12');
    expect(fmt('1-800-FLOWERS x12')).toBe('(800) 356-9377 ext. 12');
  });

  it('reads three or more letters after a number as digits, as the platform does', () => {
    expect(fmt('Call 412-535-2223 now')).toBe('INVALID NUMBER');
  });

  it('drops fewer than three letters, which make no vanity number', () => {
    expect(fmt('+1 202 555 0143 ab')).toBe('(202) 555-0143');
    expect(fmt('202-555-0143 ext. 12')).toBe('(202) 555-0143 ext. 12');
    expect(fmt('abc')).toBe('INVALID NUMBER');
  });

  it('drops a second number after /x, as libphonenumber does', () => {
    expect(fmt('412 535 2223 / x12')).toBe('(412) 535-2223');
  });

  it('writes no note', async () => {
    const lines: string[] = [];
    const fn = { data_map: { output: { response: 'Call ${fmt_ph:args.phone}' } } };
    expect(
      await executeDataMap(fn, { phone: '+442079460958' }, { log: (l) => void lines.push(l) }),
    ).toEqual({ response: 'Call 020 7946 0958' });
    expect(lines).toEqual([]);
  });
});

describe('fmt_ph without libphonenumber-js', () => {
  let previous: ReturnType<typeof _setPhoneNumbers>;
  beforeEach(() => {
    previous = _setPhoneNumbers(null);
  });
  afterEach(() => {
    _setPhoneNumbers(previous);
  });

  it('formats a North American number', () => {
    expect(fmt('+1 202 555 0143')).toBe('(202) 555-0143');
  });

  it('formats a North American vanity number, its letters read as keypad digits', () => {
    expect(fmt('+1 412 535 abcd')).toBe('(412) 535-2223');
    expect(fmt('1-800-FLOWERS')).toBe('(800) 356-9377');
  });

  it('drops fewer than three letters, which make no vanity number', () => {
    expect(fmt('+1 202 555 0143 ab')).toBe('(202) 555-0143');
  });

  it('formats no number with another country code', () => {
    expect(fmt('+4125352223')).toBe('+4125352223');
  });

  it('keeps an extension, as the platform formats it', () => {
    expect(fmt('202-555-0143 ext. 12')).toBe('(202) 555-0143 ext. 12');
    expect(fmt('1-800-FLOWERS x12')).toBe('(800) 356-9377 ext. 12');
  });

  it('leaves a value that has too many digits once its letters are read as it is', async () => {
    const lines: string[] = [];
    const fn = { data_map: { output: { response: '${fmt_ph:args.phone}' } } };
    expect(
      await executeDataMap(
        fn,
        { phone: 'Call 412-535-2223 now' },
        { log: (l) => void lines.push(l) },
      ),
    ).toEqual({ response: 'Call 412-535-2223 now' });
    expect(lines.join('\n')).toContain('INVALID NUMBER');
  });

  it('leaves another value as it is, and says to install libphonenumber-js', async () => {
    const lines: string[] = [];
    const fn = { data_map: { output: { response: 'Call ${fmt_ph:args.phone}' } } };
    expect(await executeDataMap(fn, { phone: '12' }, { log: (l) => void lines.push(l) })).toEqual({
      response: 'Call 12',
    });
    const said = lines.join('\n');
    expect(said).toContain('INVALID NUMBER');
    expect(said).toContain('libphonenumber-js');
  });
});
