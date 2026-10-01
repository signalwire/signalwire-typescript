# All Namespaces

This page covers every namespace except Fabric and Calling, which have their own pages: [Fabric Resources](fabric.md) and [Calling Commands](calling.md). Every method is async, so `await` it. Every method also takes an optional `requestOptions` object as its last argument, as [Request Options](guide.md#request-options-timeout-retries-abort) describes.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context the fragments on this page assume: `client` is a constructed RestClient
// (see the Getting Started page). Declared here so each example can `await client.<ns>...`.
declare const client: import('@signalwire/sdk').RestClient;
```

## Phone Numbers

`client.phoneNumbers` lists, searches, purchases, updates and releases phone numbers:

```typescript
// List your phone numbers
let numbers = await client.phoneNumbers.list();
numbers = await client.phoneNumbers.list({ filter_name: 'Main' });

// Search available numbers to purchase
const available = await client.phoneNumbers.search({ areacode: '512', number_type: 'local' });

// Purchase a number
const number = await client.phoneNumbers.create({ number: '+15551234567' });

// Get / update / release
const found = await client.phoneNumbers.get('pn-uuid');
await client.phoneNumbers.update('pn-uuid', { name: 'Support Line' });
await client.phoneNumbers.delete('pn-uuid');
```

The SDK sends query parameters unchanged, so use the API's parameter names: `areacode` (all lowercase), `number_type` and `filter_name`, not `areaCode` or `numberType`. The `number_type` parameter selects `local` (the default) or toll-free numbers. To route a number's inbound calls, see [phone-binding.md](phone-binding.md).

## Messages

`client.messages.create` sends an SMS or MMS message. `to` and `from` are positional, and `body`, `media` and the other fields are options. `update` redacts a sent message, and its only accepted body is an empty string:

```typescript
const message = await client.messages.create('+15551234567', '+15559876543', {
  body: 'Your order has shipped.',
});
await client.messages.update(message.id, '');
```

## Addresses

`client.addresses` lists, creates, gets and deletes addresses:

```typescript
const addresses = await client.addresses.list();
// create takes positional required fields:
// (label, country, first_name, last_name, street_number, street_name, city, state, postal_code)
const address = await client.addresses.create(
  'Office', 'US', 'Jane', 'Doe', '123', 'Main St', 'Austin', 'TX', '78701',
);
const found = await client.addresses.get('addr-uuid');
await client.addresses.delete('addr-uuid');
```

## Queues

`client.queues` manages queues and reads their members:

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

`client.recordings` lists, gets and deletes recordings:

```typescript
const recordings = await client.recordings.list();
const recording = await client.recordings.get('rec-uuid');
await client.recordings.delete('rec-uuid');
```

## Number Groups

`client.numberGroups` manages number groups and their memberships:

```typescript
const groups = await client.numberGroups.list();
const group = await client.numberGroups.create({ name: 'Marketing' });
const found = await client.numberGroups.get('ng-uuid');
await client.numberGroups.update('ng-uuid', { name: 'Sales' });
await client.numberGroups.delete('ng-uuid');

// Memberships
const memberships = await client.numberGroups.listMemberships('ng-uuid');
await client.numberGroups.addMembership('ng-uuid', 'pn-uuid');
const membership = await client.numberGroups.getMembership('mem-uuid');
await client.numberGroups.deleteMembership('mem-uuid');
```

## Verified Caller IDs

`client.verifiedCallers` manages verified caller IDs and runs the verification flow:

```typescript
const callers = await client.verifiedCallers.list();
const caller = await client.verifiedCallers.create({
  number: '+15551234567',
  name: 'Office',
});
const found = await client.verifiedCallers.get('vc-uuid');
await client.verifiedCallers.update('vc-uuid', { name: 'Main Office' });
await client.verifiedCallers.delete('vc-uuid');

// Verification flow
await client.verifiedCallers.redialVerification('vc-uuid');
await client.verifiedCallers.submitVerification('vc-uuid', '123456');
```

## SIP Profile

Each project has one SIP profile, so `get()` and `update()` take no ID:

```typescript
const profile = await client.sipProfile.get();
await client.sipProfile.update({ domain_identifier: 'myproject', default_encryption: 'required' });
```

## Phone Number Lookup

`client.lookup.phoneNumber` looks up a number in E.164 format. The `include` parameter adds `carrier` or `cnam` information, or both:

```typescript
let info = await client.lookup.phoneNumber('+15551234567');
info = await client.lookup.phoneNumber('+15551234567', { include: 'carrier,cnam' });
```

The API reference describes some of the `include` lookups as billable.

## Short Codes

`client.shortCodes` lists, gets and updates short codes:

```typescript
const codes = await client.shortCodes.list();
const code = await client.shortCodes.get('sc-uuid');
// update takes positional (id, name, messageHandler) plus optional handler URLs
await client.shortCodes.update('sc-uuid', 'Alerts', 'laml_webhooks', {
  message_request_url: 'https://example.com/sms',
});
```

## Imported Phone Numbers

`client.importedNumbers.create` imports a number you host elsewhere:

```typescript
// create takes (number, number_type) positionally, with optional capabilities
await client.importedNumbers.create('+15559999999', 'longcode', {
  capabilities: ['sms', 'voice'],
});
```

## MFA (Multi-Factor Authentication)

`client.mfa` sends a verification code by SMS or phone call, then checks the code the user enters. The `message` option is text sent before the code:

```typescript
// Request a verification code via SMS; `to` is positional, and the rest are options
const result = await client.mfa.sms('+15551234567', {
  from: '+15559876543',
  message: 'Your verification code is:',
});
const requestId = result.id;

// Or via phone call
await client.mfa.call('+15551234567', {
  from: '+15559876543',
});

// Verify the code; requestId and token are positional
await client.mfa.verify(requestId, '123456');
```

## 10DLC Campaign Registry

`client.registry` registers 10DLC brands and campaigns, and assigns numbers to campaigns:

```typescript
// Brands; a self-registered (CSP) brand needs its approved TCR brand reference
const brands = await client.registry.brands.list();
const brand = await client.registry.brands.create({
  csp_self_registered: true,
  name: 'My Brand',
  csp_brand_reference: 'BRAND123',
});
const found = await client.registry.brands.get('brand-uuid');

// Campaigns under a brand (CSP/partner form needs the approved TCR campaign reference)
const campaigns = await client.registry.brands.listCampaigns('brand-uuid');
const campaign = await client.registry.brands.createCampaign('brand-uuid', {
  name: 'Alerts',
  brand_id: 'brand-uuid',
  csp_campaign_reference: 'CAMP123',
});

// Campaign management
const camp = await client.registry.campaigns.get('camp-uuid');
await client.registry.campaigns.update('camp-uuid', { name: 'Updated alerts' });

// Number assignments
const numbers = await client.registry.campaigns.listNumbers('camp-uuid');
const orders = await client.registry.campaigns.listOrders('camp-uuid');
const order = await client.registry.campaigns.createOrder('camp-uuid', { phone_numbers: ['pn-1'] });
const fetched = await client.registry.orders.get('order-uuid');
await client.registry.numbers.delete('number-assignment-uuid');
```

## Datasphere

`client.datasphere.documents` manages documents, runs semantic search and manages the chunks of each document:

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
const results = await client.datasphere.documents.search('How do I reset my password?', {
  tags: ['support'],
  count: 5,
});

// Chunks
const chunks = await client.datasphere.documents.listChunks('doc-uuid');
const chunk = await client.datasphere.documents.getChunk('doc-uuid', 'chunk-uuid');
await client.datasphere.documents.deleteChunk('doc-uuid', 'chunk-uuid');
```

## Video

`client.video` manages rooms, room tokens, sessions, recordings, conferences and streams:

```typescript
// Rooms
const rooms = await client.video.rooms.list();
const room = await client.video.rooms.create({ name: 'standup', max_members: 10 });
const found = await client.video.rooms.get('room-uuid');
await client.video.rooms.update('room-uuid', { max_members: 20 });
await client.video.rooms.delete('room-uuid');
await client.video.rooms.listStreams('room-uuid');
await client.video.rooms.createStream('room-uuid', 'rtmp://example.com/live');

// Room tokens (room_name positional, everything else in options)
const roomToken = await client.video.roomTokens.create('standup', { user_name: 'alice' });

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
const conf = await client.video.conferences.create({ name: 'all-hands', display_name: 'All Hands', quality: '720p' });
const conference = await client.video.conferences.get('conf-uuid');
await client.video.conferences.update('conf-uuid', { display_name: 'All Hands', quality: '1080p' });
await client.video.conferences.delete('conf-uuid');
const confTokens = await client.video.conferences.listConferenceTokens('conf-uuid');
await client.video.conferences.listStreams('conf-uuid');
await client.video.conferences.createStream('conf-uuid', 'rtmp://example.com/live');

// Conference tokens
const confToken = await client.video.conferenceTokens.get('token-uuid');
await client.video.conferenceTokens.reset('token-uuid');

// Streams
const stream = await client.video.streams.get('stream-uuid');
await client.video.streams.update('stream-uuid', 'rtmp://example.com/new');
await client.video.streams.delete('stream-uuid');
```

## Logs

The log endpoints are read-only. This example reads each kind of log:

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

`client.project.tokens` creates, updates and deletes API tokens. `create` takes the token name and its permissions positionally:

```typescript
const token = await client.project.tokens.create('ci-token', ['calling', 'messaging', 'numbers']);
await client.project.tokens.update('token-uuid', { name: 'renamed-token' });
await client.project.tokens.delete('token-uuid');
```

## Projects

`client.projects` manages projects and subprojects. The signing key is returned only by `create` and `rotateSigningKey`:

```typescript
const projects = await client.projects.list();
const project = await client.projects.create({ name: 'Staging' });
await client.projects.update(project.id, { name: 'Staging EU' });
const rotated = await client.projects.rotateSigningKey(project.id);
```

## PubSub Tokens

`client.pubsub.createToken` creates a PubSub token. The time to live (`ttl`) and the channel permissions are positional:

```typescript
const token = await client.pubsub.createToken(
  60,
  { updates: { read: true, write: false } },
  { member_id: 'user-123' },
);
```

## Chat Tokens

`client.chat.createToken` creates a Chat token with the same arguments:

```typescript
const token = await client.chat.createToken(
  60,
  { support: { read: true, write: true } },
  { member_id: 'user-123' },
);
```
