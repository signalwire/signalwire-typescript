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

/* eslint-disable @typescript-eslint/no-explicit-any */

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
 * One recorded WebSocket frame from the mock server's journal. Mirrors
 * mock_relay.journal.JournalEntry over the wire.
 */
export interface RelayJournalEntry {
  timestamp: number;
  direction: 'recv' | 'send';
  method: string;
  request_id: string;
  frame: any;
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

  constructor(httpUrl: string, wsUrl: string, relayHost: string) {
    this.httpUrl = httpUrl;
    this.wsUrl = wsUrl;
    this.relayHost = relayHost;
  }

  // ─── Journal ─────────────────────────────────────────────────────

  /** Return every journaled WS frame in arrival order. */
  async journal(): Promise<RelayJournalEntry[]> {
    const resp = await fetch(`${this.httpUrl}/__mock__/journal`);
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

  /** Clear journal + scenarios. Tests typically call this from beforeEach. */
  async reset(): Promise<void> {
    await fetch(`${this.httpUrl}/__mock__/journal/reset`, { method: 'POST' });
    await fetch(`${this.httpUrl}/__mock__/scenarios/reset`, { method: 'POST' });
  }

  // ─── Scenarios — fire AFTER a matching SDK execute ────────────────

  /**
   * Queue scripted post-RPC events for `method` (FIFO consume-once).
   * Each event is `{emit: {...}, delay_ms: N, event_type?: "..."}`.
   */
  async armMethod(method: string, events: Array<Record<string, any>>): Promise<void> {
    const resp = await fetch(`${this.httpUrl}/__mock__/scenarios/${method}`, {
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
    device?: any;
    losers?: Array<{ call_id: string; states: string[] }>;
    delay_ms?: number;
  }): Promise<void> {
    const resp = await fetch(`${this.httpUrl}/__mock__/scenarios/dial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: armDial failed: ${resp.status}`);
    }
  }

  // ─── Server-initiated pushes ──────────────────────────────────────

  /** Push a single signalwire.event (or any frame) to the SDK. */
  async push(frame: Record<string, any>, sessionId?: string): Promise<any> {
    let url = `${this.httpUrl}/__mock__/push`;
    if (sessionId) url = `${url}?session_id=${encodeURIComponent(sessionId)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame }),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: push failed: ${resp.status}`);
    }
    return resp.json();
  }

  /** Inject an inbound-call announcement (calling.call.receive + state events). */
  async inboundCall(opts: {
    call_id?: string;
    from_number?: string;
    to_number?: string;
    context?: string;
    auto_states?: string[];
    delay_ms?: number;
    session_id?: string;
  } = {}): Promise<any> {
    const body: Record<string, any> = {
      from_number: opts.from_number ?? '+15551234567',
      to_number: opts.to_number ?? '+15559876543',
      context: opts.context ?? 'default',
      auto_states: opts.auto_states ?? ['created'],
      delay_ms: opts.delay_ms ?? 50,
    };
    if (opts.call_id != null) body.call_id = opts.call_id;
    if (opts.session_id != null) body.session_id = opts.session_id;
    const resp = await fetch(`${this.httpUrl}/__mock__/inbound_call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: inboundCall failed: ${resp.status}`);
    }
    return resp.json();
  }

  /** Run a scripted timeline of pushes/sleeps/expect_recv on the server. */
  async scenarioPlay(ops: Array<Record<string, any>>): Promise<any> {
    const resp = await fetch(`${this.httpUrl}/__mock__/scenario_play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ops),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: scenarioPlay failed: ${resp.status}`);
    }
    return resp.json();
  }

  /** List active WebSocket sessions on the mock. */
  async sessions(): Promise<any[]> {
    const resp = await fetch(`${this.httpUrl}/__mock__/sessions`);
    if (!resp.ok) {
      throw new Error(`mocktest: sessions failed: ${resp.status}`);
    }
    const body = (await resp.json()) as Record<string, unknown>;
    return ((body.sessions as any[]) ?? []) as any[];
  }
}

// ---------------------------------------------------------------------------
// Server lifecycle (singleton across the test process)
// ---------------------------------------------------------------------------

const DEFAULT_WS_PORT = 8776;
const DEFAULT_HTTP_PORT = 9776;
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

function resolveWsPort(): number {
  const raw = process.env['MOCK_RELAY_WS_PORT'];
  if (raw) {
    const p = parseInt(raw, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return DEFAULT_WS_PORT;
}

function resolveHttpPort(wsPort: number): number {
  const raw = process.env['MOCK_RELAY_HTTP_PORT'];
  if (raw) {
    const p = parseInt(raw, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  // Default behavior of mock-relay: HTTP = WS + 1000.
  return wsPort + 1000;
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
    const wsPort = resolveWsPort();
    const httpPort = resolveHttpPort(wsPort);
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
  const mock = await ensureServer();
  await mock.reset();

  const client = new RelayClient({
    project: 'test_proj',
    token: 'test_tok',
    host: mock.relayHost,
    scheme: 'ws',
    contexts: ['default'],
    ...options,
  });
  await client.connect();

  return { client, mock };
}
