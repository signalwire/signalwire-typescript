/**
 * The call's record, kept in `global_data`: the account found, what the caller
 * asked for, the change waiting for their yes, the changes set aside for after
 * it, and the changes settled. `now` puts it in words for the conscience and
 * the steps, and is worked out again on every update, so it is never behind.
 */

import { _Dec as Dec } from './decimal.js';
import type { Change } from './model.js';
import { _decimalOf as decimalOf } from './money.js';
import type { _Wording as Wording } from './wording.js';

/** A record, or one of its entries, as JSON. */
export type RecordData = Record<string, unknown>;

/**
 * The `global_data` key the record lives under (a service's `namespace` when
 * it has one), so other layers' state sits beside it.
 */
export const RECORD = 'ops';

/**
 * The record's `v`. It goes up when a key is renamed or changes meaning, never
 * when one is added, so a reader can tell a record it understands.
 */
export const RECORD_VERSION = 1;

/** The keys of the record. */
export const RECORD_KEYS: readonly string[] = Object.freeze([
  'v',
  'account_id',
  'account',
  'asked',
  'waiting',
  'queued',
  'history',
  'proposals',
  'state',
  'medium',
  'now',
]);

/** A money formatter: an amount as an exact decimal string, and its currency code or null. */
export type MoneyFormat = (amount: string, currency: string | null) => string;

