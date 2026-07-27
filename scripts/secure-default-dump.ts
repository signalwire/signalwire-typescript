/**
 * secure-default-dump.ts — the TypeScript port's SECURE-DEFAULT (A1) Layer-D dump
 * program for the cross-port behavioral differ
 * (porting-sdk/scripts/diff_port_secure_default.py, corpus
 * porting-sdk/scripts/secure_default_corpus.py).
 *
 * The differ drives the python reference through the secure_default corpus to
 * build the golden token TOPOLOGY, then runs THIS program (which embeds the same
 * two fixtures) and classifies OUR rendered payload the same way.
 *
 * Protocol (the 2026-07-27 redesign — a WIRE payload, not a self-verdict):
 *
 *   {"<fixture id>": {"secure_default_true": bool, "rendered": {<functions[] entry>}}}
 *
 *   secure_default_true — the SDK-RECORDED secure flag for that tool, read back
 *     from the live registry (`AgentBase.getTool(name).secure`). It is deliberately
 *     NOT the value this program passed to `defineTool`: echoing the input back
 *     would make the field incapable of ever failing, which is precisely the
 *     vacuity this redesign exists to close.
 *   rendered — that tool's own `SWAIG.functions[]` entry, VERBATIM, with every
 *     token VALUE replaced by the corpus placeholder `<TOKEN>` (the values are
 *     HMACs and vary per run; the KEY PATH is the whole contract and is preserved
 *     exactly).
 *
 * This program makes NO judgement about whether the render is correct — the
 * differ derives `has_own_webhook` and `token_carrier` from the keys. The
 * contract it pins (signalwire-python core/agent_base.py:1085-1099): a SECURE
 * tool's entry carries its own `web_hook_url` with a `__token` query param; an
 * INSECURE tool's entry carries NO `web_hook_url` key at all and falls back to
 * the shared `SWAIG.defaults.web_hook_url`.
 *
 * Only stdout carries JSON; setup noise goes to stderr.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   SIGNALWIRE_LOG_MODE=off npx tsx scripts/secure-default-dump.ts
 */

// Silence the SDK logger BEFORE AgentBase (and its Logger) is loaded so no debug
// line corrupts the JSON-only stdout contract the differ parses.
process.env['SIGNALWIRE_LOG_MODE'] ??= 'off';

const { AgentBase } = await import('../src/AgentBase.js');
const { FunctionResult } = await import('../src/FunctionResult.js');
const { SwaigFunction } = await import('../src/SwaigFunction.js');

/**
 * The FIXED call_id the corpus renders with, so a secure tool deterministically
 * gets a __token. Mirrors secure_default_corpus.CALL_ID.
 */
const CALL_ID = 'call-secure-default-fixture';

/** Mirrors secure_default_corpus.TOKEN_PLACEHOLDER. */
const TOKEN_PLACEHOLDER = '<TOKEN>';

/** The tool names the corpus requires (secure_default_corpus.CORPUS[*].tool_name). */
const DEFAULT_TOOL = 'sd_default_secure';
const INSECURE_TOOL = 'sd_explicit_insecure';

type AgentInstance = InstanceType<typeof AgentBase>;

/** One fixture's emitted payload — exactly the two keys the differ consumes. */
interface Emission {
  secure_default_true: boolean;
  rendered: Record<string, unknown>;
}

/**
 * Replace the VALUE of every token-suffixed query parameter in a URL, preserving
 * the parameter KEY and order. Mirrors diff_port_secure_default._redact_url_token.
 */
function redactUrl(url: string): string {
  const q = url.indexOf('?');
  if (q === -1) return url;
  const rebuilt = url
    .slice(q + 1)
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq === -1) return pair;
      const key = pair.slice(0, eq);
      return key.toLowerCase().endsWith('token') ? `${key}=${TOKEN_PLACEHOLDER}` : pair;
    });
  return url.slice(0, q + 1) + rebuilt.join('&');
}

/**
 * Replace every nondeterministic token VALUE (an HMAC) with the corpus
 * placeholder while preserving every KEY and key path exactly — both a
 * token-suffixed field and a token-suffixed query parameter on a URL value.
 * Mirrors diff_port_secure_default.redact_entry so the differ's re-application is
 * a no-op.
 */
function redactEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'string' && key.toLowerCase().endsWith('token')) {
      out[key] = TOKEN_PLACEHOLDER;
    } else if (typeof value === 'string' && (value.includes('://') || value.startsWith('/'))) {
      out[key] = redactUrl(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

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

/** Locate the SWAIG function entry by name in the rendered doc. */
function functionEntry(doc: unknown, toolName: string): Record<string, unknown> {
  for (const fn of findSwaigFunctions(doc) ?? []) {
    if (fn !== null && typeof fn === 'object' && fn['function'] === toolName) return fn;
  }
  return {};
}

/**
 * Build a fresh agent, define one tool, render the SWML with the fixed call_id,
 * and emit {secure_default_true, rendered} for the differ to classify.
 */
function emit(toolName: string, define: (agent: AgentInstance) => void): Emission {
  const agent = new AgentBase({
    name: 'secure-default-fixture',
    route: '/sd',
    basicAuth: ['u', 'p'],
  });
  agent.setPromptText('secure default fixture');
  define(agent);

  // The SDK-RECORDED flag, read back from the live registry — never the value we
  // passed in (see the header: an echoed input can never red). `getTool` returns
  // the live SwaigFunction; getRegisteredTools returns a name/description/
  // parameters summary that does not carry `secure`.
  const fn = agent.getTool(toolName);
  const recordedSecure = fn instanceof SwaigFunction && fn.secure === true;

  const rendered = agent.renderSwml(CALL_ID);
  const doc: unknown = typeof rendered === 'string' ? JSON.parse(rendered) : rendered;

  return {
    secure_default_true: recordedSecure,
    rendered: redactEntry(functionEntry(doc, toolName)),
  };
}

function main(): void {
  const out: Record<string, Emission> = {};

  // A1 (a): a tool defined with NO explicit `secure` must default to SECURE →
  // its rendered entry carries its own web_hook_url with a __token query param.
  out['define_tool_default_is_secure'] = emit(DEFAULT_TOOL, (agent) => {
    agent.defineTool({
      name: DEFAULT_TOOL,
      description: 'secure-default fixture tool',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });
  });

  // A1 (b): a tool defined with `secure: false` must be INSECURE → NO per-tool
  // web_hook_url key at all (it falls back to SWAIG.defaults.web_hook_url).
  out['define_tool_explicit_insecure'] = emit(INSECURE_TOOL, (agent) => {
    agent.defineTool({
      name: INSECURE_TOOL,
      description: 'secure-default fixture tool',
      parameters: {},
      secure: false,
      handler: () => new FunctionResult('ok'),
    });
  });

  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(`secure-default-dump: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
}
