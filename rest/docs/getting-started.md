# Getting Started with the REST Client

The REST client provides access to all SignalWire APIs using standard HTTP requests. No WebSocket connection required.

## Installation

The REST client is included in the `@signalwire/sdk` package:

```bash
npm install @signalwire/sdk
```

Node.js >= 22 is required. The client uses the global `fetch` API, so no extra HTTP dependency is needed.

## Configuration

You need three things to connect:

| Parameter | Env Var | Description |
|-----------|---------|-------------|
| `project` | `SIGNALWIRE_PROJECT_ID` | Your SignalWire project ID |
| `token` | `SIGNALWIRE_API_TOKEN` | Your SignalWire API token |
| `host` | `SIGNALWIRE_SPACE` | Your space hostname (e.g. `example.signalwire.com`) |

## Minimal Example

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
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

Or use environment variables and skip the constructor options:

```bash
export SIGNALWIRE_PROJECT_ID=your-project-id
export SIGNALWIRE_API_TOKEN=your-api-token
export SIGNALWIRE_SPACE=example.signalwire.com
```

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient();
const agents = await client.fabric.aiAgents.list();
```

## CRUD Pattern

Most resources follow the same CRUD pattern:

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
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

Fabric resources also support listing addresses:

<!-- snippet: no-run makes a live REST call to SIGNALWIRE_SPACE — the SDK has no plain-HTTP mock override, so it can't reach the loopback mock standalone -->
```typescript
import { RestClient } from '@signalwire/sdk';

const client = new RestClient();
const addresses = await client.fabric.aiAgents.listAddresses('agent-uuid');
```

## Error Handling

All non-2xx HTTP responses throw `SignalWireRestError`:

```typescript
import { RestClient, SignalWireRestError } from '@signalwire/sdk';

const client = new RestClient();

try {
  const agent = await client.fabric.aiAgents.get('nonexistent-id');
} catch (err) {
  if (err instanceof SignalWireRestError) {
    console.error(`HTTP ${err.statusCode}: ${JSON.stringify(err.body)}`);
    // HTTP 404: {"error":"not found"}
  }
}
```

## Debug Logging

Set the log level to see HTTP request details:

```bash
export SIGNALWIRE_LOG_LEVEL=debug
```

## Next Steps

- [Client Reference](client-reference.md) -- all namespaces and constructor options
- [Fabric Resources](fabric.md) -- managing AI agents, SWML scripts, and more
- [Calling Commands](calling.md) -- REST-based call control
- [All Namespaces](namespaces.md) -- phone numbers, video, datasphere, and more
