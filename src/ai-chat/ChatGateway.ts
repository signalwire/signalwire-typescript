/**
 * ChatGateway - a browser-facing gateway for the SignalWire AI Chat service.
 *
 * A chat widget running in a page can't hold a SignalWire API token. The token
 * carries the whole project, so putting it in JavaScript would let every
 * visitor run up turns, and every turn is billed. The widget still has to
 * reach the chat service, so it talks to a gateway mounted in your own app,
 * which holds the credential server-side and forwards on the widget's behalf:
 *
 * ```text
 * browser ──(publishable key)──▶ your app ──(project:token)──▶ chat service
 * ```
 *
 * The browser learns two things: the gateway's URL and a publishable key. It
 * doesn't learn the project, the space, the token, or which agent config
 * runs. The gateway sends `config_url` itself, so a key can only reach the
 * one agent it was issued for.
 *
 * Mount it on the app an agent already serves:
 *
 * ```ts
 * import { ChatGateway } from '@signalwire/sdk';
 *
 * const gateway = new ChatGateway({
 *   configUrl: 'https://my-agent.example.com/swml',
 *   key: 'pk_live_...', // what the widget carries
 *   allowedOrigins: ['https://shop.example.com'],
 * });
 * agent.mount(gateway.router(), { prefix: '/chat' });
 * ```
 *
 * ## What a stolen key allows
 *
 * It can't read anything: the full `chat_log` isn't exposed, and conversation
 * handles are signed by the gateway, so they can't be guessed or enumerated.
 * It can start and continue conversations, which costs the project money.
 * That makes the caps the main control: `maxNewConversations` and `maxTurns`
 * bound how many conversations can exist and how long each can run.
 *
 * The origin allowlist is a second layer. It stops a key pasted into someone
 * else's page, because a browser sends that page's origin and the gateway
 * refuses it. It doesn't stop a script that sends no origin or a false one.
 * Treat it as leak containment, not access control.
 *
 * ## What the browser may send
 *
 * One field is forwarded rather than replaced: `user_meta_data`, the page
 * context a widget collects about itself (url, title, referrer, locale,
 * viewport). It lets a chat agent tailor its greeting the way a voice agent
 * does from dial-time `userVariables`, and it reaches the agent's config
 * request as `params.user_meta_data`.
 *
 * The service reads it when it creates a conversation: the `start` call, or
 * whichever `chat` auto-creates one. An open conversation doesn't fetch its
 * config again, so metadata sent on later turns is accepted and unused. Send
 * it every turn so the creating turn carries it, but don't expect the agent
 * to see a visitor move between pages mid-conversation.
 *
 * The browser writes it, so treat it as the visitor's claim about themselves,
 * never as authority; a page can put anything in it, including text aimed at
 * your prompt. The gateway limits its size ({@link MAX_USER_METADATA_BYTES})
 * and keeps it nested under its own key, so it can't replace the conversation
 * id or `config_url` the gateway sets. It can't vouch for the contents.
 *
 * Mirrors signalwire-python's `signalwire.ai_chat.gateway`.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { getLogger } from '../Logger.js';
import { AIChatClient } from './AIChatClient.js';

const logger = getLogger('ai_chat.gateway');

/** Seconds a handle stays valid: past a page refresh, not overnight. */
export const DEFAULT_HANDLE_TTL = 24 * 60 * 60;

/**
 * The chat service's own default conversation timeout, in seconds. Reported to
 * the browser when no `conversationTimeout` is set; the service applies it.
 */
export const SERVICE_DEFAULT_CONVERSATION_TIMEOUT = 3600;

/** New conversations per window, per gateway. */
export const DEFAULT_MAX_NEW_CONVERSATIONS = 60;
/** Turns per conversation, in total. */
export const DEFAULT_MAX_TURNS = 200;
/** Seconds in the window `maxNewConversations` counts over. */
export const DEFAULT_WINDOW_SECONDS = 60;

