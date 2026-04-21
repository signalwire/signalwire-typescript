/**
 * Custom error class for RELAY protocol errors.
 *
 * Thrown when the server returns a non-2xx JSON-RPC result code. Mirrors the
 * Python SDK signature: `RelayError(code, message)`.
 */
export class RelayError extends Error {
  /** Numeric RELAY result code returned by the server. */
  readonly code: number;

  /**
   * @param code - Numeric RELAY result code (e.g. `404`, `503`).
   * @param message - Human-readable error message from the server.
   */
  constructor(code: number, message: string) {
    super(`RELAY error ${code}: ${message}`);
    this.name = 'RelayError';
    this.code = code;
  }
}
