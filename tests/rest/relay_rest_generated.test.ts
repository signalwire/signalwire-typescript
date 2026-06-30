/**
 * AUTO-GENERATED REST wire tests for the `relay-rest` namespace — DO NOT EDIT.
 * Regenerate: npx tsx scripts/generate-rest-tests.ts
 *
 * Each route the SDK implements (captured from the real client by scripts/route-registry.ts,
 * joined to the spec operationId) gets a SUCCESS test (call it, assert method + matched_route on
 * the mock journal) and an ERROR test (arm a 5xx, assert RestError). The assertion oracle is the
 * spec operationId — independent of the resource generator — so these catch SDK-vs-contract
 * drift, not a generator self-snapshot. Full-mock harness fixtures.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';
import { RestError } from '../../src/rest/RestError.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

describe('relay-rest wire (generated)', () => {
  it('addresses_create success', async () => {
    await client.addresses.create('x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.create_address');
  });

  it('addresses_create error', async () => {
    await mock.pushScenario('relay-rest.create_address', 500, { error: 'x' });
    await expect(
      client.addresses.create('x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('addresses_delete success', async () => {
    await client.addresses.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('relay-rest.delete_address');
  });

  it('addresses_delete error', async () => {
    await mock.pushScenario('relay-rest.delete_address', 500, { error: 'x' });
    await expect(client.addresses.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('addresses_get success', async () => {
    await client.addresses.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.get_address');
  });

  it('addresses_get error', async () => {
    await mock.pushScenario('relay-rest.get_address', 500, { error: 'x' });
    await expect(client.addresses.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('addresses_list success', async () => {
    await client.addresses.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_addresses');
  });

  it('addresses_list error', async () => {
    await mock.pushScenario('relay-rest.list_addresses', 500, { error: 'x' });
    await expect(client.addresses.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('importedNumbers_create success', async () => {
    await client.importedNumbers.create('x', 'longcode');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.create_imported_phone_number');
  });

  it('importedNumbers_create error', async () => {
    await mock.pushScenario('relay-rest.create_imported_phone_number', 500, { error: 'x' });
    await expect(client.importedNumbers.create('x', 'longcode')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('lookup_phoneNumber success', async () => {
    await client.lookup.phoneNumber('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.lookup_phone_number');
  });

  it('lookup_phoneNumber error', async () => {
    await mock.pushScenario('relay-rest.lookup_phone_number', 500, { error: 'x' });
    await expect(client.lookup.phoneNumber('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('mfa_call success', async () => {
    await client.mfa.call('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.request_mfa_call');
  });

  it('mfa_call error', async () => {
    await mock.pushScenario('relay-rest.request_mfa_call', 500, { error: 'x' });
    await expect(client.mfa.call('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('mfa_sms success', async () => {
    await client.mfa.sms('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.request_mfa_sms');
  });

  it('mfa_sms error', async () => {
    await mock.pushScenario('relay-rest.request_mfa_sms', 500, { error: 'x' });
    await expect(client.mfa.sms('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('mfa_verify success', async () => {
    await client.mfa.verify('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.verify_mfa_token');
  });

  it('mfa_verify error', async () => {
    await mock.pushScenario('relay-rest.verify_mfa_token', 500, { error: 'x' });
    await expect(client.mfa.verify('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numberGroups_addMembership success', async () => {
    await client.numberGroups.addMembership('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.create_number_group_membership');
  });

  it('numberGroups_addMembership error', async () => {
    await mock.pushScenario('relay-rest.create_number_group_membership', 500, { error: 'x' });
    await expect(client.numberGroups.addMembership('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numberGroups_create success', async () => {
    await client.numberGroups.create({});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.create_number_group');
  });

  it('numberGroups_create error', async () => {
    await mock.pushScenario('relay-rest.create_number_group', 500, { error: 'x' });
    await expect(client.numberGroups.create({})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numberGroups_delete success', async () => {
    await client.numberGroups.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('relay-rest.delete_number_group');
  });

  it('numberGroups_delete error', async () => {
    await mock.pushScenario('relay-rest.delete_number_group', 500, { error: 'x' });
    await expect(client.numberGroups.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numberGroups_deleteMembership success', async () => {
    await client.numberGroups.deleteMembership('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('relay-rest.delete_number_group_membership');
  });

  it('numberGroups_deleteMembership error', async () => {
    await mock.pushScenario('relay-rest.delete_number_group_membership', 500, { error: 'x' });
    await expect(client.numberGroups.deleteMembership('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numberGroups_get success', async () => {
    await client.numberGroups.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_number_group');
  });

  it('numberGroups_get error', async () => {
    await mock.pushScenario('relay-rest.retrieve_number_group', 500, { error: 'x' });
    await expect(client.numberGroups.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numberGroups_getMembership success', async () => {
    await client.numberGroups.getMembership('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_number_group_membership');
  });

  it('numberGroups_getMembership error', async () => {
    await mock.pushScenario('relay-rest.retrieve_number_group_membership', 500, { error: 'x' });
    await expect(client.numberGroups.getMembership('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numberGroups_list success', async () => {
    await client.numberGroups.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_number_groups');
  });

  it('numberGroups_list error', async () => {
    await mock.pushScenario('relay-rest.list_number_groups', 500, { error: 'x' });
    await expect(client.numberGroups.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numberGroups_listMemberships success', async () => {
    await client.numberGroups.listMemberships('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_number_group_memberships');
  });

  it('numberGroups_listMemberships error', async () => {
    await mock.pushScenario('relay-rest.list_number_group_memberships', 500, { error: 'x' });
    await expect(client.numberGroups.listMemberships('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numberGroups_update success', async () => {
    await client.numberGroups.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('relay-rest.update_number_group');
  });

  it('numberGroups_update error', async () => {
    await mock.pushScenario('relay-rest.update_number_group', 500, { error: 'x' });
    await expect(client.numberGroups.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('phoneNumbers_create success', async () => {
    await client.phoneNumbers.create({});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.purchase_phone_number');
  });

  it('phoneNumbers_create error', async () => {
    await mock.pushScenario('relay-rest.purchase_phone_number', 500, { error: 'x' });
    await expect(client.phoneNumbers.create({})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('phoneNumbers_delete success', async () => {
    await client.phoneNumbers.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('relay-rest.release_phone_number');
  });

  it('phoneNumbers_delete error', async () => {
    await mock.pushScenario('relay-rest.release_phone_number', 500, { error: 'x' });
    await expect(client.phoneNumbers.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('phoneNumbers_get success', async () => {
    await client.phoneNumbers.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_phone_number');
  });

  it('phoneNumbers_get error', async () => {
    await mock.pushScenario('relay-rest.retrieve_phone_number', 500, { error: 'x' });
    await expect(client.phoneNumbers.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('phoneNumbers_list success', async () => {
    await client.phoneNumbers.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_phone_numbers');
  });

  it('phoneNumbers_list error', async () => {
    await mock.pushScenario('relay-rest.list_phone_numbers', 500, { error: 'x' });
    await expect(client.phoneNumbers.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('phoneNumbers_search success', async () => {
    await client.phoneNumbers.search();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.search_available_phone_numbers');
  });

  it('phoneNumbers_search error', async () => {
    await mock.pushScenario('relay-rest.search_available_phone_numbers', 500, { error: 'x' });
    await expect(client.phoneNumbers.search()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('phoneNumbers_setAiAgent success', async () => {
    await client.phoneNumbers.setAiAgent('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('relay-rest.update_phone_number');
  });

  it('phoneNumbers_setAiAgent error', async () => {
    await mock.pushScenario('relay-rest.update_phone_number', 500, { error: 'x' });
    await expect(client.phoneNumbers.setAiAgent('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('queues_create success', async () => {
    await client.queues.create({});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.create_queue');
  });

  it('queues_create error', async () => {
    await mock.pushScenario('relay-rest.create_queue', 500, { error: 'x' });
    await expect(client.queues.create({})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('queues_delete success', async () => {
    await client.queues.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('relay-rest.delete_queue');
  });

  it('queues_delete error', async () => {
    await mock.pushScenario('relay-rest.delete_queue', 500, { error: 'x' });
    await expect(client.queues.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('queues_get success', async () => {
    await client.queues.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.get_queue');
  });

  it('queues_get error', async () => {
    await mock.pushScenario('relay-rest.get_queue', 500, { error: 'x' });
    await expect(client.queues.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('queues_getMember success', async () => {
    await client.queues.getMember('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_queue_member');
  });

  it('queues_getMember error', async () => {
    await mock.pushScenario('relay-rest.retrieve_queue_member', 500, { error: 'x' });
    await expect(client.queues.getMember('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('queues_getNextMember success', async () => {
    await client.queues.getNextMember('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_next_queue_member');
  });

  it('queues_getNextMember error', async () => {
    await mock.pushScenario('relay-rest.retrieve_next_queue_member', 500, { error: 'x' });
    await expect(client.queues.getNextMember('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('queues_list success', async () => {
    await client.queues.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_queues');
  });

  it('queues_list error', async () => {
    await mock.pushScenario('relay-rest.list_queues', 500, { error: 'x' });
    await expect(client.queues.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('queues_listMembers success', async () => {
    await client.queues.listMembers('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_queue_members');
  });

  it('queues_listMembers error', async () => {
    await mock.pushScenario('relay-rest.list_queue_members', 500, { error: 'x' });
    await expect(client.queues.listMembers('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('queues_update success', async () => {
    await client.queues.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('relay-rest.update_queue');
  });

  it('queues_update error', async () => {
    await mock.pushScenario('relay-rest.update_queue', 500, { error: 'x' });
    await expect(client.queues.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('recordings_delete success', async () => {
    await client.recordings.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('relay-rest.delete_recording');
  });

  it('recordings_delete error', async () => {
    await mock.pushScenario('relay-rest.delete_recording', 500, { error: 'x' });
    await expect(client.recordings.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('recordings_get success', async () => {
    await client.recordings.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.get_recording');
  });

  it('recordings_get error', async () => {
    await mock.pushScenario('relay-rest.get_recording', 500, { error: 'x' });
    await expect(client.recordings.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('recordings_list success', async () => {
    await client.recordings.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_recordings');
  });

  it('recordings_list error', async () => {
    await mock.pushScenario('relay-rest.list_recordings', 500, { error: 'x' });
    await expect(client.recordings.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('brands_createCampaign success', async () => {
    await client.registry.brands.createCampaign('x', {});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.create_campaign');
  });

  it('brands_createCampaign error', async () => {
    await mock.pushScenario('relay-rest.create_campaign', 500, { error: 'x' });
    await expect(client.registry.brands.createCampaign('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('brands_create success', async () => {
    await client.registry.brands.create({});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.create_brand');
  });

  it('brands_create error', async () => {
    await mock.pushScenario('relay-rest.create_brand', 500, { error: 'x' });
    await expect(client.registry.brands.create({})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('brands_get success', async () => {
    await client.registry.brands.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_brand');
  });

  it('brands_get error', async () => {
    await mock.pushScenario('relay-rest.retrieve_brand', 500, { error: 'x' });
    await expect(client.registry.brands.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('brands_listCampaigns success', async () => {
    await client.registry.brands.listCampaigns('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_campaigns');
  });

  it('brands_listCampaigns error', async () => {
    await mock.pushScenario('relay-rest.list_campaigns', 500, { error: 'x' });
    await expect(client.registry.brands.listCampaigns('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('brands_list success', async () => {
    await client.registry.brands.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_brands');
  });

  it('brands_list error', async () => {
    await mock.pushScenario('relay-rest.list_brands', 500, { error: 'x' });
    await expect(client.registry.brands.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('campaigns_createOrder success', async () => {
    await client.registry.campaigns.createOrder('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.create_order');
  });

  it('campaigns_createOrder error', async () => {
    await mock.pushScenario('relay-rest.create_order', 500, { error: 'x' });
    await expect(client.registry.campaigns.createOrder('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('campaigns_get success', async () => {
    await client.registry.campaigns.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_campaign');
  });

  it('campaigns_get error', async () => {
    await mock.pushScenario('relay-rest.retrieve_campaign', 500, { error: 'x' });
    await expect(client.registry.campaigns.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('campaigns_listNumbers success', async () => {
    await client.registry.campaigns.listNumbers('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_number_assignments');
  });

  it('campaigns_listNumbers error', async () => {
    await mock.pushScenario('relay-rest.list_number_assignments', 500, { error: 'x' });
    await expect(client.registry.campaigns.listNumbers('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('campaigns_listOrders success', async () => {
    await client.registry.campaigns.listOrders('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_orders');
  });

  it('campaigns_listOrders error', async () => {
    await mock.pushScenario('relay-rest.list_orders', 500, { error: 'x' });
    await expect(client.registry.campaigns.listOrders('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('campaigns_update success', async () => {
    await client.registry.campaigns.update('x');
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('relay-rest.update_campaign');
  });

  it('campaigns_update error', async () => {
    await mock.pushScenario('relay-rest.update_campaign', 500, { error: 'x' });
    await expect(client.registry.campaigns.update('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('numbers_delete success', async () => {
    await client.registry.numbers.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('relay-rest.delete_number_assignment');
  });

  it('numbers_delete error', async () => {
    await mock.pushScenario('relay-rest.delete_number_assignment', 500, { error: 'x' });
    await expect(client.registry.numbers.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('orders_get success', async () => {
    await client.registry.orders.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_order');
  });

  it('orders_get error', async () => {
    await mock.pushScenario('relay-rest.retrieve_order', 500, { error: 'x' });
    await expect(client.registry.orders.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('shortCodes_get success', async () => {
    await client.shortCodes.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_short_code');
  });

  it('shortCodes_get error', async () => {
    await mock.pushScenario('relay-rest.retrieve_short_code', 500, { error: 'x' });
    await expect(client.shortCodes.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('shortCodes_list success', async () => {
    await client.shortCodes.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_short_codes');
  });

  it('shortCodes_list error', async () => {
    await mock.pushScenario('relay-rest.list_short_codes', 500, { error: 'x' });
    await expect(client.shortCodes.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('shortCodes_update success', async () => {
    await client.shortCodes.update('x', 'x', 'relay_context');
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('relay-rest.update_short_code');
  });

  it('shortCodes_update error', async () => {
    await mock.pushScenario('relay-rest.update_short_code', 500, { error: 'x' });
    await expect(client.shortCodes.update('x', 'x', 'relay_context')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipProfile_get success', async () => {
    await client.sipProfile.get();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_sip_profile');
  });

  it('sipProfile_get error', async () => {
    await mock.pushScenario('relay-rest.retrieve_sip_profile', 500, { error: 'x' });
    await expect(client.sipProfile.get()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipProfile_update success', async () => {
    await client.sipProfile.update();
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('relay-rest.update_sip_profile');
  });

  it('sipProfile_update error', async () => {
    await mock.pushScenario('relay-rest.update_sip_profile', 500, { error: 'x' });
    await expect(client.sipProfile.update()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('verifiedCallers_create success', async () => {
    await client.verifiedCallers.create({});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.create_verified_caller_id');
  });

  it('verifiedCallers_create error', async () => {
    await mock.pushScenario('relay-rest.create_verified_caller_id', 500, { error: 'x' });
    await expect(client.verifiedCallers.create({})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('verifiedCallers_delete success', async () => {
    await client.verifiedCallers.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('relay-rest.delete_verified_caller_id');
  });

  it('verifiedCallers_delete error', async () => {
    await mock.pushScenario('relay-rest.delete_verified_caller_id', 500, { error: 'x' });
    await expect(client.verifiedCallers.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('verifiedCallers_get success', async () => {
    await client.verifiedCallers.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.retrieve_verified_caller_id');
  });

  it('verifiedCallers_get error', async () => {
    await mock.pushScenario('relay-rest.retrieve_verified_caller_id', 500, { error: 'x' });
    await expect(client.verifiedCallers.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('verifiedCallers_list success', async () => {
    await client.verifiedCallers.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('relay-rest.list_verified_caller_ids');
  });

  it('verifiedCallers_list error', async () => {
    await mock.pushScenario('relay-rest.list_verified_caller_ids', 500, { error: 'x' });
    await expect(client.verifiedCallers.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('verifiedCallers_redialVerification success', async () => {
    await client.verifiedCallers.redialVerification('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('relay-rest.redial_verification_call');
  });

  it('verifiedCallers_redialVerification error', async () => {
    await mock.pushScenario('relay-rest.redial_verification_call', 500, { error: 'x' });
    await expect(client.verifiedCallers.redialVerification('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('verifiedCallers_submitVerification success', async () => {
    await client.verifiedCallers.submitVerification('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('relay-rest.validate_verification_code');
  });

  it('verifiedCallers_submitVerification error', async () => {
    await mock.pushScenario('relay-rest.validate_verification_code', 500, { error: 'x' });
    await expect(client.verifiedCallers.submitVerification('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('verifiedCallers_update success', async () => {
    await client.verifiedCallers.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('relay-rest.update_verified_caller_id');
  });

  it('verifiedCallers_update error', async () => {
    await mock.pushScenario('relay-rest.update_verified_caller_id', 500, { error: 'x' });
    await expect(client.verifiedCallers.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
