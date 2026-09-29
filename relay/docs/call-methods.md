# Call Methods Reference

A `Call` object represents a live phone call. You get one from `client.onCall(...)` for an inbound call, or from `client.dial()` for an outbound call. Don't construct it yourself.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context: `call` is a live Call (from `client.onCall` / `client.dial`).
declare const call: import('@signalwire/sdk').Call;
```

## Properties

A `Call` has these properties:

| Property | Type | Description |
|----------|------|-------------|
| `callId` | `string` | Call identifier assigned by the platform |
| `nodeId` | `string` | RELAY node that handles the call |
| `projectId` | `string` | SignalWire project ID |
| `context` | `string` | Context or protocol the call belongs to |
| `state` | `CallState` | `created`, `ringing`, `answered`, `ending` or `ended`, updated from `calling.call.state` events |
| `direction` | `string` | `inbound` or `outbound` |
| `tag` | `string` | Correlation tag (the dial tag for an outbound call) |
| `device` | `Device` | Device descriptor from the event that created the call |
| `segmentId` | `string` | Segment identifier (inbound calls) |
| `isTerminal` | `boolean` | `true` once `state` is `ended` |

`toString()` returns `<Call id=... state=... direction=...>` for logging.

## Return Values

Methods that start a long-running operation, such as `play()` or `record()`, resolve with an `Action` object; [Actions](#actions) describes them. The other methods resolve with the result object of the platform's JSON-RPC response.

A method rejects with a `RelayError` when the platform returns a non-2xx code. The exceptions are 404 and 410, which mean the call no longer exists. For those codes, the method logs a warning and resolves with `{}`, and an action method returns an action that has already completed.

## Play Items and Devices

The wire format nests an item's fields under `params`: `{ type: 'tts', params: { text: 'Hello' } }`. The SDK also accepts a flat form, `{ type: 'tts', text: 'Hello' }`, and moves the fields under `params` before it sends the request. This applies to play items (`tts`, `audio`, `silence`, `ringtone`) and to the devices you pass to `connect()`, `refer()`, `tap()` and `client.dial()`.

For a `phone` device in the flat form, the SDK also renames `to` and `from` to the wire fields `to_number` and `from_number`. An item that already has `params` is sent unchanged.

## Actions

Methods such as `play()`, `record()` and `detect()` return an **Action**. Awaiting `call.play(...)` waits only until the platform accepts the command, and the operation then runs on the platform. You choose how to handle its completion.

### Wait inline

Await the action's `wait()` method to pause until the operation finishes:

```typescript
const action = await call.play([{ type: 'tts', params: { text: 'Hello' } }]);
await action.wait(); // resolves when playback finishes
// execution continues only after play is done
```

### Continue without waiting

Skip `wait()` to continue immediately, and check the action later:

```typescript
const action = await call.play([{ type: 'tts', params: { text: 'Hello' } }]);
// don't await action.wait(); continue while audio plays
await call.sendDigits('1234');

// check later if needed
if (action.completed) {
  console.log(`Play result: ${JSON.stringify(action.result?.params)}`);
}
```

### Run a callback on completion

Pass `onCompleted` to run a function when the action finishes, without waiting for it:

```typescript
// Sync callback
const action = await call.play(
  [{ type: 'tts', params: { text: 'Hello' } }],
  { onCompleted: (event) => console.log(`Done: ${JSON.stringify(event.params)}`) },
);
// continues immediately; the callback runs when playback finishes

