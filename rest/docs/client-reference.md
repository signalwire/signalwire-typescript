# RestClient Reference

This page lists the `RestClient` constructor options, the namespace properties on the client and the error classes it throws.

## Constructor

This example passes every connection option explicitly. The comment on each line names the environment variable it falls back to:

```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient({
  project: 'your-project-id', // SIGNALWIRE_PROJECT_ID
  token: 'your-api-token', // SIGNALWIRE_API_TOKEN
  host: 'example.signalwire.com', // SIGNALWIRE_REST_BASE_URL, then SIGNALWIRE_SPACE
});
```

The constructor accepts these options:

| Option | Type | Description |
|--------|------|-------------|
| `project` | `string` | Project ID. Falls back to `SIGNALWIRE_PROJECT_ID`. |
| `token` | `string` | API token. Falls back to `SIGNALWIRE_API_TOKEN`. |
| `host` | `string` | A bare host (`example.signalwire.com`) or a full `http(s)://` URL. Falls back to `SIGNALWIRE_REST_BASE_URL`, then `SIGNALWIRE_SPACE`. |
| `personalAccessToken` | `string` | A user's Personal Access Token (`pat_...`), which authenticates `client.space` (the Space Administration API). Falls back to `SIGNALWIRE_PERSONAL_ACCESS_TOKEN`. |
| `requestOptions` | `RequestOptionsInit` | Default timeout, retry and abort settings for every request. See [Request Options](guide.md#request-options-timeout-retries-abort). |
| `fetchImpl` | `typeof fetch` | A replacement `fetch`, for tests. |

The constructor throws an `Error` when `host` is missing, or when neither a complete `project` + `token` pair nor a `personalAccessToken` is given (each from its option or its environment variable). Project resources authenticate with HTTP Basic Auth `project:token`; `client.space` authenticates with the Personal Access Token (HTTP Basic with an empty username). Either credential, or both, may be given: calling a resource whose credential the client was not given rejects with an `Error` naming it, before any request is sent.

```typescript
const admin = new RestClient({
  personalAccessToken: 'pat_...', // SIGNALWIRE_PERSONAL_ACCESS_TOKEN
  host: 'example.signalwire.com',
});
const members = await admin.space.members.list();
```

The `restClient(options?)` function, also exported from `@signalwire/sdk`, constructs the same client.

## Namespaces

Each API area is a property on the client. Namespaces are properties, not methods: write `client.fabric`, not `client.fabric()`.

### Fabric API

`client.fabric` has these sub-resources:

| Property | Description |
|-----------|-------------|
| `client.fabric.swmlScripts` | SWML script resources (CRUD + addresses) |
| `client.fabric.swmlWebhooks` | SWML webhook resources |
| `client.fabric.aiAgents` | AI agent resources |
| `client.fabric.relayApplications` | RELAY application resources |
| `client.fabric.callFlows` | Call flow resources (+ versions) |
| `client.fabric.conferenceRooms` | Conference room resources |
| `client.fabric.freeswitchConnectors` | FreeSWITCH connector resources |
| `client.fabric.subscribers` | Subscriber resources (+ SIP endpoints) |
| `client.fabric.sipEndpoints` | SIP endpoint resources |
| `client.fabric.sipGateways` | SIP gateway resources |
| `client.fabric.cxmlScripts` | cXML script resources |
| `client.fabric.cxmlWebhooks` | cXML webhook resources |
| `client.fabric.cxmlApplications` | cXML application resources (no create) |
| `client.fabric.resources` | Generic resource operations |
| `client.fabric.addresses` | Fabric addresses (list and get only) |
| `client.fabric.tokens` | Subscriber, guest, invite and embed tokens |

### Calling API

The Calling API has one property:

| Property | Description |
|-----------|-------------|
| `client.calling` | REST call control; every command is a POST to `/api/calling/calls` |

### Relay REST Resources

These properties wrap the `/api/relay/rest` endpoints:

| Property | Description |
|-----------|-------------|
| `client.phoneNumbers` | Phone number management (+ search and call-handler helpers) |
| `client.addresses` | Address management |
| `client.queues` | Queue management (+ members) |
| `client.recordings` | Recording management |
| `client.numberGroups` | Number group management (+ memberships) |
| `client.verifiedCallers` | Verified caller ID management (+ verification flow) |
| `client.sipProfile` | Project SIP profile (get and update) |
| `client.lookup` | Phone number lookup |
| `client.shortCodes` | Short code management |
| `client.importedNumbers` | Import external phone numbers |
| `client.mfa` | Multi-factor authentication (SMS, call, verify) |
| `client.registry` | 10DLC brand and campaign registry |

### Other APIs

These properties cover the remaining APIs:

| Property | Description |
|-----------|-------------|
| `client.messages` | Send an SMS or MMS message, and redact a sent message |
| `client.datasphere` | Datasphere document management and semantic search |
| `client.video` | Video rooms, sessions, recordings, conferences, tokens and streams |
| `client.logs` | Message, voice, fax and conference logs |
| `client.project` | API token management |
| `client.projects` | Project and subproject management (+ signing-key rotation) |
| `client.pubsub` | PubSub token creation |
| `client.chat` | Chat token creation |

## Error Handling

This example catches the error thrown by a failed request and reads its properties:

```typescript
import { RestClient, SignalWireRestError } from '@signalwire/sdk';

const client = new RestClient();

try {
  await client.fabric.aiAgents.get('bad-id');
} catch (err) {
  if (err instanceof SignalWireRestError) {
    console.log(err.statusCode); // for example 404
    console.log(err.body); // parsed JSON, or the raw text
    console.log(err.url); // the full request URL
    console.log(err.method); // "GET"
    console.log(err.requestId); // the platform request ID, or null
  }
}
```

`SignalWireRestError` is thrown on any non-2xx HTTP response. It's also exported as `RestError`; the two names refer to the same class. Its message has the form `GET <url> returned 404: <body>`, followed by ` (request-id: <id>)` when the response carries a request ID.

A request that gets no response throws `RestTransportError` (also exported as `SignalWireRestTransportError`). Examples are a refused connection, a DNS or TLS failure, a timeout, and cancellation through `abortSignal`. It extends `RestError`, so one `instanceof RestError` check catches both.

### Error Properties

The error has these properties:

| Property | Type | Description |
|-----------|------|-------------|
| `statusCode` | `number \| null` | HTTP status code; `null` for a transport failure |
| `body` | `object` or `string` | Response body (parsed JSON or raw text); the error message for a transport failure |
| `url` | `string` | Full request URL |
| `method` | `string` | HTTP method |
| `headers` | `Record<string, string> \| null` | Response headers; `null` for a transport failure |
| `requestId` | `string \| null` | The first of `x-request-id`, `x-signalwire-request-id`, `request-id` or `x-amzn-requestid` in the response headers |

## Client Behavior

The client works this way:

- One `HttpClient`, using the global `fetch`, is shared by all namespaces.
- Requests send `Accept: application/json`, and a JSON body with `Content-Type: application/json`.
- A `204 No Content` response, or an empty body, returns `{}`.
- A bare `host` gets an `https://` base URL, or `http://` for a loopback host such as `127.0.0.1:8933`.
- The `fetchImpl` option replaces `fetch`, for tests.
