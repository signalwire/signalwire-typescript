/**
 * Fabric API types.
 *
 * Hand-derived from the canonical OpenAPI contract at
 * `porting-sdk/rest-apis/fabric/openapi.yaml`. Each interface mirrors a
 * `components/schemas` definition (or an operation's request-body / 2xx-response
 * schema); field names are the wire (snake_case) keys exactly as the platform
 * emits/accepts them. The mapped operationId for each type is noted in its
 * doc-comment.
 *
 * These are compile-time annotations only — they do not affect runtime behavior
 * or wire shape.
 */

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** Pagination links object shared by Fabric list responses (`*PaginationResponse`). */
export interface FabricPaginationLinks {
  /** Link to the current page. */
  self: string;
  /** Link to the first page. */
  first: string;
  /** Link to the next page, if any. */
  next?: string;
  /** Link to the previous page, if any. */
  prev?: string;
}

/** Audio channel descriptor. Schema: `AudioChannel`. */
export interface AudioChannel {
  /** Audio Channel of the Fabric Address. */
  audio: string;
}

/** Messaging channel descriptor. Schema: `MessagingChannel`. */
export interface MessagingChannel {
  /** Messaging Channel of the Fabric Address. */
  messaging: string;
}

/** Video channel descriptor. Schema: `VideoChannel`. */
export interface VideoChannel {
  /** Video Channel of the Fabric Address. */
  video: string;
}

/** Channels of a Fabric Address. Schema: `AddressChannel` (anyOf). */
export type AddressChannel = AudioChannel | MessagingChannel | VideoChannel;

/** Display type of a Fabric Address. Schema: `DisplayTypes`. */
export type DisplayTypes = 'app' | 'room' | 'call' | 'subscriber';

/** SRTP cipher suites. Schema: `Ciphers`. */
export type Ciphers =
  | 'AEAD_AES_256_GCM_8'
  | 'AES_256_CM_HMAC_SHA1_80'
  | 'AES_CM_128_HMAC_SHA1_80'
  | 'AES_256_CM_HMAC_SHA1_32'
  | 'AES_CM_128_HMAC_SHA1_32';

/** Media codecs. Schema: `Codecs`. */
export type Codecs = 'PCMU' | 'PCMA' | 'G722' | 'G729' | 'OPUS' | 'VP8' | 'H264';

/** SIP endpoint encryption requirement. Schema: `Encryption`. */
export type Encryption = 'required' | 'optional' | 'default';

/** Handler routing target for a phone route. Schema: `UsedForType`. */
export type UsedForType = 'calling' | 'messaging';

// ---------------------------------------------------------------------------
// Fabric Addresses
// ---------------------------------------------------------------------------

/** A single Fabric Address. Schema: `FabricAddress`. */
export interface FabricAddress {
  /** Unique ID of the Fabric Address. */
  id: string;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string;
  /** Whether the Fabric Address is locked (prevented from accepting calls). */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels: AddressChannel;
  /** Fabric Address creation date (date-time). */
  created_at: string;
  /** Display type of the Fabric Address. */
  type: DisplayTypes;
}

/**
 * A Fabric Address pointing to an application. Schema: `FabricAddressApp`.
 * Identical to {@link FabricAddress} except `type` is fixed to `app`.
 */
export interface FabricAddressApp extends Omit<FabricAddress, 'type'> {
  /** Display type — always `app` for application addresses. */
  type: 'app';
}

/**
 * A Fabric Address pointing to a conference room. Schema: `FabricAddressRoom`.
 * Identical to {@link FabricAddress} except `type` is fixed to `room`.
 */
export interface FabricAddressRoom extends Omit<FabricAddress, 'type'> {
  /** Display type — always `room` for conference-room addresses. */
  type: 'room';
}

/** List of Fabric Addresses. Schema: `FabricAddressesResponse` (op: `list_fabric_addresses`). */
export interface FabricAddressesResponse {
  /** Array of Fabric Addresses. */
  data: FabricAddress[];
  /** Pagination links. */
  links: FabricPaginationLinks;
}

// ---------------------------------------------------------------------------
// Call Flows
// ---------------------------------------------------------------------------

