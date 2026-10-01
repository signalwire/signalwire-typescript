// AUTO-GENERATED from porting-sdk/rest-apis/fabric/openapi.enriched.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

export interface AIAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

/** An AI Agent configuration that extends the SWML AI object with additional API-specific properties. */
export interface AIAgent {
  /** A key-value object for storing data that persists throughout the AI session. */
  global_data?: Record<string, unknown>;
  /** Hints help the AI agent understand certain words or phrases better. Words that can commonly be misinterpreted can be added to the hints to help the AI speak more accurately. */
  hints?: string[];
  /** An array of JSON objects defining supported languages in the conversation. */
  languages?: AIAgentLanguage[];
  /** A JSON object containing parameters as key-value pairs. */
  params?: AIParams;
  /** The final set of instructions and configuration settings to send to the agent. */
  post_prompt?: AIAgentPostPrompt;
  /** The URL to which to send status callbacks and reports. Authentication can also be set in the url in the format of `username:password@url`. */
  post_prompt_url?: string;
  /** An array of JSON objects to clarify the AI's pronunciation of words or expressions. */
  pronounce?: AIAgentPronounce[];
  /** Defines the AI agent's personality, goals, behaviors, and instructions for handling conversations. */
  prompt: AIAgentPrompt;
  /** An array of JSON objects to create user-defined functions/endpoints that can be executed during the dialogue. */
  SWAIG?: AIAgentSWAIG;
  /** Unique ID of an AI Agent. */
  agent_id: uuid;
  /** Name of the AI Agent. */
  name: string;
  /** Multilingual configuration for the agent. */
  multilingual?: {
    allowed?: unknown[];
    engine?: string;
    fillers?:
      | unknown[]
      | {
          default?: Record<string, unknown>;
          auto?: Record<string, unknown>;
        };
    function_fillers?:
      | unknown[]
      | {
          default?: Record<string, unknown>;
          auto?: Record<string, unknown>;
        };
    languages?: unknown[];
    min_switch_words?: number;
    model?: string;
    provider?: string;
    start_language?: string;
    turn_fillers?:
      | unknown[]
      | {
          default?: Record<string, unknown>;
        };
  };
}

/** Without one of `code` / `listen_language`, `name` and `voice`, the element has no effect: it is accepted and ignored, not rejected. */
export interface AIAgentLanguage {
  auto_emotion?: boolean | string;
  auto_speed?: boolean | string;
  code?: unknown[] | string;
  double_turn_fillers?: unknown[];
  engine?: string;
  fillers?: string[] | string;
  function_fillers?: unknown[];
  listen_language?: unknown[] | string;
  model?: string;
  name?: string;
  params?: LanguageParams;
  pronounce?: unknown[];
  speech_fillers?: unknown[];
  turn_fillers?: unknown[];
  voice?: string;
  /** Identifier of the language entry, assigned by the server when omitted. */
  id?: string;
  /** TTS provider of `voice`. Stored as sent, or inferred from `voice` when omitted. */
  provider?: string;
}

export interface AIAgentSWAIG {
  defaults?: SWAIGDefaults;
  functions?: AIAgentSWAIGFunction[];
  hooks?: {
    description?: string;
    active?: boolean | number | string;
    argument?: FunctionParameters;
    data_map?: DataMap;
    fillers?: {
      default?: Record<string, unknown>;
      auto?: Record<string, unknown>;
    };
    function?: string;
    meta_data?: Record<string, unknown>;
    meta_data_token?: string;
    parameters?: FunctionParameters;
    purpose?: string;
    skip_fillers?: boolean | string;
    wait_file?: string;
    wait_file_loops?: number | string;
    wait_for_fillers?: boolean | string;
    web_hook_auth_pass?: string;
    web_hook_auth_password?: string;
    web_hook_auth_user?: string;
    web_hook_url?: string;
  }[];
  includes?: AIAgentSWAIGInclude[];
  internal_fillers?: SWAIGInternalFiller;
  mcp_servers?: {
    headers?: Record<string, unknown>;
    resource_vars?: Record<string, unknown>;
    resources?: boolean | string;
    url?: string;
  }[];
  native_functions?: SWAIGNativeFunction[];
}

/** Without `functions` and `url`, the element has no effect: it is accepted and ignored, not rejected. */
export interface AIAgentSWAIGInclude {
  /** Identifier of the include entry. */
  id?: string;
  /** Names of the remote functions to include. */
  functions?: string[];
  /** URL where the remote functions are defined. */
  url?: string;
}

export interface AIAgentAddressListResponse {
  /** An array of objects containing the address data */
  data: FabricAddressApp[];
  /** Object containing pagination links */
  links: AIAddressPaginationResponse;
}

export interface AIAgentVoice {
  /** Identifier of the voice. */
  id: string;
  /** TTS provider of the voice. */
  provider: string;
  /** Language name. */
  language: string;
  /** Language code. */
  language_code: string;
  /** Voice string to use in an AI Agent language entry. */
  voice: string;
  /** Premium tier of the voice (0 for standard). */
  premium: number;
}

export interface AIAgentConversationLogListResponse {
  links: AIAddressPaginationResponse;
  data: AIAgentConversationLog[];
}

export interface AIAgentConversationLog {
  /** Unique ID of the conversation. */
  id: string;
  /** Number of the caller. */
  caller_id_number: string | null;
  /** Length of the AI session in seconds. */
  duration_in_seconds: number;
  /** The conversation log; empty once the conversation is redacted. */
  messages: Record<string, unknown>[] | null;
  /** When the conversation was redacted. */
  redacted_at: string | null;
}

export interface AIAgentCreateRequest {
  /** A key-value object for storing data that persists throughout the AI session. */
  global_data?: Record<string, unknown>;
  /** Hints help the AI agent understand certain words or phrases better. Words that can commonly be misinterpreted can be added to the hints to help the AI speak more accurately. */
  hints?: string[];
  /** An array of JSON objects defining supported languages in the conversation. */
  languages?: AIAgentLanguage[];
  /** A JSON object containing parameters as key-value pairs. */
  params?: AIParams;
  /** The final set of instructions and configuration settings to send to the agent. */
  post_prompt?: AIAgentPostPrompt;
  /** The URL to which to send status callbacks and reports. Authentication can also be set in the url in the format of `username:password@url`. */
  post_prompt_url?: string;
  /** An array of JSON objects to clarify the AI's pronunciation of words or expressions. */
  pronounce?: AIAgentPronounce[];
  /** Defines the AI agent's personality, goals, behaviors, and instructions for handling conversations. */
  prompt?: AIAgentPrompt;
  /** An array of JSON objects to create user-defined functions/endpoints that can be executed during the dialogue. */
  SWAIG?: AIAgentSWAIG;
  /** Name of the AI Agent. */
  name: string;
  /** The username for authenticating to the post-prompt URL. */
  post_prompt_auth_user?: string;
  /** The password for authenticating to the post-prompt URL. */
  post_prompt_auth_password?: string;
  /** Multilingual configuration for the agent. */
  multilingual?: {
    allowed?: unknown[];
    engine?: string;
    fillers?:
      | unknown[]
      | {
          default?: Record<string, unknown>;
          auto?: Record<string, unknown>;
        };
    function_fillers?:
      | unknown[]
      | {
          default?: Record<string, unknown>;
          auto?: Record<string, unknown>;
        };
    languages?: unknown[];
    min_switch_words?: number;
    model?: string;
    provider?: string;
    start_language?: string;
    turn_fillers?:
      | unknown[]
      | {
          default?: Record<string, unknown>;
        };
  };
}

/** The request contains invalid parameters. See errors for details. */
export interface AIAgentCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface AIAgentListResponse {
  /** An array of objects containing the list of AI Agent data. */
  data: AIAgentResponse[];
  /** Object containing pagination links */
  links: AIAgentPaginationResponse;
}

export interface AIAgentPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface AIAgentResponse {
  /** Unique ID of the AIAgent. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the AIAgent Fabric Resource */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'ai_agent';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** AIAgent data. */
  ai_agent: AIAgent;
}

export interface AIAgentUpdateRequest {
  /** A key-value object for storing data that persists throughout the AI session. */
  global_data?: Record<string, unknown>;
  /** Hints help the AI agent understand certain words or phrases better. Words that can commonly be misinterpreted can be added to the hints to help the AI speak more accurately. */
  hints?: string[];
  /** An array of JSON objects defining supported languages in the conversation. */
  languages?: AIAgentLanguage[];
  /** A JSON object containing parameters as key-value pairs. */
  params?: AIParams;
  /** The final set of instructions and configuration settings to send to the agent. */
  post_prompt?: AIAgentPostPrompt;
  /** The URL to which to send status callbacks and reports. Authentication can also be set in the url in the format of `username:password@url`. */
  post_prompt_url?: string;
  /** An array of JSON objects to clarify the AI's pronunciation of words or expressions. */
  pronounce?: AIAgentPronounce[];
  /** Defines the AI agent's personality, goals, behaviors, and instructions for handling conversations. */
  prompt?: AIAgentPrompt;
  /** An array of JSON objects to create user-defined functions/endpoints that can be executed during the dialogue. */
  SWAIG?: AIAgentSWAIG;
  /** Name of the AI Agent. */
  name?: string;
  /** The username for authenticating to the post-prompt URL. */
  post_prompt_auth_user?: string;
  /** The password for authenticating to the post-prompt URL. */
  post_prompt_auth_password?: string;
  /** Multilingual configuration for the agent. */
  multilingual?: {
    allowed?: unknown[];
    engine?: string;
    fillers?:
      | unknown[]
      | {
          default?: Record<string, unknown>;
          auto?: Record<string, unknown>;
        };
    function_fillers?:
      | unknown[]
      | {
          default?: Record<string, unknown>;
          auto?: Record<string, unknown>;
        };
    languages?: unknown[];
    min_switch_words?: number;
    model?: string;
    provider?: string;
    start_language?: string;
    turn_fillers?:
      | unknown[]
      | {
          default?: Record<string, unknown>;
        };
  };
}

