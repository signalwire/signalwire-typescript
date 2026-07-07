/**
 * Quickstart: real-time call control over the RELAY WebSocket client.
 *
 * This is the canonical README RELAY quickstart, kept as a real, gate-compiled example
 * so the README code block can be included from it byte-for-byte (README-INCLUDE gate).
 *
 * Run: npx tsx examples/quickstart-relay.ts
 */

// region: construct
import { RelayClient, Call } from '@signalwire/sdk';

const client = new RelayClient({
  contexts: ['default'],
});

client.onCall(async (call: Call) => {
  await call.answer();
  const action = await call.play([{ type: 'tts', text: 'Welcome to SignalWire!' }]);
  await action.wait();
  await call.hangup();
});

client.run();
// endregion: construct
