/**
 * wire-relay-dump.ts — the TypeScript port's WIRE-RELAY dump program for the
 * cross-port relay differ (porting-sdk/scripts/diff_port_wire_relay.py).
 *
 * It captures, for each wire_relay_corpus case, the observable RELAY artifact:
 *   - verb   : the {method, params} JSON-RPC frame a Call verb (or an Action
 *     control-op) hands to the wire.
 *   - client : the {method, params} frame a RelayClient call (execute / dial /
 *     send_message) sends.
 *   - event  : the decoded fields a typed event decoder extracts from a payload.
 *
 * It prints ONE JSON object mapping case-id -> artifact to stdout; the differ
 * canonicalizes both sides (normalizing the random control_id to a sentinel) and
 * byte-compares against the python oracle. Only stdout carries JSON.
 *
 * Frame capture: TS is interpreted, so — exactly like the python oracle's
 * _RecordingCall / _RecordingClient — we intercept the wire boundary in-process
 * rather than standing up a mock WebSocket. A Call is built against a recording
 * stub client whose `execute(method, params)` records the frame and returns a
 * canned success; RelayClient-level cases override the client's `execute`. Event
 * decoding is pure (no wire).
 *
 * Logging is forced off (the Logger routes info/debug to stdout) and the SDK is
 * loaded via a deferred import after the env is set.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   npx tsx scripts/wire-relay-dump.ts
 */

process.env['SIGNALWIRE_LOG_MODE'] = 'off';

/* eslint-disable @typescript-eslint/no-explicit-any */

const NODE = 'node-abc';
const CALL = 'call-xyz';
const CID = 'ctl-123';

/** frame wraps a captured params map as {method, params}. */
const frame = (method: string, params: Record<string, unknown>): Record<string, unknown> => ({
  method,
  params,
});

