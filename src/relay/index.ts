/**
 * SignalWire RELAY client — real-time call control over WebSocket.
 */

// Client
export { RelayClient } from './RelayClient.js';
export { RelayError } from './RelayError.js';

// Call + Actions
export { Call } from './Call.js';
export type { RelayClientLike } from './Call.js';
export {
  Action,
  PlayAction,
  RecordAction,
  DetectAction,
  CollectAction,
  StandaloneCollectAction,
  FaxAction,
  TapAction,
  StreamAction,
  PayAction,
  TranscribeAction,
  AIAction,
} from './Action.js';
export type { CallLike } from './Action.js';

// Message
export { Message } from './Message.js';

// Events
export {
  RelayEvent,
  CallStateEvent,
  CallReceiveEvent,
  PlayEvent,
  RecordEvent,
  CollectEvent,
  ConnectEvent,
  DetectEvent,
  FaxEvent,
  TapEvent,
  StreamEvent,
  SendDigitsEvent,
  DialEvent,
  ReferEvent,
  DenoiseEvent,
  PayEvent,
  QueueEvent,
  EchoEvent,
  TranscribeEvent,
  HoldEvent,
  ConferenceEvent,
  CallingErrorEvent,
  MessageReceiveEvent,
  MessageStateEvent,
  parseEvent,
} from './RelayEvent.js';

// Deferred utility
export { createDeferred, withTimeout } from './Deferred.js';
export type { Deferred } from './Deferred.js';

// Constants
export {
  CALL_STATE_CREATED,
  CALL_STATE_RINGING,
  CALL_STATE_ANSWERED,
  CALL_STATE_ENDING,
  CALL_STATE_ENDED,
  CONNECT_STATE_CONNECTING,
  CONNECT_STATE_CONNECTED,
  CONNECT_STATE_DISCONNECTED,
  CONNECT_STATE_FAILED,
  EVENT_CALL_STATE,
  EVENT_CALL_RECEIVE,
  EVENT_CALL_PLAY,
  EVENT_CALL_RECORD,
  EVENT_CALL_COLLECT,
  EVENT_CALL_CONNECT,
  EVENT_CALL_DETECT,
  EVENT_CALL_FAX,
  EVENT_CALL_TAP,
  EVENT_CALL_STREAM,
  EVENT_CALL_SEND_DIGITS,
  EVENT_CALL_DIAL,
  EVENT_CALL_REFER,
  EVENT_CALL_DENOISE,
  EVENT_CALL_PAY,
  EVENT_CALL_QUEUE,
  EVENT_CALL_ECHO,
  EVENT_CALL_TRANSCRIBE,
  EVENT_CALL_HOLD,
  EVENT_CONFERENCE,
  EVENT_CALLING_ERROR,
  EVENT_MESSAGING_RECEIVE,
  EVENT_MESSAGING_STATE,
  MESSAGE_STATE_QUEUED,
  MESSAGE_STATE_INITIATED,
  MESSAGE_STATE_SENT,
  MESSAGE_STATE_DELIVERED,
  MESSAGE_STATE_UNDELIVERED,
  MESSAGE_STATE_FAILED,
  MESSAGE_STATE_RECEIVED,
} from './constants.js';

// Types
export type {
  RelayClientOptions,
  CallHandler,
  MessageHandler,
  EventHandler,
  CompletedCallback,
  Device,
  PhoneDevice,
  SipDevice,
  DialOptions,
  SendMessageOptions,
  PlayItem,
  CollectConfig,
} from './types.js';
