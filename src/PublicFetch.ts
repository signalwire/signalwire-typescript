/**
 * PublicFetch - fetch a user-supplied URL without reaching private or
 * internal addresses.
 *
 * Checking a URL before fetching it isn't enough on its own. The server can
 * redirect to an internal address, such as a cloud metadata service, and the
 * hostname can resolve to a different address when the connection is made
 * (DNS rebinding). {@link _publicFetch} follows redirects itself and checks
 * every hop, and connects through a DNS lookup that refuses private and
 * internal addresses, so the address it connects to is the one it checked.
 *
 * It connects directly, ignoring any environment proxy, because through a
 * proxy the connection check can't apply. Set `SWML_URL_FETCH_USE_PROXY` to
 * send through Node's global `fetch` instead (which uses a proxy only when
 * Node's own proxy support is on), with a proxy that restricts destinations
 * itself. `SWML_ALLOW_PRIVATE_URLS` turns the address checks off.
 *
 * Internal to the SDK: the skills that fetch URLs a caller or the model
 * supplied (spider, web_search) use it. Mirrors signalwire-python's
 * `_PublicSession` (signalwire/utils/url_validator.py).
 */

import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import { _checkUrl, _privateUrlsAllowed, isPrivateIp, redactUrl } from './SecurityUtils.js';

/** Most redirects {@link _publicFetch} follows before giving up. */
const MAX_REDIRECTS = 10;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Headers that carry credentials for one origin and must not follow a redirect elsewhere. */
const ORIGIN_BOUND_HEADERS = ['authorization', 'cookie', 'proxy-authorization'];

/** Options for {@link _publicFetch}. */
export interface _PublicFetchInit {
  /** HTTP method (default `GET`). */
  method?: string;
  /** Request headers. */
  headers?: Record<string, string>;
  /** Request body, for methods that send one. */
  body?: string;
  /** Aborts the request, including any redirect in progress. */
  signal?: AbortSignal;
  /** Skip the address checks, as `SWML_ALLOW_PRIVATE_URLS` does. */
  allowPrivate?: boolean;
}

/** Sends one request without following redirects. Tests replace it. */
export type _PublicFetchTransport = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
  guard: boolean,
) => Promise<Response>;

/**
 * DNS lookup for connections to user-supplied hosts: resolves every address
 * and refuses the connection if any of them is private or internal.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err, '', 0);
      return;
    }
    const list = addresses as dns.LookupAddress[];
    const blocked = list.find((a) => isPrivateIp(a.address));
    if (blocked || list.length === 0) {
      const reason = blocked
        ? `${blocked.address} is a private or internal address`
        : 'it has no address';
      const refusal = Object.assign(new Error(`Refused to connect to ${hostname}: ${reason}`), {
        code: 'ERR_SW_BLOCKED_ADDRESS',
      });
      callback(refusal, '', 0);
      return;
    }
    if (options.all) {
      callback(null, list);
    } else {
      callback(null, list[0]!.address, list[0]!.family);
    }
  });
};

/** Wrap a decoded response body stream for a `Response`. */
function decodeBody(res: http.IncomingMessage): Readable {
  const encoding = (res.headers['content-encoding'] ?? '').toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return res.pipe(zlib.createGunzip());
  if (encoding === 'deflate') return res.pipe(zlib.createInflate());
  if (encoding === 'br') return res.pipe(zlib.createBrotliDecompress());
  return res;
}

/**
 * Send one request with node:http(s). With `guard`, the connection resolves
 * the hostname through {@link guardedLookup}, so a hostname that resolves to a
 * private address at connect time is refused even if it resolved to a public
 * one when the URL was checked. An IP-literal host skips DNS; {@link
 * _publicFetch} has already checked it.
 */
