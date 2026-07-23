/**
 * ai-chat-dump.ts — the TypeScript port's AI-CHAT dump program for the
 * cross-port wire-behavioral gate (porting-sdk/scripts/diff_port_ai_chat.py, on
 * the `ai-chat-client` branch — a COORDINATED pass).
 *
 * The gate boots the in-process mock_ai_chat server, exports MOCK_AI_CHAT_URL +
 * SIGNALWIRE_PROJECT_ID / SIGNALWIRE_API_TOKEN into this program's env, runs it,
 * and asserts the JSON it prints (+ the wire requests the mock recorded) speak
 * the AI Chat protocol per the vendored spec (ai-chat-specs/ai-chat.yaml).
 *
 * This mirrors porting-sdk/scripts/ai_chat_dump_reference.py EXACTLY: it drives
 * the TS AIChatClient through the shared ai_chat_corpus and emits ONE JSON object
 * to stdout (nothing else — logger noise silenced), keyed by corpus step:
 *
 *   success steps (create/chat/end/delete/log/summarize):
 *       { wire_method, decoded: { <spec result fields> } }
 *   summarize_failed (the summarize {error} one_of branch — must SURFACE, not swallow):
 *       { wire_method:"summarize", raised:true, error_type, message }
 *   error steps (err_notfound/err_ratelimit/err_inprogress/err_auth/err_unmapped):
 *       { raised:true, error_code, error_type }
 *
 * The corpus (steps + SUMMARIZE_ERROR_ID + ERROR_STEPS + force_error_id) is data,
 * identical for every language; it is mirrored inline here from ai_chat_corpus.py.
 *
 * Run from the signalwire-typescript repo root against a running mock:
 *
 *   MOCK_AI_CHAT_URL=http://127.0.0.1:PORT/api/ai/chat npx tsx scripts/ai-chat-dump.ts
 *
 * Nothing but the JSON object is written to stdout on success.
 */

// Silence the SDK logger BEFORE any SDK module (and its Logger) is loaded, so no
// debug line corrupts the JSON-only stdout the gate parses. ES `import` bindings
// are hoisted above top-level statements, so we set the env default first and
// import the client DYNAMICALLY. (The AIChatClient itself does not log, but this
// keeps the discipline identical to envelope-dump.ts and future-proofs it.)
process.env['SIGNALWIRE_LOG_MODE'] ??= 'off';

const { AIChatClient, AIChatError, SummaryError } = await import('../src/ai-chat/AIChatClient.js');

// ── the shared corpus (mirror of porting-sdk/scripts/ai_chat_corpus.py) ──────

/** The sentinel conversation id that makes summarize return its {error} branch. */
const SUMMARIZE_ERROR_ID = '__summarize_error';

/** error step id -> the JSON-RPC code the port's raised error MUST carry. */
const ERROR_STEPS: Record<string, number> = {
  err_notfound: -32001, // ConversationNotFound
  err_ratelimit: -32005, // RateLimit
  err_inprogress: -32007, // ChatInProgress
  err_auth: -32009, // Authentication
  err_unmapped: -32602, // base AIChatError (unmapped code)
};

/** The sentinel conversation id that makes the mock return <code>. */
function forceErrorId(code: number): string {
  return `__err_${code}`;
}

type StepResult = Record<string, unknown>;

async function run(url: string): Promise<Record<string, StepResult>> {
  const out: Record<string, StepResult> = {};
  const client = new AIChatClient({ url });

  // ── success steps ──────────────────────────────────────────────────
  const info = await client.createConversation('conv-1', {
    configUrl: 'http://cfg',
    timeout: 30,
    reinit: true,
  });
  out['create'] = {
    wire_method: 'create_conversation',
    decoded: { status: info.status, id: info.id, initial_message: info.initialMessage },
  };

  const reply = await client.chat('conv-1', 'hello', { timeout: 30, reinit: true });
  out['chat'] = {
    wire_method: 'chat',
    decoded: { response: reply.text, user_event: reply.userEvent },
  };

  // end/delete return bool idiomatically; the wire result also carries the
  // conversation id (the caller's own input, echoed). Report both the derived
  // status and the id operated on — mirroring the reference dump.
  const ended = await client.end('conv-1');
  out['end'] = {
    wire_method: 'end_conversation',
    decoded: { status: ended ? 'ended' : '?', id: 'conv-1' },
  };

  const deleted = await client.delete('conv-1');
  out['delete'] = {
    wire_method: 'delete',
    decoded: { status: deleted ? 'deleted' : '?', id: 'conv-1' },
  };

  const log = await client.log('conv-1');
  out['log'] = {
    wire_method: 'chat_log',
    decoded: { chat_log: log.messages, call_timeline: log.callTimeline },
  };

  const summary = await client.summarize('conv-1');
  out['summarize'] = { wire_method: 'summarize', decoded: { summary } };

  // ── summarize one_of {error} branch: must SURFACE, not swallow ───────
  try {
    const swallowed = await client.summarize(SUMMARIZE_ERROR_ID);
    out['summarize_failed'] = {
      wire_method: 'summarize',
      raised: false,
      decoded: { summary: swallowed },
    };
  } catch (e) {
    if (e instanceof SummaryError) {
      out['summarize_failed'] = {
        wire_method: 'summarize',
        raised: true,
        error_type: e.constructor.name,
        message: e.serverMessage,
      };
    } else {
      throw e;
    }
  }

  // ── error-code steps (JSON-RPC error object) ─────────────────────────
  for (const [step, code] of Object.entries(ERROR_STEPS)) {
    try {
      await client.chat(forceErrorId(code), 'x');
      out[step] = { raised: false };
    } catch (e) {
      if (e instanceof AIChatError) {
        out[step] = { raised: true, error_code: e.code, error_type: e.constructor.name };
      } else {
        throw e;
      }
    }
  }

  return out;
}

async function main(): Promise<void> {
  const url = process.env['MOCK_AI_CHAT_URL'];
  if (!url) {
    process.stderr.write('MOCK_AI_CHAT_URL not set\n');
    process.exit(2);
  }
  const out = await run(url);
  process.stdout.write(JSON.stringify(out) + '\n');
}

main().catch((err) => {
  process.stderr.write(`ai-chat-dump: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
