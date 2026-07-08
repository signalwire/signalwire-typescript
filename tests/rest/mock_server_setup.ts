/**
 * mock_server_setup.ts — vitest globalSetup that runs ONE shared mock_signalwire
 * server for the whole run and tears it down at the end.
 *
 * WHY: without this, every parallel worker's mocktest.ts spawns its OWN detached
 * mock server (resolvePort() picks a fresh free port per worker when
 * MOCK_SIGNALWIRE_PORT is unset). Each server's startup parses ~12 OpenAPI specs
 * (~0.2s CPU with libyaml, more without), so under fileParallelism that's N concurrent
 * spec-loads — an N-core spike — and each server is `detached` + `unref()`, so it
 * ORPHANS on exit and accumulates across runs. That storm (not a busy loop) is what can
 * saturate a dev machine. Running one shared server here (in vitest's MAIN process,
 * before workers fork) and exporting MOCK_SIGNALWIRE_PORT makes every worker REUSE it
 * (mocktest.ts probes the port and reuses a healthy server), so the spec-load happens
 * ONCE. The returned teardown kills the server (its whole process group) when the run
 * ends.
 *
 * CI already pre-spawns a shared server and sets MOCK_SIGNALWIRE_PORT itself
 * (run-ci.sh REST-COVERAGE gate); in that case we detect the env var and do nothing.
 * If porting-sdk isn't resolvable / python is missing, we do nothing and the REST
 * tests surface their own clear startup error — no behavior change from before.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

/** porting-sdk/test_harness/mock_signalwire dir, via env or adjacency walk. */
function mockPkgDir(): string | null {
  const envRoot = process.env['PORTING_SDK'] ?? process.env['PSDK'];
  if (envRoot) {
    const p = join(envRoot, 'test_harness', 'mock_signalwire');
    if (existsSync(join(p, 'mock_signalwire', '__main__.py'))) return p;
  }
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const p = join(dirname(dir), 'porting-sdk', 'test_harness', 'mock_signalwire');
    if (existsSync(join(p, 'mock_signalwire', '__main__.py'))) return p;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function probeHealth(port: number): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1000);
    const resp = await fetch(`http://127.0.0.1:${port}/__mock__/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return resp.ok;
  } catch {
    return false;
  }
}

let child: ChildProcess | null = null;

export default async function setup(): Promise<() => void> {
  // CI (run-ci.sh) already pre-spawned a shared server — reuse it, own nothing.
  if (process.env['MOCK_SIGNALWIRE_PORT']) return () => {};

  const pkgDir = mockPkgDir();
  if (pkgDir === null) return () => {}; // not resolvable; REST tests surface their own error

  const port = await pickFreePort();
  const sep = process.platform === 'win32' ? ';' : ':';
  const env = {
    ...process.env,
    PYTHONPATH: process.env['PYTHONPATH'] ? `${pkgDir}${sep}${process.env['PYTHONPATH']}` : pkgDir,
  };

  child = spawn(
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
    { detached: true, stdio: 'ignore', env },
  );
  child.unref();

  // Wait for readiness (bounded); if it never comes up, leave MOCK_SIGNALWIRE_PORT
  // UNSET so each worker falls back to spawning its own (old behavior) rather than
  // every test failing against a dead shared port.
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (await probeHealth(port)) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  const killGroup = (): void => {
    const pid = child?.pid;
    if (pid === undefined) return;
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        child?.kill('SIGKILL');
      } catch {
        /* already gone */
      }
    }
    child = null;
  };

  if (!ready) {
    killGroup();
    return () => {};
  }

  process.env['MOCK_SIGNALWIRE_PORT'] = String(port);
  // Safety net: if the main process is killed hard, still try to kill the group.
  process.once('exit', killGroup);
  return killGroup;
}
