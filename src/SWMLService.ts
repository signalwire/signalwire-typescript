/**
 * SWMLService - Lightweight HTTP service for non-AI SWML documents.
 *
 * Unlike AgentBase (which always produces an AI block), SWMLService generates
 * pure SWML call-flow documents: IVR menus, voicemail, call recording, etc.
 * Uses SwmlBuilder for verb methods and Hono for HTTP serving.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { HostAppRouter } from './web.js';
import { cors } from 'hono/cors';
import { basicAuth } from 'hono/basic-auth';
import { randomBytes } from 'node:crypto';
import { SwmlBuilder } from './SwmlBuilder.js';
import { SchemaUtils } from './SchemaUtils.js';
import { SslConfig } from './SslConfig.js';
import { ConfigLoader } from './ConfigLoader.js';
import { getLogger, Logger } from './Logger.js';
import { SwaigFunction, type SwaigFunctionOptions, type SwaigHandler } from './SwaigFunction.js';
import type { ToolParameters, ToolArgs } from './ParameterSchema.js';
import { FunctionResult } from './FunctionResult.js';
import type { SwmlRequestData } from './PlatformContracts.js';
import type { SwaigRequest } from './SwaigContracts.js';
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
  /** Allowed request hosts (`['*']` = allow all). */
  allowedHosts: string[];
  /** Allowed CORS origins. */
  corsOrigins: string[];
  /** Whether to emit an HSTS header on HTTPS responses. */
  useHsts: boolean;
  /** HSTS `max-age` in seconds. */
  hstsMaxAge: number;

  private sslConfig: SslConfig;

  constructor(opts?: { configFile?: string; serviceName?: string }) {
    // Load SSL config from env vars / options
    this.sslConfig = new SslConfig();
    this.sslEnabled = this.sslConfig.enabled;
    this.sslCertPath = this.sslConfig.certPath;
    this.sslKeyPath = this.sslConfig.keyPath;
    this.domain = this.sslConfig.domain;

    // Auth + host/CORS/HSTS defaults from env vars
    this.basicAuthUser = process.env['SWML_BASIC_AUTH_USER'] ?? null;
    this.basicAuthPassword = process.env['SWML_BASIC_AUTH_PASSWORD'] ?? null;
    this.allowedHosts = ['*'];
    this.corsOrigins = ['*'];
    this.useHsts = true;
    this.hstsMaxAge = 31536000;
    this.loadFromEnv();

    // Load from config file if available
    if (opts?.configFile) {
      this.loadFromConfigFile(opts.configFile);
    }
  }

  /** Split a comma-separated env value into a trimmed, non-empty list. */
  private static parseList(value: string | undefined): string[] | null {
    if (value === undefined) return null;
    const items = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return items.length > 0 ? items : null;
  }

  /**
   * (Re)load host/CORS/HSTS settings from environment variables. Mirrors Python
   * SDK's `SecurityConfig.load_from_env()`. SSL/auth are loaded in the constructor
   * from their own env vars; this refreshes the network-policy fields.
   */
  loadFromEnv(): void {
    const hosts = SecurityConfig.parseList(process.env['SWML_ALLOWED_HOSTS']);
    if (hosts) this.allowedHosts = hosts;
    const cors = SecurityConfig.parseList(process.env['SWML_CORS_ORIGINS']);
    if (cors) this.corsOrigins = cors;
    if (process.env['SWML_USE_HSTS'] !== undefined) {
      this.useHsts = process.env['SWML_USE_HSTS'] === 'true';
    }
    const maxAge = process.env['SWML_HSTS_MAX_AGE'];
    if (maxAge !== undefined && !Number.isNaN(Number(maxAge))) {
      this.hstsMaxAge = Number(maxAge);
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

  /**
   * Build the SSL parameters for the HTTPS server, as a plain dictionary of
   * primitive filesystem paths. Mirrors Python's
   * `SecurityConfig.get_ssl_context_kwargs()` verbatim: the reference targets
   * uvicorn's `ssl_certfile`/`ssl_keyfile` kwargs, and this returns the exact
   * same primitive path pair (the TS HTTPS server passes them to
   * `node:https.createServer` / `readFileSync`). Returns an empty object when
   * SSL is disabled or the cert/key files fail validation.
   * @returns `{ ssl_certfile, ssl_keyfile }` path strings, or `{}` when unavailable.
   */
  getSslContextKwargs(): Record<string, string> {
    if (!this.sslEnabled) return {};
    const [isValid] = this.validateSslConfig();
    if (!isValid) return {};
    return {
      ssl_certfile: this.sslCertPath as string,
      ssl_keyfile: this.sslKeyPath as string,
    };
  }

  /** Get the URL scheme based on SSL configuration. Mirrors Python's `get_url_scheme()`. */
  getUrlScheme(): string {
    return this.sslEnabled ? 'https' : 'http';
  }

  /**
   * Check whether a host is allowed. Mirrors Python's `should_allow_host()`:
   * a wildcard `*` in the allow-list permits any host.
   */
  shouldAllowHost(host: string): boolean {
    if (this.allowedHosts.includes('*')) return true;
    return this.allowedHosts.includes(host);
  }

  /**
   * Get CORS configuration. Mirrors Python's `get_cors_config()`.
   * @returns An object of CORS settings (origins, credentials, methods, headers).
   */
  getCorsConfig(): Record<string, unknown> {
    return {
      allow_origins: this.corsOrigins,
      allow_credentials: true,
      allow_methods: ['*'],
      allow_headers: ['*'],
    };
  }

  /**
   * Get the security headers to add to responses. Mirrors Python's
   * `get_security_headers()`; adds an HSTS header when the request is HTTPS and
   * HSTS is enabled.
   * @param isHttps - Whether the connection is over HTTPS.
   */
  getSecurityHeaders(isHttps = false): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
    if (isHttps && this.useHsts) {
      headers['Strict-Transport-Security'] = `max-age=${this.hstsMaxAge}; includeSubDomains`;
    }
    return headers;
  }

  /**
   * Log the current security configuration. Mirrors Python's `log_config()`.
   * @param serviceName - The service name to tag the log line with.
   */
  logConfig(serviceName: string): void {
    getLogger('SecurityConfig').info('security_config_loaded', {
      service: serviceName,
      ssl_enabled: this.sslEnabled,
      domain: this.domain,
      allowed_hosts: this.allowedHosts,
      cors_origins: this.corsOrigins,
      use_hsts: this.useHsts,
      has_basic_auth: !!(this.basicAuthUser && this.basicAuthPassword),
    });
  }
}

