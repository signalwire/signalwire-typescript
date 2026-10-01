/**
 * envelope-dump.ts — the TypeScript port's error-ENVELOPE dump program for the
 * cross-port behavioral differ (porting-sdk/scripts/diff_port_envelope.py).
 *
 * The differ boots its own oracle (the real signalwire-python client against a
 * mock) and, with `--dump-cmd`, runs THIS program and byte-compares the shared
 * artifact per corpus case. So this program must run the identical corpus with
 * the TS SDK's own REST client and emit, to stdout, ONE JSON object mapping
 *
 *   corpus-id -> { raised, error_kind, status_code, body_error_code, request_count }
 *
 * exactly as the Python oracle produces it (see envelope_corpus.py /
 * diff_port_envelope.build_oracle — this file mirrors that logic in TS).
 *
 *   error_kind    : "typed"  when the raised error is a member of the SDK's typed
 *                   RestError family (RestError / RestTransportError), else
 *                   "bare:<ClassName>" for a leaked non-typed error, else null.
 *   status_code   : the decoded HTTP status, or null for a transport failure.
 *   body_error_code: errors[0].code decoded from the error body, or null.
 *   request_count : how many times the mock journal saw the route (retry check);
 *                   0 for a transport case (nothing reached the server).
 *
 * The corpus below is the TS-native mirror of porting-sdk/scripts/envelope_corpus.py
 * (the single source of truth). When that corpus grows, add the new case here.
 * As of plan 4.2 it also covers the RequestOptions envelope: request_options
 * (retries / retry_backoff / timeout), scenario_repeat (arm the SAME override N
 * times FIFO), and POST cases (a call.method/body + a distinct endpoint/path).
 *
 * Run from the signalwire-typescript repo root (the mock is discovered via the
 * porting-sdk adjacency walk, or reused via MOCK_SIGNALWIRE_PORT):
 *
 *   npx tsx scripts/envelope-dump.ts
 *
 * Nothing but the JSON object is written to stdout on success.
 */

// Silence the SDK logger BEFORE the HttpClient module (and its Logger) is loaded:
// the logger reads SIGNALWIRE_LOG_MODE at module-init and would otherwise emit
// debug lines to STDOUT, corrupting the JSON-only stdout contract the differ parses.
// ES `import` bindings are hoisted above top-level statements, so a static
// `import { HttpClient }` would evaluate the Logger before any assignment here runs.
// We therefore set the env default first and import the SDK modules DYNAMICALLY.
process.env['SIGNALWIRE_LOG_MODE'] ??= 'off';

import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HttpClient as HttpClientType } from '../src/rest/HttpClient.js';
import type { RequestOptionsInit } from '../src/rest/RequestOptions.js';

const { HttpClient } = await import('../src/rest/HttpClient.js');
const { RestError } = await import('../src/rest/RestError.js');

// Fixed credentials -> a stable Basic-Auth header (the mock scenario session key),
// mirroring the Python oracle's PROJECT/TOKEN.
const PROJECT = 'envelope_proj';
const TOKEN = 'envelope_tok';
const AUTH_HEADER = 'Basic ' + Buffer.from(`${PROJECT}:${TOKEN}`).toString('base64');

// The default endpoint every GET case targets: fabric.list_fabric_addresses ->
// GET /api/fabric/addresses (a list route present in every port's client).
const ENDPOINT = 'fabric.list_fabric_addresses';
const PATH = '/api/fabric/addresses';
// A POST route present in every port — for the idempotency-asymmetry cases.
const CREATE_ENDPOINT = 'relay-rest.create_address';
const CREATE_PATH = '/api/relay/rest/addresses';

interface Scenario {
  status: number;
  response: unknown;
  headers?: Record<string, string>;
  delay_ms?: number;
}

interface CaseCall {
  method: string;
  path: string;
  body?: unknown;
}

interface CaseRequestOptions {
  retries?: number;
  retry_backoff?: number;
  timeout?: number;
}

