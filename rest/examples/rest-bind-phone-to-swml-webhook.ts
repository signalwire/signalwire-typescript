/**
 * REST Example: Bind an inbound phone number to an SWML webhook (the happy path).
 *
 * This is the simplest way to route a SignalWire phone number to a backend
 * that returns an SWML document per inbound call. You set `call_handler`
 * on the phone number; the server auto-materializes a `swml_webhook`
 * Fabric resource pointing at your URL. You do **not** need to create the
 * Fabric webhook resource manually; you do **not** call `assignPhoneRoute`.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *   export PHONE_NUMBER_SID=pn-...             # SID of a phone number you own
 *   export SWML_WEBHOOK_URL=https://...        # your backend's SWML endpoint
 *
 * Run:
 *   npx tsx rest/examples/rest-bind-phone-to-swml-webhook.ts
 */

import { RestClient, PhoneCallHandler } from '../../src/index.js';

async function main(): Promise<void> {
  const pnSid = process.env['PHONE_NUMBER_SID'];
  const webhookUrl = process.env['SWML_WEBHOOK_URL'];
  if (!pnSid || !webhookUrl) {
    throw new Error('Set PHONE_NUMBER_SID and SWML_WEBHOOK_URL.');
  }

  const client = new RestClient();

  // The typed helper — one line:
  console.log(`Binding ${pnSid} to ${webhookUrl} ...`);
  await client.phoneNumbers.setSwmlWebhook(pnSid, webhookUrl);

  // The equivalent wire-level form (use this if you need unusual fields):
  //
  // await client.phoneNumbers.update(pnSid, {
  //   call_handler: PhoneCallHandler.RELAY_SCRIPT,
  //   call_relay_script_url: webhookUrl,
  // });

  // Verify: the server auto-created a swml_webhook Fabric resource.
  const pn = await client.phoneNumbers.get(pnSid);
  console.log(`  call_handler = ${JSON.stringify(pn.call_handler)}`);
  console.log(`  call_relay_script_url = ${JSON.stringify(pn.call_relay_script_url)}`);
  console.log(
    `  calling_handler_resource_id (server-derived) = ${JSON.stringify(pn.calling_handler_resource_id)}`,
  );

  // To route to something other than an SWML webhook, use:
  //   client.phoneNumbers.setCxmlWebhook(sid, { url })          // LAML / Twilio-compat
  //   client.phoneNumbers.setAiAgent(sid, agentId)              // AI Agent
  //   client.phoneNumbers.setCallFlow(sid, { flowId })          // Call Flow
  //   client.phoneNumbers.setRelayApplication(sid, name)        // Named RELAY app
  //   client.phoneNumbers.setRelayTopic(sid, { topic })         // RELAY topic

  // Keep PhoneCallHandler referenced so eslint/tsc don't strip it from the
  // illustrative "wire-level form" comment above.
  void PhoneCallHandler;
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
