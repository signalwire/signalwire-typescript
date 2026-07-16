/**
 * Shared interfaces and type aliases for the RELAY client.
 */

import type { Call } from './Call.js';
import type { Message } from './Message.js';
import type { RelayEvent } from './RelayEvent.js';
import type { CallingCollectParams, CallingPlayParams } from './protocol.types.generated.js';

/** Options for constructing a RelayClient. */
export interface RelayClientOptions {
  /** SignalWire project ID. Defaults to env SIGNALWIRE_PROJECT_ID. */
  project?: string;
  /** SignalWire API token. Defaults to env SIGNALWIRE_API_TOKEN. */
  token?: string;
  /** JWT token for authentication. Defaults to env SIGNALWIRE_JWT_TOKEN. */
  jwtToken?: string;
  /** RELAY host. Defaults to relay.signalwire.com. */
  host?: string;
  /**
   * WebSocket scheme — `'wss'` (production, the default) or `'ws'`
   * (loopback fixtures and local audit harnesses). Reads from
   * `SIGNALWIRE_RELAY_SCHEME` if not explicitly set; defaults to `'wss'`.
   *
   * Production deployments should never pass `'ws'` — the value exists
   * solely so tests can drive the real client against a plain-WS loopback
   * fixture without standing up TLS termination.
   */
  scheme?: 'ws' | 'wss';
  /** Contexts (topics) to receive inbound calls/messages on. */
  contexts?: string[];
  /** Maximum number of concurrent active calls. Defaults to env RELAY_MAX_ACTIVE_CALLS or 1000. */
  maxActiveCalls?: number;
}

/** JSON-RPC 2.0 request. */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

/** JSON-RPC 2.0 response (success). */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: Record<string, unknown>;
  error?: JsonRpcError;
}

/** JSON-RPC 2.0 error object. */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** Handler for inbound calls. */
export type CallHandler = (call: Call) => void | Promise<void>;

/** Handler for inbound messages. */
export type MessageHandler = (message: Message) => void | Promise<void>;

/** Handler for relay events. */
export type EventHandler = (event: RelayEvent) => void | Promise<void>;

/** Callback when an action or message completes. */
export type CompletedCallback = (event: RelayEvent) => void | Promise<void>;

/** Phone device specification for dial/connect. */
export interface PhoneDevice {
  type: 'phone';
  to: string;
  from: string;
  timeout?: number;
  max_duration?: number;
  codecs?: string[];
  /**
   * SIP headers as a name→value map. The RELAY wire models device headers as a
   * map object (`CallingReferParams.device.params.headers`), not an array.
   */
  headers?: Record<string, string>;
}

/** SIP device specification for dial/connect. */
export interface SipDevice {
  type: 'sip';
  to: string;
  from: string;
  timeout?: number;
  max_duration?: number;
  codecs?: string[];
  /**
   * SIP headers as a name→value map. The RELAY wire models device headers as a
   * map object (`CallingReferParams.device.params.headers`), not an array.
   */
  headers?: Record<string, string>;
}

/** Any device specification. */
export type Device = PhoneDevice | SipDevice | Record<string, unknown>;

/** Options for the dial() method. */
export interface DialOptions {
  /** Caller ID / from number. */
  from?: string;
  /** Timeout in seconds for the dial. */
  timeout?: number;
  /** Maximum call duration in seconds. */
  maxDuration?: number;
}

/** Options for the sendMessage() method. */
export interface SendMessageOptions {
  /** Destination phone number in E.164 format. */
  toNumber: string;
  /** Sender phone number in E.164 format. */
  fromNumber: string;
  /** Message body text. */
  body?: string;
  /** Media URLs for MMS. */
  media?: string[];
  /** Context for the message. */
  context?: string;
  /** Tags for the message. */
  tags?: string[];
  /** Origination region override (`MessagingSendParams.region`). */
  region?: string;
  /** Callback fired when the message reaches a terminal state. */
  onCompleted?: CompletedCallback;
}

/**
 * A play item accepted by `play()` / `playAndCollect()`.
 *
 * The canonical RELAY wire form is `{ type, params }`
 * (`CallingPlayParams['play'][number]`). The SDK also accepts the friendly flat
 * shorthands below (`{ type: 'tts', text }`, etc.), which
 * {@link normalizePlayItem} expands into `params` before sending. So the
 * accepted-input type is the wire shape OR one of the flat shorthands — exactly
 * the set the normalizer handles, not the post-normalization wire shape alone.
 */
export type PlayItem =
  | CallingPlayParams['play'][number]
  | { type: 'tts'; text: string; language?: string; gender?: string }
  | { type: 'audio'; url: string }
  | { type: 'ringtone'; name: string; duration?: number }
  | { type: 'silence'; duration: number };

/**
 * Collect-input configuration — the canonical `calling.collect` params minus the
 * transport keys (`node_id`/`call_id`/`control_id`) the SDK fills internally.
 * The `digits`/`speech`/timer field types come straight from the RELAY schema.
 */
export type CollectConfig = Omit<CallingCollectParams, 'node_id' | 'call_id' | 'control_id'>;

/**
 * A device descriptor accepted by `connect()` / `refer()` / `tap()`. Same
 * wire-or-flat duality as {@link PlayItem}: {@link normalizeDevice} accepts a
 * flat `{ type, to, from, … }` and expands it into `{ type, params }`, so the
 * accepted-input type is an object with a `type` plus arbitrary other fields.
 */
export type DeviceInput = { type: string } & Record<string, unknown>;

/**
 * The typed device descriptor accepted by `refer()`. Unlike the open
 * {@link DeviceInput}, the RELAY REFER wire (`CallingReferParams.device.params`)
 * REQUIRES `to`; `headers` is a name→value map. {@link normalizeDevice} folds
 * this flat shape into `{ type, params: { to, headers } }` before sending.
 */
export interface ReferDevice {
  /** Device type (typically `'sip'`). */
  type: string;
  /** Transfer target — required by the wire (`device.params.to`). */
  to: string;
  /** Optional SIP headers as a name→value map. */
  headers?: Record<string, string>;
}

/** Queued request waiting for reconnection. */
export interface QueuedRequest {
  method: string;
  params: Record<string, unknown>;
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason?: unknown) => void;
}
