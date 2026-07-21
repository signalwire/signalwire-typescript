/**
 * relay-liveness-dump.ts — the TypeScript port's RELAY-LIVENESS dump program for
 * the cross-port behavioral differ (porting-sdk/scripts/diff_port_relay_liveness.py,
 * corpus porting-sdk/scripts/relay_liveness_corpus.py).
 *
 * The BROADER sibling of the WAIT-LIVENESS dump: where WAIT-LIVENESS pins
 * Action.wait() blocks-until-event, this pins the RELAY *client's* connection +
 * error contract — A6 creds, A2 relay-contract, F2.1 dead-peer, F2.2 black-hole,
 * F3 reconnect, max-active-calls. The differ builds the golden by driving the
 * python RelayClient, then runs THIS program and structurally compares the
 * per-fixture CLASSIFICATION (booleans: raised/bounded/detected/enforced — never
 * raw ms), so the golden is deterministic while the behavior is real.
 *
 * Most fixtures need CONTROLLABLE transport misbehavior (auth-reject, half-open,
 * silent, drop-after-auth) that the python differ gets by monkeypatching
 * websockets.connect. TS can't monkeypatch the real `ws` module cleanly, so this
 * program stands up its OWN in-process `ws` server (FakeWs) speaking the
 * connect/auth/ping handshake, scriptable per fixture, and points the client at
 * it via SIGNALWIRE_RELAY_HOST + scheme 'ws'. Fast liveness timings are set via
 * the SIGNALWIRE_RELAY_* env knobs so the half-open / black-hole / reconnect
 * paths land inside the bounded window (the analog of the python differ shrinking
 * `_CLIENT_PING_INTERVAL` / `_EXECUTE_TIMEOUT` / `RECONNECT_MIN_DELAY`).
 *
 * Protocol: stdout = ONE JSON object mapping fixture_id -> classification. Only
 * stdout carries JSON; all logging goes to stderr (SIGNALWIRE_LOG_MODE=off).
 *
 * Run from the signalwire-typescript repo root:
 *
 *   SIGNALWIRE_LOG_MODE=off npx tsx scripts/relay-liveness-dump.ts
 */

// Silence the SDK logger and set fast liveness timings BEFORE the RelayClient
// module is loaded (its timing fields read these env vars at construction, and
// the Logger reads SIGNALWIRE_LOG_MODE at module-init). ES import bindings are
// hoisted, so we set env first and import the SDK DYNAMICALLY below.
process.env['SIGNALWIRE_LOG_MODE'] ??= 'off';
process.env['SIGNALWIRE_LOG_LEVEL'] ??= 'error';
// Fast timings so the bounded window (5s) is enough to detect a half-open peer,
// bound a black-hole execute, and drive a reconnect. Production defaults apply
// when these are unset; the dump sets them explicitly.
process.env['SIGNALWIRE_RELAY_PING_INTERVAL_MS'] = '50';
process.env['SIGNALWIRE_RELAY_PING_MAX_FAILURES'] = '3';
process.env['SIGNALWIRE_RELAY_REQUEST_TIMEOUT_MS'] = '400';
process.env['SIGNALWIRE_RELAY_RECONNECT_MIN_DELAY_S'] = '0.02';
process.env['SIGNALWIRE_RELAY_RECONNECT_MAX_DELAY_S'] = '0.05';

import { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';

// mirrors diff_port_relay_liveness.BOUNDED_WINDOW_S
const BOUNDED_WINDOW_MS = 5000;

const NODE = 'node-relay-live';
const CALL = 'call-relay-live';
const CID = 'ctl-relay-live-1';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface FakeConfig {
  /** non-empty => reject signalwire.connect with this message */
  authError?: string;
  /** accept connect, then never answer any request (black hole) */
  silent?: boolean;
  /** answer signalwire.ping (false => half-open peer) */
  answerPing?: boolean;
  /** close the socket right after a successful auth (F3 first conn) */
  dropAfter?: boolean;
  /** result `code` for calling.* verbs (e.g. "500"); undefined => "200" */
  rpcCode?: string;
}

/**
 * An in-process `ws` server that speaks the RELAY connect/auth/ping handshake and
 * can be scripted to misbehave per fixture. `cfg(connN)` is evaluated per inbound
 * connection so the reconnect fixture can drop only the first socket.
 */
class FakeWs {
  private wss: WebSocketServer;
  port = 0;
  connects = 0;
  private conns: WebSocket[] = [];

  private constructor(
    wss: WebSocketServer,
    private cfg: (connN: number) => FakeConfig,
  ) {
    this.wss = wss;
    this.port = (wss.address() as AddressInfo).port;
    wss.on('connection', (ws) => this.handle(ws));
  }

  static async create(cfg: (connN: number) => FakeConfig): Promise<FakeWs> {
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise<void>((resolve, reject) => {
      wss.on('listening', () => resolve());
      wss.on('error', reject);
    });
    return new FakeWs(wss, cfg);
  }

  host(): string {
    return `127.0.0.1:${this.port}`;
  }

  currentConn(): WebSocket | null {
    return this.conns[this.conns.length - 1] ?? null;
  }

  private handle(ws: WebSocket): void {
    this.connects++;
    const n = this.connects;
    this.conns.push(ws);
    const cfg = this.cfg(n);

    ws.on('message', (raw: WebSocket.RawData) => {
      let msg: { id?: string; method?: string };
      try {
        msg = JSON.parse(raw.toString()) as { id?: string; method?: string };
      } catch {
        return;
      }
      const method = msg.method;
      const id = msg.id;
      if (method === 'signalwire.connect') {
        if (cfg.authError) {
          this.send(ws, {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32401,
              message: cfg.authError,
              data: { signalwire_error_code: 'AUTH_REQUIRED' },
            },
          });
          return;
        }
        this.send(ws, {
          jsonrpc: '2.0',
          id,
          result: { protocol: 'signalwire_fake', identity: 'id', sessionid: 'sess-fake' },
        });
        if (cfg.dropAfter) {
          setTimeout(() => ws.close(), 20);
        }
        return;
      }
      if (method === 'signalwire.ping') {
        if (cfg.silent || !cfg.answerPing) return;
        this.send(ws, { jsonrpc: '2.0', id, result: { timestamp: Date.now() } });
        return;
      }
      // A calling.* / signalwire.receive request.
      if (cfg.silent) return; // black hole: accept, never respond
      const code = cfg.rpcCode ?? '200';
      this.send(ws, { jsonrpc: '2.0', id, result: { code, message: 'OK' } });
    });
  }

  private send(ws: WebSocket, v: unknown): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(v));
  }

  pushToCurrent(v: unknown): void {
    const ws = this.currentConn();
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(v));
  }

  close(): void {
    for (const ws of this.conns) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.wss.close();
  }
}

// Dynamically imported SDK types (imported once in main()).
type RelayClientCtor = typeof import('../src/relay/RelayClient.js').RelayClient;
type RelayErrorCtor = typeof import('../src/relay/RelayError.js').RelayError;

function pointAt(f: FakeWs): void {
  process.env['SIGNALWIRE_RELAY_HOST'] = f.host();
  process.env['SIGNALWIRE_RELAY_SCHEME'] = 'ws';
}

const playParams = () => ({
  node_id: NODE,
  call_id: CALL,
  control_id: CID,
  play: [{ type: 'tts', params: { text: 'hi' } }],
});

// ---------------------------------------------------------------------------
// Fixture drivers — each returns the fixture's classification.
// ---------------------------------------------------------------------------

