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
    options?: { subproject_id?: string; extras?: Record<string, unknown> },
  ): Promise<TokenResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      name,
      permissions,
      subproject_id: options?.subproject_id,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<TokenResponse>(this._basePath, body);
  }

  async update(
    token_id: string,
    options?: { name?: string; permissions?: TokenPermission[]; extras?: Record<string, unknown> },
  ): Promise<TokenResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      name: options?.name,
      permissions: options?.permissions,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.patch<TokenResponse>(this._path(token_id), body);
  }

  async delete(token_id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(token_id));
  }
}
