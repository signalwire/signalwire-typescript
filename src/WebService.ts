/**
 * WebService - Static file serving service with HTTP API.
 *
 * Provides configurable static file serving with security features including
 * basic auth, extension filtering, directory browsing, file size limits,
 * CORS, and SSL support. Equivalent to the Python SDK's WebService class.
 */

import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { cors } from 'hono/cors';
import { readFile, stat, readdir } from 'node:fs/promises';
import { join, extname, normalize, resolve, basename } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { getLogger } from './Logger.js';
import { ConfigLoader } from './ConfigLoader.js';
import { SslConfig } from './SslConfig.js';
import type { SslOptions } from './SslConfig.js';
import { serve, type ServerHandle } from './serve.js';

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

/** Configuration options for WebService. */
export interface WebServiceOptions {
  /** Port to bind to. Default: 8002. */
  port?: number;
  /** Map of URL route prefixes to local directory paths. Default: {}. */
  directories?: Record<string, string>;
  /** Basic auth credentials as [username, password]. Default: none. */
  basicAuth?: [string, string];
  /** Path to a JSON config file. Default: none. */
  configFile?: string;
  /** Serve directory listings and fall back to index.html. Default: false. */
  enableDirectoryBrowsing?: boolean;
  /** Allowlist of file extensions (e.g. ['.html', '.css']). Default: all allowed. */
  allowedExtensions?: string[];
  /**
   * Blocklist of file extensions or names.
   * Default: ['.env', '.git', '.gitignore', '.key', '.pem', '.crt', '.pyc', '__pycache__', '.DS_Store', '.swp']
   */
  blockedExtensions?: string[];
  /** Maximum file size in bytes. Default: 104857600 (100 MB). */
  maxFileSize?: number;
  /** Enable CORS. Default: true. */
  enableCors?: boolean;
  /** SSL/TLS configuration options. */
  ssl?: SslOptions;
}

/** Escapes HTML special characters to prevent XSS in directory listings. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format a file size in bytes to a human-readable string. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Static file serving service with HTTP API.
 *
 * Provides configurable static file hosting with per-route directory mounting,
 * extension filtering, file size limits, HTTP Basic Auth, CORS, directory
 * browsing, and optional SSL/TLS. Mirrors the Python SDK's `WebService` class.
 *
 * Useful when an agent or prefab needs to serve supporting assets — prompts, audio
 * files, images — from the same process without running a separate nginx / CDN.
 *
 * @example Serve a directory of audio files
 * ```ts
 * import { WebService } from '@signalwire/sdk';
 *
 * const web = new WebService({
 *   port: 8080,
 *   directories: { '/audio': './public/audio' },
 *   allowedExtensions: ['.mp3', '.wav'],
 * });
 *
 * await web.serve();
 * // GET http://host:8080/audio/greeting.mp3
 * ```
 */
export class WebService {
  /** Port the service binds to. */
  readonly port: number;
  /** Whether directory listings are enabled. */
  readonly enableDirectoryBrowsing: boolean;
  /** Maximum file size in bytes that will be served. */
  readonly maxFileSize: number;
  /** Whether CORS is enabled. */
  readonly enableCors: boolean;
  /** Allowlist of file extensions, or null to allow all (subject to blocklist). */
  readonly allowedExtensions: string[] | null;
  /** Blocklist of file extensions and file names. */
  readonly blockedExtensions: string[];
  /** Map of URL route prefixes to local directory paths. */
  readonly directories: Record<string, string>;

  private _app: Hono;
  private _basicAuth: [string, string] | null;
  private _ssl: SslConfig;
  private _server: ServerHandle | null = null;
  private readonly log = getLogger('WebService');

  /** Default blocked extensions and file names (security-sensitive files). */
  private static readonly DEFAULT_BLOCKED = [
    '.env', '.git', '.gitignore', '.key', '.pem', '.crt',
    '.pyc', '__pycache__', '.DS_Store', '.swp',
  ];

