/**
 * Action classes — async handles for controllable call operations.
 *
 * Each Action tracks a control_id and resolves when the server sends
 * a terminal event for that control_id.
 */

import { getLogger } from '../Logger.js';
import { createDeferred, type Deferred } from './Deferred.js';
import {
  EVENT_CALL_COLLECT,
  EVENT_CALL_DETECT,
  EVENT_CALL_FAX,
  EVENT_CALL_PAY,
  EVENT_CALL_PLAY,
  EVENT_CALL_RECORD,
  EVENT_CALL_STREAM,
  EVENT_CALL_TAP,
  EVENT_CALL_TRANSCRIBE,
  PLAY_STATE_ERROR,
  PLAY_STATE_FINISHED,
  RECORD_STATE_FINISHED,
  RECORD_STATE_NO_INPUT,
} from './constants.js';
import { RelayEvent } from './RelayEvent.js';
import type { CompletedCallback } from './types.js';

const logger = getLogger('relay_action');

/**
 * Structural subset of {@link Call} that an Action needs — avoids a circular
 * import between `Call.ts` and `Action.ts`.
 */
export interface CallLike {
  _execute(method: string, extraParams?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

// ─── Base Action ─────────────────────────────────────────────────────

/**
 * Async handle for a controllable call operation (play, record, tap, detect, etc.).
 *
 * An Action is returned from the async variants on {@link Call} (e.g. `call.playAsync`).
 * It resolves when the server emits a terminal event for its `controlId`. Use
 * {@link Action.wait} to await completion, or register an `onCompleted` callback.
 *
 * @example
 * ```ts
 * const play = await call.playAsync({ play: [{ type: 'tts', text: 'Hello!' }] });
 * // do other work while the greeting plays...
 * const event = await play.wait(10); // seconds
 * console.log('Playback finished with state', event.params.state);
 * ```
 */
export class Action {
  /** Reference to the owning call. */
  readonly call: CallLike;
  /** Unique control ID used by the server to route events back to this action. */
  readonly controlId: string;
  protected readonly _terminalEvent: string;
  protected readonly _terminalStates: readonly string[];
  /** @internal */ readonly _done: Deferred<RelayEvent>;
  /** Final event once the action terminates, or `null` while still running. */
  result: RelayEvent | null = null;
  /** Whether the action has reached a terminal state. */
  completed = false;
  /** @internal */ _onCompleted: CompletedCallback | null = null;

  /**
   * @param call - Owning call (via the structural {@link CallLike} interface).
   * @param controlId - Unique control ID the server will echo on events.
   * @param terminalEvent - Event type that carries terminal state transitions.
   * @param terminalStates - State values that mark this action as completed.
   */
  constructor(
    call: CallLike,
    controlId: string,
    terminalEvent: string,
    terminalStates: readonly string[],
  ) {
    this.call = call;
    this.controlId = controlId;
    this._terminalEvent = terminalEvent;
    this._terminalStates = terminalStates;
    this._done = createDeferred<RelayEvent>();
  }

  /** @internal Called by Call when an event matches our control_id. */
  _checkEvent(event: RelayEvent): void {
    const state = (event.params.state ?? '') as string;
    if (this._terminalStates.includes(state) && !this._done.settled) {
      this._resolve(event);
    }
  }

  /** @internal Mark the action as completed and fire the on_completed callback. */
  _resolve(event: RelayEvent): void {
    this.result = event;
    this.completed = true;
    if (!this._done.settled) {
      this._done.resolve(event);
    }
    if (this._onCompleted != null) {
      try {
        const result = this._onCompleted(event);
        if (result instanceof Promise) {
          result.catch((err) => {
            logger.error(`Error in on_completed callback for ${this.controlId}: ${err}`);
          });
        }
      } catch (err) {
        logger.error(`Error in on_completed callback for ${this.controlId}: ${err}`);
      }
    }
  }

  /**
   * Wait for the action to complete.
   *
   * @param timeout - Maximum time to wait in **seconds** (matches the Python
   *   SDK convention — not milliseconds).
   * @returns The terminal {@link RelayEvent} for this action.
   * @throws {Error} When the optional timeout elapses before the action ends.
   */
  async wait(timeout?: number): Promise<RelayEvent> {
    if (timeout != null) {
      const ms = timeout * 1000;
      return new Promise<RelayEvent>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Action wait timed out after ${timeout}s`));
        }, ms);
        this._done.promise.then(
          (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          (e) => {
            clearTimeout(timer);
            reject(e);
          },
        );
      });
    }
    return this._done.promise;
  }

  /** True once the action has reached a terminal state. */
  get isDone(): boolean {
    return this._done.settled;
  }
}

// ─── PlayAction ──────────────────────────────────────────────────────

/** Async handle for a `calling.call.play` action — controls playback in progress. */
export class PlayAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, EVENT_CALL_PLAY, [PLAY_STATE_FINISHED, PLAY_STATE_ERROR]);
  }

  /**
   * Stop the playback.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('play.stop', { control_id: this.controlId });
  }

  /**
   * Pause active playback (resumable with {@link resume}).
   *
   * @returns The platform's pause response.
   * @throws {RelayError} When the pause command is rejected.
   */
  async pause(): Promise<Record<string, unknown>> {
    return this.call._execute('play.pause', { control_id: this.controlId });
  }

  /**
   * Resume playback paused by {@link pause}.
   *
   * @returns The platform's resume response.
   * @throws {RelayError} When the resume command is rejected.
   */
  async resume(): Promise<Record<string, unknown>> {
    return this.call._execute('play.resume', { control_id: this.controlId });
  }

  /**
   * Adjust playback volume.
   *
   * @param volume - Volume adjustment in dB.
   * @returns The platform's volume response.
   * @throws {RelayError} When the volume command is rejected.
   */
  async volume(volume: number): Promise<Record<string, unknown>> {
    return this.call._execute('play.volume', { control_id: this.controlId, volume });
  }
}

// ─── RecordAction ────────────────────────────────────────────────────

/** Async handle for a `calling.call.record` action — controls recording in progress. */
export class RecordAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, EVENT_CALL_RECORD, [RECORD_STATE_FINISHED, RECORD_STATE_NO_INPUT]);
  }

  /**
   * Stop the recording and finalise the file.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('record.stop', { control_id: this.controlId });
  }

  /**
   * Pause the recording (resumable with {@link resume}).
   *
   * @param behavior - Optional behaviour hint (e.g. `"silence"`) controlling
   *   what is recorded in place of paused audio.
   * @returns The platform's pause response.
   * @throws {RelayError} When the pause command is rejected.
   */
  async pause(behavior?: string): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = { control_id: this.controlId };
    if (behavior) params.behavior = behavior;
    return this.call._execute('record.pause', params);
  }

  /**
   * Resume recording paused by {@link pause}.
   *
   * @returns The platform's resume response.
   * @throws {RelayError} When the resume command is rejected.
   */
  async resume(): Promise<Record<string, unknown>> {
    return this.call._execute('record.resume', { control_id: this.controlId });
  }
}

// ─── DetectAction ────────────────────────────────────────────────────

/** Async handle for a `calling.call.detect` action (machine / fax / digit). */
export class DetectAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, EVENT_CALL_DETECT, ['finished', 'error']);
  }

  /** Resolve on first meaningful result OR terminal state. */
  override _checkEvent(event: RelayEvent): void {
    const detect = event.params.detect;
    const state = (event.params.state ?? '') as string;
    if ((detect || this._terminalStates.includes(state)) && !this._done.settled) {
      this._resolve(event);
    }
  }

  /**
   * Stop detection before the timeout elapses.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('detect.stop', { control_id: this.controlId });
  }
}

// ─── CollectAction ───────────────────────────────────────────────────

/** Async handle for a `play_and_collect` action (combined playback + input collection). */
export class CollectAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, EVENT_CALL_COLLECT, ['finished', 'error', 'no_input', 'no_match']);
  }

  /**
   * play_and_collect shares a control_id across play and collect phases.
   * Only resolve on collect events, not play events.
   */
  override _checkEvent(event: RelayEvent): void {
    if (event.eventType !== EVENT_CALL_COLLECT) return;
    const result = event.params.result;
    if (result && !this._done.settled) {
      this._resolve(event);
    } else {
      super._checkEvent(event);
    }
  }

  /**
   * Stop the play_and_collect operation.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('play_and_collect.stop', { control_id: this.controlId });
  }

  /**
   * Adjust playback volume of the prompt audio mid-collect.
   *
   * @param volume - Volume adjustment in dB.
   * @returns The platform's volume response.
   * @throws {RelayError} When the volume command is rejected.
   */
  async volume(volume: number): Promise<Record<string, unknown>> {
    return this.call._execute('play_and_collect.volume', { control_id: this.controlId, volume });
  }

  /**
   * Start the collect input timers (useful when `initial_timeout` should be
   * reset after an async side effect completes).
   *
   * @returns The platform's start_input_timers response.
   * @throws {RelayError} When the command is rejected.
   */
  async startInputTimers(): Promise<Record<string, unknown>> {
    return this.call._execute('collect.start_input_timers', { control_id: this.controlId });
  }
}

// ─── StandaloneCollectAction ─────────────────────────────────────────

/** Async handle for a bare `calling.call.collect` action (no accompanying play). */
export class StandaloneCollectAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, EVENT_CALL_COLLECT, ['finished', 'error', 'no_input', 'no_match']);
  }

  override _checkEvent(event: RelayEvent): void {
    if (event.eventType !== EVENT_CALL_COLLECT) return;
    const result = event.params.result;
    const state = (event.params.state ?? '') as string;
    if ((result || this._terminalStates.includes(state)) && !this._done.settled) {
      this._resolve(event);
    }
  }

  /**
   * Stop the collect operation before input is received.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('collect.stop', { control_id: this.controlId });
  }

  /**
   * Start the collect input timers.
   *
   * @returns The platform's start_input_timers response.
   * @throws {RelayError} When the command is rejected.
   */
  async startInputTimers(): Promise<Record<string, unknown>> {
    return this.call._execute('collect.start_input_timers', { control_id: this.controlId });
  }
}

// ─── FaxAction ───────────────────────────────────────────────────────

/** Async handle for a `send_fax` or `receive_fax` action. */
export class FaxAction extends Action {
  private _methodPrefix: string;

  constructor(call: CallLike, controlId: string, methodPrefix: string) {
    super(call, controlId, EVENT_CALL_FAX, ['finished', 'error']);
    this._methodPrefix = methodPrefix;
  }

  /**
   * Stop the fax transfer mid-stream.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute(`${this._methodPrefix}.stop`, { control_id: this.controlId });
  }
}

// ─── TapAction ───────────────────────────────────────────────────────

/** Async handle for a `calling.call.tap` action (media mirroring). */
export class TapAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, EVENT_CALL_TAP, ['finished']);
  }

  /**
   * Stop the media tap.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('tap.stop', { control_id: this.controlId });
  }
}

// ─── StreamAction ────────────────────────────────────────────────────

/** Async handle for a `calling.call.stream` action (outbound media stream). */
export class StreamAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, EVENT_CALL_STREAM, ['finished']);
  }

  /**
   * Stop the outbound stream.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('stream.stop', { control_id: this.controlId });
  }
}

// ─── PayAction ───────────────────────────────────────────────────────

/** Async handle for a `calling.call.pay` action (PCI-compliant payment collection). */
export class PayAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, EVENT_CALL_PAY, ['finished', 'error']);
  }

  /**
   * Cancel the payment collection before it completes.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('pay.stop', { control_id: this.controlId });
  }
}

// ─── TranscribeAction ────────────────────────────────────────────────

/** Async handle for a `calling.call.transcribe` action (real-time transcription). */
export class TranscribeAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, EVENT_CALL_TRANSCRIBE, ['finished']);
  }

  /**
   * Stop the transcription.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('transcribe.stop', { control_id: this.controlId });
  }
}

// ─── AIAction ────────────────────────────────────────────────────────

/** Async handle for a `calling.call.ai` action (on-call AI agent session). */
export class AIAction extends Action {
  constructor(call: CallLike, controlId: string) {
    super(call, controlId, 'calling.call.ai', ['finished', 'error']);
  }

  /**
   * Stop the AI agent session.
   *
   * @returns The platform's stop response.
   * @throws {RelayError} When the stop command is rejected.
   */
  async stop(): Promise<Record<string, unknown>> {
    return this.call._execute('ai.stop', { control_id: this.controlId });
  }
}
