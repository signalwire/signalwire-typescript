# Call Methods Reference

A `Call` object represents a live phone call. You get one from `client.onCall(...)` (inbound) or `client.dial()` (outbound).

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `callId` | `string` | Unique call identifier |
| `nodeId` | `string` | Server node handling the call |
| `state` | `string` | Current state: `created`, `ringing`, `answered`, `ending`, `ended` |
| `direction` | `string` | `inbound` or `outbound` |
| `tag` | `string` | Correlation tag |
| `device` | `Device` | Device info (type, params) |
| `segmentId` | `string` | Segment identifier |
| `isTerminal` | `boolean` | `true` once the call has reached the `ended` state |

## Actions: Blocking vs Fire-and-Forget

Methods like `play()`, `record()`, `detect()`, etc. return **Action** objects. `await call.play(...)` itself only waits for the server to accept the command — the actual operation runs asynchronously on the server. You choose how to handle completion:

### Wait inline (blocking)

```typescript
const action = await call.play([{ type: 'tts', params: { text: 'Hello' } }]);
await action.wait(); // blocks until playback finishes
// execution continues only after play is done
```

### Fire and forget (background)

```typescript
const action = await call.play([{ type: 'tts', params: { text: 'Hello' } }]);
// don't await action.wait() — continue immediately while audio plays
await call.sendDigits('1234');

// check later if needed
if (action.isDone) {
  console.log(`Play result: ${action.result}`);
}
```

### Fire with callback

```typescript
// Sync callback
const action = await call.play(
  [{ type: 'tts', params: { text: 'Hello' } }],
  { onCompleted: (event) => console.log(`Done: ${JSON.stringify(event.params)}`) },
);
// continues immediately; callback fires when playback finishes

// Async callback
const rec = await call.record(
  { format: 'wav' },
  {
    onCompleted: async (event) => {
      console.log(`Recording URL: ${event.params.url}`);
      await call.hangup();
    },
  },
);
```

The `onCompleted` callback is available on all action-based methods: `play`, `record`, `playAndCollect`, `collect`, `detect`, `pay`, `sendFax`, `receiveFax`, `tap`, `stream`, `transcribe`, and `ai`. It accepts both sync and async functions. Errors in callbacks are caught and logged, never crashing the client. The callback also fires when the call is gone (404/410).

### Action members summary

| Member | Description |
|--------|-------------|
| `await action.wait(timeout?)` | Blocks until the action completes (timeout in **seconds**), returns the terminal `RelayEvent` |
| `action.isDone` | `true` if the action has completed |
| `action.result` | The terminal `RelayEvent` (or `null` if not done) |
| `action.completed` | `true` if the action reached a terminal state |
| `await action.stop()` | Stop the operation on the server |

Some actions also have `pause()`, `resume()`, and `volume()`.

## Lifecycle

### `answer(extra?)`

Answer an inbound call.

```typescript
await call.answer();
```

### `hangup(reason?)`

End the call. Reason defaults to `'hangup'`.

```typescript
await call.hangup();
await call.hangup('busy');
```

### `pass()`

Decline control, returning the call to routing.

```typescript
await call.pass();
```

## Audio Playback

### `play(media, options?)`

Play audio. Returns a `PlayAction` with `stop()`, `pause()`, `resume()`, `volume()`, and `wait()`.

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

### Typed convenience helpers

For common cases, typed helpers wrap `play()` so you don't have to hand-assemble the media array: `playTTS(text, options?)`, `playAudio(url, options?)`, `playSilence(duration, options?)`, and `playRingtone(name, options?)`. Each returns a `PlayAction` just like `play()`.

```typescript
const action = await call.play([{ type: 'tts', params: { text: 'Hello!', language: 'en-US' } }]);
await action.wait();
```

## Recording

### `record(audio?, options?)`

Record the call. Returns a `RecordAction` with `stop()`, `pause()`, `resume()`, and `wait()`.

```typescript
const action = await call.record({ format: 'wav', stereo: true, direction: 'both' });
// ... later ...
await action.stop();
const event = await action.wait();
console.log(`Recording URL: ${event.params.url}`);
```

## Input Collection

### `playAndCollect(media, collect, options?)`

Play audio and collect DTMF or speech input. Returns a `CollectAction`.

```typescript
const action = await call.playAndCollect(
  [{ type: 'tts', params: { text: 'Press 1 for sales, 2 for support.' } }],
  { digits: { max: 1, digit_timeout: 5.0 } },
);
const event = await action.wait();
```

The typed helpers `promptTTS(text, collect, options?)` and `promptAudio(url, collect, options?)` wrap `playAndCollect()` for the common TTS / audio-prompt cases — each returns a `CollectAction`:

```typescript
const action = await call.playAndCollect(
  [{ type: 'tts', params: { text: 'Enter your PIN:' } }],
  { digits: { max: 4, terminators: '#' } },
);
const event = await action.wait();
```

### `collect(options?)`

Collect input without playing audio. Returns a `StandaloneCollectAction`.

```typescript
const action = await call.collect({
  digits: { max: 4, terminators: '#' },
  speech: { language: 'en-US' },
  partialResults: true,
});
const event = await action.wait();
```

## Bridging

### `connect(devices, options?)`

Bridge the call to another destination.

```typescript
await call.connect(
  [[{ type: 'phone', to: '+15551234567', from: '+15559876543' }]],
  { ringback: [{ type: 'ringtone', params: { name: 'us' } }] },
);
```

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

