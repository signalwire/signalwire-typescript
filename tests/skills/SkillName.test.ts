/**
 * SkillName closed-set typing — proves the typed built-in skill names accepted
 * by `AgentBase.addSkillByName` / `AgentBase.hasSkill` load the IDENTICAL skill
 * as the bare string, and that a typo'd literal is a compile-time error.
 *
 * Mirrors the PHP proof (signalwire-php 7f305bc, `SkillName` backed enum):
 * the typing is erased at runtime, so wire behavior is identical to passing a
 * string (parity with Python's bare-`str` `add_skill` / `has_skill`).
 *
 * Real behavior: a fresh AgentBase + the global SkillRegistry actually load the
 * datetime skill; we assert the skill's concrete SWAIG tools land on the agent.
 * No transport mocks.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { AgentBase } from '../../src/AgentBase.js';
import { registerBuiltinSkills } from '../../src/skills/builtin/index.js';
import type { SkillName } from '../../src/skills/SkillName.js';
import { DateTimeSkill } from '../../src/skills/builtin/index.js';
import { suppressAllLogs } from '../../src/Logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLNAME_DTS = path.resolve(__dirname, '../../src/skills/SkillName.ts');

/**
 * Type-check `body` (one statement per line) against the REAL `SkillName` type
 * with `strict` on, returning the tsc error message per source line. Drives the
 * actual TypeScript compiler so the "typo is a compile error" claim is verified,
 * not merely annotated — vitest does not type-check and `tests/` is excluded
 * from tsconfig.
 *
 * Kept fast and hermetic by skipping `@types` auto-inclusion (`types: []`,
 * `typeRoots: []`) and lib-checking (`skipLibCheck`), and by inlining the real
 * `SkillName` union extracted from {@link SKILLNAME_DTS} (so the probe checks
 * the shipped closed set, not a hand-copied duplicate) in a single compile.
 */
function typeCheckLines(body: string): Map<number, string> {
  const virtual = path.resolve(__dirname, '__skillname_probe__.ts');
  const union = extractSkillNameUnion();
  // file line 0 = the SkillName alias; the body's statements follow.
  const source = `type SkillName = ${union};\n${body}\n`;
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    typeRoots: [],
    target: ts.ScriptTarget.ES2022,
  };
  const host = ts.createCompilerHost(options);
  const origRead = host.readFile.bind(host);
  host.readFile = (f) => (path.resolve(f) === virtual ? source : origRead(f));
  const origExists = host.fileExists.bind(host);
  host.fileExists = (f) => (path.resolve(f) === virtual ? true : origExists(f));
  const program = ts.createProgram([virtual], options, host);
  const byLine = new Map<number, string>();
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (!d.file || path.resolve(d.file.fileName) !== virtual || d.start == null) continue;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    byLine.set(line, ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  }
  return byLine;
}

/**
 * Pull the `SkillName` union RHS straight out of the shipped source file so the
 * probe checks the real closed set rather than a hand-copied duplicate.
 */
function extractSkillNameUnion(): string {
  const src = readFileSync(SKILLNAME_DTS, 'utf-8');
  const m = src.match(/export type SkillName\s*=\s*([\s\S]*?);/);
  if (!m) throw new Error('could not locate `export type SkillName = ...;` in ' + SKILLNAME_DTS);
  // Flatten the (multi-line, leading-pipe) union onto ONE line so the inlined
  // alias is exactly file line 0 and the probed statements map to stable lines.
  return m[1].replace(/\s+/g, ' ').replace(/^\|\s*/, '').trim();
}

beforeAll(() => {
  suppressAllLogs(true);
  // Built-in skills must be present in the global registry for load-by-name.
  registerBuiltinSkills();
});

function makeAgent(): AgentBase {
  return new AgentBase({ name: 'skillname-test', route: '/' });
}

describe('SkillName closed-set typing', () => {
  it('loads the identical skill whether the name is a typed SkillName or a bare string', async () => {
    // The typed value is just the canonical wire string (types erase at runtime).
    const typed: SkillName = 'datetime';
    expect(typed).toBe(DateTimeSkill.SKILL_NAME);

    // addSkillByName() via the typed SkillName loads the real datetime skill:
    // its two SWAIG tools must land on the agent (concrete behavioral proof,
    // not a nullness check).
    const typedAgent = makeAgent();
    await typedAgent.addSkillByName(typed);
    const typedToolNames = typedAgent.getTools().map((f) => f.name).sort();
    expect(typedToolNames).toEqual(['get_current_date', 'get_current_time']);

    // hasSkill() accepts both the typed value and the bare string — same skill.
    expect(typedAgent.hasSkill(typed)).toBe(true);
    expect(typedAgent.hasSkill('datetime')).toBe(true);
    expect(typedAgent.listSkills().map((s) => s.name)).toContain('datetime');

    // Parity: the bare string loads byte-for-byte the same skill + tools.
    const stringAgent = makeAgent();
    await stringAgent.addSkillByName('datetime');
    const stringToolNames = stringAgent.getTools().map((f) => f.name).sort();
    expect(stringToolNames).toEqual(typedToolNames);
    expect(stringAgent.hasSkill('datetime' as SkillName)).toBe(true);
  });

  it('still accepts arbitrary (custom / third-party) skill names — open set + Python str parity', () => {
    // A name that is NOT a built-in SkillName is accepted by the type (the
    // `string & {}` arm) and simply reports "not loaded" at runtime.
    const agent = makeAgent();
    expect(agent.hasSkill('my_custom_third_party_skill')).toBe(false);
  });

  it('rejects a typo’d built-in name at COMPILE time, accepts the correct one', () => {
    // One compile, two statements. Body line 0 = the valid name (must be clean);
    // body line 1 = the typo (must be a tsc error). The leading `void`s keep the
    // bindings "used" so the only diagnostic is the assignability check itself.
    const errs = typeCheckLines(
      `const good: SkillName = 'datetime'; void good;\n` +
      `const bad: SkillName = 'datetiem'; void bad;`,
    );

    // The valid built-in name type-checks clean (body line 0 → file line 1).
    expect(errs.get(1)).toBeUndefined();

    // 'datetiem' is a typo for 'datetime'. As a bare string it would only fail
    // at the server; against SkillName it is a real tsc error (body line 1 →
    // file line 2). This is exactly what the documentary `// @ts-expect-error`
    // annotation below asserts — here we drive tsc so the claim is verified.
    const typoError = errs.get(2);
    expect(typoError).toBeDefined();
    expect(typoError!).toMatch(/not assignable to type 'SkillName'/);

    // Sanity: at runtime the typo'd name simply isn't a loaded skill.
    const agent = makeAgent();
    expect(agent.hasSkill('datetiem')).toBe(false);

    // Documentary form of the same guarantee — the idiomatic call-site marker.
    // @ts-expect-error — typo'd skill name must not satisfy SkillName
    const bad: SkillName = 'datetiem';
    void bad;
  });
});
