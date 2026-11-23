// AUTO-GENERATED from porting-sdk/rest-apis/calling/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

export interface AI {
  /** Creates an AI agent that conducts voice conversations using automatic speech recognition (ASR), */
  ai: AIObject;
}

export interface AIObject {
  /** A key-value object for storing data that persists throughout the AI session. */
  global_data?: Record<string, unknown>;
  /** Hints help the AI agent understand certain words or phrases better. Words that can commonly be misinterpreted can be added to the hints to help the AI speak more accurately. */
  hints?: (string | Hint)[];
  /** An array of JSON objects defining supported languages in the conversation. */
  languages?: Languages[];
  /** A JSON object containing parameters as key-value pairs. */
  params?: AIParams;
  /** The final set of instructions and configuration settings to send to the agent. */
  post_prompt?: AIPostPrompt;
  /** The URL to which to send status callbacks and reports. Authentication can also be set in the url in the format of `username:password@url`. */
  post_prompt_url?: string;
  /** An array of JSON objects to clarify the AI's pronunciation of words or expressions. */
  pronounce?: Pronounce[];
  /** Defines the AI agent's personality, goals, behaviors, and instructions for handling conversations. */
  prompt: AIPrompt;
  /** An array of JSON objects to create user-defined functions/endpoints that can be executed during the dialogue. */
  SWAIG?: SWAIG;
}

export interface AIParams {
  /** Instructs the agent to acknowledge crosstalk and confirm user input when the user speaks over the agent. */
  acknowledge_interruptions?: boolean | SWMLVar;
  /** The model to use for the AI. Allowed values are `gpt-4o-mini`, `gpt-4.1-mini`, and `gpt-4.1-nano`. */
  ai_model?: 'gpt-4o-mini' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | string;
  /** Sets the name the AI agent responds to for wake/activation purposes. When using `enable_pause`, `start_paused`, or `speak_when_spoken_to`, the user must say this name to get the agent's attention. The name matching is case-insensitive. */
  ai_name?: string;
  /** Adjust the volume of the AI. Allowed values from `-50` - `50`. **Default:** `0`. */
  ai_volume?: number | SWMLVar;
  /** A custom identifier for the AI application instance. This name is included in webhook payloads, allowing backend systems to identify which AI configuration made the request. */
  app_name?: string;
  /** If true, enables smart formatting in ASR (Automatic Speech Recognition). */
  asr_smart_format?: boolean | SWMLVar;
  /** Amount of time, in ms, to wait before prompting the user to respond. Allowed values from `10,000` - `600,000`. Set to `0` to disable. **Default:** `5000` ms (note: user-configurable values must be `0` or within the `10,000` - `600,000` range). */
  attention_timeout?: AttentionTimeout | 0 | SWMLVar;
  /** A custom prompt that is fed into the AI when the attention_timeout is reached. */
  attention_timeout_prompt?: string;
  /** If true, enables speaker diarization in ASR (Automatic Speech Recognition). */
  asr_diarize?: boolean | SWMLVar;
  /** If true, will force the AI Agent to only respond to the speaker who reesponds to the AI Agent first. */
  asr_speaker_affinity?: boolean | SWMLVar;
  /** URL of audio file to play in the background while AI plays in foreground. */
  background_file?: string;
  /** Maximum number of times to loop playing the background file. `undefined` means loop indefinitely. */
  background_file_loops?: number | null | SWMLVar;
  /** Defines background_file volume within a range of `-50` to `50`. **Default:** `0`. */
  background_file_volume?: number | SWMLVar;
  /** Controls the barge behavior. Allowed values are `"complete"`, `"partial"`, `"all"`, or boolean. */
  enable_barge?: string | boolean | SWMLVar;
  /** Enables the inner dialog feature, which runs a separate AI process in the background */
  enable_inner_dialog?: boolean | SWMLVar;
  /** Enables the pause/resume functionality for the AI agent. When enabled, a `pause_conversation` */
  enable_pause?: boolean | SWMLVar;
  /** Enables intelligent turn detection that monitors partial speech transcripts for sentence-ending */
  enable_turn_detection?: boolean | SWMLVar;
  /** Takes a string, including a regular expression, defining barge behavior. */
  barge_match_string?: string;
  /** Defines the number of words that must be input before triggering barge behavior, in a range of `1-99`. */
  barge_min_words?: number | SWMLVar;
  /** If `true`, allows functions to be executed while the AI is being interrupted. **Default:** `true`. */
  barge_functions?: boolean | SWMLVar;
  /** Sets the prompt which binds the agent to its purpose. */
  conscience?: string;
  /** Injects pre-existing conversation history into the AI session at startup. This allows you to seed the AI agent with context from a previous conversation or provide example interactions. */
  convo?: ConversationMessage[];
  /** Used by `check_for_input` and `save_conversation` to identify an individual conversation. */
  conversation_id?: string;
  /** Sets the size of the sliding window for conversation history. This limits how much conversation history is sent to the AI model. */
  conversation_sliding_window?: number | SWMLVar;
  /** Enables debugging to the set URL. Allowed values from `0` - `2`. Default is `1` if url is set. */
  debug_webhook_level?: number | SWMLVar;
  /** Each interaction between the AI and end user is posted in real time to the established URL. */
  debug_webhook_url?: string;
  /** Enables debug mode for the AI session. When enabled, additional diagnostic information is logged including turn detection events, speech processing details, and internal state changes. */
  debug?: boolean | number | SWMLVar;
  /** Forces the direction of the call to the assistant. Valid values are `inbound` and `outbound`. */
  direction?: Direction | SWMLVar;
  /** DTMF digit, as a string, to signal the end of input (ex: '#') */
  digit_terminators?: string;
  /** Time, in ms, at the end of digit input to detect end of input. Allowed values from `0` - `30,000`. **Default:** `3000` ms. */
  digit_timeout?: number | SWMLVar;
  /** Amount of silence, in ms, at the end of an utterance to detect end of speech. Allowed values from `250` - `10,000`. **Default:** `700` ms. */
  end_of_speech_timeout?: number | SWMLVar;
  /** Enables thinking output for the AI Agent. */
  enable_thinking?: boolean | SWMLVar;
  /** Enables visual input processing for the AI Agent. */
  enable_vision?: boolean | SWMLVar;
  /** Amount of energy necessary for bot to hear you (in dB). Allowed values from `0.0` - `100.0`. **Default:** `52.0` dB. */
  energy_level?: number | SWMLVar;
  /** Amount of time, in ms, to wait for the first word after speech is detected. Allowed values from `0` - `10,000`. **Default:** `1000` ms. */
  first_word_timeout?: number | SWMLVar;
  /** If `true`, the AI will wait for any `filler` to finish playing before executing a function. */
  function_wait_for_talking?: boolean | SWMLVar;
  /** If `true`, functions can be executed when there is no user response after a timeout. **Default:** `false`. */
  functions_on_no_response?: boolean | SWMLVar;
  /** A final prompt that is fed into the AI when the `hard_stop_time` is reached. */
  hard_stop_prompt?: string;
  /** Specifies the maximum duration fopr the AI Agent to remain active before it exists the session. */
  hard_stop_time?: string | SWMLVar;
  /** A URL for the hold music to play, accepting WAV, mp3, and FreeSWITCH tone_stream. */
  hold_music?: string;
  /** Enables hold music during SWAIG processing. */
  hold_on_process?: boolean | SWMLVar;
  /** Amount of time, in ms, to wait before exiting the app due to inactivity. Allowed values from `10,000` - `3,600,000`. **Default:** `600000` ms (10 minutes). */
  inactivity_timeout?: number | SWMLVar;
  /** Specifies the AI model to use for the inner dialog feature. Can be set to a different (often smaller/faster) model than the main conversation model. Only used when `enable_inner_dialog` is `true`. */
  inner_dialog_model?: 'gpt-4o-mini' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | string;
  /** The system prompt that guides the inner dialog AI's behavior. This prompt shapes how the background AI */
  inner_dialog_prompt?: string;
  /** When enabled, synchronizes the inner dialog with the main conversation flow. */
  inner_dialog_synced?: boolean | SWMLVar;
  /** Amount of time, in ms, to wait before starting the conversation. Allowed values from `0` - `300,000`. */
  initial_sleep_ms?: number | SWMLVar;
  /** Check for input function with check_for_input. */
  input_poll_freq?: number | SWMLVar;
  /** When enabled, barges agent upon any sound interruption longer than 1 second. */
  interrupt_on_noise?: boolean | SWMLVar;
  /** Provide a prompt for the agent to handle crosstalk. */
  interrupt_prompt?: string;
  /** @deprecated Allows multilingualism when `true`. */
  languages_enabled?: boolean | SWMLVar;
  /** The local timezone setting for the AI. Value should use `IANA TZ ID` */
  local_tz?: string;
  /** If true, the AI Agent will be involved with the diarization process. */
  llm_diarize_aware?: boolean | SWMLVar;
  /** Sets the maximum emotion intensity for the AI voice. Allowed values from `1` - `30`. **Default:** `30`. */
  max_emotion?: number | SWMLVar;
  /** Sets the maximum number of tokens the AI model can generate in a single response. Lower values produce shorter responses and reduce latency. */
  max_response_tokens?: number | SWMLVar;
  /** The ASR (Automatic Speech Recognition) engine to use. Common values include `nova-2` and `nova-3`. */
  openai_asr_engine?: string;
  /** Sets a time duration for the outbound call recipient to respond to the AI agent before timeout, in a range from `10000` to `600000`. **Default:** `120000` ms (2 minutes). */
  outbound_attention_timeout?: number | SWMLVar;
  /** When enabled, the `global_data` object is automatically saved to a channel variable */
  persist_global_data?: boolean | SWMLVar;
  /** Specifies the output format for structured prompts when using the `pom` array in prompt definitions. Valid values are `markdown` or `xml`. */
  pom_format?: 'markdown' | 'xml';
  /** Send a summary of the conversation after the call ends. */
  save_conversation?: boolean | SWMLVar;
  /** Amount of time, in ms, to wait for a speech event. Allowed values from `0` - `10,000`. **Default:** `1400` ms. */
  speech_event_timeout?: number | SWMLVar;
  /** Number of quick stops to generate for speech. Allowed values from `0` - `10`. **Default:** `3`. */
  speech_gen_quick_stops?: number | SWMLVar;
  /** Overall speech timeout, in ms. Allowed values from `0` - `600,000`. **Default:** `60000` ms. */
  speech_timeout?: number | SWMLVar;
  /** When enabled, the AI agent remains silent until directly addressed by name (using `ai_name`). */
  speak_when_spoken_to?: boolean | SWMLVar;
  /** When enabled, the AI agent starts in a paused state and will not respond until the user */
  start_paused?: boolean | SWMLVar;
  /** The static greeting to play when the call is answered. This will always play at the beginning of the call. */
  static_greeting?: string;
  /** If `true`, the static greeting will not be interrupted by the user if they speak over the greeting. If `false`, the static greeting can be interrupted by the user if they speak over the greeting. */
  static_greeting_no_barge?: boolean | SWMLVar;
  /** Defines the mode for summary generation. Allowed values are `"string"` and `"original"`. */
  summary_mode?: 'string' | 'original' | SWMLVar;
  /** Allows tweaking any of the indicated settings, such as `barge_match_string`, using the returned SWML from the SWAIG function. **Default:** `true`. */
  swaig_allow_settings?: boolean | SWMLVar;
  /** Allows your SWAIG to return SWML to be executed. **Default:** `true`. */
  swaig_allow_swml?: boolean | SWMLVar;
  /** Post entire conversation to any SWAIG call. */
  swaig_post_conversation?: boolean | SWMLVar;
  /** Allows SWAIG to set global data that persists across calls. **Default:** `true`. */
  swaig_set_global_data?: boolean | SWMLVar;
  /** Controls whether SWML variables are included in SWAIG function webhook payloads. */
  swaig_post_swml_vars?: boolean | string[] | SWMLVar;
  /** The model to use for the AI's thinking capabilities. Allowed values are `gpt-4o-mini`, `gpt-4.1-mini`, and `gpt-4.1-nano`. */
  thinking_model?: 'gpt-4o-mini' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | string;
  /** When enabled, the AI will not respond to the user's input when the user is speaking over the agent. */
  transparent_barge?: boolean | SWMLVar;
  /** Maximum time, in ms, for transparent barge mode. Allowed values from `0` - `60,000`. **Default:** `3000` ms. */
  transparent_barge_max_time?: number | SWMLVar;
  /** Pass a summary of a conversation from one AI agent to another. For example, transfer a call summary between support agents in two departments. */
  transfer_summary?: boolean | SWMLVar;
  /** Time in milliseconds to wait after detecting a potential end-of-turn before finalizing speech recognition. */
  turn_detection_timeout?: number | SWMLVar;
  /** The format for the AI agent to reference phone numbers. */
  tts_number_format?: 'international' | 'national';
  /** URL of a video file to play when AI is listening to the user speak. Only works for calls that support video. */
  video_listening_file?: string;
  /** URL of a video file to play when AI is idle. Only works for calls that support video. */
  video_idle_file?: string;
  /** URL of a video file to play when AI is talking. Only works for calls that support video. */
  video_talking_file?: string;
  /** The model to use for the AI's vision capabilities. Allowed values are `gpt-4o-mini`, `gpt-4.1-mini`, and `gpt-4.1-nano`. */
  vision_model?: 'gpt-4o-mini' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | string;
  /** Configures Silero Voice Activity Detection (VAD) settings. Format: `"threshold"` or `"threshold:frame_ms"`. */
  vad_config?: string;
  /** When false, AI agent will initialize dialogue after call is setup. When true, agent will wait for the user to speak first. */
  wait_for_user?: boolean | SWMLVar;
  /** Specifies an additional prefix that must be spoken along with the agent's name (`ai_name`) */
  wake_prefix?: string;
  /** The stability slider determines how stable the voice is and the randomness between each generation. Lowering this slider introduces a broader emotional range for the voice. */
  eleven_labs_stability?: number | SWMLVar;
  /** The similarity slider dictates how closely the AI should adhere to the original voice when attempting to replicate it. The higher the similarity, the closer the AI will sound to the original voice. */
  eleven_labs_similarity?: number | SWMLVar;
  [key: string]: unknown;
}

