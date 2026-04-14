import { describe, it, expect } from 'vitest';
import { SessionManager } from '../src/SessionManager.js';

describe('SessionManager', () => {
  it('createSession generates an ID when none provided', () => {
    const sm = new SessionManager();
    const id = sm.createSession();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('createSession returns provided ID', () => {
    const sm = new SessionManager();
    expect(sm.createSession('my-call')).toBe('my-call');
  });

  it('generateToken produces a base64url string', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('get_time', 'call-1');
    expect(typeof token).toBe('string');
    // Should be valid base64url
    expect(() => Buffer.from(token, 'base64url').toString()).not.toThrow();
  });

  it('validateToken accepts a valid token', () => {
    const sm = new SessionManager();
    const callId = 'call-1';
    const fn = 'get_time';
    const token = sm.generateToken(fn, callId);
    expect(sm.validateToken(callId, fn, token)).toBe(true);
  });

  it('validateToken rejects wrong function name', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn_a', 'call-1');
    expect(sm.validateToken('call-1', 'fn_b', token)).toBe(false);
  });

  it('validateToken rejects wrong call id', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn', 'call-1');
    expect(sm.validateToken('call-2', 'fn', token)).toBe(false);
  });

  it('validateToken rejects expired tokens', () => {
    const sm = new SessionManager(0); // 0 second expiry
    const token = sm.generateToken('fn', 'call-1');
    // Token is immediately expired (or within ms)
    // Wait a tiny bit to ensure expiry
    const result = sm.validateToken('call-1', 'fn', token);
    // With 0 expiry the token expires at creation time, so it should be invalid
    expect(result).toBe(false);
  });

  it('validateToken rejects tampered tokens', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn', 'call-1');
    // Tamper with the token
    const tampered = token.slice(0, -2) + 'XX';
    expect(sm.validateToken('call-1', 'fn', tampered)).toBe(false);
  });

  it('validateToken rejects tokens from different secret', () => {
    const sm1 = new SessionManager(3600, 'secret-1');
    const sm2 = new SessionManager(3600, 'secret-2');
    const token = sm1.generateToken('fn', 'call-1');
    expect(sm2.validateToken('call-1', 'fn', token)).toBe(false);
  });

  it('aliases work', () => {
    const sm = new SessionManager();
    const callId = 'call-1';
    const fn = 'fn';
    const token = sm.createToolToken(fn, callId);
    expect(sm.validateToolToken(fn, token, callId)).toBe(true);
  });

  it('rejects token when callId is empty', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn', 'call-1');
    // Empty callId should be rejected to prevent token reuse across calls
    expect(sm.validateToken('', 'fn', token)).toBe(false);
  });

  it('default token expiry is 900 seconds', () => {
    const sm = new SessionManager();
    expect(sm.tokenExpirySecs).toBe(900);
  });

  // ── debugToken ──────────────────────────────────────────────────

  it('debugToken returns error when debugMode is false (default)', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('get_time', 'call-42');
    const info = sm.debugToken(token);
    expect(info.error).toBe('debug mode not enabled');
    expect(info.valid_format).toBe(false);
  });

  it('debugToken decodes token components when debugMode is true', () => {
    const sm = new SessionManager();
    sm.debugMode = true;
    const token = sm.generateToken('get_time', 'call-42');
    const info = sm.debugToken(token);
    expect(info.valid_format).toBe(true);
    expect(info.components).toBeDefined();
    expect(info.components!.function).toBe('get_time');
    // call_id should be truncated to 8 chars + "..." since 'call-42' is 7 chars, no truncation
    expect(info.components!.call_id).toBe('call-42');
    expect(typeof info.components!.expiry).toBe('string');
    expect(typeof info.components!.nonce).toBe('string');
    // signature is 64 hex chars, so it should be truncated
    expect(info.components!.signature).toMatch(/^[0-9a-f]{8}\.\.\.$/);
    expect(info.status).toBeDefined();
    expect(info.status!.is_expired).toBe(false);
    expect(typeof info.status!.current_time).toBe('number');
    expect(typeof info.status!.expires_in_seconds).toBe('number');
  });

  it('debugToken returns invalid format for malformed token when debugMode is true', () => {
    const sm = new SessionManager();
    sm.debugMode = true;
    const info = sm.debugToken('not-valid');
    expect(info.valid_format).toBe(false);
  });

  it('debugToken shows expired status for expired tokens when debugMode is true', () => {
    // Use a negative expiry offset so the token is definitively in the past
    const sm = new SessionManager(-10); // already 10 seconds expired at creation
    sm.debugMode = true;
    const token = sm.generateToken('fn', 'call-1');
    const info = sm.debugToken(token);
    expect(info.valid_format).toBe(true);
    expect(info.status!.is_expired).toBe(true);
    expect(info.status!.expires_in_seconds).toBe(0);
  });

  it('debugToken truncates long call_id and signature', () => {
    const sm = new SessionManager();
    sm.debugMode = true;
    const token = sm.generateToken('fn', 'a-very-long-call-id-string');
    const info = sm.debugToken(token);
    expect(info.valid_format).toBe(true);
    expect(info.components!.call_id).toBe('a-very-l...');
  });

  it('setSessionMetadata stores and retrieves metadata', () => {
    const sm = new SessionManager();
    sm.setSessionMetadata('session-1', { caller: 'John', topic: 'billing' });
    const meta = sm.getSessionMetadata('session-1');
    expect(meta).toEqual({ caller: 'John', topic: 'billing' });
  });

  it('setSessionMetadata merges with existing metadata', () => {
    const sm = new SessionManager();
    sm.setSessionMetadata('session-1', { caller: 'John' });
    sm.setSessionMetadata('session-1', { topic: 'billing' });
    const meta = sm.getSessionMetadata('session-1');
    expect(meta).toEqual({ caller: 'John', topic: 'billing' });
  });

  it('getSessionMetadata returns undefined for unknown session', () => {
    const sm = new SessionManager();
    expect(sm.getSessionMetadata('nope')).toBeUndefined();
  });

  it('deleteSessionMetadata removes metadata', () => {
    const sm = new SessionManager();
    sm.setSessionMetadata('session-1', { key: 'val' });
    expect(sm.deleteSessionMetadata('session-1')).toBe(true);
    expect(sm.getSessionMetadata('session-1')).toBeUndefined();
  });

  // ── Security remediation tests ─────────────────────────────────────

  it('token round-trip works with full-length HMAC', () => {
    const sm = new SessionManager();
    sm.debugMode = true;
    const token = sm.generateToken('fn_a', 'call-99');
    const info = sm.debugToken(token);
    expect(info.valid_format).toBe(true);
    // Signature is truncated to 8 chars + "..." in debug output; validate via round-trip instead
    expect(sm.validateToken('call-99', 'fn_a', token)).toBe(true);
  });

  it('cleanup() removes stale entries', () => {
    const sm = new SessionManager(1); // 1 second expiry
    sm.setSessionMetadata('old-session', { a: 1 });
    // Artificially age the entry by overwriting its timestamp
    (sm as any).sessionTimestamps.set('old-session', Date.now() - 5000);
    sm.cleanup();
    expect(sm.getSessionMetadata('old-session')).toBeUndefined();
  });

  it('cleanup(0) removes all entries', () => {
    const sm = new SessionManager();
    sm.setSessionMetadata('s1', { a: 1 });
    sm.setSessionMetadata('s2', { b: 2 });
    sm.cleanup(0);
    expect(sm.getSessionMetadata('s1')).toBeUndefined();
    expect(sm.getSessionMetadata('s2')).toBeUndefined();
  });

  it('boundary expiry token is rejected (expiry <= now)', () => {
    const sm = new SessionManager(0); // token expires at creation time
    const token = sm.generateToken('fn', 'call-1');
    // With <= comparison, a token expiring at exactly now should be invalid
    expect(sm.validateToken('call-1', 'fn', token)).toBe(false);
  });

  // ── SDK alignment gap fixes ─────────────────────────────────────

  it('secretKey is publicly accessible (Python SDK parity)', () => {
    const sm = new SessionManager(900, 'my-secret');
    // secretKey must be a public property, not private
    expect(sm.secretKey).toBe('my-secret');
  });

  it('secretKey is auto-generated when not provided', () => {
    const sm = new SessionManager();
    expect(typeof sm.secretKey).toBe('string');
    expect(sm.secretKey.length).toBeGreaterThan(0);
  });

  it('activateSession is a legacy no-op returning true', () => {
    const sm = new SessionManager();
    expect(sm.activateSession('call-1')).toBe(true);
    expect(sm.activateSession('any-id')).toBe(true);
  });

  it('endSession is a legacy no-op returning true', () => {
    const sm = new SessionManager();
    expect(sm.endSession('call-1')).toBe(true);
    expect(sm.endSession('any-id')).toBe(true);
  });

  it('setSessionMetadata accepts (sessionId, key, value) overload and returns true', () => {
    const sm = new SessionManager();
    const result = sm.setSessionMetadata('session-1', 'caller', 'John');
    expect(result).toBe(true);
    const meta = sm.getSessionMetadata('session-1');
    expect(meta).toEqual({ caller: 'John' });
  });

  it('setSessionMetadata key/value overload merges with existing metadata', () => {
    const sm = new SessionManager();
    sm.setSessionMetadata('session-1', { existing: 'data' });
    sm.setSessionMetadata('session-1', 'newKey', 42);
    const meta = sm.getSessionMetadata('session-1');
    expect(meta).toEqual({ existing: 'data', newKey: 42 });
  });

  it('debugMode defaults to false', () => {
    const sm = new SessionManager();
    expect(sm.debugMode).toBe(false);
  });
});
