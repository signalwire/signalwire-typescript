/**
 * `ServiceAgent`: an agent written as what it can do. The developer registers
 * operations, lookups and how the caller is identified; the agent generates the
 * tools, the steps and the call's record, and runs every change through one
 * lifecycle: prepared, read back, agreed to, written, recorded.
 */

import { AgentBase } from '../AgentBase.js';
import type { ContextBuilder, Context, Step } from '../ContextBuilder.js';
import { FunctionResult } from '../FunctionResult.js';
import { getLogger } from '../Logger.js';
import { Proposal, current } from '../patterns/Proposal.js';
import { SemanticGate, type FillerPhrases } from '../SemanticGate.js';
import type { AgentOptions } from '../types.js';
import {
  NOT_SAID,
  Change,
  Need,
  Operation,
  Refuse,
  Values,
  Write,
  WriteFailed,
  _isMissing as isMissing,
  _sameValue as sameValue,
  Field,
  type OperationClass,
} from './model.js';
import { _Dec as Dec } from './decimal.js';
import { checkCurrency, formatMoney } from './money.js';
import {
  RECORD,
  _inAll as inAll,
  _nextUp as nextUp,
  _nowLine as nowLine,
  _opening as opening,
  _openingData as openingData,
  _queuedEntry as queuedEntry,
  _recordOf as recordOf,
  _settle as settle,
  _update as recordUpdate,
  _waitingEntry as waitingEntry,
  _whole as whole,
  type MoneyFormat,
  type RecordData,
} from './record.js';
import { DEFAULT_WORDING, _Wording as Wording } from './wording.js';

const log = getLogger('operations');

const CONFIRM_TOOL = 'confirm_change';
const DECLINE_TOOL = 'decline_change';
const TRANSFER_TOOL = 'transfer_to_human';
const IDENTIFY_TOOL = 'find_account';
const IDENTIFY_STEP = 'identify';
const MAIN_STEP = 'main';
const CONFIRM_STEP = 'confirm';
const TRANSFERRED = 'transferred';
const NAMESPACE = /^[a-z][a-z0-9_]*$/;

/** A tool handler the service generates: `(args, rawData)` to its result. */
export type OperationsHandler = (
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
) => Promise<FunctionResult>;

/** Short phrases said while a tool runs: a list, for every language, or lists by language code. */
export type Fillers = readonly string[] | Readonly<Record<string, readonly string[]>>;

/**
 * The names an `Operations` generates: its tools, steps, the context a
 * transfer moves to, and its record's `global_data` key. With a namespace,
 * each carries it, so a second `Operations` (or the agent's own tools and
 * steps) can sit beside it on one agent.
 */
class Names {
  readonly namespace: string | null;
  readonly context: string;
  readonly record: string;
  readonly confirm: string;
  readonly decline: string;
  readonly transfer: string;
  readonly identify: string;
  readonly transferred: string;
  private readonly prefix: string;

  constructor(namespace: string | null, context: string) {
    if (namespace !== null && !NAMESPACE.test(namespace)) {
      throw new Error(
        `namespace '${namespace}' must be lower case letters, digits and underscores, starting with a letter`,
      );
    }
    const p = namespace ? `${namespace}_` : '';
    this.namespace = namespace;
    this.context = context;
    this.prefix = p;
    this.record = namespace || RECORD;
    this.confirm = namespace ? `confirm_${namespace}_change` : CONFIRM_TOOL;
    this.decline = namespace ? `decline_${namespace}_change` : DECLINE_TOOL;
    this.transfer = p + TRANSFER_TOOL;
    this.identify = p + IDENTIFY_TOOL;
    this.transferred = p + TRANSFERRED;
  }

  /** A generated step's name (`identify`, `main`, `confirm`, an operation's kind). */
  step(name: string): string {
    return this.prefix + name;
  }
}

/**
 * The rules every operations agent's prompt carries, by key, unless replaced.
 * `confirm` is left out of a service with no operations; with a `medium`,
 * `reply` starts with it ("This is a phone call.").
 */
export const DEFAULT_RULES: Readonly<Record<string, string>> = Object.freeze({
  reply: 'Keep each reply short, but give every fact the caller asks for.',
  facts: 'State only facts that came from a tool result. Never guess records, prices or policies.',
  confirm:
    'Nothing changes until the caller says yes to a change read back to them and it is confirmed.',
});

/** The mediums a service can be given or find on a request: a call, or a chat. */
export const MEDIUMS: readonly string[] = Object.freeze(['voice', 'chat']);

/**
 * A refusal the service makes in whole words: the operation handler's
 * "Nothing is changed: " doesn't go before it.
 * @internal Also thrown by the task packs.
 */
export class _Said extends Refuse {
  constructor(why: string, then: string | null = null, opts: { keep?: boolean } = {}) {
    super(why, then, opts);
    this.name = 'Said';
  }
}

/**
 * One request of a call, as an operation, lookup or identify function sees it.
 *
 * `call.data` is the call's record (`global_data.ops`, or the `Operations`'
 * namespace) as it came with the request; `call.accountId` is the account
 * identified, and `call.account` what the agent's `load` function made of it.
 * `call.state` is the developer's own state for the call (a game's hand, the
 * results a caller may pick from), kept in `global_data` between requests.
 */
export class CallContext {
  /** The service the request is for. */
  readonly service: Operations;
  /** The request as the platform sent it. */
  readonly rawData: Record<string, unknown>;
  /** The call's record as it came with the request. */
  data: RecordData;
  /** The account as the agent's `load` function made it, once identified. */
  account: unknown = null;
  /** While a write runs: a key unique to it in this call, for idempotent backends. */
  writeKey = '';
  /** The developer's own state for the call, kept between requests. */
  state: Record<string, unknown>;
  /** @internal The state as the request brought it. */
  readonly _stateWas: Record<string, unknown>;
  /** @internal Screen events for the result. */
  readonly _events: Record<string, unknown>[] = [];
  /** @internal Platform actions for the result. */
  readonly _acts: Record<string, unknown>[] = [];
  /** @internal The step to move to. */
  _nextStep: string | null = null;

  /**
   * @param service - The service the request is for.
   * @param rawData - The request as the platform sent it.
   */
  constructor(service: Operations, rawData: Record<string, unknown> | null | undefined) {
    this.service = service;
    this.rawData = isRecord(rawData) ? { ...rawData } : {};
    this.data = recordOf(rawData, service._names.record);
    const kept = this.data['state'];
    this.state = isRecord(kept) ? (structuredClone(kept) as Record<string, unknown>) : {};
    this._stateWas = structuredClone(this.state);
  }

  /**
   * Add a platform action (or several) to this tool's result, after everything
   * else it does: hang up, start recording, play hold music, hand the call on.
   * The result's actions are taken; its text is not.
   * @param result - A FunctionResult with the actions.
   * @returns This call.
   */
  act(result: FunctionResult): this {
    this._acts.push(...result.action);
    return this;
  }

  /**
   * Send an event to the caller's screen (a SWML user event) with this tool's
   * result, such as the order so far or the cards dealt.
   * @param event - The event.
   * @returns This call.
   */
  show(event: Record<string, unknown>): this {
    this._events.push({ ...event });
    return this;
  }

  /**
   * Move to a step (a phase declared with `Operations.phase`, or `main`, which
   * is the namespaced name when there's a namespace) when this tool's result
   * goes back. Honoured from lookups, changes with no read-back, `apply` and
   * identify; a change read back always waits in the confirm step.
   * @param step - The step.
   * @returns This call.
   */
  go(step: string): this {
    this._nextStep = step;
    return this;
  }

  /** The identified account's id, or `""`. */
  get accountId(): string {
    return String(this.data['account_id'] || '');
  }

  /** The platform's id for the call. */
  get callId(): string {
    return String(this.rawData['call_id'] || '');
  }

  /**
   * `"voice"` or `"chat"`: the service's `medium`, or the one found on the
   * call's first request; `""` when neither says.
   */
  get medium(): string {
    return String(this.data['medium'] || this.service._medium || '');
  }
}

/** A writer: `writer(call, write)` carries out one write, or throws `WriteFailed`. May be async. */
export type WriteFunction = (call: CallContext, write: Write) => unknown;

/** A lookup's function: it reads and answers, and changes nothing. */
export type LookupFunction = (
  call: CallContext,
  args: Record<string, unknown>,
) => unknown | Promise<unknown>;

/** Options for {@link Operations.lookup}. */
export interface LookupOptions {
  /** The tool's name; defaults to the function's name. */
  tool?: string;
  /** Its arguments, by name. Default: none. */
  fields?: Readonly<Record<string, Field>>;
  /** True to offer it before the caller is identified. Account data never should be. */
  beforeIdentity?: boolean;
  /** Short phrases said while it runs. */
  fillers?: Fillers;
  /** Whether its tool takes the per-call security token. Default true. */
  secure?: boolean;
}

interface Lookup {
  fn: LookupFunction;
  tool: string;
  description: string;
  fields: Record<string, Field>;
  beforeIdentity: boolean;
  fillers: Fillers;
  secure: boolean;
}

/** `find(call, keys)`: the account's id for the keys, or null; may throw `Refuse` or `Need`. May be async. */
export type FindFunction = (call: CallContext, keys: Record<string, unknown>) => unknown;
/** `load(call, accountId)`: the account as operations use it (`call.account`). May be async. */
export type LoadFunction = (call: CallContext, accountId: string) => unknown;
/** `describe(call)`: the account in a few words for the steps. May be async. */
export type DescribeFunction = (call: CallContext) => unknown;
/** `prefill(requestData, request)`: keys already known when the call starts, or null. May be async. */
export type PrefillFunction = (requestData: Record<string, unknown>, request: unknown) => unknown;

/** Options for {@link Operations.identify}. */
export interface IdentifyOptions {
  /**
   * Key sets, any one of which finds an account, such as
   * `[['email'], ['first_name', 'last_name', 'zip']]`.
   */
  anyOf: readonly (readonly string[])[];
  /**
   * `find(call, keys)` returns the account's id (null when no account has it),
   * or throws `Refuse` or `Need`. May be async.
   */
  find: FindFunction;
  /** `load(call, accountId)` returns the account as operations use it (`call.account`); defaults to the id itself. */
  load?: LoadFunction | null;
  /** `describe(call)` returns the account in a few words for the steps, read again after every change. */
  describe?: DescribeFunction | null;
  /** Descriptions of the keys (each defaults to a string), and any other arguments `find` takes. */
  fields?: Readonly<Record<string, Field>>;
  /** The identify tool's name; defaults to `find_account` (namespaced). */
  tool?: string | null;
  /** How to ask for the keys, such as "their email address, or their first name, last name and zip code". */
  ask?: string | null;
  /** Short phrases said while it runs. */
  fillers?: Fillers;
  /** False to call `find` without a whole key set, when it recovers from partial or misheard keys itself. */
  checkKeys?: boolean;
  /**
   * False for an agent that's useful to callers who aren't identified: there's
   * no identify step, and the identify tool is offered with the rest.
   */
  required?: boolean;
  /**
   * `prefill(requestData, request)` returns keys already known when the call
   * starts (caller ID, a chat widget, the page), or null. With them, `find`
   * runs before the call does, silently, and the call starts identified.
   * Implies `required: false`.
   */
  prefill?: PrefillFunction | null;
}

