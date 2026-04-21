/**
 * Recordings namespace — list, get, delete (no create/update).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';

/**
 * Recording management (read-only + delete).
 *
 * Access via `client.recordings.*`.
 */
export class RecordingsResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/recordings');
  }

  /** List recordings in the project. */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /** Fetch a recording's metadata by ID. */
  async get(recordingId: string): Promise<any> {
    return this._http.get(this._path(recordingId));
  }

  /** Delete a recording. */
  async delete(recordingId: string): Promise<any> {
    return this._http.delete(this._path(recordingId));
  }
}
