/**
 * Video API types.
 *
 * Hand-derived from the canonical OpenAPI contract at
 * `porting-sdk/rest-apis/video/openapi.yaml`. Each interface mirrors a
 * `components/schemas` definition (or an operation's request-body / 2xx-response
 * schema); field names are the wire (snake_case) keys exactly as the platform
 * emits/accepts them. The mapped operationId for each type is noted in its
 * doc-comment. `anyOf [type, 'null']` schemas are rendered as `T | null`;
 * non-`required` properties are optional (`?`).
 *
 * These are compile-time annotations only — they do not affect runtime behavior
 * or wire shape.
 */

// ---------------------------------------------------------------------------
// Shared building blocks (enums + pagination)
// ---------------------------------------------------------------------------

/** Video quality resolution. Schema: `VideoQuality`. */
export type VideoQuality = '720p' | '1080p';

/** Video frames per second. Schema: `VideoFps`. */
export type VideoFps = 20 | 30;

/** Video room layout options. Schema: `VideoLayout`. */
export type VideoLayout =
  | 'grid-responsive'
  | 'grid-responsive-mobile'
  | 'highlight-1-responsive'
  | '1x1'
  | '2x1'
  | '2x2'
  | '5up'
  | '3x3'
  | '4x4'
  | '5x5'
  | '6x6'
  | '8x8'
  | '10x10';

/** Status of a room session. Schema: `RoomSessionStatus`. */
export type RoomSessionStatus = 'in-progress' | 'completed';

/** Status of a room recording. Schema: `RoomRecordingStatus`. */
export type RoomRecordingStatus = 'recording' | 'paused' | 'processing' | 'completed';

/** Join-as type for room tokens. Schema: `JoinAsType`. */
export type JoinAsType = 'audience' | 'member';

/** Media-allowed type for room tokens. Schema: `MediaAllowedType`. */
export type MediaAllowedType = 'all' | 'video-only' | 'audio-only';

/** Valid permission scopes for room tokens. Schema: `RoomTokenPermission`. */
export type RoomTokenPermission =
  | 'room.member.audio_mute'
  | 'room.member.audio_unmute'
  | 'room.member.video_mute'
  | 'room.member.video_unmute'
  | 'room.member.deaf'
  | 'room.member.undeaf'
  | 'room.member.set_input_volume'
  | 'room.member.set_output_volume'
  | 'room.member.set_input_sensitivity'
  | 'room.member.set_position'
  | 'room.member.set_meta'
  | 'room.member.raisehand'
  | 'room.member.lowerhand'
  | 'room.member.remove'
  | 'room.member.promote'
  | 'room.member.demote'
  | 'room.hide_video_muted'
  | 'room.list_available_layouts'
  | 'room.lock'
  | 'room.playback'
  | 'room.playback_seek'
  | 'room.prioritize_handraise'
  | 'room.recording'
  | 'room.set_layout'
  | 'room.set_position'
  | 'room.set_meta'
  | 'room.show_video_muted'
  | 'room.stream'
  | 'room.unlock'
  | 'room.self.audio_mute'
  | 'room.self.audio_unmute'
  | 'room.self.video_mute'
  | 'room.self.video_unmute'
  | 'room.self.deaf'
  | 'room.self.undeaf'
  | 'room.self.set_input_volume'
  | 'room.self.set_output_volume'
  | 'room.self.set_input_sensitivity'
  | 'room.self.set_position'
  | 'room.self.set_meta'
  | 'room.self.raisehand'
  | 'room.self.lowerhand'
  | 'room.self.screenshare'
  | 'room.self.additional_source';

/** Pagination links for list responses. Schema: `PaginationLinks`. */
export interface VideoPaginationLinks {
  /** Link to the current page. */
  self: string;
  /** Link to the first page. */
  first: string;
  /** Link to the next page, if any. */
  next?: string;
  /** Link to the previous page, if any. */
  prev?: string;
}

// ---------------------------------------------------------------------------
// Streams — VideoStreams, VideoRooms.{listStreams,createStream},
//           VideoConferences.{listStreams,createStream}
// ---------------------------------------------------------------------------

