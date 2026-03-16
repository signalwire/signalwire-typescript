import { describe, it, expect } from 'vitest';
import {
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
} from '../../src/relay/RelayEvent.js';

describe('RelayEvent', () => {
  it('parses base event from payload', () => {
    const e = RelayEvent.fromPayload({
      event_type: 'test.event',
      params: { call_id: 'c1', timestamp: 1234 },
    });
    expect(e.eventType).toBe('test.event');
    expect(e.callId).toBe('c1');
    expect(e.timestamp).toBe(1234);
    expect(e.params.call_id).toBe('c1');
  });

  it('handles missing fields gracefully', () => {
    const e = RelayEvent.fromPayload({});
    expect(e.eventType).toBe('');
    expect(e.callId).toBe('');
    expect(e.timestamp).toBe(0);
  });
});

describe('CallStateEvent', () => {
  it('parses call state event', () => {
    const e = CallStateEvent.fromPayload({
      event_type: 'calling.call.state',
      params: {
        call_id: 'c1',
        call_state: 'answered',
        end_reason: '',
        direction: 'inbound',
        device: { type: 'phone', params: { to_number: '+1234' } },
      },
    });
    expect(e).toBeInstanceOf(CallStateEvent);
    expect(e.callState).toBe('answered');
    expect(e.direction).toBe('inbound');
    expect(e.device.type).toBe('phone');
    expect(e.endReason).toBe('');
  });
});

describe('CallReceiveEvent', () => {
  it('parses call receive event with context fallback', () => {
    const e = CallReceiveEvent.fromPayload({
      event_type: 'calling.call.receive',
      params: {
        call_id: 'c1',
        call_state: 'ringing',
        direction: 'inbound',
        node_id: 'n1',
        project_id: 'p1',
        protocol: 'office',
        segment_id: 's1',
        tag: 't1',
      },
    });
    expect(e).toBeInstanceOf(CallReceiveEvent);
    expect(e.context).toBe('office'); // falls back to protocol
    expect(e.tag).toBe('t1');
    expect(e.nodeId).toBe('n1');
  });

  it('prefers context over protocol', () => {
    const e = CallReceiveEvent.fromPayload({
      event_type: 'calling.call.receive',
      params: { context: 'myctx', protocol: 'old' },
    });
    expect(e.context).toBe('myctx');
  });
});

describe('PlayEvent', () => {
  it('parses play event', () => {
    const e = PlayEvent.fromPayload({
      event_type: 'calling.call.play',
      params: { call_id: 'c1', control_id: 'ctrl1', state: 'playing' },
    });
    expect(e).toBeInstanceOf(PlayEvent);
    expect(e.controlId).toBe('ctrl1');
    expect(e.state).toBe('playing');
  });
});

describe('RecordEvent', () => {
  it('parses record event with nested record obj', () => {
    const e = RecordEvent.fromPayload({
      event_type: 'calling.call.record',
      params: {
        call_id: 'c1',
        control_id: 'ctrl1',
        state: 'finished',
        record: { url: 'https://example.com/rec.mp3', duration: 12.5, size: 100000 },
      },
    });
    expect(e).toBeInstanceOf(RecordEvent);
    expect(e.url).toBe('https://example.com/rec.mp3');
    expect(e.duration).toBe(12.5);
    expect(e.size).toBe(100000);
  });

  it('falls back to top-level url/duration/size', () => {
    const e = RecordEvent.fromPayload({
      event_type: 'calling.call.record',
      params: {
        call_id: 'c1',
        control_id: 'ctrl1',
        state: 'finished',
        url: 'https://example.com/fallback.mp3',
        duration: 5.0,
        size: 5000,
      },
    });
    expect(e.url).toBe('https://example.com/fallback.mp3');
    expect(e.duration).toBe(5.0);
    expect(e.size).toBe(5000);
  });
});

describe('CollectEvent', () => {
  it('parses collect event', () => {
    const e = CollectEvent.fromPayload({
      event_type: 'calling.call.collect',
      params: {
        call_id: 'c1',
        control_id: 'ctrl1',
        state: 'finished',
        result: { type: 'digit', params: { digits: '1234', terminator: '#' } },
        final: true,
      },
    });
    expect(e).toBeInstanceOf(CollectEvent);
    expect(e.result.type).toBe('digit');
    expect(e.final).toBe(true);
  });
});

describe('ConnectEvent', () => {
  it('parses connect event', () => {
    const e = ConnectEvent.fromPayload({
      event_type: 'calling.call.connect',
      params: { call_id: 'c1', connect_state: 'connected', peer: { call_id: 'c2' } },
    });
    expect(e).toBeInstanceOf(ConnectEvent);
    expect(e.connectState).toBe('connected');
    expect(e.peer.call_id).toBe('c2');
  });
});

