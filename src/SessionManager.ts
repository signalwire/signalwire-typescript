/**
 * SessionManager - Stateless HMAC-SHA256 token generation and validation.
 *
 * Tokens encode call_id, function name, expiry and a nonce, signed with a
 * shared secret. No server-side state is stored.
 */

import { randomBytes, createHmac } from 'node:crypto';

export class SessionManager {
  tokenExpirySecs: number;
  private secretKey: string;

  constructor(tokenExpirySecs = 3600, secretKey?: string) {
    this.tokenExpirySecs = tokenExpirySecs;
    this.secretKey = secretKey ?? randomBytes(32).toString('hex');
  }

  createSession(callId?: string): string {
    if (callId) return callId;
    return randomBytes(16).toString('base64url');
  }

  generateToken(functionName: string, callId: string): string {
    const expiry = Math.floor(Date.now() / 1000) + this.tokenExpirySecs;
    const nonce = randomBytes(4).toString('hex');
    const message = `${callId}:${functionName}:${expiry}:${nonce}`;
    const signature = createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex')
      .slice(0, 16);
    const token = `${callId}.${functionName}.${expiry}.${nonce}.${signature}`;
    return Buffer.from(token).toString('base64url');
  }

  /** Alias for generateToken */
  createToolToken(functionName: string, callId: string): string {
    return this.generateToken(functionName, callId);
  }

  validateToken(callId: string, functionName: string, token: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const parts = decoded.split('.');
      if (parts.length !== 5) return false;
      const [tokenCallId, tokenFunction, tokenExpiry, tokenNonce, tokenSignature] = parts;

      const effectiveCallId = callId || tokenCallId;
      if (tokenFunction !== functionName) return false;

      const expiry = parseInt(tokenExpiry, 10);
      if (expiry < Date.now() / 1000) return false;

      const message = `${tokenCallId}:${tokenFunction}:${tokenExpiry}:${tokenNonce}`;
      const expectedSig = createHmac('sha256', this.secretKey)
        .update(message)
        .digest('hex')
        .slice(0, 16);
      if (tokenSignature !== expectedSig) return false;
      if (tokenCallId !== effectiveCallId) return false;

      return true;
    } catch {
      return false;
    }
  }

  /** Alias for validateToken with reordered params */
  validateToolToken(functionName: string, token: string, callId: string): boolean {
    return this.validateToken(callId, functionName, token);
  }
}
