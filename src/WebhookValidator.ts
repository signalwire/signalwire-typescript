/**
 * Webhook signature validation for SignalWire-signed HTTP requests.
 *
 * Implements both schemes from porting-sdk/webhooks.md:
 *
 * - Scheme A (RELAY/SWML/JSON): hex(HMAC-SHA1(key, url + rawBody))
 * - Scheme B (Compat/cXML form): base64(HMAC-SHA1(key, url + sortedFormParams))
 *   with optional bodySHA256 query-param fallback for JSON-on-compat-surface.
 *
 * Public API:
 *     validateWebhookSignature(signingKey, signature, url, rawBody) -> boolean
 *     validateRequest(signingKey, signature, url, paramsOrRawBody)  -> boolean
 *
 * All comparisons use ``crypto.timingSafeEqual`` (constant-time) so the secret
 * is not leaked over repeated requests.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Form params can be a record, a list of [key, value] tuples, or a Map. Values
 * may be a string, number, boolean, null/undefined, or an array of those for
 * repeated keys.
 */
export type FormParamValue = string | number | boolean | null | undefined;
export type FormParams =
  | Record<string, FormParamValue | FormParamValue[]>
  | Array<[string, FormParamValue]>
  | Map<string, FormParamValue | FormParamValue[]>;

function hexHmacSha1(key: string, message: string): string {
  return createHmac('sha1', key).update(message, 'utf8').digest('hex');
}

function b64HmacSha1(key: string, message: string): string {
  return createHmac('sha1', key).update(message, 'utf8').digest('base64');
}

/**
 * Constant-time compare two strings as utf-8 byte buffers.
 * Returns false on length mismatch (which timingSafeEqual would otherwise
 * throw on) — that mismatch by itself doesn't leak the secret because the
 * length of the expected digest is a fixed constant per scheme.
 */
