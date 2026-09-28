/**
 * Per-request copy isolation: what a dynamic config callback changes on its
 * copy of the agent stays on that request.
 *
 * The copy used to share many fields with the agent by reference, so a
 * callback that added a query param, MCP server, function include, filler, LLM
 * param, SIP username or context edit wrote into the agent itself, and every
 * later call saw it. Mirrors signalwire-python's `_create_ephemeral_copy`
 * contract (61a57c2).
 */

import { AgentBase } from '../src/AgentBase.js';
import type { DynamicConfigCallback } from '../src/types.js';

const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');

type AnyAi = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function makeAgent(cb: DynamicConfigCallback): AgentBase {
  const agent = new AgentBase({ name: 'iso', route: '/', basicAuth: ['u', 'p'] });
  agent.setPromptText('isolation test');
  agent.defineTool({
    name: 'lookup',
    description: 'lookup',
    parameters: {},
    handler: () => undefined as never,
  });
  agent.setDynamicConfigCallback(cb);
  return agent;
}

/** Serve the SWML for one request and return its ai block. */
async function aiFor(agent: AgentBase, query = ''): Promise<AnyAi> {
  const res = await agent.getApp().request(`/${query}`, { headers: { Authorization: AUTH } });
  expect(res.status).toBe(200);
  const swml = await res.json();
  return swml.sections.main.find((v: AnyAi) => 'ai' in v).ai;
}

/** The agent's own SWML, with per-render tokens masked so two renders compare equal. */
function ownRender(agent: AgentBase): string {
  return agent.renderSwml('fixed-call').replace(/__token=[^&"]+/g, '__token=T');
}

describe('per-request copy isolation', () => {
  it("doesn't carry one request's SWAIG query params into the next", async () => {
    const agent = makeAgent((query, _body, _headers, copy) => {
      if (query['tenant']) copy.addSwaigQueryParams({ tenant: query['tenant'] });
    });
    const first = await aiFor(agent, '?tenant=acme');
    expect(first.SWAIG.defaults.web_hook_url).toContain('tenant=acme');

    const second = await aiFor(agent);
    expect(second.SWAIG.defaults.web_hook_url).not.toContain('tenant=acme');
    expect(ownRender(agent)).not.toContain('tenant=acme');
  });

  it("doesn't accumulate MCP servers on the agent", async () => {
    const agent = makeAgent((_q, _b, _h, copy) => {
      copy.addMcpServer('https://mcp.example.com/tools');
    });
    for (let i = 0; i < 3; i++) {
      const ai = await aiFor(agent);
      expect(ai.SWAIG.mcp_servers).toHaveLength(1);
    }
    expect(agent.getMcpServers()).toEqual([]);
  });

  it('keeps function includes, fillers, LLM params and SIP usernames off the agent', async () => {
    const agent = makeAgent((_q, _b, _h, copy) => {
      copy.addFunctionInclude('https://tools.example.com/swaig', ['remote_fn']);
      copy.addInternalFiller('lookup', 'en-US', ['One moment.']);
      copy.setPromptLlmParams({ temperature: 0.1 });
      copy.registerSipUsername('per-call-user');
    });
    const before = ownRender(agent);
    await aiFor(agent);
    await aiFor(agent);
    expect(ownRender(agent)).toBe(before);
    expect(before).not.toContain('remote_fn');
    expect(before).not.toContain('One moment.');
    expect(before).not.toContain('"temperature":0.1');
  });

  it('includes what the callback added in the request it configured', async () => {
    const agent = makeAgent((_q, _b, _h, copy) => {
      copy.addFunctionInclude('https://tools.example.com/swaig', ['remote_fn']);
    });
    const ai = await aiFor(agent);
    expect(JSON.stringify(ai.SWAIG)).toContain('remote_fn');
  });

  it("doesn't let resetContexts() in a callback clear the agent's contexts", async () => {
    // resetContexts() clears the builder in place; its docs suggest calling it
    // from a dynamic config callback to rebuild contexts for one request.
    const agent = makeAgent((_q, _b, _h, copy) => {
      copy.resetContexts();
      copy.defineContexts().addContext('default').addStep('greet').setText('per-call text');
    });
    agent.defineContexts().addContext('default').addStep('greet').setText('original text');

    const ai = await aiFor(agent);
    expect(JSON.stringify(ai.prompt.contexts)).toContain('per-call text');
    expect(ownRender(agent)).toContain('original text');

    const again = await aiFor(agent);
    expect(JSON.stringify(again.prompt.contexts)).toContain('per-call text');
    expect(ownRender(agent)).toContain('original text');
  });

  it('shares values it cannot copy (URL, RegExp, private fields) instead of breaking them', async () => {
    class Secretive {
      #token = 'kept';
      reveal(): string {
        return this.#token;
      }
    }
    const endpoint = new URL('https://example.com/resource');
    const secretive = new Secretive();
    const seen: unknown[] = [];
    const agent = makeAgent((_q, _b, _h, copy) => {
      const data = (copy as unknown as { globalData: Record<string, unknown> }).globalData;
      seen.push((data['endpoint'] as URL).href, (data['helper'] as Secretive).reveal());
      seen.push((data['pattern'] as RegExp).test('abc'));
    });
    agent.setGlobalData({ endpoint, helper: secretive, pattern: /b/, nested: { n: 1 } });
    const ai = await aiFor(agent);
    expect(ai.global_data.endpoint).toBe('https://example.com/resource');
    expect(seen).toEqual(['https://example.com/resource', 'kept', true]);
  });

  it('still copies plain nested data, so a callback edit stays on its request', async () => {
    const agent = makeAgent((_q, _b, _h, copy) => {
      const data = (copy as unknown as { globalData: Record<string, unknown> }).globalData;
      (data['profile'] as Record<string, unknown>)['tier'] = 'gold';
    });
    agent.setGlobalData({ profile: { tier: 'basic' } });
    const ai = await aiFor(agent);
    expect(ai.global_data.profile.tier).toBe('gold');
    expect(ownRender(agent)).toContain('"tier":"basic"');
  });
});
