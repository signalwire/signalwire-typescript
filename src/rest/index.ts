/**
 * SignalWire REST Client — typed HTTP access to all SignalWire platform APIs.
 *
 * Standalone module (not coupled to AgentBase). Shares Logger + env var conventions.
 */

import { getLogger } from '../Logger.js';
import { HttpClient } from './HttpClient.js';
import type { ClientOptions } from './types.js';

// Namespaces
import { FabricNamespace } from './namespaces/fabric.js';
import { CallingNamespace } from './namespaces/calling.js';
import { PhoneNumbersResource } from './namespaces/phone-numbers.js';
import { AddressesResource } from './namespaces/addresses.js';
import { QueuesResource } from './namespaces/queues.js';
import { RecordingsResource } from './namespaces/recordings.js';
import { NumberGroupsResource } from './namespaces/number-groups.js';
import { VerifiedCallersResource } from './namespaces/verified-callers.js';
import { SipProfileResource } from './namespaces/sip-profile.js';
import { LookupResource } from './namespaces/lookup.js';
import { ShortCodesResource } from './namespaces/short-codes.js';
import { ImportedNumbersResource } from './namespaces/imported-numbers.js';
import { MfaResource } from './namespaces/mfa.js';
import { RegistryNamespace } from './namespaces/registry.js';
import { DatasphereNamespace } from './namespaces/datasphere.js';
import { VideoNamespace } from './namespaces/video.js';
import { LogsNamespace } from './namespaces/logs.js';
import { ProjectNamespace } from './namespaces/project.js';
import { PubSubResource } from './namespaces/pubsub.js';
import { ChatResource } from './namespaces/chat.js';
import { CompatNamespace } from './namespaces/compat.js';

const logger = getLogger('rest_client');

/**
 * REST client for the SignalWire platform APIs.
 *
 * @example
 * ```ts
 * const client = new RestClient({
 *   project: 'your-project-id',
 *   token: 'your-api-token',
 *   host: 'your-space.signalwire.com',
 * });
 *
 * // Or use env vars: SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE
 * const client = new RestClient();
 *
 * // Use namespaced resources
 * await client.fabric.aiAgents.list();
 * await client.calling.play(callId, { play: [...] });
 * await client.phoneNumbers.search({ areaCode: '512' });
 * await client.video.rooms.create({ name: 'standup' });
 * await client.compat.calls.list();
 * ```
 */
export class RestClient {
  // Fabric API
  /** Fabric composition — AI Agents, SWML scripts, call flows, tokens, etc. */
  readonly fabric: FabricNamespace;

  // Calling API
  /** REST-based call control surface (all 37 commands as methods). */
  readonly calling: CallingNamespace;

  // Relay REST resources
  /** Phone-number CRUD plus availability search. */
  readonly phoneNumbers: PhoneNumbersResource;
  /** Relay Address CRUD. */
  readonly addresses: AddressesResource;
  /** Call-queue CRUD plus member operations. */
  readonly queues: QueuesResource;
  /** Recording read / delete. */
  readonly recordings: RecordingsResource;
  /** Number-group CRUD plus membership operations. */
  readonly numberGroups: NumberGroupsResource;
  /** Verified Caller ID CRUD plus verification flow. */
  readonly verifiedCallers: VerifiedCallersResource;
  /** Project-level SIP profile read / update (singleton). */
  readonly sipProfile: SipProfileResource;
  /** Carrier + CNAM phone-number lookups. */
  readonly lookup: LookupResource;
  /** Short-code read / update. */
  readonly shortCodes: ShortCodesResource;
  /** Import externally-hosted phone numbers. */
  readonly importedNumbers: ImportedNumbersResource;
  /** Multi-factor authentication (SMS / voice code send + verify). */
  readonly mfa: MfaResource;
  /** US 10DLC Campaign Registry — brands, campaigns, orders, numbers. */
  readonly registry: RegistryNamespace;

  // Datasphere API
  /** Datasphere RAG — document indexing and semantic search. */
  readonly datasphere: DatasphereNamespace;

  // Video API
  /** Video rooms, sessions, recordings, conferences, tokens, streams. */
  readonly video: VideoNamespace;

  // Logs
  /** Read-only message / voice / fax / conference logs. */
  readonly logs: LogsNamespace;

  // Project management
  /** Project-scoped API token management. */
  readonly project: ProjectNamespace;

  // PubSub & Chat
  /** PubSub token issuance. */
  readonly pubsub: PubSubResource;
  /** Chat token issuance. */
  readonly chat: ChatResource;

