/**
 * The words an operations agent generates come from DEFAULT_WORDING, and any
 * of them can be replaced: checked when the service is made, filled in when used.
 */

import { DEFAULT_WORDING, Wording, placeholders } from '../../src/operations/wording.js';

describe('DEFAULT_WORDING', () => {
  it('fills in every default with only its own placeholders', () => {
    for (const [key, text] of Object.entries(DEFAULT_WORDING)) {
      expect(key).toBe(key.toLowerCase());
      expect(typeof text).toBe('string');
      for (const p of placeholders(text)) expect(p).toMatch(/^[a-z_]+$/);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_WORDING)).toBe(true);
  });
});

describe('placeholders', () => {
  it('finds each placeholder once and skips platform variables', () => {
    expect(placeholders('{a} ${global_data.x} {b} {a} ${c}')).toEqual(['a', 'b']);
  });
});

describe('Wording', () => {
  it('fails on an unknown key', () => {
    expect(() => new Wording(DEFAULT_WORDING, { 'step.mian': 'x' }, 'Operations')).toThrow(
      "Operations has no wording 'step.mian'; the keys are those of DEFAULT_WORDING",
    );
  });

  it("fails on a placeholder its default doesn't have", () => {
    expect(
      () => new Wording(DEFAULT_WORDING, { 'step.main': '{order} {help}' }, 'Operations'),
    ).toThrow(/\{order\}.*can use \{account\}, \{help\}/);
  });

  it('sorts placeholders as the reference does', () => {
    expect(() => new Wording({ k: '{a} {a_b}' }, { k: '{zz} {z}' }, 'X')).toThrow(
      "wording 'k' has {zz}, {z}, which it can't fill (it can use {a_b}, {a})",
    );
    expect(() => new Wording({ k: 'plain' }, { k: '{x}' }, 'X')).toThrow('(it can use none)');
  });

  it('fails on an override that is not a string', () => {
    expect(
      () =>
        new Wording(DEFAULT_WORDING, { 'step.main': 3 } as unknown as Record<string, string>, 'X'),
    ).toThrow(TypeError);
  });

  it('can drop placeholders and keeps platform variables', () => {
    const w = new Wording(
      DEFAULT_WORDING,
      { 'step.main': 'Help. Today: ${global_data.today}' },
      'X',
    );
    expect(w.say('step.main', {})).toBe('Help. Today: ${global_data.today}');
  });

  it('fills in placeholders, and fails on one with no value', () => {
    const w = new Wording({ k: 'Hi {name}, ${x}' }, null, 'X');
    expect(w.say('k', { name: 'Sam' })).toBe('Hi Sam, ${x}');
    expect(w.template('k')).toBe('Hi {name}, ${x}');
    expect(() => w.say('k')).toThrow(/needs \{name\}/);
  });

  it('joins items in running text', () => {
    const w = new Wording(DEFAULT_WORDING, { 'list.and': ' y ' }, 'X');
    expect(w.joined([])).toBe('');
    expect(w.joined(['a', ''])).toBe('a');
    expect(w.joined(['a', 'b', 'c'])).toBe(`a${DEFAULT_WORDING['list.comma']}b y c`);
  });
});
