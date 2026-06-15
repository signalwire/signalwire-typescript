/**
 * Tests for ``src/WebhookValidator.ts``.
 *
 * Cross-language SDK contract: every port must implement Scheme A (hex
 * HMAC-SHA1 over url+rawBody for JSON/RELAY) and Scheme B (base64 HMAC-SHA1
 * over url+sortedFormParams for cXML/Compat) per
 * ``porting-sdk/webhooks.md``. Vectors A, B, C below are the canonical
 * vectors from the spec; if they break, the port has a real bug.
 *
 * Direct port of ``signalwire/tests/unit/security/test_webhook_validator.py``.
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { validateRequest, validateWebhookSignature } from '../src/WebhookValidator.js';

// ---------------------------------------------------------------------------
// Canonical test vectors from porting-sdk/webhooks.md
// ---------------------------------------------------------------------------

const VECTOR_A = {
  signingKey: 'PSKtest1234567890abcdef',
  url: 'https://example.ngrok.io/webhook',
  rawBody: '{"event":"call.state","params":{"call_id":"abc-123","state":"answered"}}',
  expected: 'c3c08c1fefaf9ee198a100d5906765a6f394bf0f',
};

const VECTOR_B_PARAMS = {
  CallSid: 'CA1234567890ABCDE',
  Caller: '+14158675309',
  Digits: '1234',
  From: '+14158675309',
  To: '+18005551212',
};
const VECTOR_B = {
  signingKey: '12345',
  url: 'https://mycompany.com/myapp.php?foo=1&bar=2',
  params: VECTOR_B_PARAMS,
  expected: 'RSOYDt4T1cUTdK1PDd93/VVr8B8=',
};

const VECTOR_C = {
  signingKey: 'PSKtest1234567890abcdef',
  rawBody: '{"event":"call.state"}',
  url:
    'https://example.ngrok.io/webhook?bodySHA256=' +
    '69f3cbfc18e386ef8236cb7008cd5a54b7fed637a8cb3373b5a1591d7f0fd5f4',
  expected: 'dfO9ek8mxyFtn2nMz24plPmPfIY=',
};

/**
 * Build an x-www-form-urlencoded body that round-trips through
 * URLSearchParams back to the same key/value pairs Scheme B will
 * sort and concat.
 */
