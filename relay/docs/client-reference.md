# RelayClient Reference

`RelayClient` owns one WebSocket connection to SignalWire RELAY. It authenticates, routes events to `Call` and `Message` objects, and sends the JSON-RPC requests that `Call` methods build.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context for the fragments on this page: `client` is a constructed
// RelayClient (see the Constructor section).
declare const client: import('@signalwire/sdk').RelayClient;
// `await using` needs the disposable global types + Symbol members absent from
// the harness's ES2020 lib set.
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

## Constructor

`new RelayClient(options?: RelayClientOptions)` takes one options object. Every option is optional:

```typescript
import { RelayClient } from '@signalwire/sdk';

function makeClient() {
  return new RelayClient({
    project: 'your-project-id',     // SIGNALWIRE_PROJECT_ID
    token: 'your-api-token',        // SIGNALWIRE_API_TOKEN
    jwtToken: 'your-jwt',           // SIGNALWIRE_JWT_TOKEN (alternative auth)
    host: 'example.signalwire.com', // SIGNALWIRE_SPACE (default: relay.signalwire.com)
    contexts: ['default'],          // topics to subscribe to
    maxActiveCalls: 1000,           // RELAY_MAX_ACTIVE_CALLS (default: 1000)
  });
}
```

Each omitted option falls back to the environment variable in its comment. Authentication needs either `jwtToken`, or both `project` and `token`. When `jwtToken` is set, the client authenticates with it and doesn't send the project and token.

The constructor throws an `Error` in these cases:

- It has no JWT, and the project or the token is missing.
- `host` contains `@`, `/`, `?`, `#`, a space or a line break, which means it isn't a bare hostname.

The options have these types:

| Option | Type | Default |
|--------|------|---------|
| `project` | `string` | `SIGNALWIRE_PROJECT_ID` |
| `token` | `string` | `SIGNALWIRE_API_TOKEN` |
| `jwtToken` | `string` | `SIGNALWIRE_JWT_TOKEN` |
| `host` | `string` | `SIGNALWIRE_RELAY_HOST`, then `SIGNALWIRE_SPACE`, then `relay.signalwire.com` |
| `scheme` | `'ws' \| 'wss'` | `SIGNALWIRE_RELAY_SCHEME`, then `'wss'` |
| `contexts` | `string[]` | `[]` |
| `maxActiveCalls` | `number` | `RELAY_MAX_ACTIVE_CALLS`, then `1000`; values under 1 become 1 |

`scheme: 'ws'` sends traffic without TLS. It exists for tests against a local fixture, not for production.

## Methods

### `run(): Promise<void>`

`run()` connects, authenticates and reconnects after every dropped connection, with exponential backoff. It installs `SIGINT` and `SIGTERM` handlers, and its promise resolves after one of those signals shuts the client down.

```typescript
await client.run();
```

A connection error doesn't reject the promise: `run()` logs it and tries again. Because `run()` installs process-wide signal handlers, call it on one client per process.

### `connect(): Promise<void>` / `disconnect(): Promise<void>`

`connect()` opens the WebSocket, runs the `signalwire.connect` handshake, starts the client ping loop and sends any queued requests. `disconnect()` closes the socket and rejects every pending request and dial with a `RelayError`. Calling `disconnect()` more than once is safe.

```typescript
await client.connect();
// ... use client ...
await client.disconnect();
```

A client started with `connect()` doesn't reconnect when the connection drops; only `run()` reconnects. `connect()` throws when the process already has `RELAY_MAX_CONNECTIONS` other connected clients.

`RelayClient` also implements `Symbol.asyncDispose`, so `await using` calls `disconnect()` at the end of the scope:

```typescript
import { RelayClient } from '@signalwire/sdk';

async function withClient() {
  await using client = new RelayClient({ contexts: ['default'] });
  await client.connect();
  // ...
}
```

### `onCall(handler: CallHandler): CallHandler`

`onCall()` registers the inbound call handler and returns it. The client calls the handler once for each `calling.call.receive` event, with a `Call` built from that event (normally in state `created`). The handler may be async.

```typescript
client.onCall(async (call) => {
  await call.answer();
});
```

The client doesn't await the handler, so handlers for different calls run concurrently. A handler's error is logged and doesn't stop the client. Registering a second handler replaces the first.

### `onMessage(handler: MessageHandler): MessageHandler`

