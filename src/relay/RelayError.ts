/**
 * Custom error class for RELAY protocol errors.
 */
export class RelayError extends Error {
  readonly code: number;

  constructor(message: string, code = 0) {
    super(message);
    this.name = 'RelayError';
    this.code = code;
  }
}
