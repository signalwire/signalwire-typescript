/**
 * Full REST success + error coverage for the `relay-rest` spec group.
 *
 * Mirrors the proven python/java suites and the committed coverage style in
 * tests/rest/fabric_coverage_mock.test.ts: every coverable canonical
 * relay-rest route (59 of 69) gets BOTH a success (2xx) test and an error
 * (4xx/5xx) test, asserting method, path, matched_route, and (for errors)
 * response_status against the mock journal.
 *
 * Accepted gaps (10, NOT faked — no relay-rest SDK surface in TS; same in
 * python/java which lacked a relay-rest namespace for these paths):
 *   - relay-rest SIP endpoints (5): list/create/retrieve/update/delete_sip_endpoint
 *     at /api/relay/rest/endpoints/sip — TS only has Fabric sipEndpoints
 *     (/api/fabric/...), not the relay-rest /endpoints/sip collection.
 *   - relay-rest domain_applications (5): list/create/retrieve/update/delete_
 *     domain_application at /api/relay/rest/domain_applications — TS only has a
 *     Fabric assignDomainApplication, not this relay-rest collection.
 *
 * Unlike pre-fix java, TS DOES cover verified_caller_ids (7) and
 * lookup_phone_number, so both are exercised here.
 *
 * Companion to tests/rest/phoneNumbers.test.ts and the small_namespaces /
 * registry mock suites; self-contained.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { JournalEntry, MockHarness } from './mocktest.js';
import { RestError } from '../../src/rest/RestError.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- DRY helpers -------------------------------------------------------
//
// Each helper RETURNS the journal entry (or response) so the calling `it()`
// body holds its own real assertions — the no-cheat auditor is intra-function.

/**
 * Await an SDK call, then return its response body alongside the last journal
 * entry. The caller asserts on both.
 */
async function callOk<T>(fn: () => Promise<T>): Promise<{ body: T; last: JournalEntry }> {
  const body = await fn();
  const last = await mock.last();
  return { body, last };
}

/**
 * Arm a one-shot error scenario for `endpointId`, assert the SDK call rejects
 * with RestError, and return the recorded journal entry for body assertions.
 */
async function callErr(
  endpointId: string,
  status: number,
  fn: () => Promise<unknown>,
): Promise<JournalEntry> {
  await mock.pushScenario(endpointId, status, { error: 'x' });
  await expect(fn()).rejects.toThrow(RestError);
  return mock.last();
}

// ---- Phone Numbers -----------------------------------------------------

