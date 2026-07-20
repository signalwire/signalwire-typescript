/**
 * RequestOptions threaded through the RESOURCE verbs (TS-1, plan 4.2 / PY-7).
 *
 * The sibling `request_options_mock.test.ts` drives a raw {@link HttpClient} and
 * proves the transport-level retry/timeout/abort contract. This suite proves the
 * NEXT layer: every generated + base REST resource verb accepts a trailing
 * `requestOptions` and threads it all the way to the transport — so a caller who
 * only ever touches the typed resource surface (`client.fabric.addresses.list(
 * { retries: 1 })`) gets the same wire-observable retry the raw client does.
 *
 * Mirrors the Python reference's per-verb `request_options` keyword (PY-7,
 * `tests/unit/rest/test_resource_request_options.py`). Drives the REAL mock over
 * the REAL fetch transport and asserts on the recorded journal (attempt count) —
 * NOT a transport stub. A resource verb that swallowed `requestOptions` (didn't
 * forward it to `_http`) would show 1 attempt where the contract requires 2.
 */

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { RestClient } from '../../src/rest/index.js';
import { newMockClient } from './mocktest.js';

const ADDRESSES_LIST_ENDPOINT = 'fabric.list_fabric_addresses';
const ADDRESSES_PATH = '/api/fabric/addresses';
const ADDRESS_GET_ENDPOINT = 'fabric.get_fabric_address';
const CREATE_ROOM_ENDPOINT = 'video.create_room';
const ROOMS_PATH = '/api/video/rooms';
const TOKEN = 'test_tok';

let mockUrl: string;
let project: string;
let authHeader: string;
let client: RestClient;

beforeEach(async () => {
  const { mock } = await newMockClient();
  mockUrl = mock.url;
  project = `test_ro_res_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  authHeader = 'Basic ' + Buffer.from(`${project}:${TOKEN}`).toString('base64');
  client = new RestClient({ project, token: TOKEN, host: mockUrl });
});

interface ScenarioSpec {
  status: number;
  response: unknown;
  headers?: Record<string, string>;
  delay_ms?: number;
}

/** Arm a scenario override scoped to THIS suite's auth header (FIFO). */
async function arm(endpointId: string, scenario: ScenarioSpec): Promise<void> {
  const resp = await fetch(
    `${mockUrl}/__mock__/scenarios/${endpointId}?session_id=${encodeURIComponent(authHeader)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario),
    },
  );
  if (!resp.ok) throw new Error(`arm ${endpointId} failed: ${resp.status}`);
}

interface JournalEntry {
  method: string;
  path: string;
  headers: Record<string, string>;
}

/** This suite's journal entries for a given method + path (auth-scoped). */
async function attempts(method: string, path: string): Promise<number> {
  const resp = await fetch(`${mockUrl}/__mock__/journal`);
  const entries = (await resp.json()) as JournalEntry[];
  return entries.filter(
    (e) => e.path === path && e.method === method && e.headers.authorization === authHeader,
  ).length;
}

describe('RequestOptions on the resource read surface (base ReadResource)', () => {
  it('list() forwards requestOptions — a 503 is retried (2 attempts)', async () => {
    // list(params?, requestOptions?) — params slot is undefined here; the
    // requestOptions object goes in the trailing slot (mirrors Python's
    // keyword-only `request_options`).
    await arm(ADDRESSES_LIST_ENDPOINT, { status: 503, response: { errors: [{ code: 'X' }] } });
    const body = await client.fabric.addresses.list(undefined, { retries: 1, retryBackoff: 0 });
    expect(body).not.toBeNull();
    expect(await attempts('GET', ADDRESSES_PATH)).toBe(2);
  });

  it('list() without requestOptions does NOT retry (1 attempt, raises)', async () => {
    await arm(ADDRESSES_LIST_ENDPOINT, { status: 503, response: { errors: [{ code: 'X' }] } });
    await expect(client.fabric.addresses.list()).rejects.toMatchObject({ statusCode: 503 });
    expect(await attempts('GET', ADDRESSES_PATH)).toBe(1);
  });

  it('get() forwards requestOptions — a 503 is retried (2 attempts)', async () => {
    await arm(ADDRESS_GET_ENDPOINT, { status: 503, response: { errors: [{ code: 'X' }] } });
    const body = await client.fabric.addresses.get('addr-1', { retries: 1, retryBackoff: 0 });
    expect(body).not.toBeNull();
    expect(await attempts('GET', `${ADDRESSES_PATH}/addr-1`)).toBe(2);
  });
});

describe('RequestOptions on the resource write surface (generated CRUD create)', () => {
  it('create() forwards requestOptions — a POST 503 throttle is retried (2 attempts)', async () => {
    await arm(CREATE_ROOM_ENDPOINT, { status: 503, response: { error: 'x' } });
    await client.video.rooms.create({ name: 'standup' }, undefined, {
      retries: 1,
      retryBackoff: 0,
    });
    expect(await attempts('POST', ROOMS_PATH)).toBe(2);
  });

  it('create() 500 is NOT retried even with requestOptions (side-effect safety, 1 attempt)', async () => {
    await arm(CREATE_ROOM_ENDPOINT, { status: 500, response: { error: 'x' } });
    await expect(
      client.video.rooms.create({ name: 'standup' }, undefined, { retries: 2, retryBackoff: 0 }),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(await attempts('POST', ROOMS_PATH)).toBe(1);
  });
});

afterAll(() => {
  // Shared mock owned by mocktest's process-level lifecycle.
});
