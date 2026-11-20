/**
 * What a developer writes for an operations agent: an operation's fields, the
 * change its `prepare` builds, the writes that carry it out, and the two ways
 * `prepare` says no ({@link Need}, {@link Refuse}).
 */

import { _Dec as Dec } from './decimal.js';
import { _decimalOf as decimalOf, type Amount } from './money.js';

/**
 * The value a field takes when the caller hasn't said it: the model's honest
 * answer, which the operation treats as missing rather than as a value.
 */
export const NOT_SAID = 'not said';

/**
 * Thrown by `prepare` when something the operation needs wasn't said.
 *
 * Nothing is proposed. The model is told what to ask, and keeps everything
 * the caller already gave for the next call.
 *
 * @example
 * ```ts
 * if (!f.size) throw new Need('Which size would they like: small, medium or large?', ['size']);
 * ```
 */
export class Need extends Error {
  /** The question to ask the caller, in the operation's words. */
  ask: string;
  /** The fields still missing. */
  fields: string[];

  /**
   * @param ask - The question to ask the caller, in the operation's words.
   * @param fields - The fields still missing.
   */
  constructor(ask: string, fields: readonly string[] = []) {
    super(ask);
    this.name = 'Need';
    this.ask = ask;
    this.fields = [...fields];
  }
}

/** Options for a {@link Refuse}. */
export interface RefuseOptions {
  /**
   * True to keep it in the model's view however long it is, for a refusal that
   * lists choices the caller picks from later.
   */
  keep?: boolean;
}

/**
 * Thrown by `prepare` (or a lookup) when the request breaks a rule.
 *
 * Nothing changes. The model is told why, and what can be done instead.
 *
 * @example
 * ```ts
 * if (order.status !== 'pending') {
 *   throw new Refuse('Only pending orders can be cancelled.', "Offer a return once it's delivered.");
 * }
 * ```
 */
export class Refuse extends Error {
  /** What is true now: nothing was changed, and why. */
  why: string;
  /** What to do next, or null for telling the caller and asking how they'd like to go on. */
  then: string | null;
  /** Whether it's kept in the model's view however long it is. */
  keep: boolean;

  /**
   * @param why - What is true now: nothing was changed, and why.
   * @param then - What to do next. Defaults to telling the caller and asking
   *   how they'd like to go on.
   * @param opts - `keep`.
   */
  constructor(why: string, then: string | null = null, opts: RefuseOptions = {}) {
    super(why);
    this.name = 'Refuse';
    this.why = why;
    this.then = then;
    this.keep = opts.keep ?? false;
  }
}

/**
 * Thrown by `apply` when a backend write was refused.
 *
 * The change stops at that write: the writes before it stay made, and the
 * model is told exactly what went through.
 */
export class WriteFailed extends Error {
  /** Why the backend refused it, in words the caller can hear. */
  reason: string;

  /**
   * @param reason - Why the backend refused it, in words the caller can hear.
   */
  constructor(reason: string) {
    super(reason);
    this.name = 'WriteFailed';
    this.reason = reason;
  }
}

/**
 * One backend write a change carries out, kept as data.
 *
 * A change's writes are frozen when it is read back: a later amendment builds
 * a new change, and never edits these.
 *
 * @example
 * ```ts
 * new Write('cancel_pending_order', { order_id: '#W1234567', reason: 'no longer needed' });
 * ```
 */
export class Write {
  /** What the write does, such as the backend call's name. */
  name: string;
  /** The write's arguments. */
  args: Record<string, unknown>;

  /**
   * @param name - What the write does, such as the backend call's name.
   * @param args - The write's arguments.
   */
  constructor(name: string, args: Record<string, unknown> = {}) {
    this.name = name;
    this.args = { ...args };
  }

  /**
   * The write as it is kept in the call's record.
   * @returns `{ name, args }`.
   */
  toDict(): Record<string, unknown> {
    return { name: this.name, args: { ...this.args } };
  }

  /**
   * A write from the call's record.
   * @param data - `{ name, args }`.
   * @returns The write.
   */
  static fromDict(data: Record<string, unknown>): Write {
    const args = data['args'];
    return new Write(
      String(data['name'] ?? ''),
      typeof args === 'object' && args !== null ? { ...(args as Record<string, unknown>) } : {},
    );
  }

