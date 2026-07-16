/**
 * Quickstart: manage SignalWire resources over HTTP with the REST client.
 *
 * This is the canonical README REST quickstart, kept as a real, gate-compiled example
 * so the README code block can be included from it byte-for-byte (README-INCLUDE gate).
 *
 * Run: npx tsx examples/quickstart-rest.ts
 */

const callId = '...';

// region: construct
import { RestClient } from '@signalwire/sdk';

const client = new RestClient({
  project: '...',
  token: '...',
  host: 'example.signalwire.com',
});

await client.fabric.aiAgents.create({ name: 'Support Bot', prompt: { text: 'You are helpful.' } });
await client.calling.play(callId, [{ type: 'tts', params: { text: 'Hello!' } }]);
await client.phoneNumbers.search({ areacode: '512' });
await client.datasphere.documents.search('billing policy');
// endregion: construct
