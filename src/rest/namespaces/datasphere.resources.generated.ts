// AUTO-GENERATED from porting-sdk/rest-apis/datasphere/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';
import type {
  ChunkListResponse,
  ChunkResponse,
  Document,
  DocumentCreateRequest,
  DocumentListResponse,
  DocumentUpdateRequest,
  SearchResponse,
  docid,
} from './datasphere.types.generated.js';

export class DatasphereDocuments extends CrudResource<
  DocumentListResponse,
  Document,
  DocumentCreateRequest,
  DocumentUpdateRequest
> {
  constructor(http: HttpClient) {
    super(http, '/api/datasphere/documents');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: DocumentCreateRequest,
    extras?: Record<string, unknown>,
  ): Promise<Document> {
    return this._http.post<Document>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: DocumentUpdateRequest,
    extras?: Record<string, unknown>,
  ): Promise<Document> {
    return this._http.patch<Document>(this._path(id), { ...body, ...extras });
  }

  async search(
    query_string: string,
    options?: {
      tags?: string[];
      document_id?: docid;
      distance?: number;
      count?: number;
      language?: string;
      pos_to_expand?: string[];
      max_synonyms?: number;
      extras?: Record<string, unknown>;
    },
  ): Promise<SearchResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      query_string,
      tags: options?.tags,
      document_id: options?.document_id,
      distance: options?.distance,
      count: options?.count,
      language: options?.language,
      pos_to_expand: options?.pos_to_expand,
      max_synonyms: options?.max_synonyms,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<SearchResponse>(this._path('search'), body);
  }

  async listChunks(document_id: string, params?: QueryParams): Promise<ChunkListResponse> {
    return this._http.get<ChunkListResponse>(this._path(document_id, 'chunks'), params);
  }

  async getChunk(
    document_id: string,
    chunk_id: string,
    params?: QueryParams,
  ): Promise<ChunkResponse> {
    return this._http.get<ChunkResponse>(this._path(document_id, 'chunks', chunk_id), params);
  }

  async deleteChunk(document_id: string, chunk_id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(document_id, 'chunks', chunk_id));
  }
}
