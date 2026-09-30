# RELAY Client Guide

The RELAY client controls live calls and messages over a persistent WebSocket connection to SignalWire. An agent built on `AgentBase` answers HTTP requests from the platform. A RELAY client holds the connection open instead: it receives events as they happen and sends commands for a call in progress. This guide shows the common tasks and links to the reference pages for the details.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context the fragments on this page assume.
declare const client: import('@signalwire/sdk').RelayClient;
declare const call: import('@signalwire/sdk').Call;
```

## Authentication

Pass the project ID, API token and space hostname to the constructor, along with the contexts to subscribe to:

```typescript
import { RelayClient } from '@signalwire/sdk';

function makeClient() {
  return new RelayClient({
    project: 'your-project-id',    // or env: SIGNALWIRE_PROJECT_ID
    token: 'your-api-token',       // or env: SIGNALWIRE_API_TOKEN
    host: 'your-space.signalwire.com', // or env: SIGNALWIRE_SPACE
    contexts: ['office', 'support'],
  });
}
```

Each credential falls back to an environment variable when you omit it:

- `SIGNALWIRE_PROJECT_ID`: your SignalWire project ID
- `SIGNALWIRE_API_TOKEN`: your SignalWire API token, or `SIGNALWIRE_JWT_TOKEN` for JWT authentication
- `SIGNALWIRE_SPACE`: your space hostname

## Handling Inbound Calls

Register a handler with `onCall()`, then start the client with `run()`:

<!-- snippet: no-run client.run() opens a live WebSocket to SIGNALWIRE_SPACE and runs until SIGINT/SIGTERM; it can't reach the loopback mock standalone -->
```typescript
client.onCall(async (call) => {
  console.log(`Inbound call: ${call.callId}`);

  await call.answer();

  const action = await call.play([
    { type: 'tts', params: { text: 'Thanks for calling.' } },
  ]);
  await action.wait();

  await call.hangup();
});

// Connect, and reconnect after dropped connections, until SIGINT/SIGTERM
await client.run();
```

## Making Outbound Calls

Connect the client, then call `dial()` with a nested array of devices. It resolves with a `Call` once a device answers:

```typescript
async function placeCall() {
  await client.connect();

  const call = await client.dial(
    [[{ type: 'phone', to: '+15551234567', from: '+15559876543' }]],
    { dialTimeout: 30 }, // seconds
  );

  console.log(`Call answered: ${call.callId}`);
  const action = await call.play([{ type: 'tts', params: { text: 'Hello from RELAY.' } }]);
  await action.wait();
  await call.hangup();
}
```

### How dial() Finds the Call

`dial()` doesn't read a call ID from the `calling.dial` response. It tags the request, then waits for a `calling.call.dial` event with that tag and a `dial_state` of `answered`. At that point it resolves with a `Call` built from the event. A `failed` dial state, the `dialTimeout` passing, or a closed connection rejects it with a `RelayError`.

## Call Methods

The [Call Methods Reference](call-methods.md) documents every method. This section shows the common ones.

### Lifecycle

A call has these lifecycle methods:

- `call.answer()`: answer an inbound call
- `call.hangup(reason?)`: end the call
- `call.pass()`: decline control and return the call to routing

### Audio Playback

`play()` takes a list of media items and returns a `PlayAction` you can control or wait on:

```typescript
const action = await call.play([
  { type: 'tts', params: { text: 'Hello world', language: 'en-US' } },
  { type: 'audio', params: { url: 'https://example.com/greeting.mp3' } },
  { type: 'silence', params: { duration: 2 } },
]);

// Control playback
await action.pause();
await action.resume();
await action.volume(-3);

// Wait for playback to finish
const event = await action.wait();
```

The SDK also accepts a flat form, `{ type: 'tts', text: 'Hello world' }`, and nests the fields under `params` for you.

### Recording

`record()` returns a `RecordAction`. After it completes, `RecordEvent.url` holds the recording URL:

```typescript
import { RecordEvent } from '@signalwire/sdk';

const action = await call.record({ format: 'mp3' });
// ... later
await action.stop();
const event = await action.wait();
if (event instanceof RecordEvent) {
  console.log(`Recording URL: ${event.url}`);
}
```

### Input Collection

`playAndCollect()` plays a prompt and collects input; `collect()` collects without a prompt:

```typescript
// Play and collect (combined)
const action = await call.playAndCollect(
  [{ type: 'tts', params: { text: 'Enter your PIN.' } }],
  { digits: { max: 4, terminators: '#' } },
);
const event = await action.wait();

