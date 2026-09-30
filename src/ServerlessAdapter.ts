/**
 * ServerlessAdapter - Adapts AgentBase for serverless platforms.
 *
 * Supports AWS Lambda, Google Cloud Functions, Azure Functions, and CGI mode.
 * Auto-detects platform from environment variables.
 */

import { getLogger } from './Logger.js';

const log = getLogger('ServerlessAdapter');

/** Reason phrases for the CGI `Status:` header on the responses this adapter emits. */
const CGI_STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  301: 'Moved Permanently',
  307: 'Temporary Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  500: 'Internal Server Error',
};

/** Supported serverless platform identifiers, or 'auto' for environment-based detection. */
export type ServerlessPlatform = 'lambda' | 'gcf' | 'azure' | 'cgi' | 'auto';

/** Normalized incoming event from a serverless platform. */
export interface ServerlessEvent {
  /** HTTP method (AWS Lambda style). */
  httpMethod?: string;
  /** HTTP method (GCF/Azure style). */
  method?: string;
  /** Request headers as key-value pairs. */
  headers?: Record<string, string>;
  /** Request body, either raw JSON string or parsed object. */
  body?: string | Record<string, unknown>;
  /** When true, `body` is base64-encoded (AWS API Gateway proxy integration). */
  isBase64Encoded?: boolean;
  /** Request path. */
  path?: string;
  /** Raw request path (AWS API Gateway v2). */
  rawPath?: string;
  /** Query string parameters as key-value pairs. */
  queryStringParameters?: Record<string, string>;
  /** Repeated query parameters (AWS API Gateway REST). */
  multiValueQueryStringParameters?: Record<string, string[]>;
  /** The raw, still-encoded query string (AWS API Gateway v2 and function URLs). */
  rawQueryString?: string;
  /** Path parameters; `proxy` is the path below a `{proxy+}` resource (AWS API Gateway REST). */
  pathParameters?: Record<string, string>;
  /** Platform-specific request context metadata. */
  requestContext?: Record<string, unknown>;
}

/** Minimal Google Cloud Functions request shape (Express-style) consumed by {@link ServerlessAdapter.createGcfHandler}. */
export interface GcfRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  /** The unparsed request body, as the platform received it. */
  rawBody?: Buffer | string;
  path?: string;
  url?: string;
  originalUrl?: string;
  protocol?: string;
  /** The client's address (Express). */
  ip?: string;
  socket?: { remoteAddress?: string };
}

/** Minimal Google Cloud Functions response shape (Express-style) consumed by {@link ServerlessAdapter.createGcfHandler}. */
export interface GcfResponse {
  status(code: number): void;
  set(field: string, value: string): void;
  send(body: string): void;
}

/** Minimal Azure Functions request shape consumed by {@link ServerlessAdapter.createAzureHandler}. */
export interface AzureRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  /** The unparsed request body, as the platform received it. */
  rawBody?: Buffer | string;
  url?: string;
}

/**
 * A URL a serverless request's webhook signature may have been computed over,
 * with the path and query below the app's root to join to `SWML_PROXY_URL_BASE`.
 * The adapter passes these to the app in Hono's `env` (see
 * {@link _SIGNATURE_TARGETS_ENV_KEY}), where a client can't set them.
 */
export interface _SignatureTarget {
  /** The full URL the platform received the request on. */
  url: string;
  /** The path below the app's root, with the query, e.g. `/swaig?x=1`. */
  pathAndQuery: string;
}

/** The Hono `env` key under which the adapter passes {@link _SignatureTarget}s. */
export const _SIGNATURE_TARGETS_ENV_KEY = 'signalwireSignatureTargets';

/**
 * The Hono `env` key under which the adapter passes the base URL the platform
 * serves the function on, when the request shows it (Azure's
 * `https://<app>.azurewebsites.net/api/<function>`, a Google Cloud Function's
 * origin). An agent renders its webhook URLs from it, unless
 * `SWML_PROXY_URL_BASE` is set.
 */
export const _PLATFORM_BASE_ENV_KEY = 'signalwirePlatformBase';

