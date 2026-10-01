// AUTO-GENERATED from porting-sdk/rest-apis/calling/openapi.enriched.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

export interface AI {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  ai: AIObject | (string | SWMLVar)[] | number | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | AIObject
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

/** Creates an AI agent that conducts voice conversations using automatic speech recognition (ASR), */
export interface AIObject {
  /** An array of JSON objects to create user-defined functions/endpoints that can be executed during the dialogue. */
  SWAIG?:
    | {
        description?: string;
        active?: boolean | number | string;
        argument?: FunctionParameters;
        data_map?: DataMap;
        fillers?: {
          default?: unknown;
          auto?: unknown;
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
      }[]
    | SWAIG;
  agent?: string | SWMLVar;
  /** The engine to use for the language. For example, 'elevenlabs'. */
  engine?: string | SWMLVar;
  /** A key-value object for storing data that persists throughout the AI session. */
  global_data?: Record<string, unknown>;
  /** Hints help the AI agent understand certain words or phrases better. Words that can commonly be misinterpreted can be added to the hints to help the AI speak more accurately. */
  hints?: (Hint | string)[];
  /** An array of JSON objects defining supported languages in the conversation. */
  languages?: Languages[];
  multilingual?: {
    allowed?: unknown[];
    engine?: string;
    fillers?:
      | unknown[]
      | {
          default?: unknown;
          auto?: unknown;
        };
    function_fillers?:
      | unknown[]
      | {
          default?: unknown;
          auto?: unknown;
        };
    languages?: unknown[];
    min_switch_words?: number;
    model?: string;
    provider?: string;
    start_language?: string;
    turn_fillers?:
      | unknown[]
      | {
          default?: unknown;
        };
  };
  params?: AIParams;
  post_prompt?: AIPostPrompt;
  post_prompt_auth_password?: string | SWMLVar;
  post_prompt_auth_user?: string | SWMLVar;
  /** The URL to which to send status callbacks and reports. Authentication can also be set in the url in the format of `username:password@url`. */
  post_prompt_url?: string | SWMLVar;
  prompt?: AIPrompt;
  /** An array of JSON objects to clarify the AI's pronunciation of words or expressions. */
  pronounce?: Pronounce[];
  /** Voice to use for the language. String format: `<engine id>.<voice id>`. */
  voice?: string | SWMLVar;
  [key: string]:
    | Record<string, unknown>
    | {
        description?: string;
        active?: boolean | number | string;
        argument?: FunctionParameters;
        data_map?: DataMap;
        fillers?: {
          default?: unknown;
          auto?: unknown;
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
      }[]
    | SWAIG
    | string
    | SWMLVar
    | (Hint | string)[]
    | Languages[]
    | {
        allowed?: unknown[];
        engine?: string;
        fillers?:
          | unknown[]
          | {
              default?: unknown;
              auto?: unknown;
            };
        function_fillers?:
          | unknown[]
          | {
              default?: unknown;
              auto?: unknown;
            };
        languages?: unknown[];
        min_switch_words?: number;
        model?: string;
        provider?: string;
        start_language?: string;
        turn_fillers?:
          | unknown[]
          | {
              default?: unknown;
            };
      }
    | AIParams
    | AIPostPrompt
    | AIPrompt
    | Pronounce[]
    | undefined;
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

/** The final set of instructions and configuration settings to send to the agent. */
export interface AIPostPrompt {
  frequency_penalty?: unknown;
  max_completion_tokens?: number;
  max_tokens?: number;
  model?: string;
  pom?: POM[];
  presence_penalty?: unknown;
  reasoning_effort?: string;
  temperature?: number;
  text?: string;
  top_p?: number;
  verbosity?: string;
}

/** The final set of instructions and configuration settings to send to the agent. */
export interface AIPostPromptPom {
  frequency_penalty?: unknown;
  max_completion_tokens?: number;
  max_tokens?: number;
  model?: string;
  pom?: POM[];
  presence_penalty?: unknown;
  reasoning_effort?: string;
  temperature?: number;
  text?: string;
  top_p?: number;
  verbosity?: string;
}

/** The final set of instructions and configuration settings to send to the agent. */
export interface AIPostPromptText {
  frequency_penalty?: unknown;
  max_completion_tokens?: number;
  max_tokens?: number;
  model?: string;
  pom?: POM[];
  presence_penalty?: unknown;
  reasoning_effort?: string;
  temperature?: number;
  text?: string;
  top_p?: number;
  verbosity?: string;
}

/** Defines the AI agent's personality, goals, behaviors, and instructions for handling conversations. */
export interface AIPrompt {
  contexts?: Contexts;
  frequency_penalty?: unknown;
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
  presence_penalty?: unknown;
  reasoning_effort?: string;
  steps?: Step[];
  temperature?: number;
  text?: string;
  top_p?: number;
  verbosity?: string;
}

/** Defines the AI agent's personality, goals, behaviors, and instructions for handling conversations. */
export interface AIPromptPom {
  contexts?: Contexts;
  frequency_penalty?: unknown;
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
  presence_penalty?: unknown;
  reasoning_effort?: string;
  steps?: Step[];
  temperature?: number;
  text?: string;
  top_p?: number;
  verbosity?: string;
}

/** Defines the AI agent's personality, goals, behaviors, and instructions for handling conversations. */
export interface AIPromptText {
  contexts?: Contexts;
  frequency_penalty?: unknown;
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
  presence_penalty?: unknown;
  reasoning_effort?: string;
  steps?: Step[];
  temperature?: number;
  text?: string;
  top_p?: number;
  verbosity?: string;
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
        voice?: unknown;
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

export interface AllOfProperty {
  /** An array of schemas where all of the schemas must be valid. */
  allOf: SchemaType[];
}

export interface AmazonBedrock {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  amazon_bedrock: AmazonBedrockObject | unknown[] | number | string;
  [key: string]: Record<string, unknown> | AmazonBedrockObject | unknown[] | number | string;
}

/** Creates a new Bedrock AI Agent */
export interface AmazonBedrockObject {
  SWAIG?: BedrockSWAIG;
  app_name?: string;
  assistant_name?: string;
  assistant_prompt?: string;
  conversation_id?: string;
  /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script */
  global_data?: Record<string, unknown>;
  greeting_prompt?: {
    role?: string;
    text?: string;
  };
  params?: BedrockParams;
  post_prompt?: BedrockPostPrompt;
  /** The URL to which to send status callbacks and reports. Authentication can also be set in the url in the format of `username:password@url`. */
  post_prompt_url?: string;
  prompt?: BedrockPrompt;
  transcript_webhook_url?: string;
  [key: string]:
    | Record<string, unknown>
    | BedrockSWAIG
    | string
    | {
        role?: string;
        text?: string;
      }
    | BedrockParams
    | BedrockPostPrompt
    | BedrockPrompt
    | undefined;
}

export interface Answer {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  answer:
    | {
        /** Comma-separated string of codecs to offer. Valid codecs are: PCMU, PCMA, G722, G729, AMR-WB, OPUS, VP8, H264. */
        codecs?:
          | string
          | ('PCMU' | 'PCMA' | 'OPUS' | 'G722' | 'G729' | 'AMR-WB' | 'VP8' | 'H264')[]
          | SWMLVar;
        /** Maximum duration in seconds for the call. Defaults to `14400` seconds (4 hours). */
        max_duration?: number | SWMLVar;
        /** Password to use for SIP authentication. */
        password?: string | SWMLVar;
        /** Username to use for SIP authentication. */
        username?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | ('PCMU' | 'PCMA' | 'OPUS' | 'G722' | 'G729' | 'AMR-WB' | 'VP8' | 'H264')[]
          | SWMLVar
          | number
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | (number | SWMLVar)[]
    | (number & (number | SWMLVar))
    | (string & (number | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** Comma-separated string of codecs to offer. Valid codecs are: PCMU, PCMA, G722, G729, AMR-WB, OPUS, VP8, H264. */
        codecs?:
          | string
          | ('PCMU' | 'PCMA' | 'OPUS' | 'G722' | 'G729' | 'AMR-WB' | 'VP8' | 'H264')[]
          | SWMLVar;
        /** Maximum duration in seconds for the call. Defaults to `14400` seconds (4 hours). */
        max_duration?: number | SWMLVar;
        /** Password to use for SIP authentication. */
        password?: string | SWMLVar;
        /** Username to use for SIP authentication. */
        username?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | ('PCMU' | 'PCMA' | 'OPUS' | 'G722' | 'G729' | 'AMR-WB' | 'VP8' | 'H264')[]
          | SWMLVar
          | number
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | (number | SWMLVar)[]
    | (number & (number | SWMLVar))
    | (string & (number | SWMLVar));
}

export interface AnyOfProperty {
  /** An array of schemas where at least one of the schemas must be valid. */
  anyOf: SchemaType[];
}

/** Base interface for all property types */
export interface ArrayProperty {
  /** A description of the property. */
  description?: string;
  /** Whether the property can be null. */
  nullable?: boolean | SWMLVar;
  /** The type of parameter(s) the AI is passing to the function. */
  type: 'array';
  /** The default array value */
  default?: unknown[];
  /** Schema for array items */
  items: SchemaType;
}

export type AttentionTimeout = number;

/** A JSON object containing parameters as key-value pairs. */
export interface BedrockParams {
  /** Effective range 1000..60000 (0 is also accepted). A value outside it is ignored by the engine rather than rejected. */
  attention_timeout?: number | string;
  compact_conversation_time?: string;
  compact_strategy?: string;
  /** The default applies only when `hard_stop_time` enables it; otherwise the value stays unset. */
  hard_stop_prompt?: string;
  hard_stop_time?: string;
  /** Effective range 10000..3600000 (0 is also accepted). A value outside it is ignored by the engine rather than rejected. */
  inactivity_timeout?: number | string;
  video_idle_file?: string;
  video_listening_file?: string;
  video_talking_file?: string;
}

/** The final set of instructions and configuration settings to send to the agent. */
export interface BedrockPostPrompt {
  pom?: {
    title?: string;
    body?: string;
    bullets?: unknown[];
    numbered?: boolean;
    numberedBullets?: boolean;
    subsections?: unknown[];
  }[];
  text?: string;
}

/** Establishes the initial set of instructions and settings to configure the agent. */
export interface BedrockPrompt {
  pom?: {
    title?: string;
    body?: string;
    bullets?: unknown[];
    numbered?: boolean;
    numberedBullets?: boolean;
    subsections?: unknown[];
  }[];
  temperature?: number | string;
  text?: string;
  top_p?: number | string;
  voice_id?: string;
}

/** An object holding the user-defined functions/endpoints that can be executed during the dialogue. The engine reads two keys off it: `functions`, the array of function definitions, and `defaults`, an object of settings applied to each of them. */
export interface BedrockSWAIG {
  defaults?: {
    web_hook_url?: string;
  };
  functions?: BedrockSWAIGFunction[];
}

/** Without `description` and `function`, `SWAIG` (checked only where amazon_bedrock discards the result) has no effect: it is accepted and ignored, not rejected. */
export interface BedrockSWAIGFunction {
  description?: string;
  data_map?: DataMap;
  function?: string;
  meta_data?: Record<string, unknown>;
  meta_data_token?: string;
  parameters?: JsonSchema;
  web_hook_url?: string;
}

/** Base interface for all property types */
export interface BooleanProperty {
  /** A description of the property. */
  description?: string;
  /** Whether the property can be null. */
  nullable?: boolean | SWMLVar;
  /** The type of parameter(s) the AI is passing to the function. */
  type: 'boolean';
  /** The default boolean value */
  default?: boolean | SWMLVar;
}

export interface CallAIMessageRequest {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The `calling.ai_message` command is used to inject a message into the AI conversation. */
  command: 'calling.ai_message';
  /** An object of parameters that will be utilized by the active command. */
  params?: {
    /** Arbitrary JSON data to merge into the AI session's global data store. */
    global_data?: Record<string, unknown>;
    /** The text content that will be sent to the AI. Required when `reset` is not provided. */
    message_text?: string;
    /** Parameters for resetting the AI conversation state. When provided, `role` and `message_text` are optional. */
    reset?: RelayIsReset;
    /** The role that the message is from. Required when `reset` is not provided. Each role type has a different purpose and will influence how the AI will interpret the message. */
    role?: string;
  };
}

/** Parameters for resetting the AI conversation state. */
export interface CallAIMessageResetParams {
  /** Whether to perform a full reset of the AI conversation, clearing all history. */
  full_reset?: boolean;
  /** A new user prompt to set after resetting the conversation. */
  user_prompt?: string;
  /** A new system prompt to set after resetting the conversation. */
  system_prompt?: string;
}

/** The request contains invalid parameters. See errors for details. */
export interface CallCreate422Error {
  /** List of validation errors. */
  errors: Types_StatusCodes_RestApiErrorItem[];
}

export interface CallCreateParamsSWML {
  /** The address that initiated the call. Can be either a E.164 formatted number (`+xxxxxxxxxxx`), or a SIP endpoint (`sip:xxx@yyy.zzz`). */
  from: string;
  /** The address that received the call. Can be either a E.164 formatted number (`+xxxxxxxxxxx`), or a SIP endpoint (`sip:xxx@yyy.zzz`). */
  to?: string;
  /** The number, in E.164 format, or identifier of the caller. */
  caller_id?: string;
  /** The Fallback URL to handle the call. This parameter allows you to specify a backup webhook or different route in your code containing SWML instructions for handling the call. */
  fallback_url?: string;
  /** A URL that will recieve status updates of the current call. Any call events defined in `status_events` will be delivered to the defined URL. */
  status_url?: string;
  /** The call events that will be monitored and sent to the `status_url` when active. */
  status_events?: ('answered' | 'queued' | 'initiated' | 'ringing' | 'ending' | 'ended')[];
  /** The HTTP method to use when requesting the URL. */
  url_method?: string;
  /** A list of codecs to use for the call. Can be an array of codec strings or a comma-separated string. Valid codecs are: `PCMU`, `PCMA`, `G722`, `G729`, `OPUS`, `VP8`, `H264`. For PSTN calls, `PCMA` and `PCMU` are recommended as many other codecs are not supported by PSTN gateways. If a SIP URI with included codecs is passed in the `to` field along with this parameter, the SIP URI codecs will be prioritized. */
  codecs?: string[] | string;
  /** SWML to run on the destination leg, instead of dialing `to`. Either an SWML document (object, or a JSON/YAML string) or an `http(s)` URL that returns SWML. When set, `to` may be omitted. */
  to_script?: string | Record<string, unknown>;
  /** Time, in seconds, to wait for the call to be answered. */
  timeout?: number;
  /** The maximum price, in USD, per minute that the call may cost. The call is rejected if the route costs more. */
  max_price_per_minute?: number;
  /** DTMF digits to send once the call is answered (`0-9`, `A-D`, `*`, `#`, `w` for wait, `,` for pause), at most 98 characters. */
  send_digits?: string;
  /** The region, or ordered list of regions, to originate the call from. Values must be regions available to the project; defaults to the project's region preference. */
  region?: string | string[];
  /** SIP authentication username, used when the destination is a SIP endpoint. */
  username?: string;
  /** SIP authentication password, used when the destination is a SIP endpoint. */
  password?: string;
  /** Custom SIP headers to send on the outbound leg (at most 20). */
  headers?: {
    /** Header name (an HTTP token). `identity` and `x-projectid` are reserved. */
    name: string;
    /** Header value, at most 1024 bytes, without CR, LF or NUL characters. */
    value: string;
  }[];
  /** Variables to set on the call, readable from SWML as `${envs.<name>}` (at most 20). Names must be valid SWML variable names and may not start with `signalwire_`, `sw_`, `rtc_` or `internal_`; values are non-empty strings of at most 1024 bytes. */
  custom_variables?: Record<string, string>;
  /** Inline SWML object containing SWML instructions for handling the call. Either `url` or `swml` must be included for a new call. */
  swml:
    | string
    | {
        sections: Section;
        version?: '1.0.0';
        [key: string]: Record<string, unknown> | Section | '1.0.0' | undefined;
      };
}

export interface CallCreateParamsURL {
  /** The address that initiated the call. Can be either a E.164 formatted number (`+xxxxxxxxxxx`), or a SIP endpoint (`sip:xxx@yyy.zzz`). */
  from: string;
  /** The address that received the call. Can be either a E.164 formatted number (`+xxxxxxxxxxx`), or a SIP endpoint (`sip:xxx@yyy.zzz`). */
  to?: string;
  /** The number, in E.164 format, or identifier of the caller. */
  caller_id?: string;
  /** The Fallback URL to handle the call. This parameter allows you to specify a backup webhook or different route in your code containing SWML instructions for handling the call. */
  fallback_url?: string;
  /** A URL that will recieve status updates of the current call. Any call events defined in `status_events` will be delivered to the defined URL. */
  status_url?: string;
  /** The call events that will be monitored and sent to the `status_url` when active. */
  status_events?: ('answered' | 'queued' | 'initiated' | 'ringing' | 'ending' | 'ended')[];
  /** The HTTP method to use when requesting the URL. */
  url_method?: string;
  /** A list of codecs to use for the call. Can be an array of codec strings or a comma-separated string. Valid codecs are: `PCMU`, `PCMA`, `G722`, `G729`, `OPUS`, `VP8`, `H264`. For PSTN calls, `PCMA` and `PCMU` are recommended as many other codecs are not supported by PSTN gateways. If a SIP URI with included codecs is passed in the `to` field along with this parameter, the SIP URI codecs will be prioritized. */
  codecs?: string[] | string;
  /** SWML to run on the destination leg, instead of dialing `to`. Either an SWML document (object, or a JSON/YAML string) or an `http(s)` URL that returns SWML. When set, `to` may be omitted. */
  to_script?: string | Record<string, unknown>;
  /** Time, in seconds, to wait for the call to be answered. */
  timeout?: number;
  /** The maximum price, in USD, per minute that the call may cost. The call is rejected if the route costs more. */
  max_price_per_minute?: number;
  /** DTMF digits to send once the call is answered (`0-9`, `A-D`, `*`, `#`, `w` for wait, `,` for pause), at most 98 characters. */
  send_digits?: string;
  /** The region, or ordered list of regions, to originate the call from. Values must be regions available to the project; defaults to the project's region preference. */
  region?: string | string[];
  /** SIP authentication username, used when the destination is a SIP endpoint. */
  username?: string;
  /** SIP authentication password, used when the destination is a SIP endpoint. */
  password?: string;
  /** Custom SIP headers to send on the outbound leg (at most 20). */
  headers?: {
    /** Header name (an HTTP token). `identity` and `x-projectid` are reserved. */
    name: string;
    /** Header value, at most 1024 bytes, without CR, LF or NUL characters. */
    value: string;
  }[];
  /** Variables to set on the call, readable from SWML as `${envs.<name>}` (at most 20). Names must be valid SWML variable names and may not start with `signalwire_`, `sw_`, `rtc_` or `internal_`; values are non-empty strings of at most 1024 bytes. */
  custom_variables?: Record<string, string>;
  /** The URL to handle the call. This parameter allows you to specify a webhook or different route in your code containing SWML instructions for handling the call. */
  url: string;
}

export interface CallCreateRequest {
  /** The `dial` command is used to create a new call. */
  command: 'dial';
  /** An object of parameters that will be utilized by the active command. */
  params: CallCreateParamsURL | CallCreateParamsSWML;
}

/** The direction of the call. */
export type CallDirection = 'inbound' | 'outbound' | 'outbound-api';

export interface CallHangupRequest {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The `calling.end` command is used to hang up a call. */
  command: 'calling.end';
  /** An object of parameters that will be utilized by the active command. */
  params?: {
    /** Set the reason why the call was hung up. */
    reason?: 'hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error';
  };
}

export interface CallHoldRequest {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The `calling.ai_hold` command is used to hold a call. */
  command: 'calling.ai_hold';
  /** An object of parameters that will be utilized by the active command. */
  params?: {
    /** A system message added to the AI conversation before placing the caller on hold. */
    prompt?: string;
    /** The duration to hold the caller in seconds. */
    timeout?: string | number;
  };
}

/** A Call leg (PSTN, SIP, or WebRTC). */
export interface CallLeg {
  /** The unique identifier of the call on SignalWire. This can be used to update the call programmatically. */
  id: uuid;
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
  /** Media quality metrics reported for the call once it has ended. `null` until metrics are available (always `null` in the response to a new dial). */
  qos_metrics?: {
    audio_in_media_packet_count?: unknown;
    audio_in_dtmf_packet_count?: unknown;
    audio_in_flaw_total?: unknown;
    audio_in_quality_percentage?: unknown;
    audio_in_mean_interval?: unknown;
    audio_out_media_packet_count?: unknown;
    audio_in_skip_packet_count?: unknown;
    audio_in_flush_packet_count?: unknown;
    audio_in_largest_jb_size?: unknown;
    audio_in_jitter_min_variance?: unknown;
    audio_in_jitter_max_variance?: unknown;
    audio_out_dtmf_packet_count?: unknown;
    audio_rtt_avg?: unknown;
    audio_rtt_min?: unknown;
    audio_rtt_max?: unknown;
    audio_out_jitter_min?: unknown;
    audio_out_jitter_max?: unknown;
    audio_out_jitter_avg?: unknown;
    audio_out_lost?: unknown;
    audio_in_mos?: unknown;
  } | null;
  /** The parent call ID if this is a child call. */
  parent_id: uuid | null;
}

export interface CallLiveTranscribeRequest {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The `calling.live_transcribe` command is used to control live transcription on an active call. */
  command: 'calling.live_transcribe';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The transcription action to perform: start, stop, or summarize. */
    action:
      | 'start'
      | 'stop'
      | 'summarize'
      | {
          start?: {
            ai_summary?: boolean;
            ai_summary_prompt?: string;
            debug_level?: number;
            deepgram_key_override?: string;
            deepgram_url_override?: string;
            direction: ('local-caller' | 'remote-caller')[];
            hints?: string[];
            lang: string;
            live_events?: boolean;
            speech_engine?: 'deepgram' | 'google';
            speech_timeout?: number;
            vad_silence_ms?: number;
            vad_thresh?: number;
            verbose_utterances?: boolean;
            webhook?: string;
          };
          stop?: unknown;
          summarize?: {
            ai_model?: string;
            prompt?: string;
            summary_prompt?: string;
            webhook?: string;
          };
        };
    hints?: unknown[];
  };
}

export interface CallLiveTranslateRequest {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The `calling.live_translate` command is used to control live translation on an active call. */
  command: 'calling.live_translate';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The translation action to perform: start, stop, summarize, or inject. */
    action:
      | 'start'
      | 'stop'
      | 'summarize'
      | 'inject'
      | {
          inject?: {
            direction: 'local-caller' | 'remote-caller';
            message: string;
          };
          start?: {
            ai_summary?: boolean;
            ai_summary_prompt?: string;
            debug_level?: number;
            deepgram_key_override?: string;
            deepgram_url_override?: string;
            direction: ('local-caller' | 'remote-caller')[];
            filter_from?: string;
            filter_to?: string;
            from_lang: string;
            from_voice?: string;
            from_voice_params?: Record<string, boolean | number | string>;
            live_events?: boolean;
            mode?: string;
            speech_engine?: 'deepgram' | 'google';
            speech_timeout?: number;
            to_lang: string;
            to_voice?: string;
            to_voice_params?: Record<string, boolean | number | string>;
            translation_model?: string;
            translation_model_params?: Record<string, unknown>;
            vad_silence_ms?: number;
            vad_thresh?: number;
            webhook?: string;
          };
          stop?: unknown;
          summarize?: {
            prompt?: string;
            summary_prompt?: string;
            webhook?: string;
          };
        };
    /** A URL to receive status update callbacks for the translation session. */
    status_url?: string;
  };
}

/** Call request union for JSON-RPC style method dispatch. Use the `command` field to specify which call method to invoke. */
export type CallRequest =
  | CallCreateRequest
  | CallUpdateCurrentCallRequest
  | CallHangupRequest
  | CallHoldRequest
  | CallUnholdRequest
  | CallAIMessageRequest
  | CallLiveTranscribeRequest
  | CallLiveTranslateRequest
  | CallTransferRequest
  | CallUserEventRequest
  | CallDisconnectRequest
  | CallPlayRequest
  | CallPlayPauseRequest
  | CallPlayResumeRequest
  | CallPlayStopRequest
  | CallPlayVolumeRequest
  | CallRecordRequest
  | CallRecordPauseRequest
  | CallRecordResumeRequest
  | CallRecordStopRequest
  | CallCollectRequest
  | CallCollectStopRequest
  | CallCollectStartInputTimersRequest
  | CallDetectRequest
  | CallDetectStopRequest
  | CallTapRequest
  | CallTapStopRequest
  | CallStreamRequest
  | CallStreamStopRequest
  | CallDenoiseRequest
  | CallDenoiseStopRequest
  | CallTranscribeRequest
  | CallTranscribeStopRequest
  | CallAIStopRequest
  | CallAISidecarRequest
  | CallAISidecarAskRequest
  | CallAISidecarPokeRequest
  | CallAISidecarStopRequest
  | CallAISidecarStatusRequest
  | CallSendFaxStopRequest
  | CallReceiveFaxStopRequest
  | CallReferRequest;

export interface CallDisconnectRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.disconnect` command disconnects bridged calls without hanging up either leg. */
  command: 'calling.disconnect';
  /** An object of parameters that will be utilized by the active command. */
  params?: Record<string, unknown>;
}

export interface CallPlayRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.play` command plays audio, TTS, silence, or ringtone to a call. */
  command: 'calling.play';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Unique identifier for this play operation. */
    control_id: string;
    /** Which leg of the call to play to. */
    direction?: 'listen' | 'speak' | 'both';
    gender?: 'male' | 'female';
    language?: string;
    /** Number of times to loop. 0 means infinite. */
    loop?: number;
    /** Array of media objects to play. */
    play: RelayCallPlayInner[];
    /** Webhook URL for play state events. */
    status_url?: string;
    voice?: string;
    /** Volume adjustment in dB. 0 is default. */
    volume?: number;
  };
}

export interface CallPlayPauseRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.play.pause` command pauses an active play operation. */
  command: 'calling.play.pause';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the play operation to pause. */
    control_id: string;
  };
}

export interface CallPlayResumeRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.play.resume` command resumes a paused play operation. */
  command: 'calling.play.resume';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the play operation to resume. */
    control_id: string;
  };
}

export interface CallPlayStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.play.stop` command stops an active play operation. */
  command: 'calling.play.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the play operation to stop. */
    control_id: string;
  };
}

export interface CallPlayVolumeRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.play.volume` command adjusts the volume of an active play operation. */
  command: 'calling.play.volume';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the play operation. */
    control_id: string;
    /** Volume adjustment in dB. */
    volume: number;
  };
}

