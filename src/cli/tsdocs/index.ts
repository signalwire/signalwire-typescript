/**
 * sw-tsdocs: the SDK's documentation, from the installed package.
 *
 * Written for people and for coding agents. With no arguments it prints an
 * index; each topic lists the concepts, the installed files to read,
 * examples and API names; `api` reads signatures and JSDoc from the
 * package's declarations, so the answers match the installed version.
 *
 * Mirrors signalwire-python's `sw-pydocs` (signalwire/cli/pydocs/).
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { init, note } from './agentsNote.js';
import {
  closeMatches,
  loadApiIndex,
  renderFound,
  resolveName,
  suggestions,
  summary,
} from './api.js';
import {
  allDocFiles,
  codeFiles,
  grepFiles,
  headings,
  isText,
  resolveDoc,
  section,
} from './files.js';
import { codeDir, packageRoot } from './locate.js';
import {
  renderExamples,
  renderIndex,
  renderLlmsTxt,
  renderTopic,
  renderTopicList,
  version,
} from './render.js';
import { TOPICS_BY_NAME } from './topics.js';

/** The command's usage text. */
export const USAGE = `usage: sw-tsdocs [<topic> [name] | <command> ...]

  sw-tsdocs                      the index: what the SDK does, where to start
  sw-tsdocs <topic>              one area: concepts, files to read, examples, API
  sw-tsdocs topics               every topic, one line each
  sw-tsdocs api <name>           signature, JSDoc and members of a name
  sw-tsdocs examples [filter]    examples with descriptions and paths
  sw-tsdocs grep <regex>         search the installed docs and examples
                                 (--code: the SDK's code too; --limit N)
  sw-tsdocs show <file>          print a doc (--toc for headings, --section <heading>)
  sw-tsdocs path [file]          where the docs are, or one file's full path
  sw-tsdocs init [--skill]       add a note about sw-tsdocs to AGENTS.md
                                 (--dir <project>, --print)
  sw-tsdocs --version            the installed SDK version

Run it with npx in a project that depends on @signalwire/sdk.
`;

const COMMANDS = ['topics', 'api', 'examples', 'grep', 'show', 'path', 'init', 'help'];

/** Where output goes; the tests capture it. */
export interface Io {
  /** Print to standard output. */
  out(text: string): void;
  /** Print to standard error. */
  err(text: string): void;
}

const processIo: Io = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

const withNewline = (text: string): string => (text.endsWith('\n') ? text : `${text}\n`);

/** A usage error: exit status 2. */
class UsageError extends Error {}

/** Split `argv` into positionals, flags and `--name value` options. */
function parseArgs(
  argv: string[],
  flags: string[],
  options: string[],
): { positional: string[]; flags: Set<string>; options: Map<string, string> } {
  const positional: string[] = [];
  const seen = new Set<string>();
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const eq = arg.indexOf('=');
    const name = arg.startsWith('--') && eq > 0 ? arg.slice(0, eq) : arg;
    if (flags.includes(arg)) {
      seen.add(arg);
    } else if (options.includes(name)) {
      const value = name !== arg ? arg.slice(eq + 1) : argv[++i];
      if (value === undefined) throw new UsageError(`${name} needs a value.`);
      values.set(name, value);
    } else if (arg.startsWith('-') && arg !== '-') {
      throw new UsageError(`Unknown option ${arg}.`);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags: seen, options: values };
}

function cmdApi(root: string, argv: string[], io: Io): number {
  const { positional } = parseArgs(argv, [], []);
  const name = positional[0];
  if (!name || positional.length > 1) {
    throw new UsageError(
      'usage: sw-tsdocs api <name>, such as AgentBase or FunctionResult.connect',
    );
  }
  const index = loadApiIndex(root);
  if (!index) {
    io.err("The API index isn't built: run `npm run build` in the SDK's repository.\n");
    return 1;
  }
  const found = resolveName(index, name);
  if (!found.length) {
    const hint = suggestions(index, name);
    const more = hint.length ? ` Similar names: ${hint.join(', ')}.` : '';
    io.err(`No SDK name '${name}' found.${more} Try \`sw-tsdocs grep ${name}\`.\n`);
    return 1;
  }
  let text = renderFound(index, found[0]!, root);
  if (found.length > 1) {
    const others = found
      .slice(1)
      .map((f) => {
        const doc = summary(f.member ? f.member.doc : f.entry.doc);
        return doc ? `- \`${f.name}\`: ${doc}` : `- \`${f.name}\``;
      })
      .join('\n');
    text += `\n## Other matches\n\n${others}\n`;
  }
  io.out(withNewline(text));
  return 0;
}