// ── Callback type ──────────────────────────────────────────────────────

/** Callback invoked per-request to dynamically build SWML. */
export type OnRequestCallback = (
  queryParams: Record<string, string>,
  bodyParams: SwmlRequestData,
  headers: Record<string, string>,
) => SwmlBuilder | Promise<SwmlBuilder>;

// RoutingCallback is owned by AgentBase.ts; SWMLService uses a structurally
// compatible local alias to avoid an import cycle and stay independent. Python
// decomposed the callback to `callback_fn(body, headers)`; headers is optional
// so body-only callbacks keep working.
type RoutingCallback = (
  requestBody: SwmlRequestData,
  headers?: Record<string, string>,
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

/**
 * HTTP service that serves non-AI SWML documents built from verb methods.
 *
 * Use `SWMLService` when you need a SignalWire call flow but don't need AI —
 * plain call routing, IVR-style trees, recording workflows, static playback, etc.
 * For AI-powered voice agents, use {@link AgentBase} instead.
 *
 * @example Static greeting that plays a file and hangs up
 * ```ts
 * import { SWMLService } from '@signalwire/sdk';
 *
 * const service = new SWMLService({ name: 'greeter', route: '/', port: 3000 });
 * service.builder
 *   .answer()
 *   .play({ url: 'https://cdn.example.com/welcome.mp3' })
 *   .hangup();
 *
 * await service.serve();
 * ```
 *
 * @see {@link SwmlBuilder} — the underlying SWML document builder
 * @see {@link AgentBase} — AI-powered alternative
 */
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

  protected swmlBuilder: SwmlBuilder;
  protected _app: Hono;
  protected _server: Server | null = null;
  protected onRequestCallback?: OnRequestCallback;
  protected authCredentials?: [string, string];
  protected authSource: 'provided' | 'environment' | 'generated' = 'generated';

  /** Validate provided basic-auth credentials against the configured ones
   * using a constant-time comparison. (Python equivalent:
   * ``AuthMixin.validate_basic_auth(username, password)``.) */
  validateBasicAuth(username: string, password: string): boolean | Promise<boolean> {
    const [u, p] = this.authCredentials ?? ['', ''];
    if (u === '' && p === '') return false;
    return this.timingSafeEqual(username, u) && this.timingSafeEqual(password, p);
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
  protected _proxyUrlBase: string | null = process.env['SWML_PROXY_URL_BASE'] ?? null;
  protected _proxyUrlBaseFromEnv = !!process.env['SWML_PROXY_URL_BASE'];
  protected _routingCallbacks = new Map<string, RoutingCallback>();

  // SWAIG tool registry — lifted from AgentBase so any SWMLService (sidecar,
  // non-agent verb host) can register and dispatch SWAIG functions. Stores
  // SwaigFunction instances (the canonical rich form) or raw descriptor maps
  // for DataMap-style functions. AgentBase reads/writes this same registry.
  protected toolRegistry: Map<string, SwaigFunction | Record<string, unknown>> = new Map();

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
    const skipValidation =
      opts?.schemaValidation === false || process.env['SWML_SKIP_SCHEMA_VALIDATION'] === 'true';
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
          this.authSource = 'generated';
          // Not enforced on HTTP — available via getBasicAuthCredentials()
        }
      }
    }

    // `service: this` is the builder's public back-reference (the reference's
    // `SWMLBuilder(service)`), so a caller holding the builder can reach its service.
    this.swmlBuilder = new SwmlBuilder({ service: this });
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
    const handler = async (c: Context) => {
      let doc: Record<string, unknown>;

      // Always parse request params so onRequest() hook and onRequestCallback
      // can both receive them (mirrors Python's _handle_request param extraction).
      const url = new URL(c.req.url);
      const queryParams: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        queryParams[k] = v;
      });

      let bodyParams: Record<string, unknown> = {};
      if (c.req.method === 'POST') {
        try {
          bodyParams = await c.req.json();
        } catch {
          // empty body is fine
        }
      }

      const headers: Record<string, string> = {};
      c.req.raw.headers.forEach((v: string, k: string) => {
        headers[k] = v;
      });

      // Protected override hook (Service-side SWML builder dispatch).
      // Try buildSwmlForRequest() first; if it returns a SwmlBuilder use
      // that document. This is distinct from WebMixin's onRequest hook
      // (a public 2-arg variant on AgentBase that mirrors Python's
      // on_request → on_swml_request delegation chain).
      const hookResult = this.buildSwmlForRequest(queryParams, bodyParams, headers);
      if (hookResult !== null) {
        doc = hookResult.build();
      } else if (this.onRequestCallback) {
        const builder = await this.onRequestCallback(queryParams, bodyParams, headers);
        doc = builder.build();
      } else {
        doc = this.swmlBuilder.build();
      }

      return c.json(doc);
    };

    const routePath = this.route === '/' ? '/' : this.route;
    const swaigPath = this.route === '/' ? '/swaig' : `${this.route}/swaig`;

    // SWAIG endpoint — GET returns the rendered SWML doc (sidecar / non-agent
    // services use the document as-is; AgentBase overrides via render hook),
    // POST validates and dispatches via onFunctionCall. Subclasses may
    // override swaigPreDispatch to add token validation / ephemeral copies.
    const swaigHandler = async (c: Context) => {
      if (c.req.method === 'GET') {
        return handler(c);
      }
      let payload: SwaigRequest;
      try {
        payload = (await c.req.json()) as SwaigRequest;
      } catch {
        return c.json({ error: 'Invalid JSON' }, 400);
      }
      const fnName = (payload['function'] as string | undefined) ?? '';
      if (!fnName) {
        return c.json({ error: 'Missing function name' }, 400);
      }
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fnName)) {
        return c.json({ error: `Invalid function name format: '${fnName}'` }, 400);
      }
      // Argument extraction: nested {argument:{parsed}} OR flat {arguments}
      let args: Record<string, unknown> = {};
      const argument = payload['argument'] as unknown as Record<string, unknown> | undefined;
      if (
        argument &&
        typeof argument === 'object' &&
        Array.isArray(argument['parsed']) &&
        (argument['parsed'] as unknown[]).length > 0
      ) {
        const first = (argument['parsed'] as unknown[])[0];
        if (first && typeof first === 'object') args = first as Record<string, unknown>;
      } else {
        const flat = payload['arguments'] as Record<string, unknown> | undefined;
        if (flat && typeof flat === 'object') args = flat;
      }
      const [target, shortCircuit] = this.swaigPreDispatch(payload, fnName);
      if (shortCircuit !== null && shortCircuit !== undefined) {
        return c.json(shortCircuit);
      }
      const result = target.onFunctionCall(fnName, args, payload);
      if (result === null || result === undefined) {
        return c.json({ error: `Unknown function: ${fnName}` }, 404);
      }
      return c.json(result);
    };
    this._app.get(swaigPath, swaigHandler);
    this._app.post(swaigPath, swaigHandler);

    // Subclass extension hook (AgentBase wires /post_prompt etc here).
    this.registerAdditionalRoutes(this._app);

    this._app.get(routePath, handler);
    this._app.post(routePath, handler);

    // Register routing callback endpoints dynamically in getApp/run
  }

  // ────────────────────────────────────────────────────────────────────
  // SWAIG tool registry (lifted from AgentBase)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Define a SWAIG function the AI can call. Tool descriptions and
   * parameter descriptions are LLM-facing prompt engineering — see
   * PORTING_GUIDE for guidance on writing them.
   *
   * Generic over the `parameters` schema (`P`) and `required` list (`R`): when
   * `parameters` is written as a FLAT inline map (`{ name: { type, … } }`), the
   * `const` type parameters capture its literals and the handler's `args` is
   * inferred precisely — `args.phone` typed `string`, an `enum` prop narrowed to
   * its literal union, `required` keys present and the rest optional (see
   * {@link ToolArgs}/{@link InferArgs}). The WRAPPED JSON-Schema object
   * (`{ type:'object', properties }`) and a pre-built `Record` are still
   * accepted and keep the prior open-record `args` behavior. The args type is a
   * compile-time authoring convenience — at runtime args is the JSON the model
   * extracted, so the handler is the ordinary {@link SwaigHandler}.
   */
  defineTool<
    const P extends ToolParameters = ToolParameters,
    const R extends readonly PropertyKey[] = [],
  >(
    opts: Omit<SwaigFunctionOptions, 'parameters' | 'required' | 'handler'> & {
      parameters?: P;
      required?: R;
      handler: (
        args: ToolArgs<P, R>,
        rawData: SwaigRequest,
      ) =>
        | FunctionResult
        | Record<string, unknown>
        | string
        | Promise<FunctionResult | Record<string, unknown> | string>;
    },
  ): this {
    const fn = new SwaigFunction({
      ...opts,
      parameters: opts.parameters as Record<string, unknown> | undefined,
      required: opts.required as string[] | undefined,
      // Single type-erasure boundary: at runtime the handler is the ordinary
      // (args: Record<string,unknown>, rawData) SwaigHandler; the inferred-args
      // view is compile-time only.
      handler: opts.handler as SwaigHandler,
    });
    this.toolRegistry.set(opts.name, fn);
    return this;
  }

  /** Register a SwaigFunction instance or a raw function descriptor (DataMap). */
  registerSwaigFunction(fn: SwaigFunction | Record<string, unknown>): this {
    if (fn instanceof SwaigFunction) {
      this.toolRegistry.set(fn.name, fn);
    } else {
      const name = fn['function'] as string;
      if (name) this.toolRegistry.set(name, fn);
    }
    return this;
  }

  /**
   * Dispatch a function call to the registered handler.
   * Returns null when the function isn't registered or has no handler.
   * Subclasses (AgentBase) override to add session-token validation
   * and FunctionResult-shape normalization. Return type is wide enough
   * to accommodate the agent override (which may also return void
   * shapes for fire-and-forget tool calls).
   */
  onFunctionCall(
    name: string,
    args: Record<string, unknown>,
    rawData: SwaigRequest,
  ):
    | FunctionResult
    | Record<string, unknown>
    | string
    | Promise<FunctionResult | Record<string, unknown> | string | void>
    | void
    | null
    | undefined {
    const fn = this.toolRegistry.get(name);
    if (!fn) return null;
    if (fn instanceof SwaigFunction) {
      return fn.handler(args, rawData);
    }
    return null;
  }

  /** Whether a tool with the given name is registered. */
  hasTool(name: string): boolean {
    return this.toolRegistry.has(name);
  }

  /** Whether a SWAIG function with the given name is registered.
   * (Python equivalent: ``ToolRegistry.has_function``.) */
  hasFunction(name: string): boolean {
    return this.toolRegistry.has(name);
  }

  /** Get a registered SWAIG function entry, or undefined.
   * (Python equivalent: ``ToolRegistry.get_function``.) */
  getFunction(name: string): SwaigFunction | Record<string, unknown> | undefined {
    return this.toolRegistry.get(name);
  }

  /** Snapshot of all registered SWAIG functions keyed by name.
   * (Python equivalent: ``ToolRegistry.get_all_functions``.) */
  getAllFunctions(): Record<string, SwaigFunction | Record<string, unknown>> {
    const out: Record<string, SwaigFunction | Record<string, unknown>> = {};
    for (const [name, fn] of this.toolRegistry) {
      out[name] = fn;
    }
    return out;
  }

  /** Remove a registered SWAIG function. Returns true when removed,
   * false when not found. (Python equivalent:
   * ``ToolRegistry.remove_function``.) */
  removeFunction(name: string): boolean {
    return this.toolRegistry.delete(name);
  }

  /** List registered tool names in insertion order (Map preserves it). */
  listToolNames(): string[] {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * Get a summary of all registered tools with their names, descriptions, and
   * parameter schemas. Lifted from AgentBase so the swaig-test CLI can list
   * tools on a non-AgentBase SWMLService target (sidecar / standalone SWAIG
   * host).
   *
   * @returns Array of tool descriptors.
   */
  getRegisteredTools(): {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }[] {
    const tools: { name: string; description: string; parameters: Record<string, unknown> }[] = [];
    for (const [name, fn] of this.toolRegistry) {
      if (fn instanceof SwaigFunction) {
        tools.push({ name, description: fn.description, parameters: fn.parameters });
      } else {
        tools.push({
          name,
          description: (fn['purpose'] as string) ?? '',
          parameters: (fn['argument'] as Record<string, unknown>) ?? {},
        });
      }
    }
    return tools;
  }

  /**
   * Look up a registered SwaigFunction by name. Lifted from AgentBase so
   * `swaig-test --exec <name>` works against a non-AgentBase SWMLService
   * target.
   *
   * @param name - The tool name to search for.
   * @returns The SwaigFunction instance, or undefined if not found or not a SwaigFunction.
   */
  getTool(name: string): SwaigFunction | undefined {
    const fn = this.toolRegistry.get(name);
    return fn instanceof SwaigFunction ? fn : undefined;
  }

  /**
   * Extension point: invoked between argument parsing and function dispatch
   * on POST /swaig. Returns [target, shortCircuit]: when shortCircuit is
   * non-null, it's returned directly without dispatching. AgentBase may
   * override to add session-token validation or ephemeral dynamic-config.
   */
  protected swaigPreDispatch(
    _requestData: SwaigRequest,
    _funcName: string,
  ): [SWMLService, unknown] {
    return [this, null];
  }

  /**
   * Extension point: register additional Hono routes after SWMLService
   * mounts /health, /ready, /swaig, and the main route. AgentBase uses
   * this to add /post_prompt, /check_for_input, /debug_events, /mcp.
   */
  protected registerAdditionalRoutes(_app: Hono): void {
    // Default: no extra routes.
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
    const doc = this.swmlBuilder.build() as { sections: Record<string, unknown[]> };
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
   * Render the SWML document.
   *
   * Subclass-override-friendly signature: AgentBase overrides this with
   * `(callId?: string, modifications?: Record<string, unknown>): string`
   * to return a serialized JSON string built from prompts + dynamic config.
   * Plain SWMLService returns the in-memory document object.
   *
   * @returns The SWML document (object) or its serialized form (subclass).
   */
  renderSwml(
    _callId?: string,
    _modifications?: Record<string, unknown>,
  ): Record<string, unknown> | string {
    return this.swmlBuilder.build();
  }

  /**
   * Get the SWML document as a dictionary. Matches Python's `get_document()`.
   * @returns The SWML document.
   */
  getDocument(): Record<string, unknown> {
    return this.swmlBuilder.build();
  }

  /**
   * Render the SWML document as a JSON string.
   * Mirrors Python's `render_document()`.
   * @returns JSON-encoded SWML document.
   */
  renderDocument(): string {
    return this.swmlBuilder.render();
  }

  /**
   * Framework-free request-dispatch core.
   *
   * The primitive dispatch surface the SDK ports share (mirrors Python's
   * `SWMLService.handle_request(method, url, headers, body)` and, e.g., the
   * dotnet `(int, Dictionary, string) HandleRequest(...)`). It performs the
   * routing-callback check, `on_request` modification, and basic-auth exactly as
   * the Hono handler path does, but over plain primitives instead of Hono
   * `Context`/`Response` objects — so both paths produce identical responses.
   *
   * @param method  HTTP method, e.g. `"GET"` or `"POST"`.
   * @param url     The full request URL (used to derive the callback path).
   * @param headers Request headers as a plain dict.
   * @param body    The already-parsed JSON body for POST requests, or `undefined`.
   * @returns A `[status, responseHeaders, bodyString]` triple. For a routing
   *   redirect the status is 307 with a `Location` header and an empty body; an
   *   auth failure is 401 with `WWW-Authenticate: Basic`; otherwise 200 with the
   *   SWML document as the body string.
   */
  async handleRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: Record<string, unknown> | null,
  ): Promise<[number, Record<string, string>, string]> {
    const parsedBody: Record<string, unknown> = body ?? {};
    const callbackPath = this._callbackPathForUrl(url);

    // Auth check over primitives.
    if (!(await this._checkBasicAuthHeaders(headers))) {
      return [401, { 'WWW-Authenticate': 'Basic' }, JSON.stringify({ error: 'Unauthorized' })];
    }

    // Routing callback: (body, headers) -> route | null. Only runs for a POST
    // with a non-empty parsed body targeting a registered callback path.
    if (
      method === 'POST' &&
      Object.keys(parsedBody).length > 0 &&
      callbackPath &&
      this._routingCallbacks.has(callbackPath)
    ) {
      const callbackFn = this._routingCallbacks.get(callbackPath)!;
      try {
        const route = await callbackFn(parsedBody, headers);
        if (route != null) {
          this.log.info(`routing_request route=${route}`);
          return [307, { Location: route }, ''];
        }
      } catch (err) {
        this.log.error(
          `error_in_routing_callback error=${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Allow customized handling in subclasses (the SWML-builder hook analog of
    // Python's on_request modification merge).
    const queryParams: Record<string, string> = {};
    try {
      new URL(url).searchParams.forEach((v, k) => {
        queryParams[k] = v;
      });
    } catch {
      /* url may be a bare path — no query params to extract */
    }
    const hookResult = this.buildSwmlForRequest(
      queryParams,
      parsedBody,
      headers,
      callbackPath ?? undefined,
    );
    if (hookResult !== null) {
      return [200, {}, JSON.stringify(hookResult.build())];
    }

    return [200, {}, this.renderDocument()];
  }

  /**
   * Derive the registered routing-callback path (if any) a URL targets. Mirrors
   * Python's `_callback_path_for_url` — the primitive `handleRequest` recovers
   * the equivalent of the router's `request.state.callback_path` by matching the
   * URL's normalized path against the registered callbacks.
   */
  protected _callbackPathForUrl(url: string): string | null {
    if (this._routingCallbacks.size === 0) return null;
    let path = url;
    try {
      path = new URL(url).pathname;
    } catch {
      /* bare path — use as-is */
    }
    const trimmed = path.replace(/^\/+|\/+$/g, '');
    const normalized = trimmed ? `/${trimmed}` : path.replace(/\/+$/, '');
    for (const cbPath of this._routingCallbacks.keys()) {
      if (normalized === cbPath || normalized.endsWith(cbPath)) return cbPath;
    }
    return null;
  }

  /**
   * Validate HTTP basic-auth from a plain headers dict (the primitive analog of
   * the Hono `basicAuth` middleware). Returns true when auth is not enforced or
   * the provided credentials match.
   */
  protected async _checkBasicAuthHeaders(headers: Record<string, string>): Promise<boolean> {
    // Auth is only enforced when credentials were explicitly provided or came
    // from the environment; auto-generated credentials are not enforced.
    if (!this.authCredentials || this.authSource === 'generated') return true;
    const authHeader = headers['authorization'] ?? headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) return false;
    let decoded: string;
    try {
      decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    } catch {
      return false;
    }
    const idx = decoded.indexOf(':');
    if (idx < 0) return false;
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    return await this.validateBasicAuth(user, pass);
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
  registerRoutingCallback(callbackFn: RoutingCallback, path: string = '/sip'): void {
    // Normalize: ensure leading /, strip trailing /
    let normalized = path.replace(/\/+$/, '');
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    this.log.info(`Registering routing callback at ${normalized}`);
    this._routingCallbacks.set(normalized, callbackFn);

    // Install an endpoint on the Hono app for this callback path
    const routeHandler = async (c: Context) => {
      let body: SwmlRequestData = {};
      if (c.req.method === 'POST') {
        try {
          body = await c.req.json();
        } catch {
          // empty body
        }
      }

      const cbHeaders: Record<string, string> = {};
      c.req.raw.headers.forEach((v: string, k: string) => {
        cbHeaders[k] = v;
      });

      const route = callbackFn(body, cbHeaders);
      // Preserve the original `route !== null` runtime guard exactly — a
      // types-only change must not alter behavior. The callback's declared
      // return includes undefined|Promise, which the pre-typing `c: any` code
      // passed to redirect verbatim; the cast keeps that identical rather than
      // narrowing it away. Any real fix to non-string returns is a separate
      // behavioral change, not part of the any-burndown.
      if (route !== null) {
        return c.redirect(route as string, 307);
      }

      // No redirect — serve normal SWML
      const doc = this.swmlBuilder.build();
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
  static extractSipUsername(requestBody: SwmlRequestData): string | null {
    try {
      const call = requestBody?.['call'] as Record<string, unknown> | undefined;
      const toField = call?.['to'] as string | undefined;
      if (!toField) return null;

      // Handle SIP URIs like "sip:username@domain" or "sips:username@domain"
      if (toField.startsWith('sip:') || toField.startsWith('sips:')) {
        const uri = toField.replace(/^sips?:/, '');
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
   * Service-side SWML-builder hook. Subclasses return a `SwmlBuilder`
   * to fully replace the document for this request, or `null` to fall
   * through to `setOnRequestCallback` or the static builder.
   *
   * This is distinct from the WebMixin `onRequest(requestData,
   * callbackPath)` hook on AgentBase (which mirrors Python's
   * `on_request -> on_swml_request` modification-merge contract).
   * Use this hook when you want to swap the entire SWML builder; use
   * `onRequest` / `onSwmlRequest` on AgentBase when you want to merge
   * targeted modifications into the rendered document.
   *
   * Default implementation returns `null` (no-op).
   *
   * @param queryParams - URL query parameters from the request.
   * @param bodyParams  - Parsed POST body (empty object for GET requests).
   * @param headers     - HTTP request headers.
   * @param callbackPath - The callback sub-path being handled, if any.
   * @returns A `SwmlBuilder` whose document is sent as the response, or
   *          `null` to delegate to the next handler in the chain.
   */
  protected buildSwmlForRequest(
    _queryParams: Record<string, string>,
    _bodyParams: Record<string, unknown>,
    _headers: Record<string, string>,
    _callbackPath?: string,
  ): SwmlBuilder | null {
    return null;
  }

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
  getBasicAuthCredentials(
    includeSource: true,
  ): [string, string, 'provided' | 'environment' | 'generated'];
  getBasicAuthCredentials(
    includeSource?: boolean,
  ): [string, string] | [string, string, 'provided' | 'environment' | 'generated'] {
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
   * This is the TypeScript equivalent of Python's `as_router()`, which returns
   * a FastAPI `APIRouter`. Both expose the underlying app/router so callers can
   * mount it into a larger framework. Use `asRouter()` when porting Python code
   * that calls `as_router()` directly.
   * @returns The configured Hono app.
   */
  getApp(): Hono {
    return this._app;
  }

  /**
   * Get a router to embed this service's routes in a host web app.
   *
   * Returns the fully-wired Hono app as a mountable sub-app; the host mounts it
   * with `hostApp.route(path, service.asRouter())`. This is the TypeScript
   * realization of Python's `as_router()`; the named {@link HostAppRouter} type
   * is the cross-port "embed my routes in a host app" contract.
   *
   * @returns A mountable Hono sub-app carrying this service's routes.
   */
  asRouter(): HostAppRouter {
    return this.getApp();
  }

  /**
   * Start the HTTP server. Canonical entrypoint, matching Python's
   * `SWMLService.serve()`.
   *
   * Matches Python's `serve()` parameters including SSL options. When
   * `SWAIG_CLI_MODE=true` is set in the environment (e.g. while running the
   * `swaig-test` CLI) the call is a no-op.
   *
   * @param hostOrOpts - Hostname, or an options object. Defaults to `this.host`
   *   (constructor value) or `'0.0.0.0'`.
   * @param port - Port. Defaults to `this.port` (constructor value) or `3000`.
   * @param opts - Optional SSL/TLS configuration overrides.
   * @param opts.sslCert - Path to the PEM certificate file.
   * @param opts.sslKey - Path to the PEM private key file.
   * @param opts.sslEnabled - When `true`, serve over HTTPS.
   * @param opts.domain - Domain used for HSTS header configuration.
   * @returns Resolves once the server has begun listening.
   */
  async serve(
    hostOrOpts?:
      | string
      | {
          host?: string;
          port?: number;
          sslCert?: string;
          sslKey?: string;
          sslEnabled?: boolean;
          domain?: string;
        },
    port?: number,
    opts?: {
      sslCert?: string;
      sslKey?: string;
      sslEnabled?: boolean;
      domain?: string;
    },
  ): Promise<void> {
    if (process.env['SWAIG_CLI_MODE'] === 'true') return;

    // Normalize: accept either positional (host, port, opts) or single
    // options-object form (matches AgentBase's `run({ host, port })` shape).
    let host: string | undefined;
    let resolvedOpts: typeof opts;
    if (typeof hostOrOpts === 'object' && hostOrOpts !== null) {
      host = hostOrOpts.host;
      port = hostOrOpts.port ?? port;
      resolvedOpts = hostOrOpts;
    } else {
      host = hostOrOpts;
      resolvedOpts = opts;
    }
    opts = resolvedOpts;

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