/** Hosts allowed without listing, so local development works unconfigured. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** The `method` values a browser may send. */
export const ALLOWED_METHODS: ReadonlySet<string> = new Set(['start', 'chat', 'log', 'end']);

/**
 * Limit on the browser-supplied `user_meta_data`, serialized, in bytes. A
 * widget's real payload is one to two KB; without a limit a page could send
 * unbounded bytes to a metered service with every turn.
 */
export const MAX_USER_METADATA_BYTES = 8 * 1024;

/**
 * Roles a browser may see. `chat_log` returns the whole conversation as the
 * service holds it, including the substituted system prompt, tool calls and
 * tool results, so the transcript is reduced to the dialogue.
 */
export const VISIBLE_ROLES: ReadonlySet<string> = new Set(['user', 'assistant']);

/**
 * A request the gateway refused, with the status the browser should see.
 *
 * Deliberately coarse: the browser learns that it was refused and, at most,
 * which of a few categories it fell into. Anything finer would let a caller
 * map out the caps and the allowlist by probing.
 */
export class GatewayRejection extends Error {
  /** HTTP status to return: 400, 401, 403, 413 or 429. */
  readonly status: number;
  /** Short explanation that reaches the browser; it never says why a handle failed. */
  readonly reason: string;

  /**
   * @param status - HTTP status to return (401 bad key, 403 origin or handle,
   *   400 malformed request, 413 metadata too large, 429 a cap was hit).
   * @param reason - Short explanation, safe to show the browser.
   */
  constructor(status: number, reason: string) {
    super(`${status}: ${reason}`);
    this.name = 'GatewayRejection';
    this.status = status;
    this.reason = reason;
  }
}

/** Constructor options for {@link ChatGateway}. */
export interface ChatGatewayOptions {
  /**
   * The agent config this key may reach. Sent on every call and never taken
   * from the request, or whoever holds a key would choose which agent runs.
   */
  configUrl: string;
  /**
   * The publishable key the widget carries. Falls back to
   * `SIGNALWIRE_CHAT_GATEWAY_KEY`, then to a generated key, which is only
   * useful to a process that also serves the page and can embed it.
   */
  key?: string;
  /**
   * Origins allowed to use this key. Localhost is always allowed so local
   * development works unconfigured; any other origin must be listed.
   */
  allowedOrigins?: readonly string[];
  /** The client to forward with. Built from the environment when omitted, and then closed by {@link ChatGateway.close}. */
  client?: AIChatClient;
  /**
   * HMAC key for signing handles. Falls back to
   * `SIGNALWIRE_CHAT_GATEWAY_SECRET`, then to a random per-process value,
   * which invalidates outstanding handles on restart and across replicas.
   * Set it when you run more than one replica or restart often.
   */
  secret?: string | Uint8Array;
  /** Seconds a handle stays valid. Default {@link DEFAULT_HANDLE_TTL}. */
  handleTtl?: number;
  /**
   * Idle seconds before the service ends a conversation, sent on every
   * create. Set here rather than in the page: the service's responses don't
   * expose the deadline, so the gateway reports it back on `start` and `log`
   * for a widget to warn that the next message opens a new conversation.
   * Omit for the service default ({@link SERVICE_DEFAULT_CONVERSATION_TIMEOUT}).
   */
  conversationTimeout?: number | null;
  /**
   * New conversations per `windowSeconds`. The cap that matters most: a
   * leaked key is used to open many one-turn conversations, each billed for
   * its opening turn. Default {@link DEFAULT_MAX_NEW_CONVERSATIONS}.
   */
  maxNewConversations?: number;
  /** Turns one conversation may run. Default {@link DEFAULT_MAX_TURNS}. */
  maxTurns?: number;
  /** Window for `maxNewConversations`, in seconds. Default {@link DEFAULT_WINDOW_SECONDS}. */
  windowSeconds?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Seconds on a monotonic clock, for the caps. */
function monotonic(): number {
  return performance.now() / 1000;
}

const BASE64URL = /^[A-Za-z0-9_-]*$/;

/**
 * Serialized size as the reference measures it (compact JSON with non-ASCII
 * escaped), so the same payload hits the limit in both SDKs.
 */
function jsonByteLength(value: unknown): number {
  const encoded = JSON.stringify(value);
  let bytes = 0;
  for (let i = 0; i < encoded.length; i++) bytes += encoded.charCodeAt(i) < 0x7f ? 1 : 6;
  return bytes;
}

/**
 * Server-side proxy that lets a browser chat without holding a token.
 *
 * The caps are counted in this process. Behind several replicas each keeps its
 * own counts, so the effective cap is multiplied by the replica count; set
 * them with that in mind, or put a shared limiter in front.
 */
export class ChatGateway {
  /** The agent config sent on every call. */
  readonly configUrl: string;
  /** The publishable key the browser presents. */
  readonly key: string;
  /** Listed origins, without trailing slashes. */
  readonly allowedOrigins: ReadonlySet<string>;
  /** Seconds a handle stays valid. */
  handleTtl: number;
  /** Idle seconds before the service ends a conversation, or null for its default. */
  conversationTimeout: number | null;
  /** New conversations allowed per window. */
  maxNewConversations: number;
  /** Turns allowed per conversation. */
  maxTurns: number;
  /** Window for `maxNewConversations`, in seconds. */
  windowSeconds: number;