export const _nodeTransport: _PublicFetchTransport = (url, init, guard) =>
  new Promise<Response>((resolve, reject) => {
    const target = new URL(url);
    const mod = target.protocol === 'https:' ? https : http;
    const req = mod.request(
      target,
      {
        method: init.method,
        headers: { 'accept-encoding': 'gzip, deflate, br', ...init.headers },
        signal: init.signal,
        // A fresh agent, never a global one that an environment proxy configured.
        agent: false,
        ...(guard ? { lookup: guardedLookup } : {}),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const headers = new Headers();
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
          const name = res.rawHeaders[i]!.toLowerCase();
          if (name === 'content-encoding' || name === 'content-length') continue;
          headers.append(res.rawHeaders[i]!, res.rawHeaders[i + 1]!);
        }
        const noBody = init.method === 'HEAD' || [204, 205, 304].includes(status);
        let body: ReadableStream | null = null;
        if (noBody) {
          res.resume();
        } else {
          body = Readable.toWeb(decodeBody(res)) as ReadableStream;
        }
        const response = new Response(body, {
          status,
          statusText: res.statusMessage ?? '',
          headers,
        });
        Object.defineProperty(response, 'url', { value: target.toString() });
        resolve(response);
      },
    );
    req.on('error', reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });

/**
 * Send one request through Node's global fetch, without following redirects.
 * Used when `SWML_URL_FETCH_USE_PROXY` asks for the environment's proxy, where
 * the connection check can't apply.
 */
const globalFetchTransport: _PublicFetchTransport = (url, init) =>
  fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: init.signal,
    redirect: 'manual',
  });

let transportOverride: _PublicFetchTransport | null = null;

/**
 * Replace the transport {@link _publicFetch} sends each request with, or
 * restore the default with `null`. For tests only.
 */
export function _setPublicFetchTransport(transport: _PublicFetchTransport | null): void {
  transportOverride = transport;
}

/** True when `SWML_URL_FETCH_USE_PROXY` (1/true/yes) lets these fetches use a proxy. */
function proxyAllowed(): boolean {
  const env = (process.env['SWML_URL_FETCH_USE_PROXY'] ?? '').toLowerCase();
  return env === '1' || env === 'true' || env === 'yes';
}

/**
 * Fetch a user-supplied URL, refusing private and internal addresses.
 *
 * Checks the URL, then each redirect's target, before requesting it (up to
 * {@link MAX_REDIRECTS} redirects), and connects through a lookup that refuses
 * a private or internal address. A redirect to another origin drops the
 * `Authorization`, `Cookie` and `Proxy-Authorization` headers. A 303, or a
 * 301/302 answering a POST, is followed with a GET, as browsers do.
 *
 * @param url - The URL to fetch.
 * @param init - Method, headers, body, abort signal and `allowPrivate`.
 * @returns The final response, which is not a redirect unless it had no
 *   `Location` header.
 * @throws If the URL or a redirect is refused, there are too many redirects,
 *   or the request fails.
 */
export async function _publicFetch(url: string, init: _PublicFetchInit = {}): Promise<Response> {
  const allowPrivate = _privateUrlsAllowed(init.allowPrivate ?? false);
  const transport =
    transportOverride ?? (proxyAllowed() && !allowPrivate ? globalFetchTransport : _nodeTransport);
  const guard = !allowPrivate;

  let method = (init.method ?? 'GET').toUpperCase();
  let body = init.body;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(init.headers ?? {})) headers[k.toLowerCase()] = v;

  let current = url;
  for (let redirects = 0; ; redirects++) {
    try {
      await _checkUrl(current, allowPrivate);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Refused to fetch ${redactUrl(current)}: ${reason}`, { cause: err });
    }

    const response = await transport(
      current,
      { method, headers, body, signal: init.signal },
      guard,
    );
    const location = response.headers.get('location');
    if (!REDIRECT_STATUSES.has(response.status) || !location) return response;

    await response.body?.cancel().catch(() => undefined);
    if (redirects >= MAX_REDIRECTS) {
      throw new Error(`Too many redirects fetching ${redactUrl(url)}`);
    }

    const next = new URL(location, current);
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && method === 'POST')
    ) {
      method = 'GET';
      body = undefined;
      delete headers['content-type'];
      delete headers['content-length'];
    }
    if (next.origin !== new URL(current).origin) {
      for (const name of ORIGIN_BOUND_HEADERS) delete headers[name];
    }
    current = next.toString();
  }
}