/** List of Call Flow Addresses. Schema: `CallFlowAddressListResponse` (op: `list_call_flow_addresses`). */
export interface CallFlowAddressListResponse {
  /** Array of Call Flow Addresses. */
  data: FabricAddressApp[];
  /** Pagination links. */
  links: FabricPaginationLinks;
}

/** A single Call Flow version. Schema: `CallFlowVersion`. */
export interface CallFlowVersion {
  /** Unique identifier of the version. */
  id: string;
  /** The version number. */
  version: string;
  /** Creation timestamp. */
  created_at: string;
  /** Last update timestamp. */
  updated_at: string;
  /** Call Flow data structure. */
  flow_data?: string;
  /** SWML document for this version. */
  relayml?: string;
}

/** List of Call Flow versions. Schema: `CallFlowVersionListResponse` (op: `list_call_flow_versions`). */
export interface CallFlowVersionListResponse {
  /** List of Call Flow Versions. */
  data: CallFlowVersion[];
  /** Pagination links. */
  links: FabricPaginationLinks;
}

/** A deployed Call Flow version. Schema: `CallFlowVersionDeployResponse` (op: `deploy_call_flow_version`). */
export interface CallFlowVersionDeployResponse {
  /** Unique identifier of the deployed Call Flow Version. */
  id: string;
  /** Creation timestamp. */
  created_at: string;
  /** Last update timestamp. */
  updated_at: string;
  /** The document version. */
  document_version: number;
  /** Call Flow data structure. */
  flow_data?: string;
  /** SWML document for this version. */
  relayml?: string;
}

/** Deploy-version request by document version. Schema: `CallFlowVersionDeployByDocumentVersion`. */
export interface CallFlowVersionDeployByDocumentVersion {
  /** The current revision of the call flow. */
  document_version: number;
}

/** Deploy-version request by version ID. Schema: `CallFlowVersionDeployByVersionId`. */
export interface CallFlowVersionDeployByVersionId {
  /** Any call flow version ID for this call flow. */
  call_flow_version_id: string;
}

/** Body for deploying a Call Flow version. Schema: `CallFlowVersionDeployRequest` (oneOf). */
export type CallFlowVersionDeployRequest =
  | CallFlowVersionDeployByDocumentVersion
  | CallFlowVersionDeployByVersionId;

// ---------------------------------------------------------------------------
// Conference Rooms
// ---------------------------------------------------------------------------

/** List of Conference Room Addresses. Schema: `ConferenceRoomAddressListResponse` (op: `list_conference_room_addresses`). */
export interface ConferenceRoomAddressListResponse {
  /** Array of Conference Room Addresses. */
  data: FabricAddressRoom[];
  /** Pagination links. */
  links: FabricPaginationLinks;
}

// ---------------------------------------------------------------------------
// Subscriber SIP Endpoints
// ---------------------------------------------------------------------------

/** A Subscriber SIP Endpoint. Schema: `SubscriberSIPEndpoint`. */
export interface SubscriberSIPEndpoint {
  /** Unique ID of the SIP Endpoint. */
  id: string;
  /** Username of the SIP Endpoint. */
  username: string;
  /** Caller ID of the SIP Endpoint. */
  caller_id: string;
  /** Purchased or verified number to send as. */
  send_as: string;
  /** Ciphers of the SIP Endpoint. */
  ciphers: Ciphers[];
  /** Codecs of the SIP Endpoint. */
  codecs: Codecs[];
  /** Encryption requirement of the SIP Endpoint. */
  encryption: Encryption;
}

/** List of Subscriber SIP Endpoints. Schema: `SubscriberSipEndpointListResponse` (op: `list_subscriber_sip_endpoints`). */
export interface SubscriberSipEndpointListResponse {
  /** Array of Subscriber SIP Endpoints. */
  data: SubscriberSIPEndpoint[];
  /** Pagination links. */
  links: FabricPaginationLinks;
}

