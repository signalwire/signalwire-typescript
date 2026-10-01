// AUTO-GENERATED from porting-sdk/rest-apis/fabric/openapi.enriched.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { RequestOptionsInit } from '../RequestOptions.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { CrudResource } from '../base/CrudResource.js';
import { FabricResource } from '../base/FabricResource.js';
import { ReadResource } from '../base/ReadResource.js';
import type {
  AIAgentConversationLogListResponse,
  AIAgentCreateRequest,
  AIAgentListResponse,
  AIAgentResponse,
  AIAgentUpdateRequest,
  AIAgentVoice,
  AliasAddress,
  AliasAddressCreateRequest,
  AliasAddressListResponse,
  AliasAddressUpdateRequest,
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
  FabricAddressItem,
  FabricAddressListResponse,
  FreeswitchConnectorCreateRequest,
  FreeswitchConnectorListResponse,
  FreeswitchConnectorResponse,
  FreeswitchConnectorUpdateRequest,
  PhoneNumberAddress,
  PhoneNumberAddressCreateRequest,
  PhoneNumberAddressListResponse,
  PhoneNumberAddressUpdateRequest,
  PhoneRouteResponse,
  RelayApplicationCreateRequest,
  RelayApplicationListResponse,
  RelayApplicationResponse,
  RelayApplicationUpdateRequest,
  ResourceAddressListResponse,
  ResourceListResponse,
  ResourceResponse,
  ResourceResponseSipEndpoint,
  SWMLWebhookCreateRequest,
  SWMLWebhookListResponse,
  SWMLWebhookResponse,
  SWMLWebhookUpdateRequest,
  SipAddress,
  SipAddressCreateRequest,
  SipAddressListResponse,
  SipAddressUpdateRequest,
  SipEndpointCreateRequest,
  SipEndpointListResponse,
  SipEndpointResponse,
  SipEndpointUpdateRequest,
  SipGatewayListResponse,
  SipGatewayRequest,
  SipGatewayRequestUpdate,
  SipGatewayResponse,
  SubscriberGuestTokenCreateResponse,
  SubscriberListResponse,
  SubscriberRefreshTokenResponse,
  SubscriberRequest,
  SubscriberResponse,
  SubscriberSIPEndpoint,
  SubscriberSipEndpointListResponse,
  SubscriberTokenResponse,
  SubscriberUpdateRequest,
  SwmlScriptCreateRequest,
  SwmlScriptListResponse,
  SwmlScriptResponse,
  SwmlScriptUpdateRequest,
  UsedForType,
  WhatsappNumberAddressResponse,
  jwt,
  uuid,
} from './fabric.types.generated.js';

export class AliasAddresses extends CrudResource<
  AliasAddressListResponse,
  AliasAddress,
  AliasAddressCreateRequest,
  AliasAddressUpdateRequest
> {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/addresses/alias');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: AliasAddressCreateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<AliasAddress> {
    return this._http.post<AliasAddress>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: AliasAddressUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<AliasAddress> {
    return this._http.patch<AliasAddress>(this._path(id), { ...body, ...extras }, requestOptions);
  }
}

export class SipAddresses extends CrudResource<
  SipAddressListResponse,
  SipAddress,
  SipAddressCreateRequest,
  SipAddressUpdateRequest
> {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/addresses/sip');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: SipAddressCreateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<SipAddress> {
    return this._http.post<SipAddress>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SipAddressUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<SipAddress> {
    return this._http.patch<SipAddress>(this._path(id), { ...body, ...extras }, requestOptions);
  }
}

export class PhoneNumberAddresses extends CrudResource<
  PhoneNumberAddressListResponse,
  PhoneNumberAddress,
  PhoneNumberAddressCreateRequest,
  PhoneNumberAddressUpdateRequest
> {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/addresses/phone');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: PhoneNumberAddressCreateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<PhoneNumberAddress> {
    return this._http.post<PhoneNumberAddress>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: PhoneNumberAddressUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<PhoneNumberAddress> {
    return this._http.patch<PhoneNumberAddress>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
  }
}

export class FabricAddresses extends ReadResource<FabricAddressListResponse, FabricAddressItem> {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/addresses');
  }

  async delete(id: string, requestOptions?: RequestOptionsInit): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id), requestOptions);
  }
}

