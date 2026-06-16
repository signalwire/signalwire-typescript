/**
 * Typed event wrappers for RELAY calling events.
 *
 * These are convenience classes over raw event dicts. All Call event handlers
 * also accept the raw dict, so these are optional.
 */

import type { CallState, DialState, MessageState } from './closedSets.js';
import type { Device } from './types.js';

/**
 * Raw RELAY wire payload — a `signalwire.event` notification dict. Field
 * names/types are server-defined; access goes through {@link pick}, which
 * applies a boundary cast to the expected field type while preserving the
 * exact `value ?? default` runtime semantics.
 */
type EventPayload = Record<string, unknown>;

/**
 * Boundary accessor for raw wire fields. Compile-time only: identical at
 * runtime to `value ?? fallback` — no coercion happens, the cast just tells
 * the type system the field's documented shape. Used to read known fields off
 * an open {@link EventPayload}.
 */
function pick<T>(value: unknown, fallback: T): T {
  return (value ?? fallback) as T;
}

// ─── Base Event ──────────────────────────────────────────────────────

/**
 * Base class for all typed RELAY events.
 *
 * Raw events arrive as `signalwire.event` JSON-RPC notifications; the client
 * looks up the correct subclass in {@link EVENT_CLASS_MAP} and invokes
 * {@link RelayEvent.fromPayload} to build a typed wrapper. Handlers receive
 * this wrapper; they can always read the original dict from `params`.
 */
export class RelayEvent {
  /** Fully-qualified event type (e.g. `"calling.call.state"`). */
  readonly eventType: string;
  /** Raw params dict from the RELAY notification. */
  readonly params: EventPayload;
  /** Call ID associated with the event, or `""` for non-call events. */
  readonly callId: string;
  /** Server timestamp (epoch seconds) at which the event was emitted. */
  readonly timestamp: number;

  /**
   * @param eventType - Fully-qualified event type.
   * @param params - Raw event params dict.
   * @param callId - Call ID (if applicable).
   * @param timestamp - Server-side event timestamp.
   */
  constructor(eventType: string, params: EventPayload, callId = '', timestamp = 0) {
    this.eventType = eventType;
    this.params = params;
    this.callId = callId;
    this.timestamp = timestamp;
  }

  /**
   * Factory that builds a typed event from a raw `signalwire.event` payload.
   * Subclasses override this to populate their specialised fields; the base
   * implementation returns a minimal `RelayEvent` used as the fallback for
   * unrecognised event types.
   */
  static fromPayload(payload: EventPayload): RelayEvent {
    const eventType = pick(payload.event_type, '');
    const params = pick<EventPayload>(payload.params, {});
    return new RelayEvent(eventType, params, pick(params.call_id, ''), pick(params.timestamp, 0));
  }
}

// ─── Helper ──────────────────────────────────────────────────────────

function baseFields(payload: EventPayload): {
  eventType: string;
  params: EventPayload;
  callId: string;
  timestamp: number;
} {
  const eventType = pick(payload.event_type, '');
  const params = pick<EventPayload>(payload.params, {});
  return {
    eventType,
    params,
    callId: pick(params.call_id, ''),
    timestamp: pick(params.timestamp, 0),
  };
}

// ─── Call Events ─────────────────────────────────────────────────────

/** `calling.call.state` — fires on every lifecycle transition (created, ringing, answered, ending, ended). */
export class CallStateEvent extends RelayEvent {
  /**
   * The new call state — a {@link CallState} (`created` | `ringing` |
   * `answered` | `ending` | `ended`; closed literal union, autocompleted +
   * typo-checked). Pass to {@link ../relay/closedSets.isCallStateTerminal} to
   * test for the terminal state.
   */
  readonly callState: CallState;
  readonly endReason: string;
  readonly direction: string;
  readonly device: Device;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    callState: CallState,
    endReason: string,
    direction: string,
    device: Device,
  ) {
    super(eventType, params, callId, timestamp);
    this.callState = callState;
    this.endReason = endReason;
    this.direction = direction;
    this.device = device;
  }

  static override fromPayload(payload: EventPayload): CallStateEvent {
    const b = baseFields(payload);
    return new CallStateEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.call_state, '' as CallState),
      pick(b.params.end_reason, ''),
      pick(b.params.direction, ''),
      pick<Device>(b.params.device, {}),
    );
  }
}

