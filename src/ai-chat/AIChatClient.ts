/**
 * AIChatClient — async client for the SignalWire AI Chat service.
 *
 * Speaks the standard SignalWire front-door protocol: HTTP Basic
 * `project:api_token` with the space in the hostname —
 * `POST https://{space}.signalwire.com/api/ai/chat` — carrying a JSON-RPC 2.0
 * body whose params are pure payload (identity NEVER appears in the body; it
 * rides the Basic-auth header only).
 *
 * Async by nature: a {@link AIChatClient.chat} call awaits a full LLM round trip
 * (seconds, not milliseconds). The service streams keepalive whitespace ahead of
 * a slow response body (proxy read-timeout protection), so liveness is byte-driven
 * rather than wall-clock: there is no total-request timeout an idle turn could
 * trip — only a per-read idle timeout, mirroring the python reference's
 * `aiohttp.ClientTimeout(total=None, connect=10, sock_read=60)`. Leading whitespace
 * is valid JSON, so the buffered `response.json()` parse is unaffected.
 *
 * Mirrors the python reference `signalwire.ai_chat.AIChatClient`.
 *
 * @example
 * ```ts
 * import { AIChatClient } from '@signalwire/sdk';
 *
 * const client = new AIChatClient({ space: 'myspace' }); // env supplies creds
 * await client.createConversation('conv-1', { configUrl: 'https://example.com/agent.yaml' });
 * const reply = await client.chat('conv-1', 'hello');
 * console.log(reply.text);
 * ```
 */

/** Default endpoint path appended to a `space`-derived base URL. */
const DEFAULT_PATH = '/api/ai/chat';

/**
 * Idle read timeout (seconds) for a single request. The service streams keepalive
 * whitespace roughly every 10s, so this bounds true byte-silence (a dead
 * connection), NOT total turn length — mirroring the python reference's
 * `sock_read=60`. `fetch` has no native per-read timeout, so this is applied as a
 * bounded read the streaming proxy's heartbeat keeps alive. A total wall-clock cap
 * is deliberately absent — a slow-but-live turn must never be severed by the client.
 */
const DEFAULT_READ_IDLE_TIMEOUT_SECONDS = 60;

// ── Errors ───────────────────────────────────────────────────────────

/**
 * Base error for AI Chat service failures. Every typed subclass carries the
 * JSON-RPC error `code` (or `null` when the failure rode the success envelope,
 * as with {@link SummaryError}) and the server `message`.
 *
 * Callers catch this one family (`instanceof AIChatError`) for every AI-Chat
 * failure and can branch on `code` or the subclass type.
 */
export class AIChatError extends Error {
  /** JSON-RPC error code, or `null` when the failure rode the success envelope. */
  readonly code: number | null;
  /** The server-provided error message (without the `[code]` prefix). */
  readonly serverMessage: string;

  /**
   * @param code - JSON-RPC error code, or `null` (a success-envelope failure).
   * @param message - The server-provided error message.
   */
  constructor(code: number | null, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'AIChatError';
    this.code = code;
    this.serverMessage = message;
  }
}

/** Missing/rejected identity (HTTP 401 / JSON-RPC -32009). */
export class AuthenticationError extends AIChatError {
  constructor(code: number | null, message: string) {
    super(code, message);
    this.name = 'AuthenticationError';
  }
}

/** The conversation does not exist in this project (-32001). */
export class ConversationNotFoundError extends AIChatError {
  constructor(code: number | null, message: string) {
    super(code, message);
    this.name = 'ConversationNotFoundError';
  }
}

/** Project or conversation rate limit hit (-32005 / -32006). */
export class RateLimitError extends AIChatError {
  constructor(code: number | null, message: string) {
    super(code, message);
    this.name = 'RateLimitError';
  }
}

/** Another message is being processed for this conversation (-32007). */
export class ChatInProgressError extends AIChatError {
  constructor(code: number | null, message: string) {
    super(code, message);
    this.name = 'ChatInProgressError';
  }
}

/**
 * Summary generation failed. `summarize` returns EXACTLY ONE of `{summary}`
 * (success) or `{error}` (generation failed), and the failure rides the JSON-RPC
 * *success* envelope — not an `error` object — so it never reaches the error-code
 * mapping. Surfaced here so a failed summary can't masquerade as an empty string.
 * `code` is `null` (no JSON-RPC code).
 */
export class SummaryError extends AIChatError {
  constructor(code: number | null, message: string) {
    super(code, message);
    this.name = 'SummaryError';
  }
}

