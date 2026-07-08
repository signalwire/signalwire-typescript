// AUTO-GENERATED from porting-sdk/swaig-specs/{swaig-request,post-prompt}.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-swaig-payloads.ts
//
// The typed SWAIG wire payloads (SWAIG_PIPELINE §4) from the AUTHORITATIVE
// mod_openai engine specs: SwaigRequest is the body a SWAIG function handler
// RECEIVES; the PostPrompt tree is the call-end summary payload the
// post-prompt / onSummary callback RECEIVES. Open-shaped READ payloads — every
// field optional, every named type carries a [key: string]: unknown tail so
// unmodeled server keys round-trip. Held to the same lint bar as hand-written
// source (no rule suppressions, no loose types).

export interface SwaigArgument {
  /** JSON objects parsed from the model's argument string (always an array, possibly empty). */
  parsed?: unknown[];
  /** The original argument string. */
  raw?: string;
  /** The argument string with JSON blocks replaced. */
  substituted?: string;
  [key: string]: unknown;
}

export interface SwaigRequest {
  /** Always present. */
  ai_session_id?: string;
  /** Always present. */
  app_name?: string;
  /** added **only on the data_map path** (`if (sh->data_map)`, `actions.c:2198`). `args` is `argument.parsed[0]` promoted to the top level (`actions.c:2206`); `input` is a shallow self-duplicate of the post_data (`actions.c:2211`). The webhook-URL path does not add these. */
  args?: string;
  argument?: SwaigArgument;
  /** Always present. */
  argument_desc?: Record<string, unknown>;
  /** Always present. */
  call_id?: string;
  /** only if `swaig_post_conversation` is set (`actions.c:2134`). `call_log` is redacted when `redact_prompt` is enabled (`actions.c:2137`); `raw_call_log` is the full transcript (`actions.c:2139`). */
  call_log?: unknown[];
  /** only if the caller-ID channel vars are set (`actions.c:2051`/`2055`). The source channel var for `caller_id_num` is `caller_id_number` — the JSON key is renamed to `caller_id_num`. */
  caller_id_name?: string;
  /** only if the caller-ID channel vars are set (`actions.c:2051`/`2055`). The source channel var for `caller_id_num` is `caller_id_number` — the JSON key is renamed to `caller_id_num`. */
  caller_id_num?: string;
  /** Always present. */
  channel_active?: boolean;
  /** Always present. */
  channel_offhook?: boolean;
  /** Always present. */
  channel_ready?: boolean;
  /** Always present. */
  content_disposition?: 'SWAIG Function';
  /** Always present. */
  content_type?: 'text/swaig';
  /** only if configured (`actions.c:2077`). */
  conversation_id?: string;
  /** Always present. */
  description?: string;
  /** only on a hangup-hook/error invocation when `fatal_error_reason` is set (`actions.c:2063-2065`). See CLAUDE.md "Fatal Error Recovery Flow". */
  error_reason?: string;
  /** only on a hangup-hook/error invocation when `fatal_error_reason` is set (`actions.c:2063-2065`). See CLAUDE.md "Fatal Error Recovery Flow". */
  fatal_error?: boolean;
  /** Always present. */
  function?: string;
  /** only if global data exists (`actions.c:2016`). */
  global_data?: Record<string, unknown>;
  /** added **only on the data_map path** (`if (sh->data_map)`, `actions.c:2198`). `args` is `argument.parsed[0]` promoted to the top level (`actions.c:2206`); `input` is a shallow self-duplicate of the post_data (`actions.c:2211`). The webhook-URL path does not add these. */
  input?: string;
  /** only if the function has a `meta_data_token` (`actions.c:2085-2093`). `meta_data` is that token's metadata store (empty object if none). */
  meta_data?: Record<string, unknown>;
  /** only if the function has a `meta_data_token` (`actions.c:2085-2093`). `meta_data` is that token's metadata store (empty object if none). */
  meta_data_token?: string;
  /** only if the `signalwire_project_id` / `signalwire_space_id` channel vars are set (`actions.c:2040`/`2044`). */
  project_id?: string;
  /** only if `swaig_post_conversation` is set (`actions.c:2134`). `call_log` is redacted when `redact_prompt` is enabled (`actions.c:2137`); `raw_call_log` is the full transcript (`actions.c:2139`). */
  raw_call_log?: unknown[];
  /** only if the `signalwire_project_id` / `signalwire_space_id` channel vars are set (`actions.c:2040`/`2044`). */
  space_id?: string;
  /** Always present. */
  version?: '2.0';
  [key: string]: unknown;
}

