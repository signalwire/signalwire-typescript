# Messaging

Send and receive SMS/MMS messages through the RELAY client.

## Sending Messages

Use `client.sendMessage()` to send an outbound SMS or MMS. It takes an options object and returns a `Message` that tracks delivery state.

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello from SignalWire!',
});
```

### Wait for delivery

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello!',
});

await message.wait(); // blocks until delivered/failed
console.log(`Final state: ${message.state}`);
if (message.reason) {
  console.log(`Reason: ${message.reason}`);
}
```

`wait()` accepts an optional timeout in **seconds**:

```typescript
await message.wait(30); // throws if no terminal state within 30s
```

### Fire and forget

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello!',
});
// don't call message.wait() — continue immediately
```

### Callback on completion

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello!',
  onCompleted: (event) => console.log(`Delivery: ${event.params.message_state}`),
});
```

### MMS (media messages)

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Check this out!',
  media: ['https://example.com/image.jpg'],
});
```

### All options

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',     // required — E.164 format
  fromNumber: '+15551111111',   // required — E.164 format
  body: 'Message text',         // required if no media
  media: ['https://...'],       // required if no body
  context: 'my_context',        // context for state events (default: relay protocol)
  tags: ['vip', 'support'],     // optional tags for searching in the dashboard
  region: 'us',                 // optional origination region
  onCompleted: (event) => {},   // optional completion callback
});
```

## Receiving Messages

Register a handler with `client.onMessage()` to receive inbound SMS/MMS.

```typescript
import { RelayClient } from '@signalwire/sdk';

const client = new RelayClient({
  project: 'your-project-id',
  token: 'your-api-token',
  host: 'example.signalwire.com',
  contexts: ['default'],
});

client.onMessage(async (message) => {
  console.log(`From: ${message.fromNumber}`);
  console.log(`To: ${message.toNumber}`);
  console.log(`Body: ${message.body}`);
  if (message.media.length) {
    console.log(`Media: ${message.media}`);
  }

  // Reply back
  await client.sendMessage({
    toNumber: message.fromNumber,
    fromNumber: message.toNumber,
    body: `You said: ${message.body}`,
  });
});

client.run();
```

## Message Object

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `messageId` | `string` | Unique message identifier |
| `context` | `string` | Context the message belongs to |
| `direction` | `string` | `inbound` or `outbound` |
| `fromNumber` | `string` | Sender phone number (E.164) |
| `toNumber` | `string` | Recipient phone number (E.164) |
| `body` | `string` | Text body of the message |
| `media` | `string[]` | Media URLs (MMS) |
| `segments` | `number` | Number of message segments |
| `state` | `string` | Current message state |
| `reason` | `string` | Failure reason (on `undelivered` or `failed`) |
| `tags` | `string[]` | Tags attached to the message |
| `isDone` | `boolean` | `true` if message reached a terminal state |
| `isTerminal` | `boolean` | `true` if `state` is a terminal delivery outcome |
| `result` | `RelayEvent \| null` | Terminal event (or `null` if not done) |

### Methods

| Method | Description |
|--------|-------------|
| `await message.wait(timeout?)` | Block until terminal state (timeout in **seconds**). Returns the terminal `RelayEvent`. |
| `message.on(handler)` | Register a listener for state-change events. |

### Message States

Outbound messages progress through these states:

| State | Description |
|-------|-------------|
| `queued` | Message accepted and queued for sending |
| `initiated` | Sending has started |
| `sent` | Message sent to carrier |
| `delivered` | Message delivered to recipient (terminal) |
| `undelivered` | Delivery failed (terminal) — check `reason` |
| `failed` | Message failed to send (terminal) — check `reason` |

Inbound messages always arrive with state `received`.

## Event Types

| Event | Description |
|-------|-------------|
| `MessageReceiveEvent` | Inbound message received |
| `MessageStateEvent` | Outbound message state change |

```typescript
import { MessageReceiveEvent, MessageStateEvent } from '@signalwire/sdk';
```

## Combining Calls and Messages

The same `RelayClient` handles both calls and messages:

```typescript
const client = new RelayClient({ project: '...', token: '...', contexts: ['default'] });

client.onCall(async (call) => {
  await call.answer();
  await call.play([{ type: 'tts', params: { text: 'Hello!' } }]);
  await call.hangup();
});

client.onMessage(async (message) => {
  console.log(`SMS from ${message.fromNumber}: ${message.body}`);
});

client.run();
```

## Next Steps

- [Client Reference](client-reference.md) -- RelayClient configuration and methods
- [Events](events.md) -- handling real-time call and message events
- [Getting Started](getting-started.md) -- connecting and your first call
