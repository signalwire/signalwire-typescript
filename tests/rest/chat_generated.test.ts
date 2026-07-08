/**
 * AUTO-GENERATED REST wire tests for the `chat` namespace — DO NOT EDIT.
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

describe('chat wire (generated)', () => {
  it('chat_createToken success', async () => {
    await client.chat.createToken(1, {});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('chat.create_chat_token');
  });

  it('chat_createToken error', async () => {
    await mock.pushScenario('chat.create_chat_token', 500, { error: 'x' });
    await expect(client.chat.createToken(1, {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