class Identity {
  readonly anyOf: string[][];
  readonly find: IdentifyOptions['find'];
  readonly load: NonNullable<IdentifyOptions['load']> | null;
  readonly describe: NonNullable<IdentifyOptions['describe']> | null;
  readonly fields: Record<string, Field>;
  readonly tool: string;
  readonly fillers: Fillers;
  readonly checkKeys: boolean;
  readonly required: boolean;
  readonly prefill: NonNullable<IdentifyOptions['prefill']> | null;
  readonly ask: string;

  constructor(opts: IdentifyOptions, tool: string, w: Wording) {
    this.required = opts.required ?? true;
    this.prefill = opts.prefill ?? null;
    this.anyOf = opts.anyOf.map((s) => [...s]);
    this.find = opts.find;
    this.load = opts.load ?? null;
    this.describe = opts.describe ?? null;
    const given = opts.fields ?? {};
    const keys = [...new Set(this.anyOf.flat())];
    this.fields = {};
    for (const k of keys) {
      this.fields[k] =
        given[k] ??
        new Field('string', w.say('tool.identify.key', { key: k.replaceAll('_', ' ') }));
    }
    for (const [k, f] of Object.entries(given)) if (!(k in this.fields)) this.fields[k] = f;
    this.tool = tool;
    this.fillers = opts.fillers ?? [];
    this.checkKeys = opts.checkKeys ?? true;
    this.ask =
      opts.ask ||
      this.anyOf
        .map((s) =>
          w.say('identify.keys', { keys: w.joined(s.map((k) => k.replaceAll('_', ' '))) }),
        )
        .join(w.say('identify.or'));
  }
}

/** Options for {@link Operations.transferWith}. */
export interface TransferOptions {
  /** Where callers can go, by name, each with a description, such as `{ sales: 'buying something new' }`. */
  destinations?: Readonly<Record<string, string>> | null;
  /**
   * Whether the tool runs only once the caller has asked for a person or agreed
   * to it. A router, whose callers say where to go, sets it false. Default true.
   */
  gated?: boolean;
  /** The tool's name; defaults to `transfer_to_human` (namespaced). */
  tool?: string | null;
  /** What the platform says as the transfer starts; defaults to the `transfer.notice` wording. */
  notice?: string | null;
}

/**
 * A transfer function: hands the call over by returning the platform action
 * to do it (a FunctionResult with a connect or a SWML transfer) or doing it
 * itself, or throws `Refuse`. With destinations it gets the one chosen.
 */
export type TransferFunction = (call: CallContext, summary: string, to?: string) => unknown;

class Transfer {
  readonly destinations: Record<string, string>;

  constructor(
    readonly fn: TransferFunction,
    readonly tool: string,
    destinations: Readonly<Record<string, string>> | null | undefined,
    readonly gated: boolean,
    readonly notice: string | null,
    private readonly w: Wording,
  ) {
    this.destinations = { ...(destinations ?? {}) };
  }

  hasDestinations(): boolean {
    return Object.keys(this.destinations).length > 0;
  }

  mention(): string {
    if (this.hasDestinations()) {
      return this.w.say('step.transfer.destinations', {
        destinations: this.w.joined(Object.keys(this.destinations)),
        tool: this.tool,
      });
    }
    return this.w.say('step.transfer', { tool: this.tool });
  }

  description(): string {
    return this.w.say(this.hasDestinations() ? 'tool.transfer.destinations' : 'tool.transfer');
  }
}

/** An operation as it's registered: the instance, its class, and the names it was given. */
interface Registered {
  impl: Operation;
  cls: OperationClass;
  kind: string;
  tool: string;
  guidance: string | null;
}

/** Options for {@link Operations.operation}. */
export interface OperationOptions {
  /** The tool's name; defaults to the class's `tool`, else its name in snake case. */
  tool?: string | null;
  /** Its name in the record; defaults to the class's `kind`, else its name in lower case. */
  kind?: string | null;
  /** Instructions for a step of its own (see `Operation.guidance`). */
  guidance?: string | null;
}

/** Options for {@link Operations.offer}. */
export interface OfferOptions {
  /** True to offer them in the identify step too, before the caller is found. */
  beforeIdentity?: boolean;
  /**
   * The steps that offer them, by name, in place of the default: every
   * generated step but `identify` and `confirm`, where a change waits for the
   * caller's yes.
   */
  steps?: readonly string[] | null;
}

/** Options for an {@link Operations}. */
export interface OperationsOptions {
  /** Who the agent is and how it sounds, the prompt's Role section. */
  role: string;
  /**
   * The prompt's Rules section. An object changes {@link DEFAULT_RULES} by
   * key: a new key adds a rule after them, a key of theirs replaces that rule,
   * and null removes it. A list replaces them all.
   */
  rules?: readonly string[] | Readonly<Record<string, string | null>> | null;
  /**
   * Words to use in place of the generated ones, by key: the steps' text
   * (`step.main`), the tools' descriptions, tool results and prompts, the
   * gates, the transfer notice (`transfer.notice`) and the record's `now`
   * line. The keys and their defaults are in `DEFAULT_WORDING`; a `{name}` in
   * one is filled in, and an override may leave those out but not add others.
   */
  wording?: Readonly<Record<string, string>> | null;
  /** Gates for `confirm_change` in place of the one `confirmGates()` builds. */
  confirmGates?: readonly SemanticGate[] | null;
  /** Fillers for the generated tools by name (`confirm_change`, `decline_change`, `transfer_to_human`, the identify tool). */
  toolFillers?: Readonly<Record<string, Record<string, string[]>>> | null;
  /** Fillers said while a generated tool's gates run. */
  gateFillers?: FillerPhrases | null;
  /** `wrap(name, handler)` returns the handler to register for each generated tool, for middleware of your own. */
  wrap?: ((name: string, handler: OperationsHandler) => OperationsHandler) | null;
  /** `customize(contexts)` gets the generated ContextBuilder once the steps are made, to change them. */
  customize?: ((contexts: ContextBuilder) => void) | null;
  /**
   * A name for this service, in lower case, such as `"billing"`, carried by
   * everything it generates: the tools (`confirm_billing_change`,
   * `decline_billing_change`, `billing_transfer_to_human`,
   * `billing_find_account`), the steps (`billing_main`), the context a
   * transfer moves to (`billing_transferred`) and the record's `global_data`
   * key (`billing`). Null: the names have no prefix, and the record is
   * `global_data.ops`.
   */
  namespace?: string | null;
  /** The context its steps go in. Default `"default"`. */
  context?: string;
  /**
   * The ISO 4217 code of the money changes move, such as `"EUR"`, for those
   * that don't give their own (`Change.currency`). Null: amounts are stated
   * without one.
   */
  currency?: string | null;
  /**
   * `moneyFormat(amount, currency)` writes an amount (an exact decimal string,
   * never below 0) in the totals the service states, in place of `formatMoney`.
   */
  moneyFormat?: MoneyFormat | null;
  /**
   * `"voice"` or `"chat"` for a service that only takes calls, or only chats:
   * the `reply` rule starts with it. Null: each call's medium is found on its
   * first request, from the platform's `conversation_type` (`prefilled`, which
   * `ServiceAgent` applies), and the record's `now` line starts with it.
   */
  medium?: string | null;
}

/** The keys of {@link OperationsOptions} other than `role`. */
const OPERATIONS_ARGS = [
  'rules',
  'wording',
  'confirmGates',
  'toolFillers',
  'gateFillers',
  'wrap',
  'customize',
  'namespace',
  'context',
  'currency',
  'moneyFormat',
  'medium',
] as const;

/**
 * What an agent can do for a caller, and the lifecycle every change goes
 * through, installable on any agent (`install`). `ServiceAgent` is the prefab
 * that owns one.
 *
 * @example
 * ```ts
 * const ops = new Operations({ role: 'You answer the phone for an online store.' });
 * ops.identify({ anyOf: [['email'], ['first_name', 'last_name', 'zip']], find: findAccount });
 *
 * class Cancel extends Operation {
 *   static override description = 'Cancel pending orders.';
 *   order_ids = new Field({ type: 'array', items: { type: 'string' } }, 'The orders to cancel');
 *   override prepare(call: CallContext, f: Values) { ... }
 * }
 * ops.operation(Cancel, { tool: 'cancel_order' });
 * ops.install(agent);
 * ```
 *
 * `install` gives the agent its prompt, tools, steps (identify, main, confirm,
 * a step for each operation with `guidance` and each phase) and the call's
 * record in `global_data`, whose `now` the conscience shows on every request.
 */
export class Operations {
  /** The read-back proposal the confirm tool's gates check. */
  readonly proposal: Proposal;
  /** @internal */
  readonly _medium: string | null;
  /** @internal */
  readonly _names: Names;
  /** @internal */
  readonly _w: Wording;
  /** @internal */
  readonly _currency: string | null;
  /** @internal */
  readonly _moneyFormat: MoneyFormat;
  /** @internal */
  readonly _operations = new Map<string, Registered>();
  /** @internal What a task pack needs of the agent it's installed on. */
  readonly _installHooks: ((agent: AgentBase) => void)[] = [];
  private readonly role: string;
  private readonly confirmGateList: SemanticGate[] | null;
  private readonly toolFillers: Record<string, Record<string, string[]>>;
  private readonly gateFillers: FillerPhrases | null;
  private readonly wrap: OperationsOptions['wrap'];
  private readonly customize: OperationsOptions['customize'];
  private readonly rules: string[] | Record<string, string | null> | null;
  private readonly lookups: Lookup[] = [];
  private identity: Identity | null = null;
  private writer: WriteFunction | null = null;
  private transfer: Transfer | null = null;
  private readonly offers: [string[], boolean, string[] | null][] = [];
  private readonly phases: [string, string, string[] | null, boolean][] = [];

