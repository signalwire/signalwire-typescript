/**
 * RelayClient — WebSocket + JSON-RPC 2.0 protocol + event dispatch.
 *
 * One instance = one persistent WebSocket connection to SignalWire RELAY.
 *
 * Architecture:
 * - JSON-RPC requests tracked by `id` in `_pending`; responses resolve deferreds
 * - signalwire.event messages ACKed back to server, then dispatched to Call/Message
 * - Result code checking accepts any 2xx (regex /^2\d{2}$/)
 * - signalwire.connect responses skip code checking
 * - Execute queue for requests while disconnected
 * - Auto-reconnect with exponential backoff
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomUUID } from 'node:crypto';
import { getLogger } from '../Logger.js';
import { Call } from './Call.js';
import { createDeferred, type Deferred } from './Deferred.js';
import {
  AGENT_STRING,
  PROTOCOL_VERSION,
  DEFAULT_RELAY_HOST,
  EVENT_AUTHORIZATION_STATE,
  EVENT_CALL_DIAL,
  EVENT_CALL_RECEIVE,
  EVENT_CALL_STATE,
  EVENT_MESSAGING_RECEIVE,
  EVENT_MESSAGING_STATE,
  METHOD_SIGNALWIRE_CONNECT,
  METHOD_SIGNALWIRE_DISCONNECT,
  METHOD_SIGNALWIRE_EVENT,
  METHOD_SIGNALWIRE_PING,
  METHOD_SIGNALWIRE_RECEIVE,
  METHOD_SIGNALWIRE_UNRECEIVE,
  RECONNECT_BACKOFF_FACTOR,
  RECONNECT_MAX_DELAY,
  RECONNECT_MIN_DELAY,
  CLIENT_PING_INTERVAL,
  CLIENT_PING_MAX_FAILURES,
  SERVER_PING_TIMEOUT,
  REQUEST_TIMEOUT,
  EXECUTE_QUEUE_MAX,
} from './constants.js';
import { Message } from './Message.js';
import { normalizeDevicePlan } from './normalize.js';
import { RelayError } from './RelayError.js';
import type { CallHandler, MessageHandler, RelayClientOptions } from './types.js';

// Polyfill Symbol.asyncDispose for runtimes that don't have it yet (Node <20.4)
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
(Symbol as any).asyncDispose ??= Symbol.for('Symbol.asyncDispose');

const logger = getLogger('relay_client');

// Any 2xx code is considered success
const SUCCESS_CODE_RE = /^2\d{2}$/;

// Safety limits
const DEFAULT_MAX_ACTIVE_CALLS = 1000;

// Max concurrent RelayClient connections per process (env: RELAY_MAX_CONNECTIONS)
// Mirrors Python _MAX_CONNECTIONS (relay/client.py:81-88). Default 1, min 1,
// invalid env values fall back to 1.
function _parseMaxConnections(): number {
  const raw = process.env.RELAY_MAX_CONNECTIONS;
  if (raw == null || raw === '') return 1;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) return 1;
  return Math.max(1, parsed);
}
const _MAX_CONNECTIONS = _parseMaxConnections();

// Process-wide tracking of active RelayClient instances. Python uses id(self);
// TS has no such helper, so we track instance refs — identity equality is fine.
const _activeClients: Set<RelayClient> = new Set();

type WsLike = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
  removeAllListeners(): void;
  readyState: number;
  ping?(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
};

/**
 * Real-time WebSocket client for SignalWire RELAY.
 *
 * One instance = one persistent JSON-RPC 2.0 WebSocket connection. Lets you
 * place / receive calls and SMS, play/record media, run TTS, conference calls
 * together, and subscribe to platform events — all without HTTP polling.
 *
 * Authentication supports either a project/token pair or a JWT.
 *
 * @example Inbound-call handler
 * ```ts
 * import { RelayClient } from '@signalwire/sdk';
 *
 * const client = new RelayClient({
 *   project: process.env.SIGNALWIRE_PROJECT_ID!,
 *   token: process.env.SIGNALWIRE_API_TOKEN!,
 *   host: 'example.signalwire.com',
 *   contexts: ['office'],
 * });
 *
 * client.onCall(async (call) => {
 *   await call.answer();
 *   await call.playTTS({ text: 'Thanks for calling!' });
 *   await call.hangup();
 * });
 *
 * await client.connect();
 * ```
 *
 * @example Outbound dial + SMS
 * ```ts
 * await client.connect();
 * const call = await client.dial({
 *   devices: [[{ type: 'phone', to: '+15551234567', from: '+15557654321' }]],
 * });
 * await client.sendMessage({ to: '+15551234567', from: '+15557654321', body: 'Hi!' });
 * ```
 *
 * @see {@link Call}
 * @see {@link Message}
 */
