// AUTO-GENERATED from porting-sdk/rest-apis/fax/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

export interface ChargeDetail {
  /** Description for this charge. */
  description: string;
  /** Charged amount. */
  charge: number;
}

export interface FaxLog {
  /** A unique identifier for the log */
  id: uuid;
  /** The origin phone number in E.164 format. */
  from: string | null;
  /** The destination phone number in E.164 format. */
  to: string | null;
  /** The status of this fax call. */
  status:
    | 'queued'
    | 'initiated'
    | 'ringing'
    | 'in-progress'
    | 'busy'
    | 'failed'
    | 'no-answer'
    | 'canceled'
    | 'completed';
  /** The direction of this fax call. */
  direction: 'inbound' | 'outbound-api' | 'outbound-dial' | null;
  /** Source of this log entry. */
  source: 'laml';
  /** Type of this log entry. */
  type: 'laml_call';
  /** URL for the associated fax resource with this log entry. */
  url: string;
  /** Represents a customer hosted Fax server. */
  remote_station: string | null;
  /** The amount charged for this fax request. */
  charge: number;
  /** The number of pages the fax document contained. */
  number_of_pages: number | null;
  /** The quality that was set when the fax document was sent. */
  quality: 'fine' | 'standard' | 'superfine' | null;
  /** Details on charges associated with this log. */
  charge_details: ChargeDetail[];
  /** Date and time when the fax was created. */
  created_at: string;
  /** Error code for this resource (if available). */
  error_code: string | null;
  /** The description of this error (if available). */
  error_message: string | null;
}

/** The request contains invalid parameters. See errors for details. */
export interface FaxLogShowStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** The request contains invalid parameters. See errors for details. */
export interface FaxLogsListStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface LogListResponse {
  /** Object containing pagination links */
  links: LogPaginationResponse;
  /** Array of log data */
  data: FaxLog[];
}

export interface LogPaginationResponse {
  /** URL for the current page of results. */
  self: string;
  /** URL for the first page of results. */
  first: string;
  /** URL for the next page of results. Only present when more results are available. */
  next?: string;
  /** URL for the previous page of results. Only present when on page 1 or later. */
  prev?: string;
}

export interface LogResponse {
  /** A unique identifier for the log */
  id: uuid;
  /** The origin phone number in E.164 format. */
  from: string | null;
  /** The destination phone number in E.164 format. */
  to: string | null;
  /** The status of this fax call. */
  status:
    | 'queued'
    | 'initiated'
    | 'ringing'
    | 'in-progress'
    | 'busy'
    | 'failed'
    | 'no-answer'
    | 'canceled'
    | 'completed';
  /** The direction of this fax call. */
  direction: 'inbound' | 'outbound-api' | 'outbound-dial' | null;
  /** Source of this log entry. */
  source: 'laml';
  /** Type of this log entry. */
  type: 'laml_call';
  /** URL for the associated fax resource with this log entry. */
  url: string;
  /** Represents a customer hosted Fax server. */
  remote_station: string | null;
  /** The amount charged for this fax request. */
  charge: number;
  /** The number of pages the fax document contained. */
  number_of_pages: number | null;
  /** The quality that was set when the fax document was sent. */
  quality: 'fine' | 'standard' | 'superfine' | null;
  /** Details on charges associated with this log. */
  charge_details: ChargeDetail[];
  /** Date and time when the fax was created. */
  created_at: string;
  /** Error code for this resource (if available). */
  error_code: string | null;
  /** The description of this error (if available). */
  error_message: string | null;
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

/** The server cannot find the requested resource. */
export interface Types_StatusCodes_StatusCode404 {
  error: 'Not Found';
}

/** An internal server error occurred. */
export interface Types_StatusCodes_StatusCode500 {
  error: 'Internal Server Error';
}

/** Universal Unique Identifier. */
export type uuid = string;

export type ListFaxLogsResponse = LogListResponse;

export type GetFaxLogResponse = LogResponse;
