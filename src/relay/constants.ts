/**
 * Protocol constants for the SignalWire RELAY calling API.
 *
 * Every value here is a **wire literal** — the exact string or number the
 * RELAY WebSocket protocol (Blade / JSON-RPC 2.0) puts on, or expects on, the
 * connection. They are exported so callers can compare against event fields
 * without hardcoding strings, and so the ten SDK ports share one spelling of
 * each. Mirrors `signalwire/relay/constants.py` in the Python reference; where
 * a value intentionally differs (`AGENT_STRING`) or is TypeScript-only
 * (`CLIENT_PING_*`, `SERVER_PING_TIMEOUT`, `EXECUTE_QUEUE_MAX`,
 * `REQUEST_TIMEOUT`) it is called out on the symbol.
 *
 * These are protocol values, not tuning knobs: changing a state or event
 * string breaks event routing. The numeric timing constants ARE defaults, and
 * {@link ../relay/RelayClient.RelayClient} lets the environment override most
 * of them (`SIGNALWIRE_RELAY_PING_INTERVAL_MS`, `..._PING_MAX_FAILURES`,
 * `..._REQUEST_TIMEOUT_MS`, `..._RECONNECT_MIN_DELAY_S`,
 * `..._RECONNECT_MAX_DELAY_S`).
 */

// Protocol version

/**
 * RELAY protocol version advertised as `params.version` in the
 * `signalwire.connect` handshake. The server uses it to select protocol
 * behavior; it is not a client build number.
 */
export const PROTOCOL_VERSION = { major: 2, minor: 0, revision: 0 };

/**
 * Client identifier sent as `params.agent` in the `signalwire.connect`
 * handshake, so server-side logs and analytics can attribute a session to this
 * SDK and version. Per-port by design — the Python reference sends
 * `signalwire-agents-python/1.0`; this is the TypeScript spelling.
 */
export const AGENT_STRING = '@signalwire/sdk-typescript/2.0';

// JSON-RPC methods

/**
 * JSON-RPC method for the opening handshake. Carries
 * {@link PROTOCOL_VERSION}, {@link AGENT_STRING}, `event_acks: true`, and the
 * credentials (project/token, or a JWT). Must succeed before any other request
 * is honored.
 */
export const METHOD_SIGNALWIRE_CONNECT = 'signalwire.connect';

/**
 * JSON-RPC method the **server** invokes to push an asynchronous event
 * (call state, message state, action completion) to this client. Its
 * `params.event_type` selects the `EVENT_*` constant below that describes the
 * payload.
 */
export const METHOD_SIGNALWIRE_EVENT = 'signalwire.event';

/**
 * JSON-RPC method for the client→server keepalive. Sent on the client ping
 * loop; a failure increments the failure counter bounded by
 * {@link CLIENT_PING_MAX_FAILURES}.
 */
export const METHOD_SIGNALWIRE_PING = 'signalwire.ping';

/**
 * JSON-RPC method for a graceful session teardown, sent before closing the
 * socket so the server can release the session rather than time it out.
 */
export const METHOD_SIGNALWIRE_DISCONNECT = 'signalwire.disconnect';

/**
 * JSON-RPC method that subscribes this client to inbound traffic on a set of
 * contexts — after it succeeds the server may deliver
 * {@link EVENT_CALL_RECEIVE} / {@link EVENT_MESSAGING_RECEIVE} for those
 * contexts. Re-sent after every reconnect, since subscriptions do not survive
 * a dropped socket.
 */
export const METHOD_SIGNALWIRE_RECEIVE = 'signalwire.receive';

/**
 * JSON-RPC method that cancels a {@link METHOD_SIGNALWIRE_RECEIVE}
 * subscription, stopping inbound delivery for those contexts.
 */
export const METHOD_SIGNALWIRE_UNRECEIVE = 'signalwire.unreceive';

// Authorization state event

/**
 * Event type carrying an opaque `authorization_state` blob the server issues
 * mid-session. The client stores the latest value and replays it on reconnect
 * so the session resumes instead of starting cold.
 */
