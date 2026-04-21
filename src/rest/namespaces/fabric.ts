/**
 * Fabric API namespace — resource composition, addresses, and tokens.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { CrudWithAddresses } from '../base/CrudWithAddresses.js';

/** Standard fabric resource with CRUD + addresses (PATCH updates). */
export class FabricResource extends CrudWithAddresses {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }
}

/** Fabric resource that uses PUT for updates. */
export class FabricResourcePUT extends CrudWithAddresses {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }
}

/** Call flows with version management. Uses singular `call_flow` for sub-resource paths. */
export class CallFlowsResource extends FabricResourcePUT {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List addresses attached to a call flow resource. */
  override async listAddresses(resourceId: string, params?: QueryParams): Promise<any> {
    const path = this._basePath.replace('/call_flows', '/call_flow');
    return this._http.get(`${path}/${resourceId}/addresses`, params);
  }

  /** List all saved versions of a call flow. */
  async listVersions(resourceId: string, params?: QueryParams): Promise<any> {
    const path = this._basePath.replace('/call_flows', '/call_flow');
    return this._http.get(`${path}/${resourceId}/versions`, params);
  }

  /** Publish a new version of a call flow. */
  async deployVersion(resourceId: string, body: any = {}): Promise<any> {
    const path = this._basePath.replace('/call_flows', '/call_flow');
    return this._http.post(`${path}/${resourceId}/versions`, body);
  }
}

/** Conference rooms — uses singular 'conference_room' for sub-resource paths. */
export class ConferenceRoomsResource extends FabricResourcePUT {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  override async listAddresses(resourceId: string, params?: QueryParams): Promise<any> {
    const path = this._basePath.replace('/conference_rooms', '/conference_room');
    return this._http.get(`${path}/${resourceId}/addresses`, params);
  }
}

/** Subscribers with SIP endpoint management. */
export class SubscribersResource extends FabricResourcePUT {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List the SIP endpoints registered under a subscriber. */
  async listSipEndpoints(subscriberId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(subscriberId, 'sip_endpoints'), params);
  }

  /** Register a new SIP endpoint under a subscriber. */
  async createSipEndpoint(subscriberId: string, body: any): Promise<any> {
    return this._http.post(this._path(subscriberId, 'sip_endpoints'), body);
  }

  /** Fetch a single SIP endpoint by ID. */
  async getSipEndpoint(subscriberId: string, endpointId: string): Promise<any> {
    return this._http.get(this._path(subscriberId, 'sip_endpoints', endpointId));
  }

  /** Update a SIP endpoint's settings. */
  async updateSipEndpoint(subscriberId: string, endpointId: string, body: any): Promise<any> {
    return this._http.patch(this._path(subscriberId, 'sip_endpoints', endpointId), body);
  }

  /** Delete a SIP endpoint. */
  async deleteSipEndpoint(subscriberId: string, endpointId: string): Promise<any> {
    return this._http.delete(this._path(subscriberId, 'sip_endpoints', endpointId));
  }
}

/** cXML applications — no create method (read/update/delete only). */
export class CxmlApplicationsResource extends FabricResourcePUT {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  override async create(): Promise<never> {
    throw new Error('cXML applications cannot be created via this API');
  }
}

/** Generic resource operations across all fabric resource types. */
export class GenericResources extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List all fabric resources regardless of specific type. */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /** Fetch a single fabric resource by ID. */
  async get(resourceId: string): Promise<any> {
    return this._http.get(this._path(resourceId));
  }

  /** Delete a fabric resource. */
  async delete(resourceId: string): Promise<any> {
    return this._http.delete(this._path(resourceId));
  }

  /** List addresses associated with any fabric resource. */
  async listAddresses(resourceId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(resourceId, 'addresses'), params);
  }

  /** Assign a phone route to a fabric resource. */
  async assignPhoneRoute(resourceId: string, body: any): Promise<any> {
    return this._http.post(this._path(resourceId, 'phone_routes'), body);
  }

  /** Assign a domain application to a fabric resource. */
  async assignDomainApplication(resourceId: string, body: any): Promise<any> {
    return this._http.post(this._path(resourceId, 'domain_applications'), body);
  }
}

