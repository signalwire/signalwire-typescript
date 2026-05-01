#!/usr/bin/env node
/**
 * enumerate-surface.ts — emit a JSON snapshot of this SDK's public API.
 *
 * Walks `src/**\/*.ts` and produces `port_surface.json` in the same shape as
 * the porting-sdk's `python_surface.json`. Class / method names are
 * translated to the Python-reference form so the two files can be diffed
 * directly:
 *
 *   - Class names stay as-is (`AgentBase`, `FunctionResult`).
 *   - Method names: camelCase → snake_case; constructor → __init__.
 *   - Module names: mapped to Python's dotted form. For classes that exist
 *     in the Python reference we emit them under Python's canonical module
 *     (e.g. `AgentBase` from `src/AgentBase.ts` goes under
 *     `signalwire.core.agent_base`). Port-only classes are emitted under
 *     a module name derived from their file path.
 *
 * Only public top-level exports are considered (`export class`,
 * `export function`, `export const`). Public methods on classes are those
 * without a leading underscore — `__init__` (the TS `constructor`) is kept.
 *
 * Usage:
 *   npx tsx scripts/enumerate-surface.ts              # write port_surface.json
 *   npx tsx scripts/enumerate-surface.ts --stdout     # print to stdout
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Name translation helpers
// ---------------------------------------------------------------------------

/** camelCase / PascalCase → snake_case. Preserves runs of uppercase (e.g.
 *  `renderSWML` → `render_swml`, `parseURL` → `parse_url`). */
