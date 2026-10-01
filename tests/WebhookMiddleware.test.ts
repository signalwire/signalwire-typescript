/**
 * Tests for ``src/WebhookMiddleware.ts``.
 *
 * The middleware MUST capture the raw body before any downstream JSON/form
 * parser consumes the stream, validate the signature, and either short-circuit
 * with 403 or call ``next()`` and stash the raw body on the context.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';

import { webhookValidationMiddleware, validate } from '../src/WebhookMiddleware.js';

const KEY = 'PSKtest1234567890abcdef';
const RAW_BODY = '{"event":"call.state","params":{"call_id":"abc-123"}}';

function schemeASig(key: string, url: string, body: string): string {
  return createHmac('sha1', key)
    .update(url + body, 'utf8')
    .digest('hex');
}

describe('webhookValidationMiddleware', () => {
  // Most tests use http://localhost/webhook (no port — the platform would
  // sign without :80 for http; the validator accepts the variant).
  const URL_PATH = 'http://localhost/webhook';

  beforeEach(() => {
    delete process.env['SWML_PROXY_URL_BASE'];
  });

  afterEach(() => {
    delete process.env['SWML_PROXY_URL_BASE'];
  });

  it('throws at construction time when signingKey is missing', () => {
    expect(() => webhookValidationMiddleware({ signingKey: '' })).toThrow();
  });

  it('valid signature passes through to handler with status 200', async () => {
    const app = new Hono();
    let handlerCalled = false;
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY }));
    app.post('/webhook', (c) => {
      handlerCalled = true;
      return c.json({ ok: true });
    });

    const sig = schemeASig(KEY, URL_PATH, RAW_BODY);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'X-SignalWire-Signature': sig,
        'Content-Type': 'application/json',
      },
      body: RAW_BODY,
    });

    expect(res.status).toBe(200);
    expect(handlerCalled).toBe(true);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('a valid SHA-256 signature alone passes through the Hono middleware', async () => {
    const app = new Hono();
    let handlerCalled = false;
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY }));
    app.post('/webhook', (c) => {
      handlerCalled = true;
      return c.json({ ok: true });
    });

    const sig = createHmac('sha256', KEY)
      .update(URL_PATH + RAW_BODY, 'utf8')
      .digest('hex');
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'X-SignalWire-Sha256-Signature': sig, 'Content-Type': 'application/json' },
      body: RAW_BODY,
    });

    expect(res.status).toBe(200);
    expect(handlerCalled).toBe(true);
  });

  it('invalid signature returns 403 and does not call handler', async () => {
    const app = new Hono();
    let handlerCalled = false;
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY }));
    app.post('/webhook', (c) => {
      handlerCalled = true;
      return c.json({ ok: true });
    });

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'X-SignalWire-Signature': 'definitely-not-a-real-signature',
        'Content-Type': 'application/json',
      },
      body: RAW_BODY,
    });

    expect(res.status).toBe(403);
    expect(handlerCalled).toBe(false);
  });

  it('missing signature header returns 403', async () => {
    const app = new Hono();
    let handlerCalled = false;
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY }));
    app.post('/webhook', (c) => {
      handlerCalled = true;
      return c.json({ ok: true });
    });

    const res = await app.request('/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: RAW_BODY,
    });

    expect(res.status).toBe(403);
    expect(handlerCalled).toBe(false);
  });

  it('honors X-Twilio-Signature alias header', async () => {
    const app = new Hono();
    let handlerCalled = false;
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY }));
    app.post('/webhook', (c) => {
      handlerCalled = true;
      return c.json({ ok: true });
    });

    const sig = schemeASig(KEY, URL_PATH, RAW_BODY);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        // Note: ONLY X-Twilio-Signature, no X-SignalWire-Signature.
        'X-Twilio-Signature': sig,
        'Content-Type': 'application/json',
      },
      body: RAW_BODY,
    });

    expect(res.status).toBe(200);
    expect(handlerCalled).toBe(true);
  });

  it('forwards rawBody on the Hono context for the downstream handler', async () => {
    const app = new Hono();
    let observedRawBody: string | undefined;
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY }));
    app.post('/webhook', (c) => {
      // `rawBody` is set by the validation middleware via c.set but isn't in
      // this untyped Hono app's Variables map, so c.get rejects the key; read
      // it through an untyped getter (the middleware guarantees it at runtime).
      observedRawBody = (c.get as (key: string) => unknown)('rawBody') as string | undefined;
      return c.json({ ok: true });
    });

    const sig = schemeASig(KEY, URL_PATH, RAW_BODY);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'X-SignalWire-Signature': sig,
        'Content-Type': 'application/json',
      },
      body: RAW_BODY,
    });

    expect(res.status).toBe(200);
    expect(observedRawBody).toBe(RAW_BODY);
  });

  it('downstream handler can still re-parse the body via c.req.json()', async () => {
    // Hono caches c.req.text() and c.req.json() returns from the same cached
    // bytes — verify that the middleware's text() call doesn't break re-parse.
    const app = new Hono();
    let parsed: unknown;
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY }));
    app.post('/webhook', async (c) => {
      parsed = await c.req.json();
      return c.json({ ok: true });
    });

    const sig = schemeASig(KEY, URL_PATH, RAW_BODY);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'X-SignalWire-Signature': sig,
        'Content-Type': 'application/json',
      },
      body: RAW_BODY,
    });

    expect(res.status).toBe(200);
    expect(parsed).toEqual({ event: 'call.state', params: { call_id: 'abc-123' } });
  });

  it('honors SWML_PROXY_URL_BASE when reconstructing the URL', async () => {
    // The platform signed for https://public.example.com/webhook but the
    // request hits us locally as http://localhost/webhook. Without the env
    // var, Scheme A would be computed against the wrong URL and reject.
    process.env['SWML_PROXY_URL_BASE'] = 'https://public.example.com';

    const app = new Hono();
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY }));
    app.post('/webhook', (c) => c.json({ ok: true }));

    const publicUrl = 'https://public.example.com/webhook';
    const sig = schemeASig(KEY, publicUrl, RAW_BODY);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'X-SignalWire-Signature': sig,
        'Content-Type': 'application/json',
      },
      body: RAW_BODY,
    });

    expect(res.status).toBe(200);
  });

  it('honors X-Forwarded-* headers when trustProxy is true', async () => {
    const app = new Hono();
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY, trustProxy: true }));
    app.post('/webhook', (c) => c.json({ ok: true }));

    const publicUrl = 'https://public.example.com/webhook';
    const sig = schemeASig(KEY, publicUrl, RAW_BODY);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'X-SignalWire-Signature': sig,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'public.example.com',
        'Content-Type': 'application/json',
      },
      body: RAW_BODY,
    });

    expect(res.status).toBe(200);
  });

  it('ignores X-Forwarded-* headers when trustProxy is false (default)', async () => {
    const app = new Hono();
    // trustProxy defaults to false.
    app.use('/webhook', webhookValidationMiddleware({ signingKey: KEY }));
    app.post('/webhook', (c) => c.json({ ok: true }));

    // Sign for the spoofed public URL; without trustProxy the middleware
    // should fall back to the raw request URL and reject.
    const publicUrl = 'https://public.example.com/webhook';
    const sig = schemeASig(KEY, publicUrl, RAW_BODY);
    const res = await app.request('/webhook', {
      method: 'POST',
      headers: {
        'X-SignalWire-Signature': sig,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'public.example.com',
        'Content-Type': 'application/json',
      },
      body: RAW_BODY,
    });

    expect(res.status).toBe(403);
  });
});

/**
 * The framework-free decomposed decision core. This is the cross-port contract
 * (`signalwire.core.security.webhook_middleware.validate`): decomposed request
 * primitives in, `null` (pass) or a `[status, headers, body]` rejection triple
 * out — no Hono/framework objects involved.
 */
