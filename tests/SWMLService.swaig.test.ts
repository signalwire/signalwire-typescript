/**
 * Tests proving SWMLService can host SWAIG functions and serve a non-agent
 * SWML doc (e.g. ai_sidecar) without subclassing AgentBase. This is the
 * contract that lets sidecar / non-agent verbs reuse the SWAIG dispatch
 * surface that previously lived only on AgentBase.
 */

import { SWMLService } from '../src/SWMLService.js';

beforeEach(() => {
  delete process.env['SWML_BASIC_AUTH_USER'];
  delete process.env['SWML_BASIC_AUTH_PASSWORD'];
});

function authHeader(user: string, pass: string): Record<string, string> {
  const encoded = Buffer.from(`${user}:${pass}`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
}

describe('SWMLService SWAIG hosting', () => {
  describe('tool registry', () => {
    it('registers a tool via defineTool and dispatches via onFunctionCall', () => {
      const svc = new SWMLService();
      const captured: Record<string, unknown> = {};
      svc.defineTool({
        name: 'lookup',
        description: 'Look it up',
        parameters: {},
        handler: (args, _raw) => {
          const a = args as Record<string, unknown>;
          for (const k of Object.keys(a)) captured[k] = a[k];
          return { response: 'ok' };
        },
      });
      const result = svc.onFunctionCall('lookup', { x: 'y' }, {});
      expect(result).toEqual({ response: 'ok' });
      expect(captured['x']).toBe('y');
    });

    it('returns null from onFunctionCall for unknown function', () => {
      const svc = new SWMLService();
      expect(svc.onFunctionCall('no_such_fn', {}, {})).toBeNull();
    });

    it('lists tool names in registration order', () => {
      const svc = new SWMLService();
      svc.defineTool({ name: 'first', description: 'f', parameters: {}, handler: () => ({}) });
      svc.defineTool({ name: 'second', description: 's', parameters: {}, handler: () => ({}) });
      expect(svc.listToolNames()).toEqual(['first', 'second']);
    });

    it('registerSwaigFunction tracks raw definition', () => {
      const svc = new SWMLService();
      svc.registerSwaigFunction({ function: 'datamap_tool', description: 'from data map' });
      expect(svc.hasTool('datamap_tool')).toBe(true);
    });
  });

  describe('/swaig HTTP endpoint', () => {
    it('GET /swaig returns SWML', async () => {
      const svc = new SWMLService({ basicAuth: ['u', 'p'] });
      svc.addVerb('hangup', {});
      const app = svc.getApp();
      const res = await app.request('/swaig', { method: 'GET', headers: authHeader('u', 'p') });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('sections');
    });

    it('POST /swaig dispatches a registered handler', async () => {
      const svc = new SWMLService({ basicAuth: ['u', 'p'] });
      svc.defineTool({
        name: 'lookup_competitor',
        description: 'Look up competitor pricing.',
        parameters: { competitor: { type: 'string' } },
        handler: (args) => ({
          response: `${args['competitor']} is $99/seat; we're $79.`,
        }),
      });
      const app = svc.getApp();
      const res = await app.request('/swaig', {
        method: 'POST',
        headers: { ...authHeader('u', 'p'), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function: 'lookup_competitor',
          argument: { parsed: [{ competitor: 'ACME' }] },
        }),
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('ACME');
      expect(text).toContain('$79');
    });

    it('POST /swaig missing function name returns 400', async () => {
      const svc = new SWMLService({ basicAuth: ['u', 'p'] });
      const app = svc.getApp();
      const res = await app.request('/swaig', {
        method: 'POST',
        headers: { ...authHeader('u', 'p'), 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
    });

    it('POST /swaig invalid function name returns 400', async () => {
      const svc = new SWMLService({ basicAuth: ['u', 'p'] });
      const app = svc.getApp();
      const res = await app.request('/swaig', {
        method: 'POST',
        headers: { ...authHeader('u', 'p'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: '../etc/passwd' }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /swaig unknown function returns 404', async () => {
      const svc = new SWMLService({ basicAuth: ['u', 'p'] });
      const app = svc.getApp();
      const res = await app.request('/swaig', {
        method: 'POST',
        headers: { ...authHeader('u', 'p'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: 'nope', argument: { parsed: [{}] } }),
      });
      expect(res.status).toBe(404);
    });

    it('POST /swaig unauthorized returns 401', async () => {
      const svc = new SWMLService({ basicAuth: ['u', 'p'] });
      const app = svc.getApp();
      const res = await app.request('/swaig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('sidecar pattern', () => {
    it('emits ai_sidecar verb, registers tool, and dispatches end-to-end', async () => {
      const svc = new SWMLService({ basicAuth: ['u', 'p'] });

      // 1. Build the SWML — answer + ai_sidecar verb config.
      svc.addVerb('answer', {});
      // `ai_sidecar` is a real, server-accepted verb the BUNDLED schema does not yet
      // model (porting-sdk task #34 — schema refresh). Both public add-verb paths now
      // validate, exactly as the reference does at `core/swml_service.py:558` and
      // `:635` (an unknown verb raises there too), so this test drives the builder's
      // trusted-internal `skipValidation` escape hatch rather than the service's
      // validating wrapper. Drop the option once the verb is in the schema.
      svc.getBuilder().addVerbToSection(
        'main',
        'ai_sidecar',
        {
          prompt: 'real-time copilot',
          lang: 'en-US',
          direction: ['remote-caller', 'local-caller'],
        },
        { skipValidation: true },
      );
      const rendered = svc.renderSwml();
      const main = ((rendered as Record<string, unknown>)['sections'] as Record<string, unknown[]>)[
        'main'
      ] as Array<Record<string, unknown>>;
      const verbs = main.map((v) => Object.keys(v)[0]);
      expect(verbs).toContain('answer');
      expect(verbs).toContain('ai_sidecar');

      // 2. Register a SWAIG tool the sidecar's LLM can call.
      svc.defineTool({
        name: 'lookup_competitor',
        description: 'Look up competitor pricing.',
        parameters: { competitor: { type: 'string' } },
        handler: (args) => ({ response: `Pricing for ${args['competitor']}: $99` }),
      });

      // 3. Dispatch end-to-end via the HTTP endpoint.
      const app = svc.getApp();
      const res = await app.request('/swaig', {
        method: 'POST',
        headers: { ...authHeader('u', 'p'), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function: 'lookup_competitor',
          argument: { parsed: [{ competitor: 'ACME' }] },
        }),
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('ACME');
    });
  });
});
