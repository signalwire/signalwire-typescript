/**
 * The PGI reference implementation (examples/pgi/), driven through the agent's
 * own HTTP app as SignalWire would drive it: SWML fetched with basic auth,
 * tools called on /swaig with a signature and the per-call token from that
 * SWML. Each test checks a claim docs/pgi_agent_guide.md makes about it.
 */

import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { ContextBuilder, FunctionResult, Step } from '../../src/index.js';
import { CaseRuleError, MemoryCaseStore } from '../../examples/pgi/case-domain.js';
import {
  STEP_TOOLS,
  configureWorkflow,
  createSupportAgent,
  supportConfigFromEnv,
} from '../../examples/pgi/support-agent.js';

// The examples import '@signalwire/sdk', which vitest resolves to the built
// package in dist/. Point it at the source, so these tests check the code in src/.
vi.mock('@signalwire/sdk', async () => await import('../../src/index.js'));

type Json = Record<string, unknown>;
type Agent = ReturnType<typeof createSupportAgent>;

const USER = 'pgi-user';
const PASS = 'pgi-pass';
const SIGNING_KEY = 'pgi-test-signing-key';
const AUTH = { Authorization: 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64') };

function makeAgent(store = new MemoryCaseStore(), tenant = 'tenant-a'): Agent {
  return createSupportAgent({
    tenant,
    store,
    basicAuth: [USER, PASS],
    signingKey: SIGNING_KEY,
    swaigSecret: 'pgi-test-swaig-secret',
  });
}

/** The ai verb of a SWML document. */
function aiVerb(swml: Json): Json {
  const main = (swml['sections'] as { main: Json[] }).main;
  const verb = main.find((v) => 'ai' in v);
  if (!verb) throw new Error('no ai verb in the SWML');
  return verb['ai'] as Json;
}

interface StepJson {
  name: string;
  functions?: unknown;
  valid_steps?: unknown;
  valid_contexts?: unknown;
  end?: unknown;
}

/** The contexts the SWML carries, in the ai verb's prompt object. */
function contextsOf(swml: Json): Record<string, { steps: StepJson[]; initial_step?: string }> {
  const prompt = aiVerb(swml)['prompt'] as Json;
  const contexts = prompt['contexts'] as
    Record<string, { steps: StepJson[]; initial_step?: string }> | undefined;
  if (!contexts) throw new Error('no contexts in the SWML');
  return contexts;
}

/**
 * The workflow contract in docs/pgi_agent_guide.md 9.3, checked on rendered
 * SWML: every step lists exactly its tools, each of them registered, and
 * offers the model no navigation. Throws on the first violation.
 */
function checkStepScoping(swml: Json, expected: Record<string, readonly string[]>): void {
  const registered = new Set(
    ((aiVerb(swml)['SWAIG'] as Json)['functions'] as Json[]).map((f) => f['function']),
  );
  const ctx = contextsOf(swml)['default'];
  if (!ctx) throw new Error("no 'default' context");
  if (ctx.initial_step !== 'intake') throw new Error('initial step is not intake');
  const names = ctx.steps.map((s) => s.name);
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(expected))) {
    throw new Error(`steps are ${names.join(', ')}`);
  }
  for (const step of ctx.steps) {
    if (!Array.isArray(step.functions)) {
      throw new Error(`step '${step.name}' has no explicit functions list`);
    }
    const want = expected[step.name] ?? [];
    if (JSON.stringify([...step.functions].sort()) !== JSON.stringify([...want].sort())) {
      throw new Error(`step '${step.name}' offers ${step.functions.join(', ')}`);
    }
    for (const fn of step.functions) {
      if (!registered.has(fn)) throw new Error(`step '${step.name}' lists unregistered ${fn}`);
    }
    if (JSON.stringify(step.valid_steps) !== '[]' || JSON.stringify(step.valid_contexts) !== '[]') {
      throw new Error(`step '${step.name}' lets the model navigate`);
    }
    if (step.end !== undefined) throw new Error(`step '${step.name}' ends step mode`);
  }
}

/** One simulated call against an agent's HTTP app. */
class Call {
  constructor(
    readonly agent: Agent,
    readonly callId: string,
  ) {}

  /** The SWML for this call: its functions' tokens are minted for this call id. */
  async swml(): Promise<Json> {
    const res = await this.agent.getApp().request(`/agent?call_id=${this.callId}`, {
      headers: AUTH,
    });
    expect(res.status).toBe(200);
    return (await res.json()) as Json;
  }

  async token(fn: string): Promise<string> {
    const functions = (aiVerb(await this.swml())['SWAIG'] as Json)['functions'] as Json[];
    const entry = functions.find((f) => f['function'] === fn);
    const url = new URL(String(entry?.['web_hook_url']));
    return url.searchParams.get('__token') ?? '';
  }

