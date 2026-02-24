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

  it('validates token when callId is empty (uses token callId)', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn', 'call-1');
    // Empty callId should use token's embedded callId
    expect(sm.validateToken('', 'fn', token)).toBe(true);
  });
});
