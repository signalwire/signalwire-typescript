/**
 * doc_wire_runner.ts — the DOC-WIRE fixture runner for signalwire-typescript.
 *
 * The DOC-WIRE gate (porting-sdk `scripts/doc_wire.py`) spawns `mock_signalwire`
 * in flag mode, exports `MOCK_SIGNALWIRE_PORT`, then runs THIS command; it then
 * reads the mock journal and fails on any `wire_violations`. Our job is only to
 * DRIVE the documented REST calls against the mock so the mock journals what the
 * documented fixtures actually put on the wire.
 *
 * We replay the REST calls the README/rest quickstart + rest-docs + rest-examples
 * teach — the exact params the docs show — so a doc lie like `area_code` (spec
 * `areacode`), `numberType` (spec `number_type`), or a flat `{ type: 'tts', text }`
 * play item would show up as a journaled violation and fail the gate. The blocking
 * agent/relay quickstarts are covered by EXAMPLES-RUN, not here.
 *
 * `RestClient` preserves an `http://` host verbatim (src/rest/index.ts), so we
 * point it straight at the loopback mock — the same plain-HTTP path the rest tests
 * (tests/rest/mocktest.ts) use. No transport override or monkey-patch is needed.
 *
 * Run: MOCK_SIGNALWIRE_PORT=<port> npx tsx scripts/doc_wire_runner.ts
 */

import { RestClient } from '../src/rest/index.js';

async function main(): Promise<number> {
  const port = process.env['MOCK_SIGNALWIRE_PORT'];
  if (!port) {
    process.stderr.write('doc_wire_runner: MOCK_SIGNALWIRE_PORT not set\n');
    return 2;
  }
  const baseUrl = process.env['SIGNALWIRE_MOCK_URL'] ?? `http://127.0.0.1:${port}`;

  // host starts with http:// => RestClient keeps it verbatim (no https:// prefix).
  const client = new RestClient({
    project: 'test_proj',
    token: 'test_tok',
    host: baseUrl,
  });

  const callId = 'call-doc-wire';

  // --- README + examples/quickstart-rest.ts (region: construct) --------------
  await client.fabric.aiAgents.create({
    name: 'Support Bot',
    prompt: { text: 'You are helpful.' },
  });
  await client.calling.play(callId, [{ type: 'tts', params: { text: 'Hello!' } }]);
  await client.phoneNumbers.search({ areacode: '512' });
  await client.datasphere.documents.search('billing policy');

  // --- rest/README.md + rest/docs/namespaces.md phone-number search ----------
  await client.phoneNumbers.search({ areacode: '512', number_type: 'local' });

  // --- rest/docs/guide.md + rest/examples/* phone-number search --------------
  await client.phoneNumbers.search({ areacode: '512', max_results: 3 });

  // --- rest/docs/calling.md + examples play (nested params:{text}) -----------
  await client.calling.play(callId, [{ type: 'tts', params: { text: 'Welcome to SignalWire.' } }]);

  process.stdout.write('doc_wire_runner: replayed documented REST fixtures against the mock\n');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(
      `doc_wire_runner: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  },
);
