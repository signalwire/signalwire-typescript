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

import { _SIGNATURE_TARGETS_ENV_KEY, type _SignatureTarget } from './ServerlessAdapter.js';
import { validateWebhookSignature, validateWebhookSignatureSha256 } from './WebhookValidator.js';

/** Canonical lowercase header names (Hono's c.req.header() is case-insensitive). */
export const SIGNALWIRE_SIGNATURE_HEADER = 'x-signalwire-signature';
/** The HMAC-SHA256 signature header, preferred over the SHA-1 one when present. */
export const SIGNALWIRE_SHA256_SIGNATURE_HEADER = 'x-signalwire-sha256-signature';
export const TWILIO_COMPAT_SIGNATURE_HEADER = 'x-twilio-signature';

/**
 * A rejection response as a framework-free triple:
 * ``[statusCode, responseHeaders, responseBody]``. Cross-port shape of the
 * decomposed webhook-validation decision (Python's
 * ``webhook_middleware.validate`` return, dotnet's
 * ``WebhookValidationMiddleware.Validate``, Rack/PSGI ``[status, headers, body]``).
 */
export type WebhookRejection = [number, Record<string, string>, string];

/**
 * Look up a header value case-insensitively from a plain header map.
 * SignalWire signs with ``X-SignalWire-Signature`` and (cXML-compat)
 * ``X-Twilio-Signature``; incoming maps may spell the keys either case.
 */
function headerLookup(headers: Record<string, string>, name: string): string | undefined {
  const want = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === want) return headers[key];
  }
  return undefined;
}

/**
 * Framework-free webhook-validation decision core.
 *
 * This is the language-neutral heart every SignalWire SDK exposes at the same
 * canonical path (``signalwire.core.security.webhook_middleware.validate``): it
 * takes the decomposed request primitives (no framework Request/Response
 * objects) and returns either ``null`` (the request is authentic — let it
 * through) or a ``[status, headers, body]`` rejection triple the caller writes
 * back verbatim. The {@link webhookValidationMiddleware} Hono adapter is a thin
 * wrapper over this: it reads the raw body + headers off the Hono context, calls
 * ``validate``, and turns a non-null triple into a ``c.text(...)`` response.
 *
 * Behavior mirrors the SignalWire webhook signature-validation contract:
 *
 *   - A valid ``X-SignalWire-Sha256-Signature`` (HMAC-SHA256) → ``null`` (pass).
 *     This stronger header is checked first; when it is missing or doesn't
 *     match, the SHA-1 header decides.
 *   - Missing ``X-SignalWire-Signature`` (or the ``X-Twilio-Signature`` alias)
 *     → reject ``[403, {}, 'Forbidden']`` (never throws for a missing header).
 *   - Bad signature → reject ``[403, {}, 'Forbidden']``.
 *   - Valid signature → ``null`` (pass).
 *   - Missing / empty ``signingKey`` → throws (a programming error, not a
 *     validation failure — matches ``validateWebhookSignature``).
 *
 * The rejection body carries no detail about which scheme or branch failed —
 * the validator MUST NOT leak that.
 *
 * @param method The HTTP method (informational; the signature does not cover it).
 * @param url The full public URL SignalWire POSTed to (scheme, host, optional
 *   port, path, query) — reconstruct proxy/tunnel URLs before calling.
 * @param headers The request headers as a plain string→string map. Looked up
 *   case-insensitively for the signature header.
 * @param body The raw request body as a UTF-8 string, BEFORE any JSON/form parse.
 * @param signingKey The customer's Signing Key from the Dashboard.
 * @returns ``null`` when the request is authentic; a ``[status, headers, body]``
 *   triple to send back when it is not.
 * @throws Error when ``signingKey`` is missing / empty.
 */
export function validate(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string,
  signingKey: string,
): WebhookRejection | null {
  void method; // signature is over url + body, not the method
  if (!signingKey || typeof signingKey !== 'string') {
    throw new Error('signingKey is required');
  }

  // Prefer the stronger SHA-256 signature when the platform sends it: the same
  // Scheme A message, hashed with SHA-256. Fall back to the SHA-1 header below,
  // so deployments on older platform builds, and the cXML/form Scheme B path,
  // keep validating.
  const sha256Signature = headerLookup(headers, SIGNALWIRE_SHA256_SIGNATURE_HEADER);
  if (sha256Signature) {
    try {
      if (validateWebhookSignatureSha256(signingKey, sha256Signature, url, body)) return null;
    } catch {
      // Fall back to the SHA-1 header.
    }
  }

  const signature =
    headerLookup(headers, SIGNALWIRE_SIGNATURE_HEADER) ??
    headerLookup(headers, TWILIO_COMPAT_SIGNATURE_HEADER);

  const reject: WebhookRejection = [403, {}, 'Forbidden'];

  if (signature === undefined || signature === '') {
    return reject;
  }

  let ok: boolean;
  try {
    ok = validateWebhookSignature(signingKey, signature, url, body);
  } catch {
    // Non-string body or other input error — treat as a rejection for the
    // request without leaking which branch tripped.
    return reject;
  }

  return ok ? null : reject;
}

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
  return publicUrl(c.req.url, (name) => c.req.header(name), opts.trustProxy);
}

