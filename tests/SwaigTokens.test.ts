/**
 * SWAIG tool tokens: a secure function runs only with a valid token minted for
 * that function and call.
 *
 * The token travels in the per-function `web_hook_url` the agent renders into
 * its SWML, so these tests take it from there, the way SignalWire does, rather
 * than minting one by hand. Mirrors signalwire-python's
 * tests/unit/core/test_swaig_tool_tokens.py (db618a9, eba9ff4).
 */

import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';
import { SessionManager } from '../src/SessionManager.js';

const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');

/** An agent with a secure tool, an open tool, and a record of what ran. */
function makeAgent() {
  const agent = new AgentBase({ name: 'tokens', route: '/', basicAuth: ['u', 'p'] });
  agent.setPromptText('token test');
  const ran: string[] = [];
  agent.defineTool({
    name: 'secure_fn',
    description: 'secure',
    parameters: {},
    secure: true,
    handler: () => {
      ran.push('secure_fn');
      return new FunctionResult('secure ran');
    },
  });
  agent.defineTool({
    name: 'other_fn',
    description: 'also secure',
    parameters: {},
    secure: true,
    handler: () => {
      ran.push('other_fn');
      return new FunctionResult('other ran');
    },
  });
  agent.defineTool({
    name: 'open_fn',
    description: 'not secure',
    parameters: {},
    secure: false,
    handler: () => {
      ran.push('open_fn');
      return new FunctionResult('open ran');
    },
  });
  return { agent, ran };
}

/** Fetch the SWML for a call with GET ?call_id= and return one function's token. */
async function tokenFromSwml(agent: AgentBase, callId: string, fn: string): Promise<string> {
  const res = await agent.getApp().request(`/?call_id=${encodeURIComponent(callId)}`, {
    headers: { Authorization: AUTH },
  });
  expect(res.status).toBe(200);
  const swml = await res.json();
  const ai = swml.sections.main.find((v: Record<string, unknown>) => 'ai' in v).ai;
  const entry = ai.SWAIG.functions.find((f: { function: string }) => f.function === fn);
  const url = new URL(entry.web_hook_url);
  const token = url.searchParams.get('__token');
  expect(token).toBeTruthy();
  return token!;
}

function callSwaig(agent: AgentBase, fn: string, callId: string | undefined, token?: string) {
  const qs = token ? `?__token=${encodeURIComponent(token)}` : '';
  const body: Record<string, unknown> = { function: fn, argument: { parsed: [{}] } };
  if (callId !== undefined) body['call_id'] = callId;
  return agent.getApp().request(`/swaig${qs}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function responseOf(res: Response): Promise<string> {
  expect(res.status).toBe(200);
  return (await res.json()).response as string;
}

describe('SWAIG tool tokens', () => {
  it('runs a secure function with the token from its rendered web_hook_url', async () => {
    const { agent, ran } = makeAgent();
    const token = await tokenFromSwml(agent, 'c1', 'secure_fn');
    expect(await responseOf(await callSwaig(agent, 'secure_fn', 'c1', token))).toBe('secure ran');
    expect(ran).toEqual(['secure_fn']);
  });

  it('refuses a secure function called without a token', async () => {
    const { agent, ran } = makeAgent();
    expect(await responseOf(await callSwaig(agent, 'secure_fn', 'c1'))).toContain('security token');
    expect(ran).toEqual([]);
  });

  it('refuses a token with no call_id in the request', async () => {
    const { agent, ran } = makeAgent();
    const token = await tokenFromSwml(agent, 'c1', 'secure_fn');
    expect(await responseOf(await callSwaig(agent, 'secure_fn', undefined, token))).toContain(
      'security token',
    );
    expect(ran).toEqual([]);
  });

  it("refuses another call's token", async () => {
    const { agent, ran } = makeAgent();
    const token = await tokenFromSwml(agent, 'c1', 'secure_fn');
    expect(await responseOf(await callSwaig(agent, 'secure_fn', 'c2', token))).toContain(
      'security token',
    );
    expect(ran).toEqual([]);
  });

  it("refuses another function's token", async () => {
    const { agent, ran } = makeAgent();
    const token = await tokenFromSwml(agent, 'c1', 'other_fn');
    expect(await responseOf(await callSwaig(agent, 'secure_fn', 'c1', token))).toContain(
      'security token',
    );
    expect(ran).toEqual([]);
  });

  it('runs a non-secure function without a token', async () => {
    const { agent, ran } = makeAgent();
    expect(await responseOf(await callSwaig(agent, 'open_fn', 'c1'))).toBe('open ran');
    expect(ran).toEqual(['open_fn']);
  });

  it('GET ?call_id= mints tokens for that call', async () => {
    const { agent } = makeAgent();
    const token = await tokenFromSwml(agent, 'call-from-query', 'secure_fn');
    const decoded = Buffer.from(token, 'base64url').toString();
    expect(decoded.startsWith('call-from-query.secure_fn.')).toBe(true);
  });

  it('validates tokens for a call id that contains dots (root.2)', async () => {
    const { agent, ran } = makeAgent();
    const token = await tokenFromSwml(agent, 'root.2', 'secure_fn');
    expect(await responseOf(await callSwaig(agent, 'secure_fn', 'root.2', token))).toBe(
      'secure ran',
    );
    expect(ran).toEqual(['secure_fn']);
  });
});

describe('SessionManager dotted call ids', () => {
  it('validates a token minted for a dotted call id, and only for that id', () => {
    const sm = new SessionManager(3600);
    const token = sm.createToolToken('fn', 'conv.a.3');
    expect(sm.validateToken('conv.a.3', 'fn', token)).toBe(true);
    expect(sm.validateToken('conv.a', 'fn', token)).toBe(false);
    expect(sm.validateToken('a.3', 'fn', token)).toBe(false);
  });

  it('debugToken reports the whole dotted call id', () => {
    const sm = new SessionManager(3600);
    sm.debugMode = true;
    const token = sm.createToolToken('fn', 'root.2');
    const info = sm.debugToken(token);
    expect(info.valid_format).toBe(true);
    expect(info.components?.call_id).toBe('root.2');
    expect(info.components?.function).toBe('fn');
  });
});