export interface CallRecordRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.record` command starts recording a call. Supports parallel recordings via multiple control_ids. */
  command: 'calling.record';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Unique identifier for this recording. */
    control_id: string;
    /** What to record. */
    record: RelayCallRecordInner;
    /** Webhook URL for recording state events. */
    status_url?: string;
  };
}

export interface CallRecordPauseRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.record.pause` command pauses an active recording. */
  command: 'calling.record.pause';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    behavior?: 'skip' | 'silence';
    /** The control_id of the recording to pause. */
    control_id: string;
  };
}

export interface CallRecordResumeRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.record.resume` command resumes a paused recording. */
  command: 'calling.record.resume';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the recording to resume. */
    control_id: string;
  };
}

export interface CallRecordStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.record.stop` command stops an active recording. */
  command: 'calling.record.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the recording to stop. */
    control_id: string;
  };
}

export interface CallCollectRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.collect` command collects DTMF or speech input from a call. */
  command: 'calling.collect';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    continue?: boolean;
    /** Keep collecting after each result. */
    continuous?: boolean;
    /** Unique identifier for this collect operation. */
    control_id: string;
    /** DTMF digit collection parameters. */
    digits?: RelayCallCollectDigitsInner;
    /** Seconds to wait for first input before timeout. */
    initial_timeout?: number;
    /** Deliver partial recognition results. */
    partial_results?: boolean;
    send_start_of_input?: boolean;
    /** Speech recognition parameters. */
    speech?: RelayCallCollectSpeechInner;
    start_input_timers?: boolean;
    status_url?: string;
  };
}

export interface CallCollectStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.collect.stop` command stops an active input collection. */
  command: 'calling.collect.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the collect operation to stop. */
    control_id: string;
  };
}

export interface CallCollectStartInputTimersRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.collect.start_input_timers` command starts input timers on an active collect operation. */
  command: 'calling.collect.start_input_timers';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the collect operation. */
    control_id: string;
  };
}

export interface CallDetectRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.detect` command starts a detector (answering machine, fax, or digit). */
  command: 'calling.detect';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Unique identifier for this detect operation. */
    control_id: string;
    /** Detection configuration. */
    detect: RelayCallDetectInner;
    status_url?: string;
    /** Overall timeout in seconds for the detect operation. */
    timeout?: number;
  };
}

export interface CallDetectStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.detect.stop` command stops an active detector. */
  command: 'calling.detect.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the detect operation to stop. */
    control_id: string;
  };
}

export interface CallTapRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.tap` command taps call audio to an RTP or WebSocket endpoint. */
  command: 'calling.tap';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Unique identifier for this tap operation. */
    control_id: string;
    /** Target device to send tapped audio to. */
    device: RelayCallTapDevice;
    status_url?: string;
    /** What to tap. */
    tap: RelayTap;
  };
}

export interface CallTapStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.tap.stop` command stops an active tap. */
  command: 'calling.tap.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the tap operation to stop. */
    control_id: string;
  };
}

export interface CallStreamRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.stream` command streams call audio to a WebSocket endpoint. */
  command: 'calling.stream';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Bearer token sent in the WebSocket handshake. */
    authorization_bearer_token?: string;
    /** Audio codec for the stream. */
    codec?: string;
    /** Unique identifier for this stream operation. */
    control_id: string;
    /** Custom key-value pairs sent with the stream. */
    custom_parameters?: Record<string, unknown>;
    name?: string;
    status_url?: string;
    status_url_method?: 'GET' | 'POST';
    /** Which audio track(s) to stream. */
    track?: 'inbound_track' | 'outbound_track' | 'both_tracks';
    /** WebSocket URL (wss://) to stream audio to. */
    url: string;
  };
}

export interface CallStreamStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.stream.stop` command stops an active audio stream. */
  command: 'calling.stream.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the stream to stop. */
    control_id: string;
  };
}

export interface CallDenoiseRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.denoise` command starts noise reduction on a call. */
  command: 'calling.denoise';
  /** An object of parameters that will be utilized by the active command. */
  params?: Record<string, unknown>;
}

export interface CallDenoiseStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.denoise.stop` command stops noise reduction on a call. */
  command: 'calling.denoise.stop';
  /** An object of parameters that will be utilized by the active command. */
  params?: Record<string, unknown>;
}

export interface CallTranscribeRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.transcribe` command starts call transcription. Only one active transcription per call. */
  command: 'calling.transcribe';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Unique identifier for this transcription. */
    control_id: string;
    /** Webhook URL for transcription results. */
    status_url?: string;
  };
}

export interface CallTranscribeStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.transcribe.stop` command stops active transcription. */
  command: 'calling.transcribe.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the transcription to stop. */
    control_id: string;
  };
}

export interface CallAIStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.ai.stop` command stops an active AI session on a call. */
  command: 'calling.ai.stop';
  /** An object of parameters that will be utilized by the active command. */
  params?: {
    /** The control_id of the AI session to stop. */
    control_id?: string;
  };
}

export interface CallAISidecarRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.ai_sidecar` command starts an AI sidecar on a call, which runs live transcription with an LLM, SWAIG and MCP loop on top and advises without taking over the call. */
  command: 'calling.ai_sidecar';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    SWAIG?: Record<string, unknown>;
    action?: Record<string, unknown>;
    customer_role?: 'remote-caller' | 'local-caller';
    direction?: ('remote-caller' | 'local-caller')[];
    global_data?: Record<string, unknown>;
    hints?: string[];
    lang: string;
    model?: string;
    params?: {
      act_on_channel?: boolean;
      ai_summary?: boolean;
      ai_summary_prompt?: string;
      debug?: boolean;
      debug_level?: number;
      deepgram_key_override?: string;
      deepgram_url_override?: string;
      final_summary?: boolean;
      idle_timeout_ms?: number;
      live_events?: boolean;
      max_history_tokens?: number;
      max_iters_per_tick?: number;
      min_interval_ms?: number;
      speech_engine?: 'deepgram' | 'google';
      speech_timeout?: number;
      summary_model?: string;
      transcribe_prompt?: string;
      vad_silence_ms?: number;
      vad_thresh?: number;
      verbose_utterances?: boolean;
    };
    permissions?: Record<string, unknown>;
    prompt?: Record<string, unknown> | string;
    url?: string;
  };
}

export interface CallAISidecarAskRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.ai_sidecar.ask` command queues a question for the call's active AI sidecar. */
  command: 'calling.ai_sidecar.ask';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    text: string;
  };
}

export interface CallAISidecarPokeRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.ai_sidecar.poke` command sends text to the call's active AI sidecar. */
  command: 'calling.ai_sidecar.poke';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    text: string;
  };
}

export interface CallAISidecarStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.ai_sidecar.stop` command stops the call's active AI sidecar. */
  command: 'calling.ai_sidecar.stop';
  /** An object of parameters that will be utilized by the active command. */
  params?: Record<string, unknown>;
}

export interface CallAISidecarStatusRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.ai_sidecar.status` command reports the state of the call's AI sidecar. */
  command: 'calling.ai_sidecar.status';
  /** An object of parameters that will be utilized by the active command. */
  params?: Record<string, unknown>;
}

export interface CallSendFaxStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.send_fax.stop` command stops an active fax send operation. */
  command: 'calling.send_fax.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the fax send to stop. */
    control_id: string;
  };
}

export interface CallReceiveFaxStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.receive_fax.stop` command stops an active fax receive operation. */
  command: 'calling.receive_fax.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The control_id of the fax receive to stop. */
    control_id: string;
  };
}

export interface CallReferRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.refer` command transfers a SIP call via SIP REFER. */
  command: 'calling.refer';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Target device for the REFER. */
    device: RelayCallReferDevice;
    /** Webhook URL for REFER state events. */
    status_url?: string;
  };
}

/** The response varies based on the type of call. A standard call returns a Call Leg, while a Fabric subscriber call returns a Fabric Device Leg. */
export type CallResponse = CallLeg | FabricDeviceLeg | VideoRoomCallLeg | DialogflowCallLeg;

/** A PSTN or SIP leg joined to a video room. */
export interface VideoRoomCallLeg {
  /** The unique identifier of the call on SignalWire. */
  id: uuid;
  /** The origin number or address. */
  from: string | null;
  /** The destination number or address. */
  to: string | null;
  /** The direction of the call. */
  direction: string | null;
  /** Source of this call. */
  source: 'realtime_api';
  /** Always null for video room legs. */
  url: null;
  /** Total charge for this call. */
  charge: number;
  /** The date and time when the call was created. */
  created_at: string;
  /** Details on charges associated with this call. */
  charge_details: ChargeDetails[];
  /** The status of the call. */
  status: string | null;
  /** The duration of the call in seconds. */
  duration: number | null;
  /** The duration of the call in milliseconds. */
  duration_ms: number | null;
  /** Type of this call. */
  type: 'video_room_pstn_leg' | 'video_room_sip_leg';
}

/** A Dialogflow call. */
export interface DialogflowCallLeg {
  /** The unique identifier of the call on SignalWire. */
  id: uuid;
  /** The origin number or address. */
  from: string | null;
  /** The destination number or address. */
  to: string | null;
  /** Source of this call. */
  source: 'dialogflow';
  /** Always null for Dialogflow calls. */
  url: null;
  /** Total charge for this call. */
  charge: number;
  /** The date and time when the call was created. */
  created_at: string;
  /** Details on charges associated with this call. */
  charge_details: ChargeDetails[];
  /** The status of the call. */
  status: string | null;
  /** The duration of the call in seconds. */
  duration: number | null;
  /** Type of this call. */
  type: 'dialogflow_call';
}

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

