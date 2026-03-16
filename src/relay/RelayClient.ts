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
import { RelayError } from './RelayError.js';
import type { CallHandler, MessageHandler, RelayClientOptions } from './types.js';

const logger = getLogger('relay_client');

// Any 2xx code is considered success
const SUCCESS_CODE_RE = /^2\d{2}$/;

// Safety limits
const DEFAULT_MAX_ACTIVE_CALLS = 1000;

type WsLike = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
  removeAllListeners(): void;
  readyState: number;
  ping?(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
};

export class RelayClient {
  readonly project: string;
  readonly token: string;
  readonly jwtToken: string;
  readonly host: string;
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

  constructor(options: RelayClientOptions = {}) {
    this.project = options.project ?? process.env.SIGNALWIRE_PROJECT_ID ?? '';
    this.token = options.token ?? process.env.SIGNALWIRE_TOKEN ?? '';
    this.jwtToken = process.env.SIGNALWIRE_JWT_TOKEN ?? '';
    this.host = options.host ?? process.env.SIGNALWIRE_SPACE ?? DEFAULT_RELAY_HOST;
    this.contexts = options.contexts ?? [];

    if (this.jwtToken) {
      // JWT auth — project/token not required
    } else if (!this.project || !this.token) {
      throw new Error(
        'project and token are required (or provide jwt_token). ' +
        'Pass them directly or set SIGNALWIRE_PROJECT_ID / SIGNALWIRE_TOKEN env vars.',
      );
    }

    // Validate host
    if (/[@/?#\r\n ]/.test(this.host)) {
      throw new Error(`Invalid host: ${this.host}. Must be a hostname, not a URL.`);
    }
  }

  get relayProtocol(): string {
    return this._relayProtocol;
  }

  // ─── Handler Registration ──────────────────────────────────────

  /** Register the inbound call handler. */
  onCall(handler: CallHandler): void {
    this._onCallHandler = handler;
  }

  /** Register the inbound message handler. */
  onMessage(handler: MessageHandler): void {
    this._onMessageHandler = handler;
  }

  // ─── Connection Lifecycle ──────────────────────────────────────

  /** Connect to RELAY and authenticate. */
  async connect(): Promise<void> {
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
    return new WS(uri, { maxPayload: 10 * 1024 * 1024 }) as unknown as WsLike;
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

  /** Cleanly close the connection. */
  async disconnect(): Promise<void> {
    this._closing = true;
    this._connected = false;
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
        deferred.reject(new RelayError('Connection closed'));
        deferred.promise.catch(() => {});
      }
    }
    this._executeQueue = [];

    // Cancel pending dials
    for (const deferred of Array.from(this._pendingDials.values())) {
      if (!deferred.settled) {
        deferred.reject(new RelayError('Connection closed during dial'));
        deferred.promise.catch(() => {});
      }
    }
    this._pendingDials.clear();
    this._dialCallsByTag.clear();

    logger.info('Disconnected from RELAY');
  }

  // ─── Public RPC Interface ──────────────────────────────────────

  /** Send a JSON-RPC request and await the response. */
  async execute(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this._sendRequest(method, params);
  }

  /** Initiate an outbound call. Returns a Call when answered. */
  async dial(
    devices: Record<string, unknown>[][],
    options: {
      tag?: string;
      maxDuration?: number;
      dialTimeout?: number;
    } = {},
  ): Promise<Call> {
    const dialTag = options.tag ?? randomUUID();
    const params: Record<string, unknown> = {
      tag: dialTag,
      devices,
    };
    if (options.maxDuration != null) params.max_duration = options.maxDuration;

    // Register a deferred that _handleEvent will resolve
    const dialDeferred = createDeferred<Call>();
    this._pendingDials.set(dialTag, dialDeferred);
    this._dialCallsByTag.set(dialTag, []);

    try {
      await this.execute('calling.dial', params);

      const timeout = options.dialTimeout ?? 120_000;
      const call = await new Promise<Call>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new RelayError(`Dial timed out waiting for answer (tag=${dialTag})`));
        }, timeout);
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

  /** Send an outbound SMS/MMS message. Returns a Message. */
  async sendMessage(options: {
    to: string;
    from: string;
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
      to_number: options.to,
      from_number: options.from,
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
      fromNumber: options.from,
      toNumber: options.to,
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

  /** Subscribe to additional contexts. */
  async receive(contexts: string[]): Promise<void> {
    if (!contexts.length) return;
    await this._sendRequest(METHOD_SIGNALWIRE_RECEIVE, { contexts });
    logger.info(`Subscribed to contexts: ${contexts}`);
  }

  /** Unsubscribe from contexts. */
  async unreceive(contexts: string[]): Promise<void> {
    if (!contexts.length) return;
    await this._sendRequest(METHOD_SIGNALWIRE_UNRECEIVE, { contexts });
    logger.info(`Unsubscribed from contexts: ${contexts}`);
  }

  // ─── Run (auto-reconnect loop) ────────────────────────────────

  /** Blocking entry point — connects and maintains connection with auto-reconnect. */
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
          throw new RelayError('Execute queue full — too many requests while disconnected');
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
          reject(new RelayError(`Request timeout for ${method}`));
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
          deferred.reject(new RelayError(`Failed to send queued request: ${err}`));
          deferred.promise.catch(() => {});
        }
      }
    }
  }

  private _clearPendingRequests(): void {
    for (const deferred of Array.from(this._pending.values())) {
      if (!deferred.settled) {
        deferred.reject(new RelayError('Connection closed'));
        deferred.promise.catch(() => {});
      }
    }
    this._pending.clear();
    this._pendingMethods.clear();

    for (const deferred of Array.from(this._pendingDials.values())) {
      if (!deferred.settled) {
        deferred.reject(new RelayError('Connection closed during dial'));
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
          String(error.message ?? 'Unknown error'),
          error.code ?? -1,
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
              String(result.message ?? 'Unknown error'),
              intCode,
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
      dialDeferred.reject(new RelayError(`Dial failed (tag=${tag})`));
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