function camelToSnake(name: string): string {
  // Replace transitions between lower-to-upper and upper-to-upper-then-lower.
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/** File path `src/AgentBase.ts` → `signalwire.core.agent_base` (when the file
 *  only contains an AgentBase class that's known to Python). For files whose
 *  classes are NOT in Python, we fall back to a Python-ish module path derived
 *  from the file path.
 *
 *  Example fallback: `src/rest/callHandler.ts` → `signalwire.rest.call_handler`.
 */
function fallbackModuleName(fileRelPath: string): string {
  // Drop the leading "src/" segment and the ".ts" suffix.
  let rel = fileRelPath.replace(/^src\//, '').replace(/\.ts$/, '');
  // Break into parts, snake_case each.
  const parts = rel.split('/').map((p) => camelToSnake(p).replace(/-/g, '_'));
  return ['signalwire', ...parts].join('.');
}

// ---------------------------------------------------------------------------
// Python-reference lookup: load python_surface.json once and build a
// class-name → module map. When a TS class name exists in Python under one
// module, we emit it there. When it's ambiguous (same name under multiple
// Python modules), we prefer whichever module best matches the TS file path.
// ---------------------------------------------------------------------------

interface PythonSurface {
  version: string;
  modules: Record<string, { classes: Record<string, string[]>; functions: string[] }>;
}

/** Load the Python reference and build three lookup tables:
 *
 *   classToModules:      class name      → [candidate modules…]
 *   methodToOwners:      method name     → [(mod, class)…] (all Python owners)
 *   agentBaseFold:       method name     → (mod, class) pairs where TS folds
 *                                          the method into AgentBase.
 */
function loadPythonReference(pythonSurfacePath: string): {
  classToModules: Map<string, string[]>;
  methodToOwners: Map<string, Array<{ mod: string; cls: string }>>;
  pythonModules: Set<string>;
  pythonClasses: Map<string, { mod: string; cls: string }[]>;
  pythonMethodsByOwner: Map<string, Set<string>>; // key: `${mod}.${cls}`
} {
  if (!fs.existsSync(pythonSurfacePath)) {
    return {
      classToModules: new Map(),
      methodToOwners: new Map(),
      pythonModules: new Set(),
      pythonClasses: new Map(),
      pythonMethodsByOwner: new Map(),
    };
  }
  const data: PythonSurface = JSON.parse(fs.readFileSync(pythonSurfacePath, 'utf-8'));
  const classToModules = new Map<string, string[]>();
  const methodToOwners = new Map<string, Array<{ mod: string; cls: string }>>();
  const pythonModules = new Set<string>();
  const pythonClasses = new Map<string, { mod: string; cls: string }[]>();
  const pythonMethodsByOwner = new Map<string, Set<string>>();
  for (const [mod, entry] of Object.entries(data.modules)) {
    pythonModules.add(mod);
    for (const [cls, methods] of Object.entries(entry.classes ?? {})) {
      if (!classToModules.has(cls)) classToModules.set(cls, []);
      classToModules.get(cls)!.push(mod);

      const key = `${mod}.${cls}`;
      pythonMethodsByOwner.set(key, new Set(methods));
      if (!pythonClasses.has(cls)) pythonClasses.set(cls, []);
      pythonClasses.get(cls)!.push({ mod, cls });

      for (const m of methods) {
        if (!methodToOwners.has(m)) methodToOwners.set(m, []);
        methodToOwners.get(m)!.push({ mod, cls });
      }
    }
  }
  return {
    classToModules,
    methodToOwners,
    pythonModules,
    pythonClasses,
    pythonMethodsByOwner,
  };
}

/** Score how closely a Python module matches a TS file path. Higher = better.
 *  Used to disambiguate when one class name appears under multiple Python
 *  modules. */
function moduleMatchScore(pythonMod: string, tsFileRelPath: string): number {
  const fileSlug = camelToSnake(
    tsFileRelPath.replace(/^src\//, '').replace(/\.ts$/, '').split('/').pop() ?? '',
  );
  const pyTail = pythonMod.split('.').pop() ?? '';
  if (pyTail === fileSlug) return 100;
  // Match by dir hint: "rest" in TS path → "rest" in Python module.
  const tsDirs = tsFileRelPath.replace(/^src\//, '').split('/').slice(0, -1);
  let score = 0;
  for (const d of tsDirs) {
    const ds = camelToSnake(d).replace(/-/g, '_');
    if (pythonMod.includes(`.${ds}.`) || pythonMod.includes(`.${ds}`)) score += 10;
  }
  return score;
}

/** Canonical module-name remap for TS paths that don't naturally map to Python
 *  module paths. Applied AFTER class lookup fails (the class isn't in Python),
 *  so port-only classes end up under a sensible dotted name. */
const TS_MODULE_ALIASES: Record<string, string> = {
  // Top-level TS files that are "core" in Python.
  'src/AgentBase.ts': 'signalwire.core.agent_base',
  'src/AgentServer.ts': 'signalwire.agent_server',
  'src/AuthHandler.ts': 'signalwire.core.auth_handler',
  'src/ConfigLoader.ts': 'signalwire.core.config_loader',
  'src/ContextBuilder.ts': 'signalwire.core.contexts',
  'src/DataMap.ts': 'signalwire.core.data_map',
  'src/FunctionResult.ts': 'signalwire.core.function_result',
  'src/Logger.ts': 'signalwire.core.logging_config',
  'src/PomBuilder.ts': 'signalwire.core.pom_builder',
  'src/PromptManager.ts': 'signalwire.core.agent.prompt.manager',
  'src/SchemaUtils.ts': 'signalwire.utils.schema_utils',
  'src/SecurityUtils.ts': 'signalwire.utils',
  'src/ServerlessAdapter.ts': 'signalwire.core.mixins.serverless_mixin',
  'src/SessionManager.ts': 'signalwire.core.security.session_manager',
  'src/SslConfig.ts': 'signalwire.core.security_config',
  'src/SwaigFunction.ts': 'signalwire.core.swaig_function',
  'src/SwmlBuilder.ts': 'signalwire.core.swml_builder',
  'src/SWMLHandler.ts': 'signalwire.core.swml_handler',
  'src/SWMLService.ts': 'signalwire.core.swml_service',
  'src/TypeInference.ts': 'signalwire.core.agent.tools.type_inference',
  'src/WebService.ts': 'signalwire.web.web_service',
  // Relay
  'src/relay/Action.ts': 'signalwire.relay.call',
  'src/relay/Call.ts': 'signalwire.relay.call',
  'src/relay/Message.ts': 'signalwire.relay.message',
  'src/relay/RelayClient.ts': 'signalwire.relay.client',
  'src/relay/RelayError.ts': 'signalwire.relay.client',
  'src/relay/RelayEvent.ts': 'signalwire.relay.event',
  // REST
  'src/rest/index.ts': 'signalwire.rest.client',
  'src/rest/HttpClient.ts': 'signalwire.rest._base',
  'src/rest/RestError.ts': 'signalwire.rest._base',
  'src/rest/callHandler.ts': 'signalwire.rest.call_handler',
  'src/rest/pagination.ts': 'signalwire.rest._pagination',
  'src/rest/base/BaseResource.ts': 'signalwire.rest._base',
  'src/rest/base/CrudResource.ts': 'signalwire.rest._base',
  'src/rest/base/CrudWithAddresses.ts': 'signalwire.rest._base',
  // Skills
  'src/skills/SkillBase.ts': 'signalwire.core.skill_base',
  'src/skills/SkillManager.ts': 'signalwire.core.skill_manager',
  'src/skills/SkillRegistry.ts': 'signalwire.skills.registry',
  // Prefabs
  'src/prefabs/ConciergeAgent.ts': 'signalwire.prefabs.concierge',
  'src/prefabs/FAQBotAgent.ts': 'signalwire.prefabs.faq_bot',
  'src/prefabs/InfoGathererAgent.ts': 'signalwire.prefabs.info_gatherer',
  'src/prefabs/ReceptionistAgent.ts': 'signalwire.prefabs.receptionist',
  'src/prefabs/SurveyAgent.ts': 'signalwire.prefabs.survey',
  // LiveWire (flat in Python; namespaces in TS handled by ns flattening below)
  'src/livewire/index.ts': 'signalwire.livewire',
  // CLI
  'src/cli/swaig-test.ts': 'signalwire.cli.test_swaig',
  'src/cli/agent-loader.ts': 'signalwire.cli.core.agent_loader',
  'src/cli/mock-data.ts': 'signalwire.cli.simulation.mock_env',
  // index.ts barrel exports — top-level module functions go under `signalwire`.
  'src/index.ts': 'signalwire',
};

/** Class-name translations where the TS spelling differs from Python's.
 *  Applied ONLY when the class appears in the Python reference under the
 *  mapped name and the TS name maps to that same intended class. */
const CLASS_NAME_ALIASES: Record<string, string> = {
  // TS keeps PascalCase consistency (Swml…) while Python uses SCREAMING
  // initialisms (SWML…) for these specific classes.
  SwaigFunction: 'SWAIGFunction',
  SwmlBuilder: 'SWMLBuilder',
  // Note: SWMLService, SWMLVerbHandler, AIVerbHandler keep their ALL-CAPS
  // spelling on both sides.
  // REST error class — Python uses ``SignalWireRestError`` to disambiguate
  // from the standard library; TS shortens to ``RestError`` since it's
  // already namespaced under the rest module.
  RestError: 'SignalWireRestError',
};

/** Method-name aliases for known TS↔Python naming mismatches that are one-off
 *  lexical differences rather than functional gaps. Applied when emitting a
 *  method for a class that exists in the Python reference. */
const METHOD_NAME_ALIASES: Record<string, Record<string, string>> = {
  // `userData` getter is snake_cased to `user_data` by camelToSnake, but
  // Python spells it as a flat `userdata` (no underscore).
  'signalwire.livewire.AgentSession': { user_data: 'userdata' },
  'signalwire.livewire.RunContext': { user_data: 'userdata' },

  // SkillManager: TS renamed for TypeScript idiom but the semantics match.
  'signalwire.core.skill_manager.SkillManager': {
    add_skill: 'load_skill',              // TS addSkill(SkillInstance) ~ Python load_skill
    remove_skill: 'unload_skill',         // TS removeSkill(instanceId) ~ Python unload_skill
    list_skills: 'list_loaded_skills',    // TS listSkills ~ Python list_loaded_skills
  },

  // SkillRegistry: TS singleton-style names map to Python methods.
  'signalwire.skills.registry.SkillRegistry': {
    register: 'register_skill',               // TS register(cls) ~ Python register_skill
    add_search_path: 'add_skill_directory',   // TS addSearchPath ~ Python add_skill_directory
    discover_from_directory: 'discover_skills', // ~ Python discover_skills
    // get_skill_class matches verbatim after camelToSnake.
    // listSkills → list_skills (matches verbatim).
    // has / clear / lock / unregister / create / size / reset_instance / get_instance are TS-only additions.
  },
};

/** Method aliases applied to every subclass of a given base class (by
 *  Python-module key `mod.cls`). Currently empty — early versions of this
 *  script aliased `get_tools` → `register_tools` but those are distinct
 *  methods in Python (one returns defs, the other runs registration). */
const SKILL_METHOD_ALIASES: Record<string, string> = {};

/** Function-name aliases on a per-module basis. */
const FUNCTION_NAME_ALIASES: Record<string, Record<string, string>> = {
  // TS's `tool` is Python's `function_tool` (LiveKit compat shim).
  'signalwire.livewire': { tool: 'function_tool' },
};

/** Skills (builtin): `src/skills/builtin/<name>.ts` maps to
 *  `signalwire.skills.<name>.skill` per the Python layout. */
function builtinSkillModule(fileRel: string): string | null {
  const m = fileRel.match(/^src\/skills\/builtin\/([A-Za-z0-9_]+)\.ts$/);
  if (!m) return null;
  const baseName = m[1];
  if (baseName === 'index') return 'signalwire.skills.registry';
  // Python uses signalwire.skills.<name>.skill.
  return `signalwire.skills.${baseName}.skill`;
}

/** REST namespace: `src/rest/namespaces/<name>.ts` → `signalwire.rest.namespaces.<name>` */
function restNamespaceModule(fileRel: string): string | null {
  const m = fileRel.match(/^src\/rest\/namespaces\/([A-Za-z0-9_-]+)\.ts$/);
  if (!m) return null;
  const py = m[1].replace(/-/g, '_');
  return `signalwire.rest.namespaces.${py}`;
}

// ---------------------------------------------------------------------------
// TypeScript AST traversal
// ---------------------------------------------------------------------------

interface ClassInfo {
  name: string;
  methods: string[];
  extendsName?: string;
}

interface FileSurface {
  classes: ClassInfo[];
  functions: string[];
}

/** Walk a source file and collect exported classes (with their public methods)
 *  and exported top-level functions / const arrow-functions. Descends into
 *  `export namespace X { ... }` blocks; classes inside are collected with a
 *  translated name ("inference" + "STT" → "InferenceSTT") when the namespace
 *  is `inference` in the Python-compat livewire map. */
function enumerateFile(file: string): FileSurface {
  const text = fs.readFileSync(file, 'utf-8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);

  const classes: ClassInfo[] = [];
  const functions: string[] = [];

  function collectClass(node: ts.ClassDeclaration, nameOverride?: string): void {
    if (!node.name) return;
    const rawName = nameOverride ?? node.name.text;
    const methods = new Set<string>();
    for (const member of node.members) {
      // Skip private/protected? No — filter only on leading underscore, per
      // Python convention. TS `private` keyword is orthogonal to public API.
      if (ts.isConstructorDeclaration(member)) {
        methods.add('__init__');
        continue;
      }
      // Method declaration.
      if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        const mName = member.name.text;
        if (mName.startsWith('_')) continue;
        // Skip private methods marked with `private` keyword; they are
        // implementation detail per TS convention even though JS still lets
        // you call them.
        const mods = ts.getCombinedModifierFlags(member);
        if (mods & ts.ModifierFlags.Private) continue;
        methods.add(camelToSnake(mName));
      }
      // Getter / setter.
      if ((ts.isGetAccessor(member) || ts.isSetAccessor(member)) && member.name && ts.isIdentifier(member.name)) {
        const mName = member.name.text;
        if (mName.startsWith('_')) continue;
        const mods = ts.getCombinedModifierFlags(member);
        if (mods & ts.ModifierFlags.Private) continue;
        methods.add(camelToSnake(mName));
      }
    }
    // Extract the extended class name (simple identifier case only; no
    // generic arguments are tracked for inheritance purposes).
    let extendsName: string | undefined;
    if (node.heritageClauses) {
      for (const hc of node.heritageClauses) {
        if (hc.token === ts.SyntaxKind.ExtendsKeyword && hc.types.length > 0) {
          const parent = hc.types[0]!.expression;
          if (ts.isIdentifier(parent)) extendsName = parent.text;
          else if (ts.isPropertyAccessExpression(parent) && ts.isIdentifier(parent.name)) {
            extendsName = parent.name.text;
          }
        }
      }
    }
    classes.push({ name: rawName, methods: Array.from(methods).sort(), extendsName });
  }

  function collectFunction(name: string): void {
    if (name.startsWith('_')) return;
    const snake = camelToSnake(name);
    // Free-function name overrides — Python's top-level
    // ``signalwire.RestClient`` is a factory function but uses PascalCase
    // (it mirrors the class name). The TS source-side function is named
    // ``restClient`` to avoid shadowing the class export; we project it
    // onto the canonical Python name here.
    const projected = snake === 'rest_client' ? 'RestClient' : snake;
    functions.push(projected);
  }

  /** Is this statement exported at the top level? */
  function isExported(node: ts.Node): boolean {
    const mods = ts.getCombinedModifierFlags(node as ts.Declaration);
    return (mods & ts.ModifierFlags.Export) !== 0;
  }

  /** Walk top-level statements + descend into exported namespaces. */
  function walk(container: ts.Node, nsPath: string[] = []): void {
    const forEachStatement = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node) && isExported(node) && node.name) {
        const nm = nsPath.length > 0
          ? `${nsPath.join('')}${node.name.text}` // namespace-prefixed (e.g. "Inference" + "STT")
          : node.name.text;
        collectClass(node, nm);
      } else if (ts.isFunctionDeclaration(node) && isExported(node) && node.name) {
        // Only care about concrete functions (they have a body). Overload
        // declarations without a body are parsed as separate nodes.
        if (!node.body) return;
        collectFunction(node.name.text);
      } else if (ts.isVariableStatement(node) && isExported(node)) {
        for (const decl of node.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name)) continue;
          // Only export-const-arrow-function and export-const-function-expression
          // count as "callable exports". Plain const values are not API surface.
          if (!decl.initializer) continue;
          if (
            ts.isArrowFunction(decl.initializer) ||
            ts.isFunctionExpression(decl.initializer)
          ) {
            collectFunction(decl.name.text);
          }
        }
      } else if (ts.isModuleDeclaration(node) && isExported(node) && node.body && ts.isModuleBlock(node.body)) {
        // `export namespace plugins { ... }`. Descend — classes inside still
        // count as exports, but we need to translate their names to match
        // Python. For the `inference` namespace in livewire, Python uses
        // `InferenceSTT`, `InferenceLLM`, `InferenceTTS`. For `plugins`,
        // Python already uses the raw class names inside
        // `signalwire.livewire.plugins`.
        const nsName = node.name.getText(sf);
        // For "inference", concat the namespace prefix so "STT" becomes
        // "InferenceSTT". For "plugins", leave as-is (the classes go under a
        // separate module, handled by the caller).
        if (nsName === 'inference') {
          walk(node.body, ['Inference']);
        } else {
          // For other namespaces, pass through but mark the namespace.
          for (const stmt of node.body.statements) {
            if (ts.isClassDeclaration(stmt) && isExported(stmt) && stmt.name) {
              // Class inside `plugins` is emitted as-is; the caller assigns
              // it to the `signalwire.livewire.plugins` module.
              classes.push({ name: `__NS__${nsName}__${stmt.name.text}`, methods: collectMethodsFor(stmt) });
            }
          }
        }
      }
    };
    ts.forEachChild(container, forEachStatement);
  }

  function collectMethodsFor(node: ts.ClassDeclaration): string[] {
    const methods = new Set<string>();
    for (const member of node.members) {
      if (ts.isConstructorDeclaration(member)) { methods.add('__init__'); continue; }
      if ((ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member))
          && member.name && ts.isIdentifier(member.name)) {
        const nm = member.name.text;
        if (nm.startsWith('_')) continue;
        const mods = ts.getCombinedModifierFlags(member);
        if (mods & ts.ModifierFlags.Private) continue;
        methods.add(camelToSnake(nm));
      }
    }
    return Array.from(methods).sort();
  }

  walk(sf);

  return { classes, functions };
}

