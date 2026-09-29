/**
 * CallSessionStore - bounded per-call state for the prefab agents.
 *
 * SurveyAgent and ReceptionistAgent keep state for each call in process,
 * keyed by `call_id`. Without a bound, every call ever handled would stay in
 * memory. This store drops a call's entry when the prefab deletes it (on the
 * call's summary), when the call has been idle longer than `maxIdleMs`, and,
 * oldest first, when it holds more than `maxEntries` calls.
 *
 * Internal to the prefabs; not part of the package's exported API.
 */

/** Limits for a {@link CallSessionStore}. */
export interface CallSessionStoreOptions {
  /** Drop a call idle (not read or written) for longer than this. Default: 1 hour. */
  maxIdleMs?: number;
  /** Keep at most this many calls, dropping the least recently used. Default: 10000. */
  maxEntries?: number;
}

/** Per-call state with an idle-age limit and an entry limit. */
export class CallSessionStore<T> {
  /** Default idle-age limit: 1 hour. */
  static readonly DEFAULT_MAX_IDLE_MS = 60 * 60 * 1000;
  /** Default entry limit. */
  static readonly DEFAULT_MAX_ENTRIES = 10_000;

  private readonly maxIdleMs: number;
  private readonly maxEntries: number;
  /** Entries in least-recently-used order: a touched entry moves to the end. */
  private readonly entries = new Map<string, { value: T; lastUsed: number }>();

  /**
   * Create a store.
   * @param options - Idle-age and entry limits.
   */
  constructor(options: CallSessionStoreOptions = {}) {
    this.maxIdleMs = options.maxIdleMs ?? CallSessionStore.DEFAULT_MAX_IDLE_MS;
    this.maxEntries = Math.max(1, options.maxEntries ?? CallSessionStore.DEFAULT_MAX_ENTRIES);
  }

  /** The number of calls held. */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Return a call's state, creating it with `create` when absent (or expired).
   * Marks the call as used now, and drops expired and excess calls.
   * @param callId - The call's id.
   * @param create - Builds the initial state for a new call.
   * @returns The call's state.
   */
  getOrCreate(callId: string, create: () => T): T {
    const now = Date.now();
    this.prune(now);
    const existing = this.entries.get(callId);
    const value = existing ? existing.value : create();
    // Delete then set so the entry moves to the most recently used end.
    this.entries.delete(callId);
    this.entries.set(callId, { value, lastUsed: now });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
    return value;
  }

  /**
   * Drop a call's state.
   * @param callId - The call's id.
   * @returns True when the call had state.
   */
  delete(callId: string): boolean {
    return this.entries.delete(callId);
  }

  /** Drop every call idle longer than the limit (the oldest are first in the map). */
  private prune(now: number): void {
    for (const [callId, entry] of this.entries) {
      if (now - entry.lastUsed <= this.maxIdleMs) break;
      this.entries.delete(callId);
    }
  }
}
