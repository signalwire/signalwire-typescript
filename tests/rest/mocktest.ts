/**
 * mocktest.ts — TypeScript test helper for the porting-sdk mock_signalwire
 * HTTP server. Mirrors the Python conftest fixtures (signalwire_client + mock)
 * and the Go pilot at signalwire-go/pkg/rest/internal/mocktest/mocktest.go so
 * vitest tests can exercise the real SDK code path against a real HTTP server
 * backed by SignalWire's 13 OpenAPI specs.
 *
 * The mock server's lifetime is per-process: the first newMockClient() call
 * probes http://127.0.0.1:<port>/__mock__/health and either confirms a
 * running server or starts one as a detached subprocess. Each test gets a
 * freshly reset journal/scenario state via beforeEach.
 *
 * The default port is 8766 (matches the TS rollout's reserved port from the
 * porting-sdk parallel-port matrix). Override with MOCK_SIGNALWIRE_PORT in
 * the test environment if a different mock instance is already running.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RestClient } from '../../src/rest/index.js';

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
  // import.meta.url -> file:// URL -> absolute path of this very file.
  const here = fileURLToPath(import.meta.url);
  let dir = dirname(here);
  // Walk up until we hit the filesystem root. At each level we check for
  // ../porting-sdk/test_harness/<name>/<name>/__init__.py.
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
 * One recorded HTTP request from the mock server's journal. Mirrors
 * mock_signalwire.journal.JournalEntry over the wire.
 *
 * `body` is `null` for empty bodies, a parsed object for application/json,
 * and a string for everything else.
 */
export interface JournalEntry {
  timestamp: number;
  method: string;
  path: string;
  query_params: Record<string, string[]>;
  headers: Record<string, string>;
  body: any;
  matched_route: string | null;
  response_status: number | null;
}

/**
 * Harness wraps the running mock server. It exposes journal accessors,
 * a helper to push scenario overrides, and a reset method tests call from
 * beforeEach.
 */
export class MockHarness {
  readonly url: string;
  readonly port: number;

  constructor(url: string, port: number) {
    this.url = url;
    this.port = port;
  }

  /**
   * Return every entry recorded since the last reset, in arrival order.
   */
  async journal(): Promise<JournalEntry[]> {
    const resp = await fetch(`${this.url}/__mock__/journal`);
    if (!resp.ok) {
      throw new Error(`mocktest: GET /__mock__/journal failed: ${resp.status}`);
    }
    return (await resp.json()) as JournalEntry[];
  }

  /**
   * Return the most recent journal entry. Throws if the journal is empty —
   * every test that calls a mock-backed SDK method should produce at least
   * one entry.
   */
  async last(): Promise<JournalEntry> {
    const entries = await this.journal();
    if (entries.length === 0) {
      throw new Error('mocktest: journal is empty - SDK call did not reach the mock server');
    }
    return entries[entries.length - 1]!;
  }

  /**
   * Clear journal + scenarios on the mock server. Tests usually invoke this
   * from beforeEach to avoid cross-test bleed.
   */
  async reset(): Promise<void> {
    await fetch(`${this.url}/__mock__/journal/reset`, { method: 'POST' });
    await fetch(`${this.url}/__mock__/scenarios/reset`, { method: 'POST' });
  }

