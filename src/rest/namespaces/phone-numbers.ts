/**
 * Phone Numbers namespace — list, search, purchase, get, update, release, bind.
 *
 * Generated from the relay-rest OpenAPI spec (`relay-rest.resources.generated.ts`);
 * re-exported here (with the `PhoneNumbersResource` back-compat alias) so existing
 * imports keep working. The handler-binding helpers (`setSwmlWebhook`,
 * `setCxmlWebhook`, `setAiAgent`, `setCallFlow`, `setRelayApplication`,
 * `setRelayTopic`, `setCxmlApplication`) are the generated `set_methods` — each
 * sets a fixed `call_handler` value plus the handler-specific field, matching the
 * canonical spec markup (RULES §7).
 */

export {
  PhoneNumbers,
  PhoneNumbers as PhoneNumbersResource,
} from './relay-rest.resources.generated.js';
