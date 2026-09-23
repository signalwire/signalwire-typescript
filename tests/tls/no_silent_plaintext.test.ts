/**
 * TLS: no silent plaintext, and the one verification opt-out is genuinely
 * two-key.
 *
 * The failure mode this guards is the one that actually hurts a user: a client
 * configured for TLS that ends up sending in the clear, or a verification
 * disable that a single stray config key can trip. The rest of tests/tls/
 * proves the positive path (a real CA-verified session) and the wrong-CA
 * rejection for REST and RELAY; this file covers the two gaps around it —
 * scheme selection, and the `rejectUnauthorized` opt-out in mcp_gateway (the
 * only site in the SDK that can turn verification off at all).
 *
 * Every assertion here is driven through the real public API. No transport
 * mock, no reading of source.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpClient } from '../../src/rest/HttpClient.js';
import { RelayClient } from '../../src/relay/RelayClient.js';

describe('TLS: scheme selection never silently downgrades', () => {
  const saved = { ...process.env };
  afterAll(() => {
    process.env = saved;
  });

  it('a non-loopback REST host is https://, never http://', () => {
    const c = new HttpClient({ host: 'example.signalwire.com', project: 'p', token: 't' });
    expect(c.baseUrl).toBe('https://example.signalwire.com');
  });

  it('the loopback http:// affordance is EXACT-MATCH and cannot be spoofed by a lookalike host', () => {
    // The dev-mock affordance (byte-identical to the reference's
    // `_is_loopback_host`, rest/_base.py) must key on the whole hostname. A
    // substring match would send `localhost.attacker.example` in the clear.
    for (const host of ['127.0.0.1:8080', 'localhost:8080']) {
      expect(new HttpClient({ host, project: 'p', token: 't' }).baseUrl).toMatch(/^http:\/\//);
    }
    for (const host of ['localhost.evil.example:8080', 'notlocalhost:8080', 'my-localhost:80']) {
      expect(new HttpClient({ host, project: 'p', token: 't' }).baseUrl).toMatch(/^https:\/\//);
    }
  });

  it('RELAY defaults to wss:// and an unrecognised scheme falls back to wss:// (fails SAFE)', () => {
    delete process.env['SIGNALWIRE_RELAY_SCHEME'];
    expect(
      new RelayClient({ project: 'p', token: 't', host: 'example.signalwire.com' }).scheme,
    ).toBe('wss');

    // A junk value must not leave the client in some third state, and must not
    // downgrade — it falls back to the secure default.
    process.env['SIGNALWIRE_RELAY_SCHEME'] = 'nonsense';
    expect(
      new RelayClient({ project: 'p', token: 't', host: 'example.signalwire.com' }).scheme,
    ).toBe('wss');
    delete process.env['SIGNALWIRE_RELAY_SCHEME'];
  });
});

describe('TLS: an https:// URL is never retried in the clear', () => {
  let plain: http.Server;
  let port = 0;

  beforeAll(async () => {
    plain = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"leaked":true}');
    });
    await new Promise<void>((r) => plain.listen(0, '127.0.0.1', r));
    port = (plain.address() as AddressInfo).port;
  });

  afterAll(() => {
    plain.close();
  });

  it('fails the request rather than falling back to plaintext against a cleartext listener', async () => {
    // The listener speaks plain HTTP. Dialing it over https:// must FAIL. If the
    // client ever "helpfully" retried without TLS it would get {"leaked":true}
    // back — a user who asked for encryption silently getting none.
    const c = new HttpClient({
      baseUrl: `https://127.0.0.1:${port}`,
      project: 'p',
      token: 't',
    });
    await expect(c.get('/')).rejects.toThrow();
  });
});

describe('TLS: mcp_gateway verification opt-out requires TWO keys', () => {
  it('verify_ssl=false ALONE leaves verification on; only the second key disables it', async () => {
    const { McpGatewaySkill } = await import('../../src/skills/builtin/mcp_gateway.js');

    // `_undiciAgent` is created ONLY when verification is genuinely disabled —
    // its presence is the observable proof of the decision. A single stray
    // `verify_ssl: false` (a copied config, a flipped default) must not be
    // enough to produce it.
    const read = (s: unknown): boolean =>
      (s as { _undiciAgent?: unknown })._undiciAgent !== undefined;

    const base = { gateway_url: 'https://gateway.example.com', auth_token: 'tok' };
    for (const cfg of [{}, { verify_ssl: false }, { allow_insecure_tls: true }]) {
      const s = new McpGatewaySkill({ ...base, ...cfg });
      await s.setup().catch(() => undefined);
      expect(read(s)).toBe(false);
    }

    const optedIn = new McpGatewaySkill({
      ...base,
      verify_ssl: false,
      allow_insecure_tls: true,
    });
    await optedIn.setup().catch(() => undefined);
    expect(read(optedIn)).toBe(true);
  });
});
