# Binding a phone number to a call handler

To route an inbound phone number to an SWML webhook, a cXML application, an AI agent or a call flow, you configure the phone number. You don't configure the Fabric resource. For the common handlers, you don't create the Fabric resource yourself. Read this page before you write code that creates webhook, agent or call flow resources by hand.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
// Shared context the fragments on this page assume (constructed on the Getting Started page).
declare const client: import('@signalwire/sdk').RestClient;
declare const pnId: string; // a phone-number SID
```

## How binding works

A phone number has a `call_handler` field that selects what handles its inbound calls. Binding a number takes these steps:

1. You update the phone number (`PUT /api/relay/rest/phone_numbers/{id}`) with a `call_handler` value and that handler's companion field, such as a URL or an ID.
2. For the handlers that have one, the server creates the matching Fabric resource from the URL or ID you supplied.

You rarely need to create a Fabric webhook resource directly. A webhook resource that no phone number points at routes no calls.

## The `PhoneCallHandler` values

`PhoneCallHandler` holds the `call_handler` values. Import it from the top-level SDK entry point:

```ts
import { PhoneCallHandler } from '@signalwire/sdk';
```

The table lists each value, its companion field and the Fabric resource the server creates for it:

| `PhoneCallHandler` | `call_handler` wire value | Required companion field | Fabric resource created |
|---|---|---|---|
| `RELAY_SCRIPT` | `relay_script` | `call_relay_script_url` | `swml_webhook` |
| `LAML_WEBHOOKS` | `laml_webhooks` | `call_request_url` | `cxml_webhook` |
| `LAML_APPLICATION` | `laml_application` | `call_laml_application_id` | `cxml_application` |
| `AI_AGENT` | `ai_agent` | `call_ai_agent_id` | `ai_agent` |
| `CALL_FLOW` | `call_flow` | `call_flow_id` | `call_flow` |
| `RELAY_APPLICATION` | `relay_application` | `call_relay_application` | `relay_application` |
| `RELAY_TOPIC` | `relay_topic` | `call_relay_topic` | None (routes to a RELAY client) |
| `RELAY_CONTEXT` | `relay_context` | `call_relay_context` | None (legacy; use `RELAY_TOPIC`) |
| `RELAY_CONNECTOR` | `relay_connector` | Connector configuration | None (internal) |
| `VIDEO_ROOM` | `video_room` | `call_video_room_id` | None (routes to the Video API) |
| `DIALOGFLOW` | `dialogflow` | `call_dialogflow_agent_id` | None |

The `LAML_WEBHOOKS` value (`laml_webhooks`) produces a cXML (Twilio-compatible) handler, not an SWML webhook, even though its name says "webhooks". For SWML, use `RELAY_SCRIPT`.

The type is named `PhoneCallHandler`, not `CallHandler`, because the RELAY client already exports a `CallHandler` type for inbound-call callbacks.

A phone number response can include `calling_handler_resource_id`. The server sets it from the handler you chose, so don't set it in an update.

## Typed helpers on `phoneNumbers`

Each helper calls `phoneNumbers.update` with the right `call_handler` value and companion field. This example shows every helper:

```ts
// SWML webhook: your backend returns SWML for each call
await client.phoneNumbers.setSwmlWebhook(pnId, 'https://example.com/swml');

// cXML (Twilio-compatible) webhook; fallback_url and status_callback_url are optional positionals
await client.phoneNumbers.setCxmlWebhook(
  pnId,
  'https://example.com/voice.xml',
  'https://example.com/fallback.xml', // optional fallback_url
  'https://example.com/status', // optional status_callback_url
);

// An existing cXML application, by ID
await client.phoneNumbers.setCxmlApplication(pnId, 'app-uuid');

// An AI agent, by ID (created with fabric.aiAgents)
await client.phoneNumbers.setAiAgent(pnId, 'agent-uuid');

// A call flow; the optional version is 'working_copy' or 'current_deployed'
await client.phoneNumbers.setCallFlow(pnId, 'flow-uuid', 'current_deployed');

// A RELAY application, by name
await client.phoneNumbers.setRelayApplication(pnId, 'my-relay-app');

// A RELAY topic; topic is positional, and a status callback URL is optional
await client.phoneNumbers.setRelayTopic(pnId, 'office');
```

Each helper returns the updated phone number. Every helper also takes an optional `extra` object, merged into the request body, and a final `requestOptions` argument.

The wire-level form sets the same fields through `update()`. Use it when you need a combination the helpers don't cover:

```ts
import { PhoneCallHandler } from '@signalwire/sdk';

await client.phoneNumbers.update(pnId, {
  call_handler: PhoneCallHandler.RELAY_SCRIPT, // or the raw string 'relay_script'
  call_relay_script_url: 'https://example.com/swml',
});
```

## Don't pre-create the webhook resource

This example shows the approach to avoid. It creates an SWML webhook resource and then tries to attach it with `assignPhoneRoute`:

```ts
// Avoid: the resource isn't bound to any phone number
const webhook = await client.fabric.swmlWebhooks.create({
  name: 'my-webhook',
  primary_request_url: 'https://example.com/swml',
});
// assignPhoneRoute takes (resourceId, phone_route_id, handler), and a phone
// route ID isn't a phone number SID
await client.fabric.resources.assignPhoneRoute(webhook.id, 'phone-route-uuid', 'calling');
```

The `fabric.swmlWebhooks.create` and `fabric.cxmlWebhooks.create` methods work, and the SDK doesn't warn about them. They don't bind a number, though. Call `phoneNumbers.setSwmlWebhook` (or `update`) instead, and the server creates the Fabric resource for you.

`client.fabric.resources.assignPhoneRoute(...)` posts to `/api/fabric/resources/{id}/phone_routes`. It isn't needed for the handlers in the [`PhoneCallHandler` table](#the-phonecallhandler-values).

For a runnable version of the recommended flow, see [rest-bind-phone-to-swml-webhook.ts](../examples/rest-bind-phone-to-swml-webhook.ts).