  // Compatibility (Twilio-compatible) API
  /** Twilio-compatible LAML surface (legacy; prefer native namespaces for new work). */
  readonly compat: CompatNamespace;

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
    const project = options.project || process.env['SIGNALWIRE_PROJECT_ID'] || '';
    const token = options.token || process.env['SIGNALWIRE_API_TOKEN'] || '';
    const host = options.host || process.env['SIGNALWIRE_SPACE'] || '';

    if (!project || !token || !host) {
      throw new Error(
        'project, token, and host are required. ' +
        'Provide them as arguments or set SIGNALWIRE_PROJECT_ID, ' +
        'SIGNALWIRE_API_TOKEN, and SIGNALWIRE_SPACE environment variables.',
      );
    }

    // Normalize host — ensure it has https:// prefix
    const baseUrl = host.startsWith('http') ? host : `https://${host}`;

    const http = new HttpClient({
      baseUrl,
      project,
      token,
      fetchImpl: options.fetchImpl,
    });

    logger.info('RestClient initialized', { host });

    // Fabric API
    this.fabric = new FabricNamespace(http);

    // Calling API
    this.calling = new CallingNamespace(http);

    // Relay REST resources
    this.phoneNumbers = new PhoneNumbersResource(http);
    this.addresses = new AddressesResource(http);
    this.queues = new QueuesResource(http);
    this.recordings = new RecordingsResource(http);
    this.numberGroups = new NumberGroupsResource(http);
    this.verifiedCallers = new VerifiedCallersResource(http);
    this.sipProfile = new SipProfileResource(http);
    this.lookup = new LookupResource(http);
    this.shortCodes = new ShortCodesResource(http);
    this.importedNumbers = new ImportedNumbersResource(http);
    this.mfa = new MfaResource(http);
    this.registry = new RegistryNamespace(http);

    // Datasphere API
    this.datasphere = new DatasphereNamespace(http);

    // Video API
    this.video = new VideoNamespace(http);

    // Logs
    this.logs = new LogsNamespace(http);

    // Project management
    this.project = new ProjectNamespace(http);

    // PubSub & Chat
    this.pubsub = new PubSubResource(http);
    this.chat = new ChatResource(http);

    // Compatibility (Twilio-compatible) API
    this.compat = new CompatNamespace(http, project);
  }
}

// --- Barrel exports ---

// Client
export { HttpClient } from './HttpClient.js';
export { RestError, SignalWireRestError } from './RestError.js';
export { paginate, paginateAll } from './pagination.js';

// Types
export type { ClientOptions, HttpClientOptions, PaginatedResponse, LamlPaginatedResponse, QueryParams } from './types.js';

// Base classes
export { BaseResource } from './base/BaseResource.js';
export { CrudResource } from './base/CrudResource.js';
export { CrudWithAddresses } from './base/CrudWithAddresses.js';

// Call-handler enum (for phoneNumbers.update call_handler field)
export { PhoneCallHandler } from './callHandler.js';

// Namespaces
export { FabricNamespace, FabricResource, FabricResourcePUT, CallFlowsResource, ConferenceRoomsResource, SubscribersResource, CxmlApplicationsResource, AutoMaterializedWebhookResource, SwmlWebhooksResource, CxmlWebhooksResource, GenericResources, FabricAddresses, FabricTokens } from './namespaces/fabric.js';
export { CallingNamespace } from './namespaces/calling.js';
export { DatasphereNamespace, DatasphereDocuments } from './namespaces/datasphere.js';
export { PhoneNumbersResource } from './namespaces/phone-numbers.js';
export type { SetSwmlWebhookExtra, SetCxmlWebhookParams, SetCallFlowParams, SetRelayTopicParams } from './namespaces/phone-numbers.js';
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
export { RegistryNamespace, RegistryBrands, RegistryCampaigns, RegistryOrders, RegistryNumbers } from './namespaces/registry.js';
export { VideoNamespace, VideoRooms, VideoRoomTokens, VideoRoomSessions, VideoRoomRecordings, VideoConferences, VideoConferenceTokens, VideoStreams } from './namespaces/video.js';
export { LogsNamespace, MessageLogs, VoiceLogs, FaxLogs, ConferenceLogs } from './namespaces/logs.js';
export { ProjectNamespace, ProjectTokens } from './namespaces/project.js';
export { PubSubResource } from './namespaces/pubsub.js';
export { ChatResource } from './namespaces/chat.js';
export { CompatNamespace, CompatAccounts, CompatCalls, CompatMessages, CompatFaxes, CompatConferences, CompatPhoneNumbers, CompatApplications, CompatLamlBins, CompatQueues, CompatRecordings, CompatTranscriptions, CompatTokens } from './namespaces/compat.js';