function cmdExamples(root: string, argv: string[], io: Io): number {
  const { positional } = parseArgs(argv, [], []);
  io.out(withNewline(renderExamples(root, positional[0])));
  return 0;
}

function cmdGrep(root: string, argv: string[], io: Io): number {
  const args = parseArgs(argv, ['--code'], ['--limit']);
  const source = args.positional[0];
  if (!source || args.positional.length > 1)
    throw new UsageError('usage: sw-tsdocs grep <regex> [--code] [--limit N]');
  const limitText = args.options.get('--limit') ?? '100';
  const limit = Number(limitText);
  if (!Number.isInteger(limit) || limit < 1) throw new UsageError('--limit must be 1 or more.');
  let pattern: RegExp;
  try {
    pattern = new RegExp(source, 'i');
  } catch (err) {
    throw new UsageError(`Invalid regular expression: ${(err as Error).message}`);
  }
  const files = allDocFiles(root);
  if (args.flags.has('--code')) {
    for (const [rel, path] of codeFiles(codeDir(root))) files.set(rel, path);
  }
  const { matches, total } = grepFiles(pattern, files, limit);
  if (!matches.length) {
    io.err(`No matches for '${source}'.\n`);
    return 1;
  }
  const lines = matches.map((m) => `${files.get(m.rel)}:${m.line}: ${m.text}`);
  if (total > matches.length) {
    lines.push(`... ${total - matches.length} more; narrow the pattern or raise --limit.`);
  }
  io.out(`${lines.join('\n')}\n`);
  return 0;
}

function cmdShow(root: string, argv: string[], io: Io): number {
  const args = parseArgs(argv, ['--toc'], ['--section']);
  const file = args.positional[0];
  if (!file || args.positional.length > 1) {
    throw new UsageError('usage: sw-tsdocs show <file> [--toc | --section <heading>]');
  }
  const wantedSection = args.options.get('--section');
  if (args.flags.has('--toc') && wantedSection !== undefined) {
    throw new UsageError('Use --toc or --section, not both.');
  }
  const files = allDocFiles(root);
  const matches = resolveDoc(file, files);
  if (!matches.length) {
    io.err(`No installed doc matches '${file}'. \`sw-tsdocs grep\` searches their text.\n`);
    return 1;
  }
  if (matches.length > 1) {
    io.err(
      `'${file}' matches several docs; name one:\n${matches
        .slice(0, 20)
        .map((m) => `- ${m}`)
        .join('\n')}\n`,
    );
    return 1;
  }
  const rel = matches[0]!;
  const path = files.get(rel)!;
  if (!isText(rel)) {
    io.err(`${path} isn't a text file.\n`);
    return 1;
  }
  const text = readFileSync(path, 'utf-8');
  if (args.flags.has('--toc')) {
    const marks = headings(text);
    if (!marks.length) {
      io.out(`${path} has no headings.\n`);
      return 0;
    }
    io.out(
      `${marks.map((m) => `${String(m.line).padStart(6)}  ${'  '.repeat(m.level - 1)}${m.text}`).join('\n')}\n`,
    );
    return 0;
  }
  if (wantedSection !== undefined) {
    const found = section(text, wantedSection);
    if (!found) {
      io.err(`No heading in ${rel} contains '${wantedSection}'. \`--toc\` lists them.\n`);
      return 1;
    }
    io.out(`<!-- ${path}:${found.heading.line} -->\n${found.body}`);
    return 0;
  }
  io.out(withNewline(text));
  return 0;
}

