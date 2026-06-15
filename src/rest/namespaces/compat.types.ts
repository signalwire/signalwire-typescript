/**
 * Compatibility (Twilio-compatible LAML / cXML) API types.
 *
 * Hand-derived from the canonical OpenAPI contract at
 * `porting-sdk/rest-apis/compatibility/openapi.yaml`. Each interface mirrors a
 * `components/schemas` definition; field names are the wire (snake_case) keys
 * exactly as the platform emits/accepts them. Request-body interfaces use the
 * LAML PascalCase form keys.
 *
 * These are compile-time annotations only — they do not affect runtime behavior
 * or wire shape.
 */

/** Response containing a list of accounts. */
export interface AccountListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page. Null if there are no more results. */
  next_page_uri: string | null;
  /** The URI of the previous page. Null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number (zero-indexed). */
  page: number;
  /** The number of results per page. */
  page_size: number;
  /** List of accounts. */
  accounts: Account[];
}

/** Account/Project model representing a SignalWire project. */
export interface Account {
  /** The unique identifier for this Project. */
  sid: string;
  /** The name of the Project. */
  friendly_name: string;
  /** The status of the Project. Always 'active'. */
  status: AccountStatus;
  /** The authorization token for this Project. Always returns 'redacted' for security. */
  auth_token: string;
  /** The date and time this Project was created, in RFC 2822 format. */
  date_created: string;
  /** The date and time this Project was last updated, in RFC 2822 format. */
  date_updated: string;
  /** The type of the Project. Always 'Full'. */
  type: AccountType;
  /** The Project ID of the parent project. For parent projects, this is the same as sid. */
  owner_account_sid: string;
  /** The preferred region for the Project. */
  region_preference: string;
  /** The URI for the Project. */
  uri: string;
  /** Whether this project is a sub-project of another project. */
  subproject: boolean;
  /** The signing key for the Project. Only returned once when a subproject is created. Subsequent requests return null. */
  signing_key: string | null;
  /** A map of URIs for sub-resources linked to this Project. */
  subresource_uris: SubresourceUris;
}

/** Response containing a single account. */
export interface AccountResponse {
  /** The unique identifier for this Project. */
  sid: string;
  /** The name of the Project. */
  friendly_name: string;
  /** The status of the Project. Always 'active'. */
  status: AccountStatus;
  /** The authorization token for this Project. Always returns 'redacted' for security. */
  auth_token: string;
  /** The date and time this Project was created, in RFC 2822 format. */
  date_created: string;
  /** The date and time this Project was last updated, in RFC 2822 format. */
  date_updated: string;
  /** The type of the Project. Always 'Full'. */
  type: AccountType;
  /** The Project ID of the parent project. For parent projects, this is the same as sid. */
  owner_account_sid: string;
  /** The preferred region for the Project. */
  region_preference: string;
  /** The URI for the Project. */
  uri: string;
  /** Whether this project is a sub-project of another project. */
  subproject: boolean;
  /** The signing key for the Project. Only returned once when a subproject is created. Subsequent requests return null. */
  signing_key: string | null;
  /** A map of URIs for sub-resources linked to this Project. */
  subresource_uris: SubresourceUris;
}

/** Request body for updating an account. */
export interface UpdateAccountRequest {
  /** The new name for the Project. */
  FriendlyName: string;
}

/** Request body for creating a subproject. */
export interface CreateSubprojectRequest {
  /** The name of the Project, up to 250 characters long. */
  FriendlyName: string;
}

/** Response containing a list of applications. */
export interface ApplicationListResponse {
  /** The URI for this resource. */
  uri: string;
  /** The URI for the first page of results. */
  first_page_uri: string;
  /** The URI for the next page of results. Null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI for the previous page of results. Null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number. Zero-indexed. */
  page: number;
  /** The number of results per page. */
  page_size: number;
  /** List of applications. */
  applications: Application[];
}

/** Application model representing a cXML application. */
export interface Application {
  /** The unique identifier for the Application. */
  sid: string;
  /** The unique identifier for the Account that created this Application. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The date, in RFC 2822 GMT format, this Application was created. */
  date_created: string;
  /** The date, in RFC 2822 GMT format, this Application was updated. */
  date_updated: string;
  /** A named unique identifier for the resource. */
  friendly_name: string;
  /** The URI for this Application. */
  uri: string;
  /** The URL to request when a phone number receives a call or fax. */
  voice_url: string | null;
  /** Whether the request to `VoiceUrl` is a `GET` or a `POST`. Default is `POST`. */
  voice_method: string | null;
  /** The URL SignalWire will request if errors occur when fetching the `VoiceUrl`. */
  voice_fallback_url: string | null;
  /** Whether the request to `VoiceFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  voice_fallback_method: string | null;
  /** The URL to pass status updates to the Application. */
  status_callback: string | null;
  /** Whether the request to the `StatusCallback` URL is a `GET` or a `POST`. Default is `POST`. */
  status_callback_method: string | null;
  /** Whether or not to look up a caller's ID from the database. Always null. */
  voice_caller_id_lookup: boolean | null;
  /** The URL to request when an SMS is received. */
  sms_url: string | null;
  /** Whether the request to `SmsUrl` is a `GET` or a `POST`. Default is `POST`. */
  sms_method: string | null;
  /** The URL SignalWire will request if errors occur when fetching the `SmsUrl`. */
  sms_fallback_url: string | null;
  /** Whether the request to `SmsFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  sms_fallback_method: string | null;
  /** The URL to receive status updates for messages sent via this Application. */
  sms_status_callback: string | null;
  /** Whether the request to `SmsStatusCallback` is a `GET` or a `POST`. Default is `POST`. */
  sms_status_callback_method: string | null;
  /** The URL to receive status updates for messages sent via this Application. */
  message_status_callback: string | null;
}

/** Response containing a single application. */
export interface ApplicationResponse {
  /** The unique identifier for the Application. */
  sid: string;
  /** The unique identifier for the Account that created this Application. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The date, in RFC 2822 GMT format, this Application was created. */
  date_created: string;
  /** The date, in RFC 2822 GMT format, this Application was updated. */
  date_updated: string;
  /** A named unique identifier for the resource. */
  friendly_name: string;
  /** The URI for this Application. */
  uri: string;
  /** The URL to request when a phone number receives a call or fax. */
  voice_url: string | null;
  /** Whether the request to `VoiceUrl` is a `GET` or a `POST`. Default is `POST`. */
  voice_method: string | null;
  /** The URL SignalWire will request if errors occur when fetching the `VoiceUrl`. */
  voice_fallback_url: string | null;
  /** Whether the request to `VoiceFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  voice_fallback_method: string | null;
  /** The URL to pass status updates to the Application. */
  status_callback: string | null;
  /** Whether the request to the `StatusCallback` URL is a `GET` or a `POST`. Default is `POST`. */
  status_callback_method: string | null;
  /** Whether or not to look up a caller's ID from the database. Always null. */
  voice_caller_id_lookup: boolean | null;
  /** The URL to request when an SMS is received. */
  sms_url: string | null;
  /** Whether the request to `SmsUrl` is a `GET` or a `POST`. Default is `POST`. */
  sms_method: string | null;
  /** The URL SignalWire will request if errors occur when fetching the `SmsUrl`. */
  sms_fallback_url: string | null;
  /** Whether the request to `SmsFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  sms_fallback_method: string | null;
  /** The URL to receive status updates for messages sent via this Application. */
  sms_status_callback: string | null;
  /** Whether the request to `SmsStatusCallback` is a `GET` or a `POST`. Default is `POST`. */
  sms_status_callback_method: string | null;
  /** The URL to receive status updates for messages sent via this Application. */
  message_status_callback: string | null;
}

/** Request body for creating an application. */
export interface CreateApplicationRequest {
  /** A named unique identifier for the resource. */
  FriendlyName: string;
  /** The URL to request when a phone number receives a call or fax. */
  VoiceUrl?: string;
  /** Whether the request to `VoiceUrl` is a `GET` or a `POST`. Default is `POST`. */
  VoiceMethod?: 'GET' | 'POST';
  /** The URL SignalWire will request if errors occur when fetching the `VoiceUrl`. */
  VoiceFallbackUrl?: string;
  /** Whether the request to `VoiceFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  VoiceFallbackMethod?: 'GET' | 'POST';
  /** The URL to pass status updates to the Application. */
  StatusCallback?: string;
  /** Whether the request to the `StatusCallback` URL is a `GET` or a `POST`. Default is `POST`. */
  StatusCallbackMethod?: 'GET' | 'POST';
  /** The URL to request when an SMS is received. */
  SmsUrl?: string;
  /** Whether the request to `SmsUrl` is a `GET` or a `POST`. Default is `POST`. */
  SmsMethod?: 'GET' | 'POST';
  /** The URL SignalWire will request if errors occur when fetching the `SmsUrl`. */
  SmsFallbackUrl?: string;
  /** Whether the request to `SmsFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  SmsFallbackMethod?: 'GET' | 'POST';
  /** The URL to receive status updates for messages sent via this Application. */
  SmsStatusCallback?: string;
  /** Whether the request to `SmsStatusCallback` is a `GET` or a `POST`. Default is `POST`. */
  SmsStatusCallbackMethod?: 'GET' | 'POST';
}

/** Request body for updating an application. */
export interface UpdateApplicationRequest {
  /** A named unique identifier for the resource. */
  FriendlyName: string;
  /** The URL to request when a phone number receives a call or fax. */
  VoiceUrl?: string;
  /** Whether the request to `VoiceUrl` is a `GET` or a `POST`. Default is `POST`. */
  VoiceMethod?: 'GET' | 'POST';
  /** The URL SignalWire will request if errors occur when fetching the `VoiceUrl`. */
  VoiceFallbackUrl?: string;
  /** Whether the request to `VoiceFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  VoiceFallbackMethod?: 'GET' | 'POST';
  /** The URL to pass status updates to the Application. */
  StatusCallback?: string;
  /** Whether the request to the `StatusCallback` URL is a `GET` or a `POST`. Default is `POST`. */
  StatusCallbackMethod?: 'GET' | 'POST';
  /** The URL to request when an SMS is received. */
  SmsUrl?: string;
  /** Whether the request to `SmsUrl` is a `GET` or a `POST`. Default is `POST`. */
  SmsMethod?: 'GET' | 'POST';
  /** The URL SignalWire will request if errors occur when fetching the `SmsUrl`. */
  SmsFallbackUrl?: string;
  /** Whether the request to `SmsFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  SmsFallbackMethod?: 'GET' | 'POST';
  /** The URL to receive status updates for messages sent via this Application. */
  SmsStatusCallback?: string;
  /** Whether the request to `SmsStatusCallback` is a `GET` or a `POST`. Default is `POST`. */
  SmsStatusCallbackMethod?: 'GET' | 'POST';
}

