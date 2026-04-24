/**
 * Call object — represents a live RELAY call with command methods.
 *
 * Created by RelayClient on inbound calling.call.receive events or
 * outbound dial responses.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomUUID } from 'node:crypto';
import { getLogger } from '../Logger.js';
import {
  Action,
  PlayAction,
  RecordAction,
  DetectAction,
  CollectAction,
  StandaloneCollectAction,
  FaxAction,
  TapAction,
  StreamAction,
  PayAction,
  TranscribeAction,
  AIAction,
} from './Action.js';
import { createDeferred, type Deferred } from './Deferred.js';
import { CALL_STATE_ENDED, EVENT_CALL_COLLECT, EVENT_CALL_STATE } from './constants.js';
import {
  normalizeDevice,
  normalizeDevicePlan,
  normalizePlayItems,
} from './normalize.js';
import { RelayEvent, parseEvent } from './RelayEvent.js';
import type { CompletedCallback, EventHandler } from './types.js';

const logger = getLogger('relay_call');

/** Interface the Call needs from RelayClient (avoids circular import). */
export interface RelayClientLike {
  execute(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/**
 * Live RELAY call with command methods.
 *
 * Don't construct directly — `Call` instances are created by {@link RelayClient}
 * for inbound calls (delivered to your `onCall` handler) and for outbound dials.
 *
 * Each command method (`answer()`, `play()`, `record()`, etc.) returns when the
 * platform acknowledges the command; event-driven completion is exposed via
 * {@link Action} objects returned from the async "play/record/..." variants.
 *
 * @example Inside an onCall handler
 * ```ts
 * client.onCall(async (call) => {
 *   await call.answer();
 *   const play = await call.playAsync({ play: [{ type: 'tts', text: 'Hello!' }] });
 *   await play.wait();
 *   await call.hangup();
 * });
 * ```
 *
 * @see {@link RelayClient}
 * @see {@link Action}
 */
export class Call {
  /** @internal */ readonly _client: RelayClientLike;
  /** Unique call identifier assigned by the platform. */
  callId: string;
  /** RELAY node that owns this call. */
  nodeId: string;
  /** SignalWire project ID. */
  projectId: string;
  /** RELAY context this call was received on. */
  context: string;
  /** Opaque correlation tag attached at dial time. */
  tag: string;
  /** `"inbound"` or `"outbound"`. */
  direction: string;
  /** Device descriptor the call is associated with (phone, SIP, etc.). */
  device: Record<string, any>;
  /** Current call state (e.g. `"created"`, `"answered"`, `"ended"`). */
  state: string;
  /** Call segment ID used for event correlation. */
  segmentId: string;

  /** @internal */ readonly _listeners: Map<string, EventHandler[]> = new Map();
  /** @internal */ readonly _actions: Map<string, Action> = new Map();
  /** @internal */ readonly _ended: Deferred<RelayEvent>;

  constructor(
    client: RelayClientLike,
    callId: string,
    nodeId: string,
    projectId: string,
    context: string,
    options: {
      tag?: string;
      direction?: string;
      device?: Record<string, any>;
      state?: string;
      segmentId?: string;
    } = {},
  ) {
    this._client = client;
    this.callId = callId;
    this.nodeId = nodeId;
    this.projectId = projectId;
    this.context = context;
    this.tag = options.tag ?? '';
    this.direction = options.direction ?? '';
    this.device = options.device ?? {};
    this.state = options.state ?? '';
    this.segmentId = options.segmentId ?? '';
    this._ended = createDeferred<RelayEvent>();
  }

  // ─── Internal RPC Primitive ──────────────────────────────────────

  /** @internal Send a calling.<method> JSON-RPC request for this call. */
  async _execute(method: string, extraParams?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const rpcMethod = `calling.${method}`;
    const params: Record<string, unknown> = {
      node_id: this.nodeId,
      call_id: this.callId,
    };
    if (extraParams) {
      Object.assign(params, extraParams);
    }
    try {
      return await this._client.execute(rpcMethod, params);
    } catch (err: any) {
      if (err?.code !== undefined) {
        logger.warn(`Call ${this.callId} error during ${method} (code=${err.code}): ${err}`);
        return {};
      }
      throw err;
    }
  }

  // ─── Event Plumbing ──────────────────────────────────────────────

  /**
   * Register an event listener for this call.
   *
   * Multiple listeners for the same event type are supported. Listener errors
   * are logged but do not disrupt dispatch to other listeners.
   *
   * @param eventType - Fully-qualified event type (e.g.
   *   `"calling.call.state"`, `"calling.call.play"`).
   * @param handler - Callback invoked for each matching event.
   */
  on(eventType: string, handler: EventHandler): void {
    const handlers = this._listeners.get(eventType) ?? [];
    handlers.push(handler);
    this._listeners.set(eventType, handlers);
  }

  /** @internal Called by RelayClient when an event arrives for this call. */
  async _dispatchEvent(payload: Record<string, unknown>): Promise<void> {
    const event = parseEvent(payload as Record<string, any>);
    const eventType = event.eventType;

    // Update call state
    if (eventType === EVENT_CALL_STATE) {
      const callState = (event.params.call_state ?? this.state) as string;
      this.state = callState;
      if (this.state === CALL_STATE_ENDED && !this._ended.settled) {
        this._ended.resolve(event);
      }
    }

    // Route to active actions by control_id
    const controlId = (event.params.control_id ?? '') as string;
    if (controlId) {
      const action = this._actions.get(controlId);
      if (action) {
        action._checkEvent(event);
        if (action.completed) {
          this._actions.delete(controlId);
        }
      }
    }

    // Notify registered listeners (snapshot to allow modification during iteration)
    const handlers = [...(this._listeners.get(eventType) ?? [])];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        logger.error(`Error in event handler for ${eventType}: ${err}`);
      }
    }
  }

