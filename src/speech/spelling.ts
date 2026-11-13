/**
 * What a caller spelled out, from the recognizer's text.
 *
 * A caller spells a name, a code or an email address in many ways: letter by
 * letter ("s m i t h"), with letter names ("ess em eye tee aitch"), with words
 * ("S as in Sam"), with the NATO alphabet ("sierra mike"), or with "double l"
 * for two. {@link readSpelled} turns all of them into units, one letter, digit
 * or symbol each, and {@link spokenEmail} reads an address said aloud.
 *
 * The recognizer confuses some letters, and which ones depends on the
 * recognizer and the voice. {@link spellingVariants} expands units with
 * confusion groups you supply, measured on your own calls; none are built in.
 * English only.
 */

// prettier-ignore
const LETTER_NAMES: Record<string, string> = {
  a: 'A', ay: 'A',
  b: 'B', be: 'B', bee: 'B',
  c: 'C', see: 'C', sea: 'C', cee: 'C',
  d: 'D', dee: 'D',
  e: 'E', ee: 'E',
  f: 'F', ef: 'F', eff: 'F',
  g: 'G', gee: 'G', jee: 'G',
  h: 'H', aitch: 'H', haitch: 'H',
  i: 'I', eye: 'I',
  j: 'J', jay: 'J',
  k: 'K', kay: 'K',
  l: 'L', el: 'L', ell: 'L',
  m: 'M', em: 'M',
  n: 'N', en: 'N',
  o: 'O',
  p: 'P', pee: 'P',
  q: 'Q', cue: 'Q', queue: 'Q',
  r: 'R', ar: 'R', are: 'R',
  s: 'S', es: 'S', ess: 'S',
  t: 'T', tee: 'T', tea: 'T',
  u: 'U', you: 'U',
  v: 'V', vee: 'V',
  w: 'W',
  x: 'X', ex: 'X',
  y: 'Y', why: 'Y', wye: 'Y',
  z: 'Z', zee: 'Z', zed: 'Z',
};

// prettier-ignore
const NATO: Record<string, string> = {
  alpha: 'A', alfa: 'A', bravo: 'B', charlie: 'C', delta: 'D',
  echo: 'E', foxtrot: 'F', golf: 'G', hotel: 'H', india: 'I',
  juliet: 'J', juliett: 'J', kilo: 'K', lima: 'L', mike: 'M',
  november: 'N', oscar: 'O', papa: 'P', quebec: 'Q', romeo: 'R',
  sierra: 'S', tango: 'T', uniform: 'U', victor: 'V',
  whiskey: 'W', whisky: 'W', xray: 'X', 'x-ray': 'X', yankee: 'Y',
  zulu: 'Z',
};

// prettier-ignore
const DIGIT_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

// prettier-ignore
const SYMBOLS: Record<string, string> = {
  dot: '.', period: '.', point: '.',
  at: '@',
  dash: '-', hyphen: '-',
  underscore: '_',
  plus: '+',
  slash: '/',
};

// Words that say how the next letter is written, not which it is
const CASE_WORDS = new Set(['capital', 'uppercase', 'upper', 'lowercase', 'lower', 'small']);

