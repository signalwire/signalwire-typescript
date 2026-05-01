/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_small_namespaces_mock.py.
 *
 * Covers the small REST namespaces with handful-of-method gaps:
 *   - addresses, recordings, short_codes, imported_numbers, mfa,
 *     sip_profile, number_groups, project.tokens,
 *     datasphere.documents, queues
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

// ---- Addresses ---------------------------------------------------------

describe('Addresses', () => {
  it('list', async () => {
    const body = await client.addresses.list({ page_size: 10 });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/addresses');
    expect(last.matched_route).not.toBeNull();
    expect(last.query_params['page_size']).toEqual(['10']);
  });

  it('create', async () => {
    const body = await client.addresses.create({
      address_type: 'commercial',
      first_name: 'Ada',
      last_name: 'Lovelace',
      country: 'US',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/addresses');
    const sent = last.body || {};
    expect(sent.address_type).toBe('commercial');
    expect(sent.first_name).toBe('Ada');
    expect(sent.country).toBe('US');
  });

  it('get', async () => {
    const body = await client.addresses.get('addr-123');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/addresses/addr-123');
    expect(last.matched_route).not.toBeNull();
  });

  it('delete', async () => {
    const body = await client.addresses.delete('addr-123');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/addresses/addr-123');
    expect([200, 202, 204]).toContain(last.response_status);
  });
});

// ---- Recordings --------------------------------------------------------

describe('Recordings', () => {
  it('list', async () => {
    const body = await client.recordings.list({ page_size: 5 });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/recordings');
    expect(last.query_params['page_size']).toEqual(['5']);
  });

  it('get', async () => {
    const body = await client.recordings.get('rec-123');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/recordings/rec-123');
  });

  it('delete', async () => {
    const body = await client.recordings.delete('rec-123');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/recordings/rec-123');
    expect([200, 202, 204]).toContain(last.response_status);
  });
});

// ---- Short Codes -------------------------------------------------------

describe('ShortCodes', () => {
  it('list', async () => {
    const body = await client.shortCodes.list({ page_size: 20 });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/short_codes');
  });

  it('get', async () => {
    const body = await client.shortCodes.get('sc-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/short_codes/sc-1');
  });

  it('update', async () => {
    const body = await client.shortCodes.update('sc-1', { name: 'Marketing SMS' });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);

    const last = await mock.last();
    // short_codes uses PUT for update.
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/short_codes/sc-1');
    const sent = last.body || {};
    expect(sent.name).toBe('Marketing SMS');
  });
});

// ---- Imported Numbers --------------------------------------------------

describe('ImportedNumbers', () => {
  it('create', async () => {
    const body = await client.importedNumbers.create({
      number: '+15551234567',
      sip_username: 'alice',
      sip_password: 'secret',
      sip_proxy: 'sip.example.com',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/imported_phone_numbers');
    const sent = last.body || {};
    expect(sent.number).toBe('+15551234567');
    expect(sent.sip_username).toBe('alice');
    expect(sent.sip_proxy).toBe('sip.example.com');
  });
});

// ---- MFA — voice channel -----------------------------------------------

describe('Mfa', () => {
  it('call', async () => {
    // Pass `from_` to match the Python wire form (Python `from_` kwarg
    // becomes a body key with the trailing underscore).
    const body = await client.mfa.call({
      to: '+15551234567',
      from_: '+15559876543',
      message: 'Your code is {code}',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/mfa/call');
    const sent = last.body || {};
    expect(sent.to).toBe('+15551234567');
    expect(sent['from_']).toBe('+15559876543');
    expect(sent.message).toBe('Your code is {code}');
  });
});

// ---- SIP Profile -------------------------------------------------------

describe('SipProfile', () => {
  it('update', async () => {
    const body = await client.sipProfile.update({
      domain: 'myco.sip.signalwire.com',
      default_codecs: ['PCMU', 'PCMA'],
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('domain' in body || 'default_codecs' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/sip_profile');
    const sent = last.body || {};
    expect(sent.domain).toBe('myco.sip.signalwire.com');
    expect(sent.default_codecs).toEqual(['PCMU', 'PCMA']);
  });
});

// ---- Number Groups — membership ops ------------------------------------

describe('NumberGroups', () => {
  it('list_memberships', async () => {
    const body = await client.numberGroups.listMemberships('ng-1', { page_size: 10 });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/number_groups/ng-1/number_group_memberships');
    expect(last.query_params['page_size']).toEqual(['10']);
  });

  it('delete_membership', async () => {
    const body = await client.numberGroups.deleteMembership('mem-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/number_group_memberships/mem-1');
    expect([200, 202, 204]).toContain(last.response_status);
  });
});

// ---- Project tokens ----------------------------------------------------

describe('ProjectTokens', () => {
  it('update', async () => {
    const body = await client.project.tokens.update('tok-1', { name: 'renamed-token' });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe('/api/project/tokens/tok-1');
    const sent = last.body || {};
    expect(sent.name).toBe('renamed-token');
  });

  it('delete', async () => {
    const body = await client.project.tokens.delete('tok-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/project/tokens/tok-1');
    expect([200, 202, 204]).toContain(last.response_status);
  });
});

// ---- Datasphere — get_chunk --------------------------------------------

describe('Datasphere', () => {
  it('get_chunk', async () => {
    const body = await client.datasphere.documents.getChunk('doc-1', 'chunk-99');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('id' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/datasphere/documents/doc-1/chunks/chunk-99');
  });
});

// ---- Queues — get_member -----------------------------------------------

describe('Queues', () => {
  it('get_member', async () => {
    const body = await client.queues.getMember('q-1', 'mem-7');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('queue_id' in body || 'call_id' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/queues/q-1/members/mem-7');
  });
});
