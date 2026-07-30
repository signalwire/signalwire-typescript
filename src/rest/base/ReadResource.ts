/**
 * Read-only resource base: `list()` + `get()` only.
 */

import type { HttpClient } from '../HttpClient.js';
import { paginate } from '../pagination.js';
import type { RequestOptionsInit } from '../RequestOptions.js';
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
  async list(params?: QueryParams, requestOptions?: RequestOptionsInit): Promise<TList> {
    return this._http.get<TList>(this._basePath, params, requestOptions);
  }

  /**
   * Iterate every item across all pages of this resource's list endpoint.
   *
   * `list()` returns a single raw page (the server's first response).
   * `paginate()` walks every page transparently, following the server's
   * `links.next` / `next_page_uri` cursor, and yields one item at a time — so
   * callers no longer hand-build the page-token loop:
   *
   * ```typescript
   * import { RestClient } from '@signalwire/sdk';
   * const client = new RestClient();
   * for await (const address of client.fabric.addresses.paginate()) {
   *   console.log(address);
   * }
   * ```
   *
   * It is an async iterator wired to the shared {@link paginate} generator,
   * reading items from `resp["data"]`.
   *
   * @param params - Query parameters applied to the FIRST request only;
   *   subsequent pages follow the server-supplied next-page URL.
   * @returns An async iterator yielding each `TItem` across all pages.
   */
  paginate(
    params?: QueryParams,
    requestOptions?: RequestOptionsInit,
  ): AsyncGenerator<TItem, void, undefined> {
    return paginate<TItem>(this._http, this._basePath, params, 'data', requestOptions);
  }

  /**
   * Fetch a single resource by ID.
   *
   * @param resourceId - Unique identifier of the resource.
   * @returns The resource record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async get(resourceId: string, requestOptions?: RequestOptionsInit): Promise<TItem> {
    return this._http.get<TItem>(this._path(resourceId), undefined, requestOptions);
  }
}
