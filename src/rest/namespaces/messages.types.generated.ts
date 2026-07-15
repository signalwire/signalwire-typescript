// AUTO-GENERATED from porting-sdk/rest-apis/messages/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** Request body for sending a new SMS or MMS message. */
export interface CreateMessageRequest {
  /** Destination phone number in E.164 format (`+` followed by 5-17 digits). Also accepts passthrough numbers like `988`/`+988`. */
  to: string;
  /** Source phone number. Must be a purchased SignalWire phone number on the project in E.164 format, or a shortcode (5-6 digits). Verified caller IDs are not permitted. */
  from: string;
  /** Message body text. Required if `media` is not provided. Subject to provider-specific character limits. */
  body?: string;
  /** Array of HTTP or HTTPS URLs for media attachments. Presence of media makes the message MMS. Maximum 8 items. */
  media?: string[];
  /** Force the message to be sent as MMS even when no media attachments are provided. */
  send_as_mms?: boolean;
  /** A valid URL to receive message status callback events at each state change. See the [Message status callback](/docs/apis/rest/messages/webhooks/message-status-callback) webhook for the payload your URL will receive. */
  status_callback?: string;
  /** Your own key/value string pairs to attach to the message — for example, an order or case number you want to recognize later. When you also set `status_callback`, SignalWire includes these pairs as a `custom_variables` object in every status callback it sends to that URL, so you can match each callback to a record in your own system. If you don't set `status_callback`, there is nowhere for the variables to be delivered. */
  custom_variables?: Record<string, string>;
}

/** Request body for redacting the body of a previously sent message. Only `body` may be updated, and it must be an empty string. */
export interface UpdateMessageRequest {
  /** Must be an empty string (`""`) to redact the message. Any non-empty value is rejected with `body_must_be_empty`. This is the only field that can be updated. */
  body: string;
}

/** A message record. Returned by the create and update endpoints. */
export interface Message {
  /** The unique ID of the message. This is the `MessageSegment` ID, consistent with the dashboard and the `/api/messaging/logs` endpoint. */
  id: uuid;
  /** The source phone number. */
  from: string;
  /** The destination phone number. */
  to: string;
  /** The message body text. Returns an empty string when the message has been redacted. */
  body: string;
  status: MessageStatus;
  direction: MessageDirection;
  kind: MessageKind;
  /** Array of URLs for any media attachments on the message. Empty for SMS. */
  media: string[];
  /** Number of segments the message body was split into for delivery. */
  number_of_segments: number;
  /** Provider-specific error code if delivery failed. Null when no error occurred. */
  error_code: string | null;
  /** Human-readable error message if delivery failed. Null when no error occurred. */
  error_message: string | null;
  /** Date and time when the message was created. */
  created_at: string;
  /** The ID of the project the message belongs to. */
  project_id: uuid;
  /** Callback URL configured to receive message status events. Null if no callback was configured. */
  status_callback_url: string | null;
  /** Relative URL for retrieving the message via the `/api/messaging/logs` endpoint. */
  message_uri: string;
}

/** Delivery state of a message. */
export type MessageStatus =
  'queued' | 'initiated' | 'sent' | 'delivered' | 'undelivered' | 'failed' | 'read';

/** The direction of a message. */
export type MessageDirection = 'inbound' | 'outbound';

/** The kind of message. */
export type MessageKind = 'sms' | 'mms';

/** The request contains invalid parameters. See errors for details. */
export interface MessagesCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** The request contains invalid parameters. See errors for details. */
export interface MessagesUpdateStatusCode422 {
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