/** Response containing a list of available phone number resources (countries). */
export interface AvailablePhoneNumberResourcesResponse {
  /** The URI for the API call. */
  uri: string;
  /** List of available countries. */
  countries: CountryResource[];
}

/** Response containing available phone number resources for a specific country. */
export interface AvailablePhoneNumberByCountryResponse {
  /** The ISO country code of the number. */
  country_code: string;
  /** The country the number is from. */
  country: string;
  /** The URI for the API call. */
  uri: string;
  /** New numbers on SignalWire are marked as `beta`. */
  beta: boolean;
  /** URIs for subresources. */
  subresource_uris: CountrySubresourceUris;
}

/** Response containing a list of available phone numbers. */
export interface AvailablePhoneNumberListResponse {
  /** The URI for the API call. */
  uri: string;
  /** List of available phone numbers. */
  available_phone_numbers: AvailablePhoneNumber[];
}

/** Response containing a list of calls. */
export interface CallListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page. */
  next_page_uri: string | null;
  /** The URI of the previous page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of calls. */
  calls: Call[];
}

/** Response containing a single call. */
export interface CallResponse {
  /** The unique identifier for the call. */
  sid: string;
  /** The unique identifier for the account that created this call. */
  account_sid: string;
  /** The date, in RFC 2822 GMT format, this call was created. */
  date_created: string;
  /** The date, in RFC 2822 GMT format, this call was updated. */
  date_updated: string;
  /** The unique identifier for the call that created this call. */
  parent_call_sid: string | null;
  /** The address that received the call. */
  to: string;
  /** The formatted number that received the call. */
  formatted_to: string;
  /** The formatted number that received the call. Alias for formatted_to. */
  to_formatted: string;
  /** The address that initiated the call. */
  from: string;
  /** The formatted number that initiated the call. */
  formatted_from: string;
  /** The formatted number that initiated the call. Alias for formatted_from. */
  from_formatted: string;
  /** The unique identifier for the phone number. */
  phone_number_sid: string | null;
  /** The status of the call. */
  status: CallStatus;
  /** The time, in RFC 2822 GMT format, on which the call began. */
  start_time: string | null;
  /** The time, in RFC 2822 GMT format, on which the call was terminated. */
  end_time: string | null;
  /** The duration, in seconds, of the call. */
  duration: number;
  /** The charge for the call. */
  price: number | null;
  /** The currency, in ISO 4127 format, for the price of the call. */
  price_unit: string;
  /** The direction of the call. */
  direction: CallDirection;
  /** Who/what the call was answered by. */
  answered_by: AnsweredBy | null;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The number this call was forwarded from. Always null. */
  forwarded_from: string | null;
  /** The caller name. Always null. */
  caller_name: string | null;
  /** The URI for the call. */
  uri: string;
  /** A Map of available sub-resources. */
  subresource_uris: CallSubresourceUris;
  /** The annotation for the call. Always null. */
  annotation: string | null;
  /** The group SID for the call. Always null. */
  group_sid: string | null;
  /** The Mean Opinion Score for audio quality (1.0-5.0). */
  audio_in_mos: number | null;
  /** The SIP result code for the call. */
  sip_result_code: string | null;
  /** The average round-trip time for audio in milliseconds. */
  audio_rtt_avg: number | null;
  /** The minimum round-trip time for audio in milliseconds. */
  audio_rtt_min: number | null;
  /** The maximum round-trip time for audio in milliseconds. */
  audio_rtt_max: number | null;
  /** The minimum outbound audio jitter in milliseconds. */
  audio_out_jitter_min: number | null;
  /** The maximum outbound audio jitter in milliseconds. */
  audio_out_jitter_max: number | null;
  /** The average outbound audio jitter in milliseconds. */
  audio_out_jitter_avg: number | null;
  /** The number of outbound audio packets lost. */
  audio_out_lost: number | null;
}

/** Request body for creating a call. */
export interface CreateCallRequest {
  /** The address that received the call. Can be a phone number in E.164 format, a SIP URI, or a client identifier. */
  To: string;
  /** The address that initiated the call. Must be a phone number in E.164 format for PSTN calls. */
  From: string;
  /** The URL to handle the call. Required if `ApplicationSid` and `Laml`/`Twiml` are not used. */
  Url?: string;
  /** The unique identifier of the application used to handle the call. Required if `Url` and `Laml`/`Twiml` are not used. */
  ApplicationSid?: string;
  /** Whether the request to `Url` is a `GET` or a `POST`. Default is `POST`. */
  Method?: 'GET' | 'POST';
  /** The URL SignalWire will request if errors occur when fetching the `Url`. */
  FallbackUrl?: string;
  /** Whether the request to `FallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  FallbackMethod?: 'GET' | 'POST';
  /** The URL SignalWire will send webhooks to on every requested `StatusCallbackEvent` event. See the [Voice status callback](/docs/compatibility-api/rest/calls/webhooks/voice-status-callback) webhook for the payload your URL will receive. */
  StatusCallback?: string;
  /** Whether the request to `StatusCallback` URL is a `GET` or a `POST`. Default is `POST`. */
  StatusCallbackMethod?: 'GET' | 'POST';
  /** The status events that trigger a SignalWire webhook. Valid values: initiated, ringing, answered, completed, ringing_forwarded, ringing_queued. Defaults to `completed`. */
  StatusCallbackEvent?: string[];
  /** The number, in E.164 format, or identifier of the caller. Used to override the From for caller ID purposes. */
  CallerId?: string;
  /** The digits to press after a call is connected. Valid characters are 0-9, #, *, w (wait 0.5s), and W (wait 1s). */
  SendDigits?: string;
  /** The time in seconds SignalWire will wait before assuming the call has no answer. Default is `60` seconds. */
  Timeout?: number;
  /** Whether a human or machine picked up the call. Default is `none`. */
  MachineDetection?: 'Enable' | 'DetectMessageEnd' | 'none';
  /** The time in seconds SignalWire will wait for machine detection before timing out. Default is `30` seconds. */
  MachineDetectionTimeout?: number;
  /** How many milliseconds of voice to decide it is a machine. Default is `2400` milliseconds. */
  MachineDetectionSpeechThreshold?: number;
  /** Number of milliseconds to wait for voice to finish. Default is `1200` milliseconds. */
  MachineDetectionSpeechEndThreshold?: number;
  /** Number of milliseconds to wait for initial voice before giving up. Default is `5000` milliseconds. */
  MachineDetectionSilenceTimeout?: number;
  /** How many words to count to decide it is a machine. Default is `6`. */
  MachineWordsThreshold?: number;
  /** Whether or not to execute machine detection asynchronously. Default is `false`. */
  AsyncAmd?: boolean;
  /** Whether the request to `AsyncAmdStatusCallback` is a `GET` or a `POST`. Default is `POST`. */
  AsyncAmdStatusCallbackMethod?: 'GET' | 'POST';
  /** The URL to request when the machine detection is completed. */
  AsyncAmdStatusCallback?: string;
  /** Whether or not to report partial (interim) results to the callback url. Default is `false`. */
  AsyncAmdPartialResults?: boolean;
  /** Whether or not to record a call. Default is `false`. */
  Record?: boolean;
  /** The number of channels in the recording. Default is `mono`. */
  RecordingChannels?: 'mono' | 'dual';
  /** Specifies whether to record the `inbound`, `outbound`, or `both` audio. Default is `both`. */
  RecordingTrack?: 'inbound' | 'outbound' | 'both';
  /** The URL to request when recording is available. See the [Recording status callback](/docs/compatibility-api/rest/recordings/webhooks/recording-status-callback) webhook for the payload your URL will receive. */
  RecordingStatusCallback?: string;
  /** Whether the request to `RecordingStatusCallback` URL is a `GET` or a `POST`. Default is `POST`. */
  RecordingStatusCallbackMethod?: 'GET' | 'POST';
  /** The recording status events that trigger a webhook. Space-separated list. Valid values: completed, in-progress, absent. Default is `completed`. */
  RecordingStatusCallbackEvent?: string;
  /** Whether leading and trailing silence is trimmed from a recording. Default is `trim-silence`. */
  Trim?: 'trim-silence' | 'do-not-trim';
  /** The username to authenticate the caller when making an outbound SIP call. */
  SipAuthUsername?: string;
  /** The password to authenticate the caller when making an outbound SIP call. */
  SipAuthPassword?: string;
  /** The maximum price in USD acceptable for the call to be created. Format: up to 4 decimal places. */
  MaxPricePerMinute?: string;
}

/** Request body for updating a call. */
export interface UpdateCallRequest {
  /** The URL to handle the call. */
  Url?: string;
  /** Whether the request to `Url` is a `GET` or a `POST`. */
  Method?: 'GET' | 'POST';
  /** The status to update the call to. */
  Status?: 'canceled' | 'completed';
  /** The URL SignalWire will request if errors occur. */
  FallbackUrl?: string;
  /** Whether the request to `FallbackUrl` is a `GET` or a `POST`. */
  FallbackMethod?: 'GET' | 'POST';
  /** The URL SignalWire will send webhooks to. */
  StatusCallback?: string;
  /** Whether the request to `StatusCallback` is a `GET` or a `POST`. */
  StatusCallbackMethod?: 'GET' | 'POST';
}

