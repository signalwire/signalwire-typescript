/**
 * Exact decimal amounts for the operations module, as the reference keeps
 * money with Python's `Decimal`: a coefficient and a base-10 exponent, added
 * without rounding, and written as Python's `str(Decimal)` writes them, so a
 * call's record holds the same strings the reference's does.
 *
 * @internal Not part of the package surface; money is exchanged as strings.
 */

/** The significant digits `Decimal`'s default context keeps in a result. */
const PRECISION = 28;

const DIGIT = /\p{Nd}/u;

/**
 * Text with every Unicode decimal digit written as an ASCII one, as
 * `Decimal()` reads them. Decimal digits come in runs of ten, 0 to 9, so a
 * digit's value is its distance from the start of its run.
 */
function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (c) => {
    const cp = c.codePointAt(0)!;
    if (cp <= 0x39) return c;
    let start = cp;
    while (DIGIT.test(String.fromCodePoint(start - 1))) start--;
    return String((cp - start) % 10);
  });
}

/** An exact decimal: `coefficient * 10 ** exponent`. */
export class Dec {
  readonly coefficient: bigint;
  readonly exponent: number;
  /** A zero written with a minus sign, which `Decimal` keeps (`"-0"`). */
  readonly negativeZero: boolean;

  constructor(coefficient: bigint, exponent: number, negativeZero = false) {
    this.coefficient = coefficient;
    this.exponent = exponent;
    this.negativeZero = coefficient === 0n && negativeZero;
  }

  /** Zero, as `Decimal(0)` is. */
  static readonly ZERO = new Dec(0n, 0);

  /**
   * A decimal from its text, as `Decimal(str)` reads it: an optional sign,
   * digits with an optional point, an optional exponent. Null when it isn't one.
   */
  static parse(text: string): Dec | null {
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(
      asciiDigits(text.trim()).replace(/_/g, ''),
    );
    if (!m) return null;
    const whole = m[2] ?? '';
    const fraction = m[3] ?? '';
    if (whole === '' && fraction === '') return null;
    const digits = BigInt((whole + fraction).replace(/^0+(?=\d)/, '') || '0');
    const exponent = Number(m[4] ?? 0) - fraction.length;
    if (!Number.isSafeInteger(exponent)) return null;
    return new Dec(m[1] === '-' ? -digits : digits, exponent, m[1] === '-');
  }

  /**
   * The sum, as `Decimal` adds in its default context: exact, at the smaller
   * exponent of the two, then rounded to 28 significant digits.
   */
  plus(other: Dec): Dec {
    const exponent = Math.min(this.exponent, other.exponent);
    // A zero sum is negative only when both are negative zeros, as Decimal adds
    return new Dec(
      this.scaled(exponent) + other.scaled(exponent),
      exponent,
      this.negativeZero && other.negativeZero,
    ).inContext();
  }

  /**
   * The negation, rounded to the context as `-Decimal` is; a zero's is a plain
   * zero, as `-Decimal("-0")` and `-Decimal(0)` are.
   */
  negated(): Dec {
    return new Dec(-this.coefficient, this.exponent).inContext();
  }

  /** The absolute value, rounded to the context as `abs(Decimal)` is. */
  abs(): Dec {
    const magnitude = this.coefficient < 0n ? -this.coefficient : this.coefficient;
    return new Dec(magnitude, this.exponent).inContext();
  }

  /**
   * Rounded to 28 significant digits, half to even, as `Decimal`'s default
   * context rounds a result.
   */
  inContext(): Dec {
    const negative = this.coefficient < 0n;
    let magnitude = negative ? -this.coefficient : this.coefficient;
    const drop = magnitude.toString().length - PRECISION;
    if (drop <= 0) return this;
    const divisor = 10n ** BigInt(drop);
    const rest = magnitude % divisor;
    magnitude /= divisor;
    if (2n * rest > divisor || (2n * rest === divisor && magnitude % 2n === 1n)) magnitude += 1n;
    let exponent = this.exponent + drop;
    // A carry to one digit more: 999...9 rounds to 1000...0, one digit fewer kept
    if (magnitude.toString().length > PRECISION) {
      magnitude /= 10n;
      exponent += 1;
    }
    return new Dec(negative ? -magnitude : magnitude, exponent, this.negativeZero);
  }

