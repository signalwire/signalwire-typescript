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

import type { SwaigResponse } from './SwaigActions.generated.js';

export interface SwaigArgument {
  /** JSON values scraped from the model's tool-call argument string (always an array, possibly empty). Each element is an object or an array -- never a scalar. */
  parsed?: (Record<string, unknown> | unknown[])[];
  /** the model's tool-call argument string, verbatim. */
  raw?: string;
  /** the model's tool-call argument string with the extracted JSON removed. Absent when the last extraction left no leading text (swaig.c:637-639). */
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
  call_log?: {
    content?: string;
    role?: string;
    /** written by the engine as a copy of a value assembled elsewhere (cJSON_Duplicate), so this site fixes no type */
    timestamp?: Record<string, unknown>;
    /** written by the engine as a copy of a value assembled elsewhere (cJSON_Duplicate), so this site fixes no type */
    tool_calls?: Record<string, unknown>;
  }[];
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
  raw_call_log?: {
    content?: string;
    role?: string;
    /** written by the engine as a copy of a value assembled elsewhere (cJSON_Duplicate), so this site fixes no type */
    timestamp?: Record<string, unknown>;
    /** written by the engine as a copy of a value assembled elsewhere (cJSON_Duplicate), so this site fixes no type */
    tool_calls?: Record<string, unknown>;
  }[];
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
  call_timeline?: {
    ts?: number;
    type?: string;
  }[];
  previous_contexts?: {
    content?: string;
    role?: string;
  }[][];
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
  /** JSON values scraped from the LLM's post-prompt completion (always an array, possibly empty). Each element is an object or an array -- never a scalar. */
  parsed?: (Record<string, unknown> | unknown[])[];
  /** the LLM's post-prompt completion, verbatim. */
  raw?: string;
  /** the LLM's post-prompt completion with the extracted JSON removed. Absent when the last extraction left no leading text (swaig.c:637-639). */
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
  tool_calls?: {
    function?: {
      arguments?: string;
      name?: string;
    };
    id?: string;
    type?: string;
  }[];
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
  /** closed set of 27 values, from two producers: `ai_conversation_system_log` (7); `tl_make_entry` (21). Derived from the call sites, not hand-listed. */
  action?:
    | 'attention_timeout'
    | 'auto_correct'
    | 'change_step_failed'
    | 'check_for_input'
    | 'context_enter'
    | 'double_turn'
    | 'filler'
    | 'function_call'
    | 'function_error'
    | 'function_loop'
    | 'gather_answer'
    | 'gather_complete'
    | 'gather_question'
    | 'gather_reject'
    | 'gather_start'
    | 'hangup_hook'
    | 'hearing_hint'
    | 'inner_dialog'
    | 'inner_dialog_scorecard'
    | 'manual_say'
    | 'reset'
    | 'session_end'
    | 'session_start'
    | 'startup_hook'
    | 'step_change'
    | 'summarize_start'
    | 'swaig_problem';
  lang?: string;
  tokens?: number;
  content_type?: string;
  /** per-action detail. `tl_stamp_location` (timeline.c) stamps `context`/`step`/`step_index` here; the remaining keys vary by `action` and are open. Entries from the second producer (`ai_conversation_system_log`, conversation.c) carry their detail as TOP-LEVEL keys instead and have no `metadata` object. */
  metadata?: {
    context?: string;
    step?: string;
    step_index?: number;
  };
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
  /** present and true for a NATIVE function, which has no SWAIG handle (actions.c:1954); absent otherwise */
  native?: true;
  /** the function's remaining activation count, or "endless". Written only for a non-native function (actions.c:1968-1971), so it is absent whenever `native` is present. */
  active_count?: number | 'endless';
  url?: string;
  post_data?: SwaigRequest;
  /** the SWAIG webhook's response body, as returned (actions.c:2312). Mutually exclusive with delayed_post_response. */
  post_response?: SwaigResponse;
  /** the SWAIG webhook's response body when it is held for post-processing instead of executed immediately (actions.c:2256). Mutually exclusive with post_response. */
  delayed_post_response?: SwaigResponse;
  mcp_url?: string;
  mcp_tool?: string;
  /** the MCP tool's raw result text, as returned by mcp_call_tool (actions.c:2158). Not parsed JSON. */
  mcp_response?: string;
  /** present and true when the MCP tool returned no result (actions.c:2162); absent otherwise */
  mcp_error?: true;
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
    'phone' | 'email' | 'ssn' | 'card' | 'uuid' | 'url' | 'money' | 'time' | 'date' | 'ordinal';
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
