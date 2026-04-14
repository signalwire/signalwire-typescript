/**
 * SWMLService - Lightweight HTTP service for non-AI SWML documents.
 *
 * Unlike AgentBase (which always produces an AI block), SWMLService generates
 * pure SWML call-flow documents: IVR menus, voicemail, call recording, etc.
 * Uses SwmlBuilder for verb methods and Hono for HTTP serving.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { basicAuth } from 'hono/basic-auth';
import { randomBytes } from 'node:crypto';
import { SwmlBuilder } from './SwmlBuilder.js';
import { SchemaUtils } from './SchemaUtils.js';
import { SslConfig } from './SslConfig.js';
import { ConfigLoader } from './ConfigLoader.js';
import { getLogger, Logger } from './Logger.js';
import type { Server } from 'node:http';

// ── Verb handler interfaces ────────────────────────────────────────────

/**
 * Interface for custom SWML verb handlers.
 * Mirrors Python SDK's `SWMLVerbHandler` abstract base class.
 */
export interface SWMLVerbHandler {
  /** Return the verb name this handler manages. */
  getVerbName(): string;
  /** Validate a verb configuration. Returns [isValid, errorMessages]. */
  validateConfig(config: Record<string, unknown>): [boolean, string[]];
  /** Build a verb configuration from keyword arguments. */
  buildConfig(kwargs: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Registry for custom SWML verb handlers.
 * Mirrors Python SDK's `VerbHandlerRegistry`.
 */
export class VerbHandlerRegistry {
  private handlers = new Map<string, SWMLVerbHandler>();

  /** Register a custom verb handler. */
  registerHandler(handler: SWMLVerbHandler): void {
    this.handlers.set(handler.getVerbName(), handler);
  }

  /** Get the handler for a specific verb, or undefined if none registered. */
  getHandler(verbName: string): SWMLVerbHandler | undefined {
    return this.handlers.get(verbName);
  }

  /** Check whether a handler exists for the given verb. */
  hasHandler(verbName: string): boolean {
    return this.handlers.has(verbName);
  }
}

// ── Security config ────────────────────────────────────────────────────

/**
 * Unified security configuration.
 * Mirrors Python SDK's `SecurityConfig` — reads from env vars and optional config file.
 */
export class SecurityConfig {
  /** Whether SSL is enabled. */
  sslEnabled: boolean;
  /** Filesystem path to the PEM certificate. */
  sslCertPath: string | null;
  /** Filesystem path to the PEM private key. */
  sslKeyPath: string | null;
  /** Domain name for SSL. */
  domain: string | null;
  /** Basic auth username from config, or null. */
  basicAuthUser: string | null;
  /** Basic auth password from config, or null. */
  basicAuthPassword: string | null;

  private sslConfig: SslConfig;

  constructor(opts?: { configFile?: string; serviceName?: string }) {
    // Load SSL config from env vars / options
    this.sslConfig = new SslConfig();
    this.sslEnabled = this.sslConfig.enabled;
    this.sslCertPath = this.sslConfig.certPath;
    this.sslKeyPath = this.sslConfig.keyPath;
    this.domain = this.sslConfig.domain;

    // Auth defaults from env vars
    this.basicAuthUser = process.env['SWML_BASIC_AUTH_USER'] ?? null;
    this.basicAuthPassword = process.env['SWML_BASIC_AUTH_PASSWORD'] ?? null;

    // Load from config file if available
    if (opts?.configFile) {
      this.loadFromConfigFile(opts.configFile);
    }
  }

  private loadFromConfigFile(filePath: string): void {
    try {
      const loader = new ConfigLoader(filePath);
      const ssl = loader.get('security.ssl') as Record<string, unknown> | undefined;
      if (ssl) {
        if (ssl['enabled'] !== undefined) this.sslEnabled = !!ssl['enabled'];
        if (typeof ssl['certPath'] === 'string') this.sslCertPath = ssl['certPath'];
        if (typeof ssl['keyPath'] === 'string') this.sslKeyPath = ssl['keyPath'];
        if (typeof ssl['domain'] === 'string') this.domain = ssl['domain'];
      }
      const auth = loader.get('security.basicAuth') as Record<string, unknown> | undefined;
      if (auth) {
        if (typeof auth['user'] === 'string') this.basicAuthUser = auth['user'];
        if (typeof auth['password'] === 'string') this.basicAuthPassword = auth['password'];
      }
    } catch {
      // Config file load failures are non-fatal
    }
  }

  /** Get basic auth credentials from security config, or null if not configured. */
  getBasicAuth(): [string, string] | null {
    if (this.basicAuthUser && this.basicAuthPassword) {
      return [this.basicAuthUser, this.basicAuthPassword];
    }
    return null;
  }

  /** Validate that SSL cert and key files are present when SSL is enabled. */
  validateSslConfig(): [boolean, string | null] {
    if (!this.sslEnabled) return [true, null];
    if (!this.sslCertPath) return [false, 'SSL cert path not configured'];
    if (!this.sslKeyPath) return [false, 'SSL key path not configured'];
    return this.sslConfig.isConfigured() ? [true, null] : [false, 'SSL cert or key file not found'];
  }
}

// ── Callback type ──────────────────────────────────────────────────────

/** Callback invoked per-request to dynamically build SWML. */
export type OnRequestCallback = (
  queryParams: Record<string, string>,
  bodyParams: Record<string, unknown>,
  headers: Record<string, string>,
) => SwmlBuilder | Promise<SwmlBuilder>;

// RoutingCallback is owned by AgentBase.ts; SWMLService uses a structurally
// compatible local alias to avoid an import cycle and stay independent.
type RoutingCallback = (
  requestBody: Record<string, unknown>,
) => string | null | undefined | Promise<string | null | undefined>;

// ── Options ────────────────────────────────────────────────────────────

/** Configuration options for SWMLService. */
export interface SWMLServiceOptions {
  /**
   * Service display name.
   * Required to match Python SDK where `name` is a positional required parameter.
   */
  name: string;
  /** HTTP route path (default '/'). */
  route?: string;
  /** Host to bind the web server to (default '0.0.0.0'). */
  host?: string;
  /** Port to bind the web server to (default PORT env var or 3000). */
  port?: number;
  /** Basic auth credentials as [username, password]. */
  basicAuth?: [string, string];
  /** Path to a JSON Schema file for verb validation. */
  schemaPath?: string;
  /** Path to a security configuration file. */
  configFile?: string;
  /** Enable schema validation (default true). Can also be disabled via SWML_SKIP_SCHEMA_VALIDATION=true. */
  schemaValidation?: boolean;
}

// ── SWMLService class ──────────────────────────────────────────────────

/** HTTP service that serves non-AI SWML documents built from verb methods. */
export class SWMLService {
  /** Service display name. */
  readonly name: string;
  /** HTTP route path. */
  readonly route: string;
  /** Host the server binds to. */
  readonly host: string;
  /** Port the server binds to. */
  readonly port: number;

  /** Structured logger, exposed for subclass access. Mirrors Python's public `self.log`. */
  readonly log: Logger;

  /** Unified security configuration. Mirrors Python's `self.security`. */
  readonly security: SecurityConfig;
  /** Whether SSL is enabled. Mirrors Python's `self.ssl_enabled`. */
  readonly sslEnabled: boolean;
  /** Domain name for SSL. Mirrors Python's `self.domain`. */
  readonly domain: string | undefined;
  /** Path to SSL certificate. Mirrors Python's `self.ssl_cert_path`. */
  readonly sslCertPath: string | undefined;
  /** Path to SSL private key. Mirrors Python's `self.ssl_key_path`. */
  readonly sslKeyPath: string | undefined;

  /** Schema validation utilities. Mirrors Python's `self.schema_utils`. */
  readonly schemaUtils: SchemaUtils;
  /** Custom verb handler registry. Mirrors Python's `self.verb_registry`. */
  readonly verbRegistry: VerbHandlerRegistry;

  private swmlBuilder: SwmlBuilder;
  private _app: Hono;
  private _server: Server | null = null;
  private onRequestCallback?: OnRequestCallback;
  private authCredentials?: [string, string];
  private authSource: 'provided' | 'environment' | 'auto-generated' = 'auto-generated';
  private _proxyUrlBase: string | null = process.env['SWML_PROXY_URL_BASE'] ?? null;
  private _proxyUrlBaseFromEnv = !!process.env['SWML_PROXY_URL_BASE'];
  private _routingCallbacks = new Map<string, RoutingCallback>();

  constructor(opts: SWMLServiceOptions);
  /** @deprecated Prefer passing an options object with a required `name`. The no-arg form defaults name to 'swml-service'. */
  constructor(opts?: Partial<SWMLServiceOptions>);
  constructor(opts?: Partial<SWMLServiceOptions>) {
    this.name = opts?.name ?? 'swml-service';
    this.route = opts?.route ?? '/';
    this.host = opts?.host ?? '0.0.0.0';
    this.port = opts?.port ?? parseInt(process.env['PORT'] ?? '3000', 10);

    // Logger — public to match Python's `self.log`
    this.log = getLogger('SWMLService');

    // Security configuration
    this.security = new SecurityConfig({
      configFile: opts?.configFile,
      serviceName: this.name,
    });
    this.sslEnabled = this.security.sslEnabled;
    this.domain = this.security.domain ?? undefined;
    this.sslCertPath = this.security.sslCertPath ?? undefined;
    this.sslKeyPath = this.security.sslKeyPath ?? undefined;

    // Schema utils — pass through schemaPath so callers can supply a custom schema file.
    // Mirrors Python's SchemaUtils(schema_path, schema_validation=...) call in SWMLService.__init__.
    const skipValidation = opts?.schemaValidation === false || process.env['SWML_SKIP_SCHEMA_VALIDATION'] === 'true';
    this.schemaUtils = new SchemaUtils({
      skipValidation,
      ...(opts?.schemaPath !== undefined ? { schemaPath: opts.schemaPath } : {}),
    });

    // Verb handler registry
    this.verbRegistry = new VerbHandlerRegistry();

    // Auth resolution: provided > env > security config > generated
    // Track whether auth was explicitly provided (enforced on HTTP) vs auto-generated (available but not enforced)
    let enforceAuth = false;
    if (opts?.basicAuth) {
      this.authCredentials = opts.basicAuth;
      this.authSource = 'provided';
      enforceAuth = true;
    } else {
      const envUser = process.env['SWML_BASIC_AUTH_USER'];
      const envPass = process.env['SWML_BASIC_AUTH_PASSWORD'];
      if (envUser && envPass) {
        this.authCredentials = [envUser, envPass];
        this.authSource = 'environment';
        enforceAuth = true;
      } else {
        const fromConfig = this.security.getBasicAuth();
        if (fromConfig) {
          this.authCredentials = fromConfig;
          this.authSource = 'environment';
          enforceAuth = true;
        } else {
          // Auto-generate credentials like AgentBase does
          const username = this.name.replace(/[^a-zA-Z0-9_-]/g, '_');
          this.authCredentials = [username, randomBytes(16).toString('hex')];
          this.authSource = 'auto-generated';
          // Not enforced on HTTP — available via getBasicAuthCredentials()
        }
      }
    }

    this.swmlBuilder = new SwmlBuilder();
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

    // CORS — credentials only when origin is explicitly configured (wildcard + credentials violates spec)
    const corsOrigins = process.env['SWML_CORS_ORIGINS'];
    const corsOrigin = corsOrigins ? corsOrigins.split(',').map((o: string) => o.trim()) : '*';
    const corsCredentials = corsOrigin !== '*';
    this._app.use('*', cors({ origin: corsOrigin, credentials: corsCredentials }));

    // Basic auth — only enforced when explicitly provided or from env, not auto-generated
    if (enforceAuth && this.authCredentials) {
      const [user, pass] = this.authCredentials;
      this._app.use('*', basicAuth({ username: user, password: pass }));
    }

    // Health endpoints
    this._app.get('/health', (c) => c.json({ status: 'ok' }));
    this._app.get('/ready', (c) => c.json({ status: 'ready' }));

    // Main SWML endpoint — serves on both GET and POST
    const handler = async (c: any) => {
      let doc: Record<string, unknown>;

      if (this.onRequestCallback) {
        const url = new URL(c.req.url);
        const queryParams: Record<string, string> = {};
        url.searchParams.forEach((v, k) => { queryParams[k] = v; });

        let bodyParams: Record<string, unknown> = {};
        if (c.req.method === 'POST') {
          try {
            bodyParams = await c.req.json();
          } catch {
            // empty body is fine
          }
        }

        const headers: Record<string, string> = {};
        c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v; });

        const builder = await this.onRequestCallback(queryParams, bodyParams, headers);
        doc = builder.getDocument();
      } else {
        doc = this.swmlBuilder.getDocument();
      }

      return c.json(doc);
    };

    const routePath = this.route === '/' ? '/' : this.route;
    this._app.get(routePath, handler);
    this._app.post(routePath, handler);

    // Register routing callback endpoints dynamically in getApp/run
  }

