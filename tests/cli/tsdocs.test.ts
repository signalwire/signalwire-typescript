/**
 * Tests for sw-tsdocs, the SDK's documentation command.
 *
 * Most of what sw-tsdocs prints is read from the package, but the topics are
 * written by hand, so these tests check that everything a topic names
 * exists: its files, its examples, its API names and the topics it links to,
 * and that its TypeScript snippets compile against the SDK.
 *
 * The API index is built from src/index.ts here (the build writes it from
 * dist/index.d.ts), so the tests don't depend on a fresh build.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { buildApiIndex } from '../../scripts/generate-tsdocs-api.js';
import { NOTE_BEGIN, NOTE_END, init, note } from '../../src/cli/tsdocs/agentsNote.js';
import { loadApiIndex, resolveName, summary, useApiIndex } from '../../src/cli/tsdocs/api.js';
import type { ApiIndex } from '../../src/cli/tsdocs/apiTypes.js';
import {
  allDocFiles,
  headings,
  isDocFile,
  resolveDoc,
  section,
} from '../../src/cli/tsdocs/files.js';
import { main, type Io } from '../../src/cli/tsdocs/index.js';
import { COMMAND_SUMMARIES, scanEnvNames } from '../../src/cli/tsdocs/live.js';
import { findPackageRoot } from '../../src/cli/tsdocs/locate.js';
import {
  exampleDescriptions,
  expandExamples,
  renderLlmsTxt,
  renderTopic,
} from '../../src/cli/tsdocs/render.js';
import {
  START_HERE,
  TOPIC_GROUPS,
  TOPICS,
  TOPICS_BY_NAME,
  type Topic,
} from '../../src/cli/tsdocs/topics.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
  version: string;
  bin: Record<string, string>;
};
const TSDOCS = join(ROOT, 'src', 'cli', 'tsdocs');

let API: ApiIndex;
let scratch: string;

beforeAll(() => {
  API = buildApiIndex(ROOT, ['src/index.ts'], PKG.version);
  useApiIndex(API);
  scratch = mkdtempSync(join(tmpdir(), 'tsdocs-test-'));
}, 120_000);

afterAll(() => {
  useApiIndex(null);
  rmSync(scratch, { recursive: true, force: true });
});

async function run(...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = '';
  let err = '';
  const io: Io = { out: (t) => (out += t), err: (t) => (err += t) };
  const code = await main(args, io, ROOT);
  return { code, out, err };
}

function snippets(topic: Topic): string[] {
  return [...topic.body.matchAll(/```ts\n([\s\S]*?)```/g)].map((m) => m[1]!);
}

/** Write `code` as a module that imports the SDK's source, and import it. */
async function importSnippet(name: string, code: string): Promise<Record<string, unknown>> {
  const file = join(scratch, `${name}.ts`);
  const source = code.replaceAll(
    "'@signalwire/sdk'",
    JSON.stringify(join(ROOT, 'src', 'index.ts')),
  );
  writeFileSync(file, source);
  return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
}

it('finds the package root from its own module', () => {
  expect(findPackageRoot(TSDOCS)).toBe(ROOT);
  expect(findPackageRoot(tmpdir())).toBeNull();
});