interface Case {
  id: string;
  endpoint: string;
  call: CaseCall;
  scenario: Scenario | null;
  /** Arm the SAME scenario override N times (FIFO). Default 1. */
  scenarioRepeat?: number;
  /** RequestOptions to pass for this call (absent => port default, retries 0). */
  requestOptions?: CaseRequestOptions;
  transport?: boolean;
  /**
   * When set ('ctx' | 'signal' | 'both'), this is a cancellation-COMPOSITION case
   * (PSDK-4c) whose artifact is the compose classification
   * {ctx_cancel_honored, signal_cancel_honored, both_compose} rather than the
   * error-envelope artifact — the differ dispatches on the corpus case's
   * `observe.kind === 'compose'`. These cases drive a SLOW (3s) response and
   * assert the request is cancelled within COMPOSE_WINDOW_MS by the intended
   * source. See runComposeCase.
   */
  composeLeg?: 'ctx' | 'signal' | 'both';
}

// Compose timing knobs — MUST match diff_port_envelope.py's _drive_compose
// (_COMPOSE_WINDOW_S / _COMPOSE_SHORT_TIMEOUT / _COMPOSE_LONG_TIMEOUT and the
// corpus scenario's delay_ms). These are a CONTRACT with the differ, not
// arbitrary numbers: the short timeout must be < the slow delay so it fires, and
// the long timeout must be > it so the SIGNAL is what cancels.
/** Bounded iff cancelled within this window (ms). */
const COMPOSE_WINDOW_MS = 1500;
/** Per-request timeout (seconds) shorter than the 3s delay: it FIRES. */
const COMPOSE_SHORT_TIMEOUT_S = 0.5;
/** Per-request timeout (seconds) longer than the 3s delay: the SIGNAL fires, not this. */
const COMPOSE_LONG_TIMEOUT_S = 10.0;
/** The armed slow-response delay (ms). */
const COMPOSE_SLOW_DELAY_MS = 3000;

// Mirror of porting-sdk/scripts/envelope_corpus.py CORPUS.
const GET_CALL: CaseCall = { method: 'GET', path: PATH };
const CREATE_CALL: CaseCall = { method: 'POST', path: CREATE_PATH, body: { label: 'x' } };

