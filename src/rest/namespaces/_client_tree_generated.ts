// AUTO-GENERATED from porting-sdk/rest-apis/*/openapi.yaml — DO NOT EDIT.
// Regenerate with: npx tsx scripts/generate-rest-types.ts
//
// The SDK client object tree: one namespace container class per
// x-sdk-namespace group plus the flat resources, wired from each resource's
// spec placement (RULES §8). The hand RestClient composes _GeneratedResourceTree.

import type { HttpClient } from '../HttpClient.js';
import { Calling } from './calling.resources.generated.js';
import { Chat } from './chat.resources.generated.js';
import { DatasphereDocuments } from './datasphere.resources.generated.js';
import {
  AiAgents,
  CallFlows,
  ConferenceRooms,
  CxmlApplications,
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
  SwmlScripts,
  SwmlWebhooks,
} from './fabric.resources.generated.js';
import { FaxLogs } from './fax.resources.generated.js';
import { ConferenceLogs } from './logs.resources.generated.js';
import { MessageLogs } from './message.resources.generated.js';
import { ProjectTokens } from './project.resources.generated.js';
import { PubSub } from './pubsub.resources.generated.js';
import {
  Addresses,
  ImportedNumbers,
  Lookup,
  Mfa,
  NumberGroups,
  PhoneNumbers,
  Queues,
  Recordings,
  RegistryBrands,
  RegistryCampaigns,
  RegistryNumbers,
  RegistryOrders,
  ShortCodes,
  SipProfile,
  VerifiedCallers,
} from './relay-rest.resources.generated.js';
import {
  VideoConferenceTokens,
  VideoConferences,
  VideoRoomRecordings,
  VideoRoomSessions,
  VideoRoomTokens,
  VideoRooms,
  VideoStreams,
} from './video.resources.generated.js';
import { VoiceLogs } from './voice.resources.generated.js';

/** Generated `client.datasphere` namespace container. */
export class DatasphereNamespace {
  readonly documents: DatasphereDocuments;

  constructor(http: HttpClient) {
    this.documents = new DatasphereDocuments(http);
  }
}

/** Generated `client.fabric` namespace container. */
export class FabricNamespace {
  readonly addresses: FabricAddresses;
  readonly aiAgents: AiAgents;
  readonly callFlows: CallFlows;
  readonly conferenceRooms: ConferenceRooms;
  readonly cxmlApplications: CxmlApplications;
  readonly cxmlScripts: CxmlScripts;
  readonly cxmlWebhooks: CxmlWebhooks;
  readonly freeswitchConnectors: FreeswitchConnectors;
  readonly relayApplications: RelayApplications;
  readonly resources: GenericResources;
  readonly sipEndpoints: SipEndpoints;
  readonly sipGateways: SipGateways;
  readonly subscribers: Subscribers;
  readonly swmlScripts: SwmlScripts;
  readonly swmlWebhooks: SwmlWebhooks;
  readonly tokens: FabricTokens;

  constructor(http: HttpClient) {
    this.addresses = new FabricAddresses(http);
    this.aiAgents = new AiAgents(http);
    this.callFlows = new CallFlows(http);
    this.conferenceRooms = new ConferenceRooms(http);
    this.cxmlApplications = new CxmlApplications(http);
    this.cxmlScripts = new CxmlScripts(http);
    this.cxmlWebhooks = new CxmlWebhooks(http);
    this.freeswitchConnectors = new FreeswitchConnectors(http);
    this.relayApplications = new RelayApplications(http);
    this.resources = new GenericResources(http);
    this.sipEndpoints = new SipEndpoints(http);
    this.sipGateways = new SipGateways(http);
    this.subscribers = new Subscribers(http);
    this.swmlScripts = new SwmlScripts(http);
    this.swmlWebhooks = new SwmlWebhooks(http);
    this.tokens = new FabricTokens(http);
  }
}

