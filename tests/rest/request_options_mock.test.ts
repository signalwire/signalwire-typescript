/**
 * RequestOptions envelope — behavioral contract over the real mock (plan 4.2).
 *
 * Translated from signalwire-python/tests/unit/rest/test_request_options.py.
 * These drive a real {@link HttpClient} through the real `fetch` transport into
 * the shared `mock_signalwire` and assert on the recorded journal — the same
 * journal the REST-COVERAGE gate reads. Retry / timeout are wire-observable: the
 * mock sees N attempts and honors the backoff ordering, so the contract is
 * proven over the real mock, NOT a transport stub.
 *
 * Contract pinned here (the oracle):
 * - `retries`: a retryable failure is retried up to `retries` extra times; the
 *   mock sees `retries + 1` attempts; the final success is returned.
 * - idempotency asymmetry: GET/PUT/DELETE retry on the full `retryOnStatus`
 *   set; POST/PATCH retry only on 429/503 (throttles), never 500/502/504.
 * - `timeout`: a server-side delay exceeding the timeout raises the transport
 *   error family.
 * - `abortSignal`: an already-aborted signal raises the transport error family
 *   before the send (and TS passes it to fetch for true in-flight abort).
 * - per-request options shallow-override the client default.
 */

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HttpClient } from '../../src/rest/HttpClient.js';
import { RestError, RestTransportError } from '../../src/rest/RestError.js';
import type { RequestOptionsInit } from '../../src/rest/RequestOptions.js';
import { newMockClient } from './mocktest.js';

const ADDRESSES_ENDPOINT_ID = 'fabric.list_fabric_addresses';
const ADDRESSES_PATH = '/api/fabric/addresses';
const CREATE_ADDRESS_ENDPOINT_ID = 'relay-rest.create_address';
const CREATE_ADDRESS_PATH = '/api/relay/rest/addresses';
const TOKEN = 'test_tok';

let mockUrl: string;
let project: string;
let authHeader: string;

