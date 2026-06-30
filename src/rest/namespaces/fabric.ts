/**
 * Fabric API namespace — resource composition, addresses, and tokens.
 */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { FabricResource, FabricResourcePUT } from '../base/FabricResource.js';
import {
  AiAgents,
  CxmlScripts,
  CxmlWebhooks,
  FreeswitchConnectors,
  RelayApplications,
  SipEndpoints,
  SipGateways,
  SwmlScripts,
  SwmlWebhooks,
} from './fabric.resources.generated.js';
import type {
  CallFlowAddressListResponse,
  CallFlowCreateRequest,
  CallFlowListResponse,
  CallFlowResponse,
  CallFlowUpdateRequest,
  CallFlowVersionDeployRequest,
  CallFlowVersionDeployResponse,
  CallFlowVersionListResponse,
  ConferenceRoomAddressListResponse,
  ConferenceRoomCreateRequest,
  ConferenceRoomListResponse,
  ConferenceRoomResponse,
  ConferenceRoomUpdateRequest,
  CxmlApplicationListResponse,
  CxmlApplicationResponse,
  CxmlApplicationUpdateRequest,
  DomainApplicationAssignRequest,
  DomainApplicationResponse,
  EmbedsTokensRequest,
  EmbedsTokensResponse,
  FabricAddress,
  FabricAddressesResponse,
  PhoneRouteAssignRequest,
  PhoneRouteResponse,
  ResourceAddressListResponse,
  ResourceListResponse,
  ResourceResponse,
  SubscriberGuestTokenCreateRequest,
  SubscriberGuestTokenCreateResponse,
  SubscriberInviteTokenCreateRequest,
  SubscriberInviteTokenCreateResponse,
  SubscriberListResponse,
  SubscriberRefreshTokenRequest,
  SubscriberRefreshTokenResponse,
  SubscriberRequest,
  SubscriberResponse,
  SubscriberSIPEndpoint,
  SubscriberSipEndpointListResponse,
  SubscriberSipEndpointRequest,
  SubscriberSipEndpointRequestUpdate,
  SubscriberTokenRequest,
  SubscriberTokenResponse,
} from './fabric.types.generated.js';

// `FabricResource` / `FabricResourcePUT` are defined in `../base/FabricResource.js`
// (imported above) so the generated `fabric.resources.generated` subclasses can extend
// them without an import cycle. Re-exported here for callers that import them from this
// module.
export { FabricResource, FabricResourcePUT };

/** Call flows with version management. Uses singular `call_flow` for sub-resource paths. */
export class CallFlowsResource extends FabricResourcePUT<
  CallFlowListResponse,
  CallFlowResponse,
  Partial<CallFlowCreateRequest>,
  Partial<CallFlowUpdateRequest>
