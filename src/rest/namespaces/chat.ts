/**
 * Chat API namespace — token creation.
 */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';
import type { CreateChatTokenRequest, CreateChatTokenResponse } from './chat.types.generated.js';

/**
 * Chat token generation.
 *
 * Access via `client.chat.*`. Issues short-lived tokens that end-user clients
 * use to join chat channels.
 */
export class ChatResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/chat/tokens');
  }

  /**
   * Generate a short-lived Chat token.
   *
   * @param body - Token payload (e.g. `{ room_name, user_name, permissions }`).
   * @returns The token record, typically `{ token: "eyJ..." }`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createToken(body: CreateChatTokenRequest): Promise<CreateChatTokenResponse> {
    return this._http.post<CreateChatTokenResponse>(this._basePath, body);
  }
}
