// AUTO-GENERATED from porting-sdk/rest-apis/projects/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { RequestOptionsInit } from '../RequestOptions.js';
import { CrudResource } from '../base/CrudResource.js';
import type {
  Project,
  ProjectCreate,
  ProjectList,
  ProjectUpdate,
  ProjectWithSigningKey,
} from './projects.types.generated.js';

export class Projects extends CrudResource<ProjectList, Project, ProjectCreate, ProjectUpdate> {
  constructor(http: HttpClient) {
    super(http, '/api/projects');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: ProjectCreate,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<Project> {
    return this._http.post<Project>(
      this._basePath,
      { ...body, ...extras },
      undefined,
      requestOptions,
    );
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: ProjectUpdate,
    extras?: Record<string, unknown>,
    requestOptions?: RequestOptionsInit,
  ): Promise<Project> {
    return this._http.patch<Project>(this._path(id), { ...body, ...extras }, requestOptions);
  }

  async rotateSigningKey(
    id: string,
    requestOptions?: RequestOptionsInit,
  ): Promise<ProjectWithSigningKey> {
    return this._http.post<ProjectWithSigningKey>(
      this._path(id, 'signing-key', 'rotate'),
      undefined,
      undefined,
      requestOptions,
    );
  }
}
