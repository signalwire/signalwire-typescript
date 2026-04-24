/**
 * Tests for PhoneNumbersResource — CRUD, search, and typed binding helpers.
 *
 * The typed helpers wrap `phoneNumbers.update` with the correct
 * `call_handler` + companion field combination for each handler type. A
 * regression test asserts the full happy-path binding flow does NOT require
 * pre-creating a Fabric webhook resource and does NOT call
 * `assignPhoneRoute` — the two traps found in the phone-binding
 * post-mortem.
 */

import { HttpClient } from '../../src/rest/HttpClient.js';
import { PhoneNumbersResource } from '../../src/rest/namespaces/phone-numbers.js';
import { FabricNamespace } from '../../src/rest/namespaces/fabric.js';
import { PhoneCallHandler } from '../../src/rest/callHandler.js';
import { mockClientOptions } from './helpers.js';

const BASE = '/api/relay/rest/phone_numbers';

function setup(responses: any[] = [{ status: 200, body: {} }]) {
  const { options, getRequests } = mockClientOptions(responses);
  const http = new HttpClient(options);
  const phoneNumbers = new PhoneNumbersResource(http);
  const fabric = new FabricNamespace(http);
  return { phoneNumbers, fabric, getRequests };
}

describe('PhoneCallHandler enum', () => {
  it('exposes all 11 wire values', () => {
    const expected = new Set([
      'relay_script',
      'laml_webhooks',
      'laml_application',
      'ai_agent',
      'call_flow',
      'relay_application',
      'relay_topic',
      'relay_context',
      'relay_connector',
      'video_room',
      'dialogflow',
    ]);
    const actual = new Set(Object.values(PhoneCallHandler));
    expect(actual).toEqual(expected);
  });

  it('members are plain strings (serialize identically to wire)', () => {
    expect(PhoneCallHandler.RELAY_SCRIPT).toBe('relay_script');
    expect(PhoneCallHandler.AI_AGENT).toBe('ai_agent');
    expect(JSON.stringify({ h: PhoneCallHandler.CALL_FLOW })).toBe('{"h":"call_flow"}');
  });

  it('is named PhoneCallHandler (not CallHandler) to avoid RELAY client collision', async () => {
    // The RELAY client exports a separate CallHandler callback type.  Confirm
    // that importing from the REST entrypoint yields a distinct symbol with
    // the expected rename, and that no `CallHandler` leaks from rest/index.
    const restIndex = await import('../../src/rest/index.js');
    expect(restIndex.PhoneCallHandler).toBeDefined();
    expect((restIndex as Record<string, unknown>)['CallHandler']).toBeUndefined();
  });
});

