// AUTO-GENERATED from porting-sdk/rest-apis/message/openapi.enriched.yaml — DO NOT EDIT.
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
import { ReadResource } from '../base/ReadResource.js';
import type {
  CreateWhatsappTemplateRequest,
  LogListResponse,
  LogRetrieveResponse,
  UpdateWhatsappTemplateRequest,
  WhatsappBusinessListResponse,
  WhatsappNumber,
  WhatsappNumberListResponse,
  WhatsappTemplate,
  WhatsappTemplateListResponse,
} from './message.types.generated.js';

export class MessageLogs extends ReadResource<LogListResponse, LogRetrieveResponse> {
  constructor(http: HttpClient) {
    super(http, '/api/messaging/logs');
  }
}

export class WhatsappNumbers extends ReadResource<WhatsappNumberListResponse, WhatsappNumber> {
  constructor(http: HttpClient) {
    super(http, '/api/messaging/whatsapp/numbers');
  }
}

export class WhatsappBusinesses extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/messaging/whatsapp/businesses');
  }

  async list(
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): Promise<WhatsappBusinessListResponse> {
    return this._http.get<WhatsappBusinessListResponse>(this._basePath, params, requestOptions);
  }
}

export class WhatsappTemplates extends CrudResource<
  WhatsappTemplateListResponse,
  WhatsappTemplate,
  CreateWhatsappTemplateRequest,
  UpdateWhatsappTemplateRequest
> {
  constructor(http: HttpClient) {
    super(http, '/api/messaging/whatsapp/templates');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: CreateWhatsappTemplateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<WhatsappTemplate> {
    return this._http.post<WhatsappTemplate>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: UpdateWhatsappTemplateRequest,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<WhatsappTemplate> {
    return this._http.patch<WhatsappTemplate>(
      this._path(id),
      { ...body, ...extras },
      requestOptions,
    );
  }
}
