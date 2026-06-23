# Getting Started with RELAY

The RELAY client connects to SignalWire over a persistent WebSocket and gives you real-time, imperative control over phone calls using async/await.

## Installation

The RELAY client is included in the `@signalwire/sdk` package:

```bash
npm install @signalwire/sdk
```

RELAY requires Node.js >= 22.

## Configuration

You need three things to connect:

| Option | Env Var | Description |
|--------|---------|-------------|
| `project` | `SIGNALWIRE_PROJECT_ID` | Your SignalWire project ID |
| `token` | `SIGNALWIRE_API_TOKEN` | Your SignalWire API token |
| `host` | `SIGNALWIRE_SPACE` | Your space hostname (e.g. `example.signalwire.com`) |

Alternatively, you can authenticate with a JWT token:

| Option | Env Var | Description |
|--------|---------|-------------|
| `jwtToken` | `SIGNALWIRE_JWT_TOKEN` | A SignalWire JWT auth token |

## Minimal Example

```typescript
import { RelayClient } from '@signalwire/sdk';

const client = new RelayClient({
  project: 'your-project-id',
  token: 'your-api-token',
  host: 'example.signalwire.com',
  contexts: ['default'],
});

client.onCall(async (call) => {
  await call.answer();
  const action = await call.play([{ type: 'tts', params: { text: 'Hello!' } }]);
  await action.wait();
  await call.hangup();
});

// Connect and maintain the connection (auto-reconnects)
client.run();
```

Or use environment variables and skip the constructor args:

```bash
export SIGNALWIRE_PROJECT_ID=your-project-id
export SIGNALWIRE_API_TOKEN=your-api-token
export SIGNALWIRE_SPACE=example.signalwire.com
```

```typescript
import { RelayClient } from '@signalwire/sdk';

const client = new RelayClient({ contexts: ['default'] });

client.onCall(async (call) => {
  await call.answer();
  await call.hangup();
});

client.run();
```

## Contexts

Contexts are topics your client subscribes to for receiving inbound calls. When a call arrives on a context you're subscribed to, your `onCall` handler is invoked.

```typescript
// Subscribe at connect time
const client = new RelayClient({ contexts: ['sales', 'support'] });

// Or dynamically after connecting
await client.receive(['billing']);
await client.unreceive(['sales']);
```

## Making Outbound Calls

Use `client.dial()` to place an outbound call:

```typescript
await client.connect();

const call = await client.dial([
  [{ type: 'phone', to: '+15551234567', from: '+15559876543' }],
]);
// call is now a live Call object
const action = await call.play([{ type: 'tts', params: { text: 'This is an outbound call.' } }]);
await action.wait();
await call.hangup();
```

The outer array represents serial attempts; the inner array represents parallel attempts. For example, to try two numbers simultaneously:

```typescript
const call = await client.dial([
  [
    { type: 'phone', to: '+15551111111', from: '+15559876543' },
    { type: 'phone', to: '+15552222222', from: '+15559876543' },
  ],
]);
```

`dial()` accepts an options object as its second argument — `tag`, `maxDuration` (minutes), and `dialTimeout` (seconds, default 120):

```typescript
const call = await client.dial(
  [[{ type: 'phone', to: '+15551234567', from: '+15559876543' }]],
  { dialTimeout: 30 },
);
```

## Debug Logging

Set the log level to see WebSocket traffic:

```bash
export SIGNALWIRE_LOG_LEVEL=debug
```

## Cleanup with `await using`

For use within an existing async application, `RelayClient` is an async-disposable — it disconnects automatically when the scope exits:

```typescript
await using client = new RelayClient({ contexts: ['default'] });
await client.connect();
const call = await client.dial([
  [{ type: 'phone', to: '+15551234567', from: '+15559876543' }],
]);
await call.hangup();
// client.disconnect() runs automatically at end of scope
```

If your runtime doesn't support `await using`, use `try`/`finally`:

```typescript
const client = new RelayClient({ contexts: ['default'] });
try {
  await client.connect();
  // ... use client
} finally {
  await client.disconnect();
}
```

## Next Steps

- [Call Methods Reference](call-methods.md) -- all methods available on a Call object
- [Events](events.md) -- handling real-time call events
- [Client Reference](client-reference.md) -- RelayClient configuration and methods
- [Messaging](messaging.md) -- sending and receiving SMS/MMS
