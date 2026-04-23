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

  /**
   * List outbound streams associated with a room.
   *
   * @param roomId - Unique identifier of the video room.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of outbound streams.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listStreams(roomId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(roomId, 'streams'), params);
  }

  /**
   * Start a new outbound stream from a room (e.g. RTMP to YouTube, Twitch).
   *
   * @param roomId - Unique identifier of the video room.
   * @param body - Stream configuration (destination URL, credentials, etc.).
   * @returns The newly-created stream record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createStream(roomId: string, body: any): Promise<any> {
    return this._http.post(this._path(roomId, 'streams'), body);
  }
}

/** Video room token generation. */
export class VideoRoomTokens extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Issue a JWT token that grants a browser / mobile client access to a room.
   *
   * @param body - Token payload (`room_name`, `user_name`, `permissions`, etc.).
   * @returns The token record, typically `{ token: "eyJ..." }`.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }
}

/** Video room session management. */
export class VideoRoomSessions extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List past and active room sessions in the project.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of room sessions.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a single room session by ID.
   *
   * @param sessionId - Unique identifier of the room session.
   * @returns The room-session record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(sessionId: string): Promise<any> {
    return this._http.get(this._path(sessionId));
  }

  /**
   * List the event log for a room session.
   *
   * @param sessionId - Unique identifier of the room session.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of session events.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listEvents(sessionId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(sessionId, 'events'), params);
  }

  /**
   * List members that participated in a room session.
   *
   * @param sessionId - Unique identifier of the room session.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of members (past and current).
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listMembers(sessionId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(sessionId, 'members'), params);
  }

  /**
   * List recordings captured during a room session.
   *
   * @param sessionId - Unique identifier of the room session.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of session recordings.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listRecordings(sessionId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(sessionId, 'recordings'), params);
  }
}

/** Video room recording management. */
export class VideoRoomRecordings extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * List all room recordings in the project.
   *
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of recordings.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  /**
   * Fetch a room recording by ID.
   *
   * @param recordingId - Unique identifier of the recording.
   * @returns The recording record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(recordingId: string): Promise<any> {
    return this._http.get(this._path(recordingId));
  }

  /**
   * Delete a room recording.
   *
   * @param recordingId - Unique identifier of the recording.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async delete(recordingId: string): Promise<any> {
    return this._http.delete(this._path(recordingId));
  }

  /**
   * List event log entries for a room recording.
   *
   * @param recordingId - Unique identifier of the recording.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of recording events.
   * @throws {RestError} On any non-2xx HTTP response.
   */
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

  /**
   * List conference tokens associated with a conference.
   *
   * @param conferenceId - Unique identifier of the conference.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of conference tokens.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listConferenceTokens(conferenceId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceId, 'conference_tokens'), params);
  }

  /**
   * List outbound streams associated with a conference.
   *
   * @param conferenceId - Unique identifier of the conference.
   * @param params - Optional filter / pagination query parameters.
   * @returns A paginated list of streams.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async listStreams(conferenceId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceId, 'streams'), params);
  }

  /**
   * Start an outbound stream from a conference (e.g. RTMP to YouTube).
   *
   * @param conferenceId - Unique identifier of the conference.
   * @param body - Stream configuration (destination URL, credentials, etc.).
   * @returns The newly-created stream record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async createStream(conferenceId: string, body: any): Promise<any> {
    return this._http.post(this._path(conferenceId, 'streams'), body);
  }
}

/** Video conference token management. */
export class VideoConferenceTokens extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Fetch a conference token by ID.
   *
   * @param tokenId - Unique identifier of the conference token.
   * @returns The conference-token record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(tokenId: string): Promise<any> {
    return this._http.get(this._path(tokenId));
  }

  /**
   * Reset / regenerate a conference token, invalidating the previous value.
   *
   * @param tokenId - Unique identifier of the conference token to reset.
   * @returns The refreshed token record with a new secret.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async reset(tokenId: string): Promise<any> {
    return this._http.post(this._path(tokenId, 'reset'));
  }
}

/** Video stream management. */
export class VideoStreams extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /**
   * Fetch a video stream by ID.
   *
   * @param streamId - Unique identifier of the stream.
   * @returns The stream record.
   * @throws {RestError} On any non-2xx HTTP response (including `404`).
   */
  async get(streamId: string): Promise<any> {
    return this._http.get(this._path(streamId));
  }

  /**
   * Update a video stream's configuration (e.g. destination URL).
   *
   * @param streamId - Unique identifier of the stream.
   * @param body - Full updated stream attributes (replace semantics).
   * @returns The updated stream record.
   * @throws {RestError} On any non-2xx HTTP response.
   */
  async update(streamId: string, body: any): Promise<any> {
    return this._http.put(this._path(streamId), body);
  }

  /**
   * Stop and delete a video stream.
   *
   * @param streamId - Unique identifier of the stream.
   * @returns The platform's delete response.
   * @throws {RestError} On any non-2xx HTTP response.
   */
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
