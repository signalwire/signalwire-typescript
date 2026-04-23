/**
 * Imported Phone Numbers namespace — create only.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/**
 * Import externally-hosted phone numbers.
 *
 * Access via `client.importedNumbers.*`.
 */
export class ImportedNumbersResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/imported_phone_numbers');
  }

  /**
   * Import an externally-hosted phone number into this project.
   *
   * @param body - Import payload specifying the number, carrier details,
   *   and any routing configuration required by the platform.
   * @returns The newly-imported phone-number record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }
}
