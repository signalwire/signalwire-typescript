/**
 * Video API namespace — rooms, sessions, recordings, conferences, tokens, streams.
 *
 * The resource classes are generated from the video OpenAPI spec
 * (`video.resources.generated.ts`); this file keeps only the `VideoNamespace`
 * container that composes them onto `client.video.*`.
 */

import type { HttpClient } from '../HttpClient.js';
import {
  VideoConferences,
  VideoConferenceTokens,
  VideoRoomRecordings,
  VideoRooms,
  VideoRoomSessions,
  VideoRoomTokens,
  VideoStreams,
} from './video.resources.generated.js';

export {
  VideoConferences,
  VideoConferenceTokens,
  VideoRoomRecordings,
  VideoRooms,
  VideoRoomSessions,
  VideoRoomTokens,
  VideoStreams,
};

/**
 * The `client.video.*` namespace — video rooms, sessions, recordings,
 * conferences, tokens, and streams.
 *
 * @example
 * ```ts
 * const room = await client.video.rooms.create({ name: 'standup' });
 * const token = await client.video.roomTokens.create({ room_name: 'standup', user_name: 'Alice' });
 * ```
 */
export class VideoNamespace {
  /** Video room CRUD plus outbound stream management. */
  readonly rooms: VideoRooms;
  /** Issue JWT tokens for browser / mobile clients to join rooms. */
  readonly roomTokens: VideoRoomTokens;
  /** Past and active room session read access. */
  readonly roomSessions: VideoRoomSessions;
  /** Room recording read, delete, and event-log access. */
  readonly roomRecordings: VideoRoomRecordings;
  /** Video conference CRUD plus stream / token management. */
  readonly conferences: VideoConferences;
  /** Individual conference token read / reset operations. */
  readonly conferenceTokens: VideoConferenceTokens;
  /** Individual video stream read / update / delete operations. */
  readonly streams: VideoStreams;

  constructor(http: HttpClient) {
    this.rooms = new VideoRooms(http);
    this.roomTokens = new VideoRoomTokens(http);
    this.roomSessions = new VideoRoomSessions(http);
    this.roomRecordings = new VideoRoomRecordings(http);
    this.conferences = new VideoConferences(http);
    this.conferenceTokens = new VideoConferenceTokens(http);
    this.streams = new VideoStreams(http);
  }
}
