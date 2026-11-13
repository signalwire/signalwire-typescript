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

/** Codex's third review: ownership and auth of a mounted router. */
describe('mounting a service, third review (found in review)', () => {
  const auth = { Authorization: AUTH, 'Content-Type': 'application/json' };
  const json = { 'Content-Type': 'application/json' };
  const service = (route = '/menu') => {
    const s = new SWMLService({ name: 'menu', route, basicAuth: ['u', 'p'] });
    s.addVerb('answer', {});
    s.defineTool({ name: 'probe', description: 'Probe', handler: () => 'ran' });
    return s;
  };

  it('keeps its auth when the router has an error handler, or sits in one that does', async () => {
    const direct = service();
    direct.asRouter().onError((err, c) => c.text(String(err), 500));
    const nested = new Hono();
    nested.onError((err, c) => c.text(String(err), 500));
    nested.route('/', service().asRouter());
    for (const router of [direct.asRouter(), nested]) {
      const host = new Hono();
      host.route('/voice', router);
      const res = await host.request('/voice/swaig', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ function: 'probe' }),
      });
      // Refused (this onError turns the 401 into a 500); the tool didn't run
      expect(res.status).not.toBe(200);
      expect(await res.text()).not.toContain('ran');
    }
  });

  it('leaves routes added to its router to check auth themselves, as the reference does', async () => {
    const s = service();
    const router = s.asRouter();
    router.get('/mine', (c) => c.text('mine'));
    const host = new Hono();
    host.route('/voice', router);
    expect(await (await host.request('/voice/mine')).text()).toBe('mine');
    // The service's own routes keep theirs
    expect((await host.request('/voice/swaig', { method: 'POST' })).status).toBe(401);
  });

  it("leaves a neighbour alone: a root-route service, a hook's middleware, a PUT at a callback path", async () => {
    const agentAuth = 'Basic ' + Buffer.from('agent:secret').toString('base64');
    const support = new AgentBase({
      name: 'support',
      route: '/support',
      basicAuth: ['agent', 'secret'],
    });
    support.setPromptText('hi');
    class Hooked extends SWMLService {
      protected override registerAdditionalRoutes(app: Hono): void {
        app.use('*', async (_c, next) => next());
      }
    }
    for (const svc of [
      service('/'),
      new Hooked({ name: 'h', route: '/h', basicAuth: ['u', 'p'] }),
    ]) {
      const server = new AgentServer<SWMLService>();
      server.register(svc, '/');
      server.register(support, '/support');
      const res = await request(server, 'GET', '/support', undefined, agentAuth);
      expect(res.status, svc.name).toBe(200);
    }
    const s = service();
    s.registerRoutingCallback(() => '/x', '/sip');
    const host = new Hono();
    host.route('/', s.asRouter());
    host.put('/sip', (c) => c.text('host put'));
    expect(await (await host.request('/sip', { method: 'PUT' })).text()).toBe('host put');
  });

  it('answers CORS preflights for its routes', async () => {
    const host = new Hono();
    host.route('/voice', service().asRouter());
    for (const path of ['/voice/swaig', '/voice']) {
      const res = await host.request(path, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
      });
      expect(res.status, path).toBe(204);
      expect(res.headers.get('access-control-allow-origin'), path).not.toBeNull();
    }
  });

  it('serves callbacks through getApp() mounted under a prefix', async () => {
    const s = service();
    s.registerRoutingCallback(() => '/routed', '/sip');
    const host = new Hono();
    host.route('/voice', s.getApp());
    const post = (path: string) =>
      host.request(path, { method: 'POST', headers: auth, body: JSON.stringify({ call: {} }) });
    expect((await post('/voice/menu/sip')).headers.get('location')).toBe('/routed');
    expect((await post('/voice/sip')).headers.get('location')).toBe('/routed');
  });

  it('matches parameterized and wildcard callback paths', async () => {
    const s = service();
    s.registerRoutingCallback(() => '/handoff', '/handoff/:id');
    s.registerRoutingCallback(() => '/files', '/files/*');
    const post = (path: string) =>
      s
        .getApp()
        .request(path, { method: 'POST', headers: auth, body: JSON.stringify({ call: {} }) });
    expect((await post('/menu/handoff/abc')).headers.get('location')).toBe('/handoff');
    expect((await post('/menu/files/a/b')).headers.get('location')).toBe('/files');
  });

  it("doesn't skip auth for an encoded path", async () => {
    const host = new Hono();
    host.route('/foo bar', service().asRouter());
    const res = await host.request('/foo%20bar/swaig', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ function: 'probe' }),
    });
    expect(res.status).toBe(401);
  });
});