export class GenericResources extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources');
  }

  async list(
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<ResourceListResponse> {
    return this._http.get<ResourceListResponse>(this._basePath, params, requestOptions);
  }

  async get(
    id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<ResourceResponse> {
    return this._http.get<ResourceResponse>(this._path(id), params, requestOptions);
  }

  async delete(id: string, requestOptions?: RequestOptionsInit): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id), requestOptions);
  }

  async listAddresses(
    id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<ResourceAddressListResponse> {
    return this._http.get<ResourceAddressListResponse>(
      this._path(id, 'addresses'),
      params,
      requestOptions,
    );
  }

  async assignPhoneRoute(
    id: string,
    phone_route_id: uuid,
    handler: UsedForType,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<PhoneRouteResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      phone_route_id,
      handler,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<PhoneRouteResponse>(
      this._path(id, 'phone_routes'),
      body,
      undefined,
      requestOptions,
    );
  }

  async assignDomainApplication(
    id: string,
    domain_application_id: uuid,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<DomainApplicationResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      domain_application_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<DomainApplicationResponse>(
      this._path(id, 'domain_applications'),
      body,
      undefined,
      requestOptions,
    );
  }

  async assignSipEndpoint(
    id: string,
    sip_endpoint_id: uuid,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<ResourceResponseSipEndpoint> {
    const body: Record<string, unknown> = {};
    const _fields = {
      sip_endpoint_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<ResourceResponseSipEndpoint>(
      this._path(id, 'sip_endpoints'),
      body,
      undefined,
      requestOptions,
    );
  }

  async assignWhatsappNumber(
    id: string,
    whatsapp_number_id: uuid,
    handler: UsedForType,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<WhatsappNumberAddressResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      whatsapp_number_id,
      handler,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<WhatsappNumberAddressResponse>(
      this._path(id, 'whatsapp_numbers'),
      body,
      undefined,
      requestOptions,
    );
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
    requestOptions?: RequestOptionsInit,
  ): Promise<AIAgentResponse> {
    return this._http.post<AIAgentResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: AIAgentUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<AIAgentResponse> {
    return this._http.patch<AIAgentResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
  }

  async listVoices(
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<AIAgentVoice[]> {
    return this._http.get<AIAgentVoice[]>(this._path('voices'), params, requestOptions);
  }

  async listConversationLogs(
    ai_agent_id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<AIAgentConversationLogListResponse> {
    return this._http.get<AIAgentConversationLogListResponse>(
      this._path(ai_agent_id, 'conversation_logs'),
      params,
      requestOptions,
    );
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
    requestOptions?: RequestOptionsInit,
  ): Promise<CallFlowResponse> {
    return this._http.post<CallFlowResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: CallFlowUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<CallFlowResponse> {
    return this._http.put<CallFlowResponse>(this._path(id), { ...body, ...extras }, requestOptions);
  }

  async listAddresses(
    id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<CallFlowAddressListResponse> {
    return this._http.get<CallFlowAddressListResponse>(
      this._path(id, 'addresses'),
      params,
      requestOptions,
    );
  }

  async listVersions(
    id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<CallFlowVersionListResponse> {
    return this._http.get<CallFlowVersionListResponse>(
      this._path(id, 'versions'),
      params,
      requestOptions,
    );
  }

  async deployVersion(
    id: string,
    body: CallFlowVersionDeployRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<CallFlowVersionDeployResponse> {
    return this._http.post<CallFlowVersionDeployResponse>(
      this._path(id, 'versions'),
      { ...body, ...extras },
      undefined,
      requestOptions,
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
    requestOptions?: RequestOptionsInit,
  ): Promise<ConferenceRoomResponse> {
    return this._http.post<ConferenceRoomResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: ConferenceRoomUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<ConferenceRoomResponse> {
    return this._http.put<ConferenceRoomResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
  }

  async listAddresses(
    id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<ConferenceRoomAddressListResponse> {
    return this._http.get<ConferenceRoomAddressListResponse>(
      this._path(id, 'addresses'),
      params,
      requestOptions,
    );
  }
}

export class CxmlApplications extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/cxml_applications');
  }

  async list(
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<CxmlApplicationListResponse> {
    return this._http.get<CxmlApplicationListResponse>(this._basePath, params, requestOptions);
  }

  async get(
    id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<CxmlApplicationResponse> {
    return this._http.get<CxmlApplicationResponse>(this._path(id), params, requestOptions);
  }

  async update(
    id: string,
    options?: {
      name?: string;
      call_request_url?: string;
      call_request_method?: 'GET' | 'POST';
      call_fallback_url?: string;
      call_fallback_method?: 'GET' | 'POST';
      call_status_url?: string;
      call_status_method?: 'GET' | 'POST';
      message_request_url?: string;
      message_request_method?: 'GET' | 'POST';
      message_fallback_url?: string;
      message_fallback_method?: 'GET' | 'POST';
      message_status_url?: string;
      message_status_method?: 'GET' | 'POST';
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<CxmlApplicationResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      name: options?.name,
      call_request_url: options?.call_request_url,
      call_request_method: options?.call_request_method,
      call_fallback_url: options?.call_fallback_url,
      call_fallback_method: options?.call_fallback_method,
      call_status_url: options?.call_status_url,
      call_status_method: options?.call_status_method,
      message_request_url: options?.message_request_url,
      message_request_method: options?.message_request_method,
      message_fallback_url: options?.message_fallback_url,
      message_fallback_method: options?.message_fallback_method,
      message_status_url: options?.message_status_url,
      message_status_method: options?.message_status_method,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<CxmlApplicationResponse>(this._path(id), body, requestOptions);
  }

  async delete(id: string, requestOptions?: RequestOptionsInit): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id), requestOptions);
  }

  async listAddresses(
    id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<CxmlApplicationAddressListResponse> {
    return this._http.get<CxmlApplicationAddressListResponse>(
      this._path(id, 'addresses'),
      params,
      requestOptions,
    );
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
    requestOptions?: RequestOptionsInit,
  ): Promise<CXMLScriptResponse> {
    return this._http.post<CXMLScriptResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: CXMLScriptUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<CXMLScriptResponse> {
    return this._http.put<CXMLScriptResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
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
    requestOptions?: RequestOptionsInit,
  ): Promise<CXMLWebhookResponse> {
    return this._http.post<CXMLWebhookResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: CXMLWebhookUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<CXMLWebhookResponse> {
    return this._http.patch<CXMLWebhookResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
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
    requestOptions?: RequestOptionsInit,
  ): Promise<FreeswitchConnectorResponse> {
    return this._http.post<FreeswitchConnectorResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: FreeswitchConnectorUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<FreeswitchConnectorResponse> {
    return this._http.put<FreeswitchConnectorResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
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
    requestOptions?: RequestOptionsInit,
  ): Promise<RelayApplicationResponse> {
    return this._http.post<RelayApplicationResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: RelayApplicationUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<RelayApplicationResponse> {
    return this._http.put<RelayApplicationResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
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
    requestOptions?: RequestOptionsInit,
  ): Promise<SipEndpointResponse> {
    return this._http.post<SipEndpointResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SipEndpointUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<SipEndpointResponse> {
    return this._http.put<SipEndpointResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
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
    requestOptions?: RequestOptionsInit,
  ): Promise<SipGatewayResponse> {
    return this._http.post<SipGatewayResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SipGatewayRequestUpdate,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<SipGatewayResponse> {
    return this._http.patch<SipGatewayResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
  }
}

export class Subscribers extends FabricResource<
  SubscriberListResponse,
  SubscriberResponse,
  SubscriberRequest,
  SubscriberUpdateRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/fabric/resources/subscribers');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: SubscriberRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<SubscriberResponse> {
    return this._http.post<SubscriberResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SubscriberUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<SubscriberResponse> {
    return this._http.put<SubscriberResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
  }

  async listSipEndpoints(
    fabric_subscriber_id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<SubscriberSipEndpointListResponse> {
    return this._http.get<SubscriberSipEndpointListResponse>(
      this._path(fabric_subscriber_id, 'sip_endpoints'),
      params,
      requestOptions,
    );
  }

  async createSipEndpoint(
    fabric_subscriber_id: string,
    username: string,
    password: string,
    options?: {
      caller_id?: string;
      send_as?: string;
      ciphers?: Ciphers[];
      codecs?: Codecs[];
      encryption?: Encryption;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<SubscriberSIPEndpoint> {
    const body: Record<string, unknown> = {};
    const _fields = {
      username,
      password,
      caller_id: options?.caller_id,
      send_as: options?.send_as,
      ciphers: options?.ciphers,
      codecs: options?.codecs,
      encryption: options?.encryption,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<SubscriberSIPEndpoint>(
      this._path(fabric_subscriber_id, 'sip_endpoints'),
      body,
      undefined,
      requestOptions,
    );
  }

  async getSipEndpoint(
    fabric_subscriber_id: string,
    id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<SubscriberSIPEndpoint> {
    return this._http.get<SubscriberSIPEndpoint>(
      this._path(fabric_subscriber_id, 'sip_endpoints', id),
      params,
      requestOptions,
    );
  }

  async updateSipEndpoint(
    fabric_subscriber_id: string,
    id: string,
    options?: {
      username?: string;
      password?: string;
      caller_id?: string;
      send_as?: string;
      ciphers?: Ciphers[];
      codecs?: Codecs[];
      encryption?: Encryption;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<SubscriberSIPEndpoint> {
    const body: Record<string, unknown> = {};
    const _fields = {
      username: options?.username,
      password: options?.password,
      caller_id: options?.caller_id,
      send_as: options?.send_as,
      ciphers: options?.ciphers,
      codecs: options?.codecs,
      encryption: options?.encryption,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.patch<SubscriberSIPEndpoint>(
      this._path(fabric_subscriber_id, 'sip_endpoints', id),
      body,
      requestOptions,
    );
  }

  async deleteSipEndpoint(
    fabric_subscriber_id: string,
    id: string,
    requestOptions?: RequestOptionsInit,
  ): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(
      this._path(fabric_subscriber_id, 'sip_endpoints', id),
      requestOptions,
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
    requestOptions?: RequestOptionsInit,
  ): Promise<SwmlScriptResponse> {
    return this._http.post<SwmlScriptResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SwmlScriptUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<SwmlScriptResponse> {
    return this._http.put<SwmlScriptResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
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
    requestOptions?: RequestOptionsInit,
  ): Promise<SWMLWebhookResponse> {
    return this._http.post<SWMLWebhookResponse>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: SWMLWebhookUpdateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<SWMLWebhookResponse> {
    return this._http.patch<SWMLWebhookResponse>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
  }
}

export class FabricTokens extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/fabric');
  }

  async createSubscriberToken(
    reference: string,
    options?: {
      ch?: string;
      expire_at?: number;
      application_id?: uuid;
      password?: string;
      first_name?: string;
      last_name?: string;
      display_name?: string;
      job_title?: string;
      time_zone?: string;
      country?: string;
      region?: string;
      company_name?: string;
      scope?: 'sat:refresh';
      fingerprint?: string;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<SubscriberTokenResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      reference,
      ch: options?.ch,
      expire_at: options?.expire_at,
      application_id: options?.application_id,
      password: options?.password,
      first_name: options?.first_name,
      last_name: options?.last_name,
      display_name: options?.display_name,
      job_title: options?.job_title,
      time_zone: options?.time_zone,
      country: options?.country,
      region: options?.region,
      company_name: options?.company_name,
      scope: options?.scope,
      fingerprint: options?.fingerprint,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<SubscriberTokenResponse>(
      this._path('subscribers', 'tokens'),
      body,
      undefined,
      requestOptions,
    );
  }

  async refreshSubscriberToken(
    refresh_token: jwt,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<SubscriberRefreshTokenResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      refresh_token,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<SubscriberRefreshTokenResponse>(
      this._path('subscribers', 'tokens', 'refresh'),
      body,
      undefined,
      requestOptions,
    );
  }

  async createGuestToken(
    allowed_addresses?: uuid[],
    options?: {
      expire_at?: number;
      ch?: string;
      region?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      display_name?: string;
      job_title?: string;
      time_zone?: string;
      country?: string;
      company_name?: string;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<SubscriberGuestTokenCreateResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      allowed_addresses,
      expire_at: options?.expire_at,
      ch: options?.ch,
      region: options?.region,
      email: options?.email,
      first_name: options?.first_name,
      last_name: options?.last_name,
      display_name: options?.display_name,
      job_title: options?.job_title,
      time_zone: options?.time_zone,
      country: options?.country,
      company_name: options?.company_name,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<SubscriberGuestTokenCreateResponse>(
      this._path('guests', 'tokens'),
      body,
      undefined,
      requestOptions,
    );
  }

  async createEmbedToken(
    token: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<EmbedsTokensResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      token,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<EmbedsTokensResponse>(
      this._path('embeds', 'tokens'),
      body,
      undefined,
      requestOptions,
    );
  }
}