/** JSON-RPC error code → the typed error constructor it maps to. */
const ERROR_BY_CODE: Record<number, new (code: number | null, message: string) => AIChatError> = {
  [-32001]: ConversationNotFoundError,
  [-32005]: RateLimitError,
  [-32006]: RateLimitError,
  [-32007]: ChatInProgressError,
  [-32009]: AuthenticationError,
};

// ── Response models ──────────────────────────────────────────────────

/** Result of {@link AIChatClient.createConversation}. */
export interface ConversationInfo {
  /** The conversation id (echoed back — the caller's own input). */
  id: string;
  /** Lifecycle status the service reported (e.g. `"created"`). */
  status: string;
  /** The opening assistant message, if the config produced one. */
  initialMessage: string | null;
}

/** Result of {@link AIChatClient.chat}. */
export interface ChatResponse {
  /** The assistant's reply text (the wire `response` field). */
  text: string;
  /** The conversation id this reply belongs to. */
  conversationId: string;
  /** An optional structured event the turn emitted, else `null`. */
  userEvent: Record<string, unknown> | null;
}

/** Result of {@link AIChatClient.log}. */
export interface ChatLog {
  /** Full message history (the wire `chat_log` field). */
  messages: Array<Record<string, unknown>>;
  /** The call timeline (the wire `call_timeline` field). */
  callTimeline: Array<Record<string, unknown>>;
}

// ── Options ──────────────────────────────────────────────────────────

/** Constructor options for {@link AIChatClient}. */
export interface AIChatClientOptions {
  /** Project id (Basic-auth username). Falls back to `SIGNALWIRE_PROJECT_ID`. */
  project?: string;
  /** API token (Basic-auth password). Falls back to `SIGNALWIRE_API_TOKEN`. */
  token?: string;
  /** Space name; builds `https://{space}.signalwire.com/api/ai/chat`. Falls back to `SIGNALWIRE_SPACE`. */
  space?: string;
  /** Fully-qualified endpoint URL, used verbatim (highest precedence). */
  url?: string;
  /** Override the `fetch` implementation (dependency injection for tests). */
  fetchImpl?: typeof globalThis.fetch;
  /** Idle read timeout in seconds (byte-silence, NOT total turn length). Default 60. `0` disables. */
  readIdleTimeoutSeconds?: number;
}

/** Per-turn options common to {@link AIChatClient.createConversation} and {@link AIChatClient.chat}. */
export interface ConversationTurnOptions {
  /** Config URL locating the agent config (required on create; auto-creates on chat). */
  configUrl?: string;
  /** Conversation inactivity timeout in seconds (wire `conversation_timeout`). */
  timeout?: number;
  /** Reinitialize an existing conversation. */
  reinit?: boolean;
  /** Arbitrary caller metadata (wire `user_meta_data`). */
  userMetadata?: Record<string, unknown>;
}

/** Options for {@link AIChatClient.createConversation}. */
export interface CreateConversationOptions extends ConversationTurnOptions {
  /** Config URL locating the agent config (required). */
  configUrl: string;
  /** The opening user message to send with the create (wire `user_message`). */
  userMessage?: string;
}

/** Options for {@link AIChatClient.chat}. */
export interface ChatOptions extends ConversationTurnOptions {
  /** Message role (`"user"` or `"system"`). Default `"user"`. */
  role?: string;
}

/** Sampling / prompt options for {@link AIChatClient.summarize}. */
export interface SummarizeOptions {
  /** Custom prompt steering the summary (wire `summary_prompt`). */
  summaryPrompt?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Nucleus-sampling top-p. */
  topP?: number;
  /** Frequency penalty. */
  frequencyPenalty?: number;
  /** Presence penalty. */
  presencePenalty?: number;
  /** Max tokens for the summary. */
  maxTokens?: number;
}

type JsonRpcParams = Record<string, unknown>;

interface JsonRpcErrorObject {
  code?: number;
  message?: string;
}

interface JsonRpcResponse {
  result?: unknown;
  error?: JsonRpcErrorObject | null;
}

// ── Client ───────────────────────────────────────────────────────────

/** Async client for the SignalWire AI Chat service. */
export class AIChatClient {
  /** Fully-qualified endpoint URL requests are POSTed to. */
  readonly url: string;
  private readonly _authHeader: string;
  private readonly _fetch: typeof globalThis.fetch;
  private readonly _readIdleTimeoutSeconds: number;
  private _requestCounter = 0;

