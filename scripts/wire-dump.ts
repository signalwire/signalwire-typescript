/**
 * wire-dump.ts — the TypeScript port's WIRE-CRYPTO dump program for the
 * cross-port wire differ (porting-sdk/scripts/diff_port_wire.py).
 *
 * It runs the shared wire_crypto corpus against the TS SDK's native security
 * surface (SessionManager tokens, webhook-signature validation, redact/filter
 * helpers) and prints ONE JSON object mapping
 *
 *   case-id -> observable-artifact
 *
 * to stdout. The differ canonicalizes both sides and byte-compares each entry
 * against the python oracle. Only stdout carries JSON.
 *
 * The corpus sentinels (__ORACLE_FORMAT_TOKEN__, __TAMPERED_TOKEN__,
 * __ORACLE_SIG__) are materialized here from the fixed per-case SECRET exactly
 * as the oracle materializes them (diff_port_wire._oracle_token / _tampered_token
 * / _oracle_sig), so the interop/tamper cases are reproducible cross-port.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   npx tsx scripts/wire-dump.ts
 */

import { createHmac } from 'node:crypto';

import { SessionManager } from '../src/SessionManager.js';
import { filterSensitiveHeaders, redactUrl } from '../src/SecurityUtils.js';
import { validateWebhookSignature } from '../src/WebhookValidator.js';

// SECRET mirrors wire_crypto_corpus.SECRET ("a" * 64).
const SECRET = 'a'.repeat(64);

const ORACLE_EXPIRY = 9999999999; // fixed far-future expiry (deterministic)
const ORACLE_NONCE = '0123456789abcdef'; // fixed 16-hex nonce (deterministic)

/** oracleToken builds a token in the SDK wire format
 *  (call_id.fn.expiry.nonce.sig, base64url) from the fixed SECRET — the TS
 *  mirror of diff_port_wire._oracle_token. */
function oracleToken(callId: string, fn: string): string {
  const msg = `${callId}:${fn}:${ORACLE_EXPIRY}:${ORACLE_NONCE}`;
  const sig = createHmac('sha256', SECRET).update(msg).digest('hex');
  const raw = `${callId}.${fn}.${ORACLE_EXPIRY}.${ORACLE_NONCE}.${sig}`;
  return Buffer.from(raw).toString('base64url');
}

/** tamperedToken flips one signature character — the TS mirror of
 *  _tampered_token (flip the first byte of the last dot-field). */
function tamperedToken(): string {
  const tok = oracleToken('c', 'f');
  const raw = Buffer.from(tok, 'base64url').toString();
  const parts = raw.split('.');
  const sig = parts[parts.length - 1] as string;
  parts[parts.length - 1] = (sig[0] !== 'f' ? 'f' : 'e') + sig.slice(1);
  return Buffer.from(parts.join('.')).toString('base64url');
}

/** oracleSig computes the correct webhook signature: hex(HMAC-SHA1(key, url+body)). */
function oracleSig(url: string, body: string, key: string): string {
  return createHmac('sha1', key)
    .update(url + body)
    .digest('hex');
}

/** observeTokenFields decodes a token and returns its wire-format shape —
 *  the TS mirror of diff_port_wire._observe_token_fields. */
function observeTokenFields(token: string): Record<string, unknown> {
  const raw = Buffer.from(token, 'base64url').toString();
  const parts = raw.split('.');
  const nonce = parts.length > 3 ? (parts[3] as string) : '';
  const nonceIsHex = parts.length > 3 && [...nonce].every((c) => '0123456789abcdef'.includes(c));
  return {
    n_fields: parts.length,
    call_id: parts.length > 0 ? parts[0] : null,
    function_name: parts.length > 1 ? parts[1] : null,
    nonce_len: nonce.length,
    nonce_is_hex: nonceIsHex,
  };
}

function main(): void {
  const out: Record<string, unknown> = {};

  // token_format: generate a token via the SDK, decode its fields.
  const sm = new SessionManager(9999999999, SECRET);
  out['token_format'] = observeTokenFields(sm.generateToken('my_func', 'call_1'));

  // token_nonce_distinct: two generations must differ (random nonce).
  const n1 = sm.generateToken('f', 'c');
  const n2 = sm.generateToken('f', 'c');
  out['token_nonce_distinct'] = { distinct: n1 !== n2 };

  // token_interop: validate an oracle-format token built from SECRET.
  out['token_interop'] = {
    valid: sm.validateToken('oracle_call', 'oracle_fn', oracleToken('oracle_call', 'oracle_fn')),
  };

  // token_tamper_rejected: a one-byte-flipped signature must fail.
  out['token_tamper_rejected'] = { valid: sm.validateToken('c', 'f', tamperedToken()) };

  // wire_validate_webhook_signature: correct HMAC-SHA1 -> valid.
  const whUrl = 'https://example.com/hook';
  const whBody = '{"event":"call.created"}';
  out['wire_validate_webhook_signature'] = {
    valid: validateWebhookSignature(SECRET, oracleSig(whUrl, whBody, SECRET), whUrl, whBody),
  };
  // wire_validate_webhook_signature_bad: wrong sig -> invalid.
  out['wire_validate_webhook_signature_bad'] = {
    valid: validateWebhookSignature(SECRET, 'deadbeef'.repeat(8), whUrl, whBody),
  };

  // wire_redact_url: credentials redacted, structure preserved.
  out['wire_redact_url'] = {
    redacted: redactUrl('https://user:s3cr3t@api.signalwire.com/path?token=abc'),
  };

  // wire_filter_sensitive_headers: authorization + x-api-key dropped, content-type kept.
  out['wire_filter_sensitive_headers'] = {
    filtered: filterSensitiveHeaders({
      Authorization: 'Bearer x',
      'X-Api-Key': 'y',
      'Content-Type': 'application/json',
    }),
  };

  // One JSON object on stdout, nothing else.
  process.stdout.write(JSON.stringify(out) + '\n');
}

main();