> {
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
  override async listAddresses(
    resourceId: string,
    params?: QueryParams,
  ): Promise<CallFlowAddressListResponse> {
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
  async listVersions(
    resourceId: string,
    params?: QueryParams,
  ): Promise<CallFlowVersionListResponse> {
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
  async deployVersion(
    resourceId: string,
    body: Partial<CallFlowVersionDeployRequest> = {},
  ): Promise<CallFlowVersionDeployResponse> {
    const path = this._basePath.replace('/call_flows', '/call_flow');
    return this._http.post(`${path}/${resourceId}/versions`, body);
  }
}

/** Conference rooms — uses singular 'conference_room' for sub-resource paths. */
export class ConferenceRoomsResource extends FabricResourcePUT<
  ConferenceRoomListResponse,
  ConferenceRoomResponse,
  Partial<ConferenceRoomCreateRequest>,
  Partial<ConferenceRoomUpdateRequest>
> {
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
  override async listAddresses(
    resourceId: string,
    params?: QueryParams,
  ): Promise<ConferenceRoomAddressListResponse> {
    const path = this._basePath.replace('/conference_rooms', '/conference_room');
    return this._http.get(`${path}/${resourceId}/addresses`, params);
  }
}

/** Subscribers with SIP endpoint management. */
export class SubscribersResource extends FabricResourcePUT<
  SubscriberListResponse,
  SubscriberResponse,
  Partial<SubscriberRequest>,
  Partial<SubscriberRequest>
> {
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
  async listSipEndpoints(
    subscriberId: string,
    params?: QueryParams,
  ): Promise<SubscriberSipEndpointListResponse> {
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
  async createSipEndpoint(
    subscriberId: string,
    body: SubscriberSipEndpointRequest,
  ): Promise<SubscriberSIPEndpoint> {
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
  async getSipEndpoint(subscriberId: string, endpointId: string): Promise<SubscriberSIPEndpoint> {
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
  async updateSipEndpoint(
    subscriberId: string,
    endpointId: string,
    body: SubscriberSipEndpointRequestUpdate,
  ): Promise<SubscriberSIPEndpoint> {
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
  async deleteSipEndpoint(subscriberId: string, endpointId: string): Promise<unknown> {
    return this._http.delete(this._path(subscriberId, 'sip_endpoints', endpointId));
  }
}

/** cXML applications — no create method (read/update/delete only). */
export class CxmlApplicationsResource extends FabricResourcePUT<
  CxmlApplicationListResponse,
  CxmlApplicationResponse,
  never,
  Partial<CxmlApplicationUpdateRequest>
> {
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
// `SwmlWebhooks` / `CxmlWebhooks` are now plain generated typed CRUD
// resources (see `fabric.resources.generated`, imported above). The former
// `AutoMaterializedWebhookResource` deprecation wrapper was removed — these SDKs are
// pre-release, so there is no back-compat to deprecate. The phone-number binding model
// (`phoneNumbers.setSwmlWebhook` / `setCxmlWebhook`) remains the documented way to
// auto-materialize a webhook; direct create is just a normal operation.

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
  async list(params?: QueryParams): Promise<ResourceListResponse> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a single fabric resource by ID.
   *
   * @param resourceId - Unique identifier of the resource.
   * @returns The resource record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(resourceId: string): Promise<ResourceResponse> {
    return this._http.get(this._path(resourceId));
  }

  /**
   * Delete a fabric resource.
   *
   * @param resourceId - Unique identifier of the resource.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(resourceId: string): Promise<unknown> {
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
  async listAddresses(
    resourceId: string,
    params?: QueryParams,
  ): Promise<ResourceAddressListResponse> {
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
  async assignPhoneRoute(
    resourceId: string,
    body: PhoneRouteAssignRequest,
  ): Promise<PhoneRouteResponse> {
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
  async assignDomainApplication(
    resourceId: string,
    body: DomainApplicationAssignRequest,
  ): Promise<DomainApplicationResponse> {
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
  async list(params?: QueryParams): Promise<FabricAddressesResponse> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a single fabric address by ID.
   *
   * @param addressId - Unique identifier of the address.
   * @returns The address record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(addressId: string): Promise<FabricAddress> {
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
  async createSubscriberToken(
    body: Partial<SubscriberTokenRequest> = {},
  ): Promise<SubscriberTokenResponse> {
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
  async refreshSubscriberToken(
    body: Partial<SubscriberRefreshTokenRequest> = {},
  ): Promise<SubscriberRefreshTokenResponse> {
    return this._http.post(this._path('subscribers', 'tokens', 'refresh'), body);
  }

  /**
   * Create a single-use invite token for onboarding a new subscriber.
   *
   * @param body - Invite payload (email, phone, permissions). Defaults to `{}`.
   * @returns The invite record, including the share URL / code.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createInviteToken(
    body: Partial<SubscriberInviteTokenCreateRequest> = {},
  ): Promise<SubscriberInviteTokenCreateResponse> {
    return this._http.post(this._path('subscriber', 'invites'), body);
  }

  /**
   * Issue a guest token (no subscriber account required).
   *
   * @param body - Guest-token payload (context, TTL, etc.). Defaults to `{}`.
   * @returns The token record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createGuestToken(
    body: Partial<SubscriberGuestTokenCreateRequest> = {},
  ): Promise<SubscriberGuestTokenCreateResponse> {
    return this._http.post(this._path('guests', 'tokens'), body);
  }

  /**
   * Issue a short-lived embed token for browser-side SignalWire widgets.
   *
   * @param body - Embed-token payload (allowed origins, TTL, etc.). Defaults to `{}`.
   * @returns The token record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createEmbedToken(body: Partial<EmbedsTokensRequest> = {}): Promise<EmbedsTokensResponse> {
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
  readonly swmlScripts: SwmlScripts;
  /** Relay Application CRUD (full-replacement `PUT` update). */
  readonly relayApplications: RelayApplications;
  /** Call Flow CRUD with version listing and publishing. */
  readonly callFlows: CallFlowsResource;
  /** Conference Room CRUD with address listing. */
  readonly conferenceRooms: ConferenceRoomsResource;
  /** FreeSWITCH Connector CRUD. */
  readonly freeswitchConnectors: FreeswitchConnectors;
  /** Subscriber CRUD plus nested SIP endpoint management. */
  readonly subscribers: SubscribersResource;
  /** Top-level SIP endpoint CRUD. */
  readonly sipEndpoints: SipEndpoints;
  /** cXML (LaML) script CRUD. */
  readonly cxmlScripts: CxmlScripts;
  /** cXML application read / update / delete (no create). */
  readonly cxmlApplications: CxmlApplicationsResource;

  // PATCH-update resources. `swmlWebhooks` / `cxmlWebhooks` are normally
  // auto-materialized via `phoneNumbers.setSwmlWebhook` / `setCxmlWebhook`;
  // direct create is a normal operation.
  readonly swmlWebhooks: SwmlWebhooks;
  /** AI Agent CRUD — the platform-managed agent registration resource. */
  readonly aiAgents: AiAgents;
  /** SIP Gateway CRUD. */
  readonly sipGateways: SipGateways;
  /** cXML webhook CRUD. */
  readonly cxmlWebhooks: CxmlWebhooks;

  // Special resources
  /** Generic operations across all resource types (list, get, delete, phone route assignment). */
  readonly resources: GenericResources;
  /** Read-only access to the unified fabric address table. */
  readonly addresses: FabricAddresses;
  /** Subscriber, guest, invite, and embed token generation. */
  readonly tokens: FabricTokens;

  constructor(http: HttpClient) {
    const base = '/api/fabric/resources';

    // Generated typed CRUD resources (named-subclass shape, closed body + extras).
    this.swmlScripts = new SwmlScripts(http);
    this.relayApplications = new RelayApplications(http);
    this.callFlows = new CallFlowsResource(http, `${base}/call_flows`);
    this.conferenceRooms = new ConferenceRoomsResource(http, `${base}/conference_rooms`);
    this.freeswitchConnectors = new FreeswitchConnectors(http);
    this.subscribers = new SubscribersResource(http, `${base}/subscribers`);
    this.sipEndpoints = new SipEndpoints(http);
    this.cxmlScripts = new CxmlScripts(http);
    this.cxmlApplications = new CxmlApplicationsResource(http, `${base}/cxml_applications`);

    // swmlWebhooks / cxmlWebhooks are normally auto-materialized via
    // phoneNumbers.setSwmlWebhook / setCxmlWebhook; direct create is a normal operation.
    this.swmlWebhooks = new SwmlWebhooks(http);
    this.aiAgents = new AiAgents(http);
    this.sipGateways = new SipGateways(http);
    this.cxmlWebhooks = new CxmlWebhooks(http);

    // Special resources
    this.resources = new GenericResources(http, base);
    this.addresses = new FabricAddresses(http, '/api/fabric/addresses');
    this.tokens = new FabricTokens(http);
  }
}
