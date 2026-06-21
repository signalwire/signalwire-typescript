/**
 * Full REST success + error coverage for the `datasphere` spec group.
 *
 * Mirrors the proven python/java suites and the canonical
 * tests/rest/fabric_coverage_mock.test.ts style: every coverable canonical
 * datasphere route (9 of 9 — ZERO gaps, matching python/java) gets BOTH a
 * success (2xx) test and an error (4xx/5xx) test, asserting method, path,
 * matched_route, and (for errors) response_status against the mock journal.
 *
 * Routes covered (9):
 *   datasphere.list_documents          GET    /api/datasphere/documents
 *   datasphere.create_document         POST   /api/datasphere/documents
 *   datasphere.search_documents        POST   /api/datasphere/documents/search
 *   datasphere.list_document_chunks    GET    /api/datasphere/documents/{documentId}/chunks
 *   datasphere.get_document_chunk      GET    /api/datasphere/documents/{documentId}/chunks/{chunkId}
 *   datasphere.delete_document_chunk   DELETE /api/datasphere/documents/{documentId}/chunks/{chunkId}
 *   datasphere.get_document            GET    /api/datasphere/documents/{id}
 *   datasphere.update_document         PATCH  /api/datasphere/documents/{id}
 *   datasphere.delete_document         DELETE /api/datasphere/documents/{id}
 *
 * Companion to tests/rest/datasphere.test.ts (idiom); self-contained.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { JournalEntry, MockHarness } from './mocktest.js';
import { RestError } from '../../src/rest/RestError.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- DRY helpers -------------------------------------------------------
//
// Each helper RETURNS the journal entry (or response) so the calling `it()`
// body holds its own real assertions — the no-cheat auditor is intra-function.

/**
 * Await an SDK call, then return its response body alongside the last journal
 * entry. The caller asserts on both.
 */
async function callOk<T>(fn: () => Promise<T>): Promise<{ body: T; last: JournalEntry }> {
  const body = await fn();
  const last = await mock.last();
  return { body, last };
}

/**
 * Arm a one-shot error scenario for `endpointId`, assert the SDK call rejects
 * with RestError, and return the recorded journal entry for body assertions.
 */
async function callErr(
  endpointId: string,
  status: number,
  fn: () => Promise<unknown>,
): Promise<JournalEntry> {
  await mock.pushScenario(endpointId, status, { error: 'x' });
  await expect(fn()).rejects.toThrow(RestError);
  return mock.last();
}

// ---- Datasphere Documents ----------------------------------------------

describe('Datasphere Documents', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.datasphere.documents.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/datasphere/documents');
    expect(last.matched_route).toBe('datasphere.list_documents');
  });
  it('list error 500', async () => {
    const last = await callErr('datasphere.list_documents', 500, () =>
      client.datasphere.documents.list(),
    );
    expect(last.matched_route).toBe('datasphere.list_documents');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() =>
      client.datasphere.documents.create({ url: 'https://example.com/doc.pdf' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/datasphere/documents');
    expect(last.matched_route).toBe('datasphere.create_document');
  });
  it('create error 422', async () => {
    const last = await callErr('datasphere.create_document', 422, () =>
      client.datasphere.documents.create({ url: 'https://example.com/doc.pdf' }),
    );
    expect(last.matched_route).toBe('datasphere.create_document');
    expect(last.response_status).toBe(422);
  });

  it('search success', async () => {
    const { last } = await callOk(() =>
      client.datasphere.documents.search({ query_string: 'find me', count: 3 }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/datasphere/documents/search');
    expect(last.matched_route).toBe('datasphere.search_documents');
  });
  it('search error 422', async () => {
    const last = await callErr('datasphere.search_documents', 422, () =>
      client.datasphere.documents.search({ query_string: 'find me' }),
    );
    expect(last.matched_route).toBe('datasphere.search_documents');
    expect(last.response_status).toBe(422);
  });

  it('list chunks success', async () => {
    const { body, last } = await callOk(() => client.datasphere.documents.listChunks('doc-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/datasphere/documents/doc-1/chunks');
    expect(last.matched_route).toBe('datasphere.list_document_chunks');
  });
  it('list chunks error 500', async () => {
    const last = await callErr('datasphere.list_document_chunks', 500, () =>
      client.datasphere.documents.listChunks('doc-1'),
    );
    expect(last.matched_route).toBe('datasphere.list_document_chunks');
    expect(last.response_status).toBe(500);
  });

  it('get chunk success', async () => {
    const { last } = await callOk(() => client.datasphere.documents.getChunk('doc-1', 'ch-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/datasphere/documents/doc-1/chunks/ch-1');
    expect(last.matched_route).toBe('datasphere.get_document_chunk');
  });
  it('get chunk error 404', async () => {
    const last = await callErr('datasphere.get_document_chunk', 404, () =>
      client.datasphere.documents.getChunk('doc-1', 'missing'),
    );
    expect(last.matched_route).toBe('datasphere.get_document_chunk');
    expect(last.response_status).toBe(404);
  });

  it('delete chunk success', async () => {
    const { last } = await callOk(() => client.datasphere.documents.deleteChunk('doc-1', 'ch-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/datasphere/documents/doc-1/chunks/ch-1');
    expect(last.matched_route).toBe('datasphere.delete_document_chunk');
  });
  it('delete chunk error 404', async () => {
    const last = await callErr('datasphere.delete_document_chunk', 404, () =>
      client.datasphere.documents.deleteChunk('doc-1', 'missing'),
    );
    expect(last.matched_route).toBe('datasphere.delete_document_chunk');
    expect(last.response_status).toBe(404);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.datasphere.documents.get('doc-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/datasphere/documents/doc-1');
    expect(last.matched_route).toBe('datasphere.get_document');
  });
  it('get error 404', async () => {
    const last = await callErr('datasphere.get_document', 404, () =>
      client.datasphere.documents.get('missing'),
    );
    expect(last.matched_route).toBe('datasphere.get_document');
    expect(last.response_status).toBe(404);
  });

  it('update success (PATCH)', async () => {
    const { last } = await callOk(() =>
      client.datasphere.documents.update('doc-1', { tags: ['renamed'] }),
    );
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe('/api/datasphere/documents/doc-1');
    expect(last.matched_route).toBe('datasphere.update_document');
  });
  it('update error 404', async () => {
    const last = await callErr('datasphere.update_document', 404, () =>
      client.datasphere.documents.update('missing', { tags: ['renamed'] }),
    );
    expect(last.matched_route).toBe('datasphere.update_document');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.datasphere.documents.delete('doc-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/datasphere/documents/doc-1');
    expect(last.matched_route).toBe('datasphere.delete_document');
  });
  it('delete error 404', async () => {
    const last = await callErr('datasphere.delete_document', 404, () =>
      client.datasphere.documents.delete('missing'),
    );
    expect(last.matched_route).toBe('datasphere.delete_document');
    expect(last.response_status).toBe(404);
  });
});