  /**
   * Whether another write is the same write: the same name and arguments.
   * @param other - The other value.
   * @returns True when they're the same.
   */
  equals(other: unknown): boolean {
    return other instanceof Write && other.name === this.name && _sameValue(other.args, this.args);
  }

  /** The write, for a test's failure message. */
  toString(): string {
    return `Write(${JSON.stringify(this.name)}, ${JSON.stringify(this.args)})`;
  }
}

/** What to tell the caller once a change's writes went through: one line per write, or one for the whole change. */
export type DoneLines = readonly string[] | string;

/** The options of a {@link Change}. */
export interface ChangeOptions {
  /**
   * The words the platform says, and the caller says yes to. The change itself
   * goes in the first clause: a read-back cut off by the caller's answer is
   * judged on what they heard.
   */
  readBack: string;
  /**
   * Stable keys for everything it acts on, such as `order:#W1234567` or
   * `item:9494281769`. A new request is weighed against the change waiting by these.
   */
  touches?: readonly string[];
  /** The backend writes, in order. */
  writes?: readonly Write[];
  /**
   * The money each write moves: more than 0 charged, less than 0 back to the
   * caller, as a number, a bigint or a numeric string. Kept exactly in the
   * call's record, for totals.
   */
  money?: readonly Amount[] | null;
  /** The ISO 4217 code of that money, such as `"EUR"`; defaults to the service's `currency`. */
  currency?: string | null;
  /** What to tell the caller once each write went through, one per write, or one sentence for the whole change. */
  done?: DoneLines | null;
  /**
   * The kind of another change the caller asked for that has to go first, such
   * as `"address"` for an item change that would leave the order's address
   * unchangeable. This one isn't read back yet: it's set aside, the model is
   * told to call that kind's tool now, and it's offered once a change of that
   * kind is settled.
   */
  after?: string | null;
  /** Why the other change goes first, in a clause. */
  afterWhy?: string;
  /**
   * What the model is told to do once it's made, in place of everything the
   * service would tell it: for a change whose effect comes after the tool's
   * result, such as a payment the platform takes next. Null: the service's words.
   */
  then?: string | null;
}

/**
 * A change `prepare` built, ready to read back.
 *
 * @example
 * ```ts
 * new Change({
 *   readBack: 'Cancel order #W1234567, refunding $54.04 to the card it was paid with. Shall I go ahead?',
 *   touches: ['order:#W1234567'],
 *   writes: [new Write('cancel_pending_order', { order_id: '#W1234567', reason: 'no longer needed' })],
 *   money: [-54.04],
 *   currency: 'USD',
 *   done: ['Order #W1234567 is cancelled; $54.04 goes back to the card.'],
 * });
 * ```
 */
export class Change {
  /** The words the platform says, and the caller says yes to. */
  readBack: string;
  /** Stable keys for everything it acts on. */
  touches: string[];
  /** The backend writes, in order. */
  writes: Write[];
  /** The money each write moves. */
  money: Amount[] | null;
  /** The ISO 4217 code of that money. */
  currency: string | null;
  /** What to tell the caller once each write went through, or null for the default line. */
  done?: DoneLines | null;
  /** The kind of another change that has to go first. */
  after: string | null;
  /** Why the other change goes first. */
  afterWhy: string;
  /** What the model is told to do once it's made, in place of the service's words. */
  then: string | null;

  /**
   * @param opts - The change: `readBack`, and `touches`, `writes`, `money`,
   *   `currency`, `done`, `after`, `afterWhy` and `then`.
   */
  constructor(opts: ChangeOptions) {
    this.readBack = opts.readBack;
    this.touches = [...(opts.touches ?? [])];
    this.writes = [...(opts.writes ?? [])];
    this.money = opts.money ? [...opts.money] : null;
    this.currency = opts.currency ?? null;
    this.done = typeof opts.done === 'string' ? opts.done : opts.done ? [...opts.done] : null;
    this.after = opts.after ?? null;
    this.afterWhy = opts.afterWhy ?? '';
    this.then = opts.then ?? null;
  }

