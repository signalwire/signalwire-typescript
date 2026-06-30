/**
 * AUTO-GENERATED REST wire tests for the `fax` namespace — DO NOT EDIT.
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

describe('fax wire (generated)', () => {
  it('fax_get success', async () => {
    await client.logs.fax.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fax.get_fax_log');
  });

  it('fax_get error', async () => {
    await mock.pushScenario('fax.get_fax_log', 500, { error: 'x' });
    await expect(client.logs.fax.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('fax_list success', async () => {
    await client.logs.fax.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('fax.list_fax_logs');
  });

  it('fax_list error', async () => {
    await mock.pushScenario('fax.list_fax_logs', 500, { error: 'x' });
    await expect(client.logs.fax.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
