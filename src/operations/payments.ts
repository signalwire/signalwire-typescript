/**
 * The Payments task pack: take a card payment, read back first, through your
 * payment connector.
 */

import type { AgentBase } from '../AgentBase.js';
import { FunctionResult, type PaymentParameter } from '../FunctionResult.js';
import { type CallContext, _Said as Said } from './agent.js';
import { _Dec as Dec } from './decimal.js';
import { Change, Field, Refuse, type Values, Write } from './model.js';
import { type Amount, checkCurrency, _decimalOf as decimalOf } from './money.js';
import { _operationsOf as operationsOf, _packOperation as packOperation } from './pack.js';
import { _Wording as Wording } from './wording.js';

/**
 * The SWML variables the pay verb sets that the result tool reads; the pack
 * asks the platform to post them with every tool request
 * (`swaig_post_swml_vars`).
 */
export const PAY_VARS: readonly string[] = Object.freeze(['pay_result', 'pay_payment_results']);

/** The fields of a {@link Charge}. */
export interface ChargeFields {
  /** How much to charge: more than 0, as a number, a bigint or a numeric string. */
  amount: Amount;
  /** What it's for, as it's said: "invoice 1042, for March". */
  description: string;
  /** Its ISO 4217 code; defaults to the pack's, else the service's. */
  currency?: string | null;
}

/** What a payment is for and how much, as `charge` gives it. */
export class Charge implements ChargeFields {
  /** How much to charge: more than 0. */
  readonly amount: Amount;
  /** What it's for, as it's said. */
  readonly description: string;
  /** Its ISO 4217 code, or null for the pack's, else the service's. */
  readonly currency: string | null;

  /**
   * @param amount - How much to charge: more than 0.
   * @param description - What it's for, as it's said: "invoice 1042, for March".
   * @param currency - Its ISO 4217 code; defaults to the pack's, else the service's.
   */
  constructor(amount: Amount, description: string, currency: string | null = null) {
    this.amount = amount;
    this.description = description;
    this.currency = currency;
    Object.freeze(this);
  }
}

/** The fields of a {@link PaymentResult}. */
export interface PaymentResultFields {
  /** The platform's `pay_result`. */
  result: string;
  /** The amount, as an exact decimal string. */
  amount: string;
  /** Its ISO 4217 code. */
  currency: string;
  /** What it was for. */
  description: string;
  /** What the caller said they were paying, as `charge` got it. */
  payingFor: string;
  /** The platform's `pay_payment_results`: the token, confirmation code and masked card, when there are. */
  details?: Readonly<Record<string, unknown>>;
}

/** How a payment went, as `onResult` gets it. */
export class PaymentResult implements PaymentResultFields {
  /**
   * The platform's `pay_result`: `success`, `too-many-failed-attempts`,
   * `payment-connector-error`, `caller-interrupted-with-star`,
   * `caller-hung-up`, `validation-error`, `internal-error`, `relay-pay-stop`,
   * `empty` or `failed`.
   */
  readonly result: string;
  /** The amount, as an exact decimal string. */
  readonly amount: string;
  /** Its ISO 4217 code. */
  readonly currency: string;
  /** What it was for. */
  readonly description: string;
  /** What the caller said they were paying, as `charge` got it. */
  readonly payingFor: string;
  /** The platform's `pay_payment_results`: the token, confirmation code and masked card, when there are. */
  readonly details: Readonly<Record<string, unknown>>;

  /** @param fields - The result's fields. */
  constructor(fields: PaymentResultFields) {
    this.result = fields.result;
    this.amount = fields.amount;
    this.currency = fields.currency;
    this.description = fields.description;
    this.payingFor = fields.payingFor;
    this.details = { ...(fields.details ?? {}) };
    Object.freeze(this);
  }

  /** Whether it went through. */
  get succeeded(): boolean {
    return this.result === 'success';
  }
}