  /**
   * What to say for each write once it went through.
   * @param fallback - The line for a change with no `done` of its own, with
   *   `{statement}` for the read-back without its question (the service's
   *   `done.default` wording).
   * @returns One line per write.
   */
  doneLines(fallback = "It's done: {statement}"): string[] {
    const n = Math.max(this.writes.length, 1);
    if (typeof this.done === 'string') return [...Array<string>(n - 1).fill(''), this.done];
    if (this.done && this.done.length > 0) {
      return [...this.done.map(String), ...Array<string>(n).fill('')].slice(0, n);
    }
    return [
      ...Array<string>(n - 1).fill(''),
      fallback.replaceAll('{statement}', () => _statement(this.readBack)),
    ];
  }

  /**
   * The money each write moves, one exact decimal string per write; a change
   * with no writes moves all of it once it's made.
   * @returns The amounts.
   */
  moneyMoved(): string[] {
    return this._moneyMovedDec().map((m) => m.toString());
  }

  /** @internal The amounts as exact decimals. */
  _moneyMovedDec(): Dec[] {
    const moved = (this.money ?? []).map(decimalOf);
    if (this.writes.length === 0) return moved;
    return [...moved, ...Array<Dec>(this.writes.length).fill(Dec.ZERO)].slice(
      0,
      this.writes.length,
    );
  }
}

/** The type of a {@link Field}'s value. */
export type FieldKind =
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | readonly (string | number)[]
  | Record<string, unknown>;

/** The options of a {@link Field}. */
export interface FieldOptions {
  /** Whether the operation needs it. Default true. */
  required?: boolean;
  /**
   * The question for the caller when it's missing. With it, a required field
   * the model sends empty, null or as "not said" (a choice of values gets that
   * option) is asked for before `prepare` runs, so the model is never pushed to
   * invent it.
   */
  ask?: string | null;
}

/**
 * One thing an operation (or a lookup) takes from the caller.
 *
 * @example
 * ```ts
 * reason = new Field(['no longer needed', 'ordered by mistake'], 'Why, in their words', {
 *   ask: 'Why are they cancelling it?',
 * });
 * ```
 */
export class Field {
  /**
   * The value's type: `'string'`, `'integer'`, `'number'` or `'boolean'` (or
   * `String`, `Number`, `Boolean`), a list of the values it can take, or a
   * JSON schema object for anything else (a list, an object).
   */
  readonly kind: FieldKind;
  /** What it is, in the caller's terms. The model reads it. */
  readonly description: string;
  /** Whether the operation needs it. */
  readonly required: boolean;
  /** The question for the caller when it's missing. */
  readonly ask: string | null;

  /**
   * @param kind - The value's type.
   * @param description - What it is, in the caller's terms.
   * @param opts - `required` (default true) and `ask`.
   */
  constructor(kind: FieldKind, description: string, opts: FieldOptions = {}) {
    this.kind = kind;
    this.description = description;
    this.required = opts.required ?? true;
    this.ask = opts.ask ?? null;
    Object.freeze(this);
  }

  /**
   * The field's JSON schema, with its description.
   * @returns The schema.
   * @throws {TypeError} For a kind it can't make a schema of.
   */
  schema(): Record<string, unknown> {
    return { ..._schemaOf(this.kind), description: this.description };
  }
}

/**
 * An operation's fields as the model gave them: `values.order_id`.
 *
 * A field that wasn't given (or came as null or "not said") is `null`.
 * `values.args` holds the arguments as they came.
 */
export class Values {
  /** The arguments as they came. */
  readonly args: Record<string, unknown>;
  /** Each field's value, by its name. */
  [field: string]: unknown;

  /**
   * @param fields - The operation's fields, by name.
   * @param args - The arguments the model gave.
   */
  constructor(fields: Record<string, Field>, args: Record<string, unknown>) {
    this.args = { ...args };
    for (const name of Object.keys(fields)) {
      if (name === 'args' || name === 'get') continue;
      Object.defineProperty(this, name, {
        enumerable: true,
        get: () => {
          const value = this.args[name];
          return _isMissing(value) ? null : value;
        },
      });
    }
  }