export const EVENT_AUTHORIZATION_STATE = 'signalwire.authorization.state';

// Call states

/**
 * `call_state` when a call object exists but no signaling has progressed yet —
 * the initial state of every leg, inbound or outbound.
 */
export const CALL_STATE_CREATED = 'created';

/** `call_state` while the far end is being alerted and has not yet answered. */
export const CALL_STATE_RINGING = 'ringing';

/** `call_state` once the far end has answered and media is flowing. */
export const CALL_STATE_ANSWERED = 'answered';

/** `call_state` while teardown is in progress but the leg is not yet gone. */
export const CALL_STATE_ENDING = 'ending';

/**
 * `call_state` for a finished leg. The only terminal call state — no further
 * state transitions follow (see
 * {@link ../relay/closedSets.isCallStateTerminal}), and
 * {@link ../relay/RelayClient.RelayClient} drops the call from its registry on
 * reaching it.
 */
export const CALL_STATE_ENDED = 'ended';

/**
 * Every `call_state` the wire may report, in lifecycle order
 * (`created → ringing → answered → ending → ended`). Frozen as a `const`
 * tuple so it can be iterated or membership-tested; the typed union is
 * {@link ../relay/closedSets.CallState}.
 */
export const CALL_STATES = [
  CALL_STATE_CREATED,
  CALL_STATE_RINGING,
  CALL_STATE_ANSWERED,
  CALL_STATE_ENDING,
  CALL_STATE_ENDED,
] as const;

// End reasons

/** `end_reason` for a normal hangup by either party. */
export const END_REASON_HANGUP = 'hangup';

/** `end_reason` for an outbound leg cancelled before the far end answered. */
export const END_REASON_CANCEL = 'cancel';

/** `end_reason` for a far end that rejected the call as busy. */
export const END_REASON_BUSY = 'busy';

/**
 * `end_reason` for a leg that rang out without being answered. Note the
 * camelCase wire spelling `noAnswer` — unlike the other multi-word reasons,
 * which are snake_case. The asymmetry is the server's and is reproduced
 * verbatim on the wire.
 */
export const END_REASON_NO_ANSWER = 'noAnswer';

/** `end_reason` for a far end that actively declined the call. */
export const END_REASON_DECLINE = 'decline';

/** `end_reason` for a leg torn down by a platform or network error. */
export const END_REASON_ERROR = 'error';

/**
 * `end_reason` for a leg the originator abandoned — e.g. the caller hung up
 * while still queued or ringing.
 */
export const END_REASON_ABANDONED = 'abandoned';

/**
 * `end_reason` for a leg the platform ended because it hit its configured
 * maximum duration.
 */
export const END_REASON_MAX_DURATION = 'max_duration';

/**
 * `end_reason` for a destination that could not be resolved — an unroutable
 * number or an unknown resource.
 */
export const END_REASON_NOT_FOUND = 'not_found';

// Connect states

/** `connect_state` while a `calling.call.connect` bridge is being established. */
export const CONNECT_STATE_CONNECTING = 'connecting';

/** `connect_state` once two legs are bridged and media flows between them. */
export const CONNECT_STATE_CONNECTED = 'connected';

/** `connect_state` after a previously connected bridge has been torn down. */
export const CONNECT_STATE_DISCONNECTED = 'disconnected';

/** `connect_state` when the bridge attempt never succeeded. */
export const CONNECT_STATE_FAILED = 'failed';

// Event types

/**
 * `event_type` for a call lifecycle transition. Its `params.call_state` is one
 * of {@link CALL_STATES}. This is the event
 * {@link ../relay/RelayClient.RelayClient} watches to attach a newly-dialed
 * leg to its pending dial (via `params.tag`).
 */
export const EVENT_CALL_STATE = 'calling.call.state';

/**
 * `event_type` for an inbound call arriving on a subscribed context (see
 * {@link METHOD_SIGNALWIRE_RECEIVE}). Delivers the new call to the client's
 * inbound-call handler.
 */