export type CallStatus = string;

export interface CallTransferRequest {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The `calling.transfer` command is used to transfer an active call to a new destination. */
  command: 'calling.transfer';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The destination to transfer the call to. Can be a SIP URI, phone number, or an inline SWML object. */
    dest: string | SWMLObject;
  };
}

export interface CallUnholdRequest {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The `calling.ai_unhold` command is used to unhold a call. */
  command: 'calling.ai_unhold';
  /** An object of parameters that will be utilized by the active command. */
  params?: {
    /** A system message added to the AI conversation when taking the caller off hold. */
    prompt?: string;
  };
}

export interface CallUpdateCurrentCallRequest {
  /** The `update` command is used to update a existing call with a new dialplan. */
  command: 'update';
  /** An object of parameters that will be utilized by the active command. */
  params: CallUpdateParamsURL | CallUpdateParamsSWML;
}

export interface CallUpdateParamsSWML {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The Fallback URL to handle the call. */
  fallback_url?: string;
  /** Either `canceled` (to cancel a not yet connected call) or `completed` (to end a call that is in progress). */
  status?: 'canceled' | 'completed';
  /** A URL to receive call status update callbacks. */
  status_url?: string;
  /** Inline SWML object containing SWML instructions for handling the call. Either `url` or `swml` must be included for a new call. */
  swml?:
    | string
    | {
        sections: Section;
        version?: '1.0.0';
        [key: string]: Record<string, unknown> | Section | '1.0.0' | undefined;
      };
}

export interface CallUpdateParamsURL {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The Fallback URL to handle the call. */
  fallback_url?: string;
  /** Either `canceled` (to cancel a not yet connected call) or `completed` (to end a call that is in progress). */
  status?: 'canceled' | 'completed';
  /** A URL to receive call status update callbacks. */
  status_url?: string;
  /** The URL to handle the call. This parameter allows you to specify a webhook or different route in your code containing SWML instructions for handling the call. */
  url?: string;
}

export interface CallUserEventRequest {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The `calling.user_event` command is used to fire a custom user event on the call. */
  command: 'calling.user_event';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Arbitrary JSON event data to fire on the call. */
    event: Record<string, unknown>;
  };
}

