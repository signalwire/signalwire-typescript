/**
 * Custom error class for REST API errors.
 *
 * `body` may be a parsed JSON object (when the server returned valid JSON)
 * or a plain string (when JSON parsing failed), matching the Python SDK's
 * `SignalWireRestError` behavior.
 */
export class RestError extends Error {
  /** HTTP status code returned by the server (e.g. `404`, `500`). */
  readonly statusCode: number;
  /**
   * Parsed response body. An object when the server returned valid JSON,
   * otherwise the raw response text as a string.
   */
  readonly body: string | Record<string, unknown>;
  /** Fully-qualified URL that produced the error. */
  readonly url: string;
  /** HTTP method that produced the error (`GET`, `POST`, etc.). */
  readonly method: string;

  /**
   * @param statusCode - HTTP status code returned by the server.
   * @param body - Response body — an object if JSON-parseable, otherwise the
   *   raw response text.
   * @param url - Fully-qualified URL that produced the error.
   * @param method - HTTP method that produced the error. Defaults to `"GET"`.
   */
  constructor(
    statusCode: number,
    body: string | Record<string, unknown>,
    url: string,
    method: string = 'GET',
  ) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    super(`${method} ${url} returned ${statusCode}: ${bodyStr}`);
    this.name = 'RestError';
    this.statusCode = statusCode;
    this.body = body;
    this.url = url;
    this.method = method;
  }
}

/** Alias matching the Python SDK class name. */
export { RestError as SignalWireRestError };
