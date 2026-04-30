/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_compat_messages_faxes.py.
 *
 * Covers gap entries for CompatMessages and CompatFaxes:
 *   - Messages: update, getMedia, deleteMedia
 *   - Faxes:    update, listMedia, getMedia, deleteMedia
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

// ---- Messages ----------------------------------------------------------

describe('CompatMessages.update', () => {
  it('returns_message_resource', async () => {
    const result = await client.compat.messages.update('MM_TEST', { Body: 'updated body' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Message resources carry body + status + sid fields.
    expect('body' in result || 'sid' in result).toBe(true);
  });

  it('journal_records_post_to_message', async () => {
    await client.compat.messages.update('MM_U1', { Body: 'x', Status: 'canceled' });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Messages/MM_U1');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Body).toBe('x');
    expect(j.body.Status).toBe('canceled');
  });
});

describe('CompatMessages.getMedia', () => {
  it('returns_media_resource', async () => {
    const result = await client.compat.messages.getMedia('MM_GM', 'ME_GM');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Media resources expose content_type + sid + parent_sid.
    expect('content_type' in result || 'sid' in result).toBe(true);
  });

  it('journal_records_get_to_media_path', async () => {
    await client.compat.messages.getMedia('MM_X', 'ME_X');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Messages/MM_X/Media/ME_X');
  });
});

describe('CompatMessages.deleteMedia', () => {
  it('no_exception_on_delete', async () => {
    const result = await client.compat.messages.deleteMedia('MM_DM', 'ME_DM');
    // The SDK's DELETE handler returns {} on 204 or whatever the mock
    // body is for non-204 responses. Either way we expect a dict.
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('journal_records_delete', async () => {
    await client.compat.messages.deleteMedia('MM_D', 'ME_D');
    const j = await mock.last();
    expect(j.method).toBe('DELETE');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Messages/MM_D/Media/ME_D');
  });
});

// ---- Faxes -------------------------------------------------------------

describe('CompatFaxes.update', () => {
  it('returns_fax_resource', async () => {
    const result = await client.compat.faxes.update('FX_U', { Status: 'canceled' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Fax resources carry direction + status + duration.
    expect('status' in result || 'direction' in result).toBe(true);
  });

  it('journal_records_post_with_status', async () => {
    await client.compat.faxes.update('FX_U2', { Status: 'canceled' });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Faxes/FX_U2');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.Status).toBe('canceled');
  });
});

describe('CompatFaxes.listMedia', () => {
  it('returns_paginated_list', async () => {
    const result = await client.compat.faxes.listMedia('FX_LM');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Fax media listing uses 'media' or 'fax_media' as collection key.
    expect('media' in result || 'fax_media' in result).toBe(true);
  });

  it('journal_records_get_to_fax_media', async () => {
    await client.compat.faxes.listMedia('FX_LM_X');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Faxes/FX_LM_X/Media');
  });
});

describe('CompatFaxes.getMedia', () => {
  it('returns_fax_media_resource', async () => {
    const result = await client.compat.faxes.getMedia('FX_GM', 'ME_GM');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Fax media carries content_type + sid + fax_sid.
    expect('content_type' in result || 'sid' in result).toBe(true);
  });

  it('journal_records_get_to_specific_media', async () => {
    await client.compat.faxes.getMedia('FX_G', 'ME_G');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Faxes/FX_G/Media/ME_G');
  });
});

describe('CompatFaxes.deleteMedia', () => {
  it('no_exception_on_delete', async () => {
    const result = await client.compat.faxes.deleteMedia('FX_DM', 'ME_DM');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('journal_records_delete', async () => {
    await client.compat.faxes.deleteMedia('FX_D', 'ME_D');
    const j = await mock.last();
    expect(j.method).toBe('DELETE');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/Faxes/FX_D/Media/ME_D');
  });
});
