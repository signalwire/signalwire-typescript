/**
 * Logs namespace — message, voice, fax, and conference logs (read-only).
 *
 * Each log resource is generated from its own canonical OpenAPI spec module
 * (message → `message`, voice → `voice`, fax → `fax`, conference → `logs`); the
 * cross-spec `LogsNamespace` container is generated into the client tree
 * (`_client_tree_generated.ts`). This module re-exports them so existing imports
 * keep working.
 */

export { MessageLogs } from './message.resources.generated.js';
export { VoiceLogs } from './voice.resources.generated.js';
export { FaxLogs } from './fax.resources.generated.js';
export { ConferenceLogs } from './logs.resources.generated.js';
export { LogsNamespace } from './_client_tree_generated.js';