/** Response containing a single call recording. */
export interface CallRecordingResponse {
  /** The unique identifier for the recording. */
  sid: string;
  /** The unique identifier for the account that is associated with this recording. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The unique identifier for the call that is associated with this recording. Null if this is a conference recording. */
  call_sid: string | null;
  /** The unique identifier for the conference that is associated with this recording. Null if this is a call recording. */
  conference_sid: string | null;
  /** The number of channels in a recording (singular key). Returns '1' for mono or '2' for stereo. */
  channel: '1' | '2';
  /** The number of channels in a recording. Returns '1' for mono or '2' for stereo. */
  channels: '1' | '2';
  /** The date, in RFC 2822 format, this recording was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this recording was updated. */
  date_updated: string;
  /** The time, in RFC 2822 format, this recording started. */
  start_time: string | null;
  /** The time, in RFC 2822 format, this recording ended. */
  end_time: string | null;
  /** The length, in seconds, of the recording. */
  duration: number;
  /** The cost for the recording. */
  price: string | null;
  /** The currency of the price of the recording. */
  price_unit: string;
  /** How the recording was made. */
  source: RecordingSource;
  /** The status of the recording. */
  status: RecordingStatus;
  /** Further details about a failed recording. */
  error_code: string | null;
  /** The URI of the recording. */
  uri: string;
  /** Subresource URIs. */
  subresource_uris: RecordingSubresourceUris;
  /** Encryption details. Always null. */
  encryption_details: string | null;
  /** Whether leading and trailing silence is trimmed from a recording. */
  trim: string;
}

/** Request body for creating a call recording. */
export interface CreateCallRecordingRequest {
  /** The number of channels in the recording. Can be `mono` (both legs of call recorded under one channel into one recording file) or `dual` (each leg of call recorded in separate channels into one recording file). Default is `mono`. */
  RecordingChannels?: 'mono' | 'dual';
  /** The URL to request to when recording is available. See the [Recording status callback](/docs/compatibility-api/rest/recordings/webhooks/recording-status-callback) webhook for the payload your URL will receive. */
  RecordingStatusCallback?: string;
  /** The different recording statuses. To specify multiple events, separate with a space. Valid values: completed, in-progress, absent. Default is `completed`. */
  RecordingStatusCallbackEvent?: string;
  /** Whether the request to `RecordingStatusCallback` URL is a `GET` or a `POST`. Default is `POST`. */
  RecordingStatusCallbackMethod?: 'GET' | 'POST';
  /** Specifies whether to record the `inbound` audio to SignalWire from the called party or the `outbound` audio from SignalWire to the called party or `both` the inbound and outbound audio. Default is `both`. */
  RecordingTrack?: 'inbound' | 'outbound' | 'both';
  /** Whether leading and trailing silence is trimmed from a recording. Default is `do-not-trim`. */
  Trim?: 'trim-silence' | 'do-not-trim';
}

/** Request body for updating a call recording. */
export interface UpdateCallRecordingRequest {
  /** The status of the recording. */
  Status: 'paused' | 'in-progress' | 'stopped';
  /** What to do while recording is paused. Default is `silence`. */
  PauseBehavior?: 'skip' | 'silence';
}

/** Response containing a single call stream. */
export interface CallStreamResponse {
  /** The unique identifier for the stream. */
  sid: string;
  /** The unique identifier for the account. */
  account_sid: string;
  /** The unique identifier for the call. */
  call_sid: string;
  /** The name of the stream. */
  name: string;
  /** The status of the stream. */
  status: StreamStatus;
  /** The date, in RFC 2822 GMT format, this stream was updated. */
  date_updated: string;
  /** The URI for the stream. */
  uri: string;
}

/** Request body for creating a call stream. */
export interface CreateCallStreamRequest {
  /** Unique name for the Stream, per Call. It is used to stop a Stream by name. */
  Name?: string;
  /** This attribute can be one of inbound_track, outbound_track, both_tracks. Default is `both_tracks`. */
  Track?: 'inbound_track' | 'outbound_track' | 'both_tracks';
  /** Whether the request to `StatusCallback` URL is a `GET` or a `POST`. Default is `POST`. */
  StatusCallbackMethod?: 'GET' | 'POST';
  /** The URL to request to when stream is available. */
  StatusCallback?: string;
  /** Absolute or relative URL. A WebSocket connection to the url will be established and audio will start flowing towards the Websocket server. The only supported protocol is wss. For security reasons ws is NOT supported. */
  Url: string;
  /** Custom parameter name to pass towards the WebSocket server. You can pass up to 99 custom parameters using `Parameter1.Name` through `Parameter99.Name`. */
  'Parameter1.Name'?: string;
  /** Custom parameter value to pass towards the WebSocket server. You can pass up to 99 custom parameters using `Parameter1.Value` through `Parameter99.Value`. */
  'Parameter1.Value'?: string;
  /** Custom parameter name to pass towards the WebSocket server. */
  'Parameter2.Name'?: string;
  /** Custom parameter value to pass towards the WebSocket server. */
  'Parameter2.Value'?: string;
  /** Bearer token for authorization with the WebSocket server. */
  AuthorizationBearerToken?: string;
}

/** Request body for updating a call stream. */
export interface UpdateCallStreamRequest {
  /** The status of the stream. Only 'stopped' is allowed. */
  Status: 'stopped';
}

/** Response containing a list of conferences. */
export interface ConferenceListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page. */
  next_page_uri: string | null;
  /** The URI of the previous page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of conferences. */
  conferences: Conference[];
}

/** Response containing a single conference. */
export interface ConferenceResponse {
  /** The unique identifier for this conference. */
  sid: string;
  /** The unique identifier for the account that created this conference. */
  account_sid: string;
  /** The date, in RFC 2822 format, this conference was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this conference was updated. */
  date_updated: string;
  /** A description, up to 64 characters, of the conference room. */
  friendly_name: string;
  /** The status of this conference. */
  status: ConferenceStatus;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The region where this conference audio was mixed. */
  region: string;
  /** The URI for this conference. */
  uri: string;
  /** The links to associated subresources. */
  subresource_uris: ConferenceSubresourceUris;
}

/** Request body for updating a conference. */
export interface UpdateConferenceRequest {
  /** The status of this conference. Only 'completed' is allowed to end the conference. */
  Status?: 'completed';
  /** The URL to send conference announcements to. */
  AnnounceUrl?: string;
  /** Whether the request to `AnnounceUrl` is a `GET` or a `POST`. Default is `POST`. */
  AnnounceMethod?: 'GET' | 'POST';
}

/** Response containing a list of conference participants. */
export interface ConferenceParticipantListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page. */
  next_page_uri: string | null;
  /** The URI of the previous page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of participants. */
  participants: ConferenceParticipant[];
}

/** Response containing a single conference participant. */
export interface ConferenceParticipantResponse {
  /** The unique identifier for the account that created this conference. */
  account_sid: string;
  /** The unique identifier for the Participant call connected to this conference. */
  call_sid: string;
  /** The unique identifier of the participant who is being coached. */
  call_sid_to_coach: string | null;
  /** Whether the participant is coaching another call. */
  coaching: boolean;
  /** The unique identifier for the conference this participant is in. */
  conference_sid: string;
  /** The date, in RFC 2822 format, this conference participant was created. */
  date_created: string;
  /** The status of the conference call. */
  status: ParticipantStatus;
  /** The date, in RFC 2822 format, this conference participant was updated. */
  date_updated: string;
  /** Whether or not a conference ends when a participant leaves the conference call. */
  end_conference_on_exit: boolean;
  /** Whether or not a participant is muted. */
  muted: boolean;
  /** Whether or not a participant is on hold. */
  hold: boolean;
  /** Whether or not a conference will begin when this participant enters the conference call. */
  start_conference_on_enter: boolean;
  /** The URI for this conference participant. */
  uri: string;
}

/** Request body for updating a conference participant. */
export interface UpdateConferenceParticipantRequest {
  /** The URL to send conference announcements to. */
  AnnounceUrl?: string;
  /** Whether the request to `AnnounceUrl` is a `GET` or a `POST`. Default is `POST`. */
  AnnounceMethod?: 'GET' | 'POST';
  /** Whether the participant is coaching another call. Requires `CallSidToCoach` to be set. */
  Coaching?: boolean;
  /** The unique identifier of the participant who is being coached. Required when `Coaching` is true. */
  CallSidToCoach?: string;
  /** Whether or not a participant is on hold. */
  Hold?: boolean;
  /** Whether the request to `HoldUrl` is a `GET` or a `POST`. Default is `GET`. */
  HoldMethod?: 'GET' | 'POST';
  /** The URL to send hold music to that will be played when participant is on hold. */
  HoldUrl?: string;
  /** Whether or not a participant is muted. */
  Muted?: boolean;
  /** The URL for wait music to be played while a conference is not yet started. */
  WaitUrl?: string;
  /** Whether the request to `WaitUrl` is a `GET` or a `POST`. Default is `POST`. */
  WaitMethod?: 'GET' | 'POST';
}

/** Response containing a list of conference recordings. */
export interface ConferenceRecordingListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page. */
  next_page_uri: string | null;
  /** The URI of the previous page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of recordings. */
  recordings: ConferenceRecording[];
}

/** Response containing a single conference recording. */
export interface ConferenceRecordingResponse {
  /** The unique identifier for the recording. */
  sid: string;
  /** The unique identifier for the account that is associated with this recording. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The unique identifier for the call. Always null for conference recordings. */
  call_sid: string | null;
  /** The unique identifier for the conference that is associated with this recording. */
  conference_sid: string | null;
  /** The number of channels in a recording (singular key). Returns '1' for mono or '2' for stereo. */
  channel: '1' | '2';
  /** The number of channels in a recording. Returns '1' for mono or '2' for stereo. */
  channels: '1' | '2';
  /** The date, in RFC 2822 format, this recording was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this recording was updated. */
  date_updated: string;
  /** The time, in RFC 2822 format, this recording started. */
  start_time: string | null;
  /** The time, in RFC 2822 format, this recording ended. */
  end_time: string | null;
  /** The length, in seconds, of the recording. */
  duration: number;
  /** The cost for the recording. */
  price: string | null;
  /** The currency of the price of the recording. */
  price_unit: string;
  /** How the recording was made. */
  source: ConferenceRecordingSource;
  /** The status of the recording. */
  status: ConferenceRecordingStatus;
  /** Further details about a failed recording. */
  error_code: string | null;
  /** The URI of the recording. */
  uri: string;
  /** Subresource URIs. */
  subresource_uris: ConferenceRecordingSubresourceUris;
  /** Encryption details. Always null. */
  encryption_details: string | null;
  /** Whether leading and trailing silence is trimmed from a recording. */
  trim: string;
}