  // ── Properties (getters) ─────────────────────────────────────────────

  /**
   * Check if full JSON Schema validation is enabled.
   * Mirrors Python's `@property full_validation_enabled`.
   * @returns True if schema-based verb validation is active.
   */
  get fullValidationEnabled(): boolean {
    // SchemaUtils in TS doesn't expose a direct 'full_validation_available' flag,
    // but if the schema was loaded and validation is not skipped, it's available.
    // We check by attempting to see if schema has verbs loaded.
    try {
      return this.schemaUtils.getVerbNames().length > 0;
    } catch {
      return false;
    }
  }

  // ── SwmlBuilder delegation ────────────────────────────────────────

  /**
   * Get the underlying SwmlBuilder for direct manipulation.
   * @returns The SwmlBuilder instance.
   */
  getBuilder(): SwmlBuilder {
    return this.swmlBuilder;
  }

  /**
   * Add a verb to the SWML document.
   * @param name - Verb name (e.g., 'answer', 'play', 'hangup').
   * @param config - Verb configuration.
   * @returns This service for chaining.
   */
  addVerb(name: string, config: unknown): this {
    this.swmlBuilder.addVerb(name, config);
    return this;
  }

  /**
   * Add a new named section to the SWML document.
   * Mirrors Python's `add_section()`.
   * @param sectionName - Name of the section to create.
   * @returns This service for chaining.
   */
  addSection(sectionName: string): this {
    const doc = this.swmlBuilder.getDocument() as { sections: Record<string, unknown[]> };
    if (!(sectionName in doc.sections)) {
      doc.sections[sectionName] = [];
    }
    return this;
  }

