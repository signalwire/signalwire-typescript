/**
 * Platform contract types — the request body the SignalWire engine POSTs to a
 * dynamic-SWML request handler.
 *
 * Generated from porting-sdk/rest-apis/swml-webhooks/openapi.yaml, which is itself
 * rendered from the engine-derived `webhook_request` contract (mod_infrastructure).
 * `SwmlRequestCall` is the union of the call object's per-device-type variants
 * (phone / sip / webrtc / other). This file is a thin barrel re-exporting the
 * generated types so every consumer keeps a stable `./PlatformContracts.js` import
 * path; regenerate via `npx tsx scripts/generate-swml-verbs.ts`. Do not hand-edit
 * the shapes here.
 *
 * NOTE: the SWAIG payloads (function-request + post-prompt) come from the
 * mod_openai engine specs via `./SwaigContracts.js` (SwaigRequest / PostPrompt).
 */
export type { SwmlRequestData, SwmlRequestCall } from './PlatformContracts.generated.js';
