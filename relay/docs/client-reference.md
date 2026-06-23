# RelayClient Reference

## Constructor

`RelayClient` takes a single options object:

```typescript
import { RelayClient } from '@signalwire/sdk';

const client = new RelayClient({
  project: 'your-project-id',     // SIGNALWIRE_PROJECT_ID
  token: 'your-api-token',        // SIGNALWIRE_API_TOKEN
  jwtToken: 'your-jwt',           // SIGNALWIRE_JWT_TOKEN (alternative auth)
  host: 'example.signalwire.com', // SIGNALWIRE_SPACE (default: relay.signalwire.com)
  contexts: ['default'],          // topics to subscribe to
  maxActiveCalls: 1000,           // RELAY_MAX_ACTIVE_CALLS (default: 1000)
});
```

Authentication requires either `project` + `token` or `jwtToken` (no server roundtrip). All options fall back to their corresponding environment variables when omitted.

## Methods

### `run()`

Blocking entry point. Connects, authenticates, and maintains the connection with auto-reconnect until interrupted (`SIGINT` / `SIGTERM`).

```typescript
client.run();
```

### `connect()` / `disconnect()`

Manual lifecycle control.

```typescript
await client.connect();
// ... use client ...
await client.disconnect();
```

`RelayClient` is also an async-disposable for use with `await using` (auto-disconnects at end of scope):

```typescript
await using client = new RelayClient({ contexts: ['default'] });
await client.connect();
// ...
```

### `onCall(handler)`

Register the inbound call handler. The handler receives a `Call` object and may be async.

```typescript
client.onCall(async (call) => {
  await call.answer();
});
```

### `dial(devices, options?)`

Place an outbound call. Returns a `Call` once the remote party answers.

- `devices` -- nested array of device objects (serial/parallel dial)
- `options.tag` -- optional correlation tag (auto-generated if omitted)
- `options.maxDuration` -- max call duration in minutes
- `options.dialTimeout` -- seconds to wait before rejecting (default: 120)

```typescript
const call = await client.dial(
  [[{ type: 'phone', to: '+15551234567', from: '+15559876543' }]],
  { dialTimeout: 30 },
);
```

### `onMessage(handler)`

Register the inbound message handler. The handler receives a `Message` object and may be async.

```typescript
client.onMessage(async (message) => {
  console.log(`SMS from ${message.fromNumber}: ${message.body}`);
});
```

### `onEvent(handler)`

Register a low-level observer that fires for every inbound `signalwire.event`, regardless of type. Most code wants `onCall` / `onMessage` instead — `onEvent` is the generic escape hatch. The handler receives `(eventType, params)`.

```typescript
client.onEvent((eventType, params) => {
  console.log(`event: ${eventType}`);
});
```

### `sendMessage(options)`

Send an outbound SMS/MMS. Takes an options object with `toNumber`, `fromNumber`, and `body` / `media`. Returns a `Message` that tracks delivery state.

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello!',
});
await message.wait(); // block until delivered/failed
```

See [Messaging](messaging.md) for full details.

### `execute(method, params)`

Send a raw JSON-RPC request. Used internally by Call methods, but available for custom commands.

```typescript
await client.execute('calling.play', { /* ... */ });
```

### `receive(contexts)` / `unreceive(contexts)`

Dynamically subscribe to or unsubscribe from contexts after connecting.

```typescript
await client.receive(['new-context']);
await client.unreceive(['old-context']);
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `relayProtocol` | `string` | Server-assigned protocol string from the connect response |
| `project` | `string` | Project ID |
| `token` | `string` | API token |
| `jwtToken` | `string` | JWT token (if used) |
| `host` | `string` | Relay host |
| `scheme` | `'ws' \| 'wss'` | WebSocket scheme |
| `contexts` | `string[]` | Initial contexts |

## Connection Behavior

- **Auto-reconnect**: On connection loss, the client reconnects with exponential backoff (1s to 30s).
- **Ping/pong**: The client sends periodic pings and monitors server pings. After 3 consecutive failures, the connection is force-closed and reconnected.
- **Request queueing**: Requests made while disconnected are queued and sent after re-authentication.
- **Authorization state**: The server sends auth state via events. On reconnect, this is sent back for fast re-authentication without a full auth roundtrip.
- **Server disconnect**: The server can request a graceful disconnect (e.g. during deployment). The client auto-reconnects afterward.

## Concurrency

Each inbound call handler runs independently, so multiple calls are handled concurrently. The `maxActiveCalls` option (default: 1000) caps concurrent calls to prevent unbounded memory growth.

For multiple WebSocket connections in one process, set `RELAY_MAX_CONNECTIONS` (default: 1).

## Error Handling

```typescript
import { RelayError } from '@signalwire/sdk';

try {
  await call.play([{ type: 'tts', params: { text: 'Hello' } }]);
} catch (err) {
  if (err instanceof RelayError) {
    console.error(`Error ${err.code}: ${err.message}`);
  }
}
```

`RelayError` is thrown when the server returns a non-2xx response code. Errors 404 and 410 (call gone) are silently swallowed by Call methods since the call no longer exists.

## Next Steps

- [Getting Started](getting-started.md) -- connecting and your first call
- [Call Methods Reference](call-methods.md) -- all methods available on a Call object
- [Events](events.md) -- handling real-time call events
- [Messaging](messaging.md) -- sending and receiving SMS/MMS
