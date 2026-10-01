# Events

RELAY events are notifications the platform pushes about call state and operation results. They arrive over the WebSocket as `signalwire.event` JSON-RPC messages. The client acknowledges each one, then routes it to the matching `Call`, `Message` or dial in progress.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context the fragments on this page assume (constructed in the Getting Started example).
declare const client: import('@signalwire/sdk').RelayClient;
declare const call: import('@signalwire/sdk').Call; // a live relay Call
declare const rawPayload: Record<string, unknown>; // the params of a signalwire.event message: { event_type, params }
```

## Listening for Events

You can receive events on a call, through an action, or for the whole client.

### On a Call

Register a listener with `call.on()`, or wait for one event with `call.waitFor()`:

```typescript
client.onCall(async (call) => {
  // Register a listener
  call.on('calling.call.play', (event) => console.log(`Play: ${JSON.stringify(event.params)}`));

  // Or wait for a specific event (timeout in milliseconds)
  const event = await call.waitFor(
    'calling.call.state',
    (e) => e.params.call_state === 'ended',
    60_000,
  );
});
```

The client routes an event to a call's listeners when the event's `params.call_id` matches a call it tracks. It handles `calling.call.receive`, `calling.call.dial` and the messaging events separately, so `call.on()` doesn't receive them. A `calling.call.dial` event that arrives after `dial()` has resolved is the exception, and goes to the answered call.

### Via Actions

Actions returned by `play()`, `record()` and the other action methods have a `wait()` method that resolves with the terminal event:

```typescript
const action = await call.play([{ type: 'tts', params: { text: 'Hello' } }]);
const event = await action.wait(30); // timeout in seconds
// event is the terminal event for this action
```

### For Every Event

`client.onEvent()` registers one observer that receives every `signalwire.event`, as `(eventType, params)` with the raw params. It runs before the client's own routing, and sees events that match no tracked call:

```typescript
client.onEvent((eventType, params) => {
  if (eventType === 'calling.conference') {
    console.log(`Conference event: ${JSON.stringify(params)}`);
  }
});
```

## Event Types

These event-type constants are exported from `@signalwire/sdk`:

| Constant | Value | Description |
|----------|-------|-------------|
| `EVENT_CALL_STATE` | `calling.call.state` | Call state changes (created, ringing, answered, ending, ended) |
| `EVENT_CALL_RECEIVE` | `calling.call.receive` | Inbound call notification |
| `EVENT_CALL_PLAY` | `calling.call.play` | Play operation state changes |
| `EVENT_CALL_RECORD` | `calling.call.record` | Record operation state changes |
| `EVENT_CALL_COLLECT` | `calling.call.collect` | Input collection results |
| `EVENT_CALL_CONNECT` | `calling.call.connect` | Bridge/connect state changes |
| `EVENT_CALL_DETECT` | `calling.call.detect` | Detection results |
| `EVENT_CALL_FAX` | `calling.call.fax` | Fax operation state changes |
| `EVENT_CALL_TAP` | `calling.call.tap` | Tap operation state changes |
| `EVENT_CALL_STREAM` | `calling.call.stream` | Stream operation state changes |
| `EVENT_CALL_SEND_DIGITS` | `calling.call.send_digits` | DTMF send completion |
| `EVENT_CALL_DIAL` | `calling.call.dial` | Outbound dial progress |
| `EVENT_CALL_REFER` | `calling.call.refer` | SIP REFER results |
| `EVENT_CALL_DENOISE` | `calling.call.denoise` | Denoise state changes |
| `EVENT_CALL_PAY` | `calling.call.pay` | Payment state changes |
| `EVENT_CALL_QUEUE` | `calling.call.queue` | Queue state changes |
| `EVENT_CALL_ECHO` | `calling.call.echo` | Echo state changes |
| `EVENT_CALL_TRANSCRIBE` | `calling.call.transcribe` | Transcription state changes |
| `EVENT_CALL_HOLD` | `calling.call.hold` | Hold/unhold state changes |
| `EVENT_CONFERENCE` | `calling.conference` | Conference state changes |
| `EVENT_CALLING_ERROR` | `calling.error` | Error events |
| `EVENT_MESSAGING_RECEIVE` | `messaging.receive` | Inbound message received |
| `EVENT_MESSAGING_STATE` | `messaging.state` | Outbound message state change |

The client also handles `signalwire.authorization.state` internally, to store the state it sends back on reconnect. The SDK has no constant or typed class for `calling.call.ai`, the event type `AIAction` is declared with; such events arrive as a plain `RelayEvent`.

## Typed Event Classes

`parseEvent()` takes the `params` object of a `signalwire.event` message, which holds `event_type` and the event's own `params`. It returns an instance of the class for that `event_type`, or a plain `RelayEvent` for a type with no class. The typed classes add camelCase properties for the event's fields:

<!-- snippet: no-run illustrative fragment: references the assumed `rawPayload` object established by the surrounding handler example -->
```typescript
import { CallStateEvent, parseEvent } from '@signalwire/sdk';

// Parse by event type
const event = parseEvent(rawPayload);
if (event instanceof CallStateEvent) {
  console.log(event.callState); // for example, "answered"
  console.log(event.endReason); // set when callState is "ended"
}

