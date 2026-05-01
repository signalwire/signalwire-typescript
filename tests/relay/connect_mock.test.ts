/**
 * Real-mock-backed tests for `RelayClient.connect()`.
 *
 * Translated 1:1 from
 *   signalwire-python/tests/unit/relay/test_connect_mock.py
 *
 * These tests boot the shared `mock_relay` WebSocket server and drive the
 * actual TypeScript `RelayClient`. No `vi.mock`, no nock, no msw — every
 * frame goes over a real WebSocket. Each test asserts both:
 *
 *   1. **Behavioral** — what the SDK exposed back to the developer.
 *   2. **Wire** — what the mock journaled (the schemas come from the
 *      production C# server, so journal-shape assertions confirm we send
 *      what the real RELAY expects).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RelayClient } from '../../src/relay/RelayClient.js';
import {
  AGENT_STRING,
  METHOD_SIGNALWIRE_CONNECT,
  PROTOCOL_VERSION,
} from '../../src/relay/constants.js';
import { getMockRelay, newRelayClient, type MockRelayHarness } from './mocktest.js';

let client: RelayClient | null = null;
let mock: MockRelayHarness;

beforeEach(async () => {
  mock = await getMockRelay();
  await mock.reset();
  // Ensure a high enough connection cap for tests that build multiple clients.
  process.env.RELAY_MAX_CONNECTIONS = '16';
});

afterEach(async () => {
  if (client) {
    try { await client.disconnect(); } catch { /* ignore */ }
    client = null;
  }
});

// ---------------------------------------------------------------------------
// Connect — happy path
// ---------------------------------------------------------------------------