/** Body for creating a Subscriber SIP Endpoint. Schema: `SubscriberSipEndpointRequest` (op: `create_subscriber_sip_endpoint`). */
export interface SubscriberSipEndpointRequest {
  /** Username of the SIP Endpoint. */
  username: string;
  /** Password of the SIP Endpoint. */
  password: string;
  /** Caller ID of the SIP Endpoint. */
  caller_id?: string;
  /** The number to send as. */
  send_as?: string;
  /** Ciphers of the SIP Endpoint. */
  ciphers?: Ciphers[];
  /** Codecs of the SIP Endpoint. */
  codecs?: Codecs[];
  /** Encryption requirement of the SIP Endpoint. */
  encryption?: Encryption;
}

/** Body for updating a Subscriber SIP Endpoint. Schema: `SubscriberSipEndpointRequestUpdate` (op: `update_subscriber_sip_endpoint`). */
export interface SubscriberSipEndpointRequestUpdate {
  /** Username of the SIP Endpoint. */
  username?: string;
  /** Password of the SIP Endpoint. */
  password?: string;
  /** Caller ID of the SIP Endpoint. */
  caller_id?: string;
  /** The number to send as. */
  send_as?: string;
  /** Ciphers of the SIP Endpoint. */
  ciphers?: Ciphers[];
  /** Codecs of the SIP Endpoint. */
  codecs?: Codecs[];
  /** Encryption requirement of the SIP Endpoint. */
  encryption?: Encryption;
}

// ---------------------------------------------------------------------------
// Generic Resources
// ---------------------------------------------------------------------------

/** Closed set of Fabric resource type discriminators. */
export type FabricResourceType =
  | 'ai_agent'
  | 'call_flow'
  | 'cxml_webhook'
  | 'cxml_script'
  | 'cxml_application'
  | 'dialogflow_agent'
  | 'freeswitch_connector'
  | 'relay_application'
  | 'sip_endpoint'
  | 'sip_gateway'
  | 'subscriber'
  | 'swml_webhook'
  | 'swml_script'
  | 'conference_room';

/**
 * A single Fabric Resource. Schema: `ResourceResponse` (op: `get_resource`) — a
 * `oneOf` of 14 type-specific variants. All variants share the base fields
 * below; each carries one additional type-specific payload object keyed by its
 * `type` name (e.g. `ai_agent`, `call_flow`). Those nested payloads vary per
 * resource type, so they are carried via the index signature as `unknown`.
 */
export interface FabricResourceResponse {
  /** Unique ID of the Resource. */
  id: string;
  /** Unique ID of the Project. */
  project_id: string;
  /** Display name of the Resource. */
  display_name: string;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource. */
  type: FabricResourceType;
  /** Type-specific payload object, keyed by the resource `type`. */
  [key: string]: unknown;
}

/** List of Fabric Resources. Schema: `ResourceListResponse` (op: `list_resources`). */
export interface ResourceListResponse {
  /** Array of Fabric Resources. */
  data: FabricResourceResponse[];
  /** Pagination links. */
  links: FabricPaginationLinks;
}

/** List of Resource Addresses. Schema: `ResourceAddressListResponse` (op: `list_resource_addresses`). */
export interface ResourceAddressListResponse {
  /** Array of Resource Addresses. */
  data: FabricAddress[];
  /** Pagination links. */
  links: FabricPaginationLinks;
}

/** Body for assigning a domain application. Schema: `DomainApplicationAssignRequest` (op: `assign_resource_domain_application`). */
export interface DomainApplicationAssignRequest {
  /** The id of the domain application to assign a resource to. */
  domain_application_id: string;
}

/** Response from assigning a domain application. Schema: `DomainApplicationResponse` (op: `assign_resource_domain_application`). */
export interface DomainApplicationResponse {
  /** Unique ID of the Fabric Address. */
  id: string;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string;
  /** Whether the Fabric Address is locked. */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels: AddressChannel;
  /** Fabric Address creation date (date-time). */
  created_at: string;
  /** Display type — always `app` for application addresses. */
  type: 'app';
}

/** Body for assigning a phone route. Schema: `PhoneRouteAssignRequest` (op: `assign_resource_phone_route`). */
export interface PhoneRouteAssignRequest {
  /** The id of the phone route. */
  phone_route_id: string;
  /** Whether the resource handles `calling` or `messaging`. */
  handler: UsedForType;
}

