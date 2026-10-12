# SignalWire REST Client

`RestClient` is a typed HTTP client for the SignalWire platform APIs. You use it from TypeScript to manage resources such as phone numbers, AI agents and video rooms, and to control live calls. It sends standard HTTP requests with `fetch` and needs no WebSocket connection.

## Quick Start

This example creates a client, creates an AI agent, searches for phone numbers and places a call:

<!-- snippet: no-run makes live REST calls to a real SignalWire space; the loopback-mock override is documented in "Pointing at a non-default endpoint" -->
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

// Place a call via REST; from and to are positional
await client.calling.dial('+15559876543', '+15551234567', {
  url: 'https://example.com/call-handler',
});
```

Every method is async and returns the parsed JSON response.

## Pointing at a non-default endpoint

By default the client talks to your SignalWire space over `https://`. To point it at a local mock, a private space or a proxy, use one of these settings. The client checks them in this order:

1. The `host` option. A value that starts with `http` is used as the full base URL:

   ```typescript
   import { RestClient } from '@signalwire/sdk';

   const client = new RestClient({
     project: 'your-project-id',
     token: 'your-api-token',
     host: 'http://127.0.0.1:8933', // a full URL is used as is
   });
   ```

2. The `SIGNALWIRE_REST_BASE_URL` environment variable, a full URL. It applies when you don't pass `host`.
3. The `SIGNALWIRE_SPACE` environment variable, a bare host such as `example.signalwire.com`. The client adds `https://`.

When the bare host is a loopback address (`127.0.0.1`, `localhost` or `::1`, with or without a port), the client uses `http://` instead of `https://`. That lets it reach a local mock server.

To trust a private or self-signed certificate, set `SIGNALWIRE_REST_CA_FILE` to a PEM bundle. The bundle replaces Node's default trust roots for REST requests. The client loads it through the `undici` package. If the file or `undici` can't be loaded, the client logs `rest_ca_file_load_failed` and uses Node's default trust store.

## Features

The client covers these API areas:

- One `RestClient` with a property for each API area, such as `client.fabric` and `client.calling`
- Every command of the Calling API: dial, play, record, collect, detect, tap, stream, AI control, transcription and more
- The Fabric API resources (AI agents, SWML scripts, subscribers, call flows and others), with CRUD, address listing and tokens
- Datasphere document management and semantic search
- Video rooms, sessions, recordings, conferences, tokens and streams
- Phone numbers, messaging, 10DLC registry, MFA, logs and project tokens
- A `requestOptions` setting on every request for timeouts, retries and cancellation
- An injectable `fetchImpl` for tests

The client uses the `fetch` built into Node.js 22 and later.

## Documentation

These pages cover the client in depth:

- [Getting Started](docs/getting-started.md): installation, configuration and your first API call
- [REST Client Guide](docs/guide.md): namespaces, pagination, request options, error handling and test injection
- [Client Reference](docs/client-reference.md): the `RestClient` constructor, every namespace and the error class
- [Fabric Resources](docs/fabric.md): AI agents, SWML scripts, subscribers, call flows, addresses and tokens
- [Binding a phone number to a call handler](docs/phone-binding.md): the `PhoneCallHandler` values and the `phoneNumbers.set*` helpers
- [Calling Commands](docs/calling.md): REST-based call control
- [All Namespaces](docs/namespaces.md): phone numbers, messaging, video, Datasphere, logs, registry and more

## Examples

These examples are in the repository:

- [rest-client.ts](examples/rest-client.ts): list numbers, agents, rooms, documents and logs
- [rest-manage-resources.ts](examples/rest-manage-resources.ts): create an AI agent, assign a number and place a call
- [rest-bind-phone-to-swml-webhook.ts](examples/rest-bind-phone-to-swml-webhook.ts): route a phone number to an SWML webhook
- [rest-datasphere-search.ts](examples/rest-datasphere-search.ts): upload a document and run a semantic search
- [rest-calling-play-and-record.ts](examples/rest-calling-play-and-record.ts): play, record, transcribe and denoise
- [rest-calling-ivr-and-ai.ts](examples/rest-calling-ivr-and-ai.ts): IVR input, detection, AI, tap, stream and SIP REFER
- [rest-fabric-swml-and-callflows.ts](examples/rest-fabric-swml-and-callflows.ts): SWML scripts, call flows and webhooks
- [rest-fabric-subscribers-and-sip.ts](examples/rest-fabric-subscribers-and-sip.ts): subscribers, SIP endpoints and gateways
- [rest-fabric-conferences-and-routing.ts](examples/rest-fabric-conferences-and-routing.ts): conferences, cXML, routing and tokens
- [rest-phone-number-management.ts](examples/rest-phone-number-management.ts): search, purchase, groups, lookup and verified callers
- [rest-queues-mfa-and-recordings.ts](examples/rest-queues-mfa-and-recordings.ts): queues, recordings and MFA
- [rest-video-rooms.ts](examples/rest-video-rooms.ts): video rooms, sessions, conferences and streams
- [rest-10dlc-registration.ts](examples/rest-10dlc-registration.ts): 10DLC brand and campaign registration

## Environment Variables

The client reads these variables:

| Variable | Description |
|----------|-------------|
| `SIGNALWIRE_PROJECT_ID` | Project ID for authentication, used when you don't pass `project` |
| `SIGNALWIRE_API_TOKEN` | API token for authentication, used when you don't pass `token` |
| `SIGNALWIRE_SPACE` | Space hostname (for example `example.signalwire.com`), used when you don't pass `host` |
| `SIGNALWIRE_REST_BASE_URL` | Full base URL; takes precedence over `SIGNALWIRE_SPACE` |
| `SIGNALWIRE_REST_CA_FILE` | PEM bundle to trust for REST HTTPS requests |
| `SIGNALWIRE_LOG_LEVEL` | Log level; `debug` logs the method and URL of each request |

## Module Structure

The client's code lives in `src/rest/`:

```text
src/rest/
    index.ts             # RestClient + public exports
    HttpClient.ts        # fetch-based HTTP with Basic Auth, retries and the CA bundle
    RequestOptions.ts    # timeout, retry and abort settings
    RestError.ts         # RestError and RestTransportError
    pagination.ts        # paginate() async generator + paginateAll()
    callHandler.ts       # PhoneCallHandler values for phoneNumbers.update
    types.ts             # ClientOptions, PaginatedResponse, QueryParams
    base/
        BaseResource.ts      # Base class with the HttpClient and _path()
        ReadResource.ts      # list(), get() and paginate()
        CrudResource.ts      # ReadResource + create(), update(), delete()
        CrudWithAddresses.ts # CrudResource + listAddresses()
        FabricResource.ts    # Fabric bases (PATCH or PUT updates)
    namespaces/
        *.resources.generated.ts  # resource classes generated from the OpenAPI specs
        *.types.generated.ts      # request and response types
        _client_tree_generated.ts # the namespace properties on RestClient
        fabric.ts, calling.ts, ...  # re-exports and compatibility aliases
```
