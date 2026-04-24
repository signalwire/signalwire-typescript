/**
 * RELAY Demo -- Answer and Welcome
 *
 * Demonstrates using the RELAY WebSocket client to answer an inbound call
 * and play a TTS greeting.
 *
 * Required env vars:
 *   SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE
 *
 * Run: npx tsx examples/relay-demo.ts
 */

import { RelayClient } from '../src/index.js';

const client = new RelayClient({
  contexts: ['default'],
});

client.onCall(async (call) => {
  console.log(`Incoming call: ${call.callId}`);
  await call.answer();

  const action = await call.play([
    { type: 'tts', params: { text: 'Welcome to SignalWire! This is a RELAY demo.' } },
  ]);
  await action.wait();

  await call.hangup();
  console.log(`Call ended: ${call.callId}`);
});

console.log('Waiting for inbound calls on context "default" ...');
client.run();