// Async callback
const rec = await call.record(
  { format: 'wav' },
  {
    onCompleted: async (event) => {
      console.log(`Recording finished: ${JSON.stringify(event.params)}`);
      await call.hangup();
    },
  },
);
```

Every method that returns an action accepts `onCompleted`, including the typed helpers such as `playTTS()` and `detectAnsweringMachine()`. The callback may be sync or async. The SDK catches and logs a callback's errors, and they don't reach the client.

The callback also runs when the platform answers 404 or 410, with an empty event (`eventType` of `''`). It doesn't run when `call.state` is already `ended` before the request: the SDK then skips the request and returns an action that has already completed.

### Action members

Every action has these members:

| Member | Description |
|--------|-------------|
| `controlId` | The control ID the platform uses to route the operation's events to this action |
| `call` | The call the action belongs to |
| `await action.wait(timeout?)` | Resolves with the terminal `RelayEvent`. `timeout` is in **seconds**; when it passes, `wait()` rejects with an `Error` and the operation keeps running. |
| `action.completed` | `true` once the action has received its terminal event |
| `action.result` | The terminal `RelayEvent`, or `null` before completion |
| `action.isDone` | `true` once the action has settled, including when its request failed |
| `await action.stop()` | Stops the operation on the platform |

The action classes add these methods and complete on these event states:

| Action | Returned by | Extra methods | Completes on |
|--------|-------------|---------------|--------------|
| `PlayAction` | `play()`, `playTTS()`, `playAudio()`, `playSilence()`, `playRingtone()` | `pause(behavior?)`, `resume()`, `volume(db)` | `finished`, `error` |
| `RecordAction` | `record()` | `pause(behavior?)`, `resume()` | `finished`, `no_input` |
| `CollectAction` | `playAndCollect()`, `promptTTS()`, `promptAudio()` | `pause(behavior?)`, `resume()`, `volume(db)`, `startInputTimers()` | a `calling.call.collect` event with a `result`, or state `finished`, `error`, `no_input`, `no_match` |
| `StandaloneCollectAction` | `collect()` | `startInputTimers()` | a `calling.call.collect` event with a `result`, or state `finished`, `error`, `no_input`, `no_match` |
| `DetectAction` | `detect()`, `detectAnsweringMachine()`, `detectDigit()`, `detectFax()` | none | the first event with a `detect` result, or state `finished`, `error` |
| `FaxAction` | `sendFax()`, `receiveFax()` | none | `finished`, `error` |
| `TapAction` | `tap()` | none | `finished` |
| `StreamAction` | `stream()` | none | `finished` |
| `PayAction` | `pay()` | none | `finished`, `error` |
| `TranscribeAction` | `transcribe()` | none | `finished` |
| `AIAction` | `ai()` | none | `finished`, `error` |

`CollectAction` ignores the `calling.call.play` events that share its control ID, so the prompt finishing doesn't complete it. Both collect actions complete on the first `calling.call.collect` event that carries a `result`, whether or not `CollectEvent.final` is `true`.

## Lifecycle

### `answer(extra?)`

Answer an inbound call. The optional `extra` object is merged into the request's params.

```typescript
await call.answer();
```

### `hangup(reason = 'hangup')`

End the call. The SDK sends `reason` to the platform in a `calling.end` request.

```typescript
await call.hangup();
await call.hangup('busy');
```

### `pass()`

Decline control of the inbound call and return it to routing, in place of answering it.

```typescript
await call.pass();
```

## Audio Playback

### `play(media, options?): Promise<PlayAction>`

Play a list of media items. The options are `volume` (dB), `direction`, `loop`, `controlId` and `onCompleted`.

```typescript
// TTS
const action = await call.play([{ type: 'tts', params: { text: 'Hello!' } }]);
await action.wait();

// Audio file
await call.play([{ type: 'audio', params: { url: 'https://example.com/sound.mp3' } }]);

// Silence
await call.play([{ type: 'silence', params: { duration: 2 } }]);

// Ringtone
await call.play([{ type: 'ringtone', params: { name: 'us' } }]);

// Control playback
await action.pause();
await action.resume();
await action.volume(-3.0);
await action.stop();
```

### Typed playback helpers

These helpers build the media item for you and return a `PlayAction`:

- `playTTS(text, options?)`: options `language`, `gender` (`'male'` or `'female'`), `voice`, `volume`, `onCompleted`
- `playAudio(url, options?)`: options `volume`, `onCompleted`
- `playSilence(duration, options?)`: `duration` in seconds; option `onCompleted`
- `playRingtone(name, options?)`: options `duration` (seconds), `volume`, `onCompleted`

This call speaks a sentence in US English and waits for it to finish:

```typescript
const action = await call.playTTS('Hello!', { language: 'en-US' });
await action.wait();
```

## Recording

### `record(audio?, options?): Promise<RecordAction>`

Record the call. `audio` holds the recording settings, such as `format` (`'mp3'` or `'wav'`), `stereo`, `direction` (`'listen'`, `'speak'` or `'both'`), `beep`, `terminators`, `initial_timeout` and `end_silence_timeout`. The options are `controlId` and `onCompleted`.

```typescript
import { RecordEvent } from '@signalwire/sdk';

