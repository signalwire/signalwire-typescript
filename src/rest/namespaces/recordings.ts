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

  /**
   * List recordings in the project.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of recordings.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a recording's metadata by ID.
   *
   * @param recordingId - Unique identifier of the recording.
   * @returns The recording metadata record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(recordingId: string): Promise<any> {
    return this._http.get(this._path(recordingId));
  }

  /**
   * Delete a recording.
   *
   * @param recordingId - Unique identifier of the recording.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(recordingId: string): Promise<any> {
    return this._http.delete(this._path(recordingId));
  }
}
