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
 *   corpus-id -> {args_unwrapped: bool, handler_saw_real_args: bool}   (unwrap fixtures)
 *   corpus-id -> {handler_invoked: bool, refused: bool}                (token fixtures)
 *
 * exactly as the Python oracle produces it (see swaig_http_corpus.py /
 * diff_port_swaig_http._classify + _classify_token — this file mirrors that
 * logic in TS).
 *
 * The platform (mod_openai) POSTs a tool call nested under
 * `argument.parsed[0]`; a handler that receives the whole `{parsed, raw}`
 * envelope (or {}) reds both booleans. AgentBase.extractSwaigArgs unwraps it
 * (TS-6), so both fixtures classify {true, true}.
 *
 * The `token_*` fixtures invoke a SECOND tool registered `secure: true` with a
 * VALID / FORGED / ABSENT `__token` query param and classify whether the
 * endpoint RAN the tool or short-circuited with a token refusal. `valid` is
 * MINTED here (`agent.createToolToken(fn, callId)`) rather than read from the
 * corpus: the token is an HMAC keyed by this agent's per-process
 * `SessionManager.secretKey` and it expires, so no corpus literal could ever be
 * valid. `call_id` rides in the POST BODY — that is where both the reference
 * (`core/swml_service.py`:877) and this port (`AgentBase` /swaig dispatch) read
 * it, and it is what token validation binds to; putting it only in the query
 * string silently makes every token invalid.
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

// The SECOND tool name, registered secure:true, used ONLY by the token fixtures
// (swaig_http_corpus.SECURE_FUNCTION). Kept distinct from FUNCTION so the unwrap
// fixtures keep exercising a non-secure tool with no token path in their way.
const SECURE_FUNCTION = 'charge_account';

// The query-param name the platform puts the per-tool token in
// (swaig_http_corpus.TOKEN_PARAM). This IS the wire contract.
const TOKEN_PARAM = '__token';

// The session id token fixtures mint/validate against (swaig_http_corpus.TOKEN_CALL_ID).
const TOKEN_CALL_ID = 'corpus-call-7fc2';

// A well-formed but cryptographically bogus token (swaig_http_corpus.FORGED_TOKEN):
// base64url of "<call_id>.<function>.<far-future-expiry>.<nonce>.<garbage-signature>".
// It DECODES and SPLITS into the 5 expected parts and is NOT expired, so a
// length/format/expiry check alone cannot reject it — only real signature
// verification does.
const FORGED_TOKEN =
  'Y29ycHVzLWNhbGwtN2ZjMi5jaGFyZ2VfYWNjb3VudC40MTAyNDQ0ODAwLmRlYWRiZWVmZGVh' +
  'ZGJlZWYuMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw' +
  'MDAwMDAwMDAwMDAw';

// The real args each fixture arms (swaig_http_corpus._NESTED_ARGS / _FLAT_ARGS /
// _TOKEN_*_ARGS). Distinct per fixture so a handler leaking another fixture's
// args (or an empty dict) is caught.
const NESTED_ARGS = { order_id: 'ORD-3007', customer: 'acme-42' };
const FLAT_ARGS = { order_id: 'FLAT-9911' };
const TOKEN_VALID_ARGS = { order_id: 'TOKVALID-5501' };
const TOKEN_FORGED_ARGS = { order_id: 'TOKFORGED-5502' };
const TOKEN_ABSENT_ARGS = { order_id: 'TOKABSENT-5503' };

interface Fixture {
  id: string;
  kind: 'platform_nested' | 'flat_arguments' | 'token';
  args: Record<string, unknown>;
  body: Record<string, unknown>;
  /** ONLY on kind === 'token'. A DIRECTIVE, never a literal. */
  token?: 'valid' | 'forged' | 'absent';
  /** ONLY on kind === 'token'. The session id a VALID token is minted against. */
  callId?: string;
}

