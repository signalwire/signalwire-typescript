/**
 * The sections of a topic that are read from the installed package, so they
 * can't drift from it: the built-in skills and their parameters, the
 * prefabs, the REST namespaces, the environment variables the code reads,
 * and the commands package.json installs.
 *
 * The skills and REST sections import only those parts of the SDK, and only
 * when their topic is printed.
 */

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { ApiIndex } from './apiTypes.js';
import { codeFiles } from './files.js';
import { codeDir, readPackageJson } from './locate.js';

/** Everything a live section may need. */
export interface LiveContext {
  /** The package root. */
  root: string;
  /** The API index, when it's built. */
  api: ApiIndex | null;
  /** The words after the topic name, such as a skill name. */
  args: string[];
}

/**
 * One line for each command the package installs.
 * tests/cli/tsdocs.test.ts checks this against package.json's `bin`.
 */
export const COMMAND_SUMMARIES: Readonly<Record<string, string>> = {
  'sw-tsdocs': 'This documentation: topics, API lookups, examples and docs search',
  'swaig-test': "Test an agent's tools and SWML locally, and simulate serverless platforms",
};

interface SkillClassLike {
  name: string;
  SKILL_NAME: string;
  SKILL_DESCRIPTION: string;
  SUPPORTS_MULTIPLE_INSTANCES: boolean;
  REQUIRED_ENV_VARS: readonly string[];
  REQUIRED_PACKAGES: readonly string[];
  getParameterSchema(): Record<
    string,
    { type?: string; description?: string; required?: boolean; default?: unknown }
  >;
}

async function builtinSkills(): Promise<SkillClassLike[]> {
  const { SkillRegistry } = await import('../../skills/SkillRegistry.js');
  const { registerBuiltinSkills } = await import('../../skills/builtin/index.js');
  registerBuiltinSkills();
  const registry = SkillRegistry.getInstance();
  return registry
    .listRegistered()
    .map((name) => registry.getSkillClass(name) as unknown as SkillClassLike | undefined)
    .filter((c): c is SkillClassLike => c !== undefined)
    .sort((a, b) => a.SKILL_NAME.localeCompare(b.SKILL_NAME));
}

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`);

async function renderSkills(ctx: LiveContext): Promise<string> {
  const skills = await builtinSkills();
  const wanted = ctx.args[0];
  if (wanted) {
    const skill = skills.find((s) => s.SKILL_NAME === wanted);
    if (!skill) {
      const names = skills.map((s) => `\`${s.SKILL_NAME}\``).join(', ');
      return `## Skill \`${wanted}\`\n\nNo built-in skill has that name. The built-in skills: ${names}.\n`;
    }
    const out = [`## Skill \`${wanted}\``, '', sentence(skill.SKILL_DESCRIPTION), ''];
    const entry = ctx.api?.entries[skill.name];
    if (entry) {
      out.push(`Class: \`${skill.name}\`, ${ctx.root}/${entry.file}:${entry.line}`, '');
    }
    out.push(
      `Parameters, for \`addSkillByName('${wanted}', {...})\` or \`new ${skill.name}({...})\`:`,
      '',
    );
    const schema = skill.getParameterSchema();
    for (const param of Object.keys(schema).sort()) {
      const spec = schema[param]!;
      const details = [spec.type ?? 'any'];
      if (spec.required) details.push('required');
      else if (spec.default !== undefined) details.push(`default ${JSON.stringify(spec.default)}`);
      out.push(`- \`${param}\` (${details.join(', ')}): ${spec.description ?? ''}`.trimEnd());
    }
    return `${out.join('\n')}\n`;
  }
  const out = [`## Built-in skills (${skills.length})`, ''];
  for (const skill of skills) {
    const needs = [...skill.REQUIRED_ENV_VARS, ...skill.REQUIRED_PACKAGES];
    const extra = needs.length ? ` Needs: ${needs.join(', ')}.` : '';
    const many = skill.SUPPORTS_MULTIPLE_INSTANCES ? ' Allows several instances.' : '';
    out.push(
      `- \`${skill.SKILL_NAME}\` (\`${skill.name}\`): ${sentence(skill.SKILL_DESCRIPTION)}${extra}${many}`,
    );
  }
  return `${out.join('\n')}\n`;
}

