/**
 * Calling API types.
 *
 * Hand-derived from the canonical OpenAPI contract at
 * `porting-sdk/rest-apis/calling/openapi.yaml`. The Calling API is a single
 * command-dispatch endpoint (`POST /api/calling/calls`): every method maps to a
 * `command` enum value in the `CallRequest` oneOf union, and the SDK method's
 * `params` argument corresponds to that command schema's `params` sub-object.
 *
 * Each `*Params` interface below mirrors the `params` schema of one command;
 * field names are the wire (snake_case) keys exactly as the platform accepts
 * them. The 2xx response for every command is `CallResponse`.
 *
 * These are compile-time annotations only — they do not affect runtime behavior
 * or wire shape.
 */

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** The direction of the call. */
export type CallDirection = 'inbound' | 'outbound' | 'outbound-api';

/** The status of the call throughout its lifecycle. */
export type CallResponseStatus =
  | 'queued'
  | 'initiated'
  | 'created'
  | 'ringing'
  | 'answered'
  | 'ending'
  | 'ended'
  | 'failed'
  | 'canceled'
  | 'completed';

/** The reason for hanging up the call. */
export type HangupReason = 'hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error';

/** Direction(s) of the call to transcribe/translate. */
export type TranscribeDirection = 'remote-caller' | 'local-caller';

/** Speech recognition engine options. */
export type SpeechEngine = 'deepgram' | 'google';

/** Preset translation filter values that adjust the tone or style of translated speech. */
export type TranslationFilterPreset = 'polite' | 'rude' | 'professional' | 'shakespeare' | 'gen-z';

/**
 * Custom translation filter with a `prompt:` prefix. The wire value is a string
 * matching `^prompt:.+$` (e.g. `prompt:Use formal business language`).
 */
export type CustomTranslationFilter = string;

/** A translation filter — either a named preset or a custom `prompt:`-prefixed string. */
export type TranslationFilter = TranslationFilterPreset | CustomTranslationFilter;

/**
 * An inline SWML document. SWML is an open-ended, deeply-nested instruction
 * tree whose full schema is defined elsewhere; callers pass an arbitrary SWML
 * object here, so it is modeled as an open record.
 */
export type SWMLObject = Record<string, unknown>;

/** Details on a charge associated with a call. */
export interface ChargeDetails {
  /** Description for this charge. */
  description: string;
  /** Charged amount. */
  charge: number;
}

// ---------------------------------------------------------------------------
// Response: CallResponse = CallLeg | FabricDeviceLeg
// ---------------------------------------------------------------------------

/** A Call leg (PSTN, SIP, or WebRTC). */
export interface CallLeg {
  /** The unique identifier of the call on SignalWire. */
  id: string;
  /** The origin number or address. */
  from: string;
  /** The destination number or address. */
  to: string;
  /** The direction of the call. */
  direction: CallDirection;
  /** Source of this call. */
  source: 'realtime_api';
  /** The URL associated with this call. */
  url: string | null;
  /** Total charge for this call. */
  charge: number;
  /** The date and time when the call was created. */
  created_at: string;
  /** Details on charges associated with this call. */
  charge_details: ChargeDetails[];
  /** The status of the call. */
  status: CallResponseStatus | null;
  /** The duration of the call in seconds. */
  duration: number | null;
  /** The duration of the call in milliseconds. */
  duration_ms: number | null;
  /** The billable duration of the call in milliseconds. */
  billing_ms: number | null;
  /** Type of this call. */
  type: 'relay_pstn_call' | 'relay_sip_call' | 'relay_webrtc_call';
  /** The parent call ID if this is a child call. */
  parent_id: string | null;
}

/** A Fabric subscriber device leg. */
export interface FabricDeviceLeg {
  /** The unique identifier of the call on SignalWire. */
  id: string;
  /** The origin number or address. */
  from: string;
  /** The destination number or address. */
  to: string;
  /** The direction of the call. */
  direction: CallDirection;
  /** Source of this call. */
  source: 'realtime_api';
  /** The URL associated with this call. */
  url: string | null;
  /** Total charge for this call. */
  charge: number;
  /** The date and time when the call was created. */
  created_at: string;
  /** Details on charges associated with this call. */
  charge_details: ChargeDetails[];
  /** The status of the call. Always null for Fabric subscriber device legs. */
  status: null;
  /** Type of this call. */
  type: 'fabric_subscriber_device_leg';
}

