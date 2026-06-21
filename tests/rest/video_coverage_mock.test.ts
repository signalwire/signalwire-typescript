/**
 * Full REST success + error coverage for the `video` spec group.
 *
 * Mirrors the proven python/java suites: every coverable canonical video
 * route (30 of 33) gets BOTH a success (2xx) test and an error (4xx/5xx)
 * test, asserting method, path, matched_route, and (for errors)
 * response_status against the mock journal.
 *
 * Gaps (3, same as python/java — NOT faked):
 *   - video.list_logs / video.get_log (2) — no video logs accessor on the
 *     TS SDK surface (client.video has no `logs`).
 *   - video.get_room (1) — routing collision: GET /api/video/rooms/{id}
 *     is wire-identical to GET /api/video/rooms/{name}, and the mock always
 *     resolves GET /rooms/X to video.get_room_by_name, so video.get_room is
 *     unhittable. get_room_by_name IS covered (via rooms.get()).
 *
 * Companion to tests/rest/video_mock.test.ts (idiom); self-contained.
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

/**
 * Await an SDK call, then return its response body alongside the last journal
 * entry. The caller asserts on both.
 */
async function callOk<T>(fn: () => Promise<T>): Promise<{ body: T; last: JournalEntry }> {
  const body = await fn();
  const last = await mock.last();
  return { body, last };
}

/**
 * Arm a one-shot error scenario for `endpointId`, assert the SDK call rejects
 * with RestError, and return the recorded journal entry for body assertions.
 */
async function callErr(
  endpointId: string,
  status: number,
  fn: () => Promise<unknown>,
): Promise<JournalEntry> {
  await mock.pushScenario(endpointId, status, { error: 'x' });
  await expect(fn()).rejects.toThrow(RestError);
  return mock.last();
}

// ---- Rooms -------------------------------------------------------------

