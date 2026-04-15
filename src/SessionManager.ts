/**
 * SessionManager - Stateless HMAC-SHA256 token generation and validation.
 *
 * Tokens encode call_id, function name, expiry and a nonce, signed with a
 * shared secret. No server-side state is stored.
 */

import { randomBytes, createHmac } from 'node:crypto';
import { getLogger } from './Logger.js';

/** Decoded token debug info matching the Python SDK's nested return structure. */
export interface DebugTokenResult {
  valid_format: boolean;
  components?: {
    call_id: string;
    function: string;
    expiry: string;
    expiry_date: string | null;
    nonce: string;
    signature: string;
  };
  status?: {
    current_time: number;
    is_expired: boolean | null;
    expires_in_seconds: number | null;
  };
  parts_count?: number;
  token_length?: number;
  error?: string;
}

/** Stateless HMAC-SHA256 token manager for SWAIG function call authentication and per-session metadata storage. */
export class SessionManager {
  /** Token validity duration in seconds. */
  tokenExpirySecs: number;
  /** HMAC signing secret. */
  secretKey: string;
  /**
   * When true, {@link debugToken} decodes token internals.
   * When false (default), it returns `{ error: "debug mode not enabled" }`.
   */
  debugMode = false;
  private sessionMetadata: Map<string, Record<string, unknown>> = new Map();
  private sessionTimestamps: Map<string, number> = new Map();
  private log = getLogger('SessionManager');

  /**
   * Create a new SessionManager.
   * @param tokenExpirySecs - Token validity duration in seconds (default 900).
   * @param secretKey - HMAC signing secret; a random key is generated if omitted.
   */
  constructor(tokenExpirySecs = 900, secretKey?: string) {
    this.tokenExpirySecs = tokenExpirySecs;
    this.secretKey = secretKey ?? randomBytes(32).toString('hex');
  }

  /**
   * Return the given callId or generate a new random session identifier.
   * @param callId - Existing call ID to reuse.
   * @returns The call ID string.
   */
  createSession(callId?: string): string {
    if (callId) return callId;
    return randomBytes(16).toString('base64url');
  }

  /**
   * Generate a signed, base64url-encoded token binding a function name to a call ID.
   * @param functionName - The SWAIG function name to bind.
   * @param callId - The call ID to bind.
   * @returns A base64url-encoded token string.
   */
  generateToken(functionName: string, callId: string): string {
    const expiry = Math.floor(Date.now() / 1000) + this.tokenExpirySecs;
    const nonce = randomBytes(16).toString('hex');
    const message = `${callId}:${functionName}:${expiry}:${nonce}`;
    const signature = createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex');
    const token = `${callId}.${functionName}.${expiry}.${nonce}.${signature}`;
    const encoded = Buffer.from(token).toString('base64url');
    this.log.debug('created_token', { function: functionName, call_id: callId });
    return encoded;
  }

  /**
   * Alias for {@link generateToken}.
   * @param functionName - The SWAIG function name to bind.
   * @param callId - The call ID to bind.
   * @returns A base64url-encoded token string.
   */
  createToolToken(functionName: string, callId: string): string {
    return this.generateToken(functionName, callId);
  }