// Mirror of swaig_http_corpus._nested_body / _flat_arguments_body / _token_body.
function nestedBody(fn: string, args: Record<string, unknown>): Record<string, unknown> {
  return { function: fn, argument: { parsed: [args], raw: JSON.stringify(args) } };
}
function flatArgumentsBody(fn: string, args: Record<string, unknown>): Record<string, unknown> {
  return { function: fn, arguments: args };
}
function tokenBody(
  fn: string,
  args: Record<string, unknown>,
  callId: string,
): Record<string, unknown> {
  // The PLATFORM-nested shape (the real platform always sends nested) PLUS the
  // `call_id` the endpoint reads from the BODY and binds token validation to.
  return { ...nestedBody(fn, args), call_id: callId };
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
  {
    id: 'token_valid',
    kind: 'token',
    token: 'valid',
    callId: TOKEN_CALL_ID,
    args: { ...TOKEN_VALID_ARGS },
    body: tokenBody(SECURE_FUNCTION, TOKEN_VALID_ARGS, TOKEN_CALL_ID),
  },
  {
    id: 'token_forged',
    kind: 'token',
    token: 'forged',
    callId: TOKEN_CALL_ID,
    args: { ...TOKEN_FORGED_ARGS },
    body: tokenBody(SECURE_FUNCTION, TOKEN_FORGED_ARGS, TOKEN_CALL_ID),
  },
  {
    id: 'token_absent',
    kind: 'token',
    token: 'absent',
    callId: TOKEN_CALL_ID,
    args: { ...TOKEN_ABSENT_ARGS },
    body: tokenBody(SECURE_FUNCTION, TOKEN_ABSENT_ARGS, TOKEN_CALL_ID),
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

/** Classify a token fixture: did the /swaig endpoint RUN the tool, or
 * short-circuit with a token refusal? Mirrors
 * diff_port_swaig_http._classify_token exactly.
 *
 * The two booleans are recorded INDEPENDENTLY rather than deriving one from the
 * other, so a port that neither runs the tool NOR refuses (a 500, an
 * unknown-function 404, an empty body) reports {false, false} and stays
 * distinguishable from a genuine refusal.
 *
 * The refusal is a RESPONSE-BODY short-circuit at HTTP 200, not a status code,
 * so `refused` is derived from the response TEXT and never from the status. */
function classifyToken(invoked: boolean, body: unknown): Record<string, boolean> {
  const text = body === null || body === undefined ? '' : JSON.stringify(body).toLowerCase();
  const refused =
    !invoked && text.includes('token') && (text.includes('invalid') || text.includes('expired'));
  return { handler_invoked: invoked, refused };
}

async function main(): Promise<void> {
  const out: Record<string, Record<string, boolean>> = {};

  for (const fixture of CORPUS) {
    // Fresh agent per fixture so a leaked receipt can never bleed across cases.
    const agent = new AgentBase({ name: 'swaig-http-dump', route: '/', basicAuth: ['u', 'p'] });
    let received: unknown = null;
    let invoked = false;
    const handler = (args: unknown): InstanceType<typeof FunctionResult> => {
      received = args;
      invoked = true;
      return new FunctionResult('ok');
    };
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
      handler,
    });
    // The SECOND tool the token fixtures target. secure:true is what arms the
    // inbound __token check at all — a secure:false tool never refuses ANY
    // token, so the token fixtures would be vacuous against it.
    agent.defineTool({
      name: SECURE_FUNCTION,
      description: 'secure probe tool that records whether it ran',
      parameters: {},
      secure: true,
      handler,
    });
    const app = agent.getApp();

    // Resolve the fixture's token DIRECTIVE into the query string to send.
    // Non-token fixtures get NO query params — byte-identical to the pre-token
    // behavior, so the two original fixtures are untouched.
    let query = '';
    if (fixture.kind === 'token' && fixture.token !== 'absent') {
      // `valid` must be MINTED here, not read from a constant: the token is an
      // HMAC keyed by this agent's per-process SessionManager.secretKey and it
      // expires, so a literal could never be valid.
      const tok =
        fixture.token === 'valid'
          ? agent.createToolToken(SECURE_FUNCTION, fixture.callId as string)
          : FORGED_TOKEN;
      query = `?${TOKEN_PARAM}=${encodeURIComponent(tok)}`;
    }

    const res = await app.request(`/swaig${query}`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fixture.body),
    });

    if (fixture.kind === 'token') {
      const text = await res.text();
      let rbody: unknown = null;
      try {
        rbody = JSON.parse(text);
      } catch {
        rbody = null;
      }
      out[fixture.id] = classifyToken(invoked, rbody);
      continue;
    }

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
