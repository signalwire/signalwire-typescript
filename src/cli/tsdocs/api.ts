/**
 * `sw-tsdocs api`: signatures, JSDoc, source locations and members.
 *
 * The answers come from `api-index.json`, which `npm run build` writes beside
 * this module from the package's own `.d.ts` files
 * (scripts/generate-tsdocs-api.ts). An installed package has no TypeScript
 * source and no compiler, so reading the declarations ahead of time is what
 * lets this work anywhere the package is installed, without importing the
 * SDK.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiEntry, ApiIndex, ApiMember } from './apiTypes.js';

/** The index's file name, beside this module in `dist/cli/tsdocs/`. */
export const API_INDEX_FILE = 'api-index.json';

/** Classes whose members a bare name, such as `hangup`, is looked up in. */
const MAIN_CLASSES = [
  'AgentBase',
  'SWMLService',
  'FunctionResult',
  'DataMap',
  'ContextBuilder',
  'Context',
  'Step',
  'AgentServer',
  'SkillBase',
  'RelayClient',
  'Call',
  'Message',
  'RestClient',
  'AIChatClient',
  'ChatGateway',
  'HandoffRouter',
  'BedrockAgent',
];

let override: ApiIndex | null = null;
const loaded = new Map<string, ApiIndex | null>();

/**
 * Use `index` instead of the built one; the tests build it from the source.
 *
 * @param index - The index to use, or null to go back to the built one.
 */
export function useApiIndex(index: ApiIndex | null): void {
  override = index;
}

/**
 * The API index for the package at `root`: beside this module when it runs
 * from `dist`, or in `dist/` when it runs from a clone's `src`.
 *
 * @param root - The package root.
 * @returns The index, or null if it hasn't been built.
 */
export function loadApiIndex(root: string): ApiIndex | null {
  if (override) return override;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, API_INDEX_FILE),
    join(root, 'dist', 'cli', 'tsdocs', API_INDEX_FILE),
  ];
  const path = candidates.find((p) => existsSync(p));
  if (!path) return null;
  if (!loaded.has(path)) {
    try {
      loaded.set(path, JSON.parse(readFileSync(path, 'utf-8')) as ApiIndex);
    } catch {
      loaded.set(path, null);
    }
  }
  return loaded.get(path) ?? null;
}

/** A resolved name: an entry, or one of its members. */
export interface Found {
  /** The name as the reader should write it, such as `FunctionResult.connect`. */
  name: string;
  /** The entry, or for a member the entry it was looked up on. */
  entry: ApiEntry;
  /** The member, when the name is one. */
  member?: ApiMember;
}

/** The entry and its bases, nearest first. */
function lineage(index: ApiIndex, entry: ApiEntry): ApiEntry[] {
  const chain: ApiEntry[] = [];
  const queue = [entry];
  while (queue.length) {
    const next = queue.shift()!;
    if (chain.includes(next)) continue;
    chain.push(next);
    for (const base of next.bases ?? []) {
      const found = index.entries[base];
      if (found) queue.push(found);
    }
  }
  return chain;
}

/**
 * A class's or interface's members with the ones it inherits, grouped by the
 * entry that declares them. An overriding member hides the base's.
 *
 * @param index - The API index.
 * @param entry - A class or interface.
 * @returns [owner, members] pairs, the entry's own first.
 */
