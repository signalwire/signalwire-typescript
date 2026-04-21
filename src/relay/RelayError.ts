/**
 * Custom error class for RELAY protocol errors.
 *
 * Mirrors the Python SDK signature: `RelayError(code, message)`.
 */
export class RelayError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(`RELAY error ${code}: ${message}`);
    this.name = 'RelayError';
    this.code = code;
  }
}
