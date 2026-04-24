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

  /**
   * List addresses attached to a call flow resource.
   *
   * @param resourceId - Unique identifier of the call flow.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of addresses.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  override async listAddresses(resourceId: string, params?: QueryParams): Promise<any> {
    const path = this._basePath.replace('/call_flows', '/call_flow');
    return this._http.get(`${path}/${resourceId}/addresses`, params);
  }

  /**
   * List all saved versions of a call flow.
   *
   * @param resourceId - Unique identifier of the call flow.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of call-flow versions.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listVersions(resourceId: string, params?: QueryParams): Promise<any> {
    const path = this._basePath.replace('/call_flows', '/call_flow');
    return this._http.get(`${path}/${resourceId}/versions`, params);
  }

  /**
   * Publish a new version of a call flow.
   *
   * @param resourceId - Unique identifier of the call flow.
   * @param body - Version payload (schema and metadata). Defaults to `{}`.
   * @returns The newly-published version record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
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

  /**
   * List addresses attached to a conference-room resource.
   *
   * @param resourceId - Unique identifier of the conference room.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of addresses.
   * @throws {RestError} On any non-2xx HTTP response.
   */
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

  /**
   * List the SIP endpoints registered under a subscriber.
   *
   * @param subscriberId - Unique identifier of the subscriber.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of SIP endpoints.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listSipEndpoints(subscriberId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(subscriberId, 'sip_endpoints'), params);
  }

  /**
   * Register a new SIP endpoint under a subscriber.
   *
   * @param subscriberId - Unique identifier of the subscriber.
   * @param body - SIP endpoint payload (credentials, codecs, etc.).
   * @returns The newly-created SIP endpoint record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createSipEndpoint(subscriberId: string, body: any): Promise<any> {
    return this._http.post(this._path(subscriberId, 'sip_endpoints'), body);
  }

  /**
   * Fetch a single SIP endpoint by ID.
   *
   * @param subscriberId - Unique identifier of the subscriber.
   * @param endpointId - Unique identifier of the SIP endpoint.
   * @returns The SIP endpoint record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getSipEndpoint(subscriberId: string, endpointId: string): Promise<any> {
    return this._http.get(this._path(subscriberId, 'sip_endpoints', endpointId));
  }

  /**
   * Update a SIP endpoint's settings.
   *
   * @param subscriberId - Unique identifier of the subscriber.
   * @param endpointId - Unique identifier of the SIP endpoint.
   * @param body - Partial update payload (PATCH semantics).
   * @returns The updated SIP endpoint record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async updateSipEndpoint(subscriberId: string, endpointId: string, body: any): Promise<any> {
    return this._http.patch(this._path(subscriberId, 'sip_endpoints', endpointId), body);
  }

  /**
   * Delete a SIP endpoint.
   *
   * @param subscriberId - Unique identifier of the subscriber.
   * @param endpointId - Unique identifier of the SIP endpoint.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
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

/**
 * Fabric webhook resource that is normally auto-materialized by the
 * corresponding `phoneNumbers.set*Webhook` helper.
 *
 * Creating directly produces an orphan Fabric resource that isn't bound to
 * any phone number — the API's binding model configures the webhook on the
 * phone number, and the server materializes the Fabric resource as a
 * side-effect.  `create` remains for backwards compatibility but emits a
 * one-time deprecation warning on first call.
 *
 * See the porting-sdk's `phone-binding.md` for the full model.
 */
export class AutoMaterializedWebhookResource extends FabricResource {
  /** Label used in the deprecation warning (subclasses override). */
  protected _autoHelperName: string = 'phoneNumbers.set*Webhook';
  private static _warned = new WeakSet<object>();

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * @deprecated Creating a webhook Fabric resource directly produces an
   *   orphan that is not bound to any phone number. Use the
   *   `phoneNumbers.setSwmlWebhook` / `setCxmlWebhook` helper instead — it
   *   updates the phone number and the server auto-materializes the
   *   resource. Kept for backwards compatibility.
   */
  override async create(body: any = {}): Promise<any> {
    if (!AutoMaterializedWebhookResource._warned.has(this)) {
      AutoMaterializedWebhookResource._warned.add(this);
      console.warn(
        `[signalwire] Creating a webhook Fabric resource directly produces ` +
        `an orphan not bound to any phone number. Use ${this._autoHelperName} ` +
        `instead; it updates the phone number and the server auto-materializes ` +
        `the resource. See porting-sdk's phone-binding.md.`,
      );
    }
    return super.create(body);
  }
}