export type AIPostPrompt = AIPostPromptText | AIPostPromptPom;

export interface AIPostPromptPom {
  /** Limits the amount of tokens that the AI agent may generate when creating its response */
  max_tokens?: number;
  /** Randomness setting. Float value between 0.0 and 1.5. Closer to 0 will make the output less random. **Default:** `1.0`. */
  temperature?: number | SWMLVar;
  /** Randomness setting. Alternative to `temperature`. Float value between 0.0 and 1.0. Closer to 0 will make the output less random. **Default:** `1.0`. */
  top_p?: number | SWMLVar;
  /** Threshold to fire a speech-detect event at the end of the utterance. Float value between 0.0 and 1.0. */
  confidence?: number | SWMLVar;
  /** Aversion to staying on topic. Float value between -2.0 and 2.0. Positive values increase the model's likelihood to talk about new topics. **Default:** `0`. */
  presence_penalty?: number | SWMLVar;
  /** Aversion to repeating lines. Float value between -2.0 and 2.0. Positive values decrease the model's likelihood to repeat the same line verbatim. **Default:** `0`. */
  frequency_penalty?: number | SWMLVar;
  /** The instructions to send to the agent. */
  pom: POM[];
}

export interface AIPostPromptText {
  /** Limits the amount of tokens that the AI agent may generate when creating its response */
  max_tokens?: number;
  /** Randomness setting. Float value between 0.0 and 1.5. Closer to 0 will make the output less random. **Default:** `1.0`. */
  temperature?: number | SWMLVar;
  /** Randomness setting. Alternative to `temperature`. Float value between 0.0 and 1.0. Closer to 0 will make the output less random. **Default:** `1.0`. */
  top_p?: number | SWMLVar;
  /** Threshold to fire a speech-detect event at the end of the utterance. Float value between 0.0 and 1.0. */
  confidence?: number | SWMLVar;
  /** Aversion to staying on topic. Float value between -2.0 and 2.0. Positive values increase the model's likelihood to talk about new topics. **Default:** `0`. */
  presence_penalty?: number | SWMLVar;
  /** Aversion to repeating lines. Float value between -2.0 and 2.0. Positive values decrease the model's likelihood to repeat the same line verbatim. **Default:** `0`. */
  frequency_penalty?: number | SWMLVar;
  /** The instructions to send to the agent. */
  text: string;
}

export type AIPrompt = AIPromptText | AIPromptPom;

export interface AIPromptPom {
  /** Limits the amount of tokens that the AI agent may generate when creating its response */
  max_tokens?: number;
  /** Randomness setting. Float value between 0.0 and 1.5. Closer to 0 will make the output less random. **Default:** `1.0`. */
  temperature?: number | SWMLVar;
  /** Randomness setting. Alternative to `temperature`. Float value between 0.0 and 1.0. Closer to 0 will make the output less random. **Default:** `1.0`. */
  top_p?: number | SWMLVar;
  /** Threshold to fire a speech-detect event at the end of the utterance. Float value between 0.0 and 1.0. */
  confidence?: number | SWMLVar;
  /** Aversion to staying on topic. Float value between -2.0 and 2.0. Positive values increase the model's likelihood to talk about new topics. **Default:** `0`. */
  presence_penalty?: number | SWMLVar;
  /** Aversion to repeating lines. Float value between -2.0 and 2.0. Positive values decrease the model's likelihood to repeat the same line verbatim. **Default:** `0`. */
  frequency_penalty?: number | SWMLVar;
  /** Prompt Object Model (POM) is a structured data format for composing, organizing, and rendering prompt instructions for AI agents. */
  pom: POM[];
  /** An object that defines the context steps for the AI. The context steps are used to define the flow of the conversation. */
  contexts?: Contexts;
}

export interface AIPromptText {
  /** Limits the amount of tokens that the AI agent may generate when creating its response */
  max_tokens?: number;
  /** Randomness setting. Float value between 0.0 and 1.5. Closer to 0 will make the output less random. **Default:** `1.0`. */
  temperature?: number | SWMLVar;
  /** Randomness setting. Alternative to `temperature`. Float value between 0.0 and 1.0. Closer to 0 will make the output less random. **Default:** `1.0`. */
  top_p?: number | SWMLVar;
  /** Threshold to fire a speech-detect event at the end of the utterance. Float value between 0.0 and 1.0. */
  confidence?: number | SWMLVar;
  /** Aversion to staying on topic. Float value between -2.0 and 2.0. Positive values increase the model's likelihood to talk about new topics. **Default:** `0`. */
  presence_penalty?: number | SWMLVar;
  /** Aversion to repeating lines. Float value between -2.0 and 2.0. Positive values decrease the model's likelihood to repeat the same line verbatim. **Default:** `0`. */
  frequency_penalty?: number | SWMLVar;
  /** The instructions to send to the agent. */
  text: string;
  /** An object that defines the context steps for the AI. The context steps are used to define the flow of the conversation. */
  contexts?: Contexts;
}

export type Action =
  | SWMLAction
  | ChangeContextAction
  | ChangeStepAction
  | ContextSwitchAction
  | HangupAction
  | HoldAction
  | PlaybackBGAction
  | SayAction
  | SetGlobalDataAction
  | SetMetaDataAction
  | StopAction
  | StopPlaybackBGAction
  | ToggleFunctionsAction
  | UnsetGlobalDataAction
  | UnsetMetaDataAction
  | UserInputAction;

export interface AllOfProperty {
  /** An array of schemas where all of the schemas must be valid. */
  allOf: SchemaType[];
}

export interface AmazonBedrock {
  /** Creates a new Bedrock AI Agent */
  amazon_bedrock: AmazonBedrockObject;
}

export interface AmazonBedrockObject {
  /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script */
  global_data?: Record<string, unknown>;
  /** A JSON object containing parameters as key-value pairs. */
  params?: BedrockParams;
  /** The final set of instructions and configuration settings to send to the agent. */
  post_prompt?: BedrockPostPrompt;
  /** The URL to which to send status callbacks and reports. Authentication can also be set in the url in the format of `username:password@url`. */
  post_prompt_url?: string;
  /** Establishes the initial set of instructions and settings to configure the agent. */
  prompt: BedrockPrompt;
  /** An array of JSON objects to create user-defined functions/endpoints that can be executed during the dialogue. */
  SWAIG?: BedrockSWAIG;
}

export interface Answer {
  /** Answer incoming call and set an optional maximum duration. */
  answer: {
    /** Maximum duration in seconds for the call. Defaults to `14400` seconds (4 hours). */
    max_duration?: number | SWMLVar;
    /** Comma-separated string of codecs to offer. Valid codecs are: PCMU, PCMA, G722, G729, AMR-WB, OPUS, VP8, H264. */
    codecs?: string;
    /** Username to use for SIP authentication. */
    username?: string;
    /** Password to use for SIP authentication. */
    password?: string;
  };
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
  default?: Record<string, unknown>[];
  /** Schema for array items */
  items: SchemaType;
}

export type AttentionTimeout = number;

export interface BedrockParams {
  /** Amount of time, in ms, to wait before prompting the user to respond. Allowed values from `10,000` - `600,000`. Set to `0` to disable. **Default:** `5000` ms (note: user-configurable values must be `0` or within the `10,000` - `600,000` range). */
  attention_timeout?: AttentionTimeout | 0 | SWMLVar;
  /** Specifies the maximum duration fopr the AI Agent to remain active before it exists the session. */
  hard_stop_time?: string | SWMLVar;
  /** Amount of time, in ms, to wait before exiting the app due to inactivity. Allowed values from `10,000` - `3,600,000`. **Default:** `600000` ms (10 minutes). */
  inactivity_timeout?: number | SWMLVar;
  /** URL of a video file to play when AI is listening to the user speak. Only works for calls that support video. */
  video_listening_file?: string;
  /** URL of a video file to play when AI is idle. Only works for calls that support video. */
  video_idle_file?: string;
  /** URL of a video file to play when AI is talking. Only works for calls that support video. */
  video_talking_file?: string;
  /** A final prompt that is fed into the AI when the `hard_stop_time` is reached. */
  hard_stop_prompt?: string;
  [key: string]:
    | Record<string, unknown>
    | AttentionTimeout
    | 0
    | SWMLVar
    | string
    | SWMLVar
    | number
    | SWMLVar
    | string
    | undefined;
}

export type BedrockPostPrompt =
  | {
      /** Limits the amount of tokens that the AI agent may generate when creating its response */
      max_tokens?: number;
      /** Randomness setting. Float value between 0.0 and 1.5. Closer to 0 will make the output less random. **Default:** `1.0`. */
      temperature?: number | SWMLVar;
      /** Randomness setting. Alternative to `temperature`. Float value between 0.0 and 1.0. Closer to 0 will make the output less random. **Default:** `1.0`. */
      top_p?: number | SWMLVar;
      /** Threshold to fire a speech-detect event at the end of the utterance. Float value between 0.0 and 1.0. */
      confidence?: number | SWMLVar;
      /** Aversion to staying on topic. Float value between -2.0 and 2.0. Positive values increase the model's likelihood to talk about new topics. **Default:** `0`. */
      presence_penalty?: number | SWMLVar;
      /** Aversion to repeating lines. Float value between -2.0 and 2.0. Positive values decrease the model's likelihood to repeat the same line verbatim. **Default:** `0`. */
      frequency_penalty?: number | SWMLVar;
      /** The instructions to send to the agent. */
      text: string;
    }
  | {
      /** Limits the amount of tokens that the AI agent may generate when creating its response */
      max_tokens?: number;
      /** Randomness setting. Float value between 0.0 and 1.5. Closer to 0 will make the output less random. **Default:** `1.0`. */
      temperature?: number | SWMLVar;
      /** Randomness setting. Alternative to `temperature`. Float value between 0.0 and 1.0. Closer to 0 will make the output less random. **Default:** `1.0`. */
      top_p?: number | SWMLVar;
      /** Threshold to fire a speech-detect event at the end of the utterance. Float value between 0.0 and 1.0. */
      confidence?: number | SWMLVar;
      /** Aversion to staying on topic. Float value between -2.0 and 2.0. Positive values increase the model's likelihood to talk about new topics. **Default:** `0`. */
      presence_penalty?: number | SWMLVar;
      /** Aversion to repeating lines. Float value between -2.0 and 2.0. Positive values decrease the model's likelihood to repeat the same line verbatim. **Default:** `0`. */
      frequency_penalty?: number | SWMLVar;
      /** The instructions to send to the agent. */
      pom: POM[];
    };

