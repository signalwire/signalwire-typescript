/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_compat_misc.py.
 *
 * Covers:
 *   - CompatApplications.update
 *   - CompatLamlBins.update
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

// ---- Applications ------------------------------------------------------

describe('CompatApplications.update', () => {
  it('returns_application_resource', async () => {
    const result = await client.compat.applications.update('AP_U', { FriendlyName: 'updated' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('friendly_name' in result || 'sid' in result).toBe(true);
  });

  it('journal_records_post_with_friendly_name', async () => {
    await client.compat.applications.update('AP_UU', {
      FriendlyName: 'renamed',
      VoiceUrl: 'https://a.b/v',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Applications/AP_UU');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.FriendlyName).toBe('renamed');
    expect(j.body.VoiceUrl).toBe('https://a.b/v');
  });
});

// ---- LamlBins ----------------------------------------------------------

describe('CompatLamlBins.update', () => {
  it('returns_laml_bin_resource', async () => {
    const result = await client.compat.lamlBins.update('LB_U', { FriendlyName: 'updated' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('friendly_name' in result || 'sid' in result || 'contents' in result).toBe(true);
  });

  it('journal_records_post_with_friendly_name', async () => {
    await client.compat.lamlBins.update('LB_UU', {
      FriendlyName: 'renamed',
      Contents: '<Response/>',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/LamlBins/LB_UU');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.FriendlyName).toBe('renamed');
    expect(j.body.Contents).toBe('<Response/>');
  });
});
