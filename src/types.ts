/**
 * Shared type definitions for SignalWire AI Agents SDK.
 */

/** Configuration options for constructing an AgentBase instance. */
export interface AgentOptions {
  /** Display name of the agent, also used as default basic-auth username when credentials are auto-generated. */
  name: string;
  /** HTTP route path the agent listens on (defaults to "/"). */
  route?: string;
  /** Hostname to bind the HTTP server to (defaults to "0.0.0.0"). */
  host?: string;
  /** Port number for the HTTP server (defaults to env PORT or 3000). */
  port?: number;
  /** Explicit basic-auth credentials as [username, password]; auto-generated if omitted. */
  basicAuth?: [string, string];
  /** Whether to use POM-based prompt rendering (defaults to true). */
  usePom?: boolean;
  /** Session token expiry in seconds (defaults to 3600). */
  tokenExpirySecs?: number;
  /** Whether to automatically insert an "answer" verb in the SWML call flow (defaults to true). */
  autoAnswer?: boolean;
  /** Whether to record the call (defaults to false). */
  recordCall?: boolean;
  /** Recording format, e.g. "mp4" (defaults to "mp4"). */
  recordFormat?: string;
  /** Whether to record in stereo (defaults to true). */
  recordStereo?: boolean;
  /** Default webhook URL for SWAIG function callbacks. */
  defaultWebhookUrl?: string;
  /** List of native function names to include in the SWAIG configuration. */
  nativeFunctions?: string[];
  /** Unique identifier for this agent instance; auto-generated if omitted. */
  agentId?: string;
  /** When true, suppresses all log output. */
  suppressLogs?: boolean;
  /**
   * Path to a JSON Schema file for SWML validation.
   * When provided, rendered SWML documents are validated against this schema.
   * Falls back to the built-in schema if omitted.
   */
  schemaPath?: string;
  /**
   * Whether to enable the post-prompt override endpoint.
   * When true, a `/post_prompt_override` route is registered that allows
   * external callers to replace the post-prompt text at runtime.
   * Defaults to false.
   */
  enablePostPromptOverride?: boolean;
  /**
   * Whether to enable the check-for-input override endpoint.
   * When true, a `/check_for_input` route is registered that allows
   * external callers to inject input checks at runtime.
   * Defaults to false.
   */
  checkForInputOverride?: boolean;
  /**
   * Path to a JSON configuration file.
   * When provided, the file is loaded at construction time and its
   * `service` section can override name, route, host, and port
   * (constructor arguments still take precedence over file values).
   */
  configFile?: string;
  /**
   * Whether to validate rendered SWML against the schema.
   * Can also be disabled via the `SWML_SKIP_SCHEMA_VALIDATION` env var.
   * Defaults to true.
   */
  schemaValidation?: boolean;
  /**
   * SignalWire Signing Key for verifying inbound webhook signatures.
   * When set, AgentBase auto-mounts the webhook signature validation
   * middleware on POST /, /swaig, and /post_prompt; unsigned or
   * mis-signed requests are rejected with 403.
   *
   * Falls back to the `SIGNALWIRE_SIGNING_KEY` environment variable when
   * omitted. When both are unset, signature validation is disabled and
   * the agent emits a one-time warning on startup so operators notice.
   *
   * Per `porting-sdk/webhooks.md`: this MUST be treated as secret —
   * never logged, never echoed to clients, never included in error
   * messages.
   */
  signingKey?: string;
  /**
   * When true, the webhook validation middleware honors
   * `X-Forwarded-Proto` / `X-Forwarded-Host` headers when reconstructing
   * the public URL the platform POSTed to. Default false because proxy
   * headers are spoofable; opt in only when you control the proxy.
   *
   * The `SWML_PROXY_URL_BASE` env var always takes precedence over both
   * forwarded headers and the raw request URL.
   */
  webhookTrustProxy?: boolean;
}

/** Configuration for a supported language in the AI agent. */
export interface LanguageConfig {
  /** Human-readable language name (e.g. "English"). */
  name: string;
  /** BCP-47 language code (e.g. "en-US"). */
  code: string;
  /** Voice identifier to use for this language. */
  voice?: string;
  /** TTS engine identifier. */
  engine?: string;
  /** Filler phrases keyed by category for this language. */
  fillers?: Record<string, string[]>;
  /** Speech recognition model identifier. */
  speechModel?: string;
  /** Per-function filler phrases, keyed by function name then language code. */
  functionFillers?: Record<string, Record<string, string[]>>;
  /**
   * Optional per-language params dict (engine-specific tuning, voice settings,
   * etc.). Emitted as the language object's `params` key in SWML — only
   * present in the wire payload when non-empty so existing entries remain
   * byte-identical when no params are passed.
   */
  params?: Record<string, unknown>;
}

/** Rule for overriding how the TTS engine pronounces a specific word or phrase. */
export interface PronunciationRule {
  /** The text pattern to match. */
  replace: string;
  /** The replacement pronunciation. */
  with: string;
  /** Whether the match should be case-insensitive. */
  ignoreCase?: boolean;
}

/** Reference to an external SWAIG function endpoint to include in the AI configuration. */
export interface FunctionInclude {
  /** URL of the remote SWAIG endpoint. */
  url: string;
  /** List of function names available at the remote endpoint. */
  functions: string[];
  /** Optional metadata to pass along with the include. */
  meta_data?: Record<string, unknown>;
}

/**
 * Callback invoked on each SWML request to dynamically modify an ephemeral copy of the agent.
 *
 * The ephemeral agent is typed as `import('./AgentBase.js').AgentBase` at
 * call sites but kept as a generic type parameter here to avoid a circular
 * import between `types.ts` and `AgentBase.ts`. Cast or import the type
 * explicitly at the call site if you need specific methods.
 *
 * @param queryParams - URL query parameters from the incoming request.
 * @param bodyParams - Parsed JSON body of the incoming request.
 * @param headers - HTTP headers from the incoming request.
 * @param agent - Ephemeral AgentBase copy that can be mutated without affecting the original.
 */
export type DynamicConfigCallback<TAgent = import('./AgentBase.js').AgentBase> = (
  queryParams: Record<string, string>,
  bodyParams: Record<string, unknown>,
  headers: Record<string, string>,
  agent: TAgent,
) => void | Promise<void>;

/**
 * Callback invoked when a post-prompt summary is received at the end of a call.
 * @param summary - Parsed summary object, or null if extraction failed.
 * @param rawData - The full raw post-prompt payload.
 */
export type SummaryCallback = (
  summary: Record<string, unknown> | null,
  rawData: Record<string, unknown>,
) => void | Promise<void>;
