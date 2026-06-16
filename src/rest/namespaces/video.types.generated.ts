// AUTO-GENERATED from porting-sdk/rest-apis/video/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** Active session information for a room. */
export interface ActiveSession {
  /** Unique ID of the session. */
  id?: string;
  /** Unique ID of the Room if the Session was created from a Room and was not an auto-created Session. */
  room_id?: string;
  /** The named identifier of room session. */
  name?: string;
  /** Display name of room, no character limitations. Maximum of 200 characters. Defaults to the value of name. */
  display_name?: string;
  /** Room Session does not accept new Members before this time. */
  join_from?: string;
  /** Room Session stops accepting new Members at this time. */
  join_until?: string;
  /** Remove Members from the Room Session at this time. */
  remove_at?: string;
  /** Remove Members after they are in the Room Session for N seconds. */
  remove_after_seconds_elapsed?: number;
  /** The Room Session's initial layout. See documentation for a full list of supported layouts. */
  layout?: string;
  /** The maximum number of members allowed in the room at a time. */
  max_members?: number;
  /** The Room Session's frames per second. */
  fps?: VideoFps;
  /** The Room Session's resolution. */
  quality?: VideoQuality;
  /** Start time of the session. */
  start_time?: string;
  /** End time of the session. */
  end_time?: string;
  /** How long, in seconds, the Room Session lasted. */
  duration?: number;
  /** Status of the session. */
  status?: RoomSessionStatus;
  /** Whether a recording was automatically started when this Room Session began. */
  record_on_start?: boolean;
  /** Whether a video with a preview of the content of the room is to be generated. */
  enable_room_previews?: boolean;
  /** If room previews are enabled and the room session is in progress, this is the URL of the preview video. */
  preview_url?: string;
  /** Enable/disable jitter buffer audio-video sync. */
  audio_video_sync?: boolean;
}

/** Charge detail item for logs. */
export interface ChargeDetail {
  /** Description for this charge. */
  description: string;
  /** Charged amount, in dollars. */
  charge: number;
}

/** Video conference response object. */
export interface Conference {
  /** Unique ID of the video conference. */
  id: string;
  /** A named unique identifier for the conference. Allowed characters: `A-Za-z0-9_-`. */
  name: string;
  /** Display name of the video conference. Maximum of 200 characters. */
  display_name: string | null;
  /** Description of the conference. Maximum of 3000 characters. */
  description: string | null;
  /** Conference does not accept new participants before this time. */
  join_from: string | null;
  /** Conference stops accepting new participants at this time, but keeps running until all participants leave. */
  join_until: string | null;
  /** The conference's resolution. */
  quality: VideoQuality;
  /** The conference's initial layout. */
  layout: VideoLayout;
  /** The size of the video conference. */
  size: ConferenceSize | null;
  /** Whether to start recording when a conference session begins. */
  record_on_start: boolean;
  /** Whether a tone is played when a member enters or exits the conference. */
  tone_on_entry_and_exit: boolean;
  /** Whether participants join with video off by user setting. */
  user_join_video_off: boolean;
  /** Whether participants join with video off by room setting. */
  room_join_video_off: boolean;
  /** Whether group chat is enabled for conference participants. */
  enable_chat: boolean;
  /** Whether a preview video of the conference content is generated. */
  enable_room_previews: boolean | null;
  /** CTA buttons and selected items color (dark theme). */
  dark_primary: string | null;
  /** Main background color (dark theme). */
  dark_background: string | null;
  /** Main foreground color (dark theme). */
  dark_foreground: string | null;
  /** Success indication color (dark theme). */
  dark_success: string | null;
  /** Error indication color (dark theme). */
  dark_negative: string | null;
  /** CTA buttons and selected items color (light theme). */
  light_primary: string | null;
  /** Main background color (light theme). */
  light_background: string | null;
  /** Main foreground color (light theme). */
  light_foreground: string | null;
  /** Success indication color (light theme). */
  light_success: string | null;
  /** Error indication color (light theme). */
  light_negative: string | null;
  /** User-defined metadata for the conference. */
  meta: Record<string, Record<string, unknown>> | null;
  /** Timestamp when the conference was created. */
  created_at: string;
  /** Timestamp when the conference was last updated. */
  updated_at: string;
  /** Active session information. Only present when requested via the `include_active_session` query parameter. */
  active_session?: ActiveSession;
}

