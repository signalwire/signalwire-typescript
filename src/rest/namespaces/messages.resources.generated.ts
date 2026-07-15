// AUTO-GENERATED from porting-sdk/rest-apis/messages/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';
import type { Message } from './messages.types.generated.js';

export class Messages extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/messaging/messages');
  }

  async create(
    to: string,
    from: string,
    options?: {
      body?: string;
      media?: string[];
      send_as_mms?: boolean;
      status_callback?: string;
      custom_variables?: Record<string, string>;
      extras?: Record<string, unknown>;
    },
  ): Promise<Message> {
    const body_: Record<string, unknown> = {};
    const _fields = {
      to,
      from,
      body: options?.body,
      media: options?.media,
      send_as_mms: options?.send_as_mms,
      status_callback: options?.status_callback,
      custom_variables: options?.custom_variables,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body_[k] = v;
    if (options?.extras) Object.assign(body_, options.extras);
    return this._http.post<Message>(this._basePath, body_);
  }

  async update(
    message_id: string,
    body: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<Message> {
    const body_: Record<string, unknown> = {};
    const _fields = {
      body,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body_[k] = v;
    if (options?.extras) Object.assign(body_, options.extras);
    return this._http.patch<Message>(this._path(message_id), body_);
  }
}