  /**
   * @param opts - `role`, and `rules`, `wording`, `confirmGates`,
   *   `toolFillers`, `gateFillers`, `wrap`, `customize`, `namespace`,
   *   `context`, `currency`, `moneyFormat` and `medium`.
   * @throws {Error} For a medium it doesn't know, a namespace that isn't one,
   *   a currency that isn't an ISO 4217 code, or wording it can't use.
   */
  constructor(opts: OperationsOptions) {
    const medium = opts.medium ?? null;
    if (medium !== null && !MEDIUMS.includes(medium)) {
      throw new Error(
        `medium must be one of ${MEDIUMS.join(', ')}, or null to find it on each request`,
      );
    }
    this._medium = medium;
    this._names = new Names(opts.namespace ?? null, opts.context ?? 'default');
    this._w = new Wording(DEFAULT_WORDING, opts.wording, 'Operations');
    this._currency = checkCurrency(opts.currency);
    this._moneyFormat = opts.moneyFormat ?? formatMoney;
    this.role = opts.role;
    this.confirmGateList = opts.confirmGates ? [...opts.confirmGates] : null;
    this.toolFillers = { ...(opts.toolFillers ?? {}) };
    this.gateFillers =
      opts.gateFillers && Object.keys(opts.gateFillers).length > 0 ? { ...opts.gateFillers } : null;
    this.wrap = opts.wrap ?? null;
    this.customize = opts.customize ?? null;
    const rules = opts.rules;
    this.rules =
      rules === undefined || rules === null
        ? null
        : Array.isArray(rules)
          ? [...(rules as readonly string[])]
          : { ...(rules as Record<string, string | null>) };
    this.proposal = new Proposal(this._names.confirm, { declineTool: this._names.decline });
  }

  // ── registration ─────────────────────────────────────────────────

  /**
   * Register an operation class.
   * @param cls - The `Operation` subclass.
   * @param opts - `tool`, `kind` and `guidance`.
   * @returns The class.
   * @throws {TypeError} For a class that isn't an Operation's.
   * @throws {Error} For a kind registered already, or a class with no description.
   */
  operation(cls: typeof Operation, opts: OperationOptions = {}): typeof Operation {
    if (typeof cls !== 'function' || !(cls.prototype instanceof Operation || cls === Operation)) {
      throw new TypeError('operation() registers an Operation subclass');
    }
    const impl = new cls();
    const kind = opts.kind || cls.kind || cls.name.toLowerCase();
    const tool = opts.tool || cls.tool || snake(cls.name);
    const guidance =
      opts.guidance !== undefined && opts.guidance !== null ? opts.guidance : cls.guidance;
    if (this._operations.has(kind)) {
      throw new Error(`an operation of kind '${kind}' is already registered`);
    }
    if (!cls.describe()) {
      throw new Error(`${cls.name} needs a description: it is what the model reads about it`);
    }
    this._operations.set(kind, { impl, cls, kind, tool, guidance: guidance ?? null });
    return cls;
  }

  /**
   * Register a lookup: a tool that reads and answers, and changes nothing.
   *
   * The function is called as `fn(call, args)`, with each field's value (null
   * when it wasn't given), and returns what to tell the model (a string or a
   * FunctionResult), or throws `Refuse`. It may be async.
   *
   * @param description - What it reads, as the model reads it.
   * @param opts - `tool`, `fields`, `beforeIdentity`, `fillers` and `secure`.
   * @returns A function that registers the lookup function and returns it.
   */
  lookup<F extends LookupFunction>(description: string, opts: LookupOptions = {}): (fn: F) => F {
    return (fn: F): F => {
      const tool = opts.tool || fn.name;
      if (!tool) throw new Error('a lookup needs a tool name: give it a named function or `tool`');
      this.lookups.push({
        fn,
        tool,
        description,
        fields: { ...(opts.fields ?? {}) },
        beforeIdentity: opts.beforeIdentity ?? false,
        fillers: opts.fillers ?? [],
        secure: opts.secure ?? true,
      });
      return fn;
    };
  }

  /**
   * Identify the caller before account data is shared or changed.
   * @param opts - `anyOf` and `find`, and `load`, `describe`, `fields`,
   *   `tool`, `ask`, `fillers`, `checkKeys`, `required` and `prefill`.
   * @returns This service.
   * @throws {Error} For no key set, or an empty one.
   */
  identify(opts: IdentifyOptions): this {
    if (!opts.anyOf || opts.anyOf.length === 0 || !opts.anyOf.every((s) => s.length > 0)) {
      throw new Error('identify needs at least one non-empty key set');
    }
    this.identity = new Identity(opts, opts.tool || this._names.identify, this._w);
    return this;
  }

  /**
   * Set the function that carries out every operation's writes:
   * `writer(call, write)`, throwing `WriteFailed` when the backend refuses one.
   * An operation's own `apply` takes precedence.
   * @param writer - The function. May be async.
   * @returns This service.
   */
  writesWith(writer: WriteFunction): this {
    this.writer = writer;
    return this;
  }

  /**
   * Offer a transfer: `transfer(call, summary)` (with destinations,
   * `transfer(call, summary, to)`) hands the call over, by returning the
   * platform action to do it or doing it itself, or throws `Refuse`. Adds its
   * tool to every step.
   * @param transfer - The function.
   * @param opts - `destinations`, `gated`, `tool` and `notice`.
   * @returns This service.
   */
  transferWith(transfer: TransferFunction, opts: TransferOptions = {}): this {
    this.transfer = new Transfer(
      transfer,
      opts.tool || this._names.transfer,
      opts.destinations,
      opts.gated ?? true,
      opts.notice ?? null,
      this._w,
    );
    return this;
  }

  /**
   * Offer tools the service didn't make (skills, DataMap tools, MCP tools,
   * another layer's tools, `defineTool`) in its steps. Offers add up.
   * @param tools - The tools' names, as registered on the agent.
   * @param opts - `beforeIdentity` and `steps`.
   * @returns This service.
   */
  offer(tools: readonly string[], opts: OfferOptions = {}): this {
    this.offers.push([
      [...tools],
      opts.beforeIdentity ?? false,
      opts.steps ? [...opts.steps] : null,
    ]);
    return this;
  }

  /**
   * Declare a step of the call's own, such as a game's betting and playing,
   * with the tools it offers. Tools move to it with `call.go(name)`.
   * @param name - The step's name.
   * @param text - What to do in it.
   * @param tools - The tools it offers, by name; defaults to every lookup and
   *   operation, and the transfer.
   * @param opts - `initial`: true to start the call in it.
   * @returns This service.
   * @throws {Error} For a name a step has already.
   */
  phase(
    name: string,
    text: string,
    tools: readonly string[] | null = null,
    opts: { initial?: boolean } = {},
  ): this {
    if (
      [IDENTIFY_STEP, MAIN_STEP, CONFIRM_STEP, TRANSFERRED].includes(name) ||
      this.phases.some((p) => p[0] === name)
    ) {
      throw new Error(`a step named '${name}' already exists`);
    }
    this.phases.push([name, text, tools ? [...tools] : null, opts.initial ?? false]);
    return this;
  }

  /**
   * Carry out one write with the agent's writer (`writesWith`).
   * @param call - The call.
   * @param write - The write.
   * @returns What the writer gave.
   * @throws {WriteFailed} When there's no writer.
   */
  applyWrite(call: CallContext, write: Write): unknown {
    if (this.writer === null)
      throw new WriteFailed(this._w.say('write.no_writer', { write: write.name }));
    return this.writer(call, write);
  }

  // ── generation ───────────────────────────────────────────────────

  /**
   * Give `agent` this service's prompt sections, record, conscience, tools and
   * steps. Call it once per agent (or per request, for an agent configured per
   * request). The agent's own setup, and other layers', before or after, are
   * added to, never replaced.
   * @param agent - The agent.
   * @returns The agent.
   * @throws {Error} When the agent has tools of the names this service makes.
   */
  install(agent: AgentBase): AgentBase {
    const taken = this.toolNames().filter((n) =>
      agent.getRegisteredTools().some((t) => t.name === n),
    );
    if (taken.length > 0) {
      throw new Error(
        `the agent already has tools named ${taken.join(', ')}: give this Operations a namespace ` +
          '(or the tools other names) so they can sit side by side',
      );
    }
    for (const hook of this._installHooks) hook(agent);
    addToSection(agent, 'Role', this.role);
    const rules = this.ruleTexts();
    if (rules.length > 0) addToSection(agent, 'Rules', '', rules);
    if (this.keepsRecord()) {
      agent.updateGlobalData(openingData(this._names.record, this._w));
      const line = `\${global_data.${this._names.record}.now}`;
      const had = String(paramsOf(agent)['conscience'] || '');
      if (!had.includes(line))
        agent.setParam('conscience', had.trim() ? `${had}\n\n${line}` : line);
    }
    this.defineTools(agent);
    this.defineSteps(agent);
    return agent;
  }

  /** @internal The `global_data` update for these changes to the call's record. */
  _update(data: RecordData, changes: RecordData = {}): RecordData {
    return recordUpdate(this._names.record, this._w, data, changes);
  }

  private inAll(history: RecordData[]): string {
    return inAll(history, this._w, this._moneyFormat);
  }

  private ruleTexts(): string[] {
    if (Array.isArray(this.rules)) return [...this.rules];
    const rules: Record<string, string | null> = { ...DEFAULT_RULES, ...(this.rules ?? {}) };
    if (this._operations.size === 0) delete rules['confirm'];
    if (this._medium && rules['reply']) {
      rules['reply'] = `${this._w.say(`medium.${this._medium}`)} ${rules['reply']}`;
    }
    return Object.values(rules).filter((r): r is string => !!r);
  }

  private registered(): Registered[] {
    return [...this._operations.values()];
  }

  private toolNames(): string[] {
    const names = [...this.lookups.map((lk) => lk.tool), ...this.registered().map((op) => op.tool)];
    if (this.identity !== null) names.push(this.identity.tool);
    if (this.registered().some((op) => op.cls.confirm))
      names.push(this._names.confirm, this._names.decline);
    if (this.transfer !== null) names.push(this.transfer.tool);
    return names;
  }

  /**
   * The `global_data` a call starts with, from its first request: the record,
   * with the call's medium when the request shows it (and the service has no
   * `medium` of its own), identified when `identify`'s `prefill` already knows
   * the caller. Null when there's nothing to add to the record `install` gave.
   * `ServiceAgent` applies it on each SWML request; an agent configured per
   * request applies it itself, as global data.
   * @param requestData - The SWML request's body.
   * @param request - The request, for `prefill`.
   * @returns The global data, or null.
   */
  async prefilled(
    requestData: Record<string, unknown> | null | undefined,
    request: unknown = null,
  ): Promise<RecordData | null> {
    if (!this.keepsRecord()) return null;
    const changes: RecordData = {};
    const medium = this._medium ? null : _mediumOfRequest(requestData);
    if (medium) changes['medium'] = medium;
    Object.assign(changes, (await this.prefilledAccount(requestData, request)) ?? {});
    if (Object.keys(changes).length === 0) return null;
    return this._update(opening(this._w), changes);
  }

