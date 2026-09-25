/**
 * Every served path that accepts a POST checks the webhook signature when a
 * signing key is set, however the agent is served.
 *
 * Mirrors signalwire-python's TestEveryServedPathIsSigned (db618a9): an
 * unsigned POST must never reach a handler, and gets 403 on every spelling,
 * slash variants included.
 */

import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { AgentBase } from '../src/AgentBase.js';
import { AgentServer } from '../src/AgentServer.js';

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
    host.route('/agent', agent.asRouter());
    return async (path, headers) =>
      (await host.request(path, { method: 'POST', headers, body: BODY })).status;
  },
  AgentServer: (agent) => {
    const server = new AgentServer();
    server.register(agent);
    return async (path, headers) =>
      (await server.getApp().request(path, { method: 'POST', headers, body: BODY })).status;
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

/**
 * Spellings a mode doesn't serve. asRouter() is mounted in the host's own Hono
 * app, whose router decides these: Hono folds a sub-app's `/` into the mount
 * path (no `/agent/`), and a default host doesn't collapse repeated slashes.
 * getApp(), AgentServer and runServerless own their routing and serve all.
 */
const HOST_ROUTED: Record<string, Set<string>> = {
  asRouter: new Set(['/agent/', '/agent//swaig', '/agent/swaig//', '/agent//cb']),
};
const served = (kind: string, paths: string[]) => paths.filter((p) => !HOST_ROUTED[kind]?.has(p));

describe.each(Object.keys(SERVERS))('served through %s', (kind) => {
  it.each(served(kind, UNSIGNED_PATHS))('refuses an unsigned POST to %s', async (path) => {
    const status = await SERVERS[kind]!(makeAgent())(path, baseHeaders);
    expect(status).toBe(403);
  });

  it.each(served(kind, UNSIGNED_PATHS))(
    'refuses a POST to %s signed for another path',
    async (path) => {
      const headers = { ...baseHeaders, 'X-SignalWire-Signature': sign('http://localhost/other') };
      const status = await SERVERS[kind]!(makeAgent())(path, headers);
      expect(status).toBe(403);
    },
  );
});

// Every serving mode in SERVERS must also pass these signed controls, so the
// refusals above can't come from a route that isn't served at all.
describe.each(Object.keys(SERVERS))('signed requests through %s', (kind) => {
  it.each(served(kind, ['/agent', '/agent/', '/agent/cb', '/agent/cb/', '/agent//cb']))(
    'lets a signed POST to %s reach the handler',
    async (path) => {
      const headers = {
        ...baseHeaders,
        'X-SignalWire-Signature': sign(`http://localhost${path}`),
      };
      const status = await SERVERS[kind]!(makeAgent())(path, headers);
      expect(status).toBe(200);
    },
  );
});
