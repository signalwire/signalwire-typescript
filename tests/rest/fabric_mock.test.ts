/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_fabric_mock.py.
 *
 * Closes Fabric coverage gaps: addresses, generic resources, SIP-endpoint
 * sub-resources on subscribers, call_flow / conference_room addresses
 * sub-paths, FabricTokens surface, and CxmlApplications create-rejection.
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

// ---- Fabric Addresses --------------------------------------------------

describe('FabricAddresses', () => {
  it('list_returns_data_collection', async () => {
    const body = await client.fabric.addresses.list();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/addresses');
    expect(last.matched_route).toBe('fabric.list_fabric_addresses');
  });

  it('get_uses_address_id', async () => {
    const body = await client.fabric.addresses.get('addr-9001');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/addresses/addr-9001');
    expect(last.matched_route).not.toBeNull();
  });
});

// ---- CxmlApplications.create — deliberate rejection --------------------

describe('CxmlApplications.create', () => {
  it('create_raises_not_implemented', async () => {
    await expect(
      // @ts-expect-error - create on this resource is overridden to throw
      client.fabric.cxmlApplications.create({ name: 'never_built' }),
    ).rejects.toThrow(/cXML applications cannot/);
    // Nothing should have hit the wire.
    const journal = await mock.journal();
    expect(journal.length).toBe(0);
  });
});

// ---- CallFlows.list_addresses uses singular path -----------------------

describe('CallFlows.listAddresses', () => {
  it('list_addresses_uses_singular_path', async () => {
    const body = await client.fabric.callFlows.listAddresses('cf-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    // singular 'call_flow' (NOT 'call_flows') in the addresses sub-path.
    expect(last.path).toBe('/api/fabric/resources/call_flow/cf-1/addresses');
    expect(last.matched_route).not.toBeNull();
  });
});

// ---- ConferenceRooms.list_addresses uses singular path -----------------

describe('ConferenceRooms.listAddresses', () => {
  it('list_addresses_uses_singular_path', async () => {
    const body = await client.fabric.conferenceRooms.listAddresses('cr-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    // singular 'conference_room' segment.
    expect(last.path).toBe('/api/fabric/resources/conference_room/cr-1/addresses');
    expect(last.matched_route).not.toBeNull();
  });
});

// ---- Subscribers — SIP endpoint per-id ops -----------------------------

describe('Subscribers SIP endpoint ops', () => {
  it('get_sip_endpoint', async () => {
    const body = await client.fabric.subscribers.getSipEndpoint('sub-1', 'ep-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1/sip_endpoints/ep-1');
    expect(last.matched_route).not.toBeNull();
  });

  it('update_sip_endpoint_uses_patch', async () => {
    const body = await client.fabric.subscribers.updateSipEndpoint('sub-1', 'ep-1', {
      username: 'renamed',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1/sip_endpoints/ep-1');
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect(last.body.username).toBe('renamed');
  });

  it('delete_sip_endpoint', async () => {
    const body = await client.fabric.subscribers.deleteSipEndpoint('sub-1', 'ep-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1/sip_endpoints/ep-1');
    expect(last.matched_route).not.toBeNull();
  });
});

// ---- FabricTokens — every token endpoint -------------------------------

describe('FabricTokens', () => {
  it('create_invite_token', async () => {
    const body = await client.fabric.tokens.createInviteToken({
      email: 'invitee@example.com',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('POST');
    // subscriber/invites uses the singular 'subscriber' path segment.
    expect(last.path).toBe('/api/fabric/subscriber/invites');
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect(last.body.email).toBe('invitee@example.com');
  });

  it('create_embed_token', async () => {
    const body = await client.fabric.tokens.createEmbedToken({
      allowed_addresses: ['addr-1', 'addr-2'],
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/embeds/tokens');
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect(last.body.allowed_addresses).toEqual(['addr-1', 'addr-2']);
  });

  it('refresh_subscriber_token', async () => {
    const body = await client.fabric.tokens.refreshSubscriberToken({
      refresh_token: 'abc-123',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/subscribers/tokens/refresh');
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect(last.body.refresh_token).toBe('abc-123');
  });
});

// ---- GenericResources --------------------------------------------------

describe('GenericResources', () => {
  it('list_returns_data_collection', async () => {
    const body = await client.fabric.resources.list();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources');
    expect(last.matched_route).not.toBeNull();
  });

  it('get_returns_single_resource', async () => {
    const body = await client.fabric.resources.get('res-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/res-1');
  });

  it('delete', async () => {
    const body = await client.fabric.resources.delete('res-2');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/res-2');
    expect(last.matched_route).not.toBeNull();
  });

  it('list_addresses', async () => {
    const body = await client.fabric.resources.listAddresses('res-3');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/res-3/addresses');
  });

  it('assign_domain_application', async () => {
    const body = await client.fabric.resources.assignDomainApplication('res-4', {
      domain_application_id: 'da-7',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/res-4/domain_applications');
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect(last.body.domain_application_id).toBe('da-7');
  });
});
