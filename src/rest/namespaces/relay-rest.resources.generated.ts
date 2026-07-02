// AUTO-GENERATED from porting-sdk/rest-apis/relay-rest/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { CrudResource } from '../base/CrudResource.js';
import type {
  AddressListResponse,
  AddressResponse,
  AddressType,
  AssignedNumberListResponse,
  AvailablePhoneNumbersResponse,
  BrandListResponse,
  BrandResponse,
  CampaignListResponse,
  CampaignResponse,
  CreateCspBrandRequest,
  CreateManagedBrandRequest,
  CreateManagedCampaignRequest,
  CreateNumberGroupRequest,
  CreatePartnerCampaignRequest,
  CreateQueueRequest,
  CreateVerifiedCallerIDRequest,
  HttpMethod,
  MfaResponse,
  MfaVerifyResponse,
  NumberGroupListResponse,
  NumberGroupMembershipListResponse,
  NumberGroupMembershipResponse,
  NumberGroupResponse,
  OrderListResponse,
  OrderResponse,
  PhoneNumberListResponse,
  PhoneNumberLookupResponse,
  PhoneNumberResponse,
  PurchasePhoneNumberRequest,
  QueueListResponse,
  QueueMemberListResponse,
  QueueMemberResponse,
  QueueResponse,
  RecordingListResponse,
  ShortCodeListResponse,
  ShortCodeMessageHandler,
  ShortCodeResponse,
  SipProfileResponse,
  UpdateNumberGroupRequest,
  UpdatePhoneNumberRequest,
  UpdateQueueRequest,
  UpdateVerifiedCallerIDRequest,
  VerifiedCallerIDListResponse,
  VerifiedCallerIDResponse,
  uuid,
} from './relay-rest.types.generated.js';

export class Addresses extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/addresses');
  }

  async list(params?: QueryParams): Promise<AddressListResponse> {
    return this._http.get<AddressListResponse>(this._basePath, params);
  }

  async create(
    label: string,
    country: string,
    first_name: string,
    last_name: string,
    street_number: string,
    street_name: string,
    city: string,
    state: string,
    postal_code: string,
    options?: {
      address_type?: AddressType;
      address_number?: string;
      extras?: Record<string, unknown>;
    },
  ): Promise<AddressResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      label,
      country,
      first_name,
      last_name,
      street_number,
      street_name,
      city,
      state,
      postal_code,
      address_type: options?.address_type,
      address_number: options?.address_number,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<AddressResponse>(this._basePath, body);
  }

  async get(id: string, params?: QueryParams): Promise<AddressResponse> {
    return this._http.get<AddressResponse>(this._path(id), params);
  }

  async delete(id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id));
  }
}

export class ImportedNumbers extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/imported_phone_numbers');
  }

  async create(
    number: string,
    number_type: 'longcode' | 'tollfree',
    options?: {
      capabilities?: ('sms' | 'voice' | 'fax' | 'mms')[];
      extras?: Record<string, unknown>;
    },
  ): Promise<PhoneNumberResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      number,
      number_type,
      capabilities: options?.capabilities,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<PhoneNumberResponse>(this._basePath, body);
  }
}

export class Lookup extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/lookup');
  }

  async phoneNumber(e164_number: string, params?: QueryParams): Promise<PhoneNumberLookupResponse> {
    return this._http.get<PhoneNumberLookupResponse>(
      this._path('phone_number', e164_number),
      params,
    );
  }
}

export class Mfa extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/mfa');
  }

  async sms(
    to: string,
    options?: {
      from?: string;
      message?: string;
      token_length?: number;
      valid_for?: number;
      max_attempts?: number;
      allow_alphas?: boolean;
      extras?: Record<string, unknown>;
    },
  ): Promise<MfaResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      to,
      from: options?.from,
      message: options?.message,
      token_length: options?.token_length,
      valid_for: options?.valid_for,
      max_attempts: options?.max_attempts,
      allow_alphas: options?.allow_alphas,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<MfaResponse>(this._path('sms'), body);
  }

  async call(
    to: string,
    options?: {
      from?: string;
      message?: string;
      token_length?: number;
      valid_for?: number;
      max_attempts?: number;
      allow_alphas?: boolean;
      extras?: Record<string, unknown>;
    },
  ): Promise<MfaResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      to,
      from: options?.from,
      message: options?.message,
      token_length: options?.token_length,
      valid_for: options?.valid_for,
      max_attempts: options?.max_attempts,
      allow_alphas: options?.allow_alphas,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<MfaResponse>(this._path('call'), body);
  }

  async verify(
    mfa_request_id: string,
    token: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<MfaVerifyResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      token,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<MfaVerifyResponse>(this._path(mfa_request_id, 'verify'), body);
  }
}