  /**
   * Validate a token against the expected call ID and function name.
   * @param callId - The expected call ID.
   * @param functionName - The expected function name.
   * @param token - The base64url-encoded token to validate.
   * @returns True if the token is valid and not expired.
   */
  validateToken(callId: string, functionName: string, token: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const parts = decoded.split('.');
      if (parts.length !== 5) {
        this.log.warn('token_invalid', { function: functionName });
        return false;
      }
      const [tokenCallId, tokenFunction, tokenExpiry, tokenNonce, tokenSignature] = parts;

      if (!callId) {
        this.log.warn('token_rejected_no_call_id', { function: functionName });
        return false;
      }
      if (tokenFunction !== functionName) {
        this.log.warn('token_function_mismatch', { expected: functionName, got: tokenFunction });
        return false;
      }

      const expiry = parseInt(tokenExpiry, 10);
      if (expiry <= Math.floor(Date.now() / 1000)) {
        this.log.warn('token_expired', { function: functionName });
        return false;
      }

      const message = `${tokenCallId}:${tokenFunction}:${tokenExpiry}:${tokenNonce}`;
      const expectedSig = createHmac('sha256', this.secretKey)
        .update(message)
        .digest('hex');
      if (tokenSignature !== expectedSig) {
        this.log.warn('token_invalid', { function: functionName });
        return false;
      }
      if (tokenCallId !== callId) {
        this.log.warn('token_call_id_mismatch', { expected: callId, got: tokenCallId });
        return false;
      }

      this.log.debug('token_valid', { function: functionName });
      return true;
    } catch {
      this.log.warn('token_invalid', { function: functionName });
      return false;
    }
  }

  /**
   * Alias for {@link validateToken} with reordered parameters.
   * @param functionName - The expected function name.
   * @param token - The base64url-encoded token to validate.
   * @param callId - The expected call ID.
   * @returns True if the token is valid and not expired.
   */
  validateToolToken(functionName: string, token: string, callId: string): boolean {
    return this.validateToken(callId, functionName, token);
  }

  /**
   * Debug a token without validating it.
   *
   * Requires {@link debugMode} to be `true`. When disabled, returns
   * `{ error: "debug mode not enabled" }` matching the Python SDK behaviour.
   *
   * @param token - The base64url-encoded token to decode.
   * @returns A nested debug structure matching the Python SDK, or an error object.
   */
  debugToken(token: string): DebugTokenResult {
    if (!this.debugMode) {
      return { valid_format: false, error: 'debug mode not enabled' };
    }
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const parts = decoded.split('.');
      if (parts.length !== 5) {
        return {
          valid_format: false,
          parts_count: parts.length,
          token_length: token ? token.length : 0,
        };
      }
      const [tokenCallId, tokenFunction, tokenExpiry, tokenNonce, tokenSignature] = parts;

      const currentTime = Math.floor(Date.now() / 1000);
      let expiry: number | null = null;
      let isExpired: boolean | null = null;
      let expiresIn: number | null = null;
      let expiryDate: string | null = null;
      const parsed = parseInt(tokenExpiry, 10);
      if (!Number.isNaN(parsed)) {
        expiry = parsed;
        isExpired = expiry < currentTime;
        expiresIn = isExpired ? 0 : expiry - currentTime;
        expiryDate = new Date(expiry * 1000).toISOString();
      }

      return {
        valid_format: true,
        components: {
          call_id: tokenCallId.length > 8 ? tokenCallId.slice(0, 8) + '...' : tokenCallId,
          function: tokenFunction,
          expiry: tokenExpiry,
          expiry_date: expiryDate,
          nonce: tokenNonce,
          signature: tokenSignature.length > 8 ? tokenSignature.slice(0, 8) + '...' : tokenSignature,
        },
        status: {
          current_time: currentTime,
          is_expired: isExpired,
          expires_in_seconds: expiresIn,
        },
      };
    } catch (e: unknown) {
      return {
        valid_format: false,
        error: e instanceof Error ? e.message : String(e),
        token_length: token ? token.length : 0,
      };
    }
  }

  /**
   * Retrieve metadata associated with a session.
   *
   * Returns an empty object when no metadata has been stored for the session,
   * matching Python SDK behavior (`get_session_metadata` always returns `{}`).
   * Callers can safely check truthiness or iterate keys without a null guard.
   *
   * @param sessionId - The session identifier.
   * @returns The metadata record for the session, or `{}` if no metadata exists.
   */
  getSessionMetadata(sessionId: string): Record<string, unknown> {
    return this.sessionMetadata.get(sessionId) ?? {};
  }

  /**
   * Merge metadata into a session, creating the entry if it does not exist.
   *
   * Supports two call signatures for Python SDK compatibility:
   * - `setSessionMetadata(sessionId, metadata)` — bulk merge (TS-native)
   * - `setSessionMetadata(sessionId, key, value)` — single key/value (Python-compatible)
   *
   * @param sessionId - The session identifier.
   * @param metadataOrKey - A metadata record to merge, or a string key when called with three arguments.
   * @param value - The value to set when called with a string key.
   */
  setSessionMetadata(sessionId: string, metadataOrKey: Record<string, unknown>): void;
  setSessionMetadata(sessionId: string, key: string, value: unknown): boolean;
  setSessionMetadata(sessionId: string, metadataOrKey: Record<string, unknown> | string, value?: unknown): void | boolean {
    if (typeof metadataOrKey === 'string') {
      // Python-compatible single key/value overload — returns bool for parity
      this.sessionMetadata.set(sessionId, { ...this.sessionMetadata.get(sessionId), [metadataOrKey]: value });
      this.sessionTimestamps.set(sessionId, Date.now());
      if (this.sessionMetadata.size > 1000) {
        this.cleanup();
      }
      return true;
    }
    this.sessionMetadata.set(sessionId, { ...this.sessionMetadata.get(sessionId), ...metadataOrKey });
    this.sessionTimestamps.set(sessionId, Date.now());
    // Auto-cleanup when map grows too large
    if (this.sessionMetadata.size > 1000) {
      this.cleanup();
    }
  }

  /**
   * Remove session metadata entries older than `maxAgeMs`.
   * @param maxAgeMs - Maximum age in milliseconds (defaults to `tokenExpirySecs * 1000`).
   */
  cleanup(maxAgeMs?: number): void {
    const maxAge = maxAgeMs ?? this.tokenExpirySecs * 1000;
    const cutoff = Date.now() - maxAge;
    for (const [id, ts] of this.sessionTimestamps) {
      if (ts <= cutoff) {
        this.sessionMetadata.delete(id);
        this.sessionTimestamps.delete(id);
      }
    }
  }

  /**
   * Legacy method retained for API compatibility with the Python SDK.
   * Does nothing and returns `true`.
   * @param _callId - The call/session identifier (unused).
   * @returns Always `true`.
   */
  activateSession(_callId: string): boolean {
    return true;
  }

  /**
   * Legacy method retained for API compatibility with the Python SDK.
   * Does nothing and returns `true`.
   * @param _callId - The call/session identifier (unused).
   * @returns Always `true`.
   */
  endSession(_callId: string): boolean {
    return true;
  }

  /**
   * Delete all metadata for a session.
   * @param sessionId - The session identifier.
   * @returns True if the session existed and was deleted.
   */
  deleteSessionMetadata(sessionId: string): boolean {
    return this.sessionMetadata.delete(sessionId);
  }
}