/** Request body for updating a conference recording. */
export interface UpdateConferenceRecordingRequest {
  /** The status of the recording. */
  Status: 'paused' | 'in-progress' | 'stopped';
  /** What to do while recording is paused. Default is `silence`. */
  PauseBehavior?: 'skip' | 'silence';
}

/** Response containing a single conference stream. */
export interface ConferenceStreamResponse {
  /** The unique identifier for the account. */
  account_sid: string;
  /** The unique identifier for the conference. */
  conference_sid: string;
  /** The date, in RFC 2822 GMT format, this stream was updated. */
  date_updated: string;
  /** The name of the stream. May be null if not specified when creating the stream. */
  name: string | null;
  /** The unique identifier for the stream. */
  sid: string;
  /** The status of the stream. */
  status: ConferenceStreamStatus;
  /** The URI for the stream. */
  uri: string;
}

/** Request body for creating a conference stream. */
export interface CreateConferenceStreamRequest {
  /** Unique name for the Stream, per Conference. It is used to stop a Stream by name. */
  Name?: string;
  /** This attribute can be one of inbound_track, outbound_track, both_tracks. Default is `both_tracks`. */
  Track?: 'inbound_track' | 'outbound_track' | 'both_tracks';
  /** Whether the request to `StatusCallback` URL is a `GET` or a `POST`. Default is `POST`. */
  StatusCallbackMethod?: 'GET' | 'POST';
  /** The URL to request to when stream is available. */
  StatusCallback?: string;
  /** Absolute or relative URL. A WebSocket connection to the url will be established and audio will start flowing towards the Websocket server. The only supported protocol is wss. For security reasons ws is NOT supported. */
  Url: string;
  /** The audio codec to use for the stream. */
  StreamCodec?: 'PCMU' | 'PCMA' | 'L16' | 'L16@16000h' | 'L16@24000h';
  /** Enable real-time streaming for the conference stream. */
  StreamRealTime?: boolean;
  /** Custom parameter name to pass towards the WebSocket server. You can pass up to 99 custom parameters using `Parameter1.Name` through `Parameter99.Name`. */
  'Parameter1.Name'?: string;
  /** Custom parameter value to pass towards the WebSocket server. You can pass up to 99 custom parameters using `Parameter1.Value` through `Parameter99.Value`. */
  'Parameter1.Value'?: string;
  /** Custom parameter name to pass towards the WebSocket server. */
  'Parameter2.Name'?: string;
  /** Custom parameter value to pass towards the WebSocket server. */
  'Parameter2.Value'?: string;
  /** Bearer token for authorization with the WebSocket server. */
  AuthorizationBearerToken?: string;
}

/** Request body for updating a conference stream. */
export interface UpdateConferenceStreamRequest {
  /** The status of the stream. Only 'stopped' is allowed. */
  Status: 'stopped';
}

/** Response containing a list of faxes. */
export interface FaxListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page, or null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page, or null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of faxes. */
  faxes: Fax[];
}

/** Response containing a single fax. */
export interface FaxResponse {
  /** The unique identifier for the account this fax is associated with. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The date and time, in ISO 8601 format, the fax was created. */
  date_created: string;
  /** The date and time, in ISO 8601 format, the fax was updated. */
  date_updated: string;
  /** The direction of the fax. */
  direction: FaxDirection;
  /** The phone number, in E.164 format, the fax was sent from. */
  from: string;
  /** The URL hosting the received media, or null if not available. */
  media_url: string | null;
  /** The unique identifier for the media instance associated with the fax instance. */
  media_sid: string;
  /** The number of pages in the fax document, or null if not yet determined. */
  num_pages: string | null;
  /** The cost of the fax, or null if not yet calculated. */
  price: string | null;
  /** The currency, in ISO 4217 format, of the price. */
  price_unit: string;
  /** The quality of the fax. */
  quality: FaxQuality;
  /** The unique identifier of the fax. */
  sid: string;
  /** The status of the fax. */
  status: FaxStatus;
  /** The phone number, in E.164 format, the fax was sent to. */
  to: string;
  /** The time, in seconds, it took to deliver a fax. */
  duration: number;
  /** The URL links for resources associated with the fax. */
  links: FaxLinks;
  /** The URL of this resource. */
  url: string;
  /** Error code for this resource, or null if no error. */
  error_code: string | null;
  /** The description of this error, or null if no error. */
  error_message: string | null;
}

/** Request body for sending a fax. */
export interface SendFaxRequest {
  /** The URL hosting the fax media to send. */
  MediaUrl: string;
  /** The phone number, in E.164 format, or SIP URI the fax will be sent to. */
  To: string;
  /** The phone number, in E.164 format, or client identifier the fax will be sent from. */
  From: string;
  /** The quality of the fax. Default is 'fine'. */
  Quality?: 'standard' | 'fine' | 'superfine';
  /** The URL to send status callback requests to when the fax status changes. */
  StatusCallback?: string;
  /** The HTTP method to use for status callback requests. Default is 'POST'. */
  StatusCallbackMethod?: 'GET' | 'POST';
  /** The events that trigger status callback requests. Valid values: 'initiated', 'ringing', 'answered', 'completed', 'ringing_forwarded', 'ringing_queued'. Default is ['completed']. */
  StatusCallbackEvent?: string[];
  /** Whether to store the fax media. Default is 'true'. */
  StoreMedia?: 'true' | 'false';
  /** Time to live in minutes for the fax. Must be between 5 and 300. Default is 60. */
  Ttl?: number;
  /** The username for SIP authentication. */
  SipAuthUsername?: string;
  /** The password for SIP authentication. */
  SipAuthPassword?: string;
}

/** Request body for updating (canceling) a fax. */
export interface UpdateFaxRequest {
  /** The status to set. Only 'canceled' is allowed. The fax must be in 'queued' status to be canceled. */
  Status: 'canceled';
}

/** Response containing a list of fax media. */
export interface FaxMediaListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page, or null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page, or null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of media. */
  media: FaxMedia[];
  /** List of fax media (alias for media). */
  fax_media: FaxMedia[];
}

/** Response containing a single fax media. */
export interface FaxMediaResponse {
  /** The unique identifier for the account. */
  account_sid: string;
  /** The content type of the media. */
  content_type: string;
  /** The date, in ISO 8601 format, this media was created. */
  date_created: string;
  /** The date, in ISO 8601 format, this media was updated. */
  date_updated: string;
  /** The unique identifier for the fax. */
  fax_sid: string;
  /** The unique identifier for the media. */
  sid: string;
  /** The URI for the media. */
  uri: string;
  /** The URL for the media. */
  url: string;
}

/** Incoming phone number model. */
export interface IncomingPhoneNumber {
  /** The unique identifier for the account that is associated with this phone number. */
  account_id: string;
  /** The unique identifier for the account that is associated with this phone number. */
  account_sid: string;
  /** Whether or not a registered address with SignalWire is required. Always 'none'. */
  address_requirements: AddressRequirements;
  /** The unique identifier for the address associated with this phone number. Always null. */
  address_sid: string | null;
  /** The version of the SignalWire API. */
  api_version: string;
  /** New numbers on SignalWire are marked as beta. Always false. */
  beta: boolean;
  /** Whether or not a number can receive calls and messages. */
  capabilities: IncomingPhoneNumberCapabilities;
  /** The ISO 3166-1 alpha-2 country code for this phone number. */
  country_code: string;
  /** The date, in RFC 2822 format, this phone number was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this phone number was updated. */
  date_updated: string;
  /** The unique identifier of the address associated with E911 for this phone number, or null if not set. */
  emergency_address_sid: string | null;
  /** Whether the phone route has an active E911 address associated. 'Active' or 'Inactive'. */
  emergency_status: string;
  /** A formatted version of the number. */
  friendly_name: string;
  /** The unique identifier for the identity associated with this phone number. Always null. */
  identity_sid: string | null;
  /** The origin of the phone number. */
  origin: PhoneNumberOrigin;
  /** The incoming number in E.164 format. */
  phone_number: string;
  /** The unique identifier for this phone number. */
  sid: string;
  /** The unique identifier for the application associated with SMS handling on this phone number, or null if not set. */
  sms_application_sid: string | null;
  /** Whether the request to `SmsFallbackUrl` is a `GET` or a `POST`. */
  sms_fallback_method: string;
  /** The URL to request if errors occur when fetching SmsUrl, or null if not set. */
  sms_fallback_url: string | null;
  /** Whether the request to SmsUrl is a `GET` or a `POST`. */
  sms_method: string;
  /** The URL to request when an incoming SMS is received, or null if not set. */
  sms_url: string | null;
  /** The URL to request to pass status updates to, or null if not set. */
  status_callback: string | null;
  /** Whether the request to StatusCallback is a `GET` or a `POST`. */
  status_callback_method: string;
  /** The unique identifier for the Trunk associated with this phone number. Always null. */
  trunk_sid: string | null;
  /** The URI for this number. */
  uri: string;
  /** The verification status for toll-free numbers. Only present for toll-free numbers. */
  verification_status?: string;
  /** The unique identifier for the application associated with call handling on this phone number, or null if not set. */
  voice_application_sid: string | null;
  /** Whether or not to look up a caller's name in the database. Always null. */
  voice_caller_id_lookup: boolean | null;
  /** Whether the request to VoiceFallbackUrl is a `GET` or a `POST`. */
  voice_fallback_method: string;
  /** The URL to request if errors occur when fetching `Url`, or null if not set. */
  voice_fallback_url: string | null;
  /** Whether the request to Url is a `GET` or a `POST`. */
  voice_method: string;
  /** The URL to request when an incoming call is received, or null if not set. */
  voice_url: string | null;
}

/** Response containing a list of incoming phone numbers. */
export interface IncomingPhoneNumberListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page, or null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page, or null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of incoming phone numbers. */
  incoming_phone_numbers: IncomingPhoneNumber[];
}