const action = await call.record({ format: 'wav', stereo: true, direction: 'both' });
// ... later ...
await action.stop();
const event = await action.wait();
if (event instanceof RecordEvent) {
  console.log(`Recording URL: ${event.url}`);
}
```

`RecordEvent.url` reads `params.record.url`, falling back to `params.url`. The check with `instanceof` handles the empty event an action gets when the call is gone.

## Input Collection

### `playAndCollect(media, collect, options?): Promise<CollectAction>`

Play media and collect DTMF or speech input in one operation. `collect` takes the `calling.collect` fields, such as `digits`, `speech`, `initial_timeout` and `partial_results`. The options are `volume`, `controlId` and `onCompleted`.

```typescript
import { CollectEvent } from '@signalwire/sdk';

const action = await call.playAndCollect(
  [{ type: 'tts', params: { text: 'Press 1 for sales, 2 for support.' } }],
  { digits: { max: 1, digit_timeout: 5.0 } },
);
const event = await action.wait();
if (event instanceof CollectEvent) {
  console.log(`Collected: ${JSON.stringify(event.result)}`);
}
```

The typed helpers `promptTTS(text, collect, options?)` and `promptAudio(url, collect, options?)` build the prompt for you. Each returns a `CollectAction`:

```typescript
const action = await call.promptTTS('Enter your PIN, then press pound.', {
  digits: { max: 4, terminators: '#' },
});
const event = await action.wait();
```

### `collect(options?): Promise<StandaloneCollectAction>`

Collect input without playing media. The options are `digits`, `speech`, `initialTimeout`, `partialResults`, `continuous`, `sendStartOfInput`, `startInputTimers`, `controlId` and `onCompleted`.

```typescript
const action = await call.collect({
  digits: { max: 4, terminators: '#' },
  speech: { language: 'en-US' },
});
const event = await action.wait();
```

## Bridging

### `connect(devices, options?)`

Bridge the call to another destination. `devices` is a nested array: serial attempts outside, parallel devices inside. The options are `ringback` (play items), `tag`, `maxDuration`, `maxPricePerMinute` and `statusUrl`.

```typescript
await call.connect(
  [[{ type: 'phone', to: '+15551234567', from: '+15559876543' }]],
  { ringback: [{ type: 'ringtone', params: { name: 'us' } }] },
);
```

A device can also be `{ type: 'sip', to, from }` or `{ type: 'fabric', to }`, where `to` names a Fabric address.

### `disconnect()`

Unbridge a connected call.

```typescript
await call.disconnect();
```

## DTMF

### `sendDigits(digits, controlId?)`

Send DTMF tones.

```typescript
await call.sendDigits('1234#');
```

## Detection

### `detect(detect, options?): Promise<DetectAction>`

Detect an answering machine, a fax tone or DTMF digits. `detect` is `{ type: 'machine' | 'fax' | 'digit', params? }`. The options are `timeout` (seconds), `controlId` and `onCompleted`.

```typescript
const action = await call.detect({ type: 'machine' }, { timeout: 30 });
const event = await action.wait();
```

These typed helpers call `detect()` and return a `DetectAction`:

- `detectAnsweringMachine(options?)`: options `initialTimeout`, `endSilenceTimeout`, `machineVoiceThreshold`, `machineWordsThreshold`, `detectInterruptions`, `detectMessageEnd`, `timeout`, `onCompleted`
- `detectDigit(options?)`: options `digits`, `timeout`, `onCompleted`
- `detectFax(options?)`: options `tone` (`'CED'` or `'CNG'`), `timeout`, `onCompleted`

This call runs answering-machine detection for up to 30 seconds and reads the result:

```typescript
import { DetectEvent } from '@signalwire/sdk';

