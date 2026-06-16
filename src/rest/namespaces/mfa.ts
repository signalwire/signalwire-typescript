/**
 * MFA (Multi-Factor Authentication) namespace.
 */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';
import type {
  MfaRequest,
  MfaResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
} from './relay-rest.types.generated.js';

/**
 * Multi-factor authentication via SMS or phone call.
 *
 * Access via `client.mfa.*`. Two-step flow: call `.sms()` or `.call()` to send
 * a code, then `.verify()` to confirm it. Request/response shapes are typed
 * from the canonical relay-rest OpenAPI spec.
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

  /**
   * Initiate MFA by sending a one-time code to a phone number over SMS.
   *
   * @param body - MFA request payload (typically `{ to: "+15551234567",
   *   message?: "Your code is {code}" }`).
   * @returns The MFA request record; its `id` is used by {@link verify}.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async sms(body: MfaRequest): Promise<MfaResponse> {
    return this._http.post<MfaResponse>(this._path('sms'), body);
  }

  /**
   * Initiate MFA by placing a phone call that reads out a one-time code.
   *
   * @param body - MFA request payload (typically `{ to: "+15551234567" }`).
   * @returns The MFA request record; its `id` is used by {@link verify}.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async call(body: MfaRequest): Promise<MfaResponse> {
    return this._http.post<MfaResponse>(this._path('call'), body);
  }

  /**
   * Verify the one-time code the user received via SMS or call.
   *
   * @param requestId - The `id` returned from {@link sms} or {@link call}.
   * @param body - Verification payload (typically `{ token: "123456" }`).
   * @returns The verification result — success or failure shape.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async verify(requestId: string, body: MfaVerifyRequest): Promise<MfaVerifyResponse> {
    return this._http.post<MfaVerifyResponse>(this._path(requestId, 'verify'), body);
  }
}
