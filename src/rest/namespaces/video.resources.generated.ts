// AUTO-GENERATED from porting-sdk/rest-apis/video/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// One typed resource class per x-sdk-resource: CRUD bases bound to the
// resource's spec types (closed body + extras door) plus declared operation
// methods, command-dispatch, and set_methods — mirrors the Python reference's
// <ns>_resources_generated module.

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { CrudResource } from '../base/CrudResource.js';
import { ReadResource } from '../base/ReadResource.js';
import type {
  Conference,
  ConferenceToken,
  CreateConferenceRequest,
  CreateRoomRequest,
  JoinAsType,
  ListConferenceTokensResponse,
  ListConferencesResponse,
  ListRoomRecordingEventsResponse,
  ListRoomRecordingsResponse,
  ListRoomSessionEventsResponse,
  ListRoomSessionMembersResponse,
  ListRoomSessionRecordingsResponse,
  ListRoomSessionsResponse,
  ListRoomsResponse,
  ListStreamsResponse,
  MediaAllowedType,
  RoomRecording,
  RoomResponse,
  RoomSessionSummary,
  RoomTokenPermission,
  RoomTokenResponse,
  Stream,
  UpdateConferenceRequest,
  UpdateRoomRequest,
} from './video.types.generated.js';

export class VideoConferenceTokens extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/video/conference_tokens');
  }

  async get(id: string, params?: QueryParams): Promise<ConferenceToken> {
    return this._http.get<ConferenceToken>(this._path(id), params);
  }

  async reset(id: string): Promise<ConferenceToken> {
    return this._http.post<ConferenceToken>(this._path(id, 'reset'));
  }
}

export class VideoConferences extends CrudResource<
  ListConferencesResponse,
  Conference,
  CreateConferenceRequest,
  UpdateConferenceRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/video/conferences');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: CreateConferenceRequest,
    extras?: Record<string, unknown>,
  ): Promise<Conference> {
    return this._http.post<Conference>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: UpdateConferenceRequest,
    extras?: Record<string, unknown>,
  ): Promise<Conference> {
    return this._http.put<Conference>(this._path(id), { ...body, ...extras });
  }

  async listConferenceTokens(
    id: string,
    params?: QueryParams,
  ): Promise<ListConferenceTokensResponse> {
    return this._http.get<ListConferenceTokensResponse>(
      this._path(id, 'conference_tokens'),
      params,
    );
  }

  async listStreams(id: string, params?: QueryParams): Promise<ListStreamsResponse> {
    return this._http.get<ListStreamsResponse>(this._path(id, 'streams'), params);
  }

  async createStream(
    id: string,
    url: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<Stream> {
    const body: Record<string, unknown> = {};
    const _fields = {
      url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<Stream>(this._path(id, 'streams'), body);
  }
}

export class VideoRoomRecordings extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/video/room_recordings');
  }

  async list(params?: QueryParams): Promise<ListRoomRecordingsResponse> {
    return this._http.get<ListRoomRecordingsResponse>(this._basePath, params);
  }

  async get(id: string, params?: QueryParams): Promise<RoomRecording> {
    return this._http.get<RoomRecording>(this._path(id), params);
  }

  async delete(id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id));
  }

  async listEvents(id: string, params?: QueryParams): Promise<ListRoomRecordingEventsResponse> {
    return this._http.get<ListRoomRecordingEventsResponse>(this._path(id, 'events'), params);
  }
}

export class VideoRoomSessions extends ReadResource<ListRoomSessionsResponse, RoomSessionSummary> {
  constructor(http: HttpClient) {
    super(http, '/api/video/room_sessions');
  }

  async listEvents(id: string, params?: QueryParams): Promise<ListRoomSessionEventsResponse> {
    return this._http.get<ListRoomSessionEventsResponse>(this._path(id, 'events'), params);
  }

  async listMembers(id: string, params?: QueryParams): Promise<ListRoomSessionMembersResponse> {
    return this._http.get<ListRoomSessionMembersResponse>(this._path(id, 'members'), params);
  }

