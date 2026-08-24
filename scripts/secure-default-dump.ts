/**
 * secure-default-dump.ts — the TypeScript port's SECURE-DEFAULT dump program for
 * the cross-port behavioral differ (porting-sdk/scripts/diff_port_secure_default.py,
 * corpus porting-sdk/scripts/secure_default_corpus.py; A+ campaign A1 / PSDK-4a).
 *
 * The A1 contract: `defineTool` WITHOUT an explicit `secure` MUST default to
 * SECURE, and the rendered SWML must reflect that on the WIRE — a secure tool's
 * SWAIG function entry carries a per-tool `__token=<hmac>` query parameter on its
 * `web_hook_url`; an explicitly `secure: false` tool carries none (it falls back
 * to the unauthenticated shared `defaults.web_hook_url`).
 *
 * So this program drives the REAL AgentBase: it registers one default tool (no
 * explicit `secure`) plus one `secure: false` tool, renders the SWML with the
 * fixed corpus `CALL_ID`, locates each tool's rendered SWAIG function entry, and
 * emits, to stdout, ONE JSON object mapping
 *
 *   corpus-id -> {secure_default_true: bool, wire_reflects_secure: bool}
 *
 * exactly as the Python oracle produces it (diff_port_secure_default.build_oracle
 * — this file mirrors that classification in TS):
 *
 *   secure_default_true   the SDK-recorded `secure` flag for the tool. For the
 *                         default case this is the observation that reds a port
 *                         whose defineTool defaults insecure.
 *   wire_reflects_secure  a `__token` is present on the rendered webhook IFF the
 *                         tool is secure (secure tool -> token present; insecure
 *                         tool -> token correctly absent).
 *
 * Both booleans are read from the ACTUAL SDK state and the ACTUAL rendered
 * document — the recorded flag from the tool registry, the token from the
 * rendered `web_hook_url`. Nothing is asserted from a constant, so a port cannot
 * report a token it did not emit. The token VALUE is a nondeterministic HMAC and
 * is deliberately NOT compared, only its presence.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   SIGNALWIRE_LOG_MODE=off npx tsx scripts/secure-default-dump.ts
 *
 * Nothing but the JSON object is written to stdout on success.
 */

// Silence the SDK logger BEFORE AgentBase (and its Logger) is loaded so no debug
// line corrupts the JSON-only stdout contract the differ parses.
process.env['SIGNALWIRE_LOG_MODE'] ??= 'off';

const { AgentBase } = await import('../src/AgentBase.js');
const { FunctionResult } = await import('../src/FunctionResult.js');
const { SwaigFunction } = await import('../src/SwaigFunction.js');

// The fixed call_id the corpus renders with (secure_default_corpus.CALL_ID). A
// per-tool token is only minted when a call_id is present, so this is load-bearing.
const CALL_ID = 'call-secure-default-fixture';

// The tool names the corpus requires (secure_default_corpus.CORPUS[*].tool_name).
const DEFAULT_TOOL = 'sd_default_secure';
const INSECURE_TOOL = 'sd_explicit_insecure';

interface Fixture {
  id: string;
  toolName: string;
  /** The SDK-recorded `secure` flag this fixture expects (corpus expect_secure). */
  expectSecure: boolean;
}

const CORPUS: Fixture[] = [
  { id: 'define_tool_default_is_secure', toolName: DEFAULT_TOOL, expectSecure: true },
  { id: 'define_tool_explicit_insecure', toolName: INSECURE_TOOL, expectSecure: false },
];

/**
 * Locate the SWAIG `functions` array inside a rendered SWML document, tolerant of
 * the document shape (the SWAIG object nests under a section/verb). Mirrors
 * diff_port_secure_default._find_swaig_functions.
 */
function findSwaigFunctions(obj: unknown): Record<string, unknown>[] | null {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    const rec = obj as Record<string, unknown>;
    const swaig = rec['SWAIG'];
    if (swaig !== null && typeof swaig === 'object' && !Array.isArray(swaig)) {
      const fns = (swaig as Record<string, unknown>)['functions'];
      if (Array.isArray(fns)) return fns as Record<string, unknown>[];
    }
    for (const v of Object.values(rec)) {
      const r = findSwaigFunctions(v);
      if (r !== null) return r;
    }
  } else if (Array.isArray(obj)) {
    for (const v of obj) {
      const r = findSwaigFunctions(v);
      if (r !== null) return r;
    }
  }
  return null;
}

/**
 * True iff a rendered SWAIG function entry's webhook carries a per-tool token
 * (`__token` in its `web_hook_url` query string) — the wire reflection of
 * `secure`. Mirrors diff_port_secure_default._webhook_has_token.
 */
function webhookHasToken(entry: Record<string, unknown> | undefined): boolean {
  const url = entry?.['web_hook_url'];
  return typeof url === 'string' && url.includes('__token=');
}

async function main(): Promise<void> {
  const agent = new AgentBase({
    name: 'secure-default-fixture',
    route: '/sd',
    basicAuth: ['u', 'p'],
  });
  agent.setPromptText('secure default fixture');

  // The DEFAULT tool: NO explicit `secure` — must default to SECURE (A1).
  agent.defineTool({
    name: DEFAULT_TOOL,
    description: 'secure-default fixture tool',
    parameters: {},
    handler: () => new FunctionResult('ok'),
  });
  // The EXPLICIT insecure tool: `secure: false` must be honored.
  agent.defineTool({
    name: INSECURE_TOOL,
    description: 'secure-default fixture tool',
    parameters: {},
    secure: false,
    handler: () => new FunctionResult('ok'),
  });

  // Read back the SDK-recorded `secure` flag per tool from the real registry.
  // `getTool` returns the live SwaigFunction (getRegisteredTools returns a
  // name/description/parameters summary that does not carry `secure`).
  const recordedSecure = new Map<string, boolean>();
  for (const fixture of CORPUS) {
    const fn = agent.getTool(fixture.toolName);
    if (fn instanceof SwaigFunction) recordedSecure.set(fixture.toolName, Boolean(fn.secure));
  }

  // Render the SWML with the fixed call_id and read the per-tool webhook token.
  const rendered = agent.renderSwml(CALL_ID);
  const doc: unknown = typeof rendered === 'string' ? JSON.parse(rendered) : rendered;
  const fns = findSwaigFunctions(doc) ?? [];
  const byName = new Map<string, Record<string, unknown>>();
  for (const fn of fns) {
    const name = fn['function'];
    if (typeof name === 'string') byName.set(name, fn);
  }

  const out: Record<string, Record<string, boolean>> = {};
  for (const fixture of CORPUS) {
    const isSecure = recordedSecure.get(fixture.toolName) ?? false;
    const tokenPresent = webhookHasToken(byName.get(fixture.toolName));
    out[fixture.id] = {
      secure_default_true: isSecure,
      // A token is present IFF the tool is secure.
      wire_reflects_secure: tokenPresent === fixture.expectSecure,
    };
  }

  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch((err) => {
  process.stderr.write(`secure-default-dump: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
