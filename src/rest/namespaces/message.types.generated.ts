// AUTO-GENERATED from porting-sdk/rest-apis/message/openapi.enriched.yaml — DO NOT EDIT.
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
  status:
    'queued' | 'initiated' | 'delivered' | 'sent' | 'received' | 'undelivered' | 'failed' | 'read';
  /** The direction of the message. */
  direction: 'inbound' | 'outbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  /** The kind of message. */
  kind: 'sms' | 'mms' | 'whatsapp';
  /** Source of this log entry. */
  source: 'realtime_api' | 'laml' | 'swml';
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
  /** The error code, if the message failed. */
  error_code?: string | null;
  /** The error message, if the message failed. */
  error_message?: string | null;
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
  status:
    'queued' | 'initiated' | 'delivered' | 'sent' | 'received' | 'undelivered' | 'failed' | 'read';
  /** The direction of the message. */
  direction: 'inbound' | 'outbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  /** The kind of message. */
  kind: 'sms' | 'mms' | 'whatsapp';
  /** Source of this log entry. */
  source: 'realtime_api' | 'laml' | 'swml';
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
  /** The error code, if the message failed. */
  error_code?: string | null;
  /** The error message, if the message failed. */
  error_message?: string | null;
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

/** A WhatsApp Business Account (WABA) connected to your SignalWire Space. Each business account can have its own set of phone numbers and message templates. */
export interface WhatsappBusiness {
  /** The SignalWire identifier for the WhatsApp Business Account. Use this value as `whatsapp_business_id` when creating or listing templates. */
  whatsapp_business_id: uuid;
  /** The business name as registered with Meta. */
  business_name: string | null;
  /** The Meta business portfolio ID associated with the account. */
  business_portfolio_id: string | null;
  /** The WhatsApp Business Account ID (WABA ID) assigned by Meta. */
  waba_id: string;
  /** The date and time when the record was created. */
  created_at: string;
  /** The date and time when the record was last updated. */
  updated_at: string;
}

/** Response containing a list of WhatsApp Business Accounts. */
export interface WhatsappBusinessListResponse {
  /** List of WhatsApp Business Accounts connected to the Space. */
  data: WhatsappBusiness[];
}

/** A WhatsApp phone number connected to your Space. Numbers are linked during the Meta embedded signup flow and used as the `from` address when sending messages. */
export interface WhatsappNumber {
  /** The SignalWire identifier of the WhatsApp number. */
  id: uuid;
  /** The Meta phone number ID for this WhatsApp number. */
  business_phone_number_id: string | null;
  /** The WhatsApp number, prefixed with `whatsapp:`. Use this value as the `from` address when sending messages. */
  phone_number: string | null;
  /** The ID of the resource (Call Flow, AI Agent, SWML script, etc.) that handles inbound calls to this number. Null if no calling handler is configured. */
  calling_handler_resource_id: uuid | null;
  /** The ID of the resource that handles inbound messages to this number. Null if no messaging handler is configured. */
  messaging_handler_resource_id: uuid | null;
  /** The business name as registered with Meta. */
  business_name: string | null;
  /** The WhatsApp Business Account ID (WABA ID) assigned by Meta. */
  waba_id: string;
  /** The SignalWire identifier of the WhatsApp Business Account this number belongs to. */
  whatsapp_business_id: uuid;
  /** Whether calling is enabled for this number. Turn it on from the **SIP Calling** column of the WhatsApp Numbers tab in your Dashboard, as described in [Enable voice on a WhatsApp number](/docs/platform/voice/whatsapp/enable-voice). */
  voice_enabled: boolean;
  /** Whether this number can receive calls — true when `voice_enabled` is true and a calling handler is attached. See [Receive WhatsApp calls](/docs/platform/voice/whatsapp/receive-calls). */
  voice_capable: boolean;
  /** The date and time when the record was created. */
  created_at: string;
  /** The date and time when the record was last updated. */
  updated_at: string;
}

/** Response containing a list of WhatsApp numbers. */
export interface WhatsappNumberListResponse {
  /** List of WhatsApp numbers available to the Space. */
  data: WhatsappNumber[];
}