describe('validate (decomposed framework-free core)', () => {
  const URL = 'http://localhost/webhook';

  const sha256Sig = (key: string, url: string, body: string) =>
    createHmac('sha256', key)
      .update(url + body, 'utf8')
      .digest('hex');

  it('passes a valid SHA-256 signature with no SHA-1 header', () => {
    const headers = { 'X-SignalWire-Sha256-Signature': sha256Sig(KEY, URL, RAW_BODY) };
    expect(validate('POST', URL, headers, RAW_BODY, KEY)).toBeNull();
  });

  it('falls back to the SHA-1 header when the SHA-256 one does not match', () => {
    const headers = {
      'X-SignalWire-Sha256-Signature': 'f'.repeat(64),
      'X-SignalWire-Signature': schemeASig(KEY, URL, RAW_BODY),
    };
    expect(validate('POST', URL, headers, RAW_BODY, KEY)).toBeNull();
  });

  it('rejects when both the SHA-256 and SHA-1 signatures are wrong', () => {
    const headers = {
      'X-SignalWire-Sha256-Signature': 'f'.repeat(64),
      'X-SignalWire-Signature': 'bogus',
    };
    expect(validate('POST', URL, headers, RAW_BODY, KEY)?.[0]).toBe(403);
  });

  it('rejects a SHA-256 signature over a tampered body', () => {
    const headers = { 'X-SignalWire-Sha256-Signature': sha256Sig(KEY, URL, RAW_BODY) };
    expect(validate('POST', URL, headers, RAW_BODY + ' ', KEY)?.[0]).toBe(403);
  });

  it('returns null (pass) for a valid Scheme-A signature', () => {
    const sig = schemeASig(KEY, URL, RAW_BODY);
    const result = validate('POST', URL, { 'X-SignalWire-Signature': sig }, RAW_BODY, KEY);
    expect(result).toBeNull();
  });

  it('returns a [403, {}, body] rejection triple for a bad signature', () => {
    const result = validate(
      'POST',
      URL,
      { 'X-SignalWire-Signature': 'definitely-not-a-real-signature' },
      RAW_BODY,
      KEY,
    );
    expect(result).not.toBeNull();
    const [status, headers, body] = result!;
    expect(status).toBe(403);
    expect(headers).toEqual({});
    // Body carries no detail about which scheme/branch failed.
    expect(body).toBe('Forbidden');
  });

  it('returns a 403 triple when the signature header is missing (never throws)', () => {
    const result = validate('POST', URL, { 'Content-Type': 'application/json' }, RAW_BODY, KEY);
    expect(result).not.toBeNull();
    expect(result![0]).toBe(403);
  });

  it('honors the X-Twilio-Signature alias header', () => {
    const sig = schemeASig(KEY, URL, RAW_BODY);
    // Only the Twilio alias present, no X-SignalWire-Signature.
    const result = validate('POST', URL, { 'X-Twilio-Signature': sig }, RAW_BODY, KEY);
    expect(result).toBeNull();
  });

  it('looks up the signature header case-insensitively', () => {
    const sig = schemeASig(KEY, URL, RAW_BODY);
    const result = validate('POST', URL, { 'x-signalwire-signature': sig }, RAW_BODY, KEY);
    expect(result).toBeNull();
  });

  it('throws when the signing key is missing (programming error, not a rejection)', () => {
    const sig = schemeASig(KEY, URL, RAW_BODY);
    expect(() => validate('POST', URL, { 'X-SignalWire-Signature': sig }, RAW_BODY, '')).toThrow();
  });
});