describe('topics', () => {
  it.each(TOPICS.map((t) => [t.name, t] as const))('%s: docs exist and ship', (_, topic) => {
    for (const [rel, purpose] of topic.docs ?? []) {
      expect(purpose, rel).toBeTruthy();
      expect(allDocFiles(ROOT).has(rel), `${rel} is missing or doesn't ship`).toBe(true);
    }
  });

  it.each(TOPICS.map((t) => [t.name, t] as const))('%s: examples exist and ship', (_, topic) => {
    for (const entry of topic.examples ?? []) {
      const rels = expandExamples(ROOT, entry);
      expect(rels.length, `${entry} names no examples`).toBeGreaterThan(0);
      for (const rel of rels) {
        expect(allDocFiles(ROOT).has(rel), `${rel} is missing or doesn't ship`).toBe(true);
      }
    }
  });

  it.each(TOPICS.map((t) => [t.name, t] as const))('%s: API names resolve', (_, topic) => {
    for (const name of topic.api ?? []) {
      expect(resolveName(API, name).length, name).toBeGreaterThan(0);
    }
  });

  it('links name topics', () => {
    for (const topic of TOPICS) {
      for (const name of topic.related ?? [])
        expect(TOPICS_BY_NAME.has(name), `${topic.name} → ${name}`).toBe(true);
    }
    for (const [, names] of START_HERE) {
      for (const name of names) expect(TOPICS_BY_NAME.has(name), name).toBe(true);
    }
  });

  it('groups list every topic once', () => {
    const grouped = TOPIC_GROUPS.flatMap(([, names]) => names);
    expect([...grouped].sort()).toEqual([...TOPICS_BY_NAME.keys()].sort());
  });

  it('covers the areas the SDK has', () => {
    for (const name of [
      'agents',
      'swml',
      'tools',
      'datamap',
      'contexts',
      'skills',
      'prefabs',
      'relay',
      'rest',
      'livewire',
      'mcp',
      'chat',
      'bedrock',
      'deploy',
      'security',
      'testing',
      'pgi',
    ]) {
      expect(TOPICS_BY_NAME.has(name), name).toBe(true);
    }
  });

  it('TypeScript snippets compile against the SDK', () => {
    const dir = join(scratch, 'snippets');
    mkdirSync(dir, { recursive: true });
    const files: string[] = [];
    for (const topic of TOPICS) {
      snippets(topic).forEach((code, i) => {
        const file = join(dir, `${topic.name}_${i}.ts`);
        writeFileSync(file, code);
        files.push(file);
      });
    }
    expect(files.length).toBeGreaterThanOrEqual(8);
    const program = ts.createProgram(files, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      types: ['node'],
      typeRoots: [join(ROOT, 'node_modules', '@types')],
      paths: { '@signalwire/sdk': [join(ROOT, 'src', 'index.ts')] },
    });
    const problems = files.flatMap((file) =>
      ts
        .getPreEmitDiagnostics(program, program.getSourceFile(file))
        .map(
          (d) =>
            `${file.split('/').pop()}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`,
        ),
    );
    expect(problems).toEqual([]);
  }, 120_000);

  it('the quickstart agent renders its tool', async () => {
    const code = snippets(TOPICS_BY_NAME.get('quickstart')!)[0]!.replace(
      'await agent.run();',
      'export { agent };',
    );
    const mod = await importSnippet('quickstart', code);
    const agent = mod['agent'] as { renderSwml(): string };
    expect(agent.renderSwml()).toContain('get_time');
  });

  it('the SWML service renders its verbs', async () => {
    const code = snippets(TOPICS_BY_NAME.get('swml')!)[0]!.replace(
      'await service.serve();',
      'export { service };',
    );
    const mod = await importSnippet('swml', code);
    const doc = (
      mod['service'] as { getDocument(): { sections: { main: Record<string, unknown>[] } } }
    ).getDocument();
    expect(doc.sections.main.map((verb) => Object.keys(verb)[0])).toEqual([
      'answer',
      'play',
      'hangup',
    ]);
  });

  it.each(TOPICS.map((t) => [t.name, t] as const))('%s renders', async (_, topic) => {
    const text = await renderTopic(topic, ROOT, []);
    expect(text.startsWith(`# ${topic.title}`)).toBe(true);
    if (topic.docs?.length) expect(text).toContain('sw-tsdocs show <path> --toc');
    for (const [rel] of topic.docs ?? []) expect(text).toContain(join(ROOT, rel));
  });
});