/** Response containing a single incoming phone number. */
export interface IncomingPhoneNumberResponse {
  /** The unique identifier for the account that is associated with this phone number. */
  account_id: string;
  /** The unique identifier for the account that is associated with this phone number. */
  account_sid: string;
  /** Whether or not a registered address with SignalWire is required. Always 'none'. */
  address_requirements: AddressRequirements;
  /** The unique identifier for the address associated with this phone number. Always null. */
  address_sid: string | null;
  /** The version of the SignalWire API. */
  api_version: string;
  /** New numbers on SignalWire are marked as beta. Always false. */
  beta: boolean;
  /** Whether or not a number can receive calls and messages. */
  capabilities: IncomingPhoneNumberCapabilities;
  /** The ISO 3166-1 alpha-2 country code for this phone number. */
  country_code: string;
  /** The date, in RFC 2822 format, this phone number was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this phone number was updated. */
  date_updated: string;
  /** The unique identifier of the address associated with E911 for this phone number, or null if not set. */
  emergency_address_sid: string | null;
  /** Whether the phone route has an active E911 address associated. 'Active' or 'Inactive'. */
  emergency_status: string;
  /** A formatted version of the number. */
  friendly_name: string;
  /** The unique identifier for the identity associated with this phone number. Always null. */
  identity_sid: string | null;
  /** The origin of the phone number. */
  origin: PhoneNumberOrigin;
  /** The incoming number in E.164 format. */
  phone_number: string;
  /** The unique identifier for this phone number. */
  sid: string;
  /** The unique identifier for the application associated with SMS handling on this phone number, or null if not set. */
  sms_application_sid: string | null;
  /** Whether the request to `SmsFallbackUrl` is a `GET` or a `POST`. */
  sms_fallback_method: string;
  /** The URL to request if errors occur when fetching SmsUrl, or null if not set. */
  sms_fallback_url: string | null;
  /** Whether the request to SmsUrl is a `GET` or a `POST`. */
  sms_method: string;
  /** The URL to request when an incoming SMS is received, or null if not set. */
  sms_url: string | null;
  /** The URL to request to pass status updates to, or null if not set. */
  status_callback: string | null;
  /** Whether the request to StatusCallback is a `GET` or a `POST`. */
  status_callback_method: string;
  /** The unique identifier for the Trunk associated with this phone number. Always null. */
  trunk_sid: string | null;
  /** The URI for this number. */
  uri: string;
  /** The verification status for toll-free numbers. Only present for toll-free numbers. */
  verification_status?: string;
  /** The unique identifier for the application associated with call handling on this phone number, or null if not set. */
  voice_application_sid: string | null;
  /** Whether or not to look up a caller's name in the database. Always null. */
  voice_caller_id_lookup: boolean | null;
  /** Whether the request to VoiceFallbackUrl is a `GET` or a `POST`. */
  voice_fallback_method: string;
  /** The URL to request if errors occur when fetching `Url`, or null if not set. */
  voice_fallback_url: string | null;
  /** Whether the request to Url is a `GET` or a `POST`. */
  voice_method: string;
  /** The URL to request when an incoming call is received, or null if not set. */
  voice_url: string | null;
}

/** Request body for importing a phone number. */
export interface ImportPhoneNumberRequest {
  /** The phone number to import in E.164 format. Must start with `+` followed by 5-30 digits. */
  number: string;
  /** The type of phone number being imported. */
  number_type: NumberType;
  /** The capabilities to enable for this phone number. If not provided, defaults to all capabilities (`sms`, `voice`, `fax`, `mms`). If provided, must include at least one capability. */
  capabilities?: PhoneNumberCapability[];
}

/** Request body for creating an incoming phone number. */
export interface CreateIncomingPhoneNumberRequest {
  /** The phone number to purchase in E.164 format. Must start with `+` followed by 5-17 digits. */
  PhoneNumber: string;
  /** A friendly name for the phone number. If not provided, the formatted phone number will be used. */
  FriendlyName?: string;
  /** The unique identifier for the application associated with SMS handling on this phone number. */
  SmsApplicationSid?: string;
  /** Whether the request to `SmsFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  SmsFallbackMethod?: 'GET' | 'POST';
  /** The URL to request if errors occur when fetching SmsUrl. */
  SmsFallbackUrl?: string;
  /** Whether the request to SmsUrl is a `GET` or a `POST`. Default is `POST`. */
  SmsMethod?: 'GET' | 'POST';
  /** The URL to request when an incoming SMS is received. */
  SmsUrl?: string;
  /** The URL to request to pass status updates to. See the [Incoming call status callback](/docs/compatibility-api/rest/incoming-phone-numbers/webhooks/incoming-call-status-callback) webhook for the payload your URL will receive. */
  StatusCallback?: string;
  /** Whether the request to StatusCallback is a `GET` or a `POST`. Default is `POST`. */
  StatusCallbackMethod?: 'GET' | 'POST';
  /** The unique identifier for the application associated with call handling on this phone number. */
  VoiceApplicationSid?: string;
  /** Whether the request to VoiceFallbackUrl is a `GET` or a `POST`. Default is `POST`. */
  VoiceFallbackMethod?: 'GET' | 'POST';
  /** The URL to request if errors occur when fetching VoiceUrl. */
  VoiceFallbackUrl?: string;
  /** Whether the request to VoiceUrl is a `GET` or a `POST`. Default is `POST`. */
  VoiceMethod?: 'GET' | 'POST';
  /** Whether this number can receive voice calls or faxes. Default is `voice`. */
  VoiceReceiveMode?: 'voice' | 'fax';
  /** The URL to request when an incoming call is received. */
  VoiceUrl?: string;
}

/** Request body for updating an incoming phone number. */
export interface UpdateIncomingPhoneNumberRequest {
  /** The unique identifier for an account to which the number should be transferred. Must be within the same Space. */
  AccountSid?: string;
  /** The unique identifier of the address associated with E911 for this phone number. Not supported for toll-free numbers or certain providers. */
  EmergencyAddressSid?: string;
  /** A friendly name for the phone number. */
  FriendlyName?: string;
  /** The unique identifier for the application associated with SMS handling on this phone number. */
  SmsApplicationSid?: string;
  /** Whether the request to `SmsFallbackUrl` is a `GET` or a `POST`. Default is `POST`. */
  SmsFallbackMethod?: 'GET' | 'POST';
  /** The URL to request if errors occur when fetching SmsUrl. */
  SmsFallbackUrl?: string;
  /** Whether the request to SmsUrl is a `GET` or a `POST`. Default is `POST`. */
  SmsMethod?: 'GET' | 'POST';
  /** The URL to request when an incoming SMS is received. */
  SmsUrl?: string;
  /** The URL to request to pass status updates to. */
  StatusCallback?: string;
  /** Whether the request to StatusCallback is a `GET` or a `POST`. Default is `POST`. */
  StatusCallbackMethod?: 'GET' | 'POST';
  /** The unique identifier for the application associated with call handling on this phone number. */
  VoiceApplicationSid?: string;
  /** Whether the request to VoiceFallbackUrl is a `GET` or a `POST`. Default is `POST`. */
  VoiceFallbackMethod?: 'GET' | 'POST';
  /** The URL to request if errors occur when fetching VoiceUrl. */
  VoiceFallbackUrl?: string;
  /** Whether the request to VoiceUrl is a `GET` or a `POST`. Default is `POST`. */
  VoiceMethod?: 'GET' | 'POST';
  /** Whether this number can receive voice calls or faxes. */
  VoiceReceiveMode?: 'voice' | 'fax';
  /** The URL to request when an incoming call is received. */
  VoiceUrl?: string;
}

/** Response containing a list of cXML scripts. */
export interface CxmlScriptListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page, or null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page, or null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of cXML scripts. */
  laml_bins: CxmlScript[];
}

/** cXML Script model. */
export interface CxmlScript {
  /** The unique identifier of the cXML script on SignalWire. */
  sid: string;
  /** The date and time, in ISO 8601 format, the script was created. */
  date_created: string;
  /** The date and time, in ISO 8601 format, the script was updated. */
  date_updated: string;
  /** The date and time, in ISO 8601 format, the script was last accessed, or null if never accessed. */
  date_last_accessed: string | null;
  /** The unique identifier for the account this script is associated with. */
  account_sid: string;
  /** A friendly name given to the cXML script. */
  name: string;
  /** The contents of the cXML script. */
  contents: string;
  /** The unique URL to the raw contents of the cXML script. */
  request_url: string;
  /** The number of times this cXML script has been accessed. */
  num_requests: number;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The URL of this resource. */
  uri: string;
}

/** Response containing a single cXML script. */
export interface CxmlScriptResponse {
  /** The unique identifier of the cXML script on SignalWire. */
  sid: string;
  /** The date and time, in ISO 8601 format, the script was created. */
  date_created: string;
  /** The date and time, in ISO 8601 format, the script was updated. */
  date_updated: string;
  /** The date and time, in ISO 8601 format, the script was last accessed, or null if never accessed. */
  date_last_accessed: string | null;
  /** The unique identifier for the account this script is associated with. */
  account_sid: string;
  /** A friendly name given to the cXML script. */
  name: string;
  /** The contents of the cXML script. */
  contents: string;
  /** The unique URL to the raw contents of the cXML script. */
  request_url: string;
  /** The number of times this cXML script has been accessed. */
  num_requests: number;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The URL of this resource. */
  uri: string;
}

/** Request body for creating a cXML script. */
export interface CreateCxmlScriptRequest {
  /** A friendly name given to the cXML script. Required. */
  Name: string;
  /** The cXML contents of the script. Must be valid XML with proper Mustache syntax if templates are used. Defaults to an empty Response element. */
  Contents?: string;
}

/** Request body for updating a cXML script. */
export interface UpdateCxmlScriptRequest {
  /** A friendly name given to the cXML script. Required. */
  Name: string;
  /** The cXML contents of the script. Must be valid XML with proper Mustache syntax if templates are used. */
  Contents?: string;
}

/** Response containing a list of messages. */
export interface MessageListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page, or null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page, or null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of messages. */
  messages: Message[];
}