  /**
   * A field's value, or `fallback` when it wasn't given.
   * @param name - The field.
   * @param fallback - The value when it wasn't given. Default null.
   * @returns The value.
   */
  get(name: string, fallback: unknown = null): unknown {
    const value = this.args[name];
    return _isMissing(value) ? fallback : value;
  }
}

/** The class side of an {@link Operation}: its settings, as static fields. */
export interface OperationClass {
  new (): Operation;
  /** Its name in the call's record and in `confirm_change`: the class name in lower case unless set. */
  kind: string;
  /** The tool's name. */
  tool: string;
  /** What it does, as the model reads it (the reference's docstring). */
  description: string;
  combine: readonly string[] | null;
  goesBefore: readonly string[];
  guidance: string | null;
  fillers: readonly string[] | Readonly<Record<string, readonly string[]>>;
  confirm: boolean;
  beforeIdentity: boolean;
  askInOrder: boolean;
  offeredIn: readonly string[] | null;
  secure: boolean;
  describe(): string;
}

/**
 * Something the agent can change for a caller.
 *
 * Extend it, declare its {@link Field} properties (their names are the tool's
 * argument names), say what it does in `static description`, and write
 * `prepare`. Register it with `ServiceAgent.operation`.
 *
 * @example
 * ```ts
 * class Cancel extends Operation {
 *   static override description = 'Cancel pending orders.';
 *   order_ids = new Field({ type: 'array', items: { type: 'string' } }, 'The orders to cancel');
 *
 *   override prepare(call: CallContext, f: Values) {
 *     return new Change({ readBack: '...', touches: [] });
 *   }
 * }
 * agent.operation(Cancel, { tool: 'cancel_order' });
 * ```
 */
export class Operation {
  /** Its name in the call's record and in `confirm_change`: the class name in lower case unless set. */
  static kind = '';
  /** The tool's name. Use the verb a caller would use. */
  static tool = '';
  /** What it does, as the model reads it: the first paragraph is used. */
  static description = '';
  /**
   * When a request of this operation made "as well" merges into one of the same
   * operation waiting for its yes: the fields that must be the same in both
   * (such as where a refund goes). Null: they are never merged.
   */
  static combine: readonly string[] | null = null;
  /** Kinds of change that must wait for this one when both are for the same things. */
  static goesBefore: readonly string[] = [];
  /** Instructions for a step of its own, entered when its `prepare` throws `Need`. Null: no step of its own. */
  static guidance: string | null = null;
  /** Short phrases said while its tool runs: a list, for every language, or lists by language code. */
  static fillers: readonly string[] | Readonly<Record<string, readonly string[]>> = [];
  /** False for a change that goes through without a read-back and a yes, such as a move in a game. */
  static confirm = true;
  /** True for an operation a caller can use before they're identified, such as booking for a new customer. */
  static beforeIdentity = false;
  /** True to ask for one missing field at a time, in declaration order. */
  static askInOrder = false;
  /** The steps that offer its tool, by name; null for every step. */
  static offeredIn: readonly string[] | null = null;
  /** Whether its tool takes the agent's per-call security token. */
  static secure = true;

  /**
   * The operation's fields, in declaration order.
   * @returns The fields, by name.
   */
  fields(): Record<string, Field> {
    const found: Record<string, Field> = {};
    for (const [name, value] of Object.entries(this)) {
      if (value instanceof Field) found[name] = value;
    }
    return found;
  }

  /**
   * Check the request and build its change. Returns a {@link Change}, or
   * throws {@link Need} or {@link Refuse}. It may look things up, and may be
   * async, but never writes.
   * @param _call - The call.
   * @param _values - The fields as the model gave them.
   * @returns The change.
   */
  prepare(_call: unknown, _values: Values): unknown {
    throw new Error(`${this.constructor.name}.prepare isn't written`);
  }

  /**
   * Carry out one write; throw {@link WriteFailed} if the backend refuses it.
   * Defaults to the service's writer (`Operations.writesWith`). May be async.
   * @param call - The call.
   * @param write - The write.
   * @returns What the write gave.
   */
  apply(call: unknown, write: Write): unknown {
    const service = (call as { service: { applyWrite(c: unknown, w: Write): unknown } }).service;
    return service.applyWrite(call, write);
  }