/** Conference size options. */
export type ConferenceSize = 'small' | 'medium' | 'large';

/** A conference token object. */
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

/** Request body for creating a conference. */
export interface CreateConferenceRequest {
  /** A named unique identifier for the conference. Allowed characters: `A-Za-z0-9_-`. Maximum of 100 characters. */
  name?: string;
  /** Display name of the video conference. Maximum of 200 characters. */
  display_name: string;
  /** Description of the conference. Maximum of 3000 characters. */
  description?: string;
  /** Conference does not accept new participants before this time. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  join_from?: string;
  /** Conference stops accepting new participants at this time, but keeps running until all participants leave. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  join_until?: string;
  /** The conference's resolution. */
  quality?: VideoQuality;
  /** The conference's initial layout. */
  layout?: VideoLayout;
  /** The size of the video conference. */
  size?: ConferenceSize;
  /** Whether to start recording when a conference session begins. */
  record_on_start?: boolean;
  /** Whether a preview video of the conference content is generated. */
  enable_room_previews?: boolean;
  /** Whether group chat is enabled for conference participants. */
  enable_chat?: boolean;
  /** CTA buttons and selected items color (dark theme). */
  dark_primary?: string;
  /** Main background color (dark theme). */
  dark_background?: string;
  /** Main foreground color (dark theme). */
  dark_foreground?: string;
  /** Success indication color (dark theme). */
  dark_success?: string;
  /** Error indication color (dark theme). */
  dark_negative?: string;
  /** CTA buttons and selected items color (light theme). */
  light_primary?: string;
  /** Main background color (light theme). */
  light_background?: string;
  /** Main foreground color (light theme). */
  light_foreground?: string;
  /** Success indication color (light theme). */
  light_success?: string;
  /** Error indication color (light theme). */
  light_negative?: string;
}

/** Request body for creating a room. */
export interface CreateRoomRequest {
  /** A named unique identifier for the room. Allowed characters: `A-Za-z0-9_-`. Maximum of 100 characters. */
  name: string;
  /** Display name of the room. Maximum of 200 characters. Defaults to the value of name. */
  display_name?: string;
  /** Description of the room. Maximum of 3000 characters. */
  description?: string;
  /** The maximum number of members in the room at a time. Must be at least 1 to a maximum of 300. */
  max_members?: number;
  /** The room's resolution. */
  quality?: VideoQuality;
  /** Room does not accept new participants before this time. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  join_from?: string;
  /** Room stops accepting new participants at this time, but keeps running until all participants leave. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  join_until?: string;
  /** Remove users from the room at this time. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  remove_at?: string;
  /** Remove users after they are in the room for N seconds. */
  remove_after_seconds_elapsed?: number;
  /** The room's initial layout. */
  layout?: RoomLayout;
  /** Specifies whether to start recording a Room Session when one is started for this Room. */
  record_on_start?: boolean;
  /** Whether a video with a preview of the content of the room is to be generated. */
  enable_room_previews?: boolean;
  /** User-defined metadata for the room. Must be a valid JSON object. Maximum of 2000 characters when serialized. */
  meta?: Record<string, Record<string, unknown>>;
  /** Enable/disable jitter buffer audio-video sync. */
  sync_audio_video?: boolean;
}

