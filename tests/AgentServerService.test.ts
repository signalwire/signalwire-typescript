/**
 * AgentServer hosts a plain SWMLService next to its agents, as
 * signalwire-python #178 (3.7.6) does: a call flow without AI, such as an IVR
 * menu, shares the server with the agents, and SIP routing can send calls to
 * it. Registering one used to make every request to the server fail with 500,
 * because the server's middleware called a method only AgentBase has.
 */

import { AgentBase } from '../src/AgentBase.js';
import { AgentServer } from '../src/AgentServer.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { SWMLService } from '../src/SWMLService.js';

const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;

function setup(): { server: AgentServer<SWMLService>; menu: SWMLService } {
  const support = new AgentBase({ name: 'support', route: '/support', basicAuth: ['u', 'p'] });
  support.setPromptText('You help callers with their accounts.');
  const menu = new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });
  menu.addVerb('answer', {});
  menu.addVerb('hangup', {});
  const server = new AgentServer<SWMLService>();
  server.register(support, '/support');
  server.register(menu, '/menu');
  return { server, menu };
}

function request(
  server: AgentServer<SWMLService>,
  method: string,
  path: string,
  body?: Json,
  auth = AUTH,
) {
  return server.getApp().request(path, {
    method,
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const verbs = async (res: Response) =>
  (((await res.json()) as Json)['sections']['main'] as Json[]).map((v) => Object.keys(v)[0]);

describe('a plain SWMLService on an AgentServer', () => {
  it("doesn't break the agents next to it", async () => {
    const { server } = setup();
    const res = await request(server, 'GET', '/support');
    expect(res.status).toBe(200);
    expect(await verbs(res)).toContain('ai');
  });

  it('answers at its route with or without the trailing slash, by GET and POST', async () => {
    const { server } = setup();
    for (const [method, path] of [
      ['GET', '/menu'],
      ['GET', '/menu/'],
      ['POST', '/menu'],
      ['POST', '/menu/'],
    ] as const) {
      const res = await request(server, method, path, method === 'POST' ? {} : undefined);
      expect(res.status, `${method} ${path}`).toBe(200);
      expect(await verbs(res)).toEqual(['answer', 'hangup']);
    }
  });

  it('checks its own basic auth', async () => {
    const { server } = setup();
    expect((await request(server, 'GET', '/menu', undefined, '')).status).toBe(401);
    const wrong = 'Basic ' + Buffer.from('u:wrong').toString('base64');
    expect((await request(server, 'GET', '/menu', undefined, wrong)).status).toBe(401);
  });

  it('serves its /swaig endpoint', async () => {
    const { server, menu } = setup();
    menu.defineTool({
      name: 'lookup',
      description: 'Look up',
      handler: () => new FunctionResult('found'),
    });
    const res = await request(server, 'POST', '/menu/swaig', {
      function: 'lookup',
      argument: { parsed: [{}] },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json)['response']).toBe('found');
  });

  it("doesn't serve the agent-only endpoints", async () => {
    const { server } = setup();
    for (const path of ['/menu/post_prompt', '/menu/check_for_input', '/menu/debug']) {
      expect((await request(server, 'POST', path, {})).status, path).toBe(404);
    }
  });

  it('takes calls through SIP routing, and serves its own routing callback', async () => {
    const { server } = setup();
    server.setupSipRouting('/sip');
    const call = { call: { to: 'sip:menu@example.com' } };
    const fromAgent = await request(server, 'POST', '/support/sip', call);
    expect(fromAgent.status).toBe(307);
    expect(fromAgent.headers.get('location')).toBe('/menu');
    const atService = await request(server, 'POST', '/menu/sip', {
      call: { to: 'sip:support@example.com' },
    });
    expect(atService.status).toBe(307);
    expect(atService.headers.get('location')).toBe('/support');
  });

  it('needs an AgentServer<SWMLService>: the default server hosts agents, typed as agents', () => {
    const menu = new SWMLService({ name: 'menu', route: '/menu' });
    const mixed = new AgentServer<SWMLService>();
    mixed.register(menu);
    // Compile-time checks only: never called
    const typeChecks = () => {
      // @ts-expect-error -- a plain service isn't an agent
      new AgentServer().register(menu);
      // @ts-expect-error -- what comes back may be a plain service
      mixed.getAgent('/menu')?.setPromptText('x');
    };
    expect(typeof typeChecks).toBe('function');
    expect(mixed.getAgent('/menu')).toBe(menu);
  });

  it('serves a service registered at a route other than its own', async () => {
    const menu = new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });
    menu.addVerb('answer', {});
    const server = new AgentServer<SWMLService>();
    server.register(menu, '/ivr');
    const res = await request(server, 'GET', '/ivr');
    expect(res.status).toBe(200);
    expect(await verbs(res)).toEqual(['answer']);
  });

  it('takes routing callbacks set up after the service has served a request', async () => {
    const { server } = setup();
    expect((await request(server, 'GET', '/menu')).status).toBe(200);
    server.setupSipRouting('/sip');
    const res = await request(server, 'POST', '/menu/sip', {
      call: { to: 'sip:support@example.com' },
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/support');
  });

  it('is listed at the server root', async () => {
    const { server } = setup();
    const res = await server.getApp().request('/');
    expect(((await res.json()) as Json)['agents']).toEqual([
      { name: 'support', route: '/support' },
      { name: 'menu', route: '/menu' },
    ]);
  });
});
