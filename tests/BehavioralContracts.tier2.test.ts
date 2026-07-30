/**
 * Tier-2 behavioral-contract tests (porting-sdk/BEHAVIORAL_CONTRACTS.md, tests 2-8).
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
 *  7. Tool-token WIRE FORMAT + nonce parity + CONSTANT-TIME validate.
 *  8. AI/LLM structured add_pattern_hint / add_language (fillers/engine/model survive).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AddressInfo } from 'node:net';
import { AgentBase } from '../src/AgentBase.js';
import { AgentServer } from '../src/AgentServer.js';
import { ServerlessAdapter } from '../src/ServerlessAdapter.js';
import { NativeVectorSearchSkill } from '../src/skills/builtin/index.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { InfoGathererSkill } from '../src/skills/builtin/index.js';
import { SessionManager } from '../src/SessionManager.js';
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

// ── Contract 7: Tool-token WIRE FORMAT + nonce parity + CONSTANT-TIME ────────
//
// Python (core/security/session_manager.py): a minted tool token base64url-wraps
// `{call_id}.{function_name}.{expiry}.{nonce}.{signature}`; the HMAC-SHA256 signed
// message is `{call_id}:{function_name}:{expiry}:{nonce}`; nonce = token_hex(8)
// (16 hex chars); validation uses a CONSTANT-TIME compare. The contract asserts
// on the DECODED form. A 3-field / no-nonce / fn-first token FAILS (1)+(2)+(3);
// a plain `!==` signature compare (short-circuits on first mismatch) FAILS (5).
describe('Contract 7 — tool-token wire format, nonce parity, constant-time validate', () => {
  const SECRET = '0123456789abcdef0123456789abcdef';

  // Decode a base64url-wrapped token to its raw dot-joined form.
  function decode(token: string): string {
    return Buffer.from(token, 'base64url').toString();
  }

  it('(1) a freshly minted token, decoded, has exactly 5 dot-fields with a NON-EMPTY nonce', () => {
    const sm = new SessionManager(900, SECRET);
    const parts = decode(sm.generateToken('get_time', 'call-1')).split('.');
    expect(parts).toHaveLength(5);
    const [callId, fn, expiry, nonce, sig] = parts;
    expect(callId).toBe('call-1'); // call_id first (NOT fn-first)
    expect(fn).toBe('get_time');
    expect(Number.isNaN(parseInt(expiry!, 10))).toBe(false);
    expect(nonce).toBeTruthy(); // non-empty nonce (a 3-field/no-nonce token has none)
    expect(nonce!.length).toBeGreaterThan(0);
    expect(sig).toMatch(/^[0-9a-f]{64}$/); // full HMAC-SHA256 hex digest
  });

  it('(2) two mints for the SAME (function_name, call_id, expiry) produce DIFFERENT nonces', () => {
    const sm = new SessionManager(900, SECRET);
    const a = decode(sm.generateToken('get_time', 'call-1')).split('.');
    const b = decode(sm.generateToken('get_time', 'call-1')).split('.');
    // Same expiry window, same fn+call → the ONLY thing that must differ is the nonce.
    expect(a[3]).not.toBe(b[3]);
  });

  it('(3) a python-oracle-format token (16-hex-char nonce) validates in-port (interop)', () => {
    // Construct a token exactly as the Python reference would: 16-hex-char nonce
    // (token_hex(8)) — SHORTER than ts's own 32-char nonce — signed over the
    // `:`-joined message, then base64url-wrapped. It must validate, proving ts
    // reads the nonce field POSITIONALLY (parts[3]) rather than assuming a length.
    const callId = 'call-oracle';
    const fn = 'lookup';
    const expiry = Math.floor(Date.now() / 1000) + 900;
    const nonce = 'a1b2c3d4e5f60718'; // 16 hex chars, python token_hex(8) length
    const message = `${callId}:${fn}:${expiry}:${nonce}`;
    const sig = createHmac('sha256', SECRET).update(message).digest('hex');
    const raw = `${callId}.${fn}.${expiry}.${nonce}.${sig}`;
    const oracleToken = Buffer.from(raw, 'utf-8').toString('base64url');

    const sm = new SessionManager(900, SECRET);
    expect(sm.validateToken(callId, fn, oracleToken)).toBe(true);
    // A 3-field / no-nonce / fn-first token must FAIL validation.
    const badRaw = `${fn}.${callId}.${sig}`; // fn-first, no expiry, no nonce
    const badToken = Buffer.from(badRaw, 'utf-8').toString('base64url');
    expect(sm.validateToken(callId, fn, badToken)).toBe(false);
  });

  it('(4) flipping one byte of the signature → validation fails', () => {
    const sm = new SessionManager(900, SECRET);
    const parts = decode(sm.generateToken('get_time', 'call-1')).split('.');
    const sig = parts[4]!;
    // Flip the first hex char of the signature (any real change invalidates it).
    const flipped = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
    parts[4] = flipped;
    const tampered = Buffer.from(parts.join('.'), 'utf-8').toString('base64url');
    expect(sm.validateToken('call-1', 'get_time', tampered)).toBe(false);
  });

  it('(5) signature compare is CONSTANT-TIME (uses timingSafeEqual, no first-mismatch early return)', () => {
    // A wall-clock timing test over a 64-char digest is inherently flaky, so —
    // like the ruby lock-in — assert the constant-time PROPERTY behaviorally
    // rather than by measuring nanoseconds:
    //  - a wrong-in-the-FIRST-byte signature and a wrong-only-in-the-LAST-byte
    //    signature BOTH reject (a short-circuit `!==` also rejects both, but the
    //    contract's guarantee is that neither leaks WHERE the mismatch is), and
    //  - a wrong-LENGTH signature rejects without throwing (timingSafeEqual
    //    requires equal-length buffers; the impl must guard length first, not
    //    let it raise). A raw `!==` would "pass" length trivially but a naive
    //    timingSafeEqual without the guard would throw — this pins the guard.
    const sm = new SessionManager(900, SECRET);
    const parts = decode(sm.generateToken('probe', 'call-1')).split('.');
    const goodSig = parts[4]!;
    const wrongFirst = (goodSig[0] === 'f' ? 'e' : 'f') + goodSig.slice(1); // byte 0 differs
    const wrongLast = goodSig.slice(0, 63) + (goodSig[63] === 'a' ? 'b' : 'a'); // byte 63 differs
    const wrongLength = goodSig.slice(0, 63); // 63 chars — length mismatch

    const mk = (sig: string): string => {
      parts[4] = sig;
      return Buffer.from(parts.join('.'), 'utf-8').toString('base64url');
    };

    // Both a first-byte and a last-byte mismatch reject (no positional leak).
    expect(sm.validateToken('call-1', 'probe', mk(wrongFirst))).toBe(false);
    expect(sm.validateToken('call-1', 'probe', mk(wrongLast))).toBe(false);
    // A length-mismatched signature rejects WITHOUT throwing (the length guard
    // in front of timingSafeEqual). This fails if the impl calls timingSafeEqual
    // on unequal-length buffers (which throws) instead of guarding.
    expect(() => sm.validateToken('call-1', 'probe', mk(wrongLength))).not.toThrow();
    expect(sm.validateToken('call-1', 'probe', mk(wrongLength))).toBe(false);

    // Pin the constant-time PRIMITIVE at the source level: the manager must route
    // the signature compare through node's timingSafeEqual, not a raw `!==` on the
    // digest (which short-circuits at the first differing character). This is the
    // assertion that FAILS against the pre-fix body.
    const src = readFileSync(new URL('../src/SessionManager.ts', import.meta.url), 'utf-8');
    expect(src).toContain('timingSafeEqual');
    expect(src).not.toMatch(/tokenSignature\s*!==\s*expectedSig/);
  });
});

// ── Contract 8: AI/LLM structured add_pattern_hint / add_language ────────────
//
// Python (ai_config mixin): add_pattern_hint attaches a STRUCTURED hint
// ({pattern, replace/hints, ...}) not a bare string; add_language carries engine,
// model (speech_model), and fillers into the rendered SWML ai.languages entry.
// A degraded/bare-string impl drops the structure/engine/model/fillers.
describe('Contract 8 — structured pattern-hint + language (fillers/engine/model survive)', () => {
  // Pull the AI verb block out of the rendered SWML document.
  function aiBlock(agent: AgentBase): Record<string, unknown> {
    const doc = JSON.parse(agent.renderSwml()) as {
      sections: { main: Array<Record<string, unknown>> };
    };
    return doc.sections.main.find((v) => 'ai' in v)!['ai'] as Record<string, unknown>;
  }

  it('a pattern hint with replacements survives as a STRUCTURED object (not a bare string)', () => {
    const agent = new AgentBase({ name: 'ph', route: '/ph' });
    agent.setPromptText('hi');
    agent.addPatternHint({
      hint: 'SignalWire',
      pattern: 'signal\\s*wire',
      replace: 'SignalWire',
      ignoreCase: true,
    });

    const hints = aiBlock(agent)['hints'] as unknown[];
    const structured = hints.find(
      (h) => typeof h === 'object' && h !== null && 'pattern' in (h as object),
    ) as Record<string, unknown>;
    expect(structured).toBeTruthy(); // a bare-string impl would leave only strings
    expect(structured['pattern']).toBe('signal\\s*wire');
    expect(structured['replace']).toBe('SignalWire'); // the replacement survives
    expect(structured['hint']).toBe('SignalWire');
    expect(structured['ignore_case']).toBe(true); // wire key is snake_case
  });

  it('a language with engine + model + fillers renders all three into ai.languages', () => {
    const agent = new AgentBase({ name: 'lang', route: '/lang' });
    agent.setPromptText('hi');
    agent.addLanguage({
      name: 'English',
      code: 'en-US',
      voice: 'rime.spore',
      engine: 'rime',
      speechModel: 'arcana',
      fillers: { default: ['um', 'let me check'] },
    });

    const languages = aiBlock(agent)['languages'] as Array<Record<string, unknown>>;
    expect(languages).toHaveLength(1);
    const lang = languages[0]!;
    expect(lang['name']).toBe('English');
    expect(lang['code']).toBe('en-US');
    expect(lang['engine']).toBe('rime'); // dropped by a degraded impl
    expect(lang['speech_model']).toBe('arcana'); // model — dropped by a degraded impl
    expect(lang['fillers']).toEqual({ default: ['um', 'let me check'] }); // fillers survive
  });
});

// ── Contract 9: defineTool is SECURE BY DEFAULT (A1 / PSDK-4a) ───────────────
//
// The reference defaults `secure=True` on every user-facing define_tool entry
// point (tool_mixin.py:37, agent/tools/registry.py:42, agent/tools/decorator.py:95)
// — only the low-level SWAIGFunction constructor is False. TS collapses both
// layers into one SwaigFunction class, so the user-facing default lives there.
//
// The DEFECT this pins: `secure: opts.secure ?? false` shipped every tool
// registered without an explicit `secure` as INSECURE — its rendered webhook
// carried no `__token`, so the platform performed no token validation on the
// callback. Cross-port gate: SECURE-DEFAULT (diff_port_secure_default.py).
describe('Contract 9 — defineTool defaults to secure, and the wire reflects it', () => {
  const CALL_ID = 'call-secure-default-fixture';

  /** The rendered SWAIG function entries, keyed by function name. */
  function swaigFunctionsByName(agent: AgentBase): Record<string, Record<string, unknown>> {
    const doc = JSON.parse(agent.renderSwml(CALL_ID)) as Record<string, unknown>;
    const sections = doc['sections'] as Record<string, unknown>;
    const main = sections['main'] as Array<Record<string, unknown>>;
    const ai = main.find((v) => 'ai' in v)!['ai'] as Record<string, unknown>;
    const swaig = ai['SWAIG'] as Record<string, unknown>;
    const fns = swaig['functions'] as Array<Record<string, unknown>>;
    const byName: Record<string, Record<string, unknown>> = {};
    for (const fn of fns) byName[fn['function'] as string] = fn;
    return byName;
  }

  function fixtureAgent(): AgentBase {
    const agent = new AgentBase({ name: 'secure-default', route: '/sd', basicAuth: ['u', 'p'] });
    agent.setPromptText('secure default contract');
    agent.defineTool({
      name: 'sd_default_secure',
      description: 'no explicit secure',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });
    agent.defineTool({
      name: 'sd_explicit_insecure',
      description: 'explicit secure:false',
      parameters: {},
      secure: false,
      handler: () => new FunctionResult('ok'),
    });
    return agent;
  }

  it('records secure=true for a tool defined without an explicit secure', () => {
    const agent = fixtureAgent();
    // The recorded flag — false under the defect.
    expect(agent.getTool('sd_default_secure')!.secure).toBe(true);
    // The other direction: an explicit secure:false is still honored.
    expect(agent.getTool('sd_explicit_insecure')!.secure).toBe(false);
  });

  it('emits a per-tool __token on the default tool and none on the insecure tool', () => {
    const byName = swaigFunctionsByName(fixtureAgent());
    // The WIRE manifestation of `secure`: a token iff the tool is secure.
    expect(byName['sd_default_secure']!['web_hook_url']).toContain('__token=');
    const insecureUrl = (byName['sd_explicit_insecure']!['web_hook_url'] as string) ?? '';
    expect(insecureUrl).not.toContain('__token=');
  });

  // The token TOPOLOGY the SECURE-DEFAULT differ derives from the rendered keys
  // (diff_port_secure_default.token_carrier). Asserting only "the URL contains
  // __token=" / "it does not" is too weak in BOTH directions, and both weaknesses
  // are shipped defects elsewhere in the fleet:
  //   * java put its token in the `meta_data_token` FIELD — a SWML metadata
  //     SCOPING key the engine MD5-derives from public config and never validates
  //     — while leaving web_hook_url tokenless. A "contains __token=" assertion on
  //     the secure entry catches that, but nothing pinned that no OTHER key
  //     carries a credential.
  //   * an insecure tool must carry NO per-tool web_hook_url AT ALL (it falls back
  //     to the shared, unauthenticated SWAIG defaults.web_hook_url). A tokenless
  //     per-tool webhook still satisfies `not.toContain('__token=')` while
  //     publishing an unauthenticated function-specific callback.
  it('carries the token ONLY as a __token query param, and gives an insecure tool no webhook at all', () => {
    const byName = swaigFunctionsByName(fixtureAgent());

    const secure = byName['sd_default_secure']!;
    const secureUrl = secure['web_hook_url'] as string;
    // The carrier is the query param on the function's OWN webhook...
    expect([...new URL(secureUrl).searchParams.keys()]).toContain('__token');
    // ...and NO other key on the entry may carry a token (the meta_data_token misuse).
    const tokenishFields = Object.keys(secure).filter(
      (k) => k !== 'web_hook_url' && k.toLowerCase().endsWith('token'),
    );
    expect(tokenishFields).toEqual([]);

    // An insecure tool omits the key entirely — not "present but tokenless".
    expect(byName['sd_explicit_insecure']!).not.toHaveProperty('web_hook_url');
  });

  it('defineTypedTool is secure by default too (both registration paths)', () => {
    const agent = new AgentBase({ name: 'typed-sd', route: '/tsd', basicAuth: ['u', 'p'] });
    agent.setPromptText('typed secure default');
    agent.defineTypedTool({
      name: 'typed_default',
      description: 'typed, no explicit secure',
      handler: (city: string) => new FunctionResult(`ok ${city}`),
    });
    expect(agent.getTool('typed_default')!.secure).toBe(true);
  });

  it('refuses an INVALID token on a default-secure tool (valid one dispatches)', async () => {
    // route:'/' so the SWAIG endpoint is served at '/swaig' (the fixture agent
    // above is routed at '/sd', where it would be '/sd/swaig').
    //
    // Parity with the reference (`agent_base.py` `_swaig_pre_dispatch`): a
    // `secure` tool REQUIRES a valid token. A supplied-but-wrong one is
    // refused; so is an ABSENT one (pinned by the sibling test below).
    function agentFor(): AgentBase {
      const a = new AgentBase({ name: 'secure-dispatch', route: '/', basicAuth: ['u', 'p'] });
      a.setPromptText('secure default dispatch');
      a.defineTool({
        name: 'sd_default_secure',
        description: 'no explicit secure',
        parameters: {},
        handler: () => new FunctionResult('dispatched'),
      });
      return a;
    }
    const post = (a: AgentBase, qs: string) =>
      a.getApp().request(`/swaig${qs}`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: 'sd_default_secure',
          argument: { parsed: [{}] },
          call_id: 'c1',
        }),
      });

    // A forged token on a secure tool is refused before the handler runs.
    const bad = (await (await post(agentFor(), '?__token=forged')).json()) as Record<
      string,
      unknown
    >;
    expect(String(bad['response'])).toContain('security token');

    // The genuine per-tool token minted for this call dispatches. It must come
    // from the agent's OWN SessionManager — that is the keying the validator uses.
    const agent = agentFor();
    const real = (agent as unknown as { sessionManager: SessionManager }).sessionManager;
    const valid = real.createToolToken('sd_default_secure', 'c1');
    const ok = (await (
      await post(agent, `?__token=${encodeURIComponent(valid)}`)
    ).json()) as Record<string, unknown>;
    expect(String(ok['response'])).toBe('dispatched');
  });

  // The FAIL-CLOSED contract. A `secure` tool invoked with NO `__token` at all
  // must be refused exactly like one invoked with a forged token — omitting the
  // credential can never be weaker than presenting a wrong one, or `secure`
  // degrades into a flag that PERMITS anonymous calls.
  //
  // The reference (`agent_base.py` `_swaig_pre_dispatch`) computes validity
  // ONCE — `token && call_id !== null && validate(...)` — and refuses whenever
  // that is false AND the function is secure; an absent token is a way to FAIL
  // validation, never a way to SKIP it (signalwire-python 7c2f253, owner-ruled
  // 2026-07-29). Cross-port gate: SWAIG-HTTP-INVOKE fixture `token_absent`,
  // golden `{handler_invoked: false, refused: true}`.
  //
  // The DEFECT this pins: TS nested the whole check inside `if (token) { … }`,
  // so a tokenless POST fell straight through to `fn.execute` and the secure
  // handler RAN. `token_forged` was refused correctly, which is exactly why the
  // hole survived — the refusal path looked wired.
  //
  // Refusal shape is a 200 + FunctionResult body, never an HTTP error status:
  // the engine (mod_openai) has no handling for a SWAIG refusal status, so the
  // tool reports it cannot execute and the model relays that to the caller.
  it('refuses a secure tool invoked with NO token at all (fail-CLOSED, not fail-open)', async () => {
    function agentFor(): AgentBase {
      const a = new AgentBase({ name: 'secure-failclosed', route: '/', basicAuth: ['u', 'p'] });
      a.setPromptText('secure fail-closed');
      a.defineTool({
        name: 'fc_secure',
        description: 'secure by default',
        parameters: {},
        handler: () => new FunctionResult('HANDLER RAN'),
      });
      a.defineTool({
        name: 'fc_insecure',
        description: 'explicitly insecure',
        parameters: {},
        secure: false,
        handler: () => new FunctionResult('HANDLER RAN'),
      });
      return a;
    }
    const post = (a: AgentBase, fn: string, qs: string, callId: string | null) =>
      a.getApp().request(`/swaig${qs}`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: fn,
          argument: { parsed: [{}] },
          ...(callId === null ? {} : { call_id: callId }),
        }),
      });

    // (a) No `__token` query param at all, WITH a call_id — the corpus's
    //     `token_absent` shape. The handler must NOT run.
    const absent = (await (await post(agentFor(), 'fc_secure', '', 'c1')).json()) as Record<
      string,
      unknown
    >;
    expect(String(absent['response'])).not.toBe('HANDLER RAN');
    expect(String(absent['response'])).toContain('security token');

    // (b) A token can only be validated AGAINST a call_id; with no call_id in
    //     the body there is nothing to check it against, so even a
    //     well-formed-looking token leaves the call unvalidated and refused.
    const noCallId = (await (
      await post(agentFor(), 'fc_secure', '?__token=anything', null)
    ).json()) as Record<string, unknown>;
    expect(String(noCallId['response'])).not.toBe('HANDLER RAN');
    expect(String(noCallId['response'])).toContain('security token');

    // (c) The other direction — an INSECURE tool is not gated by any of this.
    //     A fix that refuses every tokenless call would break the unwrap
    //     fixtures (`platform_nested` / `flat_arguments`) which target a
    //     `secure: false` tool with no token; this keeps that honest.
    const insecure = (await (await post(agentFor(), 'fc_insecure', '', 'c1')).json()) as Record<
      string,
      unknown
    >;
    expect(String(insecure['response'])).toBe('HANDLER RAN');
  });
});