describe('Video Rooms', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.video.rooms.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/rooms');
    expect(last.matched_route).toBe('video.list_rooms');
  });
  it('list error 500', async () => {
    const last = await callErr('video.list_rooms', 500, () => client.video.rooms.list());
    expect(last.matched_route).toBe('video.list_rooms');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.video.rooms.create({ name: 'standup' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/video/rooms');
    expect(last.matched_route).toBe('video.create_room');
  });
  it('create error 422', async () => {
    const last = await callErr('video.create_room', 422, () => client.video.rooms.create({}));
    expect(last.matched_route).toBe('video.create_room');
    expect(last.response_status).toBe(422);
  });

  // GET /api/video/rooms/{id} collides with GET /api/video/rooms/{name};
  // the mock resolves it to video.get_room_by_name (video.get_room is an
  // unhittable routing-collision gap — see file header).
  it('get success (resolves to get_room_by_name)', async () => {
    const { last } = await callOk(() => client.video.rooms.get('room-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/rooms/room-1');
    expect(last.matched_route).toBe('video.get_room_by_name');
  });
  it('get error 404 (get_room_by_name)', async () => {
    const last = await callErr('video.get_room_by_name', 404, () =>
      client.video.rooms.get('missing'),
    );
    expect(last.matched_route).toBe('video.get_room_by_name');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.video.rooms.update('room-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/video/rooms/room-1');
    expect(last.matched_route).toBe('video.update_room');
  });
  it('update error 404', async () => {
    const last = await callErr('video.update_room', 404, () =>
      client.video.rooms.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('video.update_room');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.video.rooms.delete('room-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/video/rooms/room-1');
    expect(last.matched_route).toBe('video.delete_room');
  });
  it('delete error 404', async () => {
    const last = await callErr('video.delete_room', 404, () =>
      client.video.rooms.delete('missing'),
    );
    expect(last.matched_route).toBe('video.delete_room');
    expect(last.response_status).toBe(404);
  });

  it('list streams success', async () => {
    const { body, last } = await callOk(() => client.video.rooms.listStreams('room-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/rooms/room-1/streams');
    expect(last.matched_route).toBe('video.list_room_streams');
  });
  it('list streams error 500', async () => {
    const last = await callErr('video.list_room_streams', 500, () =>
      client.video.rooms.listStreams('room-1'),
    );
    expect(last.matched_route).toBe('video.list_room_streams');
    expect(last.response_status).toBe(500);
  });

  it('create stream success', async () => {
    const { last } = await callOk(() =>
      client.video.rooms.createStream('room-1', { url: 'rtmp://example.com/live' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/video/rooms/room-1/streams');
    expect(last.matched_route).toBe('video.create_room_stream');
  });
  it('create stream error 422', async () => {
    const last = await callErr('video.create_room_stream', 422, () =>
      client.video.rooms.createStream('room-1', { url: 'rtmp://example.com/live' }),
    );
    expect(last.matched_route).toBe('video.create_room_stream');
    expect(last.response_status).toBe(422);
  });
});

// ---- Room Tokens -------------------------------------------------------

describe('Video Room Tokens', () => {
  it('create success', async () => {
    const { last } = await callOk(() =>
      client.video.roomTokens.create({ room_name: 'standup', user_name: 'Alice' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/video/room_tokens');
    expect(last.matched_route).toBe('video.create_room_token');
  });
  it('create error 422', async () => {
    const last = await callErr('video.create_room_token', 422, () =>
      client.video.roomTokens.create({ room_name: 'standup' }),
    );
    expect(last.matched_route).toBe('video.create_room_token');
    expect(last.response_status).toBe(422);
  });
});

// ---- Room Sessions -----------------------------------------------------

describe('Video Room Sessions', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.video.roomSessions.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_sessions');
    expect(last.matched_route).toBe('video.list_room_sessions');
  });
  it('list error 500', async () => {
    const last = await callErr('video.list_room_sessions', 500, () =>
      client.video.roomSessions.list(),
    );
    expect(last.matched_route).toBe('video.list_room_sessions');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.video.roomSessions.get('sess-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_sessions/sess-1');
    expect(last.matched_route).toBe('video.get_room_session');
  });
  it('get error 404', async () => {
    const last = await callErr('video.get_room_session', 404, () =>
      client.video.roomSessions.get('missing'),
    );
    expect(last.matched_route).toBe('video.get_room_session');
    expect(last.response_status).toBe(404);
  });

  it('list events success', async () => {
    const { body, last } = await callOk(() => client.video.roomSessions.listEvents('sess-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_sessions/sess-1/events');
    expect(last.matched_route).toBe('video.list_room_session_events');
  });
  it('list events error 500', async () => {
    const last = await callErr('video.list_room_session_events', 500, () =>
      client.video.roomSessions.listEvents('sess-1'),
    );
    expect(last.matched_route).toBe('video.list_room_session_events');
    expect(last.response_status).toBe(500);
  });

  it('list members success', async () => {
    const { body, last } = await callOk(() => client.video.roomSessions.listMembers('sess-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_sessions/sess-1/members');
    expect(last.matched_route).toBe('video.list_room_session_members');
  });
  it('list members error 500', async () => {
    const last = await callErr('video.list_room_session_members', 500, () =>
      client.video.roomSessions.listMembers('sess-1'),
    );
    expect(last.matched_route).toBe('video.list_room_session_members');
    expect(last.response_status).toBe(500);
  });

  it('list recordings success', async () => {
    const { body, last } = await callOk(() => client.video.roomSessions.listRecordings('sess-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_sessions/sess-1/recordings');
    expect(last.matched_route).toBe('video.list_room_session_recordings');
  });
  it('list recordings error 500', async () => {
    const last = await callErr('video.list_room_session_recordings', 500, () =>
      client.video.roomSessions.listRecordings('sess-1'),
    );
    expect(last.matched_route).toBe('video.list_room_session_recordings');
    expect(last.response_status).toBe(500);
  });
});

// ---- Room Recordings (top-level) ---------------------------------------

describe('Video Room Recordings', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.video.roomRecordings.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_recordings');
    expect(last.matched_route).toBe('video.list_room_recordings');
  });
  it('list error 500', async () => {
    const last = await callErr('video.list_room_recordings', 500, () =>
      client.video.roomRecordings.list(),
    );
    expect(last.matched_route).toBe('video.list_room_recordings');
    expect(last.response_status).toBe(500);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.video.roomRecordings.get('rec-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_recordings/rec-1');
    expect(last.matched_route).toBe('video.get_room_recording');
  });
  it('get error 404', async () => {
    const last = await callErr('video.get_room_recording', 404, () =>
      client.video.roomRecordings.get('missing'),
    );
    expect(last.matched_route).toBe('video.get_room_recording');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.video.roomRecordings.delete('rec-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/video/room_recordings/rec-1');
    expect(last.matched_route).toBe('video.delete_room_recording');
  });
  it('delete error 404', async () => {
    const last = await callErr('video.delete_room_recording', 404, () =>
      client.video.roomRecordings.delete('missing'),
    );
    expect(last.matched_route).toBe('video.delete_room_recording');
    expect(last.response_status).toBe(404);
  });

  it('list events success', async () => {
    const { body, last } = await callOk(() => client.video.roomRecordings.listEvents('rec-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_recordings/rec-1/events');
    expect(last.matched_route).toBe('video.list_room_recording_events');
  });
  it('list events error 500', async () => {
    const last = await callErr('video.list_room_recording_events', 500, () =>
      client.video.roomRecordings.listEvents('rec-1'),
    );
    expect(last.matched_route).toBe('video.list_room_recording_events');
    expect(last.response_status).toBe(500);
  });
});

// ---- Conferences -------------------------------------------------------

describe('Video Conferences', () => {
  it('list success', async () => {
    const { body, last } = await callOk(() => client.video.conferences.list());
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/conferences');
    expect(last.matched_route).toBe('video.list_video_conferences');
  });
  it('list error 500', async () => {
    const last = await callErr('video.list_video_conferences', 500, () =>
      client.video.conferences.list(),
    );
    expect(last.matched_route).toBe('video.list_video_conferences');
    expect(last.response_status).toBe(500);
  });

  it('create success', async () => {
    const { last } = await callOk(() => client.video.conferences.create({ name: 'conf' }));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/video/conferences');
    expect(last.matched_route).toBe('video.create_video_conference');
  });
  it('create error 422', async () => {
    const last = await callErr('video.create_video_conference', 422, () =>
      client.video.conferences.create({}),
    );
    expect(last.matched_route).toBe('video.create_video_conference');
    expect(last.response_status).toBe(422);
  });

  it('get success', async () => {
    const { last } = await callOk(() => client.video.conferences.get('conf-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/conferences/conf-1');
    expect(last.matched_route).toBe('video.get_video_conference');
  });
  it('get error 404', async () => {
    const last = await callErr('video.get_video_conference', 404, () =>
      client.video.conferences.get('missing'),
    );
    expect(last.matched_route).toBe('video.get_video_conference');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() => client.video.conferences.update('conf-1', { name: 'x' }));
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/video/conferences/conf-1');
    expect(last.matched_route).toBe('video.update_video_conference');
  });
  it('update error 404', async () => {
    const last = await callErr('video.update_video_conference', 404, () =>
      client.video.conferences.update('missing', { name: 'x' }),
    );
    expect(last.matched_route).toBe('video.update_video_conference');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.video.conferences.delete('conf-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/video/conferences/conf-1');
    expect(last.matched_route).toBe('video.delete_video_conference');
  });
  it('delete error 404', async () => {
    const last = await callErr('video.delete_video_conference', 404, () =>
      client.video.conferences.delete('missing'),
    );
    expect(last.matched_route).toBe('video.delete_video_conference');
    expect(last.response_status).toBe(404);
  });

  it('list conference tokens success', async () => {
    const { body, last } = await callOk(() =>
      client.video.conferences.listConferenceTokens('conf-1'),
    );
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/conferences/conf-1/conference_tokens');
    expect(last.matched_route).toBe('video.list_conference_tokens');
  });
  it('list conference tokens error 500', async () => {
    const last = await callErr('video.list_conference_tokens', 500, () =>
      client.video.conferences.listConferenceTokens('conf-1'),
    );
    expect(last.matched_route).toBe('video.list_conference_tokens');
    expect(last.response_status).toBe(500);
  });

  it('list streams success', async () => {
    const { body, last } = await callOk(() => client.video.conferences.listStreams('conf-1'));
    expect(typeof body === 'object' && body !== null).toBe(true);
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/conferences/conf-1/streams');
    expect(last.matched_route).toBe('video.list_conference_streams');
  });
  it('list streams error 500', async () => {
    const last = await callErr('video.list_conference_streams', 500, () =>
      client.video.conferences.listStreams('conf-1'),
    );
    expect(last.matched_route).toBe('video.list_conference_streams');
    expect(last.response_status).toBe(500);
  });

  it('create stream success', async () => {
    const { last } = await callOk(() =>
      client.video.conferences.createStream('conf-1', { url: 'rtmp://example.com/live' }),
    );
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/video/conferences/conf-1/streams');
    expect(last.matched_route).toBe('video.create_conference_stream');
  });
  it('create stream error 422', async () => {
    const last = await callErr('video.create_conference_stream', 422, () =>
      client.video.conferences.createStream('conf-1', { url: 'rtmp://example.com/live' }),
    );
    expect(last.matched_route).toBe('video.create_conference_stream');
    expect(last.response_status).toBe(422);
  });
});

// ---- Conference Tokens (top-level) -------------------------------------

describe('Video Conference Tokens', () => {
  it('get success', async () => {
    const { last } = await callOk(() => client.video.conferenceTokens.get('tok-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/conference_tokens/tok-1');
    expect(last.matched_route).toBe('video.get_conference_token');
  });
  it('get error 404', async () => {
    const last = await callErr('video.get_conference_token', 404, () =>
      client.video.conferenceTokens.get('missing'),
    );
    expect(last.matched_route).toBe('video.get_conference_token');
    expect(last.response_status).toBe(404);
  });

  it('reset success', async () => {
    const { last } = await callOk(() => client.video.conferenceTokens.reset('tok-1'));
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/video/conference_tokens/tok-1/reset');
    expect(last.matched_route).toBe('video.reset_conference_token');
  });
  it('reset error 422', async () => {
    const last = await callErr('video.reset_conference_token', 422, () =>
      client.video.conferenceTokens.reset('tok-1'),
    );
    expect(last.matched_route).toBe('video.reset_conference_token');
    expect(last.response_status).toBe(422);
  });
});

// ---- Streams (top-level) -----------------------------------------------

describe('Video Streams', () => {
  it('get success', async () => {
    const { last } = await callOk(() => client.video.streams.get('stream-1'));
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/streams/stream-1');
    expect(last.matched_route).toBe('video.get_stream');
  });
  it('get error 404', async () => {
    const last = await callErr('video.get_stream', 404, () => client.video.streams.get('missing'));
    expect(last.matched_route).toBe('video.get_stream');
    expect(last.response_status).toBe(404);
  });

  it('update success (PUT)', async () => {
    const { last } = await callOk(() =>
      client.video.streams.update('stream-1', { url: 'rtmp://example.com/new' }),
    );
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/video/streams/stream-1');
    expect(last.matched_route).toBe('video.update_stream');
  });
  it('update error 404', async () => {
    const last = await callErr('video.update_stream', 404, () =>
      client.video.streams.update('missing', { url: 'rtmp://example.com/new' }),
    );
    expect(last.matched_route).toBe('video.update_stream');
    expect(last.response_status).toBe(404);
  });

  it('delete success', async () => {
    const { last } = await callOk(() => client.video.streams.delete('stream-1'));
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/video/streams/stream-1');
    expect(last.matched_route).toBe('video.delete_stream');
  });
  it('delete error 404', async () => {
    const last = await callErr('video.delete_stream', 404, () =>
      client.video.streams.delete('missing'),
    );
    expect(last.matched_route).toBe('video.delete_stream');
    expect(last.response_status).toBe(404);
  });
});
