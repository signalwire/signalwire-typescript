# REST Client Guide

The SignalWire REST client provides typed HTTP access to all SignalWire platform APIs. It's a standalone module that doesn't depend on AgentBase — you can use it independently for any server-side integration.

<!-- snippet-setup -->
```ts
// Shared context the fragments below assume. `client` is constructed in the
// Quick Start example; `httpClient` is a constructed HttpClient (see Pagination).
import { RestClient } from '@signalwire/sdk';
const client = new RestClient();
declare const httpClient: import('@signalwire/sdk').HttpClient;
```

## Quick Start

<!-- snippet: no-run makes live REST calls to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```ts
// `client` is a constructed RestClient (see the setup above / Getting Started):
//   const client = new RestClient({ project, token, host });

// List AI agents
const agents = await client.fabric.aiAgents.list();

// Search phone numbers
const numbers = await client.phoneNumbers.search({ areacode: '512' });

// Play audio into a call (the `play` array is positional)
await client.calling.play('call-id', [{ type: 'audio', url: 'https://example.com/audio.mp3' }]);
```

## Authentication

The client uses HTTP Basic Auth with your project ID and API token. Credentials can be provided explicitly or via environment variables:

| Option | Environment Variable |
|--------|---------------------|
| `project` | `SIGNALWIRE_PROJECT_ID` |
| `token` | `SIGNALWIRE_API_TOKEN` |
| `host` | `SIGNALWIRE_SPACE` |

```ts
// Using environment variables (no args needed):
//   const client = new RestClient();
const envClient = client; // the env-configured client (see setup)
void envClient;
```

## Namespaces

The client organizes all APIs into namespaces:

### Fabric (`client.fabric.*`)

Resource management for the SignalWire Fabric platform.

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```ts
// AI Agents (PATCH updates) — create requires both `name` and `prompt`
await client.fabric.aiAgents.list();
await client.fabric.aiAgents.create({ name: 'My Agent', prompt: { text: 'Be helpful' } });
await client.fabric.aiAgents.get('agent-id');
await client.fabric.aiAgents.update('agent-id', { name: 'Updated' });
await client.fabric.aiAgents.delete('agent-id');
await client.fabric.aiAgents.listAddresses('agent-id');

// SWML Scripts (PUT updates) — the script body key is `contents`
await client.fabric.swmlScripts.create({ name: 'flow', contents: '...' });
await client.fabric.swmlScripts.update('id', { contents: '...' });

// Call Flows (with version management)
await client.fabric.callFlows.list();
await client.fabric.callFlows.listVersions('cf-id');
await client.fabric.callFlows.deployVersion('cf-id', { document_version: 2 });

// Subscribers (with SIP endpoints) — username + password are positional
await client.fabric.subscribers.listSipEndpoints('sub-id');
await client.fabric.subscribers.createSipEndpoint('sub-id', 'user', 'secret');

// Tokens — the primary identifier is positional
await client.fabric.tokens.createSubscriberToken('user@example.com');
await client.fabric.tokens.createGuestToken(['address-uuid']);
```

**Sub-resources:** `swmlScripts`, `relayApplications`, `callFlows`, `conferenceRooms`, `freeswitchConnectors`, `subscribers`, `sipEndpoints`, `cxmlScripts`, `cxmlApplications`, `swmlWebhooks`, `aiAgents`, `sipGateways`, `cxmlWebhooks`, `resources`, `addresses`, `tokens`

### Calling (`client.calling.*`)

REST-based call control — all 37 commands dispatched via POST.

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```ts
// Dial — from and to are positional
await client.calling.dial('+15559876543', '+15551234567');

// Play audio — the play array is positional; pause/resume/stop take control_id positionally
await client.calling.play('call-id', [{ type: 'audio', url: 'https://example.com/audio.mp3' }]);
await client.calling.playPause('call-id', 'ctrl-1');
await client.calling.playResume('call-id', 'ctrl-1');
await client.calling.playStop('call-id', 'ctrl-1');

// Record — record takes an options object; recordStop takes control_id positionally
await client.calling.record('call-id', { audio: { beep: true } });
await client.calling.recordStop('call-id', 'rec-1');

// AI control
await client.calling.aiMessage('call-id', { message_text: 'Hello' });
await client.calling.aiStop('call-id', 'ai-1');

// End call
await client.calling.end('call-id');
```

### Phone Numbers (`client.phoneNumbers`)

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```typescript
await client.phoneNumbers.list();
await client.phoneNumbers.search({ areacode: '512' });
await client.phoneNumbers.create({ number: '+15551234567' }); // Purchase
await client.phoneNumbers.update('id', { name: 'Main Line' });
await client.phoneNumbers.delete('id'); // Release
```

### Datasphere (`client.datasphere.*`)