/** Every key the `Payments` pack's words come from, with its default. */
export const PAYMENTS_WORDING: Readonly<Record<string, string>> = Object.freeze({
  tool: 'Take a card payment for something they owe, read back first.',
  'tool.paying_for': "What they're paying, such as an invoice or order number, as they said it.",
  'ask.paying_for': 'What would they like to pay?',
  read_back: 'Take {amount} on a card for {description}. Shall I go ahead?',
  started: 'The card details are taken next, on the keypad.',
  'started.then': "Tell them they'll enter their card on the keypad now, and say nothing more.",
  finished: 'The payment has finished. Call {tool} now, and say nothing before it.',
  'result.tool': 'How the payment that just finished went. Call it once the payment has finished.',
  paid: 'The payment went through: {amount} for {description}.',
  'paid.then': 'Tell them it went through.',
  failed: "The payment didn't go through ({result}). Nothing was charged.",
  'failed.then': "Tell them, and ask if they'd like to try again.",
  unknown: "There's no payment result yet.",
  'unknown.then':
    "If a payment just finished, tell them you can't confirm it went through, and offer to " +
    'check another way.',
  none: 'No payment was started.',
  'amount.bad': '{paying_for} has nothing to pay.',
  chat: 'A card payment is taken on a call, not in a chat.',
  'chat.then': 'Tell them, and offer to take it when they call.',
});

/** Options for {@link Payments}. */
export interface PaymentsOptions {
  /** Your payment connector, which the platform sends the card to. */
  connectorUrl: string;
  /**
   * `charge(call, payingFor)` returns the {@link Charge} (or its fields) for
   * what the caller said they're paying; it may be async, and may throw
   * `Refuse` (nothing owed, not theirs) or `Need`.
   */
  charge: (call: CallContext, payingFor: string) => unknown;
  /** The ISO 4217 code of the amounts; defaults to the service's `currency`. A payment needs one. */
  currency?: string | null;
  /**
   * The language code the platform's card prompts are spoken in, such as
   * `"en-US"`; defaults to the agent's first language. A payment needs one.
   */
  language?: string | null;
  /** The voice of the card prompts; defaults to the agent's first language's voice. */
  voice?: string | null;
  /** Whether the card's security code is asked for. Default true. */
  securityCode?: boolean;
  /** Whether the billing postal code is asked for. Default true. */
  postalCode?: boolean;
  /** How many times the caller may try the card. Default 1. */
  maxAttempts?: number;
  /** True for a token the connector can charge again (a card kept on file), false for one charge. Default false. */
  reusable?: boolean;
  /**
   * The card types taken, such as `['visa', 'mastercard']`; Visa, Mastercard
   * and American Express when null, as `FunctionResult.pay` takes them.
   */
  cardTypes?: readonly string[] | null;
  /** Where the platform posts each step of the payment. */
  statusUrl?: string | null;
  /** More name/value pairs for the connector. */
  connectorParameters?: Readonly<Record<string, string>> | null;
  /** `onResult(call, result)` gets every {@link PaymentResult}, for your records; it may be async. */
  onResult?: ((call: CallContext, result: PaymentResult) => unknown) | null;
  /** True to take payments from callers who aren't identified. */
  beforeIdentity?: boolean;
  /** The payment tool's name. Default `take_payment`. */
  tool?: string;
  /** The result tool's name. Default `payment_result`. */
  resultTool?: string;
  /** Words in place of the defaults, by key; the keys are those of {@link PAYMENTS_WORDING}. */
  wording?: Readonly<Record<string, string>> | null;
  /** Where in `call.state` the payment under way is kept. Default `payments`. */
  stateKey?: string;
}

/**
 * Take a card payment, read back first, through your payment connector.
 *
 * @example
 * ```ts
 * new Payments({
 *   connectorUrl: 'https://pay.example.com/connector',
 *   charge: (call, invoice) => new Charge(billing.balance(invoice), `invoice ${invoice}`),
 *   currency: 'USD',
 *   language: 'en-US',
 * }).addTo(agent);
 * ```
 */
export class Payments {
  /** The payment tool's name. */
  readonly tool: string;
  /** The result tool's name. */
  readonly resultTool: string;
  private readonly connector: string;
  private readonly chargeFn: PaymentsOptions['charge'];
  private readonly currency: string | null;
  private readonly language: string | null;
  private readonly voice: string | null;
  /** The language and voice, once installed. */
  private prompts: [string, string | null] | null = null;
  private readonly securityCode: boolean;
  private readonly postalCode: boolean;
  private readonly attempts: number;
  private readonly token: string;
  private readonly cards: string | null;
  private readonly statusUrl: string | null;
  private readonly parameters: PaymentParameter[];
  private readonly onResult: NonNullable<PaymentsOptions['onResult']> | null;
  private readonly beforeIdentity: boolean;
  private readonly w: Wording;
  private readonly key: string;

