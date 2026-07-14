/**
 * AUTO-GENERATED REST wire tests for the `projects` namespace — DO NOT EDIT.
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

describe('projects wire (generated)', () => {
  it('projects_create success', async () => {
    await client.projects.create({ name: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('projects.create_subproject');
  });

  it('projects_create error', async () => {
    await mock.pushScenario('projects.create_subproject', 500, { error: 'x' });
    await expect(client.projects.create({ name: 'x' })).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('projects_delete success', async () => {
    await client.projects.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('projects.delete_subproject');
  });

  it('projects_delete error', async () => {
    await mock.pushScenario('projects.delete_subproject', 500, { error: 'x' });
    await expect(client.projects.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('projects_get success', async () => {
    await client.projects.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('projects.get_project');
  });

  it('projects_get error', async () => {
    await mock.pushScenario('projects.get_project', 500, { error: 'x' });
    await expect(client.projects.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('projects_list success', async () => {
    await client.projects.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('projects.list_projects');
  });

  it('projects_list error', async () => {
    await mock.pushScenario('projects.list_projects', 500, { error: 'x' });
    await expect(client.projects.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('projects_rotateSigningKey success', async () => {
    await client.projects.rotateSigningKey('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('projects.rotate_signing_key');
  });

  it('projects_rotateSigningKey error', async () => {
    await mock.pushScenario('projects.rotate_signing_key', 500, { error: 'x' });
    await expect(client.projects.rotateSigningKey('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('projects_update success', async () => {
    await client.projects.update('x', { name: 'x' });
    const last = await mock.last();
    expect(last.method).toBe('PATCH');
    expect(last.matched_route).toBe('projects.update_project');
  });

  it('projects_update error', async () => {
    await mock.pushScenario('projects.update_project', 500, { error: 'x' });
    await expect(client.projects.update('x', { name: 'x' })).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
