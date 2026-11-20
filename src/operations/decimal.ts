/**
 * Exact decimal amounts for the operations module, as the reference keeps
 * money with Python's `Decimal`: a coefficient and a base-10 exponent, added
 * without rounding, and written as Python's `str(Decimal)` writes them, so a
 * call's record holds the same strings the reference's does.
 *
 * @internal Not part of the package surface; money is exchanged as strings.
 */

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
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text.trim().replace(/_/g, ''));
    if (!m) return null;
    const whole = m[2] ?? '';
    const fraction = m[3] ?? '';
    if (whole === '' && fraction === '') return null;
    const digits = BigInt((whole + fraction).replace(/^0+(?=\d)/, '') || '0');
    const exponent = Number(m[4] ?? 0) - fraction.length;
    if (!Number.isSafeInteger(exponent)) return null;
    return new Dec(m[1] === '-' ? -digits : digits, exponent, m[1] === '-');
  }

  /** The sum, exact: the exponent is the smaller of the two, as `Decimal` adds. */
  plus(other: Dec): Dec {
    const exponent = Math.min(this.exponent, other.exponent);
    // A zero sum is negative only when both are negative zeros, as Decimal adds
    return new Dec(
      this.scaled(exponent) + other.scaled(exponent),
      exponent,
      this.negativeZero && other.negativeZero,
    );
  }

  /** The negation. */
  negated(): Dec {
    return new Dec(-this.coefficient, this.exponent, this.coefficient === 0n && !this.negativeZero);
  }

  /** The absolute value. */
  abs(): Dec {
    return this.coefficient < 0n || this.negativeZero
      ? new Dec(this.coefficient < 0n ? -this.coefficient : this.coefficient, this.exponent)
      : this;
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

  /** The digits after the point it needs, trailing zeros dropped. */
  places(): number {
    if (this.coefficient === 0n || this.exponent >= 0) return 0;
    let c = this.coefficient < 0n ? -this.coefficient : this.coefficient;
    let places = -this.exponent;
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

  /** Fixed notation with `digits` after the point and thousands separators: `f"{x:,.2f}"`. */
  toGrouped(digits: number): string {
    const value = this.rounded(digits);
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