/** The request contains invalid parameters. See errors for details. */
export interface AIAgentUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** An object of any necessary parameters for the API call. The key is the parameter name and the value is the parameter value. */
export interface AIParams {
  acknowledge_interruptions?: number | string | boolean;
  acoustic_eot_gate_prob?: number | string;
  acoustic_eot_trust_prob?: number | string;
  ai_model?: string;
  ai_name?: string;
  ai_volume?: number | string;
  app_name?: string;
  asr_diarize?: boolean | number | string;
  asr_params?: Record<string, unknown>;
  asr_smart_format?: boolean | number | string;
  asr_speaker_affinity?: boolean | number | string;
  attention_escalate_prompt?: string;
  attention_timeout?: AttentionTimeout | string;
  attention_timeout_prompt?: string;
  auth_token?: string;
  auto_correct?: boolean | number | string;
  azure_stream_first?: boolean | number | string;
  azure_tts_key?: string;
  background_file?: string;
  background_file_loops?: number | string;
  background_file_volume?: number | string;
  barge_functions?: boolean | number | string;
  barge_match_string?: string;
  barge_min_words?: number | string;
  bill_all_tts?: boolean | number | string;
  cache?: boolean | number | string;
  call_uuid?: string;
  cartesia_key?: string;
  cartesia_model?: string;
  cartesia_stream_first?: boolean | number | string;
  confidence?: number | string;
  conscience?: string;
  conversation_id?: string;
  conversation_sliding_window?: number | string;
  convo?: ConversationMessage[];
  debug_webhook_level?: number | string;
  debug_webhook_url?: string;
  deepgram_key_override?: string;
  deepgram_stream_first?: boolean | number | string;
  deepgram_tts_key?: string;
  deepgram_url_override?: string;
  developer_prompt?: string;
  digit_terminators?: string;
  digit_timeout?: number | string;
  direction?: Direction;
  double_turn_filler_every_n?: number | string;
  double_turn_filler_min_ms?: number | string;
  double_turn_model?: string;
  double_turn_prompt?: string;
  double_turn_wait_ms?: number | string;
  double_turns?: boolean | string;
  eleven_labs_key?: string;
  eleven_labs_model?: string;
  eleven_labs_similarity?: number | string;
  eleven_labs_stability?: number | string;
  eleven_labs_stream_first?: boolean | number | string;
  enable_barge?: string | boolean;
  enable_inner_dialog?: boolean | string;
  enable_pause?: boolean | string;
  enable_text_normalization?: string;
  enable_thinking?: boolean | string;
  enable_turn_detection?: boolean | string;
  enable_vision?: boolean | string;
  end_of_speech_timeout?: number | string;
  energy_level?: number | string;
  escalate_after_ms?: number | string;
  escalate_after_turns?: number | string;
  event_webhook_url?: string;
  ext?: string;
  first_word_timeout?: number | string;
  fish_key?: string;
  fish_model?: string;
  function_filler_sequence_gap_ms?: number | string;
  function_wait_for_talking?: boolean | number | string;
  functions_on_no_response?: boolean | number | string;
  grok_key?: string;
  groq_tts_key?: string;
  hard_stop_prompt?: string;
  hard_stop_time?: string;
  hold_music?: string;
  hold_on_process?: boolean | number | string;
  inactivity_timeout?: number | string;
  initial_sleep_ms?: number | string;
  inner_dialog?: {
    SWAIG?: {
      defaults?: {
        web_hook_auth_pass?: string;
        web_hook_auth_password?: string;
        web_hook_auth_user?: string;
        web_hook_url?: string;
      };
      functions?: unknown[];
    };
  };
  inner_dialog_model?: string;
  /** The default applies only when `enable_inner_dialog` / `inner_dialog_scorecard` enables it; otherwise the value stays unset. */
  inner_dialog_prompt?: string;
  inner_dialog_scorecard?:
    | boolean
    | {
        dials?: unknown[];
        replace?: boolean | string;
      };
  input_poll_freq?: number | string;
  interrupt_on_noise?: number | string | boolean;
  interrupt_prompt?: string;
  inworld_apikey?: string;
  inworld_key?: string;
  inworld_model?: string;
  language?: string;
  /** @deprecated */
  languages_enabled?: boolean | number | string;
  lipsync_debug?: boolean | number | string;
  llm_diarize_aware?: boolean | number | string;
  local_tz?: string;
  max_emotion?: number | string;
  max_response_tokens?: number | string;
  min_utterance_ms?: number | string;
  minimax_key?: string;
  minimax_model?: string;
  mistral_key?: string;
  mistral_model?: string;
  model?: string;
  openai_asr_engine?: string;
  openai_azure?: boolean | number | string;
  openai_gcloud_version?: string;
  openai_stream_first?: boolean | number | string;
  openai_tts_key?: string;
  openai_tts_url?: string;
  outbound_attention_timeout?: number | string;
  pcm_channels?: number | string;
  pcm_rate?: number | string;
  persist_global_data?: boolean | string;
  pom_format?: string;
  provider?: string;
  pvt_params?: string;
  realtime?: {
    input_transcription?: string;
    local_vad?: boolean | string;
    local_vad_frame_ms?: number | string;
    local_vad_threshold?: number | string;
    noise_reduction?: string;
    packets_per_send?: number | string;
    reasoning_effort?: string;
    speed?: number | string;
    temperature?: number | string;
    tool_model?: string;
    vad_eagerness?: string;
    vad_prefix_padding_ms?: number | string;
    vad_silence_duration_ms?: number | string;
    vad_threshold?: number | string;
    vad_type?: string;
    voice?: string;
  };
  redact_prompt?: string;
  rime_apikey?: string;
  rime_key?: string;
  rime_model?: string;
  rime_stream_first?: boolean | number | string;
  sample_rate?: number | string;
  save_conversation?: boolean | number | string;
  send_single_llm_response?: boolean | number | string;
  similarity?: number | string;
  smallest_key?: string;
  smallest_model?: string;
  speak_when_spoken_to?: boolean | string;
  speaker?: string;
  speech_event_timeout?: number | string;
  speech_gen_quick_stops?: number | string;
  speech_timeout?: number | string;
  speechify_key?: string;
  speechify_loudness_normalization?: boolean | number | string;
  speechify_model?: string;
  speechify_output_format?: string;
  speechify_stream_first?: boolean | number | string;
  speechify_text_normalization?: boolean | number | string;
  speed?: number | string;
  stability?: number | string;
  start_paused?: boolean | string;
  static_greeting?: string;
  static_greeting_no_barge?: boolean | number | string;
  stream_first?: boolean | number | string;
  streaming?: boolean | number | string;
  strict_mode?: string;
  summary_mode?: string;
  swaig_allow_settings?: boolean | number | string;
  swaig_allow_swml?: boolean | number | string;
  swaig_post_conversation?: boolean | number | string;
  swaig_post_swml_vars?: string[] | boolean | string;
  swaig_set_global_data?: boolean | number | string;
  target_first_segment_ms?: number | string;
  text_normalization_far_dir?: string;
  thinking_model?: string;
  tool_result_distill?:
    | boolean
    | {
        enabled?: boolean | string;
        min_chars?: number;
        model?: string;
        prompt?: string;
      };
  transfer_summary?: boolean | number | string;
  transparent_barge?: boolean | number | string;
  transparent_barge_max_time?: number | string;
  tts_number_format?: string;
  turn_detection?: boolean | string;
  turn_detection_min_length?: number | string;
  turn_detection_timeout?: number | string;
  turn_filler_every_n?: number | string;
  turn_filler_min_ms?: number | string;
  turn_filler_sources?: string;
  url?: string;
  utility_model?: string;
  vad_config?: string;
  video_fps?: number | string;
  video_idle_file?: string;
  video_listening_file?: string;
  video_scale?: string;
  video_talking_file?: string;
  vision_model?: string;
  voice_name?: string;
  vol?: number | string;
  wait_for_user?: boolean | number | string;
  wake_prefix?: string;
}

export interface Action {
  SWML?: string | Record<string, unknown>;
  add_dynamic_hints?: (
    | {
        pattern?: string;
        hint?: string;
        ignore_case?: boolean | string;
        replace?: string;
      }
    | string
  )[];
  back_to_back_functions?: boolean | 'forever' | string;
  change_context?: string;
  change_step?: string;
  change_voice?:
    | string
    | {
        voice?: Record<string, unknown>;
      };
  clear_dynamic_hints?: boolean | string;
  context_switch?:
    | string
    | {
        consolidate?: boolean | string;
        full_reset?: boolean | string;
        system_pom?: {
          pom?: PromptPomSection[];
          text?: string;
        };
        system_prompt?: string;
        user_pom?: {
          pom?: PromptPomSection[];
          text?: string;
        };
        user_prompt?: string;
      };
  end_of_speech_timeout?: number;
  extensive_data?: boolean | string;
  functions_on_speaker_timeout?: boolean | string;
  hangup?: boolean | string;
  hold?:
    | number
    | string
    | {
        step?: string;
        timeout?: number | string;
        timeout_step?: string;
      };
  playback_bg?:
    | string
    | {
        file?: string;
        wait?: boolean | string;
      };
  replace_in_history?: string | true;
  say?: string;
  set_global_data?: Record<string, unknown>;
  set_meta_data?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  speech_event_timeout?: number;
  stop?: boolean | string;
  stop_playback_bg?: boolean | string | number | Record<string, unknown> | unknown[] | null;
  toggle_functions?: {
    active?: boolean | number | string;
    function?: string;
  }[];
  transfer?:
    | string
    | {
        dest?: string;
        summarize?: boolean | string;
      };
  unset_global_data?: string | string[];
  unset_meta_data?: string | string[];
  user_event?: Record<string, unknown>;
  user_input?: string;
  wait_for_user?: boolean | number | 'answer_first' | string;
}

export type AddressChannel = AudioChannel | MessagingChannel | VideoChannel;

export type AttentionTimeout = number;

export interface AudioChannel {
  /** Audio Channel of Fabric Address */
  audio: string;
}

export interface CXMLScript {
  /** Unique ID of a cXML Script. */
  id: uuid;
  /** The cXML script contents */
  contents: string;
  /** The amout of times the cXML script has been requested */
  request_count: number;
  /** The date and time when the cXML script was last accessed */
  last_accessed_at: string | null;
  /** The URL where the cXML script can be accessed */
  request_url: string;
  /** The script type the cXML Script is used for */
  script_type: 'calling' | 'faxing' | 'messaging';
  /** Display name of the cXML Script Fabric Resource */
  name: string;
  /** The url that will send status updates for the cXML Script */
  status_callback_url?: string | null;
  /** HTTP method for status callback URL */
  status_callback_method?: 'GET' | 'POST';
}

export interface CXMLScriptAddressListResponse {
  /** An array of objects that contain a list of cXML Script Addresses */
  data: FabricAddressApp[];
  /** Object containing pagination links */
  links: CXMLScriptAddressPaginationResponse;
}

export interface CXMLScriptAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface CXMLScriptCreateRequest {
  /** The cXML script contents */
  contents: string;
  /** URL to send status callbacks to */
  status_callback_url?: string;
  /** HTTP method to use for status callbacks */
  status_callback_method?: 'GET' | 'POST';
  /** The name of the cXML script. */
  name: string;
  /** What the cXML script is used for. */
  script_type?: 'calling' | 'faxing' | 'messaging';
}

/** The request contains invalid parameters. See errors for details. */
export interface CXMLScriptCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface CXMLScriptListResponse {
  /** An array of objects containing a list of cXML Script data */
  data: CXMLScriptResponse[];
  /** Object containing pagination links */
  links: CXMLScriptAddressPaginationResponse;
}

export interface CXMLScriptResponse {
  /** Unique ID of the cXML Script. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the cXML Script Fabric Resource. */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'cxml_script';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** cXML Script data. */
  cxml_script: CXMLScript;
}

export interface CXMLScriptUpdateRequest {
  /** The cXML script contents */
  contents?: string;
  /** URL to send status callbacks to */
  status_callback_url?: string;
  /** HTTP method to use for status callbacks */
  status_callback_method?: 'GET' | 'POST';
  /** The name of the cXML script. */
  name?: string;
  /** What the cXML script is used for. */
  script_type?: 'calling' | 'faxing' | 'messaging';
}

/** The request contains invalid parameters. See errors for details. */
export interface CXMLScriptUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface CXMLWebhook {
  /** Unique ID of the CXML Webhook. */
  id: uuid;
  /** Name of the CXML Webhook. */
  name: string;
  /** Used for of the CXML Webhook. */
  used_for: CxmlWebhookUsedForType;
  /** Primary request url of the CXML Webhook. */
  primary_request_url: string;
  /** Primary request method of the CXML Webhook. */
  primary_request_method: 'GET' | 'POST';
  /** Fallback request url of the CXML Webhook. */
  fallback_request_url: string | null;
  /** Fallback request method of the CXML Webhook. */
  fallback_request_method: 'GET' | 'POST';
  /** Status callback url of the CXML Webhook. */
  status_callback_url: string | null;
  /** Status callback method of the CXML Webhook. */
  status_callback_method: 'GET' | 'POST';
}

export interface CXMLWebhookAddressListResponse {
  data: FabricAddressApp[];
  links: CXMLWebhookAddressPaginationResponse;
}

export interface CXMLWebhookAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next: string;
  /** Link to the previous page */
  prev?: string;
}

export interface CXMLWebhookCreateRequest {
  /** Name of the CXML Webhook. */
  name?: string;
  /** Used for of the CXML Webhook. */
  used_for?: CxmlWebhookUsedForType;
  /** Primary request url of the CXML Webhook. */
  primary_request_url: string;
  /** Primary request method of the CXML Webhook. */
  primary_request_method?: 'GET' | 'POST';
  /** Fallback request url of the CXML Webhook. */
  fallback_request_url?: string;
  /** Fallback request method of the CXML Webhook. */
  fallback_request_method?: 'GET' | 'POST';
  /** Status callback url of the CXML Webhook. */
  status_callback_url?: string;
  /** Status callback method of the CXML Webhook. */
  status_callback_method?: 'GET' | 'POST';
}

/** The request contains invalid parameters. See errors for details. */
export interface CXMLWebhookCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface CXMLWebhookListResponse {
  /** An array of objects containing a list of cXML Webhook data */
  data: CXMLWebhookResponse[];
  /** Object containing pagination links */
  links: CXMLWebhookPaginationResponse;
}

export interface CXMLWebhookPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next: string;
  /** Link to the previous page */
  prev?: string;
}

export interface CXMLWebhookResponse {
  /** Unique ID of the CXMLWebhook. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the CXMLWebhook Fabric Resource */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'cxml_webhook';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** CXMLWebhook data. */
  cxml_webhook: CXMLWebhook;
}

export interface CXMLWebhookUpdateRequest {
  /** Name of the CXML Webhook. */
  name?: string;
  /** Used for of the CXML Webhook. */
  used_for?: CxmlWebhookUsedForType;
  /** Primary request url of the CXML Webhook. */
  primary_request_url?: string;
  /** Primary request method of the CXML Webhook. */
  primary_request_method?: 'GET' | 'POST';
  /** Fallback request url of the CXML Webhook. */
  fallback_request_url?: string;
  /** Fallback request method of the CXML Webhook. */
  fallback_request_method?: 'GET' | 'POST';
  /** Status callback url of the CXML Webhook. */
  status_callback_url?: string;
  /** Status callback method of the CXML Webhook. */
  status_callback_method?: 'GET' | 'POST';
}

/** The request contains invalid parameters. See errors for details. */
export interface CXMLWebhookUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface CallFlow {
  /** Unique ID of a Call Flow. */
  id: uuid;
  /** The name of the Call Flow */
  title: string;
  /** Call flow data as JSON string */
  flow_data?: Record<string, unknown>;
  /** A SWML document. For more information on SWML, please go to the [SWML docs](/swml) */
  relayml?: Record<string, unknown>;
  /** The current revision of the call flow. Every update must increase this number. */
  document_version?: number;
}

export interface CallFlowAddressListResponse {
  /** An array of objects containing a list of Call Flow Addresses */
  data: FabricAddressApp[];
  /** Object containing pagination links */
  links: CallFlowAddressPaginationResponse;
}

export interface CallFlowAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface CallFlowCreateRequest {
  /** The name of the Call Flow */
  title: string;
  /** The call flow's flow data, as a JSON object or a JSON string. */
  flow_data?: Record<string, unknown> | string;
  /** The call flow's SWML document, as a JSON object or a JSON string. */
  relayml?: Record<string, unknown> | string;
}

/** The request contains invalid parameters. See errors for details. */
export interface CallFlowCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface CallFlowListResponse {
  /** Object containing pagination links */
  links: CallFlowAddressPaginationResponse;
  /** An array of objects containing the CallFlow listing response */
  data: CallFlowResponse[];
}

export interface CallFlowResponse {
  /** Unique ID of the Call Flow. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Call Flow Fabric Resource */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'call_flow';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** Call Flow data. */
  call_flow: CallFlow;
}

