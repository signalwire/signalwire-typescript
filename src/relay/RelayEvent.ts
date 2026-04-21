/**
 * Typed event wrappers for RELAY calling events.
 *
 * These are convenience classes over raw event dicts. All Call event handlers
 * also accept the raw dict, so these are optional.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  readonly params: Record<string, any>;
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
  constructor(
    eventType: string,
    params: Record<string, any>,
    callId = '',
    timestamp = 0,
  ) {
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
  static fromPayload(payload: Record<string, any>): RelayEvent {
    const eventType = payload.event_type ?? '';
    const params = payload.params ?? {};
    return new RelayEvent(
      eventType,
      params,
      params.call_id ?? '',
      params.timestamp ?? 0,
    );
  }
}

// ─── Helper ──────────────────────────────────────────────────────────

function baseFields(payload: Record<string, any>) {
  const eventType = payload.event_type ?? '';
  const params = payload.params ?? {};
  return {
    eventType,
    params,
    callId: (params.call_id ?? '') as string,
    timestamp: (params.timestamp ?? 0) as number,
  };
}

// ─── Call Events ─────────────────────────────────────────────────────

/** `calling.call.state` — fires on every lifecycle transition (created, ringing, answered, ending, ended). */
export class CallStateEvent extends RelayEvent {
  readonly callState: string;
  readonly endReason: string;
  readonly direction: string;
  readonly device: Record<string, any>;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    callState: string,
    endReason: string,
    direction: string,
    device: Record<string, any>,
  ) {
    super(eventType, params, callId, timestamp);
    this.callState = callState;
    this.endReason = endReason;
    this.direction = direction;
    this.device = device;
  }

  static override fromPayload(payload: Record<string, any>): CallStateEvent {
    const b = baseFields(payload);
    return new CallStateEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.call_state ?? '',
      b.params.end_reason ?? '',
      b.params.direction ?? '',
      b.params.device ?? {},
    );
  }
}

/** `calling.call.receive` — fires when an inbound call arrives on a subscribed context. */
export class CallReceiveEvent extends RelayEvent {
  readonly callState: string;
  readonly direction: string;
  readonly device: Record<string, any>;
  readonly nodeId: string;
  readonly projectId: string;
  readonly context: string;
  readonly segmentId: string;
  readonly tag: string;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    callState: string,
    direction: string,
    device: Record<string, any>,
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

  static override fromPayload(payload: Record<string, any>): CallReceiveEvent {
    const b = baseFields(payload);
    return new CallReceiveEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.call_state ?? '',
      b.params.direction ?? '',
      b.params.device ?? {},
      b.params.node_id ?? '',
      b.params.project_id ?? '',
      b.params.context ?? b.params.protocol ?? '',
      b.params.segment_id ?? '',
      b.params.tag ?? '',
    );
  }
}

/** `calling.call.play` — play-media action state change (`playing`, `paused`, `finished`, `error`). */
export class PlayEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
  }

  static override fromPayload(payload: Record<string, any>): PlayEvent {
    const b = baseFields(payload);
    return new PlayEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.state ?? '',
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
  readonly record: Record<string, any>;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
    url: string,
    duration: number,
    size: number,
    record: Record<string, any>,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
    this.url = url;
    this.duration = duration;
    this.size = size;
    this.record = record;
  }

  static override fromPayload(payload: Record<string, any>): RecordEvent {
    const b = baseFields(payload);
    const rec = b.params.record ?? {};
    return new RecordEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.state ?? '',
      rec.url ?? b.params.url ?? '',
      rec.duration ?? b.params.duration ?? 0,
      rec.size ?? b.params.size ?? 0,
      rec,
    );
  }
}

/** `calling.call.collect` — caller input (DTMF or speech) collected by a collect action. */
export class CollectEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;
  readonly result: Record<string, any>;
  readonly final: boolean | undefined;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    controlId: string = '',
    state: string = '',
    result: Record<string, any> = {},
    final_: boolean | undefined = undefined,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
    this.result = result;
    this.final = final_;
  }

  static override fromPayload(payload: Record<string, any>): CollectEvent {
    const b = baseFields(payload);
    return new CollectEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.state ?? '',
      b.params.result ?? {},
      b.params.final,
    );
  }
}

