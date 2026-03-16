/**
 * Protocol constants for the SignalWire RELAY calling API.
 */

// Protocol version
export const PROTOCOL_VERSION = { major: 2, minor: 0, revision: 0 };
export const AGENT_STRING = 'signalwire-agents-typescript/1.0';

// JSON-RPC methods
export const METHOD_SIGNALWIRE_CONNECT = 'signalwire.connect';
export const METHOD_SIGNALWIRE_EVENT = 'signalwire.event';
export const METHOD_SIGNALWIRE_PING = 'signalwire.ping';
export const METHOD_SIGNALWIRE_DISCONNECT = 'signalwire.disconnect';
export const METHOD_SIGNALWIRE_RECEIVE = 'signalwire.receive';
export const METHOD_SIGNALWIRE_UNRECEIVE = 'signalwire.unreceive';

// Authorization state event
export const EVENT_AUTHORIZATION_STATE = 'signalwire.authorization.state';

// Call states
export const CALL_STATE_CREATED = 'created';
export const CALL_STATE_RINGING = 'ringing';
export const CALL_STATE_ANSWERED = 'answered';
export const CALL_STATE_ENDING = 'ending';
export const CALL_STATE_ENDED = 'ended';

export const CALL_STATES = [
  CALL_STATE_CREATED,
  CALL_STATE_RINGING,
  CALL_STATE_ANSWERED,
  CALL_STATE_ENDING,
  CALL_STATE_ENDED,
] as const;

// End reasons
export const END_REASON_HANGUP = 'hangup';
export const END_REASON_CANCEL = 'cancel';
export const END_REASON_BUSY = 'busy';
export const END_REASON_NO_ANSWER = 'noAnswer';
export const END_REASON_DECLINE = 'decline';
export const END_REASON_ERROR = 'error';
export const END_REASON_ABANDONED = 'abandoned';
export const END_REASON_MAX_DURATION = 'max_duration';
export const END_REASON_NOT_FOUND = 'not_found';

// Connect states
export const CONNECT_STATE_CONNECTING = 'connecting';
export const CONNECT_STATE_CONNECTED = 'connected';
export const CONNECT_STATE_DISCONNECTED = 'disconnected';
export const CONNECT_STATE_FAILED = 'failed';

// Event types
export const EVENT_CALL_STATE = 'calling.call.state';
export const EVENT_CALL_RECEIVE = 'calling.call.receive';
export const EVENT_CALL_CONNECT = 'calling.call.connect';
export const EVENT_CALL_PLAY = 'calling.call.play';
export const EVENT_CALL_COLLECT = 'calling.call.collect';
export const EVENT_CALL_RECORD = 'calling.call.record';
export const EVENT_CALL_DETECT = 'calling.call.detect';
export const EVENT_CALL_FAX = 'calling.call.fax';
export const EVENT_CALL_TAP = 'calling.call.tap';
export const EVENT_CALL_SEND_DIGITS = 'calling.call.send_digits';
export const EVENT_CALL_DIAL = 'calling.call.dial';
export const EVENT_CALL_REFER = 'calling.call.refer';
export const EVENT_CALL_DENOISE = 'calling.call.denoise';
export const EVENT_CALL_PAY = 'calling.call.pay';
export const EVENT_CALL_QUEUE = 'calling.call.queue';
export const EVENT_CALL_STREAM = 'calling.call.stream';
export const EVENT_CALL_ECHO = 'calling.call.echo';
export const EVENT_CALL_TRANSCRIBE = 'calling.call.transcribe';
export const EVENT_CALL_HOLD = 'calling.call.hold';
export const EVENT_CONFERENCE = 'calling.conference';
export const EVENT_CALLING_ERROR = 'calling.error';

// Messaging event types
export const EVENT_MESSAGING_RECEIVE = 'messaging.receive';
export const EVENT_MESSAGING_STATE = 'messaging.state';

// Message states
export const MESSAGE_STATE_QUEUED = 'queued';
export const MESSAGE_STATE_INITIATED = 'initiated';
export const MESSAGE_STATE_SENT = 'sent';
export const MESSAGE_STATE_DELIVERED = 'delivered';
export const MESSAGE_STATE_UNDELIVERED = 'undelivered';
export const MESSAGE_STATE_FAILED = 'failed';
export const MESSAGE_STATE_RECEIVED = 'received';

export const MESSAGE_TERMINAL_STATES = [
  MESSAGE_STATE_DELIVERED,
  MESSAGE_STATE_UNDELIVERED,
  MESSAGE_STATE_FAILED,
] as const;

// Play states
export const PLAY_STATE_PLAYING = 'playing';
export const PLAY_STATE_PAUSED = 'paused';
export const PLAY_STATE_FINISHED = 'finished';
export const PLAY_STATE_ERROR = 'error';

// Record states
export const RECORD_STATE_RECORDING = 'recording';
export const RECORD_STATE_PAUSED = 'paused';
export const RECORD_STATE_FINISHED = 'finished';
export const RECORD_STATE_NO_INPUT = 'no_input';

// Detect types
export const DETECT_TYPE_MACHINE = 'machine';
export const DETECT_TYPE_FAX = 'fax';
export const DETECT_TYPE_DIGIT = 'digit';

// Join room states
export const ROOM_STATE_JOINING = 'joining';
export const ROOM_STATE_JOIN = 'join';
export const ROOM_STATE_LEAVING = 'leaving';
export const ROOM_STATE_LEAVE = 'leave';

// Reconnect settings
export const RECONNECT_MIN_DELAY = 1.0;
export const RECONNECT_MAX_DELAY = 30.0;
export const RECONNECT_BACKOFF_FACTOR = 2.0;

// Ping settings
export const CLIENT_PING_INTERVAL = 30_000; // 30s
export const CLIENT_PING_MAX_FAILURES = 3;
export const SERVER_PING_TIMEOUT = 15_000; // 15s

// Request settings
export const REQUEST_TIMEOUT = 30_000; // 30s
export const EXECUTE_QUEUE_MAX = 500;

// Default host
export const DEFAULT_RELAY_HOST = 'relay.signalwire.com';
