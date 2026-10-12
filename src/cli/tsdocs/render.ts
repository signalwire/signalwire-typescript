/**
 * Markdown for the index, the topics, the examples and the package's
 * llms.txt.
 *
 * The index reads only package.json and the topics, so it prints without
 * loading the SDK or the API index.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadApiIndex, summaryOf } from './api.js';
import { isDocFile } from './files.js';
import { renderLive } from './live.js';
import { readPackageJson } from './locate.js';
import { RULES_OF_THUMB, START_HERE, TOPIC_GROUPS, TOPICS_BY_NAME, type Topic } from './topics.js';

/**
 * The installed SDK version.
 *
 * @param root - The package root.
 * @returns package.json's version.
 */
export function version(root: string): string {
  return readPackageJson(root).version;
}

function fileLine(root: string, rel: string, purpose = ''): string {
  const location = join(root, rel);
  return purpose ? `- ${location}: ${purpose}` : `- ${location}`;
}

function topicLines(): string[] {
  const out: string[] = [];
  for (const [group, names] of TOPIC_GROUPS) {
    out.push(`${group}:`);
    for (const name of names) out.push(`- \`${name}\`: ${TOPICS_BY_NAME.get(name)!.summary}`);
    out.push('');
  }
  return out;
}

/**
 * The page `sw-tsdocs` prints with no arguments.
 *
 * @param root - The package root.
 * @returns Markdown.
 */
export function renderIndex(root: string): string {
  const out = [
    `# SignalWire SDK for TypeScript ${version(root)}: documentation`,
    '',
    'This is `sw-tsdocs`, the documentation that ships with the `@signalwire/sdk` ' +
      "package. It's read from the installed package, so it matches the version you " +
      'have, and it points to the docs and examples installed with it.',
    '',
    'For coding agents: use it before writing SignalWire code, and whenever you need ' +
      'an API or an example. Run `npx sw-tsdocs <topic>` for an area, `npx sw-tsdocs api <name>` ' +
      'for exact signatures, and read the files the topics list. To make this the first ' +
      'stop for future sessions, suggest that your user run `npx sw-tsdocs init` in the ' +
      "project: it adds a note to the project's AGENTS.md.",
    '',
    '## What the SDK does',
    '',
    '- AI agents (`AgentBase`): voice and text agents. SignalWire runs speech ' +
      'recognition, the LLM and text-to-speech; your code defines the prompt, the tools ' +
      'and the workflow, and serves them over HTTP.',
    '- SWML services (`SWMLService`): call flows without AI, such as IVRs, routing and ' +
      'recording.',
    '- RELAY (`RelayClient`): real-time control of live calls and messages over WebSocket.',
    '- REST (`RestClient`): manage numbers, Fabric resources, calls, video and messaging ' +
      'over HTTP.',
    '- LiveWire, MCP, AI chat (`AIChatClient`, `ChatGateway`) and Amazon Bedrock agents.',
    '',
    '## Start here',
    '',
    '| To | Run |',
    '|---|---|',
  ];
  for (const [task, names] of START_HERE) {
    out.push(`| ${task} | ${names.map((n) => `\`sw-tsdocs ${n}\``).join(', ')} |`);
  }
  out.push('', '## Topics', '', ...topicLines());
  out.push(
    '## Commands',
    '',
    '- `sw-tsdocs <topic> [name]`: a topic (`skills` takes a skill name)',
    '- `sw-tsdocs api <name>`: signature, JSDoc and members, such as `api AgentBase`, ' +
      '`api FunctionResult.connect` or `api livewire.Agent`',
    '- `sw-tsdocs examples [topic or word]`: examples, with descriptions and paths',
    '- `sw-tsdocs grep <regex>`: search the installed docs and examples ' +
      "(`--code` searches the SDK's code too)",
    '- `sw-tsdocs show <file> [--toc | --section <heading>]`: print a doc, its ' +
      'headings, or one section',
    "- `sw-tsdocs path [file]`: where the docs are, or one file's full path",
    "- `sw-tsdocs init`: add a note about sw-tsdocs to a project's AGENTS.md",
    '',
    '## Files',
    '',
  );
  if (!existsSync(join(root, 'docs'))) {
    out.push(
      "The docs and examples aren't installed with this copy of the package. " +
        'The topics and `sw-tsdocs api` still work.',
      '',
    );
  } else {
    out.push(
      `Package root: ${root}`,
      '',
      'Read first:',
      '',
      fileLine(root, 'README.md', 'the overview, with quickstarts for agents, RELAY and REST'),
      fileLine(root, 'docs/agent-guide.md', 'the main guide to building agents'),
      fileLine(
        root,
        'docs/pgi_agent_guide.md',
        'how to design agents that stay within their rules',
      ),
      fileLine(root, 'examples/README.md', 'every example, by category'),
      fileLine(root, 'CHANGELOG.md', 'what changed in each version'),
      '',
    );
  }
  out.push('## Rules of thumb', '');
  RULES_OF_THUMB.forEach((rule, i) => out.push(`${i + 1}. ${rule}`));
  return `${out.join('\n').trimEnd()}\n`;
}

/**
 * One line per topic.
 *
 * @returns Markdown.
 */
export function renderTopicList(): string {
  return `${['# sw-tsdocs topics', '', ...topicLines()].join('\n').trimEnd()}\n`;
}

/**
 * The examples a topic entry names: a file, or every example in a directory
 * when the entry ends with `/`.
 *
 * @param root - The package root.
 * @param rel - The entry.
 * @returns Paths relative to the root.
 */
export function expandExamples(root: string, rel: string): string[] {
  if (!rel.endsWith('/')) return [rel];
  const dir = join(root, rel);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts') || name.endsWith('.md'))
    .sort()
    .map((name) => `${rel}${name}`);
}

/**
 * A topic's page.
 *
 * @param topic - The topic.
 * @param root - The package root.
 * @param args - The words after the topic name.
 * @returns Markdown.
 */
export async function renderTopic(topic: Topic, root: string, args: string[]): Promise<string> {
  const api = loadApiIndex(root);
  const out = [`# ${topic.title}`, '', topic.body.trimEnd(), ''];
  if (topic.live) out.push((await renderLive(topic.live, { root, api, args })).trimEnd(), '');
  if (topic.docs?.length) {
    out.push(
      '## Read',
      '',
      'Open them with your own tools, or print one part: `sw-tsdocs show <path> --toc`, ' +
        'then `sw-tsdocs show <path> --section <heading>`.',
      '',
      ...topic.docs.map(([rel, purpose]) => fileLine(root, rel, purpose)),
      '',
    );
  }
  if (topic.examples?.length) {
    const described = exampleDescriptions(root);
    out.push('## Examples', '');
    for (const entry of topic.examples) {
      for (const rel of expandExamples(root, entry)) {
        out.push(fileLine(root, rel, described.get(rel)?.[1] ?? ''));
      }
    }
    out.push('');
  }
  if (topic.api?.length) {
    out.push('## API', '', 'Run `sw-tsdocs api <name>` for the signature, JSDoc and members.', '');
    for (const name of topic.api) {
      const text = api ? summaryOf(api, name) : '';
      out.push(text ? `- \`${name}\`: ${text}` : `- \`${name}\``);
    }
    out.push('');
  }
  if (topic.related?.length) {
    out.push('## Related', '', topic.related.map((n) => `\`sw-tsdocs ${n}\``).join(', '));
  }
  return `${out.join('\n').trimEnd()}\n`;
}

