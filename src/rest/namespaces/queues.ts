/**
 * Queues namespace — CRUD + member management.
 */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';
import type {
  CreateQueueRequest,
  Queue,
  QueueListResponse,
  QueueMemberListResponse,
  QueueMemberResponse,
  UpdateQueueRequest,
} from './relay-rest.types.generated.js';

/**
 * Queue management with member operations.
 *
 * Access via `client.queues.*`. Extends standard CRUD (typed from the canonical
 * relay-rest OpenAPI spec) with member list/fetch. Create/update bodies stay
 * `Partial<>` to preserve Python's call-without-args ergonomics.
 */
export class QueuesResource extends CrudResource<
  QueueListResponse,
  Queue,
  Partial<CreateQueueRequest>,
  Partial<UpdateQueueRequest>
> {
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
  async listMembers(queueId: string, params?: QueryParams): Promise<QueueMemberListResponse> {
    return this._http.get<QueueMemberListResponse>(this._path(queueId, 'members'), params);
  }

  /**
   * Get the next member to be served in a queue (FIFO head).
   *
   * @param queueId - Unique identifier of the queue.
   * @returns The next queue member record, or a platform-shaped empty
   *   response when the queue is empty.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async getNextMember(queueId: string): Promise<QueueMemberResponse> {
    return this._http.get<QueueMemberResponse>(this._path(queueId, 'members', 'next'));
  }

  /**
   * Fetch a specific queue member by ID.
   *
   * @param queueId - Unique identifier of the queue.
   * @param memberId - Unique identifier of the queue member.
   * @returns The queue member record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getMember(queueId: string, memberId: string): Promise<QueueMemberResponse> {
    return this._http.get<QueueMemberResponse>(this._path(queueId, 'members', memberId));
  }
}
