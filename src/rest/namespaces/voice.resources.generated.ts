// AUTO-GENERATED from porting-sdk/rest-apis/voice/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { ReadResource } from '../base/ReadResource.js';
import type { LogEventsListResponse, LogListResponse, VoiceLog } from './voice.types.generated.js';

export class VoiceLogs extends ReadResource<LogListResponse, VoiceLog> {
  constructor(http: HttpClient) {
    super(http, '/api/voice/logs');
  }

  async listEvents(id: string, params?: QueryParams): Promise<LogEventsListResponse> {
    return this._http.get<LogEventsListResponse>(this._path(id, 'events'), params);
  }
}
