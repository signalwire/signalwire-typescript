import type { SignalWireErrorBody } from '../PlatformContracts.js';

/**
 * Custom error class for REST API errors.
 *
 * `body` may be a parsed JSON object (when the server returned valid JSON)
 * or a plain string (when JSON parsing failed), matching the Python SDK's
 * `SignalWireRestError` behavior.
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
   * Parsed response body. An object when the server returned valid JSON,
   * otherwise the raw response text as a string. For a transport failure it is
   * the underlying transport error message.
   */
  readonly body: string | SignalWireErrorBody;
  /** Fully-qualified URL that produced the error. */
  readonly url: string;
  /** HTTP method that produced the error (`GET`, `POST`, etc.). */
  readonly method: string;

  /**
   * @param statusCode - HTTP status code returned by the server, or `null` for
   *   a transport-level failure that never reached a response.
   * @param body - Response body — an object if JSON-parseable, otherwise the
   *   raw response text.
   * @param url - Fully-qualified URL that produced the error.
   * @param method - HTTP method that produced the error. Defaults to `"GET"`.
   */
  constructor(
    statusCode: number | null,
    body: string | SignalWireErrorBody,
    url: string,
    method: string = 'GET',
  ) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const reason =
      statusCode === null
        ? `failed to reach the server: ${bodyStr}`
        : `returned ${statusCode}: ${bodyStr}`;
    super(`${method} ${url} ${reason}`);
    this.name = 'RestError';
    this.statusCode = statusCode;
    this.body = body;
    this.url = url;
    this.method = method;
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
 * through.
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

/** Alias matching the Python SDK class name. */
export { RestError as SignalWireRestError };
/** Alias matching the Python SDK class name. */
export { RestTransportError as SignalWireRestTransportError };