  /**
   * Why this change and another can't both happen, or null.
   * @param _other - The other change's kind.
   * @param _mine - This change.
   * @param _theirs - The other change.
   * @returns The reason, or null.
   */
  conflictsWith(_other: string, _mine: Change, _theirs: Change): string | null {
    return null;
  }

  /**
   * This operation's arguments with what `gone` names taken out, when another
   * change takes those things over; null if it can't be split, and the whole
   * change is replaced.
   * @param _args - The arguments the change waiting was built from.
   * @param _gone - The `touches` keys the new change takes over.
   * @returns The arguments left, or null.
   */
  without(
    _args: Record<string, unknown>,
    _gone: ReadonlySet<string>,
  ): Record<string, unknown> | null {
    return null;
  }

  /**
   * One request from the change waiting (`held`) and a request made as well
   * (`added`). Lists are joined, and an item asked for again goes as asked now
   * ({@link sameItem}); other fields take the new value.
   * @param held - The waiting change's arguments.
   * @param added - The new request's arguments.
   * @returns The merged arguments.
   */
  merge(held: Record<string, unknown>, added: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...held };
    for (const [k, v] of Object.entries(added)) if (!_isMissing(v)) out[k] = v;
    for (const name of Object.keys(this.fields())) {
      const old = held[name];
      const now = added[name];
      if (Array.isArray(old) && Array.isArray(now)) {
        out[name] = [...old.filter((o) => !now.some((n) => this.sameItem(name, o, n))), ...now];
      }
    }
    return out;
  }

  /**
   * Whether two entries of a list field are the same thing asked for twice.
   * @param _field - The field.
   * @param a - One entry.
   * @param b - The other.
   * @returns True when they're the same.
   */
  sameItem(_field: string, a: unknown, b: unknown): boolean {
    return _sameValue(a, b);
  }

  /**
   * What it does, as the model reads it: the first paragraph of its `description`.
   * @returns The description.
   */
  static describe(): string {
    const doc = (this.description ?? '').trim();
    return doc
      ? doc
          .split(/\n\s*\n/)[0]!
          .replace(/\n/g, ' ')
          .trim()
      : '';
  }
}

/** @internal Whether a value counts as not given: null, empty, or "not said". */
export function _isMissing(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (typeof value === 'string' && value.trim().toLowerCase() === NOT_SAID)
  );
}

/** @internal A read-back without its closing question: "Cancel X. Shall I?" is "Cancel X.". */
export function _statement(readBack: string): string {
  const sentences = readBack.trim().split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => !s.endsWith('?'));
  return kept.length > 0 ? kept.join(' ') : readBack.trim();
}

/** @internal Deep equality of JSON values, as Python's `==` compares them. */
export function _sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => _sameValue(v, b[i]));
  }
  if (
    a &&
    b &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every(
        (k) =>
          Object.hasOwn(b, k) &&
          _sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return false;
}

const SIMPLE: Record<string, Record<string, unknown>> = {
  string: { type: 'string' },
  boolean: { type: 'boolean' },
  integer: { type: 'integer' },
  number: { type: 'number' },
};

/** @internal The JSON schema of a Field's kind. */
export function _schemaOf(kind: FieldKind): Record<string, unknown> {
  if (kind === String) return { ...SIMPLE['string'] };
  if (kind === Number) return { ...SIMPLE['number'] };
  if (kind === Boolean) return { ...SIMPLE['boolean'] };
  if (typeof kind === 'string' && Object.hasOwn(SIMPLE, kind)) return { ...SIMPLE[kind] };
  if (Array.isArray(kind)) return { type: 'string', enum: kind.map(String) };
  if (typeof kind === 'object' && kind !== null && !Array.isArray(kind)) {
    return { ...(kind as Record<string, unknown>) };
  }
  throw new TypeError(
    `a Field's kind must be a simple type, a list of choices or a JSON schema, got ${String(kind)}`,
  );
}
