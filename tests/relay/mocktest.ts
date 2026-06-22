/**
 * mocktest.ts — TypeScript test helper for the porting-sdk mock_relay
 * WebSocket server. Mirrors the Python conftest fixtures
 * (`signalwire_relay_client` + `mock_relay`) so vitest tests can drive the
 * real RelayClient over a real WebSocket against a schema-driven mock RELAY
 * backend.
 *
 * The mock server's lifetime is per-process: the first newRelayClient() call
 * probes http://127.0.0.1:<httpPort>/__mock__/health and either confirms a
 * running server or starts one as a detached subprocess. Each test gets a
 * freshly reset journal/scenario state via the harness's `reset()` (called
 * from beforeEach in the per-file test files).
 *
 * The default WebSocket port is 8776 (matches the TS rollout's reserved
 * port from the porting-sdk parallel-port matrix). The HTTP control plane
 * runs at WS port + 1000 = 9776. Override with MOCK_RELAY_WS_PORT in the
 * environment if a different mock instance is already running.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RelayClient } from '../../src/relay/RelayClient.js';
import type { RelayClientOptions } from '../../src/relay/types.js';

/**
 * Walk this file's directory upward looking for an adjacent
 * `porting-sdk/test_harness/<name>/<name>/__init__.py`. The adjacency
 * contract is "porting-sdk lives next to signalwire-typescript in ~/src/",
 * so a fresh clone of either repo can find the mock harness with no prior
 * `pip install -e`. Returns the absolute path to the directory containing
 * the Python package (i.e. the value to put on PYTHONPATH so that
 * `python -m <name>` resolves), or `null` when no adjacent porting-sdk is
 * reachable.
 */
