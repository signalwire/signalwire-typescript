// AUTO-GENERATED from porting-sdk/rest-apis/logs/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import type { ConferencesResponse } from './logs.types.generated.js';

export class ConferenceLogs extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/logs/conferences');
  }

  async list(params?: QueryParams): Promise<ConferencesResponse> {
    return this._http.get<ConferencesResponse>(this._basePath, params);
  }
}
