/**
 * Datasphere API namespace — document management and semantic search.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';

/** Document management with search and chunk operations. */
export class DatasphereDocuments extends CrudResource {
  constructor(http: HttpClient) {
    super(http, '/api/datasphere/documents');
  }

  /**
   * Run a semantic search across indexed documents.
   *
   * @param body - Search payload (typically `{ query: "...", document_id?: "...",
   *   limit?: 5, tags?: [...] }`).
   * @returns The ranked search hits.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async search(body: any): Promise<any> {
    return this._http.post(this._path('search'), body);
  }

  /**
   * List content chunks for a document.
   *
   * @param documentId - Unique identifier of the document.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of chunks.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listChunks(documentId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(documentId, 'chunks'), params);
  }

  /**
   * Fetch a specific chunk of a document by ID.
   *
   * @param documentId - Unique identifier of the document.
   * @param chunkId - Unique identifier of the chunk.
   * @returns The chunk record with its content.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async getChunk(documentId: string, chunkId: string): Promise<any> {
    return this._http.get(this._path(documentId, 'chunks', chunkId));
  }

  /**
   * Delete a specific chunk from a document.
   *
   * @param documentId - Unique identifier of the document.
   * @param chunkId - Unique identifier of the chunk.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async deleteChunk(documentId: string, chunkId: string): Promise<any> {
    return this._http.delete(this._path(documentId, 'chunks', chunkId));
  }
}

/**
 * Datasphere API namespace.
 *
 * Access via `client.datasphere.*`. Datasphere is SignalWire's RAG service —
 * index documents and run semantic search from within agent tools.
 *
 * @example
 * ```ts
 * const hits = await client.datasphere.documents.search({
 *   query: 'refund policy',
 *   document_id: 'doc_abc',
 *   limit: 5,
 * });
 * ```
 */
export class DatasphereNamespace {
  /** Document CRUD plus semantic search and chunk management. */
  readonly documents: DatasphereDocuments;

  constructor(http: HttpClient) {
    this.documents = new DatasphereDocuments(http);
  }
}