  private readonly _client: AIChatClient;
  private readonly _ownsClient: boolean;
  private readonly _secret: Buffer;
  private _mints: number[] = [];
  private _turns = new Map<string, { count: number; at: number }>();

  /**
   * @param options - The agent config, the key, and the limits.
   * @throws {Error} When `configUrl` is empty.
   */
  constructor(options: ChatGatewayOptions) {
    if (!options.configUrl) {
      throw new Error('configUrl is required; it is what a key is scoped to.');
    }
    this.configUrl = options.configUrl;
    this.key =
      options.key ||
      process.env['SIGNALWIRE_CHAT_GATEWAY_KEY'] ||
      'pk_' + randomBytes(24).toString('base64url');
    this.allowedOrigins = new Set((options.allowedOrigins ?? []).map((o) => o.replace(/\/+$/, '')));
    this.handleTtl = options.handleTtl ?? DEFAULT_HANDLE_TTL;
    this.conversationTimeout = options.conversationTimeout ?? null;
    this.maxNewConversations = options.maxNewConversations ?? DEFAULT_MAX_NEW_CONVERSATIONS;
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;

    this._client = options.client ?? new AIChatClient();
    this._ownsClient = options.client === undefined;

    const secret =
      options.secret ?? (process.env['SIGNALWIRE_CHAT_GATEWAY_SECRET'] || randomBytes(32));
    this._secret = typeof secret === 'string' ? Buffer.from(secret) : Buffer.from(secret);
  }

  /**
   * Epoch seconds of the newest message, or null when none is dated.
   *
   * Lets a browser restore its idle clock after a reload. Without it a widget
   * restarts the clock at zero, so a tab closed for 55 minutes of a 60-minute
   * timeout waits another hour before warning while the conversation ends in
   * five.
   *
   * The service stamps messages in microseconds; this converts to seconds.
   * Every role counts, not only the visible ones, because the service's idle
   * clock moves on any write.
   *
   * @param messages - Messages as `chat_log` returns them.
   * @returns Epoch seconds, or null.
   */
  static lastActivity(messages: readonly unknown[] | null | undefined): number | null {
    let newest: number | null = null;
    for (const msg of messages ?? []) {
      if (!isPlainObject(msg)) continue;
      const ts = msg['timestamp'];
      if (
        typeof ts === 'number' &&
        Number.isInteger(ts) &&
        ts > 0 &&
        (newest === null || ts > newest)
      ) {
        newest = ts;
      }
    }
    return newest !== null ? newest / 1_000_000 : null;
  }

