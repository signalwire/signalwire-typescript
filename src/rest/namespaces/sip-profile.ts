/**
 * SIP Profile namespace — get and update project SIP profile.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/**
 * Project SIP profile (singleton resource).
 *
 * Access via `client.sipProfile.*`.
 */
export class SipProfileResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/sip_profile');
  }

  /**
   * Fetch the project's SIP profile.
   *
   * @returns The SIP profile record for this project.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async get(): Promise<any> {
    return this._http.get(this._basePath);
  }

  /**
   * Update the project's SIP profile.
   *
   * @param body - Full SIP profile attributes (replace semantics — not patch).
   * @returns The updated SIP profile.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(body: any): Promise<any> {
    return this._http.put(this._basePath, body);
  }
}
