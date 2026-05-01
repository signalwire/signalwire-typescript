/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_compat_accounts.py.
 *
 * Covers CompatAccounts.create / .get / .update — the LAML Accounts
 * collection that lives at the top-level (no AccountSid prefix).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- Create ------------------------------------------------------------

describe('CompatAccounts.create', () => {
  it('returns_account_resource', async () => {
    const result = await client.compat.accounts.create({ FriendlyName: 'Sub-A' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('friendly_name' in result).toBe(true);
  });

  it('journal_records_post_to_accounts', async () => {
    await client.compat.accounts.create({ FriendlyName: 'Sub-B' });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    // Accounts.create lives at the top-level Accounts collection — no
    // AccountSid prefix.
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.FriendlyName).toBe('Sub-B');
    const status = j.response_status ?? 0;
    expect(status >= 200 && status < 400).toBe(true);
  });
});

// ---- Get ---------------------------------------------------------------

describe('CompatAccounts.get', () => {
  it('returns_account_for_sid', async () => {
    const result = await client.compat.accounts.get('AC123');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('friendly_name' in result).toBe(true);
  });

  it('journal_records_get_with_sid', async () => {
    await client.compat.accounts.get('AC_SAMPLE_SID');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/AC_SAMPLE_SID');
    // GET should not carry a request body.
    expect(j.body === null || j.body === '' || (typeof j.body === 'object' && Object.keys(j.body).length === 0)).toBe(true);
    expect(j.matched_route).not.toBeNull();
  });
});

// ---- Update ------------------------------------------------------------

describe('CompatAccounts.update', () => {
  it('returns_updated_account', async () => {
    const result = await client.compat.accounts.update('AC123', { FriendlyName: 'Renamed' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('friendly_name' in result).toBe(true);
  });

  it('journal_records_post_to_account_path', async () => {
    await client.compat.accounts.update('AC_X', { FriendlyName: 'NewName' });
    const j = await mock.last();
    // Twilio-compat update is POST (not PATCH/PUT).
    expect(j.method).toBe('POST');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/AC_X');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.FriendlyName).toBe('NewName');
  });
});