  async listRecordings(
    id: string,
    params?: QueryParams,
  ): Promise<ListRoomSessionRecordingsResponse> {
    return this._http.get<ListRoomSessionRecordingsResponse>(this._path(id, 'recordings'), params);
  }
}

export class VideoRoomTokens extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/video/room_tokens');
  }

  async create(
    room_name: string,
    options?: {
      user_name?: string;
      permissions?: RoomTokenPermission[];
      join_from?: string;
      join_until?: string;
      remove_at?: string;
      remove_after_seconds_elapsed?: number;
      join_audio_muted?: boolean;
      join_video_muted?: boolean;
      auto_create_room?: boolean;
      enable_room_previews?: boolean;
      room_display_name?: string;
      end_room_session_on_leave?: boolean;
      join_as?: JoinAsType;
      media_allowed?: MediaAllowedType;
      room_meta?: Record<string, unknown>;
      meta?: Record<string, unknown>;
      sync_audio_video?: boolean;
      extras?: Record<string, unknown>;
    },
  ): Promise<RoomTokenResponse> {
    const body: Record<string, unknown> = {};
    const _fields = {
      room_name,
      user_name: options?.user_name,
      permissions: options?.permissions,
      join_from: options?.join_from,
      join_until: options?.join_until,
      remove_at: options?.remove_at,
      remove_after_seconds_elapsed: options?.remove_after_seconds_elapsed,
      join_audio_muted: options?.join_audio_muted,
      join_video_muted: options?.join_video_muted,
      auto_create_room: options?.auto_create_room,
      enable_room_previews: options?.enable_room_previews,
      room_display_name: options?.room_display_name,
      end_room_session_on_leave: options?.end_room_session_on_leave,
      join_as: options?.join_as,
      media_allowed: options?.media_allowed,
      room_meta: options?.room_meta,
      meta: options?.meta,
      sync_audio_video: options?.sync_audio_video,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<RoomTokenResponse>(this._basePath, body);
  }
}

export class VideoRooms extends CrudResource<
  ListRoomsResponse,
  RoomResponse,
  CreateRoomRequest,
  UpdateRoomRequest
> {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/video/rooms');
  }

  /** Create — typed request body plus an `extras` escape hatch for fields not yet typed. */
  override async create(
    body: CreateRoomRequest,
    extras?: Record<string, unknown>,
  ): Promise<RoomResponse> {
    return this._http.post<RoomResponse>(this._basePath, { ...body, ...extras });
  }

  /** Update — typed request body plus an `extras` escape hatch. */
  override async update(
    id: string,
    body: UpdateRoomRequest,
    extras?: Record<string, unknown>,
  ): Promise<RoomResponse> {
    return this._http.put<RoomResponse>(this._path(id), { ...body, ...extras });
  }

  async listStreams(id: string, params?: QueryParams): Promise<ListStreamsResponse> {
    return this._http.get<ListStreamsResponse>(this._path(id, 'streams'), params);
  }

  async createStream(
    id: string,
    url: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<Stream> {
    const body: Record<string, unknown> = {};
    const _fields = {
      url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.post<Stream>(this._path(id, 'streams'), body);
  }
}

export class VideoStreams extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/video/streams');
  }

  async get(id: string, params?: QueryParams): Promise<Stream> {
    return this._http.get<Stream>(this._path(id), params);
  }

  async update(
    id: string,
    url: string,
    options?: { extras?: Record<string, unknown> },
  ): Promise<Stream> {
    const body: Record<string, unknown> = {};
    const _fields = {
      url,
    };
    for (const [k, v] of Object.entries(_fields)) if (v !== undefined) body[k] = v;
    if (options?.extras) Object.assign(body, options.extras);
    return this._http.put<Stream>(this._path(id), body);
  }

  async delete(id: string): Promise<Record<string, unknown>> {
    return this._http.delete<Record<string, unknown>>(this._path(id));
  }
}
