/**
 * Message object — represents an SMS/MMS message in the RELAY messaging namespace.
 *
 * A Message tracks the lifecycle of a sent or received message via state events.
 * Outbound messages progress through: queued -> initiated -> sent -> delivered
 * (or undelivered/failed). Inbound messages arrive fully formed with state "received".
 */

import { getLogger } from '../Logger.js';
import { createDeferred, type Deferred } from './Deferred.js';
import { MESSAGE_TERMINAL_STATES } from './constants.js';
import { RelayEvent } from './RelayEvent.js';
import type { CompletedCallback, EventHandler } from './types.js';

const logger = getLogger('relay_message');

export class Message {
  messageId: string;
  context: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  media: string[];
  segments: number;
  state: string;
  reason: string;
  tags: string[];

  private _done: Deferred<RelayEvent>;
  /** @internal */ _onCompleted: CompletedCallback | null = null;
  private _listeners: EventHandler[] = [];

  constructor(options: {
    messageId?: string;
    context?: string;
    direction?: string;
    fromNumber?: string;
    toNumber?: string;
    body?: string;
    media?: string[];
    segments?: number;
    state?: string;
    reason?: string;
    tags?: string[];
  } = {}) {
    this.messageId = options.messageId ?? '';
    this.context = options.context ?? '';
    this.direction = options.direction ?? '';
    this.fromNumber = options.fromNumber ?? '';
    this.toNumber = options.toNumber ?? '';
    this.body = options.body ?? '';
    this.media = options.media ?? [];
    this.segments = options.segments ?? 0;
    this.state = options.state ?? '';
    this.reason = options.reason ?? '';
    this.tags = options.tags ?? [];
    this._done = createDeferred<RelayEvent>();
  }

  get isDone(): boolean {
    return this._done.settled;
  }

  get result(): RelayEvent | null {
    // We can't synchronously get the result from a promise, so we track it
    return this._result ?? null;
  }

  private _result: RelayEvent | undefined;

  /** Register an event listener for state changes on this message. */
  on(handler: EventHandler): void {
    this._listeners.push(handler);
  }

  /**
   * Wait for the message to reach a terminal state.
   * @param timeout - Maximum time to wait in seconds (matches Python SDK convention).
   */
  async wait(timeout?: number): Promise<RelayEvent> {
    if (timeout != null) {
      const ms = timeout * 1000;
      return new Promise<RelayEvent>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Message wait timed out after ${timeout}s`));
        }, ms);

        this._done.promise.then(
          (v) => { clearTimeout(timer); resolve(v); },
          (e) => { clearTimeout(timer); reject(e); },
        );
      });
    }
    return this._done.promise;
  }

  /** @internal Handle a messaging.state event for this message. */
  async _dispatchEvent(payload: Record<string, unknown>): Promise<void> {
    const eventParams = (payload.params ?? {}) as Record<string, unknown>;
    const newState = (eventParams.message_state ?? '') as string;

    if (newState) {
      this.state = newState;
    }
    if (eventParams.reason !== undefined) {
      this.reason = eventParams.reason as string;
    }

    const event = RelayEvent.fromPayload(payload as Record<string, unknown>);

    // Notify listeners
    for (const handler of this._listeners) {
      try {
        await handler(event);
      } catch (err) {
        logger.error(`Error in message event handler for ${this.messageId}: ${err}`);
      }
    }

    // Check terminal state
    if ((MESSAGE_TERMINAL_STATES as readonly string[]).includes(newState)) {
      this._resolve(event);
    }
  }

  private _resolve(event: RelayEvent): void {
    if (this._done.settled) return;
    this._result = event;
    this._done.resolve(event);
    if (this._onCompleted != null) {
      try {
        const result = this._onCompleted(event);
        if (result instanceof Promise) {
          result.catch((err) => {
            logger.error(`Error in on_completed callback for message ${this.messageId}: ${err}`);
          });
        }
      } catch (err) {
        logger.error(`Error in on_completed callback for message ${this.messageId}: ${err}`);
      }
    }
  }

  toString(): string {
    return `Message(id=${this.messageId}, direction=${this.direction}, state=${this.state}, from=${this.fromNumber}, to=${this.toNumber})`;
  }
}
