/**
 * Read-only resource base: `list()` + `get()` only.
 */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from './BaseResource.js';

/**
 * Read-only REST resource exposing `list()` and `get()` (no create/update/delete).
 *
 * The read-only counterpart of {@link CrudResource} — used by resources whose
 * surface is just listing and fetching (e.g. video room sessions, fabric
 * addresses). Generated subclasses bind the two generic types and add any
 * declared sub-resource accessors.
 *
 * @typeParam TList - Type of the paginated list response.
 * @typeParam TItem - Type of a single resource item.
 */
export class ReadResource<TList = unknown, TItem = unknown> extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List resources with optional query parameters.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns The paginated list response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<TList> {
    return this._http.get<TList>(this._basePath, params);
  }

  /**
   * Fetch a single resource by ID.
   *
   * @param resourceId - Unique identifier of the resource.
   * @returns The resource record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async get(resourceId: string): Promise<TItem> {
    return this._http.get<TItem>(this._path(resourceId));
  }
}