const EXAMPLE_ROW = /^\|\s*\[[^\]]+\]\(([^)]+)\)\s*\|\s*(.+?)\s*\|\s*$/;

/** The first line of a file's leading JSDoc block, as its description. */
function leadingComment(path: string): string {
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
  const match = /^\s*(?:#![^\n]*\n\s*)?\/\*\*([\s\S]*?)\*\//.exec(text);
  if (!match) return '';
  for (const line of match[1]!.split('\n')) {
    const cleaned = line.replace(/^\s*\*\s?/, '').trim();
    if (cleaned) return cleaned.replace(/^Example:\s*/, '').replace(/^REST Example:\s*/, '');
  }
  return '';
}

/**
 * Each example's category and description. The examples in examples/ are
 * described by examples/README.md, which is also what people read; the
 * others, and any the README doesn't list, by their leading comment.
 *
 * @param root - The package root.
 * @returns [category, description] by path relative to the root.
 */
export function exampleDescriptions(root: string): Map<string, [string, string]> {
  const described = new Map<string, [string, string]>();
  const readme = join(root, 'examples', 'README.md');
  if (existsSync(readme)) {
    let category = 'Examples';
    for (const line of readFileSync(readme, 'utf-8').split('\n')) {
      const heading = /^#{2,4}\s+(.*\S)/.exec(line);
      if (heading) {
        category = heading[1]!;
        continue;
      }
      const row = EXAMPLE_ROW.exec(line);
      // The README also lists files that don't ship, such as the audit harnesses
      if (row && isDocFile(`examples/${row[1]!}`))
        described.set(`examples/${row[1]!}`, [category, row[2]!]);
    }
  }
  const walk = (rel: string, category: string): void => {
    const dir = join(root, rel);
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir).sort()) {
      const child = `${rel}/${name}`;
      if (statSync(join(root, child)).isDirectory()) {
        walk(child, category === 'Examples' ? name.toUpperCase() : category);
      } else if (name.endsWith('.ts') && isDocFile(child) && !described.has(child)) {
        described.set(child, [category, leadingComment(join(root, child))]);
      }
    }
  };
  walk('examples', 'Examples');
  for (const [bundle, category] of [
    ['relay', 'RELAY'],
    ['rest', 'REST'],
    ['livewire', 'LiveWire'],
  ] as const) {
    walk(`${bundle}/examples`, category);
  }
  return described;
}