export const EVENT_CALL_RECEIVE = 'calling.call.receive';

/**
 * `event_type` for bridge progress between two legs; its `params.connect_state`
 * is one of the `CONNECT_STATE_*` values.
 */
export const EVENT_CALL_CONNECT = 'calling.call.connect';

/**
 * `event_type` for playback progress; its `params.state` is one of the
 * `PLAY_STATE_*` values. Completes a `PlayAction` on
 * {@link PLAY_STATE_FINISHED} or {@link PLAY_STATE_ERROR}.
 */
export const EVENT_CALL_PLAY = 'calling.call.play';

/**
 * `event_type` for digit/speech collection progress. Completes a collect action
 * on `finished`, `error`, `no_input`, or `no_match`.
 */
export const EVENT_CALL_COLLECT = 'calling.call.collect';

/**
 * `event_type` for recording progress; its `params.state` is one of the
 * `RECORD_STATE_*` values. Completes a `RecordAction` on
 * {@link RECORD_STATE_FINISHED} or {@link RECORD_STATE_NO_INPUT}.
 */
export const EVENT_CALL_RECORD = 'calling.call.record';

/**
 * `event_type` for answering-machine / fax / DTMF detection progress; its
 * result type is one of the `DETECT_TYPE_*` values. Completes on `finished`
 * or `error`.
 */
export const EVENT_CALL_DETECT = 'calling.call.detect';

/** `event_type` for fax send/receive progress; completes on `finished` or `error`. */
export const EVENT_CALL_FAX = 'calling.call.fax';

/** `event_type` for media-tap (stream-fork) progress; completes on `finished`. */
export const EVENT_CALL_TAP = 'calling.call.tap';

/** `event_type` for DTMF send progress on a `send_digits` request. */
export const EVENT_CALL_SEND_DIGITS = 'calling.call.send_digits';

/**
 * `event_type` for outbound dial progress. Its `params.dial_state`
 * ({@link ../relay/closedSets.DialState}) resolves a serial/parallel dial to
 * `answered` or `failed`; {@link ../relay/RelayClient.RelayClient} joins it to
 * the originating request by `params.tag`.
 */
export const EVENT_CALL_DIAL = 'calling.call.dial';

/** `event_type` for SIP REFER (call transfer) progress. */
export const EVENT_CALL_REFER = 'calling.call.refer';

/** `event_type` for background-noise-removal (denoise) state changes on a leg. */
export const EVENT_CALL_DENOISE = 'calling.call.denoise';

/**
 * `event_type` for pay/IVR payment-collection progress; completes on
 * `finished` or `error`.
 */
export const EVENT_CALL_PAY = 'calling.call.pay';

/** `event_type` for call-queue progress (enqueue, position changes, dequeue). */
export const EVENT_CALL_QUEUE = 'calling.call.queue';

/**
 * `event_type` for outbound audio-stream progress (media forwarded to a
 * WebSocket sink); completes on `finished`.
 */
export const EVENT_CALL_STREAM = 'calling.call.stream';

/** `event_type` for echo-test progress on a leg. */
export const EVENT_CALL_ECHO = 'calling.call.echo';

/**
 * `event_type` for live-transcription progress, carrying interim and final
 * transcript segments; completes on `finished`.
 */
export const EVENT_CALL_TRANSCRIBE = 'calling.call.transcribe';

/** `event_type` for hold/unhold state changes on a leg. */
export const EVENT_CALL_HOLD = 'calling.call.hold';

/** `event_type` for conference-room membership and state changes. */
export const EVENT_CONFERENCE = 'calling.conference';

/**
 * `event_type` for a calling-namespace error the server reports out-of-band —
 * i.e. not as the JSON-RPC error of any one request.
 */
export const EVENT_CALLING_ERROR = 'calling.error';

// Messaging event types

/**
 * `event_type` for an inbound SMS/MMS arriving on a subscribed context (see
 * {@link METHOD_SIGNALWIRE_RECEIVE}).
 */