/** `calling.call.receive` — fires when an inbound call arrives on a subscribed context. */
export class CallReceiveEvent extends RelayEvent {
  /** Initial call state ({@link CallState}; typically `created`). */
  readonly callState: CallState;
  readonly direction: string;
  readonly device: Device;
  readonly nodeId: string;
  readonly projectId: string;
  readonly context: string;
  readonly segmentId: string;
  readonly tag: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    callState: CallState,
    direction: string,
    device: Device,
    nodeId: string,
    projectId: string,
    context: string,
    segmentId: string,
    tag: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.callState = callState;
    this.direction = direction;
    this.device = device;
    this.nodeId = nodeId;
    this.projectId = projectId;
    this.context = context;
    this.segmentId = segmentId;
    this.tag = tag;
  }

  static override fromPayload(payload: EventPayload): CallReceiveEvent {
    const b = baseFields(payload);
    return new CallReceiveEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.call_state, '' as CallState),
      pick(b.params.direction, ''),
      pick<Device>(b.params.device, {}),
      pick(b.params.node_id, ''),
      pick(b.params.project_id, ''),
      pick(b.params.context, pick(b.params.protocol, '')),
      pick(b.params.segment_id, ''),
      pick(b.params.tag, ''),
    );
  }
}

/** `calling.call.play` — play-media action state change (`playing`, `paused`, `finished`, `error`). */
export class PlayEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
  }

  static override fromPayload(payload: EventPayload): PlayEvent {
    const b = baseFields(payload);
    return new PlayEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick(b.params.state, ''),
    );
  }
}

/** `calling.call.record` — recording state change with final URL, duration, and size when finished. */
export class RecordEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;
  readonly url: string;
  readonly duration: number;
  readonly size: number;
  readonly record: EventPayload;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
    url: string,
    duration: number,
    size: number,
    record: EventPayload,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
    this.url = url;
    this.duration = duration;
    this.size = size;
    this.record = record;
  }

  static override fromPayload(payload: EventPayload): RecordEvent {
    const b = baseFields(payload);
    const rec = pick<EventPayload>(b.params.record, {});
    return new RecordEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick(b.params.state, ''),
      pick(rec.url, pick(b.params.url, '')),
      pick(rec.duration, pick(b.params.duration, 0)),
      pick(rec.size, pick(b.params.size, 0)),
      rec,
    );
  }
}

/** `calling.call.collect` — caller input (DTMF or speech) collected by a collect action. */
export class CollectEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;
  readonly result: EventPayload;
  readonly final: boolean | undefined;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string = '',
    state: string = '',
    result: EventPayload = {},
    final_: boolean | undefined = undefined,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
    this.result = result;
    this.final = final_;
  }

  static override fromPayload(payload: EventPayload): CollectEvent {
    const b = baseFields(payload);
    return new CollectEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick(b.params.state, ''),
      pick<EventPayload>(b.params.result, {}),
      b.params.final as boolean | undefined,
    );
  }
}

/** `calling.call.connect` — state transition when one call connects to another (dialplan/bridge). */
export class ConnectEvent extends RelayEvent {
  readonly connectState: string;
  readonly peer: EventPayload;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    connectState: string,
    peer: EventPayload,
  ) {
    super(eventType, params, callId, timestamp);
    this.connectState = connectState;
    this.peer = peer;
  }

  static override fromPayload(payload: EventPayload): ConnectEvent {
    const b = baseFields(payload);
    return new ConnectEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.connect_state, ''),
      pick<EventPayload>(b.params.peer, {}),
    );
  }
}

/** `calling.call.detect` — answering-machine / fax / DTMF detection result. */
export class DetectEvent extends RelayEvent {
  readonly controlId: string;
  readonly detect: EventPayload;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    detect: EventPayload,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.detect = detect;
  }

  static override fromPayload(payload: EventPayload): DetectEvent {
    const b = baseFields(payload);
    return new DetectEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick<EventPayload>(b.params.detect, {}),
    );
  }
}

/** `calling.call.fax` — fax send/receive progress update. */
export class FaxEvent extends RelayEvent {
  readonly controlId: string;
  readonly fax: EventPayload;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    fax: EventPayload,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.fax = fax;
  }

  static override fromPayload(payload: EventPayload): FaxEvent {
    const b = baseFields(payload);
    return new FaxEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick<EventPayload>(b.params.fax, {}),
    );
  }
}

