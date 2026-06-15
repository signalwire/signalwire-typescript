/**
 * Platform contract types — the shapes the SignalWire backend POSTs to webhook
 * endpoints (SWAIG function calls, post-prompt summaries, dynamic-SWML requests)
 * and the error body the Compatibility REST API returns.
 *
 * These are GENERATED from porting-sdk/rest-apis/swml-webhooks/openapi.yaml (a
 * faithful transcription of the prose contracts in relay-apis/public/swml.md +
 * the compatibility errors.tsp — there is no upstream machine-readable spec).
 * This file is a thin barrel re-exporting the generated types so every consumer
 * keeps a stable `./PlatformContracts.js` import path; regenerate via
 * `npx tsx scripts/generate-rest-types.ts`. Do not hand-edit the shapes here —
 * edit the spec and regenerate.
 */
export type {
  SwaigRequestData,
  SwaigArgument,
  PostPromptData,
  PostPromptParams,
  PostPromptConversationTurn,
  PostPromptFunctionCall,
  SwmlRequestData,
  SwmlRequestCall,
  SignalWireErrorBody,
} from './PlatformContracts.generated.js';