// Standalone collect (no media)
const collectAction = await call.collect({
  speech: { end_silence_timeout: 2 },
});
```

### Detection

`detect()` returns a `DetectAction`, which resolves on the first detection result:

```typescript
const action = await call.detect(
  { type: 'machine', params: { initial_timeout: 5 } },
  { timeout: 10 },
);
const event = await action.wait();
// DetectAction resolves on the first event with a detect result, or on finished/error
```

`detectAnsweringMachine()`, `detectDigit()` and `detectFax()` build the `detect` object for you.

### Connectivity

A call has these methods for bridging and transfers:

- `call.connect(devices, options?)`: bridge to another endpoint
- `call.disconnect()`: unbridge a connected call
- `call.transfer(dest, extra?)`: transfer control to another RELAY app or SWML script
- `call.refer(device, options?)`: transfer a SIP call with SIP REFER

### Other Methods

A call also has these methods:

- `call.sendDigits(digits)`: send DTMF
- `call.hold()` / `call.unhold()`: put the call on hold, or take it off hold
- `call.denoise()` / `call.denoiseStop()`: start or stop noise reduction
- `call.joinConference(name, options?)` / `call.leaveConference(conferenceId)`: join or leave a conference
- `call.joinRoom(name, options?)` / `call.leaveRoom()`: join or leave a room
- `call.stream(url, options?)`: stream audio to a WebSocket
- `call.tap(tap, device, options?)`: copy media to an RTP or WebSocket endpoint
- `call.transcribe(options?)`: start transcription
- `call.liveTranscribe(action)` / `call.liveTranslate(action, options?)`: start or stop live transcription or translation
- `call.pay(paymentConnectorUrl, options?)`: collect a payment
- `call.sendFax(document, options?)` / `call.receiveFax(options?)`: send or receive a fax
- `call.ai(options?)`: start an AI agent session
- `call.queueEnter(queueName)` / `call.queueLeave(queueName)`: enter or leave a queue
- `call.bindDigit(digits, bindMethod, options?)` / `call.clearDigitBindings(realm?)`: bind DTMF sequences to RELAY methods
- `call.echo(options?)`: echo audio back, for testing

## Actions

Methods for long-running operations return an `Action` that tracks the operation's lifecycle:

```typescript
const action = await call.play([{ type: 'tts', params: { text: 'Hello' } }]);

// Check status
console.log(action.completed); // false until the terminal event arrives

// Wait for completion, with a timeout in seconds
const event = await action.wait(10);

// Or continue without waiting, and handle completion in a callback
await call.play(
  [{ type: 'tts', params: { text: 'Background music' } }],
  {
    onCompleted: (event) => console.log('Playback finished'),
  },
);
```

`action.wait()` takes its timeout in seconds, while `call.waitFor()` and the `call.waitFor*()` helpers take milliseconds.

### Action Types

Each action class has these methods, and completes on these states:

| Action | Methods | Terminal States |
|--------|---------|----------------|
| `PlayAction` | stop, pause, resume, volume | finished, error |
| `RecordAction` | stop, pause, resume | finished, no_input |
| `DetectAction` | stop | finished, error, or the first detect result |
| `CollectAction` | stop, pause, resume, volume, startInputTimers | finished, error, no_input, no_match, or a result |
| `StandaloneCollectAction` | stop, startInputTimers | finished, error, no_input, no_match, or a result |
| `FaxAction` | stop | finished, error |
| `TapAction` | stop | finished |
| `StreamAction` | stop | finished |
| `PayAction` | stop | finished, error |
| `TranscribeAction` | stop | finished |
| `AIAction` | stop | finished, error |

## Event Listening

Listen on a call with `call.on()`, or wait for one event with `call.waitFor()`:

```typescript
// Listen for specific events on a call
call.on('calling.call.play', (event) => {
  console.log(`Play state: ${event.params.state}`);
});

// Wait for a specific event (timeout in milliseconds)
const event = await call.waitFor('calling.call.state',
  (e) => e.params.call_state === 'answered',
  10_000,
);