/** Read-only fabric addresses. */
export class FabricAddresses extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List all fabric addresses in the project. */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /** Fetch a single fabric address by ID. */
  async get(addressId: string): Promise<any> {
    return this._http.get(this._path(addressId));
  }
}

/** Subscriber, guest, invite, and embed token creation. */
export class FabricTokens extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/fabric');
  }

  /** Issue a new subscriber JWT used by end-user clients. */
  async createSubscriberToken(body: any = {}): Promise<any> {
    return this._http.post(this._path('subscribers', 'tokens'), body);
  }

  /** Refresh an existing subscriber JWT. */
  async refreshSubscriberToken(body: any = {}): Promise<any> {
    return this._http.post(this._path('subscribers', 'tokens', 'refresh'), body);
  }

  /** Create a single-use invite token for onboarding a new subscriber. */
  async createInviteToken(body: any = {}): Promise<any> {
    return this._http.post(this._path('subscriber', 'invites'), body);
  }

  /** Issue a guest token (no subscriber account required). */
  async createGuestToken(body: any = {}): Promise<any> {
    return this._http.post(this._path('guests', 'tokens'), body);
  }

  /** Issue a short-lived embed token for browser-side SignalWire widgets. */
  async createEmbedToken(body: any = {}): Promise<any> {
    return this._http.post(this._path('embeds', 'tokens'), body);
  }
}

/**
 * Fabric API namespace grouping all resource types.
 *
 * Access via `client.fabric.*`.
 *
 * @example
 * ```ts
 * const agents = await client.fabric.aiAgents.list();
 * const flow = await client.fabric.callFlows.create({ name: 'main-ivr' });
 * const token = await client.fabric.tokens.createSubscriberToken({ subscriber_id: 'sub_123' });
 * ```
 */
export class FabricNamespace {
  // PUT-update resources
  readonly swmlScripts: FabricResourcePUT;
  readonly relayApplications: FabricResourcePUT;
  readonly callFlows: CallFlowsResource;
  readonly conferenceRooms: ConferenceRoomsResource;
  readonly freeswitchConnectors: FabricResourcePUT;
  readonly subscribers: SubscribersResource;
  readonly sipEndpoints: FabricResourcePUT;
  readonly cxmlScripts: FabricResourcePUT;
  readonly cxmlApplications: CxmlApplicationsResource;

  // PATCH-update resources
  readonly swmlWebhooks: FabricResource;
  readonly aiAgents: FabricResource;
  readonly sipGateways: FabricResource;
  readonly cxmlWebhooks: FabricResource;

  // Special resources
  readonly resources: GenericResources;
  readonly addresses: FabricAddresses;
  readonly tokens: FabricTokens;

  constructor(http: HttpClient) {
    const base = '/api/fabric/resources';

    // PUT-update resources
    this.swmlScripts = new FabricResourcePUT(http, `${base}/swml_scripts`);
    this.relayApplications = new FabricResourcePUT(http, `${base}/relay_applications`);
    this.callFlows = new CallFlowsResource(http, `${base}/call_flows`);
    this.conferenceRooms = new ConferenceRoomsResource(http, `${base}/conference_rooms`);
    this.freeswitchConnectors = new FabricResourcePUT(http, `${base}/freeswitch_connectors`);
    this.subscribers = new SubscribersResource(http, `${base}/subscribers`);
    this.sipEndpoints = new FabricResourcePUT(http, `${base}/sip_endpoints`);
    this.cxmlScripts = new FabricResourcePUT(http, `${base}/cxml_scripts`);
    this.cxmlApplications = new CxmlApplicationsResource(http, `${base}/cxml_applications`);

    // PATCH-update resources
    this.swmlWebhooks = new FabricResource(http, `${base}/swml_webhooks`);
    this.aiAgents = new FabricResource(http, `${base}/ai_agents`);
    this.sipGateways = new FabricResource(http, `${base}/sip_gateways`);
    this.cxmlWebhooks = new FabricResource(http, `${base}/cxml_webhooks`);

    // Special resources
    this.resources = new GenericResources(http, base);
    this.addresses = new FabricAddresses(http, '/api/fabric/addresses');
    this.tokens = new FabricTokens(http);
  }
}
