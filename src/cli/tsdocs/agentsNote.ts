/**
 * The note that points a project's coding agents at sw-tsdocs, for AGENTS.md
 * (which most coding agents read) and an Agent Skills SKILL.md.
 * `sw-tsdocs init` writes it.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Opens the note, so `init` can find and update it. */
export const NOTE_BEGIN = '<!-- @signalwire/sdk: begin -->';
/** Closes the note. */
export const NOTE_END = '<!-- @signalwire/sdk: end -->';

const GUIDANCE = `This project uses the SignalWire SDK for TypeScript (\`@signalwire/sdk\`). Its
documentation is installed with it and matches the installed version:

- Run \`npx sw-tsdocs\` for a map of the SDK, and \`npx sw-tsdocs <topic>\` for an
  area: \`agents\`, \`tools\`, \`contexts\`, \`skills\`, \`relay\`, \`rest\`, \`deploy\`
  and more.
- Check SDK names and signatures with \`npx sw-tsdocs api <name>\` instead of
  recalling them; the TypeScript API differs from the Python SDK's.
  \`npx sw-tsdocs examples\` and \`npx sw-tsdocs grep <regex>\` find examples and
  docs.
- Before building an agent that takes real actions, read \`npx sw-tsdocs pgi\`.
- Test tools and SWML without a call: \`npx swaig-test <file> --list-tools\`,
  \`--dump-swml\`, \`--exec <tool>\`.
`;

const SKILL = `---
name: signalwire-sdk-typescript
description: Use when writing, changing or reviewing code that uses the SignalWire SDK for TypeScript (@signalwire/sdk), such as AI voice agents, SWML, SWAIG tools, RELAY call control or the REST client. Gets accurate, version-matched documentation from the installed package with sw-tsdocs.
---

# SignalWire SDK for TypeScript

${GUIDANCE}`;

/**
 * The AGENTS.md section, between markers so `init` can update it.
 *
 * @returns The section.
 */
export function note(): string {
  return `${NOTE_BEGIN}\n## SignalWire SDK\n\n${GUIDANCE}${NOTE_END}\n`;
}

/** `text` with the note added, or updated if it's already there. */
function withNote(text: string): string {
  const start = text.indexOf(NOTE_BEGIN);
  const end = text.indexOf(NOTE_END);
  if (start !== -1 && end > start) {
    return text.slice(0, start) + note() + text.slice(end + NOTE_END.length).replace(/^\n+/, '');
  }
  if (text.trim()) return `${text.replace(/\n+$/, '')}\n\n${note()}`;
  return `# Notes for coding agents\n\n${note()}`;
}

/** How `init` changed a file. */
export type Change = 'created' | 'updated' | 'unchanged';

/**
 * Add or update the note in `project`.
 *
 * AGENTS.md gets the note. So does CLAUDE.md if it exists and doesn't import
 * AGENTS.md, since an agent that reads CLAUDE.md skips AGENTS.md when both
 * are present. `skill` also writes an Agent Skills SKILL.md under
 * `.agents/skills/` and `.claude/skills/`, where agents look for skills.
 *
 * @param project - The project directory.
 * @param skill - Also write the SKILL.md files.
 * @returns Each file changed, and how.
 */
export function init(project: string, skill = false): [string, Change][] {
  const changes: [string, Change][] = [];
  const write = (path: string, content: string): void => {
    const old = existsSync(path) ? readFileSync(path, 'utf-8') : null;
    if (old === content) {
      changes.push([path, 'unchanged']);
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    changes.push([path, old === null ? 'created' : 'updated']);
  };

  const agents = join(project, 'AGENTS.md');
  write(agents, withNote(existsSync(agents) ? readFileSync(agents, 'utf-8') : ''));

  const claude = join(project, 'CLAUDE.md');
  if (existsSync(claude) && statSync(claude).isFile()) {
    const text = readFileSync(claude, 'utf-8');
    if (!text.includes('@AGENTS.md')) write(claude, withNote(text));
  }

  if (skill) {
    for (const base of ['.agents', '.claude']) {
      write(join(project, base, 'skills', 'signalwire-sdk-typescript', 'SKILL.md'), SKILL);
    }
  }
  return changes;
}
