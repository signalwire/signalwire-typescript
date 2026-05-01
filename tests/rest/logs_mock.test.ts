/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_logs_mock.py.
 *
 * Closes Logs coverage: the four sub-resources (messages, voice, fax,
 * conferences) each at /api/{messaging,voice,fax,logs}/...
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { MockHarness } from './mocktest.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- Message Logs — /api/messaging/logs --------------------------------

describe('MessageLogs', () => {
  it('list_returns_dict', async () => {
    const body = await client.logs.messages.list();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/messaging/logs');
    expect(last.matched_route).toBe('message.list_message_logs');
  });

  it('get_uses_id_in_path', async () => {
    const body = await client.logs.messages.get('ml-42');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/messaging/logs/ml-42');
    expect(last.matched_route).not.toBeNull();
  });
});

// ---- Voice Logs — /api/voice/logs --------------------------------------

describe('VoiceLogs', () => {
  it('list_returns_dict', async () => {
    const body = await client.logs.voice.list();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/voice/logs');
    expect(last.matched_route).toBe('voice.list_voice_logs');
  });

  it('get_uses_id_in_path', async () => {
    const body = await client.logs.voice.get('vl-99');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/voice/logs/vl-99');
  });
});

// ---- Fax Logs — /api/fax/logs ------------------------------------------

describe('FaxLogs', () => {
  it('list_returns_dict', async () => {
    const body = await client.logs.fax.list();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fax/logs');
    expect(last.matched_route).toBe('fax.list_fax_logs');
  });

  it('get_uses_id_in_path', async () => {
    const body = await client.logs.fax.get('fl-7');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fax/logs/fl-7');
  });
});

// ---- Conference Logs — /api/logs/conferences ---------------------------

describe('ConferenceLogs', () => {
  it('list_returns_dict', async () => {
    const body = await client.logs.conferences.list();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/logs/conferences');
    expect(last.matched_route).toBe('logs.list_conferences');
  });
});