const TOKEN = /[a-z0-9@._+/'-]+/g;
const UNIT_SYMBOLS = '@._+/-';

const lookup = (table: Record<string, string>, word: string): string | undefined =>
  Object.hasOwn(table, word) ? table[word] : undefined;

/** The letter, digit or symbol one spoken word names, or null. */
function unitOf(word: string, ohIsZero: boolean): string | null {
  if (word === 'oh') return ohIsZero ? '0' : 'O';
  for (const table of [LETTER_NAMES, NATO, DIGIT_WORDS, SYMBOLS]) {
    const unit = lookup(table, word);
    if (unit !== undefined) return unit;
  }
  if (word.length === 1 && (/\d/.test(word) || UNIT_SYMBOLS.includes(word))) return word;
  return null;
}

const isLetter = (unit: string | null): unit is string => unit !== null && /^[A-Z]$/.test(unit);

/** Options for {@link readSpelled}. */
export interface ReadSpelledOptions {
  /** True to read "oh" as the digit 0, for a code of digits; by default it's the letter O. */
  ohIsZero?: boolean;
}

/**
 * The units a caller spelled: one uppercase letter, digit or symbol each.
 *
 * `readSpelled('S as in Sam, m i t h')` and `readSpelled('sierra mike india
 * tango hotel')` are both `['S', 'M', 'I', 'T', 'H']`. "double l" is two L's,
 * and "capital" before a letter is dropped. A word that names no letter, such
 * as "smith", is taken as spelled: its letters.
 *
 * @param text - The recognizer's text.
 * @param opts - `ohIsZero`.
 * @returns The units, in order.
 */
export function readSpelled(text: string, opts: ReadSpelledOptions = {}): string[] {
  const ohIsZero = opts.ohIsZero ?? false;
  const tokens = spellingTokens(text);
  const units: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const word = tokens[i]!;
    // "S as in Sam": the letter, and the word after "as in" is skipped
    if (tokens[i + 1] === 'as' && tokens[i + 2] === 'in') {
      const letter = unitOf(word, false);
      units.push(isLetter(letter) ? letter : word[0]!.toUpperCase());
      i += 4;
      continue;
    }
    if (CASE_WORDS.has(word)) {
      i += 1;
      continue;
    }
    if (word === 'double' && i + 1 < tokens.length) {
      const following = tokens[i + 1]!;
      if (following === 'you' || following === 'u') {
        units.push('W');
      } else {
        const unit = unitOf(following, ohIsZero);
        if (unit) units.push(unit, unit);
        else units.push(...letters(following), ...letters(following));
      }
      i += 2;
      continue;
    }
    const unit = unitOf(word, ohIsZero);
    if (unit) units.push(unit);
    else units.push(...letters(word));
    i += 1;
  }
  return units;
}

/**
 * The words of spelled text. A hyphen inside a word, as a recognizer writes
 * "S-M-I-T-H", separates units; a spoken "dash" is the symbol.
 */
function spellingTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const token of text.toLowerCase().match(TOKEN) ?? []) {
    if (token.includes('-') && token.length > 1 && lookup(NATO, token) === undefined) {
      tokens.push(...token.split('-').filter((part) => part));
    } else {
      tokens.push(token);
    }
  }
  return tokens;
}

function letters(word: string): string[] {
  return [...word]
    .filter((c) => /[a-z0-9]/i.test(c) || UNIT_SYMBOLS.includes(c))
    .map((c) => (/[a-z]/i.test(c) ? c.toUpperCase() : c));
}

/**
 * An email address said aloud, as text: "john dot smith at example dot com" is
 * "john.smith@example.com".
 *
 * Words are kept as words, and letters, digits and symbols spelled out are
 * joined to them, so "j o h n underscore smith at example dot co dot uk" is
 * "john_smith@example.co.uk". An address the recognizer already wrote as one
 * is returned lowercased.
 *
 * @param text - The recognizer's text.
 * @returns The address, lowercased. Check it before you use it: this reads the
 *   words, it doesn't validate them.
 */
export function spokenEmail(text: string): string {
  const compact = text.trim().toLowerCase().replace(/\s+/g, '');
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(compact)) return compact;
  const tokens = text.toLowerCase().match(TOKEN) ?? [];
  const parts: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const word = tokens[i]!;
    if (word === 'at' && tokens[i + 1] === 'sign') {
      parts.push('@');
      i += 2;
      continue;
    }
    if (tokens[i + 1] === 'as' && tokens[i + 2] === 'in') {
      const letter = unitOf(word, false);
      parts.push((isLetter(letter) ? letter : word[0]!).toLowerCase());
      i += 4;
      continue;
    }
    if (word === 'double' && i + 1 < tokens.length) {
      const doubled = (unitOf(tokens[i + 1]!, false) ?? tokens[i + 1]!).toLowerCase();
      parts.push(doubled + doubled);
      i += 2;
      continue;
    }
    const symbol = lookup(SYMBOLS, word);
    const nato = lookup(NATO, word);
    const digit = lookup(DIGIT_WORDS, word);
    const letterName = lookup(LETTER_NAMES, word);
    if (symbol !== undefined) parts.push(symbol);
    else if (nato !== undefined) parts.push(nato.toLowerCase());
    else if (digit !== undefined) parts.push(digit);
    else if (word.length === 1 || (letterName !== undefined && word.length <= 2)) {
      parts.push((letterName ?? word).toLowerCase());
    } else parts.push(word);
    i += 1;
  }
  return parts.join('');
}

