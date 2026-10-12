/**
 * What `npm pack` ships: the code, and the docs and examples sw-tsdocs
 * reads, in their repository layout.
 *
 * package.json's `files` allowlist names the documentation by pattern, and
 * sw-tsdocs's `isDocFile()` describes the same set; these tests check the
 * two agree against the real `npm pack --dry-run` listing, that maintainer
 * files stay out, and that every relative link in a shipped doc still
 * resolves once installed.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allDocFiles } from '../../src/cli/tsdocs/files.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const BUILT = existsSync(join(ROOT, 'dist', 'cli', 'tsdocs', 'bin.js'));

let packed: Set<string>;

beforeAll(() => {
  // --ignore-scripts: list the files without running prepack's build
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const out = execFileSync(npm, ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32',
  });
  const [result] = JSON.parse(out) as [{ files: { path: string }[] }];
  packed = new Set(result.files.map((f) => f.path));
}, 120_000);

describe('npm pack', () => {
  it('ships the docs and examples', () => {
    for (const rel of [
      'README.md',
      'CHANGELOG.md',
      'LICENSE',
      'package.json',
      'docs/agent-guide.md',
      'docs/cli-guide.md',
      'examples/README.md',
      'examples/simple-agent.ts',
      'relay/README.md',
      'relay/docs/getting-started.md',
      'relay/examples/relay-inbound.ts',
      'rest/README.md',
      'rest/docs/namespaces.md',
      'rest/examples/rest-client.ts',
      'livewire/README.md',
      'livewire/docs/migration-guide.md',
      'livewire/examples/livewire-basic-agent.ts',
    ]) {
      expect(packed.has(rel), rel).toBe(true);
    }
  });

  it('ships exactly the files sw-tsdocs treats as docs, besides the code', () => {
    const docs = [...packed]
      .filter((rel) => !rel.startsWith('dist/') && rel !== 'package.json')
      .sort();
    expect(docs).toEqual([...allDocFiles(ROOT).keys()].sort());
  });

  it('leaves out the audit harnesses, maintainer notes, tests and scripts', () => {
    const leaked = [...packed].filter(
      (rel) =>
        rel.endsWith('_audit_harness.ts') ||
        rel === 'relay/RELAY_IMPLEMENTATION_GUIDE.md' ||
        /^(tests|scripts|src|node_modules)\//.test(rel) ||
        /^(AGENTS|CLAUDE|CHECKLIST)\.md$/.test(rel) ||
        /^PORT_.*\.md$/.test(rel) ||
        /^port_(signatures|surface)/.test(rel) ||
        /\.(env|log)$/.test(rel),
    );
    expect(leaked).toEqual([]);
    expect(existsSync(join(ROOT, 'examples', 'relay_audit_harness.ts'))).toBe(true);
    expect(existsSync(join(ROOT, 'relay', 'RELAY_IMPLEMENTATION_GUIDE.md'))).toBe(true);
  });

  it.skipIf(!BUILT)('ships sw-tsdocs, its API index and the package notes', () => {
    for (const rel of [
      'dist/cli/tsdocs/bin.js',
      'dist/cli/tsdocs/index.js',
      'dist/cli/tsdocs/api-index.json',
      'dist/AGENTS.md',
      'dist/llms.txt',
    ]) {
      expect(packed.has(rel), rel).toBe(true);
    }
  });

  it('keeps relative links working once installed', () => {
    const dirs = new Set<string>();
    for (const rel of packed) {
      for (let d = posix.dirname(rel); d !== '.'; d = posix.dirname(d)) dirs.add(d);
    }
    const broken: string[] = [];
    for (const rel of [...packed].sort()) {
      if (!rel.endsWith('.md') && !rel.endsWith('llms.txt')) continue;
      const text = readFileSync(join(ROOT, rel), 'utf-8').replace(
        /^\s*(```|~~~)[\s\S]*?^\s*\1/gm,
        '',
      );
      for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const path = target!.split('#')[0]!;
        if (!path || /^[a-z][a-z0-9+.-]*:/i.test(path)) continue;
        const resolved = posix.normalize(posix.join(posix.dirname(rel), path));
        if (!packed.has(resolved) && !dirs.has(resolved.replace(/\/$/, ''))) {
          broken.push(`${rel}: ${target}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