describe('examples', () => {
  it('every shipped example has a description', () => {
    const described = exampleDescriptions(ROOT);
    const missing = [...allDocFiles(ROOT).keys()]
      .filter(
        (rel) =>
          rel.endsWith('.ts') &&
          /^(examples|relay\/examples|rest\/examples|livewire\/examples)\//.test(rel),
      )
      .filter((rel) => !described.get(rel)?.[1]);
    expect(missing).toEqual([]);
  });

  it('never lists the audit harnesses', async () => {
    const { out } = await run('examples');
    expect(out).not.toContain('audit_harness');
    expect(out).toContain('simple-agent.ts');
  });

  it('filters by topic', async () => {
    const { code, out } = await run('examples', 'relay');
    expect(code).toBe(0);
    expect(out).toContain('relay-outbound.ts');
    expect(out).not.toContain('simple-agent.ts');
  });

  it('filters by word', async () => {
    const { code, out } = await run('examples', 'prefab');
    expect(code).toBe(0);
    expect(out).toContain('prefab-survey.ts');
  });

  it('says when nothing matches', async () => {
    const { code, out } = await run('examples', 'no-such-example-zz');
    expect(code).toBe(0);
    expect(out).toContain('No examples match');
  });
});

describe('index', () => {
  it('prints the version, every topic and the package root', async () => {
    const { code, out } = await run();
    expect(code).toBe(0);
    expect(out).toContain(`SignalWire SDK for TypeScript ${PKG.version}`);
    for (const name of TOPICS_BY_NAME.keys()) expect(out).toContain(`\`${name}\``);
    expect(out).toContain(`Package root: ${ROOT}`);
  });

  it('topics, help and version', async () => {
    expect((await run('topics')).out).toContain('`pgi`');
    expect((await run('--help')).out).toContain('usage: sw-tsdocs');
    expect(await run('--version')).toEqual({ code: 0, out: `${PKG.version}\n`, err: '' });
  });

  it('rejects an unknown option', async () => {
    const { code, err } = await run('--nope');
    expect(code).toBe(2);
    expect(err).toContain('usage: sw-tsdocs');
  });
});

