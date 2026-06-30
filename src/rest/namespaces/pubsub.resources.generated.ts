// AUTO-GENERATED from porting-sdk/rest-apis/pubsub/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';
import type { PubSubChannels, PubSubState, PubSubToken } from './pubsub.types.generated.js';

export class PubSub extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/pubsub/tokens');
  }

  async createToken(
    ttl: number,
    channels: PubSubChannels,
    member_id?: string,
    state?: PubSubState,
    extras?: Record<string, unknown>,
  ): Promise<PubSubToken> {
    const body: Record<string, unknown> = {};
    const _fields = {
      ttl,
      channels,
      member_id,
      state,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (extras) Object.assign(body, extras);
    return this._http.post<PubSubToken>(this._basePath, body);
  }
}