export type BedrockPrompt =
  | {
      voice_id?: 'tiffany' | 'matthew' | 'amy' | 'lupe' | 'carlos';
      /** Limits the amount of tokens that the AI agent may generate when creating its response */
      max_tokens?: number;
      /** Randomness setting. Float value between 0.0 and 1.5. Closer to 0 will make the output less random. **Default:** `1.0`. */
      temperature?: number | SWMLVar;
      /** Randomness setting. Alternative to `temperature`. Float value between 0.0 and 1.0. Closer to 0 will make the output less random. **Default:** `1.0`. */
      top_p?: number | SWMLVar;
      /** Threshold to fire a speech-detect event at the end of the utterance. Float value between 0.0 and 1.0. */
      confidence?: number | SWMLVar;
      /** Aversion to staying on topic. Float value between -2.0 and 2.0. Positive values increase the model's likelihood to talk about new topics. **Default:** `0`. */
      presence_penalty?: number | SWMLVar;
      /** Aversion to repeating lines. Float value between -2.0 and 2.0. Positive values decrease the model's likelihood to repeat the same line verbatim. **Default:** `0`. */
      frequency_penalty?: number | SWMLVar;
      /** The instructions to send to the agent. */
      text: string;
    }
  | {
      voice_id?: 'tiffany' | 'matthew' | 'amy' | 'lupe' | 'carlos';
      /** Limits the amount of tokens that the AI agent may generate when creating its response */
      max_tokens?: number;
      /** Randomness setting. Float value between 0.0 and 1.5. Closer to 0 will make the output less random. **Default:** `1.0`. */
      temperature?: number | SWMLVar;
      /** Randomness setting. Alternative to `temperature`. Float value between 0.0 and 1.0. Closer to 0 will make the output less random. **Default:** `1.0`. */
      top_p?: number | SWMLVar;
      /** Threshold to fire a speech-detect event at the end of the utterance. Float value between 0.0 and 1.0. */
      confidence?: number | SWMLVar;
      /** Aversion to staying on topic. Float value between -2.0 and 2.0. Positive values increase the model's likelihood to talk about new topics. **Default:** `0`. */
      presence_penalty?: number | SWMLVar;
      /** Aversion to repeating lines. Float value between -2.0 and 2.0. Positive values decrease the model's likelihood to repeat the same line verbatim. **Default:** `0`. */
      frequency_penalty?: number | SWMLVar;
      /** The instructions to send to the agent. */
      pom: POM[];
    };

export interface BedrockSWAIG {
  /** An array of JSON objects to define functions that can be executed during the interaction with the Bedrock AI. Default is not set. */
  functions?: BedrockSWAIGFunction[];
  /** Default settings for all SWAIG functions. If `defaults` is not set, settings may be set in each function object. Default is not set. */
  defaults?: SWAIGDefaults;
  /** Prebuilt functions the AI agent is able to call from this list of available native functions */
  native_functions?: SWAIGNativeFunction[];
  /** An array of objects to include remote function signatures. */
  includes?: SWAIGIncludes[];
}

export type BedrockSWAIGFunction =
  | {
      /** A description of the context and purpose of the function, to explain to the agent when to use it. */
      description: string;
      /** A JSON object that defines the expected user input parameters and their validation rules for the function. */
      parameters?: FunctionParameters;
      /** Whether the function is active. **Default:** `true`. */
      active?: boolean | SWMLVar;
      /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script or from the SWML set_meta_data action. */
      meta_data?: Record<string, unknown>;
      /** Scoping token for meta_data. If not supplied, metadata will be scoped to function's `web_hook_url`. Default is set by SignalWire. */
      meta_data_token?: string;
      /** An object that processes function inputs and executes operations through expressions, webhooks, or direct output. */
      data_map?: DataMap;
      /** Function-specific URL to send status callbacks and reports to. Takes precedence over a default setting. Authentication can also be set in the url in the format of `username:password@url.` */
      web_hook_url?: string;
      /** A unique name for the function. This can be any user-defined string or can reference a reserved function. Reserved functions are SignalWire functions that will be executed at certain points in the conversation. */
      function: string;
    }
  | {
      /** A description of the context and purpose of the function, to explain to the agent when to use it. */
      description: string;
      /** A JSON object that defines the expected user input parameters and their validation rules for the function. */
      parameters?: FunctionParameters;
      /** Whether the function is active. **Default:** `true`. */
      active?: boolean | SWMLVar;
      /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script or from the SWML set_meta_data action. */
      meta_data?: Record<string, unknown>;
      /** Scoping token for meta_data. If not supplied, metadata will be scoped to function's `web_hook_url`. Default is set by SignalWire. */
      meta_data_token?: string;
      /** An object that processes function inputs and executes operations through expressions, webhooks, or direct output. */
      data_map?: DataMap;
      /** Function-specific URL to send status callbacks and reports to. Takes precedence over a default setting. Authentication can also be set in the url in the format of `username:password@url.` */
      web_hook_url?: string;
      /** A unique name for the function. This can be any user-defined string or can reference a reserved function. Reserved functions are SignalWire functions that will be executed at certain points in the conversation. For the start_hook function, the function name is 'start_hook'. */
      function: 'startup_hook';
    }
  | {
      /** A description of the context and purpose of the function, to explain to the agent when to use it. */
      description: string;
      /** A JSON object that defines the expected user input parameters and their validation rules for the function. */
      parameters?: FunctionParameters;
      /** Whether the function is active. **Default:** `true`. */
      active?: boolean | SWMLVar;
      /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script or from the SWML set_meta_data action. */
      meta_data?: Record<string, unknown>;
      /** Scoping token for meta_data. If not supplied, metadata will be scoped to function's `web_hook_url`. Default is set by SignalWire. */
      meta_data_token?: string;
      /** An object that processes function inputs and executes operations through expressions, webhooks, or direct output. */
      data_map?: DataMap;
      /** Function-specific URL to send status callbacks and reports to. Takes precedence over a default setting. Authentication can also be set in the url in the format of `username:password@url.` */
      web_hook_url?: string;
      /** A unique name for the function. This can be any user-defined string or can reference a reserved function. Reserved functions are SignalWire functions that will be executed at certain points in the conversation. For the stop_hook function, the function name is 'stop_hook'. */
      function: 'hangup_hook';
    }
  | {
      /** A description of the context and purpose of the function, to explain to the agent when to use it. */
      description: string;
      /** A JSON object that defines the expected user input parameters and their validation rules for the function. */
      parameters?: FunctionParameters;
      /** Whether the function is active. **Default:** `true`. */
      active?: boolean | SWMLVar;
      /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script or from the SWML set_meta_data action. */
      meta_data?: Record<string, unknown>;
      /** Scoping token for meta_data. If not supplied, metadata will be scoped to function's `web_hook_url`. Default is set by SignalWire. */
      meta_data_token?: string;
      /** An object that processes function inputs and executes operations through expressions, webhooks, or direct output. */
      data_map?: DataMap;
      /** Function-specific URL to send status callbacks and reports to. Takes precedence over a default setting. Authentication can also be set in the url in the format of `username:password@url.` */
      web_hook_url?: string;
      /** A unique name for the function. This can be any user-defined string or can reference a reserved function. Reserved functions are SignalWire functions that will be executed at certain points in the conversation.. For the summarize_conversation function, the function name is 'summarize_conversation'. */
      function: 'summarize_conversation';
    };

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
  params: {
    /** The role that the message is from. Required when `reset` is not provided. Each role type has a different purpose and will influence how the AI will interpret the message. */
    role?: 'system' | 'user' | 'assistant';
    /** The text content that will be sent to the AI. Required when `reset` is not provided. */
    message_text?: string;
    /** Parameters for resetting the AI conversation state. When provided, `role` and `message_text` are optional. */
    reset?: CallAIMessageResetParams;
    /** Arbitrary JSON data to merge into the AI session's global data store. */
    global_data?: Record<string, unknown>;
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
  to: string;
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
  /** Inline SWML object containing SWML instructions for handling the call. Either `url` or `swml` must be included for a new call. */
  swml: SWMLObject;
}

export interface CallCreateParamsURL {
  /** The address that initiated the call. Can be either a E.164 formatted number (`+xxxxxxxxxxx`), or a SIP endpoint (`sip:xxx@yyy.zzz`). */
  from: string;
  /** The address that received the call. Can be either a E.164 formatted number (`+xxxxxxxxxxx`), or a SIP endpoint (`sip:xxx@yyy.zzz`). */
  to: string;
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
  params: {
    /** Set the reason why the call was hung up. */
    reason?: HangupReason;
  };
}

export interface CallHoldRequest {
  /** The unique identifying ID of a existing call. */
  id: uuid;
  /** The `calling.ai_hold` command is used to hold a call. */
  command: 'calling.ai_hold';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** The duration to hold the caller in seconds. */
    timeout?: number;
    /** A system message added to the AI conversation before placing the caller on hold. */
    prompt?: string;
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
    action: LiveTranscribeStartAction | LiveTranscribeSummarizeAction | LiveTranscribeStopAction;
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
      | LiveTranslateStartAction
      | LiveTranslateSummarizeAction
      | LiveTranslateInjectAction
      | LiveTranslateStopAction;
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
  | CallSendFaxStopRequest
  | CallReceiveFaxStopRequest
  | CallReferRequest;

export interface CallDisconnectRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.disconnect` command disconnects bridged calls without hanging up either leg. */
  command: 'calling.disconnect';
  /** An object of parameters that will be utilized by the active command. */
  params: Record<string, unknown>;
}

export interface CallPlayRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.play` command plays audio, TTS, silence, or ringtone to a call. */
  command: 'calling.play';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Unique identifier for this play operation. Auto-generated if not provided. */
    control_id?: string;
    /** Array of media objects to play. */
    play: {
      /** The type of media to play. */
      type?: 'audio' | 'tts' | 'silence' | 'ring';
      /** Type-specific parameters (url for audio, text/language/gender for tts, duration for silence/ring). */
      params?: Record<string, unknown>;
    }[];
    /** Volume adjustment in dB. 0 is default. */
    volume?: number;
    /** Which leg of the call to play to. */
    direction?: 'listen' | 'speak' | 'both';
    /** Number of times to loop. 0 means infinite. */
    loop?: number;
    /** Webhook URL for play state events. */
    status_url?: string;
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
    /** Unique identifier for this recording. Auto-generated if not provided. */
    control_id?: string;
    /** Audio recording parameters. */
    audio?: {
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
    };
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
    /** Unique identifier for this collect operation. */
    control_id?: string;
    /** Seconds to wait for first input before timeout. */
    initial_timeout?: number;
    /** DTMF digit collection parameters. */
    digits?: {
      /** Maximum number of digits to collect. */
      max?: number;
      /** Characters that end digit collection (e.g. '#'). */
      terminators?: string;
      /** Seconds to wait between digits. */
      digit_timeout?: number;
    };
    /** Speech recognition parameters. */
    speech?: {
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
    };
    /** Keep collecting after each result. */
    continuous?: boolean;
    /** Deliver partial recognition results. */
    partial_results?: boolean;
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
    control_id?: string;
    /** Detection configuration. */
    detect: {
      /** Type of detection to perform. */
      type: 'machine' | 'fax' | 'digit';
      /** Type-specific detection parameters. */
      params?: {
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
      };
    };
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
    control_id?: string;
    /** What to tap. */
    tap: {
      /** Tap type. */
      type: 'audio';
      /** Tap parameters. */
      params?: {
        /** Which direction to tap. */
        direction?: 'listen' | 'speak' | 'both';
      };
    };
    /** Target device to send tapped audio to. */
    device: {
      /** Target device type. */
      type: 'rtp' | 'ws';
      /** Device-specific parameters. */
      params?: {
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
      };
    };
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
  params: Record<string, unknown>;
}

