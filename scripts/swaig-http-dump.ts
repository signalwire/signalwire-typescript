/**
 * swaig-http-dump.ts — the TypeScript port's SWAIG-HTTP-INVOKE dump program for
 * the cross-port behavioral differ (porting-sdk/scripts/diff_port_swaig_http.py).
 *
 * The differ builds the python oracle (a real AgentBase /swaig endpoint driven
 * over HTTP, recording what a tool handler received) and, with `--dump-cmd`,
 * runs THIS program and structurally compares the deterministic CLASSIFICATION
 * per fixture. So this program stands up the TS SDK's OWN `/swaig` route with a
 * tool whose handler RECORDS the args it received, POSTs each corpus fixture body
 * to it over a real in-process HTTP round-trip (Hono `app.request`), classifies
 * what the handler got, and prints, to stdout, ONE JSON object mapping
 *
 *   corpus-id -> {args_unwrapped: bool, handler_saw_real_args: bool}
 *
 * exactly as the Python oracle produces it (see swaig_http_corpus.py /
 * diff_port_swaig_http._classify — this file mirrors that logic in TS).
 *
 * The platform (mod_openai) POSTs a tool call nested under
 * `argument.parsed[0]`; a handler that receives the whole `{parsed, raw}`
 * envelope (or {}) reds both booleans. AgentBase.extractSwaigArgs unwraps it
 * (TS-6), so both fixtures classify {true, true}.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   SIGNALWIRE_LOG_MODE=off npx tsx scripts/swaig-http-dump.ts
 *
 * Nothing but the JSON object is written to stdout on success.
 */

// Silence the SDK logger BEFORE AgentBase (and its Logger) is loaded so no debug
// line corrupts the JSON-only stdout contract the differ parses.
process.env['SIGNALWIRE_LOG_MODE'] ??= 'off';

const { AgentBase } = await import('../src/AgentBase.js');
const { FunctionResult } = await import('../src/FunctionResult.js');

// The tool name every port registers (swaig_http_corpus.FUNCTION).
const FUNCTION = 'lookup_order';

// The real args each fixture arms (swaig_http_corpus._NESTED_ARGS / _FLAT_ARGS).
const NESTED_ARGS = { order_id: 'ORD-3007', customer: 'acme-42' };
const FLAT_ARGS = { order_id: 'FLAT-9911' };

interface Fixture {
  id: string;
  kind: 'platform_nested' | 'flat_arguments';
  args: Record<string, unknown>;
  body: Record<string, unknown>;
}

// Mirror of swaig_http_corpus._nested_body / _flat_arguments_body.
function nestedBody(fn: string, args: Record<string, unknown>): Record<string, unknown> {
  return { function: fn, argument: { parsed: [args], raw: JSON.stringify(args) } };
}
function flatArgumentsBody(fn: string, args: Record<string, unknown>): Record<string, unknown> {
  return { function: fn, arguments: args };
}

const CORPUS: Fixture[] = [
  {
    id: 'platform_nested',
    kind: 'platform_nested',
    args: { ...NESTED_ARGS },
    body: nestedBody(FUNCTION, NESTED_ARGS),
  },
  {
    id: 'flat_arguments',
    kind: 'flat_arguments',
    args: { ...FLAT_ARGS },
    body: flatArgumentsBody(FUNCTION, FLAT_ARGS),
  },
];

/** Classify what the handler received against the fixture's expected args.
 * Mirrors diff_port_swaig_http._classify exactly. */
function classify(expected: Record<string, unknown>, received: unknown): Record<string, boolean> {
  const isDict = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  const unwrapped =
    isDict(received) &&
    !('parsed' in received) &&
    !('raw' in received) &&
    Object.keys(expected).some((k) => k in received);
  const sawReal = isDict(received) && Object.entries(expected).every(([k, v]) => received[k] === v);
  return { args_unwrapped: unwrapped, handler_saw_real_args: sawReal };
}

async function main(): Promise<void> {
  const out: Record<string, Record<string, boolean>> = {};

  for (const fixture of CORPUS) {
    // Fresh agent per fixture so a leaked receipt can never bleed across cases.
    const agent = new AgentBase({ name: 'swaig-http-dump', route: '/', basicAuth: ['u', 'p'] });
    let received: unknown = null;
    agent.defineTool({
      name: FUNCTION,
      description: 'record the args the handler received',
      parameters: {},
      // secure:false — mirrors the oracle, which defines this fixture tool with
      // secure=False (diff_port_swaig_http.py:184). This corpus measures the
      // ARGUMENT-UNWRAP contract, so token validation must not gate dispatch:
      // tools are secure by DEFAULT (A1), and an untokenized POST to a secure
      // tool is correctly refused before the handler ever records its args.
      secure: false,
      handler: (args) => {
        received = args;
        return new FunctionResult('ok');
      },
    });
    const app = agent.getApp();

    const res = await app.request('/swaig', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fixture.body),
    });
    // Drain the response so the round-trip completes; status is not the artifact.
    await res.text();

    out[fixture.id] = classify(fixture.args, received);
  }

  process.stdout.write(JSON.stringify(out) + '\n');
}

main().catch((err) => {
  process.stderr.write(`swaig-http-dump: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
