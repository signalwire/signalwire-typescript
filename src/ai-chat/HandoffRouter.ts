/**
 * HandoffRouter - moving one conversation between voice and text.
 *
 * {@link ChatGateway} lets a browser hold a text conversation. This module
 * provides the other routes a browser client needs: moving that conversation
 * to a phone call and back, and typing into a live call.
 *
 * The browser side already exists. The SignalWire address widget calls
 * `{gateway-url}/handoff`, `{gateway-url}/escalate` and `{gateway-url}/say`
 * on the same URL that serves a `ChatGateway`, and sends `handoff_nonce` and
 * `chat_handle` as user variables. Without these routes, a gateway answers
 * the widget's JSON-RPC and returns 404 for the rest.
 *
 * ## Mechanism, not policy
 *
 * This class implements the wire contract: the routes, the nonce, the
 * ordering guarantee and the spend limits. What a conversation is belongs to
 * the application: where a leg's transcript is written, what a resumed
 * greeting says, how much history to carry. Those are callbacks.
 *
 * ## The nonce
 *
 * A browser can't be trusted to name a call. `ai_message` takes a call id,
 * and accepting one from a page would let anyone who learned or guessed an id
 * inject speech into someone else's call. Instead, the application puts a
 * random `handoff_nonce` in the user variables of one dial, registers it here
 * against that call, and the browser presents it later. The nonce appears
 * nowhere else, so presenting it shows the browser placed that call.
 *
 * Exchanging a nonce for a chat handle works once. Typing works repeatedly,
 * up to `maxMessagesPerCall`, until `/handoff` uses the nonce or `nonceTtl`
 * seconds pass from its registration, even if the call is still live. An
 * unknown nonce gets the same answer as an expired one, so the routes can't
 * be used to learn whether a call is live.
 *
 * ## The ordering guarantee
 *
 * A medium doesn't start until the one it replaces has ended and its record
 * is written. `/handoff` ends the call and waits for the application to
 * confirm the capture before issuing a handle; `/escalate` waits for the chat
 * leg's capture before returning. Without the wait, the new medium's config
 * fetch can run before the record exists, and the new leg starts with no
 * history.
 *
 * ## Deployment
 *
 * The nonce registry lives in this process, like `ChatGateway`'s cap
 * counters. A redemption must reach the replica that served the dial: run one
 * replica, use sticky routing, or supply a shared `registry`.
 *
 * Registration, redemption and taking a typing slot each read the table and
 * write it back without waiting on anything in between, so within one
 * process overlapping requests can't redeem a nonce twice or pass the typing
 * cap. Every change is written back with `set()`, so a `registry` that
 * returns copies stores it. When replicas share a `registry`, each of those
 * steps is a read followed by a write that another replica can interleave,
 * so a nonce can be redeemed once by each, and the typing cap can be passed.
 * The `registry` is a plain `Map`, so the SDK can't make those steps atomic
 * across replicas; use one nonce table, or route each call's requests to one
 * replica.
 *
 * Mirrors signalwire-python's `signalwire.ai_chat.handoff`.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { getLogger } from '../Logger.js';
import {
  GatewayRejection,
  MAX_MESSAGE_BYTES,
  _readJsonBody,
  _utf8Length,
  type ChatGateway,
} from './ChatGateway.js';

const logger = getLogger('ai_chat.handoff');

/** Seconds a nonce stays usable for `/handoff` and `/say`, from registration. */
export const DEFAULT_NONCE_TTL = 3600;
/** Typed messages allowed per call. */
export const DEFAULT_MAX_MESSAGES_PER_CALL = 200;
/** Seconds to wait for `captureLeg`. */
export const DEFAULT_CAPTURE_TIMEOUT = 8.0;

/** Seconds on a monotonic clock. */
function monotonic(): number {
  return performance.now() / 1000;
}

/** What a registered nonce gives access to. */
export class NonceEntry {
  /** The conversation the call belongs to. */
  conversationId: string;
  /** The platform call id, from the request the platform sent. */
  callId: string | null;
  /** When it was registered, in monotonic seconds. */
  issuedAt: number;
  /** Typed messages delivered so far. */
  messages: number;
  /**
   * True once `/handoff` has used the nonce. The entry stays in the table
   * until it would have expired, so registering the nonce again can't make
   * it usable again.
   */
  redeemed: boolean;

