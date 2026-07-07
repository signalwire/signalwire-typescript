# Calling Commands

The Calling API provides REST-based call control. All commands are dispatched via a single `POST /api/calling/calls` endpoint with a `command` field. No WebSocket connection is needed.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context the fragments below assume (constructed on the Getting Started page).
declare const client: import('@signalwire/sdk').RestClient;
declare const callId: string; // the UUID of an active call
```

## How It Works

Every method on `client.calling` sends a POST request with this structure:

```json
{
    "command": "calling.play",
    "id": "<call-uuid>",
    "params": { ... }
}
```

For `dial` and `update`, the call details are inside `params` (no top-level `id`). For all other commands, the first argument is the UUID of the call to control. Each method is async and returns the parsed JSON response.

## Call Lifecycle

### `dial(from, to, options?)`

Initiate an outbound call. `from` and `to` are positional; everything else is options.

```typescript
const result = await client.calling.dial('+15559876543', '+15551234567', {
  url: 'https://example.com/call-handler',
});
const newCallId = result.id;
```

### `update(id, options?)`

Update an active call's dialplan mid-call. The call `id` is positional.

```typescript
await client.calling.update(callId, { url: 'https://example.com/new-handler' });
```

### `end(callId, options?)`

Terminate a call.

```typescript
await client.calling.end(callId, { reason: 'hangup' });
```

### `transfer(callId, dest, options?)`

Transfer a call to a new destination. `dest` is positional.

```typescript
await client.calling.transfer(callId, 'sip:agent@example.com');
```

### `disconnect(callId)`

Disconnect bridged calls without hanging up either leg.

```typescript
await client.calling.disconnect(callId);
```

## Audio Playback

### `play(callId, play, options?)`

Play audio, TTS, silence, or ringtone. The `play` array is positional.

```typescript
await client.calling.play(callId, [{ type: 'tts', text: 'Hello!' }], {
  volume: 5.0,
});
```

### `playPause(callId, control_id, options?)` / `playResume(callId, control_id, options?)`

Pause or resume active playback. `control_id` is positional.

```typescript
await client.calling.playPause(callId, 'ctrl-1');
await client.calling.playResume(callId, 'ctrl-1');
```

### `playStop(callId, control_id, options?)`

Stop active playback.

```typescript
await client.calling.playStop(callId, 'ctrl-1');
```

### `playVolume(callId, control_id, volume, options?)`

Adjust playback volume. `control_id` and `volume` are positional.

```typescript
await client.calling.playVolume(callId, 'ctrl-1', -3.0);
```

## Recording

### `record(callId, options?)` / `recordPause(callId, control_id, options?)` / `recordResume` / `recordStop`

`record` takes an options object; the pause/resume/stop variants take `control_id` positionally.

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

### `collect(callId, options?)` / `collectStop(callId, control_id, options?)` / `collectStartInputTimers(callId, control_id, options?)`

`collect` takes an options object; the stop/timer variants take `control_id` positionally.

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

### `detect(callId, detect, options?)` / `detectStop(callId, control_id, options?)`

The `detect` config object is positional; `detectStop` takes `control_id` positionally.

```typescript
await client.calling.detect(callId, { type: 'machine', params: { initial_timeout: 4.5 } }, {
  control_id: 'det-1',
});
await client.calling.detectStop(callId, 'det-1');
```

## Tap & Stream

### `tap(callId, tap, device, options?)` / `tapStop(callId, control_id, options?)`

The `tap` and `device` config objects are positional; `tapStop` takes `control_id` positionally.

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

The stream `url` is positional; `streamStop` takes `control_id` positionally.

```typescript
await client.calling.stream(callId, 'wss://example.com/audio-stream', {
  control_id: 'str-1',
  codec: 'PCMU',
});
await client.calling.streamStop(callId, 'str-1');
```

## Denoise

### `denoise(callId, params?)` / `denoiseStop(callId, params?)`

```typescript
await client.calling.denoise(callId);
await client.calling.denoiseStop(callId);
```

## Transcription

### `transcribe(callId, options?)` / `transcribeStop(callId, control_id, options?)`

```typescript
await client.calling.transcribe(callId, { control_id: 'tx-1', status_url: 'https://example.com/hook' });
await client.calling.transcribeStop(callId, 'tx-1');
```

## AI

### `aiMessage(callId, params?)`

Inject a message into an active AI session.

```typescript
await client.calling.aiMessage(callId, { role: 'user', message_text: 'Transfer me to billing' });
```

### `aiHold(callId, params?)` / `aiUnhold(callId, params?)`

```typescript
await client.calling.aiHold(callId, { timeout: 60, prompt: 'Please wait while I transfer you.' });
await client.calling.aiUnhold(callId, { prompt: "I'm back, how can I help?" });
```

### `aiStop(callId, control_id, options?)`

```typescript
await client.calling.aiStop(callId, 'ai-1');
```

## Live Transcribe & Translate

The `action` is a positional structured object. Use `{ start: {...} }` to begin, or `'stop'` to end.

```typescript
await client.calling.liveTranscribe(callId, {
  start: { lang: 'en-US', direction: ['remote-caller'] },
});
await client.calling.liveTranslate(callId, {
  start: { from_lang: 'en-US', to_lang: 'es-ES', direction: ['remote-caller'] },
});
```

## Fax

```typescript
await client.calling.sendFaxStop(callId, 'fax-1');
await client.calling.receiveFaxStop(callId, 'fax-1');
```

## SIP & Custom Events

```typescript
// SIP REFER transfer — the `device` object is positional
await client.calling.refer(callId, { to: 'sip:agent@example.com' });

// Custom event — the `event` object is positional; each value is an object
await client.calling.userEvent(callId, { custom: { key: 'value' } });
```

## Complete Method List

All 37 commands, with the wire `command` value each dispatches:

| Method | Command | Requires callId |
|--------|---------|:-:|
| `dial(from, to, options?)` | `dial` | No |
| `update(id, options?)` | `update` | No |
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
