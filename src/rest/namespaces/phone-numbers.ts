/**
 * Phone Numbers namespace — list, search, purchase, get, update, release.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';

/**
 * Phone number management.
 *
 * `create` and `update` accept an untyped body object (`body: any = {}`).
 * No `PhoneNumberCreateParams` / `PhoneNumberUpdateParams` interfaces are
 * defined because the Python reference SDK uses bare `**kwargs` with no
 * named or typed parameters — there is no Python type contract to port.
 * This is an intentional IDIOMATIC_DEVIATION: Python kwargs ↔ TS `any` object
 * literal with an optional default of `{}` to preserve call-without-args
 * semantics.  If the REST API stabilises a known field set, consider adding
 * typed interfaces and specialising `CrudResource<>` generics here.
 */
export class PhoneNumbersResource extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/phone_numbers');
  }

  /** Create a phone number resource. Body is optional to match Python **kwargs. */
  override async create(body: any = {}): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  /** Update a phone number resource by ID. Body is optional to match Python **kwargs. */
  override async update(resourceId: string, body: any = {}): Promise<any> {
    return this._http.put(this._path(resourceId), body);
  }

  /** Search available phone numbers for purchase. */
  async search(params?: QueryParams): Promise<any> {
    return this._http.get(this._path('search'), params);
  }
}
