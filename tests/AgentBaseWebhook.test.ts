/**
 * AgentBase integration tests for SignalWire webhook signature validation.
 *
 * Per porting-sdk/webhooks.md, AgentBase MUST:
 *  - Accept a ``signingKey`` option (and fall back to ``SIGNALWIRE_SIGNING_KEY``).
 *  - When set, auto-mount the validation middleware on POST /, /swaig,
 *    /post_prompt — unsigned requests rejected with 403.
 *  - When not set, log a prominent warning on startup and accept POSTs
 *    (so existing local-dev workflows don't break) — but the warning
 *    presence is the signal that validation is OFF.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';

import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

const KEY = 'PSKtest1234567890abcdef';

function schemeASig(key: string, url: string, body: string): string {
  return createHmac('sha1', key).update(url + body, 'utf8').digest('hex');
}

/**
 * Capture every line written to console.warn / console.error / console.info
 * for the duration of a test so we can assert on the disabled-validation
 * warning. The Logger module writes through ``console.warn`` (etc.), so
 * spying on those is the cleanest cross-environment hook.
 */
function captureLogs(): { records: string[]; restore: () => void } {
  const records: string[] = [];
  const sink = (...args: unknown[]) => {
    records.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  };
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(sink);
  const errSpy = vi.spyOn(console, 'error').mockImplementation(sink);
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(sink);
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(sink);
  return {
    records,
    restore: () => {
      warnSpy.mockRestore();
      errSpy.mockRestore();
      infoSpy.mockRestore();
      debugSpy.mockRestore();
    },
  };
}

