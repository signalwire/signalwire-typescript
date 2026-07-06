/**
 * Tier-2 behavioral-contract tests (porting-sdk/BEHAVIORAL_CONTRACTS.md, tests 2-6).
 *
 * These assert the SAME observable behavior the Python reference has for
 * capabilities whose signature is DRIFT-clean but whose body is easy to stub.
 * Each test would FAIL against the stub it replaces (noted per test):
 *
 *  2. set_prompt_llm_params / set_post_prompt_llm_params MERGE (not replace).
 *  3. InfoGatherer submit_answer STATE MACHINE (record + advance + present next).
 *  4. native_vector_search REMOTE HTTP — real POST to <remote_url>/search.
 *  5. Serverless per-platform DISPATCH — lambda + cgi + gcf reach a real response.
 *  6. SIP routing DISPATCH over the served /sip path — 307 redirect on a match.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { AgentBase } from '../src/AgentBase.js';
import { AgentServer } from '../src/AgentServer.js';
import { ServerlessAdapter } from '../src/ServerlessAdapter.js';
import { NativeVectorSearchSkill } from '../src/skills/builtin/index.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { InfoGathererSkill } from '../src/skills/builtin/index.js';
import { suppressAllLogs } from '../src/Logger.js';

beforeAll(() => {
  suppressAllLogs(true);
});

// ── Contract 2: set_prompt_llm_params / set_post_prompt_llm_params MERGE ─────
//
// STUB it replaces: a replace-implementation would keep only the last params
// object, so `temperature` would be gone after the second call. TS merges via
// safeAssign (Object.assign semantics) — matching Python's dict.update().
describe('Contract 2 — set_prompt_llm_params MERGE (not replace)', () => {
  // Render the AI verb's `params` object from the SWML document.
  function aiParams(agent: AgentBase, key: 'prompt' | 'post_prompt'): Record<string, unknown> {
    const doc = JSON.parse(agent.renderSwml()) as {
      sections: { main: Array<Record<string, unknown>> };
    };
    const aiVerb = doc.sections.main.find((v) => 'ai' in v)!['ai'] as Record<string, unknown>;
    return aiVerb[key] as Record<string, unknown>;
  }

  it('two distinct-key calls merge — BOTH keys present in the rendered prompt', () => {
    const agent = new AgentBase({ name: 'merge', route: '/merge' });
    agent.setPromptText('hi');
    agent.setPromptLlmParams({ temperature: 0.5 });
    agent.setPromptLlmParams({ top_p: 0.9 });

    const params = aiParams(agent, 'prompt');
    expect(params['temperature']).toBe(0.5); // dropped by a replace-stub
    expect(params['top_p']).toBe(0.9);
  });

  it('post_prompt params merge the same way', () => {
    const agent = new AgentBase({ name: 'merge2', route: '/merge2' });
    agent.setPromptText('hi');
    agent.setPostPrompt('summarize');
    agent.setPostPromptLlmParams({ temperature: 0.3 });
    agent.setPostPromptLlmParams({ top_p: 0.8 });

    const params = aiParams(agent, 'post_prompt');
    expect(params['temperature']).toBe(0.3); // dropped by a replace-stub
    expect(params['top_p']).toBe(0.8);
  });
});

// ── Contract 3: InfoGatherer submit_answer STATE MACHINE ────────────────────
//
// STUB it replaces: an "Answer recorded" echo with no state would fail (a) and
// (b). TS records the answer into global_data.answers, advances question_index,
// and returns the 2nd question.
describe('Contract 3 — InfoGatherer submit_answer records + advances + presents next', () => {
  const QUESTIONS = [
    { key_name: 'first_name', question_text: 'What is your first name?' },
    { key_name: 'city', question_text: 'What city do you live in?' },
  ];

  it('submitting question 1 records the answer, advances the index, and presents question 2', async () => {
    const skill = new InfoGathererSkill({ questions: QUESTIONS });
    await skill.setup();
    const submitTool = skill.getTools().find((t) => t.name === 'submit_answer')!;
    const namespace = skill.getSkillNamespace();

    const rawData = {
      global_data: { [namespace]: { questions: QUESTIONS, question_index: 0, answers: [] } },
    };
    const result = submitTool.handler(
      { answer: 'Alice', confirmed_by_user: false },
      rawData,
    ) as FunctionResult;

    // (c) the 2nd question is presented in the response
    expect(result.response).toContain('What city do you live in?');
    expect(result.response).toContain('Question 2 of 2');

    // (a) + (b): the set_global_data action carries the recorded answer and the
    // advanced index (the actual state the platform persists for the next turn).
    const action = (result.toJSON() as { action?: Array<Record<string, unknown>> }).action ?? [];
    const setGlobal = action.find((a) => 'set_global_data' in a)!['set_global_data'] as Record<
      string,
      unknown
    >;
    const newState = setGlobal[namespace] as {
      question_index: number;
      answers: Array<{ key_name: string; answer: string }>;
    };
    expect(newState.question_index).toBe(1); // advanced (stub would stay 0)
    expect(newState.answers).toEqual([{ key_name: 'first_name', answer: 'Alice' }]); // recorded
  });
});

// ── Contract 4: native_vector_search REMOTE HTTP ────────────────────────────
//
// STUB it replaces: a hardcoded "[Would query…]" string. TS POSTs the query to
// <remote_url>/search and formats the returned results into the FunctionResult.
describe('Contract 4 — native_vector_search issues a real POST to <remote_url>/search', () => {
  let server: Server;
  let baseUrl: string;
  let lastSearchBody: Record<string, unknown> | null = null;
  const savedAllow = process.env['SWML_ALLOW_PRIVATE_URLS'];

  beforeAll(async () => {
    // Permit the loopback mock URL past SSRF protection (env parity with Python).
    process.env['SWML_ALLOW_PRIVATE_URLS'] = 'true';

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
          return;
        }
        if (req.method === 'POST' && req.url === '/search') {
          lastSearchBody = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              results: [
                {
                  content: 'The mitochondria is the powerhouse of the cell.',
                  score: 0.91,
                  metadata: { filename: 'biology.md' },
                },
              ],
            }),
          );
          return;
        }
        res.writeHead(404);
        res.end();
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(() => {
    lastSearchBody = null;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (savedAllow === undefined) delete process.env['SWML_ALLOW_PRIVATE_URLS'];
    else process.env['SWML_ALLOW_PRIVATE_URLS'] = savedAllow;
  });

  it('POSTs the query to /search and formats the mock results into the FunctionResult', async () => {
    const skill = new NativeVectorSearchSkill({ remote_url: baseUrl, index_name: 'kb' });
    const ready = await skill.setup();
    expect(ready).toBe(true); // remote health check reached the mock

    const searchTool = skill.getTools()[0]!;
    const result = (await searchTool.handler(
      { query: 'what is the powerhouse of the cell' },
      {},
    )) as FunctionResult;

    // A real POST hit /search with the query in the body (a stub string never
    // touches the network, so lastSearchBody stays null).
    expect(lastSearchBody).not.toBeNull();
    expect(lastSearchBody!['query']).toBe('what is the powerhouse of the cell');
    expect(lastSearchBody!['index_name']).toBe('kb');

    // The mock's result content is formatted into the response (not a canned string).
    expect(result.response).toContain('powerhouse of the cell');
    expect(result.response).not.toContain('Would query');
  });
});

// ── Contract 5: Serverless per-platform DISPATCH ────────────────────────────
//
// STUB it replaces: Lambda-only, with base64 bodies mangled and CGI never
// reconstructed from env/stdin. Now lambda + cgi + gcf all dispatch to a real
// SWML response through the Hono served path.
describe('Contract 5 — serverless dispatches lambda + cgi + gcf to a real response', () => {
  // A fresh agent auto-generates basic-auth creds; pin them so the served path
  // (used by every platform's dispatch) authorizes and we exercise real routing.
  function newAgentWithAuth(): { agent: AgentBase; auth: string } {
    const agent = new AgentBase({ name: 'srvless', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    return { agent, auth: `Basic ${Buffer.from('u:p').toString('base64')}` };
  }

  it('lambda: a proxy GET event returns the SWML document', async () => {
    const { agent, auth } = newAgentWithAuth();
    const res = await agent.runServerless(
      { httpMethod: 'GET', path: '/', headers: { host: 'x', authorization: auth } },
      undefined,
      'lambda',
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty('sections');
  });

  it('lambda: a base64-encoded POST body is decoded before routing', async () => {
    // Prove the decode by observing the body a routing callback receives: it only
    // 307-redirects when the DECODED JSON carries route:'transfer'. A mangled
    // (still-base64) body would not JSON-parse and the callback would see nothing,
    // so a 307 back is proof the adapter decoded isBase64Encoded before routing.
    const { agent, auth } = newAgentWithAuth();
    let seenBody: Record<string, unknown> | undefined;
    agent.registerRoutingCallback((body) => {
      seenBody = body as Record<string, unknown>;
      return (body as { route?: string }).route === 'transfer' ? '/transferred' : null;
    }, '/route');

    const payload = JSON.stringify({ route: 'transfer' });
    const res = await agent.runServerless(
      {
        httpMethod: 'POST',
        path: '/route',
        headers: { host: 'x', 'content-type': 'application/json', authorization: auth },
        body: Buffer.from(payload, 'utf-8').toString('base64'),
        isBase64Encoded: true,
      },
      undefined,
      'lambda',
    );
    expect(seenBody).toEqual({ route: 'transfer' }); // decoded, not base64 gibberish
    expect(res.statusCode).toBe(307);
    expect(res.headers['location']).toBe('/transferred');
  });

  it('cgi: reconstructs the request from the CGI environment and dispatches', async () => {
    const { agent, auth } = newAgentWithAuth();
    const app = agent.getApp();
    const adapter = new ServerlessAdapter('cgi');
    // Build a CGI event from a synthetic environment (no stdin body for a GET).
    // HTTP_AUTHORIZATION → authorization header, HTTP_HOST → host.
    const event = ServerlessAdapter.buildCgiEvent(
      {
        REQUEST_METHOD: 'GET',
        PATH_INFO: '/',
        HTTP_HOST: 'cgi.local',
        HTTP_AUTHORIZATION: auth,
      } as NodeJS.ProcessEnv,
      undefined,
    );
    expect(event.method).toBe('GET');
    expect(event.path).toBe('/');
    expect(event.headers!['authorization']).toBe(auth);

    const fetchFn = (req: Request): Promise<Response> => Promise.resolve(app.fetch(req));
    const res = await adapter.handleRequest({ fetch: fetchFn }, event);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty('sections');
  });

  it('gcf: an Express-style request dispatches to a real response', async () => {
    const { agent, auth } = newAgentWithAuth();
    const res = await agent.runServerless(
      { method: 'GET', path: '/', headers: { host: 'gcf.local', authorization: auth } },
      undefined,
      'gcf',
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toHaveProperty('sections');
  });
});

// ── Contract 6: SIP routing DISPATCH over the served /sip path ──────────────
//
// STUB it replaces: enableSipRouting stored `_sipUsernames` but registered NO
// routing callback (stored-but-unconsulted), and AgentServer built a
// server-level callback it never registered. Now a SIP body to the served /sip
// path extracts the username, consults the mapping, and 307-redirects.
describe('Contract 6 — SIP routing dispatches over the served /sip path', () => {
  it('a registered SIP username routes: POST /sip 307-redirects to the owning agent', async () => {
    const server = new AgentServer();
    // route '/' → the agent app's own basePath is empty; the server mounts it at
    // the prefix so served paths are /support/... and /sales/... (no double prefix).
    const auth = `Basic ${Buffer.from('u:p').toString('base64')}`;
    const support = new AgentBase({ name: 'support', route: '/', basicAuth: ['u', 'p'] });
    const sales = new AgentBase({ name: 'sales', route: '/', basicAuth: ['u', 'p'] });
    support.setPromptText('support');
    sales.setPromptText('sales');
    server.register(support, '/support');
    server.register(sales, '/sales');

    server.setupSipRouting('/sip', false);
    server.registerSipUsername('sales', '/sales');

    const app = server.getApp();
    // POST a SIP-shaped body (call.to carries the sip: URI) to a served /sip path.
    const res = await app.request('/support/sip', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify({ call: { to: 'sip:sales@example.com' } }),
    });

    // The callback fired, extracted "sales" from the body, matched the mapping,
    // and issued a REAL 307 (a stored-but-unconsulted map would render 200 SWML).
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/sales');
  });

  it('an unregistered SIP username is served (200), not redirected', async () => {
    const server = new AgentServer();
    const auth = `Basic ${Buffer.from('u:p').toString('base64')}`;
    const agent = new AgentBase({ name: 'support', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('support');
    server.register(agent, '/support');
    server.setupSipRouting('/sip', false);

    const app = server.getApp();
    const res = await app.request('/support/sip', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify({ call: { to: 'sip:nobody@example.com' } }),
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(await res.text())).toHaveProperty('sections');
  });

  it('AgentBase.enableSipRouting registers a consulting callback (not stored-but-unconsulted)', async () => {
    // Directly assert the per-agent stub fix: enableSipRouting must register a
    // routing callback at /sip that extracts + consults the username. Reachable
    // via the served path — a matched own-username is handled (200 SWML).
    const agent = new AgentBase({ name: 'concierge', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hi');
    agent.enableSipRouting(false, '/sip');
    agent.registerSipUsername('concierge');

    const cred = Buffer.from('u:p').toString('base64');
    const [status] = await agent.handleRequest(
      'POST',
      'http://localhost/sip',
      { authorization: `Basic ${cred}` },
      { call: { to: 'sip:concierge@example.com' } },
    );
    // Own username matched → agent serves its own SWML (callback returned null).
    // Before the fix, no callback was registered at all, so the map was inert.
    expect(status).toBe(200);
  });
});