  /**
   * Add a verb to a specific named section.
   * Mirrors Python's `add_verb_to_section()`.
   * @param sectionName - Target section name (auto-created if missing).
   * @param verbName - Verb name.
   * @param config - Verb configuration.
   * @returns This service for chaining.
   */
  addVerbToSection(sectionName: string, verbName: string, config: unknown): this {
    this.swmlBuilder.addVerbToSection(sectionName, verbName, config);
    return this;
  }

  /**
   * Reset the SWML document to an empty state.
   * Mirrors Python's `reset_document()`.
   * @returns This service for chaining.
   */
  resetDocument(): this {
    this.swmlBuilder.reset();
    return this;
  }

  /**
   * Render the SWML document as a JSON object.
   * @returns The SWML document.
   */
  renderSwml(): Record<string, unknown> {
    return this.swmlBuilder.getDocument();
  }

  /**
   * Get the SWML document as a dictionary.
   * Alias for `renderSwml()` that matches Python's `get_document()` name.
   * @returns The SWML document.
   */
  getDocument(): Record<string, unknown> {
    return this.swmlBuilder.getDocument();
  }

  /**
   * Render the SWML document as a JSON string.
   * Mirrors Python's `render_document()`.
   * @returns JSON-encoded SWML document.
   */
  renderDocument(): string {
    return this.swmlBuilder.renderDocument();
  }

