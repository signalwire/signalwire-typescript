/**
 * Full REST success + error coverage for the SMALL spec groups:
 * project, voice, fax, message, calling, chat, pubsub, logs.
 *
 * Mirrors the proven python/java suites and the canonical
 * tests/rest/fabric_coverage_mock.test.ts style: every coverable canonical
 * route in these groups (14 of 14 — ZERO gaps, matching python/java) gets
 * BOTH a success (2xx) test and an error (4xx/5xx) test, asserting method,
 * path, matched_route, and (for errors) response_status against the mock
 * journal.
 *
 * Routes covered (14):
 *   project.create_token         POST   /api/project/tokens
 *   project.update_token         PATCH  /api/project/tokens/{token_id}
 *   project.delete_token         DELETE /api/project/tokens/{token_id}
 *   voice.list_voice_logs        GET    /api/voice/logs
 *   voice.get_voice_log          GET    /api/voice/logs/{id}
 *   voice.list_voice_log_events  GET    /api/voice/logs/{id}/events
 *   fax.list_fax_logs            GET    /api/fax/logs
 *   fax.get_fax_log              GET    /api/fax/logs/{id}
 *   message.list_message_logs    GET    /api/messaging/logs
 *   message.get_message_log      GET    /api/messaging/logs/{id}
 *   logs.list_conferences        GET    /api/logs/conferences
 *   calling.call-commands        POST   /api/calling/calls (dial command)
 *   chat.create_chat_token       POST   /api/chat/tokens
 *   pubsub.create_token          POST   /api/pubsub/tokens
 *
 * Companion to tests/rest/logs_mock.test.ts and calling_mock.test.ts (idiom);
 * self-contained.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { newMockClient } from './mocktest.js';
import type { RestClient } from '../../src/rest/index.js';
import type { JournalEntry, MockHarness } from './mocktest.js';
import { RestError } from '../../src/rest/RestError.js';

let client: RestClient;
let mock: MockHarness;

beforeEach(async () => {
  ({ client, mock } = await newMockClient());
});

// ---- DRY helpers -------------------------------------------------------
//
// Each helper RETURNS the journal entry (or response) so the calling `it()`
// body holds its own real assertions — the no-cheat auditor is intra-function.

async function callOk<T>(fn: () => Promise<T>): Promise<{ body: T; last: JournalEntry }> {
  const body = await fn();
  const last = await mock.last();
  return { body, last };
}

async function callErr(
  endpointId: string,
  status: number,
  fn: () => Promise<unknown>,
): Promise<JournalEntry> {
  await mock.pushScenario(endpointId, status, { error: 'x' });
  await expect(fn()).rejects.toThrow(RestError);
  return mock.last();
}

// ---- Project Tokens — /api/project/tokens ------------------------------

describe('Project Tokens', () => {
  it('create success', async () => {
    const { last } = await callOk(() =>
      client.project.tokens.create('tok', ['messaging']),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/project/tokens');
    expect(last.matched_route).toBe('project.create_token');
  });
  it('create error 422', async () => {
    const last = await callErr('project.create_token', 422, () =>
      client.project.tokens.create('tok', ['messaging']),
    );
    expect(last.matched_route).toBe('project.create_token');
    expect(last.response_status).toBe(422);
  });

  it('update success (PATCH)', async () => {
    const { last } = await callOk(() => client.project.tokens.update('tok-1', 'renamed'));
    expect(last.method).toBe('PATCH');
    expect(last.path).toBe('/api/project/tokens/tok-1');
    expect(last.matched_route).toBe('project.update_token');
  });
  it('update error 404', async () => {
    const last = await callErr('project.update_token', 404, () =>
      client.project.tokens.update('missing', 'renamed'),
    );
    expect(last.matched_route).toBe('project.update_token');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.project.tokens.delete('tok-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/project/tokens/tok-1');
    expect(last.matched_route).toBe('project.delete_token');
  });
  it('delete error 404', async () => {
    const last = await callErr('project.delete_token', 404, () =>
      client.project.tokens.delete('missing'),
    );
    expect(last.matched_route).toBe('project.delete_token');
    expect(last.response_status).toBe(404);
  });
});

// ---- Voice Logs — /api/voice/logs --------------------------------------

describe('Voice Logs', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.logs.voice.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/voice/logs');
    expect(last.matched_route).toBe('voice.list_voice_logs');
  });
  it('list error 500', async () => {
    const last = await callErr('voice.list_voice_logs', 500, () => client.logs.voice.list());
    expect(last.matched_route).toBe('voice.list_voice_logs');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.logs.voice.get('vl-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/voice/logs/vl-1');
    expect(last.matched_route).toBe('voice.get_voice_log');
  });
  it('get error 404', async () => {
    const last = await callErr('voice.get_voice_log', 404, () => client.logs.voice.get('missing'));
    expect(last.matched_route).toBe('voice.get_voice_log');
    expect(last.response_status).toBe(404);
  });

  it('list events success', async () => {
    const { body, last } = await callOk(() => client.logs.voice.listEvents('vl-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/voice/logs/vl-1/events');
    expect(last.matched_route).toBe('voice.list_voice_log_events');
  });
  it('list events error 500', async () => {
    const last = await callErr('voice.list_voice_log_events', 500, () =>
      client.logs.voice.listEvents('vl-1'),
    );
    expect(last.matched_route).toBe('voice.list_voice_log_events');
    expect(last.response_status).toBe(500);
  });
});

// ---- Fax Logs — /api/fax/logs ------------------------------------------

describe('Fax Logs', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.logs.fax.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fax/logs');
    expect(last.matched_route).toBe('fax.list_fax_logs');
  });
  it('list error 500', async () => {
    const last = await callErr('fax.list_fax_logs', 500, () => client.logs.fax.list());
    expect(last.matched_route).toBe('fax.list_fax_logs');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.logs.fax.get('fl-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/fax/logs/fl-1');
    expect(last.matched_route).toBe('fax.get_fax_log');
  });
  it('get error 404', async () => {
    const last = await callErr('fax.get_fax_log', 404, () => client.logs.fax.get('missing'));
    expect(last.matched_route).toBe('fax.get_fax_log');
    expect(last.response_status).toBe(404);
  });
});

// ---- Message Logs — /api/messaging/logs --------------------------------

describe('Message Logs', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.logs.messages.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/messaging/logs');
    expect(last.matched_route).toBe('message.list_message_logs');
  });
  it('list error 500', async () => {
    const last = await callErr('message.list_message_logs', 500, () => client.logs.messages.list());
    expect(last.matched_route).toBe('message.list_message_logs');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.logs.messages.get('ml-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/messaging/logs/ml-1');
    expect(last.matched_route).toBe('message.get_message_log');
  });
  it('get error 404', async () => {
    const last = await callErr('message.get_message_log', 404, () =>
      client.logs.messages.get('missing'),
    );
    expect(last.matched_route).toBe('message.get_message_log');
    expect(last.response_status).toBe(404);
  });
});

// ---- Conference Logs — /api/logs/conferences ---------------------------

describe('Conference Logs', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.logs.conferences.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/logs/conferences');
    expect(last.matched_route).toBe('logs.list_conferences');
  });
  it('list error 500', async () => {
    const last = await callErr('logs.list_conferences', 500, () => client.logs.conferences.list());
    expect(last.matched_route).toBe('logs.list_conferences');
    expect(last.response_status).toBe(500);
  });
});

// ---- Calling dial — POST /api/calling/calls ----------------------------

describe('Calling dial', () => {
  it('dial success', async () => {
    const { body, last } = await callOk(() =>
      client.calling.dial('+15551112222', '+15553334444'),
    );
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/calling/calls');
    expect(last.matched_route).toBe('calling.call-commands');
    const sent = last.body as Record<string, unknown>;
    expect(sent.command).toBe('dial');
    expect('id' in sent).toBe(false);
  });
  it('dial error 422', async () => {
    const last = await callErr('calling.call-commands', 422, () =>
      client.calling.dial('+15551112222', '+15553334444'),
    );
    expect(last.matched_route).toBe('calling.call-commands');
    expect(last.response_status).toBe(422);
  });
});

// ---- Chat token — POST /api/chat/tokens --------------------------------

describe('Chat Token', () => {
  it('create token success', async () => {
    const { body, last } = await callOk(() =>
      client.chat.createToken(60, { room1: { read: true } }),
    );
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/chat/tokens');
    expect(last.matched_route).toBe('chat.create_chat_token');
  });
  it('create token error 422', async () => {
    const last = await callErr('chat.create_chat_token', 422, () =>
      client.chat.createToken(60, { room1: { read: true } }),
    );
    expect(last.matched_route).toBe('chat.create_chat_token');
    expect(last.response_status).toBe(422);
  });
});

// ---- PubSub token — POST /api/pubsub/tokens ----------------------------

describe('PubSub Token', () => {
  it('create token success', async () => {
    const { body, last } = await callOk(() =>
      client.pubsub.createToken(60, { ch1: { read: true } }),
    );
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/pubsub/tokens');
    expect(last.matched_route).toBe('pubsub.create_token');
  });
  it('create token error 422', async () => {
    const last = await callErr('pubsub.create_token', 422, () =>
      client.pubsub.createToken(60, { ch1: { read: true } }),
    );
    expect(last.matched_route).toBe('pubsub.create_token');
    expect(last.response_status).toBe(422);
  });
});
