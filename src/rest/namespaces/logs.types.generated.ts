// AUTO-GENERATED from porting-sdk/rest-apis/logs/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

export interface ChargeDetails {
  /** Description for this charge. */
  description: string;
  /** Charge amount in dollars. */
  charge: string;
}

/** Pagination links for conference log list responses. */
export interface ConferenceLogPaginationLinks {
  /** Link to the current page. */
  self: string;
  /** Link to the first page. */
  first: string;
  /** Link to the next page. Only present when there are more results. */
  next?: string;
  /** Link to the previous page. Only present when not on the first page. */
  prev?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface ConferenceLogsStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** Response containing a list of conferences. */
export interface ConferencesResponse {
  /** Pagination links. */
  links: ConferenceLogPaginationLinks;
  /** A list of conference logs. */
  data: CxmlConference | RelayConference | VideoRoomSessionConference[];
}

/** Core conference object. */
export interface CxmlConference {
  /** Unique identifier for the conference. */
  id: string;
  /** Creation timestamp. */
  created_at: string;
  /** Project ID of the conference. */
  project_id: uuid;
  /** Region of the conference. */
  region: string;
  /** Name of the conference. */
  name: string | null;
  /** Status of the conference. */
  status: string | null;
  /** Maximum size of the conference. */
  max_size: number | null;
  /** Current participants in the conference. */
  current_participants: number;
  /** Updated timestamp. */
  updated_at: string;
  /** Type of the conference. */
  type: 'cxml_conference';
}

/** Core conference object. */
export interface RelayConference {
  /** Unique identifier for the conference. */
  id: string;
  /** Creation timestamp. */
  created_at: string;
  /** Project ID of the conference. */
  project_id: uuid;
  /** Region of the conference. */
  region: string;
  /** Name of the conference. */
  name: string | null;
  /** Status of the conference. */
  status: string | null;
  /** Maximum size of the conference. */
  max_size: number | null;
  /** Current participants in the conference. */
  current_participants: number;
  /** Updated timestamp. */
  updated_at: string;
  /** Type of the conference. */
  type: 'relay_conference';
  /** Recording URL of the conference. */
  recording_url: string | null;
  /** Recording duration of the conference. */
  recording_duration: number | null;
  /** Recording file size of the conference. */
  recording_file_size: number | null;
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

/** Access is unauthorized. */
export interface Types_StatusCodes_StatusCode401 {
  error: 'Unauthorized';
}

/** An internal server error occurred. */
export interface Types_StatusCodes_StatusCode500 {
  error: 'Internal Server Error';
}

/** Core conference object. */
export interface VideoRoomSessionConference {
  /** Unique identifier for the conference. */
  id: string;
  /** Creation timestamp. */
  created_at: string;
  /** Source of the conference. */
  source: string;
  /** Type of the conference. */
  type: 'video_conference_session' | 'video_room_session';
  /** URL of the conference room session. */
  url: string;
  /** Name of the conference room. */
  room_name: string | null;
  /** Status of the conference. */
  status: string | null;
  /** Whether the conference is locked. */
  locked: boolean;
  /** Timestamp when the conference started. */
  started_at: string | null;
  /** Timestamp when the conference ended. */
  ended_at: string | null;
  /** Total charge amount of the conference in dollars. */
  charge: string;
  /** Details on charges associated with this conference. */
  charge_details: ChargeDetails[];
}

/** Universal Unique Identifier. */
export type uuid = string;

export type ListConferencesResponse = ConferencesResponse;
