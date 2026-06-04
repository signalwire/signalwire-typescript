/**
 * TLS capability quadrant #3 — the SDK's own webhook/SWML server serves a
 * *real* verified HTTPS endpoint (the server side).
 *
 * Starts a `WebService` over HTTPS via its built-in SslConfig path
 * (`start(host, port, sslCert, sslKey)` → https.createServer with the shared
 * porting-sdk self-signed leaf cert, SAN localhost/127.0.0.1), then reaches its
 * `/health` route from an in-test Node TLS client that trusts the test CA over
 * https://, asserting a real response AND that the connection was authorized by
 * a real certificate chain. The whole handshake stays in-process (no shelling
 * to curl).
 *
 * The in-test client trusts the CA explicitly (ca: <ca.crt>) — REAL
 * verification with rejectUnauthorized true. A negative subtest uses an *empty*
 * root store and asserts the handshake is rejected, proving the server's cert
 * is genuinely verified.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import https from 'node:https';
import net from 'node:net';
import { WebService } from '../../src/index.js';
import { resolveTlsCerts } from './support.js';

const certs = resolveTlsCerts();
const ready = certs !== null;

/** Ask the OS for an unused loopback TCP port. */
function freeTcpPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

/** One HTTPS GET via node:https with an explicit CA list. */
function httpsGet(
  url: string,
  ca: Buffer[] | string[],
): Promise<{ status: number; body: string; authorized: boolean; peerCN: string | undefined }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca, rejectUnauthorized: true }, (res) => {
      const sock: any = res.socket;
      const authorized = Boolean(sock.authorized);
      const cert = sock.getPeerCertificate ? sock.getPeerCertificate() : {};
      const peerCN = cert?.subject?.CN;
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 0, body: data, authorized, peerCN }),
      );
    });
    req.on('error', reject);
    req.setTimeout(5_000, () => req.destroy(new Error('timeout')));
  });
}

describe.skipIf(!ready)('TLS: SDK WebService HTTPS server', () => {
  const certPath = join(certs!, 'server.crt');
  const keyPath = join(certs!, 'server.key');
  const caBuf = ready ? readFileSync(join(certs!, 'ca.crt')) : Buffer.alloc(0);

  let svc: WebService | null = null;
  let baseUrl = '';

  beforeAll(async () => {
    const port = await freeTcpPort();
    baseUrl = `https://127.0.0.1:${port}`;
    // Configure SSL at construction so the SDK's own config reports it is
    // serving TLS (the SslConfig path: enabled + cert/key on disk).
    svc = new WebService({ port, ssl: { enabled: true, certPath, keyPath } });
    // The SDK reports it is serving TLS.
    expect(svc.sslConfig.isConfigured()).toBe(true);
    // start() wires https.createServer from that SslConfig.
    await svc.start('127.0.0.1', port);

    // Poll until the TLS listener accepts (serve() returns before the socket
    // is necessarily bound).
    const deadline = Date.now() + 10_000;
    for (;;) {
      try {
        await httpsGet(`${baseUrl}/health`, [caBuf]);
        break;
      } catch {
        if (Date.now() > deadline) throw new Error('HTTPS /health never became reachable');
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  });

  afterAll(() => {
    svc?.stop();
  });

  it('serves /health over a verified HTTPS session', async () => {
    const res = await httpsGet(`${baseUrl}/health`, [caBuf]);

    // Real TLS: the in-test client authorized the server's certificate chain.
    expect(res.authorized).toBe(true);
    expect(res.peerCN).toBe('localhost');

    // Real response over that session.
    expect(res.status).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.status).toBe('healthy');
    expect(payload.sslEnabled).toBe(true);
  });

  it('rejects a client that does not trust the test CA', async () => {
    let code = 'UNEXPECTED_OK';
    try {
      // Empty trust store: the SDK server's CA-signed cert cannot be verified.
      await httpsGet(`${baseUrl}/health`, []);
    } catch (e: any) {
      code = e?.code ?? e?.message ?? 'ERR';
    }
    expect(code).not.toBe('UNEXPECTED_OK');
    expect(code).toMatch(/UNABLE_TO_VERIFY|SELF_SIGNED|unable to (verify|get)|leaf/i);
  });
});