/** Auto-materialized SWML webhook — normally created via `phoneNumbers.setSwmlWebhook`. */
export class SwmlWebhooksResource extends AutoMaterializedWebhookResource {
  protected override _autoHelperName = 'phoneNumbers.setSwmlWebhook(sid, url)';
}

/** Auto-materialized cXML webhook — normally created via `phoneNumbers.setCxmlWebhook`. */
export class CxmlWebhooksResource extends AutoMaterializedWebhookResource {
  protected override _autoHelperName = 'phoneNumbers.setCxmlWebhook(sid, { url })';
}

/** Generic resource operations across all fabric resource types. */
export class GenericResources extends BaseResource {
  private static _assignPhoneRouteWarned = new WeakSet<object>();

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List all fabric resources regardless of specific type.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of generic fabric resources.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a single fabric resource by ID.
   *
   * @param resourceId - Unique identifier of the resource.
   * @returns The resource record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(resourceId: string): Promise<any> {
    return this._http.get(this._path(resourceId));
  }

  /**
   * Delete a fabric resource.
   *
   * @param resourceId - Unique identifier of the resource.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(resourceId: string): Promise<any> {
    return this._http.delete(this._path(resourceId));
  }

  /**
   * List addresses associated with any fabric resource.
   *
   * @param resourceId - Unique identifier of the resource.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of addresses.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listAddresses(resourceId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(resourceId, 'addresses'), params);
  }

  /**
   * Assign a phone route to a fabric resource.
   *
   * @deprecated For the common cases — SWML webhooks, cXML webhooks, AI
   *   agents — this endpoint **does not work**. Bindings for those are
   *   configured on the phone number via {@link PhoneNumbersResource.setSwmlWebhook}
   *   / `setCxmlWebhook` / `setAiAgent`, and the Fabric resource is
   *   auto-materialized by the server. Calling this method against
   *   `swml_webhook`, `cxml_webhook`, or `ai_agent` resource IDs returns
   *   `404` or `422`. The endpoint (`POST /api/fabric/resources/{id}/phone_routes`)
   *   applies only to a narrow set of legacy resource types listed in
   *   `rest-apis/relay-rest/openapi.yaml`. Emits a one-time deprecation
   *   warning on first call; kept for backwards compatibility.
   *
   * @param resourceId - Unique identifier of the resource.
   * @param body - Phone route payload.
   * @returns The phone-route assignment record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async assignPhoneRoute(resourceId: string, body: any): Promise<any> {
    if (!GenericResources._assignPhoneRouteWarned.has(this)) {
      GenericResources._assignPhoneRouteWarned.add(this);
      console.warn(
        '[signalwire] assignPhoneRoute does not bind phone numbers to ' +
        'swml_webhook / cxml_webhook / ai_agent resources — those are ' +
        'configured via phoneNumbers.setSwmlWebhook / setCxmlWebhook / ' +
        'setAiAgent. This method applies only to a narrow set of legacy ' +
        "resource types. See porting-sdk's phone-binding.md.",
      );
    }
    return this._http.post(this._path(resourceId, 'phone_routes'), body);
  }

  /**
   * Assign a domain application to a fabric resource.
   *
   * @param resourceId - Unique identifier of the resource.
   * @param body - Domain application payload.
   * @returns The domain-application assignment record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async assignDomainApplication(resourceId: string, body: any): Promise<any> {
    return this._http.post(this._path(resourceId, 'domain_applications'), body);
  }
}

/** Read-only fabric addresses. */
export class FabricAddresses extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List all fabric addresses in the project.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of fabric addresses.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a single fabric address by ID.
   *
   * @param addressId - Unique identifier of the address.
   * @returns The address record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(addressId: string): Promise<any> {
    return this._http.get(this._path(addressId));
  }
}