export class NumberGroups extends CrudResource<
  NumberGroupListResponse,
  NumberGroupResponse,
  CreateNumberGroupRequest,
  UpdateNumberGroupRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/number_groups');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: CreateNumberGroupRequest,
    extras?: Record<string, unknown>,
  ): Promise<NumberGroupResponse> {
    return this._http.post<NumberGroupResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: UpdateNumberGroupRequest,
    extras?: Record<string, unknown>,
  ): Promise<NumberGroupResponse> {
    return this._http.put<NumberGroupResponse>(this._path(id), { ...body, ...extras });
  }

  async listMemberships(
    number_group_id: string,
    params?: QueryParams,
  ): Promise<NumberGroupMembershipListResponse> {
    return this._http.get<NumberGroupMembershipListResponse>(
      this._path(number_group_id, 'number_group_memberships'),
      params,
    );
  }

  async addMembership(
    number_group_id: string,
    phone_number_id: uuid,
    options?: { extras?: Record<string, unknown> },
  ): Promise<NumberGroupMembershipResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      phone_number_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<NumberGroupMembershipResponse>(
      this._path(number_group_id, 'number_group_memberships'),
      body,
    );
  }

  async getMembership(id: string, params?: QueryParams): Promise<NumberGroupMembershipResponse> {
    return this._http.get<NumberGroupMembershipResponse>(
      `/api/relay/rest/number_group_memberships/${id}`,
      params,
    );
  }

  async deleteMembership(id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(
      `/api/relay/rest/number_group_memberships/${id}`,
    );
  }
}

export class PhoneNumbers extends CrudResource<
  PhoneNumberListResponse,
  PhoneNumberResponse,
  PurchasePhoneNumberRequest,
  UpdatePhoneNumberRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/phone_numbers');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: PurchasePhoneNumberRequest,
    extras?: Record<string, unknown>,
  ): Promise<PhoneNumberResponse> {
    return this._http.post<PhoneNumberResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: UpdatePhoneNumberRequest,
    extras?: Record<string, unknown>,
  ): Promise<PhoneNumberResponse> {
    return this._http.put<PhoneNumberResponse>(this._path(id), { ...body, ...extras });
  }

  async search(params?: QueryParams): Promise<AvailablePhoneNumbersResponse> {
    return this._http.get<AvailablePhoneNumbersResponse>(this._path('search'), params);
  }

  async setSwmlWebhook(
    resourceId: string,
    url: string,
    extra?: Record<string, unknown>,
  ): Promise<PhoneNumberResponse> {
    const body: Record<string, unknown> = { call_handler: 'relay_script' };
    body['call_relay_script_url'] = url;
    if (extra) Object.assign(body, extra);
    return this.update(resourceId, body as UpdatePhoneNumberRequest);
  }

  async setCxmlWebhook(
    resourceId: string,
    url: string,
    fallback_url?: string,
    status_callback_url?: string,
    extra?: Record<string, unknown>,
  ): Promise<PhoneNumberResponse> {
    const body: Record<string, unknown> = { call_handler: 'laml_webhooks' };
    body['call_request_url'] = url;
    if (fallback_url !== undefined) body['call_fallback_url'] = fallback_url;
    if (status_callback_url !== undefined) body['call_status_callback_url'] = status_callback_url;
    if (extra) Object.assign(body, extra);
    return this.update(resourceId, body as UpdatePhoneNumberRequest);
  }

  async setCxmlApplication(
    resourceId: string,
    application_id: string,
    extra?: Record<string, unknown>,
  ): Promise<PhoneNumberResponse> {
    const body: Record<string, unknown> = { call_handler: 'laml_application' };
    body['call_laml_application_id'] = application_id;
    if (extra) Object.assign(body, extra);
    return this.update(resourceId, body as UpdatePhoneNumberRequest);
  }

  async setAiAgent(
    resourceId: string,
    agent_id: uuid,
    extra?: Record<string, unknown>,
  ): Promise<PhoneNumberResponse> {
    const body: Record<string, unknown> = { call_handler: 'ai_agent' };
    body['call_ai_agent_id'] = agent_id;
    if (extra) Object.assign(body, extra);
    return this.update(resourceId, body as UpdatePhoneNumberRequest);
  }

  async setCallFlow(
    resourceId: string,
    flow_id: uuid,
    version?: 'working_copy' | 'current_deployed',
    extra?: Record<string, unknown>,
  ): Promise<PhoneNumberResponse> {
    const body: Record<string, unknown> = { call_handler: 'call_flow' };
    body['call_flow_id'] = flow_id;
    if (version !== undefined) body['call_flow_version'] = version;
    if (extra) Object.assign(body, extra);
    return this.update(resourceId, body as UpdatePhoneNumberRequest);
  }

  async setRelayApplication(
    resourceId: string,
    name: string,
    extra?: Record<string, unknown>,
  ): Promise<PhoneNumberResponse> {
    const body: Record<string, unknown> = { call_handler: 'relay_application' };
    body['call_relay_application'] = name;
    if (extra) Object.assign(body, extra);
    return this.update(resourceId, body as UpdatePhoneNumberRequest);
  }

  async setRelayTopic(
    resourceId: string,
    topic: string,
    status_callback_url?: string,
    extra?: Record<string, unknown>,
  ): Promise<PhoneNumberResponse> {
    const body: Record<string, unknown> = { call_handler: 'relay_topic' };
    body['call_relay_topic'] = topic;
    if (status_callback_url !== undefined)
      body['call_relay_topic_status_callback_url'] = status_callback_url;
    if (extra) Object.assign(body, extra);
    return this.update(resourceId, body as UpdatePhoneNumberRequest);
  }
}

