/**
 * The Fred lessons (tutorial/fred/tutorial/*.md) quote their files, and the
 * quotes must not drift. A block after `<!-- include: <file>#<region> -->` is
 * the region between `// region: <region>` and `// endregion: <region>` in the
 * file. A block after `<!-- copy of: <file> -->` is the whole file, and one
 * after `<!-- copy of: <file> (excerpt) -->` is a run of the file's lines.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const LESSONS = `${REPO}tutorial/fred/tutorial/`;

interface Quote {
  lesson: string;
  line: number;
  marker: string;
  code: string;
}

/** Every fenced block in a lesson whose preceding line carries an include or copy marker. */
function quotes(lesson: string): Quote[] {
  const lines = readFileSync(`${LESSONS}${lesson}`, 'utf8').split('\n');
  const found: Quote[] = [];
  for (let i = 1; i < lines.length; i++) {
    const open = /^(\s*)(```+)\S/.exec(lines[i]!);
    if (!open) continue;
    const marker = /<!-- (include|copy of): ([^>]+?) -->/.exec(lines[i - 1]!);
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() !== open[2]) body.push(lines[j++]!);
    if (marker) {
      const indent = open[1]!.length;
      const code = body.map((l) => l.slice(Math.min(indent, l.length - l.trimStart().length)));
      found.push({
        lesson,
        line: i + 1,
        marker: `${marker[1]}: ${marker[2]}`,
        code: code.join('\n'),
      });
    }
    i = j;
  }
  return found;
}

/** The lines strictly between a file's region markers. */
function region(file: string, name: string): string {
  const lines = readFileSync(`${REPO}${file}`, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trim() === `// region: ${name}`);
  const end = lines.findIndex((l, k) => k > start && l.trim() === `// endregion: ${name}`);
  if (start < 0 || end < 0) throw new Error(`no region '${name}' in ${file}`);
  return lines.slice(start + 1, end).join('\n');
}

const all = readdirSync(LESSONS)
  .filter((f) => f.endsWith('.md'))
  .flatMap(quotes);

describe('the Fred lessons quote their files exactly', () => {
  it('has quotes to check', () => {
    expect(all.filter((q) => q.marker.startsWith('include')).length).toBeGreaterThanOrEqual(12);
    expect(all.filter((q) => q.marker.startsWith('copy of')).length).toBeGreaterThanOrEqual(10);
  });

  it.each(all.map((q) => [`${q.lesson}:${q.line} ${q.marker}`, q] as const))('%s', (_, q) => {
    const [kind, target] = q.marker.split(': ') as [string, string];
    if (kind === 'include') {
      const [file, name] = target.split('#') as [string, string];
      expect(q.code).toBe(region(file, name));
      return;
    }
    const excerpt = target.endsWith(' (excerpt)');
    const file = target.replace(' (excerpt)', '');
    const text = readFileSync(`${REPO}${file}`, 'utf8');
    if (!excerpt) {
      expect(q.code).toBe(text.replace(/\n$/, ''));
      return;
    }
    // An excerpt may be re-indented, so compare its lines without indentation
    const strip = (s: string) => s.split('\n').map((l) => l.trim());
    expect(strip(text).join('\n')).toContain(strip(q.code).join('\n'));
  });
});