  /** -1, 0 or 1. */
  sign(): number {
    return this.coefficient === 0n ? 0 : this.coefficient < 0n ? -1 : 1;
  }

  /** Compared by value: -1, 0 or 1. */
  compare(other: Dec): number {
    const exponent = Math.min(this.exponent, other.exponent);
    const a = this.scaled(exponent);
    const b = other.scaled(exponent);
    return a === b ? 0 : a < b ? -1 : 1;
  }

  /** Whether it's a whole number. */
  isInteger(): boolean {
    if (this.exponent >= 0) return true;
    return this.coefficient % 10n ** BigInt(-this.exponent) === 0n;
  }

  /** The digits after the point it needs, trailing zeros dropped, as `normalize()` (in the context) leaves it. */
  places(): number {
    const value = this.inContext();
    if (value.coefficient === 0n || value.exponent >= 0) return 0;
    let c = value.coefficient < 0n ? -value.coefficient : value.coefficient;
    let places = -value.exponent;
    while (places > 0 && c % 10n === 0n) {
      c /= 10n;
      places--;
    }
    return places;
  }

  /** Rounded half up to `digits` after the point, as `quantize(..., ROUND_HALF_UP)` does. */
  rounded(digits: number): Dec {
    const target = -digits;
    if (this.exponent >= target) return new Dec(this.scaled(target), target);
    const divisor = 10n ** BigInt(target - this.exponent);
    const negative = this.coefficient < 0n;
    const magnitude = negative ? -this.coefficient : this.coefficient;
    let quotient = magnitude / divisor;
    if (2n * (magnitude % divisor) >= divisor) quotient += 1n;
    return new Dec(negative ? -quotient : quotient, target);
  }

  /**
   * Fixed notation with `digits` after the point and thousands separators, as
   * `f"{x.quantize(...):,.2f}"` writes it.
   * @throws {Error} When that takes more than 28 digits, as `quantize` refuses it.
   */
  toGrouped(digits: number): string {
    const value = this.rounded(digits);
    const magnitude = value.coefficient < 0n ? -value.coefficient : value.coefficient;
    if (magnitude.toString().length > PRECISION) {
      throw new Error(`${this.toString()} has more digits than an amount of money can`);
    }
    const negative = value.coefficient < 0n;
    const text = (negative ? -value.coefficient : value.coefficient)
      .toString()
      .padStart(digits + 1, '0');
    const whole = text.slice(0, text.length - digits);
    const fraction = digits > 0 ? `.${text.slice(text.length - digits)}` : '';
    return `${negative ? '-' : ''}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction}`;
  }

  /** Written as Python's `str(Decimal)` writes it (the to-scientific-string rules). */
  toString(): string {
    const negative = this.coefficient < 0n || this.negativeZero;
    const digits = (this.coefficient < 0n ? -this.coefficient : this.coefficient).toString();
    const adjusted = this.exponent + digits.length - 1;
    let body: string;
    if (this.exponent <= 0 && adjusted >= -6) {
      if (this.exponent === 0) body = digits;
      else {
        const point = digits.length + this.exponent;
        body =
          point > 0
            ? `${digits.slice(0, point)}.${digits.slice(point)}`
            : `0.${'0'.repeat(-point)}${digits}`;
      }
    } else {
      const mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
      body = `${mantissa}E${adjusted >= 0 ? '+' : ''}${adjusted}`;
    }
    return `${negative ? '-' : ''}${body}`;
  }

  private scaled(exponent: number): bigint {
    return this.coefficient * 10n ** BigInt(this.exponent - exponent);
  }
}
