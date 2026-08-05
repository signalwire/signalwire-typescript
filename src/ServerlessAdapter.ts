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
  /** Platform-specific request context metadata. */
  requestContext?: Record<string, unknown>;
}

/** Minimal Google Cloud Functions request shape (Express-style) consumed by {@link ServerlessAdapter.createGcfHandler}. */
export interface GcfRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  path?: string;
  url?: string;
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
  url?: string;
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
 * const adapter = new ServerlessAdapter('aws');
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
   * @param app - A Hono-compatible application with a `fetch` method.
   * @param event - The incoming serverless event to process.
   * @returns The normalized serverless response.
   */
  async handleRequest(
    app: { fetch: (req: Request) => Response | Promise<Response> },
    event: ServerlessEvent,
  ): Promise<ServerlessResponse> {
    const method = event.httpMethod ?? event.method ?? 'POST';
    const path = event.rawPath ?? event.path ?? '/';
    const headers = event.headers ?? {};

    // Build URL — prefer platform env vars over client headers
    const host = process.env['AWS_LAMBDA_FUNCTION_URL']
      ? new URL(process.env['AWS_LAMBDA_FUNCTION_URL']).hostname
      : (headers['host'] ?? 'localhost');
    const proto = process.env['AWS_LAMBDA_FUNCTION_URL']
      ? 'https'
      : (headers['x-forwarded-proto'] ?? 'https');
    let url = `${proto}://${host}${path}`;
    if (event.queryStringParameters) {
      const qs = new URLSearchParams(event.queryStringParameters).toString();
      if (qs) url += `?${qs}`;
    }

    // Build body. AWS API Gateway proxy events set isBase64Encoded=true and pass
    // the body base64-encoded; decode it back to the raw payload before routing
    // (mirrors Python serverless_mixin's base64 body handling).
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

    // Create Request
    const request = new Request(url, {
      method,
      headers: new Headers(headers),
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
    });

    log.debug(`Handling ${method} ${path} on ${this.platform}`);

    // Route through Hono
    const response = await app.fetch(request);

    // Convert back to serverless response
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
    fetch: (req: Request) => Response | Promise<Response>;
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
    fetch: (req: Request) => Response | Promise<Response>;
  }): (req: GcfRequest, res: GcfResponse) => Promise<void> {
    const adapter = new ServerlessAdapter('gcf');
    return async (req: GcfRequest, res: GcfResponse) => {
      const event: ServerlessEvent = {
        method: req.method,
        headers: req.headers,
        body: req.body,
        path: req.path ?? req.url,
      };
      const response = await adapter.handleRequest(app, event);
      res.status(response.statusCode);
      for (const [k, v] of Object.entries(response.headers)) {
        res.set(k, v);
      }
      res.send(response.body);
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

    const pathInfo = env['PATH_INFO'] ?? env['SCRIPT_NAME'] ?? '/';
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
    fetch: (req: Request) => Response | Promise<Response>;
  }): () => Promise<void> {
    const adapter = new ServerlessAdapter('cgi');
    return async () => {
      const body = await adapter.readStdin();
      const event = ServerlessAdapter.buildCgiEvent(process.env, body);
      const response = await adapter.handleRequest(app, event);

      const statusText = CGI_STATUS_TEXT[response.statusCode] ?? '';
      const lines: string[] = [`Status: ${response.statusCode} ${statusText}`.trimEnd()];
      for (const [k, v] of Object.entries(response.headers)) {
        lines.push(`${k}: ${v}`);
      }
      lines.push('', response.body);
      process.stdout.write(lines.join('\r\n'));
    };
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
    fetch: (req: Request) => Response | Promise<Response>;
  }): (context: AzureContext, req: AzureRequest) => Promise<void> {
    const adapter = new ServerlessAdapter('azure');
    return async (context: AzureContext, req: AzureRequest) => {
      const event: ServerlessEvent = {
        method: req.method,
        headers: req.headers,
        body: req.body,
        path: req.url,
      };
      const response = await adapter.handleRequest(app, event);
      context.res = {
        status: response.statusCode,
        headers: response.headers,
        body: response.body,
      };
    };
  }
}