export interface CallFlowUpdateRequest {
  /** The name of the Call Flow */
  title?: string;
  /** The current revision of the call flow. Every update must increase this number. */
  document_version: number;
  /** The call flow's flow data, as a JSON object or a JSON string. */
  flow_data?: Record<string, unknown> | string;
  /** The call flow's SWML document, as a JSON object or a JSON string. */
  relayml?: Record<string, unknown> | string;
}

/** The request contains invalid parameters. See errors for details. */
export interface CallFlowUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface CallFlowVersion {
  /** The unique identifier of the version. */
  id: uuid;
  /** The document version this snapshot was taken at. */
  document_version: number;
  /** The creation timestamp. */
  created_at: string;
  /** The last update timestamp. */
  updated_at: string;
  /** Call Flow data structure */
  flow_data?: Record<string, unknown>;
  /** The calling SWML document this version snapshots. Uses [calling SWML methods](/docs/swml/reference/calling). */
  relayml?: Record<string, unknown>;
}

export interface CallFlowVersionDeployByDocumentVersion {
  /** The current revision of the call flow. */
  document_version: number;
}

export interface CallFlowVersionDeployByVersionId {
  /** Any call flow version ID for this call flow. */
  call_flow_version_id: uuid;
}

export type CallFlowVersionDeployRequest =
  CallFlowVersionDeployByDocumentVersion | CallFlowVersionDeployByVersionId;

export interface CallFlowVersionDeployResponse {
  /** The unique identifier of the deployed Call Flow Version. */
  id: uuid;
  /** The creation timestamp. */
  created_at: string;
  /** The last update timestamp. */
  updated_at: string;
  /** The document version. */
  document_version: number;
  /** Call Flow data structure */
  flow_data?: Record<string, unknown>;
  /** The calling SWML document deployed by this version. Uses [calling SWML methods](/docs/swml/reference/calling). */
  relayml?: Record<string, unknown>;
}

export interface CallFlowVersionListResponse {
  /** List of Call Flow Versions */
  data: CallFlowVersion[];
  links: CallFlowVersionsPaginationResponse;
}

export interface CallFlowVersionsPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next: string;
  /** Link to the previous page */
  prev?: string;
}

export type CallHandlerType = 'default' | 'passthrough' | 'block-pstn' | 'resource';

export type Ciphers =
  | 'AEAD_AES_256_GCM_8'
  | 'AES_256_CM_HMAC_SHA1_80'
  | 'AES_CM_128_HMAC_SHA1_80'
  | 'AES_256_CM_HMAC_SHA1_32'
  | 'AES_CM_128_HMAC_SHA1_32';

export type Codecs = 'PCMU' | 'PCMA' | 'G722' | 'G729' | 'OPUS' | 'VP8' | 'H264';

export interface ConferenceRoom {
  /** The unique id of the Conference Room */
  id: uuid;
  /** The name of the Conference Room */
  name: string;
  /** The descrption of the Conference Room */
  description: string | null;
  /** Display name of the Conference Room */
  display_name: string;
  /** Maximum number of members allowed in the conference room */
  max_members: number;
  /** The viudeo quality of the Conference Room. */
  quality: '1080p' | '720p';
  /** The frames-per-second (fps) of the participants videos in the conference. */
  fps: 30 | 20;
  /** The time users are allowed to start joining the conference. Joining before this time will result in failure to join the conference. */
  join_from: string | null;
  /** The time users are allowed to until the conference is locked. Attempting to join the conference after the set time will result in failure to join the conference. */
  join_until: string | null;
  /** The time to remove all participants from the conference. */
  remove_at: string | null;
  /** The amount of time in seconds to remove a particpant from a conference after they join. */
  remove_after_seconds_elapsed: number | null;
  /** The video layout of the conference. */
  layout: Layout;
  /** Starts recording when the conference starts. */
  record_on_start: boolean;
  /** Plays a tone when a participant joins or leaves the conference. */
  tone_on_entry_and_exit: boolean;
  /** Turns the conference video off when the participant joins the room if `true`. */
  room_join_video_off: boolean;
  /** Turns the participants video off when the participant joins the room if `true`. */
  user_join_video_off: boolean;
  /** Enables live video room previews for the conference. */
  enable_room_previews: boolean;
  /** Syncs the participants audio and video. */
  sync_audio_video: boolean | null;
  /** Metadata of the conference. */
  meta: Record<string, Record<string, unknown>>;
  /** Indicator if the Conference Room will prioritize showing participants utilizing the hand raised feature. */
  prioritize_handraise: boolean;
}

export interface ConferenceRoomAddressListResponse {
  /** An array of objects containing list of Conference Room Addresses */
  data: FabricAddressRoom[];
  /** Object containing pagination links */
  links: ConferenceRoomAddressPaginationResponse;
}

export interface ConferenceRoomAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface ConferenceRoomCreateRequest {
  /** The name of the Conference Room */
  name: string;
  /** Display name of the Conference Room */
  display_name?: string;
  /** The descrption of the Conference Room */
  description?: string;
  /** The time users are allowed to start joining the conference. Joining before this time will result in failure to join the conference. */
  join_from?: string;
  /** The time users are allowed to until the conference is locked. Attempting to join the conference after the set time will result in failure to join the conference. */
  join_until?: string;
  /** Maximum number of members allowed in the conference room */
  max_members?: number;
  /** The viudeo quality of the Conference Room. */
  quality?: '1080p' | '720p';
  /** The time to remove all participants from the conference. */
  remove_at?: string;
  /** The amount of time in seconds to remove a particpant from a conference after they join. */
  remove_after_seconds_elapsed?: number;
  /** The video layout of the conference. */
  layout?: Layout;
  /** Starts recording when the conference starts. */
  record_on_start?: boolean;
  /** Enables live video room previews for the conference. */
  enable_room_previews?: boolean;
  /** Metadata of the conference. */
  meta?: Record<string, Record<string, unknown>>;
  /** Syncs the participants audio and video. */
  sync_audio_video?: boolean;
  /** Plays a tone when a participant joins or leaves the conference. */
  tone_on_entry_and_exit?: boolean;
  /** Turns the conference video off when the participant joins the room if `true`. */
  room_join_video_off?: boolean;
  /** Turns the participants video off when the participant joins the room if `true`. */
  user_join_video_off?: boolean;
}

/** The request contains invalid parameters. See errors for details. */
export interface ConferenceRoomCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface ConferenceRoomListResponse {
  /** Object containing pagination links */
  links: ConferenceRoomAddressPaginationResponse;
  /** An array of objects containing the Conference Room data */
  data: ConferenceRoomResponse[];
}

export interface ConferenceRoomResponse {
  /** Unique ID of the Conference Room. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Conference Room Fabric Resource */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'video_room';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** Conference Room data. */
  conference_room: ConferenceRoom;
}

export interface ConferenceRoomUpdateRequest {
  /** Display name of the Conference Room */
  display_name?: string;
  /** The time users are allowed to start joining the conference. Joining before this time will result in failure to join the conference. */
  join_from?: string;
  /** The time users are allowed to until the conference is locked. Attempting to join the conference after the set time will result in failure to join the conference. */
  join_until?: string;
  /** Maximum number of members allowed in the conference room */
  max_members?: number;
  /** The viudeo quality of the Conference Room. */
  quality?: '1080p' | '720p';
  /** The time to remove all participants from the conference. */
  remove_at?: string;
  /** The amount of time in seconds to remove a particpant from a conference after they join. */
  remove_after_seconds_elapsed?: number;
  /** The video layout of the conference. */
  layout?: Layout;
  /** Starts recording when the conference starts. */
  record_on_start?: boolean;
  /** Enables live video room previews for the conference. */
  enable_room_previews?: boolean;
  /** Metadata of the conference. */
  meta?: Record<string, Record<string, unknown>>;
  /** Syncs the participants audio and video. */
  sync_audio_video?: boolean;
}

/** The request contains invalid parameters. See errors for details. */
export interface ConferenceRoomUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export type Contexts = Record<string, Context>;

