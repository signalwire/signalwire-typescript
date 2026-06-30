/**
 * AUTO-GENERATED REST wire tests for the `video` namespace — DO NOT EDIT.
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

describe('video wire (generated)', () => {
  it('conferences_create success', async () => {
    await client.video.conferences.create({});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('video.create_video_conference');
  });

  it('conferences_create error', async () => {
    await mock.pushScenario('video.create_video_conference', 500, { error: 'x' });
    await expect(client.video.conferences.create({})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferences_createStream success', async () => {
    await client.video.conferences.createStream('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('video.create_conference_stream');
  });

  it('conferences_createStream error', async () => {
    await mock.pushScenario('video.create_conference_stream', 500, { error: 'x' });
    await expect(client.video.conferences.createStream('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferences_delete success', async () => {
    await client.video.conferences.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('video.delete_video_conference');
  });

  it('conferences_delete error', async () => {
    await mock.pushScenario('video.delete_video_conference', 500, { error: 'x' });
    await expect(client.video.conferences.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferences_get success', async () => {
    await client.video.conferences.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.get_video_conference');
  });

  it('conferences_get error', async () => {
    await mock.pushScenario('video.get_video_conference', 500, { error: 'x' });
    await expect(client.video.conferences.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferences_listConferenceTokens success', async () => {
    await client.video.conferences.listConferenceTokens('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_conference_tokens');
  });

  it('conferences_listConferenceTokens error', async () => {
    await mock.pushScenario('video.list_conference_tokens', 500, { error: 'x' });
    await expect(client.video.conferences.listConferenceTokens('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferences_list success', async () => {
    await client.video.conferences.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_video_conferences');
  });

  it('conferences_list error', async () => {
    await mock.pushScenario('video.list_video_conferences', 500, { error: 'x' });
    await expect(client.video.conferences.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferences_listStreams success', async () => {
    await client.video.conferences.listStreams('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_conference_streams');
  });

  it('conferences_listStreams error', async () => {
    await mock.pushScenario('video.list_conference_streams', 500, { error: 'x' });
    await expect(client.video.conferences.listStreams('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferences_update success', async () => {
    await client.video.conferences.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('video.update_video_conference');
  });

  it('conferences_update error', async () => {
    await mock.pushScenario('video.update_video_conference', 500, { error: 'x' });
    await expect(client.video.conferences.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferenceTokens_get success', async () => {
    await client.video.conferenceTokens.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.get_conference_token');
  });

  it('conferenceTokens_get error', async () => {
    await mock.pushScenario('video.get_conference_token', 500, { error: 'x' });
    await expect(client.video.conferenceTokens.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('conferenceTokens_reset success', async () => {
    await client.video.conferenceTokens.reset('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('video.reset_conference_token');
  });

  it('conferenceTokens_reset error', async () => {
    await mock.pushScenario('video.reset_conference_token', 500, { error: 'x' });
    await expect(client.video.conferenceTokens.reset('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomRecordings_delete success', async () => {
    await client.video.roomRecordings.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('video.delete_room_recording');
  });

  it('roomRecordings_delete error', async () => {
    await mock.pushScenario('video.delete_room_recording', 500, { error: 'x' });
    await expect(client.video.roomRecordings.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomRecordings_get success', async () => {
    await client.video.roomRecordings.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.get_room_recording');
  });

  it('roomRecordings_get error', async () => {
    await mock.pushScenario('video.get_room_recording', 500, { error: 'x' });
    await expect(client.video.roomRecordings.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomRecordings_listEvents success', async () => {
    await client.video.roomRecordings.listEvents('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_room_recording_events');
  });

  it('roomRecordings_listEvents error', async () => {
    await mock.pushScenario('video.list_room_recording_events', 500, { error: 'x' });
    await expect(client.video.roomRecordings.listEvents('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomRecordings_list success', async () => {
    await client.video.roomRecordings.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_room_recordings');
  });

  it('roomRecordings_list error', async () => {
    await mock.pushScenario('video.list_room_recordings', 500, { error: 'x' });
    await expect(client.video.roomRecordings.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('rooms_create success', async () => {
    await client.video.rooms.create({});
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('video.create_room');
  });

  it('rooms_create error', async () => {
    await mock.pushScenario('video.create_room', 500, { error: 'x' });
    await expect(client.video.rooms.create({})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('rooms_createStream success', async () => {
    await client.video.rooms.createStream('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('video.create_room_stream');
  });

  it('rooms_createStream error', async () => {
    await mock.pushScenario('video.create_room_stream', 500, { error: 'x' });
    await expect(client.video.rooms.createStream('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('rooms_delete success', async () => {
    await client.video.rooms.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('video.delete_room');
  });

  it('rooms_delete error', async () => {
    await mock.pushScenario('video.delete_room', 500, { error: 'x' });
    await expect(client.video.rooms.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('rooms_get success', async () => {
    await client.video.rooms.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.get_room_by_name');
  });

  it('rooms_get error', async () => {
    await mock.pushScenario('video.get_room_by_name', 500, { error: 'x' });
    await expect(client.video.rooms.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('rooms_list success', async () => {
    await client.video.rooms.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_rooms');
  });

  it('rooms_list error', async () => {
    await mock.pushScenario('video.list_rooms', 500, { error: 'x' });
    await expect(client.video.rooms.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('rooms_listStreams success', async () => {
    await client.video.rooms.listStreams('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_room_streams');
  });

  it('rooms_listStreams error', async () => {
    await mock.pushScenario('video.list_room_streams', 500, { error: 'x' });
    await expect(client.video.rooms.listStreams('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('rooms_update success', async () => {
    await client.video.rooms.update('x', {});
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('video.update_room');
  });

  it('rooms_update error', async () => {
    await mock.pushScenario('video.update_room', 500, { error: 'x' });
    await expect(client.video.rooms.update('x', {})).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomSessions_get success', async () => {
    await client.video.roomSessions.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.get_room_session');
  });

  it('roomSessions_get error', async () => {
    await mock.pushScenario('video.get_room_session', 500, { error: 'x' });
    await expect(client.video.roomSessions.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomSessions_listEvents success', async () => {
    await client.video.roomSessions.listEvents('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_room_session_events');
  });

  it('roomSessions_listEvents error', async () => {
    await mock.pushScenario('video.list_room_session_events', 500, { error: 'x' });
    await expect(client.video.roomSessions.listEvents('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomSessions_list success', async () => {
    await client.video.roomSessions.list();
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_room_sessions');
  });

  it('roomSessions_list error', async () => {
    await mock.pushScenario('video.list_room_sessions', 500, { error: 'x' });
    await expect(client.video.roomSessions.list()).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomSessions_listMembers success', async () => {
    await client.video.roomSessions.listMembers('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_room_session_members');
  });

  it('roomSessions_listMembers error', async () => {
    await mock.pushScenario('video.list_room_session_members', 500, { error: 'x' });
    await expect(client.video.roomSessions.listMembers('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomSessions_listRecordings success', async () => {
    await client.video.roomSessions.listRecordings('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.list_room_session_recordings');
  });

  it('roomSessions_listRecordings error', async () => {
    await mock.pushScenario('video.list_room_session_recordings', 500, { error: 'x' });
    await expect(client.video.roomSessions.listRecordings('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('roomTokens_create success', async () => {
    await client.video.roomTokens.create('x');
    const last = await mock.last();
    expect(last.method).toBe('POST');
    expect(last.matched_route).toBe('video.create_room_token');
  });

  it('roomTokens_create error', async () => {
    await mock.pushScenario('video.create_room_token', 500, { error: 'x' });
    await expect(client.video.roomTokens.create('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('streams_delete success', async () => {
    await client.video.streams.delete('x');
    const last = await mock.last();
    expect(last.method).toBe('DELETE');
    expect(last.matched_route).toBe('video.delete_stream');
  });

  it('streams_delete error', async () => {
    await mock.pushScenario('video.delete_stream', 500, { error: 'x' });
    await expect(client.video.streams.delete('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('streams_get success', async () => {
    await client.video.streams.get('x');
    const last = await mock.last();
    expect(last.method).toBe('GET');
    expect(last.matched_route).toBe('video.get_stream');
  });

  it('streams_get error', async () => {
    await mock.pushScenario('video.get_stream', 500, { error: 'x' });
    await expect(client.video.streams.get('x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });

  it('streams_update success', async () => {
    await client.video.streams.update('x', 'x');
    const last = await mock.last();
    expect(last.method).toBe('PUT');
    expect(last.matched_route).toBe('video.update_stream');
  });

  it('streams_update error', async () => {
    await mock.pushScenario('video.update_stream', 500, { error: 'x' });
    await expect(client.video.streams.update('x', 'x')).rejects.toThrow(RestError);
    const last = await mock.last();
    expect(last.response_status).toBe(500);
  });
});
