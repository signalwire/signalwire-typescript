# Fabric Resources

The Fabric API (`/api/fabric`) manages the resources in your SignalWire project: AI agents, SWML scripts, subscribers, call flows and others. Most resource types support CRUD operations and address listing. Every method is async, so `await` it.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context the fragments on this page assume (constructed on the Getting Started page).
declare const client: import('@signalwire/sdk').RestClient;
declare const pnId: string; // a phone-number SID
```

## Standard CRUD Pattern

The CRUD resource types share the same methods. This example runs each of them on AI agents:

```typescript
// List all resources of this type
let items = await client.fabric.aiAgents.list();
items = await client.fabric.aiAgents.list({ page_number: 2, page_size: 10 });

// Create a new resource
const agent = await client.fabric.aiAgents.create({
  name: 'Support Bot',
  prompt: { text: 'You are a helpful support agent.' },
});

// Get a resource by ID
const found = await client.fabric.aiAgents.get('agent-uuid');

// Update a resource
await client.fabric.aiAgents.update('agent-uuid', { name: 'Updated Name' });

// Delete a resource
await client.fabric.aiAgents.delete('agent-uuid');

// List addresses assigned to this resource
const addresses = await client.fabric.aiAgents.listAddresses('agent-uuid');
```

`list()` returns one page. To walk every page, iterate `paginate()`, for example `for await (const agent of client.fabric.aiAgents.paginate())`. `cxmlApplications` and `resources` have no `paginate()`.

`client.fabric` has 16 sub-resources. Thirteen are CRUD resource types, which use one of two update methods. The other three are `resources` (generic), `addresses` and `tokens`, covered later on this page.

### PUT-Update Resources

These resources send `update()` as a `PUT` (full replacement):

| Accessor | API Path |
|-----------|----------|
| `fabric.swmlScripts` | `/api/fabric/resources/swml_scripts` |
| `fabric.relayApplications` | `/api/fabric/resources/relay_applications` |
| `fabric.callFlows` | `/api/fabric/resources/call_flows` |
| `fabric.conferenceRooms` | `/api/fabric/resources/conference_rooms` |
| `fabric.freeswitchConnectors` | `/api/fabric/resources/freeswitch_connectors` |
| `fabric.subscribers` | `/api/fabric/resources/subscribers` |
| `fabric.sipEndpoints` | `/api/fabric/resources/sip_endpoints` |
| `fabric.cxmlScripts` | `/api/fabric/resources/cxml_scripts` |
| `fabric.cxmlApplications` | `/api/fabric/resources/cxml_applications` |

### PATCH-Update Resources

These resources send `update()` as a `PATCH` (partial update):

| Accessor | API Path | Notes |
|-----------|----------|-------|
| `fabric.swmlWebhooks` | `/api/fabric/resources/swml_webhooks` | Also created by the platform when you call `phoneNumbers.setSwmlWebhook(sid, url)`. See [phone-binding.md](phone-binding.md). |
| `fabric.aiAgents` | `/api/fabric/resources/ai_agents` | Create one directly, then bind a number to it with `phoneNumbers.setAiAgent(sid, agentId)`. |
| `fabric.sipGateways` | `/api/fabric/resources/sip_gateways` | |
| `fabric.cxmlWebhooks` | `/api/fabric/resources/cxml_webhooks` | Also created by the platform when you call `phoneNumbers.setCxmlWebhook(sid, url)`. This is the cXML (Twilio-compatible) handler, although its `call_handler` wire value is `laml_webhooks`. |

## Call Flows: Extra Methods

Call flows support version management. `deployVersion` takes either a `document_version` or a `call_flow_version_id`:

```typescript
// List all versions of a call flow
const versions = await client.fabric.callFlows.listVersions('call-flow-uuid');

// Deploy a version
await client.fabric.callFlows.deployVersion('call-flow-uuid', { document_version: 3 });
```

## Subscribers: SIP Endpoints

Subscribers have nested SIP endpoint management. `createSipEndpoint` takes the username and password positionally:

```typescript
// List a subscriber's SIP endpoints
const endpoints = await client.fabric.subscribers.listSipEndpoints('subscriber-uuid');

