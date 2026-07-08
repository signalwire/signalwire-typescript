// AUTO-GENERATED from porting-sdk/swaig-specs/swaig-response.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-swaig-payloads.ts
//
// The typed SWAIG response-action CONFIG types (one <Verb>Action per object-shaped
// action value). The ergonomic builder methods live on FunctionResult; these are the
// shapes those methods accept. Held to the same lint bar as hand source.

export interface ContextSwitchAction {
  system_prompt?: Record<string, unknown>;
  user_prompt?: Record<string, unknown>;
  system_pom?: Record<string, unknown>;
  user_pom?: Record<string, unknown>;
  consolidate?: boolean;
  full_reset?: boolean;
  [key: string]: unknown;
}

export interface HoldAction {
  timeout?: number;
  [key: string]: unknown;
}

export interface PlaybackBgAction {
  file?: Record<string, unknown>;
  wait?: boolean;
  [key: string]: unknown;
}

export interface TransferAction {
  dest?: Record<string, unknown>;
  summarize?: boolean;
  [key: string]: unknown;
}