export interface CallDenoiseStopRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.denoise.stop` command stops noise reduction on a call. */
  command: 'calling.denoise.stop';
  /** An object of parameters that will be utilized by the active command. */
  params: Record<string, unknown>;
}

export interface CallTranscribeRequest {
  /** The unique identifying ID of an existing call. */
  id: uuid;
  /** The `calling.transcribe` command starts call transcription. Only one active transcription per call. */
  command: 'calling.transcribe';
  /** An object of parameters that will be utilized by the active command. */
  params: {
    /** Unique identifier for this transcription. */
    control_id?: string;
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
  params: {
    /** The control_id of the AI session to stop. */
    control_id: string;
  };
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
    device: {
      /** Device type (only sip supported for REFER). */
      type: 'sip';
      /** SIP REFER parameters. */
      params: {
        /** SIP URI to REFER to. */
        to: string;
        /** Optional SIP auth username. */
        username?: string;
        /** Optional SIP auth password. */
        password?: string;
      };
    };
    /** Webhook URL for REFER state events. */
    status_url?: string;
  };
}

export type CallResponse = CallLeg | FabricDeviceLeg;

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

export type CallStatus = 'created' | 'ringing' | 'answered' | 'ended';

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
  params: {
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
  swml: SWMLObject;
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
  url: string;
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
  /** The name of the context to switch to. The context must be defined in the AI's prompt.contexts configuration. */
  change_context: string;
}

export interface ChangeStepAction {
  /** The name of the step to switch to. The step must be defined in the current context's steps array. */
  change_step: string;
}

export interface ChargeDetails {
  /** Description for this charge. */
  description: string;
  /** Charged amount. */
  charge: number;
}

export interface Cond {
  /** Execute a sequence of instructions depending on the value of a JavaScript condition. */
  cond: CondParams[];
}

export interface CondElse {
  /** Sequence of SWML methods to execute when none of the other conditions evaluate to true. */
  else: SWMLMethod[];
}

export type CondParams = CondReg | CondElse;

export interface CondReg {
  /** The JavaScript condition to act on. */
  when: string;
  /** Sequence of SWML methods to execute when the condition evaluates to true. */
  then: SWMLMethod[];
  /** Sequence of SWML methods to execute when none of the other conditions evaluate to true. */
  else?: SWMLMethod[];
}

export interface Connect {
  /** Connect to a phone number, SIP URI, Call Fabric resource, queue, or WebSocket stream. */
  connect:
    ConnectDeviceSingle | ConnectDeviceSerial | ConnectDeviceParallel | ConnectDeviceSerialParallel;
}

export interface ConnectDeviceParallel {
  /** The caller ID to use when dialing the number. */
  from?: string;
  /** Custom SIP headers to add to INVITE. It Has no effect on calls to phone numbers. */
  headers?: ConnectHeaders[];
  /** Comma-separated string of codecs to offer. */
  codecs?: string;
  /** If true, WebRTC media is offered to the SIP endpoint. */
  webrtc_media?: boolean | SWMLVar;
  /** Time, in seconds, to set the SIP `Session-Expires` header in INVITE. */
  session_timeout?: number | SWMLVar;
  /** Array of URIs to play as ringback tone. If not specified, plays audio from the provider. */
  ringback?: string[];
  /** Action to take based on the result of the call. This will run once the peer leg of the call has ended. */
  result?: ConnectSwitch | CondParams[];
  /** Time, in seconds, to wait for the call to be answered. */
  timeout?: number | SWMLVar;
  /** Maximum duration, in seconds, allowed for the call. */
  max_duration?: number | SWMLVar;
  /** Delay answer until the B-leg answers. */
  answer_on_bridge?: boolean | SWMLVar;
  /** Confirmation to execute when the call is connected. Can be either: */
  confirm?: string | ValidConfirmMethods[];
  /** The amount of time, in seconds, to wait for the `confirm` URL to return a response */
  confirm_timeout?: number | SWMLVar;
  /** SIP username to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  username?: string;
  /** SIP password to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  password?: string;
  /** Encryption setting to use. **Possible values:** `mandatory`, `optional`, `forbidden` */
  encryption?: 'mandatory' | 'optional' | 'forbidden';
  /** Webhook URL to send call status change notifications to. Authentication can also be set in the URL in the format of `username:password@url`. */
  call_state_url?: string;
  /** SWML to execute after the bridge completes. This defines what should happen after the call is connected and the bridge ends. */
  transfer_after_bridge?: string | SWMLVar;
  /** An array of call state event names to be notified about. */
  call_state_events?: CallStatus[];
  /** HTTP or HTTPS URL to deliver connect status events. */
  status_url?: string;
  /** Array of destinations to dial simultaneously. */
  parallel: ConnectDeviceSingle[];
}

export interface ConnectDeviceSerial {
  /** The caller ID to use when dialing the number. */
  from?: string;
  /** Custom SIP headers to add to INVITE. It Has no effect on calls to phone numbers. */
  headers?: ConnectHeaders[];
  /** Comma-separated string of codecs to offer. */
  codecs?: string;
  /** If true, WebRTC media is offered to the SIP endpoint. */
  webrtc_media?: boolean | SWMLVar;
  /** Time, in seconds, to set the SIP `Session-Expires` header in INVITE. */
  session_timeout?: number | SWMLVar;
  /** Array of URIs to play as ringback tone. If not specified, plays audio from the provider. */
  ringback?: string[];
  /** Action to take based on the result of the call. This will run once the peer leg of the call has ended. */
  result?: ConnectSwitch | CondParams[];
  /** Time, in seconds, to wait for the call to be answered. */
  timeout?: number | SWMLVar;
  /** Maximum duration, in seconds, allowed for the call. */
  max_duration?: number | SWMLVar;
  /** Delay answer until the B-leg answers. */
  answer_on_bridge?: boolean | SWMLVar;
  /** Confirmation to execute when the call is connected. Can be either: */
  confirm?: string | ValidConfirmMethods[];
  /** The amount of time, in seconds, to wait for the `confirm` URL to return a response */
  confirm_timeout?: number | SWMLVar;
  /** SIP username to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  username?: string;
  /** SIP password to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  password?: string;
  /** Encryption setting to use. **Possible values:** `mandatory`, `optional`, `forbidden` */
  encryption?: 'mandatory' | 'optional' | 'forbidden';
  /** Webhook URL to send call status change notifications to. Authentication can also be set in the URL in the format of `username:password@url`. */
  call_state_url?: string;
  /** SWML to execute after the bridge completes. This defines what should happen after the call is connected and the bridge ends. */
  transfer_after_bridge?: string | SWMLVar;
  /** An array of call state event names to be notified about. */
  call_state_events?: CallStatus[];
  /** HTTP or HTTPS URL to deliver connect status events. */
  status_url?: string;
  serial: ConnectDeviceSingle[];
}

export interface ConnectDeviceSerialParallel {
  /** The caller ID to use when dialing the number. */
  from?: string;
  /** Custom SIP headers to add to INVITE. It Has no effect on calls to phone numbers. */
  headers?: ConnectHeaders[];
  /** Comma-separated string of codecs to offer. */
  codecs?: string;
  /** If true, WebRTC media is offered to the SIP endpoint. */
  webrtc_media?: boolean | SWMLVar;
  /** Time, in seconds, to set the SIP `Session-Expires` header in INVITE. */
  session_timeout?: number | SWMLVar;
  /** Array of URIs to play as ringback tone. If not specified, plays audio from the provider. */
  ringback?: string[];
  /** Action to take based on the result of the call. This will run once the peer leg of the call has ended. */
  result?: ConnectSwitch | CondParams[];
  /** Time, in seconds, to wait for the call to be answered. */
  timeout?: number | SWMLVar;
  /** Maximum duration, in seconds, allowed for the call. */
  max_duration?: number | SWMLVar;
  /** Delay answer until the B-leg answers. */
  answer_on_bridge?: boolean | SWMLVar;
  /** Confirmation to execute when the call is connected. Can be either: */
  confirm?: string | ValidConfirmMethods[];
  /** The amount of time, in seconds, to wait for the `confirm` URL to return a response */
  confirm_timeout?: number | SWMLVar;
  /** SIP username to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  username?: string;
  /** SIP password to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  password?: string;
  /** Encryption setting to use. **Possible values:** `mandatory`, `optional`, `forbidden` */
  encryption?: 'mandatory' | 'optional' | 'forbidden';
  /** Webhook URL to send call status change notifications to. Authentication can also be set in the URL in the format of `username:password@url`. */
  call_state_url?: string;
  /** SWML to execute after the bridge completes. This defines what should happen after the call is connected and the bridge ends. */
  transfer_after_bridge?: string | SWMLVar;
  /** An array of call state event names to be notified about. */
  call_state_events?: CallStatus[];
  /** HTTP or HTTPS URL to deliver connect status events. */
  status_url?: string;
  /** Array of arrays. */
  serial_parallel: ConnectDeviceSingle[][];
}

export interface ConnectDeviceSingle {
  /** The caller ID to use when dialing the number. */
  from?: string;
  /** Custom SIP headers to add to INVITE. It Has no effect on calls to phone numbers. */
  headers?: ConnectHeaders[];
  /** Comma-separated string of codecs to offer. */
  codecs?: string;
  /** If true, WebRTC media is offered to the SIP endpoint. */
  webrtc_media?: boolean | SWMLVar;
  /** Time, in seconds, to set the SIP `Session-Expires` header in INVITE. */
  session_timeout?: number | SWMLVar;
  /** Array of URIs to play as ringback tone. If not specified, plays audio from the provider. */
  ringback?: string[];
  /** Action to take based on the result of the call. This will run once the peer leg of the call has ended. */
  result?: ConnectSwitch | CondParams[];
  /** Time, in seconds, to wait for the call to be answered. */
  timeout?: number | SWMLVar;
  /** Maximum duration, in seconds, allowed for the call. */
  max_duration?: number | SWMLVar;
  /** Delay answer until the B-leg answers. */
  answer_on_bridge?: boolean | SWMLVar;
  /** Confirmation to execute when the call is connected. Can be either: */
  confirm?: string | ValidConfirmMethods[];
  /** The amount of time, in seconds, to wait for the `confirm` URL to return a response */
  confirm_timeout?: number | SWMLVar;
  /** SIP username to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  username?: string;
  /** SIP password to use for authentication when dialing a SIP URI. Has no effect on calls to phone numbers. */
  password?: string;
  /** Encryption setting to use. **Possible values:** `mandatory`, `optional`, `forbidden` */
  encryption?: 'mandatory' | 'optional' | 'forbidden';
  /** Webhook URL to send call status change notifications to. Authentication can also be set in the URL in the format of `username:password@url`. */
  call_state_url?: string;
  /** SWML to execute after the bridge completes. This defines what should happen after the call is connected and the bridge ends. */
  transfer_after_bridge?: string | SWMLVar;
  /** An array of call state event names to be notified about. */
  call_state_events?: CallStatus[];
  /** HTTP or HTTPS URL to deliver connect status events. */
  status_url?: string;
  /** Destination to dial. Can be: */
  to: string;
  /** Stream name identifier. Only applies to stream destinations. */
  name?: string;
  /** Audio codec for the stream. Supported values: `PCMU`, `PCMA`, `G722`, `L16`. */
  codec?: string;
  /** Enable realtime mode for bidirectional audio. */
  realtime?: boolean | SWMLVar;
  /** HTTP method for the stream status webhook. */
  status_url_method?: 'GET' | 'POST';
  /** Bearer token sent as an `Authorization` header during the WebSocket handshake. Only applies to stream destinations. */
  authorization_bearer_token?: string;
  /** Custom key-value pairs sent in the WebSocket start message. Only applies to stream destinations. */
  custom_parameters?: Record<string, string>;
}

export interface ConnectHeaders {
  /** The name of the header. */
  name: string;
  /** The value of the header. */
  value: string;
}

export interface ConnectSwitch {
  /** Name of the variable whose value needs to be compared. If not provided, it will check the `connect_result` variable. */
  variable?: string;
  /** Object of values mapped to array of instructions to execute */
  case: Record<string, SWMLMethod[]>;
  /** Array of instructions to execute if no cases match */
  default?: SWMLMethod[];
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
  /** A JSON object containing the context to switch to. Default is not set. */
  context_switch: {
    /** The instructions to send to the agent. Default is not set. */
    system_prompt: string;
    /** Whether to consolidate the context. Default is `false`. */
    consolidate?: boolean | SWMLVar;
    /** A string serving as simulated user input for the AI Agent. */
    user_prompt?: string;
  };
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

export interface Contexts {
  /** The default context to use at the beginning of the conversation. Additional context steps can be defined as any other key in the object. */
  default: ContextsObject;
  [key: string]: ContextsObject;
}

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

/** A message object representing a single turn in the conversation history. */
export interface ConversationMessage {
  /** The role of the message sender. */
  role: ConversationRole;
  /** The text content of the message. */
  content: string;
  /** Optional language code for the message (e.g., 'en', 'es', 'fr'). */
  lang?: string;
}

export type ConversationRole = 'user' | 'assistant' | 'system';

/** Custom translation filter with a prompt prefix. Use `prompt:` followed by your custom instructions (e.g., `prompt:Use formal business language`). */
export type CustomTranslationFilter = string;

export interface DataMap {
  /** An object that contains a response and a list of actions to be performed upon a SWAIG function call. */
  output?: Output;
  /** An array of objects that have pattern matching logic to process the user's input data. A user can define multiple expressions to match against the user's input data. */
  expressions?: Expression[];
  /** An array of objects that define external API calls. */
  webhooks?: Webhook[];
}

export interface Denoise {
  /** Start noise reduction. You can stop it at any time using `stop_denoise`. */
  denoise: Record<string, unknown>;
}

export interface DetectMachine {
  /** A detection method that combines AMD (Answering Machine Detection) and fax detection. */
  detect_machine: {
    /** If `true`, stops detection on beep / end of voicemail greeting. Default `false`. */
    detect_message_end?: boolean | SWMLVar;
    /** Comma-separated string of detectors to enable. Valid values: `amd`, `fax`. */
    detectors?: string;
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
    status_url?: string;
    /** The max time to run detector. Default `30.0` seconds. */
    timeout?: number | SWMLVar;
    /** The tone to detect, will only receive remote side tone. Default `CED`. */
    tone?: 'CED' | 'CNG';
    /** If false, the detector will run asynchronously and status_url must be set. */
    wait?: boolean | SWMLVar;
  };
}

export type Direction = 'inbound' | 'outbound';

export interface EnterQueue {
  /** Place the current call in a named queue where it will wait to be connected to an available agent or resource. */
  enter_queue: EnterQueueObject;
}

export interface EnterQueueObject {
  /** Name of the queue to enter. If a queue with this name does not exist, it will be automatically created. */
  queue_name: string;
  /** SWML to execute after the bridge completes. This defines what should happen after the call is connected to an agent and the bridge ends. */
  transfer_after_bridge: string | SWMLVar;
  /** HTTP or HTTPS URL to deliver queue status events. Default not set */
  status_url?: string;
  /** URL for media to play while waiting in the queue. Default hold music will be played if not set */
  wait_url?: string | SWMLVar;
  /** Maximum time in seconds to wait in the queue before timeout. Default `3600` */
  wait_time?: number | SWMLVar;
}

export interface Execute {
  /** Execute a specified section or URL as a subroutine, and upon completion, return to the current document. */
  execute: {
    /** Specifies what to execute. The value can be one of: */
    dest: string;
    /** Named parameters to send to section or URL */
    params?: Record<string, unknown>;
    /** User-defined metadata, ignored by SignalWire */
    meta?: Record<string, unknown>;
    /** The list of SWML instructions to be executed when the executed section or URL returns */
    on_return?: SWMLMethod[];
    /** Action to take based on the result of the call. This will run once the peer leg of the call has ended. */
    result?: ExecuteSwitch | CondParams[];
  };
}

export interface ExecuteSwitch {
  /** Name of the variable whose value needs to be compared. If not provided, it will check the `return_value` variable. */
  variable?: string;
  /** Object of values mapped to array of instructions to execute */
  case: Record<string, SWMLMethod[]>;
  /** Array of instructions to execute if no cases match */
  default?: SWMLMethod[];
}

export interface Expression {
  /** The actual input or value from the user or system. */
  string: string;
  /** A regular expression pattern to validate or match the string. */
  pattern: string;
  /** An object that contains a response and a list of actions to be performed upon a expression match. */
  output: Output;
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

/** Supported language codes */
export type FunctionFillers =
  | {
      /** Default language set by the user */
      default: string[];
    }
  | {
      /** Bulgarian */
      bg: string[];
    }
  | {
      /** Catalan */
      ca: string[];
    }
  | {
      /** Chinese (Simplified) */
      zh: string[];
    }
  | {
      /** Chinese (Simplified, China) */
      'zh-CN': string[];
    }
  | {
      /** Chinese (Simplified Han) */
      'zh-Hans': string[];
    }
  | {
      /** Chinese (Traditional, Taiwan) */
      'zh-TW': string[];
    }
  | {
      /** Chinese (Traditional Han) */
      'zh-Hant': string[];
    }
  | {
      /** Chinese (Traditional, Hong Kong) */
      'zh-HK': string[];
    }
  | {
      /** Czech */
      cs: string[];
    }
  | {
      /** Danish */
      da: string[];
    }
  | {
      /** Danish (Denmark) */
      'da-DK': string[];
    }
  | {
      /** Dutch */
      nl: string[];
    }
  | {
      /** English */
      en: string[];
    }
  | {
      /** English (United States) */
      'en-US': string[];
    }
  | {
      /** English (United Kingdom) */
      'en-GB': string[];
    }
  | {
      /** English (New Zealand) */
      'en-NZ': string[];
    }
  | {
      /** English (India) */
      'en-IN': string[];
    }
  | {
      /** English (Australia) */
      'en-AU': string[];
    }
  | {
      /** Estonian */
      et: string[];
    }
  | {
      /** Finnish */
      fi: string[];
    }
  | {
      /** Flemish (Belgian Dutch) */
      'nl-BE': string[];
    }
  | {
      /** French */
      fr: string[];
    }
  | {
      /** French (Canada) */
      'fr-CA': string[];
    }
  | {
      /** German */
      de: string[];
    }
  | {
      /** German (Switzerland) */
      'de-CH': string[];
    }
  | {
      /** Greek */
      el: string[];
    }
  | {
      /** Hindi */
      hi: string[];
    }
  | {
      /** Hungarian */
      hu: string[];
    }
  | {
      /** Indonesian */
      id: string[];
    }
  | {
      /** Italian */
      it: string[];
    }
  | {
      /** Japanese */
      ja: string[];
    }
  | {
      /** Korean */
      ko: string[];
    }
  | {
      /** Korean (South Korea) */
      'ko-KR': string[];
    }
  | {
      /** Latvian */
      lv: string[];
    }
  | {
      /** Lithuanian */
      lt: string[];
    }
  | {
      /** Malay */
      ms: string[];
    }
  | {
      /** Multilingual (Spanish + English) */
      multi: string[];
    }
  | {
      /** Norwegian */
      no: string[];
    }
  | {
      /** Polish */
      pl: string[];
    }
  | {
      /** Portuguese */
      pt: string[];
    }
  | {
      /** Portuguese (Brazil) */
      'pt-BR': string[];
    }
  | {
      /** Portuguese (Portugal) */
      'pt-PT': string[];
    }
  | {
      /** Romanian */
      ro: string[];
    }
  | {
      /** Russian */
      ru: string[];
    }
  | {
      /** Slovak */
      sk: string[];
    }
  | {
      /** Spanish */
      es: string[];
    }
  | {
      /** Spanish (Latin America) */
      'es-419': string[];
    }
  | {
      /** Swedish */
      sv: string[];
    }
  | {
      /** Swedish (Sweden) */
      'sv-SE': string[];
    }
  | {
      /** Thai */
      th: string[];
    }
  | {
      /** Thai (Thailand) */
      'th-TH': string[];
    }
  | {
      /** Turkish */
      tr: string[];
    }
  | {
      /** Ukrainian */
      uk: string[];
    }
  | {
      /** Vietnamese */
      vi: string[];
    };

export interface FunctionParameters {
  /** The type of argument the AI is passing to the function. Possible values are 'string' and 'object'. */
  type: 'object';
  /** An object containing the property definitions that are passed to the function. */
  properties: Record<string, SchemaType>;
  /** An array of required property names from the `properties` object. */
  required?: string[];
}

export interface Goto {
  /** Jump to a label within the current section, optionally based on a condition. */
  goto: {
    /** Mark any point of the SWML section with a label so that goto can jump to it. */
    label: string;
    /** A JavaScript condition that determines whether to perform the jump. If the condition evaluates to true, the jump is executed. If omitted, the jump is unconditional. */
    when?: string;
    /** The maximum number of times to perform the jump. Must be a number between 1 and 100. Default `100`. */
    max?: number | SWMLVar;
  };
}

export interface HangUpHookSWAIGFunction {
  /** A description of the context and purpose of the function, to explain to the agent when to use it. */
  description: string;
  /** The purpose field has been deprecated and is replaced by the `description` field. */
  purpose?: string;
  /** A JSON object that defines the expected user input parameters and their validation rules for the function. */
  parameters?: FunctionParameters;
  /** A JSON object defining the fillers that should be played when calling a `swaig function`. This helps the AI break silence between responses. The filler is played asynchronously during the function call. */
  fillers?: FunctionFillers;
  /** The argument field has been deprecated and is replaced by the `parameters` field.  */
  argument?: FunctionParameters;
  /** Whether the function is active. **Default:** `true`. */
  active?: boolean | SWMLVar;
  /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script or from the SWML set_meta_data action. */
  meta_data?: Record<string, unknown>;
  /** Scoping token for meta_data. If not supplied, metadata will be scoped to function's `web_hook_url`. Default is set by SignalWire. */
  meta_data_token?: string;
  /** An object that processes function inputs and executes operations through expressions, webhooks, or direct output. */
  data_map?: DataMap;
  /** Skips the top-level fillers specified in `ai.languages` (which includes `speech_fillers` and `function_fillers`). */
  skip_fillers?: boolean | SWMLVar;
  /** Function-specific URL to send status callbacks and reports to. Takes precedence over a default setting. Authentication can also be set in the url in the format of `username:password@url.` */
  web_hook_url?: string;
  /** A file to play while the function is running. `wait_file_loops` can specify the amount of times that files should continously play. Default is not set. */
  wait_file?: string;
  /** The number of times to loop playing the file. Default is not set. */
  wait_file_loops?: number | string;
  /** Whether to wait for fillers to finish playing before continuing with the function. **Default:** `false`. */
  wait_for_fillers?: boolean | SWMLVar;
  /** A unique name for the function. This can be any user-defined string or can reference a reserved function. Reserved functions are SignalWire functions that will be executed at certain points in the conversation. For the stop_hook function, the function name is 'stop_hook'. */
  function: 'hangup_hook';
}

export interface Hangup {
  /** End the call with an optional reason. */
  hangup: {
    /** The reason for hanging up the call. */
    reason?: 'hangup' | 'busy' | 'decline';
  };
}

export interface HangupAction {
  /** Whether to hang up the call. When set to `true`, the call will be terminated after the AI agent finishes speaking. */
  hangup: boolean | SWMLVar;
}

/** The reason for hanging up the call. */
export type HangupReason = 'hangup' | 'cancel' | 'busy' | 'noAnswer' | 'decline' | 'error';

export interface Hint {
  /** The hint to match. This will match the string exactly as provided */
  hint: string;
  /** A regular expression to match the hint against. This will ensure that the hint has a valid matching pattern before being replaced. */
  pattern: string;
  /** The text to replace the hint with. This will replace the portion of the hint that matches the pattern. */
  replace: string;
  /** If true, the hint will be matched in a case-insensitive manner. **Default:** `false`. */
  ignore_case?: boolean | SWMLVar;
}

export interface HoldAction {
  /** Places the caller on hold while playing hold music (configured via params.hold_music). */
  hold:
    | number
    | SWMLVar
    | {
        /** The duration to hold the caller in seconds. Can be a number or an object with timeout property. */
        timeout?: number | SWMLVar;
      };
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
  /** Join an ad-hoc audio conference started on either the SignalWire or Compatibility API. */
  join_conference: JoinConferenceObject;
}

export interface JoinConferenceObject {
  /** Name of conference */
  name: string;
  /** Whether to join the conference in a muted state. If set to `true`, the participant will be muted upon joining. Default `false`. */
  muted?: boolean | SWMLVar;
  /** Sets the behavior of the beep sound when joining or leaving the conference. Default `"true"`. */
  beep?: 'true' | 'false' | 'onEnter' | 'onExit';
  /** Starts the conference when the main participant joins. This means the start action will not wait on more participants to join before starting. Default `true`. */
  start_on_enter?: boolean | SWMLVar;
  /** Ends the conference when the main participant leaves. This means the end action will not wait on more participants to leave before ending. Default `false`. */
  end_on_exit?: boolean | SWMLVar;
  /** A URL that will play media when the conference is put on hold. Default hold music will be played if not set */
  wait_url?: string | SWMLVar;
  /** The maximum number of participants allowed in the conference. If the limit is reached, new participants will not be able to join. Default `100000`. */
  max_participants?: number | SWMLVar;
  /** Enables or disables recording of the conference. Default `"do-not-record"`. */
  record?: 'do-not-record' | 'record-from-start';
  /** Specifies the geographical region where the conference will be hosted. Default not set */
  region?: string;
  /** If set to `trim-silence`, it will remove silence from the start of the recording. If set to `do-not-trim`, it will keep the silence. Default `"trim-silence"`. */
  trim?: 'trim-silence' | 'do-not-trim';
  /** Coach accepts a call SID of a call that is currently connected to an in-progress conference. */
  coach?: string;
  /** The events to listen for and send to the status callback URL. Default not set */
  status_callback_event?:
    'start' | 'end' | 'join' | 'leave' | 'mute' | 'hold' | 'modify' | 'speaker' | 'announcement';
  /** The URL to which status events will be sent. This URL must be publicly accessible and able to handle HTTP requests. Default not set */
  status_callback?: string;
  /** The HTTP method to use when sending status events to the status callback URL. Default `"POST"`. */
  status_callback_method?: 'GET' | 'POST';
  /** The URL to which recording status events will be sent. This URL must be publicly accessible and able to handle HTTP requests. Default not set */
  recording_status_callback?: string;
  /** The HTTP method to use when sending recording status events to the recording status callback URL. Default `"POST"`. */
  recording_status_callback_method?: 'GET' | 'POST';
  /** The events to listen for and send to the recording status callback URL. Default not set */
  recording_status_callback_event?: 'in-progress' | 'completed' | 'absent';
  /** Allows the user to specify a custom action to be executed when the conference result is returned (typically when it has ended).  */
  result?:
    | {
        /** Name of the variable whose value needs to be compared. */
        variable: string;
        /** Object of key-mapped values to array of SWML methods to execute. */
        case: Record<string, SWMLMethod[]>;
        /** Array of SWML methods to execute if no cases match. */
        default?: SWMLMethod[];
      }
    | CondParams[];
}

export interface JoinRoom {
  /** Join a RELAY room. If the room doesn't exist, it creates a new room. */
  join_room: {
    /** Name of the room to join. Allowed characters: A-Z, a-z, 0-9, underscore, and hyphen. */
    name: string;
  };
}

export interface Label {
  /** Mark any point of the SWML section with a label so that goto can jump to it. */
  label: string;
}

export interface LanguageParams {
  /** The stability slider determines how stable the voice is and the randomness between each generation. Lowering this slider introduces a broader emotional range for the voice. IMPORTANT: Only works with ElevenLabs TTS engine. */
  stability?: number | SWMLVar;
  /** The similarity slider dictates how closely the AI should adhere to the original voice when attempting to replicate it. The higher the similarity, the closer the AI will sound to the original voice. IMPORTANT: Only works with ElevenLabs TTS engine. */
  similarity?: number | SWMLVar;
}

export type Languages = LanguagesWithSoloFillers | LanguagesWithFillers;

export interface LanguagesWithFillers {
  /** Name of the language (e.g., 'French', 'English'). This value is used in the system prompt to instruct the LLM what language is being spoken. */
  name: string;
  /** The language code for ASR (Automatic Speech Recognition) purposes. By default, SignalWire uses Deepgram's */
  code: string;
  /** Voice to use for the language. String format: `<engine id>.<voice id>`. */
  voice: string;
  /** The model to use for the specified TTS engine. For example, 'arcana'. */
  model?: string;
  /** Enables emotion detection for the set TTS engine. This allows the AI to express emotions when speaking. */
  emotion?: 'auto';
  /** The speed to use for the specified TTS engine. This allows the AI to speak at a different speed at different points in the conversation. */
  speed?: 'auto';
  /** The engine to use for the language. For example, 'elevenlabs'. */
  engine?: string;
  /** TTS engine-specific parameters for this language. */
  params?: LanguageParams;
  /** An array of strings to be used as fillers in the conversation when calling a `swaig function`. This helps the AI break silence between responses. The filler is played asynchronously during the function call. */
  function_fillers?: string[];
  /** An array of strings to be used as fillers in the conversation. This helps the AI break silence between responses. */
  speech_fillers?: string[];
}

export interface LanguagesWithSoloFillers {
  /** Name of the language (e.g., 'French', 'English'). This value is used in the system prompt to instruct the LLM what language is being spoken. */
  name: string;
  /** The language code for ASR (Automatic Speech Recognition) purposes. By default, SignalWire uses Deepgram's */
  code: string;
  /** Voice to use for the language. String format: `<engine id>.<voice id>`. */
  voice: string;
  /** The model to use for the specified TTS engine. For example, 'arcana'. */
  model?: string;
  /** Enables emotion detection for the set TTS engine. This allows the AI to express emotions when speaking. */
  emotion?: 'auto';
  /** The speed to use for the specified TTS engine. This allows the AI to speak at a different speed at different points in the conversation. */
  speed?: 'auto';
  /** The engine to use for the language. For example, 'elevenlabs'. */
  engine?: string;
  /** TTS engine-specific parameters for this language. */
  params?: LanguageParams;
  /** An array of strings to be used as fillers in the conversation. This will be used for both speech and function fillers if provided. */
  fillers?: string[];
}

export interface LiveTranscribe {
  /** Start live transcription of the call. The transcription will be sent to the specified webhook URL. */
  live_transcribe: {
    /** The action to perform during live transcription. */
    action: TranscribeAction;
  };
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
  /** Start live translation of the call. The translation will be sent to the specified webhook URL. */
  live_translate: {
    /** The action to perform during live translation. */
    action: TranslateAction;
  };
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
  /** A static response text or message returned to the AI agent's context. */
  response: string;
  /** A list of actions to be performed upon matching. */
  action?: Action[];
}

/** Regular section that requires either body or bullets. */
export type POM = PomSectionBodyContent | PomSectionBulletsContent;

export interface Pay {
  /** Enables secure payment processing during voice calls. When implemented, it manages the entire payment flow */
  pay: {
    /** The URL to make POST requests with all the gathered payment details. */
    payment_connector_url: string;
    /** The amount to charge against payment method passed in the request. `Float` value with no currency prefix passed as string. */
    charge_amount?: string;
    /** Uses the ISO 4217 currency code of the charge amount. */
    currency?: string;
    /** Custom description of the payment provided in the request. */
    description?: string;
    /** The method of how to collect the payment details. Currently only `dtmf` mode is supported. */
    input?: 'dtmf';
    /** Language to use for prompts being played to the caller by the `pay` method. */
    language?: string;
    /** Number of times the `pay` method will retry to collect payment details. */
    max_attempts?: number | SWMLVar;
    /** The minimum length of the postal code the user must enter. */
    min_postal_code_length?: number | SWMLVar;
    /** Array of parameter objects to pass to your payment processor. The parameters are user-defined key-value pairs. */
    parameters?: PayParameters[];
    /** Indicates the payment method which is going to be used in this payment request. Currently only `credit-card` is supported. */
    payment_method?: 'credit-card';
    /** Takes `true`, `false` or real postalcode (if it's known beforehand) to let pay method know whether to prompt for postal code. Default is `true`. */
    postal_code?: boolean | string;
    /** Array of prompt objects for customizing the audio prompts during different stages of the payment process. */
    prompts?: PayPrompts[];
    /** Takes true or false to let pay method know whether to prompt for security code. */
    security_code?: boolean | SWMLVar;
    /** The URL to send requests for each status change during the payment process. */
    status_url?: string;
    /** Limit in seconds that pay method waits for the caller to press another digit before moving on to validate the digits captured. */
    timeout?: number | SWMLVar;
    /** Whether the payment is a one off payment or re-occurring. */
    token_type?: 'one-time' | 'reusable';
    /** List of payment cards allowed to use in the requested payment process separated by space. */
    valid_card_types?: string;
    /** Text-to-speech voice to use. Please refer to https://signalwire.com/docs/voice/getting-started/voice-and-languages for more information. */
    voice?: string;
  };
}

export interface PayParameters {
  /** The identifier for your custom parameter. This will be the key in the parameters object. */
  name: string;
  /** The value associated with the parameter. This will be the value in the parameters object. */
  value: string;
}

export type PayPromptAction = PayPromptSayAction | PayPromptPlayAction;

export interface PayPromptPlayAction {
  /** When the action `type` is `Say`, this value is the text to be spoken; when the type is `Play`, it should be a URL to the audio file. */
  type: 'Play';
  /** The URL of the audio file to play */
  phrase: string;
}

export interface PayPromptSayAction {
  /** When the action `type` is `Say`, this value is the text to be spoken; when the type is `Play`, it should be a URL to the audio file. */
  type: 'Say';
  /** The phrase to speak */
  phrase: string;
}

export interface PayPrompts {
  /** Array of action objects to execute for this prompt. These actions can either play an audio file or speak a phrase. */
  actions: PayPromptAction[];
  /** The payment step this prompt is for. See Payment Steps for a list of available steps. */
  for: string;
  /** Specifies which payment attempt(s) this prompt applies to. The value increments when a payment fails. */
  attempts?: string;
  /** Space-seperated list of card types that are allowed to be used for this prompt. */
  card_type?: string;
  /** Space-separated list of error types this prompt applies to. */
  error_type?: string;
}

export interface Play {
  /** Play file(s), ringtones, speech or silence. */
  play: PlayWithURL | PlayWithURLS;
}

/** Play with a single URL */
export interface PlayWithURL {
  /** If `true`, the call will automatically answer as the sound is playing. If `false`, you will start playing the audio during early media. Default `true`. */
  auto_answer?: boolean | SWMLVar;
  /** Volume level for the audio file. */
  volume?: number | SWMLVar;
  /** The voice to use for the text to speech. */
  say_voice?: string;
  /** The language to use for the text to speech. */
  say_language?: string;
  /** Gender to use for the text to speech. */
  say_gender?: string;
  /** http or https URL to deliver play status events */
  status_url?: string;
  /** URL to play. */
  url: play_url | SWMLVar;
}

export interface PlayWithURLS {
  /** If `true`, the call will automatically answer as the sound is playing. If `false`, you will start playing the audio during early media. Default `true`. */
  auto_answer?: boolean | SWMLVar;
  /** Volume level for the audio file. */
  volume?: number | SWMLVar;
  /** The voice to use for the text to speech. */
  say_voice?: string;
  /** The language to use for the text to speech. */
  say_language?: string;
  /** Gender to use for the text to speech. */
  say_gender?: string;
  /** http or https URL to deliver play status events */
  status_url?: string;
  /** Array of URLs to play. */
  urls: play_url[] | SWMLVar[];
}

export interface PlaybackBGAction {
  /** A JSON object containing the audio file to play. */
  playback_bg: {
    /** URL or filepath of the audio file to play. */
    file: string;
    /** Whether to wait for the audio file to finish playing before continuing. Default is `false`. */
    wait?: boolean | SWMLVar;
  };
}

/** Content model with body text and optional bullets */
export interface PomSectionBodyContent {
  /** Title for the section */
  title?: string;
  /** Optional array of nested subsections */
  subsections?: POM[];
  /** Whether to number the section */
  numbered?: boolean | SWMLVar;
  /** Whether to number the bullets */
  numberedBullets?: boolean | SWMLVar;
  /** Body text for the section */
  body: string;
  /** Optional array of bullet points */
  bullets?: string[];
}

/** Content model with bullets and optional body */
export interface PomSectionBulletsContent {
  /** Title for the section */
  title?: string;
  /** Optional array of nested subsections */
  subsections?: POM[];
  /** Whether to number the section */
  numbered?: boolean | SWMLVar;
  /** Whether to number the bullets */
  numberedBullets?: boolean | SWMLVar;
  /** Body text for the section (optional) */
  body?: string;
  /** Array of bullet points */
  bullets: string[];
}

export interface Prompt {
  /** Play a prompt and wait for input. The input can be received either as digits from the keypad, */
  prompt: {
    /** URL or array of URLs to play. */
    play: play_url | play_url[] | SWMLVar | SWMLVar[];
    /** Volume level for the audio file. */
    volume?: number;
    /** The voice to use for the text to speech. */
    say_voice?: string;
    /** The language to use for the text to speech. */
    say_language?: string;
    /** The gender to use for the text to speech. */
    say_gender?: string;
    /** Number of digits to collect. */
    max_digits?: number | SWMLVar;
    /** Digits that terminate digit collection. */
    terminators?: string;
    /** Time in seconds to wait for next digit. */
    digit_timeout?: number | SWMLVar;
    /** Time in seconds to wait for start of input. */
    initial_timeout?: number | SWMLVar;
    /** Max time in seconds to wait for speech result. */
    speech_timeout?: number | SWMLVar;
    /** Time in seconds to wait for end of speech utterance. */
    speech_end_timeout?: number | SWMLVar;
    /** Language to detect speech in. */
    speech_language?: string;
    /** Expected words or phrases to help the speech recognition. */
    speech_hints?: string[] | SWMLVar[];
    /** The engine that is selected for speech recognition. The engine must support the specified language. */
    speech_engine?: string;
    /** http or https URL to deliver prompt status events */
    status_url?: string;
  };
}

export interface Pronounce {
  /** The expression to replace. */
  replace: string;
  /** The phonetic spelling of the expression. */
  with: string;
  /** Whether the pronunciation replacement should ignore case. **Default:** `true`. */
  ignore_case?: boolean | SWMLVar;
}

export interface ReceiveFax {
  /** Receive a fax being delivered to this call. */
  receive_fax: {
    /** http or https URL to deliver receive_fax status events */
    status_url?: string;
  };
}

export interface Record_ {
  /** Record the call audio in the foreground, pausing further SWML execution until recording ends. */
  record: {
    /** If true, record in stereo. */
    stereo?: boolean | SWMLVar;
    /** The format to record in. Can be `wav`, `mp3`, or `mp4`. */
    format?: 'wav' | 'mp3' | 'mp4';
    /** Direction of the audio to record: "speak" for what party says, "listen" for what party hears. */
    direction?: 'speak' | 'listen';
    /** String of digits that will stop the recording when pressed. Default is `"#"`. */
    terminators?: string;
    /** Play a beep before recording. */
    beep?: boolean | SWMLVar;
    /** How sensitive the recording voice activity detector is to background noise. */
    input_sensitivity?: number | SWMLVar;
    /** Time in seconds to wait for the start of speech. */
    initial_timeout?: number | SWMLVar;
    /** Time in seconds to wait in silence before ending the recording. */
    end_silence_timeout?: number | SWMLVar;
    /** Maximum length of the recording in seconds. */
    max_length?: number | SWMLVar;
    /** URL to send recording status events to. */
    status_url?: string;
  };
}

export interface RecordCall {
  /** Record call in the background. */
  record_call: {
    /** Identifier for this recording, to use with `stop_call_record`. */
    control_id?: string;
    /** If `true`, record in stereo. */
    stereo?: boolean | SWMLVar;
    /** The format to record in. It can be `wav`, `mp3`, or `mp4`. */
    format?: 'wav' | 'mp3' | 'mp4';
    /** Direction of the audio to record: "speak" for what party says, "listen" for what party hears, "both" for what the party hears and says. */
    direction?: 'speak' | 'listen' | 'both';
    /** String of digits that will stop the recording when pressed. Default is `""` (empty). */
    terminators?: string;
    /** Play a beep before recording. */
    beep?: boolean | SWMLVar;
    /** How sensitive the recording voice activity detector is to background noise. */
    input_sensitivity?: number | SWMLVar;
    /** Time in seconds to wait for the start of speech. */
    initial_timeout?: number | SWMLVar;
    /** Time in seconds to wait in silence before ending the recording. */
    end_silence_timeout?: number | SWMLVar;
    /** Maximum length of the recording in seconds. */
    max_length?: number | SWMLVar;
    /** http or https URL to deliver record_call status events */
    status_url?: string;
  };
}

export interface Request {
  /** Send a GET, POST, PUT, or DELETE request to a remote URL. */
  request: {
    /** URL to send the HTTPS request to. Authentication can also be set in the URL in the format of username:password@url. */
    url: string;
    /** The HTTP method to be used for the request. Can be `GET`, `POST`, `PUT`, or `DELETE`. */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    /** Object containing HTTP headers to set. Valid header values are Accept, Authorization, Content-Type, Range, and custom X- headers. */
    headers?: Record<string, unknown>;
    /** Request body. Content-Type header should be explicitly set, but if not set, the most likely type */
    body?: string | Record<string, unknown>;
    /** Maximum time in seconds to wait for a response. */
    timeout?: number | SWMLVar;
    /** Maximum time in seconds to wait for a connection. */
    connect_timeout?: number | SWMLVar;
    /** Store parsed JSON response as variables. */
    save_variables?: boolean | SWMLVar;
  };
}

export interface Return {
  /** Return a value from an execute call or exit the script. The value can be any type. */
  return: Record<string, unknown>;
}

export interface SIPRefer {
  /** Send SIP REFER to a SIP call. */
  sip_refer: {
    /** The SIP URI to send the REFER to. */
    to_uri: string;
    /** The HTTP or HTTPS URL to send status callback events to. */
    status_url?: string;
    /** Username to use for SIP authentication. */
    username?: string;
    /** Password to use for SIP authentication. */
    password?: string;
  };
}

export interface SMSWithBody {
  /** Phone number to send SMS message to in E.164 format. */
  to_number: string;
  /** Phone number the SMS message will be sent from in E.164 format. */
  from_number: string;
  /** Region of the world to originate the message from. Chosen based on account preferences or device location if not specified. */
  region?: string;
  /** Array of tags to associate with the message to facilitate log searches. */
  tags?: string[];
  /** Required if `media` is not present. The body of the SMS message. */
  body: string;
}

export interface SMSWithMedia {
  /** Phone number to send SMS message to in E.164 format. */
  to_number: string;
  /** Phone number the SMS message will be sent from in E.164 format. */
  from_number: string;
  /** Region of the world to originate the message from. Chosen based on account preferences or device location if not specified. */
  region?: string;
  /** Array of tags to associate with the message to facilitate log searches. */
  tags?: string[];
  /** Required if `body` is not present. Array of media URLs to include in the message. */
  media: string[];
  /** Optional if `media` is present. The body of the SMS message. */
  body?: string;
}

export interface SWAIG {
  /** Default settings for all SWAIG functions. If `defaults` is not set, settings may be set in each function object. Default is not set. */
  defaults?: SWAIGDefaults;
  /** Prebuilt functions the AI agent is able to call from this list of available native functions */
  native_functions?: SWAIGNativeFunction[];
  /** An array of objects to include remote function signatures. */
  includes?: SWAIGIncludes[];
  /** An array of JSON objects to define functions that can be executed during the interaction with the AI. Default is not set. */
  functions?: SWAIGFunction[];
  /** An object containing filler phrases for internal SWAIG functions. These fillers are played while utilizing internal functions. */
  internal_fillers?: SWAIGInternalFiller;
}

export interface SWAIGDefaults {
  /** Default URL to send status callbacks and reports to. Authentication can also be set in the url in the format of `username:password@url.` */
  web_hook_url?: string;
}

export type SWAIGFunction =
  | UserSWAIGFunction
  | StartUpHookSWAIGFunction
  | HangUpHookSWAIGFunction
  | SummarizeConversationSWAIGFunction;

export interface SWAIGIncludes {
  /** Remote functions to fetch and include in your AI application. */
  functions: string[];
  /** URL to fetch remote functions and include in your AI application. Authentication can also be set in the url in the format of `username:password@url`. */
  url: string;
  /** User-defined metadata to pass with the remote function request. */
  meta_data?: Record<string, unknown>;
}

export interface SWAIGInternalFiller {
  /** Filler phrases played when the AI Agent is hanging up the call. */
  hangup?: FunctionFillers;
  /** Filler phrases played when the AI Agent is checking the time. */
  check_time?: FunctionFillers;
  /** Filler phrases played when the AI Agent is waiting for user input. */
  wait_for_user?: FunctionFillers;
  /** Filler phrases played during deliberate pauses or wait periods. */
  wait_seconds?: FunctionFillers;
  /** Filler phrases played when the AI Agent is adjusting response timing. */
  adjust_response_latency?: FunctionFillers;
  /** Filler phrases played when transitioning between conversation steps when utilizing `prompt.contexts`. */
  next_step?: FunctionFillers;
  /** Filler phrases played when switching between conversation contexts when utilizing `prompt.contexts`. */
  change_context?: FunctionFillers;
  /** Filler phrases played when the AI Agent is processing visual input. This function is enabled when `enable_vision` is set to `true` in `ai.params`. */
  get_visual_input?: FunctionFillers;
  /** Filler phrases played when the AI Agent is thinking or considering options. This is utilized when `enable_thinking` is set to `true` in `ai.params`. */
  get_ideal_strategy?: FunctionFillers;
}

export type SWAIGNativeFunction =
  'check_time' | 'wait_seconds' | 'wait_for_user' | 'adjust_response_latency';

export interface SWMLAction {
  /** A SWML object to be executed. */
  SWML: SWMLObject;
}

export type SWMLMethod =
  | Answer
  | AI
  | AmazonBedrock
  | Cond
  | Connect
  | Denoise
  | EnterQueue
  | Execute
  | Goto
  | Label
  | LiveTranscribe
  | LiveTranslate
  | Hangup
  | JoinRoom
  | JoinConference
  | Play
  | Prompt
  | ReceiveFax
  | Record_
  | RecordCall
  | Request
  | Return
  | SendDigits
  | SendFax
  | SendSMS
  | Set_
  | Sleep
  | SIPRefer
  | StopDenoise
  | StopRecordCall
  | StopTap
  | Switch
  | Tap
  | Transfer
  | Unset
  | Pay
  | DetectMachine
  | UserEvent;

export interface SWMLObject {
  version?: '1.0.0';
  sections: Section;
}

/** A SWML variable reference for dynamic value substitution at runtime. */
export type SWMLVar = string;

export interface SayAction {
  /** A message to be spoken by the AI agent. */
  say: string;
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
  /** Send digit presses as DTMF tones. */
  send_digits: {
    /** The digits to send. Valid values are 0123456789*#ABCDWw. Character W is a 1 second delay, and w is a 500ms delay. */
    digits: string;
  };
}

export interface SendFax {
  /** Send a fax. */
  send_fax: {
    /** URL to the PDF document to fax. */
    document: string;
    /** Header text to include on the fax. */
    header_info?: string;
    /** Station identity to report. */
    identity?: string;
    /** http or https URL to deliver send_fax status events */
    status_url?: string;
  };
}

export interface SendSMS {
  /** Send an outbound SMS or MMS message to a PSTN phone number. */
  send_sms: SMSWithBody | SMSWithMedia;
}

export interface Set_ {
  /** Set script variables to the specified values. */
  set: Record<string, unknown>;
}

export interface SetGlobalDataAction {
  /** A JSON object containing any global data, as a key-value map. This action sets the data in the `global_data` to be globally referenced. */
  set_global_data: Record<string, unknown>;
}

export interface SetMetaDataAction {
  /** A JSON object containing any metadata, as a key-value map. This action sets the data in the `meta_data` to be referenced locally in the function. */
  set_meta_data: Record<string, unknown>;
}

export interface Sleep {
  /** Pause execution for a specified duration. */
  sleep:
    | {
        /** The amount of time to sleep in milliseconds. */
        duration: number | SWMLVar;
      }
    | number
    | SWMLVar;
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

export interface StartUpHookSWAIGFunction {
  /** A description of the context and purpose of the function, to explain to the agent when to use it. */
  description: string;
  /** The purpose field has been deprecated and is replaced by the `description` field. */
  purpose?: string;
  /** A JSON object that defines the expected user input parameters and their validation rules for the function. */
  parameters?: FunctionParameters;
  /** A JSON object defining the fillers that should be played when calling a `swaig function`. This helps the AI break silence between responses. The filler is played asynchronously during the function call. */
  fillers?: FunctionFillers;
  /** The argument field has been deprecated and is replaced by the `parameters` field.  */
  argument?: FunctionParameters;
  /** Whether the function is active. **Default:** `true`. */
  active?: boolean | SWMLVar;
  /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script or from the SWML set_meta_data action. */
  meta_data?: Record<string, unknown>;
  /** Scoping token for meta_data. If not supplied, metadata will be scoped to function's `web_hook_url`. Default is set by SignalWire. */
  meta_data_token?: string;
  /** An object that processes function inputs and executes operations through expressions, webhooks, or direct output. */
  data_map?: DataMap;
  /** Skips the top-level fillers specified in `ai.languages` (which includes `speech_fillers` and `function_fillers`). */
  skip_fillers?: boolean | SWMLVar;
  /** Function-specific URL to send status callbacks and reports to. Takes precedence over a default setting. Authentication can also be set in the url in the format of `username:password@url.` */
  web_hook_url?: string;
  /** A file to play while the function is running. `wait_file_loops` can specify the amount of times that files should continously play. Default is not set. */
  wait_file?: string;
  /** The number of times to loop playing the file. Default is not set. */
  wait_file_loops?: number | string;
  /** Whether to wait for fillers to finish playing before continuing with the function. **Default:** `false`. */
  wait_for_fillers?: boolean | SWMLVar;
  /** A unique name for the function. This can be any user-defined string or can reference a reserved function. Reserved functions are SignalWire functions that will be executed at certain points in the conversation. For the start_hook function, the function name is 'start_hook'. */
  function: 'startup_hook';
}

export interface StopAction {
  /** Whether to stop the conversation. */
  stop: boolean | SWMLVar;
}

export interface StopDenoise {
  /** Stop noise reduction that was started with denoise. */
  stop_denoise: Record<string, unknown>;
}

export interface StopPlaybackBGAction {
  /** Whether to stop the background audio file. */
  stop_playback_bg: boolean | SWMLVar;
}

export interface StopRecordCall {
  /** Stop an active background recording. */
  stop_record_call: {
    /** Identifier for the recording to stop. */
    control_id?: string;
  };
}

export interface StopTap {
  /** Stop an active tap stream. */
  stop_tap: {
    /** ID of the tap to stop. */
    control_id?: string;
  };
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

/** An internal reserved function that generates a summary of the conversation and sends any specified properties to the configured webhook after the conversation has ended. */
export interface SummarizeConversationSWAIGFunction {
  /** A description of the context and purpose of the function, to explain to the agent when to use it. */
  description: string;
  /** The purpose field has been deprecated and is replaced by the `description` field. */
  purpose?: string;
  /** A JSON object that defines the expected user input parameters and their validation rules for the function. */
  parameters?: FunctionParameters;
  /** A JSON object defining the fillers that should be played when calling a `swaig function`. This helps the AI break silence between responses. The filler is played asynchronously during the function call. */
  fillers?: FunctionFillers;
  /** The argument field has been deprecated and is replaced by the `parameters` field.  */
  argument?: FunctionParameters;
  /** Whether the function is active. **Default:** `true`. */
  active?: boolean | SWMLVar;
  /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script or from the SWML set_meta_data action. */
  meta_data?: Record<string, unknown>;
  /** Scoping token for meta_data. If not supplied, metadata will be scoped to function's `web_hook_url`. Default is set by SignalWire. */
  meta_data_token?: string;
  /** An object that processes function inputs and executes operations through expressions, webhooks, or direct output. */
  data_map?: DataMap;
  /** Skips the top-level fillers specified in `ai.languages` (which includes `speech_fillers` and `function_fillers`). */
  skip_fillers?: boolean | SWMLVar;
  /** Function-specific URL to send status callbacks and reports to. Takes precedence over a default setting. Authentication can also be set in the url in the format of `username:password@url.` */
  web_hook_url?: string;
  /** A file to play while the function is running. `wait_file_loops` can specify the amount of times that files should continously play. Default is not set. */
  wait_file?: string;
  /** The number of times to loop playing the file. Default is not set. */
  wait_file_loops?: number | string;
  /** Whether to wait for fillers to finish playing before continuing with the function. **Default:** `false`. */
  wait_for_fillers?: boolean | SWMLVar;
  /** A unique name for the function. This can be any user-defined string or can reference a reserved function. Reserved functions are SignalWire functions that will be executed at certain points in the conversation.. For the summarize_conversation function, the function name is 'summarize_conversation'. */
  function: 'summarize_conversation';
}

export interface Switch {
  /** Execute different instructions based on a variable's value. */
  switch: {
    /** Name of the variable whose value needs to be compared. */
    variable: string;
    /** Object of key-mapped values to array of SWML methods to execute. */
    case: Record<string, SWMLMethod[]>;
    /** Array of SWML methods to execute if no cases match. */
    default?: SWMLMethod[];
  };
}

export interface Tap {
  /** Start background call tap. Media is streamed over Websocket or RTP to customer controlled URI. */
  tap: {
    /** Destination of the tap media stream: rtp://IP:port, ws://example.com, or wss://example.com. */
    uri: string;
    /** Identifier for this tap to use with `stop_tap`. */
    control_id?: string;
    /** Direction of the audio to tap: */
    direction?: 'speak' | 'listen' | 'both';
    /** Codec to use for the tap media stream. */
    codec?: 'PCMU' | 'PCMA';
    /** If `uri` is a `rtp://` this will set the packetization time of the media in milliseconds. */
    rtp_ptime?: number | SWMLVar;
    /** http or https URL to deliver tap status events */
    status_url?: string;
  };
}

