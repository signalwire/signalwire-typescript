# All Namespaces

Reference for every namespace beyond Fabric, Calling, and Compat (which have their own pages). All methods are async — `await` them.

## Phone Numbers

```typescript
// List your phone numbers
let numbers = await client.phoneNumbers.list();
numbers = await client.phoneNumbers.list({ name: 'Main' });

// Search available numbers to purchase
const available = await client.phoneNumbers.search({ areaCode: '512', numberType: 'local' });

// Purchase a number
const number = await client.phoneNumbers.create({ number: '+15551234567' });

// Get / update / release
const found = await client.phoneNumbers.get('pn-uuid');
await client.phoneNumbers.update('pn-uuid', { name: 'Support Line' });
await client.phoneNumbers.delete('pn-uuid');
```

> Search filters are camelCase: use `areaCode`, not `area_code`.

## Addresses

```typescript
const addresses = await client.addresses.list();
const address = await client.addresses.create({
  label: 'Office',
  street: '123 Main St',
  city: 'Austin',
  state: 'TX',
});
const found = await client.addresses.get('addr-uuid');
await client.addresses.delete('addr-uuid');
```

## Queues

```typescript
const queues = await client.queues.list();
const queue = await client.queues.create({ name: 'Support' });
const found = await client.queues.get('q-uuid');
await client.queues.update('q-uuid', { name: 'VIP Support' });
await client.queues.delete('q-uuid');

// Members
const members = await client.queues.listMembers('q-uuid');
const nextMember = await client.queues.getNextMember('q-uuid');
const member = await client.queues.getMember('q-uuid', 'member-uuid');
```

## Recordings

```typescript
const recordings = await client.recordings.list();
const recording = await client.recordings.get('rec-uuid');
await client.recordings.delete('rec-uuid');
```

## Number Groups

```typescript
const groups = await client.numberGroups.list();
const group = await client.numberGroups.create({ name: 'Marketing' });
const found = await client.numberGroups.get('ng-uuid');
await client.numberGroups.update('ng-uuid', { name: 'Sales' });
await client.numberGroups.delete('ng-uuid');

// Memberships
const memberships = await client.numberGroups.listMemberships('ng-uuid');
await client.numberGroups.addMembership('ng-uuid', { phone_number_id: 'pn-uuid' });
const membership = await client.numberGroups.getMembership('mem-uuid');
await client.numberGroups.deleteMembership('mem-uuid');
```

## Verified Caller IDs

```typescript
const callers = await client.verifiedCallers.list();
const caller = await client.verifiedCallers.create({
  phone_number: '+15551234567',
  name: 'Office',
});
const found = await client.verifiedCallers.get('vc-uuid');
await client.verifiedCallers.update('vc-uuid', { name: 'Main Office' });
await client.verifiedCallers.delete('vc-uuid');

// Verification flow
await client.verifiedCallers.redialVerification('vc-uuid');
await client.verifiedCallers.submitVerification('vc-uuid', { code: '123456' });
```

## SIP Profile

Singleton resource -- no ID needed:

```typescript
const profile = await client.sipProfile.get();
await client.sipProfile.update({ username: 'myproject', password: 'newsecret' });
```

## Phone Number Lookup

```typescript
let info = await client.lookup.phoneNumber('+15551234567');
info = await client.lookup.phoneNumber('+15551234567', { include: 'carrier,cnam' });
```

Note: carrier and CNAM lookups are billable.

## Short Codes

```typescript
const codes = await client.shortCodes.list();
const code = await client.shortCodes.get('sc-uuid');
await client.shortCodes.update('sc-uuid', { name: 'Alerts' });
```

## Imported Phone Numbers

```typescript
await client.importedNumbers.create({ number: '+15559999999', carrier: 'external' });
```

## MFA (Multi-Factor Authentication)

```typescript
// Request a verification code via SMS
const result = await client.mfa.sms({
  to: '+15551234567',
  from: '+15559876543',
  message: 'Your code is {code}',
});
const requestId = result.id;

// Or via phone call
await client.mfa.call({
  to: '+15551234567',
  from: '+15559876543',
});

// Verify the code
await client.mfa.verify(requestId, { token: '123456' });
```

## 10DLC Campaign Registry

```typescript
// Brands
const brands = await client.registry.brands.list();
const brand = await client.registry.brands.create({ name: 'My Brand', ein: '12-3456789' });
const found = await client.registry.brands.get('brand-uuid');

// Campaigns under a brand
const campaigns = await client.registry.brands.listCampaigns('brand-uuid');
const campaign = await client.registry.brands.createCampaign('brand-uuid', { description: 'Alerts' });

// Campaign management
const camp = await client.registry.campaigns.get('camp-uuid');
await client.registry.campaigns.update('camp-uuid', { description: 'Updated alerts' });

// Number assignments
const numbers = await client.registry.campaigns.listNumbers('camp-uuid');
const orders = await client.registry.campaigns.listOrders('camp-uuid');
const order = await client.registry.campaigns.createOrder('camp-uuid', { phone_number_ids: ['pn-1'] });
const fetched = await client.registry.orders.get('order-uuid');
await client.registry.numbers.delete('number-assignment-uuid');
```