/** Request body for creating a room token. */
export interface CreateRoomTokenRequest {
  /** Room's unique named identifier. Allowed characters: A-Za-z0-9_-. Up to 100 characters. The room does not have to exist when the token is created, but must exist prior to joining, or ensure auto_create_room is set to true. */
  room_name: string;
  /** A display name to use for the user. Up to 100 characters. (If not supplied, a random alphanumeric string will be returned for each authorization with this token.) */
  user_name?: string;
  /** A list of permissions, which define what user can do once they join the room. If `join_as` is `audience`, permissions are set to an empty array regardless of the value provided. */
  permissions?: RoomTokenPermission[];
  /** The user can't join the room before this time. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z` */
  join_from?: string;
  /** The user can't join the room after this time. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z` */
  join_until?: string;
  /** Remove user from the room at this time. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z` */
  remove_at?: string;
  /** Remove user after they are in the room for N seconds. */
  remove_after_seconds_elapsed?: number;
  /** Whether the user joins the room with their audio muted. */
  join_audio_muted?: boolean;
  /** Whether the user joins the room with their video muted. */
  join_video_muted?: boolean;
  /** By default, if the user tries to use this token to join a room that doesn't exist, it will be created with default configuration. Set this to false to require the room to exist beforehand. */
  auto_create_room?: boolean;
  /** Whether to generate a video with a preview of the content of the room. This parameter has effect only if this token auto-creates the room, thus it will be ignored if the room already exists. */
  enable_room_previews?: boolean;
  /** Display name used if a room is auto-created when the token joins. Maximum of 200 characters. Defaults to the value of room_name. */
  room_display_name?: string;
  /** Whether to end the room session when the member using this token leaves the room. */
  end_room_session_on_leave?: boolean;
  /** Whether the user should join as a member or as a non-interactive audience participant. Audience participants cannot send audio or video. */
  join_as?: JoinAsType;
  /** Indicates what media the user is allowed to receive. */
  media_allowed?: MediaAllowedType;
  /** Set the room meta. Maximum of 2000 characters when serialized to JSON. */
  room_meta?: Record<string, Record<string, unknown>>;
  /** Set the member meta. Maximum of 2000 characters when serialized to JSON. */
  meta?: Record<string, Record<string, unknown>>;
  /** Enable/disable jitter buffer audio-video sync. */
  sync_audio_video?: boolean;
}

/** Request body for creating a stream. */
export interface CreateStreamRequest {
  /** RTMP or RTMPS URL. This must be the address of a server accepting incoming RTMP/RTMPS streams. */
  url: string;
}

/** A discarded/deleted video log entry. Returned when the log has been deleted. Only present when `include_deleted` is `true`. */
export interface DiscardedLog {
  /** A unique identifier for the log. */
  id: string;
  /** Date and time when the log was discarded. */
  discarded_at: string;
  /** Date and time when the log was originally created. */
  created_at: string;
}

/** Join as type for room tokens. */
export type JoinAsType = 'audience' | 'member';

/** List conference tokens response. */
export interface ListConferenceTokensResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of conference tokens. */
  data: ConferenceToken[];
}

/** List conferences response. */
export interface ListConferencesResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of conferences. */
  data: Conference[];
}

/** List logs response. */
export interface ListLogsResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of logs. */
  data: VideoLog[];
}

/** List room recording events response. */
export interface ListRoomRecordingEventsResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of room recording events. */
  data: RoomSessionEvent[];
}

/** List room recordings response. */
export interface ListRoomRecordingsResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of room recordings. */
  data: RoomRecording[];
}

/** List room session events response. */
export interface ListRoomSessionEventsResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of room session events. */
  data: RoomSessionEvent[];
}

/** List room session members response. */
export interface ListRoomSessionMembersResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of room session members. */
  data: RoomSessionMember[];
}

/** List room session recordings response. */
export interface ListRoomSessionRecordingsResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of room recordings. */
  data: RoomRecording[];
}

/** List room sessions response. */
export interface ListRoomSessionsResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of room sessions. */
  data: RoomSession[];
}

/** List rooms response. */
export interface ListRoomsResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of rooms. */
  data: RoomResponse[];
}

/** List streams response. */
export interface ListStreamsResponse {
  /** Pagination links. */
  links: PaginationLinks;
  /** List of streams. */
  data: Stream[];
}