describe('PhoneNumbersResource — typed binding helpers', () => {
  describe('setSwmlWebhook', () => {
    it('sets call_handler=relay_script + call_relay_script_url', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setSwmlWebhook('pn-1', 'https://example.com/swml');

      const req = getRequests()[0];
      expect(req?.method).toBe('PUT');
      expect(req?.url).toContain(`${BASE}/pn-1`);
      expect(req?.body).toEqual({
        call_handler: 'relay_script',
        call_relay_script_url: 'https://example.com/swml',
      });
    });

    it('passes through extra fields (e.g. name)', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setSwmlWebhook('pn-1', 'https://example.com/swml', { name: 'Support Line' });
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'relay_script',
        call_relay_script_url: 'https://example.com/swml',
        name: 'Support Line',
      });
    });
  });

  describe('setCxmlWebhook', () => {
    it('minimal form: sets call_handler=laml_webhooks + call_request_url', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setCxmlWebhook('pn-1', { url: 'https://example.com/voice.xml' });
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'laml_webhooks',
        call_request_url: 'https://example.com/voice.xml',
      });
    });

    it('includes fallbackUrl and statusCallbackUrl when supplied', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setCxmlWebhook('pn-1', {
        url: 'https://example.com/voice.xml',
        fallbackUrl: 'https://example.com/fallback.xml',
        statusCallbackUrl: 'https://example.com/status',
      });
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'laml_webhooks',
        call_request_url: 'https://example.com/voice.xml',
        call_fallback_url: 'https://example.com/fallback.xml',
        call_status_callback_url: 'https://example.com/status',
      });
    });

    it('passes through extra wire-level fields', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setCxmlWebhook('pn-1', {
        url: 'https://example.com/voice.xml',
        call_status_callback_method: 'POST',
      });
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'laml_webhooks',
        call_request_url: 'https://example.com/voice.xml',
        call_status_callback_method: 'POST',
      });
    });
  });

  describe('setCxmlApplication', () => {
    it('sets call_handler=laml_application + call_laml_application_id', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setCxmlApplication('pn-1', 'app-1');
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'laml_application',
        call_laml_application_id: 'app-1',
      });
    });
  });

  describe('setAiAgent', () => {
    it('sets call_handler=ai_agent + call_ai_agent_id', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setAiAgent('pn-1', 'agent-1');
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'ai_agent',
        call_ai_agent_id: 'agent-1',
      });
    });
  });

  describe('setCallFlow', () => {
    it('minimal: sets call_handler=call_flow + call_flow_id', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setCallFlow('pn-1', { flowId: 'cf-1' });
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'call_flow',
        call_flow_id: 'cf-1',
      });
    });

    it('includes call_flow_version when version specified', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setCallFlow('pn-1', { flowId: 'cf-1', version: 'current_deployed' });
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'call_flow',
        call_flow_id: 'cf-1',
        call_flow_version: 'current_deployed',
      });
    });
  });

  describe('setRelayApplication', () => {
    it('sets call_handler=relay_application + call_relay_application', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setRelayApplication('pn-1', 'my-app');
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'relay_application',
        call_relay_application: 'my-app',
      });
    });
  });

  describe('setRelayTopic', () => {
    it('minimal: sets call_handler=relay_topic + call_relay_topic', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setRelayTopic('pn-1', { topic: 'office' });
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'relay_topic',
        call_relay_topic: 'office',
      });
    });

    it('includes call_relay_topic_status_callback_url when supplied', async () => {
      const { phoneNumbers, getRequests } = setup();
      await phoneNumbers.setRelayTopic('pn-1', {
        topic: 'office',
        statusCallbackUrl: 'https://example.com/status',
      });
      expect(getRequests()[0]?.body).toEqual({
        call_handler: 'relay_topic',
        call_relay_topic: 'office',
        call_relay_topic_status_callback_url: 'https://example.com/status',
      });
    });
  });

  describe('helper coverage', () => {
    it('every expected helper is present on phoneNumbers', () => {
      const { phoneNumbers } = setup();
      const expected = [
        'setSwmlWebhook',
        'setCxmlWebhook',
        'setCxmlApplication',
        'setAiAgent',
        'setCallFlow',
        'setRelayApplication',
        'setRelayTopic',
      ] as const;
      for (const name of expected) {
        expect(typeof (phoneNumbers as unknown as Record<string, unknown>)[name]).toBe('function');
      }
    });
  });
});

describe('Phone-binding post-mortem regression', () => {
  /**
   * The post-mortem identified two traps:
   *   1. `fabric.swmlWebhooks.create(...)` looks right but produces orphans.
   *   2. `fabric.resources.assignPhoneRoute(...)` rejects swml_webhook bindings.
   *
   * The correct happy-path binding is a single PUT to
   * `/api/relay/rest/phone_numbers/{sid}` — no Fabric create, no phone_routes
   * post. This test pins that contract.
   */
  it('setSwmlWebhook makes exactly ONE PUT to phone_numbers, no fabric calls', async () => {
    const { phoneNumbers, getRequests } = setup();
    await phoneNumbers.setSwmlWebhook('pn-1', 'https://example.com/swml');

    const reqs = getRequests();
    expect(reqs).toHaveLength(1);

    const req = reqs[0]!;
    expect(req.method).toBe('PUT');
    expect(req.url).toContain(`${BASE}/pn-1`);
    // No fabric.swmlWebhooks.create (POST to /api/fabric/resources/swml_webhooks).
    expect(req.url).not.toContain('/api/fabric/resources/swml_webhooks');
    // No fabric.resources.assignPhoneRoute (POST to .../phone_routes).
    expect(req.url).not.toContain('/phone_routes');
  });

  it('wire-level form with raw strings works (no enum import needed)', async () => {
    const { phoneNumbers, getRequests } = setup();
    await phoneNumbers.update('pn-1', {
      call_handler: 'relay_script',
      call_relay_script_url: 'https://example.com/swml',
    });
    const req = getRequests()[0]!;
    expect(req.method).toBe('PUT');
    expect(req.body).toEqual({
      call_handler: 'relay_script',
      call_relay_script_url: 'https://example.com/swml',
    });
  });

  it('PhoneCallHandler.RELAY_SCRIPT serializes to the same wire value', async () => {
    const { phoneNumbers, getRequests } = setup();
    await phoneNumbers.update('pn-1', {
      call_handler: PhoneCallHandler.RELAY_SCRIPT,
      call_relay_script_url: 'https://example.com/swml',
    });
    expect(getRequests()[0]?.body).toEqual({
      call_handler: 'relay_script',
      call_relay_script_url: 'https://example.com/swml',
    });
  });
});
