// AUTO-GENERATED from porting-sdk/rest-apis/fabric/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { FabricResource } from '../base/FabricResource.js';
import { ReadResource } from '../base/ReadResource.js';
import type {
  AIAgentCreateRequest,
  AIAgentListResponse,
  AIAgentResponse,
  AIAgentUpdateRequest,
  CXMLScriptCreateRequest,
  CXMLScriptListResponse,
  CXMLScriptResponse,
  CXMLScriptUpdateRequest,
  CXMLWebhookCreateRequest,
  CXMLWebhookListResponse,
  CXMLWebhookResponse,
  CXMLWebhookUpdateRequest,
  CallFlowAddressListResponse,
  CallFlowCreateRequest,
  CallFlowListResponse,
  CallFlowResponse,
  CallFlowUpdateRequest,
  CallFlowVersionDeployRequest,
  CallFlowVersionDeployResponse,
  CallFlowVersionListResponse,
  Ciphers,
  Codecs,
  ConferenceRoomAddressListResponse,
  ConferenceRoomCreateRequest,
  ConferenceRoomListResponse,
  ConferenceRoomResponse,
  ConferenceRoomUpdateRequest,
  CxmlApplicationAddressListResponse,
  CxmlApplicationListResponse,
  CxmlApplicationResponse,
  DomainApplicationResponse,
  EmbedsTokensResponse,
  Encryption,
  FabricAddress,
  FabricAddressesResponse,
  FreeswitchConnectorCreateRequest,
  FreeswitchConnectorListResponse,
  FreeswitchConnectorResponse,
  FreeswitchConnectorUpdateRequest,
  PhoneRouteResponse,
  RelayApplicationCreateRequest,
  RelayApplicationListResponse,
  RelayApplicationResponse,
  RelayApplicationUpdateRequest,
  ResourceAddressListResponse,
  ResourceListResponse,
  ResourceResponse,
  SWMLWebhookCreateRequest,
  SWMLWebhookListResponse,
  SWMLWebhookResponse,
  SWMLWebhookUpdateRequest,
  SipEndpointCreateRequest,
  SipEndpointListResponse,
  SipEndpointResponse,
  SipEndpointUpdateRequest,
  SipGatewayListResponse,
  SipGatewayRequest,
  SipGatewayRequestUpdate,
  SipGatewayResponse,
  SubscriberGuestTokenCreateResponse,
  SubscriberInviteTokenCreateResponse,
  SubscriberListResponse,
  SubscriberRefreshTokenResponse,
  SubscriberRequest,
  SubscriberResponse,
  SubscriberSIPEndpoint,
  SubscriberSipEndpointListResponse,
  SubscriberTokenResponse,
  SwmlScriptCreateRequest,
  SwmlScriptListResponse,
  SwmlScriptResponse,
  SwmlScriptUpdateRequest,
  UsedForType,
  jwt,
  uuid,
} from './fabric.types.generated.js';

export class FabricAddresses extends ReadResource<FabricAddressesResponse, FabricAddress> {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/addresses');
  }
}

export class GenericResources extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources');
  }

  async list(params?: QueryParams): Promise<ResourceListResponse> {
    return this._http.get<ResourceListResponse>(this._basePath, params);
  }

  async get(id: string, params?: QueryParams): Promise<ResourceResponse> {
    return this._http.get<ResourceResponse>(this._path(id), params);
  }

  async delete(id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id));
  }

  async listAddresses(id: string, params?: QueryParams): Promise<ResourceAddressListResponse> {
    return this._http.get<ResourceAddressListResponse>(this._path(id, 'addresses'), params);
  }

  async assignPhoneRoute(
    id: string,
    phone_route_id: uuid,
    handler: UsedForType,
    extras?: Record<string, unknown>,
  ): Promise<PhoneRouteResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      phone_route_id,
      handler,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<PhoneRouteResponse>(this._path(id, 'phone_routes'), body);
  }

  async assignDomainApplication(
    id: string,
    domain_application_id: uuid,
    extras?: Record<string, unknown>,
  ): Promise<DomainApplicationResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      domain_application_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<DomainApplicationResponse>(this._path(id, 'domain_applications'), body);
  }
}

export class AiAgents extends FabricResource<
  AIAgentListResponse,
  AIAgentResponse,
  AIAgentCreateRequest,
  AIAgentUpdateRequest
