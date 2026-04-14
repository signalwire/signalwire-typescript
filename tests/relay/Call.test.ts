import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Call, type RelayClientLike } from '../../src/relay/Call.js';
import { PlayAction, RecordAction, DetectAction, CollectAction, StandaloneCollectAction, FaxAction, TapAction, StreamAction, PayAction, TranscribeAction, AIAction } from '../../src/relay/Action.js';
import { RelayEvent } from '../../src/relay/RelayEvent.js';
import { RelayError } from '../../src/relay/RelayError.js';

// Mock client that records execute calls
function mockClient(): RelayClientLike & { execCalls: Array<{ method: string; params: Record<string, unknown> }> } {
  const execCalls: Array<{ method: string; params: Record<string, unknown> }> = [];
  return {
    execCalls,
    async execute(method: string, params: Record<string, unknown>) {
      execCalls.push({ method, params });
      return { code: '200', message: 'OK' };
    },
  };
}

// Mock client that returns empty (call-gone)
function goneClient(): RelayClientLike {
  return {
    async execute() { return {}; },
  };
}

// Mock client that throws a RelayError
function errorClient(code: number, msg: string): RelayClientLike {
  return {
    async execute() { throw new RelayError(code, msg); },
  };
}

function makeCall(client?: RelayClientLike): Call {
  return new Call(
    client ?? mockClient(),
    'call-id-1',
    'node-id-1',
    'project-1',
    'default',
    { direction: 'inbound', state: 'created' },
  );
}