export interface ConversationMessage {
  content?: string;
  lang?: string;
  role?: ConversationRole;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export type ConversationRole = string;

export interface CxmlApplication {
  /** Unique ID of the cXML Application. */
  id: uuid;
  /** Project ID for the cXML Application */
  project_id: uuid;
  /** Display name of the cXML Application */
  friendly_name: string;
  /** URL to handle incoming calls */
  voice_url: string | null;
  /** HTTP method for voice URL */
  voice_method: 'GET' | 'POST' | null;
  /** Fallback URL for voice errors */
  voice_fallback_url: string | null;
  /** HTTP method for voice fallback URL */
  voice_fallback_method: 'GET' | 'POST' | null;
  /** URL to receive status callbacks */
  status_callback: string | null;
  /** HTTP method for status callbacks */
  status_callback_method: 'GET' | 'POST' | null;
  /** URL to handle incoming messages */
  sms_url: string | null;
  /** HTTP method for SMS URL */
  sms_method: 'GET' | 'POST' | null;
  /** Fallback URL for SMS errors */
  sms_fallback_url: string | null;
  /** HTTP method for SMS fallback URL */
  sms_fallback_method: 'GET' | 'POST' | null;
  /** URL to receive SMS status callbacks */
  sms_status_callback: string | null;
  /** HTTP method for SMS status callbacks */
  sms_status_callback_method: 'GET' | 'POST' | null;
  /** The message status callback URL (the same value as sms_status_callback). */
  message_status_callback?: string | null;
  /** The cXML API version. */
  api_version?: string;
  /** The cXML application's LaML API path. */
  uri?: string;
}

export interface CxmlApplicationAddressListResponse {
  /** An array of objects that contain a list of Cxml Application Addresses */
  data: FabricAddress[];
  /** Object containing pagination links */
  links: CxmlApplicationAddressPaginationResponse;
}

export interface CxmlApplicationAddressPaginationResponse {
  /** Self link for the current page */
  self: string;
  /** Link to the first page of results */
  first: string;
  /** Link to the next page of results */
  next?: string;
  /** Link to the previous page of results */
  prev?: string;
}

export interface CxmlApplicationListResponse {
  /** An array of objects containing the list of cXML Application(s) data. */
  data: CxmlApplicationResponse[];
  /** Object containing pagination links */
  links: CxmlApplicationPaginationResponse;
}

export interface CxmlApplicationPaginationResponse {
  /** Linmk to the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface CxmlApplicationResponse {
  /** Unique ID of the cXML Application. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the cXML Application Fabric Resource */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'cxml_application';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** cXML Application data. */
  cxml_application: CxmlApplication;
}

export interface CxmlApplicationUpdateRequest {
  /** The name of the cXML application. */
  name?: string;
  /** The request URL for calls. */
  call_request_url?: string;
  /** The HTTP method for the call request URL. */
  call_request_method?: 'GET' | 'POST';
  /** The fallback URL for calls. */
  call_fallback_url?: string;
  /** The HTTP method for the call fallback URL. */
  call_fallback_method?: 'GET' | 'POST';
  /** The status callback URL for calls. */
  call_status_url?: string;
  /** The HTTP method for the call status callback URL. */
  call_status_method?: 'GET' | 'POST';
  /** The request URL for messages. */
  message_request_url?: string;
  /** The HTTP method for the message request URL. */
  message_request_method?: 'GET' | 'POST';
  /** The fallback URL for messages. */
  message_fallback_url?: string;
  /** The HTTP method for the message fallback URL. */
  message_fallback_method?: 'GET' | 'POST';
  /** The status callback URL for messages. */
  message_status_url?: string;
  /** The HTTP method for the message status callback URL. */
  message_status_method?: 'GET' | 'POST';
}

/** The request contains invalid parameters. See errors for details. */
export interface CxmlApplicationUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface DataMap {
  contexts?: unknown[] | boolean | null | number | Record<string, unknown> | string;
  expressions?: Expression[] | Expression;
  output?: Output;
  webhooks?: Webhook[] | Webhook;
}

export interface DialogFlowPaginationResponse {
  /** Link to the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface DialogflowAgent {
  /** Unique ID of a Dialogflow Agent. */
  id: uuid;
  /** Whether to enable the 'say' feature */
  say_enabled?: boolean;
  /** Default message to say */
  say?: string | null;
  /** Voice to use for speech */
  voice?: string;
  /** Display name of the Dialogflow Agent */
  display_name?: string;
  /** Dialogflow reference ID */
  dialogflow_reference_id?: uuid;
  /** Dialogflow reference name */
  dialogflow_reference_name?: string;
}

export interface DialogflowAgentAddressListResponse {
  /** An array of objects that contain a list of Dialogflow Agent Addresses */
  data: FabricAddressApp[];
  /** Object containing pagination links */
  links: DialogflowAgentAddressPaginationResponse;
}

export interface DialogflowAgentAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface DialogflowAgentListResponse {
  /** An array of objects that contain a list of Dialogflow Agent data */
  data: DialogflowAgentResponse[];
  /** Object containing pagination links */
  links: DialogFlowPaginationResponse;
}

export interface DialogflowAgentResponse {
  /** Unique ID of the Dialogflow Agent. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Dialogflow Agent Fabric Resource */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'dialogflow_agent';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** Dialogflow Agent data. */
  dialogflow_agent: DialogflowAgent;
}

export interface DialogflowAgentUpdateRequest {
  /** Name of the Dialogflow Agent */
  name?: string;
  /** Whether to enable the 'say' feature */
  say_enabled?: boolean;
  /** Default message to say */
  say?: string;
  /** Voice to use for speech */
  voice?:
    | 'ar-XA-Standard-A'
    | 'ar-XA-Standard-B'
    | 'ar-XA-Standard-C'
    | 'ar-XA-Wavenet-A'
    | 'ar-XA-Wavenet-B'
    | 'ar-XA-Wavenet-C'
    | 'cs-CZ-Standard-A'
    | 'cs-CZ-Wavenet-A'
    | 'da-DK-Standard-A'
    | 'da-DK-Wavenet-A'
    | 'nl-NL-Standard-A'
    | 'nl-NL-Standard-B'
    | 'nl-NL-Standard-C'
    | 'nl-NL-Standard-D'
    | 'nl-NL-Standard-E'
    | 'nl-NL-Wavenet-A'
    | 'nl-NL-Wavenet-B'
    | 'nl-NL-Wavenet-C'
    | 'nl-NL-Wavenet-D'
    | 'nl-NL-Wavenet-E'
    | 'en-AU-Standard-A'
    | 'en-AU-Standard-B'
    | 'en-AU-Standard-C'
    | 'en-AU-Standard-D'
    | 'en-AU-Wavenet-A'
    | 'en-AU-Wavenet-B'
    | 'en-AU-Wavenet-C'
    | 'en-AU-Wavenet-D'
    | 'en-IN-Standard-A'
    | 'en-IN-Standard-B'
    | 'en-IN-Standard-C'
    | 'en-IN-Wavenet-A'
    | 'en-IN-Wavenet-B'
    | 'en-IN-Wavenet-C'
    | 'en-GB-Standard-A'
    | 'en-GB-Standard-B'
    | 'en-GB-Standard-C'
    | 'en-GB-Standard-D'
    | 'en-GB-Wavenet-A'
    | 'en-GB-Wavenet-B'
    | 'en-GB-Wavenet-C'
    | 'en-GB-Wavenet-D'
    | 'en-US-Standard-B'
    | 'en-US-Standard-C'
    | 'en-US-Standard-D'
    | 'en-US-Standard-E'
    | 'en-US-Standard-F'
    | 'en-US-Standard-G'
    | 'en-US-Standard-H'
    | 'en-US-Standard-I'
    | 'en-US-Standard-J'
    | 'en-US-Wavenet-A'
    | 'en-US-Wavenet-B'
    | 'en-US-Wavenet-C'
    | 'en-US-Wavenet-D'
    | 'en-US-Wavenet-E'
    | 'en-US-Wavenet-F'
    | 'fil-PH-Standard-A'
    | 'fil-PH-Wavenet-A'
    | 'fi-FI-Standard-A'
    | 'fi-FI-Wavenet-A'
    | 'fr-CA-Standard-A'
    | 'fr-CA-Standard-B'
    | 'fr-CA-Standard-C'
    | 'fr-CA-Standard-D'
    | 'fr-CA-Wavenet-A'
    | 'fr-CA-Wavenet-B'
    | 'fr-CA-Wavenet-C'
    | 'fr-CA-Wavenet-D'
    | 'fr-FR-Standard-A'
    | 'fr-FR-Standard-B'
    | 'fr-FR-Standard-C'
    | 'fr-FR-Standard-D'
    | 'fr-FR-Wavenet-A'
    | 'fr-FR-Wavenet-B'
    | 'fr-FR-Wavenet-C'
    | 'fr-FR-Wavenet-D'
    | 'de-DE-Standard-A'
    | 'de-DE-Standard-B'
    | 'de-DE-Wavenet-A'
    | 'de-DE-Wavenet-B'
    | 'de-DE-Wavenet-C'
    | 'de-DE-Wavenet-D'
    | 'el-GR-Standard-A'
    | 'el-GR-Wavenet-A'
    | 'hi-IN-Standard-A'
    | 'hi-IN-Standard-B'
    | 'hi-IN-Standard-C'
    | 'hi-IN-Wavenet-A'
    | 'hi-IN-Wavenet-B'
    | 'hi-IN-Wavenet-C'
    | 'hu-HU-Standard-A'
    | 'hu-HU-Wavenet-A'
    | 'id-ID-Standard-A'
    | 'id-ID-Standard-B'
    | 'id-ID-Standard-C'
    | 'id-ID-Wavenet-A'
    | 'id-ID-Wavenet-B'
    | 'id-ID-Wavenet-C'
    | 'it-IT-Standard-A'
    | 'it-IT-Standard-B'
    | 'it-IT-Standard-C'
    | 'it-IT-Standard-D'
    | 'it-IT-Wavenet-A'
    | 'it-IT-Wavenet-B'
    | 'it-IT-Wavenet-C'
    | 'it-IT-Wavenet-D'
    | 'ja-JP-Standard-A'
    | 'ja-JP-Standard-B'
    | 'ja-JP-Standard-C'
    | 'ja-JP-Standard-D'
    | 'ja-JP-Wavenet-A'
    | 'ja-JP-Wavenet-B'
    | 'ja-JP-Wavenet-C'
    | 'ja-JP-Wavenet-D'
    | 'ko-KR-Standard-A'
    | 'ko-KR-Standard-B'
    | 'ko-KR-Standard-C'
    | 'ko-KR-Standard-D'
    | 'ko-KR-Wavenet-A'
    | 'ko-KR-Wavenet-B'
    | 'ko-KR-Wavenet-C'
    | 'ko-KR-Wavenet-D'
    | 'cmn-CN-Standard-A'
    | 'cmn-CN-Standard-B'
    | 'cmn-CN-Standard-C'
    | 'cmn-CN-Wavenet-A'
    | 'cmn-CN-Wavenet-B'
    | 'cmn-CN-Wavenet-C'
    | 'nb-NO-Standard-A'
    | 'nb-NO-Standard-B'
    | 'nb-NO-Standard-C'
    | 'nb-NO-Standard-D'
    | 'nb-NO-Wavenet-A'
    | 'nb-NO-Wavenet-B'
    | 'nb-NO-Wavenet-C'
    | 'nb-NO-Wavenet-D'
    | 'nb-no-Standard-E'
    | 'nb-no-Wavenet-E'
    | 'pl-PL-Standard-A'
    | 'pl-PL-Standard-B'
    | 'pl-PL-Standard-C'
    | 'pl-PL-Standard-D'
    | 'pl-PL-Standard-E'
    | 'pl-PL-Wavenet-A'
    | 'pl-PL-Wavenet-B'
    | 'pl-PL-Wavenet-C'
    | 'pl-PL-Wavenet-D'
    | 'pl-PL-Wavenet-E'
    | 'pt-BR-Standard-A'
    | 'pt-BR-Wavenet-A'
    | 'pt-PT-Standard-A'
    | 'pt-PT-Standard-B'
    | 'pt-PT-Standard-C'
    | 'pt-PT-Standard-D'
    | 'pt-PT-Wavenet-A'
    | 'pt-PT-Wavenet-B'
    | 'pt-PT-Wavenet-C'
    | 'pt-PT-Wavenet-D'
    | 'ru-RU-Standard-A'
    | 'ru-RU-Standard-B'
    | 'ru-RU-Standard-C'
    | 'ru-RU-Standard-D'
    | 'ru-RU-Wavenet-A'
    | 'ru-RU-Wavenet-B'
    | 'ru-RU-Wavenet-C'
    | 'ru-RU-Wavenet-D'
    | 'sk-SK-Standard-A'
    | 'sk-SK-Wavenet-A'
    | 'es-ES-Standard-A'
    | 'sv-SE-Standard-A'
    | 'sv-SE-Wavenet-A'
    | 'tr-TR-Standard-A'
    | 'tr-TR-Standard-B'
    | 'tr-TR-Standard-C'
    | 'tr-TR-Standard-D'
    | 'tr-TR-Standard-E'
    | 'tr-TR-Wavenet-A'
    | 'tr-TR-Wavenet-B'
    | 'tr-TR-Wavenet-C'
    | 'tr-TR-Wavenet-D'
    | 'tr-TR-Wavenet-E'
    | 'uk-UA-Standard-A'
    | 'uk-UA-Wavenet-A'
    | 'vi-VN-Standard-A'
    | 'vi-VN-Standard-B'
    | 'vi-VN-Standard-C'
    | 'vi-VN-Standard-D'
    | 'vi-VN-Wavenet-A'
    | 'vi-VN-Wavenet-B'
    | 'vi-VN-Wavenet-C'
    | 'vi-VN-Wavenet-D';
}

/** The request contains invalid parameters. See errors for details. */
export interface DialogflowAgentUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export type Direction = string;

/** DisplayTypes */
export type DisplayTypes = 'app' | 'room' | 'call' | 'subscriber';

export interface DomainApplicationAssignRequest {
  /** The id of the domain application you wish to assign a resource to. */
  domain_application_id: uuid;
}

/** The request contains invalid parameters. See errors for details. */
export interface DomainApplicationCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** Response containing a single domain application. */
export interface DomainApplicationResponse {
  /** Unique ID of the Fabric Address. */
  id: uuid;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string | null;
  /** Locks the Fabric Address. This is used to prevent the Fabric Address from accepting calls. */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels: AudioChannel;
  /** The display type of the fabric address. */
  type: 'app' | 'call' | 'room';
  /** The ID of the resource the address was assigned to. */
  resource_id?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface EmbedTokenCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface EmbedsTokensRequest {
  /** Click to Call Token */
  token: string;
}

export interface EmbedsTokensResponse {
  /** Encrypted guest token. */
  token: string;
}

export type Encryption = 'required' | 'optional' | 'default';

export type SipGatewayEncryption = 'required' | 'optional' | 'forbidden';

/** Without one of `expr` / `string` and `output`, a Expression has no effect: it is accepted and ignored, not rejected. */
export interface Expression {
  pattern?: string;
  expr?: string;
  'nomatch-output'?: Output;
  output?: Output;
  string?: string;
}

export interface FabricAddress {
  /** Unique ID of the Fabric Address. */
  id: uuid;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string | null;
  /** Locks the Fabric Address. This is used to prevent the Fabric Address from accepting calls. */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels: AddressChannel;
  type: DisplayTypes;
  /** The ID of the resource the address was assigned to. */
  resource_id: string;
}

export interface FabricAddressApp {
  /** Unique ID of the Fabric Address. */
  id: uuid;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string | null;
  /** Locks the Fabric Address. This is used to prevent the Fabric Address from accepting calls. */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels: AddressChannel;
  type: DisplayTypes;
  /** The ID of the resource the address was assigned to. */
  resource_id: string;
}

export interface FabricAddressCall {
  /** Unique ID of the Fabric Address. */
  id: uuid;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string | null;
  /** Locks the Fabric Address. This is used to prevent the Fabric Address from accepting calls. */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels: AddressChannel;
  type: DisplayTypes;
  /** The ID of the resource the address was assigned to. */
  resource_id: string;
}

/** Pagination links for the response. */
export interface FabricAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface FabricAddressRoom {
  /** Unique ID of the Fabric Address. */
  id: uuid;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string | null;
  /** Locks the Fabric Address. This is used to prevent the Fabric Address from accepting calls. */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels: AddressChannel;
  type: DisplayTypes;
  /** The ID of the resource the address was assigned to. */
  resource_id: string;
}

export interface FabricAddressSubscriber {
  /** Unique ID of the Fabric Address. */
  id: uuid;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string | null;
  /** Locks the Fabric Address. This is used to prevent the Fabric Address from accepting calls. */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels: AddressChannel;
  /** The display type of a fabric address pointing to a [Subscriber](/docs/platform/subscribers). */
  type: DisplayTypes;
  /** The ID of the resource the address was assigned to. */
  resource_id: string;
}

/** A Fabric Address, shaped by its kind. */
export type FabricAddressItem = AliasAddress | SipAddress | PhoneNumberAddress;

/** A page of Fabric Addresses. */
export interface FabricAddressListResponse {
  /** The addresses on this page. */
  data: FabricAddressItem[];
  links: FabricAddressPaginationResponse;
  /** The number of addresses on this page. */
  items_count: number;
}

export interface FreeswitchConectorPaginationResponse {
  /** The link of the current page */
  self: string;
  /** The link of the first page */
  first: string;
  /** The link of the next page */
  next?: string;
  /** The link of the previous page */
  prev?: string;
}

export interface FreeswitchConnector {
  /** Unique ID of a FreeSWITCH Connector. */
  id: uuid;
  /** Name of the FreeSWITCH Connector */
  name?: string;
  /** Caller ID for the connector */
  caller_id?: string | null;
  /** Send as identifier */
  send_as?: string | null;
}

export interface FreeswitchConnectorAddressListResponse {
  /** An array of objects containing a list of FreeSWITCH Connector Addresses */
  data: FabricAddressCall[];
  /** Object containing pagination links */
  links: FreeswitchConnectorAddressPaginationResponse;
}

export interface FreeswitchConnectorAddressPaginationResponse {
  /** Link to the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface FreeswitchConnectorCreateRequest {
  /** Name of the FreeSWITCH Connector */
  name: string;
  /** FreeSWITCH token */
  token: uuid;
}

/** The request contains invalid parameters. See errors for details. */
export interface FreeswitchConnectorCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface FreeswitchConnectorListResponse {
  /** Object containing pagination links */
  links: FreeswitchConectorPaginationResponse;
  /** An array of objects containing a list of FreeSWITCH connector data */
  data: FreeswitchConnectorResponse[];
}

export interface FreeswitchConnectorResponse {
  /** Unique ID of the FreeSWITCH Connector. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the FreeSWITCH Connector Fabric Resource */
  display_name: string | null;
  /** Type of the Fabric Resource */
  type: 'freeswitch_connector';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** FreeSWITCH Connector data. */
  freeswitch_connector: FreeswitchConnector;
}

export interface FreeswitchConnectorUpdateRequest {
  /** Name of the FreeSWITCH Connector */
  name?: string;
  /** Caller ID for the connector */
  caller_id?: string;
  /** Send as identifier */
  send_as?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface FreeswitchConnectorUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface FunctionFillers {
  default?: Record<string, unknown>;
  auto?: Record<string, unknown>;
}

/** A JSON Schema (draft 2020-12) that may also carry `example`, `nullable`, `propertyOrdering`: the value is forwarded verbatim to whichever model API the session resolves to, and those receivers do not accept one vocabulary, so a schema here must be able to express their UNION (vocabulary_union). The engine does not inspect it. */
export interface FunctionParameters {
  title?: string;
  description?: string;
  type?:
    | 'array'
    | 'boolean'
    | 'integer'
    | 'null'
    | 'number'
    | 'object'
    | 'string'
    | ('array' | 'boolean' | 'integer' | 'null' | 'number' | 'object' | 'string')[];
  const?: Record<string, unknown>;
  enum?: unknown[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  default?: Record<string, unknown>;
  examples?: unknown[];
  deprecated?: boolean;
  nullable?: boolean;
  properties?: Record<string, FunctionParameters | boolean>;
  required?: string[];
  prefixItems?: (FunctionParameters | boolean)[];
  items?: FunctionParameters | boolean;
  propertyNames?: FunctionParameters | boolean;
  additionalProperties?: FunctionParameters | boolean;
  unevaluatedProperties?: FunctionParameters | boolean;
  oneOf?: (FunctionParameters | boolean)[];
  anyOf?: (FunctionParameters | boolean)[];
  allOf?: (FunctionParameters | boolean)[];
  not?: FunctionParameters | boolean;
  contains?: FunctionParameters | boolean;
  dependentRequired?: Record<string, string[]>;
  dependentSchemas?: Record<string, FunctionParameters | boolean>;
  else?: FunctionParameters | boolean;
  example?: Record<string, unknown>;
  if?: FunctionParameters | boolean;
  maxContains?: number;
  minContains?: number;
  multipleOf?: number;
  patternProperties?: Record<string, FunctionParameters | boolean>;
  propertyOrdering?: string[];
  readOnly?: boolean;
  then?: FunctionParameters | boolean;
  unevaluatedItems?: FunctionParameters | boolean;
  uniqueItems?: boolean;
  writeOnly?: boolean;
}

/** The request contains invalid parameters. See errors for details. */
export interface GuestTokenCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface LanguageParams {
  emotion?: string;
  pitch?: number | string;
  similarity?: number | string;
  speakingRate?: number | string;
  speed?: number | string;
  stability?: number | string;
  streaming?: boolean | string;
  temperature?: number | string;
  vol?: number | string;
}

export type Layout =
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

export interface MessagingChannel {
  /** Messaging Channel of Fabric Address */
  messaging: string;
}

export interface Output {
  action?: Action | Action[];
  post_process?: boolean;
  response?:
    | string
    | {
        tool_prompt?: string;
        tool_result?: string;
      };
}

/** Without one of `body` / `bullets` / `subsections`, the element has no effect: it is accepted and ignored, not rejected. */
export interface POM {
  title?: string;
  body?: string;
  bullets?: unknown[];
  numbered?: boolean;
  numberedBullets?: boolean;
  subsections?: unknown[];
}

export interface PhoneRouteAssignRequest {
  /** The id of the phone route. */
  phone_route_id: uuid;
  /** Indicates if the resource should be assigned to a `calling` or `messaging` handler. */
  handler: UsedForType;
}

/** The request contains invalid parameters. See errors for details. */
export interface PhoneRouteCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface PhoneRouteResponse {
  /** Unique ID of the Fabric Address. */
  id: uuid;
  /** Name of the Fabric Address. */
  name: string;
  /** Display name of the Fabric Address. */
  display_name: string;
  /** Cover url of the Fabric Address. */
  cover_url: string;
  /** Preview url of the Fabric Address. */
  preview_url: string | null;
  /** Locks the Fabric Address. This is used to prevent the Fabric Address from accepting calls. */
  locked: boolean;
  /** Channels of the Fabric Address. */
  channels:
    | {
        /** Audio Channel of Fabric Address */
        audio: string;
      }
    | {
        /** Messaging Channel of Fabric Address */
        messaging: string;
      };
  /** The display type of the fabric address. */
  type: 'app' | 'call' | 'room';
  /** The ID of the resource the address was assigned to. */
  resource_id?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface RefreshTokenStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface RelayApplication {
  /** Unique ID of a Relay Application. */
  id: uuid;
  /** Name of the Relay Application */
  name: string;
  /** Topic of the Relay Application */
  topic: string;
  /** Call status callback URL */
  call_status_callback_url: string | null;
}

export interface RelayApplicationAddressListResponse {
  /** An array of objects that contain a list of Relay Application Addresses */
  data: FabricAddressApp[];
  /** Object containing pagination links */
  links: RelayApplicationAddressPaginationResponse;
}

export interface RelayApplicationAddressPaginationResponse {
  /** Self link for the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface RelayApplicationCreateRequest {
  /** Name of the Relay Application */
  name: string;
  /** Topic of the Relay Application */
  topic: string;
  /** Call status callback URL */
  call_status_callback_url?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface RelayApplicationCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface RelayApplicationListResponse {
  /** An array of objects that contain a list of Relay Application data */
  data: RelayApplicationResponse[];
  /** Object containing pagination links */
  links: RelayApplicationAddressPaginationResponse;
}

export interface RelayApplicationResponse {
  /** Unique ID of the Relay Application. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Relay Application Fabric Resource */
  display_name: string | null;
  /** Type of the Fabric Resource */
  type: 'relay_application';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** Relay Application data. */
  relay_application: RelayApplication;
}

export interface RelayApplicationUpdateRequest {
  /** Name of the Relay Application */
  name?: string;
  /** Topic of the Relay Application */
  topic?: string;
  /** Call status callback URL */
  call_status_callback_url?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface RelayApplicationUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface ResourceAddressListResponse {
  /** An array opf objects that contain a list of Resource Addresses */
  data: FabricAddress[];
  /** Object containing pagination links */
  links: ResourceAddressPaginationResponse;
}

export interface ResourceAddressPaginationResponse {
  /** Link to the current page of results */
  self: string;
  /** Link to the first page of results */
  first: string;
  /** Link to the next page of results */
  next?: string;
  /** Link to the previous page of results */
  prev?: string;
}

export interface ResourceListResponse {
  /** An array of objects that contain a list of Resource data */
  data: ResourceResponse[];
  /** Object containing pagination links */
  links: ResourcePaginationResponse;
}

export interface ResourcePaginationResponse {
  /** The link to the current page */
  self: string;
  /** The link to the first page */
  first: string;
  /** The link to the next page */
  next?: string;
  /** The link to the previous page */
  prev?: string;
}

export type ResourceResponse =
  | ResourceResponseAI
  | ResourceResponseCallFlow
  | ResourceResponseCXMLWebhook
  | ResourceResponseCXMLScript
  | ResourceResponseCXMLApplication
  | ResourceResponseDialogFlowAgent
  | ResourceResponseFSConnector
  | ResourceResponseRelayApp
  | ResourceResponseSipEndpoint
  | ResourceResponseSipGateway
  | ResourceResponseSubscriber
  | ResourceResponseSWMLWebhook
  | ResourceResponseSWMLScript
  | ResourceResponseConferenceRoom;

export interface ResourceResponseAI {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'ai_agent';
  /** An object containing the response data of the AI Agent */
  ai_agent: AIAgent;
}

export interface ResourceResponseCXMLApplication {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'cxml_application';
  /** An object containing the response data of the cXML Application */
  cxml_application: CxmlApplication;
}

export interface ResourceResponseCXMLScript {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'cxml_script';
  /** An object containing the response data of the cXML Script */
  cxml_script: CXMLScript;
}

export interface ResourceResponseCXMLWebhook {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'cxml_webhook';
  /** An object containing the response data of the cXML Webhook */
  cxml_webhook: CXMLWebhook;
}

export interface ResourceResponseCallFlow {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'call_flow';
  /** An object containing the response data of the Call Flow */
  call_flow: CallFlow;
}

export interface ResourceResponseConferenceRoom {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'video_room';
  /** An object containing the response data of the Conference Room */
  conference_room: ConferenceRoom;
}

export interface ResourceResponseDialogFlowAgent {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'dialogflow_agent';
  /** An object containing the response data of the Dialogflow Agent */
  dialogflow_agent: DialogflowAgent;
}

export interface ResourceResponseFSConnector {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'freeswitch_connector';
  /** An object containing the response data of the FreeSWITCH Connector */
  freeswitch_connector: FreeswitchConnector;
}

export interface ResourceResponseRelayApp {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'relay_application';
  /** An object containing the response data of the Relay Application */
  relay_application: RelayApplication;
}

export interface ResourceResponseSWMLScript {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'swml_script';
  /** An object containing the response data of the SWML Script */
  swml_script: SwmlScript;
}

export interface ResourceResponseSWMLWebhook {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'swml_webhook';
  /** An object containing the response data of the SWML Webhook */
  swml_webhook: SWMLWebhook;
}

export interface ResourceResponseSipEndpoint {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'sip_endpoint';
  /** An object containing the response data of the SIP Endpoint */
  sip_endpoint: SipEndpoint;
}

export interface ResourceResponseSipGateway {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'sip_gateway';
  /** An object containing the response data of the SIP Gateway */
  sip_gateway: SipGateway;
}

export interface ResourceResponseSubscriber {
  /** Unique ID of the Resource. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the Resource */
  display_name: string | null;
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** The type of Resource */
  type: 'subscriber';
  /** An object containing the response data of the [Subscriber](/docs/platform/subscribers). */
  subscriber: Subscriber;
}

export interface ResourceSipEndpointAssignRequest {
  /** The unique identifier of the SIP endpoint. */
  sip_endpoint_id: uuid;
}

/** The request contains invalid parameters. See errors for details. */
export interface ResourceSipEndpointCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** The request contains invalid parameters. See errors for details. */
export interface ResourceSipEndpointUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** The request contains invalid parameters. See errors for details. */
export interface ResourceSubSipEndpointCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface SWAIGDefaults {
  meta_data?: Record<string, unknown>;
  meta_data_token?: string;
  web_hook_auth_pass?: string;
  web_hook_auth_password?: string;
  web_hook_auth_user?: string;
  web_hook_url?: string;
}

export interface SWAIGInternalFiller {
  adjust_response_latency?: {
    default?: Record<string, unknown>;
    auto?: Record<string, unknown>;
  };
  change_context?: {
    default?: Record<string, unknown>;
    auto?: Record<string, unknown>;
  };
  check_time?: {
    default?: Record<string, unknown>;
    auto?: Record<string, unknown>;
  };
  get_ideal_strategy?: {
    default?: Record<string, unknown>;
    auto?: Record<string, unknown>;
  };
  get_visual_input?: {
    default?: Record<string, unknown>;
    auto?: Record<string, unknown>;
  };
  next_step?: {
    default?: Record<string, unknown>;
    auto?: Record<string, unknown>;
  };
  pause_conversation?: {
    default?: Record<string, unknown>;
    auto?: Record<string, unknown>;
  };
  wait_for_user?: {
    default?: Record<string, unknown>;
    auto?: Record<string, unknown>;
  };
  wait_seconds?: {
    default?: Record<string, unknown>;
    auto?: Record<string, unknown>;
  };
}

export type SWAIGNativeFunction = string;

export interface SWMLScriptAddressListResponse {
  /** An array of objects that contain a list of SWML Script Addresses */
  data: FabricAddressApp[];
  /** Object containing pagination links */
  links: SWMLScriptAddressPaginationResponse;
}

export interface SWMLScriptAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link of the first page */
  first: string;
  /** Link of the next page */
  next?: string;
  /** Link of the previous page */
  prev?: string;
}

export interface SWMLWebhook {
  /** Unique ID of the SWML Webhook. */
  id: uuid;
  /** Name of the SWML Webhook. */
  name: string;
  /** Indicates whether this SWML Webhook handles inbound calls or inbound messages. Determines the payload SignalWire POSTs to `primary_request_url`. */
  used_for: 'calling' | 'messaging';
  /** Primary URL SignalWire fetches the SWML document from when the webhook fires. The webhook payload depends on `used_for`: for `calling`, see the [SWML inbound call webhook](/docs/apis/rest/webhooks/inbound-call-webhook); for `messaging`, see the [SWML inbound message webhook](/docs/apis/rest/webhooks/inbound-message-webhook). */
  primary_request_url: string;
  /** Primary request method of the SWML Webhook. */
  primary_request_method: 'GET' | 'POST';
  /** Fallback URL SignalWire fetches the SWML document from if the primary URL fails. Receives the same payload as `primary_request_url` — see the [SWML inbound call webhook](/docs/apis/rest/webhooks/inbound-call-webhook) or [SWML inbound message webhook](/docs/apis/rest/webhooks/inbound-message-webhook) depending on `used_for`. */
  fallback_request_url: string | null;
  /** Fallback request method of the SWML Webhook. */
  fallback_request_method: 'GET' | 'POST';
  /** Status callback url of the SWML Webhook. */
  status_callback_url: string | null;
  /** Status callback method of the SWML Webhook. */
  status_callback_method: 'GET' | 'POST';
}

export interface SWMLWebhookAddressListResponse {
  /** An array of objects that contain a list of SWML Webhook Addresses */
  data: FabricAddressApp[];
  /** Object containing pagination links */
  links: SWMLWebhookAddressPaginationResponse;
}

export interface SWMLWebhookAddressPaginationResponse {
  /** Link of the current paghe */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next: string;
  /** Link to the previous page */
  prev?: string;
}

export interface SWMLWebhookCreateRequest {
  /** Name of the SWML Webhook. */
  name?: string;
  /** Indicates whether this SWML Webhook handles inbound calls or inbound messages. Determines the payload SignalWire POSTs to `primary_request_url`. */
  used_for?: 'calling' | 'messaging';
  /** Primary URL SignalWire fetches the SWML document from when the webhook fires. The webhook payload depends on `used_for`: for `calling`, see the [SWML inbound call webhook](/docs/apis/rest/webhooks/inbound-call-webhook); for `messaging`, see the [SWML inbound message webhook](/docs/apis/rest/webhooks/inbound-message-webhook). */
  primary_request_url: string;
  /** Primary request method of the SWML Webhook. */
  primary_request_method?: 'GET' | 'POST';
  /** Fallback URL SignalWire fetches the SWML document from if the primary URL fails. Receives the same payload as `primary_request_url` — see the [SWML inbound call webhook](/docs/apis/rest/webhooks/inbound-call-webhook) or [SWML inbound message webhook](/docs/apis/rest/webhooks/inbound-message-webhook) depending on `used_for`. */
  fallback_request_url?: string;
  /** Fallback request method of the SWML Webhook. */
  fallback_request_method?: 'GET' | 'POST';
  /** Status callback url of the SWML Webhook. */
  status_callback_url?: string;
  /** Status callback method of the SWML Webhook. */
  status_callback_method?: 'GET' | 'POST';
}

export interface SWMLWebhookListResponse {
  /** An array of objects that contain a list of SWML Webhook data */
  data: SWMLWebhookResponse[];
  /** Object containing pagination links */
  links: SWMLWebhookPaginationResponse;
}

export interface SWMLWebhookPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface SWMLWebhookResponse {
  /** Unique ID of the SWML Webhook. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the SWML Webhook Fabric Resource */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'swml_webhook';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** SWML Webhook data. */
  swml_webhook: SWMLWebhook;
}

export interface SWMLWebhookUpdateRequest {
  /** Name of the SWML Webhook. */
  name?: string;
  /** Indicates whether this SWML Webhook handles inbound calls or inbound messages. Determines the payload SignalWire POSTs to `primary_request_url`. */
  used_for?: 'calling' | 'messaging';
  /** Primary URL SignalWire fetches the SWML document from when the webhook fires. The webhook payload depends on `used_for`: for `calling`, see the [SWML inbound call webhook](/docs/apis/rest/webhooks/inbound-call-webhook); for `messaging`, see the [SWML inbound message webhook](/docs/apis/rest/webhooks/inbound-message-webhook). */
  primary_request_url?: string;
  /** Primary request method of the SWML Webhook. */
  primary_request_method?: 'GET' | 'POST';
  /** Fallback URL SignalWire fetches the SWML document from if the primary URL fails. Receives the same payload as `primary_request_url` — see the [SWML inbound call webhook](/docs/apis/rest/webhooks/inbound-call-webhook) or [SWML inbound message webhook](/docs/apis/rest/webhooks/inbound-message-webhook) depending on `used_for`. */
  fallback_request_url?: string;
  /** Fallback request method of the SWML Webhook. */
  fallback_request_method?: 'GET' | 'POST';
  /** Status callback url of the SWML Webhook. */
  status_callback_url?: string;
  /** Status callback method of the SWML Webhook. */
  status_callback_method?: 'GET' | 'POST';
}

/** SIP endpoint model. */
export interface SipEndpoint {
  /** The id of the Sip Endpoint */
  id: uuid;
  /** The username of the Sip Endpoint */
  username: string;
  /** The caller ID that will showup when dialing from this Sip Endpoint */
  caller_id: string | null;
  /** The Sip username that will show up on the calle's side. Overrides the username. */
  send_as: string;
  /** Ciphers that can be enabled for calls on this Sip Endpoint. */
  ciphers: Ciphers[];
  /** Codecs that can be enabled for calls on this Sip Endpoint. */
  codecs: Codecs[];
  /** The set encryption type on the Sip Endpoint. */
  encryption: 'required' | 'optional';
  /** Specify how the SIP endpoint will handle outbound calls. */
  call_handler:
    | 'default'
    | 'passthrough'
    | 'block-pstn'
    | 'laml_webhook'
    | 'laml_application'
    | 'dialogflow'
    | 'relay_context'
    | 'relay_application'
    | 'relay_connector'
    | 'video_room'
    | 'ai_agent'
    | 'relay_script'
    | 'call_flow'
    | null;
  /** If `call_handler` is set to `resource`, this field expects the id of the set resouce. Will be `null` otherwise. */
  calling_handler_resource_id: uuid | null;
}

export interface SipEndpointAddressListResponse {
  /** An array of objects that contain a list of SIP Endpoint Addresses */
  data: FabricAddressCall[];
  /** Object containing pagination links */
  links: SipEndpointAddressPaginationResponse;
}

export interface SipEndpointAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface SipEndpointCreateRequest {
  /** The username of the Sip Endpoint */
  username: string;
  /** The caller ID that will showup when dialing from this Sip Endpoint */
  caller_id?: string;
  /** The Sip username that will show up on the calle's side. Overrides the username. */
  send_as?: string;
  /** Ciphers that can be enabled for calls on this Sip Endpoint. */
  ciphers?: Ciphers[];
  /** Codecs that can be enabled for calls on this Sip Endpoint. */
  codecs?: Codecs[];
  /** The set encryption type on the Sip Endpoint. */
  encryption?: Encryption;
  /** Specify how the SIP endpoint will handle outbound calls. */
  call_handler?: CallHandlerType;
  /** If `call_handler` is set to `resource`, this field expects the id of the set resouce. Will be `null` otherwise. */
  calling_handler_resource_id?: uuid | null;
  /** The SIP endpoint's password. */
  password: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface SipEndpointCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** Response containing a list of SIP endpoints. */
export interface SipEndpointListResponse {
  /** An array of objects that contain a list of SIP Endpoint data */
  data: SipEndpointResponse[];
  /** Object containing pagination links */
  links: SipEndpointPaginationResponse;
}

export interface SipEndpointPaginationResponse {
  /** Link to the current page. */
  self: string;
  /** Link to the first page. */
  first: string;
  /** Link to the next page. Only present when there are more results. */
  next?: string;
  /** Link to the previous page. Only present when not on the first page. */
  prev?: string;
}

export interface SipEndpointResponse {
  /** The unique identifier of the SIP endpoint. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the SIP Endpoint Fabric Resource */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'sip_endpoint';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** SIP Endpoint data. */
  sip_endpoint: SipEndpoint;
}

export interface SipEndpointUpdateRequest {
  /** The username of the Sip Endpoint */
  username?: string;
  /** The caller ID that will showup when dialing from this Sip Endpoint */
  caller_id?: string;
  /** The Sip username that will show up on the calle's side. Overrides the username. */
  send_as?: string;
  /** Ciphers that can be enabled for calls on this Sip Endpoint. */
  ciphers?: Ciphers[];
  /** Codecs that can be enabled for calls on this Sip Endpoint. */
  codecs?: Codecs[];
  /** The set encryption type on the Sip Endpoint. */
  encryption?: Encryption;
  /** Specify how the SIP endpoint will handle outbound calls. */
  call_handler?: CallHandlerType;
  /** If `call_handler` is set to `resource`, this field will contain the id of the set resouce. Will be `null` otherwise. */
  calling_handler_resource_id?: uuid | null;
  /** The SIP endpoint's password. */
  password?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface SipEndpointUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface SipGateway {
  /** Unique ID of the SIP Gateway. */
  id: string;
  /** The URI for the SIP Gateway. */
  uri: string;
  /** Display name of the SIP Gateway. */
  name: string;
  /** List of supported SIP ciphers. */
  ciphers: Ciphers[];
  /** List of supported codecs. */
  codecs: Codecs[];
  /** Specifies the encryption requirement. */
  encryption: SipGatewayEncryption;
}

export interface SipGatewayAddressListResponse {
  /** An array of objects containing a list of SIP Gateway Addresses */
  data: FabricAddressCall[];
  /** Object containing pagination links */
  links: SipGatewayAddressPaginationResponse;
}

export interface SipGatewayAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface SipGatewayCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface SipGatewayListResponse {
  /** An array of objects that contain a list of SIP Gateway data */
  data: SipGatewayResponse[];
  /** Pagination links for the response. */
  links: SipGatewayPaginationResponse;
}

export interface SipGatewayPaginationResponse {
  /** Link to the current page of results */
  self: string;
  /** Link to the first page of results */
  first: string;
  /** Link to the next page of results */
  next?: string;
  /** Link to the previous page of results */
  prev?: string;
}

export interface SipGatewayRequest {
  /** Display name for the SIP Gateway. */
  name: string;
  /** External SIP URI. */
  uri: string;
  /** Specifies the encryption requirement for the SIP connection. */
  encryption: SipGatewayEncryption;
  /** List of supported SIP ciphers. */
  ciphers: Ciphers[];
  /** List of supported codecs for media transmission. */
  codecs: Codecs[];
}

export interface SipGatewayRequestUpdate {
  /** Display name for the SIP Gateway. */
  name: string;
  /** External SIP URI. */
  uri: string;
  /** Specifies the encryption requirement for the SIP connection. */
  encryption: SipGatewayEncryption;
  /** List of supported SIP ciphers. */
  ciphers: Ciphers[];
  /** List of supported codecs for media transmission. */
  codecs: Codecs[];
}

export interface SipGatewayResponse {
  /** Unique ID of the resource. */
  id: string;
  /** Project ID associated with the resource. */
  project_id: string;
  /** Display name of the SIP Gateway. */
  display_name: string;
  /** Type of the resource. */
  type: 'sip_gateway';
  /** Timestamp when the resource was created. */
  created_at: string;
  /** Timestamp when the resource was last updated. */
  updated_at: string;
  /** SIP Gateway configuration details. */
  sip_gateway: SipGateway;
}

export interface Subscriber {
  /** Unique ID of the Subscriber. */
  id: uuid;
  /** Email of the Subscriber. */
  email: string;
  /** First name of the Subscriber. */
  first_name: string;
  /** Last name of the Subscriber. */
  last_name: string;
  /** Display name of the Subscriber. */
  display_name: string;
  /** Job title of the Subscriber. */
  job_title: string;
  /** Country of the Subscriber. */
  country: string;
  /** Company name of the Subscriber. */
  company_name: string;
  /** The subscriber's time zone. */
  time_zone?: string;
}

export interface SubscriberAddressPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link of the previous page */
  prev?: string;
}

export interface SubscriberAddressesResponse {
  /** An array of objects that contain a list of Subscriber addresses */
  data: FabricAddressSubscriber[];
  /** Object containing pagination links */
  links: SubscriberAddressPaginationResponse;
}

/** The request contains invalid parameters. See errors for details. */
export interface SubscriberCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface SubscriberGuestTokenCreateRequest {
  /** List of up to 10 UUIDs representing the allowed Fabric addresses. */
  allowed_addresses?: uuid[];
  /** A unixtime (the number of seconds since 1970-01-01 00:00:00) at which the token should no longer be valid. Defaults to 'two hours from now' */
  expire_at?: number;
  /** The channel for the guest token. */
  ch?: string;
  /** The region for the guest token. */
  region?: string;
  /** The guest's email address. */
  email?: string;
  /** The guest's first name. */
  first_name?: string;
  /** The guest's last name. */
  last_name?: string;
  /** The guest's display name. */
  display_name?: string;
  /** The guest's job title. */
  job_title?: string;
  /** The guest's time zone. Defaults to GMT. */
  time_zone?: string;
  /** The guest's country. */
  country?: string;
  /** The guest's company name. */
  company_name?: string;
}

export interface SubscriberGuestTokenCreateResponse {
  /** Guest Token */
  token: jwt;
  /** Refresh Token */
  refresh_token: jwt;
  /** URI of the guest's Fabric Address. */
  address_uri: string;
  /** When the guest token expires. */
  expires_at: string;
  /** Seconds until the guest token expires. */
  expires_in: number;
  /** When the guest token was issued. */
  issued_at: string;
}

export interface SubscriberListResponse {
  /** An array of objects that contain a list of Subscriber data */
  data: SubscriberResponse[];
  /** Object containing pagination links */
  links: SubscriberPaginationResponse;
}

export interface SubscriberPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface SubscriberRefreshTokenRequest {
  /** The refresh token previously issued alongside a subscriber access token. This token is used to request a new access token. */
  refresh_token: jwt;
}

export interface SubscriberRefreshTokenResponse {
  /** A newly generated subscriber access token, valid for 2 hours. */
  token: jwt;
  /** A new refresh token, valid for 2 hours and 5 minutes. */
  refresh_token: jwt;
}

export interface SubscriberRequest {
  /** Password of the Subscriber. Defaults to a secure random password if not provided. */
  password?: string;
  /** Email of the Subscriber. */
  email: string;
  /** First name of the Subscriber. */
  first_name?: string;
  /** Last name of the Subscriber. */
  last_name?: string;
  /** Display name of the Subscriber. */
  display_name?: string;
  /** Job title of the Subscriber. */
  job_title?: string;
  /** Country of the Subscriber. */
  country?: string;
  /** Company name of the Subscriber. */
  company_name?: string;
  /** The subscriber's time zone. Defaults to GMT on create. */
  time_zone?: string;
}

export interface SubscriberUpdateRequest {
  /** Password of the Subscriber. Defaults to a secure random password if not provided. */
  password?: string;
  /** Email of the Subscriber. */
  email?: string;
  /** First name of the Subscriber. */
  first_name?: string;
  /** Last name of the Subscriber. */
  last_name?: string;
  /** Display name of the Subscriber. */
  display_name?: string;
  /** Job title of the Subscriber. */
  job_title?: string;
  /** Country of the Subscriber. */
  country?: string;
  /** Company name of the Subscriber. */
  company_name?: string;
  /** The subscriber's time zone. Defaults to GMT on create. */
  time_zone?: string;
}

export interface SubscriberResponse {
  /** Unique ID of the request. */
  id: string;
  /** Unique ID of the project. */
  project_id: string;
  /** Display name of the Subscriber. */
  display_name: string;
  /** Type of the resource. */
  type: 'subscriber';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** Subscriber data. */
  subscriber: Subscriber;
}

export interface SubscriberSIPEndpoint {
  /** Unique ID of the Sip Endpoint. */
  id: uuid;
  /** Username of the Sip Endpoint. */
  username: string;
  /** Caller ID of the Sip Endpoint. */
  caller_id: string | null;
  /** Purchased or verified number */
  send_as: string;
  /** Ciphers of the Sip Endpoint. */
  ciphers: Ciphers[];
  /** Codecs of the Sip Endpoint. */
  codecs: Codecs[];
  /** Encryption requirement of the Sip Endpoint. */
  encryption: 'required' | 'optional' | null;
}

export interface SubscriberSipEndpointListResponse {
  data: SubscriberSIPEndpoint[];
  links: SubscriberSipEndpointPaginationResponse;
}

export interface SubscriberSipEndpointPaginationResponse {
  /** Link of the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** The link to the previous page */
  prev?: string;
}

export interface SubscriberSipEndpointRequest {
  /** Username of the Sip Endpoint. */
  username: string;
  /** Password of the Sip Endpoint. */
  password: string;
  /** Caller ID of the Sip Endpoint. */
  caller_id?: string;
  /** The Number to send as. */
  send_as?: string;
  /** Ciphers of the Sip Endpoint. */
  ciphers?: Ciphers[];
  /** Codecs of the Sip Endpoint. */
  codecs?: Codecs[];
  /** Encryption requirement of the Sip Endpoint. */
  encryption?: Encryption;
}

export interface SubscriberSipEndpointRequestUpdate {
  /** Username of the Sip Endpoint. */
  username?: string;
  /** Password of the Sip Endpoint. */
  password?: string;
  /** Caller ID of the Sip Endpoint. */
  caller_id?: string;
  /** The Number to send as. */
  send_as?: string;
  /** Ciphers of the Sip Endpoint. */
  ciphers?: Ciphers[];
  /** Codecs of the Sip Endpoint. */
  codecs?: Codecs[];
  /** Encryption requirement of the Sip Endpoint. */
  encryption?: Encryption;
}

export interface SubscriberTokenRequest {
  /** Connection host written into the token's `ch` header. Defaults to the project's regional host. */
  ch?: string;
  /** A string that uniquely identifies the subscriber. Often it's an email, but can be any other string. */
  reference: string;
  /** A unixtime (the number of seconds since 1970-01-01 00:00:00) at which the token should no longer be valid. Defaults to 'two hours from now' */
  expire_at?: number;
  /** The ID of the application that the token is associated with. */
  application_id?: uuid;
  /** Set or update the subscriber's password. Omit this field or pass an empty string if you don't want to update the password. */
  password?: string;
  /** Set or update the first name of the subscriber. */
  first_name?: string;
  /** Set or update the last name of the subscriber. */
  last_name?: string;
  /** Set or update the display name of the subscriber. */
  display_name?: string;
  /** Set or update the job title of the subscriber. */
  job_title?: string;
  /** Set or update the time zone of the subscriber. */
  time_zone?: string;
  /** Set or update the country of the subscriber. */
  country?: string;
  /** Set or update the region of the subscriber. */
  region?: string;
  /** Set or update the company name of the subscriber. */
  company_name?: string;
  /** Space-separated token scopes. The only accepted scope is `sat:refresh`, which lets the client refresh its own token; without a `fingerprint` such a token is capped at 60 seconds. */
  scope?: 'sat:refresh';
  /** A 43-character base64url key thumbprint that binds the token to one client (the token's `cnf.jkt` claim). */
  fingerprint?: string;
}

export interface SubscriberTokenResponse {
  /** The ID of the subscriber that the token is associated with. */
  subscriber_id: uuid;
  /** The token that is associated with the subscriber. */
  token: jwt;
  /** Refresh token. */
  refresh_token: jwt;
}

/** The request contains invalid parameters. See errors for details. */
export interface SubscriberTokenStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** The request contains invalid parameters. See errors for details. */
export interface SubscriberUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** A SWML Script — either a [Calling Script](#schema/CallingSwmlScript) for inbound or */
export interface SwmlScript {
  /** Unique ID of a SWML Script. */
  id: uuid;
  /** The SWML script contents */
  contents: Record<string, unknown>;
  /** The url where the SWML script is hosted at. */
  request_url: string;
  /** The displayed name of the SWML scipt */
  display_name: string;
  /** URL to send status callbacks to */
  status_callback_url?: string | null;
  /** HTTP method to use for status callbacks */
  status_callback_method?: 'POST';
  /** What the SWML script is used for. */
  script_type?: 'calling' | 'messaging';
}

/** Body shape for creating a SWML Script. Choose a [Calling Script](#schema/CallingSwmlScriptCreateRequest) for inbound or outbound calls or a [Messaging Script](#schema/MessagingSwmlScriptCreateRequest) for inbound SMS or MMS messages. `script_type` is optional and defaults to `"calling"` when omitted — set it explicitly to `"messaging"` to create a Messaging Script. The script kind determines whether the script can be assigned as a call handler or a message handler on a phone number. */
export interface SwmlScriptCreateRequest {
  /** Display name of the SWML Script */
  name: string;
  /** The contents of the SWML script. */
  contents: string | Record<string, unknown>;
  /** URL to send status callbacks to */
  status_callback_url?: string;
  /** What the SWML script is used for. */
  script_type?: 'calling' | 'messaging';
}

/** The request contains invalid parameters. See errors for details. */
export interface SwmlScriptCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface SwmlScriptListResponse {
  /** An array of objects that contain a list of SWML Script data */
  data: SwmlScriptResponse[];
  /** Object containing pagination links */
  links: SwmlScriptPaginationresponse;
}

export interface SwmlScriptPaginationresponse {
  /** Link to the current page */
  self: string;
  /** Link to the first page */
  first: string;
  /** Link to the next page */
  next?: string;
  /** Link to the previous page */
  prev?: string;
}

export interface SwmlScriptResponse {
  /** Unique ID of the SWML Script. */
  id: uuid;
  /** Unique ID of the Project. */
  project_id: uuid;
  /** Display name of the SWML Script Fabric Resource */
  display_name: string;
  /** Type of the Fabric Resource */
  type: 'swml_script';
  /** Date and time when the resource was created. */
  created_at: string;
  /** Date and time when the resource was updated. */
  updated_at: string;
  /** SWML Script data. */
  swml_script: SwmlScript;
}

/** Body shape for updating an existing SWML Script. All fields are optional — include only what you want to change. Choose a [Calling Script](#schema/CallingSwmlScriptUpdateRequest) for inbound or outbound calls or a [Messaging Script](#schema/MessagingSwmlScriptUpdateRequest) for inbound SMS or MMS messages. */
export interface SwmlScriptUpdateRequest {
  /** The contents of the SWML script. */
  contents?: string | Record<string, unknown>;
  /** URL to send status callbacks to */
  status_callback_url?: string;
  /** The name of the SWML script. */
  name?: string;
  /** What the SWML script is used for. */
  script_type?: 'calling' | 'messaging';
}

/** The request contains invalid parameters. See errors for details. */
export interface SwmlScriptUpdateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** The request contains invalid parameters. See errors for details. */
export interface SwmlWebhookCreateStatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** The request contains invalid parameters. See errors for details. */
export interface SwmlWebhookUpdateStatusCode422 {
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

/** The request contains invalid parameters. See errors for details. */
export interface Types_StatusCodes_StatusCode422 {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

/** An internal server error occurred. */
export interface Types_StatusCodes_StatusCode500 {
  error: 'Internal Server Error';
}

/** Sets the handler to handle incoming `calls`, `messages` or `faxes`. */
export type CxmlWebhookUsedForType = 'calling' | 'messaging' | 'faxing';

/** Sets the handler to handle incoming `calls` or `messages`. */
export type UsedForType = 'calling' | 'messaging';

export interface VideoChannel {
  /** Video Channel of Fabric Address */
  video: string;
}

/** Without one of `expressions` / `output` and `url`, a Webhook has no effect: it is accepted and ignored, not rejected. */
export interface Webhook {
  error_keys?: unknown[] | string;
  expressions?: Expression[] | Expression;
  foreach?: Foreach;
  form_param?: string;
  headers?: Record<string, unknown>;
  input_args_as_params?: boolean;
  method?: string;
  output?: Output;
  params?: unknown[] | boolean | null | number | Record<string, unknown> | string;
  require_args?: unknown[] | string;
  url?: string;
}

export type jwt = string;

/** Universal Unique Identifier. */
export type uuid = string;

export interface AliasAddress {
  /** Unique identifier for the alias address. */
  id: uuid;
  /** The object type. Always `alias`. */
  type: 'alias';
  /** ID of the resource that handles calls and messages to this alias. */
  resource_id: uuid | null;
  /** URL-safe name for the alias. Used to build its address. */
  name: string;
  /** Human-friendly label for the alias. Defaults to `name`. */
  display_name: string;
  /** Display type derived from the handler resource. Returned for reference only and cannot be set. */
  display_type: string | null;
  /** Channels enabled on this alias. */
  channels: ('audio' | 'messaging' | 'video')[];
  /** Codecs enabled for calls to this alias. Empty when none are set. */
  codecs:
    | (
        | 'OPUS'
        | 'OPUS@48000H@20I'
        | 'OPUS@24000H@20I'
        | 'OPUS@16000H@20I'
        | 'OPUS@8000H@20I'
        | 'G722'
        | 'PCMU'
        | 'PCMA'
        | 'G729'
        | 'VP8'
        | 'H264'
      )[]
    | null;
  /** Access context the alias lives in. */
  context: string;
  /** The resource address this alias resolves to, in the form `/<context>/<name>`. */
  uri: string;
  /** Date and time when the alias address was created. */
  created_at: string;
  /** Date and time when the alias address was last updated. */
  updated_at: string;
}

export interface AliasAddressCreateRequest {
  /** URL-safe name for the alias — lowercase letters and numbers, with underscores or dashes in place of spaces. Dashes can't start or end the name or appear twice in a row. Must be unique within its context and is used to build the alias's address. */
  name: string;
  /** Human-friendly label for the alias. Defaults to `name`. */
  display_name?: string;
  /** ID of the resource that handles calls and messages to this alias. Must reference a resource in your project. Cannot be changed after creation: to point an alias at a different resource, delete it and create a new one. */
  resource_id: uuid;
  /** Channels to enable on the alias. At least one is required. Defaults to all three. */
  channels?: ('audio' | 'messaging' | 'video')[];
  /** Codecs to enable for calls to the alias. Defaults to none. */
  codecs?: (
    | 'OPUS'
    | 'OPUS@48000H@20I'
    | 'OPUS@24000H@20I'
    | 'OPUS@16000H@20I'
    | 'OPUS@8000H@20I'
    | 'G722'
    | 'PCMU'
    | 'PCMA'
    | 'G729'
    | 'VP8'
    | 'H264'
  )[];
  /** Access context to create the alias in. Defaults to `public`. */
  context?: 'private' | 'public';
}

export interface AliasAddressUpdateRequest {
  /** URL-safe name for the alias — lowercase letters and numbers, with underscores or dashes in place of spaces. Dashes can't start or end the name or appear twice in a row. Must be unique within its context. Keeps the current value when omitted. */
  name?: string;
  /** Human-friendly label for the alias. */
  display_name?: string;
  /** Channels to enable on the alias. At least one is required. */
  channels?: ('audio' | 'messaging' | 'video')[];
  /** Codecs to enable for calls to the alias. */
  codecs?: (
    | 'OPUS'
    | 'OPUS@48000H@20I'
    | 'OPUS@24000H@20I'
    | 'OPUS@16000H@20I'
    | 'OPUS@8000H@20I'
    | 'G722'
    | 'PCMU'
    | 'PCMA'
    | 'G729'
    | 'VP8'
    | 'H264'
  )[];
  /** Access context to move the alias to. Only changed when supplied; otherwise the alias stays in its current context. */
  context?: 'private' | 'public';
}

export interface SipAddress {
  /** Unique identifier for the SIP address. */
  id: uuid;
  /** The object type. Always `sip`. */
  type: 'sip';
  /** ID of the resource this address belongs to. */
  resource_id: uuid | null;
  /** URL-safe name for the SIP address. Used to build its SIP URI. */
  name: string;
  /** Human-friendly label for the SIP address. Defaults to `name`. */
  display_name: string;
  /** The Domain this address is grouped under — for example, `public` for your project's default Domain. */
  context: string;
  /** Full SIP URI for this address. */
  uri: string;
  /** SIP username used to reach this address. `*` accepts any username. */
  user: string | null;
  /** SRTP encryption requirement for calls to this address. */
  encryption: 'required' | 'optional' | 'forbidden';
  /** Enabled codecs for calls to this address. */
  codecs: (
    | 'OPUS'
    | 'OPUS@48000H@20I'
    | 'OPUS@24000H@20I'
    | 'OPUS@16000H@20I'
    | 'OPUS@8000H@20I'
    | 'G722'
    | 'PCMU'
    | 'PCMA'
    | 'G729'
    | 'VP8'
    | 'H264'
  )[];
  /** Enabled SRTP ciphers for calls to this address. */
  ciphers: (
    | 'AEAD_AES_256_GCM_8'
    | 'AES_256_CM_HMAC_SHA1_80'
    | 'AES_CM_128_HMAC_SHA1_80'
    | 'AES_256_CM_HMAC_SHA1_32'
    | 'AES_CM_128_HMAC_SHA1_32'
  )[];
  /** Whether IP authentication is enforced for this address. */
  ip_auth_enabled: boolean | null;
  /** Whitelisted IP/CIDR entries used when `ip_auth_enabled` is `true`. */
  ip_auth: string[] | null;
  /** ID of the resource that handles inbound calls to this address. */
  calling_handler_resource_id: uuid | null;
  /** Date and time when the SIP address was created. */
  created_at: string;
  /** Date and time when the SIP address was last updated. */
  updated_at: string;
}

export interface SipAddressCreateRequest {
  /** URL-safe name for the SIP address — lowercase letters, numbers, and hyphens only (no spaces or other special characters). Must be unique within the project and is used to build the address's SIP URI. */
  name: string;
  /** SIP username used to reach this address (no spaces). Defaults to `*`, which accepts any username. Together with the address's Domain, must be unique across your SignalWire account. */
  user?: string;
  /** ID of the Domain this address should be grouped under. Must exist in your project. Defaults to your project's default Domain. */
  context_id?: uuid;
  /** ID of the resource that handles inbound calls to this address. Must reference a resource in the caller's project. */
  calling_handler_resource_id: uuid;
  /** Whether to enforce IP authentication for this address. */
  ip_auth_enabled?: boolean;
  /** Whitelisted IP/CIDR entries. Required (at least one) when `ip_auth_enabled` is `true`. Maximum 256 entries. */
  ip_auth?: string[];
  /** Non-empty subset of enabled codecs. */
  codecs?: (
    | 'OPUS'
    | 'OPUS@48000H@20I'
    | 'OPUS@24000H@20I'
    | 'OPUS@16000H@20I'
    | 'OPUS@8000H@20I'
    | 'G722'
    | 'PCMU'
    | 'PCMA'
    | 'G729'
    | 'VP8'
    | 'H264'
  )[];
  /** Non-empty subset of enabled SRTP ciphers. */
  ciphers?: (
    | 'AEAD_AES_256_GCM_8'
    | 'AES_256_CM_HMAC_SHA1_80'
    | 'AES_CM_128_HMAC_SHA1_80'
    | 'AES_256_CM_HMAC_SHA1_32'
    | 'AES_CM_128_HMAC_SHA1_32'
  )[];
  /** SRTP encryption requirement for calls to this address. */
  encryption?: 'required' | 'optional' | 'forbidden';
  /** Write-only SIP registration password. Never returned in any response. */
  password?: string;
}

export interface SipAddressUpdateRequest {
  /** URL-safe name for the SIP address — lowercase letters, numbers, and hyphens only (no spaces or other special characters). Must be unique within the project. Defaults to the current value when omitted. */
  name?: string;
  /** SIP username used to reach this address (no spaces). Together with the address's Domain, must be unique across your SignalWire account. */
  user?: string;
  /** ID of the Domain this address should be grouped under. Must exist in your project. Defaults to the address's current Domain when omitted. */
  context_id?: uuid;
  /** Whether to enforce IP authentication for this address. */
  ip_auth_enabled?: boolean;
  /** Whitelisted IP/CIDR entries. Required (at least one) when `ip_auth_enabled` is `true`. Maximum 256 entries. */
  ip_auth?: string[];
  /** Non-empty subset of enabled codecs. */
  codecs?: (
    | 'OPUS'
    | 'OPUS@48000H@20I'
    | 'OPUS@24000H@20I'
    | 'OPUS@16000H@20I'
    | 'OPUS@8000H@20I'
    | 'G722'
    | 'PCMU'
    | 'PCMA'
    | 'G729'
    | 'VP8'
    | 'H264'
  )[];
  /** Non-empty subset of enabled SRTP ciphers. */
  ciphers?: (
    | 'AEAD_AES_256_GCM_8'
    | 'AES_256_CM_HMAC_SHA1_80'
    | 'AES_CM_128_HMAC_SHA1_80'
    | 'AES_256_CM_HMAC_SHA1_32'
    | 'AES_CM_128_HMAC_SHA1_32'
  )[];
  /** SRTP encryption requirement for calls to this address. */
  encryption?: 'required' | 'optional' | 'forbidden';
  /** Write-only SIP registration password. Never returned in any response. */
  password?: string;
}

export interface PhoneNumberAddress {
  /** Unique identifier for the phone number address. */
  id: uuid;
  /** The object type. Always `phone`. */
  type: 'phone';
  /** The channel this address represents: `calling` for inbound calls or `messaging` for inbound messages. A phone number has one address per channel. */
  handler_type: 'calling' | 'messaging';
  /** ID of the resource that handles this channel. `null` when no resource is assigned. */
  resource_id: uuid | null;
  /** Name of the phone number address. */
  name: string;
  /** The phone number in E.164 format. */
  phone_number: string | null;
  /** ID of the phone number this address belongs to. */
  phone_number_id: uuid;
  /** Date and time when the phone number address was created. */
  created_at: string;
  /** Date and time when the phone number address was last updated. */
  updated_at: string;
}

export interface PhoneNumberAddressCreateRequest {
  /** ID of a phone number your project owns. Provide this or `number`. */
  phone_number_id?: uuid;
  /** A phone number your project owns, in E.164 format. Other common formats are accepted and normalized to E.164. Provide this or `phone_number_id`. */
  number?: string;
  /** ID of the resource that should handle the channel. Must be a resource in your project of a type that can handle the chosen channel — for example, only messaging-capable resources can handle `messaging`. */
  resource_id: uuid;
  /** The channel to link the resource to: `calling` for inbound calls or `messaging` for inbound messages. The channel must not already have a resource assigned. */
  handler_type: 'calling' | 'messaging';
}

export interface PhoneNumberAddressUpdateRequest {
  /** New name for the phone number address — lowercase letters, numbers, underscores, and hyphens only (no spaces or other special characters), up to 256 characters. Also renames the phone number. Defaults to the current value when omitted. */
  name?: string;
  /** ID of the resource that should handle the channel from now on. Must be a resource in your project of a type that can handle the address's channel. Defaults to the current value when omitted. */
  resource_id?: uuid;
}

export interface AliasAddressListResponse {
  /** Pagination links for the response. */
  links: FabricAddressPaginationResponse;
  /** The number of alias addresses in this page of results. */
  items_count: number;
  /** An array of alias address objects. */
  data: AliasAddress[];
}

export interface SipAddressListResponse {
  /** Pagination links for the response. */
  links: FabricAddressPaginationResponse;
  /** The number of SIP addresses in this page of results. */
  items_count: number;
  /** An array of SIP address objects. */
  data: SipAddress[];
}

export interface PhoneNumberAddressListResponse {
  /** Pagination links for the response. */
  links: FabricAddressPaginationResponse;
  /** The number of phone number addresses in this page of results. */
  items_count: number;
  /** An array of phone number address objects. */
  data: PhoneNumberAddress[];
}

export interface WhatsappNumberAssignRequest {
  /** The SignalWire ID of the WhatsApp number, as returned by [List WhatsApp numbers](/docs/apis/rest/whatsapp/list-whatsapp-numbers). */
  whatsapp_number_id: uuid;
  /** Whether the Resource handles the number's `calling` or `messaging` traffic. */
  handler: UsedForType;
}

/** The Address created for the WhatsApp number on the Resource. Its `type` is `app` for most handlers, `room` for a Video Room, and `call` for a Resource that connects the call to a SIP endpoint or connector. */
export interface WhatsappNumberAddressResponse {
  id: uuid;
  resource_id: uuid | null;
  name: string;
  display_name: string;
  type: 'app' | 'call' | 'room';
  cover_url: string | null;
  preview_url: string | null;
  locked: boolean;
  channels:
    | {
        audio: string;
      }
    | {
        messaging: string;
      };
}

export interface Step {
  end?: boolean | string;
  functions?: unknown[];
  gather_info?: Record<string, unknown>;
  history?: string;
  name?: string;
  pom?: PromptPomSection[];
  reset?: Record<string, unknown>;
  skip_to_next_step?: boolean | string;
  skip_user_turn?: boolean | string;
  step_criteria?: string;
  text?: string;
  valid_contexts?: string[];
  valid_steps?: string[];
}

/** Without one of `body` / `bullets` / `subsections`, the object has no effect: it is accepted and ignored, not rejected. */
export interface PromptPomSection {
  title?: string;
  body?: string;
  bullets?: string[];
  numbered?: boolean;
  numberedBullets?: boolean;
  subsections?: PromptPomSection[];
  [key: string]: unknown;
}

/** Without `append`, `input_key` and `output_key`, a Foreach has no effect: it is accepted and ignored, not rejected. */
export interface Foreach {
  append?: string;
  input_key?: string;
  max?: number | string;
  output_key?: string;
}

export interface Context {
  consolidate?: boolean | string;
  enter_fillers?: Record<string, unknown>;
  exit_fillers?: Record<string, unknown>;
  full_reset?: boolean | string;
  history?: string;
  initial_step?: string;
  isolated?: boolean | string;
  pom?: PromptPomSection[];
  post_prompt?: Record<string, unknown>;
  prompt?: string;
  reset?: unknown[] | boolean | null | number | Record<string, unknown> | string;
  steps?: Step[];
  system_prompt?: string;
  user_prompt?: string;
  valid_contexts?: unknown[];
  valid_steps?: unknown[];
}

/** Defines the AI agent's personality, goals, behaviors, and instructions for handling conversations. */
export interface AIAgentPrompt {
  contexts?: Contexts;
  frequency_penalty?: number | string;
  max_completion_tokens?: number;
  max_tokens?: number;
  model?: string;
  pom?: {
    title?: string;
    body?: string;
    bullets?: unknown[];
    numbered?: boolean;
    numberedBullets?: boolean;
    subsections?: unknown[];
  }[];
  presence_penalty?: number | string;
  reasoning_effort?: string;
  steps?: Step[];
  temperature?: number | string;
  text?: string;
  top_p?: number | string;
  verbosity?: string;
}

/** The final set of instructions and configuration settings to send to the agent. */
export interface AIAgentPostPrompt {
  frequency_penalty?: number | string;
  max_completion_tokens?: number;
  max_tokens?: number;
  model?: string;
  pom?: POM[];
  presence_penalty?: number | string;
  reasoning_effort?: string;
  temperature?: number | string;
  text?: string;
  top_p?: number | string;
  verbosity?: string;
}

/** Without one of `data_map` / `web_hook_url`, one of `description` / `purpose` and `function`, the element has no effect: it is accepted and ignored, not rejected. */
export interface AIAgentSWAIGFunction {
  description?: string;
  /** A `false` is dropped before storage (blank values are removed), so the function stays active; remove the function to disable it. */
  active?: boolean | number | string;
  /** The function's arguments as a JSON Schema object. prime-rails rebuilds it before storing, keeping only `type`, `description`, `enum` and `default` of each property and the `required` list; any other keyword is dropped. */
  argument?: {
    type?: 'object';
    properties?: Record<
      string,
      {
        type?: string;
        description?: string;
        enum?: unknown[] | string;
        default?: Record<string, unknown>;
      }
    >;
    required?: string[];
  };
  data_map?: DataMap;
  fillers?: FunctionFillers;
  function?: string;
  meta_data?: Record<string, unknown>;
  meta_data_token?: string;
  parameters?: FunctionParameters;
  purpose?: string;
  skip_fillers?: boolean | string;
  wait_file?: string;
  wait_file_loops?: number | string;
  wait_for_fillers?: boolean | string;
  web_hook_auth_pass?: string;
  web_hook_auth_password?: string;
  web_hook_auth_user?: string;
  web_hook_url?: string;
  /** Identifier of the function entry. */
  id?: string;
  /** Request-only alternative to `argument`, a list of arguments; stored as `argument`. Sending both is rejected. */
  arguments?: {
    name?: string;
    description?: string;
    required?: 'true' | 'false';
    enum?: unknown[] | string;
    default?: Record<string, unknown>;
    type?: string;
  }[];
}

/** Without `replace` and `with`, the element has no effect: it is accepted and ignored, not rejected. */
export interface AIAgentPronounce {
  /** Identifier of the pronunciation entry. */
  id?: string;
  replace?: string;
  with?: string;
  /** Request-only spelling of `with`; stored and returned as `with`. */
  replace_with?: string;
  ignore_case?: boolean | number | string;
}

export type ListAiAgentVoicesResponse = AIAgentVoice[];