  /**
   * @param options - Connection + credential options. Either `url` or `space`
   *   (or `SIGNALWIRE_SPACE`) must resolve a target; `project` is required (arg
   *   or `SIGNALWIRE_PROJECT_ID`).
   * @throws {Error} When no project is available, or no URL can be resolved.
   */
  constructor(options: AIChatClientOptions = {}) {
    const project = options.project ?? process.env['SIGNALWIRE_PROJECT_ID'] ?? '';
    const token = options.token ?? process.env['SIGNALWIRE_API_TOKEN'] ?? '';
    const space = options.space ?? process.env['SIGNALWIRE_SPACE'] ?? '';

    if (!project) {
      throw new Error(
        'project is required. Provide it as an option or set the ' +
          'SIGNALWIRE_PROJECT_ID environment variable.',
      );
    }

    this.url = AIChatClient._resolveUrl(options.url, space);
    this._authHeader = 'Basic ' + Buffer.from(`${project}:${token}`).toString('base64');
    this._fetch = options.fetchImpl ?? globalThis.fetch;
    this._readIdleTimeoutSeconds =
      options.readIdleTimeoutSeconds ?? DEFAULT_READ_IDLE_TIMEOUT_SECONDS;
  }

  private static _resolveUrl(url: string | undefined, space: string): string {
    if (url) return url;
    if (space) return `https://${space}.signalwire.com${DEFAULT_PATH}`;
    throw new Error('No service URL: provide url= or space= / SIGNALWIRE_SPACE.');
  }

  // ── Wire ─────────────────────────────────────────────────────────

