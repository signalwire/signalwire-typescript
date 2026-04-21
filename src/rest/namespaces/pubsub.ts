/**
 * PubSub API namespace — token creation.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/**
 * PubSub token generation.
 *
 * Access via `client.pubsub.*`. Issues short-lived tokens that browser / mobile
 * clients can use to subscribe to project channels.
 */
export class PubSubResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/pubsub/tokens');
  }

  /** Generate a PubSub token. */
  async createToken(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }
}