describe('DetectEvent', () => {
  it('parses detect event', () => {
    const e = DetectEvent.fromPayload({
      event_type: 'calling.call.detect',
      params: { call_id: 'c1', control_id: 'ctrl1', detect: { type: 'machine', params: { event: 'HUMAN' } } },
    });
    expect(e).toBeInstanceOf(DetectEvent);
    expect(e.detect.type).toBe('machine');
  });
});

describe('FaxEvent', () => {
  it('parses fax event', () => {
    const e = FaxEvent.fromPayload({
      event_type: 'calling.call.fax',
      params: { call_id: 'c1', control_id: 'ctrl1', fax: { type: 'send', pages: 3 } },
    });
    expect(e).toBeInstanceOf(FaxEvent);
    expect(e.fax.pages).toBe(3);
  });
});

describe('TapEvent', () => {
  it('parses tap event', () => {
    const e = TapEvent.fromPayload({
      event_type: 'calling.call.tap',
      params: { call_id: 'c1', control_id: 'ctrl1', state: 'tapping', tap: {}, device: { type: 'rtp' } },
    });
    expect(e).toBeInstanceOf(TapEvent);
    expect(e.state).toBe('tapping');
    expect(e.device.type).toBe('rtp');
  });
});

describe('StreamEvent', () => {
  it('parses stream event', () => {
    const e = StreamEvent.fromPayload({
      event_type: 'calling.call.stream',
      params: { call_id: 'c1', control_id: 'ctrl1', state: 'streaming', url: 'wss://stream', name: 'mystream' },
    });
    expect(e).toBeInstanceOf(StreamEvent);
    expect(e.url).toBe('wss://stream');
    expect(e.name).toBe('mystream');
  });
});

describe('SendDigitsEvent', () => {
  it('parses send_digits event', () => {
    const e = SendDigitsEvent.fromPayload({
      event_type: 'calling.call.send_digits',
      params: { call_id: 'c1', control_id: 'ctrl1', state: 'finished' },
    });
    expect(e).toBeInstanceOf(SendDigitsEvent);
    expect(e.state).toBe('finished');
  });
});

describe('DialEvent', () => {
  it('parses dial event', () => {
    const e = DialEvent.fromPayload({
      event_type: 'calling.call.dial',
      params: { tag: 'tag1', dial_state: 'answered', call: { call_id: 'c1', node_id: 'n1' } },
    });
    expect(e).toBeInstanceOf(DialEvent);
    expect(e.tag).toBe('tag1');
    expect(e.dialState).toBe('answered');
    expect(e.call.call_id).toBe('c1');
  });
});

describe('ReferEvent', () => {
  it('parses refer event', () => {
    const e = ReferEvent.fromPayload({
      event_type: 'calling.call.refer',
      params: {
        call_id: 'c1',
        state: 'completed',
        sip_refer_to: 'sip:+1234@example.com',
        sip_refer_response_code: '202',
        sip_notify_response_code: '200',
      },
    });
    expect(e).toBeInstanceOf(ReferEvent);
    expect(e.sipReferTo).toBe('sip:+1234@example.com');
  });
});

describe('DenoiseEvent', () => {
  it('parses denoise event', () => {
    const e = DenoiseEvent.fromPayload({
      event_type: 'calling.call.denoise',
      params: { call_id: 'c1', denoised: true },
    });
    expect(e).toBeInstanceOf(DenoiseEvent);
    expect(e.denoised).toBe(true);
  });
});

describe('PayEvent', () => {
  it('parses pay event', () => {
    const e = PayEvent.fromPayload({
      event_type: 'calling.call.pay',
      params: { call_id: 'c1', control_id: 'ctrl1', state: 'processing' },
    });
    expect(e).toBeInstanceOf(PayEvent);
    expect(e.state).toBe('processing');
  });
});

describe('QueueEvent', () => {
  it('parses queue event', () => {
    const e = QueueEvent.fromPayload({
      event_type: 'calling.call.queue',
      params: { call_id: 'c1', control_id: 'ctrl1', status: 'entered', id: 'q1', name: 'support', position: 3, size: 10 },
    });
    expect(e).toBeInstanceOf(QueueEvent);
    expect(e.queueId).toBe('q1');
    expect(e.queueName).toBe('support');
    expect(e.position).toBe(3);
    expect(e.size).toBe(10);
  });
});

describe('EchoEvent', () => {
  it('parses echo event', () => {
    const e = EchoEvent.fromPayload({
      event_type: 'calling.call.echo',
      params: { call_id: 'c1', state: 'active' },
    });
    expect(e).toBeInstanceOf(EchoEvent);
    expect(e.state).toBe('active');
  });
});

describe('TranscribeEvent', () => {
  it('parses transcribe event', () => {
    const e = TranscribeEvent.fromPayload({
      event_type: 'calling.call.transcribe',
      params: { call_id: 'c1', control_id: 'ctrl1', state: 'finished', url: 'https://url', recording_id: 'r1', duration: 30.0, size: 500000 },
    });
    expect(e).toBeInstanceOf(TranscribeEvent);
    expect(e.recordingId).toBe('r1');
    expect(e.duration).toBe(30.0);
  });
});