function discoverPortingSdkPackage(name: string): string | null {
  const here = fileURLToPath(import.meta.url);
  let dir = dirname(here);
  for (;;) {
    const candidate = join(dirname(dir), 'porting-sdk', 'test_harness', name);
    const init = join(candidate, name, '__init__.py');
    if (existsSync(init)) {
      try {
        if (statSync(init).isFile()) return candidate;
      } catch {
        // fall through, treat as not found
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * A decoded JSON-RPC frame as journaled by the mock. Tests reach deep into
 * `frame.params.<...>` to assert wire shape, so the frame is modeled as an
 * open, self-nesting structure rather than `any`: every property OR numeric
 * index read hands back the same open node, which keeps chained reads
 * (`frame.params.authentication.project`, `p.devices[0][0].type`) and
 * array-shape reads (`p.devices.length`, `.filter(...)`) ergonomic without
 * per-site casts, while the file stays free of `any`. A `RelayFrame` is an
 * open object; the numeric index + `length`/array members let the same node
 * stand in for the array payloads the wire frames carry.
 */
export interface RelayFrame {
  [key: string]: RelayFrameValue;
  [index: number]: RelayFrameValue;
}

/** A node inside a journaled frame — itself an open `RelayFrame`. */
export type RelayFrameValue = RelayFrame;

/**
 * One recorded WebSocket frame from the mock server's journal. Mirrors
 * mock_relay.journal.JournalEntry over the wire.
 */
export interface RelayJournalEntry {
  timestamp: number;
  direction: 'recv' | 'send';
  method: string;
  request_id: string;
  frame: RelayFrame;
  connection_id: string;
  session_id: string;
}

/**
 * Harness wraps the running mock relay server. Exposes journal accessors,
 * scenario-arming helpers, server-initiated push helpers, and a reset
 * method tests call from beforeEach.
 */
export class MockRelayHarness {
  /** HTTP control-plane base URL — `http://host:port`, no trailing slash. */
  readonly httpUrl: string;
  /** WebSocket URL — `ws://host:port`. */
  readonly wsUrl: string;
  /** `host:port` (no scheme) — feed straight into `RelayClient`'s `host`. */
  readonly relayHost: string;

  /**
   * When set, journal reads and `reset()` are scoped to this session id (the
   * server-assigned `sessionid` from the connect handshake), so a test only
   * ever sees its own frames and never disturbs another test's.
   * `newRelayClient()` sets this automatically. Left empty => global (legacy,
   * single-threaded).
   */
  sessionId = '';

  constructor(httpUrl: string, wsUrl: string, relayHost: string) {
    this.httpUrl = httpUrl;
    this.wsUrl = wsUrl;
    this.relayHost = relayHost;
  }

  /** `?session_id=<id>` suffix for control-plane calls when scoped, else ''. */
  private sessionQuery(): string {
    return this.sessionId ? `?session_id=${encodeURIComponent(this.sessionId)}` : '';
  }

  // ─── Journal ─────────────────────────────────────────────────────

  /** Return journaled WS frames in arrival order (scoped to this session when
   * `sessionId` is set). */
  async journal(): Promise<RelayJournalEntry[]> {
    const resp = await fetch(`${this.httpUrl}/__mock__/journal${this.sessionQuery()}`);
    if (!resp.ok) {
      throw new Error(`mocktest: GET /__mock__/journal failed: ${resp.status}`);
    }
    return (await resp.json()) as RelayJournalEntry[];
  }

  /** Return inbound (SDK→server) journal entries, optionally by method. */
  async journalRecv(method?: string): Promise<RelayJournalEntry[]> {
    const j = await this.journal();
    let entries = j.filter((e) => e.direction === 'recv');
    if (method != null) entries = entries.filter((e) => e.method === method);
    return entries;
  }

  /** Return outbound (server→SDK) journal entries, optionally by event_type. */
  async journalSend(eventType?: string): Promise<RelayJournalEntry[]> {
    const j = await this.journal();
    const entries = j.filter((e) => e.direction === 'send');
    if (eventType == null) return entries;
    return entries.filter((e) => {
      const params = e.frame?.params ?? {};
      return e.frame?.method === 'signalwire.event' && params?.event_type === eventType;
    });
  }

  /**
   * Return the most recent journal entry (any direction). Throws if the
   * journal is empty — every test that drives the SDK should produce at
   * least one entry.
   */
  async journalLast(): Promise<RelayJournalEntry> {
    const entries = await this.journal();
    if (entries.length === 0) {
      throw new Error('mocktest: relay journal is empty - SDK did not reach the mock');
    }
    return entries[entries.length - 1]!;
  }

  /** Clear journal + scenarios for this session (both scoped when `sessionId`
   * is set, global otherwise). Tests typically call this from beforeEach. */
  async reset(): Promise<void> {
    await fetch(`${this.httpUrl}/__mock__/journal/reset${this.sessionQuery()}`, { method: 'POST' });
    await fetch(`${this.httpUrl}/__mock__/scenarios/reset${this.sessionQuery()}`, {
      method: 'POST',
    });
  }

  /**
   * Reset this session's armed scenario queues (or all of them when unscoped).
   * Scenarios are session-scoped on the server, so a scoped harness clears only
   * its own queue — safe under parallel execution. Tests that arm scenarios
   * call this in setup so a prior run of the same test can't leak a scenario.
   */
  async resetScenarios(): Promise<void> {
    await fetch(`${this.httpUrl}/__mock__/scenarios/reset${this.sessionQuery()}`, {
      method: 'POST',
    });
  }

  // ─── Scenarios — fire AFTER a matching SDK execute ────────────────

  /**
   * Queue scripted post-RPC events for `method` (FIFO consume-once).
   * Each event is `{emit: {...}, delay_ms: N, event_type?: "..."}`.
   */
  async armMethod(method: string, events: Array<Record<string, unknown>>): Promise<void> {
    const resp = await fetch(`${this.httpUrl}/__mock__/scenarios/${method}${this.sessionQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(events),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: armMethod ${method} failed: ${resp.status}`);
    }
  }

  /** Queue a dial-dance scenario (winner state events + final dial event). */
  async armDial(opts: {
    tag: string;
    winner_call_id: string;
    states: string[];
    node_id?: string;
    device?: Record<string, unknown>;
    losers?: Array<{ call_id: string; states: string[] }>;
    delay_ms?: number;
  }): Promise<void> {
    const resp = await fetch(`${this.httpUrl}/__mock__/scenarios/dial${this.sessionQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: armDial failed: ${resp.status}`);
    }
  }

  // ─── Server-initiated pushes ──────────────────────────────────────

  /** Push a single signalwire.event (or any frame) to the SDK. Targets this
   * harness's session when scoped (so a parallel test's client never receives
   * it); an explicit `sessionId` arg overrides, and an unscoped harness with no
   * arg broadcasts (legacy single-threaded behavior). */
  async push(frame: Record<string, unknown>, sessionId?: string): Promise<RelayFrame> {
    const target = sessionId ?? this.sessionId;
    let url = `${this.httpUrl}/__mock__/push`;
    if (target) url = `${url}?session_id=${encodeURIComponent(target)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame }),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: push failed: ${resp.status}`);
    }
    return (await resp.json()) as RelayFrame;
  }

  /** Inject an inbound-call announcement (calling.call.receive + state events). */
  async inboundCall(
    opts: {
      call_id?: string;
      from_number?: string;
      to_number?: string;
      context?: string;
      auto_states?: string[];
      delay_ms?: number;
      session_id?: string;
    } = {},
  ): Promise<RelayFrame> {
    const body: Record<string, unknown> = {
      from_number: opts.from_number ?? '+15551234567',
      to_number: opts.to_number ?? '+15559876543',
      context: opts.context ?? 'default',
      auto_states: opts.auto_states ?? ['created'],
      delay_ms: opts.delay_ms ?? 50,
    };
    if (opts.call_id != null) body.call_id = opts.call_id;
    // Target this harness's session by default so the inbound-call sequence is
    // delivered only to this test's client (an unscoped harness broadcasts, as
    // before). An explicit opts.session_id overrides.
    const sid = opts.session_id ?? this.sessionId;
    if (sid) body.session_id = sid;
    const resp = await fetch(`${this.httpUrl}/__mock__/inbound_call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: inboundCall failed: ${resp.status}`);
    }
    return (await resp.json()) as RelayFrame;
  }

  /** Run a scripted timeline of pushes/sleeps/expect_recv on the server.
   * When this harness is session-scoped, each `push`/`expect_recv` op is
   * stamped with this session id (unless it already carries one), so the
   * timeline targets only this test's client and `expect_recv` matches only
   * this session's frames — making it parallel-safe. */
  async scenarioPlay(ops: Array<Record<string, unknown>>): Promise<RelayFrame> {
    const scoped = this.sessionId ? ops.map((op) => this.scopeOp(op)) : ops;
    const resp = await fetch(`${this.httpUrl}/__mock__/scenario_play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scoped),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: scenarioPlay failed: ${resp.status}`);
    }
    return (await resp.json()) as RelayFrame;
  }

  /** Inject this.sessionId into a timeline op's push/expect_recv spec when the
   * op doesn't already specify a session_id. Leaves sleep ops untouched. */
  private scopeOp(op: Record<string, unknown>): Record<string, unknown> {
    const out = { ...op };
    for (const key of ['push', 'expect_recv'] as const) {
      const spec = out[key];
      if (spec && typeof spec === 'object' && !('session_id' in spec)) {
        out[key] = { ...(spec as Record<string, unknown>), session_id: this.sessionId };
      }
    }
    return out;
  }

  /** List active WebSocket sessions on the mock. */
  async sessions(): Promise<RelayFrame[]> {
    const resp = await fetch(`${this.httpUrl}/__mock__/sessions`);
    if (!resp.ok) {
      throw new Error(`mocktest: sessions failed: ${resp.status}`);
    }
    const body = (await resp.json()) as Record<string, unknown>;
    return (body.sessions as RelayFrame[]) ?? [];
  }
}

