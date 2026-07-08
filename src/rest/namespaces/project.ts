/**
 * Project API namespace — API token management.
 *
 * The `ProjectTokens` resource class is generated from the project OpenAPI spec
 * (`project.resources.generated.ts`); the `ProjectNamespace` container is
 * generated into the client tree (`_client_tree_generated.ts`). This module
 * re-exports both so existing imports keep working.
 */

export { ProjectTokens } from './project.resources.generated.js';
export { ProjectNamespace } from './_client_tree_generated.js';
