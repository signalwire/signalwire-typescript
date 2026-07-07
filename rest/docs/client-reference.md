# RestClient Reference

## Constructor

```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient({
  project: 'your-project-id', // SIGNALWIRE_PROJECT_ID
  token: 'your-api-token',    // SIGNALWIRE_API_TOKEN
  host: 'example.signalwire.com', // SIGNALWIRE_SPACE
});
```

All options fall back to their corresponding environment variables. An `Error` is thrown if any are missing.

Authentication uses HTTP Basic Auth (`project:token`).

## Namespaces

Every API surface is available as a namespace property on the client. There are 21 top-level namespaces.

### Fabric API

`client.fabric` has 16 sub-resources:

| Property | Description |
|-----------|-------------|
| `client.fabric.swmlScripts` | SWML script resources (CRUD + addresses) |
| `client.fabric.swmlWebhooks` | SWML webhook resources |
| `client.fabric.aiAgents` | AI agent resources |
| `client.fabric.relayApplications` | Relay application resources |
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
| `client.fabric.addresses` | Fabric addresses (list/get only) |
| `client.fabric.tokens` | Subscriber/guest/invite/embed token creation |

### Calling API

| Property | Description |
|-----------|-------------|
| `client.calling` | REST call control -- 37 commands via POST |

### Relay REST Resources

| Property | Description |
|-----------|-------------|
| `client.phoneNumbers` | Phone number management (+ search) |
| `client.addresses` | Address management |
| `client.queues` | Queue management (+ members) |
| `client.recordings` | Recording management |
| `client.numberGroups` | Number group management (+ memberships) |
| `client.verifiedCallers` | Verified caller ID management (+ verification flow) |
| `client.sipProfile` | Project SIP profile (get/update) |
| `client.lookup` | Phone number lookup |
| `client.shortCodes` | Short code management |
| `client.importedNumbers` | Import external phone numbers |
| `client.mfa` | Multi-factor authentication (SMS/call/verify) |
| `client.registry` | 10DLC brand/campaign registry |

### Other APIs

| Property | Description |
|-----------|-------------|
| `client.datasphere` | Datasphere document management and semantic search |
| `client.video` | Video rooms, sessions, recordings, conferences |
| `client.logs` | Message, voice, fax, and conference logs |
| `client.project` | API token management |
| `client.pubsub` | PubSub token creation |
| `client.chat` | Chat token creation |

> Namespaces are properties, not methods — access them as `client.fabric`, never `client.fabric()`.

## Error Handling

```typescript
import { RestClient, SignalWireRestError } from '@signalwire/sdk';

const client = new RestClient();

try {
  await client.fabric.aiAgents.get('bad-id');
} catch (err) {
  if (err instanceof SignalWireRestError) {
    console.log(err.statusCode); // 404
    console.log(err.body);       // {"error":"not found"}
    console.log(err.url);        // "/api/fabric/resources/ai_agents/bad-id"
    console.log(err.method);     // "GET"
  }
}
```

`SignalWireRestError` is thrown on any non-2xx HTTP response. (It is also exported as `RestError`; the two names refer to the same class.)

### Error Properties

| Property | Type | Description |
|-----------|------|-------------|
| `statusCode` | `number` | HTTP status code |
| `body` | `object` or `string` | Response body (parsed JSON or raw text) |
| `url` | `string` | Request path |
| `method` | `string` | HTTP method |

## Client Behavior

- A single `HttpClient` (using the global `fetch`) is shared across all namespaces.
- Content-Type is `application/json` for JSON request bodies.
- A custom `fetch` implementation can be injected via the `fetchImpl` option for testing.
- The `host` is normalized to an `https://` base URL automatically.