describe('RelayClient.connect — happy path', () => {
  it('test_connect_returns_protocol_string', async () => {
    const r = await newRelayClient();
    client = r.client;
    expect(client.relayProtocol.startsWith('signalwire_')).toBe(true);
  });

  it('test_connect_journal_records_signalwire_connect', async () => {
    const r = await newRelayClient();
    client = r.client;
    const j = await mock.journalRecv(METHOD_SIGNALWIRE_CONNECT);
    expect(j.length).toBe(1);
  });

  it('test_connect_journal_carries_project_and_token', async () => {
    const r = await newRelayClient();
    client = r.client;
    const [entry] = await mock.journalRecv(METHOD_SIGNALWIRE_CONNECT);
    const auth = entry!.frame.params.authentication;
    expect(auth.project).toBe('test_proj');
    expect(auth.token).toBe('test_tok');
  });

  it('test_connect_journal_carries_contexts', async () => {
    const r = await newRelayClient();
    client = r.client;
    const [entry] = await mock.journalRecv(METHOD_SIGNALWIRE_CONNECT);
    expect(entry!.frame.params.contexts).toEqual(['default']);
  });

  it('test_connect_journal_carries_agent_and_version', async () => {
    const r = await newRelayClient();
    client = r.client;
    const [entry] = await mock.journalRecv(METHOD_SIGNALWIRE_CONNECT);
    const p = entry!.frame.params;
    expect(p.agent).toBe(AGENT_STRING);
    // PROTOCOL_VERSION is an object {major, minor, revision} in TS;
    // the Python const is the same object, so the wire shape matches.
    expect(p.version).toEqual(PROTOCOL_VERSION);
  });

  it('test_connect_journal_event_acks_true', async () => {
    const r = await newRelayClient();
    client = r.client;
    const [entry] = await mock.journalRecv(METHOD_SIGNALWIRE_CONNECT);
    expect(entry!.frame.params.event_acks).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reconnect with protocol → session_restored
// ---------------------------------------------------------------------------

describe('RelayClient.connect — reconnect with protocol', () => {
  it('test_reconnect_with_protocol_string_includes_protocol_in_frame', async () => {
    // First connect — observe the protocol string the server issued.
    const c1 = new RelayClient({
      project: 'p',
      token: 't',
      host: mock.relayHost,
      scheme: 'ws',
      contexts: ['c1'],
    });
    await c1.connect();
    const issued = c1.relayProtocol;
    await c1.disconnect();

    // Second connect — pre-set the protocol string and verify it travels
    // on the wire.
    const c2 = new RelayClient({
      project: 'p',
      token: 't',
      host: mock.relayHost,
      scheme: 'ws',
      contexts: ['c1'],
    });
    // Emulate the Python `client._relay_protocol = issued` resume path.
    (c2 as any)._relayProtocol = issued;
    await c2.connect();
    await c2.disconnect();

    const connects = await mock.journalRecv(METHOD_SIGNALWIRE_CONNECT);
    const resumed = connects.filter((e) => e.frame?.params?.protocol === issued);
    expect(resumed.length).toBeGreaterThan(0);
  });

  it('test_reconnect_with_protocol_preserves_protocol_value', async () => {
    const c1 = new RelayClient({
      project: 'p',
      token: 't',
      host: mock.relayHost,
      scheme: 'ws',
    });
    await c1.connect();
    const issued = c1.relayProtocol;
    await c1.disconnect();

    const c2 = new RelayClient({
      project: 'p',
      token: 't',
      host: mock.relayHost,
      scheme: 'ws',
    });
    (c2 as any)._relayProtocol = issued;
    await c2.connect();
    expect(c2.relayProtocol).toBe(issued);
    await c2.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Auth failure paths
// ---------------------------------------------------------------------------

describe('RelayClient.connect — auth failure', () => {
  it('test_connect_rejects_empty_creds_at_constructor', () => {
    const origProject = process.env.SIGNALWIRE_PROJECT_ID;
    const origToken = process.env.SIGNALWIRE_API_TOKEN;
    const origJwt = process.env.SIGNALWIRE_JWT_TOKEN;
    delete process.env.SIGNALWIRE_PROJECT_ID;
    delete process.env.SIGNALWIRE_API_TOKEN;
    delete process.env.SIGNALWIRE_JWT_TOKEN;
    try {
      expect(() => new RelayClient({
        project: '',
        token: '',
        host: 'anywhere',
      })).toThrow(/project and token are required/);
    } finally {
      if (origProject !== undefined) process.env.SIGNALWIRE_PROJECT_ID = origProject;
      if (origToken !== undefined) process.env.SIGNALWIRE_API_TOKEN = origToken;
      if (origJwt !== undefined) process.env.SIGNALWIRE_JWT_TOKEN = origJwt;
    }
  });

  it('test_unauthenticated_raw_connect_rejected_by_mock', async () => {
    // Drive the mock directly with empty creds — the SDK won't construct
    // a client with empty creds, but we still want to prove the mock's
    // 401 path is reachable so a port whose SDK *does* allow empty creds
    // would fail loudly here.
    const wsModule: any = await import('ws');
    const WS = wsModule.default ?? wsModule;
    const sock = new WS(mock.wsUrl);
    await new Promise<void>((resolve, reject) => {
      sock.on('open', resolve);
      sock.on('error', reject);
    });
    const reqId = 'auth-fail-' + Math.random().toString(36).slice(2);
    const respPromise = new Promise<any>((resolve) => {
      sock.on('message', (data: any) => {
        const raw = typeof data === 'string' ? data : data.toString();
        resolve(JSON.parse(raw));
      });
    });
    sock.send(JSON.stringify({
      jsonrpc: '2.0',
      id: reqId,
      method: 'signalwire.connect',
      params: {
        version: PROTOCOL_VERSION,
        agent: AGENT_STRING,
        authentication: { project: '', token: '' },
      },
    }));
    const resp = await respPromise;
    sock.close();

    expect(resp.error).toBeDefined();
    expect(resp.error?.data?.signalwire_error_code).toBe('AUTH_REQUIRED');
  });
});

// ---------------------------------------------------------------------------
// Connect — JWT path
// ---------------------------------------------------------------------------

describe('RelayClient.connect — JWT', () => {
  it('test_connect_with_jwt_carries_jwt_on_wire', async () => {
    const c = new RelayClient({
      jwtToken: 'fake-jwt-eyJ.AaaA.BbB',
      host: mock.relayHost,
      scheme: 'ws',
    });
    await c.connect();
    await c.disconnect();

    const [entry] = await mock.journalRecv(METHOD_SIGNALWIRE_CONNECT);
    const auth = entry!.frame.params.authentication;
    expect(auth.jwt_token).toBe('fake-jwt-eyJ.AaaA.BbB');
    // JWT path doesn't include project/token.
    expect(auth.token == null || auth.token === '').toBe(true);
  });
});
