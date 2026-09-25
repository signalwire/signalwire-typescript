/**
 * A SWAIG function call and a summary delivery run on the agent the call's
 * SWML came from: with a dynamic config callback, the request's configured
 * copy.
 *
 * Before, only SWML rendering applied the callback. A tool the callback made
 * secure still ran the agent's original, unsecured handler without a token; a
 * tool the callback registered rendered but returned 404; handlers and
 * onSummary saw the agent, not the configured copy. Mirrors signalwire-python
 * eba9ff4 and 61a57c2 (per-call configuration before tool lookup and token
 * validation, and `self` as the configured copy) and fa45c56
 * (fetch_conversation returns on_summary's result).
 */

import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');

/** An agent whose callback records the tenant from the query on its copy. */
class TenantAgent extends AgentBase {
  tenant = 'base';
  summaries: string[] = [];
  conversation: Record<string, unknown> | null = null;

  override onSummary(): Record<string, unknown> | void {
    this.summaries.push(this.tenant);
    return this.conversation ?? undefined;
  }
}

function makeAgent(configure?: (copy: TenantAgent, tenant: string) => void): TenantAgent {
  const agent = new TenantAgent({ name: 'tenants', route: '/', basicAuth: ['u', 'p'] });
  agent.setPromptText('tenant test');
  agent.setPostPrompt('Summarize.');
  agent.setDynamicConfigCallback((query, _body, _headers, copy) => {
    const tenantCopy = copy as TenantAgent;
    tenantCopy.tenant = query['tenant'] ?? 'none';
    // Carry the tenant into the rendered webhook URLs, as a real app would.
    if (query['tenant']) tenantCopy.addSwaigQueryParams({ tenant: query['tenant'] });
    configure?.(tenantCopy, tenantCopy.tenant);
  });
  return agent;
}

async function aiFor(agent: AgentBase, query: string) {
  const res = await agent.getApp().request(`/${query}`, { headers: { Authorization: AUTH } });
  expect(res.status).toBe(200);
  const swml = await res.json();
  return swml.sections.main.find((v: Record<string, unknown>) => 'ai' in v).ai;
}

/** POST a SWAIG call to the query string the SWML gave the function. */
async function callFunction(agent: AgentBase, fnQuery: string, fn: string) {
  const res = await agent.getApp().request(`/swaig${fnQuery}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: fn, call_id: 'c1', argument: { parsed: [{}] } }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

function webhookQuery(
  ai: { SWAIG: { functions: { function: string; web_hook_url: string }[] } },
  fn: string,
): string {
  const entry = ai.SWAIG.functions.find((f) => f.function === fn)!;
  return new URL(entry.web_hook_url).search;
}

describe('SWAIG calls run on the configured copy', () => {
  it('checks the token of a tool the callback made secure, and runs its handler', async () => {
    const agent = makeAgent((copy, tenant) => {
      copy.defineTool({
        name: 'lookup',
        description: 'tenant lookup',
        parameters: {},
        secure: true,
        handler: () => new FunctionResult(`tenant handler for ${tenant}`),
      });
    });
    agent.defineTool({
      name: 'lookup',
      description: 'open lookup',
      parameters: {},
      secure: false,
      handler: () => new FunctionResult('original open handler'),
    });

    const noToken = await callFunction(agent, '?tenant=acme', 'lookup');
    expect(noToken.body['response']).toContain('security token');

    const ai = await aiFor(agent, '?tenant=acme&call_id=c1');
    const withToken = await callFunction(agent, webhookQuery(ai, 'lookup'), 'lookup');
    expect(withToken.body['response']).toBe('tenant handler for acme');
  });

  it('runs a tool the callback registered, with its rendered token', async () => {
    const agent = makeAgent((copy) => {
      copy.defineTool({
        name: 'per_call_tool',
        description: 'only on the copy',
        parameters: {},
        handler: () => new FunctionResult('per-call ok'),
      });
    });
    const ai = await aiFor(agent, '?tenant=acme&call_id=c1');
    const res = await callFunction(agent, webhookQuery(ai, 'per_call_tool'), 'per_call_tool');
    expect(res.status).toBe(200);
    expect(res.body['response']).toBe('per-call ok');
  });

  it('passes the configured copy to the handler as its third argument', async () => {
    const agent = makeAgent();
    agent.defineTool({
      name: 'whoami',
      description: 'which tenant',
      parameters: {},
      secure: false,
      handler: (_args, _raw, running) =>
        new FunctionResult(`tenant=${(running as TenantAgent).tenant}`),
    });
    const res = await callFunction(agent, '?tenant=acme', 'whoami');
    expect(res.body['response']).toBe('tenant=acme');
    expect(agent.tenant).toBe('base');
  });

  it('passes the agent itself when there is no dynamic config callback', async () => {
    const agent = new TenantAgent({ name: 'plain', route: '/', basicAuth: ['u', 'p'] });
    let seen: AgentBase | undefined;
    agent.defineTool({
      name: 'whoami',
      description: 'which agent',
      parameters: {},
      secure: false,
      handler: (_args, _raw, running) => {
        seen = running;
        return new FunctionResult('ok');
      },
    });
    await callFunction(agent, '', 'whoami');
    expect(seen).toBe(agent);
  });

  it('GET /swaig renders the SWML for the call, like the root', async () => {
    const agent = makeAgent();
    const res = await agent.getApp().request('/swaig?call_id=c1', {
      headers: { Authorization: AUTH },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).sections).toBeDefined();
  });
});

describe('summaries run on the configured copy', () => {
  async function deliver(agent: TenantAgent, body: Record<string, unknown>) {
    const ai = await aiFor(agent, '?tenant=acme&call_id=c1');
    const query = new URL(ai.post_prompt_url).search;
    return agent.getApp().request(`/post_prompt${query}`, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: 'c1', ...body }),
    });
  }

  it('calls onSummary on the copy the callback configured', async () => {
    const agent = makeAgent();
    const res = await deliver(agent, { post_prompt_data: { raw: 'done' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    // onSummary ran on the copy, which pushed into the shared array.
    expect(agent.summaries).toEqual(['acme']);
  });

  it("returns onSummary's result for a fetch_conversation request", async () => {
    const agent = makeAgent();
    agent.conversation = { conversation_summary: 'restored conversation' };
    const res = await deliver(agent, { action: 'fetch_conversation' });
    expect(await res.json()).toEqual({ conversation_summary: 'restored conversation' });
  });
});