describe('sections read from the package', () => {
  it('skills lists the registry', async () => {
    const { SkillRegistry } = await import('../../src/skills/SkillRegistry.js');
    const { registerBuiltinSkills } = await import('../../src/skills/builtin/index.js');
    registerBuiltinSkills();
    const { code, out } = await run('skills');
    expect(code).toBe(0);
    const names = SkillRegistry.getInstance().listRegistered();
    expect(names.length).toBeGreaterThanOrEqual(19);
    for (const name of names) expect(out).toContain(`\`${name}\``);
  });

  it('one skill shows its parameters', async () => {
    const { code, out } = await run('skills', 'web_search');
    expect(code).toBe(0);
    expect(out).toContain('`search_engine_id` (string, required)');
    expect(out).toContain('src/skills/builtin/web_search.ts:');
  });

  it('an unknown skill', async () => {
    const { code, out } = await run('skills', 'no_such_skill');
    expect(code).toBe(0);
    expect(out).toContain('No built-in skill has that name');
  });

  it('rest lists the namespaces', async () => {
    const { out } = await run('rest');
    expect(out).toContain('`client.phoneNumbers`: ');
    expect(out).toMatch(/`client\.fabric`: .*aiAgents/);
  });

  it('config lists variables, not constants', async () => {
    const { out } = await run('config');
    expect(out).toContain('`SWML_BASIC_AUTH_PASSWORD`');
    expect(out).toContain('`SWML_ALLOWED_HOSTS`');
    expect(out).toContain('`SIGNALWIRE_JWT_TOKEN`'); // read as process.env.NAME
    expect(out).not.toContain('SIGNALWIRE_SIGNATURE_HEADER');
  });

  it("the variable scan skips sw-tsdocs's own prose", () => {
    const dir = join(scratch, 'code', 'dist');
    mkdirSync(join(dir, 'cli', 'tsdocs'), { recursive: true });
    writeFileSync(join(dir, 'agent.js'), "process.env['SWML_FROM_CODE'];\n");
    writeFileSync(join(dir, 'cli', 'tsdocs', 'topics.js'), "const t = 'SWML_FROM_TOPIC';\n");
    const found = scanEnvNames(dir);
    expect([...found.keys()]).toEqual(['SWML_FROM_CODE']);
    expect([...found.get('SWML_FROM_CODE')!]).toEqual(['dist/agent.js']);
  });

  it('prefabs lists each prefab', async () => {
    const { out } = await run('prefabs');
    for (const name of [
      'InfoGathererAgent',
      'SurveyAgent',
      'FAQBotAgent',
      'ConciergeAgent',
      'ReceptionistAgent',
    ]) {
      expect(out).toContain(`### ${name}`);
    }
  });

  it('the command summaries match package.json', async () => {
    expect(Object.keys(COMMAND_SUMMARIES).sort()).toEqual(Object.keys(PKG.bin).sort());
    expect(PKG.bin['sw-tsdocs']).toBe('dist/cli/tsdocs/bin.js');
    // npm 11 removes a bin path that starts with ./ when it publishes.
    for (const target of Object.values(PKG.bin)) expect(target).not.toMatch(/^\.\//);
    const { out } = await run('cli');
    for (const name of Object.keys(PKG.bin))
      expect(out).toContain(`\`${name}\`: ${COMMAND_SUMMARIES[name]}`);
  });
});

describe('api', () => {
  it('a class: signature, JSDoc, source and members by owner', async () => {
    const { code, out } = await run('api', 'AgentBase');
    expect(code).toBe(0);
    expect(out.startsWith('# class AgentBase\n')).toBe(true);
    expect(out).toContain(`Source: ${join(ROOT, 'src', 'AgentBase.ts')}:`);
    expect(out).toContain('class AgentBase extends SWMLService');
    expect(out).toContain('### SWMLService');
    expect(out).toContain('- `promptAddSection(');
    expect(out).toMatch(/- `defineTool</);
  });

  it('a method: its signature and JSDoc', async () => {
    const { code, out } = await run('api', 'FunctionResult.connect');
    expect(code).toBe(0);
    expect(out).toContain('connect(destination: string');
    expect(out).toContain('@param destination');
  });

  it('an inherited member says who defines it', async () => {
    const { out } = await run('api', 'AgentBase.defineTool');
    expect(out).toContain('Defined by `SWMLService`.');
  });

  it('a bare member name lists every match', async () => {
    const { code, out } = await run('api', 'hangup');
    expect(code).toBe(0);
    expect(out).toContain('## Other matches');
    expect(out).toContain('Call.hangup');
  });

  it('a namespace', async () => {
    const { code, out } = await run('api', 'livewire');
    expect(code).toBe(0);
    expect(out.startsWith('# namespace livewire')).toBe(true);
    expect(out).toContain('`livewire.Agent` (class)');
    expect((await run('api', '@signalwire/sdk/livewire.AgentSession')).out).toContain(
      '# class livewire.AgentSession',
    );
  });

  it('an unknown name suggests similar ones, snake_case included', async () => {
    const { code, err } = await run('api', 'prompt_add_sectoin');
    expect(code).toBe(1);
    expect(err).toContain('promptAddSection');
  });

  it('says when the index is not built', async () => {
    useApiIndex(null);
    try {
      expect(loadApiIndex(scratch)).toBeNull();
      // Run from src, the built index is looked for in <root>/dist
      let err = '';
      const code = await main(
        ['api', 'AgentBase'],
        { out: () => {}, err: (t) => (err += t) },
        scratch,
      );
      expect(code).toBe(1);
      expect(err).toContain('npm run build');
    } finally {
      useApiIndex(API);
    }
  });

  it('a bare word falls back to api, then to show', async () => {
    const api = await run('DataMap');
    expect(api.code).toBe(0);
    expect(api.out).toContain('sw-tsdocs api DataMap');
    expect(api.out).toContain('# class DataMap');
    const show = await run('contexts-guide', '--toc');
    expect(show.code).toBe(0);
    expect(show.out).toContain('sw-tsdocs show contexts-guide');
  });

  it('an unknown word suggests topics', async () => {
    const { code, err } = await run('toolz');
    expect(code).toBe(2);
    expect(err).toContain('tools');
  });
});

it('summaries take the first sentence of the first paragraph', () => {
  expect(summary('Core agent class that composes\na server, e.g. `a.b`. More.\n\nNext.')).toBe(
    'Core agent class that composes a server, e.g. `a.b`.',
  );
  expect(summary('Set `x.y`. Then.')).toBe('Set `x.y`.');
  expect(summary('@param x - y')).toBe('');
  expect(summary('No period')).toBe('No period');
});

describe('the API index generator', () => {
  it('reads declarations: bases, overloads, JSDoc, and no private members', () => {
    const dir = join(scratch, 'decls');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'base.d.ts'),
      [
        '/** The base. */',
        'export declare class Base {',
        '    /** Says hello. */',
        '    hello(name: string): string;',
        '    private secret;',
        '}',
      ].join('\n'),
    );
    writeFileSync(
      join(dir, 'index.d.ts'),
      [
        "import { Base } from './base.js';",
        '/**',
        ' * A thing.',
        ' *',
        ' * @example',
        ' * ```ts',
        ' * new Thing().go(1);',
        ' * ```',
        ' */',
        'export declare class Thing extends Base {',
        '    /** Go by number. */',
        '    go(n: number): this;',
        '    go(s: string): this;',
        '    protected hook(): void;',
        '    static make(): Thing;',
        '    _internal(): void;',
        '}',
        '/** Make a thing. */',
        'export declare function makeThing(): Thing;',
      ].join('\n'),
    );
    const index = buildApiIndex(dir, ['index.d.ts'], '1.2.3');
    expect(index.exports).toEqual(['Thing', 'makeThing']);
    const thing = index.entries['Thing']!;
    expect(thing.signature).toEqual(['class Thing extends Base']);
    expect(thing.doc).toContain('```ts\nnew Thing().go(1);\n```');
    expect(thing.bases).toEqual(['Base']);
    expect(thing.file).toBe('index.d.ts');
    const members = Object.fromEntries(thing.members!.map((m) => [m.name, m]));
    expect(Object.keys(members).sort()).toEqual(['go', 'hook', 'make']);
    expect(members['go']!.signature).toEqual(['go(n: number): this', 'go(s: string): this']);
    expect(members['hook']!.protected).toBe(true);
    expect(members['make']!.static).toBe(true);
    const base = index.entries['Base']!;
    expect(base.exported).toBe(false);
    expect(base.members!.map((m) => m.name)).toEqual(['hello']);
    expect(index.entries['makeThing']!.signature).toEqual(['function makeThing(): Thing']);
    const found = resolveName(index, 'Thing.hello')[0]!;
    expect(found.member!.owner).toBe('Base');
  });
});

