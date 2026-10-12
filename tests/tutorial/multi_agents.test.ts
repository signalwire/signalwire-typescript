/**
 * The multi-agent tutorial (tutorial/multi_agents/), driven through each
 * agent's HTTP app as SignalWire would drive it: SWML fetched with basic auth,
 * and tools called on the SWAIG endpoint with the per-call token from that
 * SWML's web_hook_url. Each test checks a claim the lessons make.
 */

import { fileURLToPath } from 'node:url';
import type { AgentBase, AgentServer } from '../../src/index.js';
import type * as PcBuilder from '../../tutorial/multi_agents/pc_builder.js';

type Json = Record<string, unknown>;
type App = { request: (path: string, init?: RequestInit) => Response | Promise<Response> };

const USER = 'tutorial-user';
const PASS = 'tutorial-pass';
const basic = (user: string, pass: string) => ({
  Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64'),
});
const AUTH = basic(USER, PASS);

const knowledge = (name: string) =>
  fileURLToPath(new URL(`../../tutorial/multi_agents/${name}`, import.meta.url));

/** The ai verb of a SWML document. */
function aiVerb(swml: Json): Json {
  const main = (swml['sections'] as { main: Json[] }).main;
  const verb = main.find((v) => 'ai' in v);
  if (!verb) throw new Error('no ai verb in the SWML');
  return verb['ai'] as Json;
}
const sections = (swml: Json) =>
  (aiVerb(swml)['prompt'] as Json)['pom'] as { title: string; body?: string; bullets?: string[] }[];
const titles = (swml: Json) => sections(swml).map((s) => s.title);
const functions = (swml: Json) =>
  ((aiVerb(swml)['SWAIG'] as Json | undefined)?.['functions'] as Json[] | undefined) ?? [];

/** One simulated call to an agent served by `app` at `route`. */
class Call {
  constructor(
    readonly app: App,
    readonly route: string,
    readonly auth: Record<string, string> = AUTH,
    readonly callId = 'call-1',
  ) {}

  private path(suffix: string): string {
    return `${this.route === '/' ? '' : this.route}${suffix}`;
  }

  async swml(query = ''): Promise<Json> {
    const res = await this.app.request(this.path(`/?call_id=${this.callId}${query}`), {
      headers: this.auth,
    });
    expect(res.status).toBe(200);
    return (await res.json()) as Json;
  }

  /** POST the function to the SWAIG endpoint, with the token its web_hook_url carries. */
  async invoke(fn: string, args: Json): Promise<Json> {
    const entry = functions(await this.swml()).find((f) => f['function'] === fn);
    if (!entry) throw new Error(`${fn} is not in the SWML`);
    const token = new URL(String(entry['web_hook_url'])).searchParams.get('__token');
    const res = await this.app.request(this.path(`/swaig?__token=${token}`), {
      method: 'POST',
      headers: { ...this.auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        function: fn,
        call_id: this.callId,
        argument: { parsed: [args], raw: JSON.stringify(args) },
      }),
    });
    expect(res.status).toBe(200);
    return (await res.json()) as Json;
  }
}

const responseOf = (body: Json) => String(body['response']);
const actions = (body: Json) => (body['action'] as Json[] | undefined) ?? [];

let savedEnv: NodeJS.ProcessEnv;
beforeAll(() => {
  savedEnv = { ...process.env };
  process.env['SIGNALWIRE_LOG_MODE'] = 'off';
  process.env['SWML_BASIC_AUTH_USER'] = USER;
  process.env['SWML_BASIC_AUTH_PASSWORD'] = PASS;
  delete process.env['SWML_PROXY_URL_BASE'];
  delete process.env['SIGNALWIRE_SIGNING_KEY'];
  delete process.env['PORT'];
});
afterAll(() => {
  process.env = savedEnv;
});

describe('Lesson 1: sales_agent.ts', () => {
  it('serves Morgan with four prompt sections and the rime.marsh voice, and no tools', async () => {
    const { agent } = await import('../../tutorial/multi_agents/sales_agent.js');
    const swml = await new Call(agent.getApp(), '/').swml();
    expect(titles(swml)).toEqual(['AI Role', 'Your Expertise', 'Your Tasks', 'Voice Instructions']);
    expect(sections(swml)[0]!.body).toMatch(/^You are Morgan/);
    expect(aiVerb(swml)['languages']).toEqual([
      expect.objectContaining({ name: 'English', code: 'en-US', voice: 'rime.marsh' }),
    ]);
    expect(functions(swml)).toEqual([]);
    // answer comes before ai, as the lesson's SWML sample shows
    expect(Object.keys((swml['sections'] as { main: Json[] }).main[0]!)).toEqual(['answer']);
  });

  it('refuses a request without credentials', async () => {
    const { agent } = await import('../../tutorial/multi_agents/sales_agent.js');
    expect((await agent.getApp().request('/')).status).toBe(401);
  });
});

