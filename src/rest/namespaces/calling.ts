/**
 * Calling API namespace — REST-based call control via command dispatch.
 *
 * The `Calling` resource class is generated from the calling OpenAPI spec
 * (`calling.resources.generated.ts`) — one typed method per discriminator
 * command (RULES §6), each POSTing `{command, params, id?}` to
 * `/api/calling/calls`. Re-exported here (with the `CallingNamespace`
 * back-compat alias) so existing imports keep working.
 */

export { Calling, Calling as CallingNamespace } from './calling.resources.generated.js';