/**
 * Hono env key for the client's address as the platform reports it (Lambda's
 * requestContext source IP, a Cloud Function request's `ip`, CGI's
 * REMOTE_ADDR), which the agent's rate limit keys on.
 * @internal
 */
export const _CLIENT_ADDRESS_ENV_KEY = 'signalwireClientAddress';

/** One serverless request, reduced to what routing and signature checks need. */
interface PlatformRequest {
  method: string;
  /** The path below the app's root, used for routing. */
  path: string;
  /** The raw query string, without the `?`. */
  query: string;
  /** Other encodings of the query to try for a signature, for platforms that decode it. */
  queryVariants: string[];
  /** The full URL the platform received the request on, or '' when unknown. */
  platformUrl: string;
  /** Headers with lower-case names. */
  headers: Record<string, string>;
  /** The raw request body. */
  body: string | undefined;
  /** The base URL the function is served on, when the request shows it. */
  platformBase?: string;
  /** The client's address, as the platform reports it. */
  clientAddress?: string;
}

/**
 * The base URL a Cloud Function was called on, or undefined to leave it to
 * the environment. The platform strips the function's own path before the
 * request reaches it, so the request shows only the host: a configured
 * FUNCTION_URL wins, a `cloudfunctions.net` host gets the function's name,
 * and any other host (Cloud Run's) is the base itself.
 */
function gcfBase(proto: string, host: string | undefined): string | undefined {
  if (!host || process.env['FUNCTION_URL']) return undefined;
  const origin = `${proto}://${host}`;
  const name = process.env['K_SERVICE'] || process.env['FUNCTION_TARGET'];
  return host.endsWith('.cloudfunctions.net') && name ? `${origin}/${name}` : origin;
}

