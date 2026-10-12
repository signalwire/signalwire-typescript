/**
 * Directory discovery: directories added with SkillRegistry.addSkillDirectory()
 * are scanned by discoverAll(), as Python searches its _external_paths
 * (skills/registry.py:53), and a subdirectory with a compiled skill.js is found
 * as well as one with skill.ts.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SkillRegistry } from '../../src/skills/SkillRegistry.js';
import { suppressAllLogs } from '../../src/Logger.js';

const SKILL_BASE = pathToFileURL(join(__dirname, '../../src/skills/SkillBase.ts')).href;

/** A skill module's source, in `.ts` or plain `.js`. */
function skillSource(name: string, ts: boolean): string {
  const override = ts ? 'static override' : 'static';
  return [
    `import { SkillBase } from '${SKILL_BASE}';`,
    `export class Skill_${name} extends SkillBase {`,
    `  ${override} SKILL_NAME = '${name}';`,
    `  ${override} SKILL_DESCRIPTION = 'Discovered ${name}.';`,
    '}',
  ].join('\n');
}

let root: string;
let registry: SkillRegistry;

beforeAll(() => suppressAllLogs(true));

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sw-discovery-'));
  process.env['SWML_SKILL_DISCOVERY_ENABLED'] = 'true';
  registry = new SkillRegistry();
});

afterEach(() => {
  delete process.env['SWML_SKILL_DISCOVERY_ENABLED'];
  rmSync(root, { recursive: true, force: true });
});

describe('skill discovery', () => {
  it('discoverAll() scans a directory added with addSkillDirectory()', async () => {
    mkdirSync(join(root, 'weather_ext'));
    writeFileSync(join(root, 'weather_ext', 'skill.ts'), skillSource('weather_ext', true));
    registry.addSkillDirectory(root);
    expect(await registry.discoverAll()).toEqual(['weather_ext']);
    expect(registry.has('weather_ext')).toBe(true);
  });

  it('finds a compiled skill.js in a subdirectory', async () => {
    mkdirSync(join(root, 'compiled_ext'));
    writeFileSync(join(root, 'compiled_ext', 'skill.js'), skillSource('compiled_ext', false));
    expect(await registry.discoverFromDirectory(root)).toEqual(['compiled_ext']);
  });

  it('scans a directory added both ways once', async () => {
    mkdirSync(join(root, 'once_ext'));
    writeFileSync(join(root, 'once_ext', 'skill.ts'), skillSource('once_ext', true));
    registry.addSearchPath(root);
    registry.addSkillDirectory(root);
    expect(await registry.discoverAll()).toEqual(['once_ext']);
  });

  it('skips .d.ts declaration files', async () => {
    writeFileSync(join(root, 'types.d.ts'), 'export declare const x: number;');
    writeFileSync(join(root, 'flat_ext.ts'), skillSource('flat_ext', true));
    expect(await registry.discoverFromDirectory(root)).toEqual(['flat_ext']);
  });
});