/** Response from assigning a phone route. Schema: `PhoneRouteResponse` (op: `assign_resource_phone_route`). */
export interface PhoneRouteResponse {
  /** Unique ID of the Fabric Address. */
  id: string;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string;
  /** Whether the Fabric Address is locked. */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels: AddressChannel;
  /** Fabric Address creation date (date-time). */
  created_at: string;
  /** Display type — always `app` for application addresses. */
  type: 'app';
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** Body for creating a subscriber token. Schema: `SubscriberTokenRequest` (op: `create_subscriber_token`). */
export interface SubscriberTokenRequest {
  /** A string that uniquely identifies the subscriber (often an email). */
  reference: string;
  /** A unixtime at which the token should no longer be valid. */
  expire_at?: number;
  /** The ID of the application the token is associated with. */
  application_id?: string;
  /** Set or update the subscriber's password. */
  password?: string;
  /** Set or update the first name of the subscriber. */
  first_name?: string;
  /** Set or update the last name of the subscriber. */
  last_name?: string;
  /** Set or update the display name of the subscriber. */
  display_name?: string;
  /** Set or update the job title of the subscriber. */
  job_title?: string;
  /** Set or update the time zone of the subscriber. */
  time_zone?: string;
  /** Set or update the country of the subscriber. */
  country?: string;
  /** Set or update the region of the subscriber. */
  region?: string;
  /** Set or update the company name of the subscriber. */
  company_name?: string;
}

/** Subscriber token response. Schema: `SubscriberTokenResponse` (op: `create_subscriber_token`). */
export interface SubscriberTokenResponse {
  /** The ID of the subscriber the token is associated with. */
  subscriber_id: string;
  /** The subscriber access token. */
  token: string;
  /** Refresh token. */
  refresh_token: string;
}

/** Body for refreshing a subscriber token. Schema: `SubscriberRefreshTokenRequest` (op: `refresh_subscriber_token`). */
export interface SubscriberRefreshTokenRequest {
  /** The refresh token previously issued alongside a subscriber access token. */
  refresh_token: string;
}

/** Subscriber refresh-token response. Schema: `SubscriberRefreshTokenResponse` (op: `refresh_subscriber_token`). */
export interface SubscriberRefreshTokenResponse {
  /** A newly generated subscriber access token, valid for 2 hours. */
  token: string;
  /** A new refresh token, valid for 2 hours and 5 minutes. */
  refresh_token: string;
}

/** Body for creating a subscriber invite token. Schema: `SubscriberInviteTokenCreateRequest` (op: `create_subscriber_invite_token`). */
export interface SubscriberInviteTokenCreateRequest {
  /** Unique ID of a Subscriber Address. */
  address_id: string;
  /** A unixtime at which the token should no longer be valid. */
  expires_at?: number;
}

/** Subscriber invite-token response. Schema: `SubscriberInviteTokenCreateResponse` (op: `create_subscriber_invite_token`). */
export interface SubscriberInviteTokenCreateResponse {
  /** Invite token. */
  token: string;
}

/** Body for creating a subscriber guest token. Schema: `SubscriberGuestTokenCreateRequest` (op: `create_subscriber_guest_token`). */
export interface SubscriberGuestTokenCreateRequest {
  /** List of up to 10 UUIDs representing the allowed Fabric addresses. */
  allowed_addresses: string[];
  /** A unixtime at which the token should no longer be valid. */
  expire_at?: number;
}

/** Subscriber guest-token response. Schema: `SubscriberGuestTokenCreateResponse` (op: `create_subscriber_guest_token`). */
export interface SubscriberGuestTokenCreateResponse {
  /** Guest token. */
  token: string;
  /** Refresh token. */
  refresh_token: string;
}

/** Body for creating an embed token. Schema: `EmbedsTokensRequest` (op: `create_embeds_token`). */
export interface EmbedsTokensRequest {
  /** Click-to-Call token. */
  token: string;
}

/** Embed-token response. Schema: `EmbedsTokensResponse` (op: `create_embeds_token`). */
export interface EmbedsTokensResponse {
  /** Encrypted guest token. */
  token: string;
}
