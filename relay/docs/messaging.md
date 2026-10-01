# Messaging

The RELAY client sends and receives SMS and MMS messages over the same connection it uses for calls. This page covers sending, tracking delivery, receiving and the `Message` object.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context: `client` is a constructed RelayClient (the full programs on this page build their own inside main()).
declare const client: import('@signalwire/sdk').RelayClient;
```

## Sending Messages

Use `client.sendMessage()` to send an outbound SMS or MMS. It takes an options object and resolves with a `Message` that tracks delivery state:

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello from SignalWire!',
});
```

`sendMessage()` resolves once the platform accepts the `messaging.send` request. The returned `Message` starts in state `queued`.

### Wait for delivery

Await `message.wait()` to pause until the message reaches `delivered`, `undelivered` or `failed`:

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello!',
});

await message.wait(); // resolves at delivered, undelivered or failed
console.log(`Final state: ${message.state}`);
if (message.reason) {
  console.log(`Reason: ${message.reason}`);
}
```

`wait()` accepts an optional timeout in **seconds**, and rejects with an `Error` when it passes:

<!-- snippet: no-run illustrative fragment: references the assumed `message` object established earlier on the page -->
```typescript
declare const message: import('@signalwire/sdk').Message;
await message.wait(30); // rejects if no terminal state within 30 seconds
```

### Continue without waiting

Skip `wait()` to continue immediately. The client keeps updating the message's `state` as events arrive:

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello!',
});
// don't call message.wait(); continue immediately
```

### Run a callback on completion

Pass `onCompleted` to run a function when the message reaches a terminal state:

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Hello!',
  onCompleted: (event) => console.log(`Delivery: ${event.params.message_state}`),
});
```

The callback may be sync or async, and the SDK logs its errors.

### MMS (media messages)

Pass `media` with one or more URLs to send an MMS:

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',
  fromNumber: '+15551111111',
  body: 'Check this out!',
  media: ['https://example.com/image.jpg'],
});
```

### All options

`sendMessage()` accepts these options:

```typescript
const message = await client.sendMessage({
  toNumber: '+15552222222',     // required, E.164 format
  fromNumber: '+15551111111',   // required, E.164 format
  body: 'Message text',         // required if no media
  media: ['https://example.com/image.jpg'], // required if no body
  context: 'my_context',        // context for state events (default: the client's relay protocol, or 'default' before it has one)
  tags: ['vip', 'support'],     // tags attached to the message
  region: 'us',                 // origination region
  onCompleted: (event) => {},   // completion callback
});
```

`sendMessage()` throws an `Error` when both `body` and `media` are missing. The SDK doesn't validate the phone number format.

## Receiving Messages

Register a handler with `client.onMessage()` to receive inbound SMS and MMS on the contexts the client subscribes to. This program replies to every message it receives:

<!-- snippet: no-run client.run() opens a live WebSocket to SIGNALWIRE_SPACE and runs until SIGINT/SIGTERM; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient } from '@signalwire/sdk';

async function main() {
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
      console.log(`Media: ${message.media.join(', ')}`);
    }

    // Reply
    await client.sendMessage({
      toNumber: message.fromNumber,
      fromNumber: message.toNumber,
      body: `You said: ${message.body}`,
    });
  });

  await client.run();
}

await main();
```

An inbound message arrives in state `received` and gets no further state events, so don't call `wait()` on it: its promise never settles.

## Message Object

### Properties

A `Message` has these properties:

| Property | Type | Description |
|----------|------|-------------|
| `messageId` | `string` | Message identifier assigned by the platform |
| `context` | `string` | Context the message belongs to |
| `direction` | `string` | `inbound` or `outbound` |
| `fromNumber` | `string` | Sender phone number (E.164) |
| `toNumber` | `string` | Recipient phone number (E.164) |
| `body` | `string` | Text body of the message |
| `media` | `string[]` | Media URLs (MMS) |
| `segments` | `number` | Number of segments, from the inbound event (`0` for outbound messages) |
| `state` | `MessageState` | Current message state |
| `reason` | `string` | Failure reason the platform sent with a state event, for example with `undelivered` or `failed` |
| `tags` | `string[]` | Tags attached to the message |
| `isDone` | `boolean` | `true` once the message has reached a terminal state through a state event |
| `isTerminal` | `boolean` | `true` when `state` is `delivered`, `undelivered` or `failed` |
| `result` | `RelayEvent \| null` | The terminal event, or `null` before one arrives |

For an outbound message, the client updates only `state` and `reason` from the platform's events. The other properties hold the values you sent.

### Methods

A `Message` has these methods:

| Method | Description |
|--------|-------------|
| `await message.wait(timeout?)` | Resolves with the terminal `messaging.state` event. `timeout` is in **seconds**. |
| `message.on(handler)` | Registers a listener that runs for every `messaging.state` event for this message |
| `message.toString()` | Returns `Message(id=..., direction=..., state=..., from=..., to=...)` for logging |

`wait()`, `on()` listeners and `onCompleted` receive a plain `RelayEvent`; read the raw fields from `event.params`.

### Message States

Outbound messages move through these states:

| State | Description |
|-------|-------------|
| `queued` | Message accepted and queued for sending |
| `initiated` | Sending has started |
| `sent` | Message sent to carrier |
| `delivered` | Message delivered to recipient (terminal) |
| `undelivered` | Delivery failed (terminal); check `reason` |
| `failed` | Message failed to send (terminal); check `reason` |

Inbound messages arrive with state `received`.

## Event Types

The typed classes for messaging events are `MessageReceiveEvent` (`messaging.receive`) and `MessageStateEvent` (`messaging.state`). `parseEvent()` builds them from raw payloads; the `Message` API itself doesn't use them. Import them from the package:

```typescript
import { MessageReceiveEvent, MessageStateEvent } from '@signalwire/sdk';
```

## Combining Calls and Messages

One `RelayClient` handles both calls and messages:

<!-- snippet: no-run client.run() opens a live WebSocket to SIGNALWIRE_SPACE and runs until SIGINT/SIGTERM; it can't reach the loopback mock standalone -->
```typescript
import { RelayClient } from '@signalwire/sdk';

async function main() {
  const client = new RelayClient({ project: 'your-project-id', token: 'your-api-token', contexts: ['default'] });

  client.onCall(async (call) => {
    await call.answer();
    const action = await call.play([{ type: 'tts', params: { text: 'Hello!' } }]);
    await action.wait();
    await call.hangup();
  });

  client.onMessage(async (message) => {
    console.log(`SMS from ${message.fromNumber}: ${message.body}`);
  });

  await client.run();
}

await main();
```

## Next Steps

Continue with these pages:

- [Client Reference](client-reference.md): `RelayClient` options and methods
- [Events](events.md): handling real-time call and message events
- [Getting Started](getting-started.md): connecting and placing a first call
