# Calling Commands

The Calling API provides REST-based call control. All commands are dispatched via a single `POST /api/calling/calls` endpoint with a `command` field. No WebSocket connection is needed.

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

### `dial(params?)`

Initiate an outbound call.

```typescript
const result = await client.calling.dial({
  from: '+15559876543',
  to: '+15551234567',
  url: 'https://example.com/call-handler',
});
const callId = result.id;
```

### `update(params?)`

Update an active call's dialplan mid-call.

```typescript
await client.calling.update({ id: callId, url: 'https://example.com/new-handler' });
```

### `end(callId, params?)`

Terminate a call.

```typescript
await client.calling.end(callId, { reason: 'hangup' });
```

### `transfer(callId, params?)`

Transfer a call to a new destination.

```typescript
await client.calling.transfer(callId, { dest: 'sip:agent@example.com' });
```

### `disconnect(callId)`

Disconnect bridged calls without hanging up either leg.

```typescript
await client.calling.disconnect(callId);
```

## Audio Playback

### `play(callId, params?)`

Play audio, TTS, silence, or ringtone.

```typescript
await client.calling.play(callId, {
  play: [{ type: 'tts', text: 'Hello!' }],
  volume: 5.0,
});
```

### `playPause(callId, params?)` / `playResume(callId, params?)`

Pause or resume active playback.

```typescript
await client.calling.playPause(callId, { control_id: 'ctrl-1' });
await client.calling.playResume(callId, { control_id: 'ctrl-1' });
```

### `playStop(callId, params?)`

Stop active playback.

```typescript
await client.calling.playStop(callId, { control_id: 'ctrl-1' });
```

### `playVolume(callId, params?)`

Adjust playback volume.

```typescript
await client.calling.playVolume(callId, { control_id: 'ctrl-1', volume: -3.0 });
```

## Recording

### `record(callId, params?)` / `recordPause` / `recordResume` / `recordStop`

```typescript
await client.calling.record(callId, {
  control_id: 'rec-1',
  audio: { beep: true, format: 'wav', stereo: true },
});
await client.calling.recordPause(callId, { control_id: 'rec-1' });
await client.calling.recordResume(callId, { control_id: 'rec-1' });
await client.calling.recordStop(callId, { control_id: 'rec-1' });
```

## Input Collection

### `collect(callId, params?)` / `collectStop` / `collectStartInputTimers`

```typescript
await client.calling.collect(callId, {
  control_id: 'coll-1',
  digits: { max: 4, terminators: '#' },
  speech: { end_silence_timeout: 2.0 },
});
await client.calling.collectStop(callId, { control_id: 'coll-1' });
await client.calling.collectStartInputTimers(callId, { control_id: 'coll-1' });
```

## Detection

### `detect(callId, params?)` / `detectStop`

```typescript
await client.calling.detect(callId, {
  control_id: 'det-1',
  detect: { type: 'machine', params: { initial_timeout: 4.5 } },
});
await client.calling.detectStop(callId, { control_id: 'det-1' });
```

## Tap & Stream

### `tap(callId, params?)` / `tapStop`

```typescript
await client.calling.tap(callId, {
  control_id: 'tap-1',
  tap: { type: 'audio', params: { direction: 'both' } },
  device: { type: 'rtp', params: { addr: '192.168.1.1', port: 1234 } },
});
await client.calling.tapStop(callId, { control_id: 'tap-1' });
```

### `stream(callId, params?)` / `streamStop`

```typescript
await client.calling.stream(callId, {
  control_id: 'str-1',
  url: 'wss://example.com/audio-stream',
  codec: 'PCMU',
});
await client.calling.streamStop(callId, { control_id: 'str-1' });
```

## Denoise

### `denoise(callId, params?)` / `denoiseStop(callId, params?)`

```typescript
await client.calling.denoise(callId);
await client.calling.denoiseStop(callId);
```

## Transcription

### `transcribe(callId, params?)` / `transcribeStop`

