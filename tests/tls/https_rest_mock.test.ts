/**
 * TLS capability quadrant #2 — the REST client performs a *real* verified
 * HTTPS request.
 *
 * Spawns the shared mock_signalwire in --tls mode (HTTPS, backed by the
 * porting-sdk self-signed test CA), points the real `RestClient` at
 * https://127.0.0.1:<port>, and performs a GET against a spec-backed endpoint,
 * asserting a real JSON response. A JSON body with a `data` array can only
 * come back over a completed, CA-verified TLS session.
 *
 * CA trust is wired idiomatically via NODE_EXTRA_CA_CERTS (set by the
 * tests/tls/gen_certs_setup.ts globalSetup, before this worker forked) —
 * `fetch`/undici uses Node's global TLS secure context, which honors it. No
 * rejectUnauthorized:false, no transport mock.
 *
 * A negative subtest issues the same GET with an *empty* root store (via a
 * custom undici Agent) and asserts the handshake is rejected, proving the cert
 * is genuinely verified.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RestClient } from '../../src/rest/index.js';
import { resolveTlsCerts, startTlsMockSignalwire, type TlsMockSignalwire } from './support.js';

const certs = resolveTlsCerts();
const ready = certs !== null;

describe.skipIf(!ready)('TLS: RestClient over https://', () => {
  let mock: TlsMockSignalwire | null = null;

  // mock_signalwire cold-loads 13 OpenAPI specs (~15s) on first --tls spawn.
  beforeAll(async () => {
    mock = await startTlsMockSignalwire();
  }, 60_000);

  afterAll(() => {
    mock?.stop();
  });

  it('GETs a spec-backed endpoint over a verified HTTPS session', async () => {
    if (mock === null) {
      return expect.unreachable('mock_signalwire --tls unavailable');
    }

    // host preserves the https:// prefix (RestClient skips its default
    // https:// normalization when host already starts with "http").
    const client = new RestClient({
      project: 'test_proj',
      token: 'test_tok',
      host: mock.baseUrl, // https://127.0.0.1:<port>
    });

    const body = await client.fabric.addresses.list();

    // Real JSON response over HTTPS.
    expect('data' in body).toBe(true);
    expect(Array.isArray((body as any).data)).toBe(true);

    // Wire proof: the GET landed on the mock's HTTPS control plane.
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toContain('/addresses');
  });

  it('rejects an HTTPS client that does not trust the test CA', async () => {
    if (mock === null) {
      return expect.unreachable('mock_signalwire --tls unavailable');
    }
    // undici Agent with an EMPTY trust store: the same GET must fail because
    // the server cert is signed by the test CA, proving real verification.
    const { Agent } = await import('undici');
    const untrusted = new Agent({ connect: { ca: [], rejectUnauthorized: true } });

    let code = 'UNEXPECTED_OK';
    try {
      await fetch(`${mock.baseUrl}/__mock__/health`, { dispatcher: untrusted } as any);
    } catch (e: any) {
      code = e?.cause?.code ?? e?.code ?? e?.message ?? 'ERR';
    } finally {
      await untrusted.close();
    }

    expect(code).not.toBe('UNEXPECTED_OK');
    expect(code).toMatch(/UNABLE_TO_VERIFY|SELF_SIGNED|unable to (verify|get)|leaf|certificate/i);
  });
});