/** A video stream object. Schema: `Stream`. */
export interface Stream {
  /** Unique identifier for the stream. */
  id: string;
  /** RTMP or RTMPS URL accepting the incoming stream. */
  url: string | null;
  /** The type of stream. */
  stream_type: string | null;
  /** The stream's width in pixels. */
  width: number | null;
  /** The stream's height in pixels. */
  height: number | null;
  /** The stream's frames per second. */
  fps: number | null;
  /** Timestamp when the stream was created. */
  created_at: string;
  /** Timestamp when the stream was last updated. */
  updated_at: string;
}

/** List streams response. Schema: `ListStreamsResponse` (`list_room_streams`, `list_conference_streams`). */
export interface ListStreamsResponse {
  /** Pagination links. */
  links: VideoPaginationLinks;
  /** List of streams. */
  data: Stream[];
}

/** Request body for creating a stream. Schema: `CreateStreamRequest` (`create_room_stream`, `create_conference_stream`). */
export interface CreateStreamRequest {
  /** RTMP or RTMPS URL accepting the incoming stream. */
  url: string;
}

/** Request body for updating a stream. Schema: `UpdateStreamRequest` (`update_stream`). */
export interface UpdateStreamRequest {
  /** RTMP or RTMPS URL accepting the incoming stream. */
  url: string;
}

// ---------------------------------------------------------------------------
// Room tokens — VideoRoomTokens.create (`create_room_token`)
// ---------------------------------------------------------------------------

/** Request body for creating a room token. Schema: `CreateRoomTokenRequest`. */
export interface CreateRoomTokenRequest {
  /** Room's unique named identifier. Allowed characters: `A-Za-z0-9_-`. */
  room_name: string;
  /** A display name to use for the user. */
  user_name?: string;
  /** Permissions defining what the user can do once they join the room. */
  permissions?: RoomTokenPermission[];
  /** The user can't join the room before this time (RFC 3339 datetime). */
  join_from?: string;
  /** The user can't join the room after this time (RFC 3339 datetime). */
  join_until?: string;
  /** Remove user from the room at this time (RFC 3339 datetime). */
  remove_at?: string;
  /** Remove user after they are in the room for N seconds. */
  remove_after_seconds_elapsed?: number;
  /** Whether the user joins the room with their audio muted. */
  join_audio_muted?: boolean;
  /** Whether the user joins the room with their video muted. */
  join_video_muted?: boolean;
  /** Whether to auto-create the room if it does not exist. */
  auto_create_room?: boolean;
  /** Whether to generate a video preview of the room content. */
  enable_room_previews?: boolean;
  /** Display name used if a room is auto-created when the token joins. */
  room_display_name?: string;
  /** Whether to end the room session when this token's member leaves. */
  end_room_session_on_leave?: boolean;
  /** Whether the user joins as a member or as a non-interactive audience participant. */
  join_as?: JoinAsType;
  /** Indicates what media the user is allowed to receive. */
  media_allowed?: MediaAllowedType;
  /** Room meta. Maximum of 2000 characters when serialized to JSON. */
  room_meta?: Record<string, unknown>;
  /** Member meta. Maximum of 2000 characters when serialized to JSON. */
  meta?: Record<string, unknown>;
  /** Enable/disable jitter buffer audio-video sync. */
  sync_audio_video?: boolean;
}

/** Room token response object. Schema: `RoomTokenResponse` (`create_room_token`). */
export interface RoomTokenResponse {
  /** A Room Token used by clients to connect to the Room. */
  token: string;
}

// ---------------------------------------------------------------------------
// Room sessions — VideoRoomSessions.*
// ---------------------------------------------------------------------------

/**
 * Room session summary, returned by the show endpoint. Omits list-only fields.
 * Schema: `RoomSessionSummary` (`get_room_session`).
 */