/** Boot (or reuse) the shared mock and mint a per-suite isolated auth header. */
beforeEach(async () => {
  // newMockClient boots the shared mock server and hands back its URL. We take
  // the URL and build our OWN HttpClient (mirroring python's client._http) with
  // a fresh random project so this suite's journal + scenarios are isolated.
  const { mock } = await newMockClient();
  mockUrl = mock.url;
  project = `test_ro_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  authHeader = 'Basic ' + Buffer.from(`${project}:${TOKEN}`).toString('base64');
});

/** A fresh HttpClient pointed at the mock with this suite's isolated auth. */
function makeClient(requestOptions?: RequestOptionsInit): HttpClient {
  return new HttpClient({ baseUrl: mockUrl, project, token: TOKEN, requestOptions });
}

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

describe('RequestOptions retry contract', () => {
  it('GET retries a 503 then succeeds (2 attempts)', async () => {
    await arm(ADDRESSES_ENDPOINT_ID, { status: 503, response: { errors: [{ code: 'X' }] } });
    const client = makeClient();
    const result = await client.get(ADDRESSES_PATH, undefined, {
      retries: 1,
      retryBackoff: 0,
    });
    expect(result).not.toBeNull();
    expect(await attempts('GET', ADDRESSES_PATH)).toBe(2);
  });

  it('does not retry by default — raises on the first failure', async () => {
    await arm(ADDRESSES_ENDPOINT_ID, { status: 503, response: { errors: [{ code: 'X' }] } });
    const client = makeClient();
    await expect(client.get(ADDRESSES_PATH)).rejects.toMatchObject({ statusCode: 503 });
    expect(await attempts('GET', ADDRESSES_PATH)).toBe(1);
  });

  it('retries exhausted — raises the last error (2 attempts)', async () => {
    await arm(ADDRESSES_ENDPOINT_ID, { status: 503, response: { errors: [{ code: 'X' }] } });
    await arm(ADDRESSES_ENDPOINT_ID, { status: 503, response: { errors: [{ code: 'X' }] } });
    const client = makeClient();
    await expect(
      client.get(ADDRESSES_PATH, undefined, { retries: 1, retryBackoff: 0 }),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(await attempts('GET', ADDRESSES_PATH)).toBe(2);
  });
});

describe('RequestOptions idempotency asymmetry', () => {
  it('POST does not retry a 500 (side-effect safety) — 1 attempt', async () => {
    await arm(CREATE_ADDRESS_ENDPOINT_ID, { status: 500, response: { error: 'x' } });
    const client = makeClient();
    await expect(
      client.post(CREATE_ADDRESS_PATH, { label: 'x' }, undefined, {
        retries: 2,
        retryBackoff: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(await attempts('POST', CREATE_ADDRESS_PATH)).toBe(1);
  });

  it('POST retries a 503 throttle (safe) — 2 attempts', async () => {
    await arm(CREATE_ADDRESS_ENDPOINT_ID, { status: 503, response: { error: 'x' } });
    const client = makeClient();
    await client.post(CREATE_ADDRESS_PATH, { label: 'x' }, undefined, {
      retries: 1,
      retryBackoff: 0,
    });
    expect(await attempts('POST', CREATE_ADDRESS_PATH)).toBe(2);
  });
});

describe('RequestOptions timeout', () => {
  it('a slow response exceeding the timeout raises the transport error', async () => {
    await arm(ADDRESSES_ENDPOINT_ID, {
      status: 200,
      response: { data: [], links: {} },
      delay_ms: 400,
    });
    const client = makeClient();
    await expect(client.get(ADDRESSES_PATH, undefined, { timeout: 0.1 })).rejects.toBeInstanceOf(
      RestTransportError,
    );
  });
});

describe('RequestOptions abortSignal', () => {
  it('an already-aborted signal raises before the request goes out', async () => {
    const client = makeClient();
    const controller = new AbortController();
    controller.abort();
    await expect(
      client.get(ADDRESSES_PATH, undefined, { abortSignal: controller.signal }),
    ).rejects.toBeInstanceOf(RestTransportError);
    // Nothing reached the mock — cancelled before the send.
    expect(await attempts('GET', ADDRESSES_PATH)).toBe(0);
  });

  it('aborting mid-flight interrupts an in-progress request (true in-flight abort)', async () => {
    // A 400ms-delayed 200; abort after 50ms => the in-flight fetch is cut,
    // surfacing the transport error. Proves TS passes abortSignal to fetch.
    await arm(ADDRESSES_ENDPOINT_ID, {
      status: 200,
      response: { data: [], links: {} },
      delay_ms: 400,
    });
    const client = makeClient();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    await expect(
      client.get(ADDRESSES_PATH, undefined, { abortSignal: controller.signal }),
    ).rejects.toBeInstanceOf(RestTransportError);
  });
});

describe('RequestOptions per-request override', () => {
  it('per-request retries override the client default', async () => {
    await arm(ADDRESSES_ENDPOINT_ID, { status: 503, response: { errors: [{ code: 'X' }] } });
    // Client default = no retries; per-request opts in to 1 retry.
    const client = makeClient({ retries: 0 });
    const result = await client.get(ADDRESSES_PATH, undefined, {
      retries: 1,
      retryBackoff: 0,
    });
    expect(result).not.toBeNull();
    expect(await attempts('GET', ADDRESSES_PATH)).toBe(2);
  });

  it('a typed RestError is raised (not a bare error) on an un-retried failure', async () => {
    await arm(ADDRESSES_ENDPOINT_ID, { status: 404, response: { errors: [{ code: 'X' }] } });
    const client = makeClient();
    await expect(client.get(ADDRESSES_PATH)).rejects.toBeInstanceOf(RestError);
  });
});

afterAll(() => {
  // The shared mock server is owned by mocktest's process-level lifecycle
  // (registerChildCleanup); nothing suite-local to tear down.
});
