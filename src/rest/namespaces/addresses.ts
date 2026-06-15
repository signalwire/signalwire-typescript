/**
 * Addresses namespace — list, create, get, delete (no update).
 */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import type {
  CreateAddressRequest,
  CreateAddressResponse,
  GetAddressResponse,
  ListAddressesResponse,
} from './relay-rest.types.generated.js';

/**
 * Address management (no update endpoint).
 *
 * Access via `client.addresses.*`.
 */
export class AddressesResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/addresses');
  }

  /**
   * List all addresses in the project.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of addresses.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<ListAddressesResponse> {
    return this._http.get<ListAddressesResponse>(this._basePath, params);
  }

  /**
   * Create a new address.
   *
   * @param body - Address attributes (name, display name, context, etc.).
   * @returns The newly-created address.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async create(body: Partial<CreateAddressRequest> = {}): Promise<CreateAddressResponse> {
    return this._http.post<CreateAddressResponse>(this._basePath, body);
  }

  /**
   * Fetch a single address by ID.
   *
   * @param addressId - Unique identifier of the address.
   * @returns The address record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(addressId: string): Promise<GetAddressResponse> {
    return this._http.get<GetAddressResponse>(this._path(addressId));
  }

  /**
   * Delete an address.
   *
   * @param addressId - Unique identifier of the address.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(addressId: string): Promise<unknown> {
    return this._http.delete(this._path(addressId));
  }
}
