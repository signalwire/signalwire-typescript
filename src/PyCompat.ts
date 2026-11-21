/**
 * Values read and written as the reference's Python reads and writes them:
 * `str()`, `repr()`, truthiness, `strip()`'s whitespace and `int()` of a
 * string, for the places the SDK puts a developer's or the platform's value
 * into text, a query string or a decision.
 * @internal
 */

/** The characters Python's `str.isspace()` (and so `strip()`) counts as whitespace; not U+FEFF. */
const PY_SPACE =
  '\t\n\v\f\r\x1c\x1d\x1e\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000';
const PY_STRIP = new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, 'g');
/** The whitespace Python's `int()` allows around a number: strip()'s, but not U+001C to U+001F. */
const INT_SPACE =
  '\\t\\n\\v\\f\\r \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const INT_STRIP = new RegExp(`^[${INT_SPACE}]+|[${INT_SPACE}]+$`, 'g');

/** @internal Text with Python's `strip()` applied. */
export function _pyStrip(text: string): string {
  return text.replace(PY_STRIP, '');
}

const DIGIT = /\p{Nd}/u;

/**
 * @internal Text with every Unicode decimal digit written as an ASCII one, as
 * Python reads digits. Decimal digits come in runs of ten, 0 to 9, so a
 * digit's value is its distance from the start of its run.
 */
export function _asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (c) => {
    const cp = c.codePointAt(0)!;
    if (cp <= 0x39) return c;
    let start = cp;
    while (DIGIT.test(String.fromCodePoint(start - 1))) start--;
    return String((cp - start) % 10);
  });
}

/**
 * @internal A whole number as Python's `int()` reads one: an int, a float cut
 * to its whole part, or an integer string (Python's whitespace around it,
 * Unicode digits, underscores between digits). Anything else, a bool
 * included, is null.
 */
export function _pyInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === 'string') {
    const text = _asciiDigits(value.replace(INT_STRIP, ''));
    return /^[+-]?\d+(_\d+)*$/.test(text) ? Number(text.replace(/_/g, '')) : null;
  }
  return null;
}

/** A plain record: an object literal's, or one made with `Object.create(null)`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/** @internal Whether Python counts the value as true: not None, False, 0, "", or an empty list or dict. */
export function _pyTruthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'bigint') return value !== 0n;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Map || value instanceof Set) return value.size > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

/** @internal A value as Python's `str()` writes it: a string as itself, anything else as `repr()`. */
export function _pyStr(value: unknown): string {
  return typeof value === 'string' ? value : _pyRepr(value);
}

/**
 * @internal A value as Python's `repr()` writes it: `None`, `True`, `1.5`,
 * `1e-07`, `'text'`, `['a', 'b']`, `{'k': True}`. A whole number is written as
 * an int: a JS number has no float form.
 */
export function _pyRepr(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return floatRepr(value);
  if (typeof value === 'string') return stringRepr(value);
  if (Array.isArray(value)) return `[${value.map(_pyRepr).join(', ')}]`;
  if (isRecord(value)) {
    const items = Object.entries(value).map(([k, v]) => `${stringRepr(k)}: ${_pyRepr(v)}`);
    return `{${items.join(', ')}}`;
  }
  return String(value);
}

function floatRepr(x: number): string {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  if (Number.isInteger(x)) {
    if (Object.is(x, -0)) return '0';
    return BigInt(x).toString();
  }
  // The shortest digits that round-trip, as both languages find them, written
  // the way Python's repr writes them: fixed from 1e-4 to 1e16, else e±XX
  const [mantissa, exp] = x.toExponential().split('e') as [string, string];
  const exponent = Number(exp);
  if (exponent >= -4 && exponent < 16) return String(x);
  const sign = exponent < 0 ? '-' : '+';
  return `${mantissa}e${sign}${String(Math.abs(exponent)).padStart(2, '0')}`;
}

const NOT_PRINTABLE = /[\p{C}\p{Z}]/u;

function stringRepr(text: string): string {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  let out = '';
  for (const c of text) {
    if (c === '\\') out += '\\\\';
    else if (c === quote) out += `\\${c}`;
    else if (c === '\n') out += '\\n';
    else if (c === '\r') out += '\\r';
    else if (c === '\t') out += '\\t';
    else if (c !== ' ' && NOT_PRINTABLE.test(c)) {
      const cp = c.codePointAt(0)!;
      out +=
        cp <= 0xff
          ? `\\x${cp.toString(16).padStart(2, '0')}`
          : cp <= 0xffff
            ? `\\u${cp.toString(16).padStart(4, '0')}`
            : `\\U${cp.toString(16).padStart(8, '0')}`;
    } else out += c;
  }
  return `${quote}${out}${quote}`;
}
