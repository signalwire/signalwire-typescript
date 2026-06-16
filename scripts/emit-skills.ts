/**
 * emit-skills.ts — the TypeScript port's SKILL-DUMP program for the cross-port
 * SKILL-CONTRACT differ (porting-sdk/scripts/diff_skill_contracts.py).
 *
 * The sibling of emit-corpus.ts, for built-in SKILLS rather than FunctionResult.
 * For each covered skill it instantiates the skill with the canonical config from
 * the shared corpus (porting-sdk/scripts/skill_contract_corpus.py — the single
 * source of truth), runs setup() + getTools(), and prints ONE JSON object
 *
 *   skill-id -> [ { name, parameters: {p: {type, enum?}}, required: [...] }, ... ]
 *
 * to stdout. The differ runs this, parses it, and structurally compares each
 * skill's tool contract against the Python reference (which registers the same
 * tools). DESCRIPTIONS are not emitted — they are LLM-facing prompt text and are
 * not part of the compared contract.
 *
 * CONTRACT (mirrors the per-port dump contract in the differ's --help):
 *   - The id set MUST equal corpus_ids() (the differ rejects a mismatch).
 *   - Only stdout carries the JSON object; logs go to stderr (suppressed here).
 *
 * Run from the signalwire-typescript repo root:
 *   npx tsx scripts/emit-skills.ts
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import { suppressAllLogs } from '../src/Logger.js';
import type { SkillBase, SkillConfig, SkillToolDefinition } from '../src/skills/index.js';
import {
  DateTimeSkill,
  MathSkill,
  JokeSkill,
  WeatherApiSkill,
  PlayBackgroundFileSkill,
  SwmlTransferSkill,
  ApiNinjasTriviaSkill,
  InfoGathererSkill,
  WebSearchSkill,
  WikipediaSearchSkill,
  GoogleMapsSkill,
  DataSphereSkill,
  SpiderSkill,
} from '../src/skills/builtin/index.js';

// Keep stdout clean: the SDK logger would otherwise interleave with the JSON.
suppressAllLogs(true);

// Some skills read credentials from env vars rather than (or in addition to)
// config (e.g. google_maps checks GOOGLE_MAPS_API_KEY). The corpus supplies the
// key as config; mirror it into the env vars those skills read so setup() loads.
// Placeholders only — no network is hit; we read tool SCHEMAS, not call APIs.
for (const v of [
  'GOOGLE_MAPS_API_KEY',
  'API_NINJAS_KEY',
  'WEATHER_API_KEY',
  'GOOGLE_SEARCH_API_KEY',
  'GOOGLE_SEARCH_ENGINE_ID',
]) {
  process.env[v] = process.env[v] ?? 'x';
}

/** skill-name → constructor, for the covered (non-dynamic) skills. */
const SKILL_CLASSES: Record<string, new (config?: SkillConfig) => SkillBase> = {
  datetime: DateTimeSkill,
  math: MathSkill,
  joke: JokeSkill,
  weather_api: WeatherApiSkill,
  play_background_file: PlayBackgroundFileSkill,
  swml_transfer: SwmlTransferSkill,
  api_ninjas_trivia: ApiNinjasTriviaSkill,
  info_gatherer: InfoGathererSkill,
  web_search: WebSearchSkill,
  wikipedia_search: WikipediaSearchSkill,
  google_maps: GoogleMapsSkill,
  datasphere: DataSphereSkill,
  spider: SpiderSkill,
};

/** A single param's comparable shape: type + (sorted) enum. */
interface ParamContract {
  type: string;
  enum?: string[];
}

/** Reduce a tool's `parameters` + `required` to the comparable contract. */
function toolContract(tool: SkillToolDefinition): {
  name: string;
  parameters: Record<string, ParamContract>;
  required: string[];
} {
  const raw = (tool.parameters ?? {}) as Record<string, unknown>;
  const props: Record<string, ParamContract> = {};
  const required: string[] = [...(tool.required ?? [])];

  // Accept the wrapped JSON-Schema form ({type:'object', properties, required})
  // as well as the flat `{name: {...}}` map. Only the wrapped form has the
  // structural `type`/`properties`/`required` keys to peel off — in the flat
  // form a param can legitimately be NAMED `type` (e.g. joke's `type`), so we
  // must not strip those keys there.
  let entries = raw;
  const isWrapped = raw['type'] === 'object' && typeof raw['properties'] === 'object';
  if (isWrapped) {
    entries = raw['properties'] as Record<string, unknown>;
    for (const r of (raw['required'] as string[] | undefined) ?? []) {
      if (!required.includes(r)) required.push(r);
    }
  }

  for (const [name, def] of Object.entries(entries)) {
    if (typeof def !== 'object' || def === null) {
      props[name] = { type: 'unknown' };
      continue;
    }
    const d = def as Record<string, unknown>;
    const entry: ParamContract = { type: (d['type'] as string) ?? 'string' };
    if (Array.isArray(d['enum'])) {
      entry.enum = (d['enum'] as unknown[]).map((x) => String(x)).sort();
    }
    props[name] = entry;
  }

  return { name: tool.name, parameters: props, required: required.sort() };
}

/** Load the shared corpus from porting-sdk (adjacent or $PORTING_SDK_PATH). */
function loadCorpus(): Array<{ id: string; skill: string; config: SkillConfig }> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [process.env['PORTING_SDK_PATH'], resolve(here, '../../porting-sdk')].filter(
    Boolean,
  ) as string[];
  for (const base of candidates) {
    const script = resolve(base, 'scripts/skill_contract_corpus.py');
    if (existsSync(script)) {
      const out = execFileSync('python3', [script], { encoding: 'utf-8' });
      return JSON.parse(out).corpus as Array<{ id: string; skill: string; config: SkillConfig }>;
    }
  }
  throw new Error(
    'cannot locate porting-sdk/scripts/skill_contract_corpus.py ' +
      '(set PORTING_SDK_PATH or clone porting-sdk adjacent).',
  );
}

async function main(): Promise<void> {
  const corpus = loadCorpus();
  const result: Record<string, ReturnType<typeof toolContract>[]> = {};

  for (const entry of corpus) {
    const SkillClass = SKILL_CLASSES[entry.skill];
    if (!SkillClass) {
      throw new Error(`emit-skills: no class wired for covered skill '${entry.skill}'`);
    }
    const skill = new SkillClass(entry.config);
    const ok = await skill.setup();
    if (!ok) {
      throw new Error(
        `emit-skills: skill '${entry.skill}' setup() returned false with the ` +
          `corpus config — config drift between the corpus and the port.`,
      );
    }
    result[entry.id] = skill.getTools().map(toolContract);
  }

  process.stdout.write(JSON.stringify(result));
}

main().catch((err) => {
  process.stderr.write(`emit-skills: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