export class Queues extends CrudResource<
  QueueListResponse,
  QueueResponse,
  CreateQueueRequest,
  UpdateQueueRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/queues');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: CreateQueueRequest,
    extras?: Record<string, unknown>,
  ): Promise<QueueResponse> {
    return this._http.post<QueueResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: UpdateQueueRequest,
    extras?: Record<string, unknown>,
  ): Promise<QueueResponse> {
    return this._http.put<QueueResponse>(this._path(id), { ...body, ...extras });
  }

  async listMembers(queue_id: string, params?: QueryParams): Promise<QueueMemberListResponse> {
    return this._http.get<QueueMemberListResponse>(this._path(queue_id, 'members'), params);
  }

  async getNextMember(queue_id: string, params?: QueryParams): Promise<QueueMemberResponse> {
    return this._http.get<QueueMemberResponse>(this._path(queue_id, 'members', 'next'), params);
  }

  async getMember(
    queue_id: string,
    id: string,
    params?: QueryParams,
  ): Promise<QueueMemberResponse> {
    return this._http.get<QueueMemberResponse>(this._path(queue_id, 'members', id), params);
  }
}

export class Recordings extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/recordings');
  }

  async list(params?: QueryParams): Promise<RecordingListResponse> {
    return this._http.get<RecordingListResponse>(this._basePath, params);
  }

  async get(id: string, params?: QueryParams): Promise<Record<string, unknown>> {
    return this._http.get<Record<string, unknown>>(this._path(id), params);
  }

  async delete(id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id));
  }
}

export class RegistryBrands extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/registry/beta/brands');
  }

  async list(params?: QueryParams): Promise<BrandListResponse> {
    return this._http.get<BrandListResponse>(this._basePath, params);
  }

  async create(
    body: CreateManagedBrandRequest | CreateCspBrandRequest,
    extras?: Record<string, unknown>,
  ): Promise<BrandResponse> {
    return this._http.post<BrandResponse>(this._basePath, { ...body, ...extras });
  }

  async get(id: string, params?: QueryParams): Promise<BrandResponse> {
    return this._http.get<BrandResponse>(this._path(id), params);
  }

  async listCampaigns(id: string, params?: QueryParams): Promise<CampaignListResponse> {
    return this._http.get<CampaignListResponse>(this._path(id, 'campaigns'), params);
  }

  async createCampaign(
    id: string,
    body: CreateManagedCampaignRequest | CreatePartnerCampaignRequest,
    extras?: Record<string, unknown>,
  ): Promise<CampaignResponse> {
    return this._http.post<CampaignResponse>(this._path(id, 'campaigns'), { ...body, ...extras });
  }
}

