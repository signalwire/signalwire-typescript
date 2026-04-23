/**
 * Verified Caller IDs namespace — CRUD + verification flow.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { CrudResource } from '../base/CrudResource.js';

/**
 * Verified caller ID management with verification flow.
 *
 * Access via `client.verifiedCallers.*`. Extends standard CRUD with
 * `redialVerification()` and `submitVerification()` for the two-step
 * phone-number verification handshake.
 */
export class VerifiedCallersResource extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/verified_caller_ids');
  }

  /**
   * Redial the verification call, starting the handshake over from scratch.
   *
   * @param callerId - Unique identifier of the verified caller ID resource.
   * @returns The platform-shaped verification response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async redialVerification(callerId: string): Promise<any> {
    return this._http.post(this._path(callerId, 'verification'));
  }

  /**
   * Submit the verification code the caller received on the verification call.
   *
   * @param callerId - Unique identifier of the verified caller ID resource.
   * @param body - Verification payload (typically `{ verification_code: "1234" }`).
   * @returns The completed verification record.
   * @throws {RestError} On any non-2xx HTTP response (including a rejected code).
   */
  async submitVerification(callerId: string, body: any): Promise<any> {
    return this._http.put(this._path(callerId, 'verification'), body);
  }
}
