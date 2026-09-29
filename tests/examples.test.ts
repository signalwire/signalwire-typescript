/**
 * Smoke tests for all example files.
 *
 * Dynamically imports each example and verifies it produces valid SWML
 * and has expected tools registered.
 */

import { loadAgent } from '../src/cli/agent-loader.js';

/** Minimal structural shape of a loaded agent/service that these smoke tests touch. */
interface LoadedAgent {
  // AgentBase returns a serialized JSON string; plain SWMLService returns the document object.
  renderSwml(callId?: string): string | Record<string, unknown>;
  getRegisteredTools(): { name: string }[];
}

/** SWML verb objects are keyed maps; tests probe individual verb keys. */
type SwmlVerb = Record<string, unknown>;

// Helper: load an example and return the agent
async function loadExample(name: string): Promise<LoadedAgent> {
  return loadAgent(`examples/${name}`) as Promise<LoadedAgent>;
}

describe('examples', () => {
  // ── Existing examples ───────────────────────────────────────────

  describe('simple-agent.ts', () => {
    it('renders SWML with AI block and get_time tool', async () => {
      const agent = await loadExample('simple-agent.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id') as string) as Record<
        string,
        unknown
      >;
      expect(swml).toHaveProperty('version', '1.0.0');
      expect(swml).toHaveProperty('sections');
      const tools = agent.getRegisteredTools();
      expect(tools.some((t) => t.name === 'get_time')).toBe(true);
    });
  });

  // ── Prefab examples ─────────────────────────────────────────────

  describe('prefab-info-gatherer.ts', () => {
    it('renders SWML with start_questions and submit_answer tools', async () => {
      const agent = await loadExample('prefab-info-gatherer.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id') as string) as Record<
        string,
        unknown
      >;
      expect(swml).toHaveProperty('version');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('start_questions');
      expect(names).toContain('submit_answer');
    });
  });

  describe('prefab-survey.ts', () => {
    it('renders SWML with survey tools', async () => {
      const agent = await loadExample('prefab-survey.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('answer_question');
      expect(names).toContain('get_current_question');
      expect(names).toContain('get_survey_progress');
    });
  });

  describe('prefab-faq.ts', () => {
    it('renders SWML with search_faqs and escalate tools', async () => {
      const agent = await loadExample('prefab-faq.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('search_faqs');
      expect(names).toContain('escalate');
    });
  });

  describe('prefab-concierge.ts', () => {
    it('renders SWML with concierge tools', async () => {
      const agent = await loadExample('prefab-concierge.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('check_availability');
      expect(names).toContain('get_directions');
    });
  });

  describe('prefab-receptionist.ts', () => {
    it('renders SWML with receptionist tools', async () => {
      const agent = await loadExample('prefab-receptionist.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('collect_caller_info');
      expect(names).toContain('transfer_call');
      expect(names).toContain('check_in_visitor');
    });
  });

  // ── Skills & features examples ──────────────────────────────────

  describe('skills-demo.ts', () => {
    it('renders SWML with datetime and math tools from skills', async () => {
      const agent = await loadExample('skills-demo.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('get_current_time');
      expect(names).toContain('get_current_date');
      expect(names).toContain('calculate');
    });
  });

  describe('advanced-dynamic-config.ts', () => {
    it('renders SWML with lookup_account tool', async () => {
      const agent = await loadExample('advanced-dynamic-config.ts');
      const tools = agent.getRegisteredTools();
      expect(tools.some((t) => t.name === 'lookup_account')).toBe(true);
    });
  });

  describe('llm-params.ts', () => {
    it('renders SWML with tuned parameters', async () => {
      const agent = await loadExample('llm-params.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id') as string) as Record<
        string,
        unknown
      >;
      expect(swml).toHaveProperty('version');
      // Check the AI params contain temperature
      const sections = swml['sections'] as Record<string, SwmlVerb[]>;
      const main = sections['main'];
      const aiVerb = main!.find((v) => v['ai']) as {
        ai: { params: Record<string, unknown> };
      };
      expect(aiVerb).toBeDefined();
      expect(aiVerb['ai']['params']['barge_match_string']).toBe('stop|cancel|hold on');
    });

    it('puts sampling settings on the prompt, not in params', async () => {
      const agent = await loadExample('llm-params.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id') as string) as Record<
        string,
        unknown
      >;
      const main = (swml['sections'] as Record<string, SwmlVerb[]>)['main'];
      const ai = (main!.find((v) => v['ai']) as { ai: Record<string, Record<string, unknown>> })[
        'ai'
      ];
      // temperature, top_p and confidence are AIPromptText keys in the SWML schema.
      expect(ai['prompt']).toMatchObject({ temperature: 0.2, top_p: 0.9, confidence: 0.6 });
      for (const key of ['temperature', 'top_p', 'confidence', 'barge_confidence']) {
        expect(ai['params']).not.toHaveProperty(key);
      }
    });
  });

  describe('advanced-datamap.ts', () => {
    /** Render the example and return its SWAIG functions keyed by name. */
    async function renderFunctions(): Promise<Record<string, Record<string, unknown>>> {
      const agent = await loadExample('advanced-datamap.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id') as string) as Record<
        string,
        unknown
      >;
      const main = (swml['sections'] as Record<string, SwmlVerb[]>)['main'];
      const ai = (main!.find((v) => v['ai']) as { ai: { SWAIG: { functions: unknown[] } } })['ai'];
      const byName: Record<string, Record<string, unknown>> = {};
      for (const fn of ai.SWAIG.functions as Record<string, unknown>[]) {
        byName[fn['function'] as string] = fn;
      }
      return byName;
    }

    it('reads the foreach array by its key in the response, not a template', async () => {
      const fns = await renderFunctions();
      const dataMap = fns['get_news']!['data_map'] as {
        webhooks: { foreach: { input_key: string } }[];
      };
      expect(dataMap.webhooks[0]!.foreach.input_key).toBe('articles');
    });

    it('matches case-insensitively with patterns JavaScript also accepts', async () => {
      const fns = await renderFunctions();
      for (const name of ['detect_greeting', 'check_status']) {
        const dataMap = fns[name]!['data_map'] as {
          expressions: { string: string; pattern: string }[];
        };
        for (const expr of dataMap.expressions) {
          // The value is lowercased with lc:, so the pattern needs no (?i) modifier,
          // which the swaig-test simulator's JavaScript RegExp rejects.
          expect(expr.string.startsWith('${lc:')).toBe(true);
          expect(() => new RegExp(expr.pattern)).not.toThrow();
        }
      }
    });
  });

  describe('gather-info.ts', () => {
    it('collects the intake answers with gather info steps', async () => {
      const agent = await loadExample('gather-info.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id') as string) as Record<
        string,
        unknown
      >;
      const main = (swml['sections'] as Record<string, SwmlVerb[]>)['main'];
      const ai = (
        main!.find((v) => v['ai']) as {
          ai: { prompt: { contexts: Record<string, { steps: Record<string, unknown>[] }> } };
        }
      )['ai'];
      const steps = ai.prompt.contexts['default']!.steps;
      const gathers = steps
        .map((s) => s['gather_info'] as { output_key?: string; questions: { key: string }[] })
        .filter(Boolean);
      expect(gathers.map((g) => g.output_key)).toEqual(['patient_demographics', 'visit_reason']);
      expect(gathers.flatMap((g) => g.questions.map((q) => q.key))).toContain('full_name');
      expect(agent.getRegisteredTools().map((t) => t.name)).toContain('submit_intake');
    });
  });

  describe('mcp-gateway.ts', () => {
    const MCP_ENV = [
      'MCP_GATEWAY_URL',
      'MCP_GATEWAY_AUTH_TOKEN',
      'MCP_GATEWAY_AUTH_USER',
      'MCP_GATEWAY_AUTH_PASSWORD',
      'MCP_GATEWAY_SERVICES',
      'SWML_ALLOW_PRIVATE_URLS',
    ];
    beforeEach(() => {
      vi.resetModules();
      for (const name of MCP_ENV) vi.stubEnv(name, undefined);
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('loads without a gateway configured and says how to configure one', async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const agent = await loadExample('mcp-gateway.ts');
        expect(agent.getRegisteredTools()).toEqual([]);
        expect(errors.mock.calls.flat().join('\n')).toContain('MCP_GATEWAY_URL');
      } finally {
        errors.mockRestore();
      }
    });

    it('registers the gateway tools when the environment points at a gateway', async () => {
      const { createServer } = await import('node:http');
      const server = createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.headers.authorization !== 'Bearer test-token') {
          res.statusCode = 401;
          res.end('{}');
        } else if (req.url === '/health') {
          res.end('{"status":"ok"}');
        } else if (req.url === '/services/todo/tools') {
          res.end(
            JSON.stringify({
              tools: [{ name: 'add_todo', description: 'Add a todo', inputSchema: {} }],
            }),
          );
        } else {
          res.statusCode = 404;
          res.end('{}');
        }
      });
      await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
      try {
        const { port } = server.address() as { port: number };
        vi.stubEnv('MCP_GATEWAY_URL', `http://127.0.0.1:${port}`);
        vi.stubEnv('MCP_GATEWAY_AUTH_TOKEN', 'test-token');
        vi.stubEnv('MCP_GATEWAY_SERVICES', 'todo');
        vi.stubEnv('SWML_ALLOW_PRIVATE_URLS', 'true');
        const agent = await loadExample('mcp-gateway.ts');
        expect(agent.getRegisteredTools().map((t) => t.name)).toContain('mcp_todo_add_todo');
      } finally {
        server.close();
      }
    });
  });

  describe('datasphere.ts', () => {
    const DS_ENV = [
      'DATASPHERE_DOCUMENT_ID',
      'SIGNALWIRE_SPACE',
      'SIGNALWIRE_PROJECT_ID',
      'SIGNALWIRE_API_TOKEN',
      'DATASPHERE_BASE_URL',
    ];
    beforeEach(() => {
      vi.resetModules();
      for (const name of DS_ENV) vi.stubEnv(name, undefined);
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it('loads without DataSphere configured and says what to set', async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const agent = await loadExample('datasphere.ts');
        expect(agent.getRegisteredTools()).toEqual([]);
        expect(errors.mock.calls.flat().join('\n')).toContain('DATASPHERE_DOCUMENT_ID');
      } finally {
        errors.mockRestore();
      }
    });

    it('searches the configured document with the skill parameters count and distance', async () => {
      vi.stubEnv('DATASPHERE_DOCUMENT_ID', 'doc-123');
      vi.stubEnv('SIGNALWIRE_SPACE', 'example');
      vi.stubEnv('SIGNALWIRE_PROJECT_ID', 'project');
      vi.stubEnv('SIGNALWIRE_API_TOKEN', 'token');
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify({ chunks: [{ text: 'Opening hours are 9 to 5.' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      );
      vi.stubGlobal('fetch', fetchMock);
      const agent = (await loadExample('datasphere.ts')) as LoadedAgent & {
        getTool(name: string): { execute(args: Record<string, unknown>): Promise<unknown> };
      };
      await agent.getTool('search_knowledge').execute({ query: 'opening hours' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const init = (fetchMock.mock.calls[0] as unknown[])[1] as { body: string };
      expect(JSON.parse(init.body)).toMatchObject({
        document_id: 'doc-123',
        count: 3,
        distance: 4,
      });
    });
  });

  describe('datasphere-serverless-env.ts', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('renders the serverless DataMap search with count and distance from the environment', async () => {
      vi.resetModules();
      vi.stubEnv('SIGNALWIRE_SPACE', 'acme.signalwire.com');
      vi.stubEnv('SIGNALWIRE_PROJECT_ID', 'project');
      vi.stubEnv('SIGNALWIRE_API_TOKEN', 'token');
      vi.stubEnv('DATASPHERE_DOCUMENT_ID', 'doc-123');
      vi.stubEnv('DATASPHERE_COUNT', '2');
      vi.stubEnv('DATASPHERE_DISTANCE', '5');
      const agent = await loadExample('datasphere-serverless-env.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id') as string) as Record<
        string,
        unknown
      >;
      const main = (swml['sections'] as Record<string, SwmlVerb[]>)['main'];
      const ai = (main!.find((v) => v['ai']) as { ai: { SWAIG: { functions: unknown[] } } })['ai'];
      const search = (ai.SWAIG.functions as Record<string, unknown>[]).find(
        (f) => f['function'] === 'search_knowledge',
      ) as { data_map: { webhooks: { url: string; params: Record<string, unknown> }[] } };
      expect(search.data_map.webhooks[0]!.url).toBe(
        'https://acme.signalwire.com/api/datasphere/documents/search',
      );
      expect(search.data_map.webhooks[0]!.params).toMatchObject({
        document_id: 'doc-123',
        count: 2,
        distance: 5,
      });
    });
  });

  describe('session-state.ts', () => {
    it('renders SWML with lookup_order tool', async () => {
      const agent = await loadExample('session-state.ts');
      const tools = agent.getRegisteredTools();
      expect(tools.some((t) => t.name === 'lookup_order')).toBe(true);
    });
  });

  describe('record-call.ts', () => {
    it('renders SWML with recording tools', async () => {
      const agent = await loadExample('record-call.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('start_recording');
      expect(names).toContain('stop_recording');
      expect(names).toContain('transfer_to_supervisor');
    });
  });

  // ── Infrastructure & verb examples ──────────────────────────────

  describe('serverless-lambda.ts', () => {
    it('renders SWML and exports handler function', async () => {
      // loadAgent will find the 'agent' export
      const agent = await loadExample('serverless-lambda.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id') as string) as Record<
        string,
        unknown
      >;
      expect(swml).toHaveProperty('version');
    });

    it('exports the Lambda handler without starting a server', async () => {
      vi.resetModules();
      const sdk = await import('../src/index.js');
      const serve = vi.spyOn(sdk.AgentBase.prototype, 'serve').mockResolvedValue(undefined);
      try {
        const mod = (await import('../examples/serverless-lambda.js')) as Record<string, unknown>;
        expect(typeof mod['handler']).toBe('function');
        expect(serve).not.toHaveBeenCalled();
      } finally {
        serve.mockRestore();
      }
    });
  });

  describe('verb-methods.ts', () => {
    it('renders SWML with pre-answer and post-AI verbs', async () => {
      const agent = await loadExample('verb-methods.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id') as string) as Record<
        string,
        unknown
      >;
      expect(swml).toHaveProperty('version');
      const main = (swml['sections'] as Record<string, SwmlVerb[]>)['main'];
      // Should have pre-answer play verb
      expect(main!.some((v) => v['play'])).toBe(true);
    });
  });

  describe('kubernetes-agent.ts', () => {
    it('renders SWML with get_status tool', async () => {
      const agent = await loadExample('kubernetes-agent.ts');
      const tools = agent.getRegisteredTools();
      expect(tools.some((t) => t.name === 'get_status')).toBe(true);
    });
  });

  // ── SWMLService examples ────────────────────────────────────────

  describe('swml-service.ts', () => {
    it('produces SWML with no AI block', async () => {
      const svc = await loadExample('swml-service.ts');
      const doc = svc.renderSwml() as Record<string, unknown>;
      expect(doc).toHaveProperty('version', '1.0.0');
      const main = (doc['sections'] as Record<string, SwmlVerb[]>)['main'];
      expect(main!.length).toBeGreaterThan(0);
      // No AI block in any verb
      for (const verb of main!) {
        expect(verb).not.toHaveProperty('ai');
      }
    });
  });

  describe('dynamic-swml-service.ts', () => {
    it('loads without error', async () => {
      const svc = await loadExample('dynamic-swml-service.ts');
      expect(svc).toBeDefined();
      // Static renderSwml returns empty main (dynamic content is per-request)
      const doc = svc.renderSwml();
      expect(doc).toHaveProperty('version', '1.0.0');
    });
  });
});