function formEncoded(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

// Regenerate a base64 sig for a given key/url/params shape so we can
// construct synthetic vectors for the URL port-normalization tests
// without depending on the canonical vectors above.
function b64Sig(key: string, url: string, params: Record<string, string> = {}): string {
  let data = url;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  return createHmac('sha1', key).update(Buffer.from(data, 'utf-8')).digest('base64');
}

// ---------------------------------------------------------------------------
// Scheme A — RELAY/JSON (hex)
// ---------------------------------------------------------------------------

describe('WebhookValidator — Scheme A (RELAY/JSON, hex)', () => {
  it('positive: canonical Vector A produces the known hex digest', () => {
    expect(
      validateWebhookSignature(
        VECTOR_A.signingKey,
        VECTOR_A.expected,
        VECTOR_A.url,
        VECTOR_A.rawBody,
      ),
    ).toBe(true);
  });

  it('negative: tampered body returns false', () => {
    const tampered = VECTOR_A.rawBody.replace('answered', 'ringing');
    expect(
      validateWebhookSignature(VECTOR_A.signingKey, VECTOR_A.expected, VECTOR_A.url, tampered),
    ).toBe(false);
  });

  it('negative: wrong signing key returns false', () => {
    expect(
      validateWebhookSignature('wrong-key', VECTOR_A.expected, VECTOR_A.url, VECTOR_A.rawBody),
    ).toBe(false);
  });

  it('negative: different URL path returns false', () => {
    expect(
      validateWebhookSignature(
        VECTOR_A.signingKey,
        VECTOR_A.expected,
        'https://example.ngrok.io/different',
        VECTOR_A.rawBody,
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scheme B — Compat/cXML (base64 form)
// ---------------------------------------------------------------------------

describe('WebhookValidator — Scheme B (Compat/cXML, base64)', () => {
  it('positive: canonical form Vector B with raw body', () => {
    const body = formEncoded(VECTOR_B.params);
    expect(
      validateWebhookSignature(VECTOR_B.signingKey, VECTOR_B.expected, VECTOR_B.url, body),
    ).toBe(true);
  });

  it('positive: canonical Vector B via validateRequest with dict', () => {
    expect(
      validateRequest(VECTOR_B.signingKey, VECTOR_B.expected, VECTOR_B.url, VECTOR_B.params),
    ).toBe(true);
  });

  it('positive: canonical Vector B via validateRequest with array of tuples', () => {
    const tuples = Object.entries(VECTOR_B.params) as Array<[string, string]>;
    expect(validateRequest(VECTOR_B.signingKey, VECTOR_B.expected, VECTOR_B.url, tuples)).toBe(
      true,
    );
  });

  it('positive: canonical Vector B via validateRequest with Map (runtime accepts Map)', () => {
    // The public type signature matches Python's
    // ``Union[str, Mapping, List[Tuple], None]`` for cross-language
    // signature parity, but the TS runtime also accepts Map for
    // ergonomic TS-side usage. Cast through to verify the runtime path.
    const m = new Map<string, string>(Object.entries(VECTOR_B.params));
    expect(
      validateRequest(
        VECTOR_B.signingKey,
        VECTOR_B.expected,
        VECTOR_B.url,
        m as unknown as Record<string, unknown>,
      ),
    ).toBe(true);
  });

  it('positive: bodySHA256 canonical Vector C', () => {
    expect(
      validateWebhookSignature(
        VECTOR_C.signingKey,
        VECTOR_C.expected,
        VECTOR_C.url,
        VECTOR_C.rawBody,
      ),
    ).toBe(true);
  });

  it('negative: bodySHA256 mismatch with valid HMAC over URL still rejects', () => {
    // Same URL/key/sig as Vector C but a body that does NOT hash to the
    // bodySHA256 query param: the HMAC over (url + '') matches but the
    // body-hash check fails, so the result must be false.
    const wrongBody = '{"event":"DIFFERENT"}';
    expect(
      validateWebhookSignature(VECTOR_C.signingKey, VECTOR_C.expected, VECTOR_C.url, wrongBody),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// URL port normalization
// ---------------------------------------------------------------------------

describe('WebhookValidator — URL port normalization', () => {
  it('signed with :443, request URL has no port — accepted', () => {
    const key = 'test-key';
    const sig = b64Sig(key, 'https://example.com:443/webhook');
    expect(validateWebhookSignature(key, sig, 'https://example.com/webhook', '{}')).toBe(true);
  });

  it('signed without port, request URL has :443 — accepted', () => {
    const key = 'test-key';
    const sig = b64Sig(key, 'https://example.com/webhook');
    expect(validateWebhookSignature(key, sig, 'https://example.com:443/webhook', '{}')).toBe(true);
  });

  it('http + :80 normalization mirrors https + :443', () => {
    const key = 'test-key';
    const sig = b64Sig(key, 'http://example.com:80/path');
    expect(validateWebhookSignature(key, sig, 'http://example.com/path', '')).toBe(true);
  });

  it('non-standard explicit port is preserved as-is (no with/without variants)', () => {
    const key = 'test-key';
    // Sign for :8080 and confirm request URL with :8080 matches.
    const sig8080 = b64Sig(key, 'https://example.com:8080/path');
    expect(validateWebhookSignature(key, sig8080, 'https://example.com:8080/path', '')).toBe(true);
    // Same sig must NOT match a request URL with :443 (no port-variant logic kicks in).
    expect(validateWebhookSignature(key, sig8080, 'https://example.com:443/path', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Repeated form keys
// ---------------------------------------------------------------------------

describe('WebhookValidator — repeated form keys', () => {
  it('To=a&To=b concatenates in submission order under sorted-by-key rule', () => {
    const key = 'test-key';
    const url = 'https://example.com/hook';
    const body = 'To=a&To=b';
    // Expected concat: ``ToaTob`` (sorted by key only; preserve order within).
    const expectedData = url + 'ToaTob';
    const sig = createHmac('sha1', key).update(expectedData, 'utf8').digest('base64');
    expect(validateWebhookSignature(key, sig, url, body)).toBe(true);
  });

  it('To=b&To=a yields a different digest than To=a&To=b', () => {
    const key = 'test-key';
    const url = 'https://example.com/hook';
    // Sign for the body_ab order; confirm body_ba does not match.
    const dataAb = url + 'ToaTob';
    const sigForAb = createHmac('sha1', key).update(dataAb, 'utf8').digest('base64');
    expect(validateWebhookSignature(key, sigForAb, url, 'To=a&To=b')).toBe(true);
    expect(validateWebhookSignature(key, sigForAb, url, 'To=b&To=a')).toBe(false);
  });

  it('repeated keys via dict-with-array param shape match raw-body equivalent', () => {
    const key = 'test-key';
    const url = 'https://example.com/hook';
    const dataAb = url + 'ToaTob';
    const sigForAb = createHmac('sha1', key).update(dataAb, 'utf8').digest('base64');
    expect(validateRequest(key, sigForAb, url, { To: ['a', 'b'] })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Error modes
// ---------------------------------------------------------------------------

describe('WebhookValidator — error modes', () => {
  it('missing signature returns false (no throw)', () => {
    expect(validateWebhookSignature(VECTOR_A.signingKey, '', VECTOR_A.url, VECTOR_A.rawBody)).toBe(
      false,
    );
    // The public type signature names ``string`` for cross-language parity
    // with Python's signature; we type-cast through to verify the runtime
    // guard against null/undefined still returns false (not throw).
    expect(
      validateWebhookSignature(
        VECTOR_A.signingKey,
        null as unknown as string,
        VECTOR_A.url,
        VECTOR_A.rawBody,
      ),
    ).toBe(false);
    expect(
      validateWebhookSignature(
        VECTOR_A.signingKey,
        undefined as unknown as string,
        VECTOR_A.url,
        VECTOR_A.rawBody,
      ),
    ).toBe(false);
  });

  it('missing signing key throws', () => {
    expect(() => validateWebhookSignature('', 'sig', VECTOR_A.url, VECTOR_A.rawBody)).toThrow();
    // Cast to satisfy TS — the runtime guard rejects null too.
    expect(() =>
      validateWebhookSignature(null as unknown as string, 'sig', VECTOR_A.url, VECTOR_A.rawBody),
    ).toThrow();
  });

  it('non-string rawBody throws TypeError', () => {
    expect(() =>
      validateWebhookSignature(
        VECTOR_A.signingKey,
        'sig',
        VECTOR_A.url,
        // Pass a parsed object — the guard must throw.
        { event: 'call.state' } as unknown as string,
      ),
    ).toThrow(TypeError);
  });

  it('malformed signatures return false without throwing', () => {
    for (const garbage of ['xyz', '!!!!', 'a'.repeat(100), '%%notbase64%%']) {
      expect(
        validateWebhookSignature(VECTOR_A.signingKey, garbage, VECTOR_A.url, VECTOR_A.rawBody),
      ).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// validateRequest legacy alias dispatch
// ---------------------------------------------------------------------------

describe('WebhookValidator — validateRequest dispatch', () => {
  it('string 4th arg delegates to combined validator (Scheme A path)', () => {
    expect(
      validateRequest(VECTOR_A.signingKey, VECTOR_A.expected, VECTOR_A.url, VECTOR_A.rawBody),
    ).toBe(true);
  });

  it('object 4th arg runs Scheme B directly', () => {
    expect(
      validateRequest(VECTOR_B.signingKey, VECTOR_B.expected, VECTOR_B.url, VECTOR_B.params),
    ).toBe(true);
  });

  it('numeric 4th arg throws TypeError', () => {
    expect(() =>
      validateRequest(VECTOR_A.signingKey, 'sig', VECTOR_A.url, 42 as unknown as string),
    ).toThrow(TypeError);
  });

  it('null/undefined 4th arg is treated as empty params (no throw)', () => {
    // Sign url + '' (empty params) and verify both null and undefined accept.
    // ``undefined`` is type-cast through because the public signature names
    // ``null`` for cross-language parity with Python's Optional[...].
    const key = 'k';
    const url = 'https://example.com/hook';
    const sig = createHmac('sha1', key).update(url, 'utf8').digest('base64');
    expect(validateRequest(key, sig, url, null)).toBe(true);
    expect(validateRequest(key, sig, url, undefined as unknown as null)).toBe(true);
  });

  it('missing signature returns false even when key is set', () => {
    expect(validateRequest(VECTOR_A.signingKey, '', VECTOR_A.url, VECTOR_A.rawBody)).toBe(false);
  });

  it('missing signing key throws', () => {
    expect(() => validateRequest('', 'sig', VECTOR_A.url, VECTOR_A.rawBody)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Constant-time compare — read the source, not just the result.
// ---------------------------------------------------------------------------

describe('WebhookValidator — constant-time compare', () => {
  it('source uses crypto.timingSafeEqual and never plain == on digests', () => {
    // Read the source so we catch a future refactor that switches to ==.
    const src = readFileSync(new URL('../src/WebhookValidator.ts', import.meta.url), 'utf8');
    expect(src).toContain('timingSafeEqual');
    // Forbid the obviously-wrong patterns. The validator's local _safeEq
    // helper is the only place signatures are compared.
    expect(src).not.toMatch(/expectedA\s*===\s*signature/);
    expect(src).not.toMatch(/expectedB\s*===\s*signature/);
  });
});