/** `calling.call.connect` — state transition when one call connects to another (dialplan/bridge). */
export class ConnectEvent extends RelayEvent {
  readonly connectState: string;
  readonly peer: Record<string, any>;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    connectState: string,
    peer: Record<string, any>,
  ) {
    super(eventType, params, callId, timestamp);
    this.connectState = connectState;
    this.peer = peer;
  }

  static override fromPayload(payload: Record<string, any>): ConnectEvent {
    const b = baseFields(payload);
    return new ConnectEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.connect_state ?? '',
      b.params.peer ?? {},
    );
  }
}

/** `calling.call.detect` — answering-machine / fax / DTMF detection result. */
export class DetectEvent extends RelayEvent {
  readonly controlId: string;
  readonly detect: Record<string, any>;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    controlId: string,
    detect: Record<string, any>,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.detect = detect;
  }

  static override fromPayload(payload: Record<string, any>): DetectEvent {
    const b = baseFields(payload);
    return new DetectEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.detect ?? {},
    );
  }
}

/** `calling.call.fax` — fax send/receive progress update. */
export class FaxEvent extends RelayEvent {
  readonly controlId: string;
  readonly fax: Record<string, any>;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    controlId: string,
    fax: Record<string, any>,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.fax = fax;
  }

  static override fromPayload(payload: Record<string, any>): FaxEvent {
    const b = baseFields(payload);
    return new FaxEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.fax ?? {},
    );
  }
}

/** `calling.call.tap` — media tap state change (audio mirror to an external endpoint). */
export class TapEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;
  readonly tap: Record<string, any>;
  readonly device: Record<string, any>;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
    tap: Record<string, any>,
    device: Record<string, any>,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
    this.tap = tap;
    this.device = device;
  }

  static override fromPayload(payload: Record<string, any>): TapEvent {
    const b = baseFields(payload);
    return new TapEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.state ?? '',
      b.params.tap ?? {},
      b.params.device ?? {},
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
    params: Record<string, any>,
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

  static override fromPayload(payload: Record<string, any>): StreamEvent {
    const b = baseFields(payload);
    return new StreamEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.state ?? '',
      b.params.url ?? '',
      b.params.name ?? '',
    );
  }
}

/** `calling.call.send_digits` — progress update for DTMF digits sent out on a call. */
export class SendDigitsEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
  }

  static override fromPayload(payload: Record<string, any>): SendDigitsEvent {
    const b = baseFields(payload);
    return new SendDigitsEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.state ?? '',
    );
  }
}

/** `calling.call.dial` — outbound dial progress (answered, failed, no-answer, etc.). */
export class DialEvent extends RelayEvent {
  readonly tag: string;
  readonly dialState: string;
  readonly call: Record<string, any>;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    tag: string,
    dialState: string,
    call: Record<string, any>,
  ) {
    super(eventType, params, callId, timestamp);
    this.tag = tag;
    this.dialState = dialState;
    this.call = call;
  }

  static override fromPayload(payload: Record<string, any>): DialEvent {
    const b = baseFields(payload);
    return new DialEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.tag ?? '',
      b.params.dial_state ?? '',
      b.params.call ?? {},
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
    params: Record<string, any>,
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

  static override fromPayload(payload: Record<string, any>): ReferEvent {
    const b = baseFields(payload);
    return new ReferEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.state ?? '',
      b.params.sip_refer_to ?? '',
      b.params.sip_refer_response_code ?? '',
      b.params.sip_notify_response_code ?? '',
    );
  }
}

/** `calling.call.denoise` — noise-reduction on/off confirmation. */
export class DenoiseEvent extends RelayEvent {
  readonly denoised: boolean;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    denoised: boolean,
  ) {
    super(eventType, params, callId, timestamp);
    this.denoised = denoised;
  }

  static override fromPayload(payload: Record<string, any>): DenoiseEvent {
    const b = baseFields(payload);
    return new DenoiseEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.denoised ?? false,
    );
  }
}

