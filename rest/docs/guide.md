# REST Client Guide

The SignalWire REST client gives you typed HTTP access to the SignalWire platform APIs. It's a standalone module that doesn't depend on `AgentBase`, so you can use it in any server-side integration. This guide shows each namespace, then pagination, request options, error handling and test injection.

<!-- snippet-setup -->
```ts
// Shared context the fragments on this page assume. `client` is a RestClient
// configured from the environment (see Getting Started).
import { RestClient } from '@signalwire/sdk';
const client = new RestClient();
```

## Quick Start

This example lists AI agents, searches phone numbers and plays audio into a call:

<!-- snippet: no-run makes live REST calls to a real SignalWire space -->
```ts
// List AI agents
const agents = await client.fabric.aiAgents.list();

// Search phone numbers
const numbers = await client.phoneNumbers.search({ areacode: '512' });

// Play audio into a call (the `play` array is positional)
await client.calling.play('call-id', [
  { type: 'audio', params: { url: 'https://example.com/audio.mp3' } },
]);
```

## Authentication

The client uses HTTP Basic Auth with your project ID and API token. You pass the credentials as options, or set the environment variables:

| Option | Environment Variable |
|--------|---------------------|
| `project` | `SIGNALWIRE_PROJECT_ID` |
| `token` | `SIGNALWIRE_API_TOKEN` |
| `host` | `SIGNALWIRE_SPACE` (or `SIGNALWIRE_REST_BASE_URL`, a full URL, which takes precedence) |

