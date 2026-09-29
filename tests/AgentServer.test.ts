import { describe, it, expect } from 'vitest';
import { AgentServer } from '../src/AgentServer.js';
import { AgentBase } from '../src/AgentBase.js';

describe('AgentServer', () => {
  it('registers agents', () => {
    const server = new AgentServer();
    const agent1 = new AgentBase({ name: 'support', route: '/support' });
    const agent2 = new AgentBase({ name: 'sales', route: '/sales' });

    server.register(agent1, '/support');
    server.register(agent2, '/sales');

    expect(server.getAgents().size).toBe(2);
    expect(server.getAgent('/support')?.name).toBe('support');
    expect(server.getAgent('/sales')?.name).toBe('sales');
  });

  it('throws on duplicate route', () => {
    const server = new AgentServer();
    const agent1 = new AgentBase({ name: 'a1', route: '/test' });
    const agent2 = new AgentBase({ name: 'a2', route: '/test' });

    server.register(agent1, '/test');
    expect(() => server.register(agent2, '/test')).toThrow("Route '/test' is already in use");
  });

  it('unregisters agents', () => {
    const server = new AgentServer();
    const agent = new AgentBase({ name: 'test', route: '/test' });
    server.register(agent, '/test');
    server.unregister('/test');
    expect(server.getAgents().size).toBe(0);
  });

  it('uses agent route if none provided', () => {
    const server = new AgentServer();
    const agent = new AgentBase({ name: 'myagent', route: '/myroute' });
    server.register(agent);
    expect(server.getAgent('/myroute')).toBeDefined();
  });

  it('getApp returns Hono instance', () => {
    const server = new AgentServer();
    const app = server.getApp();
    expect(app).toBeDefined();
    expect(typeof app.fetch).toBe('function');
  });

  it('health endpoint responds', async () => {
    const server = new AgentServer();
    const app = server.getApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('ready endpoint responds', async () => {
    const server = new AgentServer();
    const app = server.getApp();
    const res = await app.request('/ready');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ready');
  });

  it('root listing when no agent at /', async () => {
    const server = new AgentServer();
    const agent = new AgentBase({ name: 'test', route: '/test' });
    server.register(agent);
    const app = server.getApp();
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.service).toBe('SignalWire AI Agents');
    expect(body.agents.length).toBe(1);
  });

  it('includes security headers in responses', async () => {
    const server = new AgentServer();
    const app = server.getApp();
    const res = await app.request('/health');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('responds to CORS preflight', async () => {
    const server = new AgentServer();
    const app = server.getApp();
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('CORS wildcard does not set credentials header', async () => {
    const saved = process.env['SWML_CORS_ORIGINS'];
    delete process.env['SWML_CORS_ORIGINS'];
    try {
      const server = new AgentServer();
      const app = server.getApp();
      const res = await app.request('/health', {
        headers: { Origin: 'https://example.com' },
      });
      const credHeader = res.headers.get('Access-Control-Allow-Credentials');
      expect(credHeader).toBeNull();
    } finally {
      if (saved) process.env['SWML_CORS_ORIGINS'] = saved;
    }
  });

  it('CSP and Permissions-Policy headers present', async () => {
    const server = new AgentServer();
    const app = server.getApp();
    const res = await app.request('/health');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
  });
});

describe('routing callbacks added after register() (found in the documentation pass)', () => {
  const AUTH = 'Basic ' + btoa('u:p');
  function serverWithSales() {
    const server = new AgentServer();
    const agent = new AgentBase({ name: 'sales', route: '/sales', basicAuth: ['u', 'p'] });
    agent.setPromptText('hi');
    server.register(agent);
    return server;
  }
  const post = (server: AgentServer, path: string) =>
    server.getApp().request(path, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ call: { to: 'sip:sales@example.com' } }),
    });

  it('serves setupSipRouting() at the agent route, not doubled', async () => {
    const server = serverWithSales();
    server.setupSipRouting('/sip');
    expect((await post(server, '/sales/sip')).status).not.toBe(404);
    expect((await post(server, '/sales/sales/sip')).status).toBe(404);
  });

  it('serves registerGlobalRoutingCallback() at the agent route', async () => {
    const server = serverWithSales();
    server.registerGlobalRoutingCallback(() => '/elsewhere', '/route');
    const res = await post(server, '/sales/route');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/elsewhere');
  });
});