/** Log object representing a video activity entry. */
export interface Log {
  /** A unique identifier for the log. */
  id: string;
  /** Source of this log entry. */
  source: LogSource;
  /** Type of this log entry. */
  type: LogType;
  /** URL for the resource associated with this log entry. */
  url: string;
  /** A named unique identifier for the room. */
  room_name: string | null;
  /** Status of the log entry. */
  status: LogStatus | null;
  /** Whether the room session is locked. */
  locked: boolean;
  /** Start time of the activity. */
  started_at: string | null;
  /** End time of the activity. */
  ended_at: string | null;
  /** Charge amount for this activity, in dollars. */
  charge: number;
  /** Timestamp when the log was created. */
  created_at: string;
  /** Details on charges associated with this log. */
  charge_details: ChargeDetail[];
}

/** Source of a video log entry. */
export type LogSource = 'realtime_api';

/** Status of a video room session. */
export type LogStatus = 'in-progress' | 'completed';

/** Type of video activity recorded in the log. */
export type LogType = 'video_room_session' | 'video_conference_session';

/** Media allowed type for room tokens. */
export type MediaAllowedType = 'all' | 'video-only' | 'audio-only';

/** Pagination links for list responses. */
export interface PaginationLinks {
  /** Link to the current page. */
  self: string;
  /** Link to the first page. */
  first: string;
  /** Link to the next page. */
  next?: string;
  /** Link to the previous page. */
  prev?: string;
}

/** The room's layout. */
export type RoomLayout =
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

/** Room recording response object. */
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
  /** A temporary URL for accessing the recording file. By default, valid for 15 minutes. */
  uri: string | null;
  /** Timestamp when the recording was created. */
  created_at: string;
  /** Timestamp when the recording was last updated. */
  updated_at: string;
}

/** Status of a room recording. */
export type RoomRecordingStatus = 'recording' | 'paused' | 'processing' | 'completed';

/** Room response object. */
export interface RoomResponse {
  /** A unique identifier for the room. */
  id: string;
  /** A named unique identifier for the room. */
  name: string;
  /** Display name of the room. */
  display_name: string | null;
  /** Description of the room. */
  description: string | null;
  /** The maximum number of members in the room at a time. */
  max_members: number;
  /** The room's resolution. */
  quality: VideoQuality;
  /** Frames per second parameter of room video quality. */
  fps: number;
  /** Room does not accept new participants before this time. */
  join_from: string | null;
  /** Room stops accepting new participants at this time. */
  join_until: string | null;
  /** Remove users from the room at this time. */
  remove_at: string | null;
  /** Remove users after they are in the room for N seconds. */
  remove_after_seconds_elapsed: number | null;
  /** The room's initial layout. */
  layout: RoomLayout;
  /** Specifies whether to start recording a Room Session when one is started for this Room. */
  record_on_start: boolean;
  /** Whether a tone is played when participants enter or exit the room. */
  tone_on_entry_and_exit: boolean;
  /** Whether the room's video is turned off when participants join. */
  room_join_video_off: boolean;
  /** Whether a user's video is turned off when they join the room. */
  user_join_video_off: boolean;
  /** Whether a video with a preview of the content of the room is to be generated. */
  enable_room_previews: boolean | null;
  /** Enable/disable jitter buffer audio-video sync. */
  sync_audio_video: boolean | null;
  /** User-defined metadata for the room. */
  meta: Record<string, Record<string, unknown>> | null;
  /** Whether hand raises are prioritized in the room layout. */
  prioritize_handraise: boolean;
  /** Active session information for the room. */
  active_session?: ActiveSession;
  /** Timestamp when the room was created. */
  created_at: string;
  /** Timestamp when the room was last updated. */
  updated_at: string;
}

/** Room session response object. */
export interface RoomSession {
  /** Unique ID of the session. */
  id: string;
  /** Unique ID of the Room if the Session was created from a Room and was not an auto-created Session. Null if the room was set to delete on end. */
  room_id: string | null;
  /** The named identifier of the room session. */
  name: string | null;
  /** Display name of the room. Maximum of 200 characters. Defaults to the value of name. */
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
  /** If room previews are enabled and the room session is in progress, this is the URL of the preview video. */
  preview_url: string | null;
  /** Whether raised hands are prioritized in the layout. */
  prioritize_handraise: boolean | null;
  /** Enable/disable jitter buffer audio-video sync. */
  sync_audio_video: boolean | null;
  /** The cost of the room session in dollars. */
  cost_in_dollars: number;
  /** Whether a video with a preview of the content of the room is to be generated. */
  enable_room_previews: boolean;
  /** URL of the locked room cover image. */
  locked_cover: string;
}

