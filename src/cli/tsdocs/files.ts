/**
 * The documentation files the package ships, and finding, showing and
 * searching them.
 *
 * `isDocFile()` says which files are documentation. package.json's `files`
 * allowlist ships exactly those (tests/cli/tsdocs-pack.test.ts checks the
 * two agree against `npm pack`), so the same rule describes a clone of the
 * repository and an installed package.
 */

import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve as resolvePath } from 'node:path';

/** Repository files and directories that ship as documentation. */
export const DOC_SOURCES = [
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'docs',
  'examples',
  'relay',
  'rest',
  'livewire',
  'tutorial',
] as const;

/** Bundles with their own README, docs and examples. */
const BUNDLES = new Set(['relay', 'rest', 'livewire']);

/** Directories never walked: dependencies, caches and hidden directories. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage']);

/**
 * True if `rel`, a POSIX path relative to the package root, is documentation
 * that ships with the package.
 *
 * Docs are Markdown and examples are TypeScript, so a stray file (a `.env`,
 * a log, an editor backup) never counts. The examples' audit harnesses and
 * the RELAY implementation notes are for the SDK's own maintainers.
 *
 * @param rel - The path, relative to the package root, with `/` separators.
 * @returns Whether it ships.
 */
export function isDocFile(rel: string): boolean {
  const parts = rel.split('/');
  if (parts.some((part) => !part || part.startsWith('.') || SKIP_DIRS.has(part))) return false;
  const top = parts[0]!;
  const name = parts[parts.length - 1]!;
  const isMarkdown = name.endsWith('.md');
  const isExample = name.endsWith('.ts') && !name.endsWith('.d.ts');
  if (parts.length === 1) return rel === 'README.md' || rel === 'CHANGELOG.md' || rel === 'LICENSE';
  if (top === 'docs') return isMarkdown;
  if (top === 'tutorial') return isMarkdown || isExample;
  if (top === 'examples') {
    return isMarkdown || (isExample && !name.endsWith('_audit_harness.ts'));
  }
  if (BUNDLES.has(top)) {
    if (parts.length === 2) return name === 'README.md';
    if (parts[1] === 'docs') return isMarkdown;
    if (parts[1] === 'examples') return isExample;
  }
  return false;
}

function walk(dir: string, prefix: string, out: string[]): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names.sort()) {
    const rel = prefix ? `${prefix}/${name}` : name;
    const path = join(dir, name);
    let isDir: boolean;
    try {
      isDir = statSync(path).isDirectory();
    } catch {
      continue;
    }
    if (isDir) {
      if (!name.startsWith('.') && !SKIP_DIRS.has(name)) walk(path, rel, out);
    } else if (isDocFile(rel)) {
      out.push(rel);
    }
  }
}

/**
 * Every documentation file under `root`, by the path sw-tsdocs shows for it.
 *
 * @param root - The package root.
 * @returns Absolute paths keyed by their path relative to the root, sorted.
 */
export function allDocFiles(root: string): Map<string, string> {
  const rels: string[] = [];
  for (const source of DOC_SOURCES) {
    const path = join(root, source);
    if (!existsSync(path)) continue;
    if (statSync(path).isDirectory()) walk(path, source, rels);
    else if (isDocFile(source)) rels.push(source);
  }
  return new Map(rels.sort().map((rel) => [rel, join(root, rel)]));
}

/**
 * True if a documentation file is text worth showing or searching.
 *
 * @param rel - The file's path relative to the package root.
 * @returns Whether it's text.
 */
export function isText(rel: string): boolean {
  return /\.(md|ts|js|txt|json|ya?ml|sh)$/.test(rel) || rel.endsWith('LICENSE');
}

function sameFile(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolvePath(a) === resolvePath(b);
  }
}

/** `agent_guide` and `agent-guide` name the same file: the docs use both. */
const loose = (s: string): string => s.toLowerCase().replace(/_/g, '-');

/**
 * The documentation files `name` could mean, best matches first.
 *
 * Accepts a path as sw-tsdocs shows it, the same without `.md`, a file name
 * such as `agent-guide.md`, a stem such as `agent-guide` (or `agent_guide`),
 * or the full path that `sw-tsdocs path` prints.
 *
 * @param name - What the reader typed.
 * @param files - The documentation files, from {@link allDocFiles}.
 * @returns The matching relative paths.
 */