  /**
   * @param opts - `connectorUrl` and `charge`, and the rest of {@link PaymentsOptions}.
   * @throws {Error} With no connector, a currency that isn't an ISO 4217 code,
   *   or wording it can't use.
   */
  constructor(opts: PaymentsOptions) {
    if (!opts.connectorUrl) throw new Error('Payments needs connectorUrl, your payment connector');
    this.connector = opts.connectorUrl;
    this.chargeFn = opts.charge;
    this.currency = checkCurrency(opts.currency);
    this.language = opts.language ?? null;
    this.voice = opts.voice ?? null;
    this.securityCode = opts.securityCode ?? true;
    this.postalCode = opts.postalCode ?? true;
    this.attempts = opts.maxAttempts ?? 1;
    this.token = opts.reusable ? 'reusable' : 'one-time';
    this.cards = opts.cardTypes && opts.cardTypes.length > 0 ? opts.cardTypes.join(' ') : null;
    this.statusUrl = opts.statusUrl ?? null;
    this.parameters = Object.entries(opts.connectorParameters ?? {}).map(([name, value]) => ({
      name,
      value,
    }));
    this.onResult = opts.onResult ?? null;
    this.beforeIdentity = opts.beforeIdentity ?? false;
    this.tool = opts.tool ?? 'take_payment';
    this.resultTool = opts.resultTool ?? 'payment_result';
    this.w = new Wording(PAYMENTS_WORDING, opts.wording, 'Payments', 'PAYMENTS_WORDING');
    this.key = opts.stateKey ?? 'payments';
  }

  /**
   * Register the pack's operations on an `Operations` or a `ServiceAgent`.
   * @param target - The `Operations` or `ServiceAgent`.
   * @returns The target.
   * @throws {TypeError} For anything else.
   */
  addTo<T>(target: T): T {
    const ops = operationsOf(target);
    ops._installHooks.push((agent) => this.installing(agent));
    const w = this.w;

    ops.operation(
      packOperation({
        name: 'TakePayment',
        description: w.say('tool'),
        fields: {
          paying_for: new Field('string', w.say('tool.paying_for'), {
            ask: w.say('ask.paying_for'),
          }),
        },
        beforeIdentity: this.beforeIdentity,
        prepare: async (call: CallContext, f: Values) => {
          // The pay verb takes the card on a call's keypad
          if (call.medium === 'chat') throw new Said(w.say('chat'), w.say('chat.then'));
          const payingFor = String(f['paying_for']);
          const found = await this.chargeFn(call, payingFor);
          const charge = chargeOf(found);
          const amount = decimalOf(charge.amount);
          const currency =
            checkCurrency(charge.currency) || this.currency || call.service._currency;
          if (!currency) {
            throw new Error('a payment needs a currency: give Charge, Payments or the service one');
          }
          if (amount.compare(Dec.ZERO) <= 0) {
            throw new Refuse(w.say('amount.bad', { paying_for: payingFor }));
          }
          const money = call.service._moneyFormat(amount.toString(), currency);
          return new Change({
            readBack: w.say('read_back', { amount: money, description: charge.description }),
            touches: [`payment:${payingFor}`],
            writes: [
              new Write('take_payment', {
                amount: amount.toString(),
                currency,
                description: charge.description,
                paying_for: payingFor,
              }),
            ],
            done: w.say('started'),
            then: w.say('started.then'),
          });
        },
        apply: (call: CallContext, write: Write) => {
          const a = write.args;
          call.state[this.key] = { ...objectOf(call.state[this.key]), pending: { ...a } };
          call.act(this.pay(a));
          return undefined;
        },
      }),
      { tool: this.tool, kind: this.tool },
    );

    ops.operation(
      packOperation({
        name: 'PaymentResult',
        description: w.say('result.tool'),
        beforeIdentity: this.beforeIdentity,
        confirm: false,
        prepare: async (call: CallContext) => {
          const mine = { ...objectOf(call.state[this.key]) };
          const pending = mine['pending'] as Record<string, unknown> | undefined;
          delete mine['pending'];
          if (!pending || Object.keys(pending).length === 0) throw new Said(w.say('none'));
          const swmlVars = call.rawData['SWMLVars'];
          const vars = objectOf(swmlVars);
          const result = isRecord(swmlVars) ? String(vars['pay_result'] || '') : '';
          if (!result) throw new Said(w.say('unknown'), w.say('unknown.then'));
          // Settled: a later call to this tool finds none under way
          call.state[this.key] = mine;
          const outcome = new PaymentResult({
            result,
            amount: decimalOf(pending['amount']).toString(),
            currency: String(pending['currency']),
            description: String(pending['description']),
            payingFor: String(pending['paying_for']),
            details: detailsOf(vars['pay_payment_results']),
          });
          if (this.onResult !== null) await this.onResult(call, outcome);
          if (!outcome.succeeded) {
            throw new Said(w.say('failed', { result }), w.say('failed.then'));
          }
          const money = call.service._moneyFormat(outcome.amount, outcome.currency);
          return new Change({
            readBack: '',
            touches: [`payment:${outcome.payingFor}`],
            money: [outcome.amount],
            currency: outcome.currency,
            done: w.say('paid', { amount: money, description: outcome.description }),
            then: w.say('paid.then'),
          });
        },
      }),
      { tool: this.resultTool, kind: this.resultTool },
    );
    return target;
  }

