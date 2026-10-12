/**
 * Penny's lessons quote the real code. Every quoted block carries a marker on
 * the line before its fence:
 *
 *   <!-- include: tutorial/full-guardrails-agent/penny.ts#init -->   one region
 *   <!-- quote: tutorial/full-guardrails-agent/penny.sh -->          a whole file
 *
 * A region is the lines between `// region: <name>` and `// endregion: <name>`
 * in the source. The repository's README-INCLUDE gate checks include markers
 * in tracked files the same way; this test also covers whole-file quotes, and
 * runs on files git doesn't track yet.
 */

import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);
const LESSONS = new URL('tutorial/full-guardrails-agent/tutorial/', ROOT);
const MARKER = /<!--\s*(include|quote):\s*(\S+?)(?:#([\w.-]+))?\s*-->/;
const FENCE = /^\s*```/;

const read = (path: string): string => readFileSync(new URL(path, ROOT), 'utf8');

/** Drop trailing blank lines, and the indentation every line shares. */
function clean(lines: string[]): string {
  const kept = [...lines];
  while (kept.length > 0 && kept.at(-1)!.trim() === '') kept.pop();
  const indents = kept.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length);
  const common = Math.min(...indents, Infinity);
  return kept.map((l) => (l.trim() ? l.slice(common === Infinity ? 0 : common) : '')).join('\n');
}

/** The lines between `// region: name` and `// endregion: name`. */
function region(source: string, name: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => l.trim() === `// region: ${name}`);
  const end = lines.findIndex((l, i) => i > start && l.trim() === `// endregion: ${name}`);
  if (start < 0 || end < 0) throw new Error(`no region '${name}'`);
  return clean(lines.slice(start + 1, end));
}

interface Quote {
  where: string;
  kind: string;
  file: string;
  region?: string;
  block: string;
}

/** Every marked block in the lessons. */
function quotes(): Quote[] {
  const found: Quote[] = [];
  for (const page of readdirSync(LESSONS).filter((f) => f.endsWith('.md'))) {
    const lines = readFileSync(new URL(page, LESSONS), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = MARKER.exec(line);
      if (!m) return;
      const where = `${page}:${i + 1}`;
      if (!FENCE.test(lines[i + 1] ?? '')) throw new Error(`${where}: no code fence follows`);
      const end = lines.findIndex((l, j) => j > i + 1 && FENCE.test(l));
      if (end < 0) throw new Error(`${where}: the code fence is never closed`);
      found.push({
        where,
        kind: m[1]!,
        file: m[2]!,
        region: m[3],
        block: clean(lines.slice(i + 2, end)),
      });
    });
  }
  return found;
}

describe('Penny docs: the lessons quote the real code', () => {
  it('every include marker matches its region', () => {
    const includes = quotes().filter((q) => q.kind === 'include');
    expect(includes.length).toBeGreaterThan(30);
    for (const q of includes) {
      expect(q.region, `${q.where}: an include names a region`).toBeDefined();
      expect(q.block, `${q.where}: ${q.file}#${q.region}`).toBe(region(read(q.file), q.region!));
    }
  });

  it('every whole-file quote matches its file', () => {
    const whole = quotes().filter((q) => q.kind === 'quote');
    expect(whole.length).toBeGreaterThan(5);
    for (const q of whole) {
      expect(q.block, `${q.where}: ${q.file}`).toBe(clean(read(q.file).split('\n')));
    }
  });

  it('every region in the code is opened and closed once', () => {
    const sources = [
      ...readdirSync(new URL('tutorial/full-guardrails-agent/', ROOT))
        .filter((f) => f.endsWith('.ts'))
        .map((f) => `tutorial/full-guardrails-agent/${f}`),
      ...readdirSync(new URL('tests/tutorial/', ROOT))
        .filter((f) => f.startsWith('penny') && f.endsWith('.ts'))
        .map((f) => `tests/tutorial/${f}`),
    ];
    for (const file of sources) {
      const open = new Map<string, number>();
      const seen = new Set<string>();
      read(file)
        .split('\n')
        .forEach((line, i) => {
          const m = /^\s*\/\/ (region|endregion): (\S+)\s*$/.exec(line);
          if (!m) return;
          const where = `${file}:${i + 1}`;
          if (m[1] === 'region') {
            expect(seen.has(m[2]!), `${where}: '${m[2]}' opened twice`).toBe(false);
            seen.add(m[2]!);
            open.set(m[2]!, i);
          } else {
            expect(open.delete(m[2]!), `${where}: '${m[2]}' closed without opening`).toBe(true);
          }
        });
      expect([...open.keys()], `${file}: regions never closed`).toEqual([]);
    }
  });
});