/** Built by ais_get_post_data (ai_utils.c) + openai_post_process (post_process.c). No `version` field. Open shape: conditional fields appear only when their precondition holds. */
export interface PostPrompt {
  content_type?: 'text/json';
  content_disposition?: 'agent.summary';
  conversation_type?: 'voice';
  action?: 'post_conversation';
  project_id?: string;
  space_id?: string;
  call_id?: string;
  app_name?: string;
  ai_session_id?: string;
  ai_id_tag?: string;
  conversation_id?: string;
  call_ended_by?: string;
  caller_id_name?: string;
  caller_id_number?: string;
  conversation_summary?: string;
  hard_timeout?: boolean;
  call_start_date?: number;
  call_answer_date?: number;
  call_end_date?: number;
  ai_start_date?: number;
  ai_end_date?: number;
  post_prompt_data?: PostPromptData;
  global_data?: Record<string, unknown>;
  SWMLVars?: Record<string, unknown>;
  SWMLCall?: Record<string, unknown>;
  call_log?: PostPromptCallLogEntry[];
  raw_call_log?: PostPromptCallLogEntry[];
  call_timeline?: Record<string, unknown>[];
  previous_contexts?: Record<string, unknown>[][];
  times?: PostPromptTimesEntry[];
  swaig_log?: PostPromptSwaigLogEntry[];
  total_minutes?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_wire_input_tokens?: number;
  total_wire_input_tokens_per_minute?: number;
  total_wire_output_tokens?: number;
  total_wire_output_tokens_per_minute?: number;
  total_tts_chars?: number;
  total_tts_chars_per_min?: number;
  total_asr_minutes?: number;
  total_asr_cost_factor?: number;
  [key: string]: unknown;
}

export interface PostPromptData {
  parsed?: Record<string, unknown>[];
  raw?: string;
  substituted?: string;
  [key: string]: unknown;
}

/** A conversation-log entry, discriminated by `role`. raw_call_log shares this shape (plus raw-only barge fields on assistant entries). */
export type PostPromptCallLogEntry =
  | PostPromptUserEntry
  | PostPromptAssistantEntry
  | PostPromptThinkingEntry
  | PostPromptToolEntry
  | PostPromptSystemLogEntry
  | PostPromptSystemEntry;

export interface PostPromptUserEntry {
  role?: string;
  content?: string;
  timestamp?: number;
  confidence?: number;
  content_type?: string;
  speaker?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  speaking_to_final_event?: number;
  speaking_to_turn_detection?: number;
  turn_detection_to_final_event?: number;
  barge_count?: number;
  merged?: boolean;
  merge_count?: number;
  entity?: PostPromptEntity;
  eot?: PostPromptEot;
  timing?: PostPromptTiming;
  [key: string]: unknown;
}

export interface PostPromptAssistantEntry {
  role?: string;
  content?: string;
  timestamp?: number;
  tool_calls?: Record<string, unknown>[];
  latency?: number;
  utterance_latency?: number;
  audio_latency?: number;
  acoustic_latency?: number | null;
  eos_to_push_latency?: number | null;
  dg_decision_latency?: number | null;
  poll?: number | null;
  speech_start_wall_us?: number;
  last_word_end_wall_us?: number;
  turn_decided_wall_us?: number;
  status_pushed_wall_us?: number;
  stamps_us?: PostPromptStampsUs;
  barged?: boolean;
  barge_elapsed_ms?: number;
  text_heard_approx?: string;
  text_spoken_total?: string;
  [key: string]: unknown;
}

export interface PostPromptThinkingEntry {
  role?: string;
  content?: string;
  timestamp?: number;
  lang?: string;
  tokens?: number;
  [key: string]: unknown;
}

export interface PostPromptToolEntry {
  role?: string;
  tool_call_id?: string;
  content?: string;
  timestamp?: number;
  function_name?: string;
  latency?: number;
  utterance_latency?: number;
  function_latency?: number;
  audio_latency?: number;
  execution_latency?: number;
  deprecation_warning?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  distilled?: boolean;
  original_result?: string;
  [key: string]: unknown;
}

export interface PostPromptSystemLogEntry {
  role?: string;
  content?: string;
  timestamp?: number;
  action?: string;
  lang?: string;
  tokens?: number;
  content_type?: string;
  metadata?: Record<string, unknown>;
  context?: string;
  step?: string;
  step_index?: number;
  [key: string]: unknown;
}

export interface PostPromptSystemEntry {
  role?: string;
  content?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export interface PostPromptSwaigLogEntry {
  command_name?: string;
  command_arg?: string;
  epoch_time?: number;
  native?: boolean;
  active_count?: number | 'endless';
  url?: string;
  post_data?: SwaigRequest;
  post_response?: Record<string, unknown>;
  delayed_post_response?: Record<string, unknown>;
  mcp_url?: string;
  mcp_tool?: string;
  mcp_response?: Record<string, unknown>;
  mcp_error?: string;
  [key: string]: unknown;
}

export interface PostPromptTimesEntry {
  response?: string;
  response_word_count?: number;
  answer_time?: number;
  token_time?: number;
  tokens?: number;
  avg_tps?: number;
  tps?: number;
  [key: string]: unknown;
}

export interface PostPromptEntity {
  type?:
    | 'phone'
    | 'email'
    | 'ssn'
    | 'card'
    | 'uuid'
    | 'url'
    | 'money'
    | 'time'
    | 'date'
    | 'ordinal';
  value?: string;
  valid?: boolean;
  [key: string]: unknown;
}

export interface PostPromptEot {
  basis?: 'entity_snap' | 'growth_stop' | 'ceiling' | 'natural';
  confidence?: number;
  [key: string]: unknown;
}

export interface PostPromptTiming {
  hold_ms?: number;
  commit_latency_ms?: number;
  segments?: number;
  walkbacks?: number;
  [key: string]: unknown;
}

export interface PostPromptStampsUs {
  speech_start?: number;
  last_word_end?: number;
  suspected_end?: number;
  turn_decided?: number;
  status_pushed?: number;
  request_detect?: number;
  first_token?: number;
  first_utterance?: number;
  first_audio?: number;
  [key: string]: unknown;
}