`onMessage()` registers the inbound message handler and returns it. The client calls the handler for each `messaging.receive` event, with a `Message` built from that event (normally in state `received`). The handler may be async.

```typescript
client.onMessage(async (message) => {
  console.log(`SMS from ${message.fromNumber}: ${message.body}`);
});
```

### `onEvent(handler): typeof handler`

`onEvent()` registers a low-level observer for every inbound `signalwire.event`, whatever its type. The handler receives `(eventType: string, params: Record<string, unknown>)`, with `params` in the platform's raw `snake_case` form, and may be async.

```typescript
client.onEvent((eventType, params) => {
  console.log(`event: ${eventType}`);
});
```

The observer runs before the client routes the event to a `Call` or `Message`, so an event reaches both. It also sees events that match no tracked call, such as state changes for calls this client didn't create. For inbound calls and messages, `onCall` and `onMessage` hand you objects that are ready to use.

### `dial(devices, options?): Promise<Call>`

`dial()` places an outbound call and resolves with a `Call` once a device answers. It takes these arguments:

- `devices`: a nested array of device objects. The outer array holds serial attempts, and each inner array holds devices dialed in parallel.
- `options.tag`: a correlation tag. The client generates a UUID when you omit it.
- `options.maxDuration`: the maximum call duration in minutes, sent as `max_duration`
- `options.dialTimeout`: seconds to wait for an answer after the platform accepts the dial (default 120)

This call rings one number and waits up to 30 seconds:

```typescript
const call = await client.dial(
  [[{ type: 'phone', to: '+15551234567', from: '+15559876543' }]],
  { dialTimeout: 30 },
);
```

`dial()` doesn't read a call ID from the `calling.dial` response. It waits for a `calling.call.dial` event that carries its tag. It resolves when that event's `dial_state` is `answered` and rejects with a `RelayError` when it's `failed`. It also rejects when `dialTimeout` passes or the connection closes.

### `sendMessage(options): Promise<Message>`

`sendMessage()` sends an outbound SMS or MMS. It takes `toNumber` and `fromNumber`, with `body`, `media` or both, and resolves with a `Message` once the platform accepts the send.

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello!',
});
await message.wait(); // resolves at delivered, undelivered or failed
```

It throws an `Error` when both `body` and `media` are missing. [Messaging](messaging.md) lists every option.

### `execute(method, params): Promise<Record<string, unknown>>`

`execute()` sends a JSON-RPC request and resolves with the response's `result` object. `Call` methods use it, and you can use it for RELAY methods the SDK has no helper for.

```typescript
await client.execute('calling.play', { /* ... */ });
```

It rejects with a `RelayError` when the result `code` isn't 2xx. Unlike `Call` methods, it doesn't turn a 404 or 410 into `{}`. A request that gets no response within 30 seconds rejects with a `RelayError` (code `-1`), and the client then closes the connection. Under `run()`, the client reconnects.

### `notify(method, params): void`

`notify()` sends a JSON-RPC frame without waiting for a response, and does nothing when the socket is closed. The SDK's audit harness uses it. Use `execute()` in application code, because `notify()` never checks the result.

### `receive(contexts): Promise<void>` / `unreceive(contexts): Promise<void>`

`receive()` subscribes a connected client to more contexts, and `unreceive()` removes contexts. Each does nothing when the array is empty.

```typescript
await client.receive(['new-context']);
await client.unreceive(['old-context']);
```

## Properties

`RelayClient` exposes these read-only properties:

| Property | Type | Description |
|----------|------|-------------|
| `relayProtocol` | `string` | Protocol string the server assigned in the `signalwire.connect` result (`''` before the first connection) |
| `project` | `string` | Project ID |
| `token` | `string` | API token |
| `jwtToken` | `string` | JWT (`''` when not used) |
| `host` | `string` | RELAY host |
| `scheme` | `'ws' \| 'wss'` | WebSocket scheme |
| `contexts` | `string[]` | Contexts passed to the constructor. `receive()` and `unreceive()` don't change this array. |

## Connection Behavior

The client manages its WebSocket connection in these ways:

- **Reconnection**: `run()` reconnects after a dropped connection. The delay starts at 1 second, doubles after each attempt and stops growing at 30 seconds. A successful connection resets it to 1 second.
- **Ping**: The client sends `signalwire.ping` every 30 seconds. A ping that gets no response closes the connection like any other request, and so do 3 failed pings in a row. The client answers the server's pings.
- **Request timeout**: A request with no response in 30 seconds rejects with a `RelayError`, and the client closes the connection.
- **Request queueing**: A request made while the client is disconnected waits in a queue of up to 500 requests. The client sends the queue after the next successful authentication. Each queued request still times out after 30 seconds, and a full queue rejects new requests with a `RelayError`.
- **In-flight requests**: When the connection drops under `run()`, requests already sent are rejected with a `RelayError`. The client doesn't resend them.
- **Session resumption**: The client stores the protocol string and the latest `authorization_state` the server sends, and sends both back when it reconnects.
- **Server disconnect**: The client acknowledges a `signalwire.disconnect` request. When the request carries `restart: true`, the client clears the stored protocol and authorization state, so the next connection starts a new session.

## Concurrency

The client calls each inbound call handler without awaiting it, so handlers for different calls run concurrently on Node's event loop. Synchronous or CPU-bound work in a handler blocks every other call until it finishes.

The `maxActiveCalls` option (default 1000) caps the calls one client tracks, inbound and dialed. When the cap is reached, the client logs an error and ignores new inbound calls; your handler doesn't run for them. The client stops tracking a call when it reaches `ended`.

`RELAY_MAX_CONNECTIONS` (default 1) limits how many connected `RelayClient` instances one process may have. The SDK reads it once, when its module loads, so set it in the environment before your program starts.

## Error Handling

`RelayError` has a numeric `code`, a `serverMessage` with the server's text, and a `message` of the form `RELAY error <code>: <serverMessage>`. Catch it around calls that can fail:

```typescript
import { RelayError } from '@signalwire/sdk';