/** `calling.call.tap` — media tap state change (audio mirror to an external endpoint). */
export class TapEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;
  readonly tap: EventPayload;
  readonly device: Device;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
    tap: EventPayload,
    device: Device,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
    this.tap = tap;
    this.device = device;
  }

  static override fromPayload(payload: EventPayload): TapEvent {
    const b = baseFields(payload);
    return new TapEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick(b.params.state, ''),
      pick<EventPayload>(b.params.tap, {}),
      pick<Device>(b.params.device, {}),
    );
  }
}

/** `calling.call.stream` — outbound media stream state change (e.g. RTMP/WebSocket streaming). */
export class StreamEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;
  readonly url: string;
  readonly name: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
    url: string,
    name: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
    this.url = url;
    this.name = name;
  }

  static override fromPayload(payload: EventPayload): StreamEvent {
    const b = baseFields(payload);
    return new StreamEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick(b.params.state, ''),
      pick(b.params.url, ''),
      pick(b.params.name, ''),
    );
  }
}

/** `calling.call.send_digits` — progress update for DTMF digits sent out on a call. */
export class SendDigitsEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
  }

  static override fromPayload(payload: EventPayload): SendDigitsEvent {
    const b = baseFields(payload);
    return new SendDigitsEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick(b.params.state, ''),
    );
  }
}

/** `calling.call.dial` — outbound dial progress (answered, failed, no-answer, etc.). */
export class DialEvent extends RelayEvent {
  readonly tag: string;
  /**
   * Outbound-dial state — a {@link DialState} (`dialing` | `answered` |
   * `failed`; closed literal union, autocompleted + typo-checked). Pass to
   * {@link ../relay/closedSets.isDialStateTerminal} to test for resolution.
   * Distinct from a {@link CallState}.
   */
  readonly dialState: DialState;
  readonly call: EventPayload;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    tag: string,
    dialState: DialState,
    call: EventPayload,
  ) {
    super(eventType, params, callId, timestamp);
    this.tag = tag;
    this.dialState = dialState;
    this.call = call;
  }

  static override fromPayload(payload: EventPayload): DialEvent {
    const b = baseFields(payload);
    return new DialEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.tag, ''),
      pick(b.params.dial_state, '' as DialState),
      pick<EventPayload>(b.params.call, {}),
    );
  }
}

/** `calling.call.refer` — SIP REFER result (off-platform transfer response codes). */
export class ReferEvent extends RelayEvent {
  readonly state: string;
  readonly sipReferTo: string;
  readonly sipReferResponseCode: string;
  readonly sipNotifyResponseCode: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    state: string,
    sipReferTo: string,
    sipReferResponseCode: string,
    sipNotifyResponseCode: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.state = state;
    this.sipReferTo = sipReferTo;
    this.sipReferResponseCode = sipReferResponseCode;
    this.sipNotifyResponseCode = sipNotifyResponseCode;
  }

  static override fromPayload(payload: EventPayload): ReferEvent {
    const b = baseFields(payload);
    return new ReferEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.state, ''),
      pick(b.params.sip_refer_to, ''),
      pick(b.params.sip_refer_response_code, ''),
      pick(b.params.sip_notify_response_code, ''),
    );
  }
}

/** `calling.call.denoise` — noise-reduction on/off confirmation. */
export class DenoiseEvent extends RelayEvent {
  readonly denoised: boolean;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    denoised: boolean,
  ) {
    super(eventType, params, callId, timestamp);
    this.denoised = denoised;
  }

  static override fromPayload(payload: EventPayload): DenoiseEvent {
    const b = baseFields(payload);
    return new DenoiseEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.denoised, false),
    );
  }
}

/** `calling.call.pay` — PCI-compliant payment collection progress update. */
export class PayEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
  }

  static override fromPayload(payload: EventPayload): PayEvent {
    const b = baseFields(payload);
    return new PayEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick(b.params.state, ''),
    );
  }
}