  /** POST /agent/swaig, signed as SignalWire signs it, with this call's token by default. */
  async invoke(
    fn: string,
    args: Json = {},
    opts: { token?: string | null; sign?: boolean; auth?: boolean } = {},
  ): Promise<{ status: number; body: Json }> {
    const token = opts.token === undefined ? await this.token(fn) : opts.token;
    const path = token === null ? '/agent/swaig' : `/agent/swaig?__token=${token}`;
    const body = JSON.stringify({
      function: fn,
      call_id: this.callId,
      argument: { parsed: [args], raw: JSON.stringify(args) },
    });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (opts.auth !== false) Object.assign(headers, AUTH);
    if (opts.sign !== false) {
      headers['X-SignalWire-Sha256-Signature'] = createHmac('sha256', SIGNING_KEY)
        .update(`http://localhost${path}${body}`)
        .digest('hex');
    }
    const res = await this.agent.getApp().request(path, { method: 'POST', headers, body });
    const text = await res.text();
    const json = res.headers.get('content-type')?.includes('application/json');
    return { status: res.status, body: json ? (JSON.parse(text) as Json) : { text } };
  }
}

const toolResult = (body: Json): Json =>
  JSON.parse((body['response'] as { tool_result: string }).tool_result) as Json;
const actions = (body: Json): Json[] => (body['action'] as Json[] | undefined) ?? [];
const stepChange = (body: Json): unknown => actions(body).find((a) => 'change_step' in a);

const PRINTER = { category: 'repair', summary: 'The printer will not power on' };

beforeEach(() => {
  process.env['SIGNALWIRE_LOG_MODE'] = 'off';
});

describe('PGI reference: per-step tool scoping in the SWML', () => {
  it('every step lists exactly its tools and offers no model navigation', async () => {
    const swml = await new Call(makeAgent(), 'call-1').swml();
    expect(() => checkStepScoping(swml, STEP_TOOLS)).not.toThrow();
    const steps = contextsOf(swml)['default']!.steps;
    expect(steps[0]!.functions).not.toContain('submit_request');
    expect(steps[2]!.functions).not.toContain('prepare_request');
  });

  it('deliberate break: a step with an extra tool fails the check', async () => {
    const agent = makeAgent();
    const builder = configureWorkflow(new ContextBuilder());
    builder
      .getContext('default')!
      .getStep('intake')!
      .setFunctions([...STEP_TOOLS['intake']!, 'submit_request']);
    agent.defineContexts(builder);
    const swml = await new Call(agent, 'call-1').swml();
    expect(() => checkStepScoping(swml, STEP_TOOLS)).toThrow(/step 'intake' offers/);
  });

  it('deliberate break: a step that omits its list or allows navigation fails the check', async () => {
    // The same workflow, except that 'review' never calls setFunctions().
    const omitted = makeAgent();
    const ctx = omitted
      .defineContexts(new ContextBuilder())
      .addContext('default')
      .setInitialStep('intake');
    for (const [name, tools] of Object.entries(STEP_TOOLS)) {
      const step = ctx.addStep(name).setText(name).setValidSteps([]).setValidContexts([]);
      if (name !== 'review') step.setFunctions([...tools]);
    }
    expect(() => checkStepScoping(JSON.parse(omitted.renderSwml('c1')), STEP_TOOLS)).toThrow(
      /no explicit functions list/,
    );

    const navigable = makeAgent();
    const builder = configureWorkflow(new ContextBuilder());
    builder.getContext('default')!.getStep('intake')!.setValidSteps(['review']);
    navigable.defineContexts(builder);
    expect(() => checkStepScoping(JSON.parse(navigable.renderSwml('c1')), STEP_TOOLS)).toThrow(
      /lets the model navigate/,
    );
  });

  it('emits the contexts inside the prompt object, as ai.prompt.contexts (guide 6.6)', async () => {
    const ai = aiVerb(await new Call(makeAgent(), 'call-1').swml());
    expect((ai['prompt'] as Json)['contexts']).toBeDefined();
    expect(ai['contexts']).toBeUndefined();
  });

  it('validate() with the agent attached rejects a tool name nobody registered', () => {
    const agent = makeAgent();
    const builder = agent.defineContexts(new ContextBuilder());
    const ctx = builder.addContext('default');
    ctx.addStep('intake').setText('a').setFunctions(['prepare_requests']);
    expect(() => builder.validate()).toThrow(/unknown SWAIG function/);
    // A standalone builder has no registry to check against.
    const alone = new ContextBuilder();
    alone.addContext('default').addStep('intake').setText('a').setFunctions(['prepare_requests']);
    expect(() => alone.validate()).not.toThrow();
  });
});

