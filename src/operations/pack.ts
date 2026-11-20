/**
 * What the task packs share: the `Operations` a pack is added to, and the
 * `Operation` classes a pack makes.
 * @internal
 */

import { Operations } from './agent.js';
import { type Change, type Field, Operation, type OperationClass, type Write } from './model.js';

/** @internal The `Operations` a pack is added to: the one given, or a `ServiceAgent`'s. */
export function _operationsOf(target: unknown): Operations {
  const ops =
    !(target instanceof Operations) &&
    typeof target === 'object' &&
    target !== null &&
    'ops' in target
      ? (target as { ops: unknown }).ops
      : target;
  if (!(ops instanceof Operations)) {
    const kind =
      typeof target === 'object' && target !== null ? target.constructor.name : typeof target;
    throw new TypeError(`addTo takes an Operations or a ServiceAgent, not ${kind}`);
  }
  return ops;
}

/** @internal What a pack's operation is made of. */
export interface PackOperation {
  name: string;
  description: string;
  fields?: Readonly<Record<string, Field>>;
  prepare: (call: never, values: never) => unknown;
  apply?: (call: never, write: Write) => unknown;
  beforeIdentity?: boolean;
  confirm?: boolean;
  /** Why it and one of `rivals` (other kinds) can't both happen, for the same things. */
  conflict?: string | null;
  rivals?: readonly string[];
  /** The kind it's registered as, which a rival of the same kind isn't. */
  kind?: string;
}

/** @internal An `Operation` class made for a pack: its fields, description, `prepare` and `apply`. */
export function _packOperation(spec: PackOperation): OperationClass {
  const fields = { ...(spec.fields ?? {}) };
  const prepare = spec.prepare as (call: unknown, values: unknown) => unknown;
  const apply = spec.apply as ((call: unknown, write: Write) => unknown) | undefined;
  const cls = class extends Operation {
    static override description = spec.description;
    static override beforeIdentity = spec.beforeIdentity ?? false;
    static override confirm = spec.confirm ?? true;
    constructor() {
      super();
      Object.assign(this, fields);
    }
    override prepare(call: unknown, values: never): unknown {
      return prepare(call, values);
    }
  };
  if (apply !== undefined) {
    cls.prototype.apply = function (call: unknown, write: Write): unknown {
      return apply(call, write);
    };
  }
  const conflict = spec.conflict;
  if (conflict !== undefined && conflict !== null) {
    const rivals = spec.rivals ?? [];
    cls.prototype.conflictsWith = function (other: string, _mine: Change, _theirs: Change) {
      // A move and a cancel of the same appointment: both take it, and they can't both happen
      return rivals.includes(other) && other !== spec.kind ? conflict : null;
    };
  }
  Object.defineProperty(cls, 'name', { value: spec.name });
  return cls as unknown as OperationClass;
}
