# Getting Started with the REST Client

The REST client gives you access to the SignalWire platform APIs over standard HTTP requests. It needs no WebSocket connection. This page installs the SDK, configures credentials and makes a first API call.

## Installation

The REST client is part of the `@signalwire/sdk` package. Install it with npm:

```bash
npm install @signalwire/sdk
```

The SDK requires Node.js 22 or later. The client uses the global `fetch` API.

## Configuration

The client needs three settings. Each constructor option falls back to an environment variable:

| Parameter | Env Var | Description |
|-----------|---------|-------------|
| `project` | `SIGNALWIRE_PROJECT_ID` | Your SignalWire project ID |
| `token` | `SIGNALWIRE_API_TOKEN` | Your SignalWire API token |
| `host` | `SIGNALWIRE_SPACE` | Your space hostname (for example `example.signalwire.com`) |

`SIGNALWIRE_REST_BASE_URL` also sets the host, as a full URL, and takes precedence over `SIGNALWIRE_SPACE`. If a setting is missing from both the options and the environment, the constructor throws an `Error`.

## Minimal Example

This example lists the AI agents in your project:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient({
  project: 'your-project-id',
  token: 'your-api-token',
  host: 'example.signalwire.com',
});

// List your AI agents
const agents = await client.fabric.aiAgents.list();
console.log(agents);
```

To configure the client from the environment instead, export the three variables:

```bash
export SIGNALWIRE_PROJECT_ID=your-project-id
export SIGNALWIRE_API_TOKEN=your-api-token
export SIGNALWIRE_SPACE=example.signalwire.com
```

Then construct the client without options:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient();
const agents = await client.fabric.aiAgents.list();
```

## CRUD Pattern

Most resources share the same CRUD methods. This example runs each of them on AI agents:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient();

// List
const items = await client.fabric.aiAgents.list();

// Create
const agent = await client.fabric.aiAgents.create({
  name: 'Support',
  prompt: { text: 'Be helpful' },
});

// Get by ID
const found = await client.fabric.aiAgents.get('agent-uuid');

// Update
await client.fabric.aiAgents.update('agent-uuid', { name: 'Updated Name' });

// Delete
await client.fabric.aiAgents.delete('agent-uuid');
```

Fabric resources also list the addresses assigned to them:

<!-- snippet: no-run makes a live REST call to a real SignalWire space -->
```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient();
const addresses = await client.fabric.aiAgents.listAddresses('agent-uuid');
```

## Error Handling

Every non-2xx HTTP response throws `SignalWireRestError`, which is the same class as `RestError`. A request that gets no response, such as a refused connection or a timeout, throws `RestTransportError`, a subclass with a `null` status code:

```typescript
import { RestClient, SignalWireRestError } from '@signalwire/sdk';

const client = new RestClient();

try {
  const agent = await client.fabric.aiAgents.get('nonexistent-id');
} catch (err) {
  if (err instanceof SignalWireRestError) {
    console.error(`HTTP ${err.statusCode}: ${JSON.stringify(err.body)}`);
  }
}
```

The `body` property holds the parsed JSON response, or the raw text when the response isn't JSON. [Client Reference](client-reference.md#error-handling) lists every property of the error.

## Debug Logging

Set the log level to `debug` to log the method and URL of each request:

```bash
export SIGNALWIRE_LOG_LEVEL=debug
```

## Next Steps

These pages continue from here:

- [Client Reference](client-reference.md): all namespaces and constructor options
- [Fabric Resources](fabric.md): managing AI agents, SWML scripts and more
- [Calling Commands](calling.md): REST-based call control
- [All Namespaces](namespaces.md): phone numbers, video, Datasphere and more