function membersByOwner(index: ApiIndex, entry: ApiEntry): [string, ApiMember[]][] {
  const seen = new Set<string>();
  const groups: [string, ApiMember[]][] = [];
  for (const klass of lineage(index, entry)) {
    const own = (klass.members ?? []).filter((m) => {
      const id = `${m.static ? 'static ' : ''}${m.name}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (own.length) groups.push([klass.name, own]);
  }
  return groups;
}

function findMember(index: ApiIndex, entry: ApiEntry, name: string): ApiMember | undefined {
  for (const klass of lineage(index, entry)) {
    const member = klass.members?.find((m) => m.name === name);
    if (member) return member;
  }
  return undefined;
}

/**
 * Everything `name` could refer to, most specific first.
 *
 * Accepts an exported name (`AgentBase`), a member (`FunctionResult.connect`),
 * a namespace member (`livewire.Agent`), an optional `@signalwire/sdk.`
 * prefix, and a bare member name (`hangup`), which is looked up in the main
 * classes.
 *
 * @param index - The API index.
 * @param name - What the reader typed.
 * @returns The matches.
 */
export function resolveName(index: ApiIndex, name: string): Found[] {
  const wanted = name
    .trim()
    .replace(/^@signalwire\/sdk\/livewire[./]/, 'livewire.')
    .replace(/^@signalwire\/sdk[./]?/, '')
    .replace(/#/g, '.');
  if (!wanted) return [];
  const exact = index.entries[wanted];
  if (exact) return [{ name: wanted, entry: exact }];
  const parts = wanted.split('.');
  // The longest leading part that names an entry, then members
  for (let split = parts.length - 1; split > 0; split--) {
    const entry = index.entries[parts.slice(0, split).join('.')];
    if (!entry) continue;
    if (split !== parts.length - 1) return [];
    const member = findMember(index, entry, parts[split]!);
    return member ? [{ name: wanted, entry, member }] : [];
  }
  if (parts.length > 1) return [];
  const results: Found[] = [];
  for (const key of index.exports) {
    if (key.endsWith(`.${wanted}`)) results.push({ name: key, entry: index.entries[key]! });
  }
  const owners = new Set<string>();
  for (const className of MAIN_CLASSES) {
    const entry = index.entries[className];
    const member = entry && findMember(index, entry, wanted);
    if (!entry || !member) continue;
    const id = `${member.owner}.${member.name}`;
    if (owners.has(id)) continue;
    owners.add(id);
    results.push({ name: `${className}.${wanted}`, entry, member });
  }
  return results;
}

/** Lowercase, without `_` or `-`, so `prompt_add_section` finds `promptAddSection`. */
const fold = (s: string): string => s.toLowerCase().replace(/[_-]/g, '');

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

/**
 * Up to `n` words from `pool` that look like `word`, best first.
 *
 * @param word - What the reader typed.
 * @param pool - The known words.
 * @param n - The most to return.
 * @param cutoff - The least similarity, from 0 to 1.
 * @returns The close matches.
 */
export function closeMatches(word: string, pool: Iterable<string>, n = 3, cutoff = 0.6): string[] {
  const target = fold(word);
  const scored: [number, string][] = [];
  for (const candidate of new Set(pool)) {
    const folded = fold(candidate);
    const longest = Math.max(folded.length, target.length) || 1;
    const score = 1 - distance(folded, target) / longest;
    if (score >= cutoff) scored.push([score, candidate]);
  }
  return scored
    .sort((a, b) => b[0] - a[0] || a[1].localeCompare(b[1]))
    .slice(0, n)
    .map(([, candidate]) => candidate);
}

/**
 * Known names that look like `name`.
 *
 * @param index - The API index.
 * @param name - What the reader typed.
 * @returns Up to eight suggestions.
 */
export function suggestions(index: ApiIndex, name: string): string[] {
  const pool = new Set<string>(index.exports);
  for (const className of MAIN_CLASSES) {
    const entry = index.entries[className];
    if (!entry) continue;
    for (const [, members] of membersByOwner(index, entry)) {
      for (const member of members) pool.add(member.name);
    }
  }
  const last = name.split('.').pop() ?? name;
  return closeMatches(last, pool, 8, 0.6);
}

/**
 * The first sentence of a JSDoc, without its tags.
 *
 * @param doc - The JSDoc text.
 * @returns The sentence, or an empty string.
 */
export function summary(doc: string): string {
  const paragraph: string[] = [];
  for (const line of doc.split('\n')) {
    const text = line.trim();
    if (text.startsWith('@') || text.startsWith('```') || (!text && paragraph.length)) break;
    if (text) paragraph.push(text);
  }
  const joined = paragraph.join(' ');
  // The first sentence: a period and a space, outside `code` and not "e.g."
  let first = joined;
  for (const match of joined.matchAll(/\.(?=\s|$)/g)) {
    const before = joined.slice(0, match.index);
    if (/\b(e\.g|i\.e|etc|vs)$/i.test(before)) continue;
    if ((before.match(/`/g) ?? []).length % 2) continue;
    first = joined.slice(0, match.index + 1);
    break;
  }
  return first.length > 240 ? `${first.slice(0, 239)}…` : first;
}

/** One line for a member list: long inline types are cut. */
function oneLine(signature: string, max = 160): string {
  const flat = signature.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** A JSDoc with a blank line before its tags, so they don't run into the text. */
function formatDoc(doc: string): string {
  const lines = doc.split('\n');
  const first = lines.findIndex((line) => line.startsWith('@'));
  if (first > 0 && lines[first - 1]!.trim()) lines.splice(first, 0, '');
  return lines.join('\n');
}

function where(root: string, file: string, line: number): string {
  return `${join(root, file)}:${line}`;
}

function memberLabel(member: ApiMember): string {
  const flags = [
    member.static ? 'static' : '',
    member.protected ? 'protected' : '',
    member.kind === 'property' || member.kind === 'accessor' ? member.kind : '',
  ].filter(Boolean);
  return flags.length ? ` (${flags.join(', ')})` : '';
}

/**
 * Markdown for one resolved name.
 *
 * @param index - The API index.
 * @param found - The name, from {@link resolveName}.
 * @param root - The package root, for full source paths.
 * @returns The page.
 */
export function renderFound(index: ApiIndex, found: Found, root: string): string {
  const out: string[] = [];
  if (found.member) {
    const member = found.member;
    out.push(`# ${member.kind} ${found.name}`, '');
    out.push(`Source: ${where(root, member.file, member.line)}`, '');
    if (member.owner !== found.entry.name) out.push(`Defined by \`${member.owner}\`.`, '');
    out.push('```ts', ...member.signature, '```', '');
    if (member.doc) out.push(formatDoc(member.doc), '');
    return `${out.join('\n').trimEnd()}\n`;
  }
  const entry = found.entry;
  out.push(`# ${entry.kind} ${found.name}`, '');
  out.push(`Source: ${where(root, entry.file, entry.line)}`, '');
  if (!entry.exported)
    out.push('Not exported itself: its members are inherited by classes that are.', '');
  const signature = [...entry.signature];
  if (entry.kind === 'class') {
    const ctor = entry.members?.find((m) => m.kind === 'constructor');
    if (ctor) signature.push(...ctor.signature);
  }
  if (entry.kind !== 'namespace') out.push('```ts', ...signature, '```', '');
  if (entry.doc) out.push(formatDoc(entry.doc), '');
  if (entry.kind === 'class' || entry.kind === 'interface') {
    const groups = membersByOwner(index, entry).map(
      ([owner, members]) =>
        [owner, members.filter((m) => m.kind !== 'constructor')] as [string, ApiMember[]],
    );
    const count = groups.reduce((n, [, members]) => n + members.length, 0);
    if (count) {
      out.push(
        `## Members (${count})`,
        '',
        `Grouped by the ${entry.kind} that declares them. \`sw-tsdocs api ${found.name}.<name>\` shows one.`,
        '',
      );
      for (const [owner, members] of groups) {
        if (!members.length) continue;
        out.push(`### ${owner}`, '');
        for (const member of members) {
          const text = summary(member.doc);
          const line = `- \`${oneLine(member.signature[0] ?? member.name)}\`${memberLabel(member)}`;
          out.push(text ? `${line}: ${text}` : line);
        }
        out.push('');
      }
    }
  } else if (entry.kind === 'namespace') {
    out.push('## Contents', '');
    for (const key of entry.contents ?? []) {
      const item = index.entries[key];
      if (!item) continue;
      const text = summary(item.doc);
      const line = `- \`${key}\` (${item.kind})`;
      out.push(text ? `${line}: ${text}` : line);
    }
    out.push('');
  }
  return `${out.join('\n').trimEnd()}\n`;
}

/**
 * The first line of a name's JSDoc, for the topics' API lists.
 *
 * @param index - The API index.
 * @param name - A name {@link resolveName} accepts.
 * @returns The summary, or an empty string.
 */
export function summaryOf(index: ApiIndex, name: string): string {
  const found = resolveName(index, name)[0];
  if (!found) return '';
  return summary(found.member ? found.member.doc : found.entry.doc);
}
