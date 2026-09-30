/**
 * SignalWire REST Client — typed HTTP access to all SignalWire platform APIs.
 *
 * Standalone module (not coupled to AgentBase). Shares Logger + env var conventions.
 */

import { getLogger } from '../Logger.js';
import { HttpClient } from './HttpClient.js';
import type { ClientOptions } from './types.js';

// The generated resource tree (flat resources + namespace containers), wired
// from each resource's spec placement (RULES §8). RestClient composes it and
// owns only the non-spec-derivable bits (auth, HTTP construction).
import { _GeneratedResourceTree } from './namespaces/_client_tree_generated.js';

const logger = getLogger('rest_client');

/**
 * REST client for the SignalWire platform APIs.
 *
 * @example
 * ```ts
 * import { RestClient } from '@signalwire/sdk';
 *
 * const client = new RestClient({
 *   project: 'your-project-id',
 *   token: 'your-api-token',
 *   host: 'your-space.signalwire.com',
 * });
 *
 * // Or use env vars (SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE):
 * //   const client = new RestClient();
 *
 * // Use namespaced resources
 * const callId = 'call-uuid';
 * await client.fabric.aiAgents.list();
 * await client.calling.play(callId, [{ type: 'audio', params: { url: 'https://cdn.example.com/greeting.mp3' } }]);
 * await client.phoneNumbers.search({ areacode: '512' });
 * await client.video.rooms.create({ name: 'standup' });
 * ```
 */
export class RestClient extends _GeneratedResourceTree {
  // The flat resources (phoneNumbers, addresses, …) and namespace containers
  // (fabric, video, logs, registry, …) are declared + wired by the generated
  // `_GeneratedResourceTree` base (RULES §8). RestClient adds only what is NOT
  // spec-derivable below.

  /**
   * Create a new REST client.
   *
   * @param options - Connection options. `project`, `token`, and `host` are
   *   required. If any are omitted they fall back to `SIGNALWIRE_PROJECT_ID`,
   *   `SIGNALWIRE_API_TOKEN`, and `SIGNALWIRE_SPACE` environment variables.
   * @throws {Error} When `project`, `token`, or `host` is missing from both
   *   the options and the environment.
   */
  constructor(options: ClientOptions = {}) {
    super();
    const project = options.project || process.env['SIGNALWIRE_PROJECT_ID'] || '';
    const token = options.token || process.env['SIGNALWIRE_API_TOKEN'] || '';
    // Endpoint override, in precedence order (fleet convention, r5 F4):
    //   1. explicit `host` option (may be a bare host OR a full http(s):// URL),
    //   2. `SIGNALWIRE_REST_BASE_URL` env — the canonical fleet base-url override
    //      (matches go's `SIGNALWIRE_REST_BASE_URL`); always a full URL,
    //   3. `SIGNALWIRE_SPACE` env — the bare space host.
    const host =
      options.host ||
      process.env['SIGNALWIRE_REST_BASE_URL'] ||
      process.env['SIGNALWIRE_SPACE'] ||
      '';

    if (!project || !token || !host) {
      throw new Error(
        'project, token, and host are required. ' +
          'Provide them as arguments or set SIGNALWIRE_PROJECT_ID, ' +
          'SIGNALWIRE_API_TOKEN, and (SIGNALWIRE_SPACE or SIGNALWIRE_REST_BASE_URL) ' +
          'environment variables.',
      );
    }

    // Pass a fully-qualified host as baseUrl; otherwise pass the bare host and let
    // HttpClient pick the scheme (http:// for a loopback mock/dev host, https://
    // for a real *.signalwire.com space). This lets a shipped example run verbatim
    // against the local mock via SIGNALWIRE_REST_BASE_URL=http://127.0.0.1:<port>
    // (or SIGNALWIRE_SPACE=127.0.0.1:<port>), with the scheme decision living in
    // one place (HttpClient). Mirrors the python reference.
    const httpOptions = host.startsWith('http') ? { baseUrl: host } : { host };

    const http = new HttpClient({
      ...httpOptions,
      project,
      token,
      fetchImpl: options.fetchImpl,
      requestOptions: options.requestOptions,
    });

    logger.info('RestClient initialized', { host });

    // Generated resource tree (flat resources + namespace containers).
    this._wireResources(http);
  }
}

