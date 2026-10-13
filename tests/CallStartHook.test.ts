/**
 * onCallStart (the reserved startup_hook) and rejecting a call from the
 * per-call configuration, from signalwire-python a14709d.
 *
 * The platform calls `startup_hook` once, before the AI's first turn. Its
 * reply's actions run and its response text is added to the conversation as a
 * system message, so the handlers' results are combined into the one reply the
 * hook gives.
 */

import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read loose SWML JSON
type Json = Record<string, any>;

function agentWith(): AgentBase {
  const agent = new AgentBase({ name: 'hooks', route: '/', basicAuth: ['u', 'p'] });
  agent.setPromptText('hooks');
  return agent;
}

async function swml(agent: AgentBase, body: Json = {}): Promise<Json[]> {
  const res = await agent.getApp().request('/', {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ call: { call_id: 'c-1' }, ...body }),
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as Json)['sections']['main'] as Json[];
}

const aiOf = (verbs: Json[]): Json => verbs.find((v) => 'ai' in v)!['ai'] as Json;
const toolsOf = (verbs: Json[]): string[] =>
  ((aiOf(verbs)['SWAIG']?.['functions'] ?? []) as Json[]).map((f) => f['function'] as string);
const verbNames = (verbs: Json[]): string[] => verbs.map((v) => Object.keys(v)[0]!);

