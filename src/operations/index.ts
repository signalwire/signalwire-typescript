/**
 * Operations: an agent written as what it can do for a caller.
 *
 * A `ServiceAgent` holds operations (what it can change: cancel an order, move
 * a booking), lookups (what it can read) and how it identifies the caller.
 * Each operation is written once, for any caller: its fields, `prepare` (the
 * rules: check, look up, build the change) and `apply` (one backend write).
 * The agent runs the rest the same way for every operation: the read-back,
 * one yes, the writes, the call's record, and a request made while another
 * change waits.
 *
 * InfoBot (knowledge search and continuity across voice and chat) is at
 * `@signalwire/sdk/operations/infobot`.
 *
 * @packageDocumentation
 * @module @signalwire/sdk/operations
 */

export {
  CallContext,
  DEFAULT_RULES,
  MEDIUMS,
  Operations,
  ServiceAgent,
  type Fillers,
  type IdentifyOptions,
  type LookupFunction,
  type LookupOptions,
  type OfferOptions,
  type OperationOptions,
  type OperationsHandler,
  type OperationsOptions,
  type ServiceAgentOptions,
  type TransferFunction,
  type TransferOptions,
} from './agent.js';
export {
  NOT_SAID,
  Change,
  Field,
  Need,
  Operation,
  Refuse,
  Values,
  Write,
  WriteFailed,
  type ChangeOptions,
  type FieldKind,
  type FieldOptions,
  type OperationClass,
  type RefuseOptions,
} from './model.js';
export {
  APPOINTMENTS_WORDING,
  Appointment,
  Appointments,
  Slot,
  type AppointmentsOptions,
  type Labelled,
} from './appointments.js';
export {
  MESSAGES_WORDING,
  Message,
  Messages,
  type MessageFields,
  type MessagesOptions,
} from './messages.js';
export { CURRENCIES, amountOf, checkCurrency, formatMoney, type Amount } from './money.js';
export {
  PAYMENTS_WORDING,
  PAY_VARS,
  Charge,
  PaymentResult,
  Payments,
  type ChargeFields,
  type PaymentResultFields,
  type PaymentsOptions,
} from './payments.js';
export {
  Callee,
  Dialer,
  NotPlaced,
  callingHours,
  consented,
  type CalleeFields,
  type Check,
  type DialClient,
  type DialerOptions,
} from './outbound.js';
export {
  RECORD,
  RECORD_KEYS,
  RECORD_VERSION,
  type MoneyFormat,
  type RecordData,
} from './record.js';
export { DEFAULT_WORDING, placeholders } from './wording.js';
// InfoBot, also at @signalwire/sdk/operations/infobot
export * as infobot from './infobot/index.js';
