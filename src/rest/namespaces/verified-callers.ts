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

  /** Redial verification call. */
  async redialVerification(callerId: string): Promise<any> {
    return this._http.post(this._path(callerId, 'verification'));
  }

  /** Submit verification code. */
  async submitVerification(callerId: string, body: any): Promise<any> {
    return this._http.put(this._path(callerId, 'verification'), body);
  }
}
