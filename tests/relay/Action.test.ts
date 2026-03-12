import { describe, it, expect, vi } from 'vitest';
import {
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
  type CallLike,
} from '../../src/relay/Action.js';
import { RelayEvent } from '../../src/relay/RelayEvent.js';

// Mock call that records _execute calls
function mockCall(): CallLike & { execCalls: Array<{ method: string; params?: Record<string, unknown> }> } {
  const execCalls: Array<{ method: string; params?: Record<string, unknown> }> = [];
  return {
    execCalls,
    async _execute(method: string, params?: Record<string, unknown>) {
      execCalls.push({ method, params });
      return { code: '200', message: 'OK' };
    },
  };
}

function makeEvent(eventType: string, params: Record<string, unknown> = {}): RelayEvent {
  return RelayEvent.fromPayload({ event_type: eventType, params });
}

describe('Action (base)', () => {
  it('starts unsettled', () => {
    const call = mockCall();
    const a = new Action(call, 'ctrl1', 'calling.call.play', ['finished', 'error']);
    expect(a.isDone).toBe(false);
    expect(a.completed).toBe(false);
    expect(a.result).toBeNull();
  });

  it('resolves on terminal state', async () => {
    const call = mockCall();
    const a = new Action(call, 'ctrl1', 'calling.call.play', ['finished', 'error']);

    const event = makeEvent('calling.call.play', { control_id: 'ctrl1', state: 'finished' });
    a._checkEvent(event);

    expect(a.isDone).toBe(true);
    expect(a.completed).toBe(true);
    expect(a.result).toBe(event);

    const result = await a.wait();
    expect(result).toBe(event);
  });

  it('ignores non-terminal state', () => {
    const call = mockCall();
    const a = new Action(call, 'ctrl1', 'calling.call.play', ['finished', 'error']);

    a._checkEvent(makeEvent('calling.call.play', { control_id: 'ctrl1', state: 'playing' }));
    expect(a.isDone).toBe(false);
  });

  it('does not resolve twice', () => {
    const call = mockCall();
    const cb = vi.fn();
    const a = new Action(call, 'ctrl1', 'calling.call.play', ['finished']);
    a._onCompleted = cb;

    a._checkEvent(makeEvent('calling.call.play', { state: 'finished' }));
    a._checkEvent(makeEvent('calling.call.play', { state: 'finished' }));

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires on_completed callback', () => {
    const call = mockCall();
    const cb = vi.fn();
    const a = new Action(call, 'ctrl1', 'calling.call.play', ['finished']);
    a._onCompleted = cb;

    const event = makeEvent('calling.call.play', { state: 'finished' });
    a._checkEvent(event);

    expect(cb).toHaveBeenCalledWith(event);
  });

  it('wait with timeout works', async () => {
    const call = mockCall();
    const a = new Action(call, 'ctrl1', 'calling.call.play', ['finished']);

    // Resolve it
    a._checkEvent(makeEvent('calling.call.play', { state: 'finished' }));

    const result = await a.wait(5000);
    expect(result.eventType).toBe('calling.call.play');
  });

  it('wait with timeout rejects', async () => {
    const call = mockCall();
    const a = new Action(call, 'ctrl1', 'calling.call.play', ['finished']);

    await expect(a.wait(10)).rejects.toThrow('timed out');
  });
});

describe('PlayAction', () => {
  it('has correct terminal states', () => {
    const call = mockCall();
    const a = new PlayAction(call, 'ctrl1');
    expect(a.isDone).toBe(false);
  });

  it('stop/pause/resume/volume call _execute', async () => {
    const call = mockCall();
    const a = new PlayAction(call, 'ctrl1');

    await a.stop();
    await a.pause();
    await a.resume();
    await a.volume(-3.5);

    expect(call.execCalls).toHaveLength(4);
    expect(call.execCalls[0].method).toBe('play.stop');
    expect(call.execCalls[1].method).toBe('play.pause');
    expect(call.execCalls[2].method).toBe('play.resume');
    expect(call.execCalls[3].method).toBe('play.volume');
    expect(call.execCalls[3].params).toEqual({ control_id: 'ctrl1', volume: -3.5 });
  });

  it('resolves on finished', async () => {
    const call = mockCall();
    const a = new PlayAction(call, 'ctrl1');
    a._checkEvent(makeEvent('calling.call.play', { state: 'finished' }));
    expect(a.isDone).toBe(true);
  });

  it('resolves on error', async () => {
    const call = mockCall();
    const a = new PlayAction(call, 'ctrl1');
    a._checkEvent(makeEvent('calling.call.play', { state: 'error' }));
    expect(a.isDone).toBe(true);
  });
});

