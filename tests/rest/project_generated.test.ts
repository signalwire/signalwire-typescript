/**
 * AUTO-GENERATED REST wire tests for the `project` namespace — DO NOT EDIT.
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

describe('project wire (generated)', () => {
  it('tokens_create success', async () => {
    await client.project.tokens.create('x', []);
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('project.create_token');
  });

  it('tokens_create error', async () => {
    await mock.pushScenario('project.create_token', 500, { error: 'x' });
    await expect(client.project.tokens.create('x', [])).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('tokens_delete success', async () => {
    await client.project.tokens.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('project.delete_token');
  });

  it('tokens_delete error', async () => {
    await mock.pushScenario('project.delete_token', 500, { error: 'x' });
    await expect(client.project.tokens.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('tokens_update success', async () => {
    await client.project.tokens.update('x');
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('project.update_token');
  });

  it('tokens_update error', async () => {
    await mock.pushScenario('project.update_token', 500, { error: 'x' });
    await expect(client.project.tokens.update('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
