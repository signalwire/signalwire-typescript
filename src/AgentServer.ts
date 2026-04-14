/**
 * AgentServer - Hosts multiple AgentBase instances under a single HTTP server.
 *
 * Each agent is mounted at its own route prefix. The root `/` lists all
 * registered agents, and `/health` + `/ready` are global health checks.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { AgentBase, type RoutingCallback } from './AgentBase.js';
import { getLogger, setGlobalLogLevel } from './Logger.js';

/** Common MIME types for static file serving. */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
};

/** Multi-agent HTTP server that hosts multiple AgentBase instances on distinct route prefixes. */
export class AgentServer {
  /** Hostname the server binds to. */
  host: string;
  /** Port the server listens on. */
  port: number;
  /** Logging level (debug, info, warn, error). */
  readonly logLevel: string;
  /** Public logger for this server instance. */
  readonly log = getLogger('AgentServer');
  private agents: Map<string, AgentBase> = new Map();
  private _app: Hono;

  // SIP routing state
  private _sipRoutingEnabled = false;
  private _sipRoute: string | null = null;
  private _sipAutoMap = false;
  private _sipUsernameMapping: Map<string, string> = new Map();
  private _sipRoutingCallback: ((req: Request, body: Record<string, unknown>) => string | undefined) | null = null;

  // Global routing callbacks registered via registerGlobalRoutingCallback
  // Stored so they can be applied to agents registered after the call.
  private _globalRoutingCallbacks: Array<{ callbackFn: RoutingCallback; path: string }> = [];

  /**
   * Create an AgentServer.
   * @param opts - Optional host, port, and logLevel overrides; defaults to 0.0.0.0:3000, logLevel 'info'.
   */
  constructor(opts?: { host?: string; port?: number; logLevel?: string }) {
    this.host = opts?.host ?? '0.0.0.0';
    this.port = opts?.port ?? parseInt(process.env['PORT'] ?? '3000', 10);
    this.logLevel = (opts?.logLevel ?? 'info').toLowerCase();
    setGlobalLogLevel(this.logLevel as 'debug' | 'info' | 'warn' | 'error');
    this._app = new Hono();

    // Security headers
    this._app.use('*', async (c, next) => {
      await next();
      c.res.headers.set('X-Content-Type-Options', 'nosniff');
      c.res.headers.set('X-Frame-Options', 'DENY');
      c.res.headers.set('X-XSS-Protection', '1; mode=block');
      c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      c.res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    });

    // CORS (configurable via env)
    const corsOrigins = process.env['SWML_CORS_ORIGINS'];
    const corsOrigin = corsOrigins ? corsOrigins.split(',').map((o: string) => o.trim()) : '*';
    const corsCredentials = corsOrigin !== '*';
    this._app.use('*', cors({ origin: corsOrigin, credentials: corsCredentials }));

    // Global health endpoints
    this._app.get('/health', (c) => c.json({ status: 'ok' }));
    this._app.get('/ready', (c) => c.json({ status: 'ready' }));
  }

  /**
   * Register an agent at the given route prefix.
   * @param agent - The AgentBase instance to mount.
   * @param route - Route prefix; defaults to the agent's own route or '/'.
   * @throws If the route is already occupied by another agent.
   */
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

    this.log.info(`Registered '${agent.name}' at ${r}`);

    // If SIP routing is enabled, configure the newly registered agent
    if (this._sipRoutingEnabled && this._sipRoute) {
      if (this._sipAutoMap) {
        this._autoMapAgentSipUsernames(agent, r);
      }
      agent.enableSipRouting(this._sipAutoMap, this._sipRoute);
    }