function renderPrefabs(ctx: LiveContext): string {
  if (!ctx.api)
    return "The API index isn't built, so the prefabs can't be listed. Run `npm run build`.\n";
  const out = ['## Prefabs', ''];
  const prefabs = ctx.api.exports
    .map((key) => ctx.api!.entries[key]!)
    .filter((e) => e.kind === 'class' && /(^|\/)prefabs\//.test(e.file));
  for (const entry of prefabs) {
    const ctor = entry.members?.find((m) => m.kind === 'constructor');
    const doc = (entry.doc.split(/\n\s*\n/)[0] ?? '').replace(/\s*\n\s*/g, ' ');
    out.push(`### ${entry.name}`, '', doc, '');
    out.push('```ts', ...entry.signature, ...(ctor?.signature ?? []), '```', '');
    out.push(`Source: ${ctx.root}/${entry.file}:${entry.line}`, '');
  }
  return `${out.join('\n').trimEnd()}\n`;
}

function publicMembers(obj: object): string[] {
  const names = new Set<string>();
  for (
    let proto: object | null = obj;
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name !== 'constructor' && !name.startsWith('_')) names.add(name);
    }
  }
  return [...names].sort();
}

async function renderRest(): Promise<string> {
  const { RestClient } = await import('../../rest/index.js');
  // Placeholder credentials: listing the namespaces sends no request
  const client = new RestClient({ project: '-', token: '-', host: 'example.signalwire.com' });
  const out = ['## Namespaces', ''];
  const record = client as unknown as Record<string, unknown>;
  for (const name of Object.keys(client)
    .filter((n) => !n.startsWith('_'))
    .sort()) {
    const value = record[name];
    if (typeof value !== 'object' || value === null) continue;
    out.push(`- \`client.${name}\`: ${publicMembers(value).join(', ')}`);
  }
  return `${out.join('\n')}\n`;
}

// A name in quotes, or read as process.env.NAME
const ENV_NAME =
  /["']((?:SWML|SIGNALWIRE)_[A-Z0-9_]+)["']|process\.env\.((?:SWML|SIGNALWIRE)_[A-Z0-9_]+)/g;

/**
 * The `SWML_` and `SIGNALWIRE_` names in the package's code, with the files
 * that use them. This module and the topics are skipped: they mention names
 * in prose.
 *
 * @param dir - The code directory.
 * @returns Each name's files, relative to the package root.
 */
export function scanEnvNames(dir: string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const [rel, path] of codeFiles(dir, false)) {
    if (/(^|\/)cli\/tsdocs\//.test(rel)) continue;
    let text: string;
    try {
      text = readFileSync(path, 'utf-8');
    } catch {
      continue;
    }
    for (const match of text.matchAll(ENV_NAME)) {
      const name = match[1] ?? match[2]!;
      if (!found.has(name)) found.set(name, new Set());
      found.get(name)!.add(rel);
    }
  }
  return found;
}

function renderEnv(ctx: LiveContext): string {
  const dir = codeDir(ctx.root);
  const found = scanEnvNames(dir);
  const names = [...found.keys()].sort();
  const out = [
    `## SWML_ and SIGNALWIRE_ variables in the installed code (${names.length})`,
    '',
    `Found by searching the package's code (${relative(ctx.root, dir)}/) for those prefixes, with the ` +
      'files that use them; those files say what each one does. The web server also reads `PORT`, ' +
      "serverless detection reads each platform's own variables, and some skills read their own " +
      'API keys.',
    '',
  ];
  for (const name of names) {
    const files = [...found.get(name)!].sort();
    const shown =
      files.slice(0, 3).join(', ') + (files.length > 3 ? ` and ${files.length - 3} more` : '');
    out.push(`- \`${name}\`: ${shown}`);
  }
  return `${out.join('\n')}\n`;
}

/**
 * The commands package.json installs.
 *
 * @param root - The package root.
 * @returns Their names, sorted.
 */
function installedCommands(root: string): string[] {
  return Object.keys(readPackageJson(root).bin ?? {}).sort();
}

function renderCli(ctx: LiveContext): string {
  const out = ['## Commands', ''];
  for (const name of installedCommands(ctx.root)) {
    out.push(`- \`${name}\`: ${COMMAND_SUMMARIES[name] ?? 'run it with --help'}`);
  }
  return `${out.join('\n')}\n`;
}

/**
 * Render a topic's live section.
 *
 * @param section - Which one.
 * @param ctx - The package root, the API index and the arguments.
 * @returns Markdown.
 */
export async function renderLive(section: string, ctx: LiveContext): Promise<string> {
  switch (section) {
    case 'skills':
      return renderSkills(ctx);
    case 'prefabs':
      return renderPrefabs(ctx);
    case 'rest':
      return renderRest();
    case 'env':
      return renderEnv(ctx);
    case 'cli':
      return renderCli(ctx);
    default:
      return '';
  }
}
