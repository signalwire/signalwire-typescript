/**
 * Typed event wrappers for RELAY calling events.
 *
 * These are convenience classes over raw event dicts. All Call event handlers
 * also accept the raw dict, so these are optional.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Base Event ──────────────────────────────────────────────────────

export class RelayEvent {
  readonly eventType: string;
  readonly params: Record<string, any>;
  readonly callId: string;
  readonly timestamp: number;

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

export type EventClass = { fromPayload(payload: Record<string, any>): RelayEvent };

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
