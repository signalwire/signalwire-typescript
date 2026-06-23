# Compatibility API

The Compatibility API provides a Twilio-compatible LAML surface at `/api/laml/2010-04-01`. All paths are scoped under `/Accounts/{AccountSid}`, where AccountSid is your project ID. All methods are async — `await` them.

Body field names follow the Twilio-compatible (PascalCase) convention — `To`, `From`, `Url`, `FriendlyName`, etc. — because that is the wire format the LAML API expects.

## Sub-Resources

| Property | Description |
|-----------|-------------|
| `compat.accounts` | Account/subproject management |
| `compat.calls` | Call management + recordings + streams |
| `compat.messages` | SMS/MMS management + media |
| `compat.faxes` | Fax management + media |
| `compat.conferences` | Conference management + participants + recordings + streams |
| `compat.phoneNumbers` | Incoming + available phone numbers |
| `compat.applications` | Application management |
| `compat.lamlBins` | cXML/LaML script management |
| `compat.queues` | Queue management + members |
| `compat.recordings` | Recording management |
| `compat.transcriptions` | Transcription management |
| `compat.tokens` | API token management |

## Accounts

```typescript
// List accounts/subprojects
const accounts = await client.compat.accounts.list();

// Create a subproject
const sub = await client.compat.accounts.create({ FriendlyName: 'My Subproject' });

// Get/update an account
const account = await client.compat.accounts.get('AC-sid');
await client.compat.accounts.update('AC-sid', { FriendlyName: 'Updated' });
```

## Calls

```typescript
// List calls
const calls = await client.compat.calls.list({ From: '+15551234567' });

// Create a call
const call = await client.compat.calls.create({
  To: '+15552222222',
  From: '+15551111111',
  Url: 'https://example.com/twiml',
});

// Get / update / delete
const found = await client.compat.calls.get('CA-sid');
await client.compat.calls.update('CA-sid', { Status: 'completed' });
await client.compat.calls.delete('CA-sid');

// Start/update recording on a call
await client.compat.calls.startRecording('CA-sid', { channels: 'dual' });
await client.compat.calls.updateRecording('CA-sid', 'RE-sid', { Status: 'paused' });

// Start/stop stream on a call
await client.compat.calls.startStream('CA-sid', { Url: 'wss://example.com/stream' });
await client.compat.calls.stopStream('CA-sid', 'ST-sid');
```

## Messages

```typescript
// Send an SMS
const msg = await client.compat.messages.create({
  To: '+15552222222',
  From: '+15551111111',
  Body: 'Hello from SignalWire!',
});

// List / get / update / delete
const messages = await client.compat.messages.list();
const found = await client.compat.messages.get('SM-sid');
await client.compat.messages.update('SM-sid', { Body: '' }); // redact
await client.compat.messages.delete('SM-sid');

// Media sub-resources
const media = await client.compat.messages.listMedia('SM-sid');
const item = await client.compat.messages.getMedia('SM-sid', 'ME-sid');
await client.compat.messages.deleteMedia('SM-sid', 'ME-sid');
```

## Faxes

```typescript
// Send a fax
const fax = await client.compat.faxes.create({
  MediaUrl: 'https://example.com/doc.pdf',
  To: '+15552222222',
  From: '+15551111111',
});

// List / get / cancel / delete
const faxes = await client.compat.faxes.list();
const found = await client.compat.faxes.get('FX-sid');
await client.compat.faxes.update('FX-sid', { Status: 'canceled' });
await client.compat.faxes.delete('FX-sid');

// Media sub-resources
const media = await client.compat.faxes.listMedia('FX-sid');
const item = await client.compat.faxes.getMedia('FX-sid', 'ME-sid');
await client.compat.faxes.deleteMedia('FX-sid', 'ME-sid');
```

## Conferences