/** Message model. */
export interface Message {
  /** The unique identifier of the project that sent or received this message. */
  account_sid: string;
  /** The version number of the SignalWire cXML REST API used to handle this message. */
  api_version: string;
  /** The text of the message. Up to 1600 characters long. May be null if filtered for spam. */
  body: string | null;
  /** The number of segments that make up the entire message. */
  num_segments: number;
  /** The number of media files that were included with the message. */
  num_media: number;
  /** The date and time the message was created in RFC 2822 format. */
  date_created: string;
  /** The date and time the message was sent in RFC 2822 format, or null if not yet sent. */
  date_sent: string | null;
  /** The date and time the message was last updated in RFC 2822 format. */
  date_updated: string;
  /** The direction of the message. */
  direction: MessageDirection;
  /** If an error has occurred on the message, the error code will give you a specific code, or null if no error. */
  error_code: string | null;
  /** A human readable description of the error that occurred, or null if no error. */
  error_message: string | null;
  /** The phone number in E.164 format that sent the message. */
  from: string;
  /** The cost of the individual message billed to your project, or null if not yet calculated. */
  price: number | null;
  /** The currency in which `price` is charged as. */
  price_unit: string;
  /** A unique ID that identifies this specific message. */
  sid: string;
  /** Current status of the message. */
  status: MessageStatus;
  /** The phone number in E.164 format that received the message. */
  to: string;
  /** If a number group was used when sending an outbound message, the number group's ID will be present, or null otherwise. */
  messaging_service_sid: string | null;
  /** The URI of this particular message. */
  uri: string;
  /** The URIs for any subresources associated with this message. */
  subresource_uris: MessageSubresourceUris;
}

/** Response containing a single message. */
export interface MessageResponse {
  /** The unique identifier of the project that sent or received this message. */
  account_sid: string;
  /** The version number of the SignalWire cXML REST API used to handle this message. */
  api_version: string;
  /** The text of the message. Up to 1600 characters long. May be null if filtered for spam. */
  body: string | null;
  /** The number of segments that make up the entire message. */
  num_segments: number;
  /** The number of media files that were included with the message. */
  num_media: number;
  /** The date and time the message was created in RFC 2822 format. */
  date_created: string;
  /** The date and time the message was sent in RFC 2822 format, or null if not yet sent. */
  date_sent: string | null;
  /** The date and time the message was last updated in RFC 2822 format. */
  date_updated: string;
  /** The direction of the message. */
  direction: MessageDirection;
  /** If an error has occurred on the message, the error code will give you a specific code, or null if no error. */
  error_code: string | null;
  /** A human readable description of the error that occurred, or null if no error. */
  error_message: string | null;
  /** The phone number in E.164 format that sent the message. */
  from: string;
  /** The cost of the individual message billed to your project, or null if not yet calculated. */
  price: number | null;
  /** The currency in which `price` is charged as. */
  price_unit: string;
  /** A unique ID that identifies this specific message. */
  sid: string;
  /** Current status of the message. */
  status: MessageStatus;
  /** The phone number in E.164 format that received the message. */
  to: string;
  /** If a number group was used when sending an outbound message, the number group's ID will be present, or null otherwise. */
  messaging_service_sid: string | null;
  /** The URI of this particular message. */
  uri: string;
  /** The URIs for any subresources associated with this message. */
  subresource_uris: MessageSubresourceUris;
}

/** Request body for creating a message. */
export interface CreateMessageRequest {
  /** The phone number in E.164 format that will receive the message. */
  To: string;
  /** The phone number in E.164 format that will send the message. Either `From` or `MessagingServiceSid` must be provided. */
  From?: string;
  /** The text of the message. Either `Body` or `MediaUrl` must be provided. */
  Body?: string;
  /** URL(s) of media you wish to attach and send with the message. Can be specified multiple times for up to 8 media items. */
  MediaUrl?: string | string[];
  /** When set to true, forces the message to be sent as an MMS. */
  SendAsMms?: boolean;
  /** The SID of a SignalWire cXML Application used to configure the message's status callback. */
  ApplicationSid?: string;
  /** The maximum price in USD acceptable for the message to be sent. Format: decimal with up to 4 decimal places. */
  MaxPrice?: string;
  /** A URL endpoint to receive callbacks each time the status of the message changes. See the [SMS status callback](/docs/compatibility-api/rest/messages/webhooks/sms-status-callback) webhook for the payload your URL will receive. */
  StatusCallback?: string;
  /** The number of seconds a message will allow being queued before canceling. Must be between 1 and 172800 (48 hours). Default is 14400 (4 hours). */
  ValidityPeriod?: number;
  /** The ID of a number group to use when sending the message. Either `From` or `MessagingServiceSid` must be provided. */
  MessagingServiceSid?: string;
}

/** Request body for updating (redacting) a message. */
export interface UpdateMessageRequest {
  /** The new body of the message. Must be an empty string to redact the message content. */
  Body: string;
}

/** Response containing a list of message media. */
export interface MessageMediaListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page, or null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page, or null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number. */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of media. */
  media_list: MessageMedia[];
}

/** Response containing a single message media. */
export interface MessageMediaResponse {
  /** The unique identifier for the account. */
  account_sid: string;
  /** The content type of the media. */
  content_type: string;
  /** The date, in RFC 2822 GMT format, this media was created. */
  date_created: string;
  /** The date, in RFC 2822 GMT format, this media was updated. */
  date_updated: string;
  /** The unique identifier for the message. */
  parent_sid: string;
  /** The unique identifier for the media. */
  sid: string;
  /** The URI for the media. */
  uri: string;
}

/** Response containing a list of queues. */
export interface QueueListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page. Null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page. Null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number (zero-indexed). */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of queues. */
  queues: Queue[];
}

/** Queue model. */
export interface Queue {
  /** The unique identifier for the queue. */
  sid: string;
  /** The unique identifier for the account this Queue is associated with. */
  account_sid: string;
  /** A description that distinguishes a queue. */
  friendly_name: string;
  /** The maximum number of calls that are allowed to wait in a queue. Null if no limit is set. */
  max_size: number | null;
  /** The number of calls currently waiting in the queue. */
  current_size: number;
  /** The average wait time, in seconds, of callers in a queue. */
  average_wait_time: number;
  /** The date and time, in RFC 2822 format, the Queue was created. */
  date_created: string;
  /** The date and time, in RFC 2822 format, the Queue was updated. */
  date_updated: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The URI of this resource, relative to the API base URL. */
  uri: string;
}

/** Response containing a single queue. */
export interface QueueResponse {
  /** The unique identifier for the queue. */
  sid: string;
  /** The unique identifier for the account this Queue is associated with. */
  account_sid: string;
  /** A description that distinguishes a queue. */
  friendly_name: string;
  /** The maximum number of calls that are allowed to wait in a queue. Null if no limit is set. */
  max_size: number | null;
  /** The number of calls currently waiting in the queue. */
  current_size: number;
  /** The average wait time, in seconds, of callers in a queue. */
  average_wait_time: number;
  /** The date and time, in RFC 2822 format, the Queue was created. */
  date_created: string;
  /** The date and time, in RFC 2822 format, the Queue was updated. */
  date_updated: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The URI of this resource, relative to the API base URL. */
  uri: string;
}

/** Request body for creating a queue. */
export interface CreateQueueRequest {
  /** A unique name for the queue. Must contain only alphanumeric characters and underscores. */
  FriendlyName: string;
  /** The maximum number of calls that are allowed to wait in a queue. Must be a positive integer. */
  MaxSize?: number;
}

/** Request body for updating a queue. */
export interface UpdateQueueRequest {
  /** A unique name for the queue. Must contain only alphanumeric characters and underscores. */
  FriendlyName: string;
  /** The maximum number of calls that are allowed to wait in a queue. Must be a positive integer. */
  MaxSize?: number;
}

/** Response containing a list of queue members. */
export interface QueueMemberListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page. Null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page. Null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number (zero-indexed). */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of queue members. */
  queue_members: QueueMember[];
}

/** Response containing a single queue member. */
export interface QueueMemberResponse {
  /** The unique identifier for the call. */
  call_sid: string;
  /** The unique identifier for the account. */
  account_sid: string;
  /** The unique identifier for the queue. */
  queue_sid: string;
  /** The date and time, in RFC 2822 format, when the member was enqueued. */
  date_enqueued: string;
  /** The position of the member in the queue (1-indexed). */
  position: number;
  /** The wait time, in seconds, since the member was enqueued. */
  wait_time: number;
  /** The type of the queue member. */
  member_type: string;
  /** The URI of this resource, relative to the API base URL. */
  uri: string;
}

/** Request body for dequeuing a queue member. */
export interface UpdateQueueMemberRequest {
  /** The URL to redirect the dequeued member to. This URL should return cXML instructions for handling the call. */
  Url: string;
  /** The HTTP method to use when requesting the URL. Default is `POST`. */
  Method?: 'GET' | 'POST';
}

/** Response containing a list of recordings. */
export interface RecordingListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page. Null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page. Null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number (zero-indexed). */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of recordings. */
  recordings: Recording[];
}

/** Response containing a single recording. */
export interface RecordingResponse {
  /** The unique identifier for the recording. */
  sid: string;
  /** The unique identifier for the account that is associated with this recording. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The unique identifier for the call that is associated with this recording. Null if this is a conference recording. */
  call_sid: string | null;
  /** The unique identifier for the conference that is associated with this recording. Null if this is a call recording. */
  conference_sid: string | null;
  /** The number of channels in a recording (singular key). Returns '1' for mono or '2' for stereo. */
  channel: '1' | '2';
  /** The number of channels in a recording. Returns '1' for mono or '2' for stereo. */
  channels: '1' | '2';
  /** The date, in RFC 2822 format, this recording was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this recording was updated. */
  date_updated: string;
  /** The time, in RFC 2822 format, this recording started. */
  start_time: string | null;
  /** The time, in RFC 2822 format, this recording ended. */
  end_time: string | null;
  /** The length, in seconds, of the recording. */
  duration: number;
  /** The cost for the recording. */
  price: string | null;
  /** The currency of the price of the recording. */
  price_unit: string;
  /** How the recording was made. */
  source: RecordingSource;
  /** The status of the recording. */
  status: RecordingStatus;
  /** Further details about a failed recording. */
  error_code: string | null;
  /** The URI of the recording. */
  uri: string;
  /** Subresource URIs. */
  subresource_uris: RecordingSubresourceUris;
  /** Encryption details. Always null. */
  encryption_details: string | null;
  /** Whether leading and trailing silence is trimmed from a recording. */
  trim: string;
}

/** Response containing a list of transcriptions. */
export interface TranscriptionListResponse {
  /** The URI of the current page. */
  uri: string;
  /** The URI of the first page. */
  first_page_uri: string;
  /** The URI of the next page. Null if there are no more pages. */
  next_page_uri: string | null;
  /** The URI of the previous page. Null if this is the first page. */
  previous_page_uri: string | null;
  /** The current page number (zero-indexed). */
  page: number;
  /** The number of items per page. */
  page_size: number;
  /** List of transcriptions. */
  transcriptions: Transcription[];
}

