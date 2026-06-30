/**
 * 10DLC Campaign Registry namespace — brands, campaigns, orders, numbers.
 *
 * The registry resource classes are generated from the relay-rest OpenAPI spec
 * (`relay-rest.resources.generated.ts`); the cross-spec `RegistryNamespace`
 * container is generated into the client tree (`_client_tree_generated.ts`).
 * This module re-exports them so existing imports keep working.
 */

export {
  RegistryBrands,
  RegistryCampaigns,
  RegistryNumbers,
  RegistryOrders,
} from './relay-rest.resources.generated.js';
export { RegistryNamespace } from './_client_tree_generated.js';
