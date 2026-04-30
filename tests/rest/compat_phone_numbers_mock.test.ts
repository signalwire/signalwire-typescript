/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_compat_phone_numbers.py.
 *
 * Covers the 8 uncovered CompatPhoneNumbers symbols:
 *   - list, get, update, delete (basic CRUD over IncomingPhoneNumbers)
 *   - purchase, importNumber (phone-number provisioning)
 *   - listAvailableCountries, searchTollFree
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

describe('CompatPhoneNumbers.list', () => {
  it('returns_paginated_list', async () => {
    const result = await client.compat.phoneNumbers.list();
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('incoming_phone_numbers' in result).toBe(true);
    expect(Array.isArray(result.incoming_phone_numbers)).toBe(true);
  });

  it('journal_records_get_to_incoming_phone_numbers', async () => {
    await client.compat.phoneNumbers.list();
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/IncomingPhoneNumbers');
  });
});

describe('CompatPhoneNumbers.get', () => {
  it('returns_phone_number_resource', async () => {
    const result = await client.compat.phoneNumbers.get('PN_TEST');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Incoming phone-number resources carry phone_number + sid + capabilities.
    expect('phone_number' in result || 'sid' in result).toBe(true);
  });

  it('journal_records_get_with_sid', async () => {
    await client.compat.phoneNumbers.get('PN_GET');
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/IncomingPhoneNumbers/PN_GET');
  });
});

describe('CompatPhoneNumbers.update', () => {
  it('returns_phone_number_resource', async () => {
    const result = await client.compat.phoneNumbers.update('PN_U', { FriendlyName: 'updated' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('phone_number' in result || 'sid' in result).toBe(true);
  });

  it('journal_records_post_with_friendly_name', async () => {
    await client.compat.phoneNumbers.update('PN_UU', {
      FriendlyName: 'updated',
      VoiceUrl: 'https://a.b/v',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/IncomingPhoneNumbers/PN_UU');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.FriendlyName).toBe('updated');
    expect(j.body.VoiceUrl).toBe('https://a.b/v');
  });
});

describe('CompatPhoneNumbers.delete', () => {
  it('no_exception_on_delete', async () => {
    const result = await client.compat.phoneNumbers.delete('PN_D');
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
  });

  it('journal_records_delete_at_phone_number_path', async () => {
    await client.compat.phoneNumbers.delete('PN_DEL');
    const j = await mock.last();
    expect(j.method).toBe('DELETE');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/IncomingPhoneNumbers/PN_DEL');
  });
});

describe('CompatPhoneNumbers.purchase = POST /IncomingPhoneNumbers', () => {
  it('returns_purchased_number', async () => {
    const result = await client.compat.phoneNumbers.purchase({ PhoneNumber: '+15555550100' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Purchase returns the newly created IncomingPhoneNumber.
    expect('phone_number' in result || 'sid' in result).toBe(true);
  });

  it('journal_records_post_with_phone_number', async () => {
    await client.compat.phoneNumbers.purchase({
      PhoneNumber: '+15555550100',
      FriendlyName: 'Main',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/IncomingPhoneNumbers');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.PhoneNumber).toBe('+15555550100');
    expect(j.body.FriendlyName).toBe('Main');
  });
});

describe('CompatPhoneNumbers.importNumber = POST /ImportedPhoneNumbers', () => {
  it('returns_imported_number', async () => {
    const result = await client.compat.phoneNumbers.importNumber({ PhoneNumber: '+15555550111' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Imported numbers also synthesise to IncomingPhoneNumber-shaped.
    expect('phone_number' in result || 'sid' in result).toBe(true);
  });

  it('journal_records_post_to_imported_phone_numbers', async () => {
    await client.compat.phoneNumbers.importNumber({
      PhoneNumber: '+15555550111',
      VoiceUrl: 'https://a.b/v',
    });
    const j = await mock.last();
    expect(j.method).toBe('POST');
    // Note the path is ImportedPhoneNumbers, not IncomingPhoneNumbers.
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/ImportedPhoneNumbers');
    expect(typeof j.body).toBe('object');
    expect(j.body).not.toBeNull();
    expect(j.body.PhoneNumber).toBe('+15555550111');
  });
});

describe('CompatPhoneNumbers.listAvailableCountries = GET /AvailablePhoneNumbers', () => {
  it('returns_countries_collection', async () => {
    const result = await client.compat.phoneNumbers.listAvailableCountries();
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    // Available countries response wraps a 'countries' list.
    expect('countries' in result).toBe(true);
    expect(Array.isArray(result.countries)).toBe(true);
  });

  it('journal_records_get_to_available_phone_numbers', async () => {
    await client.compat.phoneNumbers.listAvailableCountries();
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/AvailablePhoneNumbers');
  });
});

describe('CompatPhoneNumbers.searchTollFree(country, params) = GET /AvailablePhoneNumbers/{c}/TollFree', () => {
  it('returns_available_numbers', async () => {
    const result = await client.compat.phoneNumbers.searchTollFree('US', { AreaCode: '800' });
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();
    expect('available_phone_numbers' in result).toBe(true);
    expect(Array.isArray(result.available_phone_numbers)).toBe(true);
  });

  it('journal_records_get_with_country_in_path', async () => {
    await client.compat.phoneNumbers.searchTollFree('US', { AreaCode: '888' });
    const j = await mock.last();
    expect(j.method).toBe('GET');
    expect(j.path).toBe('/api/laml/2010-04-01/Accounts/test_proj/AvailablePhoneNumbers/US/TollFree');
    // The AreaCode should be on the query string, not body.
    expect(j.query_params['AreaCode']).toEqual(['888']);
  });
});