describe('files', () => {
  it.each([
    ['docs/agent-guide.md', true],
    ['examples/simple-agent.ts', true],
    ['examples/pgi/case-domain.ts', true],
    ['examples/README.md', true],
    ['README.md', true],
    ['CHANGELOG.md', true],
    ['LICENSE', true],
    ['relay/README.md', true],
    ['relay/docs/events.md', true],
    ['relay/examples/relay-inbound.ts', true],
    ['rest/docs/fabric.md', true],
    ['livewire/examples/livewire-handoff.ts', true],
    ['examples/relay_audit_harness.ts', false],
    ['relay/RELAY_IMPLEMENTATION_GUIDE.md', false],
    ['docs/swaig-reference.md.new', false],
    ['docs/.env', false],
    ['examples/debug.log', false],
    ['examples/node_modules/x/index.ts', false],
    ['AGENTS.md', false],
    ['CLAUDE.md', false],
    ['PORT_OMISSIONS.md', false],
    ['src/index.ts', false],
    ['tests/setup.ts', false],
    ['scripts/run-ci.sh', false],
  ])('isDocFile(%s) is %s', (rel, shipped) => {
    expect(isDocFile(rel)).toBe(shipped);
  });

  it('resolves a stem, either separator, and a path', () => {
    const files = allDocFiles(ROOT);
    expect(resolveDoc('agent-guide', files)).toEqual(['docs/agent-guide.md']);
    expect(resolveDoc('agent_guide', files)).toEqual(['docs/agent-guide.md']);
    expect(resolveDoc('docs/agent-guide.md', files)).toEqual(['docs/agent-guide.md']);
    expect(resolveDoc(join(ROOT, 'docs', 'agent-guide.md'), files)).toEqual([
      'docs/agent-guide.md',
    ]);
  });

  it('show: ambiguous names are listed', async () => {
    const { code, err } = await run('show', 'getting-started');
    expect(code).toBe(1);
    expect(err).toContain('relay/docs/getting-started.md');
    expect(err).toContain('rest/docs/getting-started.md');
  });

  it('show --toc and --section', async () => {
    const toc = await run('show', 'relay/docs/getting-started', '--toc');
    expect(toc.code).toBe(0);
    const first = toc.out.split('\n')[0]!.trim().split(/\s+/).slice(1).join(' ');
    const part = await run('show', 'relay/docs/getting-started', '--section', first);
    expect(part.code).toBe(0);
    expect(part.out).toContain(first);
    expect(part.out.startsWith(`<!-- ${join(ROOT, 'relay/docs/getting-started.md')}:`)).toBe(true);
  });

  it('show: a missing section', async () => {
    const { code, err } = await run('show', 'agent-guide', '--section', 'no such heading zz');
    expect(code).toBe(1);
    expect(err).toContain('--toc');
  });

  it('show takes the path that path prints, and backslashes', async () => {
    const printed = (await run('path', 'agent-guide')).out.trim();
    expect(printed).toBe(join(ROOT, 'docs', 'agent-guide.md'));
    expect((await run('show', printed, '--toc')).code).toBe(0);
    expect((await run('show', 'docs\\agent-guide.md', '--toc')).code).toBe(0);
  });

  it('path prints the package root', async () => {
    expect(await run('path')).toEqual({ code: 0, out: `${ROOT}\n`, err: '' });
  });

  it('headings skip code fences', () => {
    const text = '# Title\n\n```bash\n# a shell comment\n```\n\n## Next\n';
    expect(headings(text).map((h) => h.text)).toEqual(['Title', 'Next']);
  });

  it('a section stops at a peer heading', () => {
    const text = '# A\n\n## B\nbody b\n### B1\nmore\n## C\nbody c\n';
    expect(section(text, 'b')?.body).toBe('## B\nbody b\n### B1\nmore\n');
  });

  it('grep limits its output', async () => {
    const { code, out } = await run('grep', 'setFunctions', '--limit', '2');
    expect(code).toBe(0);
    const lines = out.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain('more; narrow the pattern');
  });

  it('grep --code searches the SDK', async () => {
    const { code, out } = await run('grep', 'setFunctions\\(functions', '--code');
    expect(code).toBe(0);
    expect(out).toContain(join(ROOT, 'src', 'ContextBuilder.ts'));
  });

  it('grep: usage errors', async () => {
    expect((await run('grep', '(')).code).toBe(2);
    expect((await run('grep', 'AgentBase', '--limit', '0')).code).toBe(2);
    expect((await run('grep', 'no-such-text-anywhere-zz')).code).toBe(1);
  });
});