const CORPUS: Case[] = [
  { id: 'envelope_200_success', endpoint: ENDPOINT, call: GET_CALL, scenario: null },
  {
    id: 'envelope_404_typed',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: {
      status: 404,
      response: { errors: [{ code: 'NOT_FOUND', message: 'no such address' }] },
    },
  },
  {
    id: 'envelope_429_retry_after',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: {
      status: 429,
      response: { errors: [{ code: 'RATE_LIMITED', message: 'slow down' }] },
      headers: { 'Retry-After': '2' },
    },
  },
  {
    id: 'envelope_503_unavailable',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: {
      status: 503,
      response: { errors: [{ code: 'UNAVAILABLE', message: 'maintenance' }] },
    },
  },
  {
    id: 'envelope_500_malformed_body',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: { status: 500, response: 'not-json-at-all <garbage' },
  },
  {
    id: 'envelope_200_with_error_body',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: {
      status: 200,
      response: { errors: [{ code: 'SOFT_FAIL', message: 'ignored on 2xx' }] },
    },
  },
  {
    id: 'envelope_503_delayed',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: {
      status: 503,
      response: { errors: [{ code: 'UNAVAILABLE', message: 'slow-fail' }] },
      delay_ms: 200,
    },
  },
  {
    id: 'envelope_transport_refused',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: null,
    transport: true,
  },

  // ---- RequestOptions envelope — opt-in retry (plan 4.2). retry_backoff=0 so
  // the differ never waits on wall-clock; the observable is the attempt COUNT.
  {
    id: 'envelope_get_retry_once_succeeds',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: {
      status: 503,
      response: { errors: [{ code: 'UNAVAILABLE', message: 'transient' }] },
    },
    requestOptions: { retries: 1, retry_backoff: 0 },
  },
  {
    id: 'envelope_get_retry_exhausted',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: {
      status: 503,
      response: { errors: [{ code: 'UNAVAILABLE', message: 'down' }] },
    },
    requestOptions: { retries: 1, retry_backoff: 0 },
    scenarioRepeat: 2,
  },
  {
    id: 'envelope_post_500_not_retried',
    endpoint: CREATE_ENDPOINT,
    call: CREATE_CALL,
    scenario: {
      status: 500,
      response: { errors: [{ code: 'SERVER_ERROR', message: 'boom' }] },
    },
    requestOptions: { retries: 2, retry_backoff: 0 },
  },
  {
    id: 'envelope_post_503_retried',
    endpoint: CREATE_ENDPOINT,
    call: CREATE_CALL,
    scenario: {
      status: 503,
      response: { errors: [{ code: 'UNAVAILABLE', message: 'throttled' }] },
    },
    requestOptions: { retries: 1, retry_backoff: 0 },
  },

  // ---- timeout / abortSignal COMPOSITION (PSDK-4c). The two cancellation
  // sources must COMPOSE (merge, never replace): a cancel from EITHER cancels
  // the request. TypeScript merges them in HttpClient._attemptSignal via
  // AbortSignal.any([abortSignal, timeoutSignal]), so all three legs hold.
  // The artifact is the compose classification, not the envelope artifact.
  {
    id: 'compose_ctx_timeout_alone',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: null,
    composeLeg: 'ctx',
  },
  {
    id: 'compose_abort_signal_alone',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: null,
    composeLeg: 'signal',
  },
  {
    id: 'compose_ctx_and_signal_both',
    endpoint: ENDPOINT,
    call: GET_CALL,
    scenario: null,
    composeLeg: 'both',
  },
];

interface Artifact {
  raised: boolean;
  error_kind: string | null;
  status_code: number | null;
  body_error_code: string | null;
  request_count: number;
}

/** Pull errors[0].code out of a decoded body, or null (mirrors the differ). */
function decodeBodyErrorCode(body: unknown): string | null {
  let obj = body;
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj) as unknown;
    } catch {
      return null;
    }
  }
  if (obj && typeof obj === 'object') {
    const errs = (obj as { errors?: unknown }).errors;
    if (Array.isArray(errs) && errs.length > 0 && errs[0] && typeof errs[0] === 'object') {
      const code = (errs[0] as { code?: unknown }).code;
      return typeof code === 'string' ? code : null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// mock_signalwire discovery + lifecycle (adjacency walk + spawn, or reuse
// MOCK_SIGNALWIRE_PORT). Mirrors tests/rest/mocktest.ts.
// ---------------------------------------------------------------------------

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
        // not found
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function pickFreePort(): Promise<number> {
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

async function probeHealth(baseUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const resp = await fetch(`${baseUrl}/__mock__/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return false;
    const body = (await resp.json()) as Record<string, unknown>;
    return 'specs_loaded' in body;
  } catch {
    return false;
  }
}

interface MockServer {
  url: string;
  child: ChildProcess | null;
}

async function startMock(): Promise<MockServer> {
  // Reuse a pre-spawned mock when MOCK_SIGNALWIRE_PORT is set (CI gate owns it).
  const envPort = process.env['MOCK_SIGNALWIRE_PORT'];
  if (envPort) {
    const url = `http://127.0.0.1:${envPort}`;
    if (await probeHealth(url)) return { url, child: null };
  }

  const port = await pickFreePort();
  const url = `http://127.0.0.1:${port}`;
  const pkgDir = discoverPortingSdkPackage('mock_signalwire');
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
      'mock_signalwire',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--log-level',
      'error',
    ],
    { detached: true, stdio: 'ignore', env: childEnv },
  );
  child.unref();

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await probeHealth(url)) return { url, child };
    await new Promise((r) => setTimeout(r, 150));
  }
  try {
    if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
  throw new Error(
    `envelope-dump: 'python -m mock_signalwire' did not become ready on ${url} within 30s ` +
      '(clone porting-sdk next to signalwire-typescript, or set MOCK_SIGNALWIRE_PORT)',
  );
}