export const EVENT_MESSAGING_RECEIVE = 'messaging.receive';

/**
 * `event_type` for an outbound message's delivery-state change; its
 * `params.message_state` is one of the `MESSAGE_STATE_*` values.
 */
export const EVENT_MESSAGING_STATE = 'messaging.state';

// Message states

/** `message_state` for a message accepted by the platform but not yet dispatched. */
export const MESSAGE_STATE_QUEUED = 'queued';

/** `message_state` for a message whose send to the carrier has begun. */
export const MESSAGE_STATE_INITIATED = 'initiated';

/**
 * `message_state` for a message handed off to the carrier. Not terminal —
 * a delivery receipt may still upgrade it to `delivered` or `undelivered`.
 */
export const MESSAGE_STATE_SENT = 'sent';

/** `message_state` for a message the carrier confirmed as delivered. Terminal. */
export const MESSAGE_STATE_DELIVERED = 'delivered';

/**
 * `message_state` for a message the carrier accepted but could not deliver.
 * Terminal.
 */
export const MESSAGE_STATE_UNDELIVERED = 'undelivered';

/** `message_state` for a message that failed before or during send. Terminal. */
export const MESSAGE_STATE_FAILED = 'failed';

/**
 * `message_state` of an inbound message (see {@link EVENT_MESSAGING_RECEIVE}).
 * Inbound messages arrive in this state directly and never walk the outbound
 * `queued → … → delivered` path.
 */
export const MESSAGE_STATE_RECEIVED = 'received';

/**
 * The `message_state` values after which no further
 * {@link EVENT_MESSAGING_STATE} will arrive for that message.
 * {@link ../relay/Message.Message} settles its completion promise when the
 * state enters this set. Typed mirror:
 * {@link ../relay/closedSets.MESSAGE_STATE_TERMINAL}.
 */
export const MESSAGE_TERMINAL_STATES = [
  MESSAGE_STATE_DELIVERED,
  MESSAGE_STATE_UNDELIVERED,
  MESSAGE_STATE_FAILED,
] as const;

// Play states

/** `state` on a {@link EVENT_CALL_PLAY} event while audio is actively playing. */
export const PLAY_STATE_PLAYING = 'playing';

/**
 * `state` on a {@link EVENT_CALL_PLAY} event while playback is paused and
 * resumable. Not terminal.
 */
export const PLAY_STATE_PAUSED = 'paused';

/**
 * `state` on a {@link EVENT_CALL_PLAY} event when playback ran to completion or
 * was stopped. Terminal — resolves the pending `PlayAction`.
 */
export const PLAY_STATE_FINISHED = 'finished';

/**
 * `state` on a {@link EVENT_CALL_PLAY} event when playback failed (e.g. an
 * unreachable or undecodable audio URL). Terminal — resolves the pending
 * `PlayAction` with the failure.
 */
export const PLAY_STATE_ERROR = 'error';

// Record states

/** `state` on a {@link EVENT_CALL_RECORD} event while audio is being captured. */
export const RECORD_STATE_RECORDING = 'recording';

/**
 * `state` on a {@link EVENT_CALL_RECORD} event while recording is paused and
 * resumable. Not terminal.
 */
export const RECORD_STATE_PAUSED = 'paused';

/**
 * `state` on a {@link EVENT_CALL_RECORD} event when the recording completed and
 * the resulting media is available. Terminal — resolves the pending
 * `RecordAction`.
 */
export const RECORD_STATE_FINISHED = 'finished';

/**
 * `state` on a {@link EVENT_CALL_RECORD} event when the recording ended without
 * capturing any audio (nothing was spoken before the input timeout). Terminal —
 * resolves the pending `RecordAction`, and is distinct from a failure.
 */
export const RECORD_STATE_NO_INPUT = 'no_input';

// Detect types

/**
 * Detector type for answering-machine detection — the
 * {@link EVENT_CALL_DETECT} result distinguishes a human from voicemail.
 */
