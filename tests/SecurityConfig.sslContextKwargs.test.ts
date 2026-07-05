import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { SecurityConfig } from '../src/SWMLService.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Reconciles the port's TLS-serving config to the Python oracle's
// `SecurityConfig.get_ssl_context_kwargs()`: a plain dict of PRIMITIVE cert/key
// path strings (`ssl_certfile`/`ssl_keyfile`), NOT an ssl.SSLContext object.

const TEST_DIR = join(process.cwd(), '__ssl_kwargs_test_tmp__');
const CERT = join(TEST_DIR, 'cert.pem');
const KEY = join(TEST_DIR, 'key.pem');

const SSL_ENV = ['SWML_SSL_ENABLED', 'SWML_SSL_CERT_PATH', 'SWML_SSL_KEY_PATH'] as const;

function clearSslEnv(): void {
  for (const k of SSL_ENV) delete process.env[k];
}

describe('SecurityConfig.getSslContextKwargs', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(CERT, '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----');
    writeFileSync(KEY, '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----');
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    clearSslEnv();
  });

  afterEach(() => {
    clearSslEnv();
  });

  it('returns primitive cert/key PATHS (not file contents, not an SSLContext) when configured', () => {
    process.env['SWML_SSL_ENABLED'] = 'true';
    process.env['SWML_SSL_CERT_PATH'] = CERT;
    process.env['SWML_SSL_KEY_PATH'] = KEY;

    const kwargs = new SecurityConfig().getSslContextKwargs();

    // Matches the oracle's primitive-dict shape verbatim.
    expect(kwargs).toEqual({ ssl_certfile: CERT, ssl_keyfile: KEY });
    // Primitive path strings — the values are the paths themselves, not the
    // PEM file contents and not an object.
    expect(typeof kwargs['ssl_certfile']).toBe('string');
    expect(typeof kwargs['ssl_keyfile']).toBe('string');
    expect(kwargs['ssl_certfile']).not.toContain('BEGIN CERTIFICATE');
  });

  it('returns an empty dict when SSL is disabled', () => {
    clearSslEnv();
    expect(new SecurityConfig().getSslContextKwargs()).toEqual({});
  });

  it('returns an empty dict when the cert/key files fail validation', () => {
    process.env['SWML_SSL_ENABLED'] = 'true';
    process.env['SWML_SSL_CERT_PATH'] = join(TEST_DIR, 'missing-cert.pem');
    process.env['SWML_SSL_KEY_PATH'] = join(TEST_DIR, 'missing-key.pem');

    expect(new SecurityConfig().getSslContextKwargs()).toEqual({});
  });
});