  /**
   * Wait for a specific event, optionally filtered by predicate.
   *
   * Registers a one-shot listener that is removed after resolving (or after
   * the timeout elapses). Useful for awaiting a specific state transition.
   *
   * @param eventType - Event type to wait for.
   * @param predicate - Optional filter — only events for which this returns
   *   `true` resolve the wait.
   * @param timeout - Optional timeout in milliseconds. Omit to wait forever.
   * @returns The first matching {@link RelayEvent}.
   * @throws {Error} When the optional timeout elapses before a match.
   */
  async waitFor(
    eventType: string,
    predicate?: (event: RelayEvent) => boolean,
    timeout?: number,
  ): Promise<RelayEvent> {
    const deferred = createDeferred<RelayEvent>();

    const handler: EventHandler = (event: RelayEvent) => {
      if (deferred.settled) return;
      if (predicate == null || predicate(event)) {
        deferred.resolve(event);
      }
    };

    this.on(eventType, handler);
    try {
      if (timeout != null) {
        return await new Promise<RelayEvent>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`waitFor(${eventType}) timed out after ${timeout}ms`));
          }, timeout);
          deferred.promise.then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); },
          );
        });
      }
      return await deferred.promise;
    } finally {
      // Clean up the one-shot handler
      const list = this._listeners.get(eventType);
      if (list) {
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    }
  }

  /**
   * Wait for the call to reach the `ended` state.
   *
   * @param timeout - Optional timeout in milliseconds.
   * @returns The terminating `calling.call.state` {@link RelayEvent}.
   * @throws {Error} When the optional timeout elapses before the call ends.
   */
  async waitForEnded(timeout?: number): Promise<RelayEvent> {
    if (timeout != null) {
      return new Promise<RelayEvent>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`waitForEnded timed out after ${timeout}ms`));
        }, timeout);
        this._ended.promise.then(
          (v) => { clearTimeout(timer); resolve(v); },
          (e) => { clearTimeout(timer); reject(e); },
        );
      });
    }
    return this._ended.promise;
  }

  // ─── Action Helper ───────────────────────────────────────────────

  /** @internal Register an action, execute the RPC, clean up on failure. */
  async _startAction<T extends Action>(
    action: T,
    method: string,
    params: Record<string, unknown>,
    onCompleted?: CompletedCallback | null,
  ): Promise<T> {
    if (this.state === CALL_STATE_ENDED) {
      logger.warn(`Call ${this.callId} already ended, skipping ${method}`);
      const goneEvent = new RelayEvent('', {});
      action._resolve(goneEvent);
      return action;
    }
    if (onCompleted) action._onCompleted = onCompleted;
    this._actions.set(action.controlId, action);
    try {
      const result = await this._execute(method, params);
      // _execute returns {} when the call is gone (404/410) — resolve immediately
      if (!result || Object.keys(result).length === 0) {
        this._actions.delete(action.controlId);
        if (!action._done.settled) {
          const goneEvent = new RelayEvent('', {});
          action._resolve(goneEvent);
        }
      }
    } catch (err) {
      this._actions.delete(action.controlId);
      if (!action._done.settled) {
        action._done.reject(err);
        // Suppress unhandled rejection — the caller gets the error via the rethrown exception
        action._done.promise.catch(() => {});
      }
      throw err;
    }
    return action;
  }

  // ─── Call Lifecycle Methods ──────────────────────────────────────

  /**
   * Answer an inbound call.
   *
   * @param extra - Optional additional params merged into the answer request
   *   (e.g. SIP headers, codec hints).
   * @returns The platform's answer response.
   * @throws {RelayError} When the answer command is rejected.
   */
  async answer(extra?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this._execute('answer', extra);
  }

  /**
   * End / hang up the call.
   *
   * @param reason - Hangup reason delivered to the platform. Defaults to
   *   `"hangup"`.
   * @returns The platform's end response.
   * @throws {RelayError} When the end command is rejected.
   */
  async hangup(reason = 'hangup'): Promise<Record<string, unknown>> {
    return this._execute('end', { reason });
  }

  /**
   * Decline control of an inbound call, returning it to routing.
   *
   * Use instead of {@link answer} when you want the call to fall through to
   * the next matching route rather than be handled by this client.
   *
   * @returns The platform's pass response.
   * @throws {RelayError} When the pass command is rejected.
   */
  async pass(): Promise<Record<string, unknown>> {
    return this._execute('pass');
  }

  // ─── Audio Playback ──────────────────────────────────────────────

  /**
   * Play audio content on the call.
   *
   * Returns immediately with a {@link PlayAction} — `await action.wait()` to
   * block until playback finishes, or call `stop()` / `pause()` / `resume()`
   * / `volume()` on it to control playback.
   *
   * @param media - Platform-shaped play items (TTS, audio URLs, silence, etc.).
   * @param options - Optional playback controls.
   * @param options.volume - Volume adjustment in dB.
   * @param options.direction - `"speak"`, `"hear"`, or `"both"`.
   * @param options.loop - Number of times to loop the playback.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.onCompleted - Callback fired when playback reaches a
   *   terminal state.
   * @returns A {@link PlayAction} for control and completion tracking.
   * @throws {RelayError} When the play command is rejected.
   */
  async play(
    media: Record<string, unknown>[],
    options: {
      volume?: number;
      direction?: string;
      loop?: number;
      controlId?: string;
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<PlayAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = {
      control_id: cid,
      play: normalizePlayItems(media),
    };
    if (options.volume != null) params.volume = options.volume;
    if (options.direction != null) params.direction = options.direction;
    if (options.loop != null) params.loop = options.loop;
    const action = new PlayAction(this, cid);
    return this._startAction(action, 'play', params, options.onCompleted);
  }

  // ─── Recording ───────────────────────────────────────────────────

  /**
   * Record audio from the call.
   *
   * @param audio - Platform-shaped audio recording options (direction, codec,
   *   timeouts, etc.). Defaults to `{}`.
   * @param options - Recording behaviour.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.onCompleted - Callback fired when the recording reaches a
   *   terminal state.
   * @returns A {@link RecordAction} for control and completion tracking.
   * @throws {RelayError} When the record command is rejected.
   */
  async record(
    audio?: Record<string, unknown>,
    options: {
      controlId?: string;
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<RecordAction> {
    const cid = options.controlId ?? randomUUID();
    const recordObj = { audio: audio ?? {} };
    const params: Record<string, unknown> = { control_id: cid, record: recordObj };
    const action = new RecordAction(this, cid);
    return this._startAction(action, 'record', params, options.onCompleted);
  }

  // ─── Input Collection ────────────────────────────────────────────

  /**
   * Play audio and collect digit / speech input in a single operation.
   *
   * Convenient for IVR prompts — playback stops as soon as input is received.
   *
   * @param media - Audio items to play while collecting.
   * @param collect - Platform-shaped collect config (`digits`, `speech`, etc.).
   * @param options - Playback and collection behaviour.
   * @param options.volume - Playback volume adjustment in dB.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.onCompleted - Callback fired when collect completes.
   * @returns A {@link CollectAction} for the combined play-and-collect flow.
   * @throws {RelayError} When the play_and_collect command is rejected.
   */
  async playAndCollect(
    media: Record<string, unknown>[],
    collect: Record<string, unknown>,
    options: {
      volume?: number;
      controlId?: string;
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<CollectAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = {
      control_id: cid,
      play: normalizePlayItems(media),
      collect,
    };
    if (options.volume != null) params.volume = options.volume;
    const action = new CollectAction(this, cid);
    return this._startAction(action, 'play_and_collect', params, options.onCompleted);
  }

  /**
   * Collect digit / speech input without playing media.
   *
   * @param options - Collect configuration.
   * @param options.digits - DTMF digit-collection config.
   * @param options.speech - Speech-recognition config.
   * @param options.initialTimeout - Seconds to wait for the first input.
   * @param options.partialResults - Emit partial (interim) results.
   * @param options.continuous - Keep collecting until explicitly stopped.
   * @param options.sendStartOfInput - Emit a start-of-input event when detected.
   * @param options.startInputTimers - Start input timers immediately.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.onCompleted - Callback fired when collect completes.
   * @returns A {@link StandaloneCollectAction} for control and completion tracking.
   * @throws {RelayError} When the collect command is rejected.
   */
  async collect(options: {
    digits?: Record<string, unknown>;
    speech?: Record<string, unknown>;
    initialTimeout?: number;
    partialResults?: boolean;
    continuous?: boolean;
    sendStartOfInput?: boolean;
    startInputTimers?: boolean;
    controlId?: string;
    onCompleted?: CompletedCallback;
  } = {}): Promise<StandaloneCollectAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = { control_id: cid };
    if (options.digits != null) params.digits = options.digits;
    if (options.speech != null) params.speech = options.speech;
    if (options.initialTimeout != null) params.initial_timeout = options.initialTimeout;
    if (options.partialResults != null) params.partial_results = options.partialResults;
    if (options.continuous != null) params.continuous = options.continuous;
    if (options.sendStartOfInput != null) params.send_start_of_input = options.sendStartOfInput;
    if (options.startInputTimers != null) params.start_input_timers = options.startInputTimers;
    const action = new StandaloneCollectAction(this, cid);
    return this._startAction(action, 'collect', params, options.onCompleted);
  }

  // ─── Bridging & Connectivity ─────────────────────────────────────

  /**
   * Bridge the call to one or more destinations.
   *
   * @param devices - Serial/parallel dial plan — outer array of serial groups,
   *   inner arrays dialled in parallel.
   * @param options - Connect behaviour.
   * @param options.ringback - Ringback media played to the originating party.
   * @param options.tag - Tag for event correlation.
   * @param options.maxDuration - Maximum connect duration in seconds.
   * @param options.maxPricePerMinute - Price cap per minute.
   * @param options.statusUrl - Webhook URL for status events.
   * @returns The platform's connect response.
   * @throws {RelayError} When the connect command is rejected.
   */
  async connect(
    devices: Record<string, unknown>[][],
    options: {
      ringback?: Record<string, unknown>[];
      tag?: string;
      maxDuration?: number;
      maxPricePerMinute?: number;
      statusUrl?: string;
    } = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = { devices: normalizeDevicePlan(devices) };
    if (options.ringback != null) params.ringback = normalizePlayItems(options.ringback);
    if (options.tag != null) params.tag = options.tag;
    if (options.maxDuration != null) params.max_duration = options.maxDuration;
    if (options.maxPricePerMinute != null) params.max_price_per_minute = options.maxPricePerMinute;
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    return this._execute('connect', params);
  }

  /**
   * Disconnect (unbridge) a connected call.
   *
   * @returns The platform's disconnect response.
   * @throws {RelayError} When the disconnect command is rejected.
   */
  async disconnect(): Promise<Record<string, unknown>> {
    return this._execute('disconnect');
  }

  // ─── DTMF ────────────────────────────────────────────────────────

  /**
   * Send DTMF digits on the call.
   *
   * @param digits - The DTMF digit string to send (e.g. `"1234#"`, `"ww*9"`).
   * @param controlId - Explicit control ID. Auto-generated when omitted.
   * @returns The platform's send-digits response.
   * @throws {RelayError} When the send_digits command is rejected.
   */
  async sendDigits(digits: string, controlId?: string): Promise<Record<string, unknown>> {
    const cid = controlId ?? randomUUID();
    return this._execute('send_digits', { control_id: cid, digits });
  }

  // ─── Detection ───────────────────────────────────────────────────

  /**
   * Start audio detection (answering machine, fax, DTMF).
   *
   * @param detect - Platform-shaped detect configuration.
   * @param options - Detection behaviour.
   * @param options.timeout - Detection timeout in seconds.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.onCompleted - Callback fired when detection completes.
   * @returns A {@link DetectAction} for control and completion tracking.
   * @throws {RelayError} When the detect command is rejected.
   */
  async detect(
    detect: Record<string, unknown>,
    options: {
      timeout?: number;
      controlId?: string;
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<DetectAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = { control_id: cid, detect };
    if (options.timeout != null) params.timeout = options.timeout;
    const action = new DetectAction(this, cid);
    return this._startAction(action, 'detect', params, options.onCompleted);
  }

  // ─── SIP Refer ───────────────────────────────────────────────────

  /**
   * Transfer a SIP call via REFER.
   *
   * @param device - Platform-shaped SIP target device descriptor.
   * @param options - Optional REFER behaviour.
   * @param options.statusUrl - Webhook URL for REFER status events.
   * @returns The platform's refer response.
   * @throws {RelayError} When the refer command is rejected.
   */
  async refer(
    device: Record<string, unknown>,
    options: { statusUrl?: string } = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = { device: normalizeDevice(device) };
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    return this._execute('refer', params);
  }

  // ─── Payment ─────────────────────────────────────────────────────

  /**
   * Start a PCI-compliant payment collection flow.
   *
   * @param paymentConnectorUrl - URL of the configured payment connector to
   *   tokenise the card with.
   * @param options - Payment configuration — card-type filters, prompts,
   *   charge amount, etc. See the SignalWire pay documentation for field details.
   * @returns A {@link PayAction} tracking the payment-collection flow.
   * @throws {RelayError} When the pay command is rejected.
   */
  async pay(
    paymentConnectorUrl: string,
    options: {
      controlId?: string;
      inputMethod?: string;
      statusUrl?: string;
      paymentMethod?: string;
      timeout?: string;
      maxAttempts?: string;
      securityCode?: string;
      postalCode?: string;
      minPostalCodeLength?: string;
      tokenType?: string;
      chargeAmount?: string;
      currency?: string;
      language?: string;
      voice?: string;
      description?: string;
      validCardTypes?: string;
      parameters?: Record<string, unknown>[];
      prompts?: Record<string, unknown>[];
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<PayAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = {
      control_id: cid,
      payment_connector_url: paymentConnectorUrl,
    };
    if (options.inputMethod != null) params.input = options.inputMethod;
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    if (options.paymentMethod != null) params.payment_method = options.paymentMethod;
    if (options.timeout != null) params.timeout = options.timeout;
    if (options.maxAttempts != null) params.max_attempts = options.maxAttempts;
    if (options.securityCode != null) params.security_code = options.securityCode;
    if (options.postalCode != null) params.postal_code = options.postalCode;
    if (options.minPostalCodeLength != null) params.min_postal_code_length = options.minPostalCodeLength;
    if (options.tokenType != null) params.token_type = options.tokenType;
    if (options.chargeAmount != null) params.charge_amount = options.chargeAmount;
    if (options.currency != null) params.currency = options.currency;
    if (options.language != null) params.language = options.language;
    if (options.voice != null) params.voice = options.voice;
    if (options.description != null) params.description = options.description;
    if (options.validCardTypes != null) params.valid_card_types = options.validCardTypes;
    if (options.parameters != null) params.parameters = options.parameters;
    if (options.prompts != null) params.prompts = options.prompts;
    const action = new PayAction(this, cid);
    return this._startAction(action, 'pay', params, options.onCompleted);
  }

  // ─── Faxing ──────────────────────────────────────────────────────

  /**
   * Send a fax document.
   *
   * @param document - URL of the document to fax (TIFF or PDF).
   * @param options - Fax behaviour.
   * @param options.identity - Caller identity string sent in the fax header.
   * @param options.headerInfo - Additional fax header text.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.onCompleted - Callback fired when the fax completes.
   * @returns A {@link FaxAction} for control and completion tracking.
   * @throws {RelayError} When the send_fax command is rejected.
   */
  async sendFax(
    document: string,
    options: {
      identity?: string;
      headerInfo?: string;
      controlId?: string;
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<FaxAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = { control_id: cid, document };
    if (options.identity != null) params.identity = options.identity;
    if (options.headerInfo != null) params.header_info = options.headerInfo;
    const action = new FaxAction(this, cid, 'send_fax');
    return this._startAction(action, 'send_fax', params, options.onCompleted);
  }

  /**
   * Receive a fax and save it server-side.
   *
   * @param options - Fax reception behaviour.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.onCompleted - Callback fired when the fax completes.
   * @returns A {@link FaxAction} for control and completion tracking.
   * @throws {RelayError} When the receive_fax command is rejected.
   */
  async receiveFax(
    options: {
      controlId?: string;
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<FaxAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = { control_id: cid };
    const action = new FaxAction(this, cid, 'receive_fax');
    return this._startAction(action, 'receive_fax', params, options.onCompleted);
  }

  // ─── Tap (Media Interception) ────────────────────────────────────

  /**
   * Intercept call media and stream it to an external destination.
   *
   * @param tap - Platform-shaped tap configuration (direction, codec, etc.).
   * @param device - Destination device descriptor (WebSocket URL, etc.).
   * @param options - Tap behaviour.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.onCompleted - Callback fired when the tap completes.
   * @returns A {@link TapAction} for control and completion tracking.
   * @throws {RelayError} When the tap command is rejected.
   */
  async tap(
    tap: Record<string, unknown>,
    device: Record<string, unknown>,
    options: {
      controlId?: string;
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<TapAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = {
      control_id: cid,
      tap,
      device: normalizeDevice(device),
    };
    const action = new TapAction(this, cid);
    return this._startAction(action, 'tap', params, options.onCompleted);
  }

  // ─── Streaming ───────────────────────────────────────────────────

  /**
   * Start streaming call audio to a WebSocket endpoint.
   *
   * @param url - WebSocket URL to stream audio to.
   * @param options - Stream behaviour.
   * @param options.name - Friendly name for the stream.
   * @param options.codec - Audio codec (e.g. `"PCMU"`, `"PCMA"`).
   * @param options.track - Which track to send: `"inbound"`, `"outbound"`, or
   *   `"both"`.
   * @param options.statusUrl - Webhook URL for stream status events.
   * @param options.statusUrlMethod - HTTP method for `statusUrl` requests.
   * @param options.authorizationBearerToken - Bearer token sent to the stream endpoint.
   * @param options.customParameters - Extra parameters forwarded to the stream endpoint.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.onCompleted - Callback fired when the stream completes.
   * @returns A {@link StreamAction} for control and completion tracking.
   * @throws {RelayError} When the stream command is rejected.
   */
  async stream(
    url: string,
    options: {
      name?: string;
      codec?: string;
      track?: string;
      statusUrl?: string;
      statusUrlMethod?: string;
      authorizationBearerToken?: string;
      customParameters?: Record<string, unknown>;
      controlId?: string;
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<StreamAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = { control_id: cid, url };
    if (options.name != null) params.name = options.name;
    if (options.codec != null) params.codec = options.codec;
    if (options.track != null) params.track = options.track;
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    if (options.statusUrlMethod != null) params.status_url_method = options.statusUrlMethod;
    if (options.authorizationBearerToken != null) params.authorization_bearer_token = options.authorizationBearerToken;
    if (options.customParameters != null) params.custom_parameters = options.customParameters;
    const action = new StreamAction(this, cid);
    return this._startAction(action, 'stream', params, options.onCompleted);
  }

  // ─── Transfer ────────────────────────────────────────────────────

  /**
   * Transfer call control to another RELAY app or SWML script.
   *
   * @param dest - Destination identifier (RELAY context, SWML URL, etc.).
   * @param extra - Optional additional params merged into the transfer request.
   * @returns The platform's transfer response.
   * @throws {RelayError} When the transfer command is rejected.
   */
  async transfer(dest: string, extra?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = { dest, ...extra };
    return this._execute('transfer', params);
  }

  // ─── Conference ──────────────────────────────────────────────────

  /**
   * Join an ad-hoc audio conference.
   *
   * @param name - Conference name. Participants on the same name hear each other.
   * @param options - Conference behaviour (muting, recording, status callbacks, etc.).
   * @returns The platform's join-conference response.
   * @throws {RelayError} When the join_conference command is rejected.
   */
  async joinConference(
    name: string,
    options: {
      muted?: boolean;
      beep?: string;
      startOnEnter?: boolean;
      endOnExit?: boolean;
      waitUrl?: string;
      maxParticipants?: number;
      record?: string;
      region?: string;
      trim?: string;
      coach?: string;
      statusCallback?: string;
      statusCallbackEvent?: string;
      statusCallbackEventType?: string;
      statusCallbackMethod?: string;
      recordingStatusCallback?: string;
      recordingStatusCallbackEvent?: string;
      recordingStatusCallbackEventType?: string;
      recordingStatusCallbackMethod?: string;
      stream?: Record<string, unknown>;
    } = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = { name };
    if (options.muted != null) params.muted = options.muted;
    if (options.beep != null) params.beep = options.beep;
    if (options.startOnEnter != null) params.start_on_enter = options.startOnEnter;
    if (options.endOnExit != null) params.end_on_exit = options.endOnExit;
    if (options.waitUrl != null) params.wait_url = options.waitUrl;
    if (options.maxParticipants != null) params.max_participants = options.maxParticipants;
    if (options.record != null) params.record = options.record;
    if (options.region != null) params.region = options.region;
    if (options.trim != null) params.trim = options.trim;
    if (options.coach != null) params.coach = options.coach;
    if (options.statusCallback != null) params.status_callback = options.statusCallback;
    if (options.statusCallbackEvent != null) params.status_callback_event = options.statusCallbackEvent;
    if (options.statusCallbackEventType != null) params.status_callback_event_type = options.statusCallbackEventType;
    if (options.statusCallbackMethod != null) params.status_callback_method = options.statusCallbackMethod;
    if (options.recordingStatusCallback != null) params.recording_status_callback = options.recordingStatusCallback;
    if (options.recordingStatusCallbackEvent != null) params.recording_status_callback_event = options.recordingStatusCallbackEvent;
    if (options.recordingStatusCallbackEventType != null) params.recording_status_callback_event_type = options.recordingStatusCallbackEventType;
    if (options.recordingStatusCallbackMethod != null) params.recording_status_callback_method = options.recordingStatusCallbackMethod;
    if (options.stream != null) params.stream = options.stream;
    return this._execute('join_conference', params);
  }

  /**
   * Leave an audio conference.
   *
   * @param conferenceId - Identifier of the conference to leave.
   * @param extra - Optional additional params merged into the request.
   * @returns The platform's leave-conference response.
   * @throws {RelayError} When the leave_conference command is rejected.
   */
  async leaveConference(conferenceId: string, extra?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this._execute('leave_conference', { conference_id: conferenceId, ...extra });
  }

  // ─── Hold / Unhold ───────────────────────────────────────────────

  /**
   * Put the call on hold.
   *
   * @returns The platform's hold response.
   * @throws {RelayError} When the hold command is rejected.
   */
  async hold(): Promise<Record<string, unknown>> {
    return this._execute('hold');
  }

  /**
   * Release the call from hold.
   *
   * @returns The platform's unhold response.
   * @throws {RelayError} When the unhold command is rejected.
   */
  async unhold(): Promise<Record<string, unknown>> {
    return this._execute('unhold');
  }

  // ─── Denoise ─────────────────────────────────────────────────────

  /**
   * Start noise reduction on the call.
   *
   * @returns The platform's denoise response.
   * @throws {RelayError} When the denoise command is rejected.
   */
  async denoise(): Promise<Record<string, unknown>> {
    return this._execute('denoise');
  }

  /**
   * Stop noise reduction on the call.
   *
   * @returns The platform's denoise-stop response.
   * @throws {RelayError} When the denoise.stop command is rejected.
   */
  async denoiseStop(): Promise<Record<string, unknown>> {
    return this._execute('denoise.stop');
  }

  // ─── Transcribe ──────────────────────────────────────────────────

  /**
   * Start transcribing the call.
   *
   * @param options - Transcription behaviour.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.statusUrl - Webhook URL for transcription status events.
   * @param options.onCompleted - Callback fired when transcription completes.
   * @returns A {@link TranscribeAction} for control and completion tracking.
   * @throws {RelayError} When the transcribe command is rejected.
   */
  async transcribe(
    options: {
      controlId?: string;
      statusUrl?: string;
      onCompleted?: CompletedCallback;
    } = {},
  ): Promise<TranscribeAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = { control_id: cid };
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    const action = new TranscribeAction(this, cid);
    return this._startAction(action, 'transcribe', params, options.onCompleted);
  }

  // ─── Echo ────────────────────────────────────────────────────────

  /**
   * Echo audio back to the caller (useful for testing network round-trip).
   *
   * @param options - Echo behaviour.
   * @param options.timeout - How long to echo, in seconds.
   * @param options.statusUrl - Webhook URL for echo status events.
   * @returns The platform's echo response.
   * @throws {RelayError} When the echo command is rejected.
   */
  async echo(options: { timeout?: number; statusUrl?: string } = {}): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {};
    if (options.timeout != null) params.timeout = options.timeout;
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    return this._execute('echo', Object.keys(params).length ? params : undefined);
  }

  // ─── Digit Bindings ──────────────────────────────────────────────

  /**
   * Bind a DTMF digit sequence to trigger a RELAY method automatically when
   * the caller presses it.
   *
   * @param digits - DTMF sequence that triggers the binding (e.g. `"*9"`).
   * @param bindMethod - RELAY method to invoke when the sequence is detected.
   * @param options - Binding behaviour.
   * @param options.bindParams - Params forwarded to `bindMethod` on trigger.
   * @param options.realm - Optional realm label so bindings can be cleared in groups.
   * @param options.maxTriggers - Maximum number of times the binding can fire.
   * @returns The platform's bind_digit response.
   * @throws {RelayError} When the bind_digit command is rejected.
   */
  async bindDigit(
    digits: string,
    bindMethod: string,
    options: {
      bindParams?: Record<string, unknown>;
      realm?: string;
      maxTriggers?: number;
    } = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {
      digits,
      bind_method: bindMethod,
    };
    if (options.bindParams != null) params.params = options.bindParams;
    if (options.realm != null) params.realm = options.realm;
    if (options.maxTriggers != null) params.max_triggers = options.maxTriggers;
    return this._execute('bind_digit', params);
  }

  /**
   * Clear all digit bindings, optionally filtered by realm.
   *
   * @param realm - When provided, only bindings with this realm label are cleared.
   * @returns The platform's clear_digit_bindings response.
   * @throws {RelayError} When the clear_digit_bindings command is rejected.
   */
  async clearDigitBindings(realm?: string): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {};
    if (realm != null) params.realm = realm;
    return this._execute('clear_digit_bindings', Object.keys(params).length ? params : undefined);
  }

  // ─── Live Transcribe / Translate ─────────────────────────────────

  /**
   * Start or stop live transcription on the call.
   *
   * @param action - Platform-shaped action block (`start` or `stop` plus
   *   configuration).
   * @param extra - Optional additional params merged into the request.
   * @returns The platform's live_transcribe response.
   * @throws {RelayError} When the live_transcribe command is rejected.
   */
  async liveTranscribe(action: Record<string, unknown>, extra?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this._execute('live_transcribe', { action, ...extra });
  }

  /**
   * Start or stop live translation on the call.
   *
   * @param action - Platform-shaped action block (`start` or `stop` plus
   *   source/target languages).
   * @param options - Live-translate behaviour.
   * @param options.statusUrl - Webhook URL for translation status events.
   * @returns The platform's live_translate response.
   * @throws {RelayError} When the live_translate command is rejected.
   */
  async liveTranslate(
    action: Record<string, unknown>,
    options: { statusUrl?: string } = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = { action };
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    return this._execute('live_translate', params);
  }

  // ─── Room ────────────────────────────────────────────────────────

  /**
   * Join a video / audio room.
   *
   * @param name - Room name — callers on the same name share the same room.
   * @param options - Room behaviour.
   * @param options.statusUrl - Webhook URL for room status events.
   * @returns The platform's join_room response.
   * @throws {RelayError} When the join_room command is rejected.
   */
  async joinRoom(
    name: string,
    options: { statusUrl?: string } = {},
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = { name };
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    return this._execute('join_room', params);
  }

  /**
   * Leave the current room.
   *
   * @param extra - Optional additional params merged into the request.
   * @returns The platform's leave_room response.
   * @throws {RelayError} When the leave_room command is rejected.
   */
  async leaveRoom(extra?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this._execute('leave_room', extra);
  }

  // ─── AI Agent ────────────────────────────────────────────────────

  /**
   * Start an AI agent session on the call.
   *
   * @param options - AI configuration — prompts, voices, tools, languages, etc.
   * @returns An {@link AIAction} for control and completion tracking.
   * @throws {RelayError} When the ai command is rejected.
   */
  async ai(options: {
    controlId?: string;
    agent?: string;
    prompt?: Record<string, unknown>;
    postPrompt?: Record<string, unknown>;
    postPromptUrl?: string;
    postPromptAuthUser?: string;
    postPromptAuthPassword?: string;
    globalData?: Record<string, unknown>;
    pronounce?: Record<string, unknown>[];
    hints?: string[];
    languages?: Record<string, unknown>[];
    SWAIG?: Record<string, unknown>;
    aiParams?: Record<string, unknown>;
    onCompleted?: CompletedCallback;
  } = {}): Promise<AIAction> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = { control_id: cid };
    if (options.agent != null) params.agent = options.agent;
    if (options.prompt != null) params.prompt = options.prompt;
    if (options.postPrompt != null) params.post_prompt = options.postPrompt;
    if (options.postPromptUrl != null) params.post_prompt_url = options.postPromptUrl;
    if (options.postPromptAuthUser != null) params.post_prompt_auth_user = options.postPromptAuthUser;
    if (options.postPromptAuthPassword != null) params.post_prompt_auth_password = options.postPromptAuthPassword;
    if (options.globalData != null) params.global_data = options.globalData;
    if (options.pronounce != null) params.pronounce = options.pronounce;
    if (options.hints != null) params.hints = options.hints;
    if (options.languages != null) params.languages = options.languages;
    if (options.SWAIG != null) params.SWAIG = options.SWAIG;
    if (options.aiParams != null) params.params = options.aiParams;
    const action = new AIAction(this, cid);
    return this._startAction(action, 'ai', params, options.onCompleted);
  }

  /**
   * Connect the call to an Amazon Bedrock AI agent.
   *
   * @param options - Bedrock agent configuration.
   * @param options.prompt - Prompt to send to the Bedrock agent.
   * @param options.SWAIG - SWAIG configuration (functions, includes, etc.).
   * @param options.aiParams - AI engine parameters.
   * @param options.globalData - Global-data object available to SWAIG tools.
   * @param options.postPrompt - Post-prompt configuration.
   * @param options.postPromptUrl - URL to POST the final summary to.
   * @returns The platform's amazon_bedrock response.
   * @throws {RelayError} When the amazon_bedrock command is rejected.
   */
  async amazonBedrock(options: {
    prompt?: unknown;
    SWAIG?: Record<string, unknown>;
    aiParams?: Record<string, unknown>;
    globalData?: Record<string, unknown>;
    postPrompt?: Record<string, unknown>;
    postPromptUrl?: string;
  } = {}): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {};
    if (options.prompt != null) params.prompt = options.prompt;
    if (options.SWAIG != null) params.SWAIG = options.SWAIG;
    if (options.aiParams != null) params.params = options.aiParams;
    if (options.globalData != null) params.global_data = options.globalData;
    if (options.postPrompt != null) params.post_prompt = options.postPrompt;
    if (options.postPromptUrl != null) params.post_prompt_url = options.postPromptUrl;
    return this._execute('amazon_bedrock', params);
  }

  /**
   * Send a message into an active AI agent session.
   *
   * @param options - Message parameters.
   * @param options.messageText - Text content to inject into the conversation.
   * @param options.role - Speaker role (`"system"`, `"user"`, or `"assistant"`).
   * @param options.reset - Reset directives for the conversation state.
   * @param options.globalData - Global-data updates to merge.
   * @returns The platform's ai_message response.
   * @throws {RelayError} When the ai_message command is rejected.
   */
  async aiMessage(options: {
    messageText?: string;
    role?: string;
    reset?: Record<string, unknown>;
    globalData?: Record<string, unknown>;
  } = {}): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {};
    if (options.messageText != null) params.message_text = options.messageText;
    if (options.role != null) params.role = options.role;
    if (options.reset != null) params.reset = options.reset;
    if (options.globalData != null) params.global_data = options.globalData;
    return this._execute('ai_message', params);
  }

  /**
   * Put the AI agent session on hold (pause turn-taking).
   *
   * @param options - Hold behaviour.
   * @param options.timeout - Maximum hold duration.
   * @param options.prompt - Prompt played to the caller during the hold.
   * @returns The platform's ai_hold response.
   * @throws {RelayError} When the ai_hold command is rejected.
   */
  async aiHold(options: { timeout?: string; prompt?: string } = {}): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {};
    if (options.timeout != null) params.timeout = options.timeout;
    if (options.prompt != null) params.prompt = options.prompt;
    return this._execute('ai_hold', Object.keys(params).length ? params : undefined);
  }

  /**
   * Resume an AI agent session from hold.
   *
   * @param options - Unhold behaviour.
   * @param options.prompt - Prompt played to the caller on resume.
   * @returns The platform's ai_unhold response.
   * @throws {RelayError} When the ai_unhold command is rejected.
   */
  async aiUnhold(options: { prompt?: string } = {}): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {};
    if (options.prompt != null) params.prompt = options.prompt;
    return this._execute('ai_unhold', Object.keys(params).length ? params : undefined);
  }

  // ─── User Events ─────────────────────────────────────────────────

  /**
   * Emit a custom user-defined event on the call for your webhooks.
   *
   * @param options - Freeform event payload. Set `options.event` for the
   *   event name and include any additional fields your webhook expects.
   * @returns The platform's user_event response.
   * @throws {RelayError} When the user_event command is rejected.
   */
  async userEvent(options: { event?: string } & Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {};
    if (options.event != null) params.event = options.event;
    return this._execute('user_event', params);
  }

  // ─── Queue ───────────────────────────────────────────────────────

  /**
   * Place the call into a named queue.
   *
   * @param queueName - Name of the queue to enter.
   * @param options - Queue-entry behaviour.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.statusUrl - Webhook URL for queue status events.
   * @returns The platform's queue.enter response.
   * @throws {RelayError} When the queue.enter command is rejected.
   */
  async queueEnter(
    queueName: string,
    options: { controlId?: string; statusUrl?: string } = {},
  ): Promise<Record<string, unknown>> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = {
      control_id: cid,
      queue_name: queueName,
    };
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    return this._execute('queue.enter', params);
  }

  /**
   * Remove the call from a queue.
   *
   * @param queueName - Name of the queue to leave.
   * @param options - Queue-exit behaviour.
   * @param options.controlId - Explicit control ID. Auto-generated when omitted.
   * @param options.queueId - Queue ID override (when multiple queues share a name).
   * @param options.statusUrl - Webhook URL for queue status events.
   * @returns The platform's queue.leave response.
   * @throws {RelayError} When the queue.leave command is rejected.
   */
  async queueLeave(
    queueName: string,
    options: { controlId?: string; queueId?: string; statusUrl?: string } = {},
  ): Promise<Record<string, unknown>> {
    const cid = options.controlId ?? randomUUID();
    const params: Record<string, unknown> = {
      control_id: cid,
      queue_name: queueName,
    };
    if (options.queueId != null) params.queue_id = options.queueId;
    if (options.statusUrl != null) params.status_url = options.statusUrl;
    return this._execute('queue.leave', params);
  }

  // ─── Repr ────────────────────────────────────────────────────────

  /**
   * Return a human-readable diagnostic string.
   *
   * @returns `<Call id=... state=... direction=...>` — handy for log output.
   */
  toString(): string {
    return `<Call id=${this.callId} state=${this.state} direction=${this.direction}>`;
  }
}