// ---------------------------------------------------------------------------
// Module assignment
// ---------------------------------------------------------------------------

/** Decide which Python-reference module a class belongs to. Order of
 *  precedence:
 *    1. Explicit TS_MODULE_ALIASES for the file path (hard override).
 *    2. Class name matches one in python_surface.json → use that module,
 *       disambiguating by file-path similarity if multiple candidates.
 *    3. Fall back to fallbackModuleName().
 */
function pickModule(
  className: string,
  tsFileRel: string,
  classToModules: Map<string, string[]>,
): string {
  // Builtin skills live under their own per-skill module — don't let class
  // name lookup override that.
  const skillMod = builtinSkillModule(tsFileRel);
  if (skillMod) return skillMod;

  const restNs = restNamespaceModule(tsFileRel);
  if (restNs) return restNs;

  const candidates = classToModules.get(className);
  if (candidates && candidates.length > 0) {
    if (candidates.length === 1) return candidates[0]!;
    // Disambiguate by file path similarity.
    let best = candidates[0]!;
    let bestScore = -1;
    for (const c of candidates) {
      const s = moduleMatchScore(c, tsFileRel);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    return best;
  }

  // Fall through to file-path aliases / derivation.
  if (TS_MODULE_ALIASES[tsFileRel]) return TS_MODULE_ALIASES[tsFileRel]!;
  return fallbackModuleName(tsFileRel);
}

/** Similar picker for top-level module functions (no class to look up by). */
function pickModuleForFunction(tsFileRel: string): string {
  const skillMod = builtinSkillModule(tsFileRel);
  if (skillMod) return skillMod;
  const restNs = restNamespaceModule(tsFileRel);
  if (restNs) return restNs;
  if (TS_MODULE_ALIASES[tsFileRel]) return TS_MODULE_ALIASES[tsFileRel]!;
  return fallbackModuleName(tsFileRel);
}

// ---------------------------------------------------------------------------
// Walk the repo
// ---------------------------------------------------------------------------

function findSourceFiles(root: string): string[] {
  const out: string[] = [];
  function walkDir(dir: string): void {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
        walkDir(full);
      } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
        // Skip codegen artifacts.
        if (name === 'SwmlVerbMethods.generated.ts') continue;
        if (name === 'generateVerbTypes.ts') continue;
        out.push(full);
      }
    }
  }
  walkDir(root);
  return out.sort();
}

