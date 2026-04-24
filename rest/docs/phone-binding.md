# Binding a phone number to a call handler

Routing an inbound phone number to something — an SWML webhook, a cXML app, an AI Agent, a call flow — is configured on the **phone number**, not on the Fabric resource. Fabric resources are *derived representations* of bindings configured on adjacent entities. Read this page before writing code that creates webhook/agent/flow resources manually; for the common cases, you don't need to.

## The mental model

A phone number has a `call_handler` field that chooses what to do with inbound calls. Setting `call_handler` (together with its handler-specific required field) triggers the server to materialize the appropriate Fabric resource automatically.

```
┌────────────────────────┐      sets       ┌──────────────────────────┐
│ PUT /phone_numbers/X   │────────────────▶│ call_handler +           │
│ (you call this)        │                 │ handler-specific URL/ID  │
└────────────────────────┘                 └──────────────────────────┘
                                                        │
                                                        ▼
                                       ┌──────────────────────────────┐
                                       │ Fabric resource materializes │
                                       │ automatically, keyed off the │
                                       │ URL or ID you supplied       │
                                       └──────────────────────────────┘
```

You rarely create a Fabric webhook resource directly. Doing so without binding a phone number to it leaves an orphan; `fabric.swmlWebhooks.create` and `fabric.cxmlWebhooks.create` in this SDK emit a deprecation warning pointing at the helpers below.

## The `PhoneCallHandler` enum

The authoritative list of handler values. Import from the top-level SDK entrypoint:

```ts
import { PhoneCallHandler } from '@signalwire/sdk';
```

| `PhoneCallHandler` | `call_handler` wire value | Required companion field | Auto-materializes Fabric resource |
|---|---|---|---|
| `RELAY_SCRIPT` | `relay_script` | `call_relay_script_url` | `swml_webhook` |
| `LAML_WEBHOOKS` | `laml_webhooks` | `call_request_url` | `cxml_webhook` |
| `LAML_APPLICATION` | `laml_application` | `call_laml_application_id` | `cxml_application` |
| `AI_AGENT` | `ai_agent` | `call_ai_agent_id` | `ai_agent` |
| `CALL_FLOW` | `call_flow` | `call_flow_id` | `call_flow` |
| `RELAY_APPLICATION` | `relay_application` | `call_relay_application` | `relay_application` |
| `RELAY_TOPIC` | `relay_topic` | `call_relay_topic` | *(no Fabric resource — routes via RELAY client)* |
| `RELAY_CONTEXT` | `relay_context` | `call_relay_context` | *(no Fabric resource — legacy; prefer `RELAY_TOPIC`)* |
| `RELAY_CONNECTOR` | `relay_connector` | *(connector config)* | *(internal)* |
| `VIDEO_ROOM` | `video_room` | `call_video_room_id` | *(no Fabric resource — routes to Video API)* |
| `DIALOGFLOW` | `dialogflow` | `call_dialogflow_agent_id` | *(no Fabric resource)* |

**Naming note on `LAML_WEBHOOKS`:** the wire value is plural and contains "webhooks", but it produces a **cXML** (Twilio-compat) handler — not a generic webhook, not an SWML webhook. For SWML, use `RELAY_SCRIPT`. The dashboard labels these resources "cXML Webhook" after assignment.

**Naming note on `PhoneCallHandler`:** the enum is deliberately **not** named `CallHandler` — that symbol is already used by the RELAY client (`src/relay/types.ts`) as an inbound-call callback type.

**`calling_handler_resource_id`** (where present in responses) is **server-derived** and read-only. Don't try to set it on update; the server computes it from the handler you chose.

## Typed helpers on `phoneNumbers`

Every helper is a one-line wrapper over `phoneNumbers.update` with the right `call_handler` value and companion field already set.

```ts
// SWML webhook (the common case — your backend returns SWML per call)
await client.phoneNumbers.setSwmlWebhook(pnId, 'https://example.com/swml');

// cXML / LAML webhook (Twilio-compat)
await client.phoneNumbers.setCxmlWebhook(pnId, {
  url: 'https://example.com/voice.xml',
  fallbackUrl: 'https://example.com/fallback.xml',      // optional
  statusCallbackUrl: 'https://example.com/status',      // optional
});

// Existing cXML application by ID
await client.phoneNumbers.setCxmlApplication(pnId, 'app-uuid');

// AI Agent by ID (agent created via fabric.aiAgents or AgentBase)
await client.phoneNumbers.setAiAgent(pnId, 'agent-uuid');

// Call flow (optionally pin a version — default is current_deployed)
await client.phoneNumbers.setCallFlow(pnId, {
  flowId: 'flow-uuid',
  version: 'current_deployed',
});

// Relay application (named routing)
await client.phoneNumbers.setRelayApplication(pnId, 'my-relay-app');

// Relay topic (RELAY client subscription)
await client.phoneNumbers.setRelayTopic(pnId, { topic: 'office' });
```

All helpers return the updated phone number representation. All are thin wrappers over the single underlying `phoneNumbers.update(sid, { call_handler, ... })` call; use the update form directly when you need an unusual combination.

The wire-level form is always available:

```ts
await client.phoneNumbers.update(pnId, {
  call_handler: PhoneCallHandler.RELAY_SCRIPT, // or the raw string 'relay_script'
  call_relay_script_url: 'https://example.com/swml',
});
```

## What NOT to do

### Don't pre-create the webhook resource

```ts
// WRONG — orphan resource, does nothing. Emits a deprecation warning.
const webhook = await client.fabric.swmlWebhooks.create({
  name: 'my-webhook',
  primary_request_url: 'https://example.com/swml',
});
await client.fabric.resources.assignPhoneRoute(webhook.id, { phone_number_id: pnId });
// ↑ returns 404 / 422 depending on body shape
```

The `swmlWebhooks.create` and `cxmlWebhooks.create` endpoints exist historically but are not how you bind a number. The Fabric resource is materialized as a side-effect of `phoneNumbers.update`; there's nothing to attach.

### `assignPhoneRoute` is narrow and deprecated for the common case

`client.fabric.resources.assignPhoneRoute(...)` posts to `/api/fabric/resources/{id}/phone_routes`. It applies only to a few legacy resource types that accept phone-route attachment as a separate step (the authoritative list lives in the OpenAPI spec at `rest-apis/relay-rest/openapi.yaml`). It **does not work** for `swml_webhook`, `cxml_webhook`, or `ai_agent` — those use the derivation model above. This SDK keeps the method for backwards compatibility but emits a one-time deprecation warning on first call.

## Summary

- Bindings live on `phoneNumbers`, not on Fabric resources.
- Set `call_handler` + the one handler-specific field; the server materializes the resource for you.
- Use the typed `phoneNumbers.set*` helpers — they document the enum values inline.
- `swml_webhook` and `cxml_webhook` Fabric resources are auto-materialized. Don't manually create them.
- `laml_webhooks` produces a **cXML** handler despite the name. Use `RELAY_SCRIPT` for SWML.
- `assignPhoneRoute` is narrow and not needed for the common handlers.
