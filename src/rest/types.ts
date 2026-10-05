/**
 * Types for the REST client module.
 */

import type { RequestOptionsInit } from './RequestOptions.js';

/** A custom `fetch` implementation (primarily for tests / audit harnesses). */
export interface FetchOption {
  /** Custom fetch implementation. */
  fetchImpl?: typeof globalThis.fetch;
}

/**
 * Explicit RestClient credentials — all three are required.
 *
 * This is the compile-time-safe shape for the explicit-object constructor path:
 * passing `{ project, token }` (forgot `host`) is a TYPE error, not a runtime
 * throw. To read credentials from the `SIGNALWIRE_*` environment instead, call
 * `new RestClient()` (or pass only `{ fetchImpl }`) — see the constructor
 * overloads on {@link RestClient}.
 */
export interface ClientCredentials {
  /** SignalWire project ID. */
  project: string;
  /** SignalWire API token. */
  token: string;
  /** SignalWire space host (e.g. "example.signalwire.com"). */
  host: string;
}

/**
 * Options for constructing a RestClient (loose form).
 *
 * Every credential is optional here because each falls back to an env var
 * (`SIGNALWIRE_PROJECT_ID` / `SIGNALWIRE_API_TOKEN` / `SIGNALWIRE_SPACE`). The
 * public {@link RestClient} constructor narrows this via overloads so a partial
 * credential object is rejected at compile time; this interface remains the
 * implementation-signature / back-compat shape (e.g. the `restClient()` legacy
 * call form).
 */
export interface ClientOptions extends FetchOption {
  /** SignalWire project ID. Falls back to SIGNALWIRE_PROJECT_ID env var. */
  project?: string;
  /** SignalWire API token. Falls back to SIGNALWIRE_API_TOKEN env var. */
  token?: string;
  /** SignalWire space host (e.g. "example.signalwire.com"). Falls back to SIGNALWIRE_SPACE env var. */
  host?: string;
  /**
   * Client-default transport envelope (timeout / retries / abort) applied to
   * every request; a per-request `requestOptions` shallow-overrides it. See
   * {@link RequestOptions}.
   */
  requestOptions?: RequestOptionsInit;
}

/**
 * Every RestClient option that is not a credential — the custom `fetch` and the
 * client-default transport envelope.
 *
 * Derived from {@link ClientOptions} rather than spelled out, so a new
 * non-credential option added there is automatically accepted by both
 * constructor overloads instead of silently becoming a type error on the
 * explicit-credentials path.
 */
export type ClientTransportOptions = Omit<ClientOptions, 'project' | 'token' | 'host'>;

/** Options for constructing an HttpClient. */
export interface HttpClientOptions {
  /**
   * Base URL (e.g. "https://example.signalwire.com").
   * Either `baseUrl` or `host` must be provided. If both are given, `host` takes precedence
   * (matching the Python SDK convention where `host` is the canonical parameter).
   */
  baseUrl?: string;
  /**
   * Bare hostname (e.g. "example.signalwire.com"). `https://` is prepended automatically,
   * matching the Python SDK's `HttpClient(project, token, host)` convention.
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