describe('init', () => {
  const fresh = (): string => mkdtempSync(join(scratch, 'project-'));

  it('creates AGENTS.md', () => {
    const dir = fresh();
    expect(init(dir)).toEqual([[join(dir, 'AGENTS.md'), 'created']]);
    const text = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
    expect(text).toContain(NOTE_BEGIN);
    expect(text).toContain(NOTE_END);
    expect(text).toContain('npx sw-tsdocs');
  });

  it('is idempotent', () => {
    const dir = fresh();
    init(dir);
    const first = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
    expect(init(dir)).toEqual([[join(dir, 'AGENTS.md'), 'unchanged']]);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf-8')).toBe(first);
  });

  it('appends to an existing AGENTS.md and updates the note in place', () => {
    const dir = fresh();
    const agents = join(dir, 'AGENTS.md');
    writeFileSync(agents, '# Project\n\nOur own rules.\n');
    init(dir);
    let text = readFileSync(agents, 'utf-8');
    expect(text.startsWith(`# Project\n\nOur own rules.\n\n${NOTE_BEGIN}`)).toBe(true);
    writeFileSync(agents, `${text.replace('npx sw-tsdocs pgi', 'old text')}\nAfter.\n`);
    expect(init(dir)).toEqual([[agents, 'updated']]);
    text = readFileSync(agents, 'utf-8');
    expect(text.split(NOTE_BEGIN)).toHaveLength(2);
    expect(text).not.toContain('old text');
    expect(text.endsWith('After.\n')).toBe(true);
  });

  it('CLAUDE.md gets the note unless it imports AGENTS.md', () => {
    const dir = fresh();
    writeFileSync(join(dir, 'CLAUDE.md'), '# Notes\n');
    init(dir);
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf-8')).toContain(NOTE_BEGIN);
    const other = fresh();
    writeFileSync(join(other, 'CLAUDE.md'), '@AGENTS.md\n');
    init(other);
    expect(readFileSync(join(other, 'CLAUDE.md'), 'utf-8')).toBe('@AGENTS.md\n');
  });

  it('--skill writes SKILL.md for both agent layouts', () => {
    const dir = fresh();
    init(dir, true);
    for (const base of ['.agents', '.claude']) {
      const skill = readFileSync(
        join(dir, base, 'skills', 'signalwire-sdk-typescript', 'SKILL.md'),
        'utf-8',
      );
      expect(skill.startsWith('---\nname: signalwire-sdk-typescript\ndescription: ')).toBe(true);
    }
  });

  it('the command, and --print', async () => {
    const dir = fresh();
    const { code, out } = await run('init', '--dir', dir);
    expect(code).toBe(0);
    expect(out).toContain(`created: ${join(dir, 'AGENTS.md')}`);
    const other = fresh();
    expect(await run('init', '--dir', other, '--print')).toEqual({ code: 0, out: note(), err: '' });
    expect(readdirSync(other)).toEqual([]);
    expect((await run('init', '--dir', join(other, 'missing'))).code).toBe(2);
  });
});