```typescript
// List / get / update
const conferences = await client.compat.conferences.list();
const conf = await client.compat.conferences.get('CF-sid');
await client.compat.conferences.update('CF-sid', { Status: 'completed' });

// Participants
const participants = await client.compat.conferences.listParticipants('CF-sid');
const p = await client.compat.conferences.getParticipant('CF-sid', 'CA-sid');
await client.compat.conferences.updateParticipant('CF-sid', 'CA-sid', { Muted: true });
await client.compat.conferences.removeParticipant('CF-sid', 'CA-sid');

// Conference recordings
const recs = await client.compat.conferences.listRecordings('CF-sid');
const rec = await client.compat.conferences.getRecording('CF-sid', 'RE-sid');
await client.compat.conferences.updateRecording('CF-sid', 'RE-sid', { Status: 'stopped' });
await client.compat.conferences.deleteRecording('CF-sid', 'RE-sid');

// Conference streams
await client.compat.conferences.startStream('CF-sid', { Url: 'wss://example.com/stream' });
await client.compat.conferences.stopStream('CF-sid', 'ST-sid');
```

## Phone Numbers

```typescript
// List purchased numbers
const numbers = await client.compat.phoneNumbers.list();

// Search available numbers
const local = await client.compat.phoneNumbers.searchLocal('US', { AreaCode: '512' });
const tollFree = await client.compat.phoneNumbers.searchTollFree('US');
const countries = await client.compat.phoneNumbers.listAvailableCountries();

// Purchase / get / update / release
const num = await client.compat.phoneNumbers.purchase({ PhoneNumber: '+15551234567' });
const found = await client.compat.phoneNumbers.get('PN-sid');
await client.compat.phoneNumbers.update('PN-sid', { VoiceUrl: 'https://example.com/voice' });
await client.compat.phoneNumbers.delete('PN-sid');

// Import external number
await client.compat.phoneNumbers.importNumber({ PhoneNumber: '+15559999999' });
```

## Applications

```typescript
const apps = await client.compat.applications.list();
const app = await client.compat.applications.create({
  FriendlyName: 'My App',
  VoiceUrl: 'https://example.com/voice',
});
const found = await client.compat.applications.get('AP-sid');
await client.compat.applications.update('AP-sid', { VoiceUrl: 'https://example.com/new-voice' });
await client.compat.applications.delete('AP-sid');
```

## LaML Bins (cXML Scripts)

```typescript
const bins = await client.compat.lamlBins.list();
const b = await client.compat.lamlBins.create({
  Name: 'Greeting',
  Contents: '<Response><Say>Hello</Say></Response>',
});
const found = await client.compat.lamlBins.get('LB-sid');
await client.compat.lamlBins.update('LB-sid', { Contents: '<Response><Say>Updated</Say></Response>' });
await client.compat.lamlBins.delete('LB-sid');
```

## Queues

```typescript
const queues = await client.compat.queues.list();
const q = await client.compat.queues.create({ FriendlyName: 'Support', MaxSize: 100 });
const found = await client.compat.queues.get('QU-sid');
await client.compat.queues.update('QU-sid', { MaxSize: 200 });
await client.compat.queues.delete('QU-sid');

// Members
const members = await client.compat.queues.listMembers('QU-sid');
const member = await client.compat.queues.getMember('QU-sid', 'CA-sid');
await client.compat.queues.dequeueMember('QU-sid', 'CA-sid', { Url: 'https://example.com/dequeue' });
```

## Recordings & Transcriptions

```typescript
// Recordings
const recs = await client.compat.recordings.list();
const rec = await client.compat.recordings.get('RE-sid');
await client.compat.recordings.delete('RE-sid');

// Transcriptions
const txns = await client.compat.transcriptions.list();
const txn = await client.compat.transcriptions.get('TR-sid');
await client.compat.transcriptions.delete('TR-sid');
```

## Tokens

```typescript
const token = await client.compat.tokens.create({ name: 'my-token', permissions: ['calling', 'messaging'] });
await client.compat.tokens.update('token-id', { name: 'renamed' });
await client.compat.tokens.delete('token-id');
```