> {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/ai_agents');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: AIAgentCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<AIAgentResponse> {
    return this._http.post<AIAgentResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: AIAgentUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<AIAgentResponse> {
    return this._http.patch<AIAgentResponse>(this._path(id), { ...body, ...extras });
  }
}

export class CallFlows extends FabricResource<
  CallFlowListResponse,
  CallFlowResponse,
  CallFlowCreateRequest,
  CallFlowUpdateRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/call_flows');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: CallFlowCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<CallFlowResponse> {
    return this._http.post<CallFlowResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: CallFlowUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<CallFlowResponse> {
    return this._http.put<CallFlowResponse>(this._path(id), { ...body, ...extras });
  }

  async listAddresses(id: string, params?: QueryParams): Promise<CallFlowAddressListResponse> {
    return this._http.get<CallFlowAddressListResponse>(
      `/api/fabric/resources/call_flow/${id}/addresses`,
      params,
    );
  }

  async listVersions(id: string, params?: QueryParams): Promise<CallFlowVersionListResponse> {
    return this._http.get<CallFlowVersionListResponse>(
      `/api/fabric/resources/call_flow/${id}/versions`,
      params,
    );
  }

  async deployVersion(
    id: string,
    body: CallFlowVersionDeployRequest,
    extras?: Record<string, unknown>,
  ): Promise<CallFlowVersionDeployResponse> {
    return this._http.post<CallFlowVersionDeployResponse>(
      `/api/fabric/resources/call_flow/${id}/versions`,
      { ...body, ...extras },
    );
  }
}

export class ConferenceRooms extends FabricResource<
  ConferenceRoomListResponse,
  ConferenceRoomResponse,
  ConferenceRoomCreateRequest,
  ConferenceRoomUpdateRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/conference_rooms');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: ConferenceRoomCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<ConferenceRoomResponse> {
    return this._http.post<ConferenceRoomResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: ConferenceRoomUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<ConferenceRoomResponse> {
    return this._http.put<ConferenceRoomResponse>(this._path(id), { ...body, ...extras });
  }

  async listAddresses(
    id: string,
    params?: QueryParams,
  ): Promise<ConferenceRoomAddressListResponse> {
    return this._http.get<ConferenceRoomAddressListResponse>(
      `/api/fabric/resources/conference_room/${id}/addresses`,
      params,
    );
  }
}

export class CxmlApplications extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/cxml_applications');
  }

  async list(params?: QueryParams): Promise<CxmlApplicationListResponse> {
    return this._http.get<CxmlApplicationListResponse>(this._basePath, params);
  }

  async get(id: string, params?: QueryParams): Promise<CxmlApplicationResponse> {
    return this._http.get<CxmlApplicationResponse>(this._path(id), params);
  }

  async update(
    id: string,
    display_name?: string,
    account_sid?: uuid,
    voice_url?: string,
    voice_method?: 'GET' | 'POST',
    voice_fallback_url?: string,
    voice_fallback_method?: 'GET' | 'POST',
    status_callback?: string,
    status_callback_method?: 'GET' | 'POST',
    sms_url?: string,
    sms_method?: 'GET' | 'POST',
    sms_fallback_url?: string,
    sms_fallback_method?: 'GET' | 'POST',
    sms_status_callback?: string,
    sms_status_callback_method?: 'GET' | 'POST',
    extras?: Record<string, unknown>,
  ): Promise<CxmlApplicationResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      display_name,
      account_sid,
      voice_url,
      voice_method,
      voice_fallback_url,
      voice_fallback_method,
      status_callback,
      status_callback_method,
      sms_url,
      sms_method,
      sms_fallback_url,
      sms_fallback_method,
      sms_status_callback,
      sms_status_callback_method,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.put<CxmlApplicationResponse>(this._path(id), body);
  }

  async delete(id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id));
  }

  async listAddresses(
    id: string,
    params?: QueryParams,
  ): Promise<CxmlApplicationAddressListResponse> {
    return this._http.get<CxmlApplicationAddressListResponse>(this._path(id, 'addresses'), params);
  }
}