describe('HoldEvent', () => {
  it('parses hold event', () => {
    const e = HoldEvent.fromPayload({
      event_type: 'calling.call.hold',
      params: { call_id: 'c1', state: 'held' },
    });
    expect(e).toBeInstanceOf(HoldEvent);
    expect(e.state).toBe('held');
  });
});

describe('ConferenceEvent', () => {
  it('parses conference event', () => {
    const e = ConferenceEvent.fromPayload({
      event_type: 'calling.conference',
      params: { conference_id: 'conf1', name: 'standup', status: 'active' },
    });
    expect(e).toBeInstanceOf(ConferenceEvent);
    expect(e.conferenceId).toBe('conf1');
  });
});

describe('CallingErrorEvent', () => {
  it('parses calling error event', () => {
    const e = CallingErrorEvent.fromPayload({
      event_type: 'calling.error',
      params: { call_id: 'c1', code: '404', message: 'Not found' },
    });
    expect(e).toBeInstanceOf(CallingErrorEvent);
    expect(e.code).toBe('404');
    expect(e.message).toBe('Not found');
  });
});

describe('MessageReceiveEvent', () => {
  it('parses messaging receive event', () => {
    const e = MessageReceiveEvent.fromPayload({
      event_type: 'messaging.receive',
      params: {
        message_id: 'm1',
        context: 'sms',
        direction: 'inbound',
        from_number: '+1111',
        to_number: '+2222',
        body: 'Hello',
        media: ['https://img.com/a.jpg'],
        segments: 1,
        message_state: 'received',
        tags: ['vip'],
      },
    });
    expect(e).toBeInstanceOf(MessageReceiveEvent);
    expect(e.messageId).toBe('m1');
    expect(e.fromNumber).toBe('+1111');
    expect(e.body).toBe('Hello');
    expect(e.media).toEqual(['https://img.com/a.jpg']);
    expect(e.tags).toEqual(['vip']);
  });
});

describe('MessageStateEvent', () => {
  it('parses messaging state event', () => {
    const e = MessageStateEvent.fromPayload({
      event_type: 'messaging.state',
      params: {
        message_id: 'm1',
        context: 'sms',
        direction: 'outbound',
        from_number: '+2222',
        to_number: '+1111',
        body: 'Hey',
        segments: 1,
        message_state: 'delivered',
        reason: '',
      },
    });
    expect(e).toBeInstanceOf(MessageStateEvent);
    expect(e.messageState).toBe('delivered');
    expect(e.reason).toBe('');
  });
});

describe('parseEvent', () => {
  it('returns typed event for known types', () => {
    const e = parseEvent({
      event_type: 'calling.call.state',
      params: { call_id: 'c1', call_state: 'ended', end_reason: 'hangup' },
    });
    expect(e).toBeInstanceOf(CallStateEvent);
    expect((e as CallStateEvent).callState).toBe('ended');
  });

  it('returns base RelayEvent for unknown types', () => {
    const e = parseEvent({
      event_type: 'custom.unknown',
      params: { foo: 'bar' },
    });
    expect(e).toBeInstanceOf(RelayEvent);
    expect(e).not.toBeInstanceOf(CallStateEvent);
    expect(e.eventType).toBe('custom.unknown');
  });

  it('handles empty payload', () => {
    const e = parseEvent({});
    expect(e).toBeInstanceOf(RelayEvent);
    expect(e.eventType).toBe('');
  });

  it('parses all 22 event types', () => {
    const types = [
      ['calling.call.state', CallStateEvent],
      ['calling.call.receive', CallReceiveEvent],
      ['calling.call.play', PlayEvent],
      ['calling.call.record', RecordEvent],
      ['calling.call.collect', CollectEvent],
      ['calling.call.connect', ConnectEvent],
      ['calling.call.detect', DetectEvent],
      ['calling.call.fax', FaxEvent],
      ['calling.call.tap', TapEvent],
      ['calling.call.stream', StreamEvent],
      ['calling.call.send_digits', SendDigitsEvent],
      ['calling.call.dial', DialEvent],
      ['calling.call.refer', ReferEvent],
      ['calling.call.denoise', DenoiseEvent],
      ['calling.call.pay', PayEvent],
      ['calling.call.queue', QueueEvent],
      ['calling.call.echo', EchoEvent],
      ['calling.call.transcribe', TranscribeEvent],
      ['calling.call.hold', HoldEvent],
      ['calling.conference', ConferenceEvent],
      ['calling.error', CallingErrorEvent],
      ['messaging.receive', MessageReceiveEvent],
      ['messaging.state', MessageStateEvent],
    ] as const;

    for (const [eventType, expectedClass] of types) {
      const e = parseEvent({ event_type: eventType, params: {} });
      expect(e).toBeInstanceOf(expectedClass);
    }
  });
});