// --- Barrel exports ---

// Client
export { HttpClient } from './HttpClient.js';
export {
  RestError,
  RestTransportError,
  SignalWireRestError,
  SignalWireRestTransportError,
} from './RestError.js';
export { paginate, paginateAll } from './pagination.js';

// Request-options transport envelope (plan 4.2): timeout / retry / abort.
export { RequestOptions } from './RequestOptions.js';
export type { RequestOptionsInit } from './RequestOptions.js';

// Types
export type {
  ClientOptions,
  HttpClientOptions,
  PaginatedResponse,
  LamlPaginatedResponse,
  QueryParams,
} from './types.js';

// Generated wire & serialization DTOs — the `*Request`/`*Response` types every
// RestClient method takes and returns, re-exported so consumers can name a typed
// request body or method result (issue #19530). See types.public.generated.ts.
export type * from './types.public.generated.js';

// Base classes
export { BaseResource } from './base/BaseResource.js';
export { CrudResource } from './base/CrudResource.js';
export { CrudWithAddresses } from './base/CrudWithAddresses.js';

// Call-handler enum (for phoneNumbers.update call_handler field)
export { PhoneCallHandler } from './callHandler.js';

// Namespaces
export {
  FabricNamespace,
  FabricResource,
  FabricResourcePUT,
  CallFlowsResource,
  ConferenceRoomsResource,
  SubscribersResource,
  CxmlApplicationsResource,
  GenericResources,
  FabricAddresses,
  FabricTokens,
} from './namespaces/fabric.js';
export {
  AiAgents,
  CxmlScripts,
  CxmlWebhooks,
  FreeswitchConnectors,
  RelayApplications,
  SipEndpoints,
  SipGateways,
  SwmlScripts,
  SwmlWebhooks,
} from './namespaces/fabric.resources.generated.js';
export { CallingNamespace } from './namespaces/calling.js';
export { DatasphereNamespace, DatasphereDocuments } from './namespaces/datasphere.js';
export { PhoneNumbersResource } from './namespaces/phone-numbers.js';
export { AddressesResource } from './namespaces/addresses.js';
export { QueuesResource } from './namespaces/queues.js';
export { RecordingsResource } from './namespaces/recordings.js';
export { NumberGroupsResource } from './namespaces/number-groups.js';
export { VerifiedCallersResource } from './namespaces/verified-callers.js';
export { SipProfileResource } from './namespaces/sip-profile.js';
export { LookupResource } from './namespaces/lookup.js';
export { ShortCodesResource } from './namespaces/short-codes.js';
export { ImportedNumbersResource } from './namespaces/imported-numbers.js';
export { MfaResource } from './namespaces/mfa.js';
export {
  RegistryNamespace,
  RegistryBrands,
  RegistryCampaigns,
  RegistryOrders,
  RegistryNumbers,
} from './namespaces/registry.js';
export {
  VideoNamespace,
  VideoRooms,
  VideoRoomTokens,
  VideoRoomSessions,
  VideoRoomRecordings,
  VideoConferences,
  VideoConferenceTokens,
  VideoStreams,
} from './namespaces/video.js';
export {
  LogsNamespace,
  MessageLogs,
  VoiceLogs,
  FaxLogs,
  ConferenceLogs,
} from './namespaces/logs.js';
export { ProjectNamespace, ProjectTokens } from './namespaces/project.js';
export { PubSubResource } from './namespaces/pubsub.js';
export { ChatResource } from './namespaces/chat.js';
