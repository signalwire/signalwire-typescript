/**
 * Mock-backed unit tests translated from
 * signalwire-python/tests/unit/rest/test_video_mock.py.
 *
 * Closes Video coverage gaps: room sessions, room recordings, conference
 * tokens, conference streams, and individual stream lifecycle.
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

// ---- Rooms — streams sub-resource --------------------------------------

describe('VideoRooms streams', () => {
  it('list_streams_returns_data_collection', async () => {
    const body = await client.video.rooms.listStreams('room-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/rooms/room-1/streams');
    expect(last.matched_route).not.toBeNull();
  });

  it('create_stream_posts_kwargs_in_body', async () => {
    const body = await client.video.rooms.createStream('room-1', {
      url: 'rtmp://example.com/live',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/video/rooms/room-1/streams');
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect(last.body.url).toBe('rtmp://example.com/live');
  });
});

// ---- Room Sessions -----------------------------------------------------

describe('VideoRoomSessions', () => {
  it('list_returns_data_collection', async () => {
    const body = await client.video.roomSessions.list();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_sessions');
  });

  it('get_returns_session_object', async () => {
    const body = await client.video.roomSessions.get('sess-abc');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_sessions/sess-abc');
    expect(last.matched_route).not.toBeNull();
  });

  it('list_events_uses_events_subpath', async () => {
    const body = await client.video.roomSessions.listEvents('sess-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_sessions/sess-1/events');
  });

  it('list_recordings_uses_recordings_subpath', async () => {
    const body = await client.video.roomSessions.listRecordings('sess-2');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_sessions/sess-2/recordings');
  });
});

// ---- Room Recordings (top-level) ---------------------------------------

describe('VideoRoomRecordings', () => {
  it('list_returns_data_collection', async () => {
    const body = await client.video.roomRecordings.list();
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_recordings');
  });

  it('get_returns_single_recording', async () => {
    const body = await client.video.roomRecordings.get('rec-xyz');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_recordings/rec-xyz');
  });

  it('delete_returns_empty_dict_for_204', async () => {
    const body = await client.video.roomRecordings.delete('rec-del');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/video/room_recordings/rec-del');
    expect(last.matched_route).not.toBeNull();
  });

  it('list_events_uses_events_subpath', async () => {
    const body = await client.video.roomRecordings.listEvents('rec-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/room_recordings/rec-1/events');
  });
});

// ---- Conferences sub-collections ---------------------------------------

describe('VideoConferences sub-collections', () => {
  it('list_conference_tokens', async () => {
    const body = await client.video.conferences.listConferenceTokens('conf-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/conferences/conf-1/conference_tokens');
  });

  it('list_streams', async () => {
    const body = await client.video.conferences.listStreams('conf-2');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();
    expect('data' in body).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/conferences/conf-2/streams');
  });
});

// ---- Conference Tokens (top-level) -------------------------------------

describe('VideoConferenceTokens', () => {
  it('get_returns_single_token', async () => {
    const body = await client.video.conferenceTokens.get('tok-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/conference_tokens/tok-1');
    expect(last.matched_route).not.toBeNull();
  });

  it('reset_posts_to_reset_subpath', async () => {
    const body = await client.video.conferenceTokens.reset('tok-2');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.path).toBe('/api/video/conference_tokens/tok-2/reset');
    // reset is a no-body POST — body should be null or empty.
    const empty =
      last.body === null ||
      last.body === '' ||
      (typeof last.body === 'object' && Object.keys(last.body).length === 0);
    expect(empty).toBe(true);
  });
});

// ---- Streams (top-level) -----------------------------------------------

describe('VideoStreams', () => {
  it('get_returns_stream_resource', async () => {
    const body = await client.video.streams.get('stream-1');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.path).toBe('/api/video/streams/stream-1');
  });

  it('update_uses_put_with_kwargs', async () => {
    const body = await client.video.streams.update('stream-2', {
      url: 'rtmp://example.com/new',
    });
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.path).toBe('/api/video/streams/stream-2');
    expect(typeof last.body).toBe('object');
    expect(last.body).not.toBeNull();
    expect(last.body.url).toBe('rtmp://example.com/new');
  });

  it('delete', async () => {
    const body = await client.video.streams.delete('stream-3');
    expect(typeof body).toBe('object');
    expect(body).not.toBeNull();

    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.path).toBe('/api/video/streams/stream-3');
    expect(last.matched_route).not.toBeNull();
  });
});