/** Fire startup_hook the way the platform does: POST /swaig with the SWML's token. */
async function fire(agent: AgentBase, body: Json = {}): Promise<Json> {
  const entry = (aiOf(await swml(agent))['SWAIG']['functions'] as Json[]).find(
    (f) => f['function'] === 'startup_hook',
  )!;
  const res = await agent.getApp().request(`/swaig${new URL(entry['web_hook_url']).search}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      function: 'startup_hook',
      call_id: 'c-1',
      argument: { parsed: [{}] },
      ...body,
    }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Json;
}

function spyLog(agent: AgentBase, level: 'warn' | 'error') {
  const log = (agent as unknown as { log: Record<string, (msg: string) => void> }).log;
  return vi.spyOn(log, level).mockImplementation(() => {});
}

describe('onCallStart', () => {
  it('registers the reserved startup_hook, and returns the handler', () => {
    const agent = agentWith();
    const handler = () => undefined;
    expect(agent.onCallStart(handler)).toBe(handler);
    const hook = agent.getTool('startup_hook');
    expect(hook).toBeDefined();
    expect(hook!.description).toBe('Internal: fires when the call starts.');
    expect(agent.getTool('hangup_hook')).toBeUndefined();
  });

  it('renders the hook in the SWML, without touching swaig_post_conversation', async () => {
    const agent = agentWith();
    agent.onCallStart(() => undefined);
    const verbs = await swml(agent);
    expect(toolsOf(verbs)).toContain('startup_hook');
    expect('swaig_post_conversation' in (aiOf(verbs)['params'] ?? {})).toBe(false);
  });

  it('runs the handlers in order with the request', async () => {
    const agent = agentWith();
    const seen: unknown[] = [];
    agent.onCallStart((raw) => void seen.push(['one', raw.call_id]));
    agent.onCallStart(async (raw) => void seen.push(['two', raw.global_data?.['k']]));
    await fire(agent, { global_data: { k: 'v' } });
    expect(seen).toEqual([
      ['one', 'c-1'],
      ['two', 'v'],
    ]);
  });

  it('combines the results in order: texts one per line, actions concatenated', async () => {
    const agent = agentWith();
    agent.onCallStart(() => new FunctionResult('Caller is Ann.').updateGlobalData({ a: 1 }));
    agent.onCallStart(() => null);
    agent.onCallStart(async () =>
      new FunctionResult('Ann prefers Spanish.').updateGlobalData({ b: 2 }),
    );
    const reply = await fire(agent);
    expect(reply['response']).toBe('Caller is Ann.\nAnn prefers Spanish.');
    expect(reply['action']).toEqual([{ set_global_data: { a: 1 } }, { set_global_data: { b: 2 } }]);
    expect('post_process' in reply).toBe(false);
  });

  it('reads the response itself, not the "Action completed." an empty result serializes to', async () => {
    const agent = agentWith();
    agent.onCallStart(() => new FunctionResult());
    agent.onCallStart(() => new FunctionResult('Caller is Ann.'));
    expect((await fire(agent))['response']).toBe('Caller is Ann.');
  });

  it("doesn't carry post_process over: a delayed action would wait for a later turn", async () => {
    const agent = agentWith();
    agent.onCallStart(() => new FunctionResult('x', true).updateGlobalData({ a: 1 }));
    const reply = await fire(agent);
    expect('post_process' in reply).toBe(false);
    expect(reply['action']).toEqual([{ set_global_data: { a: 1 } }]);
  });

  it('gives a valid reply when no handler returns anything', async () => {
    const agent = agentWith();
    agent.onCallStart(() => undefined);
    expect(await fire(agent)).toEqual({ response: 'Action completed.' });
  });

  it('ignores a result that is not a FunctionResult, and a structured response', async () => {
    const agent = agentWith();
    const warn = spyLog(agent, 'warn');
    agent.onCallStart((() => 'a bare string') as unknown as () => undefined);
    agent.onCallStart(() => new FunctionResult(undefined, false, 'r').updateGlobalData({ a: 1 }));
    const reply = await fire(agent);
    expect(reply['action']).toEqual([{ set_global_data: { a: 1 } }]);
    expect('response' in reply).toBe(false);
    const messages = warn.mock.calls.map((call) => call[0]);
    expect(messages).toContain('call_start_handler_result_ignored');
    expect(messages).toContain('call_start_handler_structured_response_ignored');
  });

  it('logs a failing handler and still runs the others, so the call starts', async () => {
    const agent = agentWith();
    const error = spyLog(agent, 'error');
    agent.onCallStart(() => {
      throw new Error('boom');
    });
    agent.onCallStart(async () => {
      throw new Error('async boom');
    });
    agent.onCallStart(() => new FunctionResult('still ran'));
    const reply = await fire(agent);
    expect(reply['response']).toBe('still ran');
    expect(error.mock.calls.filter((call) => call[0] === 'call_start_handler_failed')).toHaveLength(
      2,
    );
  });

  it('defines the hook once, and works beside onCallEnd', () => {
    const agent = agentWith();
    agent.onCallStart(() => undefined);
    agent.onCallStart(() => undefined);
    agent.onCallEnd(() => undefined);
    const names = agent.getTools().map((t) => (t as { name: string }).name);
    expect(names.filter((n) => n === 'startup_hook')).toHaveLength(1);
    expect(names).toContain('hangup_hook');
  });

  it("runs handlers the per-call config added, beside the agent's own", async () => {
    const agent = agentWith();
    const ran: string[] = [];
    agent.onCallStart(() => void ran.push('agent'));
    agent.addPerCallConfig((_q, _b, _h, copy) => {
      copy.onCallStart(() => void ran.push('tenant'));
    });
    await fire(agent);
    expect(ran).toEqual(['agent', 'tenant']);
    // The copy's handler stays on the copy: the next request starts again
    ran.length = 0;
    await fire(agent);
    expect(ran).toEqual(['agent', 'tenant']);
  });
});

/**
 * The documented way to turn a call away from the per-call callback: the agent
 * is built with `play` and `hangup` post-answer verbs, and the callback clears
 * them (and adds the tools) only for a verified call. The call hangs up before
 * the `ai` verb runs, and a callback that throws leaves the goodbye in place,
 * because the SDK logs the error and renders the copy.
 */
describe('rejecting a call', () => {
  const GOODBYE = "say:Sorry, this call can't be verified. Goodbye.";

  function gated(verify: (body: Json) => boolean): AgentBase {
    const agent = agentWith();
    agent.addPostAnswerVerb('play', { url: GOODBYE });
    agent.addPostAnswerVerb('hangup', {});
    agent.addPerCallConfig((_query, body, _headers, copy) => {
      if (!verify(body)) return;
      copy.defineTool({
        name: 'lookup',
        description: 'Look something up',
        handler: () => new FunctionResult('found'),
      });
      copy.clearPostAnswerVerbs();
    });
    return agent;
  }

  it('plays the goodbye and hangs up before the AI for an unverified call', async () => {
    const verbs = await swml(gated(() => false));
    const names = verbNames(verbs);
    expect(names.indexOf('play')).toBeLessThan(names.indexOf('hangup'));
    expect(names.indexOf('hangup')).toBeLessThan(names.indexOf('ai'));
    expect(verbs[names.indexOf('play')]!['play']['url']).toBe(GOODBYE);
    expect(toolsOf(verbs)).not.toContain('lookup');
  });

  it('gives a verified call the agent and its tools', async () => {
    const verbs = await swml(gated(() => true));
    const names = verbNames(verbs);
    expect(names).not.toContain('play');
    expect(names).not.toContain('hangup');
    expect(toolsOf(verbs)).toContain('lookup');
  });

  it('leaves the call rejected when the check throws', async () => {
    const agent = gated(() => {
      throw new Error('signature store unavailable');
    });
    spyLog(agent, 'error');
    const names = verbNames(await swml(agent));
    expect(names.indexOf('hangup')).toBeLessThan(names.indexOf('ai'));
  });

  it('gives a tool call from an unverified call no tool to run', async () => {
    const agent = gated((body) => body['call_id'] !== 'c-2' && body['call']?.['call_id'] !== 'c-2');
    const entry = (aiOf(await swml(agent))['SWAIG']['functions'] as Json[]).find(
      (f) => f['function'] === 'lookup',
    )!;
    const res = await agent.getApp().request(`/swaig${new URL(entry['web_hook_url']).search}`, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ function: 'lookup', call_id: 'c-2', argument: { parsed: [{}] } }),
    });
    expect(res.status).toBe(404);
  });

  it('stays rejected when an earlier callback in the chain throws', async () => {
    const agent = agentWith();
    agent.addPostAnswerVerb('play', { url: GOODBYE });
    agent.addPostAnswerVerb('hangup', {});
    agent.addPerCallConfig(() => {
      throw new Error('tenant lookup failed');
    });
    // The callback that clears the goodbye is registered last
    agent.addPerCallConfig((_q, _b, _h, copy) => void copy.clearPostAnswerVerbs());
    spyLog(agent, 'error');
    const names = verbNames(await swml(agent));
    expect(names.indexOf('hangup')).toBeLessThan(names.indexOf('ai'));
  });

  it('changes only the request copy: the agent keeps the goodbye', async () => {
    const agent = gated(() => true);
    await swml(agent);
    const own = (agent as unknown as { postAnswerVerbs: [string, Json][] }).postAnswerVerbs;
    expect(own.map(([name]) => name)).toEqual(['play', 'hangup']);
  });
});
