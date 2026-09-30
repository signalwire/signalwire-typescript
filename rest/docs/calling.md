# Calling Commands

The Calling API controls calls over REST. Every command is a `POST` to `/api/calling/calls` with a `command` field, and needs no WebSocket connection. This page lists each method on `client.calling` with an example.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context the fragments on this page assume (constructed on the Getting Started page).
declare const client: import('@signalwire/sdk').RestClient;
declare const callId: string; // the UUID of an active call
```

## How It Works

Each method on `client.calling` sends one POST request. This is the body that `client.calling.play(callId, [...])` sends:

```json
{
  "command": "calling.play",
  "params": {
    "play": [{ "type": "audio", "params": { "url": "https://example.com/a.mp3" } }]
  },
  "id": "<call-uuid>"
}
```

For `dial` and `update`, the call details go inside `params`, with no top-level `id`. Every other method takes the UUID of the call to control as its first argument. Each method is async and returns the parsed JSON response.

Every method also accepts an `extras` object in its options, merged into `params` for fields the SDK doesn't type, and a final `requestOptions` argument. [Request Options](guide.md#request-options-timeout-retries-abort) describes the second.

## Call Lifecycle

These methods start, change and end calls.

### `dial(from, to, options?)`

`dial` starts an outbound call. `from` and `to` are positional, and the other fields are options:

```typescript
const result = await client.calling.dial('+15559876543', '+15551234567', {
  url: 'https://example.com/call-handler',
});
const newCallId = result.id;
```

### `update(id, options?)`

`update` gives an active call a new dialplan, from a `url` or inline `swml`. The call `id` is positional:

```typescript
await client.calling.update(callId, { url: 'https://example.com/new-handler' });
```

### `end(callId, options?)`

`end` hangs up a call. The optional `reason` is one of `hangup`, `cancel`, `busy`, `noAnswer`, `decline` or `error`:

```typescript
await client.calling.end(callId, { reason: 'hangup' });
```

### `transfer(callId, dest, options?)`

`transfer` moves a call to a new destination: a SIP URI, a phone number or an inline SWML object. `dest` is positional:

```typescript
await client.calling.transfer(callId, 'sip:agent@example.com');
```

### `disconnect(callId, options?)`

`disconnect` separates bridged calls without hanging up either leg:

```typescript
await client.calling.disconnect(callId);
```

## Audio Playback

These methods play media into a call and control the playback.

### `play(callId, play, options?)`

`play` plays audio, TTS, silence or a ringtone. The `play` array is positional. Each item has a `type` (`audio`, `tts`, `silence` or `ring`) and its `params`:

```typescript
await client.calling.play(callId, [{ type: 'tts', params: { text: 'Hello!' } }], {
  control_id: 'ctrl-1',
  volume: 5.0,
});
```

The `volume` option adjusts the level in dB.

### `playPause(callId, control_id, options?)` / `playResume(callId, control_id, options?)`

These pause and resume active playback. `control_id` is positional:

```typescript
await client.calling.playPause(callId, 'ctrl-1');
await client.calling.playResume(callId, 'ctrl-1');
```

### `playStop(callId, control_id, options?)`

`playStop` stops active playback:

```typescript
await client.calling.playStop(callId, 'ctrl-1');
```

### `playVolume(callId, control_id, volume, options?)`

`playVolume` adjusts the playback volume. `control_id` and `volume` are positional:

```typescript
await client.calling.playVolume(callId, 'ctrl-1', -3.0);
```

## Recording

`record` takes an options object. The pause, resume and stop methods take `control_id` positionally:

```typescript
await client.calling.record(callId, {
  control_id: 'rec-1',
  audio: { beep: true, format: 'wav', stereo: true },
});
await client.calling.recordPause(callId, 'rec-1');
await client.calling.recordResume(callId, 'rec-1');
await client.calling.recordStop(callId, 'rec-1');
```

## Input Collection

`collect` gathers DTMF or speech input and takes an options object. `collectStop` and `collectStartInputTimers` take `control_id` positionally:

```typescript
await client.calling.collect(callId, {
  control_id: 'coll-1',
  digits: { max: 4, terminators: '#' },
  speech: { end_silence_timeout: 2.0 },
});
await client.calling.collectStop(callId, 'coll-1');
await client.calling.collectStartInputTimers(callId, 'coll-1');
```

## Detection

`detect` starts an answering-machine, fax or digit detector. The `detect` config object is positional, and `detectStop` takes `control_id` positionally:

```typescript
await client.calling.detect(callId, { type: 'machine', params: { initial_timeout: 4.5 } }, {
  control_id: 'det-1',
});
await client.calling.detectStop(callId, 'det-1');
```

## Tap and Stream

`tap` sends call audio to an RTP or WebSocket endpoint, and `stream` sends it to a WebSocket URL.

### `tap(callId, tap, device, options?)` / `tapStop(callId, control_id, options?)`

The `tap` and `device` config objects are positional, and `tapStop` takes `control_id` positionally:

```typescript
await client.calling.tap(
  callId,
  { type: 'audio', params: { direction: 'both' } },
  { type: 'rtp', params: { addr: '192.168.1.1', port: 1234 } },
  { control_id: 'tap-1' },
);
await client.calling.tapStop(callId, 'tap-1');
```

### `stream(callId, url, options?)` / `streamStop(callId, control_id, options?)`

The stream `url` is positional, and `streamStop` takes `control_id` positionally:

```typescript
await client.calling.stream(callId, 'wss://example.com/audio-stream', {
  control_id: 'str-1',
  codec: 'PCMU',
});
await client.calling.streamStop(callId, 'str-1');
```

## Denoise

`denoise` starts noise reduction on a call and `denoiseStop` stops it. Both take only the call ID and an optional `extras` object:

```typescript
await client.calling.denoise(callId);
await client.calling.denoiseStop(callId);
```

## Transcription

`transcribe` starts transcription of the call, and `transcribeStop` takes `control_id` positionally:

```typescript
await client.calling.transcribe(callId, { control_id: 'tx-1', status_url: 'https://example.com/hook' });
await client.calling.transcribeStop(callId, 'tx-1');
```

## AI

These methods act on an AI session running on a call.

### `aiMessage(callId, options?)`

`aiMessage` adds a message to the AI conversation. The `role` is `system`, `user` or `assistant`. The options also accept `reset` and `global_data`:

```typescript
await client.calling.aiMessage(callId, { role: 'user', message_text: 'Transfer me to billing' });
```

### `aiHold(callId, options?)` / `aiUnhold(callId, options?)`

`aiHold` puts the caller on hold for up to `timeout` seconds. Its `prompt` is a system message added to the conversation before the hold, not text read to the caller:

```typescript
await client.calling.aiHold(callId, { timeout: 60, prompt: 'Tell the caller you are checking their account.' });
await client.calling.aiUnhold(callId, { prompt: 'The account check is done. Continue helping the caller.' });
```

### `aiStop(callId, control_id, options?)`

`aiStop` stops an active AI session on a call:

```typescript
await client.calling.aiStop(callId, 'ai-1');
```

## Live Transcribe and Translate

`liveTranscribe` and `liveTranslate` take a positional `action`. Use `{ start: {...} }` to begin, `{ summarize: {...} }` to request a summary, or the string `'stop'` to end. `liveTranslate` also accepts `{ inject: {...} }`:

```typescript
await client.calling.liveTranscribe(callId, {
  start: { lang: 'en-US', direction: ['remote-caller'] },
});
await client.calling.liveTranslate(callId, {
  start: { from_lang: 'en-US', to_lang: 'es-ES', direction: ['remote-caller'] },
});
await client.calling.liveTranscribe(callId, 'stop');
```

## Fax

These methods stop an active fax send or receive:

```typescript
await client.calling.sendFaxStop(callId, 'fax-1');
await client.calling.receiveFaxStop(callId, 'fax-1');
```

## SIP and Custom Events

`refer` transfers a SIP call with SIP REFER, and `userEvent` fires a custom event on the call:

```typescript
// SIP REFER transfer; the `device` object is positional
await client.calling.refer(callId, { type: 'sip', params: { to: 'sip:agent@example.com' } });