/** The 2xx response returned by every calling command. */
export type CallResponse = CallLeg | FabricDeviceLeg;

// ---------------------------------------------------------------------------
// Call lifecycle
// ---------------------------------------------------------------------------

/** Common fields shared by the `dial` command's URL and SWML param shapes. */
interface DialParamsCommon {
  /** The address that initiated the call (E.164 number or SIP endpoint). */
  from: string;
  /** The address that received the call (E.164 number or SIP endpoint). */
  to: string;
  /** The number, in E.164 format, or identifier of the caller. */
  caller_id?: string;
  /** Backup webhook/route containing SWML instructions for handling the call. */
  fallback_url?: string;
  /** A URL that will receive status updates for the call. */
  status_url?: string;
  /** The call events that will be monitored and sent to `status_url`. */
  status_events?: Array<'answered' | 'queued' | 'initiated' | 'ringing' | 'ending' | 'ended'>;
  /** The HTTP method to use when requesting the URL. */
  url_method?: string;
}

/** `dial` params when handling the call via a URL. */
export interface DialParamsURL extends DialParamsCommon {
  /** The URL to handle the call. */
  url: string;
}

/** `dial` params when handling the call via inline SWML. */
export interface DialParamsSWML extends DialParamsCommon {
  /**
   * A list of codecs to use for the call. Can be an array of codec strings or a
   * comma-separated string.
   */
  codecs?: string[] | string;
  /** Inline SWML object containing instructions for handling the call. */
  swml: SWMLObject;
}

/** Params for the `dial` command. */
export type DialParams = DialParamsURL | DialParamsSWML;

/** Common fields shared by the `update` command's URL and SWML param shapes. */
interface UpdateCallParamsCommon {
  /** The unique identifying ID of an existing call. */
  id: string;
  /** Backup webhook/route containing SWML instructions for handling the call. */
  fallback_url?: string;
  /**
   * Either `canceled` (to cancel a not-yet-connected call) or `completed` (to
   * end a call that is in progress).
   */
  status?: 'canceled' | 'completed';
  /** A URL to receive call status update callbacks. */
  status_url?: string;
}

/** `update` params when handling the call via a URL. */
export interface UpdateCallParamsURL extends UpdateCallParamsCommon {
  /** The URL to handle the call. */
  url: string;
}

/** `update` params when handling the call via inline SWML. */
export interface UpdateCallParamsSWML extends UpdateCallParamsCommon {
  /** Inline SWML object containing instructions for handling the call. */
  swml: SWMLObject;
}

/** Params for the `update` command. */
export type UpdateCallParams = UpdateCallParamsURL | UpdateCallParamsSWML;

/** Params for the `calling.end` command. */
export interface EndParams {
  /** Set the reason why the call was hung up. */
  reason?: HangupReason;
}

/** Params for the `calling.transfer` command. */
export interface TransferParams {
  /** The destination to transfer the call to (SIP URI, phone number, or inline SWML object). */
  dest: string | SWMLObject;
}

/**
 * Params for the `calling.disconnect` command. The command takes no parameters
 * beyond the call id.
 */
export type DisconnectParams = Record<string, never>;

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------

/** A single media object to play. */
export interface PlayMedia {
  /** The type of media to play. */
  type?: 'audio' | 'tts' | 'silence' | 'ring';
  /** Type-specific parameters (url for audio, text/language/gender for tts, duration for silence/ring). */
  params?: Record<string, unknown>;
}

/** Params for the `calling.play` command. */
export interface PlayParams {
  /** Unique identifier for this play operation. Auto-generated if not provided. */
  control_id?: string;
  /** Array of media objects to play. */
  play: PlayMedia[];
  /** Volume adjustment in dB. 0 is default. */
  volume?: number;
  /** Which leg of the call to play to. */
  direction?: 'listen' | 'speak' | 'both';
  /** Number of times to loop. 0 means infinite. */
  loop?: number;
  /** Webhook URL for play state events. */
  status_url?: string;
}