  private async prefilledAccount(
    requestData: Record<string, unknown> | null | undefined,
    request: unknown,
  ): Promise<RecordData | null> {
    const idn = this.identity;
    if (idn === null || idn.prefill === null) return null;
    let text: string;
    let call: CallContext;
    try {
      const keys = await idn.prefill(requestData ?? {}, request);
      if (!keys || (isRecord(keys) && Object.keys(keys).length === 0)) return null;
      call = new CallContext(this, { global_data: { [this._names.record]: opening(this._w) } });
      const found = await idn.find(call, { ...(keys as Record<string, unknown>) });
      if (found === null || found === undefined || String(found).trim() === '') return null;
      call.data['account_id'] = String(found);
      call.account = idn.load ? await idn.load(call, call.accountId) : call.accountId;
      text = idn.describe ? String(await idn.describe(call)) : '';
    } catch (err) {
      // Unknown: the call starts unidentified, and identify asks
      log.error(`operations: prefill could not identify the caller: ${errorText(err)}`);
      return null;
    }
    return { account_id: call.data['account_id'], account: text };
  }

  /**
   * Whether the call has a record: for its changes, its account, or the medium
   * found on its first request.
   */
  private keepsRecord(): boolean {
    return this._operations.size > 0 || this.identity !== null || this._medium === null;
  }

  /** Whether the call starts in a step of its own that asks who the caller is. */
  private gated(): boolean {
    const idn = this.identity;
    return idn !== null && idn.required && idn.prefill === null;
  }

  private toolsFor(step: string): string[] {
    const idn = this.identity;
    const tools: string[] = [];
    if (step === IDENTIFY_STEP) {
      if (idn !== null) tools.push(idn.tool);
      tools.push(...this.lookups.filter((lk) => lk.beforeIdentity).map((lk) => lk.tool));
      tools.push(
        ...this.registered()
          .filter((op) => op.cls.beforeIdentity && offered(op, step))
          .map((op) => op.tool),
      );
    } else {
      if (idn !== null && !this.gated()) tools.push(idn.tool);
      tools.push(...this.lookups.map((lk) => lk.tool));
      tools.push(
        ...this.registered()
          .filter((op) => offered(op, step) || op.kind === step)
          .map((op) => op.tool),
      );
    }
    for (const [names, beforeIdentity, steps] of this.offers) {
      const isOffered =
        steps !== null
          ? steps.includes(step)
          : step !== CONFIRM_STEP && (step !== IDENTIFY_STEP || beforeIdentity);
      if (isOffered) tools.push(...names);
    }
    if (this.transfer) tools.push(this.transfer.tool);
    return [...new Set(tools)];
  }

  private defineSteps(agent: AgentBase): void {
    const names = this._names;
    const builder = agent.defineContexts();
    const ctx = builder.getContext(names.context) ?? builder.addContext(names.context);
    const w = this._w;
    const transfer = this.transfer ? this.transfer.mention() : '';
    const account = `\${global_data.${names.record}.account}`;
    const where = this.identity ? w.say('step.account', { account }) : '';
    const idn = this.identity;
    const lookups = this.lookups.map((lk) => lk.tool).join(w.say('list.or'));
    const ops = this.registered()
      .map((op) => `${op.tool} (${op.cls.describe().replace(/\.+$/, '')})`)
      .join('; ');
    const unfound =
      idn !== null && !this.gated() ? w.say('step.unfound', { ask: idn.ask, tool: idn.tool }) : '';
    const helpWith =
      (lookups ? w.say('step.lookups', { lookups }) : '') +
      (ops ? w.say('step.operations', { operations: ops }) : '') +
      w.say('step.cannot') +
      unfound +
      transfer;
    if (this.gated() && idn !== null) {
      const earlyLookups = this.lookups.filter((lk) => lk.beforeIdentity).map((lk) => lk.tool);
      const early = earlyLookups.length
        ? w.say('step.identify.early', { lookups: earlyLookups.join(w.say('list.or')) })
        : '';
      this.contribute(
        ctx,
        names.step(IDENTIFY_STEP),
        w.say('step.identify', { ask: idn.ask, tool: idn.tool, early, transfer }),
        this.toolsFor(IDENTIFY_STEP),
      );
    }
    this.contribute(
      ctx,
      names.step(MAIN_STEP),
      w.say('step.main', { account: where, help: helpWith }),
      this.toolsFor(MAIN_STEP),
    );
    if (this.registered().some((op) => op.cls.confirm)) {
      this.contribute(
        ctx,
        names.step(CONFIRM_STEP),
        w.say('step.confirm', {
          account: where,
          confirm: names.confirm,
          decline: names.decline,
          transfer,
        }),
        [names.confirm, names.decline, ...this.toolsFor(CONFIRM_STEP)],
      );
    }
    for (const op of this.registered()) {
      if (op.guidance) {
        this.contribute(
          ctx,
          names.step(op.kind),
          w.say('step.guidance', {
            account: where,
            guidance: op.guidance,
            tool: op.tool,
            help: helpWith,
          }),
          this.toolsFor(op.kind),
        ).setHistory('spoken');
      }
    }
    const known = new Set([
      ...this.toolsFor(MAIN_STEP),
      ...this.toolsFor(IDENTIFY_STEP),
      names.confirm,
      names.decline,
      ...this.offers.flatMap(([n]) => n),
      ...this.registered().map((op) => op.tool),
    ]);
    let first: string | null = null;
    const guided = new Set(
      this.registered()
        .filter((op) => op.guidance)
        .map((op) => names.step(op.kind)),
    );
    for (const [pname, ptext, ptools, initial] of this.phases) {
      if (guided.has(pname)) {
        throw new Error(
          `phase '${pname}' has the name of an operation's own step; name the phase differently`,
        );
      }
      const tools = ptools ?? this.toolsFor(pname);
      const unknown = tools.filter((t) => !known.has(t));
      if (unknown.length > 0) {
        throw new Error(`phase '${pname}' offers tools that don't exist: ${unknown.join(', ')}`);
      }
      this.contribute(ctx, pname, `${where}${ptext}`, tools);
      first = first || (initial ? pname : null);
    }
    // One the agent or another layer chose stands
    if (ctx.getInitialStep() === null) {
      ctx.setInitialStep(this.gated() ? names.step(IDENTIFY_STEP) : first || names.step(MAIN_STEP));
    }
    if (this.transfer) {
      const gone = builder.getContext(names.transferred) ?? builder.addContext(names.transferred);
      this.contribute(gone, names.transferred, w.say('step.transferred'), []);
      gone.setInitialStep(names.transferred);
    }
    if (this.customize) this.customize(builder);
  }

  private contribute(ctx: Context, name: string, text: string, tools: string[]): Step {
    return contribute(ctx, name, text, tools, this._w.say('step.more'));
  }

  private defineTools(agent: AgentBase): void {
    const w = this._w;
    const idn = this.identity;
    if (idn !== null) {
      const params: Record<string, unknown> = {};
      for (const [k, f] of Object.entries(idn.fields)) params[k] = f.schema();
      params['asked_for'] = { type: 'string', description: w.say('tool.identify.asked_for') };
      agent.defineTool({
        name: idn.tool,
        description: w.say('tool.identify', { ask: idn.ask }),
        parameters: params,
        handler: this.wrapped(idn.tool, (a, r) => this.identifyHandler(a, r)),
        required: ['asked_for'],
        vouched: true,
        nullableOptional: true,
        fillers: this.toolFillers[idn.tool] ?? fillersOf(idn.fillers),
      });
    }
    for (const lk of this.lookups) {
      const params: Record<string, unknown> = {};
      for (const [k, f] of Object.entries(lk.fields)) params[k] = f.schema();
      agent.defineTool({
        name: lk.tool,
        description: w.say('tool.lookup', { description: lk.description }),
        parameters: params,
        handler: this.wrapped(lk.tool, this.lookupHandler(lk)),
        required: Object.entries(lk.fields)
          .filter(([, f]) => f.required && !f.ask)
          .map(([k]) => k),
        nullableOptional: true,
        fillers: fillersOf(lk.fillers),
        secure: lk.secure,
      });
    }
    for (const op of this.registered()) {
      const fields = op.impl.fields();
      const params: Record<string, unknown> = {};
      for (const [k, f] of Object.entries(fields)) params[k] = withNotSaid(f);
      if (
        op.cls.confirm &&
        (op.cls.combine !== null || op.impl.conflictsWith !== Operation.prototype.conflictsWith)
      ) {
        params['as_well'] = { type: 'boolean', description: w.say('tool.as_well') };
      }
      agent.defineTool({
        name: op.tool,
        description: w.say(op.cls.confirm ? 'tool.operation.read_back' : 'tool.operation', {
          description: op.cls.describe(),
        }),
        parameters: params,
        handler: this.wrapped(op.tool, this.operationHandler(op)),
        required: Object.entries(fields)
          .filter(([, f]) => f.required)
          .map(([k]) => k),
        // Nothing to vouch for in an operation that takes nothing from the caller
        vouched: Object.keys(fields).length > 0,
        nullableOptional: true,
        fillers: fillersOf(op.cls.fillers),
        secure: op.cls.secure,
      });
    }
    const kinds = this.registered()
      .filter((op) => op.cls.confirm)
      .map((op) => op.kind);
    if (kinds.length > 0) {
      const which = { change: { type: 'string', enum: kinds, description: w.say('tool.change') } };
      agent.defineTool({
        name: this._names.confirm,
        description: w.say('tool.confirm'),
        parameters: which,
        handler: this.wrapped(this._names.confirm, (a, r) => this.confirmHandler(a, r)),
        required: ['change'],
        gates: this.confirmGateList ?? this.confirmGates(),
        ...(this.gateFillers ? { gateFillers: this.gateFillers } : {}),
        fillers: this.toolFillers[this._names.confirm],
      });
      agent.defineTool({
        name: this._names.decline,
        description: w.say('tool.decline'),
        parameters: which,
        handler: this.wrapped(this._names.decline, (a, r) => this.declineHandler(a, r)),
        required: ['change'],
        fillers: this.toolFillers[this._names.decline],
      });
    }
    const tr = this.transfer;
    if (tr !== null) {
      const params: Record<string, unknown> = {
        summary: { type: 'string', description: w.say('tool.transfer.summary') },
      };
      if (tr.hasDestinations()) {
        params['to'] = {
          type: 'string',
          enum: Object.keys(tr.destinations),
          description: w.say('tool.transfer.to', {
            destinations: Object.entries(tr.destinations)
              .map(([k, v]) => `${k}: ${v}`)
              .join('; '),
          }),
        };
      }
      agent.defineTool({
        name: tr.tool,
        description: tr.description(),
        parameters: params,
        handler: this.wrapped(tr.tool, (a, r) => this.transferHandler(a, r)),
        ...(tr.hasDestinations() ? { required: ['to'] } : {}),
        ...(tr.gated ? { gates: [this.transferGate()] } : {}),
        ...(tr.gated && this.gateFillers ? { gateFillers: this.gateFillers } : {}),
        fillers: this.toolFillers[tr.tool],
      });
    }
  }

