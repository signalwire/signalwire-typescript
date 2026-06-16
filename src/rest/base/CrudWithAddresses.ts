/**
 * CrudResource extended with address listing.
 */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from './CrudResource.js';

/**
 * {@link CrudResource} extended with a `listAddresses()` helper for resources that
 * have associated Address records (e.g. fabric resources).
 */
export class CrudWithAddresses<
  TList = unknown,
  TItem = unknown,
  TCreate = unknown,
  TUpdate = unknown,
> extends CrudResource<TList, TItem, TCreate, TUpdate> {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List addresses associated with a specific resource instance.
   *
   * @param resourceId - Unique identifier of the owning resource.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of addresses.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listAddresses(resourceId: string, params?: QueryParams): Promise<unknown> {
    return this._http.get(this._path(resourceId, 'addresses'), params);
  }
}
