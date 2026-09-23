/**
 * RequestOptions — the REST request-options envelope (plan 4.2).
 *
 * A single value object controlling per-request transport behavior: timeout,
 * retries (with an idempotency-aware retry policy + exponential backoff), and
 * cooperative cancellation. Supplied at two levels:
 *
 * - **Client default**: `new RestClient({ ..., requestOptions })` stored on the
 *   {@link HttpClient} and applied to every request.
 * - **Per-request override**: each verb accepts an optional `requestOptions`
 *   that *shallow-overrides* the client default for that one call — an unset
 *   (`undefined`) field falls back to the client default, then the built-in
 *   default.
 *
 * The timeout + retry semantics are a wire-observable contract (the server sees
 * N attempts and honors the backoff ordering). For `abortSignal` the primitive
 * is the native {@link AbortSignal}, which is passed straight to `fetch`, so
 * cancellation is TRUE in-flight abort (an in-progress request is interrupted),
 * not merely a between-attempt check. It is *also* checked before each attempt
 * so an already-aborted signal raises before the send.
 */

/**
 * Plain-object initializer for {@link RequestOptions}. All fields optional;
 * `undefined` = inherit (fall back to the client default, then the built-in).
 * Every REST verb accepts this directly, so a call site passes an object
 * literal — `client.get(path, params, { retries: 1 })` — without constructing a
 * class instance.
 */
export interface RequestOptionsInit {
  /**
   * Max wall-clock seconds per attempt; on exceed the request raises the
   * transport-error type ({@link RestTransportError}). Built-in default `30.0`.
   */
  timeout?: number;
  /**
   * Number of RETRY attempts (total attempts = `retries + 1`) on a retryable
   * failure. Built-in default `0` (opt-in resilience — the no-retry behavior
   * stays the default; a caller opts into retries).
   */
  retries?: number;
  /**
   * HTTP statuses that trigger a retry for an idempotent method. Built-in
   * `{429, 500, 502, 503, 504}`.
   */
  retryOnStatus?: ReadonlySet<number>;
  /**
   * Base seconds for exponential backoff between retries
   * (`backoff * 2 ** (attempt - 1)`), honoring `Retry-After` when present.
   * Built-in `0.5`.
   */
  retryBackoff?: number;
  /**
   * Native cancellation primitive; passed straight to `fetch` for TRUE
   * in-flight abort, and also checked before each attempt. Built-in none.
   */
  abortSignal?: AbortSignal;
}

// The built-in defaults (the contract floor). `undefined` on a RequestOptions
// field means "inherit"; these are what an unset field resolves to at apply-time.

/**
 * Built-in {@link RequestOptionsInit.timeout}: wall-clock seconds allowed per
 * attempt before the request raises the transport-error type. Applies when
 * neither the per-request options nor the client default set `timeout`.
 */
export const DEFAULT_TIMEOUT = 30.0;

/**
 * Built-in {@link RequestOptionsInit.retries}: **zero**. Retries are opt-in —
 * out of the box a request is attempted exactly once and the first non-2xx
 * raises, which is the pinned REST contract. Raising this is a caller decision,
 * not a default.
 */
export const DEFAULT_RETRIES = 0;

/**
 * Built-in {@link RequestOptionsInit.retryOnStatus}: `{429, 500, 502, 503, 504}`
 * — throttling plus the transient server/gateway failures. Note this set alone
 * does not decide a retry: {@link statusIsRetryable} additionally restricts
 * non-idempotent methods (POST/PATCH) to 429 and 503, so a POST is never
 * replayed on a 500/502/504 whose side effect may have partially applied.
 */
export const DEFAULT_RETRY_ON_STATUS: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

/**
 * Built-in {@link RequestOptionsInit.retryBackoff}: base seconds for the
 * exponential wait between retries (`backoff * 2 ** (attempt - 1)`, so
 * 0.5s, 1s, 2s…). A `Retry-After` response header takes precedence when
 * present.
 */
export const DEFAULT_RETRY_BACKOFF = 0.5;

/**
 * Per-request transport options value object: all fields optional
 * (`undefined` = inherit), plus a {@link merge} method for the
 * per-request-over-client-default shallow
 * merge. A call site may pass either an instance or a plain
 * {@link RequestOptionsInit} object literal — every verb normalizes both.
 */
export class RequestOptions {
  readonly timeout?: number;
  readonly retries?: number;
  readonly retryOnStatus?: ReadonlySet<number>;
  readonly retryBackoff?: number;
  readonly abortSignal?: AbortSignal;

  constructor(init: RequestOptionsInit = {}) {
    this.timeout = init.timeout;
    this.retries = init.retries;
    this.retryOnStatus = init.retryOnStatus;
    this.retryBackoff = init.retryBackoff;
    this.abortSignal = init.abortSignal;
  }

  /**
   * Return a new RequestOptions with any set (non-`undefined`) field of
   * `override` applied over this one. The per-request-over-client-default
   * shallow merge: an unset field on `override` leaves this value intact.
   */
  merge(override: RequestOptionsInit | undefined): RequestOptions {
    if (!override) return this;
    return new RequestOptions({
      timeout: override.timeout ?? this.timeout,
      retries: override.retries ?? this.retries,
      retryOnStatus: override.retryOnStatus ?? this.retryOnStatus,
      retryBackoff: override.retryBackoff ?? this.retryBackoff,
      abortSignal: override.abortSignal ?? this.abortSignal,
    });
  }
}

/** A RequestOptions with every field resolved to a concrete value. */
export interface _EffectiveOptions {
  timeout: number;
  retries: number;
  retryOnStatus: ReadonlySet<number>;
  retryBackoff: number;
  abortSignal?: AbortSignal;
}

/**
 * Resolve the effective options: per-request over client-default over built-in.
 *
 * `undefined` on any field inherits the next level down; the built-in defaults
 * are the floor. The result has every field concrete.
 */
export function resolve(
  clientDefault: RequestOptionsInit | undefined,
  perRequest: RequestOptionsInit | undefined,
): _EffectiveOptions {
  const base = new RequestOptions(clientDefault ?? {});
  const m = base.merge(perRequest);
  return {
    timeout: m.timeout ?? DEFAULT_TIMEOUT,
    retries: m.retries ?? DEFAULT_RETRIES,
    retryOnStatus: m.retryOnStatus ?? DEFAULT_RETRY_ON_STATUS,
    retryBackoff: m.retryBackoff ?? DEFAULT_RETRY_BACKOFF,
    abortSignal: m.abortSignal,
  };
}

// Methods with no server-side side effect — safe to retry on any retryable
// status. POST/PATCH are excluded: they may create/mutate, so they retry ONLY
// on a transport error or 429/503 (throttles that carry Retry-After and mean
// "the request was NOT processed"), never blindly on 500/502/504, to avoid
// duplicate side effects. This asymmetry is part of the pinned contract.
const IDEMPOTENT_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'PUT',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

/**
 * Whether an HTTP `status` for `method` should trigger a retry.
 *
 * Idempotent methods (GET/PUT/DELETE) retry on the full `retryOnStatus` set.
 * Non-idempotent methods (POST/PATCH) retry only on 429/503, never on
 * 500/502/504, to avoid replaying a side effect that may have partially applied.
 */
export function statusIsRetryable(
  method: string,
  status: number,
  opts: _EffectiveOptions,
): boolean {
  if (!opts.retryOnStatus.has(status)) return false;
  if (IDEMPOTENT_METHODS.has(method.toUpperCase())) return true;
  return status === 429 || status === 503;
}