  // ── Verb handler registration ────────────────────────────────────────

  /**
   * Register a custom verb handler.
   * Mirrors Python's `register_verb_handler()`.
   * @param handler - The verb handler to register.
   */
  registerVerbHandler(handler: SWMLVerbHandler): void {
    this.verbRegistry.registerHandler(handler);
  }

  // ── Routing callbacks ────────────────────────────────────────────────

  /**
   * Register a routing callback at a given path.
   * When a POST request arrives at `path`, the callback is invoked with the
   * parsed request body. If it returns a string, the response is a 307 redirect
   * to that route; if it returns null, normal SWML serving continues.
   * Mirrors Python's `register_routing_callback()`.
   *
   * @param callbackFn - Callback receiving the request body and returning a route or null.
   * @param path - HTTP path for the callback (default '/sip').
   */
  registerRoutingCallback(
    callbackFn: RoutingCallback,
    path: string = '/sip',
  ): void {
    // Normalize: ensure leading /, strip trailing /
    let normalized = path.replace(/\/+$/, '');
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    this.log.info(`Registering routing callback at ${normalized}`);
    this._routingCallbacks.set(normalized, callbackFn);

    // Install an endpoint on the Hono app for this callback path
    const routeHandler = async (c: any) => {
      let body: Record<string, unknown> = {};
      if (c.req.method === 'POST') {
        try {
          body = await c.req.json();
        } catch {
          // empty body
        }
      }

      const route = callbackFn(body);
      if (route !== null) {
        return c.redirect(route, 307);
      }

      // No redirect — serve normal SWML
      const doc = this.swmlBuilder.getDocument();
      return c.json(doc);
    };

    this._app.get(normalized, routeHandler);
    this._app.post(normalized, routeHandler);
  }