describe('Call', () => {
  describe('constructor', () => {
    it('initializes with correct properties', () => {
      const call = makeCall();
      expect(call.callId).toBe('call-id-1');
      expect(call.nodeId).toBe('node-id-1');
      expect(call.projectId).toBe('project-1');
      expect(call.context).toBe('default');
      expect(call.direction).toBe('inbound');
      expect(call.state).toBe('created');
    });
  });

  describe('_execute', () => {
    it('sends calling.<method> with node_id and call_id', async () => {
      const client = mockClient();
      const call = makeCall(client);

      await call._execute('answer');
      expect(client.execCalls[0]).toEqual({
        method: 'calling.answer',
        params: { node_id: 'node-id-1', call_id: 'call-id-1' },
      });
    });

    it('merges extra params', async () => {
      const client = mockClient();
      const call = makeCall(client);

      await call._execute('end', { reason: 'hangup' });
      expect(client.execCalls[0].params.reason).toBe('hangup');
    });

    it('returns {} on RelayError (call-gone)', async () => {
      const call = makeCall(errorClient(404, 'Not found'));
      const result = await call._execute('answer');
      expect(result).toEqual({});
    });

    it('rethrows non-RelayError', async () => {
      const client: RelayClientLike = {
        async execute() { throw new Error('network'); },
      };
      const call = makeCall(client);
      await expect(call._execute('answer')).rejects.toThrow('network');
    });
  });

  describe('event dispatch', () => {
    it('updates call state on state events', async () => {
      const call = makeCall();

      await call._dispatchEvent({
        event_type: 'calling.call.state',
        params: { call_id: 'call-id-1', call_state: 'answered' },
      });

      expect(call.state).toBe('answered');
    });

    it('resolves _ended on state=ended', async () => {
      const call = makeCall();

      const endedPromise = call.waitForEnded(5000);
      await call._dispatchEvent({
        event_type: 'calling.call.state',
        params: { call_id: 'call-id-1', call_state: 'ended', end_reason: 'hangup' },
      });

      const event = await endedPromise;
      expect(call.state).toBe('ended');
      expect(event).toBeInstanceOf(RelayEvent);
    });

    it('routes events to actions by control_id', async () => {
      const client = mockClient();
      const call = makeCall(client);

      // Manually register an action
      const action = new PlayAction(call, 'ctrl-1');
      call._actions.set('ctrl-1', action);

      await call._dispatchEvent({
        event_type: 'calling.call.play',
        params: { call_id: 'call-id-1', control_id: 'ctrl-1', state: 'finished' },
      });

      expect(action.isDone).toBe(true);
      expect(call._actions.has('ctrl-1')).toBe(false); // cleaned up
    });

    it('notifies registered listeners', async () => {
      const call = makeCall();
      const events: RelayEvent[] = [];
      call.on('calling.call.play', (e) => { events.push(e); });

      await call._dispatchEvent({
        event_type: 'calling.call.play',
        params: { call_id: 'call-id-1', control_id: 'ctrl-1', state: 'playing' },
      });

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('calling.call.play');
    });

    it('handles listener errors gracefully', async () => {
      const call = makeCall();
      call.on('calling.call.state', () => { throw new Error('boom'); });

      // Should not throw
      await call._dispatchEvent({
        event_type: 'calling.call.state',
        params: { call_id: 'call-id-1', call_state: 'ringing' },
      });

      expect(call.state).toBe('ringing');
    });
  });

  describe('waitFor', () => {
    it('resolves on matching event', async () => {
      const call = makeCall();

      const promise = call.waitFor('calling.call.play');

      await call._dispatchEvent({
        event_type: 'calling.call.play',
        params: { state: 'finished' },
      });

      const event = await promise;
      expect(event.eventType).toBe('calling.call.play');
    });

    it('filters with predicate', async () => {
      const call = makeCall();

      const promise = call.waitFor(
        'calling.call.play',
        (e) => e.params.state === 'finished',
      );

      // First event doesn't match predicate
      await call._dispatchEvent({
        event_type: 'calling.call.play',
        params: { state: 'playing' },
      });

      // Second matches
      await call._dispatchEvent({
        event_type: 'calling.call.play',
        params: { state: 'finished' },
      });

      const event = await promise;
      expect(event.params.state).toBe('finished');
    });

    it('times out', async () => {
      const call = makeCall();
      await expect(call.waitFor('calling.call.play', undefined, 10))
        .rejects.toThrow('timed out');
    });
  });

  describe('_startAction', () => {
    it('registers action and returns it', async () => {
      const client = mockClient();
      const call = makeCall(client);

      const action = await call.play([{ type: 'tts', text: 'hello' }]);
      expect(action).toBeInstanceOf(PlayAction);
      expect(client.execCalls[0].method).toBe('calling.play');
    });

    it('resolves immediately if call already ended', async () => {
      const client = mockClient();
      const call = makeCall(client);
      call.state = 'ended';

      const action = await call.play([{ type: 'tts', text: 'hello' }]);
      expect(action.isDone).toBe(true);
      expect(client.execCalls).toHaveLength(0); // no RPC sent
    });

    it('resolves action on call-gone (empty result)', async () => {
      const call = makeCall(goneClient());

      const action = await call.play([{ type: 'tts', text: 'hello' }]);
      expect(action.isDone).toBe(true);
    });

    it('rejects action on RPC error and rethrows', async () => {
      const client: RelayClientLike = {
        async execute() { throw new Error('network fail'); },
      };
      const call = makeCall(client);

      await expect(call.play([{ type: 'tts', text: 'hello' }])).rejects.toThrow('network fail');
    });

    it('fires onCompleted callback', async () => {
      const client = mockClient();
      const call = makeCall(client);
      const cb = vi.fn();

      const action = await call.play([{ type: 'tts', text: 'hello' }], { onCompleted: cb });

      // Simulate action completing via event
      await call._dispatchEvent({
        event_type: 'calling.call.play',
        params: { control_id: action.controlId, state: 'finished' },
      });

      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle methods', () => {
    it('answer sends calling.answer', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.answer();
      expect(client.execCalls[0].method).toBe('calling.answer');
    });

    it('hangup sends calling.end with reason', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.hangup('busy');
      expect(client.execCalls[0].method).toBe('calling.end');
      expect(client.execCalls[0].params.reason).toBe('busy');
    });

    it('pass sends calling.pass', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.pass();
      expect(client.execCalls[0].method).toBe('calling.pass');
    });
  });

  describe('action methods', () => {
    it('play returns PlayAction', async () => {
      const call = makeCall();
      const action = await call.play([{ type: 'tts', text: 'hi' }]);
      expect(action).toBeInstanceOf(PlayAction);
    });

    it('record returns RecordAction', async () => {
      const call = makeCall();
      const action = await call.record();
      expect(action).toBeInstanceOf(RecordAction);
    });

    it('detect returns DetectAction', async () => {
      const call = makeCall();
      const action = await call.detect({ type: 'machine' });
      expect(action).toBeInstanceOf(DetectAction);
    });

    it('playAndCollect returns CollectAction', async () => {
      const call = makeCall();
      const action = await call.playAndCollect(
        [{ type: 'tts', text: 'Press 1' }],
        { digits: { max: 1 } },
      );
      expect(action).toBeInstanceOf(CollectAction);
    });

    it('collect returns StandaloneCollectAction', async () => {
      const call = makeCall();
      const action = await call.collect({ digits: { max: 4 } });
      expect(action).toBeInstanceOf(StandaloneCollectAction);
    });

    it('sendFax returns FaxAction', async () => {
      const call = makeCall();
      const action = await call.sendFax('https://doc.pdf');
      expect(action).toBeInstanceOf(FaxAction);
    });

    it('receiveFax returns FaxAction', async () => {
      const call = makeCall();
      const action = await call.receiveFax();
      expect(action).toBeInstanceOf(FaxAction);
    });

    it('tap returns TapAction', async () => {
      const call = makeCall();
      const action = await call.tap({}, { type: 'rtp' });
      expect(action).toBeInstanceOf(TapAction);
    });

    it('stream returns StreamAction', async () => {
      const call = makeCall();
      const action = await call.stream('wss://stream.example.com');
      expect(action).toBeInstanceOf(StreamAction);
    });

    it('pay returns PayAction', async () => {
      const call = makeCall();
      const action = await call.pay('https://payment.example.com');
      expect(action).toBeInstanceOf(PayAction);
    });

    it('transcribe returns TranscribeAction', async () => {
      const call = makeCall();
      const action = await call.transcribe();
      expect(action).toBeInstanceOf(TranscribeAction);
    });

    it('ai returns AIAction', async () => {
      const call = makeCall();
      const action = await call.ai({ agent: 'my-agent' });
      expect(action).toBeInstanceOf(AIAction);
    });
  });

  describe('simple methods', () => {
    it('connect sends calling.connect with devices', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.connect([[{ type: 'phone', to: '+1234', from: '+5678' }]]);
      expect(client.execCalls[0].method).toBe('calling.connect');
      expect(client.execCalls[0].params.devices).toEqual([[{ type: 'phone', to: '+1234', from: '+5678' }]]);
    });

    it('disconnect sends calling.disconnect', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.disconnect();
      expect(client.execCalls[0].method).toBe('calling.disconnect');
    });

    it('sendDigits sends calling.send_digits', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.sendDigits('1234#');
      expect(client.execCalls[0].method).toBe('calling.send_digits');
      expect(client.execCalls[0].params.digits).toBe('1234#');
    });

    it('transfer sends calling.transfer', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.transfer('laml://transfer.xml');
      expect(client.execCalls[0].method).toBe('calling.transfer');
      expect(client.execCalls[0].params.dest).toBe('laml://transfer.xml');
    });

    it('hold/unhold send correct methods', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.hold();
      await call.unhold();
      expect(client.execCalls[0].method).toBe('calling.hold');
      expect(client.execCalls[1].method).toBe('calling.unhold');
    });

    it('denoise/denoiseStop send correct methods', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.denoise();
      await call.denoiseStop();
      expect(client.execCalls[0].method).toBe('calling.denoise');
      expect(client.execCalls[1].method).toBe('calling.denoise.stop');
    });

    it('echo sends calling.echo', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.echo({ timeout: 30 });
      expect(client.execCalls[0].method).toBe('calling.echo');
      expect(client.execCalls[0].params.timeout).toBe(30);
    });

    it('bindDigit sends calling.bind_digit', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.bindDigit('*1', 'calling.play');
      expect(client.execCalls[0].method).toBe('calling.bind_digit');
      expect(client.execCalls[0].params.digits).toBe('*1');
    });

    it('clearDigitBindings sends calling.clear_digit_bindings', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.clearDigitBindings();
      expect(client.execCalls[0].method).toBe('calling.clear_digit_bindings');
    });

    it('liveTranscribe sends calling.live_transcribe', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.liveTranscribe({ action: 'start' });
      expect(client.execCalls[0].method).toBe('calling.live_transcribe');
    });

    it('liveTranslate sends calling.live_translate', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.liveTranslate({ action: 'start' }, { statusUrl: 'https://cb.com' });
      expect(client.execCalls[0].method).toBe('calling.live_translate');
      expect(client.execCalls[0].params.status_url).toBe('https://cb.com');
    });

    it('joinRoom/leaveRoom send correct methods', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.joinRoom('my-room');
      await call.leaveRoom();
      expect(client.execCalls[0].method).toBe('calling.join_room');
      expect(client.execCalls[1].method).toBe('calling.leave_room');
    });

    it('joinConference sends calling.join_conference', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.joinConference('standup', { muted: true, record: 'true' });
      expect(client.execCalls[0].method).toBe('calling.join_conference');
      expect(client.execCalls[0].params.name).toBe('standup');
      expect(client.execCalls[0].params.muted).toBe(true);
    });

    it('leaveConference sends calling.leave_conference', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.leaveConference('conf-1');
      expect(client.execCalls[0].method).toBe('calling.leave_conference');
      expect(client.execCalls[0].params.conference_id).toBe('conf-1');
    });

    it('amazonBedrock sends calling.amazon_bedrock', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.amazonBedrock({ prompt: 'Hello' });
      expect(client.execCalls[0].method).toBe('calling.amazon_bedrock');
    });

    it('aiMessage sends calling.ai_message', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.aiMessage({ messageText: 'hi', role: 'user' });
      expect(client.execCalls[0].method).toBe('calling.ai_message');
      expect(client.execCalls[0].params.message_text).toBe('hi');
    });

    it('aiHold/aiUnhold send correct methods', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.aiHold({ timeout: '30' });
      await call.aiUnhold({ prompt: 'welcome back' });
      expect(client.execCalls[0].method).toBe('calling.ai_hold');
      expect(client.execCalls[1].method).toBe('calling.ai_unhold');
    });

    it('userEvent sends calling.user_event', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.userEvent({ event: 'custom_event' });
      expect(client.execCalls[0].method).toBe('calling.user_event');
    });

    it('queueEnter/queueLeave send correct methods', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.queueEnter('support');
      await call.queueLeave('support', { queueId: 'q1' });
      expect(client.execCalls[0].method).toBe('calling.queue.enter');
      expect(client.execCalls[0].params.queue_name).toBe('support');
      expect(client.execCalls[1].method).toBe('calling.queue.leave');
      expect(client.execCalls[1].params.queue_id).toBe('q1');
    });

    it('refer sends calling.refer', async () => {
      const client = mockClient();
      const call = makeCall(client);
      await call.refer({ type: 'sip', to: 'sip:+1234@example.com' });
      expect(client.execCalls[0].method).toBe('calling.refer');
    });
  });

  describe('toString', () => {
    it('returns human-readable string', () => {
      const call = makeCall();
      const s = call.toString();
      expect(s).toContain('call-id-1');
      expect(s).toContain('inbound');
    });
  });
});
