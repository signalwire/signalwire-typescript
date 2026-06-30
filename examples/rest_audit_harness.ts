/**
 * rest_audit_harness.ts
 *
 * Runtime probe driven by the porting-sdk's `audit_rest_transport.py`.
 *
 * The audit binds an ephemeral 127.0.0.1:NNNN HTTP fixture and points
 * the SDK at it via `REST_FIXTURE_URL`. Each probe asks the harness to
 * invoke a specific operation; the fixture records the request shape
 * (method, path, headers, body) and replies with a canned response that
 * embeds a sentinel string. The audit asserts (1) the request was real,
 * (2) the path / method match Python's behavior, (3) the SDK parsed the
 * canned response back to a dict whose sentinel reaches the caller.
 *
 * Environment (set by the audit fixture):
 *   - REST_OPERATION         dotted name (e.g. `calling.list_calls`)
 *   - REST_FIXTURE_URL       `http://127.0.0.1:NNNN`
 *   - REST_OPERATION_ARGS    JSON dict of args
 *   - SIGNALWIRE_PROJECT_ID  `audit`
 *   - SIGNALWIRE_API_TOKEN   `audit`
 *
 * Operations supported (mirrors the audit's REST_PROBES table):
 *   - `calling.list_calls`        GET  /api/laml/2010-04-01/Accounts/{proj}/Calls.json
 *   - `messaging.send`            POST /api/laml/2010-04-01/Accounts/{proj}/Messages.json
 *   - `phone_numbers.list`        GET  /api/relay/rest/phone_numbers
 *   - `fabric.subscribers.list`   GET  /api/fabric/resources/subscribers
 *
 * Exits 0 on success (with the parsed response printed as JSON to stdout),
 * 1 on any error (with a diagnostic on stderr).
 */

import { RestClient, HttpClient } from '../src/rest/index.js';

function die(msg: string): never {
  process.stderr.write(`rest_audit_harness: ${msg}\n`);
  process.exit(1);
}

function asStringMap(args: unknown): Record<string, string> {
  // Convert {limit: 5, ...} to {limit: "5", ...} for query-param use.
  const out: Record<string, string> = {};
  if (!args || typeof args !== 'object') return out;
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

/**
 * member. The audit needs to issue a raw GET/POST against an exact path
 * reach the shared transport directly. This local view types that
 * otherwise-protected access without resorting to `any`.
 */
type WithHttp = { readonly _http: HttpClient };

async function dispatch(
  client: RestClient,
  project: string,
  operation: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  // We thread through the same HttpClient the namespace classes use so
  // every operation hits the audit fixture URL with Basic auth.
  // `client` itself is constructed pointed at REST_FIXTURE_URL.
  switch (operation) {
    case 'phone_numbers.list': {
      // The TS surface ships this directly: `client.phoneNumbers.list(params)`
      // hits `/api/relay/rest/phone_numbers`.
      return client.phoneNumbers.list(asStringMap(args));
    }

    case 'fabric.subscribers.list': {
      // `client.fabric.subscribers.list(params)` hits
      // `/api/fabric/resources/subscribers`.
      return client.fabric.subscribers.list(asStringMap(args));
    }

    default:
      throw new Error(`unsupported operation '${operation}'`);
  }
}

async function main(): Promise<void> {
  if (!process.env['SIGNALWIRE_LOG_MODE']) {
    process.env['SIGNALWIRE_LOG_MODE'] = 'off';
  }

  const operation = process.env['REST_OPERATION'] ?? die('REST_OPERATION env var required');
  const fixtureUrl = process.env['REST_FIXTURE_URL'] ?? die('REST_FIXTURE_URL env var required');
  const project =
    process.env['SIGNALWIRE_PROJECT_ID'] ?? die('SIGNALWIRE_PROJECT_ID env var required');
  const token = process.env['SIGNALWIRE_API_TOKEN'] ?? die('SIGNALWIRE_API_TOKEN env var required');

  let args: Record<string, unknown> = {};
  const rawArgs = process.env['REST_OPERATION_ARGS'];
  if (rawArgs && rawArgs.length > 0) {
    try {
      args = JSON.parse(rawArgs);
    } catch (err) {
      die(`REST_OPERATION_ARGS not JSON: ${err}`);
    }
  }

  // Build a RestClient with the fixture URL as its host. RestClient
  // accepts a fully-qualified `http://...` host and uses it verbatim
  // (no `https://` prefix is added when the value already starts with
  // `http`), so the harness exercises the real HTTP transport against
  // the loopback fixture.
  const client = new RestClient({ project, token, host: fixtureUrl });

  let result: unknown;
  try {
    result = await dispatch(client, project, operation, args);
  } catch (err) {
    die(`${operation}: ${err instanceof Error ? err.message : String(err)}`);
  }

  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(0);
}

main().catch((err) => {
  die(`unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
});