  /**
   * The idle seconds a conversation actually gets: `conversationTimeout`, or
   * the service default when unset, so the number given to a browser is never
   * null.
   */
  get effectiveTimeout(): number {
    return this.conversationTimeout || SERVICE_DEFAULT_CONVERSATION_TIMEOUT;
  }

  /**
   * Close the client, if the gateway built it. A client passed in the options
   * belongs to the caller and is left open.
   */
  async close(): Promise<void> {
    if (this._ownsClient) await this._client.close();
  }

  // ── Handles ──────────────────────────────────────────────────────

  /**
   * Issue a signed handle for a conversation.
   *
   * The browser never names a conversation. If it could, a publishable key
   * and a guessed id would be enough to continue someone else's chat; with
   * signing, a caller can only present handles this gateway issued.
   *
   * @param conversationId - The conversation to name; a new random id when omitted.
   * @returns The handle.
   */
  mintHandle(conversationId?: string): string {
    const id = conversationId || `chat-${randomBytes(18).toString('base64url')}`;
    const expires = Math.floor(Date.now() / 1000) + this.handleTtl;
    const payload = Buffer.from(`${id}:${expires}`);
    const sig = createHmac('sha256', this._secret).update(payload).digest();
    return `${payload.toString('base64url')}.${sig.toString('base64url')}`;
  }

  /**
   * The conversation id inside a handle. The signature is checked first and
   * the expiry second, both before the id is used.
   *
   * @param handle - A handle from {@link mintHandle}.
   * @returns The conversation id.
   * @throws {GatewayRejection} 400 for a malformed handle, 403 for a bad
   *   signature or an expired handle.
   */
  readHandle(handle: string): string {
    // Checked at runtime too: the handle comes from a request body.
    const dot = typeof handle === 'string' ? handle.indexOf('.') : -1;
    if (dot < 0) throw new GatewayRejection(400, 'malformed handle');
    const raw = handle.slice(0, dot);
    const sig = handle.slice(dot + 1);
    if (!BASE64URL.test(raw) || !BASE64URL.test(sig)) {
      throw new GatewayRejection(400, 'malformed handle');
    }
    const payload = Buffer.from(raw, 'base64url');
    const given = Buffer.from(sig, 'base64url');
    const expected = createHmac('sha256', this._secret).update(payload).digest();
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new GatewayRejection(403, 'invalid handle');
    }

    const text = payload.toString('utf8');
    const colon = text.lastIndexOf(':');
    const expires = colon < 0 ? '' : text.slice(colon + 1);
    if (!/^-?\d+$/.test(expires)) throw new GatewayRejection(400, 'malformed handle');
    if (Date.now() / 1000 > Number(expires)) throw new GatewayRejection(403, 'expired handle');
    return text.slice(0, colon);
  }

  // ── Guards ───────────────────────────────────────────────────────

  /**
   * Allow localhost and listed origins; refuse any other.
   *
   * A missing `Origin` is allowed: browsers send one on the cross-origin POSTs
   * this serves, so its absence means a caller that isn't a browser. Refusing
   * those would break server-side use without stopping an attacker, who can
   * leave the header out.
   *
   * @param origin - The request's `Origin` header, or null/undefined when absent.
   * @throws {GatewayRejection} 403 for an origin that isn't allowed.
   */
  checkOrigin(origin: string | null | undefined): void {
    if (origin === null || origin === undefined) return;
    let host = '';
    try {
      host = new URL(origin).hostname;
    } catch {
      // Not a URL; only an exact listing can match it.
    }
    if (LOCAL_HOSTS.has(host) || host.endsWith('.localhost')) return;
    if (this.allowedOrigins.has(origin.replace(/\/+$/, ''))) return;
    throw new GatewayRejection(403, 'origin not allowed');
  }

