/**
 * gen_certs_setup.ts — vitest globalSetup that wires CA trust for the TLS
 * capability tests.
 *
 * It runs in vitest's *main* process, BEFORE the test workers are forked. That
 * ordering is load-bearing: Node's global TLS secure context (used by both the
 * `ws` client and `fetch`/undici) reads NODE_EXTRA_CA_CERTS exactly once, when
 * the process boots. Setting it from inside a worker (e.g. in a beforeAll) is
 * empirically a no-op. By exporting it here, every forked worker inherits it
 * and boots already trusting the porting-sdk throwaway test CA — the idiomatic,
 * no-SDK-change way to do REAL HTTPS/WSS verification against the harness's
 * CA-signed leaf cert. (Node honors NODE_EXTRA_CA_CERTS; we never set
 * rejectUnauthorized:false and never mock the transport.)
 *
 * gen_certs.sh is idempotent (regenerates only when the leaf is missing / near
 * expiry). When porting-sdk is not adjacent we silently do nothing — the TLS
 * tests then skip via resolveTlsCerts() returning null in the worker.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve porting-sdk root: $PORTING_SDK / $PSDK (run-ci.sh exports these)
 * first, otherwise the realpath walk for an adjacent porting-sdk/. The env var
 * is essential when the repo is reached through a symlink, where the walk can't
 * see the sibling porting-sdk.
 */
function portingSdkTlsDir(): string | null {
  const envRoot = process.env['PORTING_SDK'] ?? process.env['PSDK'];
  if (envRoot && existsSync(join(envRoot, 'test_harness', 'tls', 'gen_certs.sh'))) {
    return join(envRoot, 'test_harness', 'tls');
  }
  const here = fileURLToPath(import.meta.url);
  let dir = dirname(here);
  for (;;) {
    const tlsDir = join(dirname(dir), 'porting-sdk', 'test_harness', 'tls');
    if (existsSync(join(tlsDir, 'gen_certs.sh'))) return tlsDir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export default function setup(): void {
  const tlsDir = portingSdkTlsDir();
  if (tlsDir === null) return; // porting-sdk not resolvable — TLS tests skip
  const res = spawnSync('bash', [join(tlsDir, 'gen_certs.sh')], { stdio: 'ignore' });
  const certs = join(tlsDir, 'certs');
  const ca = join(certs, 'ca.crt');
  if (res.status === 0 && existsSync(ca)) {
    // Trust the test CA in every worker forked after this point.
    process.env['NODE_EXTRA_CA_CERTS'] = ca;
    // Expose the certs dir so the HTTPS-server test can read server.crt/key.
    process.env['SIGNALWIRE_TLS_CERTS_DIR'] = certs;
  }
}