/** Generated `client.logs` namespace container. */
export class LogsNamespace {
  readonly conferences: ConferenceLogs;
  readonly fax: FaxLogs;
  readonly messages: MessageLogs;
  readonly voice: VoiceLogs;

  constructor(http: HttpClient) {
    this.conferences = new ConferenceLogs(http);
    this.fax = new FaxLogs(http);
    this.messages = new MessageLogs(http);
    this.voice = new VoiceLogs(http);
  }
}

/** Generated `client.project` namespace container. */
export class ProjectNamespace {
  readonly tokens: ProjectTokens;

  constructor(http: HttpClient) {
    this.tokens = new ProjectTokens(http);
  }
}

/** Generated `client.registry` namespace container. */
export class RegistryNamespace {
  readonly brands: RegistryBrands;
  readonly campaigns: RegistryCampaigns;
  readonly numbers: RegistryNumbers;
  readonly orders: RegistryOrders;

  constructor(http: HttpClient) {
    this.brands = new RegistryBrands(http);
    this.campaigns = new RegistryCampaigns(http);
    this.numbers = new RegistryNumbers(http);
    this.orders = new RegistryOrders(http);
  }
}

/** Generated `client.video` namespace container. */
export class VideoNamespace {
  readonly conferences: VideoConferences;
  readonly conferenceTokens: VideoConferenceTokens;
  readonly roomRecordings: VideoRoomRecordings;
  readonly rooms: VideoRooms;
  readonly roomSessions: VideoRoomSessions;
  readonly roomTokens: VideoRoomTokens;
  readonly streams: VideoStreams;

  constructor(http: HttpClient) {
    this.conferences = new VideoConferences(http);
    this.conferenceTokens = new VideoConferenceTokens(http);
    this.roomRecordings = new VideoRoomRecordings(http);
    this.rooms = new VideoRooms(http);
    this.roomSessions = new VideoRoomSessions(http);
    this.roomTokens = new VideoRoomTokens(http);
    this.streams = new VideoStreams(http);
  }
}

/**
 * Generated resource wiring for `RestClient` (flat resources + namespace
 * containers). The hand `RestClient` extends this and calls `_wireResources`
 * after constructing the HTTP layer; it keeps only the non-spec-derivable bits
 * (auth, HTTP construction).
 */
export class _GeneratedResourceTree {
  addresses!: Addresses;
  calling!: Calling;
  chat!: Chat;
  importedNumbers!: ImportedNumbers;
  lookup!: Lookup;
  mfa!: Mfa;
  numberGroups!: NumberGroups;
  phoneNumbers!: PhoneNumbers;
  pubsub!: PubSub;
  queues!: Queues;
  recordings!: Recordings;
  shortCodes!: ShortCodes;
  sipProfile!: SipProfile;
  verifiedCallers!: VerifiedCallers;
  datasphere!: DatasphereNamespace;
  fabric!: FabricNamespace;
  logs!: LogsNamespace;
  project!: ProjectNamespace;
  registry!: RegistryNamespace;
  video!: VideoNamespace;

  protected _wireResources(http: HttpClient): void {
    this.addresses = new Addresses(http);
    this.calling = new Calling(http);
    this.chat = new Chat(http);
    this.importedNumbers = new ImportedNumbers(http);
    this.lookup = new Lookup(http);
    this.mfa = new Mfa(http);
    this.numberGroups = new NumberGroups(http);
    this.phoneNumbers = new PhoneNumbers(http);
    this.pubsub = new PubSub(http);
    this.queues = new Queues(http);
    this.recordings = new Recordings(http);
    this.shortCodes = new ShortCodes(http);
    this.sipProfile = new SipProfile(http);
    this.verifiedCallers = new VerifiedCallers(http);
    this.datasphere = new DatasphereNamespace(http);
    this.fabric = new FabricNamespace(http);
    this.logs = new LogsNamespace(http);
    this.project = new ProjectNamespace(http);
    this.registry = new RegistryNamespace(http);
    this.video = new VideoNamespace(http);
  }
}