export class RelayClient {
  /** Project ID used for Basic Auth. */
  readonly project: string;
  /** API token used for Basic Auth. */
  readonly token: string;
  /** JWT used instead of project/token if provided. */
  readonly jwtToken: string;
  /** Hostname of the RELAY endpoint (e.g. `example.signalwire.com`). */
  readonly host: string;
  /** Contexts this client subscribes to for inbound events. */
  readonly contexts: string[];

  private _ws: WsLike | null = null;
  private _pending = new Map<string, Deferred<Record<string, unknown>>>();
  private _pendingMethods = new Map<string, string>();
  private _calls = new Map<string, Call>();
  private _messages = new Map<string, Message>();
  private _pendingDials = new Map<string, Deferred<Call>>();
  private _dialCallsByTag = new Map<string, Call[]>();
  private _executeQueue: Array<{
    message: Record<string, unknown>;
    deferred: Deferred<Record<string, unknown>>;
  }> = [];

  private _onCallHandler: CallHandler | null = null;
  private _onMessageHandler: MessageHandler | null = null;

  private _connected = false;
  private _closing = false;
  private _reconnectDelay = RECONNECT_MIN_DELAY;
  private _relayProtocol = '';
  private _identity = '';
  private _authorizationState = '';
  private _pingInterval: ReturnType<typeof setInterval> | null = null;
  private _pingFailures = 0;
  private _serverPingTimeout: ReturnType<typeof setTimeout> | null = null;
  private _maxActiveCalls = DEFAULT_MAX_ACTIVE_CALLS;

  // For run() — resolves when shutdown requested
  private _shutdownDeferred: Deferred<void> | null = null;
  private _signalHandlers: Array<() => void> = [];

  /**
   * WebSocket constructor override for testing.
   * @internal
   */
  _wsFactory: ((url: string) => WsLike) | null = null;

  /**
   * Create a new RELAY client.
   * Credentials fall back to the `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`,
   * `SIGNALWIRE_JWT_TOKEN`, and `SIGNALWIRE_SPACE` env vars when omitted.
   * @param options - Optional client configuration.
   */
  constructor(options: RelayClientOptions = {}) {
    this.project = options.project ?? process.env.SIGNALWIRE_PROJECT_ID ?? '';
    this.token = options.token ?? process.env.SIGNALWIRE_API_TOKEN ?? '';
    this.jwtToken = options.jwtToken ?? process.env.SIGNALWIRE_JWT_TOKEN ?? '';
    this.host = options.host ?? process.env.SIGNALWIRE_SPACE ?? DEFAULT_RELAY_HOST;
    this.contexts = options.contexts ?? [];

    if (this.jwtToken) {
      // JWT auth — project/token not required
    } else if (!this.project || !this.token) {
      throw new Error(
        'project and token are required (or provide jwt_token). ' +
        'Pass them directly or set SIGNALWIRE_PROJECT_ID / SIGNALWIRE_API_TOKEN env vars.',
      );
    }

    // Validate host
    if (/[@/?#\r\n ]/.test(this.host)) {
      throw new Error(`Invalid host: ${this.host}. Must be a hostname, not a URL.`);
    }

    // Max concurrent calls (constructor > env var > default)
    if (options.maxActiveCalls != null) {
      this._maxActiveCalls = Math.max(1, options.maxActiveCalls);
    } else {
      const envVal = process.env.RELAY_MAX_ACTIVE_CALLS ?? '';
      const parsed = parseInt(envVal, 10);
      this._maxActiveCalls = envVal && !isNaN(parsed) ? Math.max(1, parsed) : DEFAULT_MAX_ACTIVE_CALLS;
    }
  }

  /** The protocol name the server assigned to this client after `connect()`. */
  get relayProtocol(): string {
    return this._relayProtocol;
  }

  /**
   * Async disposable support — equivalent to Python's `__aexit__`.
   *
   * Enables usage with `await using`:
   * ```ts
   * await using client = new RelayClient({ ... });
   * await client.connect();
   * // ... automatically disconnects when scope exits
   * ```
   *
   * For environments without `await using`, use try/finally:
   * ```ts
   * const client = new RelayClient({ ... });
   * try { await client.connect(); ... }
   * finally { await client.disconnect(); }
   * ```
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.disconnect();
  }

  // ─── Handler Registration ──────────────────────────────────────

  /**
   * Register the inbound call handler.
   *
   * The handler is invoked once per inbound call, with a fully-formed
   * {@link Call} already in state `"created"`. Answer, reject, or forward
   * the call from inside the handler.
   *
   * @param handler - Callback invoked for each inbound call. May return a
   *   promise; errors are logged but do not tear down the client.
   * @returns The same handler, to support decorator-style usage.
   */
  onCall(handler: CallHandler): CallHandler {
    this._onCallHandler = handler;
    return handler;
  }

  /**
   * Register the inbound message handler.
   *
   * The handler is invoked once per inbound SMS/MMS delivered to a subscribed
   * context, with a {@link Message} already in state `"received"`.
   *
   * @param handler - Callback invoked for each inbound message. May return a
   *   promise; errors are logged but do not tear down the client.
   * @returns The same handler, to support decorator-style usage.
   */
  onMessage(handler: MessageHandler): MessageHandler {
    this._onMessageHandler = handler;
    return handler;
  }

  // ─── Connection Lifecycle ──────────────────────────────────────

  /**
   * Connect to RELAY and authenticate.
   *
   * Opens the WebSocket, runs the JSON-RPC `signalwire.connect` handshake,
   * and starts the client-side ping loop. Safe to call again after a
   * `disconnect()` to reconnect; the process-wide concurrent-connection limit
   * is enforced here.
   *
   * @returns Resolves once the client is connected and authenticated.
   * @throws {Error} When the process-wide connection limit is reached,
   *   authentication fails, or the WebSocket cannot be opened.
   */
  async connect(): Promise<void> {
    // Guard against connection leaks — enforce per-process limit.
    // Don't count ourselves (allows reconnect without double-counting).
    // Mirrors Python relay/client.py:216-228.
    let otherCount = 0;
    for (const c of _activeClients) {
      if (c !== this) otherCount++;
    }
    if (otherCount >= _MAX_CONNECTIONS) {
      throw new Error(
        `RelayClient connection limit reached (${_MAX_CONNECTIONS}). ` +
        `There are already ${otherCount} active connection(s) in this process. ` +
        `Call disconnect() on existing clients first, or set ` +
        `RELAY_MAX_CONNECTIONS env var to allow more.`,
      );
    }
    _activeClients.add(this);

    const uri = `wss://${this.host}`;
    logger.info(`Connecting to ${uri}`);

    const ws = this._wsFactory
      ? this._wsFactory(uri)
      : await this._createWebSocket(uri);

    this._ws = ws;
    this._connected = true;
    this._reconnectDelay = RECONNECT_MIN_DELAY;

    // Set up message handling
    this._setupWsListeners(ws);

    // Authenticate
    await this._authenticate();

    // Start client ping loop
    this._pingFailures = 0;
    this._startPingLoop();

    // Flush queued requests
    this._flushExecuteQueue();

    logger.info('Connected and authenticated to RELAY');
  }

  /** Create a real WebSocket (uses dynamic import for ws). */
  private async _createWebSocket(uri: string): Promise<WsLike> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const wsModule = await import('ws');
    const WS = wsModule.default ?? wsModule;
    const ws = new WS(uri, { maxPayload: 10 * 1024 * 1024 }) as unknown as WsLike;
    // Wait for the socket to finish the handshake before the caller tries to
    // send signalwire.connect — otherwise send() throws "readyState 0".
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    return ws;
  }

