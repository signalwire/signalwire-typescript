/**
 * ai-chat-gateway-dump.ts — the TypeScript port's gateway dump program for the
 * AI-CHAT-GATEWAY gate (porting-sdk/scripts/diff_port_ai_chat_gateway.py).
 *
 * Builds an AIChatClient pointed at MOCK_AI_CHAT_URL, a ChatGateway and a
 * HandoffRouter with the corpus's fixed settings, serves both routers under the
 * corpus prefix in process, runs every step of
 * porting-sdk/scripts/ai_chat_gateway_corpus.py, and prints ONE JSON object
 * mapping step id -> observation. The steps are read from the corpus itself
 * (PORTING_SDK), so they can't drift from the reference.
 *
 * Logging is forced off before the SDK loads, so only JSON reaches stdout.
 *
 *   MOCK_AI_CHAT_URL=... PORTING_SDK=... npx tsx scripts/ai-chat-gateway-dump.ts
 */

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

process.env['SIGNALWIRE_LOG_MODE'] = 'off';

interface Step {
  id: string;
  method: string;
  path: string;
  headers: string;
  body?: unknown;
  setup?: { register?: [string, string, string] };
  check_headers?: boolean;
}

interface Corpus {
  PREFIX: string;
  CONFIG_URL: string;
  KEY: string;
  SECRET: string;
  ALLOWED_ORIGIN: string;
  ESCALATE_CONVERSATION: string;
  HEADERS: Record<string, Record<string, string>>;
  CHECKED_HEADERS: string[];
  STEPS: Step[];
}

/** The corpus, read from porting-sdk's Python module so it's the same data. */
function loadCorpus(): Corpus {
  const psdk = process.env['PORTING_SDK'] ?? process.env['PORTING_SDK_PATH'];
  if (!psdk) throw new Error('set PORTING_SDK to the porting-sdk checkout');
  const code =
    'import json, sys; sys.path.insert(0, sys.argv[1]); import ai_chat_gateway_corpus as c; ' +
    'print(json.dumps({k: getattr(c, k) for k in ["PREFIX", "CONFIG_URL", "KEY", "SECRET", ' +
    '"ALLOWED_ORIGIN", "ESCALATE_CONVERSATION", "HEADERS", "CHECKED_HEADERS", "STEPS"]}))';
  const out = execFileSync('python3', ['-c', code, join(psdk, 'scripts')], { encoding: 'utf8' });
  return JSON.parse(out) as Corpus;
}

/** Replace every "handle" value with a placeholder: handles are random. */
function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        k === 'handle' && typeof v === 'string' ? '<handle>' : scrub(v),
      ]),
    );
  }
  return value;
}

async function main(): Promise<void> {
  const url = process.env['MOCK_AI_CHAT_URL'];
  if (!url) throw new Error('MOCK_AI_CHAT_URL is not set');
  const corpus = loadCorpus();

  const { Hono } = await import('hono');
  const { AIChatClient, ChatGateway, HandoffRouter } = await import('../src/ai-chat/index.js');

  const calls: unknown[][] = [];
  const client = new AIChatClient({ url });
  const gateway = new ChatGateway({
    configUrl: corpus.CONFIG_URL,
    key: corpus.KEY,
    allowedOrigins: [corpus.ALLOWED_ORIGIN],
    client,
    secret: corpus.SECRET,
  });
  const handoff = new HandoffRouter({
    gateway,
    captureLeg: async (conversationId, medium) => {
      calls.push(['capture', conversationId, medium]);
      return true;
    },
    endCall: (callId) => void calls.push(['end_call', callId]),
    sendMessage: (callId, text) => {
      calls.push(['send_message', callId, text]);
      return true;
    },
  });
  // Served as a host app would mount them: both under the prefix, with a
  // trailing slash matching as it does in the reference's router.
  const app = new Hono({ strict: false });
  app.route(corpus.PREFIX, gateway.router());
  app.route(corpus.PREFIX, handoff.router());

  const out: Record<string, unknown> = {};
  let minted: string | null = null;
  for (const step of corpus.STEPS) {
    calls.length = 0;
    const register = step.setup?.register;
    if (register) {
      const [nonce, conversationId, callId] = register;
      handoff.register(nonce, { conversationId, callId });
    }

    let body: string | undefined;
    if (step.body !== undefined) {
      body = JSON.stringify(step.body);
      if (minted) {
        body = body
          .replace('{handle}', minted)
          .replace('{forged_handle}', `${minted.split('.')[0]}.AAAA`);
      }
      body = body.replace('{escalate_handle}', gateway.mintHandle(corpus.ESCALATE_CONVERSATION));
    }

    const res = await app.request(`${corpus.PREFIX}${step.path}`, {
      method: step.method,
      headers: corpus.HEADERS[step.headers],
      body,
    });
    if (step.id === 'gateway_start') minted = res.headers.get('x-chat-handle');

    const obs: Record<string, unknown> = { status: res.status };
    const raw = (await res.text()).trim();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && 'jsonrpc' in parsed) {
      delete (parsed as Record<string, unknown>)['id'];
    }
    const handle = (parsed as Record<string, unknown> | null)?.['handle'];
    if (typeof handle === 'string') obs['handle_names'] = gateway.readHandle(handle);
    obs['body'] = scrub(parsed);
    if (step.check_headers) {
      obs['headers'] = Object.fromEntries(
        corpus.CHECKED_HEADERS.map((name) => [
          name,
          name === 'x-chat-handle' ? res.headers.has(name) : res.headers.get(name),
        ]),
      );
    }
    obs['callbacks'] = [...calls];
    out[step.id] = obs;
  }

  process.stdout.write(JSON.stringify(out) + '\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
