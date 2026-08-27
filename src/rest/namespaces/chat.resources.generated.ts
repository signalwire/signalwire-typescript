// AUTO-GENERATED from porting-sdk/rest-apis/chat/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { RequestOptionsInit } from '../RequestOptions.js';
import { BaseResource } from '../base/BaseResource.js';
import type { ChatChannel, ChatState, ChatToken } from './chat.types.generated.js';

export class Chat extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/chat/tokens');
  }

  async createToken(
    ttl: number,
    channels: ChatChannel,
    options?: { member_id?: string; state?: ChatState; extras?: Record<string, unknown> },
    requestOptions?: RequestOptionsInit,
  ): Promise<ChatToken> {
    const body: Record<string, unknown> = {};
    const _fields = {
      ttl,
      channels,
      member_id: options?.member_id,
      state: options?.state,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<ChatToken>(this._basePath, body, undefined, requestOptions);
  }
}
