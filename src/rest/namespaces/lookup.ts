/**
 * Phone Number Lookup namespace.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';

/**
 * Phone number lookup (carrier, CNAM).
 *
 * Access via `client.lookup.*`.
 *
 * @example
 * ```ts
 * const info = await client.lookup.phoneNumber('+15551234567', { include: 'carrier,caller-name' });
 * ```
 */
export class LookupResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/lookup');
  }

  /**
   * Look up carrier and CNAM information for a phone number.
   *
   * @param e164 - The phone number in E.164 format (e.g. `"+15551234567"`).
   * @param params - Optional query parameters, most commonly
   *   `include: "carrier,caller-name"` to enable carrier and CNAM lookups.
   * @returns The lookup record containing any requested datasets.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async phoneNumber(e164: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path('phone_number', e164), params);
  }
}
