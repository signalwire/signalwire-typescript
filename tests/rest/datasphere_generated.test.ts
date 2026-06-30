/**
 * AUTO-GENERATED REST wire tests for the `datasphere` namespace — DO NOT EDIT.
 * Regenerate: npx tsx scripts/generate-rest-tests.ts
 *
 * Each route the SDK implements (captured from the real client by scripts/route-registry.ts,
 * joined to the spec operationId) gets a SUCCESS test (call it, assert method + matched_route on
 * the mock journal) and an ERROR test (arm a 5xx, assert RestError). The assertion oracle is the
 * spec operationId — independent of the resource generator — so these catch SDK-vs-contract
 * drift, not a generator self-snapshot. Full-mock harness fixtures.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';
import { RestError } from '../../src/rest/RestError.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

describe('datasphere wire (generated)', () => {
  it('documents_create success', async () => {
    await client.datasphere.documents.create({});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('datasphere.create_document');
  });

  it('documents_create error', async () => {
    await mock.pushScenario('datasphere.create_document', 500, { error: 'x' });
    await expect(client.datasphere.documents.create({})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('documents_deleteChunk success', async () => {
    await client.datasphere.documents.deleteChunk('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('datasphere.delete_document_chunk');
  });

  it('documents_deleteChunk error', async () => {
    await mock.pushScenario('datasphere.delete_document_chunk', 500, { error: 'x' });
    await expect(client.datasphere.documents.deleteChunk('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('documents_delete success', async () => {
    await client.datasphere.documents.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('datasphere.delete_document');
  });

  it('documents_delete error', async () => {
    await mock.pushScenario('datasphere.delete_document', 500, { error: 'x' });
    await expect(client.datasphere.documents.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('documents_getChunk success', async () => {
    await client.datasphere.documents.getChunk('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('datasphere.get_document_chunk');
  });

  it('documents_getChunk error', async () => {
    await mock.pushScenario('datasphere.get_document_chunk', 500, { error: 'x' });
    await expect(client.datasphere.documents.getChunk('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('documents_get success', async () => {
    await client.datasphere.documents.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('datasphere.get_document');
  });

  it('documents_get error', async () => {
    await mock.pushScenario('datasphere.get_document', 500, { error: 'x' });
    await expect(client.datasphere.documents.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('documents_listChunks success', async () => {
    await client.datasphere.documents.listChunks('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('datasphere.list_document_chunks');
  });

  it('documents_listChunks error', async () => {
    await mock.pushScenario('datasphere.list_document_chunks', 500, { error: 'x' });
    await expect(client.datasphere.documents.listChunks('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('documents_list success', async () => {
    await client.datasphere.documents.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('datasphere.list_documents');
  });

  it('documents_list error', async () => {
    await mock.pushScenario('datasphere.list_documents', 500, { error: 'x' });
    await expect(client.datasphere.documents.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('documents_search success', async () => {
    await client.datasphere.documents.search('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('datasphere.search_documents');
  });

  it('documents_search error', async () => {
    await mock.pushScenario('datasphere.search_documents', 500, { error: 'x' });
    await expect(client.datasphere.documents.search('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('documents_update success', async () => {
    await client.datasphere.documents.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('datasphere.update_document');
  });

  it('documents_update error', async () => {
    await mock.pushScenario('datasphere.update_document', 500, { error: 'x' });
    await expect(client.datasphere.documents.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
