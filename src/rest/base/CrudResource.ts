/**
 * Generic CRUD resource with configurable update method.
 */

import type { HttpClient } from '../HttpClient.js';
import type { RequestOptionsInit } from '../RequestOptions.js';
import { ReadResource } from './ReadResource.js';

/**
 * Generic CRUD resource with configurable update method.
 *
 * Provides `list()`, `paginate()`, `get()`, `create()`, `update()`, and
 * `delete()` out of the box — most namespace resources extend this and narrow
 * the generic types. `_updateMethod` may be overridden to `'PUT'` for APIs that
 * replace instead of patch.
 *
 * Extends {@link ReadResource} (mirroring Python's `CrudResource(ReadResource)`)
 * so every CRUD resource inherits the `list()`/`get()`/`paginate()` read surface
 * — in particular the async-iterator `paginate()`. A prior version extended
 * `BaseResource` directly and re-declared `list()`/`get()`, which silently left
 * `paginate()` OFF every CRUD resource (a real runtime gap the hierarchy now closes).
 *
 * @typeParam TList - Type of the paginated list response.
 * @typeParam TItem - Type of a single resource item.
 * @typeParam TCreate - Request body type for `create()`.
 * @typeParam TUpdate - Request body type for `update()`.
 */
export class CrudResource<
  TList = unknown,
  TItem = unknown,
  TCreate = unknown,
  TUpdate = unknown,
> extends ReadResource<TList, TItem> {
  /** Override to 'PUT' for resources that use PUT instead of PATCH. */
  protected _updateMethod: 'PATCH' | 'PUT' = 'PATCH';

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Create a new resource.
   *
   * @param body - Request body describing the resource to create.
   * @returns The newly-created resource.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async create(body: TCreate, requestOptions?: RequestOptionsInit): Promise<TItem> {
    return this._http.post<TItem>(this._basePath, body, undefined, requestOptions);
  }

  /**
   * Update a resource by ID.
   *
   * Uses HTTP `PATCH` by default; subclasses may set `_updateMethod = 'PUT'`
   * when the remote API requires a full-replacement semantics.
   *
   * @param resourceId - Unique identifier of the resource.
   * @param body - Request body with updated fields.
   * @returns The updated resource.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(
    resourceId: string,
    body: TUpdate,
    requestOptions?: RequestOptionsInit,
  ): Promise<TItem> {
    if (this._updateMethod === 'PUT') {
      return this._http.put<TItem>(this._path(resourceId), body, requestOptions);
    }
    return this._http.patch<TItem>(this._path(resourceId), body, requestOptions);
  }

  /**
   * Delete a resource by ID.
   *
   * @param resourceId - Unique identifier of the resource.
   * @returns The platform's delete response (often an empty body on success).
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(resourceId: string, requestOptions?: RequestOptionsInit): Promise<unknown> {
    return this._http.delete(this._path(resourceId), requestOptions);
  }
}
