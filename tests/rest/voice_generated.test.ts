/**
 * AUTO-GENERATED REST wire tests for the `voice` namespace — DO NOT EDIT.
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

describe('voice wire (generated)', () => {
  it('voice_get success', async () => {
    await client.logs.voice.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('voice.get_voice_log');
  });

  it('voice_get error', async () => {
    await mock.pushScenario('voice.get_voice_log', 500, { error: 'x' });
    await expect(client.logs.voice.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('voice_listEvents success', async () => {
    await client.logs.voice.listEvents('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('voice.list_voice_log_events');
  });

  it('voice_listEvents error', async () => {
    await mock.pushScenario('voice.list_voice_log_events', 500, { error: 'x' });
    await expect(client.logs.voice.listEvents('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('voice_list success', async () => {
    await client.logs.voice.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('voice.list_voice_logs');
  });

  it('voice_list error', async () => {
    await mock.pushScenario('voice.list_voice_logs', 500, { error: 'x' });
    await expect(client.logs.voice.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