describe('Phone Numbers', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.phoneNumbers.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/phone_numbers');
    expect(last.matched_route).toBe('relay-rest.list_phone_numbers');
  });
  it('list error 500', async () => {
    const last = await callErr('relay-rest.list_phone_numbers', 500, () =>
      client.phoneNumbers.list(),
    );
    expect(last.matched_route).toBe('relay-rest.list_phone_numbers');
    expect(last.response_status).toBe(500);
  });

  it('purchase (create) success', async () => {
    const { last } = await callOk(() => client.phoneNumbers.create({ number: '+15551234567' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/phone_numbers');
    expect(last.matched_route).toBe('relay-rest.purchase_phone_number');
  });
  it('purchase error 422', async () => {
    const last = await callErr('relay-rest.purchase_phone_number', 422, () =>
      client.phoneNumbers.create({}),
    );
    expect(last.matched_route).toBe('relay-rest.purchase_phone_number');
    expect(last.response_status).toBe(422);
  });

  it('search success', async () => {
    const { body, last } = await callOk(() => client.phoneNumbers.search({ areaCode: '512' }));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/phone_numbers/search');
    expect(last.matched_route).toBe('relay-rest.search_available_phone_numbers');
  });
  it('search error 500', async () => {
    const last = await callErr('relay-rest.search_available_phone_numbers', 500, () =>
      client.phoneNumbers.search({ areaCode: '512' }),
    );
    expect(last.matched_route).toBe('relay-rest.search_available_phone_numbers');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.phoneNumbers.get('pn-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/phone_numbers/pn-1');
    expect(last.matched_route).toBe('relay-rest.retrieve_phone_number');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.retrieve_phone_number', 404, () =>
      client.phoneNumbers.get('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_phone_number');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.phoneNumbers.update('pn-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/phone_numbers/pn-1');
    expect(last.matched_route).toBe('relay-rest.update_phone_number');
  });
  it('update error 404', async () => {
    const last = await callErr('relay-rest.update_phone_number', 404, () =>
      client.phoneNumbers.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('relay-rest.update_phone_number');
    expect(last.response_status).toBe(404);
  });

  it('release (delete) success', async () => {
    const { last } = await callOk(() => client.phoneNumbers.delete('pn-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/phone_numbers/pn-1');
    expect(last.matched_route).toBe('relay-rest.release_phone_number');
  });
  it('release error 404', async () => {
    const last = await callErr('relay-rest.release_phone_number', 404, () =>
      client.phoneNumbers.delete('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.release_phone_number');
    expect(last.response_status).toBe(404);
  });
});

// ---- Addresses ---------------------------------------------------------

describe('Addresses', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.addresses.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/addresses');
    expect(last.matched_route).toBe('relay-rest.list_addresses');
  });
  it('list error 500', async () => {
    const last = await callErr('relay-rest.list_addresses', 500, () => client.addresses.list());
    expect(last.matched_route).toBe('relay-rest.list_addresses');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.addresses.create({ display_name: 'a' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/addresses');
    expect(last.matched_route).toBe('relay-rest.create_address');
  });
  it('create error 422', async () => {
    const last = await callErr('relay-rest.create_address', 422, () => client.addresses.create({}));
    expect(last.matched_route).toBe('relay-rest.create_address');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.addresses.get('addr-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/addresses/addr-1');
    expect(last.matched_route).toBe('relay-rest.get_address');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.get_address', 404, () =>
      client.addresses.get('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.get_address');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.addresses.delete('addr-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/addresses/addr-1');
    expect(last.matched_route).toBe('relay-rest.delete_address');
  });
  it('delete error 404', async () => {
    const last = await callErr('relay-rest.delete_address', 404, () =>
      client.addresses.delete('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.delete_address');
    expect(last.response_status).toBe(404);
  });
});

// ---- Verified Caller IDs -----------------------------------------------

describe('Verified Caller IDs', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.verifiedCallers.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/verified_caller_ids');
    expect(last.matched_route).toBe('relay-rest.list_verified_caller_ids');
  });
  it('list error 500', async () => {
    const last = await callErr('relay-rest.list_verified_caller_ids', 500, () =>
      client.verifiedCallers.list(),
    );
    expect(last.matched_route).toBe('relay-rest.list_verified_caller_ids');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.verifiedCallers.create({ number: '+15551234567' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/verified_caller_ids');
    expect(last.matched_route).toBe('relay-rest.create_verified_caller_id');
  });
  it('create error 422', async () => {
    const last = await callErr('relay-rest.create_verified_caller_id', 422, () =>
      client.verifiedCallers.create({}),
    );
    expect(last.matched_route).toBe('relay-rest.create_verified_caller_id');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.verifiedCallers.get('vci-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/verified_caller_ids/vci-1');
    expect(last.matched_route).toBe('relay-rest.retrieve_verified_caller_id');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.retrieve_verified_caller_id', 404, () =>
      client.verifiedCallers.get('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_verified_caller_id');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.verifiedCallers.update('vci-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/verified_caller_ids/vci-1');
    expect(last.matched_route).toBe('relay-rest.update_verified_caller_id');
  });
  it('update error 404', async () => {
    const last = await callErr('relay-rest.update_verified_caller_id', 404, () =>
      client.verifiedCallers.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('relay-rest.update_verified_caller_id');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.verifiedCallers.delete('vci-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/verified_caller_ids/vci-1');
    expect(last.matched_route).toBe('relay-rest.delete_verified_caller_id');
  });
  it('delete error 404', async () => {
    const last = await callErr('relay-rest.delete_verified_caller_id', 404, () =>
      client.verifiedCallers.delete('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.delete_verified_caller_id');
    expect(last.response_status).toBe(404);
  });

  it('redial verification success (POST)', async () => {
    const { last } = await callOk(() => client.verifiedCallers.redialVerification('vci-1'));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/verified_caller_ids/vci-1/verification');
    expect(last.matched_route).toBe('relay-rest.redial_verification_call');
  });
  it('redial verification error 404', async () => {
    const last = await callErr('relay-rest.redial_verification_call', 404, () =>
      client.verifiedCallers.redialVerification('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.redial_verification_call');
    expect(last.response_status).toBe(404);
  });

  it('submit verification success (PUT)', async () => {
    const { last } = await callOk(() =>
      client.verifiedCallers.submitVerification('vci-1', { verification_code: '1234' }),
    );
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/verified_caller_ids/vci-1/verification');
    expect(last.matched_route).toBe('relay-rest.validate_verification_code');
  });
  it('submit verification error 422', async () => {
    const last = await callErr('relay-rest.validate_verification_code', 422, () =>
      client.verifiedCallers.submitVerification('vci-1', {}),
    );
    expect(last.matched_route).toBe('relay-rest.validate_verification_code');
    expect(last.response_status).toBe(422);
  });
});

// ---- Queues + Members --------------------------------------------------

describe('Queues', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.queues.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/queues');
    expect(last.matched_route).toBe('relay-rest.list_queues');
  });
  it('list error 500', async () => {
    const last = await callErr('relay-rest.list_queues', 500, () => client.queues.list());
    expect(last.matched_route).toBe('relay-rest.list_queues');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.queues.create({ name: 'q' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/queues');
    expect(last.matched_route).toBe('relay-rest.create_queue');
  });
  it('create error 422', async () => {
    const last = await callErr('relay-rest.create_queue', 422, () => client.queues.create({}));
    expect(last.matched_route).toBe('relay-rest.create_queue');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.queues.get('q-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/queues/q-1');
    expect(last.matched_route).toBe('relay-rest.get_queue');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.get_queue', 404, () => client.queues.get('missing'));
    expect(last.matched_route).toBe('relay-rest.get_queue');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.queues.update('q-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/queues/q-1');
    expect(last.matched_route).toBe('relay-rest.update_queue');
  });
  it('update error 404', async () => {
    const last = await callErr('relay-rest.update_queue', 404, () =>
      client.queues.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('relay-rest.update_queue');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.queues.delete('q-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/queues/q-1');
    expect(last.matched_route).toBe('relay-rest.delete_queue');
  });
  it('delete error 404', async () => {
    const last = await callErr('relay-rest.delete_queue', 404, () =>
      client.queues.delete('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.delete_queue');
    expect(last.response_status).toBe(404);
  });

  it('list members success', async () => {
    const { body, last } = await callOk(() => client.queues.listMembers('q-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/queues/q-1/members');
    expect(last.matched_route).toBe('relay-rest.list_queue_members');
  });
  it('list members error 500', async () => {
    const last = await callErr('relay-rest.list_queue_members', 500, () =>
      client.queues.listMembers('q-1'),
    );
    expect(last.matched_route).toBe('relay-rest.list_queue_members');
    expect(last.response_status).toBe(500);
  });

  it('next member success', async () => {
    const { last } = await callOk(() => client.queues.getNextMember('q-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/queues/q-1/members/next');
    expect(last.matched_route).toBe('relay-rest.retrieve_next_queue_member');
  });
  it('next member error 404', async () => {
    const last = await callErr('relay-rest.retrieve_next_queue_member', 404, () =>
      client.queues.getNextMember('q-1'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_next_queue_member');
    expect(last.response_status).toBe(404);
  });

  it('get member success', async () => {
    const { last } = await callOk(() => client.queues.getMember('q-1', 'm-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/queues/q-1/members/m-1');
    expect(last.matched_route).toBe('relay-rest.retrieve_queue_member');
  });
  it('get member error 404', async () => {
    const last = await callErr('relay-rest.retrieve_queue_member', 404, () =>
      client.queues.getMember('q-1', 'missing'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_queue_member');
    expect(last.response_status).toBe(404);
  });
});

// ---- Recordings --------------------------------------------------------

describe('Recordings', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.recordings.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/recordings');
    expect(last.matched_route).toBe('relay-rest.list_recordings');
  });
  it('list error 500', async () => {
    const last = await callErr('relay-rest.list_recordings', 500, () => client.recordings.list());
    expect(last.matched_route).toBe('relay-rest.list_recordings');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.recordings.get('rec-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/recordings/rec-1');
    expect(last.matched_route).toBe('relay-rest.get_recording');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.get_recording', 404, () =>
      client.recordings.get('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.get_recording');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.recordings.delete('rec-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/recordings/rec-1');
    expect(last.matched_route).toBe('relay-rest.delete_recording');
  });
  it('delete error 404', async () => {
    const last = await callErr('relay-rest.delete_recording', 404, () =>
      client.recordings.delete('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.delete_recording');
    expect(last.response_status).toBe(404);
  });
});

// ---- Number Groups + Memberships ---------------------------------------

describe('Number Groups', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.numberGroups.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/number_groups');
    expect(last.matched_route).toBe('relay-rest.list_number_groups');
  });
  it('list error 500', async () => {
    const last = await callErr('relay-rest.list_number_groups', 500, () =>
      client.numberGroups.list(),
    );
    expect(last.matched_route).toBe('relay-rest.list_number_groups');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.numberGroups.create({ name: 'ng' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/number_groups');
    expect(last.matched_route).toBe('relay-rest.create_number_group');
  });
  it('create error 422', async () => {
    const last = await callErr('relay-rest.create_number_group', 422, () =>
      client.numberGroups.create({}),
    );
    expect(last.matched_route).toBe('relay-rest.create_number_group');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.numberGroups.get('ng-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/number_groups/ng-1');
    expect(last.matched_route).toBe('relay-rest.retrieve_number_group');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.retrieve_number_group', 404, () =>
      client.numberGroups.get('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_number_group');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.numberGroups.update('ng-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/number_groups/ng-1');
    expect(last.matched_route).toBe('relay-rest.update_number_group');
  });
  it('update error 404', async () => {
    const last = await callErr('relay-rest.update_number_group', 404, () =>
      client.numberGroups.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('relay-rest.update_number_group');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.numberGroups.delete('ng-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/number_groups/ng-1');
    expect(last.matched_route).toBe('relay-rest.delete_number_group');
  });
  it('delete error 404', async () => {
    const last = await callErr('relay-rest.delete_number_group', 404, () =>
      client.numberGroups.delete('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.delete_number_group');
    expect(last.response_status).toBe(404);
  });

  it('list memberships success', async () => {
    const { body, last } = await callOk(() => client.numberGroups.listMemberships('ng-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/number_groups/ng-1/number_group_memberships');
    expect(last.matched_route).toBe('relay-rest.list_number_group_memberships');
  });
  it('list memberships error 500', async () => {
    const last = await callErr('relay-rest.list_number_group_memberships', 500, () =>
      client.numberGroups.listMemberships('ng-1'),
    );
    expect(last.matched_route).toBe('relay-rest.list_number_group_memberships');
    expect(last.response_status).toBe(500);
  });

  it('add membership success', async () => {
    const { last } = await callOk(() =>
      client.numberGroups.addMembership('ng-1', { phone_number_id: 'pn-1' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/number_groups/ng-1/number_group_memberships');
    expect(last.matched_route).toBe('relay-rest.create_number_group_membership');
  });
  it('add membership error 422', async () => {
    const last = await callErr('relay-rest.create_number_group_membership', 422, () =>
      client.numberGroups.addMembership('ng-1', {}),
    );
    expect(last.matched_route).toBe('relay-rest.create_number_group_membership');
    expect(last.response_status).toBe(422);
  });

  it('get membership success', async () => {
    const { last } = await callOk(() => client.numberGroups.getMembership('mem-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/number_group_memberships/mem-1');
    expect(last.matched_route).toBe('relay-rest.retrieve_number_group_membership');
  });
  it('get membership error 404', async () => {
    const last = await callErr('relay-rest.retrieve_number_group_membership', 404, () =>
      client.numberGroups.getMembership('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_number_group_membership');
    expect(last.response_status).toBe(404);
  });

  it('delete membership success', async () => {
    const { last } = await callOk(() => client.numberGroups.deleteMembership('mem-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/number_group_memberships/mem-1');
    expect(last.matched_route).toBe('relay-rest.delete_number_group_membership');
  });
  it('delete membership error 404', async () => {
    const last = await callErr('relay-rest.delete_number_group_membership', 404, () =>
      client.numberGroups.deleteMembership('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.delete_number_group_membership');
    expect(last.response_status).toBe(404);
  });
});

// ---- Short Codes -------------------------------------------------------

describe('Short Codes', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.shortCodes.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/short_codes');
    expect(last.matched_route).toBe('relay-rest.list_short_codes');
  });
  it('list error 500', async () => {
    const last = await callErr('relay-rest.list_short_codes', 500, () => client.shortCodes.list());
    expect(last.matched_route).toBe('relay-rest.list_short_codes');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.shortCodes.get('sc-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/short_codes/sc-1');
    expect(last.matched_route).toBe('relay-rest.retrieve_short_code');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.retrieve_short_code', 404, () =>
      client.shortCodes.get('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_short_code');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.shortCodes.update('sc-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/short_codes/sc-1');
    expect(last.matched_route).toBe('relay-rest.update_short_code');
  });
  it('update error 404', async () => {
    const last = await callErr('relay-rest.update_short_code', 404, () =>
      client.shortCodes.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('relay-rest.update_short_code');
    expect(last.response_status).toBe(404);
  });
});

// ---- Imported Phone Numbers --------------------------------------------

describe('Imported Phone Numbers', () => {
  it('create success', async () => {
    const { last } = await callOk(() => client.importedNumbers.create({ number: '+15551234567' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/imported_phone_numbers');
    expect(last.matched_route).toBe('relay-rest.create_imported_phone_number');
  });
  it('create error 422', async () => {
    const last = await callErr('relay-rest.create_imported_phone_number', 422, () =>
      client.importedNumbers.create({}),
    );
    expect(last.matched_route).toBe('relay-rest.create_imported_phone_number');
    expect(last.response_status).toBe(422);
  });
});

// ---- MFA ---------------------------------------------------------------

describe('MFA', () => {
  it('request sms success', async () => {
    const { last } = await callOk(() => client.mfa.sms({ to: '+15551234567' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/mfa/sms');
    expect(last.matched_route).toBe('relay-rest.request_mfa_sms');
  });
  it('request sms error 422', async () => {
    const last = await callErr('relay-rest.request_mfa_sms', 422, () => client.mfa.sms({}));
    expect(last.matched_route).toBe('relay-rest.request_mfa_sms');
    expect(last.response_status).toBe(422);
  });

  it('request call success', async () => {
    const { last } = await callOk(() => client.mfa.call({ to: '+15551234567' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/mfa/call');
    expect(last.matched_route).toBe('relay-rest.request_mfa_call');
  });
  it('request call error 422', async () => {
    const last = await callErr('relay-rest.request_mfa_call', 422, () => client.mfa.call({}));
    expect(last.matched_route).toBe('relay-rest.request_mfa_call');
    expect(last.response_status).toBe(422);
  });

  it('verify success', async () => {
    const { last } = await callOk(() => client.mfa.verify('mfa-1', { token: '123456' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/mfa/mfa-1/verify');
    expect(last.matched_route).toBe('relay-rest.verify_mfa_token');
  });
  it('verify error 422', async () => {
    const last = await callErr('relay-rest.verify_mfa_token', 422, () =>
      client.mfa.verify('mfa-1', {}),
    );
    expect(last.matched_route).toBe('relay-rest.verify_mfa_token');
    expect(last.response_status).toBe(422);
  });
});

// ---- SIP Profile (singleton) -------------------------------------------

describe('SIP Profile', () => {
  it('get success', async () => {
    const { last } = await callOk(() => client.sipProfile.get());
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/sip_profile');
    expect(last.matched_route).toBe('relay-rest.retrieve_sip_profile');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.retrieve_sip_profile', 404, () =>
      client.sipProfile.get(),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_sip_profile');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.sipProfile.update({ domain: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/sip_profile');
    expect(last.matched_route).toBe('relay-rest.update_sip_profile');
  });
  it('update error 422', async () => {
    const last = await callErr('relay-rest.update_sip_profile', 422, () =>
      client.sipProfile.update({}),
    );
    expect(last.matched_route).toBe('relay-rest.update_sip_profile');
    expect(last.response_status).toBe(422);
  });
});

// ---- Lookup ------------------------------------------------------------

describe('Lookup', () => {
  it('phone number success', async () => {
    const { last } = await callOk(() => client.lookup.phoneNumber('+15551234567'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/lookup/phone_number/+15551234567');
    expect(last.matched_route).toBe('relay-rest.lookup_phone_number');
  });
  it('phone number error 404', async () => {
    const last = await callErr('relay-rest.lookup_phone_number', 404, () =>
      client.lookup.phoneNumber('+15550000000'),
    );
    expect(last.matched_route).toBe('relay-rest.lookup_phone_number');
    expect(last.response_status).toBe(404);
  });
});

// ---- 10DLC Registry: Brands --------------------------------------------

describe('Registry Brands', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.registry.brands.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/registry/beta/brands');
    expect(last.matched_route).toBe('relay-rest.list_brands');
  });
  it('list error 500', async () => {
    const last = await callErr('relay-rest.list_brands', 500, () => client.registry.brands.list());
    expect(last.matched_route).toBe('relay-rest.list_brands');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.registry.brands.create({ name: 'b' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/registry/beta/brands');
    expect(last.matched_route).toBe('relay-rest.create_brand');
  });
  it('create error 422', async () => {
    const last = await callErr('relay-rest.create_brand', 422, () =>
      client.registry.brands.create({}),
    );
    expect(last.matched_route).toBe('relay-rest.create_brand');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.registry.brands.get('brand-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/registry/beta/brands/brand-1');
    expect(last.matched_route).toBe('relay-rest.retrieve_brand');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.retrieve_brand', 404, () =>
      client.registry.brands.get('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_brand');
    expect(last.response_status).toBe(404);
  });

  it('list campaigns success', async () => {
    const { body, last } = await callOk(() => client.registry.brands.listCampaigns('brand-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/registry/beta/brands/brand-1/campaigns');
    expect(last.matched_route).toBe('relay-rest.list_campaigns');
  });
  it('list campaigns error 500', async () => {
    const last = await callErr('relay-rest.list_campaigns', 500, () =>
      client.registry.brands.listCampaigns('brand-1'),
    );
    expect(last.matched_route).toBe('relay-rest.list_campaigns');
    expect(last.response_status).toBe(500);
  });

  it('create campaign success', async () => {
    const { last } = await callOk(() =>
      client.registry.brands.createCampaign('brand-1', { name: 'c' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/registry/beta/brands/brand-1/campaigns');
    expect(last.matched_route).toBe('relay-rest.create_campaign');
  });
  it('create campaign error 422', async () => {
    const last = await callErr('relay-rest.create_campaign', 422, () =>
      client.registry.brands.createCampaign('brand-1', {}),
    );
    expect(last.matched_route).toBe('relay-rest.create_campaign');
    expect(last.response_status).toBe(422);
  });
});

// ---- 10DLC Registry: Campaigns -----------------------------------------

describe('Registry Campaigns', () => {
  it('get success', async () => {
    const { last } = await callOk(() => client.registry.campaigns.get('camp-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/registry/beta/campaigns/camp-1');
    expect(last.matched_route).toBe('relay-rest.retrieve_campaign');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.retrieve_campaign', 404, () =>
      client.registry.campaigns.get('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_campaign');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.registry.campaigns.update('camp-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/relay/rest/registry/beta/campaigns/camp-1');
    expect(last.matched_route).toBe('relay-rest.update_campaign');
  });
  it('update error 404', async () => {
    const last = await callErr('relay-rest.update_campaign', 404, () =>
      client.registry.campaigns.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('relay-rest.update_campaign');
    expect(last.response_status).toBe(404);
  });

  it('list numbers success', async () => {
    const { body, last } = await callOk(() => client.registry.campaigns.listNumbers('camp-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/registry/beta/campaigns/camp-1/numbers');
    expect(last.matched_route).toBe('relay-rest.list_number_assignments');
  });
  it('list numbers error 500', async () => {
    const last = await callErr('relay-rest.list_number_assignments', 500, () =>
      client.registry.campaigns.listNumbers('camp-1'),
    );
    expect(last.matched_route).toBe('relay-rest.list_number_assignments');
    expect(last.response_status).toBe(500);
  });

  it('list orders success', async () => {
    const { body, last } = await callOk(() => client.registry.campaigns.listOrders('camp-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/registry/beta/campaigns/camp-1/orders');
    expect(last.matched_route).toBe('relay-rest.list_orders');
  });
  it('list orders error 500', async () => {
    const last = await callErr('relay-rest.list_orders', 500, () =>
      client.registry.campaigns.listOrders('camp-1'),
    );
    expect(last.matched_route).toBe('relay-rest.list_orders');
    expect(last.response_status).toBe(500);
  });

  it('create order success', async () => {
    const { last } = await callOk(() => client.registry.campaigns.createOrder('camp-1', {}));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/relay/rest/registry/beta/campaigns/camp-1/orders');
    expect(last.matched_route).toBe('relay-rest.create_order');
  });
  it('create order error 422', async () => {
    const last = await callErr('relay-rest.create_order', 422, () =>
      client.registry.campaigns.createOrder('camp-1', {}),
    );
    expect(last.matched_route).toBe('relay-rest.create_order');
    expect(last.response_status).toBe(422);
  });
});

// ---- 10DLC Registry: Orders --------------------------------------------

describe('Registry Orders', () => {
  it('get success', async () => {
    const { last } = await callOk(() => client.registry.orders.get('order-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/relay/rest/registry/beta/orders/order-1');
    expect(last.matched_route).toBe('relay-rest.retrieve_order');
  });
  it('get error 404', async () => {
    const last = await callErr('relay-rest.retrieve_order', 404, () =>
      client.registry.orders.get('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.retrieve_order');
    expect(last.response_status).toBe(404);
  });
});

// ---- 10DLC Registry: Number Assignments --------------------------------

describe('Registry Number Assignments', () => {
  it('delete success', async () => {
    const { last } = await callOk(() => client.registry.numbers.delete('num-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/relay/rest/registry/beta/numbers/num-1');
    expect(last.matched_route).toBe('relay-rest.delete_number_assignment');
  });
  it('delete error 404', async () => {
    const last = await callErr('relay-rest.delete_number_assignment', 404, () =>
      client.registry.numbers.delete('missing'),
    );
    expect(last.matched_route).toBe('relay-rest.delete_number_assignment');
    expect(last.response_status).toBe(404);
  });
});