/** `calling.call.queue` — call-queue position update (queued, waiting, member answered, timed out). */
export class QueueEvent extends RelayEvent {
  readonly controlId: string;
  readonly status: string;
  readonly queueId: string;
  readonly queueName: string;
  readonly position: number;
  readonly size: number;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    status: string,
    queueId: string,
    queueName: string,
    position: number,
    size: number,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.status = status;
    this.queueId = queueId;
    this.queueName = queueName;
    this.position = position;
    this.size = size;
  }

  static override fromPayload(payload: EventPayload): QueueEvent {
    const b = baseFields(payload);
    return new QueueEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick(b.params.status, ''),
      pick(b.params.id, ''),
      pick(b.params.name, ''),
      pick(b.params.position, 0),
      pick(b.params.size, 0),
    );
  }
}

/** `calling.call.echo` — test/diagnostic echo reflection from the server. */
export class EchoEvent extends RelayEvent {
  readonly state: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.state = state;
  }

  static override fromPayload(payload: EventPayload): EchoEvent {
    const b = baseFields(payload);
    return new EchoEvent(b.eventType, b.params, b.callId, b.timestamp, pick(b.params.state, ''));
  }
}

/** `calling.call.transcribe` — transcription state change and final URL/duration when finished. */
export class TranscribeEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;
  readonly url: string;
  readonly recordingId: string;
  readonly duration: number;
  readonly size: number;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
    url: string,
    recordingId: string,
    duration: number,
    size: number,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
    this.url = url;
    this.recordingId = recordingId;
    this.duration = duration;
    this.size = size;
  }

  static override fromPayload(payload: EventPayload): TranscribeEvent {
    const b = baseFields(payload);
    return new TranscribeEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.control_id, ''),
      pick(b.params.state, ''),
      pick(b.params.url, ''),
      pick(b.params.recording_id, ''),
      pick(b.params.duration, 0),
      pick(b.params.size, 0),
    );
  }
}

/** `calling.call.hold` — hold/unhold state change on the call. */
export class HoldEvent extends RelayEvent {
  readonly state: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.state = state;
  }

  static override fromPayload(payload: EventPayload): HoldEvent {
    const b = baseFields(payload);
    return new HoldEvent(b.eventType, b.params, b.callId, b.timestamp, pick(b.params.state, ''));
  }
}

/** `calling.conference` — conference lifecycle change (created, active, ended). */
export class ConferenceEvent extends RelayEvent {
  readonly conferenceId: string;
  readonly name: string;
  readonly status: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    conferenceId: string,
    name: string,
    status: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.conferenceId = conferenceId;
    this.name = name;
    this.status = status;
  }

  static override fromPayload(payload: EventPayload): ConferenceEvent {
    const b = baseFields(payload);
    return new ConferenceEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.conference_id, ''),
      pick(b.params.name, ''),
      pick(b.params.status, ''),
    );
  }
}

/** `calling.error` — platform-emitted error against the calling namespace. */
export class CallingErrorEvent extends RelayEvent {
  readonly code: string;
  readonly message: string;

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    code: string,
    message: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.code = code;
    this.message = message;
  }

  static override fromPayload(payload: EventPayload): CallingErrorEvent {
    const b = baseFields(payload);
    return new CallingErrorEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.code, ''),
      pick(b.params.message, ''),
    );
  }
}

// ─── Messaging Events ────────────────────────────────────────────────

/** `messaging.receive` — inbound SMS/MMS received on a subscribed context. */
export class MessageReceiveEvent extends RelayEvent {
  readonly messageId: string;
  readonly context: string;
  readonly direction: string;
  readonly fromNumber: string;
  readonly toNumber: string;
  readonly body: string;
  readonly media: string[];
  readonly segments: number;
  readonly messageState: string;
  readonly tags: string[];

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    messageId: string,
    context: string,
    direction: string,
    fromNumber: string,
    toNumber: string,
    body: string,
    media: string[],
    segments: number,
    messageState: string,
    tags: string[],
  ) {
    super(eventType, params, callId, timestamp);
    this.messageId = messageId;
    this.context = context;
    this.direction = direction;
    this.fromNumber = fromNumber;
    this.toNumber = toNumber;
    this.body = body;
    this.media = media;
    this.segments = segments;
    this.messageState = messageState;
    this.tags = tags;
  }

  static override fromPayload(payload: EventPayload): MessageReceiveEvent {
    const b = baseFields(payload);
    return new MessageReceiveEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.message_id, ''),
      pick(b.params.context, ''),
      pick(b.params.direction, ''),
      pick(b.params.from_number, ''),
      pick(b.params.to_number, ''),
      pick(b.params.body, ''),
      pick<string[]>(b.params.media, []),
      pick(b.params.segments, 0),
      pick(b.params.message_state, ''),
      pick<string[]>(b.params.tags, []),
    );
  }
}