  /**
   * Verify the publishable key the browser sent, in constant time.
   *
   * @param presented - The key from the request, or null/undefined when absent.
   * @throws {GatewayRejection} 401 when the key is missing or wrong.
   */
  checkKey(presented: string | null | undefined): void {
    // Comparing digests keeps the comparison constant-time whatever the lengths.
    const digest = (s: string) => createHmac('sha256', this._secret).update(s).digest();
    if (!presented || !timingSafeEqual(digest(presented), digest(this.key))) {
      throw new GatewayRejection(401, 'bad key');
    }
  }

  /**
   * The transcript a browser may redraw, and nothing else.
   *
   * `chat_log` returns the conversation as the service holds it: the
   * substituted system prompt, then tool calls and results alongside the
   * dialogue. Relaying that would publish the developer's prompt to anyone
   * with a handle. Only user and assistant turns with text are kept, reduced
   * to role, content and, when dated, the time in epoch seconds, so a
   * restored transcript isn't shown as sent now.
   *
   * @param messages - Messages as `chat_log` returns them.
   * @returns The visible turns.
   */
  static visibleMessages(
    messages: readonly unknown[] | null | undefined,
  ): Array<Record<string, unknown>> {
    const out: Array<Record<string, unknown>> = [];
    for (const msg of messages ?? []) {
      if (!isPlainObject(msg)) continue;
      const role = msg['role'];
      const content = msg['content'];
      if (typeof role !== 'string' || !VISIBLE_ROLES.has(role)) continue;
      if (typeof content !== 'string' || !content.trim()) continue;
      const entry: Record<string, unknown> = { role, content };
      const ts = msg['timestamp'];
      if (typeof ts === 'number' && Number.isInteger(ts) && ts > 0) {
        entry['timestamp'] = ts / 1_000_000;
      }
      out.push(entry);
    }
    return out;
  }

  private _chargeMint(): void {
    const now = monotonic();
    const cutoff = now - this.windowSeconds;
    this._mints = this._mints.filter((t) => t > cutoff);
    if (this._mints.length >= this.maxNewConversations) {
      throw new GatewayRejection(429, 'too many new conversations');
    }
    this._mints.push(now);
  }

  private _chargeTurn(conversationId: string): void {
    const now = monotonic();
    // Swept here rather than on a timer: a handle can't outlive its TTL, so
    // older entries can never be charged again.
    const cutoff = now - this.handleTtl;
    for (const [id, entry] of this._turns) if (entry.at <= cutoff) this._turns.delete(id);
    const count = this._turns.get(conversationId)?.count ?? 0;
    if (count >= this.maxTurns) {
      throw new GatewayRejection(429, 'conversation turn limit reached');
    }
    this._turns.set(conversationId, { count: count + 1, at: now });
  }

  // ── The forwarded call ───────────────────────────────────────────

  /**
   * Validate the page context a browser sent (`user_meta_data`).
   *
   * The only field forwarded instead of replaced, so the only one that needs
   * a shape and a size limit. Absent, null and empty all yield null.
   *
   * @param body - The browser's request body.
   * @returns The metadata, or null.
   * @throws {GatewayRejection} 400 when it isn't a JSON object, 413 when it's
   *   larger than {@link MAX_USER_METADATA_BYTES} serialized.
   */
  readUserMetadata(body: Record<string, unknown>): Record<string, unknown> | null {
    const raw = body['user_meta_data'];
    if (raw === null || raw === undefined) return null;
    if (!isPlainObject(raw)) throw new GatewayRejection(400, 'user_meta_data must be an object');
    if (Object.keys(raw).length === 0) return null;
    let size: number;
    try {
      size = jsonByteLength(raw);
    } catch {
      // Reachable through prepare() with an object that never came from JSON.
      throw new GatewayRejection(400, 'user_meta_data must be JSON-serializable');
    }
    if (size > MAX_USER_METADATA_BYTES) throw new GatewayRejection(413, 'user_meta_data too large');
    return raw;
  }

