// AUTO-GENERATED from porting-sdk/swaig-specs/swaig-response.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-swaig-payloads.ts
//
// The typed SWAIG response-action CONFIG types (one <Verb>Action per object-shaped
// action value), plus the response ENVELOPE types SwaigAction (the action object)
// and SwaigResponse (the body a handler returns). The ergonomic builder methods
// live on FunctionResult; these are the shapes those methods accept. Held to the
// same lint bar as hand source.

export interface ContextSwitchAction {
  consolidate?: boolean;
  full_reset?: boolean;
  /** read by the engine; no predicate types it here */
  system_pom?: Record<string, unknown>;
  system_prompt?: string;
  /** read by the engine; no predicate types it here */
  user_pom?: Record<string, unknown>;
  user_prompt?: string;
  [key: string]: unknown;
}

export interface HoldAction {
  timeout?: number | string;
  [key: string]: unknown;
}

export interface PlaybackBgAction {
  file?: string;
  wait?: boolean;
  [key: string]: unknown;
}

export interface TransferAction {
  dest?: string;
  summarize?: boolean;
  [key: string]: unknown;
}

/** A response-action object. The keys below are the full vocabulary dispatched by actions.c::process_action; an action object sets one or more of them. Each key's source line is the engine dispatch site. */
export interface SwaigAction {
  add_dynamic_hints?: (
    | {
        hint?: string;
      }
    | string
  )[];
  back_to_back_functions?: boolean | 'forever';
  change_context?: string;
  change_step?: string;
  clear_dynamic_hints?: Record<string, unknown>;
  context_switch?: string | ContextSwitchAction;
  end_of_speech_timeout?: number;
  extensive_data?: boolean;
  functions_on_speaker_timeout?: boolean;
  hangup?: Record<string, unknown>;
  hold?: number | string | HoldAction;
  playback_bg?: string | PlaybackBgAction;
  replace_in_history?: string | true;
  say?: string;
  set_global_data?: Record<string, unknown>;
  set_meta_data?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  speech_event_timeout?: number;
  stop?: Record<string, unknown>;
  stop_playback_bg?: Record<string, unknown>;
  toggle_functions?: {
    active?: boolean | number | string;
    function?: string;
  }[];
  transfer?: string | TransferAction;
  unset_global_data?: string | string[];
  unset_meta_data?: string | string[];
  user_event?: Record<string, unknown>;
  user_input?: string;
  wait_for_user?: boolean | number | 'answer_first';
  [key: string]: unknown;
}

/** Parsed at actions.c:2228-2276. */
export interface SwaigResponse {
  /** Result text fed back to the AI for its reply. */
  response?: string;
  /** One action object, or an array of them. Each object may carry several action keys; every recognized key is dispatched. See SwaigAction. */
  action?: SwaigAction | SwaigAction[];
  /** If true, defer response+actions until after the AI's next turn (delayed_response). */
  post_process?: boolean;
  [key: string]: unknown;
}