function driveCredMissing(RelayClient: RelayClientCtor, omit: 'project' | 'token'): object {
  for (const e of ['SIGNALWIRE_PROJECT_ID', 'SIGNALWIRE_API_TOKEN', 'SIGNALWIRE_JWT_TOKEN']) {
    delete process.env[e];
  }
  const opts: { project: string; token: string; host: string } = {
    project: 'p',
    token: 't',
    host: 'relay.example.test',
  };
  const wants =
    omit === 'project' ? ['project', 'SIGNALWIRE_PROJECT_ID'] : ['token', 'SIGNALWIRE_API_TOKEN'];
  opts[omit] = '';
  let failed = false;
  let msg = '';
  try {
    new RelayClient(opts);
  } catch (err) {
    failed = true;
    msg = String(err);
  }
  const actionable = wants.every((w) => msg.includes(w));
  return { failed_preconnect_on_missing: failed && actionable };
}

async function driveCredAuthReject(
  RelayClient: RelayClientCtor,
  RelayError: RelayErrorCtor,
): Promise<object> {
  const out = {
    raised_after_bounded_retry: false,
    infinite_reconnect: false,
    server_message_surfaced: false,
  };
  const serverMsg = 'auth rejected: bad token';
  const f = await FakeWs.create(() => ({ authError: serverMsg, answerPing: true }));
  pointAt(f);
  try {
    const client = new RelayClient({ project: 'p', token: 't' });
    const connectPromise = client
      .connect()
      .then(() => ({ ok: true as const }))
      .catch((e: unknown) => ({ ok: false as const, err: e }))
      .finally(() => client.disconnect());
    const timeout = sleep(BOUNDED_WINDOW_MS + 3000).then(() => 'timeout' as const);
    const res = await Promise.race([connectPromise, timeout]);
    if (res === 'timeout') {
      out.infinite_reconnect = true;
    } else if (!res.ok) {
      out.raised_after_bounded_retry = true;
      const text = res.err instanceof RelayError ? res.err.message : String(res.err);
      out.server_message_surfaced = text.includes(serverMsg);
    }
  } finally {
    f.close();
  }
  return out;
}

async function driveRelayContract(
  RelayClient: RelayClientCtor,
  RelayError: RelayErrorCtor,
  code: string,
): Promise<object> {
  const out = { raised: false, swallowed: false };
  const f = await FakeWs.create(() => ({ answerPing: true, rpcCode: code }));
  pointAt(f);
  const client = new RelayClient({ project: 'p', token: 't' });
  try {
    await client.connect();
    // Drive the verb through the Call layer so the A2 404/410-swallow contract
    // is exercised (Call._execute applies it).
    const { Call } = await import('../src/relay/Call.js');
    const call = new Call(client, CALL, NODE, 'p', 'ctx', {
      direction: 'inbound',
      state: 'answered',
    });
    try {
      await call._execute('play', {
        control_id: CID,
        play: [{ type: 'tts', params: { text: 'hi' } }],
      });
      out.swallowed = true;
    } catch (err) {
      if (err instanceof RelayError && (err.code === 404 || err.code === 410)) {
        out.swallowed = true;
      } else {
        out.raised = true;
      }
    }
  } finally {
    await client.disconnect();
    f.close();
  }
  return out;
}

async function driveDeadPeer(RelayClient: RelayClientCtor): Promise<object> {
  const out = { detected_bounded: false, hung: true };
  const f = await FakeWs.create(() => ({ answerPing: false })); // connect ok, pings ignored
  pointAt(f);
  const client = new RelayClient({ project: 'p', token: 't' });
  try {
    await client.connect();
    const t0 = Date.now();
    while (Date.now() - t0 < BOUNDED_WINDOW_MS) {
      if (!(client as unknown as { _connected: boolean })._connected) {
        out.detected_bounded = true;
        out.hung = false;
        break;
      }
      await sleep(20);
    }
  } finally {
    await client.disconnect();
    f.close();
  }
  return out;
}

async function driveBlackHole(RelayClient: RelayClientCtor): Promise<object> {
  const out = { bounded_error: false, unbounded_hang: true };
  const f = await FakeWs.create(() => ({ silent: true }));
  pointAt(f);
  const client = new RelayClient({ project: 'p', token: 't' });
  try {
    await client.connect();
    const t0 = Date.now();
    try {
      await client.execute('calling.play', playParams());
    } catch {
      if (Date.now() - t0 < BOUNDED_WINDOW_MS) {
        out.bounded_error = true;
        out.unbounded_hang = false;
      }
    }
  } finally {
    await client.disconnect();
    f.close();
  }
  return out;
}

