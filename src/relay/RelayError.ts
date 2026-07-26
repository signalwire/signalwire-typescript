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
   * The RAW server message, undecorated — the reference's public `self.message`
   * (`relay/client.py:1332`).
   *
   * Kept as its own property because JS `Error` owns `message` and `super(...)`
   * fills it with the DECORATED text (`"RELAY error {code}: {message}"`, the
   * reference's `super().__init__` on line 1333). A caller who wants the server's
   * own wording — to match on it, surface it in a UI, or forward it — reads this;
   * `message` gives the decorated form, matching Python's `str(exc)`.
   *
   * Same spelling and rationale as {@link AIChatError.serverMessage}. The surface
   * enumerator folds it onto the reference's `message` attribute.
   */
  readonly serverMessage: string;

  /**
   * @param code - Numeric RELAY result code (e.g. `404`, `503`).
   * @param message - Human-readable error message from the server.
   */
  constructor(code: number, message: string) {
    super(`RELAY error ${code}: ${message}`);
    this.name = 'RelayError';
    this.code = code;
    this.serverMessage = message;
  }
}
