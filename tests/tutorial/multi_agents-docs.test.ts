/**
 * The multi-agent tutorial's pages quote the real code. Every block after an
 * `<!-- include: path#region -->` marker must match that region byte for
 * byte, as the README-INCLUDE gate checks, and the Dockerfile block in
 * Lesson 4 must match tutorial/multi_agents/Dockerfile.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIR = `${ROOT}tutorial/multi_agents/`;
const PAGES = readdirSync(DIR).filter((f) => f.endsWith('.md') && !f.endsWith('_knowledge.md'));

interface Quote {
  page: string;
  line: number;
  file: string;
  region: string;
  body: string;
}

/** The fenced block that starts at or after `start`, and the line after it. */
function fenceAt(lines: string[], start: number): { body: string; end: number } {
  let i = start;
  while (lines[i]!.trim() === '') i++;
  const open = /^(\s*)(`{3,})/.exec(lines[i]!);
  if (!open) throw new Error(`no fence after line ${start}`);
  const body: string[] = [];
  let j = i + 1;
  while (!lines[j]!.trim().startsWith(open[2]!)) body.push(lines[j++]!);
  return { body: body.join('\n'), end: j + 1 };
}

function quotes(): Quote[] {
  const found: Quote[] = [];
  for (const page of PAGES) {
    const lines = readFileSync(DIR + page, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = /<!--\s*include:\s*(\S+?)#([\w.-]+)\s*-->/.exec(line);
      if (m)
        found.push({ page, line: i + 1, file: m[1]!, region: m[2]!, ...fenceAt(lines, i + 1) });
    });
  }
  return found;
}

/** The lines between `// region: name` and `// endregion: name`, as the gate reads them. */
function region(file: string, name: string): string {
  const lines = readFileSync(ROOT + file, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trim() === `// region: ${name}`);
  const end = lines.findIndex((l, i) => i > start && l.trim() === `// endregion: ${name}`);
  if (start < 0 || end < 0) throw new Error(`no region ${name} in ${file}`);
  return lines.slice(start + 1, end).join('\n');
}

/** Remove the indentation every non-blank line shares, as the gate does for the doc block. */
function dedent(text: string): string {
  const lines = text.split('\n');
  const indents = lines.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length);
  const common = Math.min(...indents);
  return lines.map((l) => (l.trim() ? l.slice(common) : '')).join('\n');
}

const trimEnd = (text: string) => text.replace(/\s+$/, '');

describe('multi-agent tutorial pages quote the real code', () => {
  const all = quotes();

  it('has include markers on every lesson that shows code', () => {
    const pages = new Set(all.map((q) => q.page));
    for (const n of [1, 2, 3, 4, 5]) {
      expect([...pages].some((p) => p.startsWith(`lesson${n}_`))).toBe(true);
    }
  });

  it.each(all.map((q) => [`${q.page}:${q.line} ${q.file}#${q.region}`, q] as const))(
    '%s matches its region',
    (_label, q) => {
      expect(trimEnd(dedent(q.body))).toBe(trimEnd(region(q.file, q.region)));
    },
  );

  it('quotes the Dockerfile in Lesson 4 as it is', () => {
    const lines = readFileSync(`${DIR}lesson4_advanced_features.md`, 'utf8').split('\n');
    const at = lines.findIndex((l) => l.startsWith('```dockerfile'));
    expect(at).toBeGreaterThan(0);
    const { body } = fenceAt(lines, at);
    expect(trimEnd(body)).toBe(trimEnd(readFileSync(`${DIR}Dockerfile`, 'utf8')));
  });
});
