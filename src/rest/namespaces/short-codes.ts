/**
 * Short Codes namespace — list, get, update (no create/delete).
 */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import type {
  ListShortCodesResponse,
  RetrieveShortCodeResponse,
  UpdateShortCodeRequest,
  UpdateShortCodeResponse,
} from './relay-rest.types.generated.js';

/**
 * Short code management (read + update only).
 *
 * Access via `client.shortCodes.*`.
 */
export class ShortCodesResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/short_codes');
  }

  /**
   * List short codes in the project.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of short codes.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<ListShortCodesResponse> {
    return this._http.get<ListShortCodesResponse>(this._basePath, params);
  }

  /**
   * Fetch a short code by ID.
   *
   * @param shortCodeId - Unique identifier of the short code.
   * @returns The short-code record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(shortCodeId: string): Promise<RetrieveShortCodeResponse> {
    return this._http.get<RetrieveShortCodeResponse>(this._path(shortCodeId));
  }

  /**
   * Update a short code's configuration (webhooks, friendly name, etc.).
   *
   * @param shortCodeId - Unique identifier of the short code.
   * @param body - Full updated short-code attributes (replace semantics).
   * @returns The updated short-code record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(
    shortCodeId: string,
    body: Partial<UpdateShortCodeRequest> = {},
  ): Promise<UpdateShortCodeResponse> {
    return this._http.put<UpdateShortCodeResponse>(this._path(shortCodeId), body);
  }
}