  /**
   * Create a WebService.
   * @param options - Configuration options for the service.
   */
  constructor(options?: WebServiceOptions) {
    // Load configuration from file first (if provided), then override with
    // explicit constructor parameters, mirroring the Python SDK's precedence.
    const fileConfig = this._loadConfig(options?.configFile);

    this.port = options?.port ?? fileConfig.port ?? 8002;
    this.directories = { ...(fileConfig.directories ?? {}), ...(options?.directories ?? {}) };
    this._basicAuth = options?.basicAuth ?? null;
    this.enableDirectoryBrowsing =
      options?.enableDirectoryBrowsing ?? fileConfig.enableDirectoryBrowsing ?? false;
    this.allowedExtensions =
      options?.allowedExtensions ?? fileConfig.allowedExtensions ?? null;
    this.blockedExtensions =
      options?.blockedExtensions ?? fileConfig.blockedExtensions ?? [...WebService.DEFAULT_BLOCKED];
    this.maxFileSize = options?.maxFileSize ?? fileConfig.maxFileSize ?? 100 * 1024 * 1024;
    this.enableCors = options?.enableCors ?? fileConfig.enableCors ?? true;
    this._ssl = new SslConfig(options?.ssl);

    this._app = new Hono();
    this._setupMiddleware();
    this._setupRoutes();
    this._mountDirectories();
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Add a new directory to serve at a URL route prefix.
   * @param route - URL prefix (e.g. '/docs').
   * @param directory - Local directory path to serve.
   * @throws If the directory does not exist or is not a directory.
   */
  addDirectory(route: string, directory: string): void {
    const r = route.startsWith('/') ? route : `/${route}`;
    const dirPath = resolve(directory);

    if (!existsSync(dirPath)) {
      throw new Error(`Directory does not exist: ${directory}`);
    }

    if (!statSync(dirPath).isDirectory()) {
      throw new Error(`Path is not a directory: ${directory}`);
    }

    this.directories[r] = directory;
    this._mountSingleDirectory(r, directory);
  }

  /**
   * Remove a previously added directory route from the bookkeeping map.
   *
   * Note: Hono does not support dynamic route removal; a server restart
   * is required for the route to fully stop responding.
   * @param route - The URL route prefix to remove.
   */
  removeDirectory(route: string): void {
    const r = route.startsWith('/') ? route : `/${route}`;
    if (r in this.directories) {
      delete this.directories[r];
    }
  }

  /**
   * Get the Hono application for mounting or testing.
   * @returns The configured Hono app.
   */
  getApp(): Hono {
    return this._app;
  }

  /**
   * The SSL/TLS configuration for this service.
   *
   * Mirrors the Python SDK's `security` attribute (`SecurityConfig`), which
   * exposes SSL settings for post-construction inspection.  In the Python SDK
   * `SecurityConfig` also covers CORS origins, HSTS, allowed hosts, and rate
   * limiting; in this SDK those concerns are configured via their own
   * constructor options (`enableCors`, `ssl`, etc.) and Hono middleware rather
   * than a single combined object.
   *
   * @returns The `SslConfig` instance used by this service.
   */
  get sslConfig(): SslConfig {
    return this._ssl;
  }

  /**
   * Start the HTTP(S) service.
   *
   * When `SWAIG_CLI_MODE=true` is set in the environment, the call is a
   * no-op so config can be inspected without binding a port.
   *
   * @param host - Bind address. Defaults to `'0.0.0.0'`.
   * @param port - Port override. Defaults to `this.port`.
   * @param sslCert - Path to SSL certificate file (overrides `SslConfig`).
   * @param sslKey - Path to SSL key file (overrides `SslConfig`).
   * @returns Resolves once the server has begun listening.
   */
  async start(
    host?: string,
    port?: number,
    sslCert?: string,
    sslKey?: string,
  ): Promise<void> {
    // When loaded by the CLI tool, skip server startup.
    if (process.env['SWAIG_CLI_MODE'] === 'true') return;

    const h = host ?? '0.0.0.0';
    const p = port ?? this.port;

    // Determine SSL configuration
    const effectiveSsl = sslCert && sslKey
      ? new SslConfig({ enabled: true, certPath: sslCert, keyPath: sslKey })
      : this._ssl;

    const useHttps = effectiveSsl.isConfigured();
    const scheme = useHttps ? 'https' : 'http';

    this.log.info(`WebService starting on ${scheme}://${h}:${p}`);
    this.log.info(`Directories: ${Object.keys(this.directories).join(', ') || 'None'}`);
    this.log.info(`Directory Browsing: ${this.enableDirectoryBrowsing ? 'Enabled' : 'Disabled'}`);
    this.log.info(`Basic Auth: ${this._basicAuth ? 'Enabled' : 'Disabled'}`);
    if (useHttps) {
      this.log.info('SSL: Enabled');
    }

    const tls = useHttps ? effectiveSsl.getServerOptions() ?? undefined : undefined;
    this._server = await serve({ fetch: this._app.fetch, port: p, hostname: h, tls });
  }

  /**
   * Stop the service and release resources.
   */
  async stop(): Promise<void> {
    if (this._server) {
      await this._server.stop();
      this._server = null;
      this.log.info('WebService stopped');
    }
  }

  // ── Config loading ─────────────────────────────────────────────────

  /** Intermediate config shape returned by the file loader. */
  private _loadConfig(configFile?: string): {
    port?: number;
    directories?: Record<string, string>;
    enableDirectoryBrowsing?: boolean;
    allowedExtensions?: string[] | null;
    blockedExtensions?: string[];
    maxFileSize?: number;
    enableCors?: boolean;
  } {
    const result: ReturnType<WebService['_loadConfig']> = {};

    if (!configFile) {
      // Search standard locations for a web-service config
      const loader = ConfigLoader.search('web_service.json');
      if (!loader) return result;
      return this._extractServiceConfig(loader);
    }

    try {
      const loader = new ConfigLoader(configFile);
      return this._extractServiceConfig(loader);
    } catch {
      this.log.warn(`Failed to load config file: ${configFile}`);
      return result;
    }
  }

  private _extractServiceConfig(loader: ConfigLoader): ReturnType<WebService['_loadConfig']> {
    const result: ReturnType<WebService['_loadConfig']> = {};

    const port = loader.get<number>('service.port');
    if (port !== undefined) result.port = Number(port);

    const dirs = loader.get<Record<string, string>>('service.directories');
    if (dirs && typeof dirs === 'object') result.directories = dirs;

    const browsing = loader.get<boolean>('service.enableDirectoryBrowsing');
    if (browsing !== undefined) result.enableDirectoryBrowsing = Boolean(browsing);

    const maxSize = loader.get<number>('service.maxFileSize');
    if (maxSize !== undefined) result.maxFileSize = Number(maxSize);

    const allowed = loader.get<string[]>('service.allowedExtensions');
    if (Array.isArray(allowed)) result.allowedExtensions = allowed;

    const blocked = loader.get<string[]>('service.blockedExtensions');
    if (Array.isArray(blocked)) result.blockedExtensions = blocked;

    const corsEnabled = loader.get<boolean>('service.enableCors');
    if (corsEnabled !== undefined) result.enableCors = Boolean(corsEnabled);

    return result;
  }

  // ── Middleware setup ────────────────────────────────────────────────

  private _setupMiddleware(): void {
    // Security headers (same set as AgentServer and SWMLService)
    this._app.use('*', async (c, next) => {
      await next();
      c.res.headers.set('X-Content-Type-Options', 'nosniff');
      c.res.headers.set('X-Frame-Options', 'DENY');
      c.res.headers.set('X-XSS-Protection', '1; mode=block');
      c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      c.res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    });

    // CORS
    if (this.enableCors) {
      const corsOrigins = process.env['SWML_CORS_ORIGINS'];
      const corsOrigin = corsOrigins ? corsOrigins.split(',').map((o: string) => o.trim()) : '*';
      const corsCredentials = corsOrigin !== '*';
      this._app.use('*', cors({ origin: corsOrigin, credentials: corsCredentials }));
    }

    // SSL HSTS middleware
    if (this._ssl.isConfigured()) {
      this._app.use('*', this._ssl.hstsMiddleware());
    }

    // Basic auth (applied to all routes if configured)
    if (this._basicAuth) {
      const [user, pass] = this._basicAuth;
      this._app.use('*', basicAuth({ username: user, password: pass }));
    }
  }

  // ── Route setup ────────────────────────────────────────────────────

  private _setupRoutes(): void {
    // Health endpoint
    this._app.get('/health', (c) =>
      c.json({
        status: 'healthy',
        directories: Object.keys(this.directories),
        sslEnabled: this._ssl.isConfigured(),
        authRequired: Boolean(this._basicAuth),
        directoryBrowsing: this.enableDirectoryBrowsing,
      }),
    );

    // Root endpoint showing available directories
    this._app.get('/', (c) => {
      const dirEntries = Object.entries(this.directories);

      if (dirEntries.length === 0) {
        return c.json({
          service: 'SignalWire Web Service',
          directories: [],
        });
      }

      const items = dirEntries
        .map(
          ([route, localPath]) =>
            `<li><a href="${escapeHtml(route)}">${escapeHtml(route)}</a>` +
            ` <span class="path">&rarr; ${escapeHtml(localPath)}</span></li>`,
        )
        .join('\n');

      const html = `<!DOCTYPE html>
<html>
<head>
  <title>SignalWire Web Service</title>
  <style>
    body { font-family: sans-serif; margin: 40px; }
    h1 { color: #333; }
    ul { list-style: none; padding: 0; }
    li { padding: 10px 0; }
    a { text-decoration: none; color: #0066cc; font-size: 18px; }
    a:hover { text-decoration: underline; }
    .path { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>SignalWire Web Service</h1>
  <h2>Available Directories:</h2>
  <ul>
    ${items}
  </ul>
</body>
</html>`;
      c.header('Content-Type', 'text/html');
      return c.body(html);
    });
  }

  // ── Directory mounting ─────────────────────────────────────────────

  private _mountDirectories(): void {
    for (const [route, dir] of Object.entries(this.directories)) {
      const dirPath = resolve(dir);
      if (!existsSync(dirPath)) {
        this.log.warn(`Directory does not exist: ${dir}`);
        continue;
      }
      this._mountSingleDirectory(route, dir);
    }
  }

  private _mountSingleDirectory(route: string, directory: string): void {
    const baseDir = resolve(directory);
    const routePrefix = route.replace(/\/+$/, '') || '/';

    this._app.get(`${routePrefix}/*`, async (c) => {
      const requestedPath = c.req.path.slice(routePrefix.length);

      // Path traversal protection: reject any path containing ".."
      if (requestedPath.includes('..')) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      const normalizedPath = normalize(requestedPath);
      const fullPath = resolve(join(baseDir, normalizedPath));

      // Double-check the resolved path is within the base directory
      if (!fullPath.startsWith(baseDir)) {
        return c.json({ error: 'Forbidden' }, 403);
      }

      try {
        const fileStat = await stat(fullPath);

        // Handle directory requests
        if (fileStat.isDirectory()) {
          if (!this.enableDirectoryBrowsing) {
            // Try index.html fallback
            const indexPath = join(fullPath, 'index.html');
            try {
              const idxStat = await stat(indexPath);
              if (idxStat.isFile() && this._isFileAllowed(indexPath, idxStat.size)) {
                return this._serveFile(c, indexPath);
              }
            } catch {
              // No index.html found
            }
            return c.json({ error: 'Directory browsing disabled' }, 403);
          }
          return this._serveDirectoryListing(c, fullPath, c.req.path);
        }

        // Regular file
        if (!fileStat.isFile()) {
          return c.json({ error: 'Not found' }, 404);
        }

        if (!this._isFileAllowed(fullPath, fileStat.size)) {
          return c.json({ error: 'File type not allowed' }, 403);
        }

        return this._serveFile(c, fullPath);
      } catch {
        return c.json({ error: 'Not found' }, 404);
      }
    });

    this.log.info(`Serving static files from ${baseDir} at ${routePrefix}/*`);
  }

  // ── File checks ────────────────────────────────────────────────────

  private _isFileAllowed(fullPath: string, size: number): boolean {
    // Check file size
    if (size > this.maxFileSize) return false;

    const ext = extname(fullPath).toLowerCase();
    const name = basename(fullPath);

    // Check blocked extensions and names
    for (const blocked of this.blockedExtensions) {
      if (blocked.startsWith('.')) {
        // Check both as extension and as full name (for files like .env, .gitignore)
        if (ext === blocked || name === blocked) return false;
      } else {
        // Check as a file name or as a substring of the path
        if (name === blocked || fullPath.includes(blocked)) return false;
      }
    }

    // If allowedExtensions is set, only allow those
    if (this.allowedExtensions && !this.allowedExtensions.includes(ext)) return false;

    return true;
  }

  // ── File serving ───────────────────────────────────────────────────

  private async _serveFile(c: any, fullPath: string): Promise<Response> {
    const content = await readFile(fullPath);
    const ext = extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    c.header('Content-Type', contentType);
    c.header('Cache-Control', 'public, max-age=3600');
    c.header('X-Content-Type-Options', 'nosniff');

    return c.body(content);
  }

  // ── Directory listing ──────────────────────────────────────────────

  private async _serveDirectoryListing(
    c: any,
    dirPath: string,
    urlPath: string,
  ): Promise<Response> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    // Sort entries alphabetically
    const sorted = entries
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    const items: string[] = [];

    // Add parent directory link if not at root
    if (urlPath !== '/') {
      items.push('<li><a href="../">../</a></li>');
    }

    // List directories first, then files (matching Python SDK behavior)
    for (const entry of sorted) {
      if (entry.isDirectory()) {
        const safeName = escapeHtml(entry.name);
        items.push(`<li><a href="${safeName}/">${safeName}/</a></li>`);
      }
    }

    for (const entry of sorted) {
      if (entry.isFile()) {
        const entryPath = join(dirPath, entry.name);
        try {
          const entryStat = await stat(entryPath);
          if (this._isFileAllowed(entryPath, entryStat.size)) {
            const safeName = escapeHtml(entry.name);
            const sizeStr = formatSize(entryStat.size);
            items.push(`<li><a href="${safeName}">${safeName}</a> (${sizeStr})</li>`);
          }
        } catch {
          // Skip files we can't stat
        }
      }
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Directory listing for ${escapeHtml(urlPath)}</title>
  <style>
    body { font-family: sans-serif; margin: 40px; }
    h1 { color: #333; }
    ul { list-style: none; padding: 0; }
    li { padding: 5px 0; }
    a { text-decoration: none; color: #0066cc; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Directory listing for ${escapeHtml(urlPath)}</h1>
  <ul>
    ${items.join('\n    ')}
  </ul>
</body>
</html>`;
    c.header('Content-Type', 'text/html');
    return c.body(html);
  }
}