declare const call: import('@signalwire/sdk').Call; // a live relay Call
try {
  await call.play([{ type: 'tts', params: { text: 'Hello' } }]);
} catch (err) {
  if (err instanceof RelayError) {
    console.error(`Error ${err.code}: ${err.serverMessage}`);
  }
}
```

The client throws `RelayError` when the server returns a non-2xx result code or a JSON-RPC error, and uses code `-1` for timeouts and closed connections. `Call` methods treat 404 and 410 as "the call no longer exists": they log a warning and resolve with `{}` in place of throwing. Every other error code is thrown.

## Environment Variables

The client reads these variables in production:

| Variable | Purpose |
|----------|---------|
| `SIGNALWIRE_PROJECT_ID` | Default for `project` |
| `SIGNALWIRE_API_TOKEN` | Default for `token` |
| `SIGNALWIRE_JWT_TOKEN` | Default for `jwtToken` |
| `SIGNALWIRE_SPACE` | Default for `host` |
| `RELAY_MAX_ACTIVE_CALLS` | Default for `maxActiveCalls` |
| `RELAY_MAX_CONNECTIONS` | Connected clients allowed per process (default 1, minimum 1). Read once, when the SDK module loads. |
| `SIGNALWIRE_RELAY_CA_FILE` | Path to a CA bundle the WebSocket connection trusts in place of Node's default store. Read at each `connect()`; an unreadable file logs a warning and falls back to the default store. |

These variables exist for tests. Leave them unset in production:

| Variable | Purpose |
|----------|---------|
| `SIGNALWIRE_RELAY_HOST` | Overrides `SIGNALWIRE_SPACE` as the default host, for a local fixture |
| `SIGNALWIRE_RELAY_SCHEME` | Default for `scheme` (`ws` or `wss`) |
| `SIGNALWIRE_RELAY_PING_INTERVAL_MS` | Client ping interval (default 30000) |
| `SIGNALWIRE_RELAY_PING_MAX_FAILURES` | Ping failures before the client closes the connection (default 3) |
| `SIGNALWIRE_RELAY_REQUEST_TIMEOUT_MS` | Request timeout (default 30000) |
| `SIGNALWIRE_RELAY_RECONNECT_MIN_DELAY_S` | First reconnect delay in seconds (default 1) |
| `SIGNALWIRE_RELAY_RECONNECT_MAX_DELAY_S` | Longest reconnect delay in seconds (default 30) |

## Next Steps

Continue with these pages:

- [Getting Started](getting-started.md): connecting and placing a first call
- [Call Methods Reference](call-methods.md): the methods on a `Call` object
- [Events](events.md): handling real-time call events
- [Messaging](messaging.md): sending and receiving SMS/MMS