/** The category of a WhatsApp message template. */
export type WhatsappTemplateCategory = 'utility' | 'marketing' | 'authentication';

/** How the template's variable placeholders are referenced. */
export type WhatsappTemplateParameterFormat = 'named' | 'positional';

/** The Meta approval status of a template. A template must be `approved` before it can be used to send messages. */
export type WhatsappTemplateStatus =
  | 'approved'
  | 'archived'
  | 'deleted'
  | 'disabled'
  | 'flagged'
  | 'in_appeal'
  | 'limit_exceeded'
  | 'locked'
  | 'paused'
  | 'pending'
  | 'reinstated'
  | 'pending_deletion'
  | 'rejected';

/** A template component. The `type` is one of `HEADER`, `BODY`, `FOOTER`, or `BUTTONS`. Additional fields depend on the component type — for example, a `BODY` carries `text`, while `BUTTONS` carries a `buttons` array. See the create example for the full shape. */
export type WhatsappTemplateComponent = Record<string, unknown>;

/** A WhatsApp message template. */
export interface WhatsappTemplate {
  /** The SignalWire identifier of the template. */
  id: uuid;
  /** The template name. Lowercase letters, numbers, and underscores only. */
  name: string;
  /** The template category. */
  category: WhatsappTemplateCategory;
  /** The template's components (header, body, footer, buttons). */
  components: WhatsappTemplateComponent[];
  /** The template language code. */
  language: string;
  /** How the template's variable placeholders are referenced. */
  parameter_format: WhatsappTemplateParameterFormat;
  /** Meta's identifier for the template. */
  template_id: string | null;
  /** The Meta approval status of the template. */
  template_status: WhatsappTemplateStatus | null;
  /** The SignalWire identifier of the WhatsApp Business Account the template belongs to. */
  whatsapp_business_id: uuid;
  /** The date and time when the template was created. */
  created_at: string;
  /** The date and time when the template was last updated. */
  updated_at: string;
  /** The date and time when the template was discarded, if applicable. */
  discarded_at?: string;
}

/** Response containing a list of message templates. */
export interface WhatsappTemplateListResponse {
  /** List of message templates. */
  data: WhatsappTemplate[];
}

/** Request body for creating a message template. */
export interface CreateWhatsappTemplateRequest {
  /** The WhatsApp Business Account the template belongs to. List your accounts at `GET /api/messaging/whatsapp/businesses`. */
  whatsapp_business_id: uuid;
  /** The template name. Maximum 512 characters; lowercase letters, numbers, and underscores only. */
  name: string;
  /** The template language code. */
  language: string;
  /** The template category. */
  category: WhatsappTemplateCategory;
  /** How the template's variable placeholders are referenced. */
  parameter_format: WhatsappTemplateParameterFormat;
  /** The template's components. Must include a `BODY` component. Each component is an object whose fields depend on its `type` — see the request example. */
  components: WhatsappTemplateComponent[];
}

/** Request body for updating a template. Provide `category`, `components`, or both. A template can only be updated while it is not yet approved. */
export interface UpdateWhatsappTemplateRequest {
  /** The updated template category. Required if `components` is omitted. */
  category?: WhatsappTemplateCategory;
  /** The updated components. Required if `category` is omitted. */
  components?: WhatsappTemplateComponent[];
}

/** Response returned when a template has been deleted. */
export interface WhatsappTemplateDeleteResponse {
  /** Whether the template was deleted successfully at Meta. */
  success: boolean;
  /** Empty array when the deletion succeeds; otherwise the error details returned by Meta. */
  errors: Record<string, unknown>;
}

/** The request contains invalid parameters. See errors for details. */
export interface WhatsappStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** Details about a specific error. */
export interface WhatsappTemplateErrorItem {
  detail: string;
  status: '422';
  title: string;
  /** A specific error code. */
  code: string;
  subcode?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface WhatsappTemplateStatusCode422 {
  /** List of validation errors. */
  errors: WhatsappTemplateErrorItem[];
}

/** Universal Unique Identifier. */
export type uuid = string;
