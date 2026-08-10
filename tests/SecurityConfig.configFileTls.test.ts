import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { SWMLService, SecurityConfig } from '../src/SWMLService.js';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';

// The reference resolves TLS as defaults -> env -> CONFIG FILE, with the config
// file at HIGHEST priority (signalwire/core/security_config.py `__init__` ->
// `_load_config_file`, keys `ssl_enabled` / `ssl_cert_path` / `ssl_key_path`).
//
// These are BEHAVIOURAL tests: a construction-only assertion cannot catch the
// failure mode that motivated them, which was the service coming up on plain
// HTTP with no error while the operator believed it was serving HTTPS. So each
// test starts a real server and speaks a real protocol to it.

// Repo-local scratch (gitignored .sw-tmp/), derived from THIS FILE's own location
// so it is CWD-independent, and made unique per run by mkdtemp. Both halves are
// load-bearing for parallel safety, and both were absent:
//   - process.cwd() is a property of the RUNNER, not of this file, so every copy
//     of this test resolved to the SAME directory. With sibling agent worktrees
//     under .claude/worktrees/, four copies of this file got collected into one
//     run and raced on one path -- until one copy's afterAll rm -rf deleted the
//     fixtures out from under the other three mid-openssl.
//   - a fixed basename would still collide between two concurrent runs of this
//     same file (e.g. two checkouts, or a watch-mode rerun overlapping itself).
// mkdtemp makes collision impossible by construction rather than by scheduling
// luck: isolation comes from SCOPING the path we own, never from serialising.
const SCRATCH_ROOT = join(fileURLToPath(new URL('..', import.meta.url)), '.sw-tmp');
mkdirSync(SCRATCH_ROOT, { recursive: true });
const TEST_DIR = mkdtempSync(join(SCRATCH_ROOT, 'swts_config_file_tls_'));
const CERT = join(TEST_DIR, 'cert.pem');
const KEY = join(TEST_DIR, 'key.pem');
const CONFIG = join(TEST_DIR, 'tls_config.json');

const SSL_ENV = [
  'SWML_SSL_ENABLED',
  'SWML_SSL_CERT_PATH',
  'SWML_SSL_KEY_PATH',
  'SWML_DOMAIN',
  'SWML_SSL_DOMAIN',
] as const;

function clearSslEnv(): void {
  for (const k of SSL_ENV) delete process.env[k];
}

/** Resolve the port a started service is actually listening on. */
function servicePort(svc: SWMLService): number {
  // `_server` is protected; the address is the only way to learn the
  // OS-assigned port after listening on 0.
  const server = (svc as unknown as { _server: { address(): AddressInfo | string | null } })
    ._server;
  const addr = server.address();
  if (addr === null || typeof addr === 'string') throw new Error('server not listening on a port');
  return addr.port;
}