function stopMock(server: MockServer): void {
  if (!server.child) return; // reused a shared mock; not ours to kill
  try {
    if (server.child.pid !== undefined) process.kill(-server.child.pid, 'SIGKILL');
  } catch {
    try {
      server.child.kill('SIGKILL');
    } catch {
      // already gone
    }
  }
}

async function post(url: string, body?: unknown): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

interface JournalEntry {
  path: string;
}

async function journalCount(baseUrl: string, path: string): Promise<number> {
  const resp = await fetch(
    `${baseUrl}/__mock__/journal?session_id=${encodeURIComponent(AUTH_HEADER)}`,
  );
  const data = (await resp.json()) as JournalEntry[] | { entries?: JournalEntry[] };
  const entries = Array.isArray(data) ? data : (data.entries ?? []);
  return entries.filter((e) => e.path === path).length;
}

/** Translate a corpus request_options spec into the SDK's RequestOptions. */
function toRequestOptions(spec: CaseRequestOptions | undefined): RequestOptionsInit | undefined {
  if (!spec) return undefined;
  const opts: RequestOptionsInit = {};
  if (spec.retries !== undefined) opts.retries = spec.retries;
  if (spec.retry_backoff !== undefined) opts.retryBackoff = spec.retry_backoff;
  if (spec.timeout !== undefined) opts.timeout = spec.timeout;
  return opts;
}

async function runCase(server: MockServer, c: Case): Promise<Artifact> {
  // Fresh journal + scenarios per case so request_count is exact.
  await post(`${server.url}/__mock__/journal/reset`);
  await post(`${server.url}/__mock__/scenarios/reset`);

  if (c.scenario !== null) {
    // scenarioRepeat arms the SAME override N times (FIFO) so a retry-armed
    // case sees the failure on every attempt.
    const repeat = c.scenarioRepeat ?? 1;
    for (let i = 0; i < repeat; i++) {
      await post(
        `${server.url}/__mock__/scenarios/${c.endpoint}?session_id=${encodeURIComponent(AUTH_HEADER)}`,
        c.scenario,
      );
    }
  }

  // A transport case points the client at a DEAD port (bind a free port then
  // release it) so the connection is refused — mirroring the differ.
  let baseUrl = server.url;
  if (c.transport) {
    const dead = await pickFreePort();
    baseUrl = `http://127.0.0.1:${dead}`;
  }

  const client: HttpClientType = new HttpClient({ baseUrl, project: PROJECT, token: TOKEN });
  const reqOpts = toRequestOptions(c.requestOptions);

  const artifact: Artifact = {
    raised: false,
    error_kind: null,
    status_code: null,
    body_error_code: null,
    request_count: 0,
  };

  try {
    if (c.call.method === 'POST') {
      await client.post(c.call.path, c.call.body, undefined, reqOpts);
    } else {
      await client.get(c.call.path, undefined, reqOpts);
    }
  } catch (e) {
    artifact.raised = true;
    if (e instanceof RestError) {
      artifact.error_kind = 'typed';
      artifact.status_code = e.statusCode;
      artifact.body_error_code = decodeBodyErrorCode(e.body);
    } else {
      const name =
        e && typeof e === 'object' && 'constructor' in e
          ? (e as Error).constructor.name
          : String(e);
      artifact.error_kind = 'bare:' + name;
      const sc = (e as { statusCode?: unknown }).statusCode;
      artifact.status_code = typeof sc === 'number' ? sc : null;
    }
  }

  artifact.request_count = c.transport ? 0 : await journalCount(server.url, c.call.path);
  return artifact;
}

/**
 * The compose-case artifact the differ byte-compares against the python golden
 * {ctx_cancel_honored, signal_cancel_honored, both_compose}.
 */
