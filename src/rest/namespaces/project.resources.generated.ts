// AUTO-GENERATED from porting-sdk/rest-apis/project/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';
import type { TokenPermission, TokenResponse } from './project.types.generated.js';

export class ProjectTokens extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/project/tokens');
  }

  async create(
    name: string,
    permissions: TokenPermission[],
    subproject_id?: string,
    extras?: Record<string, unknown>,
  ): Promise<TokenResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      name,
      permissions,
      subproject_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<TokenResponse>(this._basePath, body);
  }

  async update(
    token_id: string,
    name?: string,
    permissions?: TokenPermission[],
    extras?: Record<string, unknown>,
  ): Promise<TokenResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      name,
      permissions,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.patch<TokenResponse>(this._path(token_id), body);
  }

  async delete(token_id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(token_id));
  }
}