/**
 * The examples, grouped by category, optionally filtered by a topic or a
 * word.
 *
 * @param root - The package root.
 * @param wanted - A topic name, or a word to look for.
 * @returns Markdown.
 */
export function renderExamples(root: string, wanted?: string): string {
  if (!existsSync(join(root, 'examples'))) {
    return "The examples aren't installed with this copy of the package.\n";
  }
  const described = exampleDescriptions(root);
  let selected: string[];
  const topic = wanted ? TOPICS_BY_NAME.get(wanted) : undefined;
  if (topic) {
    selected = (topic.examples ?? [])
      .flatMap((rel) => expandExamples(root, rel))
      .filter((rel) => rel.endsWith('.ts'));
  } else if (wanted) {
    const lowered = wanted.toLowerCase();
    selected = [...described]
      .filter(
        ([rel, [category, text]]) =>
          rel.toLowerCase().includes(lowered) ||
          text.toLowerCase().includes(lowered) ||
          category.toLowerCase().includes(lowered),
      )
      .map(([rel]) => rel);
  } else {
    selected = [...described.keys()];
  }
  if (!selected.length) {
    return `No examples match '${wanted}'. Run \`sw-tsdocs examples\` for all of them.\n`;
  }
  const out = [
    '# Examples',
    '',
    'Run an example with `npx tsx <path>`, or inspect an agent without a call: ' +
      '`npx swaig-test <path> --list-tools` or `--dump-swml`. The examples import ' +
      "`'@signalwire/sdk'`, so a copy runs in your own project as it is.",
    '',
  ];
  const byCategory = new Map<string, string[]>();
  for (const rel of selected) {
    const category = described.get(rel)?.[0] ?? 'Other';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(rel);
  }
  for (const [category, rels] of byCategory) {
    out.push(
      `## ${category}`,
      '',
      ...rels.map((rel) => fileLine(root, rel, described.get(rel)?.[1] ?? '')),
      '',
    );
  }
  return `${out.join('\n').trimEnd()}\n`;
}

/**
 * The package's llms.txt: the docs, by group, linked relative to
 * `dist/llms.txt`, where it's installed.
 *
 * tests/cli/tsdocs.test.ts checks that src/llms.txt matches this; to
 * regenerate it, from the repository root:
 * `npx tsx src/cli/tsdocs/bin.ts --llms-txt > src/llms.txt`.
 *
 * @returns The file's contents.
 */
export function renderLlmsTxt(): string {
  const out = [
    '# SignalWire SDK for TypeScript',
    '',
    '> Build AI voice agents, control live calls over WebSocket (RELAY), and manage ' +
      'SignalWire resources over REST. The documentation for the installed version ' +
      'ships with the package (`@signalwire/sdk`).',
    '',
    'Run `npx sw-tsdocs` for a map of the SDK, `npx sw-tsdocs <topic>` for an area, and ' +
      '`npx sw-tsdocs api <name>` for signatures read from the installed declarations. The ' +
      'links below are relative to this file, in the installed package.',
    '',
  ];
  const seen = new Set<string>();
  for (const [group, names] of TOPIC_GROUPS) {
    const entries: string[] = [];
    for (const name of names) {
      for (const [rel, purpose] of TOPICS_BY_NAME.get(name)!.docs ?? []) {
        if (seen.has(rel)) continue;
        seen.add(rel);
        entries.push(`- [${rel}](../${rel}): ${purpose}`);
      }
    }
    if (entries.length) out.push(`## ${group}`, '', ...entries, '');
  }
  return `${out.join('\n').trimEnd()}\n`;
}