  /**
   * What the pack needs of the agent: the pay verb's variables posted with
   * each tool request, and a language for the card prompts, the agent's first
   * unless one was given. Checked here, so an agent missing one fails when
   * it's set up rather than on a call.
   */
  private installing(agent: AgentBase): void {
    const internals = agent as unknown as {
      params: Record<string, unknown>;
      languages: Record<string, unknown>[];
    };
    const have = internals.params['swaig_post_swml_vars'];
    if (have !== true) {
      const listed = Array.isArray(have) ? (have as string[]) : [];
      agent.setParam('swaig_post_swml_vars', [...new Set([...listed, ...PAY_VARS])]);
    }
    const languages = internals.languages ?? [];
    const first = isRecord(languages[0]) ? languages[0] : {};
    const language = this.language || (first['code'] as string | undefined);
    if (!language) {
      throw new Error(
        'Payments needs a language for the card prompts: give it language, or the agent a language',
      );
    }
    this.prompts = [String(language), this.voice || (first['voice'] as string | undefined) || null];
  }

  /** The pay verb for a payment the caller said yes to, with what the model is told once it's finished. */
  private pay(a: Record<string, unknown>): FunctionResult {
    const [language, voice] = this.prompts!;
    return new FunctionResult().pay({
      paymentConnectorUrl: this.connector,
      chargeAmount: String(a['amount']),
      currency: String(a['currency']).toLowerCase(),
      language,
      description: String(a['description']),
      securityCode: this.securityCode,
      postalCode: this.postalCode,
      maxAttempts: this.attempts,
      tokenType: this.token,
      aiResponse: this.w.say('finished', { tool: this.resultTool }),
      ...(voice ? { voice } : {}),
      ...(this.cards ? { validCardTypes: this.cards } : {}),
      ...(this.statusUrl ? { statusUrl: this.statusUrl } : {}),
      ...(this.parameters.length > 0 ? { parameters: [...this.parameters] } : {}),
    });
  }
}

const CHARGE_FIELDS = ['amount', 'description', 'currency'];

function chargeOf(found: unknown): Charge {
  if (found instanceof Charge) return found;
  if (isRecord(found)) {
    // Its fields, and only those, as the reference's Charge(**found) takes them
    const extra = Object.keys(found).filter((k) => !CHARGE_FIELDS.includes(k));
    if (extra.length > 0) {
      throw new TypeError(`a Charge has no field ${extra.map((k) => `'${k}'`).join(', ')}`);
    }
    const missing = ['amount', 'description'].filter((k) => !Object.hasOwn(found, k));
    if (missing.length > 0) {
      throw new TypeError(`a Charge needs ${missing.map((k) => `'${k}'`).join(' and ')}`);
    }
    return new Charge(
      found['amount'] as Amount,
      found['description'] as string,
      (found['currency'] as string | null | undefined) ?? null,
    );
  }
  throw new TypeError('charge must return a Charge, or an object with amount and description');
}

function detailsOf(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return { ...value };
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) ? { ...parsed } : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}
