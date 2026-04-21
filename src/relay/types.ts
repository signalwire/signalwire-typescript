/**
 * Shared interfaces and type aliases for the RELAY client.
 */

import type { Call } from './Call.js';
import type { Message } from './Message.js';
import type { RelayEvent } from './RelayEvent.js';

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
  headers?: Record<string, string>[];
}

/** SIP device specification for dial/connect. */
export interface SipDevice {
  type: 'sip';
  to: string;
  from: string;
  timeout?: number;
  max_duration?: number;
  codecs?: string[];
  headers?: Record<string, string>[];
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
}

/** Play item: TTS, audio URL, ringtone, or silence. */
export type PlayItem =
  | { type: 'tts'; text: string; language?: string; gender?: string }
  | { type: 'audio'; url: string }
  | { type: 'ringtone'; name: string; duration?: number }
  | { type: 'silence'; duration: number }
  | Record<string, unknown>;

/** Collect input configuration. */
export interface CollectConfig {
  /** Collect digits. */
  digits?: {
    max: number;
    digit_timeout?: number;
    terminators?: string;
  };
  /** Collect speech. */
  speech?: {
    end_silence_timeout?: number;
    speech_timeout?: number;
    language?: string;
    hints?: string[];
    model?: string;
  };
  /** Initial timeout in seconds. */
  initial_timeout?: number;
  /** Partial results? */
  partial_results?: boolean;
  /** Continuous mode? */
  continuous?: boolean;
}

/** Queued request waiting for reconnection. */
export interface QueuedRequest {
  method: string;
  params: Record<string, unknown>;
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason?: unknown) => void;
}