/** Response containing a single transcription. */
export interface TranscriptionResponse {
  /** The unique identifier for the transcription. */
  sid: string;
  /** The unique identifier for the account that created this transcription. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The unique identifier for the recording that this transcription was created from. */
  recording_sid: string;
  /** The date, in RFC 2822 format, this transcription was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this transcription was updated. */
  date_updated: string;
  /** The duration, in seconds, of the transcribed audio. */
  duration: number;
  /** The charge for the transcription. Null if cost has not been calculated. */
  price: string | null;
  /** The currency, in ISO 4217 format, for the price of the transcription. */
  price_unit: string;
  /** The status of the transcription. Always 'completed' for transcriptions returned by the API. */
  status: string;
  /** The text content of the transcription. Null if transcription text is not available. */
  transcription_text: string | null;
  /** The type of the transcription. Currently always an empty string. */
  type: string;
  /** The URI of this resource, relative to the API base URL. */
  uri: string;
}

/** Response containing a single token. */
export interface TokenResponse {
  /** The unique identifier of the created API Token. */
  id: string;
  /** The name of the created API Token. */
  name: string;
  /** The permissions enabled for this token. */
  permissions: string[];
  /** The API token that can be used along with the project ID for basic authentication. */
  token: string;
}

/** Request body for creating an API token. */
export interface CreateTokenRequest {
  /** The name representing the project API token. */
  name: string;
  /** The permissions you would like to enable for this project API token. Valid permissions are: calling, chat, datasphere, fax, management, messaging, numbers, pubsub, storage, tasking, and video. */
  permissions: string[];
  /** The unique identifier of the subproject you would like to create a token for. Must belong to the parent project. */
  subproject_id?: string;
}

/** Request body for updating an API token. */
export interface UpdateTokenRequest {
  /** The name representing the project API token. */
  name?: string;
  /** The permissions you would like to enable for this project API token. If not provided, existing permissions are kept. Valid permissions are: calling, chat, datasphere, fax, management, messaging, numbers, pubsub, storage, tasking, and video. */
  permissions?: string[];
}

/** The status of the Project. */
export type AccountStatus = 'active';

/** The type of the Project. */
export type AccountType = 'Full';

/** A Map of sub-resources that are linked to the given Project. */
export interface SubresourceUris {
  /** URI for addresses. Not supported. */
  addresses: null;
  /** URI for available phone numbers. */
  available_phone_numbers: string;
  /** URI for applications. */
  applications: string;
  /** URI for authorized connect apps. Not supported. */
  authorized_connect_apps: null;
  /** URI for calls. */
  calls: string;
  /** URI for conferences. */
  conferences: string;
  /** URI for connect apps. Not supported. */
  connect_apps: null;
  /** URI for incoming phone numbers. */
  incoming_phone_numbers: string;
  /** URI for keys. Not supported. */
  keys: null;
  /** URI for notifications. Not supported. */
  notifications: null;
  /** URI for outgoing caller IDs. Not supported. */
  outgoing_caller_ids: null;
  /** URI for queues. */
  queues: string;
  /** URI for recordings. */
  recordings: string;
  /** URI for sandbox. Not supported. */
  sandbox: null;
  /** URI for SIP. Not supported. */
  sip: null;
  /** URI for short codes. Not supported. */
  short_codes: null;
  /** URI for messages. */
  messages: string;
  /** URI for transcriptions. */
  transcriptions: string;
  /** URI for usage. Not supported. */
  usage: null;
}

/** Country resource for available phone numbers. */
export interface CountryResource {
  /** The ISO country code of the number. */
  country_code: string;
  /** The country the number is from. */
  country: string;
  /** The URI for the API call. */
  uri: string;
  /** Always `false`. Included for Twilio API compatibility. */
  beta: boolean;
  /** URIs for subresources. */
  subresource_uris: CountrySubresourceUris;
}

/** Country subresource URIs. */
export interface CountrySubresourceUris {
  /** The URI for local numbers. */
  local: string;
  /** The URI for toll-free numbers. */
  toll_free: string;
}

/** Available phone number model. */
export interface AvailablePhoneNumber {
  /** A formatted version of the number. */
  friendly_name: string;
  /** The number in E.164 format. */
  phone_number: string;
  /** The LATA of the number. Always null. */
  lata: string | null;
  /** The locality/city of the number. Always null. */
  locality: string | null;
  /** The rate center of the number. Only available for numbers in US and Canada. */
  rate_center: string | null;
  /** The latitude of the number. Always null. */
  latitude: string | null;
  /** The longitude of the number. Always null. */
  longitude: string | null;
  /** The state or province abbreviation of the number. Only available for numbers in US and Canada. */
  region: string | null;
  /** The postal/zip code of the number. Always null. */
  postal_code: string | null;
  /** The ISO country code of the number. */
  iso_country: string;
  /** Whether or not a number can receive calls and messages. */
  capabilities: PhoneNumberCapabilities;
  /** Always `false`. Included for Twilio API compatibility. */
  beta: boolean;
}

/** Call model representing a voice call. */
export interface Call {
  /** The unique identifier for the call. */
  sid: string;
  /** The unique identifier for the account that created this call. */
  account_sid: string;
  /** The date, in RFC 2822 GMT format, this call was created. */
  date_created: string;
  /** The date, in RFC 2822 GMT format, this call was updated. */
  date_updated: string;
  /** The unique identifier for the call that created this call. */
  parent_call_sid: string | null;
  /** The address that received the call. */
  to: string;
  /** The formatted number that received the call. */
  formatted_to: string;
  /** The formatted number that received the call. Alias for formatted_to. */
  to_formatted: string;
  /** The address that initiated the call. */
  from: string;
  /** The formatted number that initiated the call. */
  formatted_from: string;
  /** The formatted number that initiated the call. Alias for formatted_from. */
  from_formatted: string;
  /** The unique identifier for the phone number. */
  phone_number_sid: string | null;
  /** The status of the call. */
  status: CallStatus;
  /** The time, in RFC 2822 GMT format, on which the call began. */
  start_time: string | null;
  /** The time, in RFC 2822 GMT format, on which the call was terminated. */
  end_time: string | null;
  /** The duration, in seconds, of the call. */
  duration: number;
  /** The charge for the call. */
  price: number | null;
  /** The currency, in ISO 4127 format, for the price of the call. */
  price_unit: string;
  /** The direction of the call. */
  direction: CallDirection;
  /** Who/what the call was answered by. */
  answered_by: AnsweredBy | null;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The number this call was forwarded from. Always null. */
  forwarded_from: string | null;
  /** The caller name. Always null. */
  caller_name: string | null;
  /** The URI for the call. */
  uri: string;
  /** A Map of available sub-resources. */
  subresource_uris: CallSubresourceUris;
  /** The annotation for the call. Always null. */
  annotation: string | null;
  /** The group SID for the call. Always null. */
  group_sid: string | null;
  /** The Mean Opinion Score for audio quality (1.0-5.0). */
  audio_in_mos: number | null;
  /** The SIP result code for the call. */
  sip_result_code: string | null;
  /** The average round-trip time for audio in milliseconds. */
  audio_rtt_avg: number | null;
  /** The minimum round-trip time for audio in milliseconds. */
  audio_rtt_min: number | null;
  /** The maximum round-trip time for audio in milliseconds. */
  audio_rtt_max: number | null;
  /** The minimum outbound audio jitter in milliseconds. */
  audio_out_jitter_min: number | null;
  /** The maximum outbound audio jitter in milliseconds. */
  audio_out_jitter_max: number | null;
  /** The average outbound audio jitter in milliseconds. */
  audio_out_jitter_avg: number | null;
  /** The number of outbound audio packets lost. */
  audio_out_lost: number | null;
}

/** Call status. */
export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'canceled'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer';

/** Call direction. */
export type CallDirection = 'inbound' | 'outbound';

/** Who/what answered the call. */
export type AnsweredBy = 'human' | 'machine';

/** Call subresource URIs. */
export interface CallSubresourceUris {
  /** The URI for notifications. Always null. */
  notifications: string | null;
  /** The URI for recordings. */
  recordings: string;
}

/** Recording source. */
export type RecordingSource =
  | 'DialVerb'
  | 'Conference'
  | 'OutBoundApi'
  | 'Trunking'
  | 'RecordVerb'
  | 'StartCallRecordingApi'
  | 'StartConferenceRecording';

/** Recording status. */
export type RecordingStatus =
  | 'queued'
  | 'in-progress'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'absent'
  | 'stopped';

/** Recording subresource URIs. */
export interface RecordingSubresourceUris {
  /** The URI for transcriptions. */
  transcriptions: string;
}

/** Stream status. */
export type StreamStatus = 'queued' | 'in-progress' | 'stopped';

/** Conference model. */
export interface Conference {
  /** The unique identifier for this conference. */
  sid: string;
  /** The unique identifier for the account that created this conference. */
  account_sid: string;
  /** The date, in RFC 2822 format, this conference was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this conference was updated. */
  date_updated: string;
  /** A description, up to 64 characters, of the conference room. */
  friendly_name: string;
  /** The status of this conference. */
  status: ConferenceStatus;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The region where this conference audio was mixed. */
  region: string;
  /** The URI for this conference. */
  uri: string;
  /** The links to associated subresources. */
  subresource_uris: ConferenceSubresourceUris;
}

/** Conference status. */
export type ConferenceStatus = 'init' | 'in-progress' | 'completed';

/** Conference subresource URIs. */
export interface ConferenceSubresourceUris {
  /** Links to the participants. */
  participants: string;
  /** Links to the recordings. */
  recordings: string;
}

