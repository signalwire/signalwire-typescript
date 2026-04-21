/**
 * HttpClient — fetch-based HTTP with Basic Auth.
 *
 * All methods return parsed JSON. Throws RestError on non-2xx responses.
 * Returns {} on 204 No Content.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getLogger } from '../Logger.js';
import { RestError } from './RestError.js';
import type { HttpClientOptions, QueryParams } from './types.js';

const logger = getLogger('rest_client');

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

  constructor(options: HttpClientOptions) {
    if (!options.host && !options.baseUrl) {
      throw new Error('HttpClientOptions requires either "host" or "baseUrl".');
    }

    // host takes precedence (matches Python's HttpClient(project, token, host) convention
    // where a bare hostname is expected and https:// is prepended automatically).
    const rawUrl = options.host ? `https://${options.host}` : options.baseUrl!;
    this.baseUrl = rawUrl.replace(/\/+$/, '');

    this._authHeader = 'Basic ' + Buffer.from(`${options.project}:${options.token}`).toString('base64');
    this._fetch = options.fetchImpl ?? globalThis.fetch;
  }

  private async _request<T = any>(method: string, path: string, body?: any, params?: QueryParams): Promise<T> {
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
      'Authorization': this._authHeader,
      'Accept': 'application/json',
      'User-Agent': '@signalwire/sdk-ts/2.0.0',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const resp = await this._fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text();
      let errBody: string | Record<string, unknown> = text;
      try {
        errBody = JSON.parse(text) as Record<string, unknown>;
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

  /** Perform an authenticated HTTP GET and return the parsed JSON response. */
  async get<T = any>(path: string, params?: QueryParams): Promise<T> {
    return this._request<T>('GET', path, undefined, params);
  }

  /** Perform an authenticated HTTP POST and return the parsed JSON response. */
  async post<T = any>(path: string, body?: any, params?: QueryParams): Promise<T> {
    return this._request<T>('POST', path, body, params);
  }

  /** Perform an authenticated HTTP PUT and return the parsed JSON response. */
  async put<T = any>(path: string, body?: any): Promise<T> {
    return this._request<T>('PUT', path, body);
  }

  /** Perform an authenticated HTTP PATCH and return the parsed JSON response. */
  async patch<T = any>(path: string, body?: any): Promise<T> {
    return this._request<T>('PATCH', path, body);
  }

  /** Perform an authenticated HTTP DELETE and return the parsed JSON response. */
  async delete<T = any>(path: string): Promise<T> {
    return this._request<T>('DELETE', path);
  }
}