function isPlainObject(value: unknown): value is RecordData {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function listOf(value: unknown): RecordData[] {
  return Array.isArray(value) ? (value as RecordData[]) : [];
}

function objectOf(value: unknown): RecordData {
  return isPlainObject(value) ? value : {};
}

/** @internal The record as a call opens. */
export function _opening(w: Wording): RecordData {
  return _whole(
    w,
    {},
    {
      v: RECORD_VERSION,
      account_id: '',
      account: '',
      asked: '',
      waiting: {},
      queued: [],
      history: [],
      proposals: 0,
      state: {},
      medium: '',
    },
  );
}

/** @internal The `global_data` a call opens with: the record under its key. */
export function _openingData(key: string, w: Wording): RecordData {
  return { [key]: _opening(w) };
}

/** @internal The call's record, as the platform sent it with a request. */
export function _recordOf(rawData: unknown, key: string = RECORD): RecordData {
  const data = isPlainObject(rawData) ? rawData['global_data'] : undefined;
  const record = isPlainObject(data) ? data[key] : undefined;
  return isPlainObject(record) ? (structuredClone(record) as RecordData) : {};
}

/** @internal The whole record after these changes, with `now` worked out after them. */
export function _whole(w: Wording, data: RecordData, changes: RecordData = {}): RecordData {
  const record = { ...data, ...changes };
  return { ...record, now: _nowLine(record, w) };
}

/**
 * @internal The `global_data` update for these changes: the whole record under
 * its key, since the platform replaces a top-level key whole.
 */
export function _update(
  key: string,
  w: Wording,
  data: RecordData,
  changes: RecordData = {},
): RecordData {
  return { [key]: _whole(w, data, changes) };
}

/**
 * @internal Where the call stands, in words: what they asked for, what's done,
 * what waits for their answer, and what's set aside for after it.
 */
export function _nowLine(data: RecordData, w: Wording): string {
  const done = listOf(data['history'])
    .filter((h) => h['done'])
    .map((h) => String(h['done']))
    .join(' ');
  const waiting = objectOf(data['waiting']);
  const queued = listOf(data['queued']);
  const medium = data['medium'];
  const parts = [
    medium === 'voice' || medium === 'chat' ? w.say(`medium.${medium}`) : '',
    data['asked'] ? w.say('now.asked', { asked: data['asked'] }) : '',
    done ? w.say('now.done', { done }) : '',
    waiting['read_back'] ? w.say('now.waiting', { read_back: waiting['read_back'] }) : '',
    queued.length > 0
      ? w.say('now.queued', {
          read_backs: queued
            .map((q) => w.say('now.queued.item', { read_back: q['read_back'] }))
            .join(' '),
        })
      : '',
  ];
  return parts.filter((p) => p).join('\n');
}

/**
 * @internal A change as it waits for the caller's yes: everything needed to
 * carry it out, frozen. Money is kept as exact decimal strings, with its currency.
 */
export function _waitingEntry(
  kind: string,
  args: RecordData,
  change: Change,
  revision: number,
  doneDefault: string,
  currency: string | null,
): RecordData {
  return {
    kind,
    read_back: change.readBack,
    touches: [...change.touches],
    writes: change.writes.map((wr) => wr.toDict()),
    money: change.moneyMoved(),
    currency: change.currency || currency || '',
    done: change.doneLines(doneDefault),
    ...(change.then ? { then: change.then } : {}),
    args: { ...args },
    revision,
  };
}

/** @internal A change set aside for after the one waiting, kept with the arguments to build it again. */
export function _queuedEntry(kind: string, args: RecordData, change: Change): RecordData {
  return {
    kind,
    read_back: change.readBack,
    touches: [...change.touches],
    args: { ...args },
  };
}

function total(amounts: readonly Dec[]): Dec {
  return amounts.reduce((sum, a) => sum.plus(a), Dec.ZERO);
}

/**
 * @internal The change waiting, settled into history: how (`made`, `not made`
 * with the `reason` the backend gave, `declined`, `replaced`), what was done,
 * and the money moved by the writes that went through (all of them once made,
 * else the first `made`).
 */
export function _settle(
  data: RecordData,
  outcome: string,
  done = '',
  made = 0,
  reason = '',
): RecordData {
  const waiting = objectOf(data['waiting']);
  const moved = (Array.isArray(waiting['money']) ? waiting['money'] : []).map(decimalOf);
  const entry: RecordData = {
    kind: waiting['kind'] ?? '',
    touches: [...(Array.isArray(waiting['touches']) ? waiting['touches'] : [])],
    read_back: waiting['read_back'] ?? '',
    outcome,
    ...(reason ? { reason } : {}),
    done,
    money: total(outcome === 'made' ? moved : moved.slice(0, made)).toString(),
    currency: waiting['currency'] || '',
  };
  return { waiting: {}, history: [...listOf(data['history']), entry] };
}

/**
 * @internal What the changes made in the call come to, once more than one
 * moved money: for each currency, what went back to them and what was charged.
 */
export function _inAll(history: readonly RecordData[], w: Wording, money: MoneyFormat): string {
  // Only writes that went through count
  const moved: [Dec, string | null][] = history
    .filter((h) => h['money'] && decimalOf(h['money']).sign() !== 0)
    .map((h) => [decimalOf(h['money']), (h['currency'] as string) || null]);
  if (moved.length < 2) return '';
  const parts: string[] = [];
  for (const code of new Set(moved.map(([, c]) => c))) {
    const mine = moved.filter(([, c]) => c === code).map(([a]) => a);
    const back = total(mine.filter((a) => a.sign() < 0)).negated();
    const charged = total(mine.filter((a) => a.sign() > 0));
    if (back.sign() > 0) parts.push(w.say('money.back', { amount: money(back.toString(), code) }));
    if (charged.sign() > 0) {
      parts.push(w.say('money.charged', { amount: money(charged.toString(), code) }));
    }
  }
  return parts.length > 0 ? w.say('money.in_all', { amounts: w.joined(parts) }) : '';
}

/** @internal What to do once the change waiting is settled: take up the first one set aside. */
export function _nextUp(
  data: RecordData,
  toolOf: Readonly<Record<string, string>>,
  w: Wording,
): string {
  const queued = listOf(data['queued']);
  if (queued.length === 0) return '';
  const first = queued[0]!;
  const kind = String(first['kind']);
  return w.say('then.next_up', {
    tool: Object.hasOwn(toolOf, kind) ? toolOf[kind] : w.say('then.its_tool'),
    read_back: first['read_back'],
  });
}