  /**
   * Stage a one-shot response override for the route identified by
   * endpointId. The status + body returned here will be served the next
   * time the route is hit; subsequent hits fall back to spec synthesis.
   *
   * endpointId is the Spectral-style "OperationId" from the OpenAPI spec —
   * see /__mock__/scenarios for the active list.
   */
  async pushScenario(endpointId: string, status: number, body: any): Promise<void> {
    const resp = await fetch(`${this.url}/__mock__/scenarios/${endpointId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, response: body }),
    });
    if (!resp.ok) {
      throw new Error(`mocktest: pushScenario ${endpointId} failed: ${resp.status}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Server lifecycle (singleton across the test process)
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 8766;
const STARTUP_TIMEOUT_MS = 30_000;
const PROBE_TIMEOUT_MS = 2_000;

interface ServerState {
  harness: MockHarness | null;
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

function resolvePort(): number {
  const raw = process.env['MOCK_SIGNALWIRE_PORT'];
  if (raw) {
    const p = parseInt(raw, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return DEFAULT_PORT;
}

async function probeHealth(baseUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const resp = await fetch(`${baseUrl}/__mock__/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return false;
    const body = (await resp.json()) as Record<string, unknown>;
    return 'specs_loaded' in body;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<MockHarness> {
  if (state.harness) return state.harness;
  if (state.startError) throw state.startError;
  if (state.starting) {
    await state.starting;
    if (state.harness) return state.harness;
    if (state.startError) throw state.startError;
  }

  state.starting = (async () => {
    const port = resolvePort();
    const url = `http://127.0.0.1:${port}`;

    // Probe — if a server is already running we reuse it.
    if (await probeHealth(url)) {
      state.harness = new MockHarness(url, port);
      return;
    }

    // Try to inject porting-sdk/test_harness/mock_signalwire/ into
    // PYTHONPATH so `python -m mock_signalwire` resolves without a prior
    // `pip install -e ...`. Adjacency contract: porting-sdk next to
    // signalwire-typescript in ~/src/. When the walk fails (e.g. porting-sdk
    // isn't adjacent), we still spawn — the child falls back to whatever
    // is on the system Python's sys.path, and the readiness probe surfaces
    // a clear timeout error if neither mode is available.
    const pkgDir = discoverPortingSdkPackage('mock_signalwire');
    const childEnv = { ...process.env };
    if (pkgDir !== null) {
      const sep = process.platform === 'win32' ? ';' : ':';
      childEnv['PYTHONPATH'] = childEnv['PYTHONPATH']
        ? `${pkgDir}${sep}${childEnv['PYTHONPATH']}`
        : pkgDir;
    }

    // Spawn a subprocess. We deliberately detach stdio (point them at
    // /dev/null) because Node's testing runner waits on the child's pipes
    // before exiting, which would hang the test process for the full
    // pipe-drain timeout when the subprocess stays alive across the test
    // binary lifetime. detached + unref() releases the parent.
    const child = spawn(
      'python',
      ['-m', 'mock_signalwire', '--host', '127.0.0.1', '--port', String(port), '--log-level', 'error'],
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
        `mocktest: failed to spawn 'python -m mock_signalwire': ${err.message} ` +
          `(set MOCK_SIGNALWIRE_PORT to use a pre-running instance)`,
      );
    });

    // Wait for /__mock__/health.
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (state.startError) throw state.startError;
      if (await probeHealth(url)) {
        state.harness = new MockHarness(url, port);
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
      `mocktest: 'python -m mock_signalwire' did not become ready within ${STARTUP_TIMEOUT_MS}ms on port ${port} ` +
        '(clone porting-sdk next to signalwire-typescript so tests can find ' +
        'porting-sdk/test_harness/mock_signalwire/, or pip install the mock_signalwire package)',
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
 * newMockClient builds a real RestClient pointed at the local mock plus a
 * harness exposing journal / scenario helpers. The mock's journal is reset
 * before this call returns, so the test sees a clean slate.
 *
 * The credentials are intentionally throwaway (`test_proj` / `test_tok`) —
 * the mock accepts any non-empty Basic Auth header — and the AccountSid in
 * the LAML paths becomes `test_proj`, matching the Python conftest
 * fixture's RestClient(project="test_proj", ...).
 */
export async function newMockClient(): Promise<{ client: RestClient; mock: MockHarness }> {
  const harness = await ensureServer();
  await harness.reset();

  // Pass `host` with the http:// prefix preserved — RestClient's `host` field
  // accepts a fully-qualified URL when the value starts with "http", which is
  // how we hop the constructor's default https:// normalization.
  const client = new RestClient({
    project: 'test_proj',
    token: 'test_tok',
    host: harness.url,
  });

  return { client, mock: harness };
}