/** `messaging.state` — state change for an outbound message (queued → sent → delivered/failed). */
export class MessageStateEvent extends RelayEvent {
  readonly messageId: string;
  readonly context: string;
  readonly direction: string;
  readonly fromNumber: string;
  readonly toNumber: string;
  readonly body: string;
  readonly media: string[];
  readonly segments: number;
  /**
   * Message lifecycle state — a {@link MessageState} (`queued` |
   * `initiated` | `sent` | `delivered` | `undelivered` | `failed` | `received`;
   * closed literal union, autocompleted + typo-checked). Pass to
   * {@link ../relay/closedSets.isMessageStateTerminal} to test for a final
   * delivery outcome. Distinct from a {@link CallState} /
   * {@link DialState}.
   */
  readonly messageState: MessageState;
  readonly reason: string;
  readonly tags: string[];

  constructor(
    eventType: string,
    params: EventPayload,
    callId: string,
    timestamp: number,
    messageId: string,
    context: string,
    direction: string,
    fromNumber: string,
    toNumber: string,
    body: string,
    media: string[],
    segments: number,
    messageState: MessageState,
    reason: string,
    tags: string[],
  ) {
    super(eventType, params, callId, timestamp);
    this.messageId = messageId;
    this.context = context;
    this.direction = direction;
    this.fromNumber = fromNumber;
    this.toNumber = toNumber;
    this.body = body;
    this.media = media;
    this.segments = segments;
    this.messageState = messageState;
    this.reason = reason;
    this.tags = tags;
  }

  static override fromPayload(payload: EventPayload): MessageStateEvent {
    const b = baseFields(payload);
    return new MessageStateEvent(
      b.eventType,
      b.params,
      b.callId,
      b.timestamp,
      pick(b.params.message_id, ''),
      pick(b.params.context, ''),
      pick(b.params.direction, ''),
      pick(b.params.from_number, ''),
      pick(b.params.to_number, ''),
      pick(b.params.body, ''),
      pick<string[]>(b.params.media, []),
      pick(b.params.segments, 0),
      pick(b.params.message_state, '' as MessageState),
      pick(b.params.reason, ''),
      pick<string[]>(b.params.tags, []),
    );
  }
}

// ─── Event Class Map & Parser ────────────────────────────────────────

/** Structural type for an event class that exposes a `fromPayload` factory. */
export type EventClass = { fromPayload(payload: EventPayload): RelayEvent };

/**
 * Maps RELAY `event_type` strings to the typed event subclass that builds
 * its wrapper. Used by {@link parseEvent} to dispatch raw payloads.
 */
export const EVENT_CLASS_MAP: Record<string, EventClass> = {
  'calling.call.state': CallStateEvent,
  'calling.call.receive': CallReceiveEvent,
  'calling.call.play': PlayEvent,
  'calling.call.record': RecordEvent,
  'calling.call.collect': CollectEvent,
  'calling.call.connect': ConnectEvent,
  'calling.call.detect': DetectEvent,
  'calling.call.fax': FaxEvent,
  'calling.call.tap': TapEvent,
  'calling.call.stream': StreamEvent,
  'calling.call.send_digits': SendDigitsEvent,
  'calling.call.dial': DialEvent,
  'calling.call.refer': ReferEvent,
  'calling.call.denoise': DenoiseEvent,
  'calling.call.pay': PayEvent,
  'calling.call.queue': QueueEvent,
  'calling.call.echo': EchoEvent,
  'calling.call.transcribe': TranscribeEvent,
  'calling.call.hold': HoldEvent,
  'calling.conference': ConferenceEvent,
  'calling.error': CallingErrorEvent,
  'messaging.receive': MessageReceiveEvent,
  'messaging.state': MessageStateEvent,
};

/** Parse a raw signalwire.event params dict into a typed event object. */
export function parseEvent(payload: EventPayload): RelayEvent {
  const eventType = pick(payload.event_type, '');
  const cls = EVENT_CLASS_MAP[eventType] ?? RelayEvent;
  return cls.fromPayload(payload);
}