  /**
   * @param conversationId - The conversation the call belongs to.
   * @param callId - The platform call id.
   * @param issuedAt - When it was registered, in monotonic seconds; now by default.
   * @param messages - Typed messages delivered so far.
   * @param redeemed - Whether `/handoff` has used the nonce.
   */
  constructor(
    conversationId: string,
    callId: string | null = null,
    issuedAt: number = monotonic(),
    messages = 0,
    redeemed = false,
  ) {
    this.conversationId = conversationId;
    this.callId = callId;
    this.issuedAt = issuedAt;
    this.messages = messages;
    this.redeemed = redeemed;
  }
}

/**
 * Ends a leg and writes its record: `captureLeg(conversationId, medium)`,
 * where `medium` is `voice` or `chat`. Return true once the record is written.
 */
export type CaptureLeg = (conversationId: string, medium: string) => boolean | Promise<boolean>;
/** Hangs a call up server-side, so its teardown hooks run now: `endCall(callId)`. */
export type EndCall = (callId: string) => void | Promise<void>;
/** Delivers typed text into a live call as if the caller said it: `sendMessage(callId, text)`. */
export type SendMessage = (callId: string, text: string) => boolean | Promise<boolean>;

/** Constructor options for {@link HandoffRouter}. */
export interface HandoffRouterOptions {
  /**
   * The gateway that owns the conversations. Used to issue and read handles
   * and to check origins, so all routes on the URL apply the same origin policy.
   */
  gateway: ChatGateway;
  /**
   * Ends a leg and writes its record; return true only once the record is
   * written. When omitted, nothing waits and the ordering guarantee doesn't hold.
   */
  captureLeg?: CaptureLeg;
  /** Hangs a call up server-side. */
  endCall?: EndCall;
  /** Delivers text for `/say`. When omitted, typing is off and the route returns 404. */
  sendMessage?: SendMessage;
  /**
   * The id for the new leg, from the current one. An ended conversation can't
   * be reopened, so each leg needs a new id. Defaults to appending `.N`; use
   * `.` as the separator, the only one the service keeps that can't appear in
   * a generated id.
   */
  nextConversationId?: (conversationId: string) => string;
  /**
   * Seconds a nonce stays usable for `/handoff` and `/say`, from registration.
   * Default {@link DEFAULT_NONCE_TTL}.
   */
  nonceTtl?: number;
  /**
   * Typed messages allowed per call. Each is a billed turn, so this limits
   * spending as well as abuse. Default {@link DEFAULT_MAX_MESSAGES_PER_CALL}.
   */
  maxMessagesPerCall?: number;
  /**
   * Seconds to wait for `captureLeg`, as an upper limit; a capture normally
   * takes under a second. Default {@link DEFAULT_CAPTURE_TIMEOUT}.
   */
  captureTimeout?: number;
  /**
   * The nonce table. Supply one backed by shared storage to run more than one
   * replica. It may return copies of its entries: the router writes every
   * change back with `set()`. Its read-then-write steps aren't atomic across
   * replicas that share it; see the module documentation.
   */
  registry?: Map<string, NonceEntry>;
}

/** The three routes a browser client needs beside a {@link ChatGateway}. */
export class HandoffRouter {
  /** The gateway that issues and reads handles and checks origins. */
  gateway: ChatGateway;
  /** Ends a leg and writes its record, or null. */
  captureLeg: CaptureLeg | null;
  /** Hangs a call up server-side, or null. */
  endCall: EndCall | null;
  /** Delivers typed text into a call, or null (typing off). */
  sendMessage: SendMessage | null;
  /** Produces the id for a new leg. */
  nextConversationId: (conversationId: string) => string;
  /** Seconds a nonce stays usable for `/handoff` and `/say`, from registration. */
  nonceTtl: number;
  /** Typed messages allowed per call. */
  maxMessagesPerCall: number;
  /** Seconds to wait for `captureLeg`. */
  captureTimeout: number;

  private readonly _nonces: Map<string, NonceEntry>;

