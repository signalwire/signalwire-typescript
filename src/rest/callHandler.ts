/**
 * PhoneCallHandler — enum of `call_handler` values accepted by
 * {@link PhoneNumbersResource.update}.
 *
 * Named `PhoneCallHandler` (not `CallHandler`) to avoid colliding with the
 * RELAY client's inbound-call-handler callback type already exported from
 * `src/relay/types.ts`.
 *
 * Setting a phone number's `call_handler` + the handler-specific companion
 * field routes inbound calls and auto-materializes the matching Fabric
 * resource on the server. See the high-level helpers on
 * {@link PhoneNumbersResource} (`setSwmlWebhook`, `setCxmlWebhook`,
 * `setCxmlApplication`, `setAiAgent`, `setCallFlow`, `setRelayApplication`,
 * `setRelayTopic`).
 *
 * | Member | Wire value | Companion field | Auto-creates Fabric resource |
 * |---|---|---|---|
 * | `RELAY_SCRIPT` | `relay_script` | `call_relay_script_url` | `swml_webhook` |
 * | `LAML_WEBHOOKS` | `laml_webhooks` | `call_request_url` | `cxml_webhook` |
 * | `LAML_APPLICATION` | `laml_application` | `call_laml_application_id` | `cxml_application` |
 * | `AI_AGENT` | `ai_agent` | `call_ai_agent_id` | `ai_agent` |
 * | `CALL_FLOW` | `call_flow` | `call_flow_id` | `call_flow` |
 * | `RELAY_APPLICATION` | `relay_application` | `call_relay_application` | `relay_application` |
 * | `RELAY_TOPIC` | `relay_topic` | `call_relay_topic` | *(routes via RELAY)* |
 * | `RELAY_CONTEXT` | `relay_context` | `call_relay_context` | *(legacy, prefer topic)* |
 * | `RELAY_CONNECTOR` | `relay_connector` | *(connector config)* | *(internal)* |
 * | `VIDEO_ROOM` | `video_room` | `call_video_room_id` | *(routes to Video API)* |
 * | `DIALOGFLOW` | `dialogflow` | `call_dialogflow_agent_id` | *(none)* |
 *
 * Note: `LAML_WEBHOOKS` (wire value `laml_webhooks`) produces a **cXML**
 * handler, not a generic webhook. For SWML, use `RELAY_SCRIPT`.
 *
 * @example
 * ```ts
 * import { PhoneCallHandler } from '@signalwire/sdk';
 *
 * await client.phoneNumbers.update(pnSid, {
 *   call_handler: PhoneCallHandler.RELAY_SCRIPT,
 *   call_relay_script_url: 'https://example.com/swml',
 * });
 *
 * // Or use the typed helper:
 * await client.phoneNumbers.setSwmlWebhook(pnSid, 'https://example.com/swml');
 * ```
 */
export const PhoneCallHandler = {
  RELAY_SCRIPT: 'relay_script',
  LAML_WEBHOOKS: 'laml_webhooks',
  LAML_APPLICATION: 'laml_application',
  AI_AGENT: 'ai_agent',
  CALL_FLOW: 'call_flow',
  RELAY_APPLICATION: 'relay_application',
  RELAY_TOPIC: 'relay_topic',
  RELAY_CONTEXT: 'relay_context',
  RELAY_CONNECTOR: 'relay_connector',
  VIDEO_ROOM: 'video_room',
  DIALOGFLOW: 'dialogflow',
} as const;

/** Union of every valid `call_handler` wire value. */
export type PhoneCallHandler = typeof PhoneCallHandler[keyof typeof PhoneCallHandler];
