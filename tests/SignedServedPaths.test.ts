/**
 * Every served path that accepts a POST checks the webhook signature when a
 * signing key is set, however the agent is served.
 *
 * Mirrors signalwire-python's TestEveryServedPathIsSigned (db618a9): an
 * unsigned POST must never reach a handler. The reference answers 403 on every
 * spelling, slash variants included, because it serves them through catch-all
 * routes; this port routes strictly, so a slash variant it doesn't serve gets
 * 404, which also never reaches a handler.
 */

import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { AgentBase } from '../src/AgentBase.js';

const KEY = 'PSKtest1234567890abcdef';
const AUTH = 'Basic ' + Buffer.from('u:p').toString('base64');
const BODY = '{"function":"nope","call_id":"c1"}';

const sign = (url: string) =>
  createHmac('sha1', KEY)
    .update(url + BODY, 'utf8')
    .digest('hex');

function makeAgent(): AgentBase {
  const agent = new AgentBase({
    name: 'signed',
    route: '/agent',
    basicAuth: ['u', 'p'],
    signingKey: KEY,
  });
  agent.setPromptText('signed paths');
  agent.setPostPrompt('Summarize.');
  agent.registerRoutingCallback(() => null, '/cb');
  return agent;
}

type Send = (path: string, headers: Record<string, string>) => Promise<number>;

/** Each way of serving an agent, as a function that POSTs BODY to a path. */
const SERVERS: Record<string, (agent: AgentBase) => Send> = {
  getApp: (agent) => async (path, headers) =>
    (await agent.getApp().request(path, { method: 'POST', headers, body: BODY })).status,
  asRouter: (agent) => {
    const host = new Hono();
    host.route('/', agent.asRouter() as unknown as Hono);
    return async (path, headers) =>
      (await host.request(path, { method: 'POST', headers, body: BODY })).status;
  },
  runServerless: (agent) => async (path, headers) =>
    (
      await agent.runServerless(
        {
          httpMethod: 'POST',
          path,
          headers: { host: 'localhost', 'x-forwarded-proto': 'http', ...headers },
          body: BODY,
        },
        undefined,
        'lambda',
      )
    ).statusCode,
};

const UNSIGNED_PATHS = [
  '/agent',
  '/agent/',
  '/agent/swaig',
  '/agent/swaig/',
  '/agent//swaig',
  '/agent/swaig//',
  '/agent/post_prompt',
  '/agent/post_prompt/',
  '/agent/cb',
  '/agent/cb/',
];

const baseHeaders = { Authorization: AUTH, 'Content-Type': 'application/json' };

describe.each(Object.keys(SERVERS))('served through %s', (kind) => {
  it.each(UNSIGNED_PATHS)('refuses an unsigned POST to %s', async (path) => {
    const status = await SERVERS[kind]!(makeAgent())(path, baseHeaders);
    expect([403, 404]).toContain(status);
  });

  it.each(UNSIGNED_PATHS)('refuses a POST to %s signed for another path', async (path) => {
    const headers = { ...baseHeaders, 'X-SignalWire-Signature': sign('http://localhost/other') };
    const status = await SERVERS[kind]!(makeAgent())(path, headers);
    expect([403, 404]).toContain(status);
  });
});

// Every serving mode in SERVERS must also pass these signed controls, so a
// 404 in the refusal cases above can't hide a route that isn't served at all.
describe.each(Object.keys(SERVERS))('signed requests through %s', (kind) => {
  it.each(['/agent', '/agent/cb'])('lets a signed POST to %s reach the handler', async (path) => {
    const headers = { ...baseHeaders, 'X-SignalWire-Signature': sign(`http://localhost${path}`) };
    const status = await SERVERS[kind]!(makeAgent())(path, headers);
    expect(status).toBe(200);
  });
});

// AgentServer serves an agent routed at /agent under /agent/agent (a routing
// defect fixed separately), so its /agent/... routes 404 and would pass the
// refusal cases without testing anything. Add it to SERVERS once it serves the
// agent's own route.
it.todo('served through AgentServer, once it serves an agent at its own route');