/** Params for the `calling.play.pause` command. */
export interface PlayPauseParams {
  /** The control_id of the play operation to pause. */
  control_id: string;
}

/** Params for the `calling.play.resume` command. */
export interface PlayResumeParams {
  /** The control_id of the play operation to resume. */
  control_id: string;
}

/** Params for the `calling.play.stop` command. */
export interface PlayStopParams {
  /** The control_id of the play operation to stop. */
  control_id: string;
}

/** Params for the `calling.play.volume` command. */
export interface PlayVolumeParams {
  /** The control_id of the play operation. */
  control_id: string;
  /** Volume adjustment in dB. */
  volume: number;
}

// ---------------------------------------------------------------------------
// Record
// ---------------------------------------------------------------------------

/** Audio recording parameters for the `calling.record` command. */
export interface RecordAudioParams {
  /** Play a beep before recording starts. */
  beep?: boolean;
  /** Recording file format. */
  format?: 'mp3' | 'wav';
  /** Record in stereo (separate channels per leg). */
  stereo?: boolean;
  /** Which leg(s) to record. */
  direction?: 'listen' | 'speak' | 'both';
  /** Seconds of silence before recording ends if no audio detected. */
  initial_timeout?: number;
  /** Seconds of silence after speech to stop recording. */
  end_silence_timeout?: number;
  /** DTMF digits that stop recording (e.g. '#'). */
  terminators?: string;
  /** Input sensitivity threshold (0-100). */
  input_sensitivity?: number;
}

/** Params for the `calling.record` command. */
export interface RecordParams {
  /** Unique identifier for this recording. Auto-generated if not provided. */
  control_id?: string;
  /** Audio recording parameters. */
  audio?: RecordAudioParams;
  /** Webhook URL for recording state events. */
  status_url?: string;
}

/** Params for the `calling.record.pause` command. */
export interface RecordPauseParams {
  /** The control_id of the recording to pause. */
  control_id: string;
}

/** Params for the `calling.record.resume` command. */
export interface RecordResumeParams {
  /** The control_id of the recording to resume. */
  control_id: string;
}

/** Params for the `calling.record.stop` command. */
export interface RecordStopParams {
  /** The control_id of the recording to stop. */
  control_id: string;
}

// ---------------------------------------------------------------------------
// Collect
// ---------------------------------------------------------------------------

/** DTMF digit collection parameters for the `calling.collect` command. */
export interface CollectDigitsParams {
  /** Maximum number of digits to collect. */
  max?: number;
  /** Characters that end digit collection (e.g. '#'). */
  terminators?: string;
  /** Seconds to wait between digits. */
  digit_timeout?: number;
}

/** Speech recognition parameters for the `calling.collect` command. */
export interface CollectSpeechParams {
  /** Seconds of silence after speech to finalize. */
  end_silence_timeout?: number;
  /** Max seconds of speech to collect. */
  speech_timeout?: number;
  /** Speech recognition language code (e.g. en-US). */
  language?: string;
  /** Words or phrases to boost recognition. */
  hints?: string[];
  /** Speech recognition engine. */
  engine?: string;
}

/** Params for the `calling.collect` command. */
export interface CollectParams {
  /** Unique identifier for this collect operation. */
  control_id?: string;
  /** Seconds to wait for first input before timeout. */
  initial_timeout?: number;
  /** DTMF digit collection parameters. */
  digits?: CollectDigitsParams;
  /** Speech recognition parameters. */
  speech?: CollectSpeechParams;
  /** Keep collecting after each result. */
  continuous?: boolean;
  /** Deliver partial recognition results. */
  partial_results?: boolean;
}

/** Params for the `calling.collect.stop` command. */
export interface CollectStopParams {
  /** The control_id of the collect operation to stop. */
  control_id: string;
}

/** Params for the `calling.collect.start_input_timers` command. */
export interface CollectStartInputTimersParams {
  /** The control_id of the collect operation. */
  control_id: string;
}

// ---------------------------------------------------------------------------
// Detect
// ---------------------------------------------------------------------------