export function resolveDoc(name: string, files: Map<string, string>): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  if (isAbsolute(trimmed)) {
    return [...files].filter(([, path]) => sameFile(path, trimmed)).map(([rel]) => rel);
  }
  const wanted = trimmed.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const rels = [...files.keys()];
  for (const exact of [wanted, `${wanted}.md`]) {
    if (files.has(exact)) return [exact];
  }
  const byLength = (list: string[]): string[] => list.sort((a, b) => a.length - b.length);
  const suffix = rels.filter((rel) => rel.endsWith(`/${wanted}`) || rel.endsWith(`/${wanted}.md`));
  if (suffix.length) return byLength(suffix);
  const lw = loose(wanted);
  const looseSuffix = rels.filter(
    (rel) => loose(rel) === lw || loose(rel).endsWith(`/${lw}`) || loose(rel).endsWith(`/${lw}.md`),
  );
  if (looseSuffix.length) return byLength(looseSuffix);
  return byLength(rels.filter((rel) => loose(rel).includes(lw)));
}

/** A Markdown heading and where it is. */
export interface Heading {
  /** 1 for `#`, 2 for `##` and so on. */
  level: number;
  /** The heading's text. */
  text: string;
  /** Its 1-based line number. */
  line: number;
}

const HEADING = /^(#{1,6})\s+(.*\S)\s*$/;
const FENCE = /^\s*(```|~~~)/;

/**
 * The Markdown headings in `text`, skipping lines inside code fences.
 *
 * @param text - A Markdown document.
 * @returns Its headings, in order.
 */
export function headings(text: string): Heading[] {
  const found: Heading[] = [];
  let inFence = false;
  text.split('\n').forEach((line, index) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = HEADING.exec(line);
    if (match) found.push({ level: match[1]!.length, text: match[2]!, line: index + 1 });
  });
  return found;
}

/**
 * The first section whose heading contains `wanted`, ignoring case. The
 * section runs to the next heading at the same level or higher.
 *
 * @param text - A Markdown document.
 * @param wanted - Text the heading contains.
 * @returns The heading and the section's text, or null.
 */
export function section(text: string, wanted: string): { heading: Heading; body: string } | null {
  const lines = text.split('\n');
  const marks = headings(text);
  const lowered = wanted.toLowerCase();
  for (let i = 0; i < marks.length; i++) {
    const heading = marks[i]!;
    if (!heading.text.toLowerCase().includes(lowered)) continue;
    let end = lines.length;
    for (const later of marks.slice(i + 1)) {
      if (later.level <= heading.level) {
        end = later.line - 1;
        break;
      }
    }
    const body = lines
      .slice(heading.line - 1, end)
      .join('\n')
      .trimEnd();
    return { heading, body: `${body}\n` };
  }
  return null;
}

/** One line that matched a search. */
export interface Match {
  /** The file's path as sw-tsdocs shows it. */
  rel: string;
  /** The 1-based line number. */
  line: number;
  /** The line, trimmed. */
  text: string;
}

/**
 * Lines matching `pattern` in the text files.
 *
 * @param pattern - The expression to look for.
 * @param files - The files to search, keyed by the path to show.
 * @param limit - The most matches to return.
 * @returns The first `limit` matches and the total number.
 */
export function grepFiles(
  pattern: RegExp,
  files: Map<string, string>,
  limit: number,
): { matches: Match[]; total: number } {
  const matches: Match[] = [];
  let total = 0;
  for (const [rel, path] of files) {
    if (!isText(rel)) continue;
    let text: string;
    try {
      text = readFileSync(path, 'utf-8');
    } catch {
      continue;
    }
    text.split('\n').forEach((line, index) => {
      if (!pattern.test(line)) return;
      total += 1;
      if (matches.length < limit) matches.push({ rel, line: index + 1, text: line.trim() });
    });
  }
  return { matches, total };
}

/**
 * The package's code files, for `grep --code` and the environment-variable
 * scan: the compiled JavaScript and declarations in an installed package, the
 * TypeScript source in a clone.
 *
 * @param dir - The code directory, from `codeDir()`.
 * @param declarations - Also include `.d.ts` files.
 * @returns Absolute paths keyed by their path relative to `dir`'s parent.
 */
export function codeFiles(dir: string, declarations = true): Map<string, string> {
  const out = new Map<string, string>();
  const top = dir.split(/[\\/]/).pop()!;
  const visit = (path: string, rel: string): void => {
    let names: string[];
    try {
      names = readdirSync(path);
    } catch {
      return;
    }
    for (const name of names.sort()) {
      const child = join(path, name);
      const childRel = `${rel}/${name}`;
      if (statSync(child).isDirectory()) {
        visit(child, childRel);
      } else if (
        name.endsWith('.d.ts')
          ? declarations
          : /\.(ts|js|mts|mjs)$/.test(name) && !name.endsWith('.map')
      ) {
        out.set(childRel, child);
      }
    }
  };
  visit(dir, top);
  return out;
}
