/**
 * Retry-After in either form (Python 3.12.0, #125): delta-seconds, or an
 * HTTP-date (one without a zone read as UTC); a past date means retry now; a
 * value that's neither, or a non-finite or negative delay, falls back to the
 * computed backoff (null).
 */
import { HttpClient } from '../../src/rest/HttpClient.js';

const client = new HttpClient({
  project: 'p',
  token: 't',
  baseUrl: 'https://example.signalwire.com',
});
const retryAfter = (value: string | null) =>
  client['_retryAfterSeconds'](
    new Response(null, { status: 503, headers: value === null ? {} : { 'Retry-After': value } }),
  );

describe('Retry-After', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('reads delta-seconds', () => {
    expect(retryAfter('5')).toBe(5);
    expect(retryAfter(' 2.5 ')).toBe(2.5);
    expect(retryAfter('0')).toBe(0);
  });

  it('reads an HTTP-date as the time until it', () => {
    expect(retryAfter('Mon, 16 Nov 2026 12:00:30 GMT')).toBe(30);
    // A date without a zone is UTC
    expect(retryAfter('Mon, 16 Nov 2026 12:01:00')).toBe(60);
    expect(retryAfter('16 Nov 2026 12:00:10 +0000')).toBe(10);
    // The obsolete RFC 850 and asctime forms, which a recipient must accept
    expect(retryAfter('Monday, 16-Nov-26 12:00:30 GMT')).toBe(30);
    expect(retryAfter('Mon Nov 16 12:00:30 2026')).toBe(30);
  });

  it('retries now for a date in the past', () => {
    expect(retryAfter('Mon, 16 Nov 2026 11:00:00 GMT')).toBe(0);
  });

  it('falls back to backoff for anything else', () => {
    for (const value of [null, '', '-3', 'Infinity', 'NaN', 'soon', '2026-11-16T12:00:30Z']) {
      expect(retryAfter(value), String(value)).toBeNull();
    }
  });
});