async function driveReconnect(RelayClient: RelayClientCtor): Promise<object> {
  const out = { reconnected: false, pending_faulted_not_hung: false, zombie: true };
  const f = await FakeWs.create((n) => ({ answerPing: true, dropAfter: n === 1 }));
  pointAt(f);
  const client = new RelayClient({ project: 'p', token: 't' });
  // run() maintains the connection with auto-reconnect.
  const runPromise = client.run().catch(() => {});
  try {
    const t0 = Date.now();
    while (Date.now() - t0 < BOUNDED_WINDOW_MS) {
      if (f.connects >= 2) {
        out.reconnected = true;
        break;
      }
      await sleep(20);
    }

    // A caller after the drop must be bounded (reconnect re-drives, or execute
    // times out) — never an unbounded hang.
    const te = Date.now();
    await client.execute('calling.play', playParams()).catch(() => {});
    out.pending_faulted_not_hung = Date.now() - te < BOUNDED_WINDOW_MS;
  } finally {
    await client.disconnect();
    await Promise.race([runPromise, sleep(500)]);
    // No zombie: after disconnect the client is not connected.
    out.zombie = (client as unknown as { _connected: boolean })._connected;
    f.close();
  }
  return out;
}

async function driveMaxActiveCalls(RelayClient: RelayClientCtor, cap: number): Promise<object> {
  const out = { cap_enforced: false };
  const f = await FakeWs.create(() => ({ answerPing: true }));
  pointAt(f);
  const client = new RelayClient({
    project: 'p',
    token: 't',
    contexts: ['default'],
    maxActiveCalls: cap,
  });
  client.onCall(async () => {
    await sleep(BOUNDED_WINDOW_MS); // keep each accepted call "active"
  });
  try {
    await client.connect();
    const conn = f.currentConn();
    if (conn) {
      for (let i = 0; i < cap + 1; i++) {
        f.pushToCurrent({
          jsonrpc: '2.0',
          method: 'signalwire.event',
          params: {
            event_type: 'calling.call.receive',
            params: {
              call_id: `c${i}`,
              node_id: NODE,
              direction: 'inbound',
              call_state: 'created',
              context: 'default',
            },
          },
        });
        await sleep(20);
      }
      await sleep(300);
      out.cap_enforced =
        (client as unknown as { _calls: Map<string, unknown> })._calls.size === cap;
    }
  } finally {
    await client.disconnect();
    f.close();
  }
  return out;
}

async function main(): Promise<number> {
  const { RelayClient } = await import('../src/relay/RelayClient.js');
  const { RelayError } = await import('../src/relay/RelayError.js');

  const out: Record<string, object> = {};
  out['cred_missing_project'] = driveCredMissing(RelayClient, 'project');
  out['cred_missing_token'] = driveCredMissing(RelayClient, 'token');
  out['cred_auth_reject'] = await driveCredAuthReject(RelayClient, RelayError);
  out['relay_contract_500'] = await driveRelayContract(RelayClient, RelayError, '500');
  out['relay_contract_404'] = await driveRelayContract(RelayClient, RelayError, '404');
  out['relay_contract_410'] = await driveRelayContract(RelayClient, RelayError, '410');
  out['dead_peer_half_open'] = await driveDeadPeer(RelayClient);
  out['black_hole_silent_peer'] = await driveBlackHole(RelayClient);
  out['reconnect_after_drop'] = await driveReconnect(RelayClient);
  out['max_active_calls_cap'] = await driveMaxActiveCalls(RelayClient, 2);

  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  return 0;
}

main().then(
  (rc) => process.exit(rc),
  (err) => {
    process.stderr.write(`relay-liveness-dump: ${String(err)}\n`);
    process.exit(1);
  },
);