export interface ToggleFunctionsAction {
  /** Whether to toggle the functions on or off. */
  toggle_functions: {
    /** Whether to activate or deactivate the functions. Default is `true` */
    active: boolean | SWMLVar;
    /** The function names to toggle. */
    function: string | string[];
  }[];
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
  /** Transfer the execution of the script to a different SWML section, URL, or Relay application. */
  transfer: {
    /** Specifies where to transfer to. The value can be one of: */
    dest: string;
    /** Named parameters to send to transfer destination. */
    params?: Record<string, unknown>;
    /** User data, ignored by SignalWire. */
    meta?: Record<string, unknown>;
  };
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
  /** Unset specified variables. The variables may have been set using the set method */
  unset: string | string[];
}

export interface UnsetGlobalDataAction {
  /** The key of the global data to unset from the `global_data`. You can also reset the `global_data` by passing in a new object. */
  unset_global_data: string | Record<string, unknown>;
}

export interface UnsetMetaDataAction {
  /** The key of the local data to unset from the `meta_data`. You can also reset the `meta_data` by passing in a new object. */
  unset_meta_data: string | Record<string, unknown>;
}

export interface UserEvent {
  /** Allows the user to set and send events to the connected client on the call. */
  user_event: {
    event: Record<string, unknown>;
  };
}

