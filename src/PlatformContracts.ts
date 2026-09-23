/**
 * Platform contract types — the dynamic-SWML request body the backend POSTs to a
 * SWML request handler, and the error body the Compatibility REST API returns.
 *
 * These are generated from the SignalWire SWML webhook contract (a faithful
 * transcription of the documented SWML request/response shapes and the
 * Compatibility REST error body).
 * This file is a thin barrel re-exporting the generated types so every consumer
 * keeps a stable `./PlatformContracts.js` import path; regenerate via
 * `npx tsx scripts/generate-rest-types.ts`. Do not hand-edit the shapes here —
 * edit the spec and regenerate.
 *
 * NOTE: the SWAIG payloads (function-request + post-prompt) are NOT re-exported
 * here — they now come from the AUTHORITATIVE mod_openai engine specs via
 * `./SwaigContracts.js` (SwaigRequest / PostPrompt).
 * The swml-webhooks spec's own SwaigRequestData / PostPromptData* are
 * the superseded non-authoritative derivatives (see SwaigContracts.generated.ts);
 * they remain in PlatformContracts.generated.ts only until the SWAIG schemas are
 * dropped from the shared swml-webhooks spec (a coupled cross-port spec change).
 */
export type {
  SwmlRequestData,
  SwmlRequestCall,
  SignalWireErrorBody,
} from './PlatformContracts.generated.js';