/**
 * Rebuild the public URL SignalWire POSTed to, from the URL the server or
 * platform saw. Framework-free, so the Hono adapter and serverless requests
 * share it (mirrors the reference's `_public_url`).
 *
 * @param url - The full URL the request was received on.
 * @param header - Looks up a request header by name.
 * @param trustProxy - Whether to honor `X-Forwarded-Proto` / `X-Forwarded-Host`.
 * @param pathAndQuery - The path and query to join to `SWML_PROXY_URL_BASE`;
 *   defaults to those of `url`. A serverless platform passes the path below
 *   the app's root. A forwarded host always keeps the path of `url`, so a
 *   platform prefix (a CGI script, an API Gateway stage) is kept.
 */
function publicUrl(
  url: string,
  header: (name: string) => string | undefined,
  trustProxy: boolean,
  pathAndQuery?: string,
): string {
  // Extract path + query from the raw URL without losing original encoding.
  let urlPathAndQuery: string;
  try {
    const u = new URL(url);
    urlPathAndQuery = u.pathname + (u.search || '');
  } catch {
    urlPathAndQuery = url;
  }

  const proxyBase = process.env['SWML_PROXY_URL_BASE'];
  if (proxyBase) {
    const trimmed = proxyBase.replace(/\/+$/, '');
    return `${trimmed}${pathAndQuery ?? urlPathAndQuery}`;
  }

  if (trustProxy) {
    const fwdHost = header('x-forwarded-host');
    if (fwdHost) {
      const fwdProto = header('x-forwarded-proto') ?? 'https';
      return `${fwdProto}://${fwdHost}${urlPathAndQuery}`;
    }
  }

  return url;
}

/**
 * The URLs a serverless request's signature may have been computed over, from
 * the targets the serverless adapter passes in Hono's `env`, or null for a
 * request that didn't come through the adapter.
 */
function serverlessSignatureUrls(c: Context, trustProxy: boolean): string[] | null {
  const env = c.env as Record<string, unknown> | undefined;
  const targets = env?.[_SIGNATURE_TARGETS_ENV_KEY];
  if (!Array.isArray(targets) || targets.length === 0) return null;
  const urls: string[] = [];
  for (const t of targets as _SignatureTarget[]) {
    const url = publicUrl(
      t.url || c.req.url,
      (name) => c.req.header(name),
      trustProxy,
      t.pathAndQuery,
    );
    if (!urls.includes(url)) urls.push(url);
  }
  return urls;
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
 *   2. Pulls the ``X-SignalWire-Sha256-Signature`` header and the
 *      ``X-SignalWire-Signature`` header (or the ``X-Twilio-Signature`` alias).
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
    // A serverless request carries the URL(s) the platform was called on;
    // otherwise rebuild the URL from this request.
    const urls = serverlessSignatureUrls(c, trustProxy) ?? [reconstructUrl(c, { trustProxy })];

    // Delegate the decision to the framework-free `validate` core so the Hono
    // adapter and the decomposed cross-port contract share one implementation.
    const headers: Record<string, string> = {};
    if (signature !== null) headers[SIGNALWIRE_SIGNATURE_HEADER] = signature;
    const sha256Signature = c.req.header(SIGNALWIRE_SHA256_SIGNATURE_HEADER);
    if (sha256Signature !== undefined) {
      headers[SIGNALWIRE_SHA256_SIGNATURE_HEADER] = sha256Signature;
    }
    let rejection: WebhookRejection | null = null;
    for (const url of urls) {
      rejection = validate(c.req.method, url, headers, rawBody, signingKey);
      if (rejection === null) break;
    }

    if (rejection !== null) {
      const [status, respHeaders, respBody] = rejection;
      for (const [k, v] of Object.entries(respHeaders)) c.header(k, v);
      return c.text(respBody, status as Parameters<typeof c.text>[1]);
    }

    // Valid — stash raw body for downstream handlers and continue.
    c.set('rawBody', rawBody);
    await next();
  };
}