describe('discovery', () => {
  it('swaig-test --help points to sw-tsdocs', async () => {
    const out = await new Promise<string>((resolve) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', join(ROOT, 'src', 'cli', 'swaig-test.ts'), '--help'],
        {
          cwd: ROOT,
          stdio: ['ignore', 'pipe', 'ignore'],
        },
      );
      let text = '';
      child.stdout.on('data', (d: Buffer) => (text += d.toString()));
      child.on('close', () => resolve(text));
    });
    expect(out).toContain('npx sw-tsdocs');
  }, 60_000);

  it("the package's JSDoc header points to sw-tsdocs", () => {
    const header = readFileSync(join(ROOT, 'src', 'index.ts'), 'utf-8').split('*/')[0]!;
    expect(header).toContain('npx sw-tsdocs');
  });
});

describe('the package notes', () => {
  it('src/llms.txt is current', () => {
    expect(
      readFileSync(join(ROOT, 'src', 'llms.txt'), 'utf-8'),
      'regenerate: npx tsx src/cli/tsdocs/bin.ts --llms-txt > src/llms.txt',
    ).toBe(renderLlmsTxt());
  });

  it("llms.txt's links resolve from dist/, where it's installed", () => {
    const files = allDocFiles(ROOT);
    for (const [, target] of renderLlmsTxt().matchAll(/\]\(\.\.\/([^)]+)\)/g)) {
      expect(files.has(target!), target).toBe(true);
    }
  });

  it('the package AGENTS.md points at sw-tsdocs', () => {
    const text = readFileSync(join(ROOT, 'src', 'AGENTS.md'), 'utf-8');
    expect(text).toContain('npx sw-tsdocs');
    expect(text).toContain('llms.txt');
  });
});

