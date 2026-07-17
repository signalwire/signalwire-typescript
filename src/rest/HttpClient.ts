/**
 * HttpClient — fetch-based HTTP with Basic Auth.
 *
 * All methods return parsed JSON. Throws RestError on non-2xx responses.
 * Returns {} on 204 No Content.
 */

import { createRequire } from 'node:module';
import { getLogger } from '../Logger.js';
import { RestError, RestTransportError } from './RestError.js';
import type { SignalWireErrorBody } from '../PlatformContracts.js';
import type { HttpClientOptions, QueryParams } from './types.js';

const logger = getLogger('rest_client');

/**
 * REST client User-Agent, derived at runtime from the installed package version
 * so it can never drift from a hardcoded literal (the token used to be a stale
 * `@signalwire/sdk-ts/2.0.0` while the package moved on). The product token is
 * `signalwire-typescript`, mirroring the Python reference's `signalwire-python/<v>`.
 *
 * `../../package.json` resolves identically in both layouts — from `src/rest/`
 * during dev (tsx) and from `dist/rest/` when installed — since package.json
 * always ships at the package root two levels above this module.
 */
function buildUserAgent(): string {
  let version = 'unknown';
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../../package.json') as { version?: string };
    if (pkg.version) version = pkg.version;
  } catch {
    // Uninstalled / unusual bundling — fall back to the stable product token.
  }
  return `signalwire-typescript/${version}`;
}

const USER_AGENT = buildUserAgent();

/**
 * Low-level HTTP client used by every REST namespace resource.
 *
 * Handles Basic Auth, JSON encoding/decoding, and error normalisation
 * ({@link RestError} on non-2xx). Normally you do not instantiate this
 * directly — construct a {@link RestClient} instead.
 */
export class HttpClient {
  /** Fully-qualified base URL (no trailing slash). */
  readonly baseUrl: string;
  private readonly _authHeader: string;
  private readonly _fetch: typeof globalThis.fetch;

  /**
   * Build a new HTTP client.
   *
   * @param options - Connection options. Either `host` (bare hostname;
   *   `https://` is prepended automatically) or `baseUrl` (fully-qualified)
   *   must be provided along with `project` + `token`.
   * @throws {Error} When neither `host` nor `baseUrl` is supplied.
   */
  constructor(options: HttpClientOptions) {
    if (!options.host && !options.baseUrl) {
      throw new Error('HttpClientOptions requires either "host" or "baseUrl".');
    }

    // host takes precedence (matches Python's HttpClient(project, token, host) convention
    // where a bare hostname is expected and https:// is prepended automatically).
    const rawUrl = options.host ? `https://${options.host}` : options.baseUrl!;
    this.baseUrl = rawUrl.replace(/\/+$/, '');

    this._authHeader =
      'Basic ' + Buffer.from(`${options.project}:${options.token}`).toString('base64');
    this._fetch = options.fetchImpl ?? globalThis.fetch;
  }

  private async _request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    params?: QueryParams,
  ): Promise<T> {
    let url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
      const qsStr = qs.toString();
      if (qsStr) url += (url.includes('?') ? '&' : '?') + qsStr;
    }

    logger.debug(`${method} ${url}`);

    const headers: Record<string, string> = {
      Authorization: this._authHeader,
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let resp: Response;
    try {
      resp = await this._fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      // Transport failure (connection refused / DNS / reset / TLS): fetch rejects
      // (typically a TypeError) and the request never produced a response. Wrap it
      // in the typed error family so a caller catching RestError handles it too,
      // instead of a bare fetch TypeError leaking out.
      const message = err instanceof Error ? err.message : String(err);
      throw new RestTransportError(message, url, method);
    }

    if (!resp.ok) {
      const text = await resp.text();
      let errBody: string | SignalWireErrorBody = text;
      try {
        errBody = JSON.parse(text) as SignalWireErrorBody;
      } catch {
        // Response was not valid JSON — keep as plain string.
      }
      throw new RestError(resp.status, errBody, url, method);
    }

    if (resp.status === 204) {
      return {} as T;
    }

    const text = await resp.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  /**
   * Perform an authenticated HTTP GET and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @param params - Optional query parameters; `undefined` values are skipped.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async get<T = unknown>(path: string, params?: QueryParams): Promise<T> {
    return this._request<T>('GET', path, undefined, params);
  }

  /**
   * Perform an authenticated HTTP POST and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @param body - JSON-serialisable request body. Omit to send no body.
   * @param params - Optional query parameters appended to the URL.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async post<T = unknown>(path: string, body?: unknown, params?: QueryParams): Promise<T> {
    return this._request<T>('POST', path, body, params);
  }

  /**
   * Perform an authenticated HTTP PUT and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @param body - JSON-serialisable request body.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this._request<T>('PUT', path, body);
  }

  /**
   * Perform an authenticated HTTP PATCH and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @param body - JSON-serialisable partial request body.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this._request<T>('PATCH', path, body);
  }

  /**
   * Perform an authenticated HTTP DELETE and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete<T = unknown>(path: string): Promise<T> {
    return this._request<T>('DELETE', path);
  }
}
