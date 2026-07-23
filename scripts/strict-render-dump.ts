/**
 * strict-render-dump.ts — the TypeScript port's SWML STRICT-RENDER dump program
 * for the cross-port negative differ (porting-sdk/scripts/diff_port_strict_render.py).
 *
 * The strict-render contract: building/rendering an SWML document with a
 * MISSHAPEN config, an UNKNOWN verb, or a MISSPELLED/unknown key must RAISE —
 * not silently drop/accept it. This program builds EACH corpus case in TS idiom,
 * wraps the build in try/catch, and emits ONE JSON object mapping
 *
 *   case-id -> "raised" | "ok"
 *
 * to stdout ("raised" = the build threw, "ok" = it built clean). The differ
 * compares each outcome against the python oracle.
 *
 * Corpus verb mapping (mirrors diff_port_strict_render._run_case_python):
 *   - target "SWMLService": `add_verb(name, config)` on a schema-validation-ON
 *     SWMLService — TS `SWMLService.addVerb(name, config)`.
 *   - target "AgentBase": define_tool + define_contexts -> add_context ->
 *     add_step -> set_text/set_functions/set_valid_contexts, then validate via
 *     ContextBuilder.toDict() (which calls validate()). `_ctx_add_step` /
 *     `_ctx_validate` are corpus-level verbs interpreted here against the TS
 *     contexts API.
 *
 * The SDK's Logger routes info/debug to STDOUT and reads SIGNALWIRE_LOG_MODE at
 * module-load, so we force logging off and dynamically import the SDK AFTER
 * setting the env (a static ESM import hoists above top-level statements). Only
 * JSON reaches stdout.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   SIGNALWIRE_LOG_MODE=off npx tsx scripts/strict-render-dump.ts
 */

process.env['SIGNALWIRE_LOG_MODE'] = 'off';

type Outcome = 'raised' | 'ok';

async function main(): Promise<void> {
  const { SWMLService } = await import('../src/SWMLService.js');
  const { AgentBase } = await import('../src/AgentBase.js');

  const out: Record<string, Outcome> = {};

  /** Run one builder, catching any throw as "raised". */
  const run = (fn: () => void): Outcome => {
    try {
      fn();
      return 'ok';
    } catch {
      return 'raised';
    }
  };

  // ── SWMLService verb-level cases (schema validation ON) ──
  // TS's SWMLService enables schema validation by default; addVerb runs the full
  // schema pass, so an unknown verb / misspelled-or-unknown key / wrong type
  // throws exactly as the python reference's add_verb does.
  const verbCase = (id: string, verb: string, config: unknown): void => {
    out[id] = run(() => {
      const svc = new SWMLService({ name: 's', route: '/s' });
      svc.addVerb(verb, config);
    });
  };

  // unknown / misspelled verb
  verbCase('strict_unknown_verb', 'foobar', {});
  // misspelled / unknown config key on a CLOSED verb
  verbCase('strict_answer_misspelled_key', 'answer', { maxduration: 5 });
  verbCase('strict_answer_unknown_key', 'answer', { wibble: 1 });
  verbCase('strict_play_misspelled_key', 'play', { urlz: ['say:hi'] });
  verbCase('strict_play_valid_plus_unknown_key', 'play', { url: 'say:hi', foo: 1 });
  verbCase('strict_record_misspelled_key', 'record', { formatt: 'wav' });
  // wrong-typed config
  verbCase('strict_answer_wrong_type', 'answer', { max_duration: 'notanumber' });
  // the ai verb: unknown/misspelled TOP-LEVEL keys (GAP1) — ai.params stays open
  verbCase('strict_ai_misspelled_top_key', 'ai', { prompt: { text: 'hi' }, temperatur: 0.5 });
  verbCase('strict_ai_unknown_top_key', 'ai', { prompt: { text: 'hi' }, zzz: 1 });
  verbCase('strict_ai_missing_prompt', 'ai', { post_prompt: { text: 'bye' } });
  // good documents must still render (regression guard)
  verbCase('strict_answer_ok', 'answer', { max_duration: 5 });
  verbCase('strict_play_ok', 'play', { url: 'say:hi' });
  verbCase('strict_ai_ok', 'ai', { prompt: { text: 'hi' } });
  verbCase('strict_ai_params_open_ok', 'ai', {
    prompt: { text: 'hi' },
    params: { some_future_param: 1 },
  });

  // ── AgentBase contexts-level cases (dangling refs) ──
  // define_tool + define_contexts -> add_context -> add_step -> set_* then
  // validate via toDict(). ContextBuilder.validate() rejects a step 'functions'
  // whitelist entry that is neither a registered tool nor a reserved native
  // (dangling ref, GAP2), and an undefined valid_contexts target.
  interface StepSpec {
    context: string;
    step: string;
    text?: string;
    functions?: string[];
    validContexts?: string[];
  }
  const ctxCase = (id: string, opts: { tools?: string[]; steps: StepSpec[] }): void => {
    out[id] = run(() => {
      const agent = new AgentBase({ name: 'a', route: '/a' });
      for (const tool of opts.tools ?? []) {
        agent.defineTool({
          name: tool,
          description: 'look up an order',
          parameters: {},
          handler: () => ({}),
        });
      }
      const contexts = agent.defineContexts();
      const ctxByName = new Map<string, ReturnType<typeof contexts.addContext>>();
      for (const s of opts.steps) {
        let ctx = ctxByName.get(s.context);
        if (!ctx) {
          ctx = contexts.addContext(s.context);
          ctxByName.set(s.context, ctx);
        }
        const st = ctx.addStep(s.step);
        if (s.text !== undefined) st.setText(s.text);
        if (s.functions !== undefined) st.setFunctions(s.functions);
        if (s.validContexts !== undefined) st.setValidContexts(s.validContexts);
      }
      // _ctx_validate: toDict() triggers ContextBuilder.validate().
      contexts.toDict();
    });
  };

  // GAP2/F3: 'get_datetime' is neither registered nor a reserved native — dangling.
  ctxCase('strict_dangling_step_function', {
    tools: ['order_status'],
    steps: [
      {
        context: 'default',
        step: 'help',
        text: 'help',
        functions: ['order_status', 'get_datetime'],
      },
    ],
  });
  // a step referencing a registered tool must render.
  ctxCase('strict_registered_step_function_ok', {
    tools: ['order_status'],
    steps: [{ context: 'default', step: 'help', text: 'help', functions: ['order_status'] }],
  });
  // reserved native tools (next_step/change_context) are not dangling.
  ctxCase('strict_reserved_native_function_ok', {
    steps: [
      {
        context: 'default',
        step: 'help',
        text: 'help',
        functions: ['next_step', 'change_context'],
      },
    ],
  });
  // valid_contexts references an undefined context — must raise.
  ctxCase('strict_dangling_valid_context', {
    steps: [{ context: 'default', step: 'help', text: 'help', validContexts: ['nowhere'] }],
  });

  process.stdout.write(JSON.stringify(out) + '\n');
}

void main();
