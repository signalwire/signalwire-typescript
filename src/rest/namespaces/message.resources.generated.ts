// AUTO-GENERATED from porting-sdk/rest-apis/message/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import { ReadResource } from '../base/ReadResource.js';
import type { LogListResponse, LogRetrieveResponse } from './message.types.generated.js';

export class MessageLogs extends ReadResource<LogListResponse, LogRetrieveResponse> {
  constructor(http: HttpClient) {
    super(http, '/api/messaging/logs');
  }
}