describe('PGI reference: transitions come from tool actions', () => {
  it('prepare moves to review, submit moves to done, status with nothing moves to intake', async () => {
    const call = new Call(makeAgent(), 'call-1');

    const status = await call.invoke('request_status');
    expect(stepChange(status.body)).toEqual({ change_step: 'intake' });

    const draft = await call.invoke('prepare_request', PRINTER);
    expect(draft.status).toBe(200);
    expect(stepChange(draft.body)).toEqual({ change_step: 'review' });
    expect(actions(draft.body)[0]).toEqual({
      set_global_data: {
        case_state: {
          reference: toolResult(draft.body)['reference'],
          status: 'draft',
          revision: 1,
        },
      },
    });
    expect(actions(draft.body).at(-1)).toHaveProperty('SWML');

    const done = await call.invoke('submit_request', { revision: 1 });
    expect(stepChange(done.body)).toEqual({ change_step: 'done' });
    expect(toolResult(done.body)['status']).toBe('submitted');
  });

  it('a refusal carries no actions', async () => {
    const call = new Call(makeAgent(), 'call-1');
    const bad = await call.invoke('prepare_request', {
      category: 'admin',
      summary: 'Change roles',
    });
    expect(bad.body['action']).toBeUndefined();
    expect(bad.body['response']).toEqual({
      tool_result: 'Choose repair, setup, or question.',
      tool_prompt: 'Explain the validation issue and ask for the missing or corrected information.',
    });
  });

  it('the tool result holds the projection only, not the tenant or call id', async () => {
    const draft = await new Call(makeAgent(), 'call-1').invoke('prepare_request', PRINTER);
    const view = toolResult(draft.body);
    expect(Object.keys(view).sort()).toEqual([
      'category',
      'reference',
      'revision',
      'status',
      'summary',
    ]);
    expect(JSON.stringify(draft.body)).not.toContain('tenant-a');
    expect(JSON.stringify(draft.body)).not.toContain('call-1');
  });

  it('finish hangs up explicitly, after one more model turn', async () => {
    const bye = await new Call(makeAgent(), 'call-1').invoke('finish');
    expect(bye.body).toEqual({
      response: 'Tell the caller goodbye.',
      action: [{ hangup: true }],
      post_process: true,
    });
  });
});

describe('PGI reference: the tools refuse out-of-order requests', () => {
  it('refuses to submit before a draft exists', async () => {
    const res = await new Call(makeAgent(), 'call-1').invoke('submit_request', { revision: 1 });
    expect((res.body['response'] as Json)['tool_result']).toBe(
      'Prepare a request before submitting it.',
    );
    expect(res.body['action']).toBeUndefined();
  });

  it('refuses a stale revision, then accepts the current one', async () => {
    const call = new Call(makeAgent(), 'call-1');
    await call.invoke('prepare_request', PRINTER);
    await call.invoke('prepare_request', {
      category: 'repair',
      summary: 'The replacement printer will not power on',
    });
    const stale = await call.invoke('submit_request', { revision: 1 });
    expect((stale.body['response'] as Json)['tool_result']).toBe(
      'The proposal changed. Review the current version first.',
    );
    const current = await call.invoke('submit_request', { revision: 2 });
    expect(toolResult(current.body)['status']).toBe('submitted');
  });

  it('a repeated submit returns the same case, and a submitted case cannot be rewritten', async () => {
    const call = new Call(makeAgent(), 'call-1');
    await call.invoke('prepare_request', PRINTER);
    const one = toolResult((await call.invoke('submit_request', { revision: 1 })).body);
    const two = toolResult((await call.invoke('submit_request', { revision: 1 })).body);
    expect(two).toEqual(one);
    const rewrite = await call.invoke('prepare_request', PRINTER);
    expect((rewrite.body['response'] as Json)['tool_result']).toBe(
      'This request is already submitted; check its status.',
    );
  });

  it('concurrent submits return one case', async () => {
    const call = new Call(makeAgent(), 'call-1');
    await call.invoke('prepare_request', PRINTER);
    const token = await call.token('submit_request');
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => call.invoke('submit_request', { revision: 1 }, { token })),
    );
    const refs = new Set(results.map((r) => toolResult(r.body)['reference']));
    expect(refs.size).toBe(1);
    expect(results.every((r) => toolResult(r.body)['status'] === 'submitted')).toBe(true);
  });
});