describe('Lesson 2: knowledge.ts and sales_agent_with_search.ts', () => {
  it('splits each knowledge file into one document per ### section', async () => {
    const { loadKnowledge } = await import('../../tutorial/multi_agents/knowledge.js');
    const sales = loadKnowledge(knowledge('sales_knowledge.md'));
    const support = loadKnowledge(knowledge('support_knowledge.md'));
    expect(sales).toHaveLength(18);
    expect(support).toHaveLength(19);
    expect(sales[1]!.metadata).toEqual({
      filename: 'sales_knowledge.md',
      section: 'Gaming PC Builds > Mid-Range Gaming Build ($1500-$2000)',
    });
    expect(sales[1]!.text).toMatch(/^Gaming PC Builds > Mid-Range.*\n- \*\*CPU\*\*/);
    // A heading with nothing under it adds no document
    expect(support.map((d) => d.metadata.section)).not.toContain(
      'Common Boot Issues > System Crashes/Blue Screens',
    );
  });

  it('adds search_sales_knowledge and the search instructions to the prompt', async () => {
    const { agent } = await import('../../tutorial/multi_agents/sales_agent_with_search.js');
    const swml = await new Call(agent.getApp(), '/').swml();
    expect(functions(swml).map((f) => f['function'])).toEqual(['search_sales_knowledge']);
    expect(titles(swml)).toEqual([
      'AI Role',
      'Your Expertise',
      'Your Tasks',
      'Voice Instructions',
      'Tools Available',
      'Important',
      'Knowledge Search',
    ]);
    const search = sections(swml).find((s) => s.title === 'Knowledge Search')!;
    expect(search.body).toContain('over 18 indexed document(s)');
  });

  it('answers a budget question with the matching build first', async () => {
    const { agent } = await import('../../tutorial/multi_agents/sales_agent_with_search.js');
    const body = await new Call(agent.getApp(), '/').invoke('search_sales_knowledge', {
      query: 'gaming PC under $1500',
    });
    const text = responseOf(body);
    expect(text).toMatch(/^Found 3 relevant results for 'gaming PC under \$1500'/);
    expect(text).toMatch(
      /\*\*Result 1\*\* \(from sales_knowledge\.md, section: Gaming PC Builds > Mid-Range Gaming Build/,
    );
    expect(text).toContain('NVIDIA RTX 4070');
  });

  it('finds a component by name, and says so when nothing matches', async () => {
    const { agent } = await import('../../tutorial/multi_agents/sales_agent_with_search.js');
    const call = new Call(agent.getApp(), '/');
    const rtx = responseOf(await call.invoke('search_sales_knowledge', { query: 'RTX 4090' }));
    // Keyword ranking: the power supply table names the RTX 4090 too, in a shorter section
    expect(rtx).toMatch(/\*\*Result 1\*\* .*Power Supply Requirements/);
    expect(rtx).toMatch(/\*\*Result 2\*\* .*Enthusiast Gaming Build/);
    const none = responseOf(await call.invoke('search_sales_knowledge', { query: 'espresso' }));
    expect(none).toBe("No information found for 'espresso'");
  });
});

describe('Lesson 3: pc_builder.ts', () => {
  let mod: typeof PcBuilder;
  let server: AgentServer;
  let app: App;

  beforeAll(async () => {
    mod = await import('../../tutorial/multi_agents/pc_builder.js');
    server = await mod.createPcBuilderApp({ port: 3001, basicAuth: [USER, PASS] });
    app = server.getApp();
  });

  it('hosts the three agents on their routes, and /info and /health without auth', async () => {
    expect([...server.getAgents().keys()]).toEqual(['/', '/sales', '/support']);
    const info = await app.request('/info');
    expect(info.status).toBe(200);
    expect(((await info.json()) as Json)['agents']).toEqual(
      expect.objectContaining({ sales: expect.objectContaining({ endpoint: '/sales' }) }),
    );
    expect((await app.request('/health')).status).toBe(200);
    for (const route of ['/', '/sales', '/support']) {
      expect((await app.request(route)).status).toBe(401);
    }
  });

  it('gives each agent its persona and voice', async () => {
    const voices: Record<string, string> = {};
    for (const route of ['/', '/sales', '/support']) {
      const swml = await new Call(app, route).swml();
      const [lang] = aiVerb(swml)['languages'] as Json[];
      voices[route] = String(lang!['voice']);
    }
    expect(voices).toEqual({ '/': 'rime.spore', '/sales': 'rime.marsh', '/support': 'rime.cove' });
  });

  it('offers the triage agent one transfer tool that requires a name and a summary', async () => {
    const swml = await new Call(app, '/').swml();
    const [fn, ...rest] = functions(swml);
    expect(rest).toEqual([]);
    expect(fn!['function']).toBe('transfer_to_specialist');
    expect((fn!['parameters'] as Json)['required']).toEqual([
      'specialist_type',
      'user_name',
      'summary',
    ]);
  });

  it('transfers to sales with the caller name and summary saved as call_data', async () => {
    const body = await new Call(app, '/').invoke('transfer_to_specialist', {
      specialist_type: 'sales',
      user_name: 'Jane Doe',
      summary: 'Jane wants a gaming PC for about $1500.',
    });
    expect(responseOf(body)).toBe(
      'Perfect! Let me transfer you to our sales specialist right away.',
    );
    expect(body['post_process']).toBe(true);
    const acts = actions(body);
    expect(acts[0]).toEqual({
      set_global_data: {
        call_data: { user_name: 'Jane Doe', summary: 'Jane wants a gaming PC for about $1500.' },
      },
    });
    const swml = (acts[1] as { SWML: { sections: { main: Json[] } } }).SWML;
    expect(swml.sections.main[1]).toEqual({
      transfer: { dest: `http://${USER}:${PASS}@localhost:3001/sales?transfer=true` },
    });
  });

  it('matches support case-insensitively, and asks again for an unknown specialist', async () => {
    const call = new Call(app, '/');
    const support = await call.invoke('transfer_to_specialist', {
      specialist_type: 'Technical Support',
      user_name: 'Sam',
      summary: 'PC will not boot.',
    });
    expect(JSON.stringify(actions(support))).toContain('/support?transfer=true');
    const billing = await call.invoke('transfer_to_specialist', {
      specialist_type: 'billing',
      user_name: 'Sam',
      summary: 'Question about an invoice.',
    });
    expect(responseOf(billing)).toBe(
      'I can transfer you to either our sales or support specialist. Which would you prefer?',
    );
    expect(JSON.stringify(actions(billing))).not.toContain('transfer');
  });

  it('serves the transfer URL: the sales agent greets a transferred caller by name', async () => {
    // Follow the URL the transfer action names, with the credentials it carries
    const body = await new Call(app, '/').invoke('transfer_to_specialist', {
      specialist_type: 'sales',
      user_name: 'Jane',
      summary: 'Gaming PC.',
    });
    const dest = new URL(
      String(
        (
          (actions(body)[1] as { SWML: { sections: { main: Json[] } } }).SWML.sections.main[1]![
            'transfer'
          ] as Json
        )['dest'],
      ),
    );
    const res = await app.request(`${dest.pathname}${dest.search}`, {
      headers: basic(dest.username, dest.password),
    });
    expect(res.status).toBe(200);
    const swml = (await res.json()) as Json;
    const transfer = sections(swml).find((s) => s.title === 'Call Transfer Information');
    expect(transfer?.bullets?.[0]).toBe(
      "The customer's name is ${call_data.user_name} - greet them by name",
    );
    expect(titles(swml)).not.toContain('Initial Greeting');
  });

  it('greets a direct caller without the transfer section, on every request', async () => {
    const sales = new Call(app, '/sales');
    await sales.swml('&transfer=true');
    const direct = await sales.swml();
    expect(titles(direct)).toContain('Initial Greeting');
    expect(titles(direct)).not.toContain('Call Transfer Information');
    const support = await new Call(app, '/support').swml('&transfer=true');
    expect(titles(support)).toContain('Call Transfer Information');
    expect(titles(support)).not.toContain('Initial Greeting');
  });

  it('gives the sales agent its search tool and its two sales tools', async () => {
    const sales = new Call(app, '/sales');
    expect(functions(await sales.swml()).map((f) => f['function'])).toEqual([
      'search_sales_knowledge',
      'create_build_recommendation',
      'check_component_compatibility',
    ]);
    const rec = await sales.invoke('create_build_recommendation', {
      budget: '2000',
      use_case: 'gaming',
      preferences: 'quiet',
    });
    expect(responseOf(rec)).toMatch(/^Based on your \$2000 budget for gaming, I recommend: /);
  });

  it('gives the support agent its search tool, and tickets with a dated ID', async () => {
    const support = new Call(app, '/support');
    const found = responseOf(
      await support.invoke('search_support_knowledge', { query: "PC won't turn on at all" }),
    );
    expect(found).toMatch(
      /\*\*Result 1\*\* .*section: Common Boot Issues > PC Won't Turn On At All/,
    );
    const ticket = responseOf(
      await support.invoke('create_support_ticket', {
        issue_description: 'No POST after a GPU swap',
        customer_info: 'Sam, sam@example.com',
        priority: 'high',
      }),
    );
    expect(ticket).toMatch(
      /^Support ticket SUP-\d{8}-\d{6} created for: No POST after a GPU swap\. Priority: high\./,
    );
  });

  it('shares one generated password across the agents when none is configured', async () => {
    delete process.env['SWML_BASIC_AUTH_PASSWORD'];
    try {
      const generated = await mod.createPcBuilderApp({ port: 3001 });
      const creds = [...generated.getAgents().values()].map((a: AgentBase) =>
        a.getBasicAuthCredentials().join(':'),
      );
      expect(new Set(creds).size).toBe(1);
      expect(creds[0]).toMatch(new RegExp(`^${USER}:[0-9a-f]{32}$`));
    } finally {
      process.env['SWML_BASIC_AUTH_PASSWORD'] = PASS;
    }
  });

  it('serves the same service through the Lambda handler', async () => {
    const res = (await mod.lambdaHandler({
      httpMethod: 'GET',
      path: '/info',
      headers: {},
    })) as Json;
    expect(res['statusCode']).toBe(200);
    expect(String(res['body'])).toContain('PC Builder Pro - Multi-Agent Service');
  });
});
