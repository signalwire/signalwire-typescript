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
 * proxy the connection check can't apply. With `SWML_URL_FETCH_USE_PROXY` set,
 * a request that Node's global `fetch` would send through a proxy (Node's
 * proxy support on, a proxy set for the scheme, the host not in `NO_PROXY`)
 * goes through it instead; use a proxy that restricts destinations itself.
 * Every other request still connects directly through the guarded lookup.
 * `SWML_ALLOW_PRIVATE_URLS` turns the address checks off.
 *
 * The `insecureTls` option skips TLS certificate verification (for a trusted
 * gateway with a self-signed certificate) and nothing else: every hop is still
 * checked and every connection still goes through the guarded lookup.
 *
 * Internal to the SDK: the skills that fetch URLs a caller or the model
 * supplied (spider, web_search, mcp_gateway) use it. Mirrors signalwire-python's
 * `_PublicSession` (signalwire/utils/url_validator.py).
 */

import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { Readable, pipeline } from 'node:stream';
import zlib from 'node:zlib';
import { _checkUrl, _privateUrlsAllowed, isPrivateIp, redactUrl } from './SecurityUtils.js';

/** Most redirects {@link _publicFetch} follows before giving up. */
const MAX_REDIRECTS = 10;

/**
 * Most redirects {@link _publicFetch} follows in `curl` mode: the platform's
 * `CURLOPT_MAXREDIRS` for a DataMap webhook.
 */
const CURL_MAX_REDIRECTS = 15;

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
  /**
   * Called with each redirect's target before it's requested; returning false
   * stops the fetch with a {@link _RedirectRefused} error. The address checks
   * still apply to a target it allows.
   */
  allowRedirect?: (target: string) => boolean | Promise<boolean>;
  /**
   * Accept any TLS certificate (no verification) on every hop. The address
   * checks still apply. Such a request always connects directly, through the
   * guarded lookup, even with `SWML_URL_FETCH_USE_PROXY` set, since the proxy
   * transport can't skip verification. Default `false`.
   */
  insecureTls?: boolean;
  /**
   * How redirects are followed. `browser` (the default) follows 301, 302,
   * 303, 307 and 308, up to 10 of them, and turns a 303, or a 301 or 302
   * answering a POST, into a GET without a body. `curl` follows them as
   * libcurl does with `CURLOPT_FOLLOWLOCATION`, `CURLOPT_MAXREDIRS` 15 and
   * `CURLOPT_POSTREDIR` `CURL_REDIR_POST_ALL`, the settings the platform
   * requests a DataMap webhook with: any 3xx with a `Location`, up to 15 of
   * them, a POST sent again with its body after any of them, and only a 303
   * answering a method other than GET, HEAD or POST turned into a GET. Both
   * modes check every hop's address and drop credentials on a change of
   * origin.
   */
  redirectMode?: 'browser' | 'curl';
  /**
   * Called with each response's status as it arrives, redirects included,
   * so a caller can report the last status received when a later hop fails,
   * as curl's `CURLINFO_RESPONSE_CODE` does.
   */
  onStatus?: (status: number) => void;
}

/** Thrown by {@link _publicFetch} when `allowRedirect` refuses a redirect. */
export class _RedirectRefused extends Error {
  /** The redirect target that was refused. */
  readonly target: string;

  /** @param target - The redirect target that was refused. */
  constructor(target: string) {
    super(`Redirect to ${redactUrl(target)} refused`);
    this.name = '_RedirectRefused';
    this.target = target;
  }
}

/** Sends one request without following redirects. Tests replace it. */
export type _PublicFetchTransport = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
    /** Skip TLS certificate verification (the address checks still apply). */
    insecureTls?: boolean;
  },
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

/**
 * The response body, decompressed when it's encoded. `pipeline` carries an
 * error in the connection (a reset mid-body) to the decompressor, so reading
 * the body fails instead of waiting forever.
 */
function decodeBody(res: http.IncomingMessage): Readable {
  const encoding = (res.headers['content-encoding'] ?? '').toLowerCase();
  let decoder: zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | null = null;
  if (encoding === 'gzip' || encoding === 'x-gzip') decoder = zlib.createGunzip();
  else if (encoding === 'deflate') decoder = zlib.createInflate();
  else if (encoding === 'br') decoder = zlib.createBrotliDecompress();
  if (!decoder) return res;
  return pipeline(res, decoder, () => {
    // Errors reach the consumer through the decoder, which pipeline destroys.
  });
}

/**
 * Send one request with node:http(s). With `guard`, the connection resolves
 * the hostname through {@link guardedLookup}, so a hostname that resolves to a
 * private address at connect time is refused even if it resolved to a public
 * one when the URL was checked. An IP-literal host skips DNS; {@link
 * _publicFetch} has already checked it. With `init.insecureTls`, an HTTPS
 * connection accepts any certificate; the lookup is guarded all the same.
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
        ...(init.insecureTls ? { rejectUnauthorized: false } : {}),
      },
      (res) => {
        // The server chose the status and headers, so anything that can't
        // become a Response (a status outside 200-599, a malformed header)
        // must reject this request: thrown here, in an event callback, it
        // would escape the promise and crash the process.
        try {
          const status = res.statusCode ?? 0;
          if (status < 200 || status > 599) {
            throw new Error(`Invalid HTTP status ${status} from ${target.host}`);
          }
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
        } catch (err) {
          res.destroy();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
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

const truthy = (value: string | undefined) =>
  ['1', 'true', 'yes'].includes((value ?? '').toLowerCase());

/** True when `SWML_URL_FETCH_USE_PROXY` (1/true/yes) lets these fetches use a proxy. */
function proxyAllowed(): boolean {
  return truthy(process.env['SWML_URL_FETCH_USE_PROXY']);
}