  /**
   * Validate a browser request and build the call to the chat service.
   *
   * Everything the browser could use to widen its own access is refused or
   * replaced here: the method must be one of four, the conversation comes
   * from a signed handle, and `config_url` is the gateway's. The one
   * exception is `user_meta_data`, which is forwarded (see
   * {@link readUserMetadata}).
   *
   * @param body - The browser's request body:
   *   `{ method?, handle?, message?, user_meta_data? }`.
   * @param opts - `origin`: the `Origin` header; `key`: the presented key.
   * @returns `[method, params, mintedHandle]`, the service method and params
   *   to send, and the new handle when this call created the conversation
   *   (null otherwise), for the caller to return to the browser.
   * @throws {GatewayRejection} When the request is refused.
   */
  prepare(
    body: Record<string, unknown>,
    opts: { origin?: string | null; key?: string | null },
  ): [string, Record<string, unknown>, string | null] {
    this.checkKey(opts.key);
    this.checkOrigin(opts.origin);

    const method = body['method'] ?? 'chat';
    if (typeof method !== 'string' || !ALLOWED_METHODS.has(method)) {
      throw new GatewayRejection(400, 'method not allowed');
    }

    // Read before minting, so a malformed value doesn't use up a
    // new-conversation slot on a request that never reaches the service.
    const userMetadata = this.readUserMetadata(body);

    const handle = body['handle'];
    let minted: string | null = null;
    let conversationId: string;
    if (handle) {
      conversationId = this.readHandle(handle as string);
    } else if (method === 'end' || method === 'log') {
      throw new GatewayRejection(400, `${method} requires a handle`);
    } else {
      this._chargeMint();
      minted = this.mintHandle();
      conversationId = this.readHandle(minted);
    }

    if (method === 'end') return ['end_conversation', { id: conversationId }, null];

    // Scoped to the conversation inside the signed handle, never to anything
    // the caller sent.
    if (method === 'log') return ['chat_log', { id: conversationId }, null];

    if (method === 'start') {
      // Opens the conversation with no user message, so the agent speaks first.
      const params: Record<string, unknown> = { id: conversationId, config_url: this.configUrl };
      if (this.conversationTimeout) params['conversation_timeout'] = this.conversationTimeout;
      if (userMetadata) params['user_meta_data'] = userMetadata;
      return ['create_conversation', params, minted];
    }

    const message = body['message'];
    if (typeof message !== 'string' || !message.trim()) {
      throw new GatewayRejection(400, 'message is required');
    }

    this._chargeTurn(conversationId);
    // config_url and the timeout on every chat: the service auto-creates the
    // conversation on the first one and ignores both after.
    const params: Record<string, unknown> = {
      id: conversationId,
      message,
      config_url: this.configUrl,
    };
    if (this.conversationTimeout) params['conversation_timeout'] = this.conversationTimeout;
    // On every chat, since any chat may be the one that creates the
    // conversation, the only time the service reads it.
    if (userMetadata) params['user_meta_data'] = userMetadata;
    return ['chat', params, minted];
  }

  // ── HTTP ─────────────────────────────────────────────────────────

  /**
   * A Hono app serving this gateway at `/`. Mount it with
   * `agent.mount(gateway.router(), { prefix: '/chat' })`, or `app.route()`.
   *
   * `POST /` takes `{ method: 'start'|'chat'|'log'|'end', handle?, message?,
   * user_meta_data? }` with the key in `Authorization: Bearer`. A chat
   * streams the service's JSON-RPC response through without buffering it:
   * the service pads slow turns with keepalive whitespace so proxies don't
   * close the connection, and collecting the body here would hold that
   * padding back and bring the timeout into your own stack. A new handle is
   * returned in the `X-Chat-Handle` header, which is why it can be sent
   * before the body.
   *
   * `start` returns `{ greeting, status, timeout }`, `log` returns
   * `{ messages, timeout, last_activity }` with only the visible dialogue,
   * and `end` returns `{ status: 'ended' }`. A refusal returns
   * `{ error: reason }` with the rejection's status, and a failure reaching
   * the chat service before any reply is sent returns 502
   * `{ error: 'chat service error' }`, with CORS headers either way.
   *
   * @returns The Hono app.
   */
  router(): Hono {
    const router = new Hono();

    const cors = (origin: string | undefined): Record<string, string> => {
      if (origin === undefined) return {};
      try {
        this.checkOrigin(origin);
      } catch {
        return {};
      }
      return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Expose-Headers': 'X-Chat-Handle',
        Vary: 'Origin',
      };
    };

