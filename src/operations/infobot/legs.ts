/**
 * A conversation's legs, kept across a switch between voice and chat.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** One leg of a conversation: its id, its medium and its turns. */
export type Leg = Record<string, unknown>;

/** Options for a {@link LegStore}. */
export interface LegStoreOptions {
  /** The directory the default store keeps its files in; defaults to `infobot_conversations` under the temp dir. */
  cacheDir?: string | null;
}

/** A store's own persistence: `load(id)` gives the legs, `append(id, leg)` stores one. Either may be async. */
export interface LegPersistence {
  /** Every leg recorded for the conversation, oldest first. */
  load: (conversationId: string) => Leg[] | Promise<Leg[]>;
  /** Append a leg; returns whether it was stored. */
  append: (conversationId: string, leg: Leg) => boolean | Promise<boolean>;
}

/**
 * Persistence for a conversation's legs across a medium switch.
 *
 * A conversation that moves between mediums (voice, chat) ends one leg and
 * opens another; because an ended conversation cannot be reopened, the next
 * leg gets a fresh id while the store keys every leg off the ROOT id, so the
 * history travels across the switch. The default persistence is one JSON file
 * per conversation under a temp dir, on this host: for development.
 * `setStore` replaces it (a database, for more than one process or host).
 */
export class LegStore {
  /** What separates a root id from a leg's number. */
  static readonly SEP = '.';
  private readonly cacheDir: string;
  private persistence: LegPersistence | null = null;

  /** @param opts - `cacheDir`. */
  constructor(opts: LegStoreOptions = {}) {
    this.cacheDir = opts.cacheDir || join(tmpdir(), 'infobot_conversations');
  }

  /**
   * Replace persistence: `load(id)` gives the legs; `append(id, leg)` stores one.
   * @param persistence - `load` and `append`.
   * @returns This store.
   */
  setStore(persistence: LegPersistence): this {
    // Kept whole, so a persistence object's methods are called on it
    this.persistence = persistence;
    return this;
  }

  /**
   * Every leg recorded for the conversation, oldest first.
   * @param conversationId - The conversation's (root) id.
   * @returns The legs.
   */
  async legs(conversationId: string): Promise<Leg[]> {
    return this.persistence
      ? await this.persistence.load(conversationId)
      : this.defaultLoad(conversationId);
  }

  /**
   * Append a leg.
   * @param conversationId - The conversation's (root) id.
   * @param leg - The leg.
   * @returns Whether it was stored.
   */
  async record(conversationId: string, leg: Leg): Promise<boolean> {
    return this.persistence
      ? await this.persistence.append(conversationId, leg)
      : this.defaultAppend(conversationId, leg);
  }

  /**
   * The conversation's root id, any per-leg suffix removed.
   * @param conversationId - The id.
   * @returns The root id.
   */
  static rootId(conversationId: string): string {
    return (conversationId || '').split(LegStore.SEP)[0]!;
  }

  /**
   * A fresh id for the next leg of the same conversation.
   * @param conversationId - The id.
   * @param legCount - How many legs there are.
   * @returns The next leg's id.
   */
  static nextLegId(conversationId: string, legCount: number): string {
    return `${LegStore.rootId(conversationId)}${LegStore.SEP}${legCount + 1}`;
  }

  private path(conversationId: string): string {
    const safe = (conversationId || 'unknown').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);
    return join(this.cacheDir, `conversation_${safe}.json`);
  }

  private defaultLoad(conversationId: string): Leg[] {
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(this.path(conversationId), 'utf8'));
    } catch {
      return [];
    }
    const legs =
      typeof data === 'object' && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)['legs']
        : [];
    return Array.isArray(legs) ? [...(legs as Leg[])] : [];
  }

  private defaultAppend(conversationId: string, leg: Leg): boolean {
    // Synchronous, so one process's read-modify-write can't interleave
    try {
      mkdirSync(this.cacheDir, { recursive: true });
      const legs = this.defaultLoad(conversationId);
      legs.push(leg);
      writeFileSync(this.path(conversationId), JSON.stringify({ legs }, null, 1));
    } catch {
      return false;
    }
    return true;
  }
}
