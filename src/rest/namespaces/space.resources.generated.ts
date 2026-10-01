// AUTO-GENERATED from porting-sdk/rest-apis/space/openapi.enriched.yaml — DO NOT EDIT.
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
import type {
  AddressCountryCode,
  Balance,
  BalanceAdjustment,
  BillingProfile,
  BillingStatement,
  BillingStatementPeriodList,
  GeographicPermission,
  LowBalanceSetting,
  Member,
  MemberCreate,
  MemberList,
  MemberProject,
  MemberProjectList,
  MemberUpdate,
  PaymentHistoryList,
  PaymentMethod,
  Space,
  Usage,
} from './space.types.generated.js';

export class SpaceSettings extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/space');
  }

  async get(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<Space> {
    return this._http.get<Space>(this._basePath, params, requestOptions);
  }

  async update(
    options?: { name?: string; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<Space> {
    const body: Record<string, unknown> = {};
    const _fields = {
      name: options?.name,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<Space>(this._basePath, body, requestOptions);
  }
}

export class SpaceGeographicPermissions extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/space/geographic_permissions');
  }

  async get(
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<GeographicPermission> {
    return this._http.get<GeographicPermission>(this._basePath, params, requestOptions);
  }

  async update(
    countries: string[],
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<GeographicPermission> {
    const body: Record<string, unknown> = {};
    const _fields = {
      countries,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<GeographicPermission>(this._basePath, body, requestOptions);
  }
}

export class SpaceBillingProfile extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/space/billing_profile');
  }

  async get(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<BillingProfile> {
    return this._http.get<BillingProfile>(this._basePath, params, requestOptions);
  }

  async update(
    address_line1: string,
    address_city: string,
    address_state: string,
    address_zip: string,
    address_country: AddressCountryCode,
    company_name: string,
    contact_name: string,
    contact_email: string[],
    contact_phone: string,
    options?: {
      address_line2?: string;
      tax_id_number?: string;
      monthly_invoices?: boolean;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<BillingProfile> {
    const body: Record<string, unknown> = {};
    const _fields = {
      address_line1,
      address_city,
      address_state,
      address_zip,
      address_country,
      company_name,
      contact_name,
      contact_email,
      contact_phone,
      address_line2: options?.address_line2,
      tax_id_number: options?.tax_id_number,
      monthly_invoices: options?.monthly_invoices,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<BillingProfile>(this._basePath, body, requestOptions);
  }
}

export class SpaceBillingStatements extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/space');
  }

  async list(
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<BillingStatementPeriodList> {
    return this._http.get<BillingStatementPeriodList>(
      this._path('billing_statements'),
      params,
      requestOptions,
    );
  }

  async get(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<BillingStatement> {
    return this._http.get<BillingStatement>(
      this._path('billing_statement'),
      params,
      requestOptions,
    );
  }

  async getCsv(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<string> {
    const _headers: Record<string, string> = { Accept: 'text/csv' };
    return this._http.getText(
      this._path('billing_statement.csv'),
      params,
      requestOptions,
      _headers,
    );
  }

  /**
   * Return the URL this endpoint redirects to (the `Location` of its redirect),
   * without following it or downloading anything; fetch it with any HTTP client.
   * @throws {RestError} For an error status.
   */
  async getPdf(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<string> {
    return this._http.getRedirectLocation(
      this._path('billing_statement.pdf'),
      params,
      requestOptions,
    );
  }
}

export class SpaceUsage extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/space/usage');
  }

  async get(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<Usage> {
    return this._http.get<Usage>(this._basePath, params, requestOptions);
  }
}

export class SpacePaymentHistory extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/space/payment_history');
  }

  async list(
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<PaymentHistoryList> {
    return this._http.get<PaymentHistoryList>(this._basePath, params, requestOptions);
  }
}

export class SpaceMembers extends CrudResource<MemberList, Member, MemberCreate, MemberUpdate> {
  constructor(http: HttpClient) {
    super(http, '/api/space/members');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: MemberCreate,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<Member> {
    return this._http.post<Member>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: MemberUpdate,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<Member> {
    return this._http.patch<Member>(this._path(id), { ...body, ...extras }, requestOptions);
  }

  async listProjects(
    member_id: string,
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<MemberProjectList> {
    return this._http.get<MemberProjectList>(
      this._path(member_id, 'projects'),
      params,
      requestOptions,
    );
  }

  async enableProject(
    member_id: string,
    project_id: string,
    requestOptions?: RequestOptionsInit,
  ): Promise<MemberProject> {
    return this._http.put<MemberProject>(
      this._path(member_id, 'projects', project_id),
      undefined,
      requestOptions,
    );
  }

  async disableProject(
    member_id: string,
    project_id: string,
    requestOptions?: RequestOptionsInit,
  ): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(
      this._path(member_id, 'projects', project_id),
      requestOptions,
    );
  }
}

export class SpaceBalance extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/space/balance');
  }

  async get(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<Balance> {
    return this._http.get<Balance>(this._basePath, params, requestOptions);
  }

  async createTopUp(
    idempotency_key: string,
    amount_in_microdollars: number,
    payment_method_id: string,
    options?: { extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<BalanceAdjustment> {
    const body: Record<string, unknown> = {};
    const _fields = {
      amount_in_microdollars,
      payment_method_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    const _headers: Record<string, string> = { 'Idempotency-Key': idempotency_key };
    return this._http.post<BalanceAdjustment>(
      this._path('top_ups'),
      body,
      undefined,
      requestOptions,
      _headers,
    );
  }
}

export class SpaceLowBalanceSetting extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/space/low_balance_setting');
  }

  async get(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<LowBalanceSetting> {
    return this._http.get<LowBalanceSetting>(this._basePath, params, requestOptions);
  }

  async update(
    options?: {
      threshold_in_microdollars?: number;
      send_email?: boolean;
      send_webhook?: boolean;
      webhook_url?: string;
      webhook_method?: 'GET' | 'POST';
      send_topup?: boolean;
      topup_amount_in_microdollars?: number;
      topup_payment_method_id?: string;
      extras?: Record<string, unknown>;
    },
    requestOptions?: RequestOptionsInit,
  ): Promise<LowBalanceSetting> {
    const body: Record<string, unknown> = {};
    const _fields = {
      threshold_in_microdollars: options?.threshold_in_microdollars,
      send_email: options?.send_email,
      send_webhook: options?.send_webhook,
      webhook_url: options?.webhook_url,
      webhook_method: options?.webhook_method,
      send_topup: options?.send_topup,
      topup_amount_in_microdollars: options?.topup_amount_in_microdollars,
      topup_payment_method_id: options?.topup_payment_method_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<LowBalanceSetting>(this._basePath, body, requestOptions);
  }
}

export class SpacePaymentMethods extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/space/payment_methods');
  }

  async list(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<PaymentMethod> {
    return this._http.get<PaymentMethod>(this._basePath, params, requestOptions);
  }

  async delete(id: string, requestOptions?: RequestOptionsInit): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id), requestOptions);
  }
}