  /**
   * POST one JSON-RPC call and return its decoded `result` object.
   *
   * Success/failure is decided by the JSON-RPC BODY, not the HTTP status: the
   * service's keepalive heartbeat commits `200` before the turn's outcome is
   * known, so a slow error can arrive as `200 + {"error": …}`. Never gate on
   * `response.status` here (mirrors the python reference).
   *
   * @throws {AIChatError} (or a typed subclass) when the body carries `error`.
   */
  private async _request(method: string, params: JsonRpcParams): Promise<Record<string, unknown>> {
    this._requestCounter += 1;
    const payload = {
      jsonrpc: '2.0',
      method,
      params,
      id: `req-${this._requestCounter}`,
    };

    const response = await this._fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: this._authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: this._readIdleSignal(),
    });

    // Buffer the whole body then parse. Leading keepalive whitespace is valid
    // JSON, so a plain parse handles it — no need to strip.
    const text = await response.text();
    let body: JsonRpcResponse;
    try {
      body = JSON.parse(text) as JsonRpcResponse;
    } catch {
      throw new AIChatError(response.status, `non-JSON response (HTTP ${response.status})`);
    }

    if (body.error != null) {
      const error = body.error;
      const code = typeof error.code === 'number' ? error.code : null;
      const ctor = code !== null ? (ERROR_BY_CODE[code] ?? AIChatError) : AIChatError;
      throw new ctor(code, error.message ?? '');
    }

    const result = body.result;
    return result != null && typeof result === 'object' ? (result as Record<string, unknown>) : {};
  }

  /**
   * The per-request AbortSignal enforcing the read-idle timeout. `fetch` has no
   * per-read timeout, so this is a bounded total for the whole buffered read;
   * because the mock (and the real proxy) heartbeat well within the window, a
   * live-but-slow turn never trips it, while a truly dead connection is severed
   * after `readIdleTimeoutSeconds` of silence. A value of `0` disables it.
   */
  private _readIdleSignal(): AbortSignal | undefined {
    if (this._readIdleTimeoutSeconds <= 0) return undefined;
    return AbortSignal.timeout(this._readIdleTimeoutSeconds * 1000);
  }

  // ── API methods ──────────────────────────────────────────────────

  /**
   * Create a conversation (or, with `reinit`, reinitialize an existing one) and
   * optionally send its opening user message.
   *
   * @param conversationId - The conversation id to create.
   * @param options - Must include `configUrl`; other fields are optional.
   * @returns The created conversation's status + optional opening message.
   */
  async createConversation(
    conversationId: string,
    options: CreateConversationOptions,
  ): Promise<ConversationInfo> {
    const params: JsonRpcParams = { id: conversationId, config_url: options.configUrl };
    if (options.userMessage) params['user_message'] = options.userMessage;
    if (options.timeout) params['conversation_timeout'] = options.timeout;
    if (options.userMetadata) params['user_meta_data'] = options.userMetadata;
    if (options.reinit) params['reinit'] = true;

    const result = await this._request('create_conversation', params);
    return {
      id: conversationId,
      status: typeof result['status'] === 'string' ? (result['status'] as string) : 'created',
      initialMessage:
        typeof result['initial_message'] === 'string'
          ? (result['initial_message'] as string)
          : null,
    };
  }

  /**
   * Send a message and await a full LLM round trip.
   *
   * Passing `configUrl` auto-creates the conversation if it doesn't exist yet;
   * `timeout` and `reinit` apply to that auto-create, with the same meaning as on
   * {@link createConversation}. Expect seconds — the turn awaits the model.
   *
   * @param conversationId - The conversation to send into.
   * @param message - The user (or system) message text.
   * @param options - Optional role / auto-create / metadata fields.
   * @returns The assistant reply text plus any structured user event.
   */
  async chat(
    conversationId: string,
    message: string,
    options: ChatOptions = {},
  ): Promise<ChatResponse> {
    const params: JsonRpcParams = {
      id: conversationId,
      message,
      role: options.role ?? 'user',
    };
    if (options.configUrl) params['config_url'] = options.configUrl;
    if (options.userMetadata) params['user_meta_data'] = options.userMetadata;
    if (options.timeout) params['conversation_timeout'] = options.timeout;
    if (options.reinit) params['reinit'] = true;

    const result = await this._request('chat', params);
    return {
      text: typeof result['response'] === 'string' ? (result['response'] as string) : '',
      conversationId,
      userEvent:
        result['user_event'] != null && typeof result['user_event'] === 'object'
          ? (result['user_event'] as Record<string, unknown>)
          : null,
    };
  }

  /**
   * End a conversation (triggers server-side post-processing / archival).
   *
   * @param conversationId - The conversation to end.
   * @returns `true` when the service reported the conversation ended.
   */
  async end(conversationId: string): Promise<boolean> {
    const result = await this._request('end_conversation', { id: conversationId });
    return result['status'] === 'ended';
  }

  /**
   * Permanently delete a conversation and its data. Idempotent.
   *
   * @param conversationId - The conversation to delete.
   * @returns `true` when the service reported the conversation deleted.
   */
  async delete(conversationId: string): Promise<boolean> {
    const result = await this._request('delete', { id: conversationId });
    return result['status'] === 'deleted';
  }

  /**
   * Return the full message history plus the call timeline.
   *
   * @param conversationId - The conversation to read.
   * @returns The message list and call timeline.
   */
  async log(conversationId: string): Promise<ChatLog> {
    const result = await this._request('chat_log', { id: conversationId });
    return {
      messages: Array.isArray(result['chat_log'])
        ? (result['chat_log'] as Array<Record<string, unknown>>)
        : [],
      callTimeline: Array.isArray(result['call_timeline'])
        ? (result['call_timeline'] as Array<Record<string, unknown>>)
        : [],
    };
  }

  /**
   * Return an AI summary of the conversation (rate limited server-side).
   *
   * The service returns EXACTLY ONE of `{summary}` or `{error}` — BOTH on the
   * success envelope — so a failed generation must surface as a thrown
   * {@link SummaryError}, never as an empty string.
   *
   * @param conversationId - The conversation to summarize.
   * @param options - Optional custom prompt + sampling parameters.
   * @returns The summary text.
   * @throws {SummaryError} When the service reports summary generation failed.
   */
  async summarize(conversationId: string, options?: SummarizeOptions): Promise<string> {
    const params: JsonRpcParams = { id: conversationId };
    if (options?.summaryPrompt) params['summary_prompt'] = options.summaryPrompt;
    if (options?.temperature !== undefined) params['temperature'] = options.temperature;
    if (options?.topP !== undefined) params['top_p'] = options.topP;
    if (options?.frequencyPenalty !== undefined) {
      params['frequency_penalty'] = options.frequencyPenalty;
    }
    if (options?.presencePenalty !== undefined) {
      params['presence_penalty'] = options.presencePenalty;
    }
    if (options?.maxTokens !== undefined) params['max_tokens'] = options.maxTokens;

    const result = await this._request('summarize', params);
    if ('error' in result && !('summary' in result)) {
      throw new SummaryError(null, String(result['error']));
    }
    const summary = result['summary'];
    return typeof summary === 'string' ? summary : summary === undefined ? '' : String(summary);
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /**
   * Release any resources the client holds and complete its lifecycle.
   *
   * The client is stateless per request — it injects/uses `fetch` and holds no
   * pooled socket or session of its own (unlike the python reference's owned
   * `aiohttp.ClientSession`), so there is nothing to tear down; this is a no-op
   * that fulfills the reference's `close()` lifecycle contract. Safe to call more
   * than once. Prefer `await using` (below) where the runtime supports it.
   */
  async close(): Promise<void> {
    // Nothing to release: no owned session / socket pool.
  }

  /**
   * `Symbol.asyncDispose` — the TS/JS explicit-resource-management analogue of the
   * python reference's `async with AIChatClient(...) as client:` context manager.
   * `await using client = new AIChatClient(...)` calls this on scope exit,
   * mirroring `__aenter__`/`__aexit__` → `close()`.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