export interface ChangeContextAction {
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
        voice?: unknown;
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

export interface ChangeStepAction {
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
        voice?: unknown;
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

export interface ChargeDetails {
  /** Description for this charge. */
  description: string;
  /** Charged amount. */
  charge: number;
}

export interface Cond {
  /** Body shape enforced by is_valid_cond_method, swml_schema.c:1271. */
  cond: CondParams[];
  [key: string]: Record<string, unknown> | CondParams[];
}

export interface CondElse {
  else?: SWMLMethod[];
  then?: SWMLMethod[];
  when?: string;
  [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
}

export interface CondParams {
  else?: SWMLMethod[];
  then?: SWMLMethod[];
  when?: string;
  [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
}

export interface CondReg {
  else?: SWMLMethod[];
  then?: SWMLMethod[];
  when?: string;
  [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
}

export interface Connect {
  connect: ConnectDeviceSingle;
  [key: string]: Record<string, unknown> | ConnectDeviceSingle;
}

/** Dial a SIP URI or phone number. */
export type ConnectDeviceParallel = Record<string, unknown>;

/** Dial a SIP URI or phone number. */
export type ConnectDeviceSerial = Record<string, unknown>;

/** Dial a SIP URI or phone number. */
export type ConnectDeviceSerialParallel = Record<string, unknown>;

/** Dial a SIP URI or phone number. */
export type ConnectDeviceSingle = Record<string, unknown>;

export interface ConnectHeaders {
  name: string;
  value: string | SWMLVar;
  [key: string]: Record<string, unknown> | string | string | SWMLVar;
}

/** Execute different instructions based on a variable's value. */
export interface ConnectSwitch {
  /** Array of SWML methods to execute if no `case` matches. If omitted and no case */
  default?:
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: unknown;
        [key: string]: Record<string, unknown> | unknown | undefined;
      };
  /** Map of values to arrays of SWML methods to execute. The key is the value to compare */
  case?: Record<
    string,
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: unknown;
        [key: string]: Record<string, unknown> | unknown | undefined;
      }
  >;
  /** Variable path to match. Specified without the `%{}` wrapper (e.g. `message.body`). */
  variable?: string | SWMLVar;
  [key: string]:
    | Record<string, unknown>
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: unknown;
        [key: string]: Record<string, unknown> | unknown | undefined;
      }
    | Record<
        string,
        | SWMLMethod[]
        | {
            code: Record<string, unknown>;
            meta?: unknown;
            [key: string]: Record<string, unknown> | unknown | undefined;
          }
      >
    | string
    | SWMLVar
    | undefined;
}

export interface ConstProperty {
  /** A constant value that can be passed to the function. */
  const: Record<string, unknown>;
}

export interface ContextPOMSteps {
  /** The name of the step. The name must be unique within the context. The name is used for referencing the step in the context. */
  name: string;
  /** The criteria that must be met for the AI to proceed to the next step. */
  step_criteria?: string;
  /** An array of strings, where each string is the name of a SWAIG.function that can be executed from this step. */
  functions?: string[];
  /** An array of context names that the AI can transition to from this step. This must be a valid `contexts.name` that is present in your `contexts` object. */
  valid_contexts?: string[];
  /** A boolean value, if set to `true`, will skip the user's turn to respond in the conversation and proceed to the next step. **Default:** `false`. */
  skip_user_turn?: boolean | SWMLVar;
  /** A boolean value that determines if the step is the last in the context. If `true`, the context ends after this step. Cannot be used along with the `valid_steps` parameter. **Default:** `false`. */
  end?: boolean;
  /** An array of valid steps that the conversation can proceed to from this step. */
  valid_steps?: string[];
  /** An array of objects that define the POM for the step. POM is the Post-Prompt Object Model, which is used to define the flow of the conversation. */
  pom: POM[];
}

export type ContextSteps = ContextPOMSteps | ContextTextSteps;

export interface ContextSwitchAction {
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
        voice?: unknown;
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

export interface ContextTextSteps {
  /** The name of the step. The name must be unique within the context. The name is used for referencing the step in the context. */
  name: string;
  /** The criteria that must be met for the AI to proceed to the next step. */
  step_criteria?: string;
  /** An array of strings, where each string is the name of a SWAIG.function that can be executed from this step. */
  functions?: string[];
  /** An array of context names that the AI can transition to from this step. This must be a valid `contexts.name` that is present in your `contexts` object. */
  valid_contexts?: string[];
  /** A boolean value, if set to `true`, will skip the user's turn to respond in the conversation and proceed to the next step. **Default:** `false`. */
  skip_user_turn?: boolean | SWMLVar;
  /** A boolean value that determines if the step is the last in the context. If `true`, the context ends after this step. Cannot be used along with the `valid_steps` parameter. **Default:** `false`. */
  end?: boolean;
  /** An array of valid steps that the conversation can proceed to from this step. */
  valid_steps?: string[];
  /** The prompt or instructions given to the AI at this step. */
  text: string;
}

export type Contexts = Record<string, Context>;

export type ContextsObject = ContextsPOMObject | ContextsTextObject;

export interface ContextsPOMObject {
  /** An array of step objects that define the conversation flow for this context. Steps execute sequentially unless otherwise specified. */
  steps: ContextSteps[];
  /** When `true`, resets conversation history to only the system prompt when entering this context. Useful for focused tasks that shouldn't be influenced by previous conversation. **Default:** `false`. */
  isolated?: boolean;
  /** Language-specific filler phrases played when transitioning into this context. Helps provide smooth context switches. */
  enter_fillers?: FunctionFillers[];
  /** Language-specific filler phrases played when leaving this context. Ensures natural transitions out of specialized modes. */
  exit_fillers?: FunctionFillers[];
  /** An array of objects that define the POM for the context. POM is the Post-Prompt Object Model, which is used to define the flow of the conversation. */
  pom?: POM[];
}

export interface ContextsTextObject {
  /** An array of step objects that define the conversation flow for this context. Steps execute sequentially unless otherwise specified. */
  steps: ContextSteps[];
  /** When `true`, resets conversation history to only the system prompt when entering this context. Useful for focused tasks that shouldn't be influenced by previous conversation. **Default:** `false`. */
  isolated?: boolean;
  /** Language-specific filler phrases played when transitioning into this context. Helps provide smooth context switches. */
  enter_fillers?: FunctionFillers[];
  /** Language-specific filler phrases played when leaving this context. Ensures natural transitions out of specialized modes. */
  exit_fillers?: FunctionFillers[];
  /** The text to send to the agent. */
  text?: string;
}

export interface ConversationMessage {
  content?: string;
  lang?: string;
  role?: ConversationRole;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export type ConversationRole = string;

/** Custom translation filter with a prompt prefix. Use `prompt:` followed by your custom instructions (e.g., `prompt:Use formal business language`). */
export type CustomTranslationFilter = string;

export interface DataMap {
  contexts?: unknown[] | boolean | null | number | Record<string, unknown> | string;
  expressions?: Expression[] | Expression;
  output?: Output;
  webhooks?: Webhook[] | Webhook;
}

export interface Denoise {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  denoise:
    | {
        [key: string]: Record<string, unknown>;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        [key: string]: Record<string, unknown>;
      }
    | unknown[]
    | number
    | string;
}

export interface DetectMachine {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  detect_machine:
    | {
        /** If `true`, stops detection on beep / end of voicemail greeting. Default `false`. */
        detect_message_end?: boolean | SWMLVar;
        /** Comma-separated string of detectors to enable. Valid values: `amd`, `fax`. */
        detectors?: string | SWMLVar;
        /** How long to wait for voice to finish. Default `1.0`. */
        end_silence_timeout?: number | SWMLVar;
        /** How long to wait for initial voice before giving up. Default `4.5`. */
        initial_timeout?: number | SWMLVar;
        /** How long to wait for voice to finish before firing READY event. Default is `end_silence_timeout`. */
        machine_ready_timeout?: number | SWMLVar;
        /** The number of seconds of ongoing voice activity required to classify as MACHINE. Default `1.25`. */
        machine_voice_threshold?: number | SWMLVar;
        /** The minimum number of words that must be detected in a single utterance before classifying the call as MACHINE. Default `6`. */
        machine_words_threshold?: number | SWMLVar;
        /** The http(s) URL to deliver detector events to. */
        status_url?: string | SWMLVar;
        /** The max time to run detector. Default `30.0` seconds. */
        timeout?: number | SWMLVar;
        /** The tone to detect, will only receive remote side tone. Default `CED`. */
        tone?: 'CNG' | 'CED' | 'cng' | 'ced' | SWMLVar;
        /** If false, the detector will run asynchronously and status_url must be set. */
        wait?: boolean | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | boolean
          | SWMLVar
          | string
          | SWMLVar
          | number
          | SWMLVar
          | 'CNG'
          | 'CED'
          | 'cng'
          | 'ced'
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** If `true`, stops detection on beep / end of voicemail greeting. Default `false`. */
        detect_message_end?: boolean | SWMLVar;
        /** Comma-separated string of detectors to enable. Valid values: `amd`, `fax`. */
        detectors?: string | SWMLVar;
        /** How long to wait for voice to finish. Default `1.0`. */
        end_silence_timeout?: number | SWMLVar;
        /** How long to wait for initial voice before giving up. Default `4.5`. */
        initial_timeout?: number | SWMLVar;
        /** How long to wait for voice to finish before firing READY event. Default is `end_silence_timeout`. */
        machine_ready_timeout?: number | SWMLVar;
        /** The number of seconds of ongoing voice activity required to classify as MACHINE. Default `1.25`. */
        machine_voice_threshold?: number | SWMLVar;
        /** The minimum number of words that must be detected in a single utterance before classifying the call as MACHINE. Default `6`. */
        machine_words_threshold?: number | SWMLVar;
        /** The http(s) URL to deliver detector events to. */
        status_url?: string | SWMLVar;
        /** The max time to run detector. Default `30.0` seconds. */
        timeout?: number | SWMLVar;
        /** The tone to detect, will only receive remote side tone. Default `CED`. */
        tone?: 'CNG' | 'CED' | 'cng' | 'ced' | SWMLVar;
        /** If false, the detector will run asynchronously and status_url must be set. */
        wait?: boolean | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | boolean
          | SWMLVar
          | string
          | SWMLVar
          | number
          | SWMLVar
          | 'CNG'
          | 'CED'
          | 'cng'
          | 'ced'
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
}

export type Direction = string;

export interface EnterQueue {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  enter_queue: EnterQueueObject | unknown[] | number | string;
  [key: string]: Record<string, unknown> | EnterQueueObject | unknown[] | number | string;
}

/** Place the current call in a named queue where it will wait to be connected to an available agent or resource. */
export interface EnterQueueObject {
  execute_after_queue?: string | SWMLVar;
  /** Name of the queue to enter. If a queue with this name does not exist, it will be automatically created. */
  queue_name: string | SWMLVar;
  /** HTTP or HTTPS URL to deliver queue status events. Default not set */
  status_url?: string | SWMLVar;
  /** Maximum time in seconds to wait in the queue before timeout. Default `180` */
  wait_time?: number | SWMLVar;
  /** URL for media to play while waiting in the queue. Default hold music will be played if not set */
  wait_url?: string | SWMLVar;
  whisper_url?: string | SWMLVar;
  [key: string]: Record<string, unknown> | string | SWMLVar | number | SWMLVar | undefined;
}

export interface Execute {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  execute:
    | {
        /** Name of the section to execute. Must reference a section in the current document. */
        dest: string | SWMLVar;
        /** User-defined metadata, ignored by SignalWire */
        meta?: Record<string, unknown>;
        /** The list of SWML instructions to be executed when the executed section or URL returns */
        on_return?:
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            };
        /** Parameters accessible as `params.*` in the called section. Replaces (does not merge with) any outer `params` from the caller. */
        params?: Record<string, unknown> | SWMLVar;
        /** Action to take based on the result of the call. This will run once the peer leg of the call has ended. */
        result?:
          | {
              else?: SWMLMethod[];
              then?: SWMLMethod[];
              when?: string;
              [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
            }[]
          | ExecuteSwitch;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            }
          | Record<string, unknown>
          | SWMLVar
          | {
              else?: SWMLMethod[];
              then?: SWMLMethod[];
              when?: string;
              [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
            }[]
          | ExecuteSwitch
          | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** Name of the section to execute. Must reference a section in the current document. */
        dest: string | SWMLVar;
        /** User-defined metadata, ignored by SignalWire */
        meta?: Record<string, unknown>;
        /** The list of SWML instructions to be executed when the executed section or URL returns */
        on_return?:
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            };
        /** Parameters accessible as `params.*` in the called section. Replaces (does not merge with) any outer `params` from the caller. */
        params?: Record<string, unknown> | SWMLVar;
        /** Action to take based on the result of the call. This will run once the peer leg of the call has ended. */
        result?:
          | {
              else?: SWMLMethod[];
              then?: SWMLMethod[];
              when?: string;
              [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
            }[]
          | ExecuteSwitch;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            }
          | Record<string, unknown>
          | SWMLVar
          | {
              else?: SWMLMethod[];
              then?: SWMLMethod[];
              when?: string;
              [key: string]: Record<string, unknown> | SWMLMethod[] | string | undefined;
            }[]
          | ExecuteSwitch
          | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

/** Execute different instructions based on a variable's value. */
export interface ExecuteSwitch {
  /** Array of SWML methods to execute if no `case` matches. If omitted and no case */
  default?:
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: unknown;
        [key: string]: Record<string, unknown> | unknown | undefined;
      };
  /** Map of values to arrays of SWML methods to execute. The key is the value to compare */
  case?: Record<
    string,
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: unknown;
        [key: string]: Record<string, unknown> | unknown | undefined;
      }
  >;
  /** Variable path to match. Specified without the `%{}` wrapper (e.g. `message.body`). */
  variable?: string | SWMLVar;
  [key: string]:
    | Record<string, unknown>
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: unknown;
        [key: string]: Record<string, unknown> | unknown | undefined;
      }
    | Record<
        string,
        | SWMLMethod[]
        | {
            code: Record<string, unknown>;
            meta?: unknown;
            [key: string]: Record<string, unknown> | unknown | undefined;
          }
      >
    | string
    | SWMLVar
    | undefined;
}

/** Without one of `expr` / `string` and `output`, a Expression has no effect: it is accepted and ignored, not rejected. */
export interface Expression {
  pattern?: string;
  expr?: string;
  'nomatch-output'?: Output;
  output?: Output;
  string?: string;
}

/** A Fabric subscriber device leg. */
export interface FabricDeviceLeg {
  /** The unique identifier of the call on SignalWire. This can be used to update the call programmatically. */
  id: uuid;
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

export interface FunctionFillers {
  default?: unknown;
  auto?: unknown;
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
  const?: unknown;
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
  default?: unknown;
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
  example?: unknown;
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

export interface Goto {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  goto:
    | {
        /** Label to jump to. Must reference a `label` step in the current section or in a section that encloses it. */
        label: string | SWMLVar;
        /** Maximum number of times this `goto` can jump to its label. Once the limit is reached, */
        max?: number | SWMLVar;
        /** A JavaScript condition that determines whether to perform the jump. If the condition evaluates to true, the jump is executed. If omitted, the jump is unconditional. */
        when?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | number | SWMLVar | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** Label to jump to. Must reference a `label` step in the current section or in a section that encloses it. */
        label: string | SWMLVar;
        /** Maximum number of times this `goto` can jump to its label. Once the limit is reached, */
        max?: number | SWMLVar;
        /** A JavaScript condition that determines whether to perform the jump. If the condition evaluates to true, the jump is executed. If omitted, the jump is unconditional. */
        when?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | number | SWMLVar | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

/** Without one of `data_map` / `web_hook_url`, one of `description` / `purpose` and `function`, the element has no effect: it is accepted and ignored, not rejected. */
export interface HangUpHookSWAIGFunction {
  description?: string;
  active?: boolean | number | string;
  argument?: FunctionParameters;
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
}

export interface Hangup {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  hangup:
    | {
        /** The reason for hanging up the call. */
        reason?: 'hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error' | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'hangup'
          | 'cancel'
          | 'busy'
          | 'noAnswer'
          | 'decline'
          | 'error'
          | SWMLVar
          | undefined;
      }
    | ('hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error' | SWMLVar)[]
    | number
    | (string & ('hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error' | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** The reason for hanging up the call. */
        reason?: 'hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error' | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'hangup'
          | 'cancel'
          | 'busy'
          | 'noAnswer'
          | 'decline'
          | 'error'
          | SWMLVar
          | undefined;
      }
    | ('hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error' | SWMLVar)[]
    | number
    | (string & ('hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error' | SWMLVar));
}

export interface HangupAction {
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
        voice?: unknown;
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

/** The reason for hanging up the call. */
export type HangupReason = 'hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error';

export interface Hint {
  pattern?: string;
  hint?: string;
  ignore_case?: boolean | string;
  replace?: string;
}

export interface HoldAction {
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
        voice?: unknown;
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

export interface InjectAction {
  /** Injects a message into the conversation to be translated and spoken to the specified party. */
  inject: {
    /** The message to be injected */
    message: string;
    /** The direction of the message. */
    direction: TranslateDirection;
  };
}

/** Base interface for all property types */
export interface IntegerProperty {
  /** A description of the property. */
  description?: string;
  /** Whether the property can be null. */
  nullable?: boolean | SWMLVar;
  /** The type of parameter(s) the AI is passing to the function. */
  type: 'integer';
  /** An array of integers that are the possible values */
  enum?: number[];
  /** The default integer value */
  default?: number | SWMLVar;
}

export interface JoinConference {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  join_conference:
    JoinConferenceObject | (string | SWMLVar)[] | number | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | JoinConferenceObject
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

/** Join an ad-hoc audio conference. */
export interface JoinConferenceObject {
  /** Sets the behavior of the beep sound when joining or leaving the conference. Default `\"true\"`. */
  beep?: 'true' | 'false' | 'onEnter' | 'onExit' | SWMLVar;
  /** Coach accepts a call SID of a call that is currently connected to an in-progress conference. */
  coach?: string | SWMLVar;
  emit_call_quality?: boolean | SWMLVar;
  /** Ends the conference when the main participant leaves. This means the end action will not wait on more participants to leave before ending. Default `false`. */
  end_on_exit?: boolean | SWMLVar;
  /** The maximum number of participants allowed in the conference. If the limit is reached, new participants will not be able to join. Default `100000`. */
  max_participants?: number | SWMLVar;
  meta?:
    | {
        private?: unknown;
        public?: unknown;
      }
    | SWMLVar;
  min_participants?: number | SWMLVar;
  /** Whether to join the conference in a muted state. If set to `true`, the participant will be muted upon joining. Default `false`. */
  muted?: boolean | SWMLVar;
  /** A friendly name to identify the stream at the WebSocket endpoint. Default not set */
  name: string | SWMLVar;
  /** Enables or disables recording of the conference. Default `\"do-not-record\"`. */
  record?: 'do-not-record' | 'record-from-start' | SWMLVar;
  /** The URL to which recording status events will be sent. This URL must be publicly accessible and able to handle HTTP requests. Default not set */
  recording_status_callback?: string | SWMLVar;
  /** Space-separated list of one or more events to send to the recording status callback URL. */
  recording_status_callback_event?: string | SWMLVar;
  /** The content type used when sending recording status events to the recording status callback URL. Defaults to `relay`. An unlisted value is rejected rather than falling back to the default. */
  recording_status_callback_event_type?: 'cxml' | 'laml' | 'relay' | SWMLVar;
  /** The HTTP method to use when sending recording status events to the recording status callback URL. Default `\"POST\"`. */
  recording_status_callback_method?: 'GET' | 'POST' | SWMLVar;
  /** Specifies the geographical region where the conference will be hosted. Default not set */
  region?: 'global' | 'us' | 'eu' | 'ch' | SWMLVar;
  /** Starts the conference when the main participant joins. This means the start action will not wait on more participants to join before starting. Default `true`. */
  start_on_enter?: boolean | SWMLVar;
  /** The URL to which status events will be sent. This URL must be publicly accessible and able to handle HTTP requests. Default not set */
  status_callback?: string | SWMLVar;
  /** Space-separated list of one or more events to send to the status callback URL. */
  status_callback_event?: string | SWMLVar;
  /** The content type used when sending status events to the status callback URL. Default not set */
  status_callback_event_type?: 'cxml' | 'laml' | 'relay' | SWMLVar;
  /** The HTTP method to use when sending status events to the status callback URL. Default `\"POST\"`. */
  status_callback_method?: 'GET' | 'POST' | SWMLVar;
  /** Attach a bidirectional WebSocket stream to the conference. Conference audio is streamed to */
  stream?: CallDeviceStream | SWMLVar;
  /** If set to `trim-silence`, it will remove silence from the start of the recording. If set to `do-not-trim`, it will keep the silence. Default `\"trim-silence\"`. */
  trim?: 'trim-silence' | 'do-not-trim' | SWMLVar;
  video?: boolean | SWMLVar;
  video_layout?: string | SWMLVar;
  video_preview?: boolean | SWMLVar;
  video_quality?: '720p' | '1080p' | SWMLVar;
  /** A URL that will play media when the conference is put on hold. Default hold music will be played if not set */
  wait_url?: string | SWMLVar;
  [key: string]:
    | Record<string, unknown>
    | 'true'
    | 'false'
    | 'onEnter'
    | 'onExit'
    | SWMLVar
    | string
    | SWMLVar
    | boolean
    | SWMLVar
    | number
    | SWMLVar
    | {
        private?: unknown;
        public?: unknown;
      }
    | SWMLVar
    | 'do-not-record'
    | 'record-from-start'
    | SWMLVar
    | 'cxml'
    | 'laml'
    | 'relay'
    | SWMLVar
    | 'GET'
    | 'POST'
    | SWMLVar
    | 'global'
    | 'us'
    | 'eu'
    | 'ch'
    | SWMLVar
    | CallDeviceStream
    | SWMLVar
    | 'trim-silence'
    | 'do-not-trim'
    | SWMLVar
    | '720p'
    | '1080p'
    | SWMLVar
    | undefined;
}

export interface JoinRoom {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  join_room:
    | {
        /** Name of the room to join. Allowed characters: A-Z, a-z, 0-9, underscore, and hyphen. */
        name: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** Name of the room to join. Allowed characters: A-Z, a-z, 0-9, underscore, and hyphen. */
        name: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

export interface Label {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  label:
    | {
        /** Mark any point of the SWML section with a label so that `goto` can jump to it. Must be */
        label: string;
        [key: string]: Record<string, unknown> | string;
      }
    | string[]
    | number
    | (string & string);
  [key: string]:
    | Record<string, unknown>
    | {
        /** Mark any point of the SWML section with a label so that `goto` can jump to it. Must be */
        label: string;
        [key: string]: Record<string, unknown> | string;
      }
    | string[]
    | number
    | (string & string);
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

/** Without one of `code` / `listen_language`, `name` and `voice`, the element has no effect: it is accepted and ignored, not rejected. */
export interface Languages {
  auto_emotion?: boolean | string;
  auto_speed?: boolean | string;
  code?: unknown[] | string;
  double_turn_fillers?: unknown[];
  engine?: string;
  fillers?: unknown[];
  function_fillers?: unknown[];
  listen_language?: unknown[] | string;
  model?: string;
  name?: string;
  params?: LanguageParams;
  pronounce?: unknown[];
  speech_fillers?: unknown[];
  turn_fillers?: unknown[];
  voice?: string;
}

/** Without one of `code` / `listen_language`, `name` and `voice`, the element has no effect: it is accepted and ignored, not rejected. */
export interface LanguagesWithFillers {
  auto_emotion?: boolean | string;
  auto_speed?: boolean | string;
  code?: unknown[] | string;
  double_turn_fillers?: unknown[];
  engine?: string;
  fillers?: unknown[];
  function_fillers?: unknown[];
  listen_language?: unknown[] | string;
  model?: string;
  name?: string;
  params?: LanguageParams;
  pronounce?: unknown[];
  speech_fillers?: unknown[];
  turn_fillers?: unknown[];
  voice?: string;
}

/** Without one of `code` / `listen_language`, `name` and `voice`, the element has no effect: it is accepted and ignored, not rejected. */
export interface LanguagesWithSoloFillers {
  auto_emotion?: boolean | string;
  auto_speed?: boolean | string;
  code?: unknown[] | string;
  double_turn_fillers?: unknown[];
  engine?: string;
  fillers?: unknown[];
  function_fillers?: unknown[];
  listen_language?: unknown[] | string;
  model?: string;
  name?: string;
  params?: LanguageParams;
  pronounce?: unknown[];
  speech_fillers?: unknown[];
  turn_fillers?: unknown[];
  voice?: string;
}

export interface LiveTranscribe {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  live_transcribe:
    | {
        /** The action to perform during live transcription. */
        action?:
          | string
          | {
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    hints?: (string | SWMLVar)[] | SWMLVar;
                    lang?: string | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    verbose_utterances?: boolean | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: unknown;
              summarize?:
                | {
                    ai_model?: string | SWMLVar;
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar;
        hints?:
          | (
              | {
                  pattern?: string | SWMLVar;
                  hint?: string | SWMLVar;
                  ignore_case?: boolean | string | SWMLVar;
                  replace?: string | SWMLVar;
                }
              | string
              | SWMLVar
            )[]
          | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | {
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    hints?: (string | SWMLVar)[] | SWMLVar;
                    lang?: string | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    verbose_utterances?: boolean | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: unknown;
              summarize?:
                | {
                    ai_model?: string | SWMLVar;
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar
          | (
              | {
                  pattern?: string | SWMLVar;
                  hint?: string | SWMLVar;
                  ignore_case?: boolean | string | SWMLVar;
                  replace?: string | SWMLVar;
                }
              | string
              | SWMLVar
            )[]
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** The action to perform during live transcription. */
        action?:
          | string
          | {
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    hints?: (string | SWMLVar)[] | SWMLVar;
                    lang?: string | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    verbose_utterances?: boolean | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: unknown;
              summarize?:
                | {
                    ai_model?: string | SWMLVar;
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar;
        hints?:
          | (
              | {
                  pattern?: string | SWMLVar;
                  hint?: string | SWMLVar;
                  ignore_case?: boolean | string | SWMLVar;
                  replace?: string | SWMLVar;
                }
              | string
              | SWMLVar
            )[]
          | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | {
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    hints?: (string | SWMLVar)[] | SWMLVar;
                    lang?: string | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    verbose_utterances?: boolean | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: unknown;
              summarize?:
                | {
                    ai_model?: string | SWMLVar;
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar
          | (
              | {
                  pattern?: string | SWMLVar;
                  hint?: string | SWMLVar;
                  ignore_case?: boolean | string | SWMLVar;
                  replace?: string | SWMLVar;
                }
              | string
              | SWMLVar
            )[]
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface LiveTranscribeStartAction {
  /** Starts live transcription of the call. */
  start: {
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
    /** The AI prompt that instructs how to summarize the conversation when `ai_summary` is enabled. */
    ai_summary_prompt?: string;
    /** The speech recognition engine to use. */
    speech_engine?: SpeechEngine;
    /** Speech timeout in milliseconds. */
    speech_timeout?: number;
    /** Voice activity detection silence time in milliseconds. Default depends on speech engine: `300` for Deepgram, `500` for Google. */
    vad_silence_ms?: number;
    /** Voice activity detection threshold (0-1800). */
    vad_thresh?: number;
    /** Debug level for logging (0-2). */
    debug_level?: number;
  };
}

/** Stops the live transcription session. */
export type LiveTranscribeStopAction = 'stop';

export interface LiveTranscribeSummarizeAction {
  /** Request an on-demand AI summary of the conversation. */
  summarize: {
    /** The webhook URL to receive the summary. */
    webhook?: string;
    /** The AI prompt that instructs how to summarize the conversation. */
    prompt?: string;
  };
}

export interface LiveTranslate {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  live_translate:
    | {
        /** The action to perform during live translation. */
        action?:
          | string
          | {
              inject?:
                | {
                    direction?: string | SWMLVar;
                    message?: string | SWMLVar;
                  }
                | SWMLVar;
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    filter_from?: string | SWMLVar;
                    filter_to?: string | SWMLVar;
                    from_lang?: string | SWMLVar;
                    from_voice?: string | SWMLVar;
                    from_voice_params?: Record<string, unknown> | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    mode?: string | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    to_lang?: string | SWMLVar;
                    to_voice?: string | SWMLVar;
                    to_voice_params?: Record<string, unknown> | SWMLVar;
                    translation_model?: string | SWMLVar;
                    translation_model_params?: Record<string, unknown> | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: unknown;
              summarize?:
                | {
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | {
              inject?:
                | {
                    direction?: string | SWMLVar;
                    message?: string | SWMLVar;
                  }
                | SWMLVar;
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    filter_from?: string | SWMLVar;
                    filter_to?: string | SWMLVar;
                    from_lang?: string | SWMLVar;
                    from_voice?: string | SWMLVar;
                    from_voice_params?: Record<string, unknown> | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    mode?: string | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    to_lang?: string | SWMLVar;
                    to_voice?: string | SWMLVar;
                    to_voice_params?: Record<string, unknown> | SWMLVar;
                    translation_model?: string | SWMLVar;
                    translation_model_params?: Record<string, unknown> | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: unknown;
              summarize?:
                | {
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** The action to perform during live translation. */
        action?:
          | string
          | {
              inject?:
                | {
                    direction?: string | SWMLVar;
                    message?: string | SWMLVar;
                  }
                | SWMLVar;
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    filter_from?: string | SWMLVar;
                    filter_to?: string | SWMLVar;
                    from_lang?: string | SWMLVar;
                    from_voice?: string | SWMLVar;
                    from_voice_params?: Record<string, unknown> | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    mode?: string | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    to_lang?: string | SWMLVar;
                    to_voice?: string | SWMLVar;
                    to_voice_params?: Record<string, unknown> | SWMLVar;
                    translation_model?: string | SWMLVar;
                    translation_model_params?: Record<string, unknown> | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: unknown;
              summarize?:
                | {
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | {
              inject?:
                | {
                    direction?: string | SWMLVar;
                    message?: string | SWMLVar;
                  }
                | SWMLVar;
              start?:
                | {
                    ai_summary?: boolean | SWMLVar;
                    ai_summary_prompt?: string | SWMLVar;
                    debug_level?: number | SWMLVar;
                    deepgram_key_override?: string | SWMLVar;
                    deepgram_url_override?: string | SWMLVar;
                    direction?: (string | SWMLVar)[] | SWMLVar;
                    filter_from?: string | SWMLVar;
                    filter_to?: string | SWMLVar;
                    from_lang?: string | SWMLVar;
                    from_voice?: string | SWMLVar;
                    from_voice_params?: Record<string, unknown> | SWMLVar;
                    live_events?: boolean | SWMLVar;
                    mode?: string | SWMLVar;
                    speech_engine?: string | SWMLVar;
                    speech_timeout?: number | SWMLVar;
                    to_lang?: string | SWMLVar;
                    to_voice?: string | SWMLVar;
                    to_voice_params?: Record<string, unknown> | SWMLVar;
                    translation_model?: string | SWMLVar;
                    translation_model_params?: Record<string, unknown> | SWMLVar;
                    vad_silence_ms?: number | SWMLVar;
                    vad_thresh?: number | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
              stop?: unknown;
              summarize?:
                | {
                    prompt?: string | SWMLVar;
                    summary_prompt?: string | SWMLVar;
                    webhook?: string | SWMLVar;
                  }
                | SWMLVar;
            }
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface LiveTranslateInjectAction {
  /** Inject a message into the conversation to be translated and spoken. */
  inject: {
    /** The text message to inject and translate. */
    message: string;
    /** The direction to send the translated message. */
    direction: TranscribeDirection;
  };
}

export interface LiveTranslateStartAction {
  /** Starts live translation of the call. */
  start: {
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
    filter_from?: TranslationFilterPreset | CustomTranslationFilter;
    /** Translation filter for the target language direction. */
    filter_to?: TranslationFilterPreset | CustomTranslationFilter;
    /** The webhook URL to receive translation events. */
    webhook?: string;
    /** Whether to send real-time translation events. */
    live_events?: boolean;
    /** Whether to generate AI summaries in both languages when translation ends. */
    ai_summary?: boolean;
    /** The AI prompt that instructs how to summarize the conversation when `ai_summary` is enabled. */
    ai_summary_prompt?: string;
    /** The speech recognition engine to use. */
    speech_engine?: SpeechEngine;
    /** Speech timeout in milliseconds. */
    speech_timeout?: number;
    /** Voice activity detection silence time in milliseconds. Default depends on speech engine: `300` for Deepgram, `500` for Google. */
    vad_silence_ms?: number;
    /** Voice activity detection threshold (0-1800). */
    vad_thresh?: number;
    /** Debug level for logging (0-2). */
    debug_level?: number;
  };
}

/** Stops the live translation session. */
export type LiveTranslateStopAction = 'stop';

export interface LiveTranslateSummarizeAction {
  /** Request an on-demand AI summary of the translated conversation. */
  summarize: {
    /** The webhook URL to receive the summary. */
    webhook?: string;
    /** The AI prompt that instructs how to summarize the conversation. */
    prompt?: string;
  };
}

export interface NullProperty {
  /** The type of parameter(s) the AI is passing to the function. */
  type: 'null';
  /** A description of the property. */
  description: string;
}

/** Base interface for all property types */
export interface NumberProperty {
  /** A description of the property. */
  description?: string;
  /** Whether the property can be null. */
  nullable?: boolean | SWMLVar;
  /** The type of parameter(s) the AI is passing to the function. */
  type: 'number';
  /** An array of integers that are the possible values */
  enum?: number[] | SWMLVar[];
  /** The default integer value */
  default?: number | SWMLVar;
}

/** Base interface for all property types */
export interface ObjectProperty {
  /** A description of the property. */
  description?: string;
  /** Whether the property can be null. */
  nullable?: boolean | SWMLVar;
  /** The type of parameter(s) the AI is passing to the function. */
  type: 'object';
  /** The default object value */
  default?: Record<string, unknown>;
  /** Nested properties */
  properties?: Record<string, SchemaType>;
  /** Required property names */
  required?: string[];
}

export interface OneOfProperty {
  /** An array of schemas where exactly one of the schemas must be valid. */
  oneOf: SchemaType[];
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

export interface Pay {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  pay:
    | {
        /** Custom description of the payment provided in the request. */
        description?: string | SWMLVar;
        bank_account_type?:
          'consumer-checking' | 'consumer-savings' | 'commercial-checking' | SWMLVar;
        /** The amount to charge against payment method passed in the request. `Float` value with no currency prefix passed as string. */
        charge_amount?: string | SWMLVar;
        /** Uses the ISO 4217 currency code of the charge amount. */
        currency?: string | SWMLVar;
        /** The method of how to collect the payment details. Currently only `dtmf` mode is supported. */
        input?: 'dtmf' | 'voice' | SWMLVar;
        /** Language to use for prompts being played to the caller by the `pay` method. */
        language?: string | SWMLVar;
        /** Number of times the `pay` method will retry to collect payment details. */
        max_attempts?: string | SWMLVar;
        /** The minimum length of the postal code the user must enter. */
        min_postal_code_length?: string | SWMLVar;
        /** Array of parameter objects to pass to your payment processor. The parameters are user-defined key-value pairs. */
        parameters?: (PayParameters | SWMLVar)[] | SWMLVar;
        /** The URL to make POST requests with all the gathered payment details. */
        payment_connector_url: string | SWMLVar;
        /** Indicates the payment method which is going to be used in this payment request, `credit-card` or `ach-debit`. Default is `credit-card`. */
        payment_method?: 'credit-card' | 'ach-debit' | SWMLVar;
        /** Takes `true`, `false` or real postalcode (if it's known beforehand) to let pay method know whether to prompt for postal code. Default is `true`. */
        postal_code?: string | SWMLVar;
        /** Array of prompt objects for customizing the audio prompts during different stages of the payment process. */
        prompts?: (PayPrompts | SWMLVar)[] | SWMLVar;
        say_voice?: string | SWMLVar;
        /** Takes true or false to let pay method know whether to prompt for security code. */
        security_code?: string | SWMLVar;
        /** The URL to send requests for each status change during the payment process. */
        status_url?: string | SWMLVar;
        /** Limit in seconds that pay method waits for the caller to press another digit before moving on to validate the digits captured. */
        timeout?: string | SWMLVar;
        /** Whether the payment is a one off payment or re-occurring. */
        token_type?: 'one-time' | 'reusable' | SWMLVar;
        /** List of payment cards allowed to use in the requested payment process separated by space. */
        valid_card_types?: string | SWMLVar;
        /** Text-to-speech voice to use. Please refer to [TTS documentation](/docs/platform/voice/tts) for more information. */
        voice?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | 'consumer-checking'
          | 'consumer-savings'
          | 'commercial-checking'
          | SWMLVar
          | 'dtmf'
          | 'voice'
          | SWMLVar
          | (PayParameters | SWMLVar)[]
          | SWMLVar
          | 'credit-card'
          | 'ach-debit'
          | SWMLVar
          | (PayPrompts | SWMLVar)[]
          | SWMLVar
          | 'one-time'
          | 'reusable'
          | SWMLVar
          | undefined;
      }
    | (unknown | 'dtmf' | 'voice' | SWMLVar)[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** Custom description of the payment provided in the request. */
        description?: string | SWMLVar;
        bank_account_type?:
          'consumer-checking' | 'consumer-savings' | 'commercial-checking' | SWMLVar;
        /** The amount to charge against payment method passed in the request. `Float` value with no currency prefix passed as string. */
        charge_amount?: string | SWMLVar;
        /** Uses the ISO 4217 currency code of the charge amount. */
        currency?: string | SWMLVar;
        /** The method of how to collect the payment details. Currently only `dtmf` mode is supported. */
        input?: 'dtmf' | 'voice' | SWMLVar;
        /** Language to use for prompts being played to the caller by the `pay` method. */
        language?: string | SWMLVar;
        /** Number of times the `pay` method will retry to collect payment details. */
        max_attempts?: string | SWMLVar;
        /** The minimum length of the postal code the user must enter. */
        min_postal_code_length?: string | SWMLVar;
        /** Array of parameter objects to pass to your payment processor. The parameters are user-defined key-value pairs. */
        parameters?: (PayParameters | SWMLVar)[] | SWMLVar;
        /** The URL to make POST requests with all the gathered payment details. */
        payment_connector_url: string | SWMLVar;
        /** Indicates the payment method which is going to be used in this payment request, `credit-card` or `ach-debit`. Default is `credit-card`. */
        payment_method?: 'credit-card' | 'ach-debit' | SWMLVar;
        /** Takes `true`, `false` or real postalcode (if it's known beforehand) to let pay method know whether to prompt for postal code. Default is `true`. */
        postal_code?: string | SWMLVar;
        /** Array of prompt objects for customizing the audio prompts during different stages of the payment process. */
        prompts?: (PayPrompts | SWMLVar)[] | SWMLVar;
        say_voice?: string | SWMLVar;
        /** Takes true or false to let pay method know whether to prompt for security code. */
        security_code?: string | SWMLVar;
        /** The URL to send requests for each status change during the payment process. */
        status_url?: string | SWMLVar;
        /** Limit in seconds that pay method waits for the caller to press another digit before moving on to validate the digits captured. */
        timeout?: string | SWMLVar;
        /** Whether the payment is a one off payment or re-occurring. */
        token_type?: 'one-time' | 'reusable' | SWMLVar;
        /** List of payment cards allowed to use in the requested payment process separated by space. */
        valid_card_types?: string | SWMLVar;
        /** Text-to-speech voice to use. Please refer to [TTS documentation](/docs/platform/voice/tts) for more information. */
        voice?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | 'consumer-checking'
          | 'consumer-savings'
          | 'commercial-checking'
          | SWMLVar
          | 'dtmf'
          | 'voice'
          | SWMLVar
          | (PayParameters | SWMLVar)[]
          | SWMLVar
          | 'credit-card'
          | 'ach-debit'
          | SWMLVar
          | (PayPrompts | SWMLVar)[]
          | SWMLVar
          | 'one-time'
          | 'reusable'
          | SWMLVar
          | undefined;
      }
    | (unknown | 'dtmf' | 'voice' | SWMLVar)[]
    | number
    | string;
}

export interface PayParameters {
  name: string | SWMLVar;
  value: string | SWMLVar;
  [key: string]: Record<string, unknown> | string | SWMLVar;
}

export interface PayPromptAction {
  type: 'Say' | 'Play' | SWMLVar;
  phrase: string | SWMLVar;
  [key: string]: Record<string, unknown> | 'Say' | 'Play' | SWMLVar | string | SWMLVar;
}

export interface PayPromptPlayAction {
  type: 'Say' | 'Play' | SWMLVar;
  phrase: string | SWMLVar;
  [key: string]: Record<string, unknown> | 'Say' | 'Play' | SWMLVar | string | SWMLVar;
}

export interface PayPromptSayAction {
  type: 'Say' | 'Play' | SWMLVar;
  phrase: string | SWMLVar;
  [key: string]: Record<string, unknown> | 'Say' | 'Play' | SWMLVar | string | SWMLVar;
}

export interface PayPrompts {
  actions?: (PayPromptAction | SWMLVar)[] | SWMLVar;
  attempt?: string | SWMLVar;
  card_type?: string | SWMLVar;
  error_type?: string | SWMLVar;
  for:
    | 'payment-card-number'
    | 'expiration-date'
    | 'security-code'
    | 'postal-code'
    | 'bank-routing-number'
    | 'bank-account-number'
    | 'payment-processing'
    | 'payment-completed'
    | 'payment-failed'
    | 'payment-canceled'
    | SWMLVar;
  play?: (RingbackConfig | SWMLVar)[] | SWMLVar;
  require_matching_inputs?: string | SWMLVar;
  [key: string]:
    | Record<string, unknown>
    | (PayPromptAction | SWMLVar)[]
    | SWMLVar
    | string
    | SWMLVar
    | 'payment-card-number'
    | 'expiration-date'
    | 'security-code'
    | 'postal-code'
    | 'bank-routing-number'
    | 'bank-account-number'
    | 'payment-processing'
    | 'payment-completed'
    | 'payment-failed'
    | 'payment-canceled'
    | SWMLVar
    | (RingbackConfig | SWMLVar)[]
    | SWMLVar
    | undefined;
}

export interface Play {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  play: PlayWithURL | string[] | number | (string & string);
  [key: string]: Record<string, unknown> | PlayWithURL | string[] | number | (string & string);
}

/** Play file(s), ringtones, speech or silence. */
export interface PlayWithURL {
  /** If `true`, the call will automatically answer as the sound is playing. If `false`, you will start playing the audio during early media. Default `true`. */
  auto_answer?: boolean | string | SWMLVar;
  loop?: number | SWMLVar;
  /** Gender to use for the text to speech. */
  say_gender?: 'male' | 'female' | SWMLVar;
  /** The language to use for the text to speech. */
  say_language?: string | SWMLVar;
  /** The voice to use for the text to speech. */
  say_voice?: string | SWMLVar;
  /** http or https URL to deliver play status events */
  status_url?: string | SWMLVar;
  url?: play_url;
  /** Array of URLs to play. */
  urls?: string[];
  /** Volume level for the audio file. */
  volume?: number | SWMLVar;
  [key: string]:
    | Record<string, unknown>
    | boolean
    | string
    | SWMLVar
    | number
    | SWMLVar
    | 'male'
    | 'female'
    | SWMLVar
    | string
    | SWMLVar
    | play_url
    | string[]
    | undefined;
}

/** Play file(s), ringtones, speech or silence. */
export interface PlayWithURLS {
  /** If `true`, the call will automatically answer as the sound is playing. If `false`, you will start playing the audio during early media. Default `true`. */
  auto_answer?: boolean | string | SWMLVar;
  loop?: number | SWMLVar;
  /** Gender to use for the text to speech. */
  say_gender?: 'male' | 'female' | SWMLVar;
  /** The language to use for the text to speech. */
  say_language?: string | SWMLVar;
  /** The voice to use for the text to speech. */
  say_voice?: string | SWMLVar;
  /** http or https URL to deliver play status events */
  status_url?: string | SWMLVar;
  url?: play_url;
  /** Array of URLs to play. */
  urls?: string[];
  /** Volume level for the audio file. */
  volume?: number | SWMLVar;
  [key: string]:
    | Record<string, unknown>
    | boolean
    | string
    | SWMLVar
    | number
    | SWMLVar
    | 'male'
    | 'female'
    | SWMLVar
    | string
    | SWMLVar
    | play_url
    | string[]
    | undefined;
}

export interface PlaybackBGAction {
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
        voice?: unknown;
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

/** Without one of `body` / `bullets` / `subsections`, the element has no effect: it is accepted and ignored, not rejected. */
export interface PomSectionBodyContent {
  title?: string;
  body?: string;
  bullets?: unknown[];
  numbered?: boolean;
  numberedBullets?: boolean;
  subsections?: unknown[];
}

/** Without one of `body` / `bullets` / `subsections`, the element has no effect: it is accepted and ignored, not rejected. */
export interface PomSectionBulletsContent {
  title?: string;
  body?: string;
  bullets?: unknown[];
  numbered?: boolean;
  numberedBullets?: boolean;
  subsections?: unknown[];
}

export interface Prompt {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  prompt:
    | {
        /** Time in seconds to wait for next digit. */
        digit_timeout?: number | SWMLVar;
        /** Time in seconds to wait for start of input. */
        initial_timeout?: number | SWMLVar;
        /** Number of digits to collect. */
        max_digits?: number | SWMLVar;
        /** URL or array of URLs to play. */
        play?: RingbackConfig | string[] | string;
        /** The gender to use for the text to speech. */
        say_gender?: 'male' | 'female' | SWMLVar;
        /** The language to use for the text to speech. */
        say_language?: string | SWMLVar;
        /** The voice to use for the text to speech. */
        say_voice?: string | SWMLVar;
        /** Time in seconds to wait for end of speech utterance. */
        speech_end_timeout?: number | SWMLVar;
        /** The engine that is selected for speech recognition. The engine must support the specified language. */
        speech_engine?: 'Google' | 'Google.V2' | 'Deepgram' | SWMLVar;
        /** Expected words or phrases to help the speech recognition. */
        speech_hints?: string[];
        /** Language to detect speech in. */
        speech_language?: string | SWMLVar;
        /** Max time in seconds to wait for speech result. */
        speech_timeout?: number | SWMLVar;
        /** http or https URL to deliver prompt status events */
        status_url?: string | SWMLVar;
        /** Digits that terminate digit collection. */
        terminators?: string | SWMLVar;
        url?: string;
        /** Volume level for the audio file. */
        volume?: number | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | number
          | SWMLVar
          | RingbackConfig
          | string[]
          | string
          | 'male'
          | 'female'
          | SWMLVar
          | string
          | SWMLVar
          | 'Google'
          | 'Google.V2'
          | 'Deepgram'
          | SWMLVar
          | string[]
          | string
          | undefined;
      }
    | (string | number | SWMLVar)[]
    | number
    | (string & string);
  [key: string]:
    | Record<string, unknown>
    | {
        /** Time in seconds to wait for next digit. */
        digit_timeout?: number | SWMLVar;
        /** Time in seconds to wait for start of input. */
        initial_timeout?: number | SWMLVar;
        /** Number of digits to collect. */
        max_digits?: number | SWMLVar;
        /** URL or array of URLs to play. */
        play?: RingbackConfig | string[] | string;
        /** The gender to use for the text to speech. */
        say_gender?: 'male' | 'female' | SWMLVar;
        /** The language to use for the text to speech. */
        say_language?: string | SWMLVar;
        /** The voice to use for the text to speech. */
        say_voice?: string | SWMLVar;
        /** Time in seconds to wait for end of speech utterance. */
        speech_end_timeout?: number | SWMLVar;
        /** The engine that is selected for speech recognition. The engine must support the specified language. */
        speech_engine?: 'Google' | 'Google.V2' | 'Deepgram' | SWMLVar;
        /** Expected words or phrases to help the speech recognition. */
        speech_hints?: string[];
        /** Language to detect speech in. */
        speech_language?: string | SWMLVar;
        /** Max time in seconds to wait for speech result. */
        speech_timeout?: number | SWMLVar;
        /** http or https URL to deliver prompt status events */
        status_url?: string | SWMLVar;
        /** Digits that terminate digit collection. */
        terminators?: string | SWMLVar;
        url?: string;
        /** Volume level for the audio file. */
        volume?: number | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | number
          | SWMLVar
          | RingbackConfig
          | string[]
          | string
          | 'male'
          | 'female'
          | SWMLVar
          | string
          | SWMLVar
          | 'Google'
          | 'Google.V2'
          | 'Deepgram'
          | SWMLVar
          | string[]
          | string
          | undefined;
      }
    | (string | number | SWMLVar)[]
    | number
    | (string & string);
}

/** Without `replace` and `with`, the element has no effect: it is accepted and ignored, not rejected. */
export interface Pronounce {
  ignore_case?: boolean | number | string;
  replace?: string;
  with?: string;
}

export interface ReceiveFax {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  receive_fax:
    | {
        /** http or https URL to deliver receive_fax status events */
        status_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** http or https URL to deliver receive_fax status events */
        status_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

export interface Record_ {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  record:
    | {
        /** The format to record in. Can be `wav`, `mp3`, or `mp4`. */
        format?: 'wav' | 'mp3' | 'mp4' | SWMLVar;
        /** Play a beep before recording. */
        beep?: boolean | SWMLVar;
        /** Direction of the audio to record: "speak" for what party says, "listen" for what party hears, "both" for what the party hears and says. */
        direction?: 'listen' | 'speak' | 'both' | SWMLVar;
        /** Time in seconds to wait in silence before ending the recording. */
        end_silence_timeout?: number | SWMLVar;
        /** Time in seconds to wait for the start of speech. */
        initial_timeout?: number | SWMLVar;
        /** How sensitive the recording voice activity detector is to background noise. */
        input_sensitivity?: number | SWMLVar;
        /** Maximum length of the recording in seconds. */
        max_length?: number | SWMLVar;
        /** URL to send recording status events to. */
        status_url?: string | SWMLVar;
        /** If true, record in stereo. */
        stereo?: boolean | SWMLVar;
        /** String of digits that will stop the recording when pressed. Default is `\"#\"`. */
        terminators?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'wav'
          | 'mp3'
          | 'mp4'
          | SWMLVar
          | boolean
          | SWMLVar
          | 'listen'
          | 'speak'
          | 'both'
          | SWMLVar
          | number
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** The format to record in. Can be `wav`, `mp3`, or `mp4`. */
        format?: 'wav' | 'mp3' | 'mp4' | SWMLVar;
        /** Play a beep before recording. */
        beep?: boolean | SWMLVar;
        /** Direction of the audio to record: "speak" for what party says, "listen" for what party hears, "both" for what the party hears and says. */
        direction?: 'listen' | 'speak' | 'both' | SWMLVar;
        /** Time in seconds to wait in silence before ending the recording. */
        end_silence_timeout?: number | SWMLVar;
        /** Time in seconds to wait for the start of speech. */
        initial_timeout?: number | SWMLVar;
        /** How sensitive the recording voice activity detector is to background noise. */
        input_sensitivity?: number | SWMLVar;
        /** Maximum length of the recording in seconds. */
        max_length?: number | SWMLVar;
        /** URL to send recording status events to. */
        status_url?: string | SWMLVar;
        /** If true, record in stereo. */
        stereo?: boolean | SWMLVar;
        /** String of digits that will stop the recording when pressed. Default is `\"#\"`. */
        terminators?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'wav'
          | 'mp3'
          | 'mp4'
          | SWMLVar
          | boolean
          | SWMLVar
          | 'listen'
          | 'speak'
          | 'both'
          | SWMLVar
          | number
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface RecordCall {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  record_call:
    | {
        /** The format to record in. It can be `wav`, `mp3`, or `mp4`. */
        format?: 'wav' | 'mp3' | 'mp4' | SWMLVar;
        /** Play a beep before recording. */
        beep?: boolean | SWMLVar;
        /** Identifier for this recording, to use with `stop_record_call`. */
        control_id?: string | SWMLVar;
        /** Direction of the audio to record: "speak" for what party says, "listen" for what party hears, "both" for what the party hears and says. */
        direction?: 'listen' | 'speak' | 'both' | SWMLVar;
        /** Time in seconds to wait in silence before ending the recording. Must be at least `1`; `0` and fractional values below `1` are rejected. */
        end_silence_timeout?: number | SWMLVar;
        /** Time in seconds to wait for the start of speech. Must be at least `1`; `0` and fractional values below `1` are rejected. */
        initial_timeout?: number | SWMLVar;
        /** How sensitive the recording voice activity detector is to background noise. */
        input_sensitivity?: number | SWMLVar;
        /** Maximum length of the recording in seconds. */
        max_length?: number | SWMLVar;
        /** http or https URL to deliver record_call status events */
        status_url?: string | SWMLVar;
        /** If `true`, record in stereo. */
        stereo?: boolean | SWMLVar;
        /** String of digits that will stop the recording when pressed. Default is `\"\"` (empty). */
        terminators?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'wav'
          | 'mp3'
          | 'mp4'
          | SWMLVar
          | boolean
          | SWMLVar
          | string
          | SWMLVar
          | 'listen'
          | 'speak'
          | 'both'
          | SWMLVar
          | number
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** The format to record in. It can be `wav`, `mp3`, or `mp4`. */
        format?: 'wav' | 'mp3' | 'mp4' | SWMLVar;
        /** Play a beep before recording. */
        beep?: boolean | SWMLVar;
        /** Identifier for this recording, to use with `stop_record_call`. */
        control_id?: string | SWMLVar;
        /** Direction of the audio to record: "speak" for what party says, "listen" for what party hears, "both" for what the party hears and says. */
        direction?: 'listen' | 'speak' | 'both' | SWMLVar;
        /** Time in seconds to wait in silence before ending the recording. Must be at least `1`; `0` and fractional values below `1` are rejected. */
        end_silence_timeout?: number | SWMLVar;
        /** Time in seconds to wait for the start of speech. Must be at least `1`; `0` and fractional values below `1` are rejected. */
        initial_timeout?: number | SWMLVar;
        /** How sensitive the recording voice activity detector is to background noise. */
        input_sensitivity?: number | SWMLVar;
        /** Maximum length of the recording in seconds. */
        max_length?: number | SWMLVar;
        /** http or https URL to deliver record_call status events */
        status_url?: string | SWMLVar;
        /** If `true`, record in stereo. */
        stereo?: boolean | SWMLVar;
        /** String of digits that will stop the recording when pressed. Default is `\"\"` (empty). */
        terminators?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'wav'
          | 'mp3'
          | 'mp4'
          | SWMLVar
          | boolean
          | SWMLVar
          | string
          | SWMLVar
          | 'listen'
          | 'speak'
          | 'both'
          | SWMLVar
          | number
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface Request {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  request:
    | {
        /** Request body. Objects are JSON-encoded automatically. */
        body?: Record<string, unknown> | unknown[] | string | number | boolean;
        /** Maximum time in seconds to wait for a connection. Defaults to `5` when the key is absent, and is clamped to a maximum of `30`. Fractional input is truncated to an integer. */
        connect_timeout?: number | SWMLVar;
        /** HTTP headers to include with the request, as a map of header name to value. Each value must be a string. */
        headers?: Record<string, unknown>;
        /** The HTTP method to be used for the request. Can be `GET`, `POST`, `PUT`, or `DELETE`. */
        method: 'get' | 'GET' | 'put' | 'PUT' | 'POST' | 'post' | 'DELETE' | 'delete' | SWMLVar;
        /** If `true`, parse the JSON response into `request_response.*` variables. */
        save_variables?: boolean | SWMLVar;
        /** Timeout in seconds. Defaults to `5` when the key is absent, and is clamped to a maximum of `30`. Fractional input is truncated to an integer. */
        timeout?: number | SWMLVar;
        /** Endpoint to call. Must be a publicly reachable URL. */
        url: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | Record<string, unknown>
          | unknown[]
          | string
          | number
          | boolean
          | number
          | SWMLVar
          | 'get'
          | 'GET'
          | 'put'
          | 'PUT'
          | 'POST'
          | 'post'
          | 'DELETE'
          | 'delete'
          | SWMLVar
          | boolean
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** Request body. Objects are JSON-encoded automatically. */
        body?: Record<string, unknown> | unknown[] | string | number | boolean;
        /** Maximum time in seconds to wait for a connection. Defaults to `5` when the key is absent, and is clamped to a maximum of `30`. Fractional input is truncated to an integer. */
        connect_timeout?: number | SWMLVar;
        /** HTTP headers to include with the request, as a map of header name to value. Each value must be a string. */
        headers?: Record<string, unknown>;
        /** The HTTP method to be used for the request. Can be `GET`, `POST`, `PUT`, or `DELETE`. */
        method: 'get' | 'GET' | 'put' | 'PUT' | 'POST' | 'post' | 'DELETE' | 'delete' | SWMLVar;
        /** If `true`, parse the JSON response into `request_response.*` variables. */
        save_variables?: boolean | SWMLVar;
        /** Timeout in seconds. Defaults to `5` when the key is absent, and is clamped to a maximum of `30`. Fractional input is truncated to an integer. */
        timeout?: number | SWMLVar;
        /** Endpoint to call. Must be a publicly reachable URL. */
        url: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | Record<string, unknown>
          | unknown[]
          | string
          | number
          | boolean
          | number
          | SWMLVar
          | 'get'
          | 'GET'
          | 'put'
          | 'PUT'
          | 'POST'
          | 'post'
          | 'DELETE'
          | 'delete'
          | SWMLVar
          | boolean
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface Return {
  /** Body shape enforced by CHECK_swml_method_return, swml_schema.c:1495. */
  return: Record<string, unknown> | unknown[] | boolean | null | number | string;
  [key: string]:
    | Record<string, unknown>
    | Record<string, unknown>
    | unknown[]
    | boolean
    | null
    | number
    | string;
}

export interface SIPRefer {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  sip_refer:
    Record<string, unknown> | (string | SWMLVar)[] | number | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | Record<string, unknown>
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

/** Send an outbound SMS or MMS message to a PSTN phone number. */
export interface SMSWithBody {
  /** Optional if `media` is present. The body of the SMS message. */
  body?: string | SWMLVar;
  /** Phone number the SMS message will be sent from in E.164 format. */
  from_number: string | SWMLVar;
  /** Required if `body` is not present. Array of media URLs to include in the message. */
  media?: string[];
  /** Region of the world to originate the message from. Chosen based on account preferences or device location if not specified. */
  region?: string | SWMLVar;
  /** URL to receive delivery status callbacks for the outbound message (e.g., `queued`, `sent`, `delivered`, `failed`). Not set if not specified. The callback uses the [message status callback payload](/docs/apis/rest/messages/webhooks/message-status-callback). */
  status_callback?: string | SWMLVar;
  /** Array of tags to associate with the message to facilitate log searches. */
  tags?: string[];
  /** Phone number to send SMS message to in E.164 format. */
  to_number: string | SWMLVar;
  [key: string]: Record<string, unknown> | string | SWMLVar | string[] | undefined;
}

/** Send an outbound SMS or MMS message to a PSTN phone number. */
export interface SMSWithMedia {
  /** Optional if `media` is present. The body of the SMS message. */
  body?: string | SWMLVar;
  /** Phone number the SMS message will be sent from in E.164 format. */
  from_number: string | SWMLVar;
  /** Required if `body` is not present. Array of media URLs to include in the message. */
  media?: string[];
  /** Region of the world to originate the message from. Chosen based on account preferences or device location if not specified. */
  region?: string | SWMLVar;
  /** URL to receive delivery status callbacks for the outbound message (e.g., `queued`, `sent`, `delivered`, `failed`). Not set if not specified. The callback uses the [message status callback payload](/docs/apis/rest/messages/webhooks/message-status-callback). */
  status_callback?: string | SWMLVar;
  /** Array of tags to associate with the message to facilitate log searches. */
  tags?: string[];
  /** Phone number to send SMS message to in E.164 format. */
  to_number: string | SWMLVar;
  [key: string]: Record<string, unknown> | string | SWMLVar | string[] | undefined;
}

export interface SWAIG {
  defaults?: SWAIGDefaults;
  functions?: SWAIGFunction[];
  hooks?: {
    description?: string;
    active?: boolean | number | string;
    argument?: FunctionParameters;
    data_map?: DataMap;
    fillers?: {
      default?: unknown;
      auto?: unknown;
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
  includes?: SWAIGIncludes[];
  internal_fillers?: SWAIGInternalFiller;
  mcp_servers?: {
    headers?: Record<string, unknown>;
    resource_vars?: Record<string, unknown>;
    resources?: boolean | string;
    url?: string;
  }[];
  native_functions?: SWAIGNativeFunction[];
}

export interface SWAIGDefaults {
  meta_data?: unknown;
  meta_data_token?: string;
  web_hook_auth_pass?: string;
  web_hook_auth_password?: string;
  web_hook_auth_user?: string;
  web_hook_url?: string;
}

/** Without one of `data_map` / `web_hook_url`, one of `description` / `purpose` and `function`, the element has no effect: it is accepted and ignored, not rejected. */
export interface SWAIGFunction {
  description?: string;
  active?: boolean | number | string;
  argument?: FunctionParameters;
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
}

/** Without `functions` and `url`, the element has no effect: it is accepted and ignored, not rejected. */
export interface SWAIGIncludes {
  auth_password?: string;
  auth_user?: string;
  functions?: unknown[];
  meta_data?: Record<string, unknown>;
  url?: string;
}

export interface SWAIGInternalFiller {
  adjust_response_latency?: {
    default?: unknown;
    auto?: unknown;
  };
  change_context?: {
    default?: unknown;
    auto?: unknown;
  };
  check_time?: {
    default?: unknown;
    auto?: unknown;
  };
  get_ideal_strategy?: {
    default?: unknown;
    auto?: unknown;
  };
  get_visual_input?: {
    default?: unknown;
    auto?: unknown;
  };
  next_step?: {
    default?: unknown;
    auto?: unknown;
  };
  pause_conversation?: {
    default?: unknown;
    auto?: unknown;
  };
  wait_for_user?: {
    default?: unknown;
    auto?: unknown;
  };
  wait_seconds?: {
    default?: unknown;
    auto?: unknown;
  };
}

export type SWAIGNativeFunction = string;

export interface SWMLAction {
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
        voice?: unknown;
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

export type SWMLMethod =
  | AI
  | AiSidecar
  | AmazonBedrock
  | Answer
  | BindDigit
  | ClearDigitBindings
  | Cond
  | Connect
  | Denoise
  | DetectMachine
  | Echo
  | EnterQueue
  | Execute
  | ExecuteRpc
  | Goto
  | Hangup
  | JoinConference
  | JoinRoom
  | Label
  | LiveTranscribe
  | LiveTranslate
  | Pay
  | Play
  | Prompt
  | ReceiveFax
  | Record_
  | RecordCall
  | Request
  | Return
  | Ring
  | SIPRefer
  | SendDigits
  | SendFax
  | SendSMS
  | Set_
  | SetCapabilities
  | SetMeta
  | Sleep
  | StopDenoise
  | StopRecordCall
  | StopStream
  | StopTap
  | Stream
  | Switch
  | Tap
  | Transcribe
  | TranscribeStop
  | Transfer
  | Unset
  | UserEvent;

export interface SWMLObject {
  sections: Section;
  version?: '1.0.0';
  [key: string]: Record<string, unknown> | Section | '1.0.0' | undefined;
}

/** A SWML variable reference using ${varname} or %{varname} syntax for dynamic value substitution at runtime. */
export type SWMLVar = string;

export interface SayAction {
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
        voice?: unknown;
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

export type SchemaType =
  | StringProperty
  | IntegerProperty
  | NumberProperty
  | BooleanProperty
  | ArrayProperty
  | ObjectProperty
  | NullProperty
  | OneOfProperty
  | AllOfProperty
  | AnyOfProperty
  | ConstProperty;

export interface Section {
  main: SWMLMethod[];
  [key: string]: SWMLMethod[];
}

export interface SendDigits {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  send_digits:
    | {
        /** The digits to send. Valid values are 0123456789*#ABCDWw. Character W is a 1 second delay, and w is a 500ms delay. */
        digits: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** The digits to send. Valid values are 0123456789*#ABCDWw. Character W is a 1 second delay, and w is a 500ms delay. */
        digits: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

export interface SendFax {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  send_fax:
    | {
        /** URL to the PDF document to fax. */
        document: string | SWMLVar;
        /** Header text to include on the fax. */
        header_info?: string | SWMLVar;
        /** Station identity to report. */
        identity?: string | SWMLVar;
        /** http or https URL to deliver send_fax status events */
        status_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** URL to the PDF document to fax. */
        document: string | SWMLVar;
        /** Header text to include on the fax. */
        header_info?: string | SWMLVar;
        /** Station identity to report. */
        identity?: string | SWMLVar;
        /** http or https URL to deliver send_fax status events */
        status_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

export interface SendSMS {
  send_sms: SMSWithBody;
  [key: string]: Record<string, unknown> | SMSWithBody;
}

export interface Set_ {
  /** Set script variables to the specified values. */
  set: Record<string, unknown>;
  [key: string]: Record<string, unknown>;
}

export interface SetGlobalDataAction {
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
        voice?: unknown;
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

export interface SetMetaDataAction {
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
        voice?: unknown;
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

export interface Sleep {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  sleep:
    | {
        /** The amount of time to sleep in milliseconds. */
        duration: number | SWMLVar;
        [key: string]: Record<string, unknown> | number | SWMLVar;
      }
    | (number | SWMLVar)[]
    | (number & (number | SWMLVar))
    | (string & (number | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** The amount of time to sleep in milliseconds. */
        duration: number | SWMLVar;
        [key: string]: Record<string, unknown> | number | SWMLVar;
      }
    | (number | SWMLVar)[]
    | (number & (number | SWMLVar))
    | (string & (number | SWMLVar));
}

/** Speech recognition engine options. */
export type SpeechEngine = 'deepgram' | 'google';

export interface StartAction {
  /** Starts live translation of the call. The translation will be sent to the specified URL. */
  start: {
    /** The webhook URL to be called. */
    webhook?: string;
    /** The language to translate from. */
    from_lang: string;
    /** The language to translate to. */
    to_lang: string;
    /** The TTS voice you want to use for the source language. */
    from_voice?: string;
    /** The TTS voice you want to use for the target language. */
    to_voice?: string;
    /** Translation filter for the source language direction. */
    filter_from?: TranslationFilterPreset | CustomTranslationFilter;
    /** Translation filter for the target language direction. */
    filter_to?: TranslationFilterPreset | CustomTranslationFilter;
    /** Whether to enable live events. */
    live_events?: boolean | SWMLVar;
    /** Whether to enable AI summarization. */
    ai_summary?: boolean | SWMLVar;
    /** The timeout for speech recognition in milliseconds. */
    speech_timeout?: number | SWMLVar;
    /** Voice activity detection silence time in milliseconds. Default depends on speech engine: `300` for Deepgram, `500` for Google. */
    vad_silence_ms?: number | SWMLVar;
    /** Voice activity detection threshold (0-1800). */
    vad_thresh?: number | SWMLVar;
    /** Debug level for logging (0-2). */
    debug_level?: number | SWMLVar;
    /** The direction of the call that should be translated. */
    direction: TranslateDirection[];
    /** The speech engine to use for speech recognition. */
    speech_engine?: SpeechEngine;
    /** The AI prompt that instructs how to summarize the conversation when `ai_summary` is enabled. */
    ai_summary_prompt?: string;
  };
}

/** Without one of `data_map` / `web_hook_url`, one of `description` / `purpose` and `function`, the element has no effect: it is accepted and ignored, not rejected. */
export interface StartUpHookSWAIGFunction {
  description?: string;
  active?: boolean | number | string;
  argument?: FunctionParameters;
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
}

export interface StopAction {
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
        voice?: unknown;
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

export interface StopDenoise {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stop_denoise:
    | {
        [key: string]: Record<string, unknown>;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        [key: string]: Record<string, unknown>;
      }
    | unknown[]
    | number
    | string;
}

export interface StopPlaybackBGAction {
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
        voice?: unknown;
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

export interface StopRecordCall {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stop_record_call:
    | {
        /** Identifier for the recording to stop. */
        control_id?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** Identifier for the recording to stop. */
        control_id?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

export interface StopTap {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stop_tap:
    | {
        /** ID of the tap to stop. */
        control_id?: unknown | SWMLVar;
        [key: string]: Record<string, unknown> | unknown | SWMLVar | undefined;
      }
    | (unknown | SWMLVar)[]
    | number
    | (string & (unknown | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** ID of the tap to stop. */
        control_id?: unknown | SWMLVar;
        [key: string]: Record<string, unknown> | unknown | SWMLVar | undefined;
      }
    | (unknown | SWMLVar)[]
    | number
    | (string & (unknown | SWMLVar));
}

export type StringFormat =
  | 'date_time'
  | 'time'
  | 'date'
  | 'duration'
  | 'email'
  | 'hostname'
  | 'ipv4'
  | 'ipv6'
  | 'uri'
  | 'uuid';

/** Base interface for all property types */
export interface StringProperty {
  /** A description of the property. */
  description?: string;
  /** Whether the property can be null. */
  nullable?: boolean | SWMLVar;
  /** The type of parameter(s) the AI is passing to the function. */
  type: 'string';
  /** An array of strings that are the possible values */
  enum?: string[];
  /** The default string value */
  default?: string;
  /** Regular expression pattern */
  pattern?: string;
  /** String format (email, date-time, etc.) */
  format?: StringFormat;
}

export interface SummarizeAction {
  /** Summarizes the conversation as an object, allowing you to specify the webhook url and prompt for the summary. */
  summarize: {
    /** The webhook URL to be called. */
    webhook?: string;
    /** The AI prompt that instructs how to summarize the conversation. */
    prompt?: string;
  };
}

export type SummarizeActionUnion = SummarizeAction | 'summarize';

/** Without one of `data_map` / `web_hook_url`, one of `description` / `purpose` and `function`, the element has no effect: it is accepted and ignored, not rejected. */
export interface SummarizeConversationSWAIGFunction {
  description?: string;
  active?: boolean | number | string;
  argument?: FunctionParameters;
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
}

export interface Switch {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  switch:
    | {
        /** Array of SWML methods to execute if no `case` matches. If omitted and no case */
        default?:
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            };
        /** Map of values to arrays of SWML methods to execute. The key is the value to compare */
        case?: Record<
          string,
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            }
        >;
        /** Variable path to match. Specified without the `%{}` wrapper (e.g. `message.body`). */
        variable: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            }
          | Record<
              string,
              | SWMLMethod[]
              | {
                  code: Record<string, unknown>;
                  meta?: unknown;
                  [key: string]: Record<string, unknown> | unknown | undefined;
                }
            >
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** Array of SWML methods to execute if no `case` matches. If omitted and no case */
        default?:
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            };
        /** Map of values to arrays of SWML methods to execute. The key is the value to compare */
        case?: Record<
          string,
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            }
        >;
        /** Variable path to match. Specified without the `%{}` wrapper (e.g. `message.body`). */
        variable: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | SWMLMethod[]
          | {
              code: Record<string, unknown>;
              meta?: unknown;
              [key: string]: Record<string, unknown> | unknown | undefined;
            }
          | Record<
              string,
              | SWMLMethod[]
              | {
                  code: Record<string, unknown>;
                  meta?: unknown;
                  [key: string]: Record<string, unknown> | unknown | undefined;
                }
            >
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface Tap {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  tap:
    | {
        /** Codec to use for the tap media stream. */
        codec?: 'PCMA' | 'PCMU' | 'pcma' | 'pcmu' | SWMLVar;
        /** Identifier for this tap to use with `stop_tap`. */
        control_id?: unknown | SWMLVar;
        /** Direction of the audio to tap: */
        direction?: 'listen' | 'speak' | 'both' | SWMLVar;
        /** If `uri` is a `rtp://` this will set the packetization time of the media in milliseconds. */
        rtp_ptime?: number | SWMLVar;
        /** http or https URL to deliver tap status events */
        status_url?: string | SWMLVar;
        /** Destination of the tap media stream: rtp://IP:port, ws://example.com, or wss://example.com. */
        uri: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'PCMA'
          | 'PCMU'
          | 'pcma'
          | 'pcmu'
          | SWMLVar
          | unknown
          | SWMLVar
          | 'listen'
          | 'speak'
          | 'both'
          | SWMLVar
          | number
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | (string | SWMLVar | 'listen' | 'speak' | 'both')[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** Codec to use for the tap media stream. */
        codec?: 'PCMA' | 'PCMU' | 'pcma' | 'pcmu' | SWMLVar;
        /** Identifier for this tap to use with `stop_tap`. */
        control_id?: unknown | SWMLVar;
        /** Direction of the audio to tap: */
        direction?: 'listen' | 'speak' | 'both' | SWMLVar;
        /** If `uri` is a `rtp://` this will set the packetization time of the media in milliseconds. */
        rtp_ptime?: number | SWMLVar;
        /** http or https URL to deliver tap status events */
        status_url?: string | SWMLVar;
        /** Destination of the tap media stream: rtp://IP:port, ws://example.com, or wss://example.com. */
        uri: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | 'PCMA'
          | 'PCMU'
          | 'pcma'
          | 'pcmu'
          | SWMLVar
          | unknown
          | SWMLVar
          | 'listen'
          | 'speak'
          | 'both'
          | SWMLVar
          | number
          | SWMLVar
          | string
          | SWMLVar
          | undefined;
      }
    | (string | SWMLVar | 'listen' | 'speak' | 'both')[]
    | number
    | (string & (string | SWMLVar));
}

export interface ToggleFunctionsAction {
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
        voice?: unknown;
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

export type TranscribeAction = TranscribeStartAction | 'stop' | TranscribeSummarizeActionUnion;

export type TranscribeDirection = 'remote-caller' | 'local-caller';

export interface TranscribeStartAction {
  /** Starts live transcription of the call. The transcription will be sent to the specified URL. */
  start: {
    /** Enables AI summarization of the transcription. The summary will be sent to the specified URL at the end of the conversation. */
    ai_summary?: boolean | SWMLVar;
    /** The webhook URL the transcription will be sent to. */
    webhook?: string;
    /** The language to transcribe. */
    lang: string;
    /** Whether to enable live events. */
    live_events?: boolean | SWMLVar;
    /** The timeout for speech recognition in milliseconds. */
    speech_timeout?: number | SWMLVar;
    /** Voice activity detection silence time in milliseconds. Default depends on speech engine: `300` for Deepgram, `500` for Google. */
    vad_silence_ms?: number | SWMLVar;
    /** Voice activity detection threshold (0-1800). */
    vad_thresh?: number | SWMLVar;
    /** Debug level for logging (0-2). */
    debug_level?: number | SWMLVar;
    /** The direction of the call that should be transcribed. */
    direction: TranscribeDirection[];
    /** The speech engine to use for speech recognition. */
    speech_engine?: SpeechEngine;
    /** The AI prompt that instructs how to summarize the conversation when `ai_summary` is enabled. */
    ai_summary_prompt?: string;
  };
}

export interface TranscribeSummarizeAction {
  /** Summarizes the conversation as an object, allowing you to specify the webhook url and prompt for the summary. */
  summarize: {
    /** The webhook URL to be called. */
    webhook?: string;
    /** The prompt for summarization. */
    prompt?: string;
  };
}

export type TranscribeSummarizeActionUnion = TranscribeSummarizeAction | 'summarize';

export interface Transfer {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  transfer:
    | {
        /** URL (`http` or `https`) to fetch the new SWML document from. Authentication can */
        dest: string | SWMLVar;
        /** User data, ignored by SignalWire. */
        meta?: Record<string, unknown>;
        /** Parameters to include in the request body of the fetch. Available as `params.*` in the transferred document. */
        params?: Record<string, unknown> | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** URL (`http` or `https`) to fetch the new SWML document from. Authentication can */
        dest: string | SWMLVar;
        /** User data, ignored by SignalWire. */
        meta?: Record<string, unknown>;
        /** Parameters to include in the request body of the fetch. Available as `params.*` in the transferred document. */
        params?: Record<string, unknown> | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

export type TranslateAction = StartAction | 'stop' | SummarizeActionUnion | InjectAction;

export type TranslateDirection = 'remote-caller' | 'local-caller';

/** Preset translation filter values that adjust the tone or style of translated speech. */
export type TranslationFilterPreset = 'polite' | 'rude' | 'professional' | 'shakespeare' | 'gen-z';

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

export interface Unset {
  /** Body shape enforced by CHECK_swml_method_unset, swml_schema.c. */
  unset: string[] | string;
  [key: string]: Record<string, unknown> | string[] | string;
}

export interface UnsetGlobalDataAction {
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
        voice?: unknown;
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

export interface UnsetMetaDataAction {
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
        voice?: unknown;
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

export interface UserEvent {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  user_event:
    | {
        event?: Record<string, unknown> | SWMLVar;
        [key: string]: Record<string, unknown> | Record<string, unknown> | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        event?: Record<string, unknown> | SWMLVar;
        [key: string]: Record<string, unknown> | Record<string, unknown> | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface UserInputAction {
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
        voice?: unknown;
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

/** Without one of `data_map` / `web_hook_url`, one of `description` / `purpose` and `function`, the element has no effect: it is accepted and ignored, not rejected. */
export interface UserSWAIGFunction {
  description?: string;
  active?: boolean | number | string;
  argument?: FunctionParameters;
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
}

export type ValidConfirmMethods =
  | Cond
  | Set_
  | Unset
  | Hangup
  | Play
  | Prompt
  | Record_
  | RecordCall
  | StopRecordCall
  | Tap
  | StopTap
  | SendDigits
  | SendSMS
  | Denoise
  | StopDenoise;

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

/** URL to play. */
export type play_url = string;

/** Universal Unique Identifier. */
export type uuid = string;

export interface TranscribeStop {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  transcribe_stop: Record<string, unknown> | unknown[] | number | string;
  [key: string]: Record<string, unknown> | Record<string, unknown> | unknown[] | number | string;
}

export interface Transcribe {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  transcribe:
    | {
        /** An HTTP or HTTPS URL that receives the status callback when the transcription finishes */
        status_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** An HTTP or HTTPS URL that receives the status callback when the transcription finishes */
        status_url?: string | SWMLVar;
        [key: string]: Record<string, unknown> | string | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface Stream {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stream:
    | {
        /** Bearer token sent as an `Authorization` header during the WebSocket handshake. */
        authorization_bearer_token?: string | SWMLVar;
        /** Codec to use for the streamed audio. Freeform and endpoint-specific. */
        codec?: string | SWMLVar;
        /** Identifier for this stream to use with `stop_stream`. If not set, one is generated and stored in the `stream_control_id` variable. */
        control_id?: unknown | SWMLVar;
        /** Custom key-value pairs sent to the WebSocket endpoint in the start message. */
        custom_parameters?: Record<string, unknown>;
        /** Friendly name for the stream. */
        name?: string | SWMLVar;
        /** HTTP or HTTPS URL to deliver stream status events. */
        status_url?: string | SWMLVar;
        /** HTTP method used to deliver stream status events to `status_url`. */
        status_url_method?: 'GET' | 'POST' | SWMLVar;
        /** Audio track to stream: */
        track?: 'inbound_track' | 'outbound_track' | 'both_tracks' | SWMLVar;
        /** Secure WebSocket URI (wss://) to stream the call audio to. */
        url: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | unknown
          | SWMLVar
          | 'GET'
          | 'POST'
          | SWMLVar
          | 'inbound_track'
          | 'outbound_track'
          | 'both_tracks'
          | SWMLVar
          | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** Bearer token sent as an `Authorization` header during the WebSocket handshake. */
        authorization_bearer_token?: string | SWMLVar;
        /** Codec to use for the streamed audio. Freeform and endpoint-specific. */
        codec?: string | SWMLVar;
        /** Identifier for this stream to use with `stop_stream`. If not set, one is generated and stored in the `stream_control_id` variable. */
        control_id?: unknown | SWMLVar;
        /** Custom key-value pairs sent to the WebSocket endpoint in the start message. */
        custom_parameters?: Record<string, unknown>;
        /** Friendly name for the stream. */
        name?: string | SWMLVar;
        /** HTTP or HTTPS URL to deliver stream status events. */
        status_url?: string | SWMLVar;
        /** HTTP method used to deliver stream status events to `status_url`. */
        status_url_method?: 'GET' | 'POST' | SWMLVar;
        /** Audio track to stream: */
        track?: 'inbound_track' | 'outbound_track' | 'both_tracks' | SWMLVar;
        /** Secure WebSocket URI (wss://) to stream the call audio to. */
        url: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | unknown
          | SWMLVar
          | 'GET'
          | 'POST'
          | SWMLVar
          | 'inbound_track'
          | 'outbound_track'
          | 'both_tracks'
          | SWMLVar
          | undefined;
      }
    | (string | SWMLVar)[]
    | number
    | (string & (string | SWMLVar));
}

export interface StopStream {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  stop_stream:
    | {
        /** ID of the stream to stop. */
        control_id?: unknown | SWMLVar;
        [key: string]: Record<string, unknown> | unknown | SWMLVar | undefined;
      }
    | (unknown | SWMLVar)[]
    | number
    | (string & (unknown | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        /** ID of the stream to stop. */
        control_id?: unknown | SWMLVar;
        [key: string]: Record<string, unknown> | unknown | SWMLVar | undefined;
      }
    | (unknown | SWMLVar)[]
    | number
    | (string & (unknown | SWMLVar));
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

export interface SetMeta {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  set_meta:
    | {
        private?: Record<string, unknown> | SWMLVar;
        public?: Record<string, unknown> | SWMLVar;
        [key: string]: Record<string, unknown> | Record<string, unknown> | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        private?: Record<string, unknown> | SWMLVar;
        public?: Record<string, unknown> | SWMLVar;
        [key: string]: Record<string, unknown> | Record<string, unknown> | SWMLVar | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface SetCapabilities {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  set_capabilities:
    | {
        capabilities: (string | SWMLVar)[] | SWMLVar;
        [key: string]: Record<string, unknown> | (string | SWMLVar)[] | SWMLVar;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        capabilities: (string | SWMLVar)[] | SWMLVar;
        [key: string]: Record<string, unknown> | (string | SWMLVar)[] | SWMLVar;
      }
    | unknown[]
    | number
    | string;
}

/** Declared as a named $defs entry so every generator emits a TYPED shape via $ref rather than collapsing an inline object to an untyped map. */
export interface RingbackConfig {
  /** URL to play. */
  url?: string;
  /** Array of URLs to play. */
  urls?: string[];
  /** Volume level for the audio file. */
  volume?: number | SWMLVar;
  [key: string]: Record<string, unknown> | string | string[] | number | SWMLVar | undefined;
}

export interface Ring {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  ring:
    | {
        [key: string]: Record<string, unknown>;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        [key: string]: Record<string, unknown>;
      }
    | unknown[]
    | number
    | string;
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

/** A JSON Schema (draft 2020-12). The value is forwarded verbatim to the receiving model API, which owns this contract; the engine does not inspect it. */
export interface JsonSchema {
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
  const?: unknown;
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
  default?: unknown;
  examples?: unknown[];
  deprecated?: boolean;
  properties?: Record<string, JsonSchema | boolean>;
  required?: string[];
  prefixItems?: (JsonSchema | boolean)[];
  items?: JsonSchema | boolean;
  propertyNames?: JsonSchema | boolean;
  additionalProperties?: JsonSchema | boolean;
  unevaluatedProperties?: JsonSchema | boolean;
  oneOf?: (JsonSchema | boolean)[];
  anyOf?: (JsonSchema | boolean)[];
  allOf?: (JsonSchema | boolean)[];
  not?: JsonSchema | boolean;
  contains?: JsonSchema | boolean;
  dependentRequired?: Record<string, string[]>;
  dependentSchemas?: Record<string, JsonSchema | boolean>;
  else?: JsonSchema | boolean;
  if?: JsonSchema | boolean;
  maxContains?: number;
  minContains?: number;
  multipleOf?: number;
  patternProperties?: Record<string, JsonSchema | boolean>;
  readOnly?: boolean;
  then?: JsonSchema | boolean;
  unevaluatedItems?: JsonSchema | boolean;
  uniqueItems?: boolean;
  writeOnly?: boolean;
}

/** Without `append`, `input_key` and `output_key`, a Foreach has no effect: it is accepted and ignored, not rejected. */
export interface Foreach {
  append?: string;
  input_key?: string;
  max?: number | string;
  output_key?: string;
}

export interface ExecuteRpc {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  execute_rpc:
    | {
        call_id?: string | SWMLVar;
        method: string | SWMLVar;
        node_id?: string | SWMLVar;
        params?: Record<string, unknown> | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        call_id?: string | SWMLVar;
        method: string | SWMLVar;
        node_id?: string | SWMLVar;
        params?: Record<string, unknown> | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | string
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface Echo {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  echo:
    | {
        timeout?: number | SWMLVar;
        [key: string]: Record<string, unknown> | number | SWMLVar | undefined;
      }
    | (number | SWMLVar)[]
    | (number & (number | SWMLVar))
    | (string & (number | SWMLVar));
  [key: string]:
    | Record<string, unknown>
    | {
        timeout?: number | SWMLVar;
        [key: string]: Record<string, unknown> | number | SWMLVar | undefined;
      }
    | (number | SWMLVar)[]
    | (number & (number | SWMLVar))
    | (string & (number | SWMLVar));
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

/** Body shape enforced by CHECK_swml_connect_serial_parallel, swml_schema.c. */
export type ConnectSerialParallel = ConnectDevice[];

/** Body shape enforced by CHECK_swml_connect_device, swml_schema.c. */
export interface ConnectDevice {
  authorization_bearer_token?: string | SWMLVar;
  call_state_events?: string[] | SWMLVar;
  call_state_url?: string | SWMLVar;
  codec?: string | SWMLVar;
  codecs?: string | unknown[];
  confirm?:
    | string
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: unknown;
        [key: string]: Record<string, unknown> | unknown | undefined;
      }
    | SWMLVar;
  confirm_timeout?: number | SWMLVar;
  custom_parameters?: Record<string, string> | SWMLVar;
  encryption?: 'mandatory' | 'optional' | 'forbidden' | SWMLVar;
  from?: string | SWMLVar;
  from_name?: string | SWMLVar;
  headers?: ConnectHeaders[];
  name?: string | SWMLVar;
  password?: string | SWMLVar;
  realtime?: boolean | SWMLVar;
  session_timeout?: number | SWMLVar;
  status_url?: string | SWMLVar;
  status_url_method?: 'GET' | 'POST' | SWMLVar;
  timeout?: number | SWMLVar;
  to: string | SWMLVar;
  username?: string | SWMLVar;
  webrtc_media?: boolean | SWMLVar;
  [key: string]:
    | Record<string, unknown>
    | string
    | SWMLVar
    | string[]
    | SWMLVar
    | string
    | unknown[]
    | string
    | SWMLMethod[]
    | {
        code: Record<string, unknown>;
        meta?: unknown;
        [key: string]: Record<string, unknown> | unknown | undefined;
      }
    | SWMLVar
    | number
    | SWMLVar
    | Record<string, string>
    | SWMLVar
    | 'mandatory'
    | 'optional'
    | 'forbidden'
    | SWMLVar
    | ConnectHeaders[]
    | boolean
    | SWMLVar
    | 'GET'
    | 'POST'
    | SWMLVar
    | undefined;
}

export interface ClearDigitBindings {
  /** Clear all digit bindings. */
  clear_digit_bindings: {
    realm?: string;
    [key: string]: Record<string, unknown> | string | undefined;
  };
  [key: string]:
    | Record<string, unknown>
    | {
        realm?: string;
        [key: string]: Record<string, unknown> | string | undefined;
      };
}

export interface CallDeviceStream {
  authorization_bearer_token?: string | SWMLVar;
  codec?: string | SWMLVar;
  custom_parameters?: unknown;
  name?: string | SWMLVar;
  realtime?: boolean | SWMLVar;
  status_url?: string | SWMLVar;
  status_url_method?: 'GET' | 'POST' | SWMLVar;
  url: string | SWMLVar;
  [key: string]:
    | Record<string, unknown>
    | string
    | SWMLVar
    | unknown
    | boolean
    | SWMLVar
    | 'GET'
    | 'POST'
    | SWMLVar
    | undefined;
}

export interface BindDigit {
  /** Bind DTMF digit actions. */
  bind_digit: {
    digits: string;
    max_triggers?: number | SWMLVar;
    method: string;
    params?: Record<string, unknown>;
    realm?: string;
    [key: string]: Record<string, unknown> | string | number | SWMLVar | undefined;
  };
  [key: string]:
    | Record<string, unknown>
    | {
        digits: string;
        max_triggers?: number | SWMLVar;
        method: string;
        params?: Record<string, unknown>;
        realm?: string;
        [key: string]: Record<string, unknown> | string | number | SWMLVar | undefined;
      };
}

export interface AiSidecar {
  /** Body shape enforced by check_method_type_and_unknown_params, swml_schema.c:911. */
  ai_sidecar:
    | {
        /** SWAIG functions and MCP servers available to the sidecar. */
        SWAIG?:
          | {
              defaults?:
                | {
                    web_hook_auth_pass?: string | SWMLVar;
                    web_hook_auth_password?: string | SWMLVar;
                    web_hook_auth_user?: string | SWMLVar;
                    web_hook_url?: string | SWMLVar;
                  }
                | SWMLVar;
              functions?:
                | (
                    | {
                        description?: string | SWMLVar;
                        function?: string | SWMLVar;
                        parameters?: FunctionParameters | SWMLVar;
                        purpose?: string | SWMLVar;
                        web_hook_auth_pass?: string | SWMLVar;
                        web_hook_auth_password?: string | SWMLVar;
                        web_hook_auth_user?: string | SWMLVar;
                        web_hook_url?: string | SWMLVar;
                      }
                    | SWMLVar
                  )[]
                | SWMLVar;
              mcp_servers?: unknown[] | SWMLVar;
            }
          | SWMLVar;
        /** Summarize the conversation instead of starting a sidecar. When you include `action.summarize`, */
        action?: Record<string, unknown> | SWMLVar;
        /** Which leg is the customer, used as the turn-end trigger source. **Default:** `remote-caller`. */
        customer_role?: string | SWMLVar;
        /** The call legs to observe. Both legs are required — a single-leg value is rejected. When omitted, both legs are observed. **Default:** both legs (`remote-caller` and `local-caller`). */
        direction?: (string | SWMLVar)[] | SWMLVar;
        /** A key-value object of data that is available throughout the sidecar session. You can reference it in the prompt with variable expansion, and it is included in the requests sent to your tools. */
        global_data?: Record<string, unknown> | SWMLVar;
        /** Hints that improve speech recognition of specific terms, such as product names, competitor names, jargon, or customer names. Strongly recommended. */
        hints?: (string | SWMLVar)[] | SWMLVar;
        /** The conversation language as a single BCP-47 tag. Sets the speech recognition language and is shared with the model as a hint. */
        lang?: string | SWMLVar;
        /** The model used for the sidecar's advice and its end-of-call summaries. Suggested values: `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1-nano`. **Default:** `gpt-4o-mini`. */
        model?: string | SWMLVar;
        /** Tuning options for the sidecar. */
        params?:
          | {
              act_on_channel?: boolean | SWMLVar;
              ai_summary?: boolean | SWMLVar;
              ai_summary_prompt?: string | SWMLVar;
              debug?: boolean | SWMLVar;
              debug_level?: number | SWMLVar;
              deepgram_key_override?: string | SWMLVar;
              deepgram_url_override?: string | SWMLVar;
              final_summary?: boolean | SWMLVar;
              idle_timeout_ms?: number | SWMLVar;
              live_events?: boolean | SWMLVar;
              max_history_tokens?: number | SWMLVar;
              max_iters_per_tick?: number | SWMLVar;
              min_interval_ms?: number | SWMLVar;
              speech_engine?: string | SWMLVar;
              speech_timeout?: number | SWMLVar;
              summary_model?: string | SWMLVar;
              transcribe_prompt?: string | SWMLVar;
              vad_silence_ms?: number | SWMLVar;
              vad_thresh?: number | SWMLVar;
              verbose_utterances?: boolean | SWMLVar;
            }
          | SWMLVar;
        /** SWAIG permission overrides. Defaults to all permissions enabled. */
        permissions?:
          | {
              swaig_allow_settings?: boolean | SWMLVar;
              swaig_allow_swml?: boolean | SWMLVar;
              swaig_set_global_data?: boolean | SWMLVar;
            }
          | SWMLVar;
        /** The prompt used to write the summary. May be given as a string, or as an object with a `file` key naming a file to read it from. Defaults to `Be helpful.` */
        prompt?:
          | {
              file?: string | SWMLVar;
            }
          | string
          | SWMLVar;
        /** The webhook URL the sidecar POSTs its callbacks to. Receives both transcription events and sidecar callbacks. */
        url?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | {
              defaults?:
                | {
                    web_hook_auth_pass?: string | SWMLVar;
                    web_hook_auth_password?: string | SWMLVar;
                    web_hook_auth_user?: string | SWMLVar;
                    web_hook_url?: string | SWMLVar;
                  }
                | SWMLVar;
              functions?:
                | (
                    | {
                        description?: string | SWMLVar;
                        function?: string | SWMLVar;
                        parameters?: FunctionParameters | SWMLVar;
                        purpose?: string | SWMLVar;
                        web_hook_auth_pass?: string | SWMLVar;
                        web_hook_auth_password?: string | SWMLVar;
                        web_hook_auth_user?: string | SWMLVar;
                        web_hook_url?: string | SWMLVar;
                      }
                    | SWMLVar
                  )[]
                | SWMLVar;
              mcp_servers?: unknown[] | SWMLVar;
            }
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | string
          | SWMLVar
          | (string | SWMLVar)[]
          | SWMLVar
          | {
              act_on_channel?: boolean | SWMLVar;
              ai_summary?: boolean | SWMLVar;
              ai_summary_prompt?: string | SWMLVar;
              debug?: boolean | SWMLVar;
              debug_level?: number | SWMLVar;
              deepgram_key_override?: string | SWMLVar;
              deepgram_url_override?: string | SWMLVar;
              final_summary?: boolean | SWMLVar;
              idle_timeout_ms?: number | SWMLVar;
              live_events?: boolean | SWMLVar;
              max_history_tokens?: number | SWMLVar;
              max_iters_per_tick?: number | SWMLVar;
              min_interval_ms?: number | SWMLVar;
              speech_engine?: string | SWMLVar;
              speech_timeout?: number | SWMLVar;
              summary_model?: string | SWMLVar;
              transcribe_prompt?: string | SWMLVar;
              vad_silence_ms?: number | SWMLVar;
              vad_thresh?: number | SWMLVar;
              verbose_utterances?: boolean | SWMLVar;
            }
          | SWMLVar
          | {
              swaig_allow_settings?: boolean | SWMLVar;
              swaig_allow_swml?: boolean | SWMLVar;
              swaig_set_global_data?: boolean | SWMLVar;
            }
          | SWMLVar
          | {
              file?: string | SWMLVar;
            }
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
  [key: string]:
    | Record<string, unknown>
    | {
        /** SWAIG functions and MCP servers available to the sidecar. */
        SWAIG?:
          | {
              defaults?:
                | {
                    web_hook_auth_pass?: string | SWMLVar;
                    web_hook_auth_password?: string | SWMLVar;
                    web_hook_auth_user?: string | SWMLVar;
                    web_hook_url?: string | SWMLVar;
                  }
                | SWMLVar;
              functions?:
                | (
                    | {
                        description?: string | SWMLVar;
                        function?: string | SWMLVar;
                        parameters?: FunctionParameters | SWMLVar;
                        purpose?: string | SWMLVar;
                        web_hook_auth_pass?: string | SWMLVar;
                        web_hook_auth_password?: string | SWMLVar;
                        web_hook_auth_user?: string | SWMLVar;
                        web_hook_url?: string | SWMLVar;
                      }
                    | SWMLVar
                  )[]
                | SWMLVar;
              mcp_servers?: unknown[] | SWMLVar;
            }
          | SWMLVar;
        /** Summarize the conversation instead of starting a sidecar. When you include `action.summarize`, */
        action?: Record<string, unknown> | SWMLVar;
        /** Which leg is the customer, used as the turn-end trigger source. **Default:** `remote-caller`. */
        customer_role?: string | SWMLVar;
        /** The call legs to observe. Both legs are required — a single-leg value is rejected. When omitted, both legs are observed. **Default:** both legs (`remote-caller` and `local-caller`). */
        direction?: (string | SWMLVar)[] | SWMLVar;
        /** A key-value object of data that is available throughout the sidecar session. You can reference it in the prompt with variable expansion, and it is included in the requests sent to your tools. */
        global_data?: Record<string, unknown> | SWMLVar;
        /** Hints that improve speech recognition of specific terms, such as product names, competitor names, jargon, or customer names. Strongly recommended. */
        hints?: (string | SWMLVar)[] | SWMLVar;
        /** The conversation language as a single BCP-47 tag. Sets the speech recognition language and is shared with the model as a hint. */
        lang?: string | SWMLVar;
        /** The model used for the sidecar's advice and its end-of-call summaries. Suggested values: `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-4.1-nano`. **Default:** `gpt-4o-mini`. */
        model?: string | SWMLVar;
        /** Tuning options for the sidecar. */
        params?:
          | {
              act_on_channel?: boolean | SWMLVar;
              ai_summary?: boolean | SWMLVar;
              ai_summary_prompt?: string | SWMLVar;
              debug?: boolean | SWMLVar;
              debug_level?: number | SWMLVar;
              deepgram_key_override?: string | SWMLVar;
              deepgram_url_override?: string | SWMLVar;
              final_summary?: boolean | SWMLVar;
              idle_timeout_ms?: number | SWMLVar;
              live_events?: boolean | SWMLVar;
              max_history_tokens?: number | SWMLVar;
              max_iters_per_tick?: number | SWMLVar;
              min_interval_ms?: number | SWMLVar;
              speech_engine?: string | SWMLVar;
              speech_timeout?: number | SWMLVar;
              summary_model?: string | SWMLVar;
              transcribe_prompt?: string | SWMLVar;
              vad_silence_ms?: number | SWMLVar;
              vad_thresh?: number | SWMLVar;
              verbose_utterances?: boolean | SWMLVar;
            }
          | SWMLVar;
        /** SWAIG permission overrides. Defaults to all permissions enabled. */
        permissions?:
          | {
              swaig_allow_settings?: boolean | SWMLVar;
              swaig_allow_swml?: boolean | SWMLVar;
              swaig_set_global_data?: boolean | SWMLVar;
            }
          | SWMLVar;
        /** The prompt used to write the summary. May be given as a string, or as an object with a `file` key naming a file to read it from. Defaults to `Be helpful.` */
        prompt?:
          | {
              file?: string | SWMLVar;
            }
          | string
          | SWMLVar;
        /** The webhook URL the sidecar POSTs its callbacks to. Receives both transcription events and sidecar callbacks. */
        url?: string | SWMLVar;
        [key: string]:
          | Record<string, unknown>
          | {
              defaults?:
                | {
                    web_hook_auth_pass?: string | SWMLVar;
                    web_hook_auth_password?: string | SWMLVar;
                    web_hook_auth_user?: string | SWMLVar;
                    web_hook_url?: string | SWMLVar;
                  }
                | SWMLVar;
              functions?:
                | (
                    | {
                        description?: string | SWMLVar;
                        function?: string | SWMLVar;
                        parameters?: FunctionParameters | SWMLVar;
                        purpose?: string | SWMLVar;
                        web_hook_auth_pass?: string | SWMLVar;
                        web_hook_auth_password?: string | SWMLVar;
                        web_hook_auth_user?: string | SWMLVar;
                        web_hook_url?: string | SWMLVar;
                      }
                    | SWMLVar
                  )[]
                | SWMLVar;
              mcp_servers?: unknown[] | SWMLVar;
            }
          | SWMLVar
          | Record<string, unknown>
          | SWMLVar
          | string
          | SWMLVar
          | (string | SWMLVar)[]
          | SWMLVar
          | {
              act_on_channel?: boolean | SWMLVar;
              ai_summary?: boolean | SWMLVar;
              ai_summary_prompt?: string | SWMLVar;
              debug?: boolean | SWMLVar;
              debug_level?: number | SWMLVar;
              deepgram_key_override?: string | SWMLVar;
              deepgram_url_override?: string | SWMLVar;
              final_summary?: boolean | SWMLVar;
              idle_timeout_ms?: number | SWMLVar;
              live_events?: boolean | SWMLVar;
              max_history_tokens?: number | SWMLVar;
              max_iters_per_tick?: number | SWMLVar;
              min_interval_ms?: number | SWMLVar;
              speech_engine?: string | SWMLVar;
              speech_timeout?: number | SWMLVar;
              summary_model?: string | SWMLVar;
              transcribe_prompt?: string | SWMLVar;
              vad_silence_ms?: number | SWMLVar;
              vad_thresh?: number | SWMLVar;
              verbose_utterances?: boolean | SWMLVar;
            }
          | SWMLVar
          | {
              swaig_allow_settings?: boolean | SWMLVar;
              swaig_allow_swml?: boolean | SWMLVar;
              swaig_set_global_data?: boolean | SWMLVar;
            }
          | SWMLVar
          | {
              file?: string | SWMLVar;
            }
          | string
          | SWMLVar
          | undefined;
      }
    | unknown[]
    | number
    | string;
}

export interface RelayIsReset {
  full_reset?: unknown;
  system_prompt?: unknown;
  user_prompt?: unknown;
}

export type RelayCallPlayInner =
  | {
      params?: RelayCallPlayAudio;
      type: 'audio';
    }
  | {
      params?: RelayCallPlayTts;
      type: 'tts';
    }
  | {
      params?: RelayCallPlaySilence;
      type: 'silence';
    }
  | {
      params?: RelayCallPlayRingtone;
      type: 'ringtone';
    };

export interface RelayCallPlayAudio {
  url: string;
}

export interface RelayCallPlayTts {
  gender?: 'male' | 'female';
  language?: string;
  text: string;
  voice?: string;
}

export interface RelayCallPlaySilence {
  duration: number;
}

export interface RelayCallPlayRingtone {
  duration?: number;
  name:
    | 'au'
    | 'be'
    | 'ca'
    | 'cn'
    | 'cy'
    | 'cz'
    | 'de'
    | 'dk'
    | 'dz'
    | 'eg'
    | 'es'
    | 'fi'
    | 'fr'
    | 'hu'
    | 'il'
    | 'in'
    | 'jp'
    | 'ko'
    | 'pk'
    | 'pl'
    | 'ro'
    | 'rs'
    | 'ru'
    | 'sa'
    | 'tr'
    | 'uk'
    | 'us'
    | 'at'
    | 'bg'
    | 'br'
    | 'ch'
    | 'cl'
    | 'ee'
    | 'gr'
    | 'it'
    | 'lt'
    | 'mx'
    | 'my'
    | 'nl'
    | 'no'
    | 'nz'
    | 'ph'
    | 'pt'
    | 'se'
    | 'sg'
    | 'th'
    | 'za'
    | 'tw'
    | 've'
    | 'bong';
}

export interface RelayCallRecordInner {
  audio: RelayCallRecordAudio;
}

export interface RelayCallRecordAudio {
  beep?: boolean;
  direction?: 'listen' | 'speak' | 'both';
  end_silence_timeout?: number;
  format?: 'mp3' | 'wav' | 'mp4';
  initial_timeout?: number;
  input_sensitivity?: number;
  max_length?: number;
  stereo?: boolean;
  terminators?: string;
}

export interface RelayCallCollectDigitsInner {
  digit_timeout?: number;
  max: number;
  terminators?: string;
}

export interface RelayCallCollectSpeechInner {
  /** Server default 0.5, a value the validator itself would reject: it tests the integer part of the number. */
  end_silence_timeout?: number;
  engine?: 'Google' | 'Google.V2' | 'Deepgram';
  hints?: string[];
  language?: string;
  model?: string;
  speech_timeout?: number;
}

export type RelayCallDetectInner =
  | {
      params?: RelayCallDetectFax;
      type?: 'fax';
    }
  | {
      params?: RelayCallDetectMachine;
      type?: 'machine';
    }
  | {
      params?: RelayCallDetectDigit;
      type?: 'digit';
    };

export interface RelayCallDetectFax {
  tone?: 'CNG' | 'CED' | 'cng' | 'ced';
}

export interface RelayCallDetectMachine {
  detect_interruptions?: boolean;
  detect_message_end?: boolean;
  end_silence_timeout?: number;
  initial_timeout?: number;
  machine_ready_timeout?: number;
  machine_voice_threshold?: number;
  machine_words_threshold?: number;
}

export interface RelayCallDetectDigit {
  digits?: string;
}

export type RelayCallTapDevice =
  | {
      params?: RelayCallTapDeviceRtp;
      type: 'rtp';
    }
  | {
      params?: RelayCallTapDeviceWs;
      type: 'ws';
    };

export interface RelayCallTapDeviceRtp {
  addr: string;
  codec?: 'PCMA' | 'PCMU' | 'pcma' | 'pcmu' | 'OPUS' | 'opus';
  port: number;
  ptime?: number;
}

export interface RelayCallTapDeviceWs {
  codec?: 'PCMA' | 'PCMU' | 'pcma' | 'pcmu' | 'OPUS' | 'opus';
  uri: string;
}

export interface RelayTap {
  params: RelayAudioTapParams;
  type: 'audio';
}

export interface RelayAudioTapParams {
  direction: 'listen' | 'speak' | 'both';
}

export interface RelayCallReferDevice {
  params?: RelayCallReferDeviceSip;
  type: 'sip';
}

export interface RelayCallReferDeviceSip {
  from?: string;
  password?: string;
  to: string;
  username?: string;
}