describe('PGI reference: the agent refuses requests it cannot attribute', () => {
  it('refuses a request without basic auth (401) or without a signature (403)', async () => {
    const call = new Call(makeAgent(), 'call-1');
    expect((await call.invoke('prepare_request', PRINTER, { auth: false })).status).toBe(401);
    expect((await call.invoke('prepare_request', PRINTER, { sign: false })).status).toBe(403);
  });

  it("refuses a call with no token, another call's token, or another tool's token", async () => {
    const store = new MemoryCaseStore();
    const agent = makeAgent(store);
    const call = new Call(agent, 'call-1');
    const other = new Call(agent, 'call-2');
    const refusals = [
      await call.invoke('prepare_request', PRINTER, { token: null }),
      await call.invoke('prepare_request', PRINTER, {
        token: await other.token('prepare_request'),
      }),
      await call.invoke('prepare_request', PRINTER, { token: await call.token('request_status') }),
    ];
    for (const res of refusals) {
      expect(res.body['action']).toBeUndefined();
      expect(String(res.body['response'])).toContain('security token');
    }
    expect(await store.get('tenant-a', 'call-1')).toBeNull();
  });

  it('keeps tenants apart even when the call id matches', async () => {
    const store = new MemoryCaseStore();
    await new Call(makeAgent(store, 'tenant-a'), 'call-1').invoke('prepare_request', PRINTER);
    const b = await new Call(makeAgent(store, 'tenant-b'), 'call-1').invoke('request_status');
    expect((b.body['response'] as Json)['tool_result']).toBe('No request exists for this session.');
  });
});

describe('PGI reference: the domain rules, without the SDK', () => {
  const store = () => new MemoryCaseStore();

  it('validates the category, the summary and the revision', async () => {
    const s = store();
    await expect(s.prepare('t', 'c', 'admin', 'Change account permissions')).rejects.toThrow(
      CaseRuleError,
    );
    await expect(s.prepare('t', 'c', 'repair', 'x')).rejects.toThrow(/between 10 and 300/);
    await s.prepare('t', 'c', 'repair', 'The printer will not power on');
    await expect(s.submit('t', 'c', '1')).rejects.toThrow(/revision is required/);
    await expect(s.submit('t', 'c', 1.5)).rejects.toThrow(/revision is required/);
  });

  it('requires a tenant and a call id', async () => {
    await expect(store().get('', 'c')).rejects.toThrow(/tenant/);
    await expect(store().get('t', '')).rejects.toThrow(/call context/);
  });

  it('refuses to start without its security settings', () => {
    expect(() => supportConfigFromEnv({ CASE_TENANT_ID: 'demo' })).toThrow(
      'Missing server configuration: SWML_BASIC_AUTH_USER, SWML_BASIC_AUTH_PASSWORD, ' +
        'SIGNALWIRE_SIGNING_KEY, SIGNALWIRE_SWAIG_SECRET',
    );
  });
});

describe('PGI reference: SDK contracts the guide relies on', () => {
  it('an omitted functions list differs from an empty one', () => {
    expect(new Step('omitted').setText('Ask a question.').toDict()).not.toHaveProperty('functions');
    expect(
      new Step('explicit').setText('Ask a question.').setFunctions([]).toDict().functions,
    ).toEqual([]);
  });

  it('a locked terminal step does not use end, and history rejects unknown modes', () => {
    const step = new Step('locked')
      .setText('This workflow is complete.')
      .setFunctions([])
      .setValidSteps([])
      .setValidContexts([])
      .setHistory('hide');
    expect(step.toDict()).not.toHaveProperty('end');
    expect(step.toDict().history).toBe('hide');
    expect(() => new Step('bad').setHistory('erase_everything')).toThrow();
  });

  it('validate() rejects a navigation target that does not exist', () => {
    const builder = new ContextBuilder();
    builder.addContext('default').addStep('start').setText('Ask.').setValidSteps(['missing']);
    expect(() => builder.validate()).toThrow(/unknown step 'missing'/);
  });

  it('hold routes when the hold ends and turns on post-processing', () => {
    const result = new FunctionResult()
      .hold('Tell the caller you are checking.', 30, 'review', 'intake')
      .toDict();
    expect(result.post_process).toBe(true);
    expect(result.action).toEqual([
      { hold: { timeout: 30, step: 'review', timeout_step: 'intake' } },
    ]);
  });
});

describe('PGI reference: the guide quotes the example files byte for byte', () => {
  it('every include region in docs/pgi_agent_guide.md matches its source', () => {
    const doc = readFileSync(new URL('../../docs/pgi_agent_guide.md', import.meta.url), 'utf8');
    const include = /<!--\s*include:\s*(\S+?)#([\w.-]+)\s*-->\s*\n```[a-z]*\n([\s\S]*?)\n```/g;
    let count = 0;
    for (const [, file, region, block] of doc.matchAll(include)) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
      const start = source.indexOf(`// region: ${region}\n`);
      const end = source.indexOf(`// endregion: ${region}`);
      expect(start, `${file}#${region}`).toBeGreaterThanOrEqual(0);
      const body = source.slice(start + `// region: ${region}\n`.length, end).replace(/\n+$/, '');
      expect(block, `${file}#${region}`).toBe(body);
      count++;
    }
    // Every include marker was followed by a fence and checked.
    expect(count).toBeGreaterThan(0);
    expect(count).toBe(doc.match(/<!--\s*include:/g)?.length);
  });
});