  private _setupWsListeners(ws: WsLike): void {
    ws.on('message', (data: any) => {
      const raw = typeof data === 'string' ? data : data.toString();
      let msg: Record<string, any>;
      try {
        msg = JSON.parse(raw);
      } catch {
        logger.warn(`Invalid JSON received: ${raw}`);
        return;
      }
      logger.debug(`<< ${raw}`);
      this._handleMessage(msg).catch((err) => {
        logger.error(`Error handling message: ${err}`);
      });
    });

    ws.on('close', () => {
      logger.info('WebSocket connection closed');
      this._connected = false;
      this._stopPingLoop();
      this._cancelServerPingTimeout();
    });

    ws.on('error', (err: any) => {
      logger.error(`WebSocket error: ${err}`);
    });

    // Server ping (if ws supports it)
    ws.on('ping', () => {
      this._resetServerPingTimeout();
    });
  }

  /** Send signalwire.connect and wait for the response. */
  private async _authenticate(): Promise<void> {
    let authentication: Record<string, unknown>;
    if (this.jwtToken) {
      authentication = { jwt_token: this.jwtToken };
    } else {
      authentication = { project: this.project, token: this.token };
    }

    const params: Record<string, unknown> = {
      version: PROTOCOL_VERSION,
      agent: AGENT_STRING,
      event_acks: true,
      authentication,
    };
    if (this.contexts.length > 0) {
      params.contexts = this.contexts;
    }
    if (this._relayProtocol) {
      params.protocol = this._relayProtocol;
    }
    if (this._authorizationState) {
      params.authorization_state = this._authorizationState;
    }

    const result = await this._sendRequest(METHOD_SIGNALWIRE_CONNECT, params);

    this._relayProtocol = (result.protocol as string) ?? this._relayProtocol;
    this._identity = (result.identity as string) ?? this._identity;
    logger.debug(`Auth response: protocol=${this._relayProtocol} identity=${this._identity}`);
  }