```typescript
await client.calling.transcribe(callId, { control_id: 'tx-1', status_url: 'https://example.com/hook' });
await client.calling.transcribeStop(callId, { control_id: 'tx-1' });
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

### `aiStop(callId, params?)`

```typescript
await client.calling.aiStop(callId, { control_id: 'ai-1' });
```

## Live Transcribe & Translate

```typescript
await client.calling.liveTranscribe(callId, { action: 'start', lang: 'en' });
await client.calling.liveTranslate(callId, { action: 'start', from_lang: 'en', to_lang: 'es' });
```

## Fax

```typescript
await client.calling.sendFaxStop(callId, { control_id: 'fax-1' });
await client.calling.receiveFaxStop(callId, { control_id: 'fax-1' });
```

## SIP & Custom Events

```typescript
// SIP REFER transfer
await client.calling.refer(callId, { device: { to: 'sip:agent@example.com' } });

// Custom event
await client.calling.userEvent(callId, { event: { type: 'custom', data: { key: 'value' } } });
```

## Complete Method List

All 37 commands, with the wire `command` value each dispatches:

| Method | Command | Requires callId |
|--------|---------|:-:|
| `dial(params?)` | `dial` | No |
| `update(params?)` | `update` | No |
| `end(callId, params?)` | `calling.end` | Yes |
| `transfer(callId, params?)` | `calling.transfer` | Yes |
| `disconnect(callId, params?)` | `calling.disconnect` | Yes |
| `play(callId, params?)` | `calling.play` | Yes |
| `playPause(callId, params?)` | `calling.play.pause` | Yes |
| `playResume(callId, params?)` | `calling.play.resume` | Yes |
| `playStop(callId, params?)` | `calling.play.stop` | Yes |
| `playVolume(callId, params?)` | `calling.play.volume` | Yes |
| `record(callId, params?)` | `calling.record` | Yes |
| `recordPause(callId, params?)` | `calling.record.pause` | Yes |
| `recordResume(callId, params?)` | `calling.record.resume` | Yes |
| `recordStop(callId, params?)` | `calling.record.stop` | Yes |
| `collect(callId, params?)` | `calling.collect` | Yes |
| `collectStop(callId, params?)` | `calling.collect.stop` | Yes |
| `collectStartInputTimers(callId, params?)` | `calling.collect.start_input_timers` | Yes |
| `detect(callId, params?)` | `calling.detect` | Yes |
| `detectStop(callId, params?)` | `calling.detect.stop` | Yes |
| `tap(callId, params?)` | `calling.tap` | Yes |
| `tapStop(callId, params?)` | `calling.tap.stop` | Yes |
| `stream(callId, params?)` | `calling.stream` | Yes |
| `streamStop(callId, params?)` | `calling.stream.stop` | Yes |
| `denoise(callId, params?)` | `calling.denoise` | Yes |
| `denoiseStop(callId, params?)` | `calling.denoise.stop` | Yes |
| `transcribe(callId, params?)` | `calling.transcribe` | Yes |
| `transcribeStop(callId, params?)` | `calling.transcribe.stop` | Yes |
| `aiMessage(callId, params?)` | `calling.ai_message` | Yes |
| `aiHold(callId, params?)` | `calling.ai_hold` | Yes |
| `aiUnhold(callId, params?)` | `calling.ai_unhold` | Yes |
| `aiStop(callId, params?)` | `calling.ai.stop` | Yes |
| `liveTranscribe(callId, params?)` | `calling.live_transcribe` | Yes |
| `liveTranslate(callId, params?)` | `calling.live_translate` | Yes |
| `sendFaxStop(callId, params?)` | `calling.send_fax.stop` | Yes |
| `receiveFaxStop(callId, params?)` | `calling.receive_fax.stop` | Yes |
| `refer(callId, params?)` | `calling.refer` | Yes |
| `userEvent(callId, params?)` | `calling.user_event` | Yes |
