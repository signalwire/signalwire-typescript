/**
 * skills_audit_harness.ts
 *
 * Runtime probe driven by the porting-sdk's `audit_skills_dispatch.py`.
 *
 * The audit binds an ephemeral 127.0.0.1:NNNN HTTP fixture and points
 * the named skill at it via the per-skill `*_BASE_URL` env var. The
 * harness instantiates the skill, supplies the audit-mandated config /
 * credential params (read from env), invokes the skill's handler with
 * the parsed args, and prints the parsed return value as JSON to
 * stdout. Exits 0 on success, 1 on any error.
 *
 * Environment (set by the audit fixture):
 *   - SKILL_NAME            e.g. `web_search`, `wikipedia_search`,
 *                                `datasphere`, `spider`, `weather_api`,
 *                                `api_ninjas_trivia`
 *   - SKILL_FIXTURE_URL     `http://127.0.0.1:NNNN`
 *   - SKILL_HANDLER_ARGS    JSON dict of args
 *   - per-skill upstream env (e.g. `WEB_SEARCH_BASE_URL`,
 *     `WIKIPEDIA_BASE_URL`, `DATASPHERE_BASE_URL`, `SPIDER_BASE_URL`,
 *     `WEATHER_API_BASE_URL`, `API_NINJAS_BASE_URL`)
 *   - per-skill credentials (e.g. `GOOGLE_API_KEY`, `GOOGLE_CSE_ID`,
 *     `WEATHER_API_KEY`, `API_NINJAS_KEY`, `DATASPHERE_TOKEN`)
 *
 * Each skill that the audit probes must have honored its `*_BASE_URL`
 * env var when constructing outbound URLs (see `src/skills/builtin/*.ts`
 * for the per-skill plumbing). The harness here is just a thin wrapper
 * that drives the handler.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { registerBuiltinSkills } from '../src/skills/builtin/index.js';
import { SkillRegistry } from '../src/skills/SkillRegistry.js';
import type { SkillBase, SkillConfig } from '../src/skills/SkillBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

function die(msg: string): never {
  process.stderr.write(`skills_audit_harness: ${msg}\n`);
  process.exit(1);
}

/**
 * Resolve the per-skill config the audit needs. Maps audit-mandated
 * env vars (Python parity) to the skill's TS-native config keys.
 */
function buildSkillConfig(skillName: string): SkillConfig {
  const cfg: SkillConfig = {};
  switch (skillName) {
    case 'web_search': {
      // Audit sets GOOGLE_API_KEY / GOOGLE_CSE_ID. The TS skill reads
      // GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_ENGINE_ID by default; pull
      // through whichever the audit provided.
      const apiKey =
        process.env['GOOGLE_API_KEY'] ?? process.env['GOOGLE_SEARCH_API_KEY'];
      const cseId =
        process.env['GOOGLE_CSE_ID'] ?? process.env['GOOGLE_SEARCH_ENGINE_ID'];
      if (apiKey) cfg['api_key'] = apiKey;
      if (cseId) cfg['search_engine_id'] = cseId;
      // Force one result so the harness only fetches once. The skill's
      // post-fetch scoring doesn't matter — the audit only checks the
      // outbound CSE call hit the fixture and returned the sentinel.
      cfg['num_results'] = 1;
      cfg['oversample_factor'] = 1.0;
      cfg['min_quality_score'] = 0.0;
      cfg['delay'] = 0;
      // Disable the secondary scrape pass so the only HTTP request is
      // the customsearch GET. The fixture serves JSON the skill won't
      // try to scrape on its own — but it does try to fetch each
      // result's URL. Setting min_quality_score to 0 keeps the original
      // CSE result regardless of scrape outcome.
      break;
    }
    case 'wikipedia_search': {
      cfg['num_results'] = 1;
      break;
    }
    case 'api_ninjas_trivia': {
      const k = process.env['API_NINJAS_KEY'];
      if (k) cfg['api_key'] = k;
      break;
    }
    case 'weather_api': {
      const k = process.env['WEATHER_API_KEY'];
      if (k) cfg['api_key'] = k;
      cfg['units'] = 'fahrenheit';
      break;
    }
    case 'datasphere': {
      cfg['space_name'] = 'audit-space';
      cfg['project_id'] = 'audit-project';
      cfg['document_id'] = 'audit-doc';
      const token = process.env['DATASPHERE_TOKEN'];
      if (token) cfg['token'] = token;
      break;
    }
    case 'spider': {
      // Use single fast settings so the audit-fixture round-trip
      // completes inside the audit's 15s timeout.
      cfg['delay'] = 0;
      cfg['concurrent_requests'] = 1;
      cfg['timeout'] = 5;
      cfg['cache_enabled'] = false;
      // SSRF guard rejects private IPs by default; the audit fixture
      // binds 127.0.0.1, which is private. Lift the restriction for the
      // audit run only — production is unaffected since this env var is
      // not set by normal users.
      process.env['SWML_ALLOW_PRIVATE_URLS'] = 'true';
      break;
    }
    default:
      // Other skills run with default config.
      break;
  }
  return cfg;
}

