/**
 * AUTO-GENERATED REST wire tests for the `fabric` namespace — DO NOT EDIT.
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

describe('fabric wire (generated)', () => {
  it('addresses_get success', async () => {
    await client.fabric.addresses.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_fabric_address');
  });

  it('addresses_get error', async () => {
    await mock.pushScenario('fabric.get_fabric_address', 500, { error: 'x' });
    await expect(client.fabric.addresses.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('addresses_list success', async () => {
    await client.fabric.addresses.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_fabric_addresses');
  });

  it('addresses_list error', async () => {
    await mock.pushScenario('fabric.list_fabric_addresses', 500, { error: 'x' });
    await expect(client.fabric.addresses.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('aiAgents_create success', async () => {
    await client.fabric.aiAgents.create({ prompt: { text: 'x' }, name: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_ai_agent');
  });

  it('aiAgents_create error', async () => {
    await mock.pushScenario('fabric.create_ai_agent', 500, { error: 'x' });
    await expect(
      client.fabric.aiAgents.create({ prompt: { text: 'x' }, name: 'x' }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('aiAgents_delete success', async () => {
    await client.fabric.aiAgents.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_ai_agent');
  });

  it('aiAgents_delete error', async () => {
    await mock.pushScenario('fabric.delete_ai_agent', 500, { error: 'x' });
    await expect(client.fabric.aiAgents.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('aiAgents_get success', async () => {
    await client.fabric.aiAgents.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_ai_agent');
  });

  it('aiAgents_get error', async () => {
    await mock.pushScenario('fabric.get_ai_agent', 500, { error: 'x' });
    await expect(client.fabric.aiAgents.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('aiAgents_listAddresses success', async () => {
    await client.fabric.aiAgents.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_ai_agent_addresses');
  });

  it('aiAgents_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_ai_agent_addresses', 500, { error: 'x' });
    await expect(client.fabric.aiAgents.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('aiAgents_list success', async () => {
    await client.fabric.aiAgents.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_ai_agents');
  });

  it('aiAgents_list error', async () => {
    await mock.pushScenario('fabric.list_ai_agents', 500, { error: 'x' });
    await expect(client.fabric.aiAgents.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('aiAgents_update success', async () => {
    await client.fabric.aiAgents.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('fabric.update_ai_agent');
  });

  it('aiAgents_update error', async () => {
    await mock.pushScenario('fabric.update_ai_agent', 500, { error: 'x' });
    await expect(client.fabric.aiAgents.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('callFlows_create success', async () => {
    await client.fabric.callFlows.create({ title: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_call_flow');
  });

  it('callFlows_create error', async () => {
    await mock.pushScenario('fabric.create_call_flow', 500, { error: 'x' });
    await expect(client.fabric.callFlows.create({ title: 'x' })).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('callFlows_delete success', async () => {
    await client.fabric.callFlows.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_call_flow');
  });

  it('callFlows_delete error', async () => {
    await mock.pushScenario('fabric.delete_call_flow', 500, { error: 'x' });
    await expect(client.fabric.callFlows.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('callFlows_deployVersion success', async () => {
    await client.fabric.callFlows.deployVersion('x', { document_version: 1 });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.deploy_call_flow_version');
  });

  it('callFlows_deployVersion error', async () => {
    await mock.pushScenario('fabric.deploy_call_flow_version', 500, { error: 'x' });
    await expect(
      client.fabric.callFlows.deployVersion('x', { document_version: 1 }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('callFlows_get success', async () => {
    await client.fabric.callFlows.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_call_flow');
  });

  it('callFlows_get error', async () => {
    await mock.pushScenario('fabric.get_call_flow', 500, { error: 'x' });
    await expect(client.fabric.callFlows.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('callFlows_listAddresses success', async () => {
    await client.fabric.callFlows.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_call_flow_addresses');
  });

  it('callFlows_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_call_flow_addresses', 500, { error: 'x' });
    await expect(client.fabric.callFlows.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('callFlows_list success', async () => {
    await client.fabric.callFlows.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_call_flows');
  });

  it('callFlows_list error', async () => {
    await mock.pushScenario('fabric.list_call_flows', 500, { error: 'x' });
    await expect(client.fabric.callFlows.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('callFlows_listVersions success', async () => {
    await client.fabric.callFlows.listVersions('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_call_flow_versions');
  });

  it('callFlows_listVersions error', async () => {
    await mock.pushScenario('fabric.list_call_flow_versions', 500, { error: 'x' });
    await expect(client.fabric.callFlows.listVersions('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('callFlows_update success', async () => {
    await client.fabric.callFlows.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('fabric.update_call_flow');
  });

  it('callFlows_update error', async () => {
    await mock.pushScenario('fabric.update_call_flow', 500, { error: 'x' });
    await expect(client.fabric.callFlows.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferenceRooms_create success', async () => {
    await client.fabric.conferenceRooms.create({ name: 'x', enable_room_previews: false });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_conference_room');
  });

  it('conferenceRooms_create error', async () => {
    await mock.pushScenario('fabric.create_conference_room', 500, { error: 'x' });
    await expect(
      client.fabric.conferenceRooms.create({ name: 'x', enable_room_previews: false }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferenceRooms_delete success', async () => {
    await client.fabric.conferenceRooms.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_conference_room');
  });

  it('conferenceRooms_delete error', async () => {
    await mock.pushScenario('fabric.delete_conference_room', 500, { error: 'x' });
    await expect(client.fabric.conferenceRooms.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferenceRooms_get success', async () => {
    await client.fabric.conferenceRooms.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_conference_room');
  });

  it('conferenceRooms_get error', async () => {
    await mock.pushScenario('fabric.get_conference_room', 500, { error: 'x' });
    await expect(client.fabric.conferenceRooms.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferenceRooms_listAddresses success', async () => {
    await client.fabric.conferenceRooms.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_conference_room_addresses');
  });

  it('conferenceRooms_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_conference_room_addresses', 500, { error: 'x' });
    await expect(client.fabric.conferenceRooms.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferenceRooms_list success', async () => {
    await client.fabric.conferenceRooms.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_conference_rooms');
  });

  it('conferenceRooms_list error', async () => {
    await mock.pushScenario('fabric.list_conference_rooms', 500, { error: 'x' });
    await expect(client.fabric.conferenceRooms.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferenceRooms_update success', async () => {
    await client.fabric.conferenceRooms.update('x', {
      enable_room_previews: false,
      sync_audio_video: false,
    });
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('fabric.update_conference_room');
  });

  it('conferenceRooms_update error', async () => {
    await mock.pushScenario('fabric.update_conference_room', 500, { error: 'x' });
    await expect(
      client.fabric.conferenceRooms.update('x', {
        enable_room_previews: false,
        sync_audio_video: false,
      }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlApplications_delete success', async () => {
    await client.fabric.cxmlApplications.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_cxml_application');
  });

  it('cxmlApplications_delete error', async () => {
    await mock.pushScenario('fabric.delete_cxml_application', 500, { error: 'x' });
    await expect(client.fabric.cxmlApplications.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlApplications_get success', async () => {
    await client.fabric.cxmlApplications.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_cxml_application');
  });

  it('cxmlApplications_get error', async () => {
    await mock.pushScenario('fabric.get_cxml_application', 500, { error: 'x' });
    await expect(client.fabric.cxmlApplications.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlApplications_listAddresses success', async () => {
    await client.fabric.cxmlApplications.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_cxml_application_addresses');
  });

  it('cxmlApplications_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_cxml_application_addresses', 500, { error: 'x' });
    await expect(client.fabric.cxmlApplications.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlApplications_list success', async () => {
    await client.fabric.cxmlApplications.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_cxml_applications');
  });

  it('cxmlApplications_list error', async () => {
    await mock.pushScenario('fabric.list_cxml_applications', 500, { error: 'x' });
    await expect(client.fabric.cxmlApplications.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlApplications_update success', async () => {
    await client.fabric.cxmlApplications.update('x');
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('fabric.update_cxml_application');
  });

  it('cxmlApplications_update error', async () => {
    await mock.pushScenario('fabric.update_cxml_application', 500, { error: 'x' });
    await expect(client.fabric.cxmlApplications.update('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlScripts_create success', async () => {
    await client.fabric.cxmlScripts.create({ display_name: 'x', contents: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_cxml_script');
  });

  it('cxmlScripts_create error', async () => {
    await mock.pushScenario('fabric.create_cxml_script', 500, { error: 'x' });
    await expect(
      client.fabric.cxmlScripts.create({ display_name: 'x', contents: 'x' }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlScripts_delete success', async () => {
    await client.fabric.cxmlScripts.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_cxml_script');
  });

  it('cxmlScripts_delete error', async () => {
    await mock.pushScenario('fabric.delete_cxml_script', 500, { error: 'x' });
    await expect(client.fabric.cxmlScripts.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlScripts_get success', async () => {
    await client.fabric.cxmlScripts.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_cxml_script');
  });

  it('cxmlScripts_get error', async () => {
    await mock.pushScenario('fabric.get_cxml_script', 500, { error: 'x' });
    await expect(client.fabric.cxmlScripts.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlScripts_listAddresses success', async () => {
    await client.fabric.cxmlScripts.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_cxml_script_addresses');
  });

  it('cxmlScripts_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_cxml_script_addresses', 500, { error: 'x' });
    await expect(client.fabric.cxmlScripts.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlScripts_list success', async () => {
    await client.fabric.cxmlScripts.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_cxml_scripts');
  });

  it('cxmlScripts_list error', async () => {
    await mock.pushScenario('fabric.list_cxml_scripts', 500, { error: 'x' });
    await expect(client.fabric.cxmlScripts.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlScripts_update success', async () => {
    await client.fabric.cxmlScripts.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('fabric.update_cxml_script');
  });

  it('cxmlScripts_update error', async () => {
    await mock.pushScenario('fabric.update_cxml_script', 500, { error: 'x' });
    await expect(client.fabric.cxmlScripts.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlWebhooks_create success', async () => {
    await client.fabric.cxmlWebhooks.create({ primary_request_url: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_cxml_webhook');
  });

  it('cxmlWebhooks_create error', async () => {
    await mock.pushScenario('fabric.create_cxml_webhook', 500, { error: 'x' });
    await expect(client.fabric.cxmlWebhooks.create({ primary_request_url: 'x' })).rejects.toThrow(
      RestError,
    );
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlWebhooks_delete success', async () => {
    await client.fabric.cxmlWebhooks.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_cxml_webhook');
  });

  it('cxmlWebhooks_delete error', async () => {
    await mock.pushScenario('fabric.delete_cxml_webhook', 500, { error: 'x' });
    await expect(client.fabric.cxmlWebhooks.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlWebhooks_get success', async () => {
    await client.fabric.cxmlWebhooks.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_cxml_webhook');
  });

  it('cxmlWebhooks_get error', async () => {
    await mock.pushScenario('fabric.get_cxml_webhook', 500, { error: 'x' });
    await expect(client.fabric.cxmlWebhooks.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlWebhooks_listAddresses success', async () => {
    await client.fabric.cxmlWebhooks.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_cxml_webhook_addresses');
  });

  it('cxmlWebhooks_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_cxml_webhook_addresses', 500, { error: 'x' });
    await expect(client.fabric.cxmlWebhooks.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlWebhooks_list success', async () => {
    await client.fabric.cxmlWebhooks.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_cxml_webhooks');
  });

  it('cxmlWebhooks_list error', async () => {
    await mock.pushScenario('fabric.list_cxml_webhooks', 500, { error: 'x' });
    await expect(client.fabric.cxmlWebhooks.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('cxmlWebhooks_update success', async () => {
    await client.fabric.cxmlWebhooks.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('fabric.update_cxml_webhook');
  });

  it('cxmlWebhooks_update error', async () => {
    await mock.pushScenario('fabric.update_cxml_webhook', 500, { error: 'x' });
    await expect(client.fabric.cxmlWebhooks.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('freeswitchConnectors_create success', async () => {
    await client.fabric.freeswitchConnectors.create({ name: 'x', token: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_freeswitch_connector');
  });

  it('freeswitchConnectors_create error', async () => {
    await mock.pushScenario('fabric.create_freeswitch_connector', 500, { error: 'x' });
    await expect(
      client.fabric.freeswitchConnectors.create({ name: 'x', token: 'x' }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('freeswitchConnectors_delete success', async () => {
    await client.fabric.freeswitchConnectors.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_freeswitch_connector');
  });

  it('freeswitchConnectors_delete error', async () => {
    await mock.pushScenario('fabric.delete_freeswitch_connector', 500, { error: 'x' });
    await expect(client.fabric.freeswitchConnectors.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('freeswitchConnectors_get success', async () => {
    await client.fabric.freeswitchConnectors.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_freeswitch_connector');
  });

  it('freeswitchConnectors_get error', async () => {
    await mock.pushScenario('fabric.get_freeswitch_connector', 500, { error: 'x' });
    await expect(client.fabric.freeswitchConnectors.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('freeswitchConnectors_listAddresses success', async () => {
    await client.fabric.freeswitchConnectors.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_freeswitch_connector_addresses');
  });

  it('freeswitchConnectors_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_freeswitch_connector_addresses', 500, { error: 'x' });
    await expect(client.fabric.freeswitchConnectors.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('freeswitchConnectors_list success', async () => {
    await client.fabric.freeswitchConnectors.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_freeswitch_connectors');
  });

  it('freeswitchConnectors_list error', async () => {
    await mock.pushScenario('fabric.list_freeswitch_connectors', 500, { error: 'x' });
    await expect(client.fabric.freeswitchConnectors.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('freeswitchConnectors_update success', async () => {
    await client.fabric.freeswitchConnectors.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('fabric.update_freeswitch_connector');
  });

  it('freeswitchConnectors_update error', async () => {
    await mock.pushScenario('fabric.update_freeswitch_connector', 500, { error: 'x' });
    await expect(client.fabric.freeswitchConnectors.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('relayApplications_create success', async () => {
    await client.fabric.relayApplications.create({ name: 'x', topic: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_relay_application');
  });

  it('relayApplications_create error', async () => {
    await mock.pushScenario('fabric.create_relay_application', 500, { error: 'x' });
    await expect(client.fabric.relayApplications.create({ name: 'x', topic: 'x' })).rejects.toThrow(
      RestError,
    );
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('relayApplications_delete success', async () => {
    await client.fabric.relayApplications.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_relay_application');
  });

  it('relayApplications_delete error', async () => {
    await mock.pushScenario('fabric.delete_relay_application', 500, { error: 'x' });
    await expect(client.fabric.relayApplications.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('relayApplications_get success', async () => {
    await client.fabric.relayApplications.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_relay_application');
  });

  it('relayApplications_get error', async () => {
    await mock.pushScenario('fabric.get_relay_application', 500, { error: 'x' });
    await expect(client.fabric.relayApplications.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('relayApplications_listAddresses success', async () => {
    await client.fabric.relayApplications.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_relay_application_addresses');
  });

  it('relayApplications_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_relay_application_addresses', 500, { error: 'x' });
    await expect(client.fabric.relayApplications.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('relayApplications_list success', async () => {
    await client.fabric.relayApplications.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_relay_applications');
  });

  it('relayApplications_list error', async () => {
    await mock.pushScenario('fabric.list_relay_applications', 500, { error: 'x' });
    await expect(client.fabric.relayApplications.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('relayApplications_update success', async () => {
    await client.fabric.relayApplications.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('fabric.update_relay_application');
  });

  it('relayApplications_update error', async () => {
    await mock.pushScenario('fabric.update_relay_application', 500, { error: 'x' });
    await expect(client.fabric.relayApplications.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('resources_assignDomainApplication success', async () => {
    await client.fabric.resources.assignDomainApplication('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.assign_resource_domain_application');
  });

  it('resources_assignDomainApplication error', async () => {
    await mock.pushScenario('fabric.assign_resource_domain_application', 500, { error: 'x' });
    await expect(client.fabric.resources.assignDomainApplication('x', 'x')).rejects.toThrow(
      RestError,
    );
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('resources_assignPhoneRoute success', async () => {
    await client.fabric.resources.assignPhoneRoute('x', 'x', 'calling');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.assign_resource_phone_route');
  });

  it('resources_assignPhoneRoute error', async () => {
    await mock.pushScenario('fabric.assign_resource_phone_route', 500, { error: 'x' });
    await expect(client.fabric.resources.assignPhoneRoute('x', 'x', 'calling')).rejects.toThrow(
      RestError,
    );
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('resources_delete success', async () => {
    await client.fabric.resources.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_resource');
  });

  it('resources_delete error', async () => {
    await mock.pushScenario('fabric.delete_resource', 500, { error: 'x' });
    await expect(client.fabric.resources.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('resources_get success', async () => {
    await client.fabric.resources.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_resource');
  });

  it('resources_get error', async () => {
    await mock.pushScenario('fabric.get_resource', 500, { error: 'x' });
    await expect(client.fabric.resources.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('resources_listAddresses success', async () => {
    await client.fabric.resources.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_resource_addresses');
  });

  it('resources_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_resource_addresses', 500, { error: 'x' });
    await expect(client.fabric.resources.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('resources_list success', async () => {
    await client.fabric.resources.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_resources');
  });

  it('resources_list error', async () => {
    await mock.pushScenario('fabric.list_resources', 500, { error: 'x' });
    await expect(client.fabric.resources.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipEndpoints_create success', async () => {
    await client.fabric.sipEndpoints.create({
      username: 'x',
      caller_id: 'x',
      send_as: 'x',
      ciphers: [],
      codecs: [],
      encryption: 'required',
      call_handler: 'default',
      calling_handler_resource_id: 'x',
    });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_sip_endpoint');
  });

  it('sipEndpoints_create error', async () => {
    await mock.pushScenario('fabric.create_sip_endpoint', 500, { error: 'x' });
    await expect(
      client.fabric.sipEndpoints.create({
        username: 'x',
        caller_id: 'x',
        send_as: 'x',
        ciphers: [],
        codecs: [],
        encryption: 'required',
        call_handler: 'default',
        calling_handler_resource_id: 'x',
      }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipEndpoints_delete success', async () => {
    await client.fabric.sipEndpoints.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_sip_endpoint');
  });

  it('sipEndpoints_delete error', async () => {
    await mock.pushScenario('fabric.delete_sip_endpoint', 500, { error: 'x' });
    await expect(client.fabric.sipEndpoints.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipEndpoints_get success', async () => {
    await client.fabric.sipEndpoints.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_sip_endpoint');
  });

  it('sipEndpoints_get error', async () => {
    await mock.pushScenario('fabric.get_sip_endpoint', 500, { error: 'x' });
    await expect(client.fabric.sipEndpoints.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipEndpoints_listAddresses success', async () => {
    await client.fabric.sipEndpoints.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_sip_endpoint_addresses');
  });

  it('sipEndpoints_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_sip_endpoint_addresses', 500, { error: 'x' });
    await expect(client.fabric.sipEndpoints.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipEndpoints_list success', async () => {
    await client.fabric.sipEndpoints.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_sip_endpoints');
  });

  it('sipEndpoints_list error', async () => {
    await mock.pushScenario('fabric.list_sip_endpoints', 500, { error: 'x' });
    await expect(client.fabric.sipEndpoints.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipEndpoints_update success', async () => {
    await client.fabric.sipEndpoints.update('x', { calling_handler_resource_id: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('fabric.update_sip_endpoint');
  });

  it('sipEndpoints_update error', async () => {
    await mock.pushScenario('fabric.update_sip_endpoint', 500, { error: 'x' });
    await expect(
      client.fabric.sipEndpoints.update('x', { calling_handler_resource_id: 'x' }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipGateways_create success', async () => {
    await client.fabric.sipGateways.create({
      name: 'x',
      uri: 'x',
      encryption: 'required',
      ciphers: [],
      codecs: [],
    });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_sip_gateway');
  });

  it('sipGateways_create error', async () => {
    await mock.pushScenario('fabric.create_sip_gateway', 500, { error: 'x' });
    await expect(
      client.fabric.sipGateways.create({
        name: 'x',
        uri: 'x',
        encryption: 'required',
        ciphers: [],
        codecs: [],
      }),
    ).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipGateways_delete success', async () => {
    await client.fabric.sipGateways.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_sip_gateway');
  });

  it('sipGateways_delete error', async () => {
    await mock.pushScenario('fabric.delete_sip_gateway', 500, { error: 'x' });
    await expect(client.fabric.sipGateways.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipGateways_get success', async () => {
    await client.fabric.sipGateways.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_sip_gateway');
  });

  it('sipGateways_get error', async () => {
    await mock.pushScenario('fabric.get_sip_gateway', 500, { error: 'x' });
    await expect(client.fabric.sipGateways.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipGateways_listAddresses success', async () => {
    await client.fabric.sipGateways.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_sip_gateway_addresses');
  });

  it('sipGateways_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_sip_gateway_addresses', 500, { error: 'x' });
    await expect(client.fabric.sipGateways.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipGateways_list success', async () => {
    await client.fabric.sipGateways.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_sip_gateways');
  });

  it('sipGateways_list error', async () => {
    await mock.pushScenario('fabric.list_sip_gateways', 500, { error: 'x' });
    await expect(client.fabric.sipGateways.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('sipGateways_update success', async () => {
    await client.fabric.sipGateways.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('fabric.update_sip_gateway');
  });

  it('sipGateways_update error', async () => {
    await mock.pushScenario('fabric.update_sip_gateway', 500, { error: 'x' });
    await expect(client.fabric.sipGateways.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_create success', async () => {
    await client.fabric.subscribers.create({ email: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_subscriber');
  });

  it('subscribers_create error', async () => {
    await mock.pushScenario('fabric.create_subscriber', 500, { error: 'x' });
    await expect(client.fabric.subscribers.create({ email: 'x' })).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_createSipEndpoint success', async () => {
    await client.fabric.subscribers.createSipEndpoint('x', 'x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_subscriber_sip_endpoint');
  });

  it('subscribers_createSipEndpoint error', async () => {
    await mock.pushScenario('fabric.create_subscriber_sip_endpoint', 500, { error: 'x' });
    await expect(client.fabric.subscribers.createSipEndpoint('x', 'x', 'x')).rejects.toThrow(
      RestError,
    );
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_delete success', async () => {
    await client.fabric.subscribers.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_subscriber');
  });

  it('subscribers_delete error', async () => {
    await mock.pushScenario('fabric.delete_subscriber', 500, { error: 'x' });
    await expect(client.fabric.subscribers.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_deleteSipEndpoint success', async () => {
    await client.fabric.subscribers.deleteSipEndpoint('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_subscriber_sip_endpoint');
  });

  it('subscribers_deleteSipEndpoint error', async () => {
    await mock.pushScenario('fabric.delete_subscriber_sip_endpoint', 500, { error: 'x' });
    await expect(client.fabric.subscribers.deleteSipEndpoint('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_get success', async () => {
    await client.fabric.subscribers.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_subscriber');
  });

  it('subscribers_get error', async () => {
    await mock.pushScenario('fabric.get_subscriber', 500, { error: 'x' });
    await expect(client.fabric.subscribers.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_getSipEndpoint success', async () => {
    await client.fabric.subscribers.getSipEndpoint('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_subscriber_sip_endpoint');
  });

  it('subscribers_getSipEndpoint error', async () => {
    await mock.pushScenario('fabric.get_subscriber_sip_endpoint', 500, { error: 'x' });
    await expect(client.fabric.subscribers.getSipEndpoint('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_listAddresses success', async () => {
    await client.fabric.subscribers.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_subscriber_addresses');
  });

  it('subscribers_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_subscriber_addresses', 500, { error: 'x' });
    await expect(client.fabric.subscribers.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_list success', async () => {
    await client.fabric.subscribers.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_subscribers');
  });

  it('subscribers_list error', async () => {
    await mock.pushScenario('fabric.list_subscribers', 500, { error: 'x' });
    await expect(client.fabric.subscribers.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_listSipEndpoints success', async () => {
    await client.fabric.subscribers.listSipEndpoints('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_subscriber_sip_endpoints');
  });

  it('subscribers_listSipEndpoints error', async () => {
    await mock.pushScenario('fabric.list_subscriber_sip_endpoints', 500, { error: 'x' });
    await expect(client.fabric.subscribers.listSipEndpoints('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_update success', async () => {
    await client.fabric.subscribers.update('x', { email: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('fabric.update_subscriber');
  });

  it('subscribers_update error', async () => {
    await mock.pushScenario('fabric.update_subscriber', 500, { error: 'x' });
    await expect(client.fabric.subscribers.update('x', { email: 'x' })).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('subscribers_updateSipEndpoint success', async () => {
    await client.fabric.subscribers.updateSipEndpoint('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('fabric.update_subscriber_sip_endpoint');
  });

  it('subscribers_updateSipEndpoint error', async () => {
    await mock.pushScenario('fabric.update_subscriber_sip_endpoint', 500, { error: 'x' });
    await expect(client.fabric.subscribers.updateSipEndpoint('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlScripts_create success', async () => {
    await client.fabric.swmlScripts.create({ name: 'x', contents: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_swml_script');
  });

  it('swmlScripts_create error', async () => {
    await mock.pushScenario('fabric.create_swml_script', 500, { error: 'x' });
    await expect(client.fabric.swmlScripts.create({ name: 'x', contents: 'x' })).rejects.toThrow(
      RestError,
    );
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlScripts_delete success', async () => {
    await client.fabric.swmlScripts.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_swml_script');
  });

  it('swmlScripts_delete error', async () => {
    await mock.pushScenario('fabric.delete_swml_script', 500, { error: 'x' });
    await expect(client.fabric.swmlScripts.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlScripts_get success', async () => {
    await client.fabric.swmlScripts.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_swml_script');
  });

  it('swmlScripts_get error', async () => {
    await mock.pushScenario('fabric.get_swml_script', 500, { error: 'x' });
    await expect(client.fabric.swmlScripts.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlScripts_listAddresses success', async () => {
    await client.fabric.swmlScripts.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_swml_script_addresses');
  });

  it('swmlScripts_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_swml_script_addresses', 500, { error: 'x' });
    await expect(client.fabric.swmlScripts.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlScripts_list success', async () => {
    await client.fabric.swmlScripts.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_swml_scripts');
  });

  it('swmlScripts_list error', async () => {
    await mock.pushScenario('fabric.list_swml_scripts', 500, { error: 'x' });
    await expect(client.fabric.swmlScripts.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlScripts_update success', async () => {
    await client.fabric.swmlScripts.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('fabric.update_swml_script');
  });

  it('swmlScripts_update error', async () => {
    await mock.pushScenario('fabric.update_swml_script', 500, { error: 'x' });
    await expect(client.fabric.swmlScripts.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlWebhooks_create success', async () => {
    await client.fabric.swmlWebhooks.create({ primary_request_url: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_swml_webhook');
  });

  it('swmlWebhooks_create error', async () => {
    await mock.pushScenario('fabric.create_swml_webhook', 500, { error: 'x' });
    await expect(client.fabric.swmlWebhooks.create({ primary_request_url: 'x' })).rejects.toThrow(
      RestError,
    );
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlWebhooks_delete success', async () => {
    await client.fabric.swmlWebhooks.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('fabric.delete_swml_webhook');
  });

  it('swmlWebhooks_delete error', async () => {
    await mock.pushScenario('fabric.delete_swml_webhook', 500, { error: 'x' });
    await expect(client.fabric.swmlWebhooks.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlWebhooks_get success', async () => {
    await client.fabric.swmlWebhooks.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.get_swml_webhook');
  });

  it('swmlWebhooks_get error', async () => {
    await mock.pushScenario('fabric.get_swml_webhook', 500, { error: 'x' });
    await expect(client.fabric.swmlWebhooks.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlWebhooks_listAddresses success', async () => {
    await client.fabric.swmlWebhooks.listAddresses('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_swml_webhook_addresses');
  });

  it('swmlWebhooks_listAddresses error', async () => {
    await mock.pushScenario('fabric.list_swml_webhook_addresses', 500, { error: 'x' });
    await expect(client.fabric.swmlWebhooks.listAddresses('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlWebhooks_list success', async () => {
    await client.fabric.swmlWebhooks.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fabric.list_swml_webhooks');
  });

  it('swmlWebhooks_list error', async () => {
    await mock.pushScenario('fabric.list_swml_webhooks', 500, { error: 'x' });
    await expect(client.fabric.swmlWebhooks.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('swmlWebhooks_update success', async () => {
    await client.fabric.swmlWebhooks.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('fabric.update_swml_webhook');
  });

  it('swmlWebhooks_update error', async () => {
    await mock.pushScenario('fabric.update_swml_webhook', 500, { error: 'x' });
    await expect(client.fabric.swmlWebhooks.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('tokens_createEmbedToken success', async () => {
    await client.fabric.tokens.createEmbedToken('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_embeds_token');
  });

  it('tokens_createEmbedToken error', async () => {
    await mock.pushScenario('fabric.create_embeds_token', 500, { error: 'x' });
    await expect(client.fabric.tokens.createEmbedToken('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('tokens_createGuestToken success', async () => {
    await client.fabric.tokens.createGuestToken([]);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_subscriber_guest_token');
  });

  it('tokens_createGuestToken error', async () => {
    await mock.pushScenario('fabric.create_subscriber_guest_token', 500, { error: 'x' });
    await expect(client.fabric.tokens.createGuestToken([])).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('tokens_createInviteToken success', async () => {
    await client.fabric.tokens.createInviteToken('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_subscriber_invite_token');
  });

  it('tokens_createInviteToken error', async () => {
    await mock.pushScenario('fabric.create_subscriber_invite_token', 500, { error: 'x' });
    await expect(client.fabric.tokens.createInviteToken('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('tokens_createSubscriberToken success', async () => {
    await client.fabric.tokens.createSubscriberToken('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.create_subscriber_token');
  });

  it('tokens_createSubscriberToken error', async () => {
    await mock.pushScenario('fabric.create_subscriber_token', 500, { error: 'x' });
    await expect(client.fabric.tokens.createSubscriberToken('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('tokens_refreshSubscriberToken success', async () => {
    await client.fabric.tokens.refreshSubscriberToken('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('fabric.refresh_subscriber_token');
  });

  it('tokens_refreshSubscriberToken error', async () => {
    await mock.pushScenario('fabric.refresh_subscriber_token', 500, { error: 'x' });
    await expect(client.fabric.tokens.refreshSubscriberToken('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
