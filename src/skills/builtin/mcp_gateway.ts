/**
 * MCP Gateway Skill - Bridge MCP servers with SWAIG functions.
 *
 * Port of the Python `MCPGatewaySkill`. Connects SignalWire agents to a
 * Model Context Protocol gateway HTTP service and dynamically registers
 * SWAIG tools for every MCP tool exposed by the configured services.
 *
 * Authentication: Bearer token (via `auth_token`) or HTTP Basic auth
 * (via `auth_user` + `auth_password`). Supports configurable timeouts,
 * retry attempts, and SSL verification.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { FunctionResult } from '../../FunctionResult.js';
import { getLogger } from '../../Logger.js';
import { validateUrl } from '../../SecurityUtils.js';
import { Agent as UndiciAgent } from 'undici';

const log = getLogger('McpGatewaySkill');

/** Configuration entry for a single MCP service to expose. */
interface McpServiceConfig {
  /** Service name as registered on the gateway. */
  name: string;
  /** Tools to expose: '*' for all, array of names to filter, or undefined. */
  tools?: string | string[];
}

/** MCP tool definition returned by the gateway's /services/<name>/tools endpoint. */
interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { type?: string; description?: string; enum?: unknown[]; default?: unknown }>;
    required?: string[];
  };
}

/**
 * Bridge MCP (Model Context Protocol) servers with SWAIG functions.
 *
 * When configured, calls a gateway's `/services` endpoint to discover MCP
 * services, enumerates each service's tools, and registers them as SWAIG
 * tools prefixed with `tool_prefix` (default `mcp_`). A hidden hangup hook
 * tool cleans up MCP sessions when the call ends.
 *
 * @example
 * ```ts
 * agent.addSkill('mcp_gateway', {
 *   gateway_url: 'https://mcp-gateway.example.com',
 *   tool_prefix: 'mcp_',
 * });
 * ```
 */
