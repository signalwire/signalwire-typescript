/**
 * Imported Phone Numbers namespace — create only.
 */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';
import type {
  CreateImportedPhoneNumberRequest,
  CreateImportedPhoneNumberResponse,
} from './relay-rest.types.generated.js';

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
  async create(
    body: Partial<CreateImportedPhoneNumberRequest> = {},
  ): Promise<CreateImportedPhoneNumberResponse> {
    return this._http.post<CreateImportedPhoneNumberResponse>(this._basePath, body);
  }
}
