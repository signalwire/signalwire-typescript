/**
 * AgentServer - Hosts multiple AgentBase instances under a single HTTP server.
 *
 * Each agent is mounted at its own route prefix. The root `/` lists all
 * registered agents, and `/health` + `/ready` are global health checks.
 */

import { Hono } from 'hono';
import { AgentBase } from './AgentBase.js';

export class AgentServer {
  host: string;
  port: number;
  private agents: Map<string, AgentBase> = new Map();
  private _app: Hono;

  constructor(opts?: { host?: string; port?: number }) {
    this.host = opts?.host ?? '0.0.0.0';
    this.port = opts?.port ?? parseInt(process.env['PORT'] ?? '3000', 10);
    this._app = new Hono();

    // Global health endpoints
    this._app.get('/health', (c) => c.json({ status: 'ok' }));
    this._app.get('/ready', (c) => c.json({ status: 'ready' }));
  }

  register(agent: AgentBase, route?: string): void {
    let r = route ?? (agent as any).route ?? '/';
    if (!r.startsWith('/')) r = `/${r}`;
    r = r.replace(/\/+$/, '') || '/';

    if (this.agents.has(r)) {
      throw new Error(`Route '${r}' is already in use`);
    }

    this.agents.set(r, agent);

    // Mount the agent's Hono app at the route prefix
    const agentApp = agent.getApp();
    if (r === '/') {
      this._app.route('/', agentApp);
    } else {
      this._app.route(r, agentApp);
    }

    console.log(`[AgentServer] Registered '${agent.name}' at ${r}`);
  }

  unregister(route: string): void {
    this.agents.delete(route);
    // Note: Hono doesn't support dynamic route removal,
    // but the agent won't be listed anymore
  }

  getAgents(): Map<string, AgentBase> {
    return this.agents;
  }

  getAgent(route: string): AgentBase | undefined {
    return this.agents.get(route);
  }

  getApp(): Hono {
    // Add root listing (registered after agents so it doesn't shadow them)
    const listing = [...this.agents.entries()].map(([route, agent]) => ({
      name: agent.name,
      route,
    }));

    // We create a response for the root that lists agents
    // Only if no agent is mounted at /
    if (!this.agents.has('/')) {
      this._app.get('/', (c) =>
        c.json({
          service: 'SignalWire AI Agents',
          agents: listing,
        }),
      );
    }

    return this._app;
  }

  async run(host?: string, port?: number): Promise<void> {
    const { serve } = await import('@hono/node-server');
    const h = host ?? this.host;
    const p = port ?? this.port;

    const app = this.getApp();

    console.log(`[AgentServer] Starting on http://${h}:${p}`);
    for (const [route, agent] of this.agents) {
      const [user, pass] = agent.getBasicAuthCredentials();
      console.log(`  ${route} -> ${agent.name} (auth: ${user}:${pass})`);
    }

    serve({ fetch: app.fetch, port: p, hostname: h });
  }
}