  /** The transfer tool's gate: has the caller asked for a person. */
  private transferGate(): SemanticGate {
    const w = this._w;
    return new SemanticGate(
      w.say('gate.transfer'),
      0.8,
      new FunctionResult(
        undefined,
        false,
        w.say('gate.transfer.refused'),
        w.say('gate.transfer.refused.then'),
      ).backToBackFunctions(false),
      {
        id: 'wants_person',
        trueMeans: w.say('gate.transfer.true'),
        falseMeans: w.say('gate.transfer.false'),
      },
    );
  }

  private wrapped(name: string, handler: OperationsHandler): OperationsHandler {
    const run = chained(handler);
    return this.wrap ? this.wrap(name, run) : run;
  }

  /**
   * The confirm tool's gate: did the caller agree to the change read back.
   *
   * One gate. A yes counts however short, even said while the read-back was
   * still playing, and even with a request for something else; it doesn't
   * count when they asked for this change itself to be different.
   * @returns The gates.
   */
  confirmGates(): SemanticGate[] {
    const agreed = this.proposal.confirmGates().find((g) => g.id === 'agreed')!;
    const refused = new FunctionResult(
      undefined,
      false,
      this._w.say('gate.confirm.refused', { tool: this._names.confirm }),
      this._w.say('gate.confirm.refused.then', {
        read_back: '${global_data.semantic_state.proposal}',
        decline: this._names.decline,
      }),
    ).backToBackFunctions(false);
    return [
      new SemanticGate(this._w.say('gate.confirm'), agreed.threshold, refused, {
        id: agreed.id,
        ...(agreed.dialogue !== undefined ? { dialogue: agreed.dialogue } : {}),
        trueMeans: this._w.say('gate.confirm.true'),
        falseMeans: this._w.say('gate.confirm.false'),
      }),
    ];
  }

  // ── handlers ─────────────────────────────────────────────────────

  private operationHandler(op: Registered): OperationsHandler {
    return async (args, rawData) => {
      const call = new CallContext(this, rawData);
      try {
        if (op.cls.beforeIdentity) await this.loadAccount(call);
        else await this.requireAccount(call);
        const change = await this._prepare(call, op, args);
        if (!op.cls.confirm) return this.finish(call, await this.applyNow(call, op, args, change));
        return this.finish(call, await this.stage(call, op, args, change), false);
      } catch (e) {
        if (e instanceof Need) return this.finish(call, this.needResult(call, op, e), false);
        if (e instanceof Refuse) {
          return this.finish(call, this.refused(e, this._w.say('refused.prefix')), false);
        }
        throw e;
      }
    };
  }

  private lookupHandler(lk: Lookup): OperationsHandler {
    return async (args, rawData) => {
      const call = new CallContext(this, rawData);
      let answer: unknown;
      try {
        if (!lk.beforeIdentity) await this.requireAccount(call);
        const values: Record<string, unknown> = {};
        for (const k of Object.keys(lk.fields)) values[k] = isMissing(args[k]) ? null : args[k];
        answer = await lk.fn(call, values);
      } catch (e) {
        if (e instanceof Refuse) return this.finish(call, this.refused(e), false);
        if (e instanceof Need) {
          return this.finish(
            call,
            new FunctionResult(
              undefined,
              false,
              this._w.say('lookup.need', { ask: e.ask }),
              this._w.say('then.ask', { ask: e.ask }),
            ),
            false,
          );
        }
        throw e;
      }
      return this.finish(
        call,
        answer instanceof FunctionResult
          ? answer
          : new FunctionResult(undefined, false, pyStr(answer)),
      );
    };
  }

  private async loadAccount(call: CallContext): Promise<void> {
    const idn = this.identity;
    if (idn !== null && call.accountId) {
      call.account = idn.load ? await idn.load(call, call.accountId) : call.accountId;
    }
  }

  private async requireAccount(call: CallContext): Promise<void> {
    const idn = this.identity;
    if (idn === null) return;
    if (!call.accountId) {
      throw new Refuse(
        this._w.say('account.unfound'),
        this._w.say('account.unfound.then', { ask: idn.ask, tool: idn.tool }),
      );
    }
    call.account = idn.load ? await idn.load(call, call.accountId) : call.accountId;
  }

  /** @internal Check the request and build its change, as the operation's `prepare` does. */
  async _prepare(
    call: CallContext,
    op: Registered,
    args: Record<string, unknown>,
  ): Promise<Change> {
    const fields = op.impl.fields();
    let missing = Object.entries(fields)
      .filter(([k, f]) => f.required && f.ask && isMissing(args[k]))
      .map(([k]) => k);
    if (missing.length > 0 && op.cls.askInOrder) missing = missing.slice(0, 1);
    if (missing.length > 0) {
      throw new Need(missing.map((k) => String(fields[k]!.ask)).join(' '), missing);
    }
    const name = op.cls.name;
    const change = await op.impl.prepare(call, new Values(fields, args));
    if (!(change instanceof Change)) {
      throw new TypeError(`${name}.prepare must return a Change, got ${typeName(change)}`);
    }
    if (op.cls.confirm && !change.readBack.trim()) {
      throw new Error(`${name}.prepare returned a Change with no readBack`);
    }
    try {
      checkCurrency(change.currency);
      change.moneyMoved();
    } catch (e) {
      const message = `${name}.prepare returned a Change whose money ${errorText(e)}`;
      throw e instanceof TypeError ? new TypeError(message) : new Error(message);
    }
    return change;
  }

  /**
   * Put what the tool's own code asked for into its result. The record goes in
   * one action object ahead of the rest, whole (the platform replaces a
   * top-level key whole), with the tool's state in it, so a say the caller
   * talks over can't keep it from being recorded; then the step it goes to and
   * its screen events; its platform actions go last.
   */
  private finish(call: CallContext, result: FunctionResult, go = true): FunctionResult {
    const key = this._names.record;
    let record: unknown = undefined;
    let kept: Record<string, unknown>[] = [];
    for (const action of result.action) {
      const set = isRecord(action) ? action['set_global_data'] : undefined;
      if (isRecord(set) && Object.hasOwn(set, key)) {
        record = set[key];
        const rest = Object.fromEntries(Object.entries(set).filter(([k]) => k !== key));
        const others = Object.fromEntries(
          Object.entries(action).filter(([k]) => k !== 'set_global_data'),
        );
        if (Object.keys(rest).length > 0 || Object.keys(others).length > 0) {
          kept.push({
            ...others,
            ...(Object.keys(rest).length > 0 ? { set_global_data: rest } : {}),
          });
        }
        continue;
      }
      kept.push(action);
    }
    if (!sameValue(call.state, call._stateWas)) {
      record = whole(this._w, isRecord(record) ? record : call.data, { state: call.state });
    }
    const front = new FunctionResult();
    if (record !== undefined) front.updateGlobalData({ [key]: record });
    if (go && call._nextStep) {
      kept = kept.filter((a) => !(isRecord(a) && 'change_step' in a));
      front.swmlChangeStep(this.stepName(call._nextStep));
    }
    for (const event of call._events) front.swmlUserEvent(event);
    result.action = [...front.action, ...kept, ...call._acts];
    return result;
  }

  /** A refusal as the tool's result: why, after `prefix` unless the service said it whole, and what next. */
  private refused(e: Refuse, prefix = ''): FunctionResult {
    const why = e instanceof _Said ? e.why : prefix + e.why;
    const result = new FunctionResult(
      undefined,
      false,
      why,
      e.then || this._w.say('then.going_on'),
    );
    return e.keep ? result.enableExtensiveData(false) : result;
  }

  /** A step as `call.go` names it, as generated: `main` and the other generated steps take the namespace. */
  private stepName(step: string): string {
    const generated = new Set([
      IDENTIFY_STEP,
      MAIN_STEP,
      CONFIRM_STEP,
      ...this.registered()
        .filter((op) => op.guidance)
        .map((op) => op.kind),
    ]);
    return generated.has(step) ? this._names.step(step) : step;
  }

  private needResult(call: CallContext, op: Registered, e: Need): FunctionResult {
    const result = new FunctionResult(
      undefined,
      false,
      this._w.say('need', { tool: op.tool }),
      this._w.say('need.then', { ask: e.ask, tool: op.tool }),
    );
    if (op.guidance && !objectOf(call.data['waiting'])['read_back']) {
      result.swmlChangeStep(this._names.step(op.kind));
    }
    return result;
  }

