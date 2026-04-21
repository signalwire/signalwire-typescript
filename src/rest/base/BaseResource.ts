import type { HttpClient } from '../HttpClient.js';

/**
 * Abstract base class for all REST resources.
 *
 * Every namespace resource (e.g. {@link PhoneNumbersResource}, {@link VideoRooms})
 * extends this class to get a typed reference to the shared {@link HttpClient}
 * and a small path-building helper. Not exported for direct use — subclass it.
 */
export abstract class BaseResource {
  protected readonly _http: HttpClient;
  protected readonly _basePath: string;

  /**
   * @param http - Shared HTTP client to issue requests through.
   * @param basePath - Absolute path prefix (e.g. `'/api/relay/rest/phone_numbers'`).
   */
  constructor(http: HttpClient, basePath: string) {
    this._http = http;
    this._basePath = basePath;
  }

  /**
   * Build a sub-resource path by joining parts onto the base path.
   *
   * @param parts - String or numeric path segments to append.
   * @returns The joined path (no trailing slash).
   */
  protected _path(...parts: (string | number)[]): string {
    return [this._basePath, ...parts.map(String)].join('/');
  }
}
