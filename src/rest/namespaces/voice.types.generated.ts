// AUTO-GENERATED from porting-sdk/rest-apis/voice/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** Details on charges associated with this log. */
export interface ChargeDetail {
  /** Description for this charge. */
  description: string;
  /** Charged amount. */
  charge: number;
}

/** Voice log for Dialogflow call types. Returned when `type` is `dialogflow_call`. */
export interface DialogflowVoiceLog {
  /** A unique identifier for the log. */
  id: uuid;
  /** The origin phone number. */
  from: string;
  /** The destination phone number. */
  to: string;
  /** Source of this log entry. */
  source: VoiceSources;
  /** The charge in dollars. */
  charge: number;
  /** Details on charges associated with this log. */
  charge_details: ChargeDetail[];
  /** Date and time when the call entry was created. */
  created_at: string;
  /** Type of this log entry. */
  type: 'dialogflow_call';
  /** Always null for this call type. */
  url: null;
  /** The status of the voice activity. */
  status: VoiceLogStatus;
  /** The duration of the voice activity in seconds. */
  duration: number | null;
}

/** A discarded/deleted voice log entry. Returned when the log has been deleted. Only present when `include_deleted` is `true`. */
export interface DiscardedVoiceLog {
  /** A unique identifier for the log. */
  id: uuid;
  /** Date and time when the log was discarded. */
  discarded_at: string;
  /** Date and time when the log was originally created. */
  created_at: string;
}

/** Voice log for Fabric Subscriber Device call types. Returned when `type` is `fabric_subscriber_device_leg`. */
export interface FabricVoiceLog {
  /** A unique identifier for the log. */
  id: uuid;
  /** The origin phone number. */
  from: string;
  /** The destination phone number. */
  to: string;
  /** Source of this log entry. */
  source: VoiceSources;
  /** The charge in dollars. */
  charge: number;
  /** Details on charges associated with this log. */
  charge_details: ChargeDetail[];
  /** Date and time when the call entry was created. */
  created_at: string;
  /** Type of this log entry. */
  type: 'fabric_subscriber_device_leg';
  /** Always null for this call type. */
  url: null;
  /** The direction of the voice activity. */
  direction: VoiceDirection;
  /** The status of the voice activity. Always null for this call type. */
  status: VoiceLogStatus | null;
}

/** Event entry for a voice log */
export interface LogEvent {
  /** Timestamp when the event occurred. */
  event_at: string;
  /** Log level of the event. */
  level: 'info' | 'warn' | 'error' | 'debug';
  /** Name of the event. */
  name: string;
  /** Additional details about the event. Structure varies by event type. */
  details: Record<string, unknown>;
  /** Unique identifier for the project. */
  project_id: uuid;
  /** Unique identifier for the log. */
  log_id: uuid;
}

/** Response model for log events list endpoint */
export interface LogEventsListResponse {
  /** Array of event entries for the log */
  data: LogEvent[];
}

/** Response model for voice log list endpoint */
export interface LogListResponse {
  /** Pagination links */
  links: LogPaginationResponse;
  /** Array of voice log entries */
  data: VoiceLog[];
}

/** Pagination links for voice log list responses */
export interface LogPaginationResponse {
  /** URL of the current page. */
  self: string;
  /** URL of the first page. */
  first: string;
  /** URL of the next page. Absent on the last page. */
  next?: string;
  /** URL of the previous page. Absent on the first page. */
  prev?: string;
}

/** Voice log for Compatibility and Relay call types. Returned when `type` is `laml_call`, `relay_pstn_call`, `relay_sip_call`, or `relay_webrtc_call`. */
export interface RelayVoiceLog {
  /** A unique identifier for the log. */
  id: uuid;
  /** The origin phone number. */
  from: string;
  /** The destination phone number. */
  to: string;
  /** Source of this log entry. */
  source: VoiceSources;
  /** The charge in dollars. */
  charge: number;
  /** Details on charges associated with this log. */
  charge_details: ChargeDetail[];
  /** Date and time when the call entry was created. */
  created_at: string;
  /** Type of this log entry. */
  type: RelayVoiceType;
  /** URL for the resource associated with this log entry. Present for LAML calls, null for Relay calls. */
  url: string | null;
  /** The direction of the voice activity. */
  direction: VoiceDirection;
  /** The status of the voice activity. */
  status: VoiceLogStatus;
  /** The duration of the voice activity in seconds. */
  duration: number | null;
  /** The duration of the voice activity in milliseconds. */
  duration_ms: number | null;
  /** The billable duration of the voice activity in milliseconds. */
  billing_ms: number | null;
  /** Parent log identifier for related call entries. */
  parent_id: string | null;
}

export type RelayVoiceType =
  'laml_call' | 'relay_pstn_call' | 'relay_sip_call' | 'relay_webrtc_call';

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

/** The server cannot find the requested resource. */
export interface Types_StatusCodes_StatusCode404 {
  error: 'Not Found';
}

/** The request contains invalid parameters. See errors for details. */
export interface Types_StatusCodes_StatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** An internal server error occurred. */
export interface Types_StatusCodes_StatusCode500 {
  error: 'Internal Server Error';
}

/** Voice log for audio legs in a Video Room. Returned when `type` is `video_room_pstn_leg` or `video_room_sip_leg`. */
export interface VideoRoomVoiceLog {
  /** A unique identifier for the log. */
  id: uuid;
  /** The origin phone number. */
  from: string;
  /** The destination phone number. */
  to: string;
  /** Source of this log entry. */
  source: VoiceSources;
  /** The charge in dollars. */
  charge: number;
  /** Details on charges associated with this log. */
  charge_details: ChargeDetail[];
  /** Date and time when the call entry was created. */
  created_at: string;
  /** Type of this log entry. */
  type: VideoRoomVoiceType;
  /** Always null for this call type. */
  url: null;
  /** The direction of the voice activity. */
  direction: VoiceDirection;
  /** The status of the voice activity. */
  status: VoiceLogStatus;
  /** The duration of the voice activity in seconds. */
  duration: number | null;
  /** The duration of the voice activity in milliseconds. */
  duration_ms: number | null;
}

export type VideoRoomVoiceType = 'video_room_pstn_leg' | 'video_room_sip_leg';

export type VoiceDirection = 'inbound' | 'outbound' | 'outbound-api' | 'outbound-dial';

/** A voice log entry. The specific fields present depend on the `type` value. Discarded logs return only `id`, `discarded_at`, and `created_at`. */
export type VoiceLog =
  RelayVoiceLog | VideoRoomVoiceLog | DialogflowVoiceLog | FabricVoiceLog | DiscardedVoiceLog;

export type VoiceLogStatus =
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled'
  | 'completed'
  | 'ended'
  | 'answered'
  | 'created'
  | 'ending'
  | 'joined';

/** The request contains invalid parameters. See errors for details. */
export interface VoiceLogsListStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export type VoiceSources = 'dialogflow' | 'laml' | 'realtime_api';

/** Universal Unique Identifier. */
export type uuid = string;