/** Room session event response object. */
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
  payload: Record<string, Record<string, unknown>>;
  /** Timestamp when the event was created. */
  created_at: string;
}

/** Room session member response object. */
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
  /** How long the Member stayed in the Room Session, in seconds. Null if the member has not yet joined. */
  duration: number | null;
  /** The cost of the member's participation in dollars. */
  cost_in_dollars: number;
}

/** Status of a room session. */
export type RoomSessionStatus = 'in-progress' | 'completed';

/** Room session summary, returned by the show endpoint. Omits list-only fields. */
export interface RoomSessionSummary {
  /** Unique ID of the session. */
  id: string;
  /** Unique ID of the Room if the Session was created from a Room and was not an auto-created Session. Null if the room was set to delete on end. */
  room_id: string | null;
  /** The named identifier of the room session. */
  name: string | null;
  /** Display name of the room. Maximum of 200 characters. Defaults to the value of name. */
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
  /** If room previews are enabled and the room session is in progress, this is the URL of the preview video. */
  preview_url: string | null;
  /** Whether raised hands are prioritized in the layout. */
  prioritize_handraise: boolean | null;
  /** Enable/disable jitter buffer audio-video sync. */
  sync_audio_video: boolean | null;
}

/** Valid permission scopes for room tokens. */
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

/** Room token response object. */
export interface RoomTokenResponse {
  /** A Room Token to be used by clients to connect to the Room. */
  token: string;
}