describe('RecordAction', () => {
  it('stop/pause/resume call _execute', async () => {
    const call = mockCall();
    const a = new RecordAction(call, 'ctrl1');

    await a.stop();
    await a.pause('silence');
    await a.resume();

    expect(call.execCalls[0].method).toBe('record.stop');
    expect(call.execCalls[1].method).toBe('record.pause');
    expect(call.execCalls[1].params?.behavior).toBe('silence');
    expect(call.execCalls[2].method).toBe('record.resume');
  });

  it('resolves on finished', () => {
    const call = mockCall();
    const a = new RecordAction(call, 'ctrl1');
    a._checkEvent(makeEvent('calling.call.record', { state: 'finished' }));
    expect(a.isDone).toBe(true);
  });

  it('resolves on no_input', () => {
    const call = mockCall();
    const a = new RecordAction(call, 'ctrl1');
    a._checkEvent(makeEvent('calling.call.record', { state: 'no_input' }));
    expect(a.isDone).toBe(true);
  });
});

describe('DetectAction', () => {
  it('resolves on first meaningful detect result', () => {
    const call = mockCall();
    const a = new DetectAction(call, 'ctrl1');

    // First event with detect data — should resolve
    a._checkEvent(makeEvent('calling.call.detect', {
      control_id: 'ctrl1',
      detect: { type: 'machine', params: { event: 'HUMAN' } },
    }));
    expect(a.isDone).toBe(true);
  });

  it('resolves on terminal state without detect', () => {
    const call = mockCall();
    const a = new DetectAction(call, 'ctrl1');

    a._checkEvent(makeEvent('calling.call.detect', { state: 'finished' }));
    expect(a.isDone).toBe(true);
  });

  it('does not resolve on empty event', () => {
    const call = mockCall();
    const a = new DetectAction(call, 'ctrl1');

    a._checkEvent(makeEvent('calling.call.detect', { state: 'detecting' }));
    expect(a.isDone).toBe(false);
  });

  it('stop calls _execute', async () => {
    const call = mockCall();
    const a = new DetectAction(call, 'ctrl1');
    await a.stop();
    expect(call.execCalls[0].method).toBe('detect.stop');
  });
});

describe('CollectAction', () => {
  it('ignores play events (shared control_id)', () => {
    const call = mockCall();
    const a = new CollectAction(call, 'ctrl1');

    // Play event with same control_id — should be ignored
    a._checkEvent(makeEvent('calling.call.play', { control_id: 'ctrl1', state: 'finished' }));
    expect(a.isDone).toBe(false);
  });

  it('resolves on collect event with result', () => {
    const call = mockCall();
    const a = new CollectAction(call, 'ctrl1');

    a._checkEvent(makeEvent('calling.call.collect', {
      control_id: 'ctrl1',
      result: { type: 'digit', params: { digits: '1234' } },
    }));
    expect(a.isDone).toBe(true);
  });

  it('resolves on collect terminal state', () => {
    const call = mockCall();
    const a = new CollectAction(call, 'ctrl1');

    a._checkEvent(makeEvent('calling.call.collect', { control_id: 'ctrl1', state: 'no_input' }));
    expect(a.isDone).toBe(true);
  });

  it('stop/volume/startInputTimers call correct methods', async () => {
    const call = mockCall();
    const a = new CollectAction(call, 'ctrl1');

    await a.stop();
    await a.volume(-2);
    await a.startInputTimers();

    expect(call.execCalls[0].method).toBe('play_and_collect.stop');
    expect(call.execCalls[1].method).toBe('play_and_collect.volume');
    expect(call.execCalls[2].method).toBe('collect.start_input_timers');
  });
});