// Wait for the call to end (timeout in milliseconds)
const endEvent = await call.waitForEnded(60_000);
```

## Messaging

`sendMessage()` sends an SMS or MMS, and `onMessage()` receives them:

```typescript
// Send SMS
const message = await client.sendMessage({
  toNumber: '+15551234567',
  fromNumber: '+15559876543',
  body: 'Hello from RELAY.',
});

// Track delivery (timeout in seconds)
const event = await message.wait(30);
console.log(`State: ${message.state}`); // delivered, undelivered or failed

// Receive inbound messages
client.onMessage(async (message) => {
  console.log(`From ${message.fromNumber}: ${message.body}`);
});
```

For more information, see [Messaging](messaging.md).

## Reconnection

`run()` reconnects after a dropped connection, with exponential backoff:

<!-- snippet: no-run client.run() opens a live WebSocket to SIGNALWIRE_SPACE and runs until SIGINT/SIGTERM; it can't reach the loopback mock standalone -->
```typescript
await client.run(); // resolves after SIGINT/SIGTERM shuts the client down
```

Reconnection works like this:

- The first delay is 1 second.
- The delay doubles after each attempt, up to 30 seconds.
- On each reconnect, the client sends back the protocol string and authorization state it stored from the server.
- Requests made while the client is disconnected wait in a queue and go out after it authenticates again. Requests already sent when the connection dropped are rejected.
- `SIGINT` or `SIGTERM` shuts the client down cleanly.

A client started with `connect()` doesn't reconnect by itself. Use `connect()` and `disconnect()` when your own code manages the connection:

```typescript
await client.connect();
// ... use client
await client.disconnect();
```

## Dynamic Context Subscription

Change the contexts a connected client subscribes to with `receive()` and `unreceive()`:

```typescript
await client.connect();

// Subscribe to new contexts at runtime
await client.receive(['sales', 'support']);

// Unsubscribe
await client.unreceive(['sales']);
```

## Error Handling

Catch `RelayError` for failed commands. Its `serverMessage` holds the server's text, and `message` already includes the code:

```typescript
import { RelayError } from '@signalwire/sdk';

try {
  await call.answer();
} catch (err) {
  if (err instanceof RelayError) {
    console.error(`RELAY error ${err.code}: ${err.serverMessage}`);
  }
}
```

### Call-Gone Handling

When the platform answers 404 or 410, the call no longer exists. `Call` methods then resolve with `{}` in place of throwing, and an action method returns an action that has already completed, so `await action.wait()` doesn't hang:

```typescript
const action = await call.play([{ type: 'tts', params: { text: 'hello' } }]);
// If the call ended before the platform handled the request, action.completed is true
```

When `call.state` is already `ended`, action methods skip the request and return a completed action.

## Typed Events

Events that reach `call.on()` listeners are instances of typed classes, which you can check with `instanceof`:

```typescript
import { CallStateEvent } from '@signalwire/sdk';

call.on('calling.call.state', (event) => {
  if (event instanceof CallStateEvent) {
    console.log(event.callState);  // 'answered', 'ended', etc.
    console.log(event.endReason);  // 'hangup', 'busy', etc.
  }
});
```

[Events](events.md) lists the typed event classes and their properties.

## Environment Variables

The client reads these variables:

| Variable | Purpose |
|----------|---------|
| `SIGNALWIRE_PROJECT_ID` | Project ID for authentication |
| `SIGNALWIRE_API_TOKEN` | API token for authentication |
| `SIGNALWIRE_JWT_TOKEN` | JWT (alternative to project and token) |
| `SIGNALWIRE_SPACE` | Space hostname (default: `relay.signalwire.com`) |
| `RELAY_MAX_ACTIVE_CALLS` | Maximum calls one client tracks (default 1000) |
| `RELAY_MAX_CONNECTIONS` | Maximum connected clients per process (default 1) |
| `SIGNALWIRE_RELAY_CA_FILE` | CA bundle for the WebSocket connection's TLS |
| `SIGNALWIRE_LOG_LEVEL` | Log level: `debug`, `info`, `warn`, `error` |
| `SIGNALWIRE_LOG_MODE` | Set to `off` to turn off logging |

## Examples

The `relay/examples/` directory has these programs:

- [relay-inbound.ts](../examples/relay-inbound.ts): answer calls, play TTS, collect digits
- [relay-outbound.ts](../examples/relay-outbound.ts): dial out, detect an answering machine, play a message
- [relay-messaging.ts](../examples/relay-messaging.ts): send and receive SMS
