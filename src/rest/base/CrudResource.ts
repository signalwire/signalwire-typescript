/**
 * Generic CRUD resource with configurable update method.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from './BaseResource.js';

/**
 * Generic CRUD resource with configurable update method.
 *
 * Provides `list()`, `create()`, `get()`, `update()`, and `delete()` out of the
 * box — most namespace resources extend this and narrow the generic types.
 * `_updateMethod` may be overridden to `'PUT'` for APIs that replace instead
 * of patch.
 *
 * @typeParam TList - Type of the paginated list response.
 * @typeParam TItem - Type of a single resource item.
 * @typeParam TCreate - Request body type for `create()`.
 * @typeParam TUpdate - Request body type for `update()`.
 */
export class CrudResource<
  TList = any,
  TItem = any,
  TCreate = any,
  TUpdate = any,
> extends BaseResource {
  /** Override to 'PUT' for resources that use PUT instead of PATCH. */
  protected _updateMethod: 'PATCH' | 'PUT' = 'PATCH';

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List resources with optional query parameters. */
  async list(params?: QueryParams): Promise<TList> {
    return this._http.get<TList>(this._basePath, params);
  }

  /** Create a new resource. */
  async create(body: TCreate): Promise<TItem> {
    return this._http.post<TItem>(this._basePath, body);
  }

  /** Get a single resource by ID. */
  async get(resourceId: string): Promise<TItem> {
    return this._http.get<TItem>(this._path(resourceId));
  }

  /** Update a resource by ID. */
  async update(resourceId: string, body: TUpdate): Promise<TItem> {
    if (this._updateMethod === 'PUT') {
      return this._http.put<TItem>(this._path(resourceId), body);
    }
    return this._http.patch<TItem>(this._path(resourceId), body);
  }

  /** Delete a resource by ID. */
  async delete(resourceId: string): Promise<any> {
    return this._http.delete(this._path(resourceId));
  }
}