/** Conference participant model. */
export interface ConferenceParticipant {
  /** The unique identifier for the account that created this conference. */
  account_sid: string;
  /** The unique identifier for the Participant call connected to this conference. */
  call_sid: string;
  /** The unique identifier of the participant who is being coached. */
  call_sid_to_coach: string | null;
  /** Whether the participant is coaching another call. */
  coaching: boolean;
  /** The unique identifier for the conference this participant is in. */
  conference_sid: string;
  /** The date, in RFC 2822 format, this conference participant was created. */
  date_created: string;
  /** The status of the conference call. */
  status: ParticipantStatus;
  /** The date, in RFC 2822 format, this conference participant was updated. */
  date_updated: string;
  /** Whether or not a conference ends when a participant leaves the conference call. */
  end_conference_on_exit: boolean;
  /** Whether or not a participant is muted. */
  muted: boolean;
  /** Whether or not a participant is on hold. */
  hold: boolean;
  /** Whether or not a conference will begin when this participant enters the conference call. */
  start_conference_on_enter: boolean;
  /** The URI for this conference participant. */
  uri: string;
}

/** Conference participant status. */
export type ParticipantStatus = 'completed' | 'in-progress';

/** Conference recording model. */
export interface ConferenceRecording {
  /** The unique identifier for the recording. */
  sid: string;
  /** The unique identifier for the account that is associated with this recording. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The unique identifier for the call. Always null for conference recordings. */
  call_sid: string | null;
  /** The unique identifier for the conference that is associated with this recording. */
  conference_sid: string | null;
  /** The number of channels in a recording (singular key). Returns '1' for mono or '2' for stereo. */
  channel: '1' | '2';
  /** The number of channels in a recording. Returns '1' for mono or '2' for stereo. */
  channels: '1' | '2';
  /** The date, in RFC 2822 format, this recording was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this recording was updated. */
  date_updated: string;
  /** The time, in RFC 2822 format, this recording started. */
  start_time: string | null;
  /** The time, in RFC 2822 format, this recording ended. */
  end_time: string | null;
  /** The length, in seconds, of the recording. */
  duration: number;
  /** The cost for the recording. */
  price: string | null;
  /** The currency of the price of the recording. */
  price_unit: string;
  /** How the recording was made. */
  source: ConferenceRecordingSource;
  /** The status of the recording. */
  status: ConferenceRecordingStatus;
  /** Further details about a failed recording. */
  error_code: string | null;
  /** The URI of the recording. */
  uri: string;
  /** Subresource URIs. */
  subresource_uris: ConferenceRecordingSubresourceUris;
  /** Encryption details. Always null. */
  encryption_details: string | null;
  /** Whether leading and trailing silence is trimmed from a recording. */
  trim: string;
}

/** Recording source for conference recordings. */
export type ConferenceRecordingSource = 'Conference' | 'StartConferenceRecording';

/** Recording status. */
export type ConferenceRecordingStatus =
  | 'queued'
  | 'in-progress'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'absent'
  | 'stopped';

/** Recording subresource URIs. */
export interface ConferenceRecordingSubresourceUris {
  /** The URI for transcriptions. */
  transcriptions: string;
}

/** Conference stream status. */
export type ConferenceStreamStatus = 'queued' | 'in-progress' | 'stopped';

/** Fax model. */
export interface Fax {
  /** The unique identifier for the account this fax is associated with. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The date and time, in ISO 8601 format, the fax was created. */
  date_created: string;
  /** The date and time, in ISO 8601 format, the fax was updated. */
  date_updated: string;
  /** The direction of the fax. */
  direction: FaxDirection;
  /** The phone number, in E.164 format, the fax was sent from. */
  from: string;
  /** The URL hosting the received media, or null if not available. */
  media_url: string | null;
  /** The unique identifier for the media instance associated with the fax instance. */
  media_sid: string;
  /** The number of pages in the fax document, or null if not yet determined. */
  num_pages: string | null;
  /** The cost of the fax, or null if not yet calculated. */
  price: string | null;
  /** The currency, in ISO 4217 format, of the price. */
  price_unit: string;
  /** The quality of the fax. */
  quality: FaxQuality;
  /** The unique identifier of the fax. */
  sid: string;
  /** The status of the fax. */
  status: FaxStatus;
  /** The phone number, in E.164 format, the fax was sent to. */
  to: string;
  /** The time, in seconds, it took to deliver a fax. */
  duration: number;
  /** The URL links for resources associated with the fax. */
  links: FaxLinks;
  /** The URL of this resource. */
  url: string;
  /** Error code for this resource, or null if no error. */
  error_code: string | null;
  /** The description of this error, or null if no error. */
  error_message: string | null;
}

/** Fax direction. */
export type FaxDirection = 'inbound' | 'outbound';

/** Fax quality. */
export type FaxQuality = 'standard' | 'fine' | 'superfine';

/** Fax status. */
export type FaxStatus =
  | 'queued'
  | 'processing'
  | 'sending'
  | 'delivered'
  | 'receiving'
  | 'received'
  | 'no-answer'
  | 'busy'
  | 'failed'
  | 'canceled';

/** Fax links. */
export interface FaxLinks {
  /** Media associated with this fax. */
  media: string;
}

/** Fax media model. */
export interface FaxMedia {
  /** The unique identifier for the account. */
  account_sid: string;
  /** The content type of the media. */
  content_type: string;
  /** The date, in ISO 8601 format, this media was created. */
  date_created: string;
  /** The date, in ISO 8601 format, this media was updated. */
  date_updated: string;
  /** The unique identifier for the fax. */
  fax_sid: string;
  /** The unique identifier for the media. */
  sid: string;
  /** The URI for the media. */
  uri: string;
  /** The URL for the media. */
  url: string;
}

/** Address requirements. */
export type AddressRequirements = 'none' | 'any' | 'local' | 'foreign';

/** Phone number capabilities. */
export interface IncomingPhoneNumberCapabilities {
  /** Whether or not voice is enabled. */
  voice: boolean;
  /** Whether or not SMS is enabled. */
  sms: boolean;
  /** Whether or not MMS is enabled. */
  mms: boolean;
  /** Whether or not fax is enabled. */
  fax: boolean;
}

/** Phone number origin. */
export type PhoneNumberOrigin = 'signalwire' | 'hosted';

/** The type of phone number being imported. */
export type NumberType = 'longcode' | 'tollfree';

/** Phone number capabilities. */
export type PhoneNumberCapability = 'sms' | 'voice' | 'fax' | 'mms';

/** Message direction. */
export type MessageDirection = 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';

/** Message status. */
export type MessageStatus =
  | 'queued'
  | 'initiated'
  | 'sent'
  | 'failed'
  | 'delivered'
  | 'undelivered'
  | 'received';

/** Message subresource URIs. */
export interface MessageSubresourceUris {
  /** The URI for media. */
  media: string;
}

/** Message media model. */
export interface MessageMedia {
  /** The unique identifier for the account. */
  account_sid: string;
  /** The content type of the media. */
  content_type: string;
  /** The date, in RFC 2822 GMT format, this media was created. */
  date_created: string;
  /** The date, in RFC 2822 GMT format, this media was updated. */
  date_updated: string;
  /** The unique identifier for the message. */
  parent_sid: string;
  /** The unique identifier for the media. */
  sid: string;
  /** The URI for the media. */
  uri: string;
}

/** Queue member model representing a call waiting in a queue. */
export interface QueueMember {
  /** The unique identifier for the call. */
  call_sid: string;
  /** The unique identifier for the account. */
  account_sid: string;
  /** The unique identifier for the queue. */
  queue_sid: string;
  /** The date and time, in RFC 2822 format, when the member was enqueued. */
  date_enqueued: string;
  /** The position of the member in the queue (1-indexed). */
  position: number;
  /** The wait time, in seconds, since the member was enqueued. */
  wait_time: number;
  /** The type of the queue member. */
  member_type: string;
  /** The URI of this resource, relative to the API base URL. */
  uri: string;
}

/** Recording model. */
export interface Recording {
  /** The unique identifier for the recording. */
  sid: string;
  /** The unique identifier for the account that is associated with this recording. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The unique identifier for the call that is associated with this recording. Null if this is a conference recording. */
  call_sid: string | null;
  /** The unique identifier for the conference that is associated with this recording. Null if this is a call recording. */
  conference_sid: string | null;
  /** The number of channels in a recording (singular key). Returns '1' for mono or '2' for stereo. */
  channel: '1' | '2';
  /** The number of channels in a recording. Returns '1' for mono or '2' for stereo. */
  channels: '1' | '2';
  /** The date, in RFC 2822 format, this recording was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this recording was updated. */
  date_updated: string;
  /** The time, in RFC 2822 format, this recording started. */
  start_time: string | null;
  /** The time, in RFC 2822 format, this recording ended. */
  end_time: string | null;
  /** The length, in seconds, of the recording. */
  duration: number;
  /** The cost for the recording. */
  price: string | null;
  /** The currency of the price of the recording. */
  price_unit: string;
  /** How the recording was made. */
  source: RecordingSource;
  /** The status of the recording. */
  status: RecordingStatus;
  /** Further details about a failed recording. */
  error_code: string | null;
  /** The URI of the recording. */
  uri: string;
  /** Subresource URIs. */
  subresource_uris: RecordingSubresourceUris;
  /** Encryption details. Always null. */
  encryption_details: string | null;
  /** Whether leading and trailing silence is trimmed from a recording. */
  trim: string;
}

/** Transcription model. */
export interface Transcription {
  /** The unique identifier for the transcription. */
  sid: string;
  /** The unique identifier for the account that created this transcription. */
  account_sid: string;
  /** The version of the SignalWire API. */
  api_version: string;
  /** The unique identifier for the recording that this transcription was created from. */
  recording_sid: string;
  /** The date, in RFC 2822 format, this transcription was created. */
  date_created: string;
  /** The date, in RFC 2822 format, this transcription was updated. */
  date_updated: string;
  /** The duration, in seconds, of the transcribed audio. */
  duration: number;
  /** The charge for the transcription. Null if cost has not been calculated. */
  price: string | null;
  /** The currency, in ISO 4217 format, for the price of the transcription. */
  price_unit: string;
  /** The status of the transcription. Always 'completed' for transcriptions returned by the API. */
  status: string;
  /** The text content of the transcription. Null if transcription text is not available. */
  transcription_text: string | null;
  /** The type of the transcription. Currently always an empty string. */
  type: string;
  /** The URI of this resource, relative to the API base URL. */
  uri: string;
}

/** Phone number capabilities. */
export interface PhoneNumberCapabilities {
  /** Whether or not voice is enabled on the number. */
  voice: boolean;
  /** Whether or not SMS is enabled on the number. */
  SMS: boolean;
  /** Whether or not MMS is enabled on the number. */
  MMS: boolean;
}
