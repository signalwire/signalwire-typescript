/**
 * AgentServer - Hosts multiple AgentBase instances under a single HTTP server.
 *
 * Each agent is mounted at its own route prefix. The root `/` lists all
 * registered agents, and `/health` + `/ready` are global health checks.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getPathNoStrict } from 'hono/utils/url';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { AgentBase, type RoutingCallback } from './AgentBase.js';
import type { Server as NodeServer } from 'node:http';
import { getLogger, setGlobalLogLevel } from './Logger.js';
import { SslConfig } from './SslConfig.js';

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

/**
 * Multi-agent HTTP server that hosts multiple AgentBase instances on distinct route prefixes.
 *
 * Use `AgentServer` when one process should serve more than one agent — each with its own
 * prompt, tools, and route. Internally, each agent's Hono router is mounted under its own
 * path. Static assets can also be served from a configured directory.
 *
 * @example Host two agents on one port
 * ```ts
 * import { AgentServer, AgentBase } from '@signalwire/sdk';
 *
 * const salesAgent = new AgentBase({ name: 'sales', route: '/sales' });
 * const supportAgent = new AgentBase({ name: 'support', route: '/support' });
 *
 * const server = new AgentServer({ host: '0.0.0.0', port: 3000 });
 * server.register(salesAgent);
 * server.register(supportAgent);
 *
 * await server.run();
 * ```
 *
 * @see {@link AgentBase}
 */
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
  /** @internal The server `run()` started, or null. */
  _server: NodeServer | null = null;

  // SIP routing state
  private _sipRoutingEnabled = false;
  private _sipRoute: string | null = null;
  private _sipAutoMap = false;
  private _sipUsernameMapping: Map<string, string> = new Map();
  private _sipRoutingCallback: RoutingCallback | null = null;

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
    // swaig-test sets its own log level before loading a file; leave it.
    if (process.env['SWAIG_CLI_MODE'] !== 'true') {
      setGlobalLogLevel(this.logLevel as 'debug' | 'info' | 'warn' | 'error');
    }
    // Match paths without regard to a trailing slash or repeated slashes, as
    // an agent's own app does, so a mounted agent answers /route/swaig/ too.
    // (Hono ignores a custom getPath when `strict: false` is passed.)
    this._app = new Hono({
      getPath: (req: Request) => getPathNoStrict(req).replace(/\/{2,}/g, '/'),
    });

    // Security headers. A path an agent serves through mount() (a chat
    // gateway, say) sets its own headers and answers its own CORS preflights.
    this._app.use('*', async (c, next) => {
      const mounted = this._servedByMount(c.req.path, c.req.method);
      await next();
      if (mounted) return;
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
    const corsMw = cors({ origin: corsOrigin, credentials: corsCredentials });
    this._app.use('*', (c, next) =>
      this._servedByMount(c.req.path, c.req.method) ? next() : corsMw(c, next),
    );

    // Global health endpoints
    this._app.get('/health', (c) => c.json({ status: 'ok' }));
    this._app.get('/ready', (c) => c.json({ status: 'ready' }));
  }

  /** Whether a path belongs to an app one of the served agents added with mount(). */
  private _servedByMount(path: string, method: string): boolean {
    const normalized = path.replace(/\/{2,}/g, '/');
    for (const [route, agent] of this.agents) {
      const base = route === '/' ? '' : route.replace(/\/+$/, '');
      if (base && normalized !== base && !normalized.startsWith(`${base}/`)) continue;
      if (agent._servedByMount(normalized.slice(base.length) || '/', method)) return true;
    }
    return false;
  }

  /**
   * Register an agent at the given route prefix.
   * @param agent - The AgentBase instance to mount.
   * @param route - Route prefix; defaults to the agent's own route or '/'.
   * @throws If the route is already occupied by another agent.
   */
  register(agent: AgentBase, route?: string): void {
    let r = route ?? agent.route ?? '/';
    if (!r.startsWith('/')) r = `/${r}`;
    r = r.replace(/\/+$/, '') || '/';

    if (this.agents.has(r)) {
      throw new Error(`Route '${r}' is already in use`);
    }

    this.agents.set(r, agent);

    // Register routing callbacks on the agent BEFORE building/mounting its Hono
    // app. `registerRoutingCallback` rebuilds the agent's app so its `/sip` (and
    // any global) route is present; mounting via `app.route()` snapshots the
    // sub-app's routes at mount time, so a callback registered AFTER the mount
    // would be invisible on the served path.

    // If SIP routing is enabled, configure the newly registered agent: map its
    // usernames into the server mapping and register the unified server
    // callback at the SIP route (mirrors Python register_agent:154-159).
    if (this._sipRoutingEnabled && this._sipRoute) {
      if (this._sipAutoMap) {
        this._autoMapAgentSipUsernames(agent, r);
      }
      if (this._sipRoutingCallback) {
        agent.registerRoutingCallback(this._sipRoutingCallback, this._sipRoute);
      }
    }

    // Apply any global routing callbacks registered before this agent was added
    for (const { callbackFn, path } of this._globalRoutingCallbacks) {
      agent.registerRoutingCallback(callbackFn, path);
    }

    // Mount the agent's (now fully-wired) route-relative router at the route
    // prefix. getApp() would serve the routes under the agent's own route
    // already, so mounting it here served them twice over (/sales/sales).
    this._app.route(r, agent.asRouter());

    this.log.info(`Registered '${agent.name}' at ${r}`);
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

    // Create a unified routing callback that checks all registered usernames
    // across every agent and returns the target agent's route on a match. The
    // framework-free `(body, headers)` shape matches RoutingCallback; only the
    // body is read. Mirrors Python `server_sip_routing_callback`
    // (agent_server.py:195-214): a matched username returns the target route so
    // handleRequest issues a real 307 redirect, cross-agent.
    const serverSipRoutingCallback: RoutingCallback = (body) => {
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
      // No routing needed (the addressed agent handles it itself).
      return null;
    };

    this._sipRoutingCallback = serverSipRoutingCallback;

    // Register this unified callback on every agent at the SIP route. Mirrors
    // Python (agent_server.py:220-222) which registers the SERVER callback on
    // each agent — NOT the per-agent enable_sip_routing callback — so a SIP
    // request to any agent's /sip is redirected to whichever agent owns the
    // username. registerRoutingCallback rebuilds each agent's Hono app to add
    // the `/sip` route, so re-mount the (already-registered) agents' apps into
    // the server so the new route is reachable on the served path.
    for (const [agentRoute, agent] of this.agents) {
      agent.registerRoutingCallback(serverSipRoutingCallback, r);
      const agentApp = agent.getApp();
      if (agentRoute === '/') {
        this._app.route('/', agentApp);
      } else {
        this._app.route(agentRoute, agentApp);
      }
    }

    this.log.info(`SIP routing enabled at ${r} on all agents`);
  }

  /**
   * Register a mapping from a SIP username to an agent route at the server level.
   *
   * Allows callers to manually route an arbitrary SIP username to any already-registered
   * agent route, independent of the automatic mapping performed by `setupSipRouting`.
   *
   * @param username - The SIP username to map (stored lowercase).
   * @param route - The agent route to map the username to (leading `/` added if missing; trailing slashes stripped).
   */
  registerSipUsername(username: string, route: string): void {
    if (!this._sipRoutingEnabled) {
      this.log.warn('SIP routing is not enabled. Call setupSipRouting() first.');
      return;
    }

    // Normalize route: ensure leading slash, strip trailing slashes
    let r = route.startsWith('/') ? route : `/${route}`;
    r = r.replace(/\/+$/, '');

    // Warn if the target route has no registered agent
    if (!this.agents.has(r)) {
      this.log.warn(`Route '${r}' not found. SIP username will be registered but may not work.`);
    }

    this._sipUsernameMapping.set(username.toLowerCase(), r);
    this.log.info(`Registered SIP username '${username}' to route '${r}'`);
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
  registerGlobalRoutingCallback(callbackFn: RoutingCallback, path: string): void {
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
    // Add the root listing once (after the agents, so it doesn't shadow one
    // mounted at /). It lists the agents registered when it's requested.
    // Adding it on every call threw once the app had served a request, since
    // Hono can't add a route after its matcher is built.
    if (!this._rootListingAdded && !this.agents.has('/')) {
      this._rootListingAdded = true;
      this._app.get('/', (c) =>
        c.json({
          service: 'SignalWire AI Agents',
          agents: [...this.agents.entries()].map(([route, agent]) => ({
            name: agent.name,
            route,
          })),
        }),
      );
    }

    return this._app;
  }

  /** Whether {@link getApp} has added the root listing route. */
  private _rootListingAdded = false;

  /**
   * Start the HTTP server and begin listening for requests.
   *
   * This method handles server mode only. For serverless deployments
   * (AWS Lambda, Google Cloud Functions, Azure Functions), use
   * {@link ServerlessAdapter} instead. When `SWAIG_CLI_MODE=true` is set in
   * the environment, the call is a no-op so agent config can be inspected
   * without starting a server.
   *
   * @param host - Override the configured hostname. Defaults to the
   *   constructor value.
   * @param port - Override the configured port. Defaults to the constructor
   *   value.
   * @returns Resolves once the underlying Hono server has begun listening.
   */
  async run(host?: string, port?: number): Promise<void> {
    // When loaded by the CLI tool, skip server startup — only the agent config is needed.
    if (process.env['SWAIG_CLI_MODE'] === 'true') return;

    const h = host ?? this.host;
    const p = port ?? this.port;

    const app = this.getApp();

    if (this.agents.size === 0) {
      this.log.warn('starting_server_with_no_agents');
    }

    // HTTPS from SWML_SSL_ENABLED, SWML_SSL_CERT_PATH and SWML_SSL_KEY_PATH,
    // as the reference's run() reads them; a missing file falls back to HTTP.
    const ssl = new SslConfig();
    if (ssl.enabled && !ssl.isConfigured()) {
      this.log.warn(
        `SSL is enabled but the certificate or key isn't found (${ssl.certPath ?? 'no cert'}, ${ssl.keyPath ?? 'no key'}); serving HTTP`,
      );
    }
    const serverOptions = ssl.isConfigured() ? ssl.getServerOptions() : null;

    this.log.info(`Starting on ${serverOptions ? 'https' : 'http'}://${h}:${p}`);
    for (const [route, agent] of this.agents) {
      const [user] = agent.getBasicAuthCredentials();
      this.log.info(`  ${route} -> ${agent.name} (auth: ${user}:****)`);
    }

    if (serverOptions) {
      const { createServer } = await import('node:https');
      const { getRequestListener } = await import('@hono/node-server');
      const server = createServer(serverOptions, getRequestListener(app.fetch));
      server.listen(p, h);
      this._server = server;
    } else {
      const { serve } = await import('@hono/node-server');
      this._server = serve({ fetch: app.fetch, port: p, hostname: h }) as unknown as NodeServer;
    }
  }
}
