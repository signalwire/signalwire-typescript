/**
 * pagination-dump.ts — the TypeScript port's PAGINATION-CORPUS dump program for
 * the cross-port behavioral differ (porting-sdk/scripts/diff_port_pagination.py).
 *
 * The differ boots its own oracle (the real signalwire-python PaginatedIterator
 * over a live mock with each fixture's page sequence armed) and, with
 * `--dump-cmd`, runs THIS program and structurally compares the deterministic
 * CLASSIFICATION per fixture. So this program runs the identical corpus with the
 * TS SDK's own `paginate()` async generator and emits, to stdout, ONE JSON object
 * mapping
 *
 *   corpus-id -> classification
 *
 * where the classification per kind is:
 *   empty_page_with_next    {continued_past_empty: bool, items_seen: int}
 *   repeating_cursor_guard  {loop_guarded: bool, hung: bool}
 *   exhaustion              {terminated: bool, total_items: int}
 *
 * exactly as the Python oracle produces it (see pagination_corpus.py /
 * diff_port_pagination.build_oracle — this file mirrors that logic in TS).
 *
 * Run from the signalwire-typescript repo root (the mock is discovered via the
 * porting-sdk adjacency walk, or reused via MOCK_SIGNALWIRE_PORT):
 *
 *   SIGNALWIRE_LOG_MODE=off npx tsx scripts/pagination-dump.ts
 *
 * Nothing but the JSON object is written to stdout on success.
 */

// Silence the SDK logger BEFORE the HttpClient module (and its Logger) is loaded
// so no debug line corrupts the JSON-only stdout contract the differ parses.
process.env['SIGNALWIRE_LOG_MODE'] ??= 'off';

import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HttpClient as HttpClientType } from '../src/rest/HttpClient.js';

const { HttpClient } = await import('../src/rest/HttpClient.js');
const { paginate } = await import('../src/rest/pagination.js');

// The list endpoint the corpus arms its page sequences on (matches
// pagination_corpus.LIST_PATH / ENDPOINT_ID). The mock serves each armed page
// body — including links.next — verbatim.
const LIST_PATH = '/api/fabric/addresses';
const ENDPOINT_ID = 'fabric.list_fabric_addresses';
const PROJECT = 'test_proj';

// A stable next-cursor URL builder mirroring pagination_corpus._next so the
// armed page bodies are byte-identical to the oracle's.
function nextUrl(tok: string): string {
  return `http://mock.test${LIST_PATH}?page_token=${tok}`;
}

interface PageBody {
  data: Array<{ id: string }>;
  links: { next?: string };
}

type Kind = 'empty_page_with_next' | 'repeating_cursor_guard' | 'exhaustion';

interface Fixture {
  id: string;
  kind: Kind;
  pages: PageBody[];
}

// Mirror of porting-sdk/scripts/pagination_corpus.py CORPUS.
const CORPUS: Fixture[] = [
  {
    id: 'empty_page_with_next',
    kind: 'empty_page_with_next',
    pages: [
      { data: [], links: { next: nextUrl('EP_page2') } },
      { data: [{ id: 'found-after-empty' }], links: {} },
    ],
  },
  {
    id: 'repeating_cursor_guard',
    kind: 'repeating_cursor_guard',
    pages: [
      { data: [{ id: 'loop-1' }], links: { next: nextUrl('LOOP') } },
      { data: [{ id: 'loop-2' }], links: { next: nextUrl('LOOP') } },
    ],
  },
  {
    id: 'exhaustion',
    kind: 'exhaustion',
    pages: [
      { data: [{ id: 'x-1' }, { id: 'x-2' }], links: { next: nextUrl('EX_page2') } },
      { data: [{ id: 'x-3' }, { id: 'x-4' }], links: { next: nextUrl('EX_page3') } },
      { data: [{ id: 'x-5' }], links: {} },
    ],
  },
];

// The repeating-cursor walk MUST terminate inside this window; a walk that
// outlives it is HUNG (a hard fail).
const BOUNDED_WINDOW_MS = 5000;

// ---------------------------------------------------------------------------
// mock_signalwire discovery + lifecycle (adjacency walk + spawn, or reuse
// MOCK_SIGNALWIRE_PORT). Mirrors scripts/envelope-dump.ts / tests/rest/mocktest.ts.
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
    `pagination-dump: 'python -m mock_signalwire' did not become ready on ${url} within 30s ` +
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

/** Arm one consume-once page body on the mock, scoped to the auth header. */
async function armPage(url: string, sessionId: string, page: PageBody): Promise<void> {
  await post(
    `${url}/__mock__/scenarios/${ENDPOINT_ID}?session_id=${encodeURIComponent(sessionId)}`,
    { status: 200, response: page },
  );
}

/** Walk the paginator for a fixture, bounded, returning the ids seen or 'HUNG'. */
async function walkFixture(
  token: string,
  server: MockServer,
  fixture: Fixture,
): Promise<string[] | 'HUNG'> {
  const sessionId = 'Basic ' + Buffer.from(`${PROJECT}:${token}`).toString('base64');
  await post(`${server.url}/__mock__/scenarios/reset`);
  for (const page of fixture.pages) {
    await armPage(server.url, sessionId, page);
  }
  const http: HttpClientType = new HttpClient({ baseUrl: server.url, project: PROJECT, token });

  const ids: string[] = [];
  const walk = (async (): Promise<'DONE'> => {
    for await (const item of paginate<{ id: string }>(http, LIST_PATH, undefined, 'data')) {
      ids.push(item.id);
      // Hard cap so a regression cannot exhaust memory even inside the window.
      if (ids.length > 100) return 'DONE';
    }
    return 'DONE';
  })();
  const timeout = new Promise<'HUNG'>((resolve) =>
    setTimeout(() => resolve('HUNG'), BOUNDED_WINDOW_MS),
  );
  const outcome = await Promise.race([walk, timeout]);
  return outcome === 'HUNG' ? 'HUNG' : ids;
}

function classify(fixture: Fixture, result: string[] | 'HUNG'): Record<string, unknown> {
  if (fixture.kind === 'repeating_cursor_guard') {
    if (result === 'HUNG') return { loop_guarded: false, hung: true };
    const guarded = result.length === 2 && result[0] === 'loop-1' && result[1] === 'loop-2';
    return { loop_guarded: guarded, hung: false };
  }
  const items = result === 'HUNG' ? [] : result;
  if (fixture.kind === 'empty_page_with_next') {
    const continued = items.length === 1 && items[0] === 'found-after-empty';
    return { continued_past_empty: continued, items_seen: items.length };
  }
  // exhaustion
  const expected = ['x-1', 'x-2', 'x-3', 'x-4', 'x-5'];
  const terminated = items.length === expected.length && items.every((v, i) => v === expected[i]);
  return { terminated, total_items: items.length };
}

async function main(): Promise<void> {
  const server = await startMock();
  const out: Record<string, Record<string, unknown>> = {};
  try {
    for (const fixture of CORPUS) {
      const result = await walkFixture(`tok_${fixture.id}`, server, fixture);
      out[fixture.id] = classify(fixture, result);
    }
  } finally {
    stopMock(server);
  }
  process.stdout.write(JSON.stringify(out) + '\n');
}

main().catch((err) => {
  process.stderr.write(`pagination-dump: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