describe('AgentBase — webhook signature validation', () => {
  beforeEach(() => {
    delete process.env['SIGNALWIRE_SIGNING_KEY'];
  });

  afterEach(() => {
    delete process.env['SIGNALWIRE_SIGNING_KEY'];
  });

  it('with explicit signingKey: POST /swaig with valid sig is accepted', async () => {
    const agent = new AgentBase({
      name: 'sig-agent',
      route: '/',
      basicAuth: ['u', 'p'],
      signingKey: KEY,
    });
    agent.defineTool({
      name: 'echo',
      description: 'echo',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });

    const app = agent.getApp();
    const body = JSON.stringify({ function: 'echo', argument: {} });
    // Hono's app.request resolves c.req.url to http://localhost/swaig by default.
    const url = 'http://localhost/swaig';
    const sig = schemeASig(KEY, url, body);

    const res = await app.request('/swaig', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'X-SignalWire-Signature': sig,
        'Content-Type': 'application/json',
      },
      body,
    });
    expect(res.status).toBe(200);
  });

  it('with explicit signingKey: POST /swaig with no signature header → 403', async () => {
    const agent = new AgentBase({
      name: 'sig-agent',
      route: '/',
      basicAuth: ['u', 'p'],
      signingKey: KEY,
    });
    agent.defineTool({
      name: 'echo',
      description: 'echo',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });

    const app = agent.getApp();
    const res = await app.request('/swaig', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'echo', argument: {} }),
    });
    expect(res.status).toBe(403);
  });

  it('with explicit signingKey: POST / (SWML root) with valid sig is accepted', async () => {
    const agent = new AgentBase({
      name: 'sig-agent',
      route: '/',
      basicAuth: ['u', 'p'],
      signingKey: KEY,
    });
    agent.setPromptText('hello');

    const app = agent.getApp();
    const body = JSON.stringify({ call_id: 'abc-123' });
    const url = 'http://localhost/';
    const sig = schemeASig(KEY, url, body);

    const res = await app.request('/', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'X-SignalWire-Signature': sig,
        'Content-Type': 'application/json',
      },
      body,
    });
    expect(res.status).toBe(200);
  });

  it('with explicit signingKey: POST / with bogus sig → 403', async () => {
    const agent = new AgentBase({
      name: 'sig-agent',
      route: '/',
      basicAuth: ['u', 'p'],
      signingKey: KEY,
    });
    agent.setPromptText('hello');

    const app = agent.getApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'X-SignalWire-Signature': 'bogus',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('with explicit signingKey: POST /post_prompt with valid sig is accepted', async () => {
    const agent = new AgentBase({
      name: 'sig-agent',
      route: '/',
      basicAuth: ['u', 'p'],
      signingKey: KEY,
    });

    const app = agent.getApp();
    const body = JSON.stringify({ post_prompt_data: { summary: 'ok' } });
    const url = 'http://localhost/post_prompt';
    const sig = schemeASig(KEY, url, body);

    const res = await app.request('/post_prompt', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'X-SignalWire-Signature': sig,
        'Content-Type': 'application/json',
      },
      body,
    });
    expect(res.status).toBe(200);
  });

  it('with explicit signingKey: GET / (SWML probe) is unsigned and still works', async () => {
    // GET / is the SignalWire platform's static-SWML probe. It carries no body
    // and is not signed by the platform; we must NOT 403 it.
    const agent = new AgentBase({
      name: 'sig-agent',
      route: '/',
      basicAuth: ['u', 'p'],
      signingKey: KEY,
    });
    agent.setPromptText('hello');

    const app = agent.getApp();
    const res = await app.request('/', {
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
      },
    });
    expect(res.status).toBe(200);
  });

  it('with no signingKey: POST /swaig still passes (validation disabled)', async () => {
    // No signingKey, no env var → middleware is NOT mounted, existing
    // unsigned-flow tests must continue to work.
    const agent = new AgentBase({
      name: 'no-sig-agent',
      route: '/',
      basicAuth: ['u', 'p'],
    });
    agent.defineTool({
      name: 'echo',
      description: 'echo',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });

    const app = agent.getApp();
    const res = await app.request('/swaig', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'echo', argument: {} }),
    });
    expect(res.status).toBe(200);
  });

  it('with no signingKey: emits the canonical disabled-validation warning on construction', () => {
    const cap = captureLogs();
    try {
      // No signingKey, no env var.
      new AgentBase({ name: 'unsigned', route: '/', basicAuth: ['u', 'p'] });
    } finally {
      cap.restore();
    }
    const expected =
      '[signalwire] webhook signature validation is disabled — set signingKey or SIGNALWIRE_SIGNING_KEY to enable';
    const matched = cap.records.some((line) => line.includes(expected));
    expect(matched).toBe(true);
  });

  it('with no signingKey but SIGNALWIRE_SIGNING_KEY env set: uses env value, no warning', async () => {
    process.env['SIGNALWIRE_SIGNING_KEY'] = KEY;

    const cap = captureLogs();
    let agent: AgentBase;
    try {
      agent = new AgentBase({ name: 'env-sig', route: '/', basicAuth: ['u', 'p'] });
    } finally {
      cap.restore();
    }
    const expected =
      '[signalwire] webhook signature validation is disabled — set signingKey or SIGNALWIRE_SIGNING_KEY to enable';
    const sawWarning = cap.records.some((line) => line.includes(expected));
    expect(sawWarning).toBe(false);

    // Confirm it actually validates: a bogus-sig POST gets 403, a valid-sig POST gets 200.
    agent!.defineTool({
      name: 'echo',
      description: 'echo',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });
    const app = agent!.getApp();
    const body = JSON.stringify({ function: 'echo', argument: {} });
    const url = 'http://localhost/swaig';
    const sig = schemeASig(KEY, url, body);

    const okRes = await app.request('/swaig', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'X-SignalWire-Signature': sig,
        'Content-Type': 'application/json',
      },
      body,
    });
    expect(okRes.status).toBe(200);

    const badRes = await app.request('/swaig', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'X-SignalWire-Signature': 'bogus',
        'Content-Type': 'application/json',
      },
      body,
    });
    expect(badRes.status).toBe(403);
  });

  it('explicit signingKey takes precedence over SIGNALWIRE_SIGNING_KEY env', async () => {
    // Env has the wrong key; constructor option has the right one.
    process.env['SIGNALWIRE_SIGNING_KEY'] = 'wrong-env-key';
    const agent = new AgentBase({
      name: 'precedence',
      route: '/',
      basicAuth: ['u', 'p'],
      signingKey: KEY,
    });
    agent.defineTool({
      name: 'echo',
      description: 'echo',
      parameters: {},
      handler: () => new FunctionResult('ok'),
    });

    const app = agent.getApp();
    const body = JSON.stringify({ function: 'echo', argument: {} });
    const url = 'http://localhost/swaig';
    const sigForExplicit = schemeASig(KEY, url, body);

    const res = await app.request('/swaig', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'X-SignalWire-Signature': sigForExplicit,
        'Content-Type': 'application/json',
      },
      body,
    });
    expect(res.status).toBe(200);
  });
});