/**
 * Whether Node's global fetch would send a request for `url` through an
 * environment proxy: Node's proxy support is on (`NODE_USE_ENV_PROXY` or
 * `--use-env-proxy`), a proxy is set for the URL's scheme, and `NO_PROXY`
 * doesn't exclude the host. When it wouldn't, the connection is direct and
 * must go through the guarded transport. `NO_PROXY` is matched loosely (any
 * entry that could cover the host counts), which errs toward the guard.
 */
export function _proxiedByNode(url: string): boolean {
  const env = process.env;
  const nodeProxySupport =
    truthy(env['NODE_USE_ENV_PROXY']) || process.execArgv.includes('--use-env-proxy');
  if (!nodeProxySupport) return false;
  const target = new URL(url);
  const proxy =
    target.protocol === 'https:'
      ? (env['HTTPS_PROXY'] ?? env['https_proxy'])
      : (env['HTTP_PROXY'] ?? env['http_proxy']);
  if (!proxy) return false;
  const host = target.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const noProxy = (env['NO_PROXY'] ?? env['no_proxy'] ?? '')
    .split(/[\s,]+/)
    .map((e) => e.trim().toLowerCase().replace(/:\d+$/, ''))
    .filter(Boolean);
  for (const entry of noProxy) {
    if (entry === '*') return false;
    const bare = entry.replace(/^\*?\./, '');
    if (host === bare || host.endsWith(`.${bare}`)) return false;
  }
  return true;
}

/**
 * Fetch a user-supplied URL, refusing private and internal addresses.
 *
 * Checks the URL, then each redirect's target, before requesting it (up to
 * {@link MAX_REDIRECTS} redirects), and connects through a lookup that refuses
 * a private or internal address. A redirect to another origin drops the
 * `Authorization`, `Cookie` and `Proxy-Authorization` headers. A 303, or a
 * 301/302 answering a POST, is followed with a GET, as browsers do. With
 * `redirectMode: 'curl'`, redirects follow curl's rules instead (see
 * {@link _PublicFetchInit.redirectMode}); the checks are the same.
 *
 * @param url - The URL to fetch.
 * @param init - Method, headers, body, abort signal, `allowPrivate`,
 *   `allowRedirect`, `insecureTls`, `redirectMode` and `onStatus`.
 * @returns The final response, which is not a redirect unless it had no
 *   `Location` header.
 * @throws If the URL or a redirect is refused ({@link _RedirectRefused} when
 *   `allowRedirect` refuses it), there are too many redirects, or the
 *   request fails.
 */
export async function _publicFetch(url: string, init: _PublicFetchInit = {}): Promise<Response> {
  const allowPrivate = _privateUrlsAllowed(init.allowPrivate ?? false);
  const guard = !allowPrivate;
  // Through a proxy the connection check can't apply, so the global fetch is
  // used only when the request will really go through one; a direct
  // connection always goes through the guarded transport.
  // The global fetch can't skip certificate verification, so an insecureTls
  // request always connects directly.
  const insecureTls = init.insecureTls === true;
  const transportFor = (target: string): _PublicFetchTransport =>
    transportOverride ??
    (guard && !insecureTls && proxyAllowed() && _proxiedByNode(target)
      ? globalFetchTransport
      : _nodeTransport);

  const curl = init.redirectMode === 'curl';
  const maxRedirects = curl ? CURL_MAX_REDIRECTS : MAX_REDIRECTS;
  // curl follows a Location on any 3xx response (http.c), and a browser only
  // on the redirect statuses.
  const isRedirect = (status: number) =>
    curl ? status >= 300 && status <= 399 : REDIRECT_STATUSES.has(status);
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

    const response = await transportFor(current)(
      current,
      { method, headers, body, signal: init.signal, insecureTls },
      guard,
    );
    init.onStatus?.(response.status);
    const location = response.headers.get('location');
    if (!isRedirect(response.status) || !location) return response;

    await response.body?.cancel().catch(() => undefined);
    if (redirects >= maxRedirects) {
      throw new Error(`Too many redirects fetching ${redactUrl(url)}`);
    }

    const next = new URL(location, current);
    // A browser turns a 303, and a 301 or 302 answering a POST, into a GET.
    // curl with CURL_REDIR_POST_ALL sends a POST again, with its body, and
    // turns only a 303 answering another method (other than GET and HEAD)
    // into a GET (transfer.c Curl_follow).
    const toGet = curl
      ? response.status === 303 && !['GET', 'HEAD', 'POST'].includes(method)
      : response.status === 303 ||
        ((response.status === 301 || response.status === 302) && method === 'POST');
    if (toGet) {
      method = 'GET';
      body = undefined;
      delete headers['content-type'];
      delete headers['content-length'];
    }
    if (next.origin !== new URL(current).origin) {
      for (const name of ORIGIN_BOUND_HEADERS) delete headers[name];
    }
    current = next.toString();
    if (init.allowRedirect && !(await init.allowRedirect(current))) {
      throw new _RedirectRefused(current);
    }
  }
}
