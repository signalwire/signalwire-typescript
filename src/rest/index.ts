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
/**
 * Stands in for the HTTP client of a credential the `RestClient` was not given:
 * every request rejects with an `Error` naming the missing credential, before
 * anything is sent — so a PAT-only client fails loudly on a project resource (and
 * a project-only client on `client.space`) instead of sending a request the
 * server can only refuse.
 */
function missingCredentialHttp(message: string): HttpClient {
  return new Proxy({} as HttpClient, {
    get(_target, prop) {
      // Not a thenable, and no implicit-conversion hooks: only named methods refuse.
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      return () => Promise.reject(new Error(message));
    },
  });
}

export class RestClient extends _GeneratedResourceTree {
  // The flat resources (phoneNumbers, addresses, …) and namespace containers
  // (fabric, video, logs, registry, …) are declared + wired by the generated
  // `_GeneratedResourceTree` base (RULES §8). RestClient adds only what is NOT
  // spec-derivable below.

  /**
   * Create a new REST client.
   *
   * @param options - Connection options. Each falls back to its environment
   *   variable when omitted: `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`,
   *   `SIGNALWIRE_SPACE` and `SIGNALWIRE_PERSONAL_ACCESS_TOKEN`. `project` +
   *   `token` authenticate every project-scoped resource; `personalAccessToken`
   *   (a user's `pat_...` token) authenticates `client.space`. Either credential,
   *   or both, may be given; calling a resource whose credential is missing
   *   rejects with an `Error` naming it, before any request is sent.
   * @throws {Error} When `host` is missing, or neither a complete `project` +
   *   `token` pair nor a `personalAccessToken` is given.
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

    const pat =
      options.personalAccessToken || process.env['SIGNALWIRE_PERSONAL_ACCESS_TOKEN'] || '';
    const hasProject = Boolean(project && token);

    if (!host || !(hasProject || pat)) {
      throw new Error(
        'project, token, and host are required. ' +
          'Provide them as arguments or set SIGNALWIRE_PROJECT_ID, ' +
          'SIGNALWIRE_API_TOKEN, and (SIGNALWIRE_SPACE or SIGNALWIRE_REST_BASE_URL) ' +
          'environment variables (or, for client.space only, host and ' +
          'personalAccessToken / SIGNALWIRE_PERSONAL_ACCESS_TOKEN).',
      );
    }

    // Pass a fully-qualified host as baseUrl; otherwise pass the bare host and let
    // HttpClient pick the scheme (http:// for a loopback mock/dev host, https://
    // for a real *.signalwire.com space). This lets a shipped example run verbatim
    // against the local mock via SIGNALWIRE_REST_BASE_URL=http://127.0.0.1:<port>
    // (or SIGNALWIRE_SPACE=127.0.0.1:<port>), with the scheme decision living in
    // one place (HttpClient). Mirrors the python reference.
    const httpOptions = host.startsWith('http') ? { baseUrl: host } : { host };

    const http = hasProject
      ? new HttpClient({
          ...httpOptions,
          project,
          token,
          fetchImpl: options.fetchImpl,
          requestOptions: options.requestOptions,
        })
      : missingCredentialHttp(
          'project and token are required for this resource ' +
            '(SIGNALWIRE_PROJECT_ID / SIGNALWIRE_API_TOKEN); this client has only ' +
            'a personal access token, which authenticates client.space',
        );
    // A Personal Access Token is HTTP Basic with an EMPTY username
    // (prime-rails API::Space::BaseController -> Authenticators::PersonalAccessToken).
    const patHttp = pat
      ? new HttpClient({
          ...httpOptions,
          project: '',
          token: pat,
          fetchImpl: options.fetchImpl,
          requestOptions: options.requestOptions,
        })
      : missingCredentialHttp(
          'personalAccessToken is required for client.space (SIGNALWIRE_PERSONAL_ACCESS_TOKEN)',
        );

    logger.info('RestClient initialized', { host });

    // Generated resource tree (flat resources + namespace containers).
    this._wireResources(http, patHttp);
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