  /**
   * Hold a change for the caller's yes, weighed against the one waiting.
   *
   * One change waits at a time. A new one (N) against the one waiting (W):
   *
   * - the same operation made "as well" merges into W when `combine` allows;
   *   for things W is already for, without `as_well`, the model is asked which
   *   they meant;
   * - the same operation otherwise, or one that `conflictsWith` W, takes W's
   *   place for what both are for, and the rest of W (`without`) is built
   *   again and set aside; if it can't go through without what N took, nothing
   *   is changed. A conflict asked for "as well" is refused: they can't have both;
   * - W first when N's kind is in W's `goesBefore`: N is set aside;
   * - otherwise N is read back now and W is set aside for after it.
   */
  private async stage(
    call: CallContext,
    op: Registered,
    argsIn: Record<string, unknown>,
    changeIn: Change,
  ): Promise<FunctionResult> {
    const w = this._w;
    const data = call.data;
    let args = argsIn;
    let change = changeIn;
    const waiting = objectOf(data['waiting']);
    let queued = listOf(data['queued']);
    if (change.after) return this.held(call, op, args, change, queued);
    const asWell = args['as_well'];
    let note = '';
    let replaced = false;
    if (waiting['read_back']) {
      const wkind = String(waiting['kind'] || '');
      const wop = this._operations.get(wkind);
      const heldTouches = new Set(stringsOf(waiting['touches']));
      const overlap = new Set(change.touches.filter((t) => heldTouches.has(t)));
      const same = wkind === op.kind;
      let conflict: string | null = null;
      if (overlap.size > 0 && !same) {
        const theirs = changeOf(waiting);
        conflict =
          op.impl.conflictsWith(wkind, change, theirs) ||
          (wop ? wop.impl.conflictsWith(op.kind, theirs, change) : null);
      }
      const within = change.touches.every((t) => heldTouches.has(t));
      if (same && op.cls.combine !== null) {
        if ((asWell === undefined || asWell === null) && overlap.size > 0 && !within) {
          throw new _Said(
            w.say('stage.waits', { kind: op.kind, read_back: waiting['read_back'] }),
            w.say('stage.as_well.ask', { tool: op.tool }),
          );
        }
        const held = objectOf(waiting['args']);
        if (asWell === true && op.cls.combine.every((k) => sameAnswer(held[k], args[k]))) {
          args = op.impl.merge(held, args);
          change = await this._prepare(call, op, args);
          note = w.say('stage.merged', { kind: op.kind });
          replaced = true;
        }
      }
      if (waiting['read_back'] === change.readBack && replaced) {
        // as_well with nothing new: the model meant to add something and left
        // it out, so say what to pass, not "the same"
        throw new _Said(
          w.say('stage.nothing_added', { kind: op.kind, read_back: change.readBack }),
          w.say('stage.nothing_added.then', { tool: op.tool }),
        );
      }
      if (waiting['read_back'] === change.readBack) {
        throw new Refuse(
          w.say('stage.same', { read_back: change.readBack }),
          w.say('stage.same.then'),
        );
      }
      if (replaced) {
        // merged into the change waiting
      } else if (overlap.size > 0 && (same || conflict)) {
        if (conflict && asWell === true) {
          throw new _Said(
            w.say('stage.both', { conflict, read_back: waiting['read_back'] }),
            w.say('stage.both.then'),
          );
        }
        const rest = wop ? wop.impl.without(objectOf(waiting['args']), overlap) : null;
        let kept: Change | null = null;
        if (rest && Object.keys(rest).length > 0 && wop !== undefined) {
          try {
            kept = await this._prepare(call, wop, rest);
          } catch (e) {
            if (e instanceof Need || e instanceof Refuse) {
              throw new _Said(
                w.say('stage.rest_fails', { kind: wkind, why: whyOf(e) }),
                w.say('then.going_on'),
              );
            }
            throw e;
          }
        }
        const since = conflict ? w.say('stage.since', { why: conflict }) : '';
        if (kept !== null && rest) {
          queued.push(queuedEntry(wkind, rest, kept));
          note = w.say('stage.replaced.rest', { kind: wkind, since, read_back: kept.readBack });
        } else {
          note = w.say('stage.replaced', { since, read_back: waiting['read_back'] });
        }
        replaced = true;
      } else if (overlap.size > 0 && wop !== undefined && wop.cls.goesBefore.includes(op.kind)) {
        const entry = queuedEntry(op.kind, args, change);
        queued = [...queued.filter((q) => !sameRequest(q, entry)), entry];
        return new FunctionResult(
          undefined,
          false,
          w.say('stage.after_waiting', { read_back: change.readBack, kind: wkind }),
          w.say('stage.after_waiting.then', { read_back: waiting['read_back'] }),
        ).updateGlobalData(this._update(data, { queued }));
      } else {
        queued.push({
          kind: waiting['kind'] ?? null,
          read_back: waiting['read_back'] ?? null,
          touches: waiting['touches'] ?? null,
          args: waiting['args'] ?? null,
        });
        note = w.say('stage.set_aside', { read_back: waiting['read_back'] });
      }
    }
    const [reconciled, also] = await this.reconcileQueue(call, op, change, queued);
    queued = reconciled;
    note += also;
    const history = replaced
      ? (settle(data, 'replaced')['history'] as RecordData[])
      : listOf(data['history']);
    const revision = toInt(data['proposals']) + 1;
    const entry = waitingEntry(
      op.kind,
      args,
      change,
      revision,
      this._w.template('done.default'),
      this._currency,
    );
    const result = new FunctionResult()
      .updateGlobalData(
        this._update(data, { history, queued, waiting: entry, proposals: revision }),
      )
      .swmlChangeStep(this._names.step(CONFIRM_STEP));
    return this.proposed(change.readBack, call.rawData, result, note);
  }

  /** The read-back, proposed, with what the model is to do next; `note` goes before the result's words. */
  private proposed(
    readBack: string,
    rawData: Record<string, unknown>,
    result?: FunctionResult,
    note = '',
  ): FunctionResult {
    const out = this.proposal.propose(readBack, { rawData, result });
    // In place of the Proposal pattern's own ("If they say no or want a
    // change, call decline_change"): the confirm step's words, and more asked
    // for added to it. Told only to wait for a yes, a model told the caller
    // nothing more could be asked for until they answered. A question
    // answered in between left the change waiting, unasked, until the call ended.
    return out.setToolResponse(
      note + this._w.say('read_back', { read_back: readBack }),
      this._w.say('then.read_back', { confirm: this._names.confirm, decline: this._names.decline }),
    );
  }

  /**
   * A change that waits for another the caller asked for (`after`): set aside,
   * not read back, with the model told to call the other one's tool now. It's
   * offered once that one is settled, like any change set aside. One of the
   * same operation set aside already, for some of the same things, is weighed
   * against it as the change waiting would be: made "as well", one change,
   * merged; in place of it, this one, with the rest of it kept; not said, the
   * model is asked which.
   */
  private async held(
    call: CallContext,
    op: Registered,
    argsIn: Record<string, unknown>,
    changeIn: Change,
    queuedIn: RecordData[],
  ): Promise<FunctionResult> {
    const w = this._w;
    let args = argsIn;
    let change = changeIn;
    let queued = [...queuedIn];
    const asWell = args['as_well'];
    for (const q of queued.filter((q) => q['kind'] === op.kind)) {
      const qTouches = new Set(stringsOf(q['touches']));
      const overlap = new Set(change.touches.filter((t) => qTouches.has(t)));
      if (overlap.size === 0) continue;
      const held = { ...objectOf(q['args']) };
      queued.splice(queued.indexOf(q), 1);
      const within = change.touches.every((t) => qTouches.has(t));
      if (op.cls.combine !== null && asWell !== false && !within) {
        if (asWell === undefined || asWell === null) {
          throw new _Said(
            w.say('held.set_aside', { kind: op.kind, read_back: q['read_back'] }),
            w.say('stage.as_well.ask', { tool: op.tool }),
          );
        }
        if (!op.cls.combine.every((k) => sameAnswer(held[k], args[k]))) {
          throw new _Said(
            w.say('held.differ', { kind: op.kind, fields: w.joined([...op.cls.combine]) }),
            w.say('held.differ.then'),
          );
        }
        args = op.impl.merge(held, args);
        change = await this._prepare(call, op, args);
        continue;
      }
      const rest = op.impl.without(held, overlap);
      if (rest && Object.keys(rest).length > 0) {
        let kept: Change;
        try {
          kept = await this._prepare(call, op, rest);
        } catch (e) {
          if (e instanceof Need || e instanceof Refuse) continue;
          throw e;
        }
        queued.push(queuedEntry(op.kind, rest, kept));
      }
    }
    const entry = queuedEntry(op.kind, args, change);
    queued = [...queued.filter((q) => !sameRequest(q, entry)), entry];
    const first = this._operations.get(String(change.after));
    const tool = first ? first.tool : w.say('then.its_tool');
    const waiting = objectOf(call.data['waiting']);
    const since = change.afterWhy ? w.say('stage.since', { why: change.afterWhy }) : '';
    const fact = w.say('held.first', { after: change.after, since, read_back: change.readBack });
    const then =
      waiting['kind'] === change.after
        ? w.say('stage.after_waiting.then', { read_back: waiting['read_back'] ?? null })
        : w.say('held.first.then', { tool });
    return new FunctionResult(undefined, false, fact, then).updateGlobalData(
      this._update(call.data, { queued }),
    );
  }

  /**
   * The changes set aside, weighed against the one now read back as the one
   * waiting was: one of the same operation, or one it conflicts with, keeps
   * only what the new one doesn't take over, built again; what can't go
   * through without it no longer goes ahead.
   */
  private async reconcileQueue(
    call: CallContext,
    op: Registered,
    change: Change,
    queued: RecordData[],
  ): Promise<[RecordData[], string]> {
    const kept: RecordData[] = [];
    const notes: string[] = [];
    const touches = new Set(change.touches);
    for (const q of queued) {
      const qop = this._operations.get(String(q['kind'] || ''));
      const qTouches = new Set(stringsOf(q['touches']));
      const overlap = new Set([...qTouches].filter((t) => touches.has(t)));
      if (overlap.size === 0 || qop === undefined) {
        kept.push(q);
        continue;
      }
      const same = q['kind'] === op.kind;
      if (same && sameSet(qTouches, touches)) continue; // this is that one, taken up now
      const theirs = changeOf(q);
      const conflict = same
        ? null
        : op.impl.conflictsWith(qop.kind, change, theirs) ||
          qop.impl.conflictsWith(op.kind, theirs, change);
      if (!(same || conflict)) {
        kept.push(q);
        continue;
      }
      const rest = qop.impl.without(objectOf(q['args']), overlap);
      let rebuilt: Change | null = null;
      if (rest && Object.keys(rest).length > 0) {
        try {
          rebuilt = await this._prepare(call, qop, rest);
        } catch (e) {
          if (!(e instanceof Need || e instanceof Refuse)) throw e;
          rebuilt = null;
        }
      }
      if (rebuilt !== null && rest) {
        kept.push(queuedEntry(qop.kind, rest, rebuilt));
        notes.push(this._w.say('queue.narrowed', { read_back: rebuilt.readBack }));
      } else {
        notes.push(this._w.say('queue.dropped', { read_back: q['read_back'] ?? null }));
      }
    }
    return [kept, notes.join('')];
  }

  private async runWrites(
    call: CallContext,
    op: Registered,
    writes: readonly Write[],
    revision: number,
  ): Promise<[number, string]> {
    let made = 0;
    let reply = '';
    for (const [i, write] of writes.entries()) {
      call.writeKey = `${call.callId}:${revision}:${i}`;
      try {
        await op.impl.apply(call, write);
      } catch (e) {
        if (e instanceof WriteFailed) {
          reply = e.reason;
          break;
        }
        // An outcome nobody reported: not counted as made
        log.error(`operations: ${op.kind} write ${write.name} threw: ${errorText(e)}`);
        reply = this._w.say('write.unknown', { error: errorName(e) });
        break;
      }
      made += 1;
    }
    return [made, reply];
  }

  private async accountText(call: CallContext): Promise<RecordData> {
    const idn = this.identity;
    if (idn === null || idn.describe === null || !call.accountId) return {};
    try {
      call.account = idn.load ? await idn.load(call, call.accountId) : call.accountId;
      return { account: pyStr(await idn.describe(call)) };
    } catch (e) {
      // What was written still counts
      log.error(`operations: describing the account again failed: ${errorText(e)}`);
      return {};
    }
  }