/**
 * Map the audit's `SKILL_NAME` to the tool name registered by the
 * skill. Matches Python's per-skill `tool_name` defaults.
 */
function toolNameFor(skillName: string): string {
  switch (skillName) {
    case 'web_search':
      return 'web_search';
    case 'wikipedia_search':
      return 'search_wiki';
    case 'api_ninjas_trivia':
      return 'get_trivia';
    case 'weather_api':
      return 'get_weather';
    case 'datasphere':
      return 'search_knowledge';
    case 'spider':
      return 'scrape_url';
    default:
      return skillName;
  }
}

/**
 * For DataMap-based skills (api_ninjas_trivia is one such in some
 * ports — TS keeps it handler-based, but we may add DataMap variants),
 * the SignalWire platform — not the SDK — fetches the configured
 * webhook URL. The harness simulates that platform behavior by
 * extracting the webhook URL from the registered DataMap and issuing
 * the HTTP call itself.
 */
async function executeDataMap(
  tool: any,
  args: Record<string, unknown>,
): Promise<unknown> {
  const dataMap = tool?.['data_map'] ?? tool?.dataMap;
  if (!dataMap) return null;
  const webhooks = (dataMap['webhooks'] ?? []) as any[];
  if (webhooks.length === 0) return null;
  const webhook = webhooks[0];
  const urlTemplate = String(webhook['url'] ?? '');
  const method = String(webhook['method'] ?? 'GET').toUpperCase();
  const headers = (webhook['headers'] ?? {}) as Record<string, string>;

  // Naive ${...args.foo} expansion — args.foo / args.bar.baz / etc.
  const url = urlTemplate.replace(/\$\{[^}]*args\.([\w.]+)\}/g, (_, path) => {
    const parts = String(path).split('.');
    let v: any = args;
    for (const p of parts) {
      if (v == null) return '';
      v = (v as Record<string, unknown>)[p];
    }
    return v == null ? '' : String(v);
  });

  const response = await fetch(url, {
    method,
    headers,
    body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify({}) : undefined,
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep as text */
  }
  return { status: response.status, url, body: parsed };
}

async function dispatchHandler(
  skill: SkillBase,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tools = skill.getTools();
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    die(`tool '${toolName}' not registered by skill '${skill.constructor.name}'`);
  }
  if (typeof tool.handler === 'function') {
    const result = await tool.handler(args, {});
    if (result instanceof FunctionResult) {
      return result.toDict();
    }
    return result;
  }
  // No handler — try DataMap.
  return executeDataMap(tool as any, args);
}

async function main(): Promise<void> {
  if (!process.env['SIGNALWIRE_LOG_MODE']) {
    process.env['SIGNALWIRE_LOG_MODE'] = 'off';
  }

  const skillName = process.env['SKILL_NAME'] ?? die('SKILL_NAME env var required');
  const fixtureUrl = process.env['SKILL_FIXTURE_URL'];
  if (!fixtureUrl) die('SKILL_FIXTURE_URL env var required');

  const argsRaw = process.env['SKILL_HANDLER_ARGS'] ?? '{}';
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsRaw);
  } catch (err) {
    die(`SKILL_HANDLER_ARGS not JSON: ${err}`);
  }

  // Register every built-in skill so we can look up the named one.
  registerBuiltinSkills();
  const registry = SkillRegistry.getInstance();
  const SkillClass = registry.getSkillClass(skillName);
  if (!SkillClass) die(`skill '${skillName}' not registered`);

  const skill = registry.create(skillName, buildSkillConfig(skillName));
  if (!skill) die(`failed to create skill '${skillName}'`);

  // Run setup() so every skill's lazily-resolved config validation
  // passes (api keys, document IDs, etc.). A `false` return means the
  // skill rejected its config — typically a missing credential.
  const ok = await skill.setup();
  if (!ok) die(`skill '${skillName}' setup() returned false`);

  const toolName = toolNameFor(skillName);
  const result = await dispatchHandler(skill, toolName, args);

  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(0);
}

main().catch((err) => {
  die(`unhandled error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
});
