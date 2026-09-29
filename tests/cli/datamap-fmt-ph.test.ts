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