    // Apply any global routing callbacks registered before this agent was added
    for (const { callbackFn, path } of this._globalRoutingCallbacks) {
      agent.registerRoutingCallback(callbackFn, path);
    }
  }

  /**
   * Remove an agent registration by route.
   * @param route - The route prefix to unregister.
   * @returns True if the agent was found and removed, false if not found.
   */
  unregister(route: string): boolean {
    // Note: Hono doesn't support dynamic route removal,
    // but the agent won't be listed anymore
    return this.agents.delete(route);
  }

  /**
   * Get all registered agents keyed by their route prefix.
   * @returns A map of route prefixes to AgentBase instances.
   */
  getAgents(): Map<string, AgentBase> {
    return this.agents;
  }

  /**
   * Look up a registered agent by its route prefix.
   * @param route - The route prefix to look up.
   * @returns The agent at that route, or undefined if none is registered.
   */
  getAgent(route: string): AgentBase | undefined {
    return this.agents.get(route);
  }

  /**
   * Serve static files from a local directory under a given route prefix.
   * Includes path traversal protection (rejects `..`), MIME type detection,
   * and security headers (Cache-Control, X-Content-Type-Options).
   * @param directory - Absolute or relative path to the directory to serve.
   * @param route - Route prefix for static files (defaults to '/').
   */
  serveStaticFiles(directory: string, route = '/'): void {
    const baseDir = resolve(directory);
    const routePrefix = route.replace(/\/+$/, '') || '/';

    this._app.get(`${routePrefix}/*`, async (c) => {
      const requestedPath = c.req.path.slice(routePrefix.length);

      // Path traversal protection: reject any path containing ".."
      if (requestedPath.includes('..')) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      const normalizedPath = normalize(requestedPath);
      // Double-check the resolved path is within the base directory
      const fullPath = resolve(join(baseDir, normalizedPath));
      if (!fullPath.startsWith(baseDir)) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      try {
        const fileStat = await stat(fullPath);
        if (!fileStat.isFile()) {
          return c.json({ error: 'Not found' }, 404);
        }

        const content = await readFile(fullPath);
        const ext = extname(fullPath).toLowerCase();
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

        c.header('Content-Type', contentType);
        c.header('X-Content-Type-Options', 'nosniff');
        c.header('Cache-Control', 'public, max-age=3600');

        return c.body(content);
      } catch {
        return c.json({ error: 'Not found' }, 404);
      }
    });

    this.log.info(`Serving static files from ${baseDir} at ${routePrefix}/*`);
  }

  /**
   * Set up central SIP-based routing for the server.
   *
   * This configures all agents to handle SIP requests at the specified path,
   * using a coordinated routing system where each agent checks if it can
   * handle SIP requests for specific usernames.
   *
   * @param route - The path for SIP routing (default: '/sip').
   * @param autoMap - Whether to automatically map SIP usernames to agent routes (default: true).
   */
  setupSipRouting(route = '/sip', autoMap = true): void {
    if (this._sipRoutingEnabled) {
      this.log.warn('SIP routing is already enabled');
      return;
    }

    // Normalize the route
    let r = route;
    if (!r.startsWith('/')) r = `/${r}`;
    r = r.replace(/\/+$/, '') || '/sip';

    this._sipRoutingEnabled = true;
    this._sipRoute = r;
    this._sipAutoMap = autoMap;

    // Auto-map existing agents
    if (autoMap) {
      for (const [agentRoute, agent] of this.agents) {
        this._autoMapAgentSipUsernames(agent, agentRoute);
      }
    }

    // Create a unified routing callback
    const serverSipRoutingCallback = (_req: Request, body: Record<string, unknown>): string | undefined => {
      const sipUsername = AgentBase.extractSipUsername(body);
      if (sipUsername) {
        this.log.info(`Extracted SIP username: ${sipUsername}`);
        const targetRoute = this._sipUsernameMapping.get(sipUsername.toLowerCase());
        if (targetRoute) {
          this.log.info(`Routing SIP request to ${targetRoute}`);
          return targetRoute;
        }
        this.log.warn(`No route found for SIP username: ${sipUsername}`);
      }
      return undefined;
    };

    this._sipRoutingCallback = serverSipRoutingCallback;

    // Register this callback with each agent via enableSipRouting
    for (const agent of this.agents.values()) {
      agent.enableSipRouting(autoMap, r);
    }

    this.log.info(`SIP routing enabled at ${r} on all agents`);
  }

  /**
   * Register a routing callback across all agents at the given path.
   *
   * This allows unified routing logic to be applied to all agents from
   * a central server-level coordinator.
   *
   * @param callbackFn - The callback function that receives a request and body, returning a route string or undefined.
   * @param path - The path to register the callback at.
   */
  registerGlobalRoutingCallback(
    callbackFn: RoutingCallback,
    path: string,
  ): void {
    // Normalize path: ensure leading slash, strip trailing slash
    let p = path;
    if (!p.startsWith('/')) p = `/${p}`;
    p = p.replace(/\/+$/, '') || '/';

    // Store so agents registered after this call also receive the callback
    this._globalRoutingCallbacks.push({ callbackFn, path: p });

    // Register with all currently registered agents
    for (const agent of this.agents.values()) {
      agent.registerRoutingCallback(callbackFn, p);
    }

    this.log.info(`Registered global routing callback at ${p} on all agents`);
  }

  /**
   * Auto-map SIP usernames for an agent based on name and route.
   */
  private _autoMapAgentSipUsernames(agent: AgentBase, route: string): void {
    const agentName = agent.name.toLowerCase();
    const cleanName = agentName.replace(/[^a-z0-9_]/g, '');

    if (cleanName) {
      this._sipUsernameMapping.set(cleanName, route);
      this.log.info(`Registered SIP username '${cleanName}' to route '${route}'`);
    }

    if (route) {
      const routePart = route.split('/').pop() ?? '';
      const cleanRoute = routePart.replace(/[^a-z0-9_]/g, '');
      if (cleanRoute && cleanRoute !== cleanName) {
        this._sipUsernameMapping.set(cleanRoute, route);
        this.log.info(`Registered SIP username '${cleanRoute}' to route '${route}'`);
      }
    }
  }

  /**
   * Build and return the Hono application with all registered agents and a root listing endpoint.
   * @returns The fully configured Hono app.
   */
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

  /**
   * Start the HTTP server and begin listening for requests.
   *
   * This method handles server mode only. For serverless deployments
   * (AWS Lambda, Google Cloud Functions, Azure Functions), use
   * {@link ServerlessAdapter} instead.
   *
   * @param host - Override the configured hostname.
   * @param port - Override the configured port.
   */
  async run(host?: string, port?: number): Promise<void> {
    // When loaded by the CLI tool, skip server startup — only the agent config is needed.
    if (process.env['SWAIG_CLI_MODE'] === 'true') return;

    const { serve } = await import('@hono/node-server');
    const h = host ?? this.host;
    const p = port ?? this.port;

    const app = this.getApp();

    if (this.agents.size === 0) {
      this.log.warn('starting_server_with_no_agents');
    }

    this.log.info(`Starting on http://${h}:${p}`);
    for (const [route, agent] of this.agents) {
      const [user] = agent.getBasicAuthCredentials();
      this.log.info(`  ${route} -> ${agent.name} (auth: ${user}:****)`);
    }

    serve({ fetch: app.fetch, port: p, hostname: h });
  }
}