/** Type-specific detection parameters for the `calling.detect` command. */
export interface DetectTypeParams {
  /** Seconds to wait for initial detection. */
  initial_timeout?: number;
  /** Seconds of silence to end detection. */
  end_silence_timeout?: number;
  /** Seconds to wait for machine greeting to finish. */
  machine_ready_timeout?: number;
  /** Threshold for machine voice detection. */
  machine_voice_threshold?: number;
  /** Word count threshold for machine detection. */
  machine_words_threshold?: number;
  /** Detect if machine greeting is interrupted. */
  detect_interruptions?: boolean;
  /** Detect end of machine message (beep). */
  detect_message_end?: boolean;
  /** Tone to detect (for fax type - CED or CNG). */
  tone?: string;
  /** Specific digit sequence to detect (for digit type). */
  digits?: string;
}

/** Detection configuration for the `calling.detect` command. */
export interface DetectConfig {
  /** Type of detection to perform. */
  type: 'machine' | 'fax' | 'digit';
  /** Type-specific detection parameters. */
  params?: DetectTypeParams;
}

/** Params for the `calling.detect` command. */
export interface DetectParams {
  /** Unique identifier for this detect operation. */
  control_id?: string;
  /** Detection configuration. */
  detect: DetectConfig;
  /** Overall timeout in seconds for the detect operation. */
  timeout?: number;
}

/** Params for the `calling.detect.stop` command. */
export interface DetectStopParams {
  /** The control_id of the detect operation to stop. */
  control_id: string;
}

// ---------------------------------------------------------------------------
// Tap
// ---------------------------------------------------------------------------

/** Tap parameters describing what to tap. */
export interface TapTapParams {
  /** Which direction to tap. */
  direction?: 'listen' | 'speak' | 'both';
}

/** What to tap for the `calling.tap` command. */
export interface TapSource {
  /** Tap type. */
  type: 'audio';
  /** Tap parameters. */
  params?: TapTapParams;
}

/** Device-specific parameters for the tap target. */
export interface TapDeviceParams {
  /** Target IP address (rtp type). */
  addr?: string;
  /** Target port (rtp type). */
  port?: number;
  /** Audio codec (PCMU, PCMA, OPUS). */
  codec?: string;
  /** Packetization time in ms (rtp type). */
  ptime?: number;
  /** WebSocket URI (ws type). */
  uri?: string;
  /** Sample rate (ws type). */
  rate?: number;
}

/** Target device to send tapped audio to. */
export interface TapDevice {
  /** Target device type. */
  type: 'rtp' | 'ws';
  /** Device-specific parameters. */
  params?: TapDeviceParams;
}

/** Params for the `calling.tap` command. */
export interface TapParams {
  /** Unique identifier for this tap operation. */
  control_id?: string;
  /** What to tap. */
  tap: TapSource;
  /** Target device to send tapped audio to. */
  device: TapDevice;
}

/** Params for the `calling.tap.stop` command. */
export interface TapStopParams {
  /** The control_id of the tap operation to stop. */
  control_id: string;
}

// ---------------------------------------------------------------------------
// Stream
// ---------------------------------------------------------------------------

/** Params for the `calling.stream` command. */
export interface StreamParams {
  /** Unique identifier for this stream operation. */
  control_id?: string;
  /** WebSocket URL (wss://) to stream audio to. */
  url: string;
  /** Audio codec for the stream. */
  codec?: string;
  /** Which audio track(s) to stream. */
  track?: 'inbound_track' | 'outbound_track' | 'both_tracks';
  /** Bearer token sent in the WebSocket handshake. */
  authorization_bearer_token?: string;
  /** Custom key-value pairs sent with the stream. */
  custom_parameters?: Record<string, unknown>;
}

/** Params for the `calling.stream.stop` command. */
export interface StreamStopParams {
  /** The control_id of the stream to stop. */
  control_id: string;
}

// ---------------------------------------------------------------------------
// Denoise
// ---------------------------------------------------------------------------

/** Params for the `calling.denoise` command. Takes no parameters beyond the call id. */
export type DenoiseParams = Record<string, never>;

/** Params for the `calling.denoise.stop` command. Takes no parameters beyond the call id. */
export type DenoiseStopParams = Record<string, never>;

// ---------------------------------------------------------------------------
// Transcribe
// ---------------------------------------------------------------------------