/** `calling.call.pay` — PCI-compliant payment collection progress update. */
export class PayEvent extends RelayEvent {
  readonly controlId: string;
  readonly state: string;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    controlId: string,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.controlId = controlId;
    this.state = state;
  }

  static override fromPayload(payload: Record<string, any>): PayEvent {
    const b = baseFields(payload);
    return new PayEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.state ?? '',
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
    params: Record<string, any>,
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

  static override fromPayload(payload: Record<string, any>): QueueEvent {
    const b = baseFields(payload);
    return new QueueEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.status ?? '',
      b.params.id ?? '',
      b.params.name ?? '',
      b.params.position ?? 0,
      b.params.size ?? 0,
    );
  }
}

/** `calling.call.echo` — test/diagnostic echo reflection from the server. */
export class EchoEvent extends RelayEvent {
  readonly state: string;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.state = state;
  }

  static override fromPayload(payload: Record<string, any>): EchoEvent {
    const b = baseFields(payload);
    return new EchoEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.state ?? '',
    );
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
    params: Record<string, any>,
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

  static override fromPayload(payload: Record<string, any>): TranscribeEvent {
    const b = baseFields(payload);
    return new TranscribeEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.control_id ?? '',
      b.params.state ?? '',
      b.params.url ?? '',
      b.params.recording_id ?? '',
      b.params.duration ?? 0,
      b.params.size ?? 0,
    );
  }
}

/** `calling.call.hold` — hold/unhold state change on the call. */
export class HoldEvent extends RelayEvent {
  readonly state: string;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    state: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.state = state;
  }

  static override fromPayload(payload: Record<string, any>): HoldEvent {
    const b = baseFields(payload);
    return new HoldEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.state ?? '',
    );
  }
}

/** `calling.conference` — conference lifecycle change (created, active, ended). */
export class ConferenceEvent extends RelayEvent {
  readonly conferenceId: string;
  readonly name: string;
  readonly status: string;

  constructor(
    eventType: string,
    params: Record<string, any>,
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

  static override fromPayload(payload: Record<string, any>): ConferenceEvent {
    const b = baseFields(payload);
    return new ConferenceEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.conference_id ?? '',
      b.params.name ?? '',
      b.params.status ?? '',
    );
  }
}

/** `calling.error` — platform-emitted error against the calling namespace. */
export class CallingErrorEvent extends RelayEvent {
  readonly code: string;
  readonly message: string;

  constructor(
    eventType: string,
    params: Record<string, any>,
    callId: string,
    timestamp: number,
    code: string,
    message: string,
  ) {
    super(eventType, params, callId, timestamp);
    this.code = code;
    this.message = message;
  }

  static override fromPayload(payload: Record<string, any>): CallingErrorEvent {
    const b = baseFields(payload);
    return new CallingErrorEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.code ?? '',
      b.params.message ?? '',
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
    params: Record<string, any>,
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

  static override fromPayload(payload: Record<string, any>): MessageReceiveEvent {
    const b = baseFields(payload);
    return new MessageReceiveEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.message_id ?? '',
      b.params.context ?? '',
      b.params.direction ?? '',
      b.params.from_number ?? '',
      b.params.to_number ?? '',
      b.params.body ?? '',
      b.params.media ?? [],
      b.params.segments ?? 0,
      b.params.message_state ?? '',
      b.params.tags ?? [],
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
  readonly messageState: string;
  readonly reason: string;
  readonly tags: string[];

  constructor(
    eventType: string,
    params: Record<string, any>,
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

  static override fromPayload(payload: Record<string, any>): MessageStateEvent {
    const b = baseFields(payload);
    return new MessageStateEvent(
      b.eventType, b.params, b.callId, b.timestamp,
      b.params.message_id ?? '',
      b.params.context ?? '',
      b.params.direction ?? '',
      b.params.from_number ?? '',
      b.params.to_number ?? '',
      b.params.body ?? '',
      b.params.media ?? [],
      b.params.segments ?? 0,
      b.params.message_state ?? '',
      b.params.reason ?? '',
      b.params.tags ?? [],
    );
  }
}

// ─── Event Class Map & Parser ────────────────────────────────────────

/** Structural type for an event class that exposes a `fromPayload` factory. */
export type EventClass = { fromPayload(payload: Record<string, any>): RelayEvent };

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
export function parseEvent(payload: Record<string, any>): RelayEvent {
  const eventType = payload.event_type ?? '';
  const cls = EVENT_CLASS_MAP[eventType] ?? RelayEvent;
  return cls.fromPayload(payload);
}