    router.options('/', (c: Context) => {
      const headers = cors(c.req.header('origin'));
      if (Object.keys(headers).length > 0) {
        headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
        headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
        headers['Access-Control-Max-Age'] = '600';
      }
      return c.body(null, 204, headers);
    });

    router.post('/', async (c: Context) => {
      const origin = c.req.header('origin');
      const auth = c.req.header('authorization') ?? '';
      const key = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null;
      const corsHeaders = cors(origin);

      let method: string;
      let params: Record<string, unknown>;
      let minted: string | null;
      try {
        let body: unknown;
        try {
          body = await c.req.json();
        } catch {
          return c.json({ error: 'bad request' }, 400, corsHeaders);
        }
        if (!isPlainObject(body)) throw new GatewayRejection(400, 'body must be an object');
        [method, params, minted] = this.prepare(body, { origin, key });
      } catch (err) {
        if (err instanceof GatewayRejection) {
          return c.json({ error: err.reason }, err.status as 400, corsHeaders);
        }
        return c.json({ error: 'bad request' }, 400, corsHeaders);
      }
      const id = params['id'] as string;

      try {
        return await this._forward(c, method, id, params, minted, corsHeaders);
      } catch (err) {
        // Before any of the reply was sent: answer with the CORS headers, so
        // the widget can read the refusal. (A failure after streaming
        // started can only end the stream.) Only the error's type is logged.
        logger.error('chat_gateway_upstream_failed', {
          method,
          error_type: err instanceof Error ? err.name : typeof err,
        });
        return c.json({ error: 'chat service error' }, 502, corsHeaders);
      }
    });

    return router;
  }

  /** Send a prepared call to the chat service and build the browser's answer. */
  private async _forward(
    c: Context,
    method: string,
    id: string,
    params: Record<string, unknown>,
    minted: string | null,
    corsHeaders: Record<string, string>,
  ): Promise<Response> {
    if (method === 'end_conversation') {
      await this._client.end(id);
      return c.json({ status: 'ended' }, 200, corsHeaders);
    }

    if (method === 'create_conversation') {
      // prepare() decides whether a timeout applies; it has to reach the
      // service, or the browser is told one number and the service keeps another.
      const info = await this._client.createConversation(id, {
        configUrl: params['config_url'] as string,
        timeout: params['conversation_timeout'] as number | undefined,
        userMetadata: params['user_meta_data'] as Record<string, unknown> | undefined,
      });
      const headers = minted ? { ...corsHeaders, 'X-Chat-Handle': minted } : corsHeaders;
      return c.json(
        { greeting: info.initialMessage, status: info.status, timeout: this.effectiveTimeout },
        200,
        headers,
      );
    }

    if (method === 'chat_log') {
      const log = await this._client.log(id);
      return c.json(
        {
          messages: ChatGateway.visibleMessages(log.messages),
          timeout: this.effectiveTimeout,
          last_activity: ChatGateway.lastActivity(log.messages),
        },
        200,
        corsHeaders,
      );
    }

    const upstream = await this._client.rawPost(method, params);
    const headers: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': 'application/json',
    };
    if (minted) headers['X-Chat-Handle'] = minted;
    return new Response(upstream.body, { status: 200, headers });
  }
}