export class McpGatewaySkill extends SkillBase {
  // Python ground truth: skills/mcp_gateway/skill.py:~70-76
  // REQUIRED_PACKAGES = ["requests"] in Python; TS uses undici for SSL dispatch.
  // Python does not set SUPPORTS_MULTIPLE_INSTANCES so it inherits the default (False).
  static override SKILL_NAME = 'mcp_gateway';
  static override SKILL_DESCRIPTION = 'Bridge MCP servers with SWAIG functions';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_PACKAGES: readonly string[] = ['undici'];
  static override REQUIRED_ENV_VARS: readonly string[] = [];

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      gateway_url: {
        type: 'string',
        description: 'URL of the MCP Gateway service',
        required: true,
      },
      auth_token: {
        type: 'string',
        description:
          'Bearer token for authentication (alternative to basic auth)',
        required: false,
        hidden: true,
        env_var: 'MCP_GATEWAY_AUTH_TOKEN',
      },
      auth_user: {
        type: 'string',
        description:
          'Username for basic authentication (required if auth_token not provided)',
        required: false,
        env_var: 'MCP_GATEWAY_AUTH_USER',
      },
      auth_password: {
        type: 'string',
        description:
          'Password for basic authentication (required if auth_token not provided)',
        required: false,
        hidden: true,
        env_var: 'MCP_GATEWAY_AUTH_PASSWORD',
      },
      services: {
        type: 'array',
        description:
          'List of MCP services to connect to (empty for all available)',
        default: [],
        required: false,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Service name' },
            tools: {
              type: ['string', 'array'],
              description:
                "Tools to expose ('*' for all, or list of tool names)",
            },
          },
        },
      },
      session_timeout: {
        type: 'integer',
        description: 'Session timeout in seconds',
        default: 300,
        required: false,
      },
      tool_prefix: {
        type: 'string',
        description: 'Prefix for registered SWAIG function names',
        default: 'mcp_',
        required: false,
      },
      retry_attempts: {
        type: 'integer',
        description: 'Number of retry attempts for failed requests',
        default: 3,
        required: false,
      },
      request_timeout: {
        type: 'integer',
        description: 'Request timeout in seconds',
        default: 30,
        required: false,
      },
      verify_ssl: {
        type: 'boolean',
        description: 'Verify SSL certificates',
        default: true,
        required: false,
      },
    };
  }

  // Runtime state populated in setup()
  private gatewayUrl = '';
  private authToken: string | undefined;
  private authUser: string | undefined;
  private authPassword: string | undefined;
  private services: McpServiceConfig[] = [];
  private sessionTimeout = 300;
  private toolPrefix = 'mcp_';
  private retryAttempts = 3;
  private requestTimeout = 30;
  private verifySsl = true;
  private _discoveredTools: SkillToolDefinition[] = [];
  private _ready = false;
  /**
   * Cached undici Agent used when `verify_ssl=false`. Created once in
   * `setup()` and reused across every `_makeRequest` call to avoid
   * connection-pool churn (Python reuses `requests.Session` implicitly).
   */
  private _undiciAgent: UndiciAgent | undefined;

  override async setup(): Promise<boolean> {
    this.authToken =
      this.getConfig<string | undefined>('auth_token', undefined) ??
      process.env['MCP_GATEWAY_AUTH_TOKEN'];

    const gatewayUrl = this.getConfig<string | undefined>('gateway_url', undefined);
    if (!gatewayUrl) {
      log.error('mcp_gateway: missing required parameter: gateway_url');
      return false;
    }

    if (!this.authToken) {
      this.authUser =
        this.getConfig<string | undefined>('auth_user', undefined) ??
        process.env['MCP_GATEWAY_AUTH_USER'];
      this.authPassword =
        this.getConfig<string | undefined>('auth_password', undefined) ??
        process.env['MCP_GATEWAY_AUTH_PASSWORD'];
      if (!this.authUser || !this.authPassword) {
        log.error(
          'mcp_gateway: missing required parameters: auth_token or (auth_user + auth_password)',
        );
        return false;
      }
    }

    this.gatewayUrl = gatewayUrl.replace(/\/+$/, '');

    // SSRF protection — match Python skills/mcp_gateway/skill.py:147-148 which
    // calls validate_url(self.gateway_url) before the health check. Reject
    // private/loopback/metadata-endpoint URLs in multi-tenant deployments.
    if (!(await validateUrl(this.gatewayUrl))) {
      log.error('mcp_gateway: gateway_url rejected by SSRF protection', {
        url: this.gatewayUrl,
      });
      return false;
    }

    this.services =
      this.getConfig<McpServiceConfig[]>('services', []) ?? [];
    this.sessionTimeout = this.getConfig<number>('session_timeout', 300);
    this.toolPrefix = this.getConfig<string>('tool_prefix', 'mcp_');
    this.retryAttempts = this.getConfig<number>('retry_attempts', 3);
    this.requestTimeout = this.getConfig<number>('request_timeout', 30);
    this.verifySsl = this.getConfig<boolean>('verify_ssl', true);

    // Cache a single undici Agent for SSL-bypass mode so each request reuses
    // the same connection pool (parity with Python requests.Session behavior).
    if (!this.verifySsl) {
      this._undiciAgent = new UndiciAgent({
        connect: { rejectUnauthorized: false },
      });
    }

    // Validate gateway connectivity
    try {
      const health = await this._makeRequest('GET', `${this.gatewayUrl}/health`);
      if (!health.ok) {
        log.error('mcp_gateway: gateway health check failed', {
          status: health.status,
        });
        return false;
      }
      log.info('mcp_gateway: connected', { url: this.gatewayUrl });
    } catch (err) {
      log.error('mcp_gateway: failed to connect to gateway', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }

    // Discover tools (equivalent of Python register_tools())
    try {
      await this._discoverTools();
      this._ready = true;
      return true;
    } catch (err) {
      log.error('mcp_gateway: tool discovery failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  override getHints(): string[] {
    const hints = ['MCP', 'gateway'];
    const services =
      this.services.length > 0
        ? this.services
        : (this.getConfig<McpServiceConfig[]>('services', []) ?? []);
    for (const service of services) {
      if (service && typeof service === 'object' && service.name) {
        hints.push(service.name);
      }
    }
    return hints;
  }

  override getGlobalData(): Record<string, unknown> {
    if (!this._ready) return {};
    // Python skill.py emits mcp_session_id = self.session_id, which Python
    // initializes to None in setup() and never updates. Per-call session IDs
    // live in local scope inside _call_mcp_tool — never mutate shared state.
    return {
      mcp_gateway_url: this.gatewayUrl,
      mcp_session_id: null,
      mcp_services: this.services.map((s) =>
        typeof s === 'object' && s !== null ? s.name : String(s),
      ),
    };
  }

  /**
   * @returns Dynamically discovered MCP tools plus an internal hangup-cleanup
   *          tool. If discovery has not completed, returns a single fallback
   *          `mcp_invoke` tool that explains configuration is missing.
   */
  getTools(): SkillToolDefinition[] {
    if (!this._ready || this._discoveredTools.length === 0) {
      return [
        {
          name: 'mcp_invoke',
          description:
            'MCP gateway is not configured. Provide gateway_url and credentials to enable this skill.',
          parameters: {
            server: {
              type: 'string',
              description: 'The MCP server/service name.',
            },
            method: {
              type: 'string',
              description: 'The method/tool name to invoke.',
            },
            params: {
              type: 'object',
              description: 'Parameters to pass to the MCP method.',
            },
          },
          required: ['server', 'method'],
          handler: () =>
            new FunctionResult(
              'MCP gateway is not configured. Set gateway_url and an auth method (auth_token or auth_user/auth_password) on the skill config.',
            ),
        },
      ];
    }

    // Append hangup hook tool — isHangupHook causes the platform to auto-fire
    // this on call hangup (Python: is_hangup_hook=True in define_tool).
    const tools = [...this._discoveredTools];
    tools.push({
      name: '_mcp_gateway_hangup',
      description: 'Internal cleanup function for MCP sessions',
      parameters: {},
      handler: (args: Record<string, unknown>, rawData: Record<string, unknown>) =>
        this._hangupHandler(args, rawData),
      isHangupHook: true,
    });
    return tools;
  }

  /** @returns Prompt section listing configured MCP services. */
  protected override _getPromptSections(): SkillPromptSection[] {
    // Prefer runtime-resolved services (after setup); fall back to config.
    const services =
      this.services.length > 0
        ? this.services
        : (this.getConfig<McpServiceConfig[]>('services', []) ?? []);
    const gatewayUrl = this.gatewayUrl || this.getConfig<string>('gateway_url', '');
    const toolPrefix = this.toolPrefix || this.getConfig<string>('tool_prefix', 'mcp_');
    const serviceDescriptions: string[] = [];
    for (const service of services) {
      if (typeof service !== 'object' || service === null) continue;
      const name = service.name ?? 'Unknown';
      const tools = service.tools ?? '*';
      if (tools === '*') {
        serviceDescriptions.push(`${name} (all tools)`);
      } else if (Array.isArray(tools)) {
        serviceDescriptions.push(`${name} (${tools.length} tools)`);
      } else {
        serviceDescriptions.push(String(name));
      }
    }

    if (serviceDescriptions.length === 0) {
      return [];
    }

    return [
      {
        title: 'MCP Gateway Integration',
        body: 'You have access to external MCP (Model Context Protocol) services through a gateway.',
        bullets: [
          `Connected to gateway at ${gatewayUrl}`,
          `Available services: ${serviceDescriptions.join(', ')}`,
          `Functions are prefixed with '${toolPrefix}' followed by service name`,
          'Each service maintains its own session state throughout the call',
        ],
      },
    ];
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Build auth + timeout-bearing fetch request to the gateway. */
  private async _makeRequest(
    method: string,
    url: string,
    options: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    } else if (this.authUser && this.authPassword) {
      const creds = Buffer.from(`${this.authUser}:${this.authPassword}`).toString(
        'base64',
      );
      headers['Authorization'] = `Basic ${creds}`;
    }

    const init: RequestInit & { dispatcher?: unknown } = { method, headers };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.requestTimeout * 1000,
    );
    init.signal = controller.signal;

    // Mirror Python `requests.request(..., verify=self.verify_ssl)`. Node's
    // built-in fetch has no SSL toggle, so reuse the undici Agent cached in
    // setup() rather than spinning up a fresh one on every call.
    if (this._undiciAgent) {
      init.dispatcher = this._undiciAgent;
    }

    try {
      return await fetch(url, init as RequestInit);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Discover available services and register each MCP tool as a SWAIG tool. */
  private async _discoverTools(): Promise<void> {
    this._discoveredTools = [];

    // If no services configured, fetch all available
    let services = this.services;
    if (services.length === 0) {
      const response = await this._makeRequest(
        'GET',
        `${this.gatewayUrl}/services`,
      );
      if (!response.ok) {
        log.error('mcp_gateway: failed to list services', {
          status: response.status,
        });
        return;
      }
      const allServices = (await response.json()) as Record<string, unknown>;
      services = Object.keys(allServices).map((name) => ({ name }));
      this.services = services;
    }

    for (const serviceConfig of services) {
      const serviceName = serviceConfig?.name;
      if (!serviceName) continue;

      try {
        const response = await this._makeRequest(
          'GET',
          `${this.gatewayUrl}/services/${encodeURIComponent(serviceName)}/tools`,
        );
        if (!response.ok) {
          log.error('mcp_gateway: failed to get tools for service', {
            service: serviceName,
            status: response.status,
          });
          continue;
        }
        const data = (await response.json()) as { tools?: McpToolDefinition[] };
        let tools = data.tools ?? [];

        // Filter tools if specified
        const toolFilter = serviceConfig.tools ?? '*';
        if (toolFilter !== '*' && Array.isArray(toolFilter)) {
          tools = tools.filter((t) => toolFilter.includes(t.name));
        }

        for (const toolDef of tools) {
          const registered = this._registerMcpTool(serviceName, toolDef);
          if (registered) this._discoveredTools.push(registered);
        }
      } catch (err) {
        log.error('mcp_gateway: error fetching tools for service', {
          service: serviceName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /** Convert an MCP tool definition into a SWAIG-compatible `SkillToolDefinition`. */
  private _registerMcpTool(
    serviceName: string,
    toolDef: McpToolDefinition,
  ): SkillToolDefinition | null {
    const toolName = toolDef.name;
    if (!toolName) return null;

    const swaigName = `${this.toolPrefix}${serviceName}_${toolName}`;

    const inputSchema = toolDef.inputSchema ?? {};
    const properties = inputSchema.properties ?? {};
    const required = inputSchema.required ?? [];

    const swaigParams: Record<string, Record<string, unknown>> = {};
    for (const [propName, propDef] of Object.entries(properties)) {
      const paramDef: Record<string, unknown> = {
        type: propDef.type ?? 'string',
        description: propDef.description ?? '',
      };
      if (propDef.enum !== undefined) paramDef['enum'] = propDef.enum;
      if (propDef.default !== undefined && !required.includes(propName)) {
        paramDef['default'] = propDef.default;
      }
      swaigParams[propName] = paramDef;
    }

    log.info('mcp_gateway: registering SWAIG tool', { name: swaigName });

    return {
      name: swaigName,
      description: `[${serviceName}] ${toolDef.description ?? toolName}`,
      parameters: swaigParams,
      required,
      handler: async (
        args: Record<string, unknown>,
        rawData: Record<string, unknown>,
      ) => this._callMcpTool(serviceName, toolName, args, rawData),
    };
  }

  /** Call an MCP tool through the gateway, with retries. */
  private async _callMcpTool(
    serviceName: string,
    toolName: string,
    args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const globalData = (rawData['global_data'] as Record<string, unknown>) ?? {};
    log.debug('mcp_gateway: raw_data keys', { keys: Object.keys(rawData) });
    log.debug('mcp_gateway: global_data keys', { keys: Object.keys(globalData) });
    let sessionId: string;
    if (typeof globalData['mcp_call_id'] === 'string') {
      sessionId = globalData['mcp_call_id'] as string;
      log.info('mcp_gateway: using session ID from global_data.mcp_call_id', {
        sessionId,
      });
    } else {
      sessionId = (rawData['call_id'] as string) ?? 'unknown';
      log.info('mcp_gateway: using session ID from call_id', { sessionId });
    }
    // NB: do NOT mutate this.sessionId here — Python leaves self.session_id
    // untouched after setup(). Per-call IDs stay local so concurrent tool
    // calls don't race and overwrite each other's session metadata.

    const requestData: Record<string, unknown> = {
      tool: toolName,
      arguments: args,
      session_id: sessionId,
      timeout: this.sessionTimeout,
      metadata: {
        // Python sends self.agent.name; mirror that and fall back to the
        // skill name when agent is not yet bound. No hardcoded SDK literal.
        agent_id: this.agent?.name ?? this.skillName,
        timestamp: rawData['timestamp'],
        call_id: rawData['call_id'],
      },
    };

    let lastError: string | undefined;
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await this._makeRequest(
          'POST',
          `${this.gatewayUrl}/services/${encodeURIComponent(serviceName)}/call`,
          { body: requestData },
        );

        if (response.status === 200) {
          const resultData = (await response.json()) as {
            result?: unknown;
          };
          // Python returns result_data.get('result', 'No response') which yields
          // the raw string 'No response' when the key is missing. Preserve that:
          // only stringify when the value is defined and non-string.
          let resultText: string;
          if (typeof resultData.result === 'string') {
            resultText = resultData.result;
          } else if (resultData.result != null) {
            resultText = JSON.stringify(resultData.result);
          } else {
            resultText = 'No response';
          }
          return new FunctionResult(resultText);
        }

        let errorMsg: string;
        try {
          const errorData = (await response.json()) as { error?: string };
          errorMsg = errorData.error ?? `HTTP ${response.status}`;
        } catch {
          // Python includes the first 200 chars of the response body when the
          // payload isn't valid JSON (skill.py error handler). Match that.
          const bodyText = await response.text().catch(() => '');
          errorMsg = bodyText
            ? `HTTP ${response.status}: ${bodyText.slice(0, 200)}`
            : `HTTP ${response.status}`;
        }
        lastError = errorMsg;

        if (response.status >= 500) {
          log.warn('mcp_gateway: server error, retrying', {
            attempt: attempt + 1,
            error: errorMsg,
          });
          continue;
        }
        // Client error — don't retry
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // Distinguish network/timeout errors (retriable) from programming
        // errors like JSON parse failures on success responses (fatal).
        // Python aborts the retry loop on non-network exceptions; mirror that.
        const isNetwork =
          err instanceof Error &&
          (err.name === 'AbortError' ||
            err.name === 'TypeError' ||
            err.message.includes('fetch'));
        if (!isNetwork) {
          log.error('mcp_gateway: unexpected error, aborting retry', {
            attempt: attempt + 1,
            error: lastError,
          });
          break;
        }
        log.warn('mcp_gateway: request error', {
          attempt: attempt + 1,
          error: lastError,
        });
      }
    }

    const errorMsg = `Failed to call ${serviceName}.${toolName}: ${lastError ?? 'unknown error'}`;
    log.error('mcp_gateway: call failed', { error: errorMsg });
    return new FunctionResult(errorMsg);
  }

  /** Handle call hangup — clean up any MCP session on the gateway. */
  private async _hangupHandler(
    _args: Record<string, unknown>,
    rawData: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const globalData = (rawData['global_data'] as Record<string, unknown>) ?? {};
    const sessionId =
      (globalData['mcp_call_id'] as string | undefined) ??
      (rawData['call_id'] as string | undefined) ??
      'unknown';

    try {
      const response = await this._makeRequest(
        'DELETE',
        `${this.gatewayUrl}/sessions/${encodeURIComponent(sessionId)}`,
      );

      if (response.status === 200 || response.status === 404) {
        log.info('mcp_gateway: cleaned up MCP session', { sessionId });
      } else {
        log.warn('mcp_gateway: session cleanup returned non-ok status', {
          status: response.status,
        });
      }
    } catch (err) {
      log.error('mcp_gateway: error cleaning up session', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return new FunctionResult('Session cleanup complete');
  }
}

/**
 * Factory function for creating McpGatewaySkill instances.
 * @param config - Optional skill configuration.
 * @returns A new McpGatewaySkill instance.
 */
export function createSkill(config?: SkillConfig): McpGatewaySkill {
  return new McpGatewaySkill(config);
}