async function main(): Promise<void> {
  const { Call } = await import('../src/relay/Call.js');
  const { RelayClient } = await import('../src/relay/RelayClient.js');
  const { QueueEvent, RecordEvent, CollectEvent, parseEvent } =
    await import('../src/relay/RelayEvent.js');

  const out: Record<string, unknown> = {};

  // ────────────────────────────────────────────────────────────────
  // verb + action frames — capture what Call._execute hands to the wire
  // ────────────────────────────────────────────────────────────────
  // A recording client: records the latest frame per method and returns a
  // canned success so verbs/actions proceed (mirrors _RecordingCall._execute).
  const frames = new Map<string, Record<string, unknown>>();
  const recordingClient = {
    execute: async (method: string, params: Record<string, unknown>) => {
      frames.set(method, params);
      if (method === 'calling.dial') return { code: '200', message: 'Dialing' };
      if (method === 'messaging.send') return { code: '200', message_id: 'msg-1' };
      return { code: '200' };
    },
  };
  // Build a Call in the 'answered' state so control-ops (_start_action) proceed.
  const newCall = () =>
    new Call(recordingClient as any, CALL, NODE, 'proj-1', 'ctx', { state: 'answered' as any });

  const last = (method: string): Record<string, unknown> => frames.get(method) ?? {};

  // relay_play
  {
    const c = newCall();
    await c.play([{ type: 'audio', params: { url: 'https://x/a.mp3' } }], {
      volume: 5.0,
      controlId: CID,
    });
    out['relay_play'] = frame('calling.play', last('calling.play'));
  }
  // relay_play_tts
  {
    const c = newCall();
    await c.playTTS('Hello world', { voice: 'en-US-Neural' });
    out['relay_play_tts'] = frame('calling.play', last('calling.play'));
  }
  // relay_record
  {
    const c = newCall();
    await c.record({ format: 'mp3', beep: true } as any, { controlId: CID });
    out['relay_record'] = frame('calling.record', last('calling.record'));
  }
  // relay_connect
  {
    const c = newCall();
    await c.connect([[{ type: 'phone', params: { to_number: '+15551112222' } }]] as any, {
      ringback: [{ type: 'ringtone', params: { name: 'us' } }] as any,
      tag: 'leg-1',
      maxDuration: 3600,
    });
    out['relay_connect'] = frame('calling.connect', last('calling.connect'));
  }
  // relay_collect
  {
    const c = newCall();
    await c.collect({
      digits: { max: 4, terminators: '#' } as any,
      speech: { language: 'en-US' } as any,
      initialTimeout: 5.0,
      partialResults: true,
      controlId: CID,
    });
    out['relay_collect'] = frame('calling.collect', last('calling.collect'));
  }
  // relay_prompt (play_and_collect)
  {
    const c = newCall();
    await c.promptTTS('Enter your PIN', { digits: { max: 4 } } as any, { voice: 'en-US-Neural' });
    out['relay_prompt'] = frame('calling.play_and_collect', last('calling.play_and_collect'));
  }
  // relay_detect
  {
    const c = newCall();
    await c.detect({ type: 'machine', params: { initial_timeout: 4.0 } } as any, {
      timeout: 30.0,
      controlId: CID,
    });
    out['relay_detect'] = frame('calling.detect', last('calling.detect'));
  }
  // relay_detect_amd
  {
    const c = newCall();
    await c.detectAnsweringMachine({
      initialTimeout: 4.0,
      machineWordsThreshold: 6,
      timeout: 30.0,
    });
    out['relay_detect_amd'] = frame('calling.detect', last('calling.detect'));
  }
  // relay_tap
  {
    const c = newCall();
    await c.tap(
      { type: 'audio', params: { direction: 'both' } } as any,
      { type: 'ws', params: { uri: 'wss://x/tap' } } as any,
      { controlId: CID },
    );
    out['relay_tap'] = frame('calling.tap', last('calling.tap'));
  }
  // relay_send_fax
  {
    const c = newCall();
    await c.sendFax('https://x/doc.pdf', {
      identity: '+15550001111',
      headerInfo: 'Hdr',
      controlId: CID,
    });
    out['relay_send_fax'] = frame('calling.send_fax', last('calling.send_fax'));
  }

  // ---- control-ops (Action methods) ----
  // relay_play_stop
  {
    const c = newCall();
    const pa = await c.play([{ type: 'audio', params: { url: 'https://x/a.mp3' } }], {
      controlId: CID,
    });
    await pa.stop();
    out['relay_play_stop'] = frame('calling.play.stop', last('calling.play.stop'));
  }
  // relay_play_pause
  {
    const c = newCall();
    const pa = await c.play([{ type: 'audio', params: { url: 'https://x/a.mp3' } }], {
      controlId: CID,
    });
    await pa.pause('silence');
    out['relay_play_pause'] = frame('calling.play.pause', last('calling.play.pause'));
  }
  // relay_record_resume
  {
    const c = newCall();
    const ra = await c.record({ format: 'mp3' } as any, { controlId: CID });
    await ra.resume();
    out['relay_record_resume'] = frame('calling.record.resume', last('calling.record.resume'));
  }
  // relay_play_volume
  {
    const c = newCall();
    const pa = await c.play([{ type: 'audio', params: { url: 'https://x/a.mp3' } }], {
      controlId: CID,
    });
    await pa.volume(3.5);
    out['relay_play_volume'] = frame('calling.play.volume', last('calling.play.volume'));
  }

  // ────────────────────────────────────────────────────────────────
  // RelayClient-level frames — override execute to capture the frame
  // ────────────────────────────────────────────────────────────────
  {
    const client = new RelayClient({ project: 'proj-1', token: 'tok-1' });
    // Simulate a completed connect handshake: the negotiated protocol becomes
    // the default messaging context (the mock relay replies protocol "default").
    (client as any)._relayProtocol = 'default';
    const clientFrames = new Map<string, Record<string, unknown>>();
    (client as any).execute = async (method: string, params: Record<string, unknown>) => {
      clientFrames.set(method, params);
      if (method === 'calling.dial') return { code: '200', message: 'Dialing' };
      if (method === 'messaging.send') return { code: '200', message_id: 'msg-1' };
      return { code: '200' };
    };

    // relay_client_execute (passthrough)
    await client.execute('calling.answer', { node_id: NODE, call_id: CALL });
    out['relay_client_execute'] = frame('calling.answer', clientFrames.get('calling.answer') ?? {});

    // relay_send_message
    await client.sendMessage({
      toNumber: '+15551112222',
      fromNumber: '+15553334444',
      body: 'hi',
      tags: ['t1'],
    });
    out['relay_send_message'] = frame('messaging.send', clientFrames.get('messaging.send') ?? {});

    // relay_dial — capture the calling.dial frame. dial() awaits an answered
    // event; feed one so it resolves cleanly (mirrors the oracle's _resolve_dial).
    const dialPromise = client
      .dial([[{ type: 'phone', params: { to_number: '+15551112222' } }]] as any, {
        tag: 'dial-1',
        maxDuration: 600,
        dialTimeout: 2,
      })
      .catch(() => undefined);
    // Let dial() register its pending future, then resolve it via _handleEvent.
    await new Promise((r) => setImmediate(r));
    (client as any)._handleEvent({
      event_type: 'calling.call.dial',
      params: {
        tag: 'dial-1',
        dial_state: 'answered',
        call: { call_id: CALL, node_id: NODE },
      },
    });
    await dialPromise;
    out['relay_dial'] = frame('calling.dial', clientFrames.get('calling.dial') ?? {});
  }

  // ────────────────────────────────────────────────────────────────
  // event decoders (pure — no wire). Map the TS camelCase decoded fields
  // to the snake_case keys the oracle picks.
  // ────────────────────────────────────────────────────────────────
  // relay_evt_queue: RENAME queue_id <- p.id, queue_name <- p.name
  {
    const q = QueueEvent.fromPayload({
      event_type: 'calling.call.queue',
      params: {
        call_id: CALL,
        control_id: CID,
        status: 'waiting',
        id: 'q-42',
        name: 'support',
        position: 3,
        size: 10,
      },
    } as any);
    out['relay_evt_queue'] = {
      control_id: q.controlId,
      status: q.status,
      queue_id: q.queueId,
      queue_name: q.queueName,
      position: q.position,
      size: q.size,
    };
  }
  // relay_evt_record: url/duration/size FALLBACK from nested record{}
  {
    const rec = RecordEvent.fromPayload({
      event_type: 'calling.call.record',
      params: {
        call_id: CALL,
        control_id: CID,
        state: 'finished',
        record: { url: 'https://x/rec.mp3', duration: 12.5, size: 4096 },
      },
    } as any);
    out['relay_evt_record'] = {
      control_id: rec.controlId,
      state: rec.state,
      url: rec.url,
      duration: rec.duration,
      size: rec.size,
    };
  }
  // relay_evt_state_dispatch: parse_event -> CallStateEvent
  {
    const obj = parseEvent({
      event_type: 'calling.call.state',
      params: { call_id: CALL, call_state: 'answered', direction: 'inbound', end_reason: '' },
    } as any);
    out['relay_evt_state_dispatch'] = {
      _class: obj.constructor.name,
      call_id: (obj as any).callId,
      call_state: (obj as any).callState,
      direction: (obj as any).direction,
    };
  }
  // relay_evt_collect: result{} + final tri-state
  {
    const col = CollectEvent.fromPayload({
      event_type: 'calling.call.collect',
      params: {
        call_id: CALL,
        control_id: CID,
        state: 'finished',
        result: { type: 'digit', params: { digits: '1234' } },
        final: true,
      },
    } as any);
    out['relay_evt_collect'] = {
      control_id: col.controlId,
      state: col.state,
      result: col.result,
      final: col.final,
    };
  }

  process.stdout.write(JSON.stringify(out) + '\n');
}

void main();
