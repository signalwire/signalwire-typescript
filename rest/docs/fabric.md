# Fabric Resources

The Fabric API (`/api/fabric`) manages all resource types in your SignalWire project. Most resource types support CRUD operations and address listing. All methods are async — `await` them.

## Standard CRUD Pattern

The resource types share the same methods:

```typescript
// List all resources of this type
let items = await client.fabric.aiAgents.list();
items = await client.fabric.aiAgents.list({ page: 2, page_size: 10 });

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

`client.fabric` exposes 16 sub-resources. They split into two update conventions:

### PUT-Update Resources

These resources use `PUT` for updates (full replacement):

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

These resources use `PATCH` for updates (partial update):

| Accessor | API Path | Notes |
|-----------|----------|-------|
| `fabric.swmlWebhooks` | `/api/fabric/resources/swml_webhooks` | **Auto-materialized.** Created as a side-effect of `phoneNumbers.setSwmlWebhook(sid, url)`. Do not create directly — see [phone-binding.md](phone-binding.md). |
| `fabric.aiAgents` | `/api/fabric/resources/ai_agents` | Can be created directly, or bind an existing one with `phoneNumbers.setAiAgent(sid, agentId)`. |
| `fabric.sipGateways` | `/api/fabric/resources/sip_gateways` | |
| `fabric.cxmlWebhooks` | `/api/fabric/resources/cxml_webhooks` | **Auto-materialized** by `phoneNumbers.setCxmlWebhook(sid, { url })`. Note: this is the **cXML (Twilio-compat)** handler — despite the `laml_webhooks` wire name. |

The remaining sub-resources are `resources` (generic), `addresses`, and `tokens`, covered below.

## Call Flows -- Extra Methods

Call flows support version management:

```typescript
// List all versions of a call flow
const versions = await client.fabric.callFlows.listVersions('call-flow-uuid');

// Deploy a new version
await client.fabric.callFlows.deployVersion('call-flow-uuid', { document_version: 3 });
```

## Subscribers -- SIP Endpoints

Subscribers have nested SIP endpoint management:

```typescript
// List subscriber's SIP endpoints
const endpoints = await client.fabric.subscribers.listSipEndpoints('subscriber-uuid');

// Create a SIP endpoint for a subscriber
const endpoint = await client.fabric.subscribers.createSipEndpoint('subscriber-uuid', {
  username: 'user1',
  password: 'secret',
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

cXML applications support list/get/update/delete but not create:

```typescript
const apps = await client.fabric.cxmlApplications.list();
const app = await client.fabric.cxmlApplications.get('app-uuid');
await client.fabric.cxmlApplications.update('app-uuid', { voice_url: 'https://example.com/voice' });
await client.fabric.cxmlApplications.delete('app-uuid');

// Calling .create() on this resource throws — cXML applications cannot be created via this API.
```

## Generic Resources

Operate on any resource type by ID:

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
await client.fabric.resources.assignDomainApplication('resource-uuid', {
  domain_application_id: 'da-uuid',
});
```

### `assignPhoneRoute` — narrow-use, not for the common case

This SDK exposes `client.fabric.resources.assignPhoneRoute(resourceId, ...)` which posts to `/api/fabric/resources/{id}/phone_routes`. **This does not bind a phone number to an SWML/cXML webhook or AI agent.** Those bindings are configured on the phone number (see [phone-binding.md](phone-binding.md)) and the Fabric resource is materialized automatically.

`assignPhoneRoute` applies only to a few legacy resource types that accept phone-route attachment as an explicit step; which types accept it is defined by the server and visible in `rest-apis/relay-rest/openapi.yaml`. Calling it against `swml_webhook` / `cxml_webhook` / `ai_agent` returns 404 or 422. The method still posts (for backwards compatibility) but emits a one-time deprecation warning on first call.

## Binding a phone number to a handler

See **[phone-binding.md](phone-binding.md)** for the `PhoneCallHandler` enum, the mapping from each handler value to its auto-materialized Fabric resource, and the typed `phoneNumbers.set*` helpers. The one-liner summary:

```typescript
// SWML webhook (your backend returns SWML per call)
await client.phoneNumbers.setSwmlWebhook(pnId, 'https://example.com/swml');
```

## Fabric Addresses

Read-only access to all fabric addresses:

```typescript
// List all addresses (filter by type or display_name)
const addresses = await client.fabric.addresses.list({ type: 'room' });

// Get a specific address
const address = await client.fabric.addresses.get('address-uuid');
```

## Tokens

Create tokens for subscribers, guests, invites, and embeds:

```typescript
// Subscriber token
const subscriberToken = await client.fabric.tokens.createSubscriberToken({
  reference: 'user@example.com',
  password: 'secret',
});

// Refresh a subscriber token
const refreshed = await client.fabric.tokens.refreshSubscriberToken({
  refresh_token: 'existing-refresh-token',
});

// Guest token
const guestToken = await client.fabric.tokens.createGuestToken({
  allowed_addresses: ['address-uuid-1', 'address-uuid-2'],
  expire_at: '2025-12-31T23:59:59Z',
});

// Subscriber invite token
const inviteToken = await client.fabric.tokens.createInviteToken({
  address_id: 'address-uuid',
  expires_at: '2025-12-31T23:59:59Z',
});

// Click-to-call embed token
const embedToken = await client.fabric.tokens.createEmbedToken({ token: 'embed-source-token' });
```
