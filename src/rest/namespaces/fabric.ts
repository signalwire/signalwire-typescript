/**
 * Fabric API namespace — resource composition, addresses, and tokens.
 *
 * All fabric resource classes are generated from the fabric OpenAPI spec
 * (`fabric.resources.generated.ts`); the `FabricNamespace` container is generated
 * into the client tree (`_client_tree_generated.ts`). This module re-exports them
 * (plus the historical `*Resource` aliases) so existing imports keep working.
 *
 * @example
 * ```ts
 * const agents = await client.fabric.aiAgents.list();
 * const flow = await client.fabric.callFlows.create({ name: 'main-ivr' });
 * const token = await client.fabric.tokens.createSubscriberToken({ subscriber_id: 'sub_123' });
 * ```
 */

// `FabricResource` / `FabricResourcePUT` are the CrudWithAddresses bases the
// generated fabric subclasses extend (kept in `../base/FabricResource.js` to
// avoid an import cycle). Re-exported for callers that import them from here.
export { FabricResource, FabricResourcePUT } from '../base/FabricResource.js';

export {
  AiAgents,
  CallFlows,
  CallFlows as CallFlowsResource,
  ConferenceRooms,
  ConferenceRooms as ConferenceRoomsResource,
  CxmlApplications,
  CxmlApplications as CxmlApplicationsResource,
  CxmlScripts,
  CxmlWebhooks,
  FabricAddresses,
  FabricTokens,
  FreeswitchConnectors,
  GenericResources,
  RelayApplications,
  SipEndpoints,
  SipGateways,
  Subscribers,
  Subscribers as SubscribersResource,
  SwmlScripts,
  SwmlWebhooks,
} from './fabric.resources.generated.js';
export { FabricNamespace } from './_client_tree_generated.js';