// ---------------------------------------------------------------------------
// Server lifecycle (singleton across the test process)
// ---------------------------------------------------------------------------

const STARTUP_TIMEOUT_MS = 30_000;
const PROBE_TIMEOUT_MS = 2_000;

interface ServerState {
  harness: MockRelayHarness | null;
  child: ChildProcess | null;
  startError: Error | null;
  starting: Promise<void> | null;
}

const state: ServerState = {
  harness: null,
  child: null,
  startError: null,
  starting: null,
};

// Ask the OS for a free loopback TCP port (listen on :0, read it, close).
async function pickFreePort(): Promise<number> {
  const { createServer } = await import('node:net');
  return new Promise<number>((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      srv.close(() => (port > 0 ? resolve(port) : reject(new Error('failed to pick a free port'))));
    });
  });
}

// Env override wins; otherwise pick a FREE port rather than a hardcoded default
// that would collide with a stale/concurrent mock and hang the suite.
async function resolveWsPort(): Promise<number> {
  const raw = process.env['MOCK_RELAY_WS_PORT'];
  if (raw) {
    const p = parseInt(raw, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return pickFreePort();
}

// HTTP control plane: an independent free port (env override wins). Picked
// separately rather than ws+1000 so a dynamic WS port never derives a busy one.
async function resolveHttpPort(): Promise<number> {
  const raw = process.env['MOCK_RELAY_HTTP_PORT'];
  if (raw) {
    const p = parseInt(raw, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return pickFreePort();
}

async function probeHealth(httpUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const resp = await fetch(`${httpUrl}/__mock__/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return false;
    const body = (await resp.json()) as Record<string, unknown>;
    return 'schemas_loaded' in body;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<MockRelayHarness> {
  if (state.harness) return state.harness;
  if (state.startError) throw state.startError;
  if (state.starting) {
    await state.starting;
    if (state.harness) return state.harness;
    if (state.startError) throw state.startError;
  }

  state.starting = (async () => {
    const wsPort = await resolveWsPort();
    const httpPort = await resolveHttpPort();
    const httpUrl = `http://127.0.0.1:${httpPort}`;
    const wsUrl = `ws://127.0.0.1:${wsPort}`;
    const relayHost = `127.0.0.1:${wsPort}`;

    if (await probeHealth(httpUrl)) {
      state.harness = new MockRelayHarness(httpUrl, wsUrl, relayHost);
      return;
    }

    const pkgDir = discoverPortingSdkPackage('mock_relay');
    const childEnv = { ...process.env };
    if (pkgDir !== null) {
      const sep = process.platform === 'win32' ? ';' : ':';
      childEnv['PYTHONPATH'] = childEnv['PYTHONPATH']
        ? `${pkgDir}${sep}${childEnv['PYTHONPATH']}`
        : pkgDir;
    }

    const child = spawn(
      'python',
      [
        '-m',
        'mock_relay',
        '--host',
        '127.0.0.1',
        '--ws-port',
        String(wsPort),
        '--http-port',
        String(httpPort),
        '--log-level',
        'error',
      ],
      {
        detached: true,
        stdio: 'ignore',
        env: childEnv,
      },
    );
    child.unref();
    state.child = child;

    child.on('error', (err) => {
      state.startError = new Error(
        `mocktest: failed to spawn 'python -m mock_relay': ${err.message} ` +
          `(set MOCK_RELAY_WS_PORT to use a pre-running instance)`,
      );
    });

    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (state.startError) throw state.startError;
      if (await probeHealth(httpUrl)) {
        state.harness = new MockRelayHarness(httpUrl, wsUrl, relayHost);
        return;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    try {
      child.kill();
    } catch {
      // ignore
    }
    state.startError = new Error(
      `mocktest: 'python -m mock_relay' did not become ready within ` +
        `${STARTUP_TIMEOUT_MS}ms on ws=${wsPort} http=${httpPort} ` +
        `(clone porting-sdk next to signalwire-typescript so tests can find ` +
        `porting-sdk/test_harness/mock_relay/, or pip install the mock_relay package)`,
    );
    throw state.startError;
  })();

  await state.starting;
  if (!state.harness) {
    if (state.startError) throw state.startError;
    throw new Error('mocktest: server start completed without producing a harness');
  }
  return state.harness;
}

/**
 * Acquire the singleton harness. Use this from per-test setup (beforeAll /
 * beforeEach) when you need to push / journal but want to construct your
 * own RelayClient with custom options.
 */
export async function getMockRelay(): Promise<MockRelayHarness> {
  return ensureServer();
}

/**
 * newRelayClient builds a real RelayClient pointed at the local mock
 * (project=`test_proj`, token=`test_tok`, contexts=`['default']` by
 * default), connects it, and returns it alongside the harness. Mirrors the
 * Python `signalwire_relay_client` fixture.
 *
 * The journal is reset *before* this call returns so the test sees a clean
 * slate. The caller MUST call `await client.disconnect()` when done — there
 * is no per-test auto-cleanup hook in vitest's default surface.
 *
 * The mock listens on `ws://`, but `RelayClient` defaults to `wss://`. We
 * override `scheme: 'ws'` here so the SDK speaks the same protocol the
 * mock accepts. Production users continue to get `wss://` because they
 * never construct a client with `scheme: 'ws'`.
 */
export async function newRelayClient(
  options: Partial<RelayClientOptions> = {},
): Promise<{ client: RelayClient; mock: MockRelayHarness }> {
  const shared = await ensureServer();

  const client = new RelayClient({
    project: 'test_proj',
    token: 'test_tok',
    host: shared.relayHost,
    scheme: 'ws',
    contexts: ['default'],
    ...options,
  });
  await client.connect();

  // Return a per-call harness view scoped to THIS client's session, so the
  // test's journal reads/resets see only its own frames — making the shared
  // mock safe under concurrent (parallel) test execution. No global reset is
  // needed: a brand-new session starts with an empty (scoped) journal.
  const mock = new MockRelayHarness(shared.httpUrl, shared.wsUrl, shared.relayHost);
  mock.sessionId = sessionIdOf(client);

  return { client, mock };
}

/**
 * Read the server-assigned session id a connected `RelayClient` captured from
 * the connect handshake. The SDK keeps this internal (Python's `RelayClient`
 * doesn't expose it either — keeping the public surface identical), so tests
 * reach the private `_sessionId` field through a narrow cast. Use this to
 * re-scope a `MockRelayHarness` to a client a test built by hand.
 */
export function sessionIdOf(client: RelayClient): string {
  return (client as unknown as { _sessionId: string })._sessionId;
}