export class CxmlScripts extends FabricResource<
  CXMLScriptListResponse,
  CXMLScriptResponse,
  CXMLScriptCreateRequest,
  CXMLScriptUpdateRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/cxml_scripts');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: CXMLScriptCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<CXMLScriptResponse> {
    return this._http.post<CXMLScriptResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: CXMLScriptUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<CXMLScriptResponse> {
    return this._http.put<CXMLScriptResponse>(this._path(id), { ...body, ...extras });
  }
}

export class CxmlWebhooks extends FabricResource<
  CXMLWebhookListResponse,
  CXMLWebhookResponse,
  CXMLWebhookCreateRequest,
  CXMLWebhookUpdateRequest
> {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/cxml_webhooks');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: CXMLWebhookCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<CXMLWebhookResponse> {
    return this._http.post<CXMLWebhookResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: CXMLWebhookUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<CXMLWebhookResponse> {
    return this._http.patch<CXMLWebhookResponse>(this._path(id), { ...body, ...extras });
  }
}

export class FreeswitchConnectors extends FabricResource<
  FreeswitchConnectorListResponse,
  FreeswitchConnectorResponse,
  FreeswitchConnectorCreateRequest,
  FreeswitchConnectorUpdateRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/freeswitch_connectors');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: FreeswitchConnectorCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<FreeswitchConnectorResponse> {
    return this._http.post<FreeswitchConnectorResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: FreeswitchConnectorUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<FreeswitchConnectorResponse> {
    return this._http.put<FreeswitchConnectorResponse>(this._path(id), { ...body, ...extras });
  }
}

export class RelayApplications extends FabricResource<
  RelayApplicationListResponse,
  RelayApplicationResponse,
  RelayApplicationCreateRequest,
  RelayApplicationUpdateRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/relay_applications');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: RelayApplicationCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<RelayApplicationResponse> {
    return this._http.post<RelayApplicationResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: RelayApplicationUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<RelayApplicationResponse> {
    return this._http.put<RelayApplicationResponse>(this._path(id), { ...body, ...extras });
  }
}

export class SipEndpoints extends FabricResource<
  SipEndpointListResponse,
  SipEndpointResponse,
  SipEndpointCreateRequest,
  SipEndpointUpdateRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/sip_endpoints');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: SipEndpointCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<SipEndpointResponse> {
    return this._http.post<SipEndpointResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SipEndpointUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<SipEndpointResponse> {
    return this._http.put<SipEndpointResponse>(this._path(id), { ...body, ...extras });
  }
}

export class SipGateways extends FabricResource<
  SipGatewayListResponse,
  SipGatewayResponse,
  SipGatewayRequest,
  SipGatewayRequestUpdate
> {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/sip_gateways');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: SipGatewayRequest,
    extras?: Record<string, unknown>,
  ): Promise<SipGatewayResponse> {
    return this._http.post<SipGatewayResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SipGatewayRequestUpdate,
    extras?: Record<string, unknown>,
  ): Promise<SipGatewayResponse> {
    return this._http.patch<SipGatewayResponse>(this._path(id), { ...body, ...extras });
  }
}