/** Params for the `calling.transcribe` command. */
export interface TranscribeParams {
  /** Unique identifier for this transcription. */
  control_id?: string;
  /** Webhook URL for transcription results. */
  status_url?: string;
}

/** Params for the `calling.transcribe.stop` command. */
export interface TranscribeStopParams {
  /** The control_id of the transcription to stop. */
  control_id: string;
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

/** Parameters for resetting the AI conversation state. */
export interface AIMessageResetParams {
  /** Whether to perform a full reset of the AI conversation, clearing all history. */
  full_reset?: boolean;
  /** A new user prompt to set after resetting the conversation. */
  user_prompt?: string;
  /** A new system prompt to set after resetting the conversation. */
  system_prompt?: string;
}

/** Params for the `calling.ai_message` command. */
export interface AIMessageParams {
  /** The role that the message is from. Required when `reset` is not provided. */
  role?: 'system' | 'user' | 'assistant';
  /** The text content sent to the AI. Required when `reset` is not provided. */
  message_text?: string;
  /** Parameters for resetting the AI conversation state. */
  reset?: AIMessageResetParams;
  /** Arbitrary JSON data to merge into the AI session's global data store. */
  global_data?: Record<string, unknown>;
}

/** Params for the `calling.ai_hold` command. */
export interface AIHoldParams {
  /** The duration to hold the caller in seconds. */
  timeout?: number;
  /** A system message added to the AI conversation before placing the caller on hold. */
  prompt?: string;
}

/** Params for the `calling.ai_unhold` command. */
export interface AIUnholdParams {
  /** A system message added to the AI conversation when taking the caller off hold. */
  prompt?: string;
}

/** Params for the `calling.ai.stop` command. */
export interface AIStopParams {
  /** The control_id of the AI session to stop. */
  control_id: string;
}

// ---------------------------------------------------------------------------
// Live transcribe / translate
// ---------------------------------------------------------------------------

/** The `start` payload for a live-transcribe session. */
export interface LiveTranscribeStart {
  /** The language to transcribe (e.g., 'en-US', 'es-ES'). */
  lang: string;
  /** The direction(s) of the call to transcribe. */
  direction: TranscribeDirection[];
  /** The webhook URL to receive transcription events. */
  webhook?: string;
  /** Whether to send real-time utterance events as speech is recognized. */
  live_events?: boolean;
  /** Whether to generate an AI summary when transcription ends. */
  ai_summary?: boolean;
  /** The AI prompt that instructs how to summarize the conversation. */
  ai_summary_prompt?: string;
  /** The speech recognition engine to use. */
  speech_engine?: SpeechEngine;
  /** Speech timeout in milliseconds. */
  speech_timeout?: number;
  /** Voice activity detection silence time in milliseconds. */
  vad_silence_ms?: number;
  /** Voice activity detection threshold (0-1800). */
  vad_thresh?: number;
  /** Debug level for logging (0-2). */
  debug_level?: number;
}

/** The `summarize` payload for a live-transcribe session. */
export interface LiveTranscribeSummarize {
  /** The webhook URL to receive the summary. */
  webhook?: string;
  /** The AI prompt that instructs how to summarize the conversation. */
  prompt?: string;
}

/** Start a live transcription. */
export interface LiveTranscribeStartAction {
  /** Starts live transcription of the call. */
  start: LiveTranscribeStart;
}

/** Request an on-demand AI summary of the conversation. */
export interface LiveTranscribeSummarizeAction {
  /** Request an on-demand AI summary of the conversation. */
  summarize: LiveTranscribeSummarize;
}

/** Stop the live transcription session. */
export type LiveTranscribeStopAction = 'stop';

/** The transcription action to perform: start, stop, or summarize. */
export type LiveTranscribeAction =
  | LiveTranscribeStartAction
  | LiveTranscribeSummarizeAction
  | LiveTranscribeStopAction;

/** Params for the `calling.live_transcribe` command. */
export interface LiveTranscribeParams {
  /** The transcription action to perform: start, stop, or summarize. */
  action: LiveTranscribeAction;
}

/** The `start` payload for a live-translate session. */
export interface LiveTranslateStart {
  /** The language to translate from (e.g., 'en-US'). */
  from_lang: string;
  /** The language to translate to (e.g., 'es-ES'). */
  to_lang: string;
  /** The direction(s) of the call to translate. */
  direction: TranscribeDirection[];
  /** The TTS voice for the source language. */
  from_voice?: string;
  /** The TTS voice for the target language. */
  to_voice?: string;
  /** Translation filter for the source language direction. */
  filter_from?: TranslationFilter;
  /** Translation filter for the target language direction. */
  filter_to?: TranslationFilter;
  /** The webhook URL to receive translation events. */
  webhook?: string;
  /** Whether to send real-time translation events. */
  live_events?: boolean;
  /** Whether to generate AI summaries in both languages when translation ends. */
  ai_summary?: boolean;
  /** The AI prompt that instructs how to summarize the conversation. */
  ai_summary_prompt?: string;
  /** The speech recognition engine to use. */
  speech_engine?: SpeechEngine;
  /** Speech timeout in milliseconds. */
  speech_timeout?: number;
  /** Voice activity detection silence time in milliseconds. */
  vad_silence_ms?: number;
  /** Voice activity detection threshold (0-1800). */
  vad_thresh?: number;
  /** Debug level for logging (0-2). */
  debug_level?: number;
}

/** The `summarize` payload for a live-translate session. */
export interface LiveTranslateSummarize {
  /** The webhook URL to receive the summary. */
  webhook?: string;
  /** The AI prompt that instructs how to summarize the conversation. */
  prompt?: string;
}

/** The `inject` payload for a live-translate session. */
export interface LiveTranslateInject {
  /** The text message to inject and translate. */
  message: string;
  /** The direction to send the translated message. */
  direction: TranscribeDirection;
}

/** Start a live translation. */
export interface LiveTranslateStartAction {
  /** Starts live translation of the call. */
  start: LiveTranslateStart;
}

/** Request an on-demand AI summary of the translated conversation. */
export interface LiveTranslateSummarizeAction {
  /** Request an on-demand AI summary of the translated conversation. */
  summarize: LiveTranslateSummarize;
}

/** Inject a message into the conversation to be translated and spoken. */
export interface LiveTranslateInjectAction {
  /** Inject a message into the conversation to be translated and spoken. */
  inject: LiveTranslateInject;
}

/** Stop the live translation session. */
export type LiveTranslateStopAction = 'stop';

/** The translation action to perform: start, stop, summarize, or inject. */
export type LiveTranslateAction =
  | LiveTranslateStartAction
  | LiveTranslateSummarizeAction
  | LiveTranslateInjectAction
  | LiveTranslateStopAction;

/** Params for the `calling.live_translate` command. */
export interface LiveTranslateParams {
  /** The translation action to perform: start, stop, summarize, or inject. */
  action: LiveTranslateAction;
  /** A URL to receive status update callbacks for the translation session. */
  status_url?: string;
}

// ---------------------------------------------------------------------------
// Fax
// ---------------------------------------------------------------------------

/** Params for the `calling.send_fax.stop` command. */
export interface SendFaxStopParams {
  /** The control_id of the fax send to stop. */
  control_id: string;
}

/** Params for the `calling.receive_fax.stop` command. */
export interface ReceiveFaxStopParams {
  /** The control_id of the fax receive to stop. */
  control_id: string;
}

// ---------------------------------------------------------------------------
// SIP
// ---------------------------------------------------------------------------

/** SIP REFER parameters for the `calling.refer` command. */
export interface ReferDeviceParams {
  /** SIP URI to REFER to. */
  to: string;
  /** Optional SIP auth username. */
  username?: string;
  /** Optional SIP auth password. */
  password?: string;
}

/** Target device for the REFER. */
export interface ReferDevice {
  /** Device type (only sip supported for REFER). */
  type: 'sip';
  /** SIP REFER parameters. */
  params: ReferDeviceParams;
}

/** Params for the `calling.refer` command. */
export interface ReferParams {
  /** Target device for the REFER. */
  device: ReferDevice;
  /** Webhook URL for REFER state events. */
  status_url?: string;
}

// ---------------------------------------------------------------------------
// Custom events
// ---------------------------------------------------------------------------

/** Params for the `calling.user_event` command. */
export interface UserEventParams {
  /** Arbitrary JSON event data to fire on the call. */
  event: Record<string, unknown>;
}
