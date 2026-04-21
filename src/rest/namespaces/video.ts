/**
 * Video API namespace — rooms, sessions, recordings, conferences, tokens, streams.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { CrudResource } from '../base/CrudResource.js';

/** Video room management with streams. */
export class VideoRooms extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List outbound streams associated with a room. */
  async listStreams(roomId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(roomId, 'streams'), params);
  }

  /** Start a new outbound stream from a room (e.g. RTMP to YouTube). */
  async createStream(roomId: string, body: any): Promise<any> {
    return this._http.post(this._path(roomId, 'streams'), body);
  }
}

/** Video room token generation. */
export class VideoRoomTokens extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** Issue a JWT token that grants a client access to a specific room. */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }
}

/** Video room session management. */
export class VideoRoomSessions extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List past and active room sessions. */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /** Fetch a single room session by ID. */
  async get(sessionId: string): Promise<any> {
    return this._http.get(this._path(sessionId));
  }

  /** List the event log for a room session. */
  async listEvents(sessionId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(sessionId, 'events'), params);
  }

  /** List members that participated in a room session. */
  async listMembers(sessionId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(sessionId, 'members'), params);
  }

  /** List recordings captured during a room session. */
  async listRecordings(sessionId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(sessionId, 'recordings'), params);
  }
}

/** Video room recording management. */
export class VideoRoomRecordings extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List all room recordings in the project. */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /** Fetch a room recording by ID. */
  async get(recordingId: string): Promise<any> {
    return this._http.get(this._path(recordingId));
  }

  /** Delete a room recording. */
  async delete(recordingId: string): Promise<any> {
    return this._http.delete(this._path(recordingId));
  }

  /** List event log entries for a room recording. */
  async listEvents(recordingId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(recordingId, 'events'), params);
  }
}

/** Video conference management with tokens and streams. */
export class VideoConferences extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List conference tokens associated with a conference. */
  async listConferenceTokens(conferenceId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceId, 'conference_tokens'), params);
  }

  /** List outbound streams associated with a conference. */
  async listStreams(conferenceId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceId, 'streams'), params);
  }

  /** Start an outbound stream from a conference. */
  async createStream(conferenceId: string, body: any): Promise<any> {
    return this._http.post(this._path(conferenceId, 'streams'), body);
  }
}

/** Video conference token management. */
export class VideoConferenceTokens extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** Fetch a conference token by ID. */
  async get(tokenId: string): Promise<any> {
    return this._http.get(this._path(tokenId));
  }

  /** Reset / regenerate a conference token, invalidating the previous value. */
  async reset(tokenId: string): Promise<any> {
    return this._http.post(this._path(tokenId, 'reset'));
  }
}

/** Video stream management. */
export class VideoStreams extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** Fetch a video stream by ID. */
  async get(streamId: string): Promise<any> {
    return this._http.get(this._path(streamId));
  }

  /** Update a video stream's configuration (e.g. destination URL). */
  async update(streamId: string, body: any): Promise<any> {
    return this._http.put(this._path(streamId), body);
  }

  /** Stop and delete a video stream. */
  async delete(streamId: string): Promise<any> {
    return this._http.delete(this._path(streamId));
  }
}

/**
 * Video API namespace.
 *
 * Access via `client.video.*`.
 *
 * @example Create a room and issue a client token
 * ```ts
 * const room = await client.video.rooms.create({ name: 'standup' });
 * const token = await client.video.roomTokens.create({ room_name: 'standup', user_name: 'Alice' });
 * ```
 */
export class VideoNamespace {
  readonly rooms: VideoRooms;
  readonly roomTokens: VideoRoomTokens;
  readonly roomSessions: VideoRoomSessions;
  readonly roomRecordings: VideoRoomRecordings;
  readonly conferences: VideoConferences;
  readonly conferenceTokens: VideoConferenceTokens;
  readonly streams: VideoStreams;

  constructor(http: HttpClient) {
    const base = '/api/video';
    this.rooms = new VideoRooms(http, `${base}/rooms`);
    this.roomTokens = new VideoRoomTokens(http, `${base}/room_tokens`);
    this.roomSessions = new VideoRoomSessions(http, `${base}/room_sessions`);
    this.roomRecordings = new VideoRoomRecordings(http, `${base}/room_recordings`);
    this.conferences = new VideoConferences(http, `${base}/conferences`);
    this.conferenceTokens = new VideoConferenceTokens(http, `${base}/conference_tokens`);
    this.streams = new VideoStreams(http, `${base}/streams`);
  }
}
