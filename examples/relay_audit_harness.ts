/**
 * relay_audit_harness.ts
 *
 * Runtime probe driven by the porting-sdk's `audit_relay_handshake.py`.
 *
 * The audit fixture binds an ephemeral 127.0.0.1:NNNN port that speaks
 * just enough WebSocket + JSON-RPC 2.0 to drive a real RelayClient
 * through the documented happy-path:
 *
 *   1. Open WSS socket (proves real transport, not a stub)
 *   2. Send `signalwire.connect` with `params.project` populated
 *   3. Send `signalwire.subscribe` for the configured context(s)
 *   4. Receive a pushed `signalwire.event`
 *   5. Echo a `method: "signalwire.event"` frame back so the fixture
 *      can confirm dispatch happened
 *   6. Disconnect cleanly
 *
 * Environment (set by the audit fixture):
 *   - SIGNALWIRE_RELAY_HOST     `127.0.0.1:NNNN` (fixture bind port)
 *   - SIGNALWIRE_RELAY_SCHEME   `ws` (audit) or `wss` (production)
 *   - SIGNALWIRE_PROJECT_ID     `audit`
 *   - SIGNALWIRE_API_TOKEN      `audit`
 *   - SIGNALWIRE_CONTEXTS       `audit_ctx`
 *
 * Exits 0 on a clean run, 1 on any error. The audit's `state.upgrade_seen`
 * / `state.connect_request` / `state.subscribe_seen` /
 * `state.event_dispatched` flags must all be true at finish.
 */

import { RelayClient } from '../src/relay/RelayClient.js';

async function main(): Promise<void> {
  // Quiet the SDK so the audit fixture can read clean stdout.
  if (!process.env['SIGNALWIRE_LOG_MODE']) {
    process.env['SIGNALWIRE_LOG_MODE'] = 'off';
  }

  const project = process.env['SIGNALWIRE_PROJECT_ID'] ?? 'audit';
  const token = process.env['SIGNALWIRE_API_TOKEN'] ?? 'audit';
  const contexts = (process.env['SIGNALWIRE_CONTEXTS'] ?? 'audit_ctx')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  // Construct the client with the audit-fixture host. RelayClient
  // automatically reads SIGNALWIRE_RELAY_HOST and SIGNALWIRE_RELAY_SCHEME
  // when no explicit values are passed, so the audit's loopback ws://
  // setup just works.
  const client = new RelayClient({ project, token, contexts });

  // Track that an inbound event was dispatched. When the fixture pushes
  // a `signalwire.event` frame, the SDK runs our `onEvent` callback —
  // we both flip the flag AND emit a method-bearing `signalwire.event`
  // frame back through the socket, which is what the fixture's
  // `state.event_dispatched` watch matches on.
  let sawEvent = false;
  client.onEvent((eventType, params) => {
    sawEvent = true;
    client.notify('signalwire.event', {
      dispatched: true,
      event_type: eventType,
      echoed: params,
    });
  });

  try {
    await client.connect();
  } catch (err) {
    process.stderr.write(`relay_audit_harness: connect failed: ${err}\n`);
    process.exit(1);
  }

  // Send `signalwire.subscribe` explicitly. The TS RelayClient ships
  // `receive()` which sends `signalwire.receive`; the audit fixture
  // looks for the method name `signalwire.subscribe` (the wire-level
  // Blade alias). We use the raw `execute` escape hatch so the
  // method name is what the fixture expects.
  //
  // The fixture replies with a no-op success result, so the call
  // returns immediately.
  try {
    await client.execute('signalwire.subscribe', { contexts });
  } catch (err) {
    process.stderr.write(`relay_audit_harness: subscribe failed: ${err}\n`);
    await client.disconnect();
    process.exit(1);
  }

  // Wait up to 5 seconds for one inbound event to be dispatched.
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (sawEvent) break;
    await new Promise((r) => setTimeout(r, 50));
  }

  // Give the WS write loop a moment to flush the method-bearing echo
  // before we tear the socket down — the fixture must see the echo
  // before close arrives, otherwise `state.event_dispatched` stays false.
  await new Promise((r) => setTimeout(r, 200));
  await client.disconnect();

  if (!sawEvent) {
    process.stderr.write('relay_audit_harness: no event arrived within 5s\n');
    process.exit(1);
  }

  process.stdout.write('relay_audit_harness: event dispatched\n');
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`relay_audit_harness: unhandled error: ${err}\n`);
  process.exit(1);
});