  // ── Static utilities ─────────────────────────────────────────────────

  /**
   * Extract the SIP username from a request body's call.to field.
   * Mirrors Python's `@staticmethod extract_sip_username()`.
   * @param requestBody - The parsed request body containing call information.
   * @returns The extracted SIP username, or null if not found.
   */
  static extractSipUsername(requestBody: Record<string, unknown>): string | null {
    try {
      const call = requestBody?.['call'] as Record<string, unknown> | undefined;
      const toField = call?.['to'] as string | undefined;
      if (!toField) return null;

      // Handle SIP URIs like "sip:username@domain" or "sips:username@domain"
      if (toField.startsWith('sip:') || toField.startsWith('sips:')) {
        let uri = toField.replace(/^sips?:/, '');
        const atIdx = uri.indexOf('@');
        if (atIdx > 0) return uri.substring(0, atIdx);
        return uri;
      }
      // Handle TEL URIs like "tel:+1234567890"
      if (toField.startsWith('tel:')) {
        return toField.substring(4);
      }
      // Otherwise return the whole 'to' field
      return toField;
    } catch {
      return null;
    }
  }

  // ── Dynamic request callback ──────────────────────────────────────

  /**
   * Set a callback invoked per-request to dynamically build SWML.
   * When set, the static SwmlBuilder is ignored and the callback's
   * returned SwmlBuilder is used instead.
   * @param cb - Callback receiving query params, body params, and headers.
   * @returns This service for chaining.
   */
  setOnRequestCallback(cb: OnRequestCallback): this {
    this.onRequestCallback = cb;
    return this;
  }

