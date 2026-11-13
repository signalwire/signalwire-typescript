/**
 * AgentServer hosts a plain SWMLService next to its agents, as
 * signalwire-python #178 (3.7.6) does: a call flow without AI, such as an IVR
 * menu, shares the server with the agents, and SIP routing can send calls to
 * it. Registering one used to make every request to the server fail with 500,
 * because the server's middleware called a method only AgentBase has.
 */

import { Hono } from 'hono';
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

/** Codex's checkpoint review of the first asRouter(), which rewrote requests. */
describe('mounting a service (found in review)', () => {
  const auth = { Authorization: AUTH, 'Content-Type': 'application/json' };
  const menuService = (opts: { route?: string } = {}) => {
    const menu = new SWMLService({ name: 'menu', basicAuth: ['u', 'p'], ...opts });
    menu.addVerb('answer', {});
    return menu;
  };

  it("leaves other agents' routes alone when registered at '/'", async () => {
    for (const order of ['service first', 'agent first']) {
      const support = new AgentBase({ name: 'support', route: '/support', basicAuth: ['u', 'p'] });
      support.setPromptText('hi');
      const server = new AgentServer<SWMLService>();
      const menu = menuService({ route: '/menu' });
      if (order === 'service first') {
        server.register(menu, '/');
        server.register(support, '/support');
      } else {
        server.register(support, '/support');
        server.register(menu, '/');
      }
      expect((await request(server, 'GET', '/support')).status, order).toBe(200);
      expect((await request(server, 'GET', '/')).status, order).toBe(200);
    }
  });

  it('serves a nested registration under another service', async () => {
    const server = new AgentServer<SWMLService>();
    server.register(menuService({ route: '/menu' }), '/menu');
    const child = new SWMLService({ name: 'child', route: '/child', basicAuth: ['u', 'p'] });
    child.addVerb('hangup', {});
    server.register(child, '/menu/child');
    expect(await verbs(await request(server, 'GET', '/menu/child'))).toEqual(['hangup']);
    expect(await verbs(await request(server, 'GET', '/menu'))).toEqual(['answer']);
  });

  it("serves a root-route service's callbacks under the prefix it's mounted at", async () => {
    const menu = menuService();
    menu.registerRoutingCallback(() => '/elsewhere', '/sip');
    const host = new Hono();
    host.route('/voice', menu.asRouter());
    const res = await host.request('/voice/sip', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ call: {} }),
    });
    expect(res.status).toBe(307);
  });

  it('works after host middleware has read the body', async () => {
    const menu = menuService({ route: '/menu' });
    menu.defineTool({
      name: 'probe',
      description: 'Probe',
      handler: () => new FunctionResult('ok'),
    });
    const host = new Hono();
    host.use('*', async (c, next) => {
      await c.req.json().catch(() => undefined);
      await next();
    });
    host.route('/voice', menu.asRouter());
    const res = await host.request('/voice/swaig', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ function: 'probe' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json)['response']).toBe('ok');
  });

  it('works under a parameterized or encoded mount prefix', async () => {
    const host = new Hono();
    host.route('/tenant/:id', menuService({ route: '/menu' }).asRouter());
    host.route('/foo bar', menuService({ route: '/menu' }).asRouter());
    for (const path of ['/tenant/x/swaig', '/tenant/long-name/swaig', '/foo%20bar/swaig']) {
      const res = await host.request(path, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ function: 'nope' }),
      });
      expect(res.status, path).not.toBe(401);
      expect(((await res.json()) as Json)['error'], path).toBe('Unknown function: nope');
    }
  });

  it('serves a route configured with a trailing slash, which it drops as the reference does', async () => {
    const menu = menuService({ route: '/menu/' });
    expect(menu.route).toBe('/menu');
    expect((await menu.getApp().request('/menu', { headers: auth })).status).toBe(200);
    const host = new Hono();
    host.route('/voice', menu.asRouter());
    expect((await host.request('/voice', { headers: auth })).status).toBe(200);
  });

  it('keeps /swaig ahead of a routing callback registered at the same path', async () => {
    const menu = menuService({ route: '/menu' });
    menu.defineTool({ name: 'lookup', description: 'Look up', handler: () => 'found' });
    menu.registerRoutingCallback(() => '/elsewhere', '/swaig');
    const res = await menu.getApp().request('/menu/swaig', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ function: 'lookup' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json)['response']).toBe('found');
  });

  it("gives an exact path to the callback registered there, not another's alias", async () => {
    for (const late of [false, true]) {
      const menu = menuService({ route: '/menu' });
      menu.registerRoutingCallback(() => '/short', '/sip');
      if (late) await menu.getApp().request('/menu', { headers: auth });
      menu.registerRoutingCallback(() => '/legacy-exact', '/menu/sip');
      const res = await menu.getApp().request('/menu/sip', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ call: {} }),
      });
      expect(res.headers.get('location'), `late=${late}`).toBe('/legacy-exact');
    }
  });

  it('answers HEAD at a callback path', async () => {
    const menu = menuService({ route: '/menu' });
    menu.registerRoutingCallback(() => '/elsewhere', '/sip');
    expect((await menu.getApp().request('/sip', { method: 'HEAD', headers: auth })).status).toBe(
      200,
    );
    expect(
      (await menu.getApp().request('/menu/sip', { method: 'HEAD', headers: auth })).status,
    ).toBe(200);
  });
});

