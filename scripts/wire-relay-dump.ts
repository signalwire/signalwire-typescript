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
  // verb + action frames — capture at the CLIENT-SEND boundary
  // ────────────────────────────────────────────────────────────────
  // Mirrors the python oracle's _run_verb: build a REAL Call attached to a
  // recording CLIENT and intercept client.execute — so a frame is observed
  // ONLY if the verb actually transmits (Call._execute -> client.execute). A
  // verb that builds a frame but never reaches the client (e.g. rust's
  // sent_commands Vec, ledger #10) records NOTHING and the case emits the
  // `_no_frame_transmitted` sentinel, failing the differ.
  //
  // Each case gets a FRESH frames buffer + client (not a persistent per-method
  // Map) so a build-but-never-transmit can't be masked by a prior case's frame.
  const NO_FRAME = { _no_frame_transmitted: true };
  const makeClient = (frames: Record<string, unknown>[]) => ({
    execute: async (method: string, params: Record<string, unknown>) => {
      frames.push({ method, params });
      if (method === 'calling.dial') return { code: '200', message: 'Dialing' };
      if (method === 'messaging.send') return { code: '200', message_id: 'msg-1' };
      return { code: '200' };
    },
  });
  // Build a Call (answered state so control-ops proceed) against a fresh
  // recording client. Returns [call, frames]; `emit` reads the last transmitted
  // frame or the no-frame sentinel — the oracle's `frames[-1] if frames else …`.
  const newCall = (): [InstanceType<typeof Call>, Record<string, unknown>[]] => {
    const frames: Record<string, unknown>[] = [];
    const call = new Call(makeClient(frames) as any, CALL, NODE, 'proj-1', 'ctx', {
      state: 'answered' as any,
    });
    return [call, frames];
  };
  const emit = (frames: Record<string, unknown>[]): Record<string, unknown> =>
    frames.length ? (frames[frames.length - 1] as Record<string, unknown>) : NO_FRAME;

  // relay_play
  {
    const [c, frames] = newCall();
    await c.play([{ type: 'audio', params: { url: 'https://x/a.mp3' } }], {
      volume: 5.0,
      controlId: CID,
    });
    out['relay_play'] = emit(frames);
  }
  // relay_play_tts
  {
    const [c, frames] = newCall();
    await c.playTTS('Hello world', { voice: 'en-US-Neural' });
    out['relay_play_tts'] = emit(frames);
  }
  // relay_record
  {
    const [c, frames] = newCall();
    await c.record({ format: 'mp3', beep: true } as any, { controlId: CID });
    out['relay_record'] = emit(frames);
  }
  // relay_connect
  {
    const [c, frames] = newCall();
    await c.connect([[{ type: 'phone', params: { to_number: '+15551112222' } }]] as any, {
      ringback: [{ type: 'ringtone', params: { name: 'us' } }] as any,
      tag: 'leg-1',
      maxDuration: 3600,
    });
    out['relay_connect'] = emit(frames);
  }
  // relay_collect
  {
    const [c, frames] = newCall();
    await c.collect({
      digits: { max: 4, terminators: '#' } as any,
      speech: { language: 'en-US' } as any,
      initialTimeout: 5.0,
      partialResults: true,
      controlId: CID,
    });
    out['relay_collect'] = emit(frames);
  }
  // relay_prompt (play_and_collect)
  {
    const [c, frames] = newCall();
    await c.promptTTS('Enter your PIN', { digits: { max: 4 } } as any, { voice: 'en-US-Neural' });
    out['relay_prompt'] = emit(frames);
  }
  // relay_detect
  {
    const [c, frames] = newCall();
    await c.detect({ type: 'machine', params: { initial_timeout: 4.0 } } as any, {
      timeout: 30.0,
      controlId: CID,
    });
    out['relay_detect'] = emit(frames);
  }
  // relay_detect_amd
  {
    const [c, frames] = newCall();
    await c.detectAnsweringMachine({
      initialTimeout: 4.0,
      machineWordsThreshold: 6,
      timeout: 30.0,
    });
    out['relay_detect_amd'] = emit(frames);
  }
  // relay_tap
  {
    const [c, frames] = newCall();
    await c.tap(
      { type: 'audio', params: { direction: 'both' } } as any,
      { type: 'ws', params: { uri: 'wss://x/tap' } } as any,
      { controlId: CID },
    );
    out['relay_tap'] = emit(frames);
  }
  // relay_send_fax
  {
    const [c, frames] = newCall();
    await c.sendFax('https://x/doc.pdf', {
      identity: '+15550001111',
      headerInfo: 'Hdr',
      controlId: CID,
    });
    out['relay_send_fax'] = emit(frames);
  }
  // relay_live_transcribe -- params.action MUST be wrapped, not forwarded flat.
  {
    const [c, frames] = newCall();
    await c.liveTranscribe({ start: { lang: 'en' } });
    out['relay_live_transcribe'] = emit(frames);
  }
  // relay_live_translate -- params.action wrapped + status_url sibling param.
  {
    const [c, frames] = newCall();
    await c.liveTranslate(
      { start: { from_lang: 'en', to_lang: 'es' } },
      { statusUrl: 'https://x/cb' },
    );
    out['relay_live_translate'] = emit(frames);
  }

  // ---- control-ops (Action methods) ----
  // The oracle clears the verb's own frame before the action, so we observe
  // ONLY the action's transmitted frame (fresh buffer per case does the same).
  // relay_play_stop
  {
    const [c, frames] = newCall();
    const pa = await c.play([{ type: 'audio', params: { url: 'https://x/a.mp3' } }], {
      controlId: CID,
    });
    frames.length = 0;
    await pa.stop();
    out['relay_play_stop'] = emit(frames);
  }
  // relay_play_pause
  {
    const [c, frames] = newCall();
    const pa = await c.play([{ type: 'audio', params: { url: 'https://x/a.mp3' } }], {
      controlId: CID,
    });
    frames.length = 0;
    await pa.pause('silence');
    out['relay_play_pause'] = emit(frames);
  }
  // relay_record_resume
  {
    const [c, frames] = newCall();
    const ra = await c.record({ format: 'mp3' } as any, { controlId: CID });
    frames.length = 0;
    await ra.resume();
    out['relay_record_resume'] = emit(frames);
  }
  // relay_play_volume
  {
    const [c, frames] = newCall();
    const pa = await c.play([{ type: 'audio', params: { url: 'https://x/a.mp3' } }], {
      controlId: CID,
    });
    frames.length = 0;
    await pa.volume(3.5);
    out['relay_play_volume'] = emit(frames);
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