Document management and semantic search.

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```ts
// Documents — create takes a document URL (chunked server-side)
await client.datasphere.documents.list();
await client.datasphere.documents.create({ url: 'https://example.com/faq.pdf', tags: ['faq'] });
await client.datasphere.documents.get('doc-id');
await client.datasphere.documents.update('doc-id', { tags: ['faq', 'billing'] });
await client.datasphere.documents.delete('doc-id');

// Search — the query string is positional
await client.datasphere.documents.search('how do I reset my password', { count: 5 });

// Chunks
await client.datasphere.documents.listChunks('doc-id');
await client.datasphere.documents.getChunk('doc-id', 'chunk-id');
await client.datasphere.documents.deleteChunk('doc-id', 'chunk-id');
```

### Video (`client.video.*`)

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```ts
// Rooms — update uses `max_members`
await client.video.rooms.list();
await client.video.rooms.create({ name: 'standup' });
await client.video.rooms.update('room-id', { max_members: 10 });
await client.video.rooms.listStreams('room-id');
await client.video.rooms.createStream('room-id', 'rtmp://example.com/live');

// Room Tokens — room_name is positional
await client.video.roomTokens.create('standup', { user_name: 'alice' });

// Sessions
await client.video.roomSessions.list();
await client.video.roomSessions.listMembers('session-id');
await client.video.roomSessions.listRecordings('session-id');

// Conferences
await client.video.conferences.list();
await client.video.conferences.listConferenceTokens('conf-id');
```

### Other Namespaces

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```ts
// Addresses — create takes the address fields positionally
await client.addresses.list();
await client.addresses.create(
  'Office', 'US', 'Jane', 'Doe', '123', 'Main St', 'Austin', 'TX', '78701',
);

// Queues (with member management)
await client.queues.list();
await client.queues.listMembers('queue-id');
await client.queues.getNextMember('queue-id');

// Recordings
await client.recordings.list();
await client.recordings.get('recording-id');
await client.recordings.delete('recording-id');

// Number Groups (with membership) — phone_number_id is positional
await client.numberGroups.list();
await client.numberGroups.listMemberships('group-id');
await client.numberGroups.addMembership('group-id', 'pn-id');

// Verified Callers — the create body key is `number`
await client.verifiedCallers.list();
await client.verifiedCallers.create({ number: '+15551234567' });
await client.verifiedCallers.submitVerification('id', '1234');

// SIP Profile (singleton) — codecs field is `default_codecs`
await client.sipProfile.get();
await client.sipProfile.update({ default_codecs: ['PCMU', 'PCMA'] });

// Lookup
await client.lookup.phoneNumber('+15551234567', { include: 'cnam' });

// Short Codes — update takes (id, name, message_handler) positionally
await client.shortCodes.list();
await client.shortCodes.update('sc-id', 'Alerts', 'laml_webhooks', {
  message_request_url: 'https://example.com/sms',
});

// Imported Numbers — number + number_type are positional
await client.importedNumbers.create('+15551234567', 'longcode');

// MFA — `to` is positional
await client.mfa.sms('+15551234567', { from: '+15559876543' });
await client.mfa.call('+15551234567', { from: '+15559876543' });
await client.mfa.verify('request-id', '1234');

// Registry (10DLC) — createCampaign takes a typed campaign body
await client.registry.brands.list();
await client.registry.brands.createCampaign('brand-id', {
  name: 'Alerts',
  brand_id: 'brand-id',
  csp_campaign_reference: 'CAMP123',
});
await client.registry.campaigns.listNumbers('campaign-id');

// Logs
await client.logs.voice.list({ page_size: 10 });
await client.logs.voice.listEvents('log-id');
await client.logs.messages.list();
await client.logs.fax.list();
await client.logs.conferences.list();

// Project tokens — create takes (name, permissions) positionally
await client.project.tokens.create('ci-token', ['calling', 'messaging', 'numbers']);
await client.project.tokens.update('token-id', { name: 'updated' });
await client.project.tokens.delete('token-id');

// PubSub & Chat tokens — createToken(ttl, channels, options?)
await client.pubsub.createToken(60, { updates: { read: true, write: false } }, { member_id: 'user-1' });
await client.chat.createToken(60, { support: { read: true, write: true } }, { member_id: 'user-1' });
```

## Pagination

The client provides two pagination utilities that work with both standard (`links.next`) and LAML (`next_page_uri`) pagination styles.

### Async Generator

<!-- snippet: no-run illustrative fragment: references the assumed `httpClient` object established in the Pagination setup -->
```ts
import { paginate } from '@signalwire/sdk';

// paginate() yields items one at a time across pages
for await (const number of paginate<{ id: string; number: string }>(
  httpClient,
  '/api/relay/rest/phone_numbers',
)) {
  void number.id;
  void number.number;
}
```

### Collect All

<!-- snippet: no-run illustrative fragment: references the assumed `httpClient` object established in the Pagination setup -->
```ts
import { paginateAll } from '@signalwire/sdk';

const allNumbers = await paginateAll(httpClient, '/api/relay/rest/phone_numbers');
void allNumbers.length;
```