// Or build one class directly
const stateEvent = CallStateEvent.fromPayload(rawPayload);
```

The events that `call.on()` listeners, `call.waitFor()` and `action.wait()` deliver come from `parseEvent()`, so you can check them with `instanceof`. `Message` listeners and `message.wait()` receive a plain `RelayEvent`.

### Available Typed Events

Each class reads these properties from the event's `params`:

| Class | Properties |
|-------|------------|
| `CallStateEvent` | `callState`, `endReason`, `direction`, `device` |
| `CallReceiveEvent` | `callState`, `direction`, `device`, `nodeId`, `projectId`, `context`, `segmentId`, `tag` |
| `PlayEvent` | `controlId`, `state` |
| `RecordEvent` | `controlId`, `state`, `url`, `duration`, `size`, `record` |
| `CollectEvent` | `controlId`, `state`, `result`, `final` |
| `ConnectEvent` | `connectState`, `peer` |
| `DetectEvent` | `controlId`, `detect` |
| `FaxEvent` | `controlId`, `fax` |
| `TapEvent` | `controlId`, `state`, `tap`, `device` |
| `StreamEvent` | `controlId`, `state`, `url`, `name` |
| `SendDigitsEvent` | `controlId`, `state` |
| `DialEvent` | `tag`, `dialState`, `call` |
| `ReferEvent` | `state`, `sipReferTo`, `sipReferResponseCode`, `sipNotifyResponseCode` |
| `DenoiseEvent` | `denoised` |
| `PayEvent` | `controlId`, `state` |
| `QueueEvent` | `controlId`, `status`, `queueId`, `queueName`, `position`, `size` |
| `EchoEvent` | `state` |
| `TranscribeEvent` | `controlId`, `state`, `url`, `recordingId`, `duration`, `size` |
| `HoldEvent` | `state` |
| `ConferenceEvent` | `conferenceId`, `name`, `status` |
| `CallingErrorEvent` | `code`, `message` |
| `MessageReceiveEvent` | `messageId`, `context`, `direction`, `fromNumber`, `toNumber`, `body`, `media`, `segments`, `messageState`, `tags` |
| `MessageStateEvent` | `messageId`, `context`, `direction`, `fromNumber`, `toNumber`, `body`, `media`, `segments`, `messageState`, `reason`, `tags` |

Most properties map to the `snake_case` field of the same name. These don't:

- `RecordEvent.url`, `duration` and `size` read `params.record.*` first, then `params.*`.
- `QueueEvent.queueId` and `queueName` read `params.id` and `params.name`.
- `CallReceiveEvent.context` reads `params.context`, then `params.protocol`.

A missing field becomes `''`, `0`, `{}` or `[]`, depending on its type. `CollectEvent.final` is `undefined` when the event doesn't carry it.

`EVENT_CLASS_MAP` maps each event-type string to its class. Every typed event also has the base `RelayEvent` fields: `eventType`, `params`, `callId` and `timestamp`. `params` is the raw object, with the platform's `snake_case` names, and `timestamp` comes from `params.timestamp` (`0` when absent).

## Call States

A call moves through these states in order:

```text
created -> ringing -> answered -> ending -> ended
```

The constants are `CALL_STATE_CREATED`, `CALL_STATE_RINGING`, `CALL_STATE_ANSWERED`, `CALL_STATE_ENDING` and `CALL_STATE_ENDED`. The `CallState` type is the union of these values. `isCallStateTerminal(state)` and `call.isTerminal` test for `ended`, the only terminal state.

An outbound dial has its own states, in `DialEvent.dialState`: `dialing`, then `answered` or `failed`. The `DialState` type and `isDialStateTerminal()` cover them.

## End Reasons

When a call reaches `ended`, `CallStateEvent.endReason` holds the `end_reason` the platform sent. The SDK's constants list these values; the package doesn't export constants for them:

| Reason | Description |
|--------|-------------|
| `hangup` | Normal hangup |
| `cancel` | Caller cancelled |
| `busy` | Destination busy |
| `noAnswer` | No answer |
| `decline` | Call declined |
| `error` | Error occurred |
| `abandoned` | Call abandoned |
| `max_duration` | Max duration reached |
| `not_found` | Destination not found |

## Message States

Outbound messages move through `queued`, `initiated` and `sent`, and end at `delivered`, `undelivered` or `failed`. Inbound messages arrive with state `received`.

The constants are `MESSAGE_STATE_QUEUED`, `MESSAGE_STATE_INITIATED`, `MESSAGE_STATE_SENT`, `MESSAGE_STATE_DELIVERED`, `MESSAGE_STATE_UNDELIVERED`, `MESSAGE_STATE_FAILED` and `MESSAGE_STATE_RECEIVED`. The `MessageState` type is their union, and `isMessageStateTerminal()` tests for the three terminal states.

## Next Steps

Continue with these pages:

- [Call Methods Reference](call-methods.md): the methods on a `Call` object
- [Client Reference](client-reference.md): `RelayClient` options and methods
- [Messaging](messaging.md): sending and receiving SMS/MMS