export interface UserInputAction {
  /** Used to inject text into the users queue as if they input the data themselves. */
  user_input: string;
}

export interface UserSWAIGFunction {
  /** A description of the context and purpose of the function, to explain to the agent when to use it. */
  description: string;
  /** The purpose field has been deprecated and is replaced by the `description` field. */
  purpose?: string;
  /** A JSON object that defines the expected user input parameters and their validation rules for the function. */
  parameters?: FunctionParameters;
  /** A JSON object defining the fillers that should be played when calling a `swaig function`. This helps the AI break silence between responses. The filler is played asynchronously during the function call. */
  fillers?: FunctionFillers;
  /** The argument field has been deprecated and is replaced by the `parameters` field.  */
  argument?: FunctionParameters;
  /** Whether the function is active. **Default:** `true`. */
  active?: boolean | SWMLVar;
  /** A powerful and flexible environmental variable which can accept arbitrary data that is set initially in the SWML script or from the SWML set_meta_data action. */
  meta_data?: Record<string, unknown>;
  /** Scoping token for meta_data. If not supplied, metadata will be scoped to function's `web_hook_url`. Default is set by SignalWire. */
  meta_data_token?: string;
  /** An object that processes function inputs and executes operations through expressions, webhooks, or direct output. */
  data_map?: DataMap;
  /** Skips the top-level fillers specified in `ai.languages` (which includes `speech_fillers` and `function_fillers`). */
  skip_fillers?: boolean | SWMLVar;
  /** Function-specific URL to send status callbacks and reports to. Takes precedence over a default setting. Authentication can also be set in the url in the format of `username:password@url.` */
  web_hook_url?: string;
  /** A file to play while the function is running. `wait_file_loops` can specify the amount of times that files should continously play. Default is not set. */
  wait_file?: string;
  /** The number of times to loop playing the file. Default is not set. */
  wait_file_loops?: number | string;
  /** Whether to wait for fillers to finish playing before continuing with the function. **Default:** `false`. */
  wait_for_fillers?: boolean | SWMLVar;
  /** A unique name for the function. This can be any user-defined string or can reference a reserved function. Reserved functions are SignalWire functions that will be executed at certain points in the conversation. */
  function: string;
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

export interface Webhook {
  /** A list of expressions to be evaluated upon matching. */
  expressions?: Expression[];
  /** A string or array of strings that represent the keys to be used for error handling. This will match the key(s) in the response from the API call. */
  error_keys?: string | string[];
  /** The endpoint for the external service or API. */
  url: string;
  /** Iterates over an array of objects and processes a output based on each element in the array. Works similarly to JavaScript's forEach method. */
  foreach?: {
    /** The key to be used to access the current element in the array. */
    input_key: string;
    /** The key that can be referenced in the output of the `foreach` iteration. The values that are stored from `append` will be stored in this key. */
    output_key: string;
    /** The max amount of elements that are iterated over in the array. This will start at the beginning of the array. */
    max?: number | SWMLVar;
    /** The values to append to the output_key. */
    append: string;
  };
  /** Any necessary headers for the API call. */
  headers?: Record<string, unknown>;
  /** The HTTP method (GET, POST, etc.) for the API call. */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** A boolean to determine if the input arguments should be passed as parameters. */
  input_args_as_params?: boolean | SWMLVar;
  /** An object of any necessary parameters for the API call. The key is the parameter name and the value is the parameter value. */
  params?: Record<string, unknown>;
  /** A string or array of strings that represent the `arguments` that are required to make the webhook request. */
  require_args?: string | string[];
  /** An object that contains a response and a list of actions to be performed upon completion of the webhook request. */
  output?: Output;
}

export type play_url = string;

/** Universal Unique Identifier. */
export type uuid = string;
