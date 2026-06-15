/**
 * Hono middleware for SignalWire webhook signature validation.
 *
 * This module ships a small, framework-aware adapter around
 * {@link validateWebhookSignature}. It captures the raw body BEFORE any
 * downstream JSON / form parser consumes the stream — re-serialization
 * changes whitespace and key order, which would break the Scheme A digest.
 *
 * After successful validation the raw body string is stashed on the Hono
 * context as ``c.get('rawBody')`` (and the signing key under
 * ``c.get('webhookSigningKey')`` so a downstream handler can sign outbound
 * follow-ups if it needs to). Failed validation short-circuits with a
 * canonical 403 response — no body detail is included, since the validator
 * MUST NOT leak which scheme failed.
 *
 * Usage:
 *
 * ```ts
 * import { Hono } from 'hono';
 * import { webhookValidationMiddleware } from '@signalwire/sdk';
 *
 * const app = new Hono();
 * app.use('/webhook', webhookValidationMiddleware({ signingKey: 'PSK...' }));
 * app.post('/webhook', async (c) => {
 *   const raw = c.get('rawBody');         // string, pre-parser
 *   return c.json({ ok: true });
 * });
 * ```
 */

import type { Context, MiddlewareHandler } from 'hono';

import { validateWebhookSignature } from './WebhookValidator.js';

/** Canonical lowercase header names (Hono's c.req.header() is case-insensitive). */
export const SIGNALWIRE_SIGNATURE_HEADER = 'x-signalwire-signature';
export const TWILIO_COMPAT_SIGNATURE_HEADER = 'x-twilio-signature';

/**
 * Options for {@link webhookValidationMiddleware}.
 */
export interface WebhookValidationOptions {
  /**
   * The customer's Signing Key. Required; passing an empty string throws at
   * construction time (it's a programming error, not a runtime failure).
   */
  signingKey: string;
  /**
   * When true, honor ``X-Forwarded-Proto`` / ``X-Forwarded-Host`` headers
   * when reconstructing the URL. Default false — proxy headers are spoofable,
   * so opt in only when you control the proxy.
   */
  trustProxy?: boolean;
}

/**
 * Pull the SignalWire signature header (or the ``X-Twilio-Signature`` alias).
 */
function extractSignatureHeader(c: Context): string | null {
  const sig = c.req.header(SIGNALWIRE_SIGNATURE_HEADER);
  if (sig !== undefined) return sig;
  const twilioSig = c.req.header(TWILIO_COMPAT_SIGNATURE_HEADER);
  if (twilioSig !== undefined) return twilioSig;
  return null;
}

/**
 * Rebuild the public URL SignalWire POSTed to.
 *
 * Resolution order (highest priority first):
 *
 *   1. ``SWML_PROXY_URL_BASE`` env var (joined with the request path + query).
 *   2. ``X-Forwarded-Proto`` / ``X-Forwarded-Host`` headers, when
 *      ``trustProxy`` is true.
 *   3. The raw request URL (``c.req.url``).
 */
function reconstructUrl(c: Context, opts: { trustProxy: boolean }): string {
  const rawUrl = c.req.url;

  // Extract path + query from the raw URL without losing original encoding.
  let pathAndQuery: string;
  try {
    const u = new URL(rawUrl);
    pathAndQuery = u.pathname + (u.search || '');
  } catch {
    pathAndQuery = rawUrl;
  }

  const proxyBase = process.env['SWML_PROXY_URL_BASE'];
  if (proxyBase) {
    const trimmed = proxyBase.replace(/\/+$/, '');
    return `${trimmed}${pathAndQuery}`;
  }

  if (opts.trustProxy) {
    const fwdHost = c.req.header('x-forwarded-host');
    if (fwdHost) {
      const fwdProto = c.req.header('x-forwarded-proto') ?? 'https';
      return `${fwdProto}://${fwdHost}${pathAndQuery}`;
    }
  }

  return rawUrl;
}

/**
 * Build a Hono middleware that enforces SignalWire webhook signature
 * validation.
 *
 * The middleware:
 *
 *   1. Captures the raw body (``await c.req.text()``) BEFORE any other
 *      consumer reads the stream. The string is stashed at ``c.set('rawBody')``
 *      so the downstream handler can re-parse without re-reading the stream.
 *   2. Pulls the ``X-SignalWire-Signature`` header (or the ``X-Twilio-Signature``
 *      alias).
 *   3. Reconstructs the public URL (``SWML_PROXY_URL_BASE`` env > forwarded
 *      headers when ``trustProxy`` > raw request URL).
 *   4. Calls {@link validateWebhookSignature}.
 *   5. On any failure: responds 403 with no body detail (would leak which
 *      branch failed). Does NOT call ``next()``.
 *   6. On success: ``next()``.
 *
 * @throws Error at construction time if ``signingKey`` is empty.
 */
export function webhookValidationMiddleware(opts: WebhookValidationOptions): MiddlewareHandler {
  if (!opts.signingKey || typeof opts.signingKey !== 'string') {
    throw new Error('signingKey is required');
  }
  const signingKey = opts.signingKey;
  const trustProxy = opts.trustProxy ?? false;

  return async (c, next) => {
    // Capture raw body BEFORE any downstream consumer reads the stream.
    // c.req.text() caches internally so subsequent c.req.json() / .text()
    // calls still work.
    let rawBody: string;
    try {
      rawBody = await c.req.text();
    } catch {
      return c.text('Forbidden', 403);
    }

    const signature = extractSignatureHeader(c);
    if (!signature) {
      return c.text('Forbidden', 403);
    }

    const url = reconstructUrl(c, { trustProxy });

    let ok: boolean;
    try {
      ok = validateWebhookSignature(signingKey, signature, url, rawBody);
    } catch {
      // Programming error or non-string body — treat as invalid for the
      // request without leaking which branch tripped.
      return c.text('Forbidden', 403);
    }

    if (!ok) {
      return c.text('Forbidden', 403);
    }

    // Valid — stash raw body for downstream handlers and continue.
    c.set('rawBody', rawBody);
    await next();
  };
}
