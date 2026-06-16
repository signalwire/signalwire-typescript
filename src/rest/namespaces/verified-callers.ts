/**
 * Verified Caller IDs namespace — CRUD + verification flow.
 */

import type { HttpClient } from '../HttpClient.js';
import { CrudResource } from '../base/CrudResource.js';
import type {
  CreateVerifiedCallerIDRequest,
  UpdateVerifiedCallerIDRequest,
  VerifiedCallerID,
  VerifiedCallerIDListResponse,
  VerifiedCallerIDResponse,
  VerifyCallerIDRequest,
} from './relay-rest.types.generated.js';

/**
 * Verified caller ID management with verification flow.
 *
 * Access via `client.verifiedCallers.*`. Extends standard CRUD (typed from the
 * canonical relay-rest OpenAPI spec) with `redialVerification()` and
 * `submitVerification()` for the two-step phone-number verification handshake.
 * Create/update bodies stay `Partial<>` to preserve Python's call-without-args
 * ergonomics.
 */
export class VerifiedCallersResource extends CrudResource<
  VerifiedCallerIDListResponse,
  VerifiedCallerID,
  Partial<CreateVerifiedCallerIDRequest>,
  Partial<UpdateVerifiedCallerIDRequest>
> {
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
  async redialVerification(callerId: string): Promise<VerifiedCallerIDResponse> {
    return this._http.post<VerifiedCallerIDResponse>(this._path(callerId, 'verification'));
  }

  /**
   * Submit the verification code the caller received on the verification call.
   *
   * @param callerId - Unique identifier of the verified caller ID resource.
   * @param body - Verification payload (typically `{ verification_code: "1234" }`).
   * @returns The completed verification record.
   * @throws {RestError} On any non-2xx HTTP response (including a rejected code).
   */
  async submitVerification(
    callerId: string,
    body: VerifyCallerIDRequest,
  ): Promise<VerifiedCallerIDResponse> {
    return this._http.put<VerifiedCallerIDResponse>(this._path(callerId, 'verification'), body);
  }
}