export class Subscribers extends FabricResource<
  SubscriberListResponse,
  SubscriberResponse,
  SubscriberRequest,
  SubscriberRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/subscribers');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: SubscriberRequest,
    extras?: Record<string, unknown>,
  ): Promise<SubscriberResponse> {
    return this._http.post<SubscriberResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SubscriberRequest,
    extras?: Record<string, unknown>,
  ): Promise<SubscriberResponse> {
    return this._http.put<SubscriberResponse>(this._path(id), { ...body, ...extras });
  }

  async listSipEndpoints(
    fabric_subscriber_id: string,
    params?: QueryParams,
  ): Promise<SubscriberSipEndpointListResponse> {
    return this._http.get<SubscriberSipEndpointListResponse>(
      this._path(fabric_subscriber_id, 'sip_endpoints'),
      params,
    );
  }

  async createSipEndpoint(
    fabric_subscriber_id: string,
    username: string,
    password: string,
    caller_id?: string,
    send_as?: string,
    ciphers?: Ciphers[],
    codecs?: Codecs[],
    encryption?: Encryption,
    extras?: Record<string, unknown>,
  ): Promise<SubscriberSIPEndpoint> {
    const body: Record<string, unknown> = {};
    const _fields = {
      username,
      password,
      caller_id,
      send_as,
      ciphers,
      codecs,
      encryption,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<SubscriberSIPEndpoint>(
      this._path(fabric_subscriber_id, 'sip_endpoints'),
      body,
    );
  }

  async getSipEndpoint(
    fabric_subscriber_id: string,
    id: string,
    params?: QueryParams,
  ): Promise<SubscriberSIPEndpoint> {
    return this._http.get<SubscriberSIPEndpoint>(
      this._path(fabric_subscriber_id, 'sip_endpoints', id),
      params,
    );
  }

  async updateSipEndpoint(
    fabric_subscriber_id: string,
    id: string,
    username?: string,
    password?: string,
    caller_id?: string,
    send_as?: string,
    ciphers?: Ciphers[],
    codecs?: Codecs[],
    encryption?: Encryption,
    extras?: Record<string, unknown>,
  ): Promise<SubscriberSIPEndpoint> {
    const body: Record<string, unknown> = {};
    const _fields = {
      username,
      password,
      caller_id,
      send_as,
      ciphers,
      codecs,
      encryption,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.patch<SubscriberSIPEndpoint>(
      this._path(fabric_subscriber_id, 'sip_endpoints', id),
      body,
    );
  }

  async deleteSipEndpoint(
    fabric_subscriber_id: string,
    id: string,
  ): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(
      this._path(fabric_subscriber_id, 'sip_endpoints', id),
    );
  }
}

export class SwmlScripts extends FabricResource<
  SwmlScriptListResponse,
  SwmlScriptResponse,
  SwmlScriptCreateRequest,
  SwmlScriptUpdateRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/swml_scripts');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: SwmlScriptCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<SwmlScriptResponse> {
    return this._http.post<SwmlScriptResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SwmlScriptUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<SwmlScriptResponse> {
    return this._http.put<SwmlScriptResponse>(this._path(id), { ...body, ...extras });
  }
}

export class SwmlWebhooks extends FabricResource<
  SWMLWebhookListResponse,
  SWMLWebhookResponse,
  SWMLWebhookCreateRequest,
  SWMLWebhookUpdateRequest
> {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/swml_webhooks');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: SWMLWebhookCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<SWMLWebhookResponse> {
    return this._http.post<SWMLWebhookResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SWMLWebhookUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<SWMLWebhookResponse> {
    return this._http.patch<SWMLWebhookResponse>(this._path(id), { ...body, ...extras });
  }
}

export class FabricTokens extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/fabric');
  }

  async createSubscriberToken(
    reference: string,
    expire_at?: number,
    application_id?: uuid,
    password?: string,
    first_name?: string,
    last_name?: string,
    display_name?: string,
    job_title?: string,
    time_zone?: string,
    country?: string,
    region?: string,
    company_name?: string,
    extras?: Record<string, unknown>,
  ): Promise<SubscriberTokenResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      reference,
      expire_at,
      application_id,
      password,
      first_name,
      last_name,
      display_name,
      job_title,
      time_zone,
      country,
      region,
      company_name,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<SubscriberTokenResponse>(this._path('subscribers', 'tokens'), body);
  }

  async refreshSubscriberToken(
    refresh_token: jwt,
    extras?: Record<string, unknown>,
  ): Promise<SubscriberRefreshTokenResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      refresh_token,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<SubscriberRefreshTokenResponse>(
      this._path('subscribers', 'tokens', 'refresh'),
      body,
    );
  }

  async createInviteToken(
    address_id: uuid,
    expires_at?: number,
    extras?: Record<string, unknown>,
  ): Promise<SubscriberInviteTokenCreateResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      address_id,
      expires_at,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<SubscriberInviteTokenCreateResponse>(
      this._path('subscriber', 'invites'),
      body,
    );
  }

  async createGuestToken(
    allowed_addresses: uuid[],
    expire_at?: number,
    extras?: Record<string, unknown>,
  ): Promise<SubscriberGuestTokenCreateResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      allowed_addresses,
      expire_at,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<SubscriberGuestTokenCreateResponse>(
      this._path('guests', 'tokens'),
      body,
    );
  }

  async createEmbedToken(
    token: string,
    extras?: Record<string, unknown>,
  ): Promise<EmbedsTokensResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      token,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<EmbedsTokensResponse>(this._path('embeds', 'tokens'), body);
  }
}