  private async applyNow(
    call: CallContext,
    op: Registered,
    args: Record<string, unknown>,
    change: Change,
  ): Promise<FunctionResult> {
    void args;
    const data = call.data;
    const history = listOf(data['history']);
    const revision = toInt(data['proposals']) + 1;
    const [made, reply] = await this.runWrites(call, op, change.writes, revision);
    const lines = change.doneLines(this._w.template('done.default'));
    const moved = change._moneyMovedDec();
    const done = madeText(lines, change.writes, made);
    const outcome = made === change.writes.length ? 'made' : 'not made';
    history.push({
      kind: op.kind,
      touches: [...change.touches],
      read_back: change.readBack,
      outcome,
      ...(outcome !== 'made' ? { reason: reply } : {}),
      done,
      money: (outcome === 'made' ? moved : moved.slice(0, made))
        .reduce((sum, m) => sum.plus(m), Dec.ZERO)
        .toString(),
      currency: change.currency || this._currency || '',
      ...(outcome !== 'made'
        ? { writes_made: change.writes.slice(0, made).map((wr) => wr.toDict()) }
        : {}),
    });
    const update = this._update(data, {
      ...(await this.accountText(call)),
      history,
      proposals: revision,
    });
    const w = this._w;
    if (outcome !== 'made') {
      const part = made ? w.say('applied.part', { done }) : '';
      return new FunctionResult(
        undefined,
        false,
        w.say('applied.failed', { reason: reply, part }),
        w.say('then.going_on'),
      ).updateGlobalData(update);
    }
    return new FunctionResult(
      undefined,
      false,
      w.say('applied', { done }),
      change.then || w.say('applied.then'),
    ).updateGlobalData(update);
  }

  private waitingNamed(call: CallContext, args: Record<string, unknown>): RecordData {
    const waiting = objectOf(call.data['waiting']);
    if (!waiting['read_back']) {
      throw new Refuse(this._w.say('waiting.none'), this._w.say('waiting.none.then'));
    }
    if (args['change'] !== waiting['kind']) {
      throw new Refuse(
        this._w.say('waiting.other', {
          kind: waiting['kind'] ?? null,
          read_back: waiting['read_back'],
        }),
        this._w.say('waiting.other.then', { kind: waiting['kind'] ?? null }),
      );
    }
    return waiting;
  }

  private toolOf(): Record<string, string> {
    return Object.fromEntries(this.registered().map((op) => [op.kind, op.tool]));
  }

  private async confirmHandler(
    args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const call = new CallContext(this, rawData);
    let waiting: RecordData;
    try {
      waiting = this.waitingNamed(call, args);
      await this.requireAccount(call);
    } catch (e) {
      if (e instanceof Refuse) return this.refused(e);
      throw e;
    }
    const state = current(rawData);
    if (!state || state['proposal'] !== waiting['read_back']) {
      return this.proposed(
        String(waiting['read_back']),
        rawData,
        undefined,
        this._w.say('confirm.stale'),
      );
    }
    const op = this._operations.get(String(waiting['kind']))!;
    const writes = listOf(waiting['writes']).map((wr) => Write.fromDict(wr));
    const [made, reply] = await this.runWrites(call, op, writes, toInt(waiting['revision']));
    const account = await this.accountText(call);
    const data = call.data;
    const madeNow = madeText(stringsOf(waiting['done']), writes, made);
    const toolOf = this.toolOf();
    if (made < writes.length) {
      const part = made ? this._w.say('applied.part', { done: madeNow }) : '';
      const settled = settle(data, 'not made', madeNow, made, reply);
      const history = settled['history'] as RecordData[];
      history[history.length - 1]!['writes_made'] = writes.slice(0, made).map((wr) => wr.toDict());
      return this.finish(
        call,
        new FunctionResult(
          undefined,
          false,
          this._w.say('confirm.failed', { reason: reply, part }),
          this._w.say('then.going_on') + nextUp(data, toolOf, this._w),
        )
          .updateGlobalData(this._update(data, { ...account, ...settled }))
          .swmlChangeStep(this._names.step(MAIN_STEP)),
      );
    }
    const now = settle(data, 'made', madeNow);
    const total = this.inAll(now['history'] as RecordData[]);
    const then =
      (typeof waiting['then'] === 'string' && waiting['then']) ||
      this._w.say(total ? 'confirm.done.total.then' : 'confirm.done.then') +
        (nextUp(data, toolOf, this._w) || this._w.say('then.anything_else'));
    const result = new FunctionResult(
      undefined,
      false,
      this._w.say('confirm.done', { done: madeNow, total }),
      then,
    );
    return this.finish(
      call,
      this.proposal
        .complete(madeNow || this._w.say('confirm.done.state'), result)
        .updateGlobalData(this._update(data, { ...account, ...now }))
        .swmlChangeStep(this._names.step(MAIN_STEP)),
    );
  }

  private async declineHandler(
    args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const call = new CallContext(this, rawData);
    let waiting: RecordData;
    try {
      waiting = this.waitingNamed(call, args);
    } catch (e) {
      if (e instanceof Refuse) return this.refused(e);
      throw e;
    }
    return new FunctionResult(
      undefined,
      false,
      this._w.say('decline', { read_back: waiting['read_back'] }),
      this._w.say('decline.then') +
        (nextUp(call.data, this.toolOf(), this._w) || this._w.say('then.anything_else')),
    )
      .setSemanticState({ declined: waiting['read_back'] })
      .updateGlobalData(this._update(call.data, settle(call.data, 'declined')))
      .swmlChangeStep(this._names.step(MAIN_STEP));
  }

  private async identifyHandler(
    args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const call = new CallContext(this, rawData);
    const idn = this.identity!;
    const asked = String(args['asked_for'] || call.data['asked'] || '');
    const keys: Record<string, unknown> = {};
    for (const k of Object.keys(idn.fields)) if (!isMissing(args[k])) keys[k] = args[k];
    const remember = this._update(call.data, { asked });
    if (idn.checkKeys && !idn.anyOf.some((s) => s.every((k) => k in keys))) {
      return this.finish(
        call,
        new FunctionResult(
          undefined,
          false,
          this._w.say('identify.incomplete', { ask: idn.ask }),
          this._w.say('identify.incomplete.then', { ask: idn.ask, tool: idn.tool }),
        ).updateGlobalData(remember),
      );
    }
    let accountId: string;
    try {
      const found = await idn.find(call, keys);
      if (found === null || found === undefined || String(found).trim() === '') {
        throw new Refuse(
          this._w.say('identify.none'),
          this._w.say('identify.none.then', { ask: idn.ask }),
        );
      }
      accountId = String(found);
    } catch (e) {
      // call.go is honoured: a lockout moves the call on
      if (e instanceof Refuse) return this.finish(call, this.refused(e).updateGlobalData(remember));
      if (e instanceof Need) {
        return this.finish(
          call,
          new FunctionResult(
            undefined,
            false,
            this._w.say('identify.need', { ask: e.ask }),
            this._w.say('then.ask', { ask: e.ask }),
          ).updateGlobalData(remember),
        );
      }
      throw e;
    }
    call.data['account_id'] = accountId;
    const text = String((await this.accountText(call))['account'] ?? '');
    const before = recordOf(rawData, this._names.record)['account_id'];
    const fresh = call.data['account_id'] !== before;
    const changes: RecordData = { account_id: accountId, account: text, asked };
    // A different account: nothing waits on the old one
    if (fresh && before) Object.assign(changes, { waiting: {}, queued: [] });
    const foundIt = new FunctionResult(
      undefined,
      false,
      this._w.say('identify.found', { account: text }).trim(),
      asked ? this._w.say('identify.found.then', { asked }) : this._w.say('identify.found.ask'),
    ).updateGlobalData(this._update(call.data, changes));
    return this.finish(
      call,
      this.gated() ? foundIt.swmlChangeStep(this._names.step(MAIN_STEP)) : foundIt,
    );
  }

  private async transferHandler(
    args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const call = new CallContext(this, rawData);
    const tr = this.transfer!;
    const summary = String(args['summary'] || this._w.say('transfer.summary'));
    const to = tr.hasDestinations() ? String(args['to'] || '') : '';
    if (tr.hasDestinations() && !Object.hasOwn(tr.destinations, to)) {
      return this.finish(
        call,
        new FunctionResult(
          undefined,
          false,
          this._w.say('transfer.nowhere', { to: to || this._w.say('transfer.unnamed') }),
          this._w.say('transfer.nowhere.then', {
            destinations: this._w.joined(Object.keys(tr.destinations)),
          }),
        ),
      );
    }
    let handed: unknown;
    try {
      handed = await (tr.hasDestinations() ? tr.fn(call, summary, to) : tr.fn(call, summary));
    } catch (e) {
      // call.go is honoured: a closed desk can move the call to take a message
      if (e instanceof Refuse) return this.finish(call, this.refused(e));
      throw e;
    }
    const result = new FunctionResult(
      undefined,
      false,
      this._w.say('transfer.going', { to: to || this._w.say('transfer.person') }),
      this._w.say('transfer.going.then'),
    ).say(tr.notice || this._w.say('transfer.notice'));
    if (handed instanceof FunctionResult) result.addActions(handed.action);
    return this.finish(call, result.swmlChangeContext(this._names.transferred), false);
  }

  // ── inspection ───────────────────────────────────────────────────

  /**
   * What the model is given in each step: its text and its tools, plus the
   * conscience, as plain text for review.
   * @param agent - An agent this was installed on; by default it's installed
   *   on a new one for the preview.
   * @returns The preview.
   */
  preview(agent?: AgentBase): string {
    const target = agent ?? this.install(new AgentBase({ name: 'preview', suppressLogs: true }));
    const contexts = target.defineContexts().toDict() as Record<string, { steps?: unknown[] }>;
    const lines = [`Conscience: ${String(paramsOf(target)['conscience'] ?? '')}`, ''];
    for (const [cname, ctx] of Object.entries(contexts)) {
      for (const step of (ctx.steps ?? []) as Record<string, unknown>[]) {
        const fns = Array.isArray(step['functions']) ? (step['functions'] as string[]) : [];
        lines.push(`== ${cname}/${String(step['name'])}  tools: ${fns.join(', ') || 'none'}`);
        lines.push(String(step['text'] || ''));
        lines.push('');
      }
    }
    return lines.join('\n');
  }

  /**
   * The record's `now` line for a call's `global_data`.
   * @param globalData - The call's global data.
   * @returns The line.
   */
  recordText(globalData: Record<string, unknown>): string {
    const record = globalData[this._names.record];
    return nowLine(isRecord(record) ? record : {}, this._w);
  }
}

/** Options for a {@link ServiceAgent}: the agent's, and its `Operations`'. */
export interface ServiceAgentOptions extends AgentOptions, OperationsOptions {}

/**
 * An agent written as the operations it can do for a caller: the prefab over
 * `Operations`, installed before the first SWML or tool request.
 *
 * @example
 * ```ts
 * const agent = new ServiceAgent({ name: 'store', role: 'You answer the phone for an online store.' });
 * agent.identify({ anyOf: [['email'], ['first_name', 'last_name', 'zip']], find: findAccount });
 * agent.operation(Cancel, { tool: 'cancel_order' });
 * ```
 */
