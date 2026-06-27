// AUTO-GENERATED from porting-sdk/rest-apis/fabric/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed CRUD subclass per full-CRUD resource (closed body + extras door),
// bound to the resource's spec types so the oracle resolves the crud_base.

import { FabricResource, FabricResourcePUT } from '../base/FabricResource.js';
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
  CallFlowCreateRequest,
  CallFlowListResponse,
  CallFlowResponse,
  CallFlowUpdateRequest,
  ConferenceRoomCreateRequest,
  ConferenceRoomListResponse,
  ConferenceRoomResponse,
  ConferenceRoomUpdateRequest,
  FreeswitchConnectorCreateRequest,
  FreeswitchConnectorListResponse,
  FreeswitchConnectorResponse,
  FreeswitchConnectorUpdateRequest,
  RelayApplicationCreateRequest,
  RelayApplicationListResponse,
  RelayApplicationResponse,
  RelayApplicationUpdateRequest,
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
  SubscriberListResponse,
  SubscriberRequest,
  SubscriberResponse,
  SwmlScriptCreateRequest,
  SwmlScriptListResponse,
  SwmlScriptResponse,
  SwmlScriptUpdateRequest,
} from './fabric.types.generated.js';

export class AiAgentsResource extends FabricResource<
  AIAgentListResponse,
  AIAgentResponse,
  AIAgentCreateRequest,
  AIAgentUpdateRequest
> {
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

export class CallFlowsResource extends FabricResourcePUT<
  CallFlowListResponse,
  CallFlowResponse,
  CallFlowCreateRequest,
  CallFlowUpdateRequest
> {
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
}

export class ConferenceRoomsResource extends FabricResourcePUT<
  ConferenceRoomListResponse,
  ConferenceRoomResponse,
  ConferenceRoomCreateRequest,
  ConferenceRoomUpdateRequest
> {
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
}

export class CxmlScriptsResource extends FabricResourcePUT<
  CXMLScriptListResponse,
  CXMLScriptResponse,
  CXMLScriptCreateRequest,
  CXMLScriptUpdateRequest
> {
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

export class CxmlWebhooksResource extends FabricResource<
  CXMLWebhookListResponse,
  CXMLWebhookResponse,
  CXMLWebhookCreateRequest,
  CXMLWebhookUpdateRequest
> {
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

export class FreeswitchConnectorsResource extends FabricResourcePUT<
  FreeswitchConnectorListResponse,
  FreeswitchConnectorResponse,
  FreeswitchConnectorCreateRequest,
  FreeswitchConnectorUpdateRequest
> {
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

export class RelayApplicationsResource extends FabricResourcePUT<
  RelayApplicationListResponse,
  RelayApplicationResponse,
  RelayApplicationCreateRequest,
  RelayApplicationUpdateRequest
> {
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

export class SipEndpointsResource extends FabricResourcePUT<
  SipEndpointListResponse,
  SipEndpointResponse,
  SipEndpointCreateRequest,
  SipEndpointUpdateRequest
> {
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

export class SipGatewaysResource extends FabricResource<
  SipGatewayListResponse,
  SipGatewayResponse,
  SipGatewayRequest,
  SipGatewayRequestUpdate
> {
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

export class SubscribersResource extends FabricResourcePUT<
  SubscriberListResponse,
  SubscriberResponse,
  SubscriberRequest,
  SubscriberRequest
> {
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
}

export class SwmlScriptsResource extends FabricResourcePUT<
  SwmlScriptListResponse,
  SwmlScriptResponse,
  SwmlScriptCreateRequest,
  SwmlScriptUpdateRequest
> {
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

export class SwmlWebhooksResource extends FabricResource<
  SWMLWebhookListResponse,
  SWMLWebhookResponse,
  SWMLWebhookCreateRequest,
  SWMLWebhookUpdateRequest
> {
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