/** Headers as a plain object with lower-case names. */
function lowerHeaders(headers: Record<string, unknown> | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers ?? {})) {
    if (v == null) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

/**
 * Percent-encode a query component as Python's `quote(s, safe='')` does:
 * everything but letters, digits and `_.-~`. With `plus`, a space is `+`, as
 * `quote_plus` (and HTML form encoding) writes it.
 */
function encodeQueryPart(s: string, plus: boolean): string {
  const encoded = encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return plus ? encoded.replace(/%20/g, '+') : encoded;
}

function encodeQuery(pairs: [string, string][], plus: boolean): string {
  return pairs.map(([k, v]) => `${encodeQueryPart(k, plus)}=${encodeQueryPart(v, plus)}`).join('&');
}

/** Split a path-and-query string at the first `?`. */
function splitPathAndQuery(pathAndQuery: string): [string, string] {
  const i = pathAndQuery.indexOf('?');
  return i === -1 ? [pathAndQuery, ''] : [pathAndQuery.slice(0, i), pathAndQuery.slice(i + 1)];
}

/** A body as the platform received it: raw bytes as UTF-8, a string as-is, anything else as JSON. */
function rawBodyText(rawBody: unknown, body: unknown): string | undefined {
  if (Buffer.isBuffer(rawBody)) return rawBody.toString('utf-8');
  if (typeof rawBody === 'string') return rawBody;
  if (body == null) return undefined;
  return typeof body === 'string' ? body : JSON.stringify(body);
}

/** Minimal Azure Functions invocation context consumed by {@link ServerlessAdapter.createAzureHandler}. */
export interface AzureContext {
  res?: { status: number; headers: Record<string, string>; body: string };
}

/** Normalized outgoing response returned to a serverless platform. */
export interface ServerlessResponse {
  /** HTTP status code. */
  statusCode: number;
  /** Response headers as key-value pairs. */
  headers: Record<string, string>;
  /** Response body as a string. */
  body: string;
}

/**
 * Adapts a Hono application for deployment on AWS Lambda, Google Cloud Functions, Azure Functions, or CGI.
 *
 * Accepts the provider's native event shape (`APIGatewayProxyEvent`, Google Functions `Request`,
 * Azure function arguments, CGI env + stdin) and returns a provider-native response.
 *
 * @example AWS Lambda handler
 * ```ts
 * import { AgentBase, ServerlessAdapter } from '@signalwire/sdk';
 *
 * const agent = new AgentBase({ name: 'lambda', route: '/' });
 * agent.setPromptText('You are a helpful assistant.');
 *
 * const adapter = new ServerlessAdapter('lambda');
 *
 * export const handler = async (event: any) => {
 *   return adapter.handleRequest(agent.asRouter(), event);
 * };
 * ```
 */
export class ServerlessAdapter {
  private platform: ServerlessPlatform;

  /**
   * Create a ServerlessAdapter for the given platform.
   * @param platform - Target platform; defaults to 'auto' which detects from environment variables.
   */
  constructor(platform: ServerlessPlatform = 'auto') {
    this.platform = platform === 'auto' ? this.detectPlatform() : platform;
  }

  /**
   * Detect the serverless platform by inspecting well-known environment variables.
   * @returns The detected platform identifier; defaults to 'lambda' if no match is found.
   */
  detectPlatform(): ServerlessPlatform {
    if (process.env['AWS_LAMBDA_FUNCTION_NAME'] || process.env['_HANDLER']) return 'lambda';
    if (process.env['FUNCTION_TARGET'] || process.env['K_SERVICE']) return 'gcf';
    if (process.env['FUNCTIONS_WORKER_RUNTIME'] || process.env['AZURE_FUNCTIONS_ENVIRONMENT'])
      return 'azure';
    if (process.env['GATEWAY_INTERFACE']) return 'cgi';
    return 'lambda'; // default fallback
  }

  /**
   * Get the resolved platform identifier.
   * @returns The serverless platform this adapter is configured for.
   */
  getPlatform(): ServerlessPlatform {
    return this.platform;
  }

  /**
   * Convert a serverless event into a standard Request, route it through the Hono app, and return a normalized response.
   *
   * The app also receives, in its `env`, the URL the platform was called on,
   * so a webhook signature is checked against the URL SignalWire signed: with
   * an API Gateway stage or other platform prefix, and the query as the
   * platform received it (for API Gateway REST, which decodes the query, both
   * common encodings are tried).
   *
   * @param app - A Hono-compatible application with a `fetch` method.
   * @param event - The incoming serverless event to process.
   * @returns The normalized serverless response.
   */
  async handleRequest(
    app: { fetch: (req: Request, env?: Record<string, unknown>) => Response | Promise<Response> },
    event: ServerlessEvent,
  ): Promise<ServerlessResponse> {
    return this.dispatch(app, ServerlessAdapter.fromEvent(event));
  }

  /**
   * Reduce a Lambda-style event (a function URL, API Gateway REST or HTTP API
   * event, or a hand-built event) to a {@link PlatformRequest}.
   */
  private static fromEvent(event: ServerlessEvent): PlatformRequest {
    const headers = lowerHeaders(event.headers);
    const context = (event.requestContext ?? {}) as Record<string, unknown>;
    const http = (context['http'] ?? {}) as Record<string, unknown>;

    let body: string | undefined;
    if (event.body != null) {
      if (typeof event.body === 'string') {
        body = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString('utf-8')
          : event.body;
      } else {
        body = JSON.stringify(event.body);
      }
    }

    const method = String(
      event.httpMethod ?? event.method ?? http['method'] ?? (body ? 'POST' : 'GET'),
    ).toUpperCase();

    // The path below the app's root. A REST API {proxy+} resource puts it in
    // pathParameters.proxy; an HTTP API stage other than $default is in rawPath.
    let path = event.rawPath ?? '';
    const stage = typeof context['stage'] === 'string' ? (context['stage'] as string) : '';
    if (
      path &&
      stage &&
      stage !== '$default' &&
      (path === `/${stage}` || path.startsWith(`/${stage}/`))
    ) {
      path = path.slice(stage.length + 1) || '/';
    }
    if (!path && event.pathParameters?.['proxy'] !== undefined) {
      path = `/${event.pathParameters['proxy']}`;
    }
    if (!path) path = event.path ?? '/';

    let query: string;
    const queryVariants: string[] = [];
    if (event.rawQueryString !== undefined) {
      query = event.rawQueryString;
    } else {
      // REST (v1) events carry decoded parameters, so the original encoding is
      // lost: route with the "+" form and also try the "%20" form for signatures.
      const multi = event.multiValueQueryStringParameters ?? {};
      let pairs: [string, string][] = Object.entries(multi).flatMap(([k, vs]) =>
        (vs ?? []).map((v): [string, string] => [k, v]),
      );
      if (pairs.length === 0) pairs = Object.entries(event.queryStringParameters ?? {});
      query = encodeQuery(pairs, true);
      const percent = encodeQuery(pairs, false);
      if (percent !== query) queryVariants.push(percent);
    }

    // The URL the platform was called on. REST (v1) events keep the stage in
    // requestContext.path; HTTP API and function URL events in rawPath.
    const called = event.rawPath ?? (context['path'] as string | undefined) ?? event.path ?? path;
    let origin = '';
    if (typeof context['domainName'] === 'string') {
      origin = `https://${context['domainName']}`;
    } else if (process.env['AWS_LAMBDA_FUNCTION_URL']) {
      origin = `https://${new URL(process.env['AWS_LAMBDA_FUNCTION_URL']).host}`;
    } else if (headers['host']) {
      origin = `${headers['x-forwarded-proto'] ?? 'https'}://${headers['host']}`;
    }
    const platformUrl = origin ? `${origin}${called}${query ? `?${query}` : ''}` : '';

    // The client address the platform saw: HTTP API / function URL events
    // in requestContext.http, REST (v1) events in requestContext.identity.
    const identity = (context['identity'] ?? {}) as Record<string, unknown>;
    const sourceIp = http['sourceIp'] ?? identity['sourceIp'];
    const clientAddress = typeof sourceIp === 'string' && sourceIp ? sourceIp : undefined;

    return { method, path, query, queryVariants, platformUrl, headers, body, clientAddress };
  }

  /** Route one reduced request through the app and normalize its response. */
  private async dispatch(
    app: { fetch: (req: Request, env?: Record<string, unknown>) => Response | Promise<Response> },
    req: PlatformRequest,
  ): Promise<ServerlessResponse> {
    // Build the routing URL — prefer platform env vars over client headers
    const host = process.env['AWS_LAMBDA_FUNCTION_URL']
      ? new URL(process.env['AWS_LAMBDA_FUNCTION_URL']).hostname
      : (req.headers['host'] ?? 'localhost');
    const proto = process.env['AWS_LAMBDA_FUNCTION_URL']
      ? 'https'
      : (req.headers['x-forwarded-proto'] ?? 'https');
    const path = req.path.startsWith('/') ? req.path : `/${req.path}`;
    const url = `${proto}://${host}${path}${req.query ? `?${req.query}` : ''}`;

    const request = new Request(url, {
      method: req.method,
      headers: new Headers(req.headers),
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
    });

    // Every URL the signature may have been computed over, one per query encoding.
    const targets: _SignatureTarget[] = [req.query, ...req.queryVariants].map((q) => {
      const suffix = q ? `?${q}` : '';
      let platformUrl = '';
      if (req.platformUrl) {
        const [base] = splitPathAndQuery(req.platformUrl);
        platformUrl = `${base}${suffix}`;
      }
      return { url: platformUrl, pathAndQuery: `${path}${suffix}` };
    });

    log.debug(`Handling ${req.method} ${path} on ${this.platform}`);

    const env: Record<string, unknown> = { [_SIGNATURE_TARGETS_ENV_KEY]: targets };
    if (req.platformBase) env[_PLATFORM_BASE_ENV_KEY] = req.platformBase;
    if (req.clientAddress) env[_CLIENT_ADDRESS_ENV_KEY] = req.clientAddress;
    const response = await app.fetch(request, env);

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      responseHeaders[k] = v;
    });

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: await response.text(),
    };
  }

  /**
   * Generate the platform-specific invocation URL for a deployed function.
   * @param opts - Optional overrides for region, project, function name, stage, or API ID.
   * @returns The constructed URL string.
   */
  generateUrl(opts?: {
    region?: string;
    projectId?: string;
    functionName?: string;
    stage?: string;
    apiId?: string;
  }): string {
    const functionName = opts?.functionName ?? process.env['AWS_LAMBDA_FUNCTION_NAME'] ?? 'agent';

    switch (this.platform) {
      case 'lambda': {
        const region = opts?.region ?? process.env['AWS_REGION'] ?? 'us-east-1';
        const apiId = opts?.apiId ?? 'API_ID';
        const stage = opts?.stage ?? 'prod';
        return `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
      }
      case 'gcf': {
        const project = opts?.projectId ?? process.env['GCLOUD_PROJECT'] ?? 'PROJECT';
        const region = opts?.region ?? process.env['FUNCTION_REGION'] ?? 'us-central1';
        return `https://${region}-${project}.cloudfunctions.net/${functionName}`;
      }
      case 'azure': {
        return `https://${functionName}.azurewebsites.net/api/${functionName}`;
      }
      case 'cgi': {
        return `http://localhost/cgi-bin/${functionName}`;
      }
      default:
        return `https://localhost/${functionName}`;
    }
  }

  /**
   * Create an AWS Lambda-compatible handler function from a Hono app.
   * @param app - A Hono-compatible application with a `fetch` method.
   * @returns A function that accepts a Lambda event and returns a promise of a serverless response.
   */
  static createLambdaHandler(app: {
    fetch: (req: Request, env?: Record<string, unknown>) => Response | Promise<Response>;
  }): (event: ServerlessEvent) => Promise<ServerlessResponse> {
    const adapter = new ServerlessAdapter('lambda');
    return (event: ServerlessEvent) => adapter.handleRequest(app, event);
  }

  /**
   * Create a Google Cloud Functions-compatible handler from a Hono app.
   * @param app - A Hono-compatible application with a `fetch` method.
   * @returns A function that accepts GCF request/response objects.
   */
  static createGcfHandler(app: {
    fetch: (req: Request, env?: Record<string, unknown>) => Response | Promise<Response>;
  }): (req: GcfRequest, res: GcfResponse) => Promise<void> {
    const adapter = new ServerlessAdapter('gcf');
    return async (req: GcfRequest, res: GcfResponse) => {
      const response = await adapter.dispatch(app, ServerlessAdapter.fromGcfRequest(req));
      res.status(response.statusCode);
      for (const [k, v] of Object.entries(response.headers)) {
        res.set(k, v);
      }
      res.send(response.body);
    };
  }

  /**
   * Reduce a Google Cloud Functions (Express-style) request. The signature is
   * checked over the raw body, since a re-serialized parsed body can differ
   * from the bytes SignalWire signed, and over the URL with its query.
   */
  private static fromGcfRequest(req: GcfRequest): PlatformRequest {
    const headers = lowerHeaders(req.headers);
    const relative = req.originalUrl ?? req.url ?? req.path ?? '/';
    const [urlPath, query] = splitPathAndQuery(relative);
    const proto = headers['x-forwarded-proto'] ?? req.protocol ?? 'https';
    const host = headers['host'];
    // SignalWire signs the URL it called: the webhook URL the SWML gave it,
    // which carries the function's name on cloudfunctions.net (or is under
    // FUNCTION_URL); the platform strips that name before the request
    // arrives. Only that URL is accepted: the stripped form would also accept
    // a signature made for another function on the same host.
    const origin = host ? `${proto}://${host}` : '';
    const base = host
      ? (process.env['FUNCTION_URL']?.replace(/\/+$/, '') ?? gcfBase(proto, host) ?? origin)
      : '';
    return {
      method: String(req.method ?? 'POST').toUpperCase(),
      path: req.path ?? urlPath ?? '/',
      query,
      queryVariants: [],
      platformUrl: base ? `${base}${relative}` : '',
      platformBase: gcfBase(proto, host),
      clientAddress: req.ip || req.socket?.remoteAddress || undefined,
      headers,
      body: rawBodyText(req.rawBody, req.body),
    };
  }

  /**
   * Reduce an Azure Functions request. Its URL is absolute, e.g.
   * `https://app.azurewebsites.net/api/<function>/swaig?code=...`; the path
   * below `/api/<function>` is routed, and the whole URL is what was signed.
   */
  private static fromAzureRequest(req: AzureRequest): PlatformRequest {
    const headers = lowerHeaders(req.headers);
    const raw = req.url ?? '/';
    let path = '/';
    let query = '';
    let platformBase: string | undefined;
    const absolute = /^https?:\/\//.test(raw);
    try {
      const parsed = new URL(raw, 'http://localhost');
      query = parsed.search.replace(/^\?/, '');
      const [, belowApi] = parsed.pathname.split(/\/api\//, 2);
      if (belowApi !== undefined) {
        const slash = belowApi.indexOf('/');
        path = slash === -1 ? '/' : belowApi.slice(slash) || '/';
        const fn = slash === -1 ? belowApi : belowApi.slice(0, slash);
        // The function's own URL, as the reference's Azure handler takes it.
        if (absolute) platformBase = `${parsed.origin}/api/${fn}`.replace(/\/+$/, '');
      } else {
        path = parsed.pathname || '/';
        if (absolute) platformBase = `${parsed.origin}/api`;
      }
    } catch {
      /* keep the defaults */
    }
    return {
      method: String(req.method ?? 'POST').toUpperCase(),
      path,
      query,
      queryVariants: [],
      platformUrl: absolute ? raw : '',
      platformBase,
      headers,
      body: rawBodyText(req.rawBody, req.body),
    };
  }

  /**
   * Reduce a CGI request from its environment and the body read from stdin.
   * `PATH_INFO` is routed; the signed URL includes the script's own path
   * (`SCRIPT_NAME`), as `REQUEST_URI` gives it.
   */
  private static fromCgiEnv(env: NodeJS.ProcessEnv, body?: string): PlatformRequest {
    const event = ServerlessAdapter.buildCgiEvent(env, body);
    const query = env['QUERY_STRING'] ?? '';
    const pathInfo = env['PATH_INFO'] || '/';
    const scheme = ['on', '1'].includes((env['HTTPS'] ?? '').toLowerCase()) ? 'https' : 'http';
    const host = env['HTTP_HOST'] || env['SERVER_NAME'] || 'localhost';
    const requestUri =
      env['REQUEST_URI'] || `${env['SCRIPT_NAME'] ?? ''}${pathInfo}${query ? `?${query}` : ''}`;
    return {
      method: String(env['REQUEST_METHOD'] || (body ? 'POST' : 'GET')).toUpperCase(),
      path: pathInfo.startsWith('/') ? pathInfo : `/${pathInfo}`,
      query,
      queryVariants: [],
      platformUrl: `${scheme}://${host}${requestUri}`,
      headers: lowerHeaders(event.headers),
      body,
      clientAddress: env['REMOTE_ADDR'] || undefined,
    };
  }

  /** Maximum CGI request body size (10MB), matching Python's `MAX_CGI_BODY_SIZE`. */
  static readonly MAX_CGI_BODY_SIZE = 10 * 1024 * 1024;

  /**
   * Build a {@link ServerlessEvent} from a CGI environment + request body.
   *
   * CGI has no "event" object: the request is described by environment variables
   * (`REQUEST_METHOD`, `PATH_INFO`, `QUERY_STRING`, `CONTENT_TYPE`, `HTTP_*`) and
   * the body arrives on stdin. This reconstructs the normalized event so a CGI
   * invocation dispatches through the same Hono routing as Lambda/GCF/Azure
   * (mirrors Python `serverless_mixin` CGI mode: `PATH_INFO` + stdin body).
   *
   * @param env - The process environment (defaults to `process.env`).
   * @param body - The already-read request body from stdin (optional).
   * @returns A normalized serverless event.
   */
  static buildCgiEvent(env: NodeJS.ProcessEnv = process.env, body?: string): ServerlessEvent {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (value == null) continue;
      if (key.startsWith('HTTP_')) {
        // HTTP_X_FOO -> x-foo
        const name = key.slice(5).toLowerCase().replace(/_/g, '-');
        headers[name] = value;
      }
    }
    if (env['CONTENT_TYPE']) headers['content-type'] = env['CONTENT_TYPE'];

    const pathInfo = env['PATH_INFO'] || '/';
    const path = pathInfo.startsWith('/') ? pathInfo : `/${pathInfo}`;

    let queryStringParameters: Record<string, string> | undefined;
    if (env['QUERY_STRING']) {
      queryStringParameters = {};
      for (const [k, v] of new URLSearchParams(env['QUERY_STRING'])) {
        queryStringParameters[k] = v;
      }
    }

    return {
      method: env['REQUEST_METHOD'] ?? 'POST',
      headers,
      path,
      body,
      ...(queryStringParameters ? { queryStringParameters } : {}),
    };
  }

  /**
   * Create a CGI handler that reads the request from the CGI environment + stdin,
   * routes it through the Hono app, and writes a CGI response (status line,
   * headers, blank line, body) to stdout.
   *
   * @param app - A Hono-compatible application with a `fetch` method.
   * @returns An async function that performs one CGI request/response cycle.
   */
  static createCgiHandler(app: {
    fetch: (req: Request, env?: Record<string, unknown>) => Response | Promise<Response>;
  }): () => Promise<void> {
    const adapter = new ServerlessAdapter('cgi');
    return async () => {
      await adapter._runCgi(app, process.env);
    };
  }

  /**
   * Run one CGI request/response cycle: read the body from stdin, route the
   * request, write the CGI response to stdout, and return it.
   * @internal Used by {@link createCgiHandler} and `AgentBase.runServerless`.
   */
  async _runCgi(
    app: { fetch: (req: Request, env?: Record<string, unknown>) => Response | Promise<Response> },
    env: NodeJS.ProcessEnv,
    body?: string,
    write: (text: string) => void = (text) => process.stdout.write(text),
  ): Promise<ServerlessResponse> {
    const requestBody = body ?? (await this.readStdin());
    const response = await this.dispatch(app, ServerlessAdapter.fromCgiEnv(env, requestBody));
    write(ServerlessAdapter.cgiResponseText(response));
    return response;
  }

  /** A complete CGI response: a status line, headers, a blank line, then the body. */
  private static cgiResponseText(response: ServerlessResponse): string {
    const statusText = CGI_STATUS_TEXT[response.statusCode] ?? '';
    const lines: string[] = [`Status: ${response.statusCode} ${statusText}`.trimEnd()];
    for (const [k, v] of Object.entries(response.headers)) {
      lines.push(`${k}: ${v}`);
    }
    lines.push('', response.body);
    return lines.join('\r\n');
  }

  /** Read the request body from stdin, honoring `CONTENT_LENGTH` when present. */
  private readStdin(): Promise<string | undefined> {
    return new Promise((resolvePromise) => {
      const contentLength = process.env['CONTENT_LENGTH'];
      if (contentLength === undefined || contentLength === '' || contentLength === '0') {
        resolvePromise(undefined);
        return;
      }
      const expected = Number.parseInt(contentLength, 10);
      if (!Number.isFinite(expected) || expected <= 0) {
        resolvePromise(undefined);
        return;
      }
      if (expected > ServerlessAdapter.MAX_CGI_BODY_SIZE) {
        log.error('CGI request body exceeds MAX_CGI_BODY_SIZE', { contentLength: expected });
        resolvePromise(undefined);
        return;
      }
      const chunks: Buffer[] = [];
      const stdin = process.stdin;
      stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
      stdin.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf-8')));
      stdin.on('error', () => resolvePromise(undefined));
    });
  }

  /**
   * Create an Azure Functions-compatible handler from a Hono app.
   * @param app - A Hono-compatible application with a `fetch` method.
   * @returns A function that accepts an Azure context and request object.
   */
  static createAzureHandler(app: {
    fetch: (req: Request, env?: Record<string, unknown>) => Response | Promise<Response>;
  }): (context: AzureContext, req: AzureRequest) => Promise<void> {
    const adapter = new ServerlessAdapter('azure');
    return async (context: AzureContext, req: AzureRequest) => {
      const response = await adapter.dispatch(app, ServerlessAdapter.fromAzureRequest(req));
      context.res = {
        status: response.statusCode,
        headers: response.headers,
        body: response.body,
      };
    };
  }
}
