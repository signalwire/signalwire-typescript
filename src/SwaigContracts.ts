/**
 * Typed SWAIG wire payloads (SWAIG_PIPELINE §4) — the bodies the SignalWire AI
 * engine (mod_openai) POSTs to a SWAIG function's web_hook_url and to
 * post_prompt_url at call end. `SwaigRequest` is what a function handler RECEIVES;
 * the `PostPrompt` tree is the call-summary payload the post-prompt / `onSummary`
 * callback RECEIVES.
 *
 * Generated from the authoritative SignalWire AI engine SWAIG specifications,
 * mirroring the Python SDK's request/response payload types. This file is a thin
 * barrel re-exporting the generated types so every consumer keeps a stable
 * `./SwaigContracts.js` import path; regenerate via
 * `npx tsx scripts/generate-rest-types.ts`. Do not hand-edit the shapes — edit
 * the spec and regenerate.
 */
export type {
  SwaigRequest,
  SwaigArgument,
  PostPrompt,
  PostPromptData,
  PostPromptCallLogEntry,
  PostPromptUserEntry,
  PostPromptAssistantEntry,
  PostPromptThinkingEntry,
  PostPromptToolEntry,
  PostPromptSystemLogEntry,
  PostPromptSystemEntry,
  PostPromptSwaigLogEntry,
  PostPromptTimesEntry,
  PostPromptEntity,
  PostPromptEot,
  PostPromptTiming,
  PostPromptStampsUs,
} from './SwaigContracts.generated.js';
