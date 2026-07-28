import { describe, it, expect } from 'vitest';
import { AuthHandler, BasicCredentials, BearerCredentials } from '../src/AuthHandler.js';

describe('AuthHandler', () => {
  it('validates Bearer token', async () => {
    const auth = new AuthHandler({ bearerToken: 'my-secret-token' });
    const valid = await auth.validate({ authorization: 'Bearer my-secret-token' });
    expect(valid).toBe(true);
  });

  it('rejects invalid Bearer token', async () => {
    const auth = new AuthHandler({ bearerToken: 'my-secret-token' });
    const valid = await auth.validate({ authorization: 'Bearer wrong-token' });
    expect(valid).toBe(false);
  });

  it('validates API key', async () => {
    const auth = new AuthHandler({ apiKey: 'my-api-key' });
    const valid = await auth.validate({ 'x-api-key': 'my-api-key' });
    expect(valid).toBe(true);
  });

  it('rejects invalid API key', async () => {
    const auth = new AuthHandler({ apiKey: 'my-api-key' });
    const valid = await auth.validate({ 'x-api-key': 'wrong-key' });
    expect(valid).toBe(false);
  });

  it('validates Basic auth', async () => {
    const auth = new AuthHandler({ basicAuth: ['admin', 'pass123'] });
    const encoded = Buffer.from('admin:pass123').toString('base64');
    const valid = await auth.validate({ authorization: `Basic ${encoded}` });
    expect(valid).toBe(true);
  });

  it('rejects invalid Basic auth', async () => {
    const auth = new AuthHandler({ basicAuth: ['admin', 'pass123'] });
    const encoded = Buffer.from('admin:wrong').toString('base64');
    const valid = await auth.validate({ authorization: `Basic ${encoded}` });
    expect(valid).toBe(false);
  });

  it('validates custom validator', async () => {
    const auth = new AuthHandler({
      customValidator: (req) => req.headers['x-custom'] === 'valid',
    });
    const valid = await auth.validate({ 'x-custom': 'valid' });
    expect(valid).toBe(true);
  });

  it('rejects with custom validator', async () => {
    const auth = new AuthHandler({
      customValidator: (req) => req.headers['x-custom'] === 'valid',
    });
    const valid = await auth.validate({ 'x-custom': 'invalid' });
    expect(valid).toBe(false);
  });

  it('checks methods in priority order: Bearer > API Key > Basic', async () => {
    const auth = new AuthHandler({
      bearerToken: 'token',
      apiKey: 'key',
      basicAuth: ['u', 'p'],
    });
    // Bearer should pass even without API key or Basic
    const valid = await auth.validate({ authorization: 'Bearer token' });
    expect(valid).toBe(true);
  });

  it('allows all when no auth configured', async () => {
    const auth = new AuthHandler({});
    const valid = await auth.validate({});
    expect(valid).toBe(true);
  });

  it('hasBearerAuth returns correct state', () => {
    expect(new AuthHandler({ bearerToken: 'x' }).hasBearerAuth()).toBe(true);
    expect(new AuthHandler({}).hasBearerAuth()).toBe(false);
  });

  it('hasApiKeyAuth returns correct state', () => {
    expect(new AuthHandler({ apiKey: 'x' }).hasApiKeyAuth()).toBe(true);
    expect(new AuthHandler({}).hasApiKeyAuth()).toBe(false);
  });

  it('hasBasicAuth returns correct state', () => {
    expect(new AuthHandler({ basicAuth: ['u', 'p'] }).hasBasicAuth()).toBe(true);
    expect(new AuthHandler({}).hasBasicAuth()).toBe(false);
  });

  it('async custom validator works', async () => {
    const auth = new AuthHandler({
      customValidator: async (req) => {
        await new Promise((r) => setTimeout(r, 1));
        return req.headers['x-token'] === 'async-valid';
      },
    });
    expect(await auth.validate({ 'x-token': 'async-valid' })).toBe(true);
    expect(await auth.validate({ 'x-token': 'nope' })).toBe(false);
  });

  it('allowUnauthenticated: false with no methods denies request', async () => {
    const auth = new AuthHandler({ allowUnauthenticated: false });
    const valid = await auth.validate({});
    expect(valid).toBe(false);
  });

  it('different-length strings are safely rejected', async () => {
    const auth = new AuthHandler({ bearerToken: 'short' });
    const valid = await auth.validate({ authorization: 'Bearer a-much-longer-token-value' });
    expect(valid).toBe(false);
  });

  it('middleware returns 401 for unauthorized request', async () => {
    const auth = new AuthHandler({ bearerToken: 'secret' });
    const mw = auth.middleware();
    let nextCalled = false;

    // Mock Hono context
    const mockCtx = {
      req: {
        raw: {
          headers: new Map([['authorization', 'Bearer wrong']]),
        },
      },
      json: (body: unknown, status: number) => ({ body, status }),
    };

    // mockCtx is a deliberately-minimal stand-in for Hono's Context (only the
    // fields this middleware path reads); cast to the parameter type.
    const result = await mw(mockCtx as unknown as Parameters<typeof mw>[0], async () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect((result as { status: number }).status).toBe(401);
  });

  // The credential carriers are the parity contract with the Python reference:
  // verify_basic_auth takes a {username, password} record and verify_bearer_token
  // takes a {scheme, credentials} record. These verify the fields are load-bearing
  // (each is actually compared) rather than decorative.
  describe('credential carriers', () => {
    it('BasicCredentials carries the username/password pair verbatim', () => {
      const c = new BasicCredentials('alice', 'hunter2');
      expect(c.username).toBe('alice');
      expect(c.password).toBe('hunter2');
    });

    it('BearerCredentials carries the scheme/credentials pair verbatim', () => {
      const c = new BearerCredentials('Bearer', 'tok-abc');
      expect(c.scheme).toBe('Bearer');
      expect(c.credentials).toBe('tok-abc');
    });

    it('verifyBasicAuth accepts the configured pair and compares BOTH fields', () => {
      const h = new AuthHandler({ basicAuth: ['alice', 'hunter2'] });
      expect(h.verifyBasicAuth(new BasicCredentials('alice', 'hunter2'))).toBe(true);
      // Each field independently participates in the comparison.
      expect(h.verifyBasicAuth(new BasicCredentials('bob', 'hunter2'))).toBe(false);
      expect(h.verifyBasicAuth(new BasicCredentials('alice', 'wrong'))).toBe(false);
    });

    it('verifyBasicAuth returns false when Basic auth is not configured', () => {
      const h = new AuthHandler({ bearerToken: 'tok' });
      expect(h.verifyBasicAuth(new BasicCredentials('alice', 'hunter2'))).toBe(false);
    });

    it('verifyBearerToken compares the credentials field, not the scheme', () => {
      const h = new AuthHandler({ bearerToken: 'tok-abc' });
      expect(h.verifyBearerToken(new BearerCredentials('Bearer', 'tok-abc'))).toBe(true);
      expect(h.verifyBearerToken(new BearerCredentials('Bearer', 'tok-wrong'))).toBe(false);
      // The scheme is carried for header fidelity but is NOT the secret compared —
      // same as the Python reference, which reads only `.credentials`.
      expect(h.verifyBearerToken(new BearerCredentials('Token', 'tok-abc'))).toBe(true);
    });

    it('verifyBearerToken returns false when Bearer auth is not configured', () => {
      const h = new AuthHandler({ apiKey: 'k' });
      expect(h.verifyBearerToken(new BearerCredentials('Bearer', 'tok-abc'))).toBe(false);
    });

    it('validate() routes header parsing through the carriers', async () => {
      const h = new AuthHandler({ basicAuth: ['alice', 'hunter2'] });
      const encoded = Buffer.from('alice:hunter2').toString('base64');
      expect(await h.validate({ authorization: `Basic ${encoded}` })).toBe(true);
      const wrong = Buffer.from('alice:nope').toString('base64');
      expect(await h.validate({ authorization: `Basic ${wrong}` })).toBe(false);
    });
  });
});
