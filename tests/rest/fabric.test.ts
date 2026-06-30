import { vi } from 'vitest';
import { HttpClient } from '../../src/rest/HttpClient.js';
import { FabricNamespace } from '../../src/rest/namespaces/fabric.js';
import { mockClientOptions, type MockResponse } from './helpers.js';

describe('FabricNamespace', () => {
  function setup(responses: MockResponse[] = [{ status: 200, body: { data: [] } }]) {
    const { options, getRequests } = mockClientOptions(responses);
    const http = new HttpClient(options);
    const fabric = new FabricNamespace(http);
    return { fabric, getRequests };
  }

  describe('AI Agents (PATCH-update)', () => {
    it('lists ai agents', async () => {
      const { fabric, getRequests } = setup();
      await fabric.aiAgents.list();
      expect(getRequests()[0].url).toContain('/api/fabric/resources/ai_agents');
      expect(getRequests()[0].method).toBe('GET');
    });

    it('creates an ai agent', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'a1' } }]);
      await fabric.aiAgents.create({ name: 'test' });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].body).toEqual({ name: 'test' });
    });

    it('updates ai agent with PATCH', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'a1' } }]);
      await fabric.aiAgents.update('a1', { name: 'updated' });
      expect(getRequests()[0].method).toBe('PATCH');
    });

    it('lists addresses for ai agent', async () => {
      const { fabric, getRequests } = setup();
      await fabric.aiAgents.listAddresses('a1');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/ai_agents/a1/addresses');
    });
  });

  describe('SWML Scripts (PUT-update)', () => {
    it('updates swml script with PUT', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 's1' } }]);
      await fabric.swmlScripts.update('s1', { code: 'new' });
      expect(getRequests()[0].method).toBe('PUT');
    });
  });

  describe('Call Flows', () => {
    it('uses singular call_flow for addresses', async () => {
      const { fabric, getRequests } = setup();
      await fabric.callFlows.listAddresses('cf1');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/call_flow/cf1/addresses');
    });

    it('lists versions', async () => {
      const { fabric, getRequests } = setup();
      await fabric.callFlows.listVersions('cf1');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/call_flow/cf1/versions');
    });

    it('deploys a version', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { version: 2 } }]);
      await fabric.callFlows.deployVersion('cf1', { version: 2 });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/call_flow/cf1/versions');
    });
  });

  describe('Conference Rooms', () => {
    it('uses singular conference_room for addresses', async () => {
      const { fabric, getRequests } = setup();
      await fabric.conferenceRooms.listAddresses('cr1');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/conference_room/cr1/addresses');
    });
  });

  describe('Subscribers', () => {
    it('lists SIP endpoints', async () => {
      const { fabric, getRequests } = setup();
      await fabric.subscribers.listSipEndpoints('sub1');
      expect(getRequests()[0].url).toContain(
        '/api/fabric/resources/subscribers/sub1/sip_endpoints',
      );
    });

    it('creates a SIP endpoint', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'ep1' } }]);
      await fabric.subscribers.createSipEndpoint('sub1', 'test');
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].body).toEqual({ username: 'test' });
    });

    it('gets a SIP endpoint', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'ep1' } }]);
      await fabric.subscribers.getSipEndpoint('sub1', 'ep1');
      expect(getRequests()[0].url).toContain('/subscribers/sub1/sip_endpoints/ep1');
    });

    it('updates a SIP endpoint with PATCH', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.subscribers.updateSipEndpoint('sub1', 'ep1', undefined, 'new');
      expect(getRequests()[0].method).toBe('PATCH');
      expect(getRequests()[0].body).toEqual({ password: 'new' });
    });

    it('deletes a SIP endpoint', async () => {
      const { fabric, getRequests } = setup([{ status: 204 }]);
      await fabric.subscribers.deleteSipEndpoint('sub1', 'ep1');
      expect(getRequests()[0].method).toBe('DELETE');
    });
  });

  describe('CXML Applications', () => {
    it('exposes no create (cXML applications cannot be created via this route)', () => {
      const { fabric } = setup();
      // The generated, oracle-faithful surface omits `create` entirely for
      // cXML applications — there is no create route. The method is absent
      // rather than present-and-throwing.
      expect((fabric.cxmlApplications as unknown as { create?: unknown }).create).toBeUndefined();
    });
  });

  describe('Webhook resources', () => {
    // Webhooks are plain CRUD resources. The phone-number binding model
    // (phoneNumbers.setSwmlWebhook / setCxmlWebhook) is the documented way to
    // auto-materialize them, but direct create is a normal operation with no
    // deprecation warning (these SDKs are pre-release — nothing to deprecate).
    it('swmlWebhooks.create posts without warning', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'wh1' } }]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await fabric.swmlWebhooks.create({
          name: 'wh',
          primary_request_url: 'https://example.com',
        });
        expect(getRequests()[0].method).toBe('POST');
        expect(getRequests()[0].url).toContain('/api/fabric/resources/swml_webhooks');
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('cxmlWebhooks.create posts without warning', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'wh2' } }]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await fabric.cxmlWebhooks.create({
          name: 'wh',
          primary_request_url: 'https://example.com',
        });
        expect(getRequests()[0].method).toBe('POST');
        expect(getRequests()[0].url).toContain('/api/fabric/resources/cxml_webhooks');
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('swmlWebhooks.list / get / update / delete do NOT warn', async () => {
      const { fabric } = setup([
        { status: 200, body: { data: [] } },
        { status: 200, body: { id: 'wh1' } },
        { status: 200, body: { id: 'wh1' } },
        { status: 204 },
      ]);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        await fabric.swmlWebhooks.list();
        await fabric.swmlWebhooks.get('wh1');
        await fabric.swmlWebhooks.update('wh1', { name: 'renamed' });
        await fabric.swmlWebhooks.delete('wh1');
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('Generic Resources', () => {
    it('lists all resources', async () => {
      const { fabric, getRequests } = setup();
      await fabric.resources.list();
      expect(getRequests()[0].url).toContain('/api/fabric/resources');
      expect(getRequests()[0].url).not.toContain('/api/fabric/resources/');
    });

    it('assigns phone route (posts to phone_routes with typed body)', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      // The oracle-faithful generated surface takes exploded spec params
      // (phone_route_id, handler) and posts them as the request body. It no
      // longer emits a deprecation warning — that was a hand-class artifact.
      await fabric.resources.assignPhoneRoute('r1', 'pr-1', 'calling');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/r1/phone_routes');
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].body).toEqual({ phone_route_id: 'pr-1', handler: 'calling' });
    });

    it('assigns domain application', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.resources.assignDomainApplication('r1', { domain: 'test.com' });
      expect(getRequests()[0].url).toContain('/api/fabric/resources/r1/domain_applications');
    });
  });

  describe('Addresses', () => {
    it('lists addresses', async () => {
      const { fabric, getRequests } = setup();
      await fabric.addresses.list();
      expect(getRequests()[0].url).toContain('/api/fabric/addresses');
    });

    it('gets an address', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'addr1' } }]);
      await fabric.addresses.get('addr1');
      expect(getRequests()[0].url).toContain('/api/fabric/addresses/addr1');
    });
  });

  describe('Tokens', () => {
    it('creates subscriber token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { token: 'xxx' } }]);
      await fabric.tokens.createSubscriberToken({ subscriber_id: 's1' });
      expect(getRequests()[0].url).toContain('/api/fabric/subscribers/tokens');
      expect(getRequests()[0].method).toBe('POST');
    });

    it('refreshes subscriber token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { token: 'xxx' } }]);
      await fabric.tokens.refreshSubscriberToken({ token: 'old' });
      expect(getRequests()[0].url).toContain('/api/fabric/subscribers/tokens/refresh');
    });

    it('creates invite token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.tokens.createInviteToken({});
      expect(getRequests()[0].url).toContain('/api/fabric/subscriber/invites');
    });

    it('creates guest token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.tokens.createGuestToken({});
      expect(getRequests()[0].url).toContain('/api/fabric/guests/tokens');
    });

    it('creates embed token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.tokens.createEmbedToken({});
      expect(getRequests()[0].url).toContain('/api/fabric/embeds/tokens');
    });
  });
});
