/**
 * Tests for the framework-free request-dispatch core: SWMLService.handleRequest
 * and the AgentBase override. This is the primitive dispatch surface the SDK
 * ports share (mirrors Python's SWMLService/AgentBase.handle_request), returning
 * a [status, headers, bodyString] triple over plain primitives.
 */

import { SWMLService } from '../src/SWMLService.js';
import { AgentBase } from '../src/AgentBase.js';

beforeEach(() => {
  delete process.env['SWML_BASIC_AUTH_USER'];
  delete process.env['SWML_BASIC_AUTH_PASSWORD'];
});

describe('SWMLService.handleRequest', () => {
  it('returns 200 with the SWML document for a GET', async () => {
    const svc = new SWMLService({ name: 'ivr' });
    svc.addVerb('answer', {});
    svc.addVerb('hangup', {});

    const [status, headers, body] = await svc.handleRequest('GET', 'http://localhost:3000/', {});
    expect(status).toBe(200);
    expect(headers).toEqual({});
    const doc = JSON.parse(body);
    expect(doc).toHaveProperty('sections');
  });

  it('returns 401 with WWW-Authenticate when enforced auth is missing', async () => {
    const svc = new SWMLService({ name: 'ivr', basicAuth: ['admin', 'secret'] });
    const [status, headers] = await svc.handleRequest('GET', 'http://localhost:3000/', {});
    expect(status).toBe(401);
    expect(headers['WWW-Authenticate']).toBe('Basic');
  });

  it('passes with correct basic-auth credentials', async () => {
    const svc = new SWMLService({ name: 'ivr', basicAuth: ['admin', 'secret'] });
    const cred = Buffer.from('admin:secret').toString('base64');
    const [status] = await svc.handleRequest('GET', 'http://localhost:3000/', {
      authorization: `Basic ${cred}`,
    });
    expect(status).toBe(200);
  });

  // ── RFC 7235 auth-scheme case-insensitivity (SWMLService basic path) ──
  // The reference compares `scheme.lower() != "basic"`, so a legal lowercase
  // scheme token authenticates. A case-sensitive port 401s it.

  it('passes with a lowercase `basic` scheme token', async () => {
    const svc = new SWMLService({ name: 'ivr', basicAuth: ['admin', 'secret'] });
    const cred = Buffer.from('admin:secret').toString('base64');
    const [status] = await svc.handleRequest('GET', 'http://localhost:3000/', {
      authorization: `basic ${cred}`,
    });
    expect(status).toBe(200);
  });

  it('passes with a mixed-case `BaSiC` scheme token', async () => {
    const svc = new SWMLService({ name: 'ivr', basicAuth: ['admin', 'secret'] });
    const cred = Buffer.from('admin:secret').toString('base64');
    const [status] = await svc.handleRequest('GET', 'http://localhost:3000/', {
      authorization: `BaSiC ${cred}`,
    });
    expect(status).toBe(200);
  });

  it('still 401s wrong schemes and a colon-less payload', async () => {
    const svc = new SWMLService({ name: 'ivr', basicAuth: ['admin', 'secret'] });
    const cred = Buffer.from('admin:secret').toString('base64');
    const noColon = Buffer.from('admin').toString('base64');
    for (const header of [
      `Digest ${cred}`,
      `Negotiate ${cred}`,
      `Basicx ${cred}`,
      `basicx ${cred}`,
      `Bearer ${cred}`,
      `${cred}`,
      `Basic ${noColon}`,
      `basic ${noColon}`,
    ]) {
      const [status] = await svc.handleRequest('GET', 'http://localhost:3000/', {
        authorization: header,
      });
      expect(status).toBe(401);
    }
  });

  it('invokes a routing callback with (body, headers) and 307-redirects on a route', async () => {
    const svc = new SWMLService({ name: 'ivr' });
    let seenHeaders: Record<string, string> | undefined;
    svc.registerRoutingCallback((body, headers) => {
      seenHeaders = headers;
      return (body as { to?: string }).to === 'sales' ? '/sales' : null;
    }, '/route');

    const [status, headers] = await svc.handleRequest(
      'POST',
      'http://localhost:3000/route',
      { 'x-test': 'v' },
      { to: 'sales' },
    );
    expect(status).toBe(307);
    expect(headers['Location']).toBe('/sales');
    expect(seenHeaders).toEqual({ 'x-test': 'v' });
  });

  it('serves normal SWML (200) when the routing callback returns null', async () => {
    const svc = new SWMLService({ name: 'ivr' });
    svc.registerRoutingCallback(() => null, '/route');
    const [status] = await svc.handleRequest(
      'POST',
      'http://localhost:3000/route',
      {},
      { some: 'payload' },
    );
    expect(status).toBe(200);
  });
});

