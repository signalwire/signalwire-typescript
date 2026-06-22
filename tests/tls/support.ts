/**
 * support.ts — shared test-only TLS plumbing for the three cross-port
 * "every SDK does verified HTTPS + WSS" capability quadrants.
 *
 * Mirrors the Go pilot (signalwire-go commit b6b2b6d,
 * pkg/relay/tls_support_test.go + pkg/rest/namespaces/tls_support_test.go):
 *
 *   - resolveTlsCerts()       — walk up to porting-sdk/test_harness/tls, run
 *                               the idempotent gen_certs.sh, return the certs
 *                               dir (ca.crt / server.crt / server.key).
 *   - startTlsMockRelay()     — spawn `python -m mock_relay --tls`     (wss://)
 *   - startTlsMockSignalwire() — spawn `python -m mock_signalwire --tls` (https://)
 *
 * CA trust itself is NOT wired here — it is wired *before this process forks
 * its vitest worker* by the globalSetup at tests/tls/gen_certs_setup.ts, which
 * sets NODE_EXTRA_CA_CERTS=<certs>/ca.crt. That env var is honored by Node's
 * global TLS secure context (used by both `ws` and `fetch`/undici) only when
 * it is present at worker boot — empirically, setting it at runtime is a no-op
 * (the secure context is built once). So these helpers assume the worker
 * already trusts the test CA, and the negative subtests prove that trust is
 * real (a client given an *empty* root store is rejected).
 *
 * REAL verification only: no `rejectUnauthorized: false`, no transport/fetch
 * mocks. The dedicated --tls mocks run on their own ports so the plain-HTTP
 * shared mocks that the rest of the suite uses are untouched.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STARTUP_TIMEOUT_MS = 40_000; // mock_signalwire cold-loads 13 specs (~15s)
const PROBE_TIMEOUT_MS = 2_000;

// The --tls mocks pick FREE ports (bind :0) rather than hardcoded ones, so a
// stale/concurrent listener never collides. Each start function picks its own
// (relay: WS + HTTP independently); env overrides win when set.
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

async function resolveTlsPort(envVar: string): Promise<number> {
  const raw = process.env[envVar];
  if (raw) {
    const p = parseInt(raw, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  return pickFreePort();
}

/**
 * Resolve the porting-sdk root: $PORTING_SDK / $PSDK (the env vars run-ci.sh
 * exports) take precedence, otherwise walk this file's directory upward for an
 * adjacent `porting-sdk/` containing test_harness/. Returns the absolute
 * porting-sdk root, or null. The env-var path is needed in layouts where the
 * repo is reached through a symlink (so the realpath walk can't see the
 * sibling porting-sdk), which is exactly how the local dev tree is arranged.
 */
