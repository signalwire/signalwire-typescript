/**
 * Abstract base class for all REST resources.
 *
 * Every namespace resource (e.g. `PhoneNumbersResource`, `VideoRooms`) extends
 * this class to get a typed reference to the shared {@link HttpClient} and a
 * small path-building helper.
 */
import type { HttpClient } from '../HttpClient.js';

export abstract class BaseResource {
  protected readonly _http: HttpClient;
  protected readonly _basePath: string;

  constructor(http: HttpClient, basePath: string) {
    this._http = http;
    this._basePath = basePath;
  }

  /** Build a sub-resource path by joining parts onto the base path. */
  protected _path(...parts: (string | number)[]): string {
    return [this._basePath, ...parts.map(String)].join('/');
  }
}
