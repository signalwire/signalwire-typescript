/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_compat_tokens.py.
 *
 * Covers CompatTokens.create / .update / .delete. Note: CompatTokens
 * uses PATCH for update (BaseResource semantics, not LAML POST).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';

const BASE = '/api/laml/2010-04-01/Accounts/test_proj/tokens';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- Create ------------------------------------------------------------

describe('CompatTokens.create', () => {
  it('returns_token_resource', async () => {
    const result = await client.compat.tokens.create({ Ttl: 3600 });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('token' in result || 'id' in result).toBe(true);
  });

  it('journal_records_post_with_ttl', async () => {
    await client.compat.tokens.create({ Ttl: 3600, Name: 'api-key' });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe(BASE);
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Ttl).toBe(3600);
    expect(j.body.Name).toBe('api-key');
  });
});

// ---- Update ------------------------------------------------------------

describe('CompatTokens.update', () => {
  it('returns_token_resource', async () => {
    const result = await client.compat.tokens.update('TK_U', { Ttl: 7200 });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('token' in result || 'id' in result).toBe(true);
  });

  it('journal_records_patch_with_ttl', async () => {
    await client.compat.tokens.update('TK_UU', { Ttl: 7200 });
    const j = await mock.last();
    // CompatTokens.update uses PATCH (BaseResource — not LAML POST).
    expect(j.method).toBe('PATCH');
    expect(j.path).toBe(`${BASE}/TK_UU`);
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Ttl).toBe(7200);
  });
});

// ---- Delete ------------------------------------------------------------

describe('CompatTokens.delete', () => {
  it('no_exception_on_delete', async () => {
    const result = await client.compat.tokens.delete('TK_D');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('journal_records_delete', async () => {
    await client.compat.tokens.delete('TK_DEL');
    const j = await mock.last();
    expect(j.method).toBe('DELETE');
    expect(j.path).toBe(`${BASE}/TK_DEL`);
  });
});