  // ── Auth ──────────────────────────────────────────────────────────

  /**
   * Get the basic-auth credentials used by this service.
   * Mirrors Python's `get_basic_auth_credentials()`.
   * @param includeSource - When true, a third element indicating the credential source is appended.
   * @returns A tuple of [username, password] or [username, password, source].
   */
  getBasicAuthCredentials(includeSource?: false): [string, string];
  getBasicAuthCredentials(includeSource: true): [string, string, 'provided' | 'environment' | 'auto-generated'];
  getBasicAuthCredentials(includeSource?: boolean): [string, string] | [string, string, 'provided' | 'environment' | 'auto-generated'] {
    const creds = this.authCredentials ?? ['', ''];
    if (includeSource) return [...creds, this.authSource];
    return creds;
  }

  // ── Proxy ─────────────────────────────────────────────────────────

  /**
   * Manually set the proxy base URL used for webhook URL generation.
   * Mirrors Python's `manual_set_proxy_url()`.
   * @param url - The external-facing base URL (trailing slashes are stripped).
   * @returns This service for chaining.
   */
  manualSetProxyUrl(url: string): this {
    if (url) {
      this._proxyUrlBase = url.replace(/\/+$/, '');
      this._proxyUrlBaseFromEnv = false;
      this.log.info(`Proxy URL manually set to ${this._proxyUrlBase}`);
    }
    return this;
  }

  // ── HTTP ──────────────────────────────────────────────────────────

  /**
   * Get the Hono application for mounting or testing.
   * @returns The configured Hono app.
   */
  getApp(): Hono {
    return this._app;
  }

  /**
   * Start the HTTP server.
   * Matches Python's `serve()` parameters including SSL options.
   *
   * @param host - Hostname (default: this.host or '0.0.0.0').
   * @param port - Port (default: this.port or 3000).
   * @param opts - Optional SSL/TLS configuration overrides.
   */
  async run(
    host?: string,
    port?: number,
    opts?: {
      sslCert?: string;
      sslKey?: string;
      sslEnabled?: boolean;
      domain?: string;
    },
  ): Promise<void> {
    if (process.env['SWAIG_CLI_MODE'] === 'true') return;

    const h = host ?? this.host;
    const p = port ?? this.port;

    // Determine effective SSL state (param > instance > env)
    const effectiveSslEnabled = opts?.sslEnabled ?? this.sslEnabled;
    const effectiveSslCert = opts?.sslCert ?? this.sslCertPath;
    const effectiveSslKey = opts?.sslKey ?? this.sslKeyPath;

    if (effectiveSslEnabled && effectiveSslCert && effectiveSslKey) {
      // HTTPS mode
      const { readFileSync } = await import('node:fs');
      const { createServer } = await import('node:https');
      const { getRequestListener } = await import('@hono/node-server');

      const serverOpts = {
        cert: readFileSync(effectiveSslCert, 'utf-8'),
        key: readFileSync(effectiveSslKey, 'utf-8'),
      };

      this.log.info(`${this.name} starting on https://${h}:${p}${this.route} (SSL enabled)`);
      const listener = getRequestListener(this._app.fetch);
      this._server = createServer(serverOpts, listener) as unknown as Server;
      this._server.listen(p, h);
    } else {
      // HTTP mode
      const { serve } = await import('@hono/node-server');
      this.log.info(`${this.name} starting on http://${h}:${p}${this.route}`);
      this._server = serve({ fetch: this._app.fetch, port: p, hostname: h }) as unknown as Server;
    }
  }

  /**
   * Stop the HTTP server.
   * Mirrors Python's `stop()`.
   */
  stop(): void {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }
}