function safeEq(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  try {
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

/** Stringify a single value the way the JS reference implementation does. */
function stringifyParamValue(v: FormParamValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

/**
 * Concatenate form params per Scheme B rules:
 *
 *   - Sort by key, ASCII ascending (stable).
 *   - For repeated keys: keep original submission order, emit ``key+value``
 *     once per occurrence.
 */
function sortedConcatParams(params: FormParams | null | undefined): string {
  if (params === null || params === undefined) return '';

  // Normalize to an ordered list of [key, value] pairs.
  const items: Array<[string, FormParamValue]> = [];
  if (params instanceof Map) {
    for (const [k, v] of params) {
      if (Array.isArray(v)) {
        for (const vi of v) items.push([k, vi]);
      } else {
        items.push([k, v]);
      }
    }
  } else if (Array.isArray(params)) {
    for (const [k, v] of params) items.push([k, v]);
  } else {
    for (const k of Object.keys(params)) {
      const v = params[k];
      if (Array.isArray(v)) {
        for (const vi of v) items.push([k, vi]);
      } else {
        items.push([k, v]);
      }
    }
  }

  if (items.length === 0) return '';

  // Stable sort by key — preserves original order within repeated keys.
  // Array.prototype.sort is stable in V8 since Node 12.
  items.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  let out = '';
  for (const [k, v] of items) out += k + stringifyParamValue(v);
  return out;
}

/**
 * Best-effort parse of an x-www-form-urlencoded body into ordered (k, v) pairs.
 * Returns an empty list if the body doesn't look like form data; the caller
 * then signs against ``url + ""``.
 */
function parseFormBody(rawBody: string): Array<[string, string]> {
  if (!rawBody) return [];
  // URLSearchParams preserves insertion order including repeats.
  try {
    const sp = new URLSearchParams(rawBody);
    const out: Array<[string, string]> = [];
    sp.forEach((v, k) => out.push([k, v]));
    return out;
  } catch {
    return [];
  }
}

interface SplitUrl {
  scheme: string;
  host: string; // hostname only (no port, no brackets)
  port: string; // empty string if absent
  path: string;
  query: string;
  fragment: string;
  hadAuth: boolean;
  authority: string; // userinfo@ if present, else ''
}

/**
 * Split a URL into its parts without dropping anything. We avoid the
 * ``URL`` class round-trip for assembly because that re-encodes characters,
 * which would change the bytes the HMAC was computed over.
 */
function splitUrl(url: string): SplitUrl {
  // Match RFC 3986-ish: scheme://[userinfo@]host[:port][/path][?query][#fragment]
  const m = url.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!m) {
    return {
      scheme: '',
      host: '',
      port: '',
      path: url,
      query: '',
      fragment: '',
      hadAuth: false,
      authority: '',
    };
  }
  // Groups 1-3 are non-optional in the regex, so they are always present on a
  // match; `?? ''` only satisfies the type checker (empty string is unreachable).
  const scheme = m[1] ?? '';
  const netloc = m[2] ?? '';
  const path = m[3] ?? '';
  const query = m[4] ? m[4].slice(1) : '';
  const fragment = m[5] ? m[5].slice(1) : '';

  // Split userinfo from host:port
  let authority = '';
  let hostPort = netloc;
  const atIdx = netloc.lastIndexOf('@');
  if (atIdx >= 0) {
    authority = netloc.slice(0, atIdx + 1); // includes the trailing @
    hostPort = netloc.slice(atIdx + 1);
  }

  let host = hostPort;
  let port = '';
  // IPv6 bracket form: [::1]:8080
  if (hostPort.startsWith('[')) {
    const close = hostPort.indexOf(']');
    if (close >= 0) {
      host = hostPort.slice(0, close + 1);
      const rest = hostPort.slice(close + 1);
      if (rest.startsWith(':')) port = rest.slice(1);
    }
  } else {
    const colon = hostPort.lastIndexOf(':');
    if (colon >= 0 && /^\d+$/.test(hostPort.slice(colon + 1))) {
      host = hostPort.slice(0, colon);
      port = hostPort.slice(colon + 1);
    }
  }

  return {
    scheme,
    host,
    port,
    path,
    query,
    fragment,
    hadAuth: authority.length > 0,
    authority,
  };
}

/** Reassemble a URL from its parts, replacing the port (or stripping it). */
function buildUrl(parts: SplitUrl, port: string): string {
  if (!parts.scheme) return parts.path;
  const portPart = port ? `:${port}` : '';
  const queryPart = parts.query ? `?${parts.query}` : '';
  const fragPart = parts.fragment ? `#${parts.fragment}` : '';
  return `${parts.scheme}://${parts.authority}${parts.host}${portPart}${parts.path}${queryPart}${fragPart}`;
}

/**
 * Return the URL variants to try for Scheme B port normalization.
 *
 * - If the URL already has a non-standard port: just the input URL.
 * - If https + no port: input URL AND url with ":443".
 * - If http  + no port: input URL AND url with ":80".
 * - If https + ":443" / http + ":80": input URL AND url with port stripped.
 * - Otherwise (any explicit non-standard port): just the input URL.
 */
function candidateUrls(url: string): string[] {
  const parts = splitUrl(url);
  if (!parts.host) return [url];

  const standard: Record<string, string> = { http: '80', https: '443' };
  const std = standard[parts.scheme.toLowerCase()] ?? '';

  const out: string[] = [url];

  if (!parts.port && std) {
    const withPort = buildUrl(parts, std);
    if (withPort !== url) out.push(withPort);
  } else if (parts.port && std === parts.port) {
    const withoutPort = buildUrl(parts, '');
    if (withoutPort !== url) out.push(withoutPort);
  }
  return out;
}

/** Pull a single query-param value out of the query string (no decoding magic). */
function queryParam(query: string, name: string): string | undefined {
  if (!query) return undefined;
  for (const piece of query.split('&')) {
    if (!piece) continue;
    const eq = piece.indexOf('=');
    const key = eq >= 0 ? piece.slice(0, eq) : piece;
    const val = eq >= 0 ? piece.slice(eq + 1) : '';
    if (decodeQueryComponent(key) === name) return decodeQueryComponent(val);
  }
  return undefined;
}

function decodeQueryComponent(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/**
 * If URL has ``?bodySHA256=<hex>``, verify ``sha256_hex(rawBody)`` matches.
 * Returns true if the param is absent (no constraint) or present and matches.
 */
function checkBodySha256(url: string, rawBody: string): boolean {
  const parts = splitUrl(url);
  const expected = queryParam(parts.query, 'bodySHA256');
  if (expected === undefined) return true;
  const actual = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  return safeEq(actual, expected);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a SignalWire webhook signature against both schemes (A then B).
 *
 * @param signingKey The customer's Signing Key from the Dashboard. Empty / null
 *   throws ``Error`` — that's a programming error, not a validation failure.
 * @param signature The ``X-SignalWire-Signature`` header value (or
 *   ``X-Twilio-Signature`` for cXML compat). Missing / empty returns ``false``
 *   without throwing.
 * @param url The full URL SignalWire POSTed to (scheme, host, optional port,
 *   path, query). Must match what the platform saw — see the URL reconstruction
 *   section of porting-sdk/webhooks.md.
 * @param rawBody The raw request body bytes as a UTF-8 string, BEFORE any
 *   JSON / form parsing. Must be a string — passing a parsed object throws
 *   ``TypeError``.
 * @returns ``true`` if the signature matches either Scheme A (hex JSON) or
 *   Scheme B (base64 form, with port-normalization variants and optional
 *   bodySHA256 fallback). ``false`` otherwise.
 * @throws Error when ``signingKey`` is missing / empty.
 * @throws TypeError when ``rawBody`` is not a string.
 */
export function validateWebhookSignature(
  signingKey: string,
  signature: string,
  url: string,
  rawBody: string,
): boolean {
  if (!signingKey || typeof signingKey !== 'string') {
    throw new Error('signingKey is required');
  }
  if (typeof rawBody !== 'string') {
    throw new TypeError('rawBody must be a string; did you pass parsed JSON by mistake?');
  }
  if (signature === null || signature === undefined || signature === '') {
    return false;
  }

  // ------------------------------------------------------------------
  // Scheme A — RELAY/SWML/JSON: hex(HMAC-SHA1(key, url + rawBody))
  // ------------------------------------------------------------------
  const expectedA = hexHmacSha1(signingKey, url + rawBody);
  if (safeEq(expectedA, signature)) {
    return true;
  }

  // ------------------------------------------------------------------
  // Scheme B — Compat/cXML form: base64(HMAC-SHA1(key, url + sortedConcat))
  // Try with parsed form params; fall back to empty params for JSON-on-compat.
  // Try both with-port and without-port URL variants.
  // ------------------------------------------------------------------
  const parsedParams = parseFormBody(rawBody);
  const paramShapes: Array<Array<[string, FormParamValue]>> = [parsedParams, []];

  for (const candidateUrl of candidateUrls(url)) {
    for (const shape of paramShapes) {
      const concat = sortedConcatParams(shape);
      const expectedB = b64HmacSha1(signingKey, candidateUrl + concat);
      if (safeEq(expectedB, signature)) {
        // If the URL carries bodySHA256, the body hash must match too.
        if (checkBodySha256(candidateUrl, rawBody)) return true;
        // bodySHA256 mismatched — keep trying other shapes/urls.
      }
    }
  }

  return false;
}

/**
 * Legacy ``@signalwire/compatibility-api`` drop-in entry point.
 *
 * If ``paramsOrRawBody`` is a string, delegates to
 * {@link validateWebhookSignature} (Scheme A then Scheme B with parsed form).
 *
 * If it's a record, Map, or list of [key, value] tuples, treats it as
 * pre-parsed form params and runs Scheme B directly (with URL port
 * normalization and optional bodySHA256 fallback).
 *
 * The parameter type matches Python's
 * ``Union[str, Mapping[str, Any], List[Tuple[str, Any]], None]`` for
 * cross-language signature parity. ``Map<string, unknown>`` is also
 * accepted at runtime for ergonomic TS usage.
 *
 * @param signingKey Customer's Signing Key. Empty / null throws Error.
 * @param signature Header value. Missing / empty returns false.
 * @param url Full URL SignalWire POSTed to.
 * @param paramsOrRawBody String raw body OR pre-parsed form params.
 * @returns true on match, false otherwise.
 * @throws Error when ``signingKey`` is missing.
 * @throws TypeError when ``paramsOrRawBody`` is neither a string nor a
 *   record/Map/array of tuples (e.g. a plain number).
 */
export function validateRequest(
  signingKey: string,
  signature: string,
  url: string,
  paramsOrRawBody: string | Record<string, unknown> | Array<[string, unknown]> | null | undefined,
): boolean {
  if (!signingKey || typeof signingKey !== 'string') {
    throw new Error('signingKey is required');
  }
  if (signature === null || signature === undefined || signature === '') {
    return false;
  }

  if (typeof paramsOrRawBody === 'string') {
    return validateWebhookSignature(signingKey, signature, url, paramsOrRawBody);
  }

  if (paramsOrRawBody === null || paramsOrRawBody === undefined) {
    paramsOrRawBody = [];
  }

  const isMap = paramsOrRawBody instanceof Map;
  const isArray = Array.isArray(paramsOrRawBody);
  const isPlainObj = !isMap && !isArray && typeof paramsOrRawBody === 'object';

  if (!isMap && !isArray && !isPlainObj) {
    throw new TypeError(
      'paramsOrRawBody must be a string (raw body) or a record/Map/array of form params',
    );
  }

  // Pre-parsed form params → Scheme B only.
  const concat = sortedConcatParams(paramsOrRawBody as FormParams);
  for (const candidateUrl of candidateUrls(url)) {
    const expectedB = b64HmacSha1(signingKey, candidateUrl + concat);
    if (safeEq(expectedB, signature)) {
      // bodySHA256 has no raw body to verify here — skip that check.
      return true;
    }
  }
  return false;
}