export interface RoomSessionSummary {
  /** Unique ID of the session. */
  id: string;
  /** Unique ID of the Room the Session was created from, if any. */
  room_id: string | null;
  /** The named identifier of the room session. */
  name: string | null;
  /** Display name of the room. */
  display_name: string | null;
  /** The maximum number of members allowed in the room at a time. */
  max_members: number | null;
  /** The room session's resolution. */
  quality: VideoQuality | null;
  /** The room session's frames per second. */
  fps: VideoFps | null;
  /** Room Session does not accept new Members before this time. */
  join_from: string | null;
  /** Room Session stops accepting new Members at this time. */
  join_until: string | null;
  /** Remove Members from the Room Session at this time. */
  remove_at: string | null;
  /** Remove Members after they are in the Room Session for N seconds. */
  remove_after_seconds_elapsed: number | null;
  /** The room session's initial layout. */
  layout: string | null;
  /** Whether a recording was automatically started when this Room Session began. */
  record_on_start: boolean;
  /** Whether a tone is played when a member enters or exits the room session. */
  tone_on_entry_and_exit: boolean;
  /** Whether participants join with video off by room setting. */
  room_join_video_off: boolean;
  /** Whether participants join with video off by user setting. */
  user_join_video_off: boolean;
  /** Whether the room session is locked. */
  locked: boolean;
  /** Start time of the session. */
  start_time: string | null;
  /** End time of the session. */
  end_time: string | null;
  /** How long, in seconds, the Room Session lasted. */
  duration: number | null;
  /** Status of the session. */
  status: RoomSessionStatus | null;
  /** Timestamp when the room session was created. */
  created_at: string;
  /** Timestamp when the room session was last updated. */
  updated_at: string;
  /** Preview-video URL when room previews are enabled and the session is in progress. */
  preview_url: string | null;
  /** Whether raised hands are prioritized in the layout. */
  prioritize_handraise: boolean | null;
  /** Enable/disable jitter buffer audio-video sync. */
  sync_audio_video: boolean | null;
}

/** Room session response object (list form). Schema: `RoomSession` (`list_room_sessions`). */
export interface RoomSession {
  /** Unique ID of the session. */
  id: string;
  /** Unique ID of the Room the Session was created from, if any. */
  room_id: string | null;
  /** The named identifier of the room session. */
  name: string | null;
  /** Display name of the room. */
  display_name: string | null;
  /** The maximum number of members allowed in the room at a time. */
  max_members: number | null;
  /** The room session's resolution. */
  quality: VideoQuality | null;
  /** The room session's frames per second. */
  fps: VideoFps | null;
  /** Room Session does not accept new Members before this time. */
  join_from: string | null;
  /** Room Session stops accepting new Members at this time. */
  join_until: string | null;
  /** Remove Members from the Room Session at this time. */
  remove_at: string | null;
  /** Remove Members after they are in the Room Session for N seconds. */
  remove_after_seconds_elapsed: number | null;
  /** The room session's initial layout. */
  layout: string | null;
  /** Whether a recording was automatically started when this Room Session began. */
  record_on_start: boolean;
  /** Whether a tone is played when a member enters or exits the room session. */
  tone_on_entry_and_exit: boolean;
  /** Whether participants join with video off by room setting. */
  room_join_video_off: boolean;
  /** Whether participants join with video off by user setting. */
  user_join_video_off: boolean;
  /** Whether the room session is locked. */
  locked: boolean;
  /** Start time of the session. */
  start_time: string | null;
  /** End time of the session. */
  end_time: string | null;
  /** How long, in seconds, the Room Session lasted. */
  duration: number | null;
  /** Status of the session. */
  status: RoomSessionStatus | null;
  /** Timestamp when the room session was created. */
  created_at: string;
  /** Timestamp when the room session was last updated. */
  updated_at: string;
  /** Preview-video URL when room previews are enabled and the session is in progress. */
  preview_url: string | null;
  /** Whether raised hands are prioritized in the layout. */
  prioritize_handraise: boolean | null;
  /** Enable/disable jitter buffer audio-video sync. */
  sync_audio_video: boolean | null;
  /** The cost of the room session in dollars. */
  cost_in_dollars: number;
  /** Whether a video preview of the room content is generated. */
  enable_room_previews: boolean;
  /** URL of the locked room cover image. */
  locked_cover: string;
}

/** List room sessions response. Schema: `ListRoomSessionsResponse` (`list_room_sessions`). */
export interface ListRoomSessionsResponse {
  /** Pagination links. */
  links: VideoPaginationLinks;
  /** List of room sessions. */
  data: RoomSession[];
}

/** Room session event response object. Schema: `RoomSessionEvent`. */
export interface RoomSessionEvent {
  /** Unique ID of the event. */
  id: string;
  /** The ID of the project. */
  project_id: string;
  /** The ID of the room. */
  room_id: string;
  /** The ID of the room session. */
  room_session_id: string;
  /** The ID of the associated room recording. Only present for recording-related events. */
  room_recording_id?: string;
  /** The ID of the associated room participant. Only present for participant-related events. */
  room_participant_id?: string;
  /** The severity level of the event. */
  level: string;
  /** The name of the event. */
  name: string;
  /** Event-specific payload data. */
  payload: Record<string, unknown>;
  /** Timestamp when the event was created. */
  created_at: string;
}