const action = await call.detectAnsweringMachine({ initialTimeout: 5, timeout: 30 });
const event = await action.wait();
if (event instanceof DetectEvent) {
  console.log(`Detect result: ${JSON.stringify(event.detect)}`);
}
```

A `DetectAction` completes on the first event that carries a `detect` result, not only on `finished`.

## SIP Refer

### `refer(device, options?)`

Transfer a SIP call with a SIP REFER. The option is `statusUrl`.

```typescript
await call.refer({ type: 'sip', to: 'sip:user@example.com' });
```

## Transfer

### `transfer(dest, extra?)`

Transfer control of the call to another RELAY application or a SWML script. The optional `extra` object is merged into the request's params.

```typescript
await call.transfer('https://example.com/swml-endpoint');
```

## Fax

### `sendFax(document, options?): Promise<FaxAction>`

Send a fax. `document` is the URL of the document. The options are `identity`, `headerInfo`, `controlId` and `onCompleted`.

```typescript
const action = await call.sendFax('https://example.com/document.pdf', { identity: '+15551234567' });
const event = await action.wait();
```

### `receiveFax(options?): Promise<FaxAction>`

Receive a fax on the call. The options are `controlId` and `onCompleted`.

```typescript
const action = await call.receiveFax();
const event = await action.wait();
```

## Tap (Media Interception)

### `tap(tap, device, options?): Promise<TapAction>`

Copy the call's audio to an RTP or WebSocket endpoint. `tap` is `{ type: 'audio', params?: { direction } }`, and `device` has type `rtp` or `ws`. The options are `controlId` and `onCompleted`.

```typescript
const action = await call.tap(
  { type: 'audio', params: { direction: 'both' } },
  { type: 'rtp', params: { addr: '192.168.1.100', port: 5000 } },
);
```

## Streaming

### `stream(url, options?): Promise<StreamAction>`

Stream the call's audio to a WebSocket endpoint. The options are `name`, `codec`, `track`, `statusUrl`, `statusUrlMethod`, `authorizationBearerToken`, `customParameters`, `controlId` and `onCompleted`. `track` picks the audio to stream: `'inbound_track'`, `'outbound_track'` or `'both_tracks'`.

```typescript
const action = await call.stream('wss://example.com/audio', {
  name: 'my_stream',
  codec: 'PCMU',
  track: 'inbound_track',
});
// Stop streaming
await action.stop();
```

## Payment

### `pay(paymentConnectorUrl, options?): Promise<PayAction>`

Collect a card payment through a payment connector. The options include `inputMethod` (sent as `input`), `chargeAmount`, `currency`, `paymentMethod`, `tokenType`, `validCardTypes`, `prompts`, `parameters`, `statusUrl`, `timeout`, `maxAttempts`, `language`, `voice` and `description`. Most take strings, as the wire format does.

```typescript
const action = await call.pay('https://pay.example.com', {
  chargeAmount: '25.99',
  currency: 'usd',
  inputMethod: 'dtmf',
});
const event = await action.wait();
```

## Conference

### `joinConference(name, options?)`

Join the call to a named conference. Calls that join the same name hear each other. The options include `muted`, `beep`, `startOnEnter`, `endOnExit`, `waitUrl`, `maxParticipants`, `record`, `region`, `trim`, `coach`, `stream` and the `statusCallback*` and `recordingStatusCallback*` fields.

```typescript
await call.joinConference('my_conference', { muted: false, beep: 'onEnter' });
```

### `leaveConference(conferenceId, extra?)`

Remove the call from a conference.

```typescript
await call.leaveConference('conf-123');
```

## Hold

### `hold()` / `unhold()`

Put the call on hold, or take it off hold.

```typescript
await call.hold();
// ... later ...
await call.unhold();
```

## Denoise

### `denoise()` / `denoiseStop()`

Start or stop noise reduction on the call.

```typescript
await call.denoise();
// ... later ...
await call.denoiseStop();
```

## Transcription

### `transcribe(options?): Promise<TranscribeAction>`

Start transcribing the call. The options are `statusUrl`, `controlId` and `onCompleted`.

```typescript
const action = await call.transcribe({ statusUrl: 'https://example.com/transcription' });
// ... later ...
await action.stop();
```

## Live Transcribe / Translate

### `liveTranscribe(action, extra?)`

Start or stop live transcription. `action` is the platform's action object, such as `{ start: { ... } }` or `{ stop: ... }`.

```typescript
await call.liveTranscribe({ start: { language: 'en-US' } });
```

### `liveTranslate(action, options?)`

Start or stop live translation. The option is `statusUrl`.

```typescript
await call.liveTranslate({ start: { source: 'en-US', target: 'es' } });
```

## Echo

### `echo(options?)`

Echo the caller's audio back to them, which helps when you test audio paths. The options are `timeout` (seconds) and `statusUrl`.

```typescript
await call.echo({ timeout: 30 });
```

## AI Agent

### `ai(options?): Promise<AIAction>`

Start an AI agent session on the call. The options are `agent`, `prompt`, `postPrompt`, `postPromptUrl`, `postPromptAuthUser`, `postPromptAuthPassword`, `globalData`, `pronounce`, `hints`, `languages`, `SWAIG`, `aiParams` (sent as `params`), `controlId` and `onCompleted`.

```typescript
const action = await call.ai({
  prompt: { text: 'You are a helpful support agent.' },
  SWAIG: { functions: [] },
  aiParams: { end_of_speech_timeout: 3000 },
});
const event = await action.wait();
```

### `amazonBedrock(options?)`

Connect the call to an Amazon Bedrock agent. The options are `prompt`, `SWAIG`, `aiParams`, `globalData`, `postPrompt` and `postPromptUrl`.

### `aiMessage(options?)`

Send a message into an active AI session. The options are `messageText`, `role`, `reset` and `globalData`.

### `aiHold(options?)` / `aiUnhold(options?)`

Put an AI session on hold, or resume it. `aiHold()` takes `timeout` and `prompt`; `aiUnhold()` takes `prompt`.

## Rooms

### `joinRoom(name, options?)`

Join the call to a named room. The option is `statusUrl`.

```typescript
await call.joinRoom('my_room');
```

### `leaveRoom(extra?)`

Remove the call from its room.

```typescript
await call.leaveRoom();
```

## Queue

### `queueEnter(queueName, options?)`

Place the call in a named queue. The options are `controlId` and `statusUrl`.

```typescript
await call.queueEnter('support');
```

### `queueLeave(queueName, options?)`

Remove the call from a queue. The options are `controlId`, `queueId` and `statusUrl`.

```typescript
await call.queueLeave('support', { queueId: 'q-123' });
```

## Digit Bindings

### `bindDigit(digits, bindMethod, options?)`

Bind a DTMF sequence to a RELAY method, which the platform runs when the caller presses the sequence. The options are `bindParams` (sent as `params`), `realm` and `maxTriggers`.

```typescript
await call.bindDigit('*1', 'calling.play', {
  bindParams: { play: [{ type: 'tts', params: { text: 'You pressed star-1' } }] },
});
```

### `clearDigitBindings(realm?)`

Remove the call's digit bindings, or only those in `realm`.

```typescript
await call.clearDigitBindings();
```

## User Events

### `userEvent(options?)`

Send a custom event named by `options.event`. The SDK sends every other field in `options` with it:

```typescript
await call.userEvent({ event: 'order_placed', order_id: '12345' });
```

## Event Handling

### `on(eventType, handler)`

Register a listener for one event type on this call. The handler receives the typed event object, such as a `PlayEvent` for `calling.call.play`. Listener errors are logged and don't stop other listeners.

```typescript
call.on('calling.call.play', (event) => {
  console.log(`Play state: ${event.params.state}`);
});
```

### `waitFor(eventType, predicate?, timeout?)`

Wait for the next event of a type that matches the optional predicate. `timeout` is in **milliseconds**; when it passes, `waitFor()` rejects with an `Error`.

```typescript
const event = await call.waitFor('calling.call.play', undefined, 30_000);
```

### `waitForEnded(timeout?)`

Wait for the call to reach `ended`, and resolve with that `calling.call.state` event. `timeout` is in **milliseconds**.

```typescript
const event = await call.waitForEnded();
console.log(`End reason: ${event.params.end_reason}`);
```

`waitForAnswered(timeout?)`, `waitForRinging(timeout?)` and `waitForEnding(timeout?)` wait for those states, with `timeout` in milliseconds. They resolve at once, with a generated `calling.call.state` event, when the call is already at or past the state.

## Next Steps

Continue with these pages:

- [Events](events.md): typed event classes and event-type constants
- [Client Reference](client-reference.md): `RelayClient` options and methods
- [Getting Started](getting-started.md): connecting and placing a first call