/** Resolve the path to python_surface.json. Priority:
 *    1. $PYTHON_SURFACE_PATH
 *    2. $PORTING_SDK_PATH/python_surface.json
 *    3. sibling ../porting-sdk/python_surface.json
 *    4. ~/src/porting-sdk/python_surface.json
 */
function resolvePythonSurfacePath(repoRoot: string): string {
  const envPath = process.env['PYTHON_SURFACE_PATH'];
  if (envPath && fs.existsSync(envPath)) return envPath;
  const portingSdkEnv = process.env['PORTING_SDK_PATH'];
  if (portingSdkEnv) {
    const candidate = path.join(portingSdkEnv, 'python_surface.json');
    if (fs.existsSync(candidate)) return candidate;
  }
  const sibling = path.resolve(repoRoot, '..', 'porting-sdk', 'python_surface.json');
  if (fs.existsSync(sibling)) return sibling;
  const home = process.env['HOME'] ?? '';
  if (home) {
    const src = path.join(home, 'src', 'porting-sdk', 'python_surface.json');
    if (fs.existsSync(src)) return src;
  }
  return sibling; // non-existent, will cause loadPythonReference to no-op.
}

function getGitSha(repoRoot: string): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'N/A';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const argv = process.argv.slice(2);
  const writeStdout = argv.includes('--stdout');
  const outputArgIdx = argv.indexOf('--output');
  const repoRoot = path.resolve(__dirname, '..');
  const outputPath = outputArgIdx >= 0
    ? path.resolve(argv[outputArgIdx + 1]!)
    : path.join(repoRoot, 'port_surface.json');

  const srcDir = path.join(repoRoot, 'src');
  const files = findSourceFiles(srcDir);

  const pythonSurfacePath = resolvePythonSurfacePath(repoRoot);
  const { classToModules, methodToOwners, pythonMethodsByOwner } = loadPythonReference(pythonSurfacePath);

  interface ModuleEntry {
    classes: Record<string, string[]>;
    functions: string[];
  }
  const modules: Record<string, ModuleEntry> = {};

  // First pass: collect every file's raw classes so we can resolve
  // `extends` chains across files before emitting.
  interface RawClass {
    fileRel: string;
    name: string;
    methods: string[];
    extendsName?: string;
  }
  const rawClasses: RawClass[] = [];
  const rawFunctions: Array<{ fileRel: string; fns: string[] }> = [];
  for (const abs of files) {
    const rel = path.relative(repoRoot, abs).replace(/\\/g, '/');
    const fs2 = enumerateFile(abs);
    for (const c of fs2.classes) {
      rawClasses.push({ fileRel: rel, name: c.name, methods: c.methods, extendsName: c.extendsName });
    }
    if (fs2.functions.length > 0) rawFunctions.push({ fileRel: rel, fns: fs2.functions });
  }

  // Build a name → methods map for inheritance lookups (TS-class-name keyed).
  const classMethods = new Map<string, Set<string>>();
  for (const c of rawClasses) {
    const cleanName = c.name.startsWith('__NS__')
      ? c.name.split('__').pop()!
      : c.name;
    if (!classMethods.has(cleanName)) classMethods.set(cleanName, new Set());
    for (const m of c.methods) classMethods.get(cleanName)!.add(m);
  }

  function resolveInherited(name: string, seen = new Set<string>()): Set<string> {
    if (seen.has(name)) return new Set();
    seen.add(name);
    const own = classMethods.get(name) ?? new Set();
    const full = new Set(own);
    // Find my own record(s) to get extendsName
    for (const c of rawClasses) {
      const cleanName = c.name.startsWith('__NS__') ? c.name.split('__').pop()! : c.name;
      if (cleanName === name && c.extendsName) {
        for (const m of resolveInherited(c.extendsName, seen)) full.add(m);
      }
    }
    return full;
  }

  // Expand every class's method list to include inherited ones, but only
  // the ones that Python's equivalent class declares. Python enumerates
  // only *declared* methods per class, so if TS inherits a method from a
  // base class we only want to emit it when Python's version of the same
  // class also explicitly declares it — avoiding a flood of inherited
  // methods that wouldn't be in Python's surface anyway.
  for (const c of rawClasses) {
    const cleanName = c.name.startsWith('__NS__') ? c.name.split('__').pop()! : c.name;
    const emitName = CLASS_NAME_ALIASES[cleanName] ?? cleanName;
    const candidateMods = classToModules.get(emitName);
    const pythonSet = new Set<string>();
    if (candidateMods) {
      for (const m of candidateMods) {
        for (const meth of pythonMethodsByOwner.get(`${m}.${emitName}`) ?? []) {
          pythonSet.add(meth);
        }
      }
    }
    const inherited = resolveInherited(cleanName);
    // Apply skill aliases to the inherited set so the method names line up
    // against Python (e.g. `get_tools` → `register_tools`).
    const moduleGuess = pickModule(emitName, c.fileRel, classToModules);
    const skillCtx = moduleGuess === 'signalwire.core.skill_base' || moduleGuess.startsWith('signalwire.skills.');
    const toAlias = (m: string): string => {
      if (skillCtx && SKILL_METHOD_ALIASES[m]) return SKILL_METHOD_ALIASES[m]!;
      return m;
    };
    const inheritedFiltered = new Set<string>();
    for (const m of inherited) {
      const aliased = toAlias(m);
      if (pythonSet.has(aliased)) inheritedFiltered.add(m);
    }
    c.methods = Array.from(new Set([...c.methods, ...inheritedFiltered])).sort();
  }

  function ensureModule(mod: string): ModuleEntry {
    if (!modules[mod]) modules[mod] = { classes: {}, functions: [] };
    return modules[mod]!;
  }

  // Emit classes.
  for (const cls of rawClasses) {
    const rel = cls.fileRel;

    // Handle nested-namespace marker: "__NS__plugins__DeepgramSTT" → class
    // "DeepgramSTT" under `signalwire.livewire.plugins` when the file is
    // the livewire index.
    const nsMatch = cls.name.match(/^__NS__([A-Za-z0-9_]+)__(.+)$/);
    if (nsMatch) {
      const [, nsName, realName] = nsMatch;
      const mod = (rel === 'src/livewire/index.ts' && nsName === 'plugins')
        ? 'signalwire.livewire.plugins'
        : fallbackModuleName(rel) + '.' + nsName;
      const entry = ensureModule(mod);
      const existing = new Set(entry.classes[realName!] ?? []);
      for (const me of cls.methods) existing.add(me);
      entry.classes[realName!] = Array.from(existing).sort();
      continue;
    }

    // Apply class-name alias (e.g. SwaigFunction → SWAIGFunction).
    let emitName = CLASS_NAME_ALIASES[cls.name] ?? cls.name;
    const mod = pickModule(emitName, rel, classToModules);
    // Apply method-name aliases keyed on the final {module, class} pair.
    const methodAliases = METHOD_NAME_ALIASES[`${mod}.${emitName}`];
    let emitMethods = cls.methods;
    if (methodAliases) {
      emitMethods = emitMethods.map((m) => methodAliases[m] ?? m);
    }
    if (mod === 'signalwire.core.skill_base' || mod.startsWith('signalwire.skills.')) {
      emitMethods = emitMethods.map((m) => SKILL_METHOD_ALIASES[m] ?? m);
    }

    if (emitName === 'AgentBase' && mod === 'signalwire.core.agent_base') {
      const keepOnAgentBase = new Set<string>(['__init__']);
      const pythonAgentBaseMethods = new Set<string>();
      for (const [m, owners] of methodToOwners.entries()) {
        for (const o of owners) {
          if (o.mod === 'signalwire.core.agent_base' && o.cls === 'AgentBase') {
            pythonAgentBaseMethods.add(m);
          }
        }
      }
      for (const m of emitMethods) {
        if (m === '__init__') continue;
        const owners = methodToOwners.get(m);
        if (!owners) {
          keepOnAgentBase.add(m);
          continue;
        }
        let foldedSomewhere = false;
        for (const { mod: ownerMod, cls: ownerCls } of owners) {
          if (!ownerMod.includes('.mixins.') && !ownerMod.startsWith('signalwire.core.agent.')) continue;
          const subEntry = ensureModule(ownerMod);
          const subExisting = new Set(subEntry.classes[ownerCls] ?? []);
          subExisting.add(m);
          subEntry.classes[ownerCls] = Array.from(subExisting).sort();
          foldedSomewhere = true;
        }
        if (pythonAgentBaseMethods.has(m)) keepOnAgentBase.add(m);
        if (!foldedSomewhere && !pythonAgentBaseMethods.has(m)) keepOnAgentBase.add(m);
      }
      const entry = ensureModule(mod);
      const existing = new Set(entry.classes[emitName] ?? []);
      for (const me of keepOnAgentBase) existing.add(me);
      entry.classes[emitName] = Array.from(existing).sort();
    } else {
      const entry = ensureModule(mod);
      const existing = new Set(entry.classes[emitName] ?? []);
      for (const me of emitMethods) existing.add(me);
      entry.classes[emitName] = Array.from(existing).sort();
    }
  }

  // Emit functions.
  for (const f of rawFunctions) {
    const mod = pickModuleForFunction(f.fileRel);
    const aliases = FUNCTION_NAME_ALIASES[mod] ?? {};
    const entry = ensureModule(mod);
    const existing = new Set(entry.functions);
    for (const fn of f.fns) existing.add(aliases[fn] ?? fn);
    entry.functions = Array.from(existing).sort();
  }

  // Post-process: Python enumerator only emits `__init__` when the class
  // body explicitly defines `def __init__`. TS classes always have a
  // constructor (implicit or explicit). Normalize to Python's behavior:
  //   * If Python has the class AND defines `__init__`, keep it in TS.
  //   * If Python has the class AND doesn't define `__init__`, strip it
  //     from TS (constructor is implicit both sides).
  //   * If Python doesn't have the class (port-only), leave as-is.
  //
  // Also: if Python has `__init__` but TS doesn't explicitly declare a
  // constructor, add it back — the class is constructible either way.
  for (const [mod, entry] of Object.entries(modules)) {
    for (const [cls, methods] of Object.entries(entry.classes)) {
      const key = `${mod}.${cls}`;
      const pythonMethods = pythonMethodsByOwner.get(key);
      if (!pythonMethods) continue; // port-only class — keep as-is.
      const current = new Set(methods);
      if (pythonMethods.has('__init__')) {
        current.add('__init__');
      } else {
        current.delete('__init__');
      }
      entry.classes[cls] = Array.from(current).sort();
    }
  }

  // Sort module keys for deterministic output.
  const sortedModules: Record<string, ModuleEntry> = {};
  for (const k of Object.keys(modules).sort()) sortedModules[k] = modules[k]!;

  const snapshot = {
    version: '1',
    generated_from: `signalwire-typescript @ ${getGitSha(repoRoot)}`,
    typescript_version: ts.version,
    modules: sortedModules,
  };

  const rendered = JSON.stringify(snapshot, null, 2) + '\n';

  if (writeStdout) {
    process.stdout.write(rendered);
  } else {
    fs.writeFileSync(outputPath, rendered, 'utf-8');
    process.stderr.write(`wrote ${outputPath}\n`);
  }
}

main();
