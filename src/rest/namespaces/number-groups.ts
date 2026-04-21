/**
 * Number Groups namespace — CRUD + membership management.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';

/**
 * Number group management with membership operations.
 *
 * Access via `client.numberGroups.*`. Extends standard CRUD with membership helpers.
 */
export class NumberGroupsResource extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/number_groups');
  }

  /**
   * List memberships (phone-number assignments) in a group.
   *
   * @param groupId - Unique identifier of the number group.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of number-group memberships.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listMemberships(groupId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(groupId, 'number_group_memberships'), params);
  }

  /**
   * Add a phone number to a group.
   *
   * @param groupId - Unique identifier of the number group.
   * @param body - Membership payload (typically `{ phone_number_id: "..." }`).
   * @returns The newly-created membership record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async addMembership(groupId: string, body: any): Promise<any> {
    return this._http.post(this._path(groupId, 'number_group_memberships'), body);
  }

  /**
   * Fetch a membership by ID.
   *
   * @param membershipId - Unique identifier of the membership.
   * @returns The membership record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getMembership(membershipId: string): Promise<any> {
    return this._http.get(`/api/relay/rest/number_group_memberships/${membershipId}`);
  }

  /**
   * Remove a number from a group by deleting its membership.
   *
   * @param membershipId - Unique identifier of the membership.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async deleteMembership(membershipId: string): Promise<any> {
    return this._http.delete(`/api/relay/rest/number_group_memberships/${membershipId}`);
  }
}
