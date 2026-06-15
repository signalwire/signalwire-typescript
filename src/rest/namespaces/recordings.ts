/**
 * Recordings namespace — list, get, delete (no create/update).
 */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import type { Recording, RecordingListResponse } from './relay-rest.types.generated.js';

/**
 * Recording management (read-only + delete).
 *
 * Access via `client.recordings.*`. List/item shapes are typed from the
 * canonical relay-rest OpenAPI spec; `Recording` is a union over the PSTN,
 * SIP, and WebRTC call-leg recording shapes.
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
  async list(params?: QueryParams): Promise<RecordingListResponse> {
    return this._http.get<RecordingListResponse>(this._basePath, params);
  }

  /**
   * Fetch a recording's metadata by ID.
   *
   * @param recordingId - Unique identifier of the recording.
   * @returns The recording metadata record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(recordingId: string): Promise<Recording> {
    return this._http.get<Recording>(this._path(recordingId));
  }

  /**
   * Delete a recording.
   *
   * @param recordingId - Unique identifier of the recording.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(recordingId: string): Promise<unknown> {
    return this._http.delete(this._path(recordingId));
  }
}
