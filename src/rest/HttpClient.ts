/**
 * HttpClient — fetch-based HTTP with Basic Auth.
 *
 * All methods return parsed JSON. Throws RestError on non-2xx responses.
 * Returns {} on 204 No Content.
 *
 * Transport behavior (timeout, opt-in retry with an idempotency-aware policy +
 * exponential backoff, cooperative cancellation) is governed by the
 * {@link RequestOptions} envelope (plan 4.2): a client default stored here, plus
 * an optional per-request override each verb accepts. See RequestOptions.ts.
 */

import { createRequire } from 'node:module';
import { getLogger } from '../Logger.js';
import { RestError, RestTransportError } from './RestError.js';
import type { SignalWireErrorBody } from '../PlatformContracts.js';
import type { HttpClientOptions, QueryParams } from './types.js';
import {
  resolve,
  statusIsRetryable,
  type _EffectiveOptions,
  type RequestOptionsInit,
} from './RequestOptions.js';

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

/** Backoff sleep between retries (a Promise-based delay). */
function sleep(seconds: number): Promise<void> {
  if (seconds <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

/**
 * Low-level HTTP client used by every REST namespace resource.
 *
 * Handles Basic Auth, JSON encoding/decoding, error normalisation
 * ({@link RestError} on non-2xx), and the {@link RequestOptions} transport
 * envelope (timeout / retry / abort). Normally you do not instantiate this
 * directly — construct a {@link RestClient} instead.
 */
export class HttpClient {
  /** Fully-qualified base URL (no trailing slash). */
  readonly baseUrl: string;
  private readonly _authHeader: string;
  private readonly _fetch: typeof globalThis.fetch;
  /** Client-default request options, shallow-overridden per request. */
  private readonly _requestOptions?: RequestOptionsInit;

  /**
   * Build a new HTTP client.
   *
   * @param options - Connection options. Either `host` (bare hostname;
   *   `https://` is prepended automatically) or `baseUrl` (fully-qualified)
   *   must be provided along with `project` + `token`. An optional
   *   `requestOptions` sets the client-default transport envelope.
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
    this._requestOptions = options.requestOptions;
  }

  /** Parse a `Retry-After` header (delta-seconds form) if present, else null. */
  private _retryAfterSeconds(resp: Response): number | null {
    const value = resp.headers.get('Retry-After');
    if (value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null; // HTTP-date form: fall back to backoff
  }

  private async _request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
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

    const opts = resolve(this._requestOptions, requestOptions);
    logger.debug(`${method} ${url}`);

    const headers: Record<string, string> = {
      Authorization: this._authHeader,
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const encodedBody = body !== undefined ? JSON.stringify(body) : undefined;

    // total attempts = retries + 1; retry on a retryable status (idempotency-
    // aware) or a transport error, honoring Retry-After then exponential
    // backoff. abortSignal is checked cooperatively before every attempt AND
    // passed to fetch for TRUE in-flight abort.
    let attempt = 0;
    for (;;) {
      attempt += 1;
      if (opts.abortSignal?.aborted) {
        // Cancelled before this attempt — surface as the transport-error family
        // (no response was produced), not a bare exception.
        throw new RestTransportError('request cancelled by abortSignal', url, method);
      }

      let resp: Response;
      try {
        resp = await this._fetch(url, {
          method,
          headers,
          body: encodedBody,
          signal: this._attemptSignal(opts),
        });
      } catch (err) {
        // Transport failure (connection refused / DNS / reset / TLS / timeout /
        // abort): fetch rejects and the request never produced a response.
        // Retry if attempts remain, else wrap in the typed error family so a
        // caller catching RestError handles it too.
        if (this._isAbort(err) && opts.abortSignal?.aborted) {
          // A user-driven abort (not a timeout) is terminal — do not retry.
          throw new RestTransportError('request cancelled by abortSignal', url, method);
        }
        if (attempt <= opts.retries) {
          await sleep(opts.retryBackoff * 2 ** (attempt - 1));
          continue;
        }
        const message = err instanceof Error ? err.message : String(err);
        throw new RestTransportError(message, url, method);
      }

      if (!resp.ok) {
        if (attempt <= opts.retries && statusIsRetryable(method, resp.status, opts)) {
          let delay = this._retryAfterSeconds(resp);
          if (delay === null) delay = opts.retryBackoff * 2 ** (attempt - 1);
          await sleep(delay);
          continue;
        }
        const text = await resp.text();
        let errBody: string | SignalWireErrorBody = text;
        try {
          errBody = JSON.parse(text) as SignalWireErrorBody;
        } catch {
          // Response was not valid JSON — keep as plain string.
        }
        // §6.6 error-observability: capture the response header map so RestError
        // can surface the platform request id (x-request-id etc.) — no wire change.
        const respHeaders: Record<string, string> = {};
        resp.headers.forEach((v, k) => {
          respHeaders[k] = v;
        });
        throw new RestError(resp.status, errBody, url, method, respHeaders);
      }

      if (resp.status === 204) {
        return {} as T;
      }

      const text = await resp.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    }
  }

  /**
   * Build the per-attempt `AbortSignal` fed to fetch: the caller's abortSignal
   * (TRUE in-flight cancellation) combined with a per-attempt timeout. A fresh
   * timeout is created for each attempt so the wall-clock budget is per attempt,
   * matching the contract. When neither applies, returns undefined.
   */
  private _attemptSignal(opts: _EffectiveOptions): AbortSignal | undefined {
    const timeoutSignal = opts.timeout > 0 ? AbortSignal.timeout(opts.timeout * 1000) : undefined;
    if (opts.abortSignal && timeoutSignal) {
      return AbortSignal.any([opts.abortSignal, timeoutSignal]);
    }
    return opts.abortSignal ?? timeoutSignal;
  }

  /** Whether an error is an AbortError (fetch abort or timeout). */
  private _isAbort(err: unknown): boolean {
    return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
  }

  /**
   * Perform an authenticated HTTP GET and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @param params - Optional query parameters; `undefined` values are skipped.
   * @param requestOptions - Optional per-request transport envelope override.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async get<T = unknown>(
    path: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<T> {
    return this._request<T>('GET', path, undefined, params, requestOptions);
  }

  /**
   * Perform an authenticated HTTP POST and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @param body - JSON-serialisable request body. Omit to send no body.
   * @param params - Optional query parameters appended to the URL.
   * @param requestOptions - Optional per-request transport envelope override.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<T> {
    return this._request<T>('POST', path, body, params, requestOptions);
  }

  /**
   * Perform an authenticated HTTP PUT and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @param body - JSON-serialisable request body.
   * @param requestOptions - Optional per-request transport envelope override.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    requestOptions?: RequestOptionsInit,
  ): Promise<T> {
    return this._request<T>('PUT', path, body, undefined, requestOptions);
  }

  /**
   * Perform an authenticated HTTP PATCH and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @param body - JSON-serialisable partial request body.
   * @param requestOptions - Optional per-request transport envelope override.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async patch<T = unknown>(
    path: string,
    body?: unknown,
    requestOptions?: RequestOptionsInit,
  ): Promise<T> {
    return this._request<T>('PATCH', path, body, undefined, requestOptions);
  }

  /**
   * Perform an authenticated HTTP DELETE and return the parsed JSON response.
   *
   * @typeParam T - Expected response body type.
   * @param path - Absolute URL or path relative to {@link HttpClient.baseUrl}.
   * @param requestOptions - Optional per-request transport envelope override.
   * @returns The parsed JSON body, or `{}` on `204 No Content`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete<T = unknown>(path: string, requestOptions?: RequestOptionsInit): Promise<T> {
    return this._request<T>('DELETE', path, undefined, undefined, requestOptions);
  }
}
