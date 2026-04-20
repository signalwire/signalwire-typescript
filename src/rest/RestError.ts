/**
 * Custom error class for REST API errors.
 *
 * `body` may be a parsed JSON object (when the server returned valid JSON)
 * or a plain string (when JSON parsing failed), matching the Python SDK's
 * `SignalWireRestError` behavior.
 */
export class RestError extends Error {
  readonly statusCode: number;
  readonly body: string | Record<string, unknown>;
  readonly url: string;
  readonly method: string;

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
