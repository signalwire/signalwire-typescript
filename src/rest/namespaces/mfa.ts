/**
 * MFA (Multi-Factor Authentication) namespace.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/**
 * Multi-factor authentication via SMS or phone call.
 *
 * Access via `client.mfa.*`. Two-step flow: call `.sms()` or `.call()` to send
 * a code, then `.verify()` to confirm it.
 *
 * @example
 * ```ts
 * const req = await client.mfa.sms({ to: '+15551234567' });
 * const result = await client.mfa.verify(req.id, { token: '123456' });
 * ```
 */
export class MfaResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/mfa');
  }

  /** Initiate MFA via SMS. */
  async sms(body: any): Promise<any> {
    return this._http.post(this._path('sms'), body);
  }

  /** Initiate MFA via phone call. */
  async call(body: any): Promise<any> {
    return this._http.post(this._path('call'), body);
  }

  /** Verify an MFA code. */
  async verify(requestId: string, body: any): Promise<any> {
    return this._http.post(this._path(requestId, 'verify'), body);
  }
}
