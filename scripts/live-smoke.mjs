#!/usr/bin/env node
// live-smoke.mjs — Plan 6.5 real-server smoke against the LIVE SignalWire platform.
//
// Opt-in + creds-gated: runs only when SWSDK_LIVE_TESTS is truthy AND the
// SIGNALWIRE_PROJECT_ID / SIGNALWIRE_API_TOKEN / SIGNALWIRE_SPACE env vars are
// set. Otherwise it prints why it is skipping and exits 0 (a skip is not a
// failure — forks/PRs have no secrets). This is the only check that catches
// mock↔production drift the mock servers haven't closed yet.
//
// The four smoke steps (auth + one REST list + one SWML render + one RELAY
// connect) exercise the real wire. Imports the BUILT dist (run `npm run build`
// first), the same artifact a consumer installs.

import { RestClient, RelayClient, SwmlBuilder } from '../dist/index.js';

function truthy(v) {
  return v != null && ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

async function main() {
  if (!truthy(process.env.SWSDK_LIVE_TESTS)) {
    console.log('[live-smoke] SWSDK_LIVE_TESTS not set → skipping (not a failure).');
    return;
  }
  const { SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE } = process.env;
  if (!SIGNALWIRE_PROJECT_ID || !SIGNALWIRE_API_TOKEN || !SIGNALWIRE_SPACE) {
    console.log('[live-smoke] SIGNALWIRE_* credentials not set → skipping (not a failure).');
    return;
  }

  // 1. Auth — construct the REST client from env (throws if creds are missing).
  const client = new RestClient();
  console.log('[live-smoke] 1/4 auth: RestClient constructed');

  // 2. One REST list against the real platform (auth is exercised on the wire here).
  const numbers = await client.phoneNumbers.list({ page_size: 1 });
  const count = Array.isArray(numbers?.data) ? numbers.data.length : 0;
  console.log(`[live-smoke] 2/4 REST list: phoneNumbers.list ok (${count} row[s] on page)`);

  // 3. One SWML render (local document generation — proves the SWML surface builds).
  const swml = new SwmlBuilder().answer().hangup().render();
  if (!swml || !swml.includes('answer')) {
    throw new Error('SWML render produced no answer verb');
  }
  console.log('[live-smoke] 3/4 SWML render: ok');

  // 4. One RELAY connect against the real platform, then a clean disconnect.
  const relay = new RelayClient();
  await relay.connect();
  console.log('[live-smoke] 4/4 RELAY connect: ok');
  await relay.disconnect();

  console.log('[live-smoke] PASS — auth + REST list + SWML render + RELAY connect');
}

main().catch((err) => {
  console.error('[live-smoke] FAIL:', err?.message ?? err);
  process.exit(1);
});
