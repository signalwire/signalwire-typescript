/**
 * state-dump.ts — the TypeScript port's STATE dump program for the cross-port
 * state differ (porting-sdk/scripts/diff_port_state.py).
 *
 * For each state_corpus case it builds the target object, applies the mutation
 * chain via the TS SDK's native API, reads the observable state, and prints ONE
 * JSON object mapping
 *
 *   case-id -> observed-state
 *
 * to stdout. The differ canonicalizes both sides and byte-compares against the
 * python oracle. Only stdout carries JSON.
 *
 * A few observables live on private fields (global data, the sip-username set,
 * the routing-callback map). This diagnostic dump reads them by field name — it
 * is not SDK surface, it is a state observer analogous to the python oracle's
 * `obj._global_data` / `obj._sip_usernames` reads. Logging is forced off (the
 * Logger routes info/debug to stdout) and the SDK is loaded via a deferred
 * import after the env is set, so only JSON reaches stdout.
 *
 * Run from the signalwire-typescript repo root:
 *
 *   npx tsx scripts/state-dump.ts
 */

process.env['SIGNALWIRE_LOG_MODE'] = 'off';

/* eslint-disable @typescript-eslint/no-explicit-any */

async function main(): Promise<void> {
  const { AgentBase } = await import('../src/AgentBase.js');
  const { AgentServer } = await import('../src/AgentServer.js');
  const { SWMLService } = await import('../src/SWMLService.js');
  const { VerbHandlerRegistry } = await import('../src/SWMLHandler.js');
  const { SkillRegistry } = await import('../src/skills/SkillRegistry.js');
  const { SkillBase } = await import('../src/skills/SkillBase.js');
  const { InfoGathererAgent } = await import('../src/prefabs/InfoGathererAgent.js');

  const demoAgent = () => new AgentBase({ name: 'demo', route: '/demo' });

  // read a private/protected field off an instance for state observation.
  const field = (o: unknown, name: string): any => (o as Record<string, any>)[name];

  const out: Record<string, unknown> = {};

  // ---- global_data: set MERGES into the accumulated global data ----
  {
    const a = demoAgent();
    a.setGlobalData({ company: 'SignalWire', tier: 'gold' });
    out['state_set_global_data'] = field(a, 'globalData');
  }
  {
    const a = demoAgent();
    a.updateGlobalData({ k1: 'v1' });
    a.updateGlobalData({ k2: 'v2' });
    out['state_update_global_data'] = field(a, 'globalData');
  }
  {
    // MERGE semantics: overlapping key wins, sibling survives.
    const a = demoAgent();
    a.setGlobalData({ a: 1, b: 2 });
    a.setGlobalData({ b: 99, c: 3 });
    out['state_global_data_merge'] = field(a, 'globalData');
  }

  // ---- sip-username registration on AgentBase (lowercased set) ----
  {
    const a = demoAgent();
    a.registerSipUsername('Bob');
    a.registerSipUsername('alice');
    out['state_register_sip_username'] = [
      ...(field(a, '_sipUsernames') as Map<string, string>).keys(),
    ].sort();
  }
  {
    // dedup + case-fold: "Bob","BOB","bob" collapse to one.
    const a = demoAgent();
    a.registerSipUsername('Bob');
    a.registerSipUsername('BOB');
    a.registerSipUsername('bob');
    out['state_register_sip_username_dedup'] = [
      ...(field(a, '_sipUsernames') as Map<string, string>).keys(),
    ].sort();
  }

  // ---- AgentServer sip-username mapping (username -> route) + lookup ----
  {
    const s = new AgentServer();
    s.setupSipRouting('/sip', false);
    s.registerSipUsername('Bob', '/agent');
    s.registerSipUsername('sales', '/sales');
    const mapping = field(s, '_sipUsernameMapping') as Map<string, string>;
    // lookup mirrors the server's own consultation: lowercased key into the map.
    const lookup = (u: string) => mapping.get(u.toLowerCase()) ?? null;
    out['server_sip_username_mapping'] = {
      mapping: Object.fromEntries(mapping),
      lookup_bob: lookup('bob'),
      lookup_BOB: lookup('BOB'),
      lookup_missing: lookup('nope'),
    };
  }
  {
    // unregister removes the agent route from the registry.
    const s = new AgentServer();
    s.register(new AgentBase({ name: 'agent', route: '/agent' }), '/agent');
    s.register(new AgentBase({ name: 'other', route: '/other' }), '/other');
    s.unregister('/agent');
    out['server_unregister'] = [...s.getAgents().keys()].sort();
  }

  // ---- routing-callback registration on SWMLService (path-normalized) ----
  {
    const svc = new SWMLService({ name: 'svc', route: '/svc' });
    const noop = () => null;
    svc.registerRoutingCallback(noop, '/sip/');
    svc.registerRoutingCallback(noop, 'voice');
    const cbs = field(svc, '_routingCallbacks') as Map<string, unknown>;
    out['state_register_routing_callback'] = [...cbs.keys()].sort();
  }

  // ---- verb-handler registration (VerbHandlerRegistry: ai preloaded) ----
  {
    const reg = new VerbHandlerRegistry();
    reg.registerHandler({
      getVerbName: () => 'greet',
      validateConfig: () => [true, []] as [boolean, string[]],
      buildConfig: (cfg: Record<string, unknown>) => cfg,
    } as any);
    const handlers = field(reg, 'handlers') as Map<string, unknown>;
    out['state_register_verb_handler'] = {
      verbs: [...handlers.keys()].sort(),
      has_greet: reg.hasHandler('greet'),
      has_ai: reg.hasHandler('ai'),
      has_missing: reg.hasHandler('nope'),
    };
  }

  // ---- skill registration (SkillRegistry: name -> class, idempotent) ----
  {
    const reg = new SkillRegistry();
    const makeSkill = (skillName: string): typeof SkillBase => {
      class S extends SkillBase {
        static override SKILL_NAME = skillName;
        static override SKILL_DESCRIPTION = `corpus skill ${skillName}`;
        static override getParameterSchema() {
          const schema = super.getParameterSchema();
          schema[`${skillName}_param`] = { type: 'string', default: '' };
          return schema;
        }
        override async setup(): Promise<boolean> {
          return true;
        }
        override registerTools(): void {
          /* no-op */
        }
      }
      return S as unknown as typeof SkillBase;
    };
    reg.register(makeSkill('custom_alpha'));
    reg.register(makeSkill('custom_beta'));
    reg.register(makeSkill('custom_alpha')); // idempotent (overwrites, no dup key)
    out['state_register_skill'] = reg.listRegistered().sort();
  }

  // ---- InfoGatherer.submit_answer: records answer + advances index ----
  const submitAnswerDelta = (
    ig: InstanceType<typeof InfoGathererAgent>,
    args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ): Record<string, unknown> => {
    const res = ig.submitAnswer(args, rawData);
    const d = res.toDict() as Record<string, any>;
    let gd: Record<string, any> = {};
    const actions = d['action'];
    if (Array.isArray(actions)) {
      for (const act of actions) {
        if (act && typeof act === 'object' && 'set_global_data' in act) {
          gd = act['set_global_data'];
          break;
        }
      }
    }
    const resp = typeof d['response'] === 'string' ? (d['response'] as string) : '';
    return {
      question_index: gd['question_index'],
      answers: gd['answers'],
      done: resp.includes('All questions have been answered'),
    };
  };
  {
    const ig = new InfoGathererAgent({
      questions: [
        { key_name: 'name', question_text: 'What is your name?' },
        { key_name: 'email', question_text: 'What is your email?' },
      ],
    } as any);
    out['infogatherer_submit_answer_first'] = submitAnswerDelta(
      ig,
      { answer: 'Alice' },
      {
        global_data: {
          questions: [
            { key_name: 'name', question_text: 'What is your name?' },
            { key_name: 'email', question_text: 'What is your email?' },
          ],
          question_index: 0,
          answers: [],
        },
      },
    );
  }
  {
    const ig = new InfoGathererAgent({
      questions: [
        { key_name: 'name', question_text: 'What is your name?' },
        { key_name: 'email', question_text: 'What is your email?' },
      ],
    } as any);
    out['infogatherer_submit_answer_last'] = submitAnswerDelta(
      ig,
      { answer: 'a@b.com' },
      {
        global_data: {
          questions: [
            { key_name: 'name', question_text: 'What is your name?' },
            { key_name: 'email', question_text: 'What is your email?' },
          ],
          question_index: 1,
          answers: [{ key_name: 'name', answer: 'Alice' }],
        },
      },
    );
  }

  // ---- contexts/steps navigation (valid_steps rendered per step) ----
  {
    const a = demoAgent();
    const cb = a.defineContexts();
    const ctx = cb.addContext('default');
    ctx.addStep('greet').setText('Greet the caller.').setValidSteps(['collect']);
    ctx.addStep('collect').setText('Collect their info.').setValidSteps(['greet']);
    const rendered = cb.toDict() as Record<string, any>;
    const nav: Record<string, unknown> = {};
    for (const [cname, cdoc] of Object.entries(rendered)) {
      const steps = (cdoc as Record<string, any>)['steps'] ?? [];
      nav[cname] = (steps as Record<string, any>[]).map((s) => ({
        name: s['name'],
        valid_steps: s['valid_steps'],
      }));
    }
    out['state_contexts_navigation'] = nav;
  }

  process.stdout.write(JSON.stringify(out) + '\n');
}

void main();