### Custom Data Key

Some APIs use different keys for the data array. Use the `dataKey` parameter:

<!-- snippet: no-run illustrative fragment: references the assumed `httpClient` object established in the Pagination setup -->
```ts
import { paginateAll } from '@signalwire/sdk';

// LAML uses resource-specific keys like "calls", "messages"
const allCalls = await paginateAll(httpClient, '/api/laml/.../Calls', undefined, 'calls');
void allCalls;
```

## Request Options (timeout, retries, abort)

Every request accepts a `RequestOptions` envelope controlling per-request transport
behavior. Set a client-wide default via the `requestOptions` constructor option, and
override it per call by passing an options object as the final argument to any method.

<!-- snippet: no-run makes live REST calls (phoneNumbers.list / fabric.aiAgents.get) to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```typescript
// `RestClient` is imported in the shared setup above. Construct a client with
// client-wide request defaults applied to every request:
const tunedClient = new RestClient({
  project: 'your-project-id',
  token: 'your-api-token',
  host: 'example.signalwire.com',
  requestOptions: { timeout: 10, retries: 2 },
});

// Per-call override (shallow-merges over the client default):
await tunedClient.phoneNumbers.list({ areacode: '512' }, { timeout: 5 });
await tunedClient.fabric.aiAgents.get('agent-id', { retries: 3 });

// Cancel an in-flight request with an AbortSignal:
const controller = new AbortController();
const pending = tunedClient.phoneNumbers.list(undefined, { abortSignal: controller.signal });
// ...later, call the controller's standard abort() to cancel `pending`.
```

Fields (all optional):

| Field | Default | Meaning |
|-------|---------|---------|
| `timeout` | `30` | Max wall-clock **seconds per attempt**; on exceed the request raises a transport error. |
| `retries` | `0` | RETRY attempts on a retryable failure (total attempts = `retries + 1`). Opt-in — the default is no retry. |
| `retryOnStatus` | `{429,500,502,503,504}` | HTTP statuses that trigger a retry for an idempotent method. |
| `retryBackoff` | `0.5` | Base seconds for exponential backoff (`backoff * 2 ** (attempt-1)`), honoring `Retry-After`. |
| `abortSignal` | — | An `AbortSignal` for true in-flight cancellation; also checked before each attempt. |

Retries are idempotency-aware: non-idempotent methods (POST/PATCH) retry only on `429`/`503`.

## Error Handling

All HTTP errors throw `RestError` with status code, body, URL, and method:

```typescript
import { RestError } from '@signalwire/sdk';

try {
  await client.phoneNumbers.get('nonexistent');
} catch (err) {
  if (err instanceof RestError) {
    console.error(`${err.method} ${err.url} returned ${err.statusCode}`);
    console.error('Body:', err.body);
  }
}
```

## Test Injection

For testing, inject a custom `fetch` implementation:

```ts
const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) =>
  new Response(JSON.stringify({ data: [] }));

const testClient = new RestClient({
  project: 'test',
  token: 'test',
  host: 'test.signalwire.com',
  fetchImpl: mockFetch,
});
void testClient;
```

This follows the same pattern as the RELAY client's `_wsFactory` injection.

## Architecture

```
RestClient
  ├── HttpClient (fetch + Basic Auth)
  ├── fabric: FabricNamespace (16 sub-resources)
  ├── calling: CallingNamespace (37 commands)
  ├── phoneNumbers: PhoneNumbersResource (CRUD + search)
  ├── addresses: AddressesResource
  ├── messages: MessagesResource
  ├── queues: QueuesResource (CRUD + members)
  ├── recordings: RecordingsResource
  ├── numberGroups: NumberGroupsResource (CRUD + membership)
  ├── verifiedCallers: VerifiedCallersResource (CRUD + verify)
  ├── sipProfile: SipProfileResource (singleton)
  ├── lookup: LookupResource
  ├── shortCodes: ShortCodesResource
  ├── importedNumbers: ImportedNumbersResource
  ├── mfa: MfaResource
  ├── registry: RegistryNamespace (brands, campaigns, orders, numbers)
  ├── datasphere: DatasphereNamespace (documents)
  ├── video: VideoNamespace (rooms, sessions, recordings, conferences, tokens, streams)
  ├── logs: LogsNamespace (messages, voice, fax, conferences)
  ├── project: ProjectNamespace (tokens)
  ├── projects: ProjectsResource
  ├── pubsub: PubSubResource
  └── chat: ChatResource
```

The base class hierarchy:
- `BaseResource` — holds `HttpClient` + base path, provides `_path()` helper
- `CrudResource` — adds `list()`, `create()`, `get()`, `update()`, `delete()` with configurable `_updateMethod` (PATCH or PUT)
- `CrudWithAddresses` — adds `listAddresses()` to CrudResource