### `detect(detect, options?)`

Detect machine, fax, or digits. Returns a `DetectAction`.

```typescript
const action = await call.detect({ type: 'machine' }, { timeout: 30 });
const event = await action.wait();
```

Typed helpers wrap `detect()` for each detection type: `detectAnsweringMachine(options?)`, `detectDigit(options?)`, and `detectFax(options?)` — each returns a `DetectAction`.

```typescript
const action = await call.detect(
  { type: 'machine', params: { initial_timeout: 5 } },
  { timeout: 30 },
);
const event = await action.wait();
```

## SIP Refer

### `refer(device, options?)`

Transfer via SIP REFER.

```typescript
await call.refer({ type: 'sip', to: 'sip:user@example.com' });
```

## Transfer

### `transfer(dest, extra?)`

Transfer call control to another RELAY app or SWML script.

```typescript
await call.transfer('https://example.com/swml-endpoint');
```

## Fax

### `sendFax(document, options?)`

```typescript
const action = await call.sendFax('https://example.com/document.pdf', { identity: '+15551234567' });
const event = await action.wait();
```

### `receiveFax(options?)`

```typescript
const action = await call.receiveFax();
const event = await action.wait();
```

## Tap (Media Interception)

### `tap(tap, device, options?)`

Intercept call media and stream it to an external endpoint.

```typescript
const action = await call.tap(
  { type: 'audio', params: { direction: 'both' } },
  { type: 'rtp', params: { addr: '192.168.1.100', port: 5000 } },
);
```

## Streaming

### `stream(url, options?)`

Stream call audio to a WebSocket endpoint.

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

### `pay(paymentConnectorUrl, options?)`

Collect a payment via DTMF. Returns a `PayAction`.

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

```typescript
await call.joinConference('my_conference', { muted: false, beep: 'onEnter' });
```

### `leaveConference(conferenceId, extra?)`

```typescript
await call.leaveConference('conf-123');
```

## Hold

### `hold()` / `unhold()`

```typescript
await call.hold();
// ... later ...
await call.unhold();
```

## Denoise

### `denoise()` / `denoiseStop()`

```typescript
await call.denoise();
// ... later ...
await call.denoiseStop();
```

## Transcription

### `transcribe(options?)`

Returns a `TranscribeAction`.

```typescript
const action = await call.transcribe({ statusUrl: 'https://example.com/transcription' });
// ... later ...
await action.stop();
```

## Live Transcribe / Translate

### `liveTranscribe(action, extra?)`

```typescript
await call.liveTranscribe({ start: { language: 'en-US' } });
```

### `liveTranslate(action, options?)`

```typescript
await call.liveTranslate({ start: { source: 'en-US', target: 'es' } });
```

## Echo

### `echo(options?)`

Echo audio back to the caller (useful for testing).

```typescript
await call.echo({ timeout: 30 });
```

## AI Agent

### `ai(options?)`

Start an AI agent session on the call. Returns an `AIAction`.

```typescript
const action = await call.ai({
  prompt: { text: 'You are a helpful support agent.' },
  SWAIG: { functions: [] },
  aiParams: { end_of_speech_timeout: 3000 },
});
const event = await action.wait();
```

### `amazonBedrock(options?)`

Connect to an Amazon Bedrock AI agent.

### `aiMessage(options?)`

Send a message to an active AI session.

### `aiHold(options?)` / `aiUnhold(options?)`

Put an AI session on/off hold.

## Rooms

### `joinRoom(name, options?)`

```typescript
await call.joinRoom('my_room');
```

### `leaveRoom(extra?)`

```typescript
await call.leaveRoom();
```

## Queue

### `queueEnter(queueName, options?)`

```typescript
await call.queueEnter('support');
```

### `queueLeave(queueName, options?)`

```typescript
await call.queueLeave('support', { queueId: 'q-123' });
```

## Digit Bindings

### `bindDigit(digits, bindMethod, options?)`

Bind a DTMF sequence to trigger a RELAY method.

```typescript
await call.bindDigit('*1', 'calling.play', {
  bindParams: { play: [{ type: 'tts', params: { text: 'You pressed star-1' } }] },
});
```

### `clearDigitBindings(realm?)`

```typescript
await call.clearDigitBindings();
```

## User Events

### `userEvent(options?)`

Send a custom event. Set `options.event` for the event name and include any additional fields your webhook expects.

```typescript
await call.userEvent({ event: 'order_placed', order_id: '12345' });
```

## Event Handling

### `on(eventType, handler)`

Register an event listener on this call.

```typescript
call.on('calling.call.play', (event) => {
  console.log(`Play state: ${event.params.state}`);
});
```

### `waitFor(eventType, predicate?, timeout?)`

Wait for a specific event. Timeout is in **milliseconds**.

```typescript
const event = await call.waitFor('calling.call.play', undefined, 30_000);
```

### `waitForEnded(timeout?)`

Wait for the call to end. Timeout is in **milliseconds**.

```typescript
const event = await call.waitForEnded();
console.log(`End reason: ${event.params.end_reason}`);
```

`waitForAnswered(timeout?)`, `waitForRinging(timeout?)`, and `waitForEnding(timeout?)` wait for the corresponding lifecycle state.

## Next Steps

- [Events](events.md) -- typed event classes and event-type constants
- [Client Reference](client-reference.md) -- RelayClient configuration and methods
- [Getting Started](getting-started.md) -- connecting and your first call