describe('speed', () => {
  it('sw-tsdocs imports only node builtins and its own modules up front', () => {
    // The index must print without loading the SDK. Static imports load
    // eagerly; the SDK is imported only with import(), in live.ts, for the
    // topics that read it (skills, rest).
    for (const name of readdirSync(TSDOCS).filter((n) => n.endsWith('.ts'))) {
      const sf = ts.createSourceFile(
        name,
        readFileSync(join(TSDOCS, name), 'utf-8'),
        ts.ScriptTarget.ES2022,
      );
      for (const statement of sf.statements) {
        if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
        const spec = (statement.moduleSpecifier as ts.StringLiteral).text;
        expect(spec.startsWith('node:') || spec.startsWith('./'), `${name} imports ${spec}`).toBe(
          true,
        );
      }
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const spec = (node.arguments[0] as ts.StringLiteral).text;
          expect(name === 'live.ts' && spec.startsWith('../../'), `${name} imports ${spec}`).toBe(
            true,
          );
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  });

  it('the index loads no SDK module', async () => {
    // Record every module the command loads, through a resolve hook
    const hook = join(scratch, 'record-loads.mjs');
    writeFileSync(
      hook,
      [
        "import { registerHooks } from 'node:module';",
        'const seen = [];',
        'registerHooks({ resolve(s, c, next) { const r = next(s, c); seen.push(r.url); return r; } });',
        "process.on('exit', () => process.stderr.write('\\nLOADED ' + JSON.stringify(seen) + '\\n'));",
      ].join('\n'),
    );
    const { status, stderr } = await new Promise<{ status: number | null; stderr: string }>(
      (resolve) => {
        const child = spawn(
          process.execPath,
          ['--import', pathToFileURL(hook).href, '--import', 'tsx', join(TSDOCS, 'bin.ts')],
          { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] },
        );
        let err = '';
        child.stderr.on('data', (d: Buffer) => (err += d.toString()));
        child.on('close', (code) => resolve({ status: code, stderr: err }));
      },
    );
    expect(status).toBe(0);
    const loaded = JSON.parse(/LOADED (.*)/.exec(stderr)![1]!) as string[];
    const sdk = loaded.filter((url) => url.startsWith(pathToFileURL(join(ROOT, 'src')).href));
    expect(sdk.length).toBeGreaterThan(0);
    expect(sdk.filter((url) => !url.includes('/src/cli/tsdocs/'))).toEqual([]);
    expect(loaded.filter((url) => /node_modules\/(hono|ajv|ws|js-yaml)\//.test(url))).toEqual([]);
  }, 60_000);

  it.each([
    ['short output', [] as string[]],
    ['long output', ['show', 'docs/api-reference.md']],
  ])(
    'a closed pipe exits quietly (%s)',
    async (_, args) => {
      const { status, stderr } = await new Promise<{ status: number | null; stderr: string }>(
        (resolve) => {
          const child = spawn(
            process.execPath,
            ['--import', 'tsx', join(TSDOCS, 'bin.ts'), ...args],
            {
              cwd: ROOT,
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          );
          child.stdout.destroy();
          let err = '';
          child.stderr.on('data', (d: Buffer) => (err += d.toString()));
          child.on('close', (code) => resolve({ status: code, stderr: err }));
        },
      );
      expect(status).toBe(0);
      expect(stderr).not.toContain('EPIPE');
      expect(stderr).not.toContain('Error');
    },
    60_000,
  );
});
