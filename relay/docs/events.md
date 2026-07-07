# Events

RELAY events are server-pushed notifications about call state changes and operation results. Events arrive over the WebSocket as `signalwire.event` JSON-RPC messages and are automatically routed to the correct `Call` object.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context the fragments below assume (constructed in the Getting Started example).
declare const client: import('@signalwire/sdk').RelayClient;
declare const call: any; // a live relay Call
declare const rawPayload: any; // a raw signalwire.event JSON-RPC payload
```

## Listening for Events

### On a Call

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

### Via Actions

Actions returned by `play()`, `record()`, etc. have a `wait()` method that resolves when the operation completes:

```typescript
const action = await call.play([{ type: 'tts', params: { text: 'Hello' } }]);
const event = await action.wait(30); // timeout in seconds
// event is a RelayEvent with the terminal state
```

## Event Types

All event-type constants are importable from `@signalwire/sdk`:

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

## Typed Event Classes

Raw events are always a `RelayEvent` with a `params` object. For convenience, typed event classes provide named (camelCase) properties:

```typescript
import { CallStateEvent, PlayEvent, RecordEvent, parseEvent } from '@signalwire/sdk';

// Automatic parsing
const event = parseEvent(rawPayload);

// Or construct directly
if (event.eventType === 'calling.call.state') {
  const stateEvent = CallStateEvent.fromPayload(rawPayload);
  console.log(stateEvent.callState);  // "answered"
  console.log(stateEvent.endReason);  // "hangup" (only on ended)
}
```

### Available Typed Events

| Class | Key Properties |
|-------|---------------|
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

Every typed event also carries the base `RelayEvent` fields: `eventType`, `params` (the raw dict), `callId`, and `timestamp`. The `params` dict always uses the platform's raw `snake_case` field names.

## Call States

```
created -> ringing -> answered -> ending -> ended
```

Constants: `CALL_STATE_CREATED`, `CALL_STATE_RINGING`, `CALL_STATE_ANSWERED`, `CALL_STATE_ENDING`, `CALL_STATE_ENDED`

## End Reasons

When a call reaches the `ended` state, the `endReason` field indicates why:

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

Outbound messages progress through: `queued` -> `initiated` -> `sent` -> `delivered` (or `undelivered`/`failed`).

Constants: `MESSAGE_STATE_QUEUED`, `MESSAGE_STATE_INITIATED`, `MESSAGE_STATE_SENT`, `MESSAGE_STATE_DELIVERED`, `MESSAGE_STATE_UNDELIVERED`, `MESSAGE_STATE_FAILED`, `MESSAGE_STATE_RECEIVED`

## Next Steps

- [Call Methods Reference](call-methods.md) -- all methods available on a Call object
- [Client Reference](client-reference.md) -- RelayClient configuration and methods
- [Messaging](messaging.md) -- sending and receiving SMS/MMS
