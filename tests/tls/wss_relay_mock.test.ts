/**
 * TLS capability quadrant #1 — the RELAY client performs a *real* verified
 * WSS handshake.
 *
 * Spawns the shared mock_relay in --tls mode (the WebSocket endpoint becomes
 * wss:// backed by the porting-sdk self-signed test CA), points the real
 * `RelayClient` at wss://127.0.0.1:<port> with scheme:'wss', and drives the
 * full connect + authenticate handshake. The negotiated protocol string can
 * only come back over a genuinely-completed TLS session.
 *
 * CA trust is wired idiomatically via NODE_EXTRA_CA_CERTS (set by the
 * tests/tls/gen_certs_setup.ts globalSetup, before this worker forked) — `ws`
 * uses Node's global TLS secure context, which honors it. No
 * rejectUnauthorized:false, no transport mock.
 *
 * A negative subtest dials the same wss:// endpoint with an *empty* root store
 * and asserts the handshake is rejected, proving the server presents a cert
 * that must actually be verified — trust is real, not skipped.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RelayClient } from '../../src/relay/RelayClient.js';
import { METHOD_SIGNALWIRE_CONNECT } from '../../src/relay/constants.js';
import { resolveTlsCerts, startTlsMockRelay, type TlsMockRelay } from './support.js';

const certs = resolveTlsCerts();
const mockReady = certs !== null;

describe.skipIf(!mockReady)('TLS: RelayClient over wss://', () => {
  let mock: TlsMockRelay | null = null;
  let client: RelayClient | null = null;

  beforeAll(async () => {
    mock = await startTlsMockRelay();
    if (mock === null) return; // harness unavailable — its tests skip below
    process.env['RELAY_MAX_CONNECTIONS'] = '16';
  }, 60_000);

  afterAll(async () => {
    if (client) {
      try {
        await client.disconnect();
      } catch {
        /* ignore */
      }
      client = null;
    }
    mock?.stop();
  });

  it('connects + authenticates over a verified WSS session', async () => {
    if (mock === null) {
      // mock_relay --tls could not be started in this environment.
      return expect.unreachable('mock_relay --tls unavailable');
    }

    client = new RelayClient({
      project: 'test_proj',
      token: 'test_tok',
      host: mock.relayHost,
      scheme: 'wss', // real TLS — wss://127.0.0.1:<port>
      contexts: ['default'],
    });

    // connect() also runs the signalwire.connect auth round-trip.
    await client.connect();

    // Behavioral proof the TLS session carried a real RELAY handshake: the
    // mock only issues a protocol string on a successful credential exchange.
    expect(client.relayProtocol).toMatch(/^signalwire_/);

    // Wire proof: the inbound signalwire.connect frame crossed the WSS link
    // and was journaled on the plain-HTTP control plane.
    expect(await mock.sawRecvMethod(METHOD_SIGNALWIRE_CONNECT)).toBe(true);
  });

  it('rejects a WSS client that does not trust the test CA', async () => {
    if (mock === null) {
      return expect.unreachable('mock_relay --tls unavailable');
    }
    // Raw ws dial with an EMPTY trust store: the handshake must fail because
    // the server's cert is signed by the test CA (not in this store), proving
    // certificate verification is genuinely in force.
    const wsModule = await import('ws');
    const WS = wsModule.default ?? wsModule.WebSocket;
    const url = `wss://${mock.relayHost}/api/relay/ws`;

    const code: string = await new Promise((resolve) => {
      const ws = new WS(url, { ca: [], rejectUnauthorized: true });
      ws.on('open', () => {
        ws.close();
        resolve('UNEXPECTED_OPEN');
      });
      ws.on('error', (err: Error & { code?: string }) =>
        resolve(err?.code ?? err?.message ?? 'ERR'),
      );
    });

    expect(code).not.toBe('UNEXPECTED_OPEN');
    expect(code).toMatch(/UNABLE_TO_VERIFY|SELF_SIGNED|unable to (verify|get)|leaf/i);
  });

  // TS-5 / CA-VAR: the RELAY WS transport honors SIGNALWIRE_RELAY_CA_FILE as its
  // TLS trust root. Pointing it at a CA that does NOT sign the server cert must
  // make connect() FAIL — proving the fleet var is genuinely wired into the
  // transport (relayCaWsOptions overrides the ambient NODE_EXTRA_CA_CERTS trust).
  it('SIGNALWIRE_RELAY_CA_FILE governs RELAY TLS trust (wrong CA => rejected)', async () => {
    if (mock === null) {
      return expect.unreachable('mock_relay --tls unavailable');
    }
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    // An empty PEM bundle: trusts nothing, written repo-local (next to this test).
    const emptyCa = path.join(
      path.dirname(url.fileURLToPath(import.meta.url)),
      `.empty-relay-ca-${process.pid}.pem`,
    );
    fs.writeFileSync(emptyCa, '');
    const prev = process.env['SIGNALWIRE_RELAY_CA_FILE'];
    process.env['SIGNALWIRE_RELAY_CA_FILE'] = emptyCa;
    let insecureClient: RelayClient | null = null;
    try {
      insecureClient = new RelayClient({
        project: 'test_proj',
        token: 'test_tok',
        host: mock.relayHost,
        scheme: 'wss',
        contexts: ['default'],
      });
      let rejected = false;
      try {
        await insecureClient.connect();
      } catch {
        rejected = true;
      }
      expect(rejected).toBe(true);
    } finally {
      try {
        await insecureClient?.disconnect();
      } catch {
        /* not connected */
      }
      if (prev === undefined) delete process.env['SIGNALWIRE_RELAY_CA_FILE'];
      else process.env['SIGNALWIRE_RELAY_CA_FILE'] = prev;
      fs.rmSync(emptyCa, { force: true });
    }
  });
});