export class RegistryCampaigns extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/registry/beta/campaigns');
  }

  async get(id: string, params?: QueryParams): Promise<CampaignResponse> {
    return this._http.get<CampaignResponse>(this._path(id), params);
  }

  async update(
    id: string,
    options?: { name?: string; extras?: Record<string, unknown> },
  ): Promise<CampaignResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      name: options?.name,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<CampaignResponse>(this._path(id), body);
  }

  async listNumbers(id: string, params?: QueryParams): Promise<AssignedNumberListResponse> {
    return this._http.get<AssignedNumberListResponse>(this._path(id, 'numbers'), params);
  }

  async listOrders(id: string, params?: QueryParams): Promise<OrderListResponse> {
    return this._http.get<OrderListResponse>(this._path(id, 'orders'), params);
  }

  async createOrder(
    id: string,
    options?: {
      phone_numbers?: string[];
      status_callback_url?: string;
      extras?: Record<string, unknown>;
    },
  ): Promise<OrderResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      phone_numbers: options?.phone_numbers,
      status_callback_url: options?.status_callback_url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<OrderResponse>(this._path(id, 'orders'), body);
  }
}

export class RegistryNumbers extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/registry/beta/numbers');
  }

  async delete(id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id));
  }
}

export class RegistryOrders extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/registry/beta/orders');
  }

  async get(id: string, params?: QueryParams): Promise<OrderResponse> {
    return this._http.get<OrderResponse>(this._path(id), params);
  }
}

export class ShortCodes extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/short_codes');
  }

  async list(params?: QueryParams): Promise<ShortCodeListResponse> {
    return this._http.get<ShortCodeListResponse>(this._basePath, params);
  }

  async get(id: string, params?: QueryParams): Promise<ShortCodeResponse> {
    return this._http.get<ShortCodeResponse>(this._path(id), params);
  }

  async update(
    id: string,
    name: string,
    message_handler: ShortCodeMessageHandler,
    options?: {
      message_request_url?: string;
      message_request_method?: HttpMethod;
      message_fallback_url?: string;
      message_fallback_method?: HttpMethod;
      message_laml_application_id?: uuid;
      message_relay_context?: string;
      extras?: Record<string, unknown>;
    },
  ): Promise<ShortCodeResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      name,
      message_handler,
      message_request_url: options?.message_request_url,
      message_request_method: options?.message_request_method,
      message_fallback_url: options?.message_fallback_url,
      message_fallback_method: options?.message_fallback_method,
      message_laml_application_id: options?.message_laml_application_id,
      message_relay_context: options?.message_relay_context,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<ShortCodeResponse>(this._path(id), body);
  }
}

export class SipProfile extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/sip_profile');
  }

  async get(params?: QueryParams): Promise<SipProfileResponse> {
    return this._http.get<SipProfileResponse>(this._basePath, params);
  }

  async update(options?: {
    domain_identifier?: string;
    default_codecs?: string[];
    default_ciphers?: string[];
    default_encryption?: 'required' | 'optional';
    default_send_as?: string;
    extras?: Record<string, unknown>;
  }): Promise<SipProfileResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      domain_identifier: options?.domain_identifier,
      default_codecs: options?.default_codecs,
      default_ciphers: options?.default_ciphers,
      default_encryption: options?.default_encryption,
      default_send_as: options?.default_send_as,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<SipProfileResponse>(this._basePath, body);
  }
}

export class VerifiedCallers extends CrudResource<
  VerifiedCallerIDListResponse,
  VerifiedCallerIDResponse,
  CreateVerifiedCallerIDRequest,
  UpdateVerifiedCallerIDRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/verified_caller_ids');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: CreateVerifiedCallerIDRequest,
    extras?: Record<string, unknown>,
  ): Promise<VerifiedCallerIDResponse> {
    return this._http.post<VerifiedCallerIDResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: UpdateVerifiedCallerIDRequest,
    extras?: Record<string, unknown>,
  ): Promise<VerifiedCallerIDResponse> {
    return this._http.put<VerifiedCallerIDResponse>(this._path(id), { ...body, ...extras });
  }

  async redialVerification(id: string): Promise<VerifiedCallerIDResponse> {
    return this._http.post<VerifiedCallerIDResponse>(this._path(id, 'verification'));
  }

  async submitVerification(
    id: string,
    verification_code: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<VerifiedCallerIDResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      verification_code,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<VerifiedCallerIDResponse>(this._path(id, 'verification'), body);
  }
}