With the environment variables set, `new RestClient()` needs no arguments. [Getting Started](getting-started.md#configuration) has the details.

## Namespaces

The client groups the APIs into namespaces, one property each. The sections that follow show the common calls in each one.

### Fabric (`client.fabric.*`)

The Fabric namespace manages resources such as AI agents, SWML scripts, call flows and subscribers:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```ts
// AI Agents (PATCH updates); create requires both `name` and `prompt`
await client.fabric.aiAgents.list();
await client.fabric.aiAgents.create({ name: 'My Agent', prompt: { text: 'Be helpful' } });
await client.fabric.aiAgents.get('agent-id');
await client.fabric.aiAgents.update('agent-id', { name: 'Updated' });
await client.fabric.aiAgents.delete('agent-id');
await client.fabric.aiAgents.listAddresses('agent-id');

// SWML Scripts (PUT updates); the script body key is `contents`
const swml = JSON.stringify({ version: '1.0.0', sections: { main: [{ answer: {} }] } });
await client.fabric.swmlScripts.create({ name: 'flow', contents: swml });
await client.fabric.swmlScripts.update('id', { contents: swml });

// Call Flows (with version management)
await client.fabric.callFlows.list();
await client.fabric.callFlows.listVersions('cf-id');
await client.fabric.callFlows.deployVersion('cf-id', { document_version: 2 });

// Subscribers (with SIP endpoints); username and password are positional
await client.fabric.subscribers.listSipEndpoints('sub-id');
await client.fabric.subscribers.createSipEndpoint('sub-id', 'user', 'a-long-random-password');

// Tokens; the primary identifier is positional
await client.fabric.tokens.createSubscriberToken('user@example.com');
await client.fabric.tokens.createGuestToken(['address-uuid']);
```

The Fabric sub-resources are `swmlScripts`, `relayApplications`, `callFlows`, `conferenceRooms`, `freeswitchConnectors`, `subscribers`, `sipEndpoints`, `cxmlScripts`, `cxmlApplications`, `swmlWebhooks`, `aiAgents`, `sipGateways`, `cxmlWebhooks`, `resources`, `addresses` and `tokens`. [Fabric Resources](fabric.md) covers each one.

### Calling (`client.calling.*`)

The Calling namespace controls calls over REST. Each command is a POST to `/api/calling/calls`:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```ts
// Dial; from and to are positional
await client.calling.dial('+15559876543', '+15551234567', { url: 'https://example.com/handler' });

// Play audio; the play array is positional, and pause/resume/stop take control_id positionally
await client.calling.play('call-id', [
  { type: 'audio', params: { url: 'https://example.com/audio.mp3' } },
], { control_id: 'ctrl-1' });
await client.calling.playPause('call-id', 'ctrl-1');
await client.calling.playResume('call-id', 'ctrl-1');
await client.calling.playStop('call-id', 'ctrl-1');

// Record; record takes an options object, and recordStop takes control_id positionally
await client.calling.record('call-id', { control_id: 'rec-1', audio: { beep: true } });
await client.calling.recordStop('call-id', 'rec-1');

// AI control
await client.calling.aiMessage('call-id', { role: 'system', message_text: 'The caller is a premium customer.' });
await client.calling.aiStop('call-id', 'ai-1');

// End the call
await client.calling.end('call-id');
```

[Calling Commands](calling.md) lists every method and the wire command it sends.

### Phone Numbers (`client.phoneNumbers`)

This example lists, searches, purchases, updates and releases phone numbers:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```typescript
await client.phoneNumbers.list();
await client.phoneNumbers.search({ areacode: '512' });
await client.phoneNumbers.create({ number: '+15551234567' }); // Purchase
await client.phoneNumbers.update('id', { name: 'Main Line' });
await client.phoneNumbers.delete('id'); // Release
```

To route a number's inbound calls, use the `phoneNumbers.set*` helpers that [phone-binding.md](phone-binding.md) describes.

### Datasphere (`client.datasphere.*`)

The Datasphere namespace manages documents and runs semantic search over them:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```ts
// Documents; create takes a document URL
await client.datasphere.documents.list();
await client.datasphere.documents.create({ url: 'https://example.com/faq.pdf', tags: ['faq'] });
await client.datasphere.documents.get('doc-id');
await client.datasphere.documents.update('doc-id', { tags: ['faq', 'billing'] });
await client.datasphere.documents.delete('doc-id');

// Search; the query string is positional
await client.datasphere.documents.search('how do I reset my password', { count: 5 });

// Chunks
await client.datasphere.documents.listChunks('doc-id');
await client.datasphere.documents.getChunk('doc-id', 'chunk-id');
await client.datasphere.documents.deleteChunk('doc-id', 'chunk-id');
```

### Video (`client.video.*`)

The Video namespace manages rooms, room tokens, sessions and conferences:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```ts
// Rooms; update uses `max_members`
await client.video.rooms.list();
await client.video.rooms.create({ name: 'standup' });
await client.video.rooms.update('room-id', { max_members: 10 });
await client.video.rooms.listStreams('room-id');
await client.video.rooms.createStream('room-id', 'rtmp://example.com/live');

// Room tokens; room_name is positional
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

This example shows one or two calls from each of the remaining namespaces:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```ts
// Messaging; to and from are positional
await client.messages.create('+15551234567', '+15559876543', { body: 'Your order has shipped.' });

// Addresses; create takes the address fields positionally
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

// Number Groups (with memberships); phone_number_id is positional
await client.numberGroups.list();
await client.numberGroups.listMemberships('group-id');
await client.numberGroups.addMembership('group-id', 'pn-id');

// Verified Callers; the create body key is `number`
await client.verifiedCallers.list();
await client.verifiedCallers.create({ number: '+15551234567' });
await client.verifiedCallers.submitVerification('id', '1234');

// SIP Profile (one per project); the codecs field is `default_codecs`
await client.sipProfile.get();
await client.sipProfile.update({ default_codecs: ['PCMU', 'PCMA'] });

// Lookup
await client.lookup.phoneNumber('+15551234567', { include: 'cnam' });

// Short Codes; update takes (id, name, message_handler) positionally
await client.shortCodes.list();
await client.shortCodes.update('sc-id', 'Alerts', 'laml_webhooks', {
  message_request_url: 'https://example.com/sms',
});

// Imported Numbers; number and number_type are positional
await client.importedNumbers.create('+15551234567', 'longcode');

// MFA; `to` is positional
await client.mfa.sms('+15551234567', { from: '+15559876543' });
await client.mfa.call('+15551234567', { from: '+15559876543' });
await client.mfa.verify('request-id', '1234');

// Registry (10DLC); createCampaign takes a typed campaign body
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

// Project tokens; create takes (name, permissions) positionally
await client.project.tokens.create('ci-token', ['calling', 'messaging', 'numbers']);
await client.project.tokens.update('token-id', { name: 'updated' });
await client.project.tokens.delete('token-id');

// Projects and subprojects
await client.projects.list();
await client.projects.rotateSigningKey('project-id');

// PubSub and Chat tokens; createToken(ttl, channels, options?)
await client.pubsub.createToken(60, { updates: { read: true, write: false } }, { member_id: 'user-1' });
await client.chat.createToken(60, { support: { read: true, write: true } }, { member_id: 'user-1' });
```

[All Namespaces](namespaces.md) covers each of these in more detail.

## Pagination

A `list()` call returns one page of results, as the server sent it. The platform APIs use two pagination styles: a `links.next` URL, or a `next_page_uri` field.

### Iterating a resource

Resources built on `ReadResource` or `CrudResource` also have `paginate()`. Examples are `phoneNumbers`, `queues`, `video.rooms`, `logs.voice`, `fabric.addresses` and most Fabric resource types. `paginate()` follows the next-page link of either style and yields one item at a time:

<!-- snippet: no-run makes live REST calls to a real SignalWire space -->
```ts
for await (const number of client.phoneNumbers.paginate({ page_size: 50 })) {
  console.log(number.id);
}
```

The query parameters apply to the first request only. Later pages use the URL the server returns. `paginate()` stops when there's no next link, or when the server repeats a link it already returned.

### The pagination functions

The SDK also exports `paginate()` and `paginateAll()` as functions. They take an `HttpClient`, a path and optional query parameters. `dataKey` names the property that holds the items, and defaults to `data`. `paginateAll()` collects every item into one array, so it holds all pages in memory:

<!-- snippet: no-run makes live REST calls to a real SignalWire space -->
```ts
import { HttpClient, paginate, paginateAll } from '@signalwire/sdk';

const http = new HttpClient({
  host: 'example.signalwire.com',
  project: 'your-project-id',
  token: 'your-api-token',
});

// Yield items one at a time across pages
for await (const number of paginate<{ id: string; number: string }>(
  http,
  '/api/relay/rest/phone_numbers',
)) {
  console.log(number.number);
}

// Collect every item into an array
const allNumbers = await paginateAll(http, '/api/relay/rest/phone_numbers');
console.log(allNumbers.length);
```

`paginate()` takes `requestOptions` as its fifth argument and applies them to every page. `paginateAll()` doesn't take `requestOptions`.

## Request Options (timeout, retries, abort)

Every request accepts request options that control its timeout, retries and cancellation. Set a client-wide default with the `requestOptions` constructor option. Override it for one call by passing an options object as the method's last argument:

<!-- snippet: no-run makes live REST calls to a real SignalWire space -->
```typescript
// `RestClient` is imported in the shared setup. Construct a client with
// defaults that apply to every request:
const tunedClient = new RestClient({
  project: 'your-project-id',
  token: 'your-api-token',
  host: 'example.signalwire.com',
  requestOptions: { timeout: 10, retries: 2 },
});

// Per-call override (merged over the client default, field by field):
await tunedClient.phoneNumbers.list({ page_size: 20 }, { timeout: 5 });
await tunedClient.fabric.aiAgents.get('agent-id', { retries: 3 });

// Cancel an in-flight request with an AbortSignal:
const controller = new AbortController();
const pending = tunedClient.phoneNumbers.list(undefined, { abortSignal: controller.signal });
// Later, call the controller's abort() method: `pending` then rejects with a RestTransportError.
```

The request options have these fields, all optional:

| Field | Default | Meaning |
|-------|---------|---------|
| `timeout` | `30` | Maximum seconds for each attempt. When it's exceeded, the request throws `RestTransportError`. |
| `retries` | `0` | Number of retries after a retryable failure (total attempts = `retries + 1`). By default the client doesn't retry. |
| `retryOnStatus` | `{429, 500, 502, 503, 504}` | HTTP statuses that trigger a retry for an idempotent method. |
| `retryBackoff` | `0.5` | Base seconds for exponential backoff (`retryBackoff * 2 ** (attempt - 1)`). A numeric `Retry-After` header takes precedence. |
| `abortSignal` | None | An `AbortSignal` that cancels the request in flight. It's also checked before each attempt. |

A field you leave unset falls back to the client default, then to the built-in default. Retries depend on the method. `GET`, `PUT` and `DELETE` retry on any status in `retryOnStatus`, and on transport errors. `POST` and `PATCH` retry only on transport errors and on a `429` or `503` in `retryOnStatus`. That way a request that changed data isn't sent twice after a `500`. A cancellation through `abortSignal` is never retried.

## Error Handling

Every non-2xx response throws `RestError`, with the status code, body, URL and method. A request that gets no response throws `RestTransportError`, a subclass of `RestError` whose `statusCode` is `null`:

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

`RestError` is also exported as `SignalWireRestError`. [Client Reference](client-reference.md#error-properties) lists its properties.

## Test Injection

For tests, pass your own `fetch` implementation as `fetchImpl`. This example returns an empty list for every request:

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

## Architecture

`RestClient` holds one `HttpClient` and a property for each namespace. This tree shows each property and the class behind it:

```text
RestClient
  HttpClient (fetch + Basic Auth, shared by every namespace)
  fabric: FabricNamespace (16 sub-resources)
  calling: Calling (command dispatch)
  phoneNumbers: PhoneNumbers (CRUD + search + call-handler helpers)
  addresses: Addresses
  messages: Messages
  queues: Queues (CRUD + members)
  recordings: Recordings
  numberGroups: NumberGroups (CRUD + memberships)
  verifiedCallers: VerifiedCallers (CRUD + verification)
  sipProfile: SipProfile (get and update)
  lookup: Lookup
  shortCodes: ShortCodes
  importedNumbers: ImportedNumbers
  mfa: Mfa
  registry: RegistryNamespace (brands, campaigns, orders, numbers)
  datasphere: DatasphereNamespace (documents)
  video: VideoNamespace (rooms, roomTokens, roomSessions, roomRecordings, conferences, conferenceTokens, streams)
  logs: LogsNamespace (messages, voice, fax, conferences)
  project: ProjectNamespace (tokens)
  projects: Projects
  pubsub: PubSub
  chat: Chat
```

The resource classes build on these base classes:

- `BaseResource` holds the `HttpClient` and the base path, and provides the `_path()` helper.
- `ReadResource` adds `list()`, `get()` and `paginate()`.
- `CrudResource` adds `create()`, `update()` and `delete()` to `ReadResource`. Its update method is `PATCH` or `PUT`, depending on the resource.
- `CrudWithAddresses` adds `listAddresses()` to `CrudResource`.

Resources whose API doesn't fit these shapes, such as `recordings` and `sipProfile`, extend `BaseResource` and define their own methods. They have no `paginate()`.