/** Options for {@link spellingVariants}. */
export interface SpellingVariantsOptions {
  /**
   * Only these positions vary, such as the words the recognizer was least sure
   * of (`AgentBase.speechFinals()` gives each word's confidence). Default: all.
   */
  positions?: Iterable<number>;
  /** The most spellings to return. Default 50. */
  limit?: number;
}

/**
 * The spellings `units` could be, given letters the recognizer confuses.
 *
 * `groups` maps a unit to the units it may be heard as, such as `{ S: 'F', F:
 * 'S', M: 'N', N: 'M' }` (a string is its letters): measure them on your own
 * recognizer and voices. The units as heard come first, then the variants with
 * one change, then two, and so on, up to `limit`. Look each up in your own
 * records; the first that matches is the likeliest.
 *
 * @param units - The units, from {@link readSpelled}.
 * @param groups - For each unit, the units it may have been.
 * @param opts - `positions` and `limit`.
 * @returns The spellings, joined.
 */
export function spellingVariants(
  units: readonly string[],
  groups: Readonly<Record<string, Iterable<string>>> | ReadonlyMap<string, Iterable<string>>,
  opts: SpellingVariantsOptions = {},
): string[] {
  const limit = opts.limit ?? 50;
  const allowed = opts.positions === undefined ? null : new Set(opts.positions);
  const groupOf = (unit: string): Iterable<string> =>
    (groups instanceof Map
      ? groups.get(unit)
      : Object.hasOwn(groups, unit)
        ? (groups as Record<string, Iterable<string>>)[unit]
        : undefined) ?? [];
  const choices = units.map((unit, n) =>
    allowed === null || allowed.has(n)
      ? [unit, ...[...groupOf(unit)].filter((u) => u !== unit)]
      : [unit],
  );
  const varying = choices.flatMap((c, n) => (c.length > 1 ? [n] : []));
  const spellings = [units.join('')];
  if (spellings.length >= limit) return spellings;
  for (let changes = 1; changes <= varying.length; changes++) {
    for (const where of combinations(varying, changes)) {
      for (const picks of product(where.map((n) => choices[n]!.slice(1)))) {
        const spelled = [...units];
        where.forEach((n, k) => (spelled[n] = picks[k]!));
        spellings.push(spelled.join(''));
        if (spellings.length >= limit) return spellings;
      }
    }
  }
  return spellings;
}

/** The `size`-element combinations of `items`, in order, as Python's itertools gives them. */
function* combinations<T>(items: readonly T[], size: number): Generator<T[]> {
  const index = Array.from({ length: size }, (_, k) => k);
  if (size > items.length) return;
  for (;;) {
    yield index.map((k) => items[k]!);
    let k = size - 1;
    while (k >= 0 && index[k] === k + items.length - size) k--;
    if (k < 0) return;
    index[k]!++;
    for (let j = k + 1; j < size; j++) index[j] = index[j - 1]! + 1;
  }
}

/** The cartesian product of `lists`, the last varying fastest. */
function* product<T>(lists: readonly (readonly T[])[]): Generator<T[]> {
  if (lists.some((l) => l.length === 0)) return;
  const index = lists.map(() => 0);
  for (;;) {
    yield index.map((k, n) => lists[n]![k]!);
    let n = lists.length - 1;
    while (n >= 0 && index[n] === lists[n]!.length - 1) index[n--] = 0;
    if (n < 0) return;
    index[n]!++;
  }
}