/** Codex's review of the rebuilt-on-registration router. */
describe('mounting a service, second review (found in review)', () => {
  const auth = { Authorization: AUTH, 'Content-Type': 'application/json' };
  const call = (body: Json = { call: {} }) => ({
    method: 'POST',
    headers: auth,
    body: JSON.stringify(body),
  });

  it("doesn't apply its basic auth to a neighbour's routes", async () => {
    const menu = new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });
    menu.addVerb('answer', {});
    const support = new AgentBase({
      name: 'support',
      route: '/support',
      basicAuth: ['agent', 'secret'],
    });
    support.setPromptText('hi');
    const server = new AgentServer<SWMLService>();
    server.register(menu, '/');
    server.register(support, '/support');
    const agentAuth = 'Basic ' + Buffer.from('agent:secret').toString('base64');
    expect((await request(server, 'GET', '/support', undefined, agentAuth)).status).toBe(200);
    expect((await request(server, 'GET', '/', undefined, agentAuth)).status).toBe(401);
    expect((await request(server, 'GET', '/')).status).toBe(200);
  });

  it('passes the app being built to registerAdditionalRoutes', async () => {
    class Extra extends SWMLService {
      protected override registerAdditionalRoutes(app: Hono): void {
        app.get('/extra', (c) => c.text('extra'));
      }
    }
    const extra = new Extra({ name: 'extra', route: '/x', basicAuth: ['u', 'p'] });
    expect(await (await extra.getApp().request('/extra', { headers: auth })).text()).toBe('extra');
    const host = new Hono();
    host.route('/v', extra.asRouter());
    expect(await (await host.request('/v/extra', { headers: auth })).text()).toBe('extra');
    expect((await host.request('/v/extra')).status).toBe(401);
  });

  it('answers a late callback through an app, router or handler taken before it', async () => {
    const menu = new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });
    const held = menu.getApp();
    const host = new Hono();
    host.route('/voice', menu.asRouter());
    await held.request('/menu', { headers: auth });
    await host.request('/voice', { headers: auth });
    menu.registerRoutingCallback(() => '/late', '/sip');
    expect((await held.request('/menu/sip', call())).headers.get('location')).toBe('/late');
    expect((await host.request('/voice/sip', call())).headers.get('location')).toBe('/late');
  });

  it('keeps routes added to its app when a callback is registered', async () => {
    const menu = new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });
    menu.getApp().get('/custom', (c) => c.text('custom'));
    expect((await menu.getApp().request('/custom', { headers: auth })).status).toBe(200);
    menu.registerRoutingCallback(() => '/x', '/sip');
    expect((await menu.getApp().request('/custom', { headers: auth })).status).toBe(200);
  });

  it('runs the callback registered last at a path', async () => {
    const menu = new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });
    menu.registerRoutingCallback(() => '/old', '/sip');
    menu.registerRoutingCallback(() => '/new', '/sip');
    expect((await menu.getApp().request('/menu/sip', call())).headers.get('location')).toBe('/new');
  });

  it('answers its configured trailing-slash route, on its own and mounted', async () => {
    const menu = new SWMLService({ name: 'menu', route: '/menu/', basicAuth: ['u', 'p'] });
    menu.addVerb('answer', {});
    for (const path of ['/menu', '/menu/', '/menu/swaig/']) {
      const res = await menu.getApp().request(path, { headers: auth });
      expect(res.status, path).toBe(200);
    }
    // Whether /voice/ is /voice is the host's choice: Hono's strict option
    const host = new Hono({ strict: false });
    host.route('/voice', menu.asRouter());
    for (const path of ['/voice', '/voice/']) {
      expect((await host.request(path, { headers: auth })).status, path).toBe(200);
    }
  });

  it('gives handleRequest the same exact-path precedence', async () => {
    const menu = new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });
    menu.registerRoutingCallback(() => '/short', '/sip');
    menu.registerRoutingCallback(() => '/exact', '/menu/sip');
    const [status, headers] = await menu.handleRequest(
      'POST',
      'https://example.com/menu/sip',
      { authorization: AUTH },
      { call: {} },
    );
    expect(status).toBe(307);
    expect(headers['Location']).toBe('/exact');
  });
});