/** Wait until the service's listener has an assigned port. */
async function waitForListening(svc: SWMLService): Promise<number> {
  for (let i = 0; i < 100; i++) {
    try {
      return servicePort(svc);
    } catch {
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  throw new Error('server never began listening');
}

/**
 * Perform a real TLS handshake + GET. Resolving at all proves the listener
 * spoke TLS; a plain-HTTP listener fails the handshake instead.
 */
function getOverHttps(port: number, path: string): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'GET',
        // The fixture cert is self-signed; we are asserting that TLS is spoken
        // at all, not that a public CA vouches for it.
        rejectUnauthorized: false,
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** Perform a plaintext GET. Used to prove HTTP mode when SSL is off. */
function getOverHttp(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode ?? 0));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('TLS from the config file (defaults -> env -> config file)', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    // A REAL key pair — the server must complete an actual TLS handshake, so a
    // placeholder PEM string will not do.
    execFileSync('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      KEY,
      '-out',
      CERT,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
    ]);
    writeFileSync(
      CONFIG,
      JSON.stringify({
        security: {
          ssl_enabled: true,
          ssl_cert_path: CERT,
          ssl_key_path: KEY,
          domain: 'localhost',
        },
      }),
    );
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    clearSslEnv();
  });

  afterEach(() => {
    clearSslEnv();
  });

  it('serves real HTTPS when the cert/key come ONLY from the config file', async () => {
    clearSslEnv(); // nothing whatsoever in the environment

    const svc = new SWMLService({ name: 'tls-from-config', configFile: CONFIG, port: 0 });
    try {
      await svc.serve('127.0.0.1', 0);
      const port = await waitForListening(svc);

      // The load-bearing assertion: a TLS client succeeds against this port.
      const { status } = await getOverHttps(port, '/');
      expect(status).toBeGreaterThan(0);

      // And a plaintext client must NOT get a valid HTTP response from it.
      await expect(getOverHttp(port, '/')).rejects.toThrow();
    } finally {
      svc.stop();
    }
  }, 20000);

  it('exposes the config-file values on the service and its security config', () => {
    clearSslEnv();
    const svc = new SWMLService({ name: 'tls-attrs', configFile: CONFIG, port: 0 });

    expect(svc.sslEnabled).toBe(true);
    expect(svc.sslCertPath).toBe(CERT);
    expect(svc.sslKeyPath).toBe(KEY);
    expect(svc.domain).toBe('localhost');
    expect(svc.security.getUrlScheme()).toBe('https');
    expect(svc.security.validateSslConfig()).toEqual([true, null]);
    expect(svc.security.getSslContextKwargs()).toEqual({
      ssl_certfile: CERT,
      ssl_keyfile: KEY,
    });
  });

  it('lets the config file OVERRIDE the environment (config file is highest priority)', () => {
    // Env points SSL somewhere useless; the config file must win.
    process.env['SWML_SSL_ENABLED'] = 'false';
    process.env['SWML_SSL_CERT_PATH'] = join(TEST_DIR, 'does-not-exist.pem');
    process.env['SWML_SSL_KEY_PATH'] = join(TEST_DIR, 'does-not-exist.key');

    const cfg = new SecurityConfig({ configFile: CONFIG });
    expect(cfg.sslEnabled).toBe(true);
    expect(cfg.sslCertPath).toBe(CERT);
    expect(cfg.sslKeyPath).toBe(KEY);
    expect(cfg.validateSslConfig()).toEqual([true, null]);
  });

  it('serves plain HTTP when no config file and no env enable SSL', async () => {
    clearSslEnv();
    const svc = new SWMLService({ name: 'no-tls', port: 0 });
    try {
      await svc.serve('127.0.0.1', 0);
      const port = await waitForListening(svc);
      const status = await getOverHttp(port, '/');
      expect(status).toBeGreaterThan(0);
    } finally {
      svc.stop();
    }
  }, 20000);

  it('applies the reference key names, not the TypeScript API camelCase names', () => {
    clearSslEnv();
    // A config file using the camelCase API shape must NOT enable SSL — the
    // config-file contract is the reference's snake_case wire names.
    const camel = join(TEST_DIR, 'camel.json');
    writeFileSync(
      camel,
      JSON.stringify({ security: { ssl: { enabled: true, certPath: CERT, keyPath: KEY } } }),
    );
    const cfg = new SecurityConfig({ configFile: camel });
    expect(cfg.sslEnabled).toBe(false);
  });

  it('reads the non-SSL security settings from the config file too', () => {
    clearSslEnv();
    const extra = join(TEST_DIR, 'extra.json');
    writeFileSync(
      extra,
      JSON.stringify({
        security: {
          allowed_hosts: ['api.example.com'],
          cors_origins: 'https://a.example.com,https://b.example.com',
          use_hsts: false,
          hsts_max_age: 120,
          auth: { basic: { user: 'cfguser', password: 'cfgpass' } },
        },
      }),
    );
    const cfg = new SecurityConfig({ configFile: extra });
    expect(cfg.allowedHosts).toEqual(['api.example.com']);
    expect(cfg.corsOrigins).toEqual(['https://a.example.com', 'https://b.example.com']);
    expect(cfg.useHsts).toBe(false);
    expect(cfg.hstsMaxAge).toBe(120);
    expect(cfg.getBasicAuth()).toEqual(['cfguser', 'cfgpass']);
    expect(cfg.shouldAllowHost('api.example.com')).toBe(true);
    expect(cfg.shouldAllowHost('evil.example.com')).toBe(false);
  });

  it('interpolates ${VAR} in config-file security values', () => {
    clearSslEnv();
    process.env['TLS_FIXTURE_CERT'] = CERT;
    process.env['TLS_FIXTURE_KEY'] = KEY;
    const interp = join(TEST_DIR, 'interp.json');
    writeFileSync(
      interp,
      JSON.stringify({
        security: {
          ssl_enabled: '${TLS_ENABLE_FIXTURE|true}',
          ssl_cert_path: '${TLS_FIXTURE_CERT}',
          ssl_key_path: '${TLS_FIXTURE_KEY}',
        },
      }),
    );
    try {
      const cfg = new SecurityConfig({ configFile: interp });
      expect(cfg.sslEnabled).toBe(true);
      expect(cfg.sslCertPath).toBe(CERT);
      expect(cfg.validateSslConfig()).toEqual([true, null]);
    } finally {
      delete process.env['TLS_FIXTURE_CERT'];
      delete process.env['TLS_FIXTURE_KEY'];
    }
  });
});
