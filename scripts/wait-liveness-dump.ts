/**
 * wait-liveness-dump.ts — the TypeScript port's WAIT-LIVENESS dump program for the
 * cross-port behavioral differ (porting-sdk/scripts/diff_port_wait_liveness.py).
 *
 * The differ runs porting-sdk/scripts/wait_liveness_corpus.py against
 * signalwire-python to build the golden LIVENESS classification, then runs THIS
 * program (which embeds the same corpus) and structurally compares our per-case
 * classification. The artifact is a CLASSIFICATION (not raw ms), so the golden is
 * deterministic while the timing that produces it is real and unfakeable:
 *
 *   * a wait() that is a NO-OP returns at t~=0  -> blocked_until_event=false -> RED;
 *   * a wait() that HANGS blows the deadline    -> timed_out=true            -> RED;
 *   * a correct wait() BLOCKS until the deferred completing event, then returns
 *     with the finished state (the golden)      ->                          -> GREEN.
 *
 * Unlike wire-relay-dump (which records the send-side frame with no socket), this
 * gate MUST exercise real liveness — so we drive the SDK against a real mock_relay
 * and arm the completing event as a DEFERRED (delay_ms) scenario. That delivers the
 * event through the SAME socket-read -> event-dispatch path the real server drives;
 * a wait() that never pumps the loop cannot observe it. This is the exact mechanism
 * tests/relay/actions_mock.test.ts#test_play_resolves_on_finished_event uses; we
 * reuse that test harness (newRelayClient + armMethod + inboundCall) directly.
 *
 * Protocol: stdout = ONE JSON object mapping case_id -> classification. ONLY stdout
 * carries JSON (the differ does JSON.parse(proc.stdout)); all logging goes to stderr.
 *
 * Run from the repo root (mock_relay reachable via MOCK_RELAY_PORT /
 * MOCK_RELAY_HTTP_PORT, or auto-spawned by the harness):
 *
 *   SIGNALWIRE_LOG_MODE=off npx tsx scripts/wait-liveness-dump.ts
 */

import { newRelayClient, type MockRelayHarness } from '../tests/relay/mocktest.js';
import type { RelayClient } from '../src/relay/RelayClient.js';
import type { Call } from '../src/relay/Call.js';
import type { Action } from '../src/relay/Action.js';

// Classification tolerances — must match porting-sdk/scripts/diff_port_wait_liveness.py.
const DEADLINE_S = 5.0;
const BLOCK_TOL_MS = 40;
// The deferred-event delay — must match wait_liveness_corpus.DELAY_MS.
const DELAY_MS = 150;
const CID = 'ctl-live-1';

interface Classification {
  blocked_until_event: boolean;
  returned_after_event: boolean;
  completed_state: string;
  timed_out: boolean;
}

interface Case {
  id: string;
  verb: 'play' | 'record';
  method: string; // the RELAY method whose scenario carries the terminal event
}

// The corpus, mirroring porting-sdk/scripts/wait_liveness_corpus.py CORPUS. Two
// distinct action types (play, record) so a port can't hardcode one surface.
const CORPUS: Case[] = [
  { id: 'live_play_wait', verb: 'play', method: 'calling.play' },
  { id: 'live_record_wait', verb: 'record', method: 'calling.record' },
];

/** Derive the deterministic liveness classification (mirrors classify_liveness). */
function classify(
  tWaitStart: number,
  tReturn: number | null,
  completedState: string,
  timedOut: boolean,
): Classification {
  if (timedOut || tReturn === null) {
    return {
      blocked_until_event: false,
      returned_after_event: false,
      completed_state: '',
      timed_out: true,
    };
  }
  const elapsedMs = tReturn - tWaitStart;
  const blocked = elapsedMs >= DELAY_MS - BLOCK_TOL_MS;
  return {
    blocked_until_event: blocked,
    returned_after_event: true,
    completed_state: completedState,
    timed_out: false,
  };
}

/** Answer an inbound call we can issue actions on (mirrors the actions_mock helper). */
async function answeredInboundCall(
  client: RelayClient,
  mock: MockRelayHarness,
  callId: string,
): Promise<Call> {
  const captured: { call?: Call } = {};
  const handlerReturned = new Promise<void>((resolve) => {
    client.onCall(async (call) => {
      captured.call = call;
      await call.answer();
      resolve();
    });
  });
  await mock.inboundCall({ call_id: callId, auto_states: ['created'] });
  await Promise.race([
    handlerReturned,
    new Promise((_, reject) => setTimeout(() => reject(new Error('handler timeout')), 5000)),
  ]);
  const call = captured.call!;
  call.state = 'answered';
  return call;
}

/** Start the Action-returning verb for a case against an answered call. */
async function startAction(call: Call, verb: Case['verb']): Promise<Action> {
  if (verb === 'play') {
    return call.play([{ type: 'silence', params: { duration: 1 } }], { controlId: CID });
  }
  return call.record({ format: 'mp3' }, { controlId: CID });
}

/** Drive ONE liveness case against the real mock and return its classification. */
async function runCase(c: Case): Promise<Classification> {
  const { client, mock } = await newRelayClient();
  try {
    await mock.resetScenarios();
    const call = await answeredInboundCall(client, mock, `call-${c.id}`);

    // Arm the completing event as a DEFERRED (delay_ms) scenario: it arrives
    // DELAY_MS after the verb RPC, through the real socket-read path.
    await mock.armMethod(c.method, [{ emit: { state: 'finished' }, delay_ms: DELAY_MS }]);

    const action = await startAction(call, c.verb);

    const tWaitStart = performance.now();
    try {
      const event = await action.wait(DEADLINE_S);
      const tReturn = performance.now();
      const state = String(event.params?.['state'] ?? '');
      return classify(tWaitStart, tReturn, state, false);
    } catch {
      // wait() rejected (timeout) => hung.
      return classify(tWaitStart, null, '', true);
    }
  } finally {
    try {
      await client.disconnect();
    } catch {
      /* ignore */
    }
  }
}

async function main(): Promise<number> {
  const out: Record<string, Classification> = {};
  for (const c of CORPUS) {
    out[c.id] = await runCase(c);
  }
  process.stdout.write(JSON.stringify(out));
  process.stdout.write('\n');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(
      `wait-liveness-dump: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  },
);
