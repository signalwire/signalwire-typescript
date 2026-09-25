/**
 * AgentBase additions from signalwire-python 8253718: swaigSecret,
 * addPerCallConfig, onCallEnd (the reserved hangup_hook) and mount().
 */

import { Hono } from 'hono';
import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { AgentServer } from '../src/AgentServer.js';

const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');

function agentWith(opts: Partial<ConstructorParameters<typeof AgentBase>[0]> = {}): AgentBase {
  const agent = new AgentBase({ name: 'adds', route: '/', basicAuth: ['u', 'p'], ...opts });
  agent.setPromptText('additions');
  return agent;
}

async function swml(agent: AgentBase, query = '') {
  const res = await agent.getApp().request(`/${query}`, { headers: { Authorization: AUTH } });
  expect(res.status).toBe(200);
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test reads loose SWML JSON
type Ai = Record<string, any>;

const aiOf = (doc: { sections: { main: Record<string, unknown>[] } }) =>
  doc.sections.main.find((v) => 'ai' in v)!['ai'] as Ai;

function tokenQuery(ai: Ai, fn: string): string {
  const entry = ai['SWAIG'].functions.find((f: { function: string }) => f.function === fn);
  return new URL(entry.web_hook_url).search;
}

function callSwaig(agent: AgentBase, query: string, body: Record<string, unknown>) {
  return agent.getApp().request(`/swaig${query}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('swaigSecret', () => {
  const secureTool = (agent: AgentBase) =>
    agent.defineTool({
      name: 'secret_op',
      description: 'secure',
      parameters: {},
      handler: () => new FunctionResult('ran'),
    });

  it('lets a token minted by one agent validate on another with the same secret', async () => {
    const a = agentWith({ swaigSecret: 'shared-secret' });
    const b = agentWith({ swaigSecret: 'shared-secret' });
    secureTool(a);
    secureTool(b);
    const q = tokenQuery(aiOf(await swml(a, '?call_id=c1')), 'secret_op');
    const res = await callSwaig(b, q, {
      function: 'secret_op',
      call_id: 'c1',
      argument: { parsed: [{}] },
    });
    expect((await res.json()).response).toBe('ran');
  });

  it('reads SIGNALWIRE_SWAIG_SECRET, and refuses a token from an agent with another secret', async () => {
    process.env['SIGNALWIRE_SWAIG_SECRET'] = 'env-secret';
    try {
      const a = agentWith();
      const b = agentWith();
      const other = agentWith({ swaigSecret: 'different' });
      [a, b, other].forEach(secureTool);
      const q = tokenQuery(aiOf(await swml(a, '?call_id=c1')), 'secret_op');
      const body = { function: 'secret_op', call_id: 'c1', argument: { parsed: [{}] } };
      expect((await (await callSwaig(b, q, body)).json()).response).toBe('ran');
      expect((await (await callSwaig(other, q, body)).json()).response).toContain('security token');
    } finally {
      delete process.env['SIGNALWIRE_SWAIG_SECRET'];
    }
  });
});

describe('addPerCallConfig', () => {
  it('runs every registered callback, in order, on the same copy', async () => {
    const agent = agentWith();
    const order: string[] = [];
    agent.addPerCallConfig((_q, _b, _h, copy) => {
      order.push('first');
      copy.setPromptText('from the first');
    });
    agent.addPerCallConfig((_q, _b, _h, copy) => {
      order.push(`second saw: ${copy.getPrompt()}`);
      copy.addHint('from-second');
    });
    const ai = aiOf(await swml(agent));
    expect(order).toEqual(['first', 'second saw: from the first']);
    expect(ai['prompt'].text).toBe('from the first');
    expect(ai['hints']).toContain('from-second');
  });

  it('setDynamicConfigCallback replaces every callback registered so far', async () => {
    const agent = agentWith();
    const ran: string[] = [];
    agent.addPerCallConfig(() => void ran.push('a'));
    agent.addPerCallConfig(() => void ran.push('b'));
    agent.setDynamicConfigCallback(() => void ran.push('replacement'));
    await swml(agent);
    expect(ran).toEqual(['replacement']);
  });
});

describe('onCallEnd', () => {
  it('registers the reserved hangup_hook and turns on swaig_post_conversation', async () => {
    const agent = agentWith();
    const handler = () => undefined;
    expect(agent.onCallEnd(handler)).toBe(handler);
    const ai = aiOf(await swml(agent, '?call_id=c1'));
    const hook = ai['SWAIG'].functions.find(
      (f: { function: string }) => f.function === 'hangup_hook',
    );
    expect(hook.description).toBe('Internal: fires when the call ends.');
    expect(ai['params'].swaig_post_conversation).toBe(true);
  });

  it('runs every handler in order with the call log, isolating a failing one', async () => {
    const agent = agentWith();
    const seen: string[] = [];
    agent.onCallEnd((log) => void seen.push(`first:${log.length}`));
    agent.onCallEnd(() => {
      throw new Error('broken handler');
    });
    agent.onCallEnd(async (log, raw) => void seen.push(`third:${log.length}:${raw.call_id}`));
    const q = tokenQuery(aiOf(await swml(agent, '?call_id=c1')), 'hangup_hook');
    const res = await callSwaig(agent, q, {
      function: 'hangup_hook',
      call_id: 'c1',
      argument: { parsed: [{}] },
      call_log: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
    });
    expect(res.status).toBe(200);
    expect(seen).toEqual(['first:2', 'third:2:c1']);
  });

  it('reads raw_call_log too, and leaves an explicit swaig_post_conversation: false alone', async () => {
    const agent = agentWith();
    agent.setParam('swaig_post_conversation', false);
    let got: unknown[] = [];
    agent.onCallEnd((log) => void (got = log));
    const ai = aiOf(await swml(agent, '?call_id=c1'));
    expect(ai['params'].swaig_post_conversation).toBe(false);
    await callSwaig(agent, tokenQuery(ai, 'hangup_hook'), {
      function: 'hangup_hook',
      call_id: 'c1',
      argument: { parsed: [{}] },
      raw_call_log: [{ role: 'user', content: 'x' }],
    });
    expect(got).toHaveLength(1);
  });
});

describe('mount', () => {
  function chatApp(): Hono {
    const chat = new Hono();
    chat.get('/ping', (c) => c.json({ pong: true }));
    chat.options('/', (c) =>
      c.body(null, 204, { 'Access-Control-Allow-Origin': 'https://site.example' }),
    );
    return chat;
  }

  it("serves a mounted Hono app's routes under the prefix, without the agent's auth or headers", async () => {
    const agent = agentWith().mount(chatApp(), { prefix: '/chat/' });
    const res = await agent.getApp().request('/chat/ping');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pong: true });
    expect(res.headers.get('content-security-policy')).toBeNull();
    // The agent's own routes keep their auth and headers.
    const root = await agent.getApp().request('/');
    expect(root.status).toBe(401);
    expect(root.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('lets the mounted app answer its own CORS preflight', async () => {
    const agent = agentWith().mount(chatApp(), { prefix: '/chat' });
    const res = await agent.getApp().request('/chat', {
      method: 'OPTIONS',
      headers: { Origin: 'https://site.example', 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://site.example');
  });

  it('mounts a fetch handler, and keeps mounts across an app rebuild', async () => {
    const agent = agentWith();
    agent.getApp();
    agent.mount((req) => new Response(`handled ${new URL(req.url).pathname}`), {
      prefix: '/static',
    });
    // A routing callback rebuilds the app; the mount survives.
    agent.registerRoutingCallback(() => null, '/sip');
    const res = await agent.getApp().request('/static/page.html');
    expect(await res.text()).toBe('handled /page.html');
  });

  describe('the exemption follows which routes serve the request', () => {
    const saved = { ...process.env };
    beforeEach(() => {
      process.env['SWML_CSRF_PROTECTION'] = 'true';
      process.env['SWML_CORS_ORIGINS'] = 'https://ok.example';
    });
    afterEach(() => {
      for (const k of ['SWML_CSRF_PROTECTION', 'SWML_CORS_ORIGINS']) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    });

    it("keeps the agent's CSRF check and headers on its own route under a mount prefix", async () => {
      const agent = agentWith({ route: '/agent' }).mount(chatApp(), { prefix: '/agent' });
      const res = await agent.getApp().request('/agent', {
        method: 'POST',
        headers: { Authorization: AUTH, Origin: 'https://evil.example' },
      });
      expect(res.status).toBe(403);
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    });

    it("leaves a mounted app to its own CORS and headers under AgentServer, at the agent's route", async () => {
      const agent = agentWith({ route: '/agent' }).mount(chatApp(), { prefix: '/chat' });
      const server = new AgentServer();
      server.register(agent);
      const app = server.getApp();
      const preflight = await app.request('/agent/chat', {
        method: 'OPTIONS',
        headers: { Origin: 'https://site.example', 'Access-Control-Request-Method': 'POST' },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin')).toBe('https://site.example');
      const ping = await app.request('/agent/chat/ping', {
        headers: { Origin: 'https://site.example' },
      });
      expect(ping.status).toBe(200);
      expect(ping.headers.get('content-security-policy')).toBeNull();
      // The agent's own route keeps its protection.
      const root = await app.request('/agent', { headers: { Authorization: AUTH } });
      expect(root.headers.get('content-security-policy')).toContain("default-src 'none'");
    });
  });
});