function resolvePortingSdkRoot(): string | null {
  const envRoot = process.env['PORTING_SDK'] ?? process.env['PSDK'];
  if (envRoot && existsSync(join(envRoot, 'test_harness'))) return envRoot;

  const here = fileURLToPath(import.meta.url);
  let dir = dirname(here);
  for (;;) {
    const candidate = join(dirname(dir), 'porting-sdk');
    if (existsSync(join(candidate, 'test_harness'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Return the dir to prepend to PYTHONPATH so `python -m <name>` resolves the
 * mock package (porting-sdk/test_harness/<name>), or null. In this environment
 * the mock packages are also importable from the system Python, so a null here
 * is non-fatal — the spawners fall back to system sys.path.
 */
function discoverPortingSdkPackage(name: string): string | null {
  const root = resolvePortingSdkRoot();
  if (root === null) return null;
  const candidate = join(root, 'test_harness', name);
  const init = join(candidate, name, '__init__.py');
  try {
    if (existsSync(init) && statSync(init).isFile()) return candidate;
  } catch {
    // fall through
  }
  return null;
}

/**
 * Locate porting-sdk/test_harness/tls, run the idempotent gen_certs.sh (a
 * no-op when the leaf cert still has >30 days left), and return the certs
 * directory containing ca.crt / server.crt / server.key. Returns null when
 * porting-sdk cannot be resolved or gen_certs.sh fails — callers skip the test
 * in that case, matching the harness adjacency contract.
 */
export function resolveTlsCerts(): string | null {
  const root = resolvePortingSdkRoot();
  if (root === null) return null;
  const tlsDir = join(root, 'test_harness', 'tls');
  const gen = join(tlsDir, 'gen_certs.sh');
  if (!existsSync(gen)) return null;
  const res = spawnSync('bash', [gen], { stdio: 'ignore' });
  if (res.status !== 0) return null;
  const certs = join(tlsDir, 'certs');
  if (existsSync(join(certs, 'ca.crt')) && existsSync(join(certs, 'server.crt'))) {
    return certs;
  }
  return null;
}

/**
 * Build a child env, prepending pkgDir to PYTHONPATH when known (otherwise the
 * mock resolves from the system Python's sys.path) plus extra overrides.
 */
function harnessEnv(pkgDir: string | null, extra: Record<string, string>): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (pkgDir !== null) {
    const sep = process.platform === 'win32' ? ';' : ':';
    env['PYTHONPATH'] = env['PYTHONPATH'] ? `${pkgDir}${sep}${env['PYTHONPATH']}` : pkgDir;
  }
  for (const [k, v] of Object.entries(extra)) env[k] = v;
  return env;
}

// ─── mock_relay --tls (wss://) ───────────────────────────────────────────

/** One journaled WS frame (subset of mock_relay.journal.JournalEntry). */
export interface RelayJournalEntry {
  direction: 'recv' | 'send';
  method: string;
  frame: unknown;
}

/** A running `python -m mock_relay --tls` instance on dedicated ports. */
export class TlsMockRelay {
  constructor(
    private readonly child: ChildProcess,
    /** WSS endpoint host:port (feed into RelayClient host + scheme:'wss'). */
    readonly relayHost: string,
    /** Plain-HTTP control plane base URL (kept HTTP even in --tls). */
    readonly httpUrl: string,
  ) {}

  /** Fetch the journal over the plain-HTTP control plane. */
  async journal(): Promise<RelayJournalEntry[]> {
    const resp = await fetch(`${this.httpUrl}/__mock__/journal`);
    if (!resp.ok) throw new Error(`tls mock_relay journal GET failed: ${resp.status}`);
    return (await resp.json()) as RelayJournalEntry[];
  }

  /** True if an inbound (SDK→server) frame with `method` was journaled. */
  async sawRecvMethod(method: string): Promise<boolean> {
    const j = await this.journal();
    return j.some((e) => e.direction === 'recv' && e.method === method);
  }

  stop(): void {
    try {
      this.child.kill();
    } catch {
      // ignore
    }
  }
}

/**
 * Spawn `python -m mock_relay --tls` on dedicated WS+HTTP ports. Resolves once
 * the plain-HTTP control plane answers /__mock__/health; returns null when the
 * harness is unavailable so the caller can skip.
 */
export async function startTlsMockRelay(): Promise<TlsMockRelay | null> {
  // null pkgDir is fine — the mock also resolves from the system Python.
  const pkgDir = discoverPortingSdkPackage('mock_relay');

  const tlsWsPort = await resolveTlsPort('MOCK_RELAY_TLS_WS_PORT');
  const tlsHttpPort = await resolveTlsPort('MOCK_RELAY_TLS_HTTP_PORT');
  const httpUrl = `http://127.0.0.1:${tlsHttpPort}`;
  const relayHost = `127.0.0.1:${tlsWsPort}`;

  // Reuse an already-running --tls instance if one answers (probe-then-spawn).
  if (await probeHealth(httpUrl, 'schemas_loaded')) {
    return new TlsMockRelay(spawn('true'), relayHost, httpUrl);
  }

  const child = spawn(
    'python',
    [
      '-m',
      'mock_relay',
      '--host',
      '127.0.0.1',
      '--ws-port',
      String(tlsWsPort),
      '--http-port',
      String(tlsHttpPort),
      '--tls',
      '--log-level',
      'error',
    ],
    {
      detached: true,
      stdio: 'ignore',
      env: harnessEnv(pkgDir, { SIGNALWIRE_MOCK_TLS: '1' }),
    },
  );
  child.unref();

  if (await waitHealth(httpUrl, 'schemas_loaded')) {
    return new TlsMockRelay(child, relayHost, httpUrl);
  }
  try {
    child.kill();
  } catch {
    // ignore
  }
  return null;
}

// ─── mock_signalwire --tls (https://) ────────────────────────────────────

/** One journaled HTTP request (subset of mock_signalwire.journal.JournalEntry). */
export interface RestJournalEntry {
  method: string;
  path: string;
}

/** A running `python -m mock_signalwire --tls` instance. */
export class TlsMockSignalwire {
  constructor(
    private readonly child: ChildProcess,
    /** https://127.0.0.1:<port> — feed into RestClient host (https preserved). */
    readonly baseUrl: string,
  ) {}

  /** Fetch the journal over HTTPS (TLS mode serves /__mock__/ over TLS too). */
  async journal(): Promise<RestJournalEntry[]> {
    const resp = await fetch(`${this.baseUrl}/__mock__/journal`);
    if (!resp.ok) throw new Error(`tls mock_signalwire journal GET failed: ${resp.status}`);
    return (await resp.json()) as RestJournalEntry[];
  }

  /** Most recent journaled request; throws when empty (request never landed). */
  async last(): Promise<RestJournalEntry> {
    const entries = await this.journal();
    if (entries.length === 0) {
      throw new Error('tls mock_signalwire journal empty — HTTPS request did not reach the mock');
    }
    return entries[entries.length - 1]!;
  }

  stop(): void {
    try {
      this.child.kill();
    } catch {
      // ignore
    }
  }
}

/**
 * Spawn `python -m mock_signalwire --tls` on a dedicated port. The readiness
 * probe runs over HTTPS, so it only succeeds once TLS is up *and* the worker
 * trusts the CA (NODE_EXTRA_CA_CERTS, set by the globalSetup). Returns null
 * when the harness is unavailable so the caller can skip.
 */
export async function startTlsMockSignalwire(): Promise<TlsMockSignalwire | null> {
  // null pkgDir is fine — the mock also resolves from the system Python.
  const pkgDir = discoverPortingSdkPackage('mock_signalwire');

  const tlsPort = await resolveTlsPort('MOCK_SIGNALWIRE_TLS_PORT');
  const baseUrl = `https://127.0.0.1:${tlsPort}`;

  if (await probeHealth(baseUrl, 'specs_loaded')) {
    return new TlsMockSignalwire(spawn('true'), baseUrl);
  }

  const child = spawn(
    'python',
    [
      '-m',
      'mock_signalwire',
      '--host',
      '127.0.0.1',
      '--port',
      String(tlsPort),
      '--tls',
      '--log-level',
      'error',
    ],
    {
      detached: true,
      stdio: 'ignore',
      env: harnessEnv(pkgDir, { SIGNALWIRE_MOCK_TLS: '1' }),
    },
  );
  child.unref();

  if (await waitHealth(baseUrl, 'specs_loaded')) {
    return new TlsMockSignalwire(child, baseUrl);
  }
  try {
    child.kill();
  } catch {
    // ignore
  }
  return null;
}

// ─── readiness probing ───────────────────────────────────────────────────

async function probeHealth(baseUrl: string, marker: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const resp = await fetch(`${baseUrl}/__mock__/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return false;
    const body = (await resp.json()) as Record<string, unknown>;
    return marker in body;
  } catch {
    return false;
  }
}

async function waitHealth(baseUrl: string, marker: string): Promise<boolean> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await probeHealth(baseUrl, marker)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}