  /**
   * Cleanly close the connection.
   *
   * Stops the ping loop, drops the WebSocket, rejects every pending request
   * and dial with a `Connection closed` {@link RelayError}, and removes the
   * client from the process-wide active set. Safe to call repeatedly.
   *
   * @returns Resolves once all resources have been released.
   */
  async disconnect(): Promise<void> {
    this._closing = true;
    this._connected = false;
    // Mirrors Python relay/client.py:290 — remove from per-process active set.
    // Safe to call even if we never connected (Set.delete is idempotent).
    _activeClients.delete(this);
    this._stopPingLoop();
    this._cancelServerPingTimeout();

    if (this._ws) {
      this._ws.removeAllListeners();
      this._ws.close();
      this._ws = null;
    }

    // Reject all pending
    this._clearPendingRequests();

    // Cancel queued requests
    for (const { deferred } of this._executeQueue) {
      if (!deferred.settled) {
        deferred.reject(new RelayError(-1, 'Connection closed'));
        deferred.promise.catch(() => {});
      }
    }
    this._executeQueue = [];

    // Cancel pending dials
    for (const deferred of Array.from(this._pendingDials.values())) {
      if (!deferred.settled) {
        deferred.reject(new RelayError(-1, 'Connection closed during dial'));
        deferred.promise.catch(() => {});
      }
    }
    this._pendingDials.clear();
    this._dialCallsByTag.clear();

    logger.info('Disconnected from RELAY');
  }

  // ─── Public RPC Interface ──────────────────────────────────────

  /**
   * Send a JSON-RPC request and await the response.
   *
   * This is the low-level escape hatch for calling RELAY methods that don't
   * yet have a higher-level helper on this class. Queued if the client is
   * currently disconnected; sent immediately otherwise.
   *
   * @param method - Fully-qualified JSON-RPC method name (e.g. `"calling.play"`).
   * @param params - Method-specific params object.
   * @returns The `result` field of the JSON-RPC response.
   * @throws {RelayError} When the server returns a non-2xx code.
   */
  async execute(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this._sendRequest(method, params);
  }