describe('AgentBase.handleRequest (override)', () => {
  it('renders the AI SWML document via renderSwml for a GET', async () => {
    const agent = new AgentBase({ name: 'demo', basicAuth: ['u', 'p'] });
    const cred = Buffer.from('u:p').toString('base64');
    const [status, , body] = await agent.handleRequest('GET', 'http://localhost:3000/', {
      authorization: `Basic ${cred}`,
    });
    expect(status).toBe(200);
    const doc = JSON.parse(body) as { sections?: { main?: unknown[] } };
    // AgentBase always emits an AI block in the main section.
    const main = JSON.stringify(doc.sections?.main ?? []);
    expect(main).toContain('ai');
  });

  it('returns 401 when basic-auth is enforced and missing', async () => {
    const agent = new AgentBase({ name: 'demo', basicAuth: ['u', 'p'] });
    const [status, headers] = await agent.handleRequest('GET', 'http://localhost:3000/', {});
    expect(status).toBe(401);
    expect(headers['WWW-Authenticate']).toBe('Basic');
  });

  // ── RFC 7235 auth-scheme case-insensitivity (AgentBase basic path) ────

  it('renders SWML with a lowercase `basic` scheme token', async () => {
    const agent = new AgentBase({ name: 'demo', basicAuth: ['u', 'p'] });
    const cred = Buffer.from('u:p').toString('base64');
    const [status] = await agent.handleRequest('GET', 'http://localhost:3000/', {
      authorization: `basic ${cred}`,
    });
    expect(status).toBe(200);
  });

  it('renders SWML with a mixed-case `BaSiC` scheme token', async () => {
    const agent = new AgentBase({ name: 'demo', basicAuth: ['u', 'p'] });
    const cred = Buffer.from('u:p').toString('base64');
    const [status] = await agent.handleRequest('GET', 'http://localhost:3000/', {
      authorization: `BaSiC ${cred}`,
    });
    expect(status).toBe(200);
  });

  it('still 401s wrong schemes and a colon-less payload', async () => {
    const agent = new AgentBase({ name: 'demo', basicAuth: ['u', 'p'] });
    const cred = Buffer.from('u:p').toString('base64');
    const noColon = Buffer.from('u').toString('base64');
    for (const header of [
      `Digest ${cred}`,
      `Negotiate ${cred}`,
      `Basicx ${cred}`,
      `basicx ${cred}`,
      `Bearer ${cred}`,
      `${cred}`,
      `Basic ${noColon}`,
      `basic ${noColon}`,
    ]) {
      const [status] = await agent.handleRequest('GET', 'http://localhost:3000/', {
        authorization: header,
      });
      expect(status).toBe(401);
    }
  });

  it('307-redirects from a routing callback receiving (body, headers)', async () => {
    const agent = new AgentBase({ name: 'demo', basicAuth: ['u', 'p'] });
    const cred = Buffer.from('u:p').toString('base64');
    agent.registerRoutingCallback(
      (body) => ((body as { go?: boolean }).go ? '/next' : null),
      '/sip',
    );
    const [status, headers] = await agent.handleRequest(
      'POST',
      'http://localhost:3000/sip',
      { authorization: `Basic ${cred}` },
      { go: true },
    );
    expect(status).toBe(307);
    expect(headers['Location']).toBe('/next');
  });
});
