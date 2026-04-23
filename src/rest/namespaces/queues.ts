/**
 * Queues namespace — CRUD + member management.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';

/**
 * Queue management with member operations.
 *
 * Access via `client.queues.*`. Extends standard CRUD with member list/fetch.
 */
export class QueuesResource extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/queues');
  }

  /**
   * List members in a queue.
   *
   * @param queueId - Unique identifier of the queue.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of queue members.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listMembers(queueId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(queueId, 'members'), params);
  }

  /**
   * Get the next member to be served in a queue (FIFO head).
   *
   * @param queueId - Unique identifier of the queue.
   * @returns The next queue member record, or a platform-shaped empty
   *   response when the queue is empty.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async getNextMember(queueId: string): Promise<any> {
    return this._http.get(this._path(queueId, 'members', 'next'));
  }

  /**
   * Fetch a specific queue member by ID.
   *
   * @param queueId - Unique identifier of the queue.
   * @param memberId - Unique identifier of the queue member.
   * @returns The queue member record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getMember(queueId: string, memberId: string): Promise<any> {
    return this._http.get(this._path(queueId, 'members', memberId));
  }
}