export const DETECT_TYPE_MACHINE = 'machine';

/** Detector type for fax-tone (CNG/CED) detection. */
export const DETECT_TYPE_FAX = 'fax';

/** Detector type for in-band DTMF digit detection. */
export const DETECT_TYPE_DIGIT = 'digit';

// Join room states

/** Room membership state while the join is in flight. */
export const ROOM_STATE_JOINING = 'joining';

/** Room membership state once the participant is in the room. */
export const ROOM_STATE_JOIN = 'join';

/** Room membership state while the participant is being removed. */
export const ROOM_STATE_LEAVING = 'leaving';

/** Room membership state once the participant has left. Terminal. */
export const ROOM_STATE_LEAVE = 'leave';

// Reconnect settings

/**
 * Seconds to wait before the FIRST reconnect attempt after a dropped
 * connection, and the base the exponential backoff grows from. Overridable via
 * `SIGNALWIRE_RELAY_RECONNECT_MIN_DELAY_S`.
 */
export const RECONNECT_MIN_DELAY = 1.0;

/**
 * Ceiling in seconds for the reconnect backoff — the delay grows by
 * {@link RECONNECT_BACKOFF_FACTOR} per attempt but never exceeds this, so a
 * long outage retries at a steady 30s rather than drifting to hours.
 * Overridable via `SIGNALWIRE_RELAY_RECONNECT_MAX_DELAY_S`.
 */
export const RECONNECT_MAX_DELAY = 30.0;

/**
 * Multiplier applied to the reconnect delay after each failed attempt
 * (`delay = min(delay * factor, RECONNECT_MAX_DELAY)`), i.e. a doubling
 * backoff. Also the base of the per-failure client-ping backoff
 * (`RECONNECT_MIN_DELAY * factor ** failures`).
 */
export const RECONNECT_BACKOFF_FACTOR = 2.0;

// Ping settings

/**
 * Milliseconds between client→server {@link METHOD_SIGNALWIRE_PING} keepalives.
 * TypeScript-only: the Python reference uses a monkeypatchable
 * `_CLIENT_PING_INTERVAL`. Overridable via
 * `SIGNALWIRE_RELAY_PING_INTERVAL_MS`.
 */
export const CLIENT_PING_INTERVAL = 30_000; // 30s

/**
 * Consecutive client-ping failures tolerated before the client gives up on the
 * socket and forces a close, triggering the reconnect loop. Reset to zero by
 * any successful ping or any server ping. Overridable via
 * `SIGNALWIRE_RELAY_PING_MAX_FAILURES`.
 */
export const CLIENT_PING_MAX_FAILURES = 3;

/**
 * Milliseconds of silence from the server before the client notes (at debug
 * level) that no server ping has arrived. This is a **watchdog for logging
 * only** — it does not itself close or reconnect the socket; a genuinely dead
 * peer is caught by the client ping loop hitting
 * {@link CLIENT_PING_MAX_FAILURES}. Not overridable by env.
 */
export const SERVER_PING_TIMEOUT = 15_000; // 15s

// Request settings

/**
 * Milliseconds a JSON-RPC request waits for its response before rejecting.
 * Overridable via `SIGNALWIRE_RELAY_REQUEST_TIMEOUT_MS`.
 */
export const REQUEST_TIMEOUT = 30_000; // 30s

/**
 * Maximum number of requests buffered while the client is disconnected. Once
 * the queue is full, further requests reject immediately with a `RelayError`
 * rather than growing the buffer without bound — an unbounded queue would
 * silently accumulate a backlog during a long outage and then flood the server
 * on reconnect. The queue is drained in order once the connection is
 * re-established.
 */
export const EXECUTE_QUEUE_MAX = 500;

// Default host

/**
 * Hostname used to build the RELAY WebSocket URL when the caller supplies
 * neither an explicit host nor one via the environment.
 */
export const DEFAULT_RELAY_HOST = 'relay.signalwire.com';