function cmdPath(root: string, argv: string[], io: Io): number {
  const { positional } = parseArgs(argv, [], []);
  const file = positional[0];
  if (file === undefined) {
    io.out(`${root}\n`);
    return 0;
  }
  const files = allDocFiles(root);
  const matches = resolveDoc(file, files);
  if (!matches.length) {
    io.err(`No installed doc matches '${file}'.\n`);
    return 1;
  }
  io.out(
    `${matches
      .slice(0, 20)
      .map((m) => files.get(m))
      .join('\n')}\n`,
  );
  return 0;
}

function cmdInit(argv: string[], io: Io): number {
  const args = parseArgs(argv, ['--skill', '--print'], ['--dir']);
  if (args.positional.length)
    throw new UsageError('usage: sw-tsdocs init [--dir <project>] [--skill] [--print]');
  if (args.flags.has('--print')) {
    io.out(note());
    return 0;
  }
  const project = resolve(args.options.get('--dir') ?? '.');
  if (!existsSync(project) || !statSync(project).isDirectory()) {
    io.err(`${project} isn't a directory.\n`);
    return 2;
  }
  const changes = init(project, args.flags.has('--skill'));
  io.out(`${changes.map(([path, how]) => `${how}: ${path}`).join('\n')}\n`);
  return 0;
}

/** Try the word as an API name, then as a doc, before giving up. */
function unknownWord(root: string, word: string, rest: string[], io: Io): number {
  const index = loadApiIndex(root);
  if (index && resolveName(index, word).length) {
    io.out(`<!-- \`${word}\` isn't a topic; this is \`sw-tsdocs api ${word}\` -->\n`);
    return cmdApi(root, [word], io);
  }
  if (resolveDoc(word, allDocFiles(root)).length) {
    io.out(`<!-- \`${word}\` isn't a topic; this is \`sw-tsdocs show ${word}\` -->\n`);
    return cmdShow(root, [word, ...rest], io);
  }
  const close = closeMatches(word, [...TOPICS_BY_NAME.keys(), ...COMMANDS], 3, 0.5);
  const more = close.length ? ` Did you mean: ${close.join(', ')}?` : '';
  io.err(
    `No topic, command, SDK name or doc called '${word}'.${more} Run \`sw-tsdocs\` for the index.\n`,
  );
  return 2;
}

/**
 * Run sw-tsdocs.
 *
 * @param argv - The arguments, without the program name.
 * @param io - Where output goes.
 * @param root - The package root; found from this module by default.
 * @returns The exit status: 0, 1 when a name or file isn't found, 2 for a usage error.
 */
export async function main(
  argv: string[],
  io: Io = processIo,
  root: string = packageRoot(),
): Promise<number> {
  const [first, ...rest] = argv;
  try {
    if (first === undefined) {
      io.out(renderIndex(root));
      return 0;
    }
    if (first === '-h' || first === '--help' || first === 'help') {
      io.out(USAGE);
      return 0;
    }
    if (first === '--version' || first === '-V') {
      io.out(`${version(root)}\n`);
      return 0;
    }
    if (first === '--llms-txt') {
      io.out(renderLlmsTxt());
      return 0;
    }
    const topic = TOPICS_BY_NAME.get(first);
    if (topic) {
      io.out(await renderTopic(topic, root, rest));
      return 0;
    }
    switch (first) {
      case 'topics':
        io.out(renderTopicList());
        return 0;
      case 'api':
        return cmdApi(root, rest, io);
      case 'examples':
        return cmdExamples(root, rest, io);
      case 'grep':
        return cmdGrep(root, rest, io);
      case 'show':
        return cmdShow(root, rest, io);
      case 'path':
        return cmdPath(root, rest, io);
      case 'init':
        return cmdInit(rest, io);
    }
    if (first.startsWith('-')) throw new UsageError(`Unknown option ${first}.`);
    return unknownWord(root, first, rest, io);
  } catch (err) {
    if (err instanceof UsageError) {
      io.err(`${err.message}\n\n${USAGE}`);
      return 2;
    }
    throw err;
  }
}