interface ComposeClassification {
  ctx_cancel_honored: boolean;
  signal_cancel_honored: boolean;
  both_compose: boolean;
}

/**
 * Drive one composition leg against a local HTTP server that delays its 200 by
 * COMPOSE_SLOW_DELAY_MS, and report whether the request was cancelled inside
 * COMPOSE_WINDOW_MS by the intended source.
 *
 * The "ctx" source in TypeScript is `RequestOptions.timeout` — TS has no
 * `context.Context`; the per-request wall-clock deadline is the timeout field,
 * exactly as in the Python oracle (`_drive_compose` arms it the same way). The
 * "signal" source is the native `AbortSignal`. Both are passed as ordinary
 * RequestOptions through the public verb API, and `HttpClient._attemptSignal`
 * merges them with `AbortSignal.any` — so neither replaces the other.
 *
 * A cancellation surfaces as `RestTransportError` (a member of the typed
 * RestError family), which the SDK raises both pre-attempt (already-aborted
 * signal) and on the fetch rejection (timeout / in-flight abort). Any other
 * bounded error still counts as cut, mirroring the differ's broad except.
 */
async function runComposeCase(c: Case): Promise<ComposeClassification> {
  const httpServer: HttpServer = createHttpServer((_req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [] }));
    }, COMPOSE_SLOW_DELAY_MS);
  });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const addr = httpServer.address();
  const port = addr && typeof addr === 'object' ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Run one GET and report whether it returned (was cancelled) within the window.
  const bounded = async (
    timeout: number,
    abortSignal: AbortSignal | undefined,
  ): Promise<boolean> => {
    const client: HttpClientType = new HttpClient({ baseUrl, project: PROJECT, token: TOKEN });
    const opts: RequestOptionsInit = { timeout, retries: 0 };
    if (abortSignal !== undefined) opts.abortSignal = abortSignal;
    const t0 = Date.now();
    try {
      await client.get(c.call.path, undefined, opts);
      return false; // ran to completion — nothing cancelled it
    } catch {
      // Any raised error is a cut; it counts only if it landed in-window.
      return Date.now() - t0 < COMPOSE_WINDOW_MS;
    }
  };

  const out: ComposeClassification = {
    ctx_cancel_honored: false,
    signal_cancel_honored: false,
    both_compose: false,
  };

  try {
    if (c.composeLeg === 'ctx') {
      // SHORT timeout vs the slow response, NO signal: the timeout must cut it.
      out.ctx_cancel_honored = await bounded(COMPOSE_SHORT_TIMEOUT_S, undefined);
    } else if (c.composeLeg === 'signal') {
      // GENEROUS timeout, a PRE-ABORTED signal: the SIGNAL must cut it.
      const ctrl = new AbortController();
      ctrl.abort();
      out.signal_cancel_honored = await bounded(COMPOSE_LONG_TIMEOUT_S, ctrl.signal);
    } else {
      // BOTH a short timeout AND a live (un-aborted) signal armed. Cancel-from-
      // either: here the TIMEOUT is what fires, proving the timeout is NOT
      // dropped when a signal coexists (the go GO-5 replace-instead-of-merge bug).
      const ctrl = new AbortController();
      out.both_compose = await bounded(COMPOSE_SHORT_TIMEOUT_S, ctrl.signal);
    }
  } finally {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  return out;
}

async function main(): Promise<void> {
  const server = await startMock();
  const out: Record<string, Artifact | ComposeClassification> = {};
  try {
    for (const c of CORPUS) {
      // Composition cases have a DIFFERENT artifact and drive their own local
      // slow server — they never touch the shared mock.
      out[c.id] = c.composeLeg ? await runComposeCase(c) : await runCase(server, c);
    }
  } finally {
    stopMock(server);
  }
  process.stdout.write(JSON.stringify(out) + '\n');
}

main().catch((err) => {
  process.stderr.write(`envelope-dump: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