/** Codex's fourth review: routes added to a mounted router, however spelled, stay guarded. */
describe('mounting a service, fourth review (found in review)', () => {
  const auth = { Authorization: AUTH, 'Content-Type': 'application/json' };
  const service = () => {
    const s = new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });
    s.addVerb('answer', {});
    return s;
  };

  it('guards its routes under odd mounts, and still finds callbacks there', async () => {
    for (const [mount, path, cbPath] of [
      ['/percent%25', '/percent%25/%ZZ', '/percent%25/sip'],
      ['/t/:id{[0-9]+}', '/t/7/private', '/t/7/sip'],
    ] as const) {
      const s = service();
      s.registerRoutingCallback(() => '/routed', '/sip');
      const host = new Hono();
      host.route(mount, s.asRouter());
      const swaig = path.replace(/\/[^/]+$/, '/swaig');
      expect((await host.request(swaig, { method: 'POST' })).status, mount).toBe(401);
      const routed = await host.request(cbPath, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ call: {} }),
      });
      expect(routed.headers.get('location'), mount).toBe('/routed');
    }
  });

  it("lets a hook's middleware at a neighbour's path leave the neighbour alone", async () => {
    class Hooked extends SWMLService {
      protected override registerAdditionalRoutes(app: Hono): void {
        app.use('/support', async (_c, next) => next());
      }
    }
    const host = new Hono();
    host.route('/', new Hooked({ name: 'h', route: '/h', basicAuth: ['u', 'p'] }).asRouter());
    host.get('/support', (c) => c.text('public'));
    expect(await (await host.request('/support')).text()).toBe('public');
  });

  it('checks the credentials of each dispatch of a reused Request', async () => {
    const app = service().getApp();
    const req = new Request('http://localhost/menu', { headers: { Authorization: AUTH } });
    expect((await app.fetch(req)).status).toBe(200);
    req.headers.delete('authorization');
    expect((await app.fetch(req)).status).toBe(401);
  });
});

/** Codex's fifth review. */
describe('mounting a service, fifth review (found in review)', () => {
  const auth = { Authorization: AUTH, 'Content-Type': 'application/json' };
  const routed = () => {
    const s = new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });
    s.registerRoutingCallback(() => '/destination', '/sip');
    return s;
  };

  it.each([
    ['/t/:id{[^/]+}', '/t/acme/sip'],
    ['/t/:path{.+}/v1', '/t/acme/team/v1/sip'],
  ])('finds a callback under the mount %s', async (mount, path) => {
    const host = new Hono();
    host.route(mount, routed().asRouter());
    const res = await host.request(path, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ call: {} }),
    });
    expect(res.headers.get('location')).toBe('/destination');
  });

  it("sets its security and CORS headers on a callback's responses, refusals included", async () => {
    const previous = process.env['SWML_CORS_ORIGINS'];
    process.env['SWML_CORS_ORIGINS'] = 'https://app.example.com';
    try {
      const host = new Hono();
      host.route('/voice', routed().asRouter());
      for (const [init, status] of [
        [{ method: 'GET', headers: auth }, 200],
        [{ method: 'POST', headers: auth, body: JSON.stringify({ call: {} }) }, 307],
        [{ method: 'POST', body: '{}' }, 401],
      ] as const) {
        const res = await host.request('/voice/sip', init);
        expect(res.status).toBe(status);
        expect(res.headers.get('x-frame-options'), String(status)).toBe('DENY');
        expect(res.headers.get('vary'), String(status)).toContain('Origin');
      }
    } finally {
      if (previous === undefined) delete process.env['SWML_CORS_ORIGINS'];
      else process.env['SWML_CORS_ORIGINS'] = previous;
    }
  });
});

/** Codex's sixth review. */
describe('routing callbacks, sixth review (found in review)', () => {
  const auth = { Authorization: AUTH, 'Content-Type': 'application/json' };
  const post = (app: Hono, path: string, headers: Record<string, string> = auth) =>
    app.request(path, { method: 'POST', headers, body: JSON.stringify({ call: {} }) });
  const menu = () => new SWMLService({ name: 'menu', route: '/menu', basicAuth: ['u', 'p'] });

  it('dispatches a callback registered at /', async () => {
    const s = menu();
    s.registerRoutingCallback(() => '/destination', '/');
    expect((await post(s.getApp(), '/')).headers.get('location')).toBe('/destination');
    const host = new Hono();
    host.route('/voice', s.getApp());
    expect((await post(host, '/voice')).headers.get('location')).toBe('/destination');
  });

  it('matches percent-encoded callback paths as sent, without decoded aliases', async () => {
    const s = menu();
    s.registerRoutingCallback(() => '/pct', '/literal%25');
    s.registerRoutingCallback(() => '/slash', '/literal%2Fpath');
    s.registerRoutingCallback(() => '/ab', '/a/b');
    const host = new Hono();
    host.route('/voice', s.asRouter());
    for (const app of [s.getApp(), host]) {
      const at = (p: string) => (app === host ? `/voice${p}` : p);
      expect((await post(app, at('/literal%25'))).headers.get('location')).toBe('/pct');
      expect((await post(app, at('/literal%2Fpath'))).headers.get('location')).toBe('/slash');
      expect((await post(app, at('/a%2Fb'))).status).toBe(404);
      expect((await post(app, at('/a/b'))).headers.get('location')).toBe('/ab');
    }
  });

  it("lets the app's error handler answer a callback's auth refusal", async () => {
    const s = menu();
    s.registerRoutingCallback(() => '/destination', '/sip');
    const router = s.asRouter();
    let errors = 0;
    router.onError((_err, c) => {
      errors++;
      return c.json({ custom: true }, 401);
    });
    const host = new Hono();
    host.route('/voice', router);
    const res = await post(host, '/voice/sip', { 'Content-Type': 'application/json' });
    expect(await res.json()).toEqual({ custom: true });
    expect(errors).toBe(1);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });
});