export class ServiceAgent extends AgentBase {
  /** The agent's operations. */
  readonly ops: Operations;
  private _installed = false;
  private _installing = false;

  /**
   * @param opts - The agent's options (`name` and the rest), and `role` and
   *   the other `Operations` options.
   */
  constructor(opts: ServiceAgentOptions) {
    const opsOpts: OperationsOptions = { role: opts.role };
    const agentOpts: Record<string, unknown> = { ...opts };
    delete agentOpts['role'];
    for (const k of OPERATIONS_ARGS) {
      if (k in agentOpts) {
        (opsOpts as unknown as Record<string, unknown>)[k] = agentOpts[k];
        delete agentOpts[k];
      }
    }
    super(agentOpts as unknown as AgentOptions);
    this.ops = new Operations(opsOpts);
  }

  /** See {@link Operations.operation}. */
  operation(cls: typeof Operation, opts: OperationOptions = {}): typeof Operation {
    return this.ops.operation(cls, opts);
  }

  /** See {@link Operations.lookup}. */
  lookup<F extends LookupFunction>(description: string, opts: LookupOptions = {}): (fn: F) => F {
    return this.ops.lookup<F>(description, opts);
  }

  /** See {@link Operations.phase}. */
  phase(
    name: string,
    text: string,
    tools: readonly string[] | null = null,
    opts: { initial?: boolean } = {},
  ): this {
    this.ops.phase(name, text, tools, opts);
    return this;
  }

  /** See {@link Operations.offer}. */
  offer(tools: readonly string[], opts: OfferOptions = {}): this {
    this.ops.offer(tools, opts);
    return this;
  }

  /** See {@link Operations.confirmGates}. */
  confirmGates(): SemanticGate[] {
    return this.ops.confirmGates();
  }

  /** See {@link Operations.identify}. */
  identify(opts: IdentifyOptions): this {
    this.ops.identify(opts);
    return this;
  }

  /** See {@link Operations.writesWith}. */
  writesWith(writer: WriteFunction): this {
    this.ops.writesWith(writer);
    return this;
  }

  /** See {@link Operations.transferWith}. */
  transferWith(transfer: TransferFunction, opts: TransferOptions = {}): this {
    this.ops.transferWith(transfer, opts);
    return this;
  }

  /**
   * Start the call with its record from this request: its medium, and
   * identified when `identify`'s `prefill` already knows the caller
   * (`Operations.prefilled`).
   */
  override async onSwmlRequest(
    rawData: Parameters<AgentBase['onSwmlRequest']>[0],
    callbackPath?: string,
    context?: Parameters<AgentBase['onSwmlRequest']>[2],
  ): Promise<Record<string, unknown> | void> {
    const mods = await super.onSwmlRequest(rawData, callbackPath, context);
    // Rendered on a per-request copy, which gets it before its callbacks
    // (_seedPerCallCopy): modifications land after them, over their changes
    if (this._hasPerCallConfig()) return mods;
    const known = await this.ops.prefilled(rawData as Record<string, unknown>, context ?? null);
    if (!known) return mods;
    const out: Record<string, unknown> = { ...(mods ?? {}) };
    out['global_data'] = { ...objectOf(out['global_data']), ...known };
    return out;
  }

  /**
   * A per-request copy starts installed, with the call's record, before the
   * configuration callbacks see it.
   * @internal
   */
  protected override async _seedPerCallCopy(
    copy: AgentBase,
    requestData: Record<string, unknown>,
    context?: Parameters<AgentBase['onSwmlRequest']>[2],
  ): Promise<void> {
    await super._seedPerCallCopy(copy, requestData, context);
    if (copy instanceof ServiceAgent) copy.compile();
    const known = await this.ops.prefilled(requestData, context ?? null);
    if (known) copy.updateGlobalData(known);
  }

  /**
   * Install the operations on this agent, once; runs before the first SWML or
   * tool request.
   * @returns This agent.
   */
  compile(): this {
    if (!this._installed && !this._installing) {
      this._installing = true;
      try {
        super.ensureToolsDefined();
        this.ops.install(this);
        this._installed = true;
      } finally {
        this._installing = false;
      }
    }
    return this;
  }

  /** The agent's own tools first, then the operations. */
  protected override ensureToolsDefined(): void {
    super.ensureToolsDefined();
    this.compile();
  }

  /** See {@link Operations.preview}. */
  preview(): string {
    return this.ops.preview(this.compile());
  }
}

/**
 * A step with its text and its tools, and no way to leave on its own: handlers
 * move it. A step another layer made already keeps what it has: the text and
 * tools are added to its own (`Step._extend`).
 */
function contribute(
  ctx: Context,
  name: string,
  text: string,
  tools: string[],
  section: string,
): Step {
  const step = ctx.getStep(name);
  if (step === undefined) {
    return ctx
      .addStep(name)
      .setText(text)
      .setFunctions([...tools])
      .setValidSteps([]);
  }
  return step._extend(text, tools, section);
}

/**
 * The medium a SWML request shows: the platform's `conversation_type` (`chat`,
 * or a call), else a call's details. Null when it doesn't say, or names a
 * medium the service doesn't know.
 * @internal
 */
export function _mediumOfRequest(data: unknown): string | null {
  const d = isRecord(data) ? data : {};
  const kind = String(d['conversation_type'] || '')
    .trim()
    .toLowerCase();
  if (kind === 'chat') return 'chat';
  if (kind === 'voice' || kind === 'call' || kind === 'phone') return 'voice';
  if (kind) return null;
  const call = d['call'];
  return isRecord(call) && call['call_id'] ? 'voice' : null;
}

/** Add to the prompt section of this title, made if the agent hasn't one, without repeating a bullet it has. */
function addToSection(
  agent: AgentBase,
  title: string,
  body = '',
  bullets: readonly string[] = [],
): void {
  if (!agent.promptHasSection(title)) {
    agent.promptAddSection(title, {
      body,
      ...(bullets.length > 0 ? { bullets: [...bullets] } : {}),
    });
    return;
  }
  const section = agent.pom?.findSection(title) ?? null;
  const had = new Set(section?.bullets ?? []);
  const fresh = bullets.filter((b) => !had.has(b));
  agent.promptAddToSection(title, {
    ...(body ? { body } : {}),
    ...(fresh.length > 0 ? { bullets: fresh } : {}),
  });
}

function offered(op: Registered, step: string): boolean {
  return op.cls.offeredIn === null || op.cls.offeredIn.includes(step);
}

/**
 * A generated handler whose result lets the model call the next tool right
 * after it. A gate that refuses turns that off, so the model answers in words
 * before it tries again (the confirm gate's and the transfer gate's
 * `backToBackFunctions(false)`); but the setting lasts for the call, and
 * without this every later tool result would be followed by a request with no
 * tools. Set first, so a tool's own setting after it still wins.
 */
function chained(handler: OperationsHandler): OperationsHandler {
  return async (args, rawData) => {
    const result = await handler(args, rawData);
    result.action = [{ back_to_back_functions: 'forever' }, ...result.action];
    return result;
  };
}

/** What went through, in the change's own words, or, where it has none for the writes made, the writes. */
function madeText(done: readonly string[], writes: readonly Write[], made: number): string {
  if (writes.length === 0) return done.filter((d) => d).join(' ');
  const said = done
    .slice(0, made)
    .filter((d) => d)
    .join(' ');
  if (said || made === 0 || made === writes.length) return said;
  return (
    writes
      .slice(0, made)
      .map(
        (wr) =>
          `${wr.name} (${Object.entries(wr.args)
            .map(([k, v]) => `${k} ${pyStr(v)}`)
            .join(', ')})`,
      )
      .join('; ') + '.'
  );
}

/** A field's schema; one that's asked for when missing takes "not said" as well, the model's honest answer. */
function withNotSaid(f: Field): Record<string, unknown> {
  const schema = f.schema();
  const choices = schema['enum'];
  if (f.ask && Array.isArray(choices) && !choices.includes(NOT_SAID)) {
    schema['enum'] = [...choices, NOT_SAID];
  }
  return schema;
}

function whyOf(e: unknown): string {
  return e instanceof Refuse ? e.why : e instanceof Need ? e.ask : errorText(e);
}

function changeOf(entry: RecordData): Change {
  return new Change({
    readBack: String(entry['read_back'] || ''),
    touches: stringsOf(entry['touches']),
    writes: listOf(entry['writes']).map((wr) => Write.fromDict(wr)),
    money: Array.isArray(entry['money']) ? (entry['money'] as string[]) : [],
    currency: (entry['currency'] as string) || null,
    done: stringsOf(entry['done']),
  });
}

/** Whether two answers are the same, ignoring case and spaces at the ends. */
function sameAnswer(a: unknown, b: unknown): boolean {
  return normal(a) === normal(b);
}

function normal(value: unknown): string {
  return value === null || value === undefined ? '' : pyStr(value).trim().toLowerCase();
}

function sameRequest(a: RecordData, b: RecordData): boolean {
  return (
    a['kind'] === b['kind'] &&
    sameSet(new Set(stringsOf(a['touches'])), new Set(stringsOf(b['touches'])))
  );
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** A class name in snake case: `ChangeAddress` is `change_address`. */
function snake(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_+/, '');
}

/** Fillers as `defineTool` takes them: a list is for every language (the platform's `default`). */
function fillersOf(phrases: Fillers | null | undefined): Record<string, string[]> | undefined {
  if (!phrases) return undefined;
  if (Array.isArray(phrases)) return phrases.length > 0 ? { default: [...phrases] } : undefined;
  const byLanguage = phrases as Readonly<Record<string, readonly string[]>>;
  if (Object.keys(byLanguage).length === 0) return undefined;
  return Object.fromEntries(Object.entries(byLanguage).map(([k, v]) => [k, [...v]]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectOf(value: unknown): RecordData {
  return isRecord(value) ? value : {};
}

function listOf(value: unknown): RecordData[] {
  return Array.isArray(value) ? (value as RecordData[]).slice() : [];
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toInt(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** A value as the reference's `str()` writes it, for the few values put in words. */
function pyStr(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function typeName(value: unknown): string {
  if (value === null || value === undefined) return 'NoneType';
  return typeof value === 'object' ? (value.constructor?.name ?? 'object') : typeof value;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function errorName(e: unknown): string {
  return e instanceof Error ? e.constructor.name : typeof e;
}

/** The agent's AI parameters, as it has them now. */
function paramsOf(agent: AgentBase): Record<string, unknown> {
  return ((agent as unknown as { params?: Record<string, unknown> }).params ?? {}) as Record<
    string,
    unknown
  >;
}
