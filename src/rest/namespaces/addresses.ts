/**
 * Addresses namespace — list, create, get, delete (no update).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';

/**
 * Address management (no update endpoint).
 *
 * Access via `client.addresses.*`.
 */
export class AddressesResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/addresses');
  }

  /** List all addresses in the project. */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /** Create a new address. */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  /** Fetch a single address by ID. */
  async get(addressId: string): Promise<any> {
    return this._http.get(this._path(addressId));
  }

  /** Delete an address. */
  async delete(addressId: string): Promise<any> {
    return this._http.delete(this._path(addressId));
  }
}