// Create a SIP endpoint for a subscriber (username and password are positional)
const endpoint = await client.fabric.subscribers.createSipEndpoint('subscriber-uuid', 'user1', 'secret', {
  caller_id: '+15551234567',
});

// Get a specific SIP endpoint
const found = await client.fabric.subscribers.getSipEndpoint('subscriber-uuid', 'endpoint-uuid');

// Update a SIP endpoint (uses PATCH)
await client.fabric.subscribers.updateSipEndpoint('subscriber-uuid', 'endpoint-uuid', {
  caller_id: '+15559876543',
});

// Delete a SIP endpoint
await client.fabric.subscribers.deleteSipEndpoint('subscriber-uuid', 'endpoint-uuid');
```

## cXML Applications

cXML applications support list, get, update and delete. The class has no `create()` method, so a call to it fails to compile:

```typescript
const apps = await client.fabric.cxmlApplications.list();
const app = await client.fabric.cxmlApplications.get('app-uuid');
await client.fabric.cxmlApplications.update('app-uuid', { voice_url: 'https://example.com/voice' });
await client.fabric.cxmlApplications.delete('app-uuid');
```

## Generic Resources

`client.fabric.resources` operates on a resource of any type by its ID:

```typescript
// List all resources across all types
const allResources = await client.fabric.resources.list();

// Get any resource by ID
const resource = await client.fabric.resources.get('resource-uuid');

// Delete any resource
await client.fabric.resources.delete('resource-uuid');

// List addresses for any resource
const addresses = await client.fabric.resources.listAddresses('resource-uuid');

// Assign a resource as a domain application handler
await client.fabric.resources.assignDomainApplication('resource-uuid', 'da-uuid');
```

### `assignPhoneRoute` is not how you bind a phone number

`client.fabric.resources.assignPhoneRoute(id, phone_route_id, handler)` posts to `/api/fabric/resources/{id}/phone_routes`. The `handler` is `'calling'` or `'messaging'`. This method doesn't bind a phone number to an SWML webhook, a cXML webhook or an AI agent. You configure those bindings on the phone number, as [phone-binding.md](phone-binding.md) describes.

## Binding a phone number to a handler

[phone-binding.md](phone-binding.md) covers the `PhoneCallHandler` values, the Fabric resource each one produces and the typed `phoneNumbers.set*` helpers. The common case routes a number to an SWML webhook:

```typescript
// SWML webhook (your backend returns SWML per call)
await client.phoneNumbers.setSwmlWebhook(pnId, 'https://example.com/swml');
```

## Fabric Addresses

`client.fabric.addresses` gives read-only access to all Fabric addresses. `list()` accepts filters such as `type`, `display_name` and `name`:

```typescript
// List all addresses, filtered by type
const addresses = await client.fabric.addresses.list({ type: 'room' });

// Get a specific address
const address = await client.fabric.addresses.get('address-uuid');
```

## Tokens

`client.fabric.tokens` creates tokens for subscribers, guests, invites and embeds. The `expire_at` and `expires_at` options are Unix times in seconds:

```typescript
// Subscriber token; `reference` is positional, and the rest are options
const subscriberToken = await client.fabric.tokens.createSubscriberToken('user@example.com', {
  password: 'a-long-random-password',
});

// Refresh a subscriber token; the refresh token is positional
const refreshed = await client.fabric.tokens.refreshSubscriberToken('existing-refresh-token');

// Guest token; `allowed_addresses` is positional
const guestToken = await client.fabric.tokens.createGuestToken(
  ['address-uuid-1', 'address-uuid-2'],
  { expire_at: 1767225599 },
);

// Subscriber invite token; `address_id` is positional
const inviteToken = await client.fabric.tokens.createInviteToken('address-uuid', {
  expires_at: 1767225599,
});

// Click-to-call embed token; the source token is positional
const embedToken = await client.fabric.tokens.createEmbedToken('embed-source-token');
```
