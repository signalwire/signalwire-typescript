/**
 * Values put in words as the reference's Python puts them: `str()`, `repr()`
 * and truthiness, for the few places the operations module writes a
 * developer's value into text, a query string or a decision.
 * @internal
 */

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
