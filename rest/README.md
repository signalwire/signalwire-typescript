# SignalWire REST Client

Typed HTTP client for managing SignalWire resources, controlling live calls, and interacting with every SignalWire API surface from TypeScript. No WebSocket required — just standard HTTP requests with `fetch`.

## Quick Start

<!-- snippet: no-run makes live REST calls to a real SignalWire space; the loopback-mock override is documented in "Pointing at a non-default endpoint" below -->
```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient({
  project: 'your-project-id',
  token: 'your-api-token',
  host: 'example.signalwire.com',
});

// Create an AI agent
const agent = await client.fabric.aiAgents.create({
  name: 'Support Bot',
  prompt: { text: 'You are a helpful support agent.' },
});

// Search for a phone number
const results = await client.phoneNumbers.search({ areacode: '512' });

// Place a call via REST — from and to are positional
await client.calling.dial('+15559876543', '+15551234567', {
  url: 'https://example.com/call-handler',
});
```

## Pointing at a non-default endpoint

By default the client talks to your SignalWire space over `https://`. To point it at a
local mock, a private space, or a proxy, use any of these (in precedence order):

- **`host` option accepting a full URL** — pass a `http://`/`https://` URL as `host` and
  the client uses it verbatim:
  ```typescript
  import { RestClient } from '@signalwire/sdk';

  const client = new RestClient({
    project: 'your-project-id',
    token: 'your-api-token',
    host: 'http://127.0.0.1:8933', // full URL → used as-is (plain HTTP for loopback)
  });
  ```
- **`SIGNALWIRE_REST_BASE_URL` env var** — the fleet-wide base-url override (a full URL);
  takes effect when `host` is not passed. Matches the other SignalWire SDKs.
- **`SIGNALWIRE_SPACE` env var** — a bare host (e.g. `example.signalwire.com`); the client
  prepends `https://` (or `http://` for a loopback host).

A bare loopback host (`127.0.0.1:<port>` / `localhost:<port>`) is auto-detected and served
over plain `http://`, so the client can reach a local mock standalone.

Custom CA: set `SIGNALWIRE_REST_CA_FILE` to a PEM bundle to trust a private/self-signed
certificate for HTTPS requests.

## Features

- Single `RestClient` with namespaced sub-objects for every API
- All 37 calling commands: dial, play, record, collect, detect, tap, stream, AI, transcribe, and more
- Full Fabric API: 16 resource types with CRUD + addresses, tokens, and generic resources
- Datasphere: document management and semantic search
- Video: rooms, sessions, recordings, conferences, tokens, streams
- Phone number management, 10DLC registry, MFA, logs, and more
- Uses the platform's built-in `fetch` (Node 22+); a small set of runtime dependencies (`hono`, `@hono/node-server`, `ajv`, `js-yaml`, `ws`) power the agent/server layer
- Injectable `fetchImpl` for testing

## Documentation

- [Getting Started](docs/guide.md) — installation, configuration, namespaces, pagination, error handling

## Examples

- [rest-client.ts](examples/rest-client.ts) — overview: list numbers, agents, rooms, documents, logs
- [rest-manage-resources.ts](examples/rest-manage-resources.ts) — create an AI agent, assign a number, place a call
- [rest-datasphere-search.ts](examples/rest-datasphere-search.ts) — upload a document, semantic search
- [rest-calling-play-and-record.ts](examples/rest-calling-play-and-record.ts) — play, record, transcribe, denoise
- [rest-calling-ivr-and-ai.ts](examples/rest-calling-ivr-and-ai.ts) — IVR, detect, AI, tap, stream, SIP refer
- [rest-fabric-swml-and-callflows.ts](examples/rest-fabric-swml-and-callflows.ts) — SWML scripts, call flows, webhooks
- [rest-fabric-subscribers-and-sip.ts](examples/rest-fabric-subscribers-and-sip.ts) — subscribers, SIP endpoints, gateways
- [rest-fabric-conferences-and-routing.ts](examples/rest-fabric-conferences-and-routing.ts) — conferences, cXML, routing, tokens
- [rest-phone-number-management.ts](examples/rest-phone-number-management.ts) — search, purchase, groups, lookup, verified callers
- [rest-queues-mfa-and-recordings.ts](examples/rest-queues-mfa-and-recordings.ts) — queues, recordings, MFA
- [rest-video-rooms.ts](examples/rest-video-rooms.ts) — video rooms, sessions, conferences, streams
- [rest-10dlc-registration.ts](examples/rest-10dlc-registration.ts) — 10DLC brand and campaign registration

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SIGNALWIRE_PROJECT_ID` | Project ID for authentication |
| `SIGNALWIRE_API_TOKEN` | API token for authentication |
| `SIGNALWIRE_SPACE` | Space hostname (e.g. `example.signalwire.com`) |
| `SIGNALWIRE_LOG_LEVEL` | Log level (`debug` for HTTP request details) |

## Module Structure

```
src/rest/
    index.ts             # RestClient + public exports
    HttpClient.ts        # fetch-based HTTP with Basic Auth
    RestError.ts         # Error class: statusCode, body, url, method, headers, requestId
    pagination.ts        # paginate<T>() async generator + paginateAll()
    types.ts             # ClientOptions, PaginatedResponse, QueryParams
    base/
        BaseResource.ts      # Abstract base with _http + _path()
        CrudResource.ts      # list/create/get/update/delete with generics
        CrudWithAddresses.ts # CrudResource + listAddresses()
    namespaces/
        fabric.ts        # 16 resource types incl. generic resources + addresses + tokens
        calling.ts       # 37 command dispatch methods via single POST
        phone-numbers.ts # Search, purchase, update, release
        video.ts         # Rooms, sessions, recordings, conferences, tokens, streams
        datasphere.ts    # Documents
        ... and more
```
