/**
 * Project API namespace — API token management.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/** Project API token management. */
export class ProjectTokens extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/project/tokens');
  }

  /**
   * Create a new project-scoped API token.
   *
   * @param body - Token creation payload (friendly name, scopes, etc.).
   * @returns The newly-created token record, including the secret value
   *   (which is typically returned ONCE and not retrievable again).
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  /**
   * Update a project API token's attributes (e.g. friendly name).
   *
   * @param tokenId - Unique identifier of the token.
   * @param body - Partial update payload.
   * @returns The updated token record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(tokenId: string, body: any): Promise<any> {
    return this._http.patch(this._path(tokenId), body);
  }

  /**
   * Revoke and delete a project API token.
   *
   * @param tokenId - Unique identifier of the token to revoke.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(tokenId: string): Promise<any> {
    return this._http.delete(this._path(tokenId));
  }
}

/**
 * Project API namespace.
 *
 * Access via `client.project.*`. Manages project-level resources like
 * secondary API tokens.
 */
export class ProjectNamespace {
  /** Project-scoped API token create / update / delete. */
  readonly tokens: ProjectTokens;

  constructor(http: HttpClient) {
    this.tokens = new ProjectTokens(http);
  }
}