/** List room session events response. Schema: `ListRoomSessionEventsResponse` (`list_room_session_events`). */
export interface ListRoomSessionEventsResponse {
  /** Pagination links. */
  links: VideoPaginationLinks;
  /** List of room session events. */
  data: RoomSessionEvent[];
}

/** Room session member response object. Schema: `RoomSessionMember`. */
export interface RoomSessionMember {
  /** Unique ID of the Member. */
  id: string;
  /** Unique ID of the Room Session. */
  room_session_id: string;
  /** Display name of the Member. */
  name: string | null;
  /** Timestamp of when the Member joined the Room Session. */
  join_time: string | null;
  /** Timestamp of when the Member left the Room Session. */
  leave_time: string | null;
  /** How long the Member stayed in the Room Session, in seconds. */
  duration: number | null;
  /** The cost of the member's participation in dollars. */
  cost_in_dollars: number;
}

/** List room session members response. Schema: `ListRoomSessionMembersResponse` (`list_room_session_members`). */
export interface ListRoomSessionMembersResponse {
  /** Pagination links. */
  links: VideoPaginationLinks;
  /** List of room session members. */
  data: RoomSessionMember[];
}

/** List room session recordings response. Schema: `ListRoomSessionRecordingsResponse` (`list_room_session_recordings`). */
export interface ListRoomSessionRecordingsResponse {
  /** Pagination links. */
  links: VideoPaginationLinks;
  /** List of room recordings. */
  data: RoomRecording[];
}

// ---------------------------------------------------------------------------
// Room recordings — VideoRoomRecordings.*
// ---------------------------------------------------------------------------

/** Room recording response object. Schema: `RoomRecording` (`get_room_recording`). */
export interface RoomRecording {
  /** Unique ID of the Room Recording. */
  id: string;
  /** Unique ID of the Room Session the Room Recording was made in. */
  room_session_id: string;
  /** Status of the recording. */
  status: RoomRecordingStatus | null;
  /** Timestamp of when the Room Recording started. */
  started_at: string | null;
  /** Timestamp of when the Room Recording stopped. */
  finished_at: string | null;
  /** The length of the Room Recording in seconds. */
  duration: number | null;
  /** The number of bytes of the Room Recording file. */
  size_in_bytes: number | null;
  /** The MIME type of the Room Recording file. */
  format: string | null;
  /** The cost of the recording in dollars. */
  cost_in_dollars: number;
  /** A temporary URL for accessing the recording file. */
  uri: string | null;
  /** Timestamp when the recording was created. */
  created_at: string;
  /** Timestamp when the recording was last updated. */
  updated_at: string;
}

/** List room recordings response. Schema: `ListRoomRecordingsResponse` (`list_room_recordings`). */
export interface ListRoomRecordingsResponse {
  /** Pagination links. */
  links: VideoPaginationLinks;
  /** List of room recordings. */
  data: RoomRecording[];
}

/** List room recording events response. Schema: `ListRoomRecordingEventsResponse` (`list_room_recording_events`). */
export interface ListRoomRecordingEventsResponse {
  /** Pagination links. */
  links: VideoPaginationLinks;
  /** List of room recording events. */
  data: RoomSessionEvent[];
}

// ---------------------------------------------------------------------------
// Conference tokens — VideoConferenceTokens.*, VideoConferences.listConferenceTokens
// ---------------------------------------------------------------------------

/** A conference token object. Schema: `ConferenceToken` (`get_conference_token`, `reset_conference_token`). */
export interface ConferenceToken {
  /** Unique identifier for the conference token. */
  id: string;
  /** Name of the conference token. */
  name: string | null;
  /** Conference token's randomly generated sequence. */
  token: string;
  /** List of permissions. */
  scopes: string[];
}

/** List conference tokens response. Schema: `ListConferenceTokensResponse` (`list_conference_tokens`). */
export interface ListConferenceTokensResponse {
  /** Pagination links. */
  links: VideoPaginationLinks;
  /** List of conference tokens. */
  data: ConferenceToken[];
}
