/**
 * Full REST success + error coverage for the `fabric` spec group.
 *
 * Mirrors the proven python/java suites: every coverable canonical fabric
 * route (96 of 103) gets BOTH a success (2xx) test and an error (4xx/5xx)
 * test, asserting method, path, matched_route, and (for errors)
 * response_status against the mock journal.
 *
 * Gaps (7, same as python/java — NOT faked):
 *   - fabric.list_dialogflow_agents / get / update / delete /
 *     list_dialogflow_agent_addresses (5) — no SDK surface.
 *   - fabric.list_sip_gateway_addresses (doubled-path artifact:
 *     /sip_gateways/resources/sip_gateways/{resource_id}/addresses).
 *   - fabric.assign_resource_sip_endpoint (doubled-path artifact:
 *     /sip_endpoints/resources/{id}/sip_endpoints).
 *
 * Companion to tests/rest/fabric_mock.test.ts (idiom); self-contained.
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

// ---- Fabric Addresses --------------------------------------------------

describe('Fabric Addresses', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.addresses.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/addresses');
    expect(last.matched_route).toBe('fabric.list_fabric_addresses');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_fabric_addresses', 500, () =>
      client.fabric.addresses.list(),
    );
    expect(last.matched_route).toBe('fabric.list_fabric_addresses');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.addresses.get('addr-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/addresses/addr-1');
    expect(last.matched_route).toBe('fabric.get_fabric_address');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_fabric_address', 404, () =>
      client.fabric.addresses.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_fabric_address');
    expect(last.response_status).toBe(404);
  });
});

// ---- Fabric Tokens -----------------------------------------------------

describe('Fabric Tokens', () => {
  it('create embeds token success', async () => {
    const { last } = await callOk(() => client.fabric.tokens.createEmbedToken({}));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/embeds/tokens');
    expect(last.matched_route).toBe('fabric.create_embeds_token');
  });
  it('create embeds token error 422', async () => {
    const last = await callErr('fabric.create_embeds_token', 422, () =>
      client.fabric.tokens.createEmbedToken({}),
    );
    expect(last.matched_route).toBe('fabric.create_embeds_token');
    expect(last.response_status).toBe(422);
  });

  it('create guest token success', async () => {
    const { last } = await callOk(() => client.fabric.tokens.createGuestToken({}));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/guests/tokens');
    expect(last.matched_route).toBe('fabric.create_subscriber_guest_token');
  });
  it('create guest token error 422', async () => {
    const last = await callErr('fabric.create_subscriber_guest_token', 422, () =>
      client.fabric.tokens.createGuestToken({}),
    );
    expect(last.matched_route).toBe('fabric.create_subscriber_guest_token');
    expect(last.response_status).toBe(422);
  });

  it('create invite token success', async () => {
    const { last } = await callOk(() =>
      client.fabric.tokens.createInviteToken({ email: 'a@b.com' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/subscriber/invites');
    expect(last.matched_route).toBe('fabric.create_subscriber_invite_token');
  });
  it('create invite token error 422', async () => {
    const last = await callErr('fabric.create_subscriber_invite_token', 422, () =>
      client.fabric.tokens.createInviteToken({}),
    );
    expect(last.matched_route).toBe('fabric.create_subscriber_invite_token');
    expect(last.response_status).toBe(422);
  });

  it('create subscriber token success', async () => {
    const { last } = await callOk(() => client.fabric.tokens.createSubscriberToken({}));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/subscribers/tokens');
    expect(last.matched_route).toBe('fabric.create_subscriber_token');
  });
  it('create subscriber token error 422', async () => {
    const last = await callErr('fabric.create_subscriber_token', 422, () =>
      client.fabric.tokens.createSubscriberToken({}),
    );
    expect(last.matched_route).toBe('fabric.create_subscriber_token');
    expect(last.response_status).toBe(422);
  });

  it('refresh subscriber token success', async () => {
    const { last } = await callOk(() =>
      client.fabric.tokens.refreshSubscriberToken({ refresh_token: 'r-1' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/subscribers/tokens/refresh');
    expect(last.matched_route).toBe('fabric.refresh_subscriber_token');
  });
  it('refresh subscriber token error 422', async () => {
    const last = await callErr('fabric.refresh_subscriber_token', 422, () =>
      client.fabric.tokens.refreshSubscriberToken({}),
    );
    expect(last.matched_route).toBe('fabric.refresh_subscriber_token');
    expect(last.response_status).toBe(422);
  });
});

// ---- Generic Resources -------------------------------------------------

describe('Generic Resources', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.resources.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources');
    expect(last.matched_route).toBe('fabric.list_resources');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_resources', 500, () => client.fabric.resources.list());
    expect(last.matched_route).toBe('fabric.list_resources');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.resources.get('res-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/res-1');
    expect(last.matched_route).toBe('fabric.get_resource');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_resource', 404, () =>
      client.fabric.resources.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_resource');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.resources.delete('res-2'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/res-2');
    expect(last.matched_route).toBe('fabric.delete_resource');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_resource', 404, () =>
      client.fabric.resources.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_resource');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() => client.fabric.resources.listAddresses('res-3'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/res-3/addresses');
    expect(last.matched_route).toBe('fabric.list_resource_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_resource_addresses', 500, () =>
      client.fabric.resources.listAddresses('res-3'),
    );
    expect(last.matched_route).toBe('fabric.list_resource_addresses');
    expect(last.response_status).toBe(500);
  });

  it('assign domain application success', async () => {
    const { last } = await callOk(() =>
      client.fabric.resources.assignDomainApplication('res-4', { domain_application_id: 'da-7' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/res-4/domain_applications');
    expect(last.matched_route).toBe('fabric.assign_resource_domain_application');
  });
  it('assign domain application error 422', async () => {
    const last = await callErr('fabric.assign_resource_domain_application', 422, () =>
      client.fabric.resources.assignDomainApplication('res-4', { domain_application_id: 'da-7' }),
    );
    expect(last.matched_route).toBe('fabric.assign_resource_domain_application');
    expect(last.response_status).toBe(422);
  });

  it('assign phone route success', async () => {
    const { last } = await callOk(() =>
      client.fabric.resources.assignPhoneRoute('res-5', { phone_number_id: 'pn-1' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/res-5/phone_routes');
    expect(last.matched_route).toBe('fabric.assign_resource_phone_route');
  });
  it('assign phone route error 422', async () => {
    const last = await callErr('fabric.assign_resource_phone_route', 422, () =>
      client.fabric.resources.assignPhoneRoute('res-5', { phone_number_id: 'pn-1' }),
    );
    expect(last.matched_route).toBe('fabric.assign_resource_phone_route');
    expect(last.response_status).toBe(422);
  });
});

// ---- AI Agents ---------------------------------------------------------

describe('AI Agents', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.aiAgents.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/ai_agents');
    expect(last.matched_route).toBe('fabric.list_ai_agents');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_ai_agents', 500, () => client.fabric.aiAgents.list());
    expect(last.matched_route).toBe('fabric.list_ai_agents');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.aiAgents.create({ name: 'a' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/ai_agents');
    expect(last.matched_route).toBe('fabric.create_ai_agent');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_ai_agent', 422, () =>
      client.fabric.aiAgents.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_ai_agent');
    expect(last.response_status).toBe(422);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() => client.fabric.aiAgents.listAddresses('ag-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/ai_agents/ag-1/addresses');
    expect(last.matched_route).toBe('fabric.list_ai_agent_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_ai_agent_addresses', 500, () =>
      client.fabric.aiAgents.listAddresses('ag-1'),
    );
    expect(last.matched_route).toBe('fabric.list_ai_agent_addresses');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.aiAgents.get('ag-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/ai_agents/ag-1');
    expect(last.matched_route).toBe('fabric.get_ai_agent');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_ai_agent', 404, () =>
      client.fabric.aiAgents.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_ai_agent');
    expect(last.response_status).toBe(404);
  });

  it('update success (PATCH)', async () => {
    const { last } = await callOk(() => client.fabric.aiAgents.update('ag-1', { name: 'b' }));
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe('/api/fabric/resources/ai_agents/ag-1');
    expect(last.matched_route).toBe('fabric.update_ai_agent');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_ai_agent', 404, () =>
      client.fabric.aiAgents.update('missing', { name: 'b' }),
    );
    expect(last.matched_route).toBe('fabric.update_ai_agent');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.aiAgents.delete('ag-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/ai_agents/ag-1');
    expect(last.matched_route).toBe('fabric.delete_ai_agent');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_ai_agent', 404, () =>
      client.fabric.aiAgents.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_ai_agent');
    expect(last.response_status).toBe(404);
  });
});

// ---- Call Flows --------------------------------------------------------

describe('Call Flows', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.callFlows.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/call_flows');
    expect(last.matched_route).toBe('fabric.list_call_flows');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_call_flows', 500, () => client.fabric.callFlows.list());
    expect(last.matched_route).toBe('fabric.list_call_flows');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.callFlows.create({ name: 'cf' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/call_flows');
    expect(last.matched_route).toBe('fabric.create_call_flow');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_call_flow', 422, () =>
      client.fabric.callFlows.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_call_flow');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.callFlows.get('cf-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/call_flows/cf-1');
    expect(last.matched_route).toBe('fabric.get_call_flow');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_call_flow', 404, () =>
      client.fabric.callFlows.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_call_flow');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.fabric.callFlows.update('cf-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/fabric/resources/call_flows/cf-1');
    expect(last.matched_route).toBe('fabric.update_call_flow');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_call_flow', 404, () =>
      client.fabric.callFlows.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_call_flow');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.callFlows.delete('cf-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/call_flows/cf-1');
    expect(last.matched_route).toBe('fabric.delete_call_flow');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_call_flow', 404, () =>
      client.fabric.callFlows.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_call_flow');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success (singular path)', async () => {
    const { body, last } = await callOk(() => client.fabric.callFlows.listAddresses('cf-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/call_flow/cf-1/addresses');
    expect(last.matched_route).toBe('fabric.list_call_flow_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_call_flow_addresses', 500, () =>
      client.fabric.callFlows.listAddresses('cf-1'),
    );
    expect(last.matched_route).toBe('fabric.list_call_flow_addresses');
    expect(last.response_status).toBe(500);
  });

  it('list versions success', async () => {
    const { body, last } = await callOk(() => client.fabric.callFlows.listVersions('cf-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/call_flow/cf-1/versions');
    expect(last.matched_route).toBe('fabric.list_call_flow_versions');
  });
  it('list versions error 500', async () => {
    const last = await callErr('fabric.list_call_flow_versions', 500, () =>
      client.fabric.callFlows.listVersions('cf-1'),
    );
    expect(last.matched_route).toBe('fabric.list_call_flow_versions');
    expect(last.response_status).toBe(500);
  });

  it('deploy version success', async () => {
    const { last } = await callOk(() => client.fabric.callFlows.deployVersion('cf-1', {}));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/call_flow/cf-1/versions');
    expect(last.matched_route).toBe('fabric.deploy_call_flow_version');
  });
  it('deploy version error 422', async () => {
    const last = await callErr('fabric.deploy_call_flow_version', 422, () =>
      client.fabric.callFlows.deployVersion('cf-1', {}),
    );
    expect(last.matched_route).toBe('fabric.deploy_call_flow_version');
    expect(last.response_status).toBe(422);
  });
});

// ---- Conference Rooms --------------------------------------------------

describe('Conference Rooms', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.conferenceRooms.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/conference_rooms');
    expect(last.matched_route).toBe('fabric.list_conference_rooms');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_conference_rooms', 500, () =>
      client.fabric.conferenceRooms.list(),
    );
    expect(last.matched_route).toBe('fabric.list_conference_rooms');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.conferenceRooms.create({ name: 'cr' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/conference_rooms');
    expect(last.matched_route).toBe('fabric.create_conference_room');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_conference_room', 422, () =>
      client.fabric.conferenceRooms.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_conference_room');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.conferenceRooms.get('cr-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/conference_rooms/cr-1');
    expect(last.matched_route).toBe('fabric.get_conference_room');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_conference_room', 404, () =>
      client.fabric.conferenceRooms.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_conference_room');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() =>
      client.fabric.conferenceRooms.update('cr-1', { name: 'x' }),
    );
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/fabric/resources/conference_rooms/cr-1');
    expect(last.matched_route).toBe('fabric.update_conference_room');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_conference_room', 404, () =>
      client.fabric.conferenceRooms.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_conference_room');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.conferenceRooms.delete('cr-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/conference_rooms/cr-1');
    expect(last.matched_route).toBe('fabric.delete_conference_room');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_conference_room', 404, () =>
      client.fabric.conferenceRooms.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_conference_room');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success (singular path)', async () => {
    const { body, last } = await callOk(() => client.fabric.conferenceRooms.listAddresses('cr-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/conference_room/cr-1/addresses');
    expect(last.matched_route).toBe('fabric.list_conference_room_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_conference_room_addresses', 500, () =>
      client.fabric.conferenceRooms.listAddresses('cr-1'),
    );
    expect(last.matched_route).toBe('fabric.list_conference_room_addresses');
    expect(last.response_status).toBe(500);
  });
});

// ---- cXML Applications (no create — overridden to throw) ----------------

describe('cXML Applications', () => {
  it('create throws (not a route)', async () => {
    await expect(
      // @ts-expect-error - create on this resource is overridden to throw
      client.fabric.cxmlApplications.create({ name: 'never' }),
    ).rejects.toThrow(/cXML applications cannot/);
    const journal = await mock.journal();
    expect(journal.length).toBe(0);
  });

  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.cxmlApplications.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/cxml_applications');
    expect(last.matched_route).toBe('fabric.list_cxml_applications');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_cxml_applications', 500, () =>
      client.fabric.cxmlApplications.list(),
    );
    expect(last.matched_route).toBe('fabric.list_cxml_applications');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.cxmlApplications.get('ca-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/cxml_applications/ca-1');
    expect(last.matched_route).toBe('fabric.get_cxml_application');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_cxml_application', 404, () =>
      client.fabric.cxmlApplications.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_cxml_application');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() =>
      client.fabric.cxmlApplications.update('ca-1', { name: 'x' }),
    );
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/fabric/resources/cxml_applications/ca-1');
    expect(last.matched_route).toBe('fabric.update_cxml_application');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_cxml_application', 404, () =>
      client.fabric.cxmlApplications.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_cxml_application');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.cxmlApplications.delete('ca-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/cxml_applications/ca-1');
    expect(last.matched_route).toBe('fabric.delete_cxml_application');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_cxml_application', 404, () =>
      client.fabric.cxmlApplications.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_cxml_application');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() => client.fabric.cxmlApplications.listAddresses('ca-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/cxml_applications/ca-1/addresses');
    expect(last.matched_route).toBe('fabric.list_cxml_application_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_cxml_application_addresses', 500, () =>
      client.fabric.cxmlApplications.listAddresses('ca-1'),
    );
    expect(last.matched_route).toBe('fabric.list_cxml_application_addresses');
    expect(last.response_status).toBe(500);
  });
});

// ---- cXML Scripts ------------------------------------------------------

describe('cXML Scripts', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.cxmlScripts.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/cxml_scripts');
    expect(last.matched_route).toBe('fabric.list_cxml_scripts');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_cxml_scripts', 500, () =>
      client.fabric.cxmlScripts.list(),
    );
    expect(last.matched_route).toBe('fabric.list_cxml_scripts');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.cxmlScripts.create({ name: 'cs' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/cxml_scripts');
    expect(last.matched_route).toBe('fabric.create_cxml_script');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_cxml_script', 422, () =>
      client.fabric.cxmlScripts.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_cxml_script');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.cxmlScripts.get('cs-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/cxml_scripts/cs-1');
    expect(last.matched_route).toBe('fabric.get_cxml_script');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_cxml_script', 404, () =>
      client.fabric.cxmlScripts.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_cxml_script');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.fabric.cxmlScripts.update('cs-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/fabric/resources/cxml_scripts/cs-1');
    expect(last.matched_route).toBe('fabric.update_cxml_script');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_cxml_script', 404, () =>
      client.fabric.cxmlScripts.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_cxml_script');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.cxmlScripts.delete('cs-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/cxml_scripts/cs-1');
    expect(last.matched_route).toBe('fabric.delete_cxml_script');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_cxml_script', 404, () =>
      client.fabric.cxmlScripts.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_cxml_script');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() => client.fabric.cxmlScripts.listAddresses('cs-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/cxml_scripts/cs-1/addresses');
    expect(last.matched_route).toBe('fabric.list_cxml_script_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_cxml_script_addresses', 500, () =>
      client.fabric.cxmlScripts.listAddresses('cs-1'),
    );
    expect(last.matched_route).toBe('fabric.list_cxml_script_addresses');
    expect(last.response_status).toBe(500);
  });
});

// ---- cXML Webhooks (create auto-materialized; emits warning) -----------

describe('cXML Webhooks', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.cxmlWebhooks.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/cxml_webhooks');
    expect(last.matched_route).toBe('fabric.list_cxml_webhooks');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_cxml_webhooks', 500, () =>
      client.fabric.cxmlWebhooks.list(),
    );
    expect(last.matched_route).toBe('fabric.list_cxml_webhooks');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.cxmlWebhooks.create({ name: 'cw' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/cxml_webhooks');
    expect(last.matched_route).toBe('fabric.create_cxml_webhook');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_cxml_webhook', 422, () =>
      client.fabric.cxmlWebhooks.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_cxml_webhook');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.cxmlWebhooks.get('cw-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/cxml_webhooks/cw-1');
    expect(last.matched_route).toBe('fabric.get_cxml_webhook');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_cxml_webhook', 404, () =>
      client.fabric.cxmlWebhooks.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_cxml_webhook');
    expect(last.response_status).toBe(404);
  });

  it('update success (PATCH)', async () => {
    const { last } = await callOk(() => client.fabric.cxmlWebhooks.update('cw-1', { name: 'x' }));
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe('/api/fabric/resources/cxml_webhooks/cw-1');
    expect(last.matched_route).toBe('fabric.update_cxml_webhook');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_cxml_webhook', 404, () =>
      client.fabric.cxmlWebhooks.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_cxml_webhook');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.cxmlWebhooks.delete('cw-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/cxml_webhooks/cw-1');
    expect(last.matched_route).toBe('fabric.delete_cxml_webhook');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_cxml_webhook', 404, () =>
      client.fabric.cxmlWebhooks.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_cxml_webhook');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() => client.fabric.cxmlWebhooks.listAddresses('cw-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/cxml_webhooks/cw-1/addresses');
    expect(last.matched_route).toBe('fabric.list_cxml_webhook_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_cxml_webhook_addresses', 500, () =>
      client.fabric.cxmlWebhooks.listAddresses('cw-1'),
    );
    expect(last.matched_route).toBe('fabric.list_cxml_webhook_addresses');
    expect(last.response_status).toBe(500);
  });
});

// ---- FreeSWITCH Connectors ---------------------------------------------

describe('FreeSWITCH Connectors', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.freeswitchConnectors.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/freeswitch_connectors');
    expect(last.matched_route).toBe('fabric.list_freeswitch_connectors');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_freeswitch_connectors', 500, () =>
      client.fabric.freeswitchConnectors.list(),
    );
    expect(last.matched_route).toBe('fabric.list_freeswitch_connectors');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.freeswitchConnectors.create({ name: 'fc' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/freeswitch_connectors');
    expect(last.matched_route).toBe('fabric.create_freeswitch_connector');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_freeswitch_connector', 422, () =>
      client.fabric.freeswitchConnectors.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_freeswitch_connector');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.freeswitchConnectors.get('fc-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/freeswitch_connectors/fc-1');
    expect(last.matched_route).toBe('fabric.get_freeswitch_connector');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_freeswitch_connector', 404, () =>
      client.fabric.freeswitchConnectors.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_freeswitch_connector');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() =>
      client.fabric.freeswitchConnectors.update('fc-1', { name: 'x' }),
    );
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/fabric/resources/freeswitch_connectors/fc-1');
    expect(last.matched_route).toBe('fabric.update_freeswitch_connector');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_freeswitch_connector', 404, () =>
      client.fabric.freeswitchConnectors.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_freeswitch_connector');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.freeswitchConnectors.delete('fc-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/freeswitch_connectors/fc-1');
    expect(last.matched_route).toBe('fabric.delete_freeswitch_connector');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_freeswitch_connector', 404, () =>
      client.fabric.freeswitchConnectors.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_freeswitch_connector');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() =>
      client.fabric.freeswitchConnectors.listAddresses('fc-1'),
    );
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/freeswitch_connectors/fc-1/addresses');
    expect(last.matched_route).toBe('fabric.list_freeswitch_connector_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_freeswitch_connector_addresses', 500, () =>
      client.fabric.freeswitchConnectors.listAddresses('fc-1'),
    );
    expect(last.matched_route).toBe('fabric.list_freeswitch_connector_addresses');
    expect(last.response_status).toBe(500);
  });
});

// ---- Relay Applications ------------------------------------------------

describe('Relay Applications', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.relayApplications.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/relay_applications');
    expect(last.matched_route).toBe('fabric.list_relay_applications');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_relay_applications', 500, () =>
      client.fabric.relayApplications.list(),
    );
    expect(last.matched_route).toBe('fabric.list_relay_applications');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.relayApplications.create({ name: 'ra' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/relay_applications');
    expect(last.matched_route).toBe('fabric.create_relay_application');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_relay_application', 422, () =>
      client.fabric.relayApplications.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_relay_application');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.relayApplications.get('ra-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/relay_applications/ra-1');
    expect(last.matched_route).toBe('fabric.get_relay_application');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_relay_application', 404, () =>
      client.fabric.relayApplications.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_relay_application');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() =>
      client.fabric.relayApplications.update('ra-1', { name: 'x' }),
    );
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/fabric/resources/relay_applications/ra-1');
    expect(last.matched_route).toBe('fabric.update_relay_application');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_relay_application', 404, () =>
      client.fabric.relayApplications.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_relay_application');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.relayApplications.delete('ra-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/relay_applications/ra-1');
    expect(last.matched_route).toBe('fabric.delete_relay_application');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_relay_application', 404, () =>
      client.fabric.relayApplications.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_relay_application');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() =>
      client.fabric.relayApplications.listAddresses('ra-1'),
    );
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/relay_applications/ra-1/addresses');
    expect(last.matched_route).toBe('fabric.list_relay_application_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_relay_application_addresses', 500, () =>
      client.fabric.relayApplications.listAddresses('ra-1'),
    );
    expect(last.matched_route).toBe('fabric.list_relay_application_addresses');
    expect(last.response_status).toBe(500);
  });
});

// ---- SIP Endpoints (assign_resource_sip_endpoint is a doubled-path gap) -

describe('SIP Endpoints', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.sipEndpoints.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/sip_endpoints');
    expect(last.matched_route).toBe('fabric.list_sip_endpoints');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_sip_endpoints', 500, () =>
      client.fabric.sipEndpoints.list(),
    );
    expect(last.matched_route).toBe('fabric.list_sip_endpoints');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.sipEndpoints.create({ username: 'se' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/sip_endpoints');
    expect(last.matched_route).toBe('fabric.create_sip_endpoint');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_sip_endpoint', 422, () =>
      client.fabric.sipEndpoints.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_sip_endpoint');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.sipEndpoints.get('se-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/sip_endpoints/se-1');
    expect(last.matched_route).toBe('fabric.get_sip_endpoint');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_sip_endpoint', 404, () =>
      client.fabric.sipEndpoints.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_sip_endpoint');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() =>
      client.fabric.sipEndpoints.update('se-1', { username: 'x' }),
    );
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/fabric/resources/sip_endpoints/se-1');
    expect(last.matched_route).toBe('fabric.update_sip_endpoint');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_sip_endpoint', 404, () =>
      client.fabric.sipEndpoints.update('missing', { username: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_sip_endpoint');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.sipEndpoints.delete('se-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/sip_endpoints/se-1');
    expect(last.matched_route).toBe('fabric.delete_sip_endpoint');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_sip_endpoint', 404, () =>
      client.fabric.sipEndpoints.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_sip_endpoint');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() => client.fabric.sipEndpoints.listAddresses('se-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/sip_endpoints/se-1/addresses');
    expect(last.matched_route).toBe('fabric.list_sip_endpoint_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_sip_endpoint_addresses', 500, () =>
      client.fabric.sipEndpoints.listAddresses('se-1'),
    );
    expect(last.matched_route).toBe('fabric.list_sip_endpoint_addresses');
    expect(last.response_status).toBe(500);
  });
});

// ---- SIP Gateways (list_sip_gateway_addresses is a doubled-path gap) ----

describe('SIP Gateways', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.sipGateways.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/sip_gateways');
    expect(last.matched_route).toBe('fabric.list_sip_gateways');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_sip_gateways', 500, () =>
      client.fabric.sipGateways.list(),
    );
    expect(last.matched_route).toBe('fabric.list_sip_gateways');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.sipGateways.create({ name: 'sg' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/sip_gateways');
    expect(last.matched_route).toBe('fabric.create_sip_gateway');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_sip_gateway', 422, () =>
      client.fabric.sipGateways.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_sip_gateway');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.sipGateways.get('sg-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/sip_gateways/sg-1');
    expect(last.matched_route).toBe('fabric.get_sip_gateway');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_sip_gateway', 404, () =>
      client.fabric.sipGateways.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_sip_gateway');
    expect(last.response_status).toBe(404);
  });

  it('update success (PATCH)', async () => {
    const { last } = await callOk(() => client.fabric.sipGateways.update('sg-1', { name: 'x' }));
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe('/api/fabric/resources/sip_gateways/sg-1');
    expect(last.matched_route).toBe('fabric.update_sip_gateway');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_sip_gateway', 404, () =>
      client.fabric.sipGateways.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_sip_gateway');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.sipGateways.delete('sg-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/sip_gateways/sg-1');
    expect(last.matched_route).toBe('fabric.delete_sip_gateway');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_sip_gateway', 404, () =>
      client.fabric.sipGateways.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_sip_gateway');
    expect(last.response_status).toBe(404);
  });
});

// ---- Subscribers (with nested SIP endpoints) ---------------------------

describe('Subscribers', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.subscribers.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/subscribers');
    expect(last.matched_route).toBe('fabric.list_subscribers');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_subscribers', 500, () =>
      client.fabric.subscribers.list(),
    );
    expect(last.matched_route).toBe('fabric.list_subscribers');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.subscribers.create({ email: 'a@b.com' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/subscribers');
    expect(last.matched_route).toBe('fabric.create_subscriber');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_subscriber', 422, () =>
      client.fabric.subscribers.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_subscriber');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.subscribers.get('sub-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1');
    expect(last.matched_route).toBe('fabric.get_subscriber');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_subscriber', 404, () =>
      client.fabric.subscribers.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_subscriber');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() =>
      client.fabric.subscribers.update('sub-1', { email: 'x@y.com' }),
    );
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1');
    expect(last.matched_route).toBe('fabric.update_subscriber');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_subscriber', 404, () =>
      client.fabric.subscribers.update('missing', { email: 'x@y.com' }),
    );
    expect(last.matched_route).toBe('fabric.update_subscriber');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.subscribers.delete('sub-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1');
    expect(last.matched_route).toBe('fabric.delete_subscriber');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_subscriber', 404, () =>
      client.fabric.subscribers.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_subscriber');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() => client.fabric.subscribers.listAddresses('sub-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1/addresses');
    expect(last.matched_route).toBe('fabric.list_subscriber_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_subscriber_addresses', 500, () =>
      client.fabric.subscribers.listAddresses('sub-1'),
    );
    expect(last.matched_route).toBe('fabric.list_subscriber_addresses');
    expect(last.response_status).toBe(500);
  });

  it('list sip endpoints success', async () => {
    const { body, last } = await callOk(() => client.fabric.subscribers.listSipEndpoints('sub-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1/sip_endpoints');
    expect(last.matched_route).toBe('fabric.list_subscriber_sip_endpoints');
  });
  it('list sip endpoints error 500', async () => {
    const last = await callErr('fabric.list_subscriber_sip_endpoints', 500, () =>
      client.fabric.subscribers.listSipEndpoints('sub-1'),
    );
    expect(last.matched_route).toBe('fabric.list_subscriber_sip_endpoints');
    expect(last.response_status).toBe(500);
  });

  it('create sip endpoint success', async () => {
    const { last } = await callOk(() =>
      client.fabric.subscribers.createSipEndpoint('sub-1', { username: 'u' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1/sip_endpoints');
    expect(last.matched_route).toBe('fabric.create_subscriber_sip_endpoint');
  });
  it('create sip endpoint error 422', async () => {
    const last = await callErr('fabric.create_subscriber_sip_endpoint', 422, () =>
      client.fabric.subscribers.createSipEndpoint('sub-1', { username: 'u' }),
    );
    expect(last.matched_route).toBe('fabric.create_subscriber_sip_endpoint');
    expect(last.response_status).toBe(422);
  });

  it('get sip endpoint success', async () => {
    const { last } = await callOk(() => client.fabric.subscribers.getSipEndpoint('sub-1', 'ep-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1/sip_endpoints/ep-1');
    expect(last.matched_route).toBe('fabric.get_subscriber_sip_endpoint');
  });
  it('get sip endpoint error 404', async () => {
    const last = await callErr('fabric.get_subscriber_sip_endpoint', 404, () =>
      client.fabric.subscribers.getSipEndpoint('sub-1', 'missing'),
    );
    expect(last.matched_route).toBe('fabric.get_subscriber_sip_endpoint');
    expect(last.response_status).toBe(404);
  });

  it('update sip endpoint success (PATCH)', async () => {
    const { last } = await callOk(() =>
      client.fabric.subscribers.updateSipEndpoint('sub-1', 'ep-1', { username: 'renamed' }),
    );
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1/sip_endpoints/ep-1');
    expect(last.matched_route).toBe('fabric.update_subscriber_sip_endpoint');
  });
  it('update sip endpoint error 404', async () => {
    const last = await callErr('fabric.update_subscriber_sip_endpoint', 404, () =>
      client.fabric.subscribers.updateSipEndpoint('sub-1', 'missing', { username: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_subscriber_sip_endpoint');
    expect(last.response_status).toBe(404);
  });

  it('delete sip endpoint success', async () => {
    const { last } = await callOk(() =>
      client.fabric.subscribers.deleteSipEndpoint('sub-1', 'ep-1'),
    );
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/subscribers/sub-1/sip_endpoints/ep-1');
    expect(last.matched_route).toBe('fabric.delete_subscriber_sip_endpoint');
  });
  it('delete sip endpoint error 404', async () => {
    const last = await callErr('fabric.delete_subscriber_sip_endpoint', 404, () =>
      client.fabric.subscribers.deleteSipEndpoint('sub-1', 'missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_subscriber_sip_endpoint');
    expect(last.response_status).toBe(404);
  });
});

// ---- SWML Scripts ------------------------------------------------------

describe('SWML Scripts', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.swmlScripts.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/swml_scripts');
    expect(last.matched_route).toBe('fabric.list_swml_scripts');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_swml_scripts', 500, () =>
      client.fabric.swmlScripts.list(),
    );
    expect(last.matched_route).toBe('fabric.list_swml_scripts');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.swmlScripts.create({ name: 'ss' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/swml_scripts');
    expect(last.matched_route).toBe('fabric.create_swml_script');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_swml_script', 422, () =>
      client.fabric.swmlScripts.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_swml_script');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.swmlScripts.get('ss-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/swml_scripts/ss-1');
    expect(last.matched_route).toBe('fabric.get_swml_script');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_swml_script', 404, () =>
      client.fabric.swmlScripts.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_swml_script');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.fabric.swmlScripts.update('ss-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/fabric/resources/swml_scripts/ss-1');
    expect(last.matched_route).toBe('fabric.update_swml_script');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_swml_script', 404, () =>
      client.fabric.swmlScripts.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_swml_script');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.swmlScripts.delete('ss-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/swml_scripts/ss-1');
    expect(last.matched_route).toBe('fabric.delete_swml_script');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_swml_script', 404, () =>
      client.fabric.swmlScripts.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_swml_script');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() => client.fabric.swmlScripts.listAddresses('ss-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/swml_scripts/ss-1/addresses');
    expect(last.matched_route).toBe('fabric.list_swml_script_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_swml_script_addresses', 500, () =>
      client.fabric.swmlScripts.listAddresses('ss-1'),
    );
    expect(last.matched_route).toBe('fabric.list_swml_script_addresses');
    expect(last.response_status).toBe(500);
  });
});

// ---- SWML Webhooks (create auto-materialized; emits warning) -----------

describe('SWML Webhooks', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.fabric.swmlWebhooks.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/swml_webhooks');
    expect(last.matched_route).toBe('fabric.list_swml_webhooks');
  });
  it('list error 500', async () => {
    const last = await callErr('fabric.list_swml_webhooks', 500, () =>
      client.fabric.swmlWebhooks.list(),
    );
    expect(last.matched_route).toBe('fabric.list_swml_webhooks');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.fabric.swmlWebhooks.create({ name: 'sw' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/fabric/resources/swml_webhooks');
    expect(last.matched_route).toBe('fabric.create_swml_webhook');
  });
  it('create error 422', async () => {
    const last = await callErr('fabric.create_swml_webhook', 422, () =>
      client.fabric.swmlWebhooks.create({}),
    );
    expect(last.matched_route).toBe('fabric.create_swml_webhook');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.fabric.swmlWebhooks.get('sw-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/swml_webhooks/sw-1');
    expect(last.matched_route).toBe('fabric.get_swml_webhook');
  });
  it('get error 404', async () => {
    const last = await callErr('fabric.get_swml_webhook', 404, () =>
      client.fabric.swmlWebhooks.get('missing'),
    );
    expect(last.matched_route).toBe('fabric.get_swml_webhook');
    expect(last.response_status).toBe(404);
  });

  it('update success (PATCH)', async () => {
    const { last } = await callOk(() => client.fabric.swmlWebhooks.update('sw-1', { name: 'x' }));
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe('/api/fabric/resources/swml_webhooks/sw-1');
    expect(last.matched_route).toBe('fabric.update_swml_webhook');
  });
  it('update error 404', async () => {
    const last = await callErr('fabric.update_swml_webhook', 404, () =>
      client.fabric.swmlWebhooks.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('fabric.update_swml_webhook');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.fabric.swmlWebhooks.delete('sw-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/fabric/resources/swml_webhooks/sw-1');
    expect(last.matched_route).toBe('fabric.delete_swml_webhook');
  });
  it('delete error 404', async () => {
    const last = await callErr('fabric.delete_swml_webhook', 404, () =>
      client.fabric.swmlWebhooks.delete('missing'),
    );
    expect(last.matched_route).toBe('fabric.delete_swml_webhook');
    expect(last.response_status).toBe(404);
  });

  it('list addresses success', async () => {
    const { body, last } = await callOk(() => client.fabric.swmlWebhooks.listAddresses('sw-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fabric/resources/swml_webhooks/sw-1/addresses');
    expect(last.matched_route).toBe('fabric.list_swml_webhook_addresses');
  });
  it('list addresses error 500', async () => {
    const last = await callErr('fabric.list_swml_webhook_addresses', 500, () =>
      client.fabric.swmlWebhooks.listAddresses('sw-1'),
    );
    expect(last.matched_route).toBe('fabric.list_swml_webhook_addresses');
    expect(last.response_status).toBe(500);
  });
});
