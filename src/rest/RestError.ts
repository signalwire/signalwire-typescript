import type { Types_StatusCodes_StatusCode422 } from './namespaces/voice.types.generated.js';
import type { Types_StatusCodes_ValidationError } from './namespaces/relay-rest.types.generated.js';

/**
 * A non-2xx response body: the raw text when it is not JSON, otherwise the parsed
 * JSON value. The REST specs declare three error shapes — `{error: '<reason
 * phrase>'}` (400/401/403/404/500), `{errors: RestApiErrorItem[]}` (422), and
 * relay-rest's `{errors: SpaceApiErrorItem[]}` — but the body is not validated
 * against them, so any other JSON value the server sends is kept as-is.
 */
type RestErrorBody =
  | string
  | Types_StatusCodes_StatusCode422
  | Types_StatusCodes_ValidationError
  | { error: string }
  | { [key: string]: unknown }
  | unknown[]
  | number
  | boolean
  | null;

/**
 * Header names SignalWire (and common proxies) use for the platform request id,
 * in preference order. Matched case-insensitively.
 */
const REQUEST_ID_HEADERS = [
  'x-request-id',
  'x-signalwire-request-id',
  'request-id',
  'x-amzn-requestid',
] as const;

/**
 * Extract the platform request id from a response header map (case-insensitive,
 * first match wins in {@link REQUEST_ID_HEADERS} order). Returns `null` when no
 * request-id header is present or no headers were captured (transport failure).
 */
function extractRequestId(headers: Record<string, string> | null): string | null {
  if (!headers) return null;
  const lowered: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lowered[k.toLowerCase()] = v;
  }
  for (const name of REQUEST_ID_HEADERS) {
    if (name in lowered) return lowered[name] ?? null;
  }
  return null;
}

/**
 * Custom error class for REST API errors.
 *
 * `body` is the parsed JSON value (when the server returned valid JSON)
 * or a plain string (when JSON parsing failed).
 */
export class RestError extends Error {
  /**
   * HTTP status code returned by the server (e.g. `404`, `500`).
   *
   * `null` for a TRANSPORT failure — a {@link RestTransportError} — where the
   * request never reached a response (connection refused, DNS failure,
   * connection reset, TLS error), so there is no HTTP status to report.
   * Callers catch this one family (`instanceof RestError`) for every REST
   * failure, HTTP or transport.
   */
  readonly statusCode: number | null;
  /**
   * Parsed response body: the parsed JSON value when the server returned JSON
   * (normally one of the REST specs' `{errors: [...]}` envelopes), otherwise the
   * raw response text as a string. For a transport failure it is
   * the underlying transport error message.
   */
  readonly body: RestErrorBody;
  /** Fully-qualified URL that produced the error. */
  readonly url: string;
  /** HTTP method that produced the error (`GET`, `POST`, etc.). */
  readonly method: string;
  /**
   * Response header map captured from the failed HTTP response, or `null` for a
   * transport failure that produced no response. Client-side observability with
   * no wire-contract change.
   */
  readonly headers: Record<string, string> | null;
  /**
   * The platform request id pulled from {@link headers} (`x-request-id` /
   * `x-signalwire-request-id` / `request-id` / `x-amzn-requestid`, case-insensitive,
   * in that precedence), or `null` if absent. Log/correlate a failure against
   * SignalWire's own request id.
   */
  readonly requestId: string | null;

  /**
   * @param statusCode - HTTP status code returned by the server, or `null` for
   *   a transport-level failure that never reached a response.
   * @param body - Response body — the parsed JSON value if the server returned
   *   JSON, otherwise the raw response text.
   * @param url - Fully-qualified URL that produced the error.
   * @param method - HTTP method that produced the error. Defaults to `"GET"`.
   * @param headers - Response header map (for request-id extraction), or `null`
   *   for a transport failure that produced no response.
   */
  constructor(
    statusCode: number | null,
    body: RestErrorBody,
    url: string,
    method: string = 'GET',
    headers: Record<string, string> | null = null,
  ) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const reason =
      statusCode === null
        ? `failed to reach the server: ${bodyStr}`
        : `returned ${statusCode}: ${bodyStr}`;
    const requestId = extractRequestId(headers);
    const suffix = requestId ? ` (request-id: ${requestId})` : '';
    super(`${method} ${url} ${reason}${suffix}`);
    this.name = 'RestError';
    this.statusCode = statusCode;
    this.body = body;
    this.url = url;
    this.method = method;
    this.headers = headers;
    this.requestId = requestId;
  }
}

/**
 * Raised when a REST request never reached a response — a transport-level
 * failure (connection refused, DNS failure, connection reset, TLS error).
 *
 * A member of the {@link RestError} family (`statusCode` is `null`, `body` is
 * the underlying transport error message) so a caller catching `RestError`
 * (aka `SignalWireRestError`) handles both HTTP-error and transport-error
 * responses with one `catch`, instead of a bare `fetch` `TypeError` leaking
 * through. `headers` and `requestId` are `null` — no response was produced.
 */
export class RestTransportError extends RestError {
  /**
   * @param body - The underlying transport error message.
   * @param url - Fully-qualified URL that produced the error.
   * @param method - HTTP method that produced the error. Defaults to `"GET"`.
   */
  constructor(body: string, url: string, method: string = 'GET') {
    super(null, body, url, method);
    this.name = 'RestTransportError';
  }
}

/** Alias under the fully-qualified SignalWire class name. */
export { RestError as SignalWireRestError };
/** Alias under the fully-qualified SignalWire class name. */
export { RestTransportError as SignalWireRestTransportError };