## Datasphere

```typescript
// Documents
const docs = await client.datasphere.documents.list();
const doc = await client.datasphere.documents.create({
  url: 'https://example.com/doc.pdf',
  tags: ['support'],
});
const found = await client.datasphere.documents.get('doc-uuid');
await client.datasphere.documents.update('doc-uuid', { tags: ['support', 'billing'] });
await client.datasphere.documents.delete('doc-uuid');

// Semantic search (the body keys are platform snake_case)
const results = await client.datasphere.documents.search({
  query_string: 'How do I reset my password?',
  tags: ['support'],
  count: 5,
});

// Chunks
const chunks = await client.datasphere.documents.listChunks('doc-uuid');
const chunk = await client.datasphere.documents.getChunk('doc-uuid', 'chunk-uuid');
await client.datasphere.documents.deleteChunk('doc-uuid', 'chunk-uuid');
```

## Video

```typescript
// Rooms
const rooms = await client.video.rooms.list();
const room = await client.video.rooms.create({ name: 'standup', max_members: 10 });
const found = await client.video.rooms.get('room-uuid');
await client.video.rooms.update('room-uuid', { max_members: 20 });
await client.video.rooms.delete('room-uuid');
await client.video.rooms.listStreams('room-uuid');
await client.video.rooms.createStream('room-uuid', { url: 'rtmp://example.com/live' });

// Room tokens
const roomToken = await client.video.roomTokens.create({ room_name: 'standup', user_name: 'alice' });

// Room sessions
const sessions = await client.video.roomSessions.list({ room_name: 'standup' });
const session = await client.video.roomSessions.get('session-uuid');
const events = await client.video.roomSessions.listEvents('session-uuid');
const members = await client.video.roomSessions.listMembers('session-uuid');
const sessionRecordings = await client.video.roomSessions.listRecordings('session-uuid');

// Room recordings
const recs = await client.video.roomRecordings.list();
const rec = await client.video.roomRecordings.get('rec-uuid');
await client.video.roomRecordings.delete('rec-uuid');
const recEvents = await client.video.roomRecordings.listEvents('rec-uuid');

// Conferences
const confs = await client.video.conferences.list();
const conf = await client.video.conferences.create({ name: 'all-hands', quality: '720p' });
const conference = await client.video.conferences.get('conf-uuid');
await client.video.conferences.update('conf-uuid', { quality: '1080p' });
await client.video.conferences.delete('conf-uuid');
const confTokens = await client.video.conferences.listConferenceTokens('conf-uuid');
await client.video.conferences.listStreams('conf-uuid');
await client.video.conferences.createStream('conf-uuid', { url: 'rtmp://example.com/live' });

// Conference tokens
const confToken = await client.video.conferenceTokens.get('token-uuid');
await client.video.conferenceTokens.reset('token-uuid');

// Streams
const stream = await client.video.streams.get('stream-uuid');
await client.video.streams.update('stream-uuid', { url: 'rtmp://example.com/new' });
await client.video.streams.delete('stream-uuid');
```

## Logs

All log endpoints are read-only.

```typescript
// Message logs
const messageLogs = await client.logs.messages.list({ include_deleted: true });
const messageLog = await client.logs.messages.get('log-uuid');

// Voice logs (with events)
const voiceLogs = await client.logs.voice.list();
const voiceLog = await client.logs.voice.get('log-uuid');
const voiceEvents = await client.logs.voice.listEvents('log-uuid');

// Fax logs
const faxLogs = await client.logs.fax.list();
const faxLog = await client.logs.fax.get('log-uuid');

// Conference logs
const conferenceLogs = await client.logs.conferences.list();
```

## Project Tokens

```typescript
const token = await client.project.tokens.create({
  name: 'ci-token',
  permissions: ['calling', 'messaging', 'numbers'],
});
await client.project.tokens.update('token-uuid', { name: 'renamed-token' });
await client.project.tokens.delete('token-uuid');
```

## PubSub Tokens

```typescript
const token = await client.pubsub.createToken({
  ttl: 60,
  channels: [{ name: 'updates', read: true, write: false }],
  member_id: 'user-123',
});
```

## Chat Tokens

```typescript
const token = await client.chat.createToken({
  ttl: 60,
  channels: [{ name: 'support', read: true, write: true }],
  member_id: 'user-123',
});
```
