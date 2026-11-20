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
/** The largest adjusted exponent of a result in the default context. */
const EMAX = 999999;
/** The smallest exponent a (subnormal) result can have: Emin - precision + 1. */
const ETINY = -999999 - PRECISION + 1;
/** The largest exponent a full-precision result can have: Emax - precision + 1. */
const ETOP = EMAX - PRECISION + 1;

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
    if (this.coefficient === 0n && other.coefficient === 0n) {
      // A zero sum is negative only when both are negative zeros, as Decimal adds
      return new Dec(0n, exponent, this.negativeZero && other.negativeZero).inContext();
    }
    // A zero added keeps the other's digits, and no more than the context's
    // past them, as Decimal's _add does: never a padding of a million zeros
    if (this.coefficient === 0n || other.coefficient === 0n) {
      const kept = this.coefficient === 0n ? other : this;
      const at = Math.max(exponent, kept.exponent - PRECISION - 1);
      return new Dec(kept.scaled(at), at).inContext();
    }
    // As Decimal's _normalize: an addend far below the other's last digit the
    // context keeps counts only as a sticky 1 just below it
    const big = this.exponent >= other.exponent ? this : other;
    let small = big === this ? other : this;
    const sticky = big.exponent + Math.min(-1, big.digits() - PRECISION - 2);
    if (small.digits() + small.exponent - 1 < sticky) {
      small = new Dec(small.coefficient < 0n ? -1n : 1n, sticky);
    }
    const at = Math.min(big.exponent, small.exponent);
    return new Dec(big.scaled(at) + small.scaled(at), at).inContext();
  }

  /** How many digits its coefficient has. */
  private digits(): number {
    return (this.coefficient < 0n ? -this.coefficient : this.coefficient).toString().length;
  }

  /** Its magnitude divided by `10 ** drop`, and whether what's dropped is under, at or over half. */
  private static shifted(magnitude: bigint, drop: number): [bigint, number] {
    if (drop <= 0) return [magnitude * 10n ** BigInt(-drop), -1];
    // Every digit dropped, and then some: less than half of the last one kept
    if (drop > magnitude.toString().length) return [0n, magnitude === 0n ? -2 : -1];
    const divisor = 10n ** BigInt(drop);
    const twice = 2n * (magnitude % divisor);
    return [
      magnitude / divisor,
      twice === 0n ? -2 : twice < divisor ? -1 : twice === divisor ? 0 : 1,
    ];
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
   * Rounded as `Decimal`'s default context rounds a result: to 28 significant
   * digits, half to even, with a carry to one digit more taken off again; a
   * result smaller than the context holds is subnormal, rounded to the
   * smallest exponent there is (so it may become zero), and one larger fails.
   * @throws {Error} For a result over the largest the context holds (Overflow).
   */
  inContext(): Dec {
    const negative = this.coefficient < 0n || this.negativeZero;
    let magnitude = this.coefficient < 0n ? -this.coefficient : this.coefficient;
    if (magnitude === 0n) {
      const exponent = Math.min(Math.max(this.exponent, ETINY), EMAX);
      return exponent === this.exponent ? this : new Dec(0n, exponent, this.negativeZero);
    }
    let least = magnitude.toString().length + this.exponent - PRECISION;
    if (least > ETOP)
      throw new Error(`decimal overflow: ${this.toString()} is over the largest amount`);
    if (least < ETINY) least = ETINY;
    if (this.exponent >= least) return this;
    const [quotient, half] = Dec.shifted(magnitude, least - this.exponent);
    magnitude = quotient;
    if (half > 0 || (half === 0 && magnitude % 2n === 1n)) magnitude += 1n;
    let exponent = least;
    // A carry to one digit more: 999...9 rounds to 1000...0, one digit fewer kept
    if (magnitude.toString().length > PRECISION) {
      magnitude /= 10n;
      exponent += 1;
    }
    if (exponent > ETOP)
      throw new Error(`decimal overflow: ${this.toString()} is over the largest amount`);
    return new Dec(negative ? -magnitude : magnitude, exponent, negative);
  }

  /** -1, 0 or 1. */
  sign(): number {
    return this.coefficient === 0n ? 0 : this.coefficient < 0n ? -1 : 1;
  }

  /** Compared by value: -1, 0 or 1. */
  compare(other: Dec): number {
    const a = this.sign();
    const b = other.sign();
    if (a !== b || a === 0) return a === b ? 0 : a < b ? -1 : 1;
    // The same sign: the larger adjusted exponent is the larger magnitude
    const adjusted = this.exponent + this.digits() - (other.exponent + other.digits());
    if (adjusted !== 0) return adjusted > 0 ? a : -a;
    const exponent = Math.min(this.exponent, other.exponent);
    const x = this.scaled(exponent);
    const y = other.scaled(exponent);
    return x === y ? 0 : x < y ? -1 : 1;
  }

  /** Whether it's a whole number. */
  isInteger(): boolean {
    if (this.exponent >= 0 || this.coefficient === 0n) return true;
    const zeros = /0*$/.exec(this.coefficient.toString())![0].length;
    return zeros >= -this.exponent;
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
    if (this.coefficient === 0n) return new Dec(0n, target);
    const negative = this.coefficient < 0n;
    const [quotient, half] = Dec.shifted(
      negative ? -this.coefficient : this.coefficient,
      target - this.exponent,
    );
    const magnitude = half >= 0 ? quotient + 1n : quotient;
    return new Dec(negative ? -magnitude : magnitude, target);
  }

  /**
   * Fixed notation with `digits` after the point and thousands separators, as
   * `f"{x.quantize(...):,.2f}"` writes it.
   * @throws {Error} When that takes more than 28 digits, as `quantize` refuses it.
   */
  toGrouped(digits: number): string {
    // Too many digits before it's rounded: refused without building them
    if (this.coefficient !== 0n && this.exponent + this.digits() + digits > PRECISION + 1) {
      throw new Error(`${this.toString()} has more digits than an amount of money can`);
    }
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