describe('StandaloneCollectAction', () => {
  it('ignores play events', () => {
    const call = mockCall();
    const a = new StandaloneCollectAction(call, 'ctrl1');

    a._checkEvent(makeEvent('calling.call.play', { control_id: 'ctrl1', state: 'finished' }));
    expect(a.isDone).toBe(false);
  });

  it('resolves on result', () => {
    const call = mockCall();
    const a = new StandaloneCollectAction(call, 'ctrl1');

    a._checkEvent(makeEvent('calling.call.collect', {
      control_id: 'ctrl1',
      result: { type: 'speech', params: { text: 'hello' } },
    }));
    expect(a.isDone).toBe(true);
  });

  it('resolves on terminal state', () => {
    const call = mockCall();
    const a = new StandaloneCollectAction(call, 'ctrl1');

    a._checkEvent(makeEvent('calling.call.collect', { control_id: 'ctrl1', state: 'error' }));
    expect(a.isDone).toBe(true);
  });

  it('stop/startInputTimers call correct methods', async () => {
    const call = mockCall();
    const a = new StandaloneCollectAction(call, 'ctrl1');

    await a.stop();
    await a.startInputTimers();

    expect(call.execCalls[0].method).toBe('collect.stop');
    expect(call.execCalls[1].method).toBe('collect.start_input_timers');
  });
});

describe('FaxAction', () => {
  it('stop uses correct method prefix', async () => {
    const call = mockCall();

    const sendFax = new FaxAction(call, 'ctrl1', 'send_fax');
    await sendFax.stop();
    expect(call.execCalls[0].method).toBe('send_fax.stop');

    const recvFax = new FaxAction(call, 'ctrl2', 'receive_fax');
    await recvFax.stop();
    expect(call.execCalls[1].method).toBe('receive_fax.stop');
  });

  it('resolves on finished', () => {
    const call = mockCall();
    const a = new FaxAction(call, 'ctrl1', 'send_fax');
    a._checkEvent(makeEvent('calling.call.fax', { state: 'finished' }));
    expect(a.isDone).toBe(true);
  });
});

describe('TapAction', () => {
  it('stop calls _execute', async () => {
    const call = mockCall();
    const a = new TapAction(call, 'ctrl1');
    await a.stop();
    expect(call.execCalls[0].method).toBe('tap.stop');
  });

  it('resolves on finished', () => {
    const call = mockCall();
    const a = new TapAction(call, 'ctrl1');
    a._checkEvent(makeEvent('calling.call.tap', { state: 'finished' }));
    expect(a.isDone).toBe(true);
  });
});

describe('StreamAction', () => {
  it('stop calls _execute', async () => {
    const call = mockCall();
    const a = new StreamAction(call, 'ctrl1');
    await a.stop();
    expect(call.execCalls[0].method).toBe('stream.stop');
  });
});

describe('PayAction', () => {
  it('stop calls _execute', async () => {
    const call = mockCall();
    const a = new PayAction(call, 'ctrl1');
    await a.stop();
    expect(call.execCalls[0].method).toBe('pay.stop');
  });

  it('resolves on error', () => {
    const call = mockCall();
    const a = new PayAction(call, 'ctrl1');
    a._checkEvent(makeEvent('calling.call.pay', { state: 'error' }));
    expect(a.isDone).toBe(true);
  });
});

describe('TranscribeAction', () => {
  it('stop calls _execute', async () => {
    const call = mockCall();
    const a = new TranscribeAction(call, 'ctrl1');
    await a.stop();
    expect(call.execCalls[0].method).toBe('transcribe.stop');
  });
});

describe('AIAction', () => {
  it('stop calls _execute', async () => {
    const call = mockCall();
    const a = new AIAction(call, 'ctrl1');
    await a.stop();
    expect(call.execCalls[0].method).toBe('ai.stop');
  });

  it('resolves on finished', () => {
    const call = mockCall();
    const a = new AIAction(call, 'ctrl1');
    a._checkEvent(makeEvent('calling.call.ai', { state: 'finished' }));
    expect(a.isDone).toBe(true);
  });

  it('resolves on error', () => {
    const call = mockCall();
    const a = new AIAction(call, 'ctrl1');
    a._checkEvent(makeEvent('calling.call.ai', { state: 'error' }));
    expect(a.isDone).toBe(true);
  });
});