// Custom event; the `event` object is positional, and each value is an object
await client.calling.userEvent(callId, { custom: { key: 'value' } });
```

## Complete Method List

The table lists all 37 methods, with the wire `command` value each one sends:

| Method | Command | Requires callId |
|--------|---------|:-:|
| `dial(from, to, options?)` | `dial` | No |
| `update(id, options?)` | `update` | No (`id` goes in `params`) |
| `end(callId, options?)` | `calling.end` | Yes |
| `transfer(callId, dest, options?)` | `calling.transfer` | Yes |
| `disconnect(callId, options?)` | `calling.disconnect` | Yes |
| `play(callId, play, options?)` | `calling.play` | Yes |
| `playPause(callId, control_id, options?)` | `calling.play.pause` | Yes |
| `playResume(callId, control_id, options?)` | `calling.play.resume` | Yes |
| `playStop(callId, control_id, options?)` | `calling.play.stop` | Yes |
| `playVolume(callId, control_id, volume, options?)` | `calling.play.volume` | Yes |
| `record(callId, options?)` | `calling.record` | Yes |
| `recordPause(callId, control_id, options?)` | `calling.record.pause` | Yes |
| `recordResume(callId, control_id, options?)` | `calling.record.resume` | Yes |
| `recordStop(callId, control_id, options?)` | `calling.record.stop` | Yes |
| `collect(callId, options?)` | `calling.collect` | Yes |
| `collectStop(callId, control_id, options?)` | `calling.collect.stop` | Yes |
| `collectStartInputTimers(callId, control_id, options?)` | `calling.collect.start_input_timers` | Yes |
| `detect(callId, detect, options?)` | `calling.detect` | Yes |
| `detectStop(callId, control_id, options?)` | `calling.detect.stop` | Yes |
| `tap(callId, tap, device, options?)` | `calling.tap` | Yes |
| `tapStop(callId, control_id, options?)` | `calling.tap.stop` | Yes |
| `stream(callId, url, options?)` | `calling.stream` | Yes |
| `streamStop(callId, control_id, options?)` | `calling.stream.stop` | Yes |
| `denoise(callId, options?)` | `calling.denoise` | Yes |
| `denoiseStop(callId, options?)` | `calling.denoise.stop` | Yes |
| `transcribe(callId, options?)` | `calling.transcribe` | Yes |
| `transcribeStop(callId, control_id, options?)` | `calling.transcribe.stop` | Yes |
| `aiMessage(callId, options?)` | `calling.ai_message` | Yes |
| `aiHold(callId, options?)` | `calling.ai_hold` | Yes |
| `aiUnhold(callId, options?)` | `calling.ai_unhold` | Yes |
| `aiStop(callId, control_id, options?)` | `calling.ai.stop` | Yes |
| `liveTranscribe(callId, action, options?)` | `calling.live_transcribe` | Yes |
| `liveTranslate(callId, action, options?)` | `calling.live_translate` | Yes |
| `sendFaxStop(callId, control_id, options?)` | `calling.send_fax.stop` | Yes |
| `receiveFaxStop(callId, control_id, options?)` | `calling.receive_fax.stop` | Yes |
| `refer(callId, device, options?)` | `calling.refer` | Yes |
| `userEvent(callId, event, options?)` | `calling.user_event` | Yes |
