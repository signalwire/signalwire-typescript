// AUTO-GENERATED from porting-sdk/rest-apis/message/openapi.yaml — DO NOT EDIT.
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

export interface LogListResponse {
  /** Object containing pagination links */
  links: LogPaginationResponse;
  /** Array of message log entries */
  data: MessageLog[];
}

export interface LogPaginationResponse {
  /** URL to current page */
  self: string;
  /** URL to first page */
  first: string;
  /** URL to next page (if available) */
  next?: string;
  /** URL to previous page (if available) */
  prev?: string;
}

/** Response model for message log retrieve endpoint */
export interface LogRetrieveResponse {
  /** A unique identifier for the log. */
  id: uuid;
  /** The origin phone number. */
  from: string;
  /** The destination phone number. */
  to: string;
  /** The status of the message. */
  status: 'queued' | 'initiated' | 'delivered' | 'sent' | 'received' | 'undelivered' | 'failed';
  /** The direction of the message. */
  direction: 'inbound' | 'outbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  /** The kind of message. */
  kind: 'sms' | 'mms';
  /** Source of this log entry. */
  source: 'realtime_api' | 'laml';
  /** Type of this log entry. */
  type: 'relay_message' | 'laml_message';
  /** URL for the resource associated with this log entry. Null for Relay messages. */
  url: string | null;
  /** The number of segments. */
  number_of_segments: number;
  /** The charge in dollars. */
  charge: number;
  /** Details on charges associated with this log. */
  charge_details: ChargeDetail[];
  /** Date and time when the message entry was created. */
  created_at: string;
}

/** Message log entry with all activity details */
export interface MessageLog {
  /** A unique identifier for the log. */
  id: uuid;
  /** The origin phone number. */
  from: string;
  /** The destination phone number. */
  to: string;
  /** The status of the message. */
  status: 'queued' | 'initiated' | 'delivered' | 'sent' | 'received' | 'undelivered' | 'failed';
  /** The direction of the message. */
  direction: 'inbound' | 'outbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  /** The kind of message. */
  kind: 'sms' | 'mms';
  /** Source of this log entry. */
  source: 'realtime_api' | 'laml';
  /** Type of this log entry. */
  type: 'relay_message' | 'laml_message';
  /** URL for the resource associated with this log entry. Null for Relay messages. */
  url: string | null;
  /** The number of segments. */
  number_of_segments: number;
  /** The charge in dollars. */
  charge: number;
  /** Details on charges associated with this log. */
  charge_details: ChargeDetail[];
  /** Date and time when the message entry was created. */
  created_at: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface MessageLogShowStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** The request contains invalid parameters. See errors for details. */
export interface MessageLogsListStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
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
