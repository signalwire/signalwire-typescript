# Getting Started with RELAY

The RELAY client holds a WebSocket connection to SignalWire and gives you real-time control over phone calls and messages with `async`/`await`. This page installs the SDK, connects a client and places a first call.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// `await using` needs the disposable global types + Symbol members absent from
// the harness's ES2020 lib set. Declared here so the `await using` example compiles.
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
    readonly asyncDispose: unique symbol;
  }
  interface Disposable {
    [Symbol.dispose](): void;
  }
  interface AsyncDisposable {
    [Symbol.asyncDispose](): PromiseLike<void>;
  }
}
```

## Installation

The RELAY client is part of the `@signalwire/sdk` package. Install it with npm:

```bash
npm install @signalwire/sdk
```

The package requires Node.js 22 or later. Its WebSocket dependency, `ws`, installs with it.

## Configuration

The client needs a project ID, an API token and your space's hostname:

| Option | Env Var | Description |
|--------|---------|-------------|
| `project` | `SIGNALWIRE_PROJECT_ID` | Your SignalWire project ID |
| `token` | `SIGNALWIRE_API_TOKEN` | Your SignalWire API token |
| `host` | `SIGNALWIRE_SPACE` | Your space hostname (for example, `example.signalwire.com`) |

You can authenticate with a JWT in place of the project and token:

| Option | Env Var | Description |
|--------|---------|-------------|
| `jwtToken` | `SIGNALWIRE_JWT_TOKEN` | A SignalWire JWT |

The constructor throws when it has neither a JWT nor both a project and a token. It also throws when `host` isn't a bare hostname, for example when you pass a URL.

## Minimal Example

This program connects with explicit credentials and answers every call on the `default` context:

<!-- snippet: no-run client.run() opens a live WebSocket to SIGNALWIRE_SPACE and runs until SIGINT/SIGTERM; it can't reach the loopback mock standalone -->
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

// Connect, then reconnect after any dropped connection until SIGINT/SIGTERM
await client.run();
```

You can set the credentials as environment variables instead:

```bash
export SIGNALWIRE_PROJECT_ID=your-project-id
export SIGNALWIRE_API_TOKEN=your-api-token
export SIGNALWIRE_SPACE=example.signalwire.com
```

With those set, the constructor needs only the contexts:

<!-- snippet: no-run client.run() opens a live WebSocket to SIGNALWIRE_SPACE and runs until SIGINT/SIGTERM; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient } from '@signalwire/sdk';

const client = new RelayClient({ contexts: ['default'] });

client.onCall(async (call) => {
  await call.answer();
  await call.hangup();
});

await client.run();
```

## Contexts

Contexts are the topics your client subscribes to for inbound calls and messages. When a call arrives on a subscribed context, the client calls your `onCall` handler with a `Call` object.

Set contexts in the constructor, or change them on a connected client:

<!-- snippet: no-run client.receive() opens a live WebSocket to SIGNALWIRE_SPACE; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient } from '@signalwire/sdk';

// Subscribe when the client connects
const client = new RelayClient({ contexts: ['sales', 'support'] });
await client.connect();

// Change the subscription later
await client.receive(['billing']);
await client.unreceive(['sales']);
```

## Making Outbound Calls

Use `client.dial()` to place an outbound call. It resolves with a `Call` once a device answers:

<!-- snippet: no-run client.dial() opens a live WebSocket to SIGNALWIRE_SPACE; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient } from '@signalwire/sdk';
const client = new RelayClient({ contexts: ['default'] });
await client.connect();

const call = await client.dial([
  [{ type: 'phone', to: '+15551234567', from: '+15559876543' }],
]);
// call is now a live Call object
const action = await call.play([{ type: 'tts', params: { text: 'This is an outbound call.' } }]);
await action.wait();
await call.hangup();
```

The SDK sends a phone device's `to` and `from` as the wire fields `to_number` and `from_number`. You can also pass the wire shape, `{ type: 'phone', params: { to_number, from_number } }`.

The outer array holds serial attempts, and each inner array holds devices dialed in parallel. This call rings two numbers at the same time:

<!-- snippet: no-run client.dial() opens a live WebSocket to SIGNALWIRE_SPACE; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient } from '@signalwire/sdk';
const client = new RelayClient({ contexts: ['default'] });
await client.connect();
const call = await client.dial([
  [
    { type: 'phone', to: '+15551111111', from: '+15559876543' },
    { type: 'phone', to: '+15552222222', from: '+15559876543' },
  ],
]);
```

`dial()` takes an options object as its second argument: `tag`, `maxDuration` (minutes) and `dialTimeout` (seconds, default 120). This call gives up after 30 seconds:

<!-- snippet: no-run client.dial() opens a live WebSocket to SIGNALWIRE_SPACE; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient } from '@signalwire/sdk';
const client = new RelayClient({ contexts: ['default'] });
await client.connect();
const call = await client.dial(
  [[{ type: 'phone', to: '+15551234567', from: '+15559876543' }]],
  { dialTimeout: 30 },
);
```

`dial()` rejects with a `RelayError` when the dial fails, when `dialTimeout` passes first, or when the connection closes.

## Debug Logging

Set the log level to `debug` to log the WebSocket traffic:

```bash
export SIGNALWIRE_LOG_LEVEL=debug
```

The debug log masks the project, token, JWT and authorization-state values.

## Cleanup with `await using`

`RelayClient` implements `Symbol.asyncDispose`, so `await using` disconnects it when the scope exits:

<!-- snippet: no-run client.connect()/dial() opens a live WebSocket to SIGNALWIRE_SPACE; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient } from '@signalwire/sdk';
await using client = new RelayClient({ contexts: ['default'] });
await client.connect();
const call = await client.dial([
  [{ type: 'phone', to: '+15551234567', from: '+15559876543' }],
]);
await call.hangup();
// client.disconnect() runs automatically at end of scope
```

If your toolchain doesn't support `await using`, call `disconnect()` in a `finally` block:

<!-- snippet: no-run client.connect() opens a live WebSocket to SIGNALWIRE_SPACE; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient } from '@signalwire/sdk';
const client = new RelayClient({ contexts: ['default'] });
try {
  await client.connect();
  // ... use client
} finally {
  await client.disconnect();
}
```

A client started with `connect()` doesn't reconnect by itself. Use `run()` for a long-running process that should survive dropped connections.

## Next Steps

Continue with these pages:

- [Call Methods Reference](call-methods.md): the methods on a `Call` object
- [Events](events.md): handling real-time call events
- [Client Reference](client-reference.md): `RelayClient` options and methods
- [Messaging](messaging.md): sending and receiving SMS/MMS