  /**
   * @param options - The gateway, the application's callbacks, and the limits.
   */
  constructor(options: HandoffRouterOptions) {
    this.gateway = options.gateway;
    this.captureLeg = options.captureLeg ?? null;
    this.endCall = options.endCall ?? null;
    this.sendMessage = options.sendMessage ?? null;
    this.nextConversationId = options.nextConversationId ?? HandoffRouter._defaultNextId;
    this.nonceTtl = options.nonceTtl ?? DEFAULT_NONCE_TTL;
    this.maxMessagesPerCall = options.maxMessagesPerCall ?? DEFAULT_MAX_MESSAGES_PER_CALL;
    this.captureTimeout = options.captureTimeout ?? DEFAULT_CAPTURE_TIMEOUT;
    this._nonces = options.registry ?? new Map();
  }

  // ── Nonces ───────────────────────────────────────────────────────

  /** `root` → `root.1`; `root.2` → `root.3`. */
  private static _defaultNextId(conversationId: string): string {
    const dot = conversationId.lastIndexOf('.');
    const root = dot < 0 ? '' : conversationId.slice(0, dot);
    const tail = dot < 0 ? '' : conversationId.slice(dot + 1);
    if (root && /^\d+$/.test(tail)) return `${root}.${Number(tail) + 1}`;
    return `${conversationId}.1`;
  }

  /**
   * Record what a nonce gives access to.
   *
   * Call it from the per-call config callback of the dial that carried the
   * nonce, with `callId` from the request the platform sent, never from
   * anything the browser supplied.
   *
   * Registering a nonce that's already in the table changes nothing, since
   * the callback runs on every config request for the call. The first
   * registration's call, time and message count stand, and a nonce `/handoff`
   * has used stays used until it would have expired.
   *
   * @param nonce - The nonce put in the dial's user variables.
   * @param opts - `conversationId`: the conversation; `callId`: the call.
   */
  register(nonce: string, opts: { conversationId: string; callId?: string | null }): void {
    if (!nonce || typeof nonce !== 'string') return;
    this._prune();
    const callId = opts.callId ?? null;
    const existing = this._nonces.get(nonce);
    if (existing) {
      if (
        existing.redeemed ||
        existing.conversationId !== opts.conversationId ||
        existing.callId !== callId
      ) {
        logger.warn('handoff_nonce_reregister_ignored', {
          conversation_id: opts.conversationId,
          call_id: callId,
          note: existing.redeemed ? 'nonce already redeemed' : 'nonce registered to another call',
        });
      }
      return;
    }
    this._nonces.set(nonce, new NonceEntry(opts.conversationId, callId));
    logger.info('handoff_nonce_registered', {
      conversation_id: opts.conversationId,
      call_id: callId,
    });
  }

  private _prune(): void {
    const cutoff = monotonic() - this.nonceTtl;
    for (const [nonce, entry] of this._nonces) {
      if (entry.issuedAt < cutoff) this._nonces.delete(nonce);
    }
  }

  private _lookup(nonce: unknown): NonceEntry | null {
    if (!nonce || typeof nonce !== 'string') return null;
    this._prune();
    const entry = this._nonces.get(nonce);
    return entry && !entry.redeemed ? entry : null;
  }

  // ── Operations ───────────────────────────────────────────────────

