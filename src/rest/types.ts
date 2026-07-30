/**
 * Types for the REST client module.
 */

import type { RequestOptionsInit } from './RequestOptions.js';

/** Options for constructing a RestClient. */
export interface ClientOptions {
  /** SignalWire project ID. Falls back to SIGNALWIRE_PROJECT_ID env var. */
  project?: string;
  /** SignalWire API token. Falls back to SIGNALWIRE_API_TOKEN env var. */
  token?: string;
  /** SignalWire space host (e.g. "example.signalwire.com"). Falls back to SIGNALWIRE_SPACE env var. */
  host?: string;
  /** Custom fetch implementation for testing. */
  fetchImpl?: typeof globalThis.fetch;
  /**
   * Client-default transport envelope (timeout / retries / abort) applied to
   * every request; a per-request `requestOptions` shallow-overrides it. See
   * {@link RequestOptions}.
   */
  requestOptions?: RequestOptionsInit;
}

/** Options for constructing an HttpClient. */
export interface HttpClientOptions {
  /**
   * Base URL (e.g. "https://example.signalwire.com").
   * Either `baseUrl` or `host` must be provided. If both are given, `host` takes precedence
   * — `host` is the canonical parameter.
   */
  baseUrl?: string;
  /**
   * Bare hostname (e.g. "example.signalwire.com"). `https://` is prepended automatically.
   */
  host?: string;
  /** Project ID for Basic Auth username. */
  project: string;
  /** API token for Basic Auth password. */
  token: string;
  /** Custom fetch implementation for testing. */
  fetchImpl?: typeof globalThis.fetch;
  /**
   * Client-default transport envelope (timeout / retries / abort) applied to
   * every request; a per-request `requestOptions` shallow-overrides it. See
   * {@link RequestOptions}.
   */
  requestOptions?: RequestOptionsInit;
}

/** Standard paginated response with links-based navigation (relay REST). */
export interface PaginatedResponse<T> {
  data: T[];
  links?: {
    first?: string;
    self?: string;
    next?: string;
    last?: string;
  };
}

/**
 * LAML-style paginated response with next_page_uri. The resource array is
 * carried under a resource-named key (e.g. `calls`, `messages`), so the index
 * signature is open; callers read the known key. Values are `unknown` (the
 * caller narrows) rather than `any`.
 */
export interface LamlPaginatedResponse<_T = unknown> {
  [key: string]: unknown;
  next_page_uri?: string | null;
  uri?: string;
  page?: number;
  page_size?: number;
}

/** Query parameters for list operations. */
export type QueryParams = Record<string, string | number | boolean | undefined>;
