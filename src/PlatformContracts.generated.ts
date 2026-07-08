// AUTO-GENERATED from porting-sdk/rest-apis/swml-webhooks/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-swml-verbs.ts
//
// Held to the same lint bar as hand-written source (no rule suppressions, no
// loose types). If the generator cannot emit a clean faithful type, fix the
// generator rather than weaken the output.

/** Body POSTed to a SWAIG function's web_hook_url when the AI invokes it. */
export interface SwaigRequestData {
  /** Unique identifier for the call. */
  call_id: string;
  /** Identifier for the AI session. */
  ai_session_id: string;
  /** Application name (e.g. "swml"). */
  app_name?: string;
  /** Your SignalWire project UUID. */
  project_id: string;
  /** Your SignalWire space UUID. */
  space_id: string;
  /** The function name being invoked. */
  action: string;
  /** The function name (same as action). */
  function: string;
  argument: SwaigArgument;
  /** Custom metadata from SWAIG.defaults.meta_data. */
  meta_data?: Record<string, unknown>;
  /** Identifier for the conversation thread. */
  conversation_id?: string;
  /** Content type identifier (e.g. "text/swaig"). */
  content_type?: string;
  /** SWAIG protocol version (e.g. "2.0"). */
  version?: string;
  [key: string]: unknown;
}

/** The arguments the AI extracted for a SWAIG function call. */
export interface SwaigArgument {
  /** Structured argument data as JSON objects. */
  parsed: Record<string, unknown>[];
  /** Raw argument string from the AI. */
  raw: string;
  /** Argument with variable substitutions applied. */
  substituted: string;
}

/** Body POSTed to post_prompt_url at the end of an AI call — the calling.call.ai.complete event envelope. */
export interface PostPromptData {
  event_type?: string;
  event_channel?: string;
  timestamp?: number;
  project_id?: string;
  space_id?: string;
  params: PostPromptParams;
  [key: string]: unknown;
}

/** The AI-completion payload carried by a post-prompt webhook. */
export interface PostPromptParams {
  call_id: string;
  ai_session_id: string;
  /** The model's conversation summary. */
  summary?: string;
  /** Structured summary requested via post_prompt. */
  post_prompt_result?: Record<string, unknown> | string;
  end_reason?: string;
  conversation?: PostPromptConversationTurn[];
  function_calls?: PostPromptFunctionCall[];
  [key: string]: unknown;
}

/** A single turn in a post-prompt conversation transcript. */
export interface PostPromptConversationTurn {
  role: string;
  content: string;
}

/** A function the AI called during the conversation, as reported post-prompt. */
export interface PostPromptFunctionCall {
  function: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

/** Body POSTed to a dynamic-SWML request handler. */
export interface SwmlRequestData {
  call?: SwmlRequestCall;
  /** SWML variables. */
  vars?: Record<string, unknown>;
  /** Environment values. */
  envs?: Record<string, unknown>;
  /** Request params (query/body merge). */
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

/** The call object embedded in a dynamic-SWML request. */
export interface SwmlRequestCall {
  call_id: string;
  node_id?: string;
  segment_id?: string;
  project_id: string;
  space_id: string;
  call_state?: string;
  direction?: string;
  type?: string;
  from?: string;
  to?: string;
  from_number?: string;
  to_number?: string;
  headers?: Record<string, unknown>[];
  [key: string]: unknown;
}

/** Error body returned by the Compatibility REST API (single-error form). Source: signalwire/docs specs/compatibility-api/_shared/errors.tsp (CompatibilityErrorResponse). */
export interface SignalWireErrorBody {
  /** Numeric error code. */
  code: number;
  /** Human-readable error message. */
  message: string;
  /** URL with more information about the error. */
  more_info?: string;
  /** HTTP status code. */
  status?: number;
}