  /** Wait for the application's capture, up to `captureTimeout`. Never throws. */
  private async _capture(conversationId: string, medium: string): Promise<boolean> {
    if (!this.captureLeg) return false;
    const capture = this.captureLeg;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = Symbol('timeout');
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => capture(conversationId, medium)),
        new Promise<typeof timedOut>((resolve) => {
          timer = setTimeout(() => resolve(timedOut), this.captureTimeout * 1000);
        }),
      ]);
      if (result === timedOut) {
        logger.warn('handoff_capture_timeout', {
          conversation_id: conversationId,
          medium,
          note: "starting the next medium without this leg's record",
        });
        return false;
      }
      return Boolean(result);
    } catch (err) {
      logger.error('handoff_capture_failed', {
        conversation_id: conversationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Exchange a nonce for a chat handle, once.
   *
   * Ends the call, waits for its record, and only then issues a handle for a
   * new leg of the same conversation.
   *
   * @param nonce - The nonce the browser presented.
   * @returns The handle, or null for a nonce that's unknown, expired or
   *   already used; the three can't be told apart.
   */
  async redeem(nonce: string): Promise<string | null> {
    const entry = this._lookup(nonce);
    if (!entry) return null;
    // Used up even if what follows fails: a nonce is one attempt. Keep the
    // entry as a tombstone until it would have expired, so registering the
    // nonce again can't make it usable again.
    entry.redeemed = true;
    this._nonces.set(nonce, entry);

    if (entry.callId && this.endCall) {
      try {
        await this.endCall(entry.callId);
      } catch (err) {
        logger.warn('handoff_end_call_failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this._capture(entry.conversationId, 'voice');

    let handle: string;
    try {
      handle = this.gateway.mintHandle(this.nextConversationId(entry.conversationId));
    } catch (err) {
      logger.error('handoff_mint_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
    logger.info('handoff_redeemed', { conversation_id: entry.conversationId });
    return handle;
  }

  /**
   * End a chat leg and wait for its record, before a call is placed.
   *
   * The browser waits for this, so a voice leg started right after finds the
   * text leg already recorded.
   *
   * @param handle - The chat leg's handle.
   * @returns False when the handle doesn't verify.
   */
  async escalate(handle: string): Promise<boolean> {
    let conversationId: string;
    try {
      conversationId = this.gateway.readHandle(handle);
    } catch {
      return false;
    }
    await this._capture(conversationId, 'chat');
    logger.info('handoff_escalated', { conversation_id: conversationId });
    return true;
  }

  /**
   * Deliver typed text into the call the nonce names.
   *
   * Doesn't use up the nonce: typing works until `/handoff` uses it or
   * `nonceTtl` seconds pass from its registration, even if the call is
   * still live. The call is found by nonce, never by a browser-supplied call
   * id, and no other request field is forwarded. In particular, `global_data`
   * is agent state that step logic trusts, and a page must not write it.
   *
   * Text over {@link MAX_MESSAGE_BYTES} (UTF-8), the gateway's limit for a
   * chat message, is refused.
   *
   * @param nonce - The nonce the browser presented.
   * @param text - The typed text; surrounding whitespace is removed.
   * @returns True when the text was delivered: `sendMessage` neither threw
   *   nor returned false.
   */
  async say(nonce: string, text: string): Promise<boolean> {
    if (!this.sendMessage) return false;
    const cleaned = (text ?? '').trim();
    if (!cleaned || _utf8Length(cleaned) > MAX_MESSAGE_BYTES) return false;
    const entry = this._lookup(nonce);
    if (!entry || !entry.callId) return false;
    if (entry.messages >= this.maxMessagesPerCall) {
      logger.warn('handoff_say_cap_reached', { call_id: entry.callId });
      return false;
    }
    // Take the slot before waiting on delivery, so concurrent requests can't
    // all pass the check. Written back, so a registry that returns copies
    // stores the change.
    entry.messages += 1;
    this._nonces.set(nonce, entry);
    let delivered: boolean;
    try {
      delivered = (await this.sendMessage(entry.callId, cleaned)) !== false;
    } catch (err) {
      logger.error('handoff_say_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      delivered = false;
    }
    if (!delivered) this._refund(nonce, entry);
    return delivered;
  }

  /**
   * Give back the slot a failed delivery took, if the table still holds the
   * registration it came from. A registry may return copies, so the
   * registration is matched by value (conversation, call and registration
   * time), and the stored count is the one decremented, keeping the slots
   * other requests took meanwhile.
   */
  private _refund(nonce: string, entry: NonceEntry): void {
    const current = this._nonces.get(nonce);
    if (
      current &&
      current.messages > 0 &&
      current.conversationId === entry.conversationId &&
      current.callId === entry.callId &&
      current.issuedAt === entry.issuedAt
    ) {
      current.messages -= 1;
      this._nonces.set(nonce, current);
    }
  }

  // ── HTTP ─────────────────────────────────────────────────────────

  /**
   * A Hono app serving `POST /handoff`, `/escalate` and `/say`. Mount it at
   * the same prefix as the gateway, since the browser derives all three
   * paths from the gateway's URL:
   *
   * ```ts
   * import { AgentBase, ChatGateway, HandoffRouter } from '@signalwire/sdk';
   *
   * const agent = new AgentBase({ name: 'shop', route: '/swml' });
   * const gateway = new ChatGateway({
   *   configUrl: 'https://my-agent.example.com/swml',
   *   key: 'pk_live_...',
   *   allowedOrigins: ['https://shop.example.com'],
   * });
   * const handoff = new HandoffRouter({ gateway });
   * agent.mount(gateway.router(), { prefix: '/chat' });
   * agent.mount(handoff.router(), { prefix: '/chat' });
   * ```
   *
   * - `/handoff` takes `{ nonce }` and returns `{ handle }`.
   * - `/escalate` takes `{ handle }` and returns `{ ok: true }`.
   * - `/say` takes `{ nonce, text }` and returns `{ ok: true }`.
   *
   * Each returns 403 for a refused origin, and 404 `{ error: 'not found' }`
   * when the nonce or handle doesn't verify. Each returns 413
   * `{ error: 'request too large' }` for a body over the gateway's
   * `MAX_REQUEST_BODY_BYTES`, and `/say` returns 413
   * `{ error: 'message too large' }` for text over its `MAX_MESSAGE_BYTES`.
   * Both are checked before the nonce is looked up, so the answer says
   * nothing about whether the nonce is live. Each answers its own CORS
   * preflight, and sends CORS headers to an origin the gateway allows.
   *
   * @returns The Hono app.
   */
  router(): Hono {
    const router = new Hono();

    // CORS for origins the gateway allows, so a widget on another origin can
    // call these routes and read the answers; the agent's own CORS handling
    // doesn't apply to a mounted app.
    const cors = (c: Context): Record<string, string> => {
      const origin = c.req.header('origin');
      if (origin === undefined) return {};
      try {
        this.gateway.checkOrigin(origin);
      } catch {
        return {};
      }
      return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    };

    const forbiddenOrigin = (c: Context): Response | null => {
      try {
        this.gateway.checkOrigin(c.req.header('origin'));
      } catch {
        return c.json({ error: 'origin not allowed' }, 403);
      }
      return null;
    };

    // Every answer carries the CORS headers, refusals included.
    router.use('*', async (c, next) => {
      await next();
      for (const [name, value] of Object.entries(cors(c))) c.res.headers.set(name, value);
    });

    for (const path of ['/handoff', '/escalate', '/say']) {
      router.options(path, (c: Context) => {
        const headers = cors(c);
        if (Object.keys(headers).length > 0) {
          headers['Access-Control-Allow-Headers'] = 'Content-Type';
          headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
          headers['Access-Control-Max-Age'] = '600';
        }
        return c.body(null, 204, headers);
      });
    }

    // The JSON object sent, or {} for anything else. Throws a
    // GatewayRejection (413) for a body over the size limit.
    const readBody = async (c: Context): Promise<Record<string, unknown>> => {
      let data: unknown;
      try {
        data = await _readJsonBody(c.req);
      } catch (err) {
        if (err instanceof GatewayRejection) throw err;
        return {};
      }
      return typeof data === 'object' && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    };

    const notFound = (c: Context) => c.json({ error: 'not found' }, 404);
    const tooLarge = (c: Context, reason: string) => c.json({ error: reason }, 413);

    // Every route reads its body this way, so an oversized one is refused
    // before anything else looks at it.
    const withBody =
      (handler: (c: Context, body: Record<string, unknown>) => Promise<Response>) =>
      async (c: Context): Promise<Response> => {
        const denied = forbiddenOrigin(c);
        if (denied) return denied;
        let body: Record<string, unknown>;
        try {
          body = await readBody(c);
        } catch (err) {
          if (err instanceof GatewayRejection) return tooLarge(c, err.reason);
          throw err;
        }
        return handler(c, body);
      };

    router.post(
      '/handoff',
      withBody(async (c, body) => {
        const nonce = body['nonce'];
        if (typeof nonce !== 'string') return notFound(c);
        const handle = await this.redeem(nonce);
        // The same answer for unknown, expired and already used.
        if (!handle) return notFound(c);
        return c.json({ handle });
      }),
    );

    router.post(
      '/escalate',
      withBody(async (c, body) => {
        const handle = body['handle'];
        if (!handle || typeof handle !== 'string') return c.json({ error: 'bad request' }, 400);
        if (!(await this.escalate(handle))) return notFound(c);
        return c.json({ ok: true });
      }),
    );

    router.post(
      '/say',
      withBody(async (c, body) => {
        const nonce = body['nonce'];
        const text = body['text'] ?? '';
        if (typeof nonce !== 'string' || typeof text !== 'string') return notFound(c);
        // Before the lookup, so the answer doesn't depend on the nonce.
        if (_utf8Length(text) > MAX_MESSAGE_BYTES) return tooLarge(c, 'message too large');
        if (!(await this.say(nonce, text))) return notFound(c);
        return c.json({ ok: true });
      }),
    );

    return router;
  }
}