/** A video stream object. */
export interface Stream {
  /** Unique identifier for the stream. */
  id: string;
  /** RTMP or RTMPS URL. This must be the address of a server accepting incoming RTMP/RTMPS streams. */
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

/** Details about a specific error. */
export interface Types_StatusCodes_RestApiErrorItem {
  /** The category of error. */
  type: string;
  /** A specific error code. */
  code: string;
  /** A description of what caused the error. */
  message: string;
  /** The request parameter that caused the error, if applicable. */
  attribute?: string | null;
  /** A link to documentation about this error. */
  url: string;
}

/** The request is invalid. */
export interface Types_StatusCodes_StatusCode400 {
  error: 'Bad Request';
}

/** Access is unauthorized. */
export interface Types_StatusCodes_StatusCode401 {
  error: 'Unauthorized';
}

/** Access is forbidden. */
export interface Types_StatusCodes_StatusCode403 {
  error: 'Forbidden';
}

/** The server cannot find the requested resource. */
export interface Types_StatusCodes_StatusCode404 {
  error: 'Not Found';
}

/** An internal server error occurred. */
export interface Types_StatusCodes_StatusCode500 {
  error: 'Internal Server Error';
}

/** Request body for updating a conference. */
export interface UpdateConferenceRequest {
  /** Display name of the video conference. Maximum of 200 characters. */
  display_name: string;
  /** Description of the conference. Maximum of 3000 characters. */
  description?: string;
  /** Conference does not accept new participants before this time. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  join_from?: string;
  /** Conference stops accepting new participants at this time, but keeps running until all participants leave. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  join_until?: string;
  /** The conference's resolution. */
  quality?: VideoQuality;
  /** The conference's initial layout. */
  layout?: VideoLayout;
  /** The size of the video conference. */
  size?: ConferenceSize;
  /** Whether to start recording when a conference session begins. */
  record_on_start?: boolean;
  /** Whether a tone is played when a member enters or exits the conference. */
  tone_on_entry_and_exit?: boolean;
  /** Whether participants join with video off by room setting. */
  room_join_video_off?: boolean;
  /** Whether participants join with video off by user setting. */
  user_join_video_off?: boolean;
  /** Whether a preview video of the conference content is generated. */
  enable_room_previews?: boolean;
  /** Whether group chat is enabled for conference participants. */
  enable_chat?: boolean;
  /** CTA buttons and selected items color (dark theme). */
  dark_primary?: string;
  /** Main background color (dark theme). */
  dark_background?: string;
  /** Main foreground color (dark theme). */
  dark_foreground?: string;
  /** Success indication color (dark theme). */
  dark_success?: string;
  /** Error indication color (dark theme). */
  dark_negative?: string;
  /** CTA buttons and selected items color (light theme). */
  light_primary?: string;
  /** Main background color (light theme). */
  light_background?: string;
  /** Main foreground color (light theme). */
  light_foreground?: string;
  /** Success indication color (light theme). */
  light_success?: string;
  /** Error indication color (light theme). */
  light_negative?: string;
}

/** Request body for updating a room. */
export interface UpdateRoomRequest {
  /** Display name of the room. Maximum of 200 characters. Defaults to the value of name. */
  display_name?: string;
  /** Description of the room. Maximum of 3000 characters. */
  description?: string;
  /** The maximum number of members in the room at a time. Must be at least 1 to a maximum of 300. */
  max_members?: number;
  /** The room's resolution. */
  quality?: VideoQuality;
  /** Room does not accept new participants before this time. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  join_from?: string;
  /** Room stops accepting new participants at this time, but keeps running until all participants leave. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  join_until?: string;
  /** Remove users from the room at this time. Expects RFC 3339 datetime: `2022-01-01T23:59:60Z`. Date only: `2022-01-01` will be converted to `2022-01-01T00:00:00Z`. */
  remove_at?: string;
  /** Remove users after they are in the room for N seconds. */
  remove_after_seconds_elapsed?: number;
  /** The room's initial layout. */
  layout?: RoomLayout;
  /** Specifies whether to start recording a Room Session when one is started for this Room. */
  record_on_start?: boolean;
  /** Whether a video with a preview of the content of the room is to be generated. */
  enable_room_previews?: boolean;
  /** User-defined metadata for the room. Must be a valid JSON object. Maximum of 2000 characters when serialized. */
  meta?: Record<string, Record<string, unknown>>;
  /** Enable/disable jitter buffer audio-video sync. */
  sync_audio_video?: boolean;
}

/** Request body for updating a stream. */
export interface UpdateStreamRequest {
  /** RTMP or RTMPS URL. This must be the address of a server accepting incoming RTMP/RTMPS streams. */
  url: string;
}

/** Video frames per second. */
export type VideoFps = 20 | 30;

/** Video room layout options. */
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

/** A video log entry. Discarded logs return only `id`, `discarded_at`, and `created_at`. */
export type VideoLog = Log | DiscardedLog;

/** Video quality resolution. */
export type VideoQuality = '720p' | '1080p';

/** The request contains invalid parameters. See errors for details. */
export interface VideoStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export type GetConferenceTokenResponse = ConferenceToken;

export type ResetConferenceTokenResponse = ConferenceToken;

export type CreateVideoConferenceRequest = CreateConferenceRequest;

export type CreateVideoConferenceResponse = Conference;

export type ListVideoConferencesResponse = ListConferencesResponse;

export type GetVideoConferenceResponse = Conference;

export type UpdateVideoConferenceRequest = UpdateConferenceRequest;

export type UpdateVideoConferenceResponse = Conference;

export type ListConferenceStreamsResponse = ListStreamsResponse;

export type CreateConferenceStreamRequest = CreateStreamRequest;

export type CreateConferenceStreamResponse = Stream;

export type GetLogResponse = VideoLog;

export type GetRoomRecordingResponse = RoomRecording;

export type GetRoomSessionResponse = RoomSessionSummary;

export type CreateRoomTokenResponse = RoomTokenResponse;

export type CreateRoomResponse = RoomResponse;

export type GetRoomResponse = RoomResponse;

export type UpdateRoomResponse = RoomResponse;

export type ListRoomStreamsResponse = ListStreamsResponse;

export type CreateRoomStreamRequest = CreateStreamRequest;

export type CreateRoomStreamResponse = Stream;

export type GetRoomByNameResponse = RoomResponse;

export type GetStreamResponse = Stream;

export type UpdateStreamResponse = Stream;