/** Subscriber, guest, invite, and embed token creation. */
export class FabricTokens extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/fabric');
  }

  /**
   * Issue a new subscriber JWT used by end-user clients.
   *
   * @param body - Token payload (subscriber ID, TTL, scopes). Defaults to `{}`.
   * @returns The token record, typically `{ token: "eyJ..." }`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createSubscriberToken(body: any = {}): Promise<any> {
    return this._http.post(this._path('subscribers', 'tokens'), body);
  }

  /**
   * Refresh an existing subscriber JWT, extending its lifetime.
   *
   * @param body - Refresh payload (usually containing the current token).
   *   Defaults to `{}`.
   * @returns The refreshed token record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async refreshSubscriberToken(body: any = {}): Promise<any> {
    return this._http.post(this._path('subscribers', 'tokens', 'refresh'), body);
  }

  /**
   * Create a single-use invite token for onboarding a new subscriber.
   *
   * @param body - Invite payload (email, phone, permissions). Defaults to `{}`.
   * @returns The invite record, including the share URL / code.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createInviteToken(body: any = {}): Promise<any> {
    return this._http.post(this._path('subscriber', 'invites'), body);
  }

  /**
   * Issue a guest token (no subscriber account required).
   *
   * @param body - Guest-token payload (context, TTL, etc.). Defaults to `{}`.
   * @returns The token record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createGuestToken(body: any = {}): Promise<any> {
    return this._http.post(this._path('guests', 'tokens'), body);
  }

  /**
   * Issue a short-lived embed token for browser-side SignalWire widgets.
   *
   * @param body - Embed-token payload (allowed origins, TTL, etc.). Defaults to `{}`.
   * @returns The token record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
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
  /** SWML script CRUD (full-replacement `PUT` update). */
  readonly swmlScripts: FabricResourcePUT;
  /** Relay Application CRUD (full-replacement `PUT` update). */
  readonly relayApplications: FabricResourcePUT;
  /** Call Flow CRUD with version listing and publishing. */
  readonly callFlows: CallFlowsResource;
  /** Conference Room CRUD with address listing. */
  readonly conferenceRooms: ConferenceRoomsResource;
  /** FreeSWITCH Connector CRUD. */
  readonly freeswitchConnectors: FabricResourcePUT;
  /** Subscriber CRUD plus nested SIP endpoint management. */
  readonly subscribers: SubscribersResource;
  /** Top-level SIP endpoint CRUD. */
  readonly sipEndpoints: FabricResourcePUT;
  /** cXML (LaML) script CRUD. */
  readonly cxmlScripts: FabricResourcePUT;
  /** cXML application read / update / delete (no create). */
  readonly cxmlApplications: CxmlApplicationsResource;

  // PATCH-update resources
  /**
   * SWML webhook CRUD. **Auto-materialized** as a side-effect of
   * {@link PhoneNumbersResource.setSwmlWebhook}; direct `create` produces
   * an orphan resource and emits a deprecation warning.
   */
  readonly swmlWebhooks: SwmlWebhooksResource;
  /** AI Agent CRUD — the platform-managed agent registration resource. */
  readonly aiAgents: FabricResource;
  /** SIP Gateway CRUD. */
  readonly sipGateways: FabricResource;
  /**
   * cXML webhook CRUD. **Auto-materialized** as a side-effect of
   * {@link PhoneNumbersResource.setCxmlWebhook}; direct `create` produces
   * an orphan resource and emits a deprecation warning.
   */
  readonly cxmlWebhooks: CxmlWebhooksResource;

  // Special resources
  /** Generic operations across all resource types (list, get, delete, phone route assignment). */
  readonly resources: GenericResources;
  /** Read-only access to the unified fabric address table. */
  readonly addresses: FabricAddresses;
  /** Subscriber, guest, invite, and embed token generation. */
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
    // swmlWebhooks and cxmlWebhooks are normally auto-materialized by
    // phoneNumbers.setSwmlWebhook / setCxmlWebhook. Direct create still
    // works for backcompat but emits a deprecation warning.
    this.swmlWebhooks = new SwmlWebhooksResource(http, `${base}/swml_webhooks`);
    this.aiAgents = new FabricResource(http, `${base}/ai_agents`);
    this.sipGateways = new FabricResource(http, `${base}/sip_gateways`);
    this.cxmlWebhooks = new CxmlWebhooksResource(http, `${base}/cxml_webhooks`);

    // Special resources
    this.resources = new GenericResources(http, base);
    this.addresses = new FabricAddresses(http, '/api/fabric/addresses');
    this.tokens = new FabricTokens(http);
  }
}