  /**
   * Initiate an outbound call.
   *
   * Accepts a "dial plan" — an outer array of serial groups, each containing
   * an inner array of devices dialled in parallel. Resolves when any device
   * answers; rejects if no device answers within `dialTimeout`.
   *
   * @param devices - Serial/parallel dial plan. `[[A], [B, C]]` dials A first,
   *   then B and C in parallel.
   * @param options - Optional dial behaviour overrides.
   * @param options.tag - Client-provided tag for event correlation.
   *   Auto-generated (UUID) when omitted.
   * @param options.maxDuration - Maximum call duration in minutes.
   * @param options.dialTimeout - Seconds to wait for the dial to complete.
   *   Defaults to `120`.
   * @returns A {@link Call} representing the answered leg.
   * @throws {Error} When the dial times out.
   * @throws {RelayError} When the server rejects the dial request.
   */
  async dial(
    devices: Record<string, unknown>[][],
    options: {
      tag?: string;
      maxDuration?: number;
      /** Dial timeout in seconds (default 120). */
      dialTimeout?: number;
    } = {},
  ): Promise<Call> {
    const dialTag = options.tag ?? randomUUID();
    const params: Record<string, unknown> = {
      tag: dialTag,
      devices: normalizeDevicePlan(devices),
    };
    if (options.maxDuration != null) params.max_duration = options.maxDuration;

    // Register a deferred that _handleEvent will resolve
    const dialDeferred = createDeferred<Call>();
    this._pendingDials.set(dialTag, dialDeferred);
    this._dialCallsByTag.set(dialTag, []);

    try {
      await this.execute('calling.dial', params);

      const timeoutSec = options.dialTimeout ?? 120;
      const timeoutMs = timeoutSec * 1000;
      const call = await new Promise<Call>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new RelayError(-1, `Dial timed out waiting for answer (tag=${dialTag})`));
        }, timeoutMs);
        dialDeferred.promise.then(
          (v) => { clearTimeout(timer); resolve(v); },
          (e) => { clearTimeout(timer); reject(e); },
        );
      });
      return call;
    } catch (err) {
      if (!dialDeferred.settled) {
        dialDeferred.reject(err);
        dialDeferred.promise.catch(() => {});
      }
      throw err;
    } finally {
      this._pendingDials.delete(dialTag);
      this._dialCallsByTag.delete(dialTag);
    }
  }

  /**
   * Send an outbound SMS / MMS message.
   *
   * The method returns as soon as the server has accepted the send; track the
   * message's terminal state with {@link Message.wait} or the `onCompleted`
   * callback.
   *
   * @param options - Send parameters.
   * @param options.toNumber - Destination phone number in E.164 format.
   * @param options.fromNumber - Sender phone number in E.164 format.
   * @param options.context - Context for receiving state events. Defaults to
   *   the negotiated relay protocol.
   * @param options.body - Text body of the message.
   * @param options.media - List of media URLs for MMS.
   * @param options.tags - Tags attached to the message for correlation.
   * @param options.region - Origination region override.
   * @param options.onCompleted - Optional callback fired when the message
   *   reaches a terminal state (delivered / failed / undelivered).
   * @returns A {@link Message} tracking the outbound send.
   * @throws {RelayError} When the server rejects the send request.
   */
  async sendMessage(options: {
    toNumber: string;
    fromNumber: string;
    context?: string;
    body?: string;
    media?: string[];
    tags?: string[];
    region?: string;
    onCompleted?: (event: any) => void | Promise<void>;
  }): Promise<Message> {
    if (!options.body && (!options.media || options.media.length === 0)) {
      throw new Error('At least one of body or media is required');
    }

    const msgContext = options.context ?? this._relayProtocol ?? 'default';
    const params: Record<string, unknown> = {
      context: msgContext,
      to_number: options.toNumber,
      from_number: options.fromNumber,
    };
    if (options.body) params.body = options.body;
    if (options.media) params.media = options.media;
    if (options.tags) params.tags = options.tags;
    if (options.region) params.region = options.region;

    const result = await this.execute('messaging.send', params);

    const messageId = (result.message_id as string) ?? '';
    const message = new Message({
      messageId,
      context: msgContext,
      direction: 'outbound',
      fromNumber: options.fromNumber,
      toNumber: options.toNumber,
      body: options.body ?? '',
      media: options.media ?? [],
      tags: options.tags ?? [],
      state: 'queued',
    });
    if (options.onCompleted) {
      message._onCompleted = options.onCompleted;
    }
    if (messageId) {
      this._messages.set(messageId, message);
    }

    return message;
  }

  /**
   * Subscribe to additional RELAY contexts on an already-connected client.
   *
   * Inbound calls and messages on any of the listed contexts will be delivered
   * to the `onCall` / `onMessage` handlers. A no-op when `contexts` is empty.
   *
   * @param contexts - Context names to subscribe to.
   * @returns Resolves once the server has confirmed the subscription.
   * @throws {RelayError} When the server rejects the subscribe request.
   */
  async receive(contexts: string[]): Promise<void> {
    if (!contexts.length) return;
    await this._sendRequest(METHOD_SIGNALWIRE_RECEIVE, { contexts });
    logger.info(`Subscribed to contexts: ${contexts}`);
  }

  /**
   * Unsubscribe from contexts previously passed to {@link receive} (or the
   * constructor). A no-op when `contexts` is empty.
   *
   * @param contexts - Context names to unsubscribe from.
   * @returns Resolves once the server has confirmed the unsubscribe.
   * @throws {RelayError} When the server rejects the unsubscribe request.
   */
  async unreceive(contexts: string[]): Promise<void> {
    if (!contexts.length) return;
    await this._sendRequest(METHOD_SIGNALWIRE_UNRECEIVE, { contexts });
    logger.info(`Unsubscribed from contexts: ${contexts}`);
  }

  // ─── Run (auto-reconnect loop) ────────────────────────────────

  /**
   * Blocking entry point — connects and maintains the connection with
   * auto-reconnect, returning only after a clean shutdown (Ctrl+C, SIGTERM,
   * or {@link disconnect} from another scope).
   *
   * Installs `SIGINT` / `SIGTERM` handlers, so typically only one `RelayClient`
   * per process should call `run()`.
   *
   * @returns Resolves once a shutdown has been requested and cleanup completes.
   * @throws {Error} Only on unrecoverable startup failures — normal
   *   disconnects are handled internally by the reconnect loop.
   */
  async run(): Promise<void> {
    this._closing = false;
    this._shutdownDeferred = createDeferred<void>();

    // Handle SIGINT/SIGTERM
    const shutdown = () => {
      logger.info('Shutting down ...');
      this._closing = true;
      if (this._ws) {
        this._ws.close();
      }
      this._shutdownDeferred?.resolve();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    this._signalHandlers = [
      () => process.removeListener('SIGINT', shutdown),
      () => process.removeListener('SIGTERM', shutdown),
    ];

    try {
      while (!this._closing) {
        try {
          await this.connect();

          // Block until connection closes
          await new Promise<void>((resolve) => {
            if (!this._ws) { resolve(); return; }
            this._ws.on('close', () => resolve());
          });
        } catch (err) {
          if (this._closing) break;
          logger.error(`Connection error: ${err}`);
        }

        if (this._closing) break;

        this._stopPingLoop();
        this._cancelServerPingTimeout();
        this._clearPendingRequests();

        // Auto-reconnect with exponential backoff
        logger.info(`Reconnecting in ${this._reconnectDelay.toFixed(1)}s ...`);
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, this._reconnectDelay * 1000);
          // If shutdown requested during wait, resolve immediately
          this._shutdownDeferred?.promise.then(() => {
            clearTimeout(timer);
            resolve();
          });
        });

        if (this._closing) break;

        this._reconnectDelay = Math.min(
          this._reconnectDelay * RECONNECT_BACKOFF_FACTOR,
          RECONNECT_MAX_DELAY,
        );
      }
    } finally {
      await this.disconnect();
      // Cleanup signal handlers
      for (const cleanup of this._signalHandlers) cleanup();
      this._signalHandlers = [];
      logger.info('RELAY client stopped');
    }
  }

  // ─── Internal: Send / Receive ──────────────────────────────────

  private async _sendRequest(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const reqId = randomUUID();
    const message: Record<string, unknown> = {
      jsonrpc: '2.0',
      id: reqId,
      method,
      params,
    };

    const deferred = createDeferred<Record<string, unknown>>();
    this._pending.set(reqId, deferred);
    this._pendingMethods.set(reqId, method);

    try {
      if (!this._ws || !this._connected) {
        if (this._executeQueue.length >= EXECUTE_QUEUE_MAX) {
          throw new RelayError(-1, 'Execute queue full — too many requests while disconnected');
        }
        this._executeQueue.push({ message, deferred });
        logger.debug(`Request queued (not connected): ${method}`);
      } else {
        const raw = JSON.stringify(message);
        logger.debug(`>> ${method} id=${reqId}`);
        this._ws.send(raw);
      }

      // Timeout
      return await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new RelayError(-1, `Request timeout for ${method}`));
          if (method !== METHOD_SIGNALWIRE_CONNECT) {
            this._forceClose();
          }
        }, REQUEST_TIMEOUT);

        deferred.promise.then(
          (v) => { clearTimeout(timer); resolve(v); },
          (e) => { clearTimeout(timer); reject(e); },
        );
      });
    } finally {
      this._pending.delete(reqId);
      this._pendingMethods.delete(reqId);
    }
  }

  private _flushExecuteQueue(): void {
    if (!this._executeQueue.length || !this._ws) return;
    const queued = [...this._executeQueue];
    this._executeQueue = [];
    logger.debug(`Flushing ${queued.length} queued requests`);
    for (const { message, deferred } of queued) {
      if (deferred.settled) continue;
      const raw = JSON.stringify(message);
      logger.debug(`>> (queued) ${message.method ?? '?'} id=${message.id ?? '?'}`);
      try {
        this._ws!.send(raw);
      } catch (err) {
        if (!deferred.settled) {
          deferred.reject(new RelayError(-1, `Failed to send queued request: ${err}`));
          deferred.promise.catch(() => {});
        }
      }
    }
  }

  private _clearPendingRequests(): void {
    for (const deferred of Array.from(this._pending.values())) {
      if (!deferred.settled) {
        deferred.reject(new RelayError(-1, 'Connection closed'));
        deferred.promise.catch(() => {});
      }
    }
    this._pending.clear();
    this._pendingMethods.clear();

    for (const deferred of Array.from(this._pendingDials.values())) {
      if (!deferred.settled) {
        deferred.reject(new RelayError(-1, 'Connection closed during dial'));
        deferred.promise.catch(() => {});
      }
    }
    this._pendingDials.clear();
    this._dialCallsByTag.clear();
  }

  // ─── Message Handling ──────────────────────────────────────────

  private async _handleMessage(msg: Record<string, any>): Promise<void> {
    if (typeof msg !== 'object' || msg === null) {
      logger.warn('Ignoring non-object message');
      return;
    }

    // JSON-RPC error response
    if ('id' in msg && 'error' in msg) {
      const reqId = msg.id as string;
      const deferred = this._pending.get(reqId);
      if (deferred && !deferred.settled) {
        const error = typeof msg.error === 'object' ? msg.error : { code: -1, message: String(msg.error) };
        deferred.reject(new RelayError(
          error.code ?? -1,
          String(error.message ?? 'Unknown error'),
        ));
      }
      return;
    }

    // JSON-RPC success response
    if ('id' in msg && 'result' in msg) {
      const reqId = msg.id as string;
      const deferred = this._pending.get(reqId);
      if (deferred && !deferred.settled) {
        const result = msg.result;
        if (typeof result !== 'object' || result === null) {
          deferred.resolve({ raw: result });
          return;
        }
        const requestMethod = this._pendingMethods.get(reqId) ?? '';
        if (requestMethod === METHOD_SIGNALWIRE_CONNECT) {
          deferred.resolve(result);
        } else {
          const code = result.code;
          const codeStr = code != null ? String(code) : null;
          if (codeStr != null && !SUCCESS_CODE_RE.test(codeStr)) {
            let intCode: number;
            try { intCode = parseInt(codeStr, 10); } catch { intCode = -1; }
            if (isNaN(intCode)) intCode = -1;
            deferred.reject(new RelayError(
              intCode,
              String(result.message ?? 'Unknown error'),
            ));
          } else {
            deferred.resolve(result);
          }
        }
      }
      return;
    }

    // Server-initiated method call
    const method = (msg.method ?? '') as string;
    const params = (msg.params ?? {}) as Record<string, any>;
    if (typeof params !== 'object') {
      logger.warn('Ignoring message with non-object params');
      return;
    }

    if (method === METHOD_SIGNALWIRE_EVENT) {
      if ('id' in msg) {
        this._sendEventAck(msg.id as string);
      }
      await this._handleEvent(params);
    } else if (method === METHOD_SIGNALWIRE_PING) {
      this._resetServerPingTimeout();
      if ('id' in msg) {
        this._sendPong(msg.id as string);
      }
    } else if (method === METHOD_SIGNALWIRE_DISCONNECT) {
      const restart = params.restart ?? false;
      logger.info(`Received signalwire.disconnect from server (restart=${restart})`);
      if ('id' in msg) {
        this._sendEventAck(msg.id as string);
      }
      if (restart) {
        this._relayProtocol = '';
        this._authorizationState = '';
      }
    }
  }

  // ─── Event Dispatch ────────────────────────────────────────────

  private async _handleEvent(payload: Record<string, any>): Promise<void> {
    const eventType = (payload.event_type ?? '') as string;
    const eventParams = (payload.params ?? {}) as Record<string, any>;
    const callId = (eventParams.call_id ?? '') as string;

    if (!eventType) {
      logger.warn(`Received event with empty event_type: ${JSON.stringify(payload)}`);
      return;
    }

    logger.debug(`Event: ${eventType} call_id=${callId}`);

    // Authorization state update
    if (eventType === EVENT_AUTHORIZATION_STATE) {
      const authState = (eventParams.authorization_state ?? '') as string;
      if (authState) {
        this._authorizationState = authState;
        logger.debug('Updated authorization_state for reconnection');
      }
      return;
    }

    // Inbound message
    if (eventType === EVENT_MESSAGING_RECEIVE) {
      this._handleInboundMessage(payload);
      return;
    }

    // Outbound message state change
    if (eventType === EVENT_MESSAGING_STATE) {
      this._handleMessageState(payload);
      return;
    }

    // Inbound call
    if (eventType === EVENT_CALL_RECEIVE) {
      this._handleInboundCall(payload);
      return;
    }

    // Outbound dial progress
    if (eventType === EVENT_CALL_DIAL) {
      await this._handleDialEvent(payload);
      return;
    }

    // State events during pending dial
    if (eventType === EVENT_CALL_STATE) {
      const tag = (eventParams.tag ?? '') as string;
      if (tag && this._pendingDials.has(tag) && callId) {
        if (!this._calls.has(callId)) {
          this._registerDialLeg(tag, eventParams);
        }
        // Fall through to normal routing
      }
    }

    // Route to existing Call by call_id
    if (callId) {
      const call = this._calls.get(callId);
      if (call) {
        await call._dispatchEvent(payload);
        if (call.state === 'ended') {
          this._calls.delete(callId);
        }
      }
    }
  }

  private _handleInboundCall(payload: Record<string, any>): void {
    if (this._calls.size >= this._maxActiveCalls) {
      logger.error(`Max active calls (${this._maxActiveCalls}) reached, dropping inbound call`);
      return;
    }
    const params = (payload.params ?? {}) as Record<string, any>;
    const callId = (params.call_id ?? '') as string;

    const call = new Call(
      this,
      callId,
      params.node_id ?? '',
      params.project_id ?? this.project,
      this._relayProtocol || params.context || params.protocol || '',
      {
        tag: params.tag ?? '',
        direction: params.direction ?? 'inbound',
        device: params.device,
        state: params.call_state ?? 'created',
        segmentId: params.segment_id ?? '',
      },
    );
    this._calls.set(callId, call);

    if (this._onCallHandler) {
      Promise.resolve(this._onCallHandler(call)).catch((err) => {
        logger.error(`Error in on_call handler for ${callId}: ${err}`);
      });
    } else {
      logger.warn(`Inbound call ${callId} but no on_call handler registered`);
    }
  }

  private _handleInboundMessage(payload: Record<string, any>): void {
    const params = (payload.params ?? {}) as Record<string, any>;
    const message = new Message({
      messageId: params.message_id ?? '',
      context: params.context ?? '',
      direction: params.direction ?? 'inbound',
      fromNumber: params.from_number ?? '',
      toNumber: params.to_number ?? '',
      body: params.body ?? '',
      media: params.media ?? [],
      segments: params.segments ?? 0,
      state: params.message_state ?? 'received',
      tags: params.tags ?? [],
    });

    if (this._onMessageHandler) {
      Promise.resolve(this._onMessageHandler(message)).catch((err) => {
        logger.error(`Error in on_message handler for ${message.messageId}: ${err}`);
      });
    } else {
      logger.warn(`Inbound message ${message.messageId} but no on_message handler registered`);
    }
  }

  private _handleMessageState(payload: Record<string, any>): void {
    const params = (payload.params ?? {}) as Record<string, any>;
    const messageId = (params.message_id ?? '') as string;
    const message = this._messages.get(messageId);
    if (message) {
      message._dispatchEvent(payload).catch((err) => {
        logger.error(`Error dispatching message state for ${messageId}: ${err}`);
      });
      if (message.isDone) {
        this._messages.delete(messageId);
      }
    } else {
      logger.debug(`State event for unknown message ${messageId}`);
    }
  }

  private _registerDialLeg(tag: string, eventParams: Record<string, any>): Call {
    const callId = (eventParams.call_id ?? '') as string;
    const nodeId = (eventParams.node_id ?? '') as string;
    const call = new Call(
      this,
      callId,
      nodeId,
      eventParams.project_id ?? this.project,
      this._relayProtocol,
      {
        tag,
        direction: 'outbound',
        device: eventParams.device,
        state: eventParams.call_state ?? 'created',
      },
    );
    this._calls.set(callId, call);
    const legs = this._dialCallsByTag.get(tag) ?? [];
    legs.push(call);
    this._dialCallsByTag.set(tag, legs);
    logger.debug(`Registered dial leg: call_id=${callId} tag=${tag}`);
    return call;
  }

  private async _handleDialEvent(payload: Record<string, any>): Promise<void> {
    const eventParams = (payload.params ?? {}) as Record<string, any>;
    const tag = (eventParams.tag ?? '') as string;
    const dialState = (eventParams.dial_state ?? '') as string;
    const callInfo = (eventParams.call ?? {}) as Record<string, any>;

    logger.debug(`Dial event: tag=${tag} state=${dialState}`);

    const dialDeferred = this._pendingDials.get(tag);
    if (!dialDeferred || dialDeferred.settled) {
      // Stale or progress event after resolution — dispatch to call if exists
      if (callInfo) {
        const cid = (callInfo.call_id ?? '') as string;
        const call = this._calls.get(cid);
        if (call) {
          await call._dispatchEvent(payload);
        }
      }
      return;
    }

    if (dialState === 'answered') {
      const winnerCallId = (callInfo.call_id ?? '') as string;
      const winnerNodeId = (callInfo.node_id ?? '') as string;
      let call = this._calls.get(winnerCallId);
      if (!call) {
        call = new Call(
          this,
          winnerCallId,
          winnerNodeId,
          this.project,
          this._relayProtocol,
          {
            tag,
            direction: 'outbound',
            device: callInfo.device,
            state: 'answered',
          },
        );
        this._calls.set(winnerCallId, call);
      } else {
        if (winnerNodeId && !call.nodeId) {
          call.nodeId = winnerNodeId;
        }
      }
      dialDeferred.resolve(call);
    } else if (dialState === 'failed') {
      dialDeferred.reject(new RelayError(-1, `Dial failed (tag=${tag})`));
      dialDeferred.promise.catch(() => {});
    }
    // "dialing" events are progress — don't resolve
  }

  // ─── Pong / ACK ───────────────────────────────────────────────

  private _sendPong(reqId: string): void {
    if (!this._ws) return;
    const msg = JSON.stringify({ jsonrpc: '2.0', id: reqId, result: {} });
    this._ws.send(msg);
  }

  private _sendEventAck(reqId: string): void {
    if (!this._ws) return;
    const msg = JSON.stringify({ jsonrpc: '2.0', id: reqId, result: {} });
    this._ws.send(msg);
  }

  // ─── Client Ping Loop ─────────────────────────────────────────

  private _startPingLoop(): void {
    this._stopPingLoop();
    this._pingInterval = setInterval(async () => {
      if (!this._connected || !this._ws) return;
      try {
        await this._sendRequest(METHOD_SIGNALWIRE_PING, {});
        this._pingFailures = 0;
      } catch {
        this._pingFailures++;
        const backoff = Math.min(
          RECONNECT_MIN_DELAY * (RECONNECT_BACKOFF_FACTOR ** this._pingFailures),
          RECONNECT_MAX_DELAY,
        );
        logger.warn(`Client ping failed (${this._pingFailures}/${CLIENT_PING_MAX_FAILURES}), backoff ${backoff.toFixed(1)}s`);
        if (this._pingFailures >= CLIENT_PING_MAX_FAILURES) {
          logger.error('Max ping failures reached, forcing reconnect');
          this._forceClose();
        }
      }
    }, CLIENT_PING_INTERVAL);
  }

  private _stopPingLoop(): void {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  // ─── Server Ping Watchdog ─────────────────────────────────────

  private _resetServerPingTimeout(): void {
    this._pingFailures = 0;
    this._cancelServerPingTimeout();
    this._serverPingTimeout = setTimeout(() => {
      logger.debug(`No server ping received in ${SERVER_PING_TIMEOUT}ms, client pings will probe`);
    }, SERVER_PING_TIMEOUT);
  }

  private _cancelServerPingTimeout(): void {
    if (this._serverPingTimeout) {
      clearTimeout(this._serverPingTimeout);
      this._serverPingTimeout = null;
    }
  }

  private _forceClose(): void {
    this._stopPingLoop();
    this._cancelServerPingTimeout();
    this._connected = false;
    if (this._ws) {
      this._ws.close();
    }
  }
}
