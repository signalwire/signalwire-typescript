#!/usr/bin/env node
/**
 * enumerate-signatures.ts — emit port_signatures.json for the TS SDK.
 *
 * Phase 4 of the cross-language signature audit. Uses TypeScript's
 * compiler API (ts.createProgram + TypeChecker) to extract every public
 * method's full signature — parameter names, types, optionality,
 * defaults, return types — from the SDK's source. Translates to the
 * canonical shape defined by porting-sdk/surface_schema_v2.json.
 *
 * Reuses the same name-translation logic as enumerate-surface.ts:
 *   - File path → Python canonical module path (TS_MODULE_ALIASES).
 *   - Class name aliases (CLASS_NAME_ALIASES) for SwaigFunction →
 *     SWAIGFunction, etc.
 *   - Method name aliases (METHOD_NAME_ALIASES) for AgentSession.userData →
 *     userdata, etc.
 *
 * Type translation goes via porting-sdk/type_aliases.yaml (typescript
 * section). Anything outside the canonical vocabulary triggers a loud
 * failure with file:line so the missing case becomes a documented
 * decision (extend vocabulary, add to type_aliases.yaml, or list in
 * PORT_SIGNATURE_OMISSIONS.md), never a silent fallback to `any`.
 *
 * Usage:
 *   npx tsx scripts/enumerate-signatures.ts            # writes port_signatures.json
 *   npx tsx scripts/enumerate-signatures.ts --strict   # fail on any unknown type
 *   npx tsx scripts/enumerate-signatures.ts --stdout
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import * as yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PSDK = process.env.PSDK ?? '/usr/local/home/devuser/src/porting-sdk';

// ---------------------------------------------------------------------------
// Translation tables — kept in sync with enumerate-surface.ts.
// (These could be lifted into a shared module; for v1 they're copied here
// because the existing enumerator is a 796-LOC monolith and a refactor
// would balloon the diff. Anything emitted as a Python-canonical name by
// either script must agree.)
// ---------------------------------------------------------------------------

const TS_MODULE_ALIASES: Record<string, string> = {
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
  'src/relay/Action.ts': 'signalwire.relay.call',
  'src/relay/Call.ts': 'signalwire.relay.call',
  'src/relay/Message.ts': 'signalwire.relay.message',
  'src/relay/RelayClient.ts': 'signalwire.relay.client',
  'src/relay/RelayError.ts': 'signalwire.relay.client',
  'src/relay/RelayEvent.ts': 'signalwire.relay.event',
  'src/rest/index.ts': 'signalwire.rest.client',
  'src/rest/HttpClient.ts': 'signalwire.rest._base',
  'src/rest/RestError.ts': 'signalwire.rest._base',
  'src/skills/SkillBase.ts': 'signalwire.core.skill_base',
  'src/skills/SkillManager.ts': 'signalwire.core.skill_manager',
  'src/skills/SkillRegistry.ts': 'signalwire.skills.registry',
  'src/prefabs/ConciergeAgent.ts': 'signalwire.prefabs.concierge',
  'src/prefabs/FAQBotAgent.ts': 'signalwire.prefabs.faq_bot',
  'src/prefabs/InfoGathererAgent.ts': 'signalwire.prefabs.info_gatherer',
  'src/prefabs/ReceptionistAgent.ts': 'signalwire.prefabs.receptionist',
  'src/prefabs/SurveyAgent.ts': 'signalwire.prefabs.survey',
  'src/livewire/index.ts': 'signalwire.livewire',
  // Top-level barrel: ``src/index.ts`` exposes Python's package-level
  // free functions (``add_skill_directory``, ``register_skill``, etc.) as
  // ``signalwire.<name>`` rather than ``signalwire.index.<name>``.
  'src/index.ts': 'signalwire',
  // Skill files: TS uses src/skills/builtin/<name>.ts; Python uses
  // signalwire.skills.<name>.skill. Map each explicitly.
  'src/skills/builtin/api_ninjas_trivia.ts': 'signalwire.skills.api_ninjas_trivia.skill',
  'src/skills/builtin/ask_claude.ts': 'signalwire.skills.ask_claude.skill',
  'src/skills/builtin/claude_skills.ts': 'signalwire.skills.claude_skills.skill',
  'src/skills/builtin/custom_skills.ts': 'signalwire.skills.custom_skills.skill',
  'src/skills/builtin/datasphere.ts': 'signalwire.skills.datasphere.skill',
  'src/skills/builtin/datasphere_serverless.ts': 'signalwire.skills.datasphere_serverless.skill',
  'src/skills/builtin/datetime.ts': 'signalwire.skills.datetime.skill',
  'src/skills/builtin/google_maps.ts': 'signalwire.skills.google_maps.skill',
  'src/skills/builtin/info_gatherer.ts': 'signalwire.skills.info_gatherer.skill',
  'src/skills/builtin/joke.ts': 'signalwire.skills.joke.skill',
  'src/skills/builtin/math.ts': 'signalwire.skills.math.skill',
  'src/skills/builtin/mcp_gateway.ts': 'signalwire.skills.mcp_gateway.skill',
  'src/skills/builtin/native_vector_search.ts': 'signalwire.skills.native_vector_search.skill',
  'src/skills/builtin/play_background_file.ts': 'signalwire.skills.play_background_file.skill',
  'src/skills/builtin/spider.ts': 'signalwire.skills.spider.skill',
  'src/skills/builtin/swml_transfer.ts': 'signalwire.skills.swml_transfer.skill',
  'src/skills/builtin/weather_api.ts': 'signalwire.skills.weather_api.skill',
  'src/skills/builtin/web_search.ts': 'signalwire.skills.web_search.skill',
  'src/skills/builtin/wikipedia_search.ts': 'signalwire.skills.wikipedia_search.skill',
};

const CLASS_NAME_ALIASES: Record<string, string> = {
  SwaigFunction: 'SWAIGFunction',
  SwmlBuilder: 'SWMLBuilder',
  // Skill class casing aligned with Python reference
  McpGatewaySkill: 'MCPGatewaySkill',
  SwmlTransferSkill: 'SWMLTransferSkill',
};

// MIXIN_PROJECTIONS: TS flattens AgentBase mixins via TS class extends.
// Project the canonical Python-mixin methods onto their owning mixin module.
const MIXIN_PROJECTIONS: Record<string, [string, string[]]> = {
  AIConfigMixin: ['signalwire.core.mixins.ai_config_mixin', [
    'add_function_include', 'add_hint', 'add_hints', 'add_internal_filler',
    'add_language', 'add_pattern_hint', 'add_pronunciation',
    'enable_debug_events',
    'set_function_includes', 'set_global_data', 'set_internal_fillers',
    'set_languages', 'set_native_functions', 'set_param', 'set_params',
    'set_post_prompt_llm_params', 'set_prompt_llm_params',
    'set_pronunciations', 'update_global_data',
  ]],
  PromptMixin: ['signalwire.core.mixins.prompt_mixin', [
    'define_contexts', 'get_post_prompt', 'get_prompt',
    'prompt_add_section',
    'prompt_add_subsection', 'prompt_add_to_section',
    'prompt_has_section', 'reset_contexts', 'set_post_prompt',
    'set_prompt_text',
  ]],
  // Python additionally extracted a ``PromptManager`` class that
  // PromptMixin delegates to. The user-facing surface is identical
  // (``agent.prompt_manager.X`` ≡ ``agent.X``). Project the same set
  // of AgentBase methods to PromptManager so the cross-language audit
  // treats both paths as covered. The TS source-side PromptManager
  // class has a slightly different method shape (``addSection`` etc.)
  // and is enumerated separately from PromptManager.ts; the projected
  // AgentBase methods are merged into the same module entry.
  PromptManager: ['signalwire.core.agent.prompt.manager', [
    'define_contexts', 'get_contexts', 'get_post_prompt', 'get_prompt',
    'get_raw_prompt',
    'prompt_add_section', 'prompt_add_subsection', 'prompt_add_to_section',
    'prompt_has_section', 'set_post_prompt', 'set_prompt_pom',
    'set_prompt_text',
  ]],
  SkillMixin: ['signalwire.core.mixins.skill_mixin', [
    'add_skill', 'has_skill', 'list_skills', 'remove_skill',
  ]],
  ToolMixin: ['signalwire.core.mixins.tool_mixin', [
    'define_tool', 'on_function_call', 'register_swaig_function',
  ]],
  ToolRegistry: ['signalwire.core.agent.tools.registry', [
    'define_tool', 'register_swaig_function',
    'has_function', 'get_function', 'get_all_functions', 'remove_function',
  ]],
  AuthMixin: ['signalwire.core.mixins.auth_mixin', [
    'validate_basic_auth', 'get_basic_auth_credentials',
  ]],
  WebMixin: ['signalwire.core.mixins.web_mixin', [
    'enable_debug_routes', 'manual_set_proxy_url', 'run', 'serve',
    'set_dynamic_config_callback', 'on_request', 'on_swml_request',
  ]],
  MCPServerMixin: ['signalwire.core.mixins.mcp_server_mixin', [
    'add_mcp_server',
  ]],
  StateMixin: ['signalwire.core.mixins.state_mixin', [
    'validate_tool_token',
  ]],
};

const SKIP_METHOD_NAMES = new Set([
  'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
  'propertyIsEnumerable', 'toLocaleString',
]);

// Free-function name overrides — for cases where the Python canonical
// name doesn't follow snake_case. Python's top-level
// ``signalwire.RestClient`` is a factory function but uses PascalCase
// (it mirrors the class name). The TS source side names the function
// ``restClient`` to avoid shadowing the class export; we project it
// onto the canonical Python name here.
const FREE_FN_NAME_OVERRIDES: Record<string, string> = {
  rest_client: 'RestClient',
};

function camelToSnake(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function fallbackModuleName(fileRelPath: string): string {
  let rel = fileRelPath.replace(/^src\//, '').replace(/\.ts$/, '');
  const parts = rel.split('/').map((p) => camelToSnake(p).replace(/-/g, '_'));
  return ['signalwire', ...parts].join('.');
}

// ---------------------------------------------------------------------------
// Type translation
// ---------------------------------------------------------------------------

class TypeTranslationError extends Error {
  constructor(public readonly context: string, message: string) {
    super(`${context}: ${message}`);
  }
}

function loadAliases(): Record<string, string> {
  const raw = fs.readFileSync(path.join(PSDK, 'type_aliases.yaml'), 'utf-8');
  const doc = yaml.parse(raw) as { aliases: { typescript: Record<string, string> } };
  return doc.aliases.typescript;
}

/**
 * Translate a TypeScript type to canonical form. Uses the TypeChecker's
 * resolved type so that imported aliases, generics, etc. are normalized.
 *
 * Strategy:
 *   1. Get a stable string from the TypeChecker.
 *   2. Look up directly in aliases.
 *   3. If parameterized (Array<T>, Map<K,V>, Promise<T>, ...), unwrap
 *      and recurse.
 *   4. If union with `null`/`undefined`, treat as optional<T>.
 *   5. If a class/interface from the SDK, emit class:<canonical>.
 *   6. Otherwise fail loud.
 */
function translateType(
  type: ts.Type,
  checker: ts.TypeChecker,
  aliases: Record<string, string>,
  context: string,
): string {
  // Stringify for alias lookup. Use TypeFormatFlags.NoTruncation to keep the
  // full string. typeToString() returns the source form.
  const typeStr = checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType);

  // Direct alias hit (covers string/number/boolean/Date/etc.)
  if (aliases[typeStr] !== undefined) return aliases[typeStr];

  // Stripped flags
  if (type.flags & ts.TypeFlags.String) return 'string';
  if (type.flags & ts.TypeFlags.Number) return 'float';
  if (type.flags & ts.TypeFlags.Boolean) return 'bool';
  if (type.flags & ts.TypeFlags.BigInt) return 'int';
  if (type.flags & ts.TypeFlags.Void) return 'void';
  if (type.flags & ts.TypeFlags.Undefined) return 'void';
  if (type.flags & ts.TypeFlags.Null) return 'void';
  if (type.flags & ts.TypeFlags.Any) return 'any';
  if (type.flags & ts.TypeFlags.Unknown) return 'any';
  if (type.flags & ts.TypeFlags.Never) return 'any';
  // String / number / boolean literal types (e.g. ``'debug' | 'info'``)
  if (type.flags & ts.TypeFlags.StringLiteral) return 'string';
  if (type.flags & ts.TypeFlags.NumberLiteral) return 'float';
  if (type.flags & ts.TypeFlags.BooleanLiteral) return 'bool';
  // Generic type parameter (T, U, ...). Python doesn't carry generic
  // type variables in signatures; resolve to `any`.
  if (type.flags & ts.TypeFlags.TypeParameter) return 'any';
  // ``this`` types — fluent-API returns. Resolve to a class reference for
  // the owning declaration.
  if ((type as any).flags & 0x100000000 || typeStr === 'this') {
    // Fall through to symbol-based class:<canonical> below.
  }

  // Union: T | null | undefined → optional<T>; multi-element non-nullable
  // unions → union<...>.
  if (type.isUnion()) {
    const filtered: ts.Type[] = [];
    let hasNullish = false;
    for (const t of type.types) {
      if (t.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined)) {
        hasNullish = true;
      } else {
        filtered.push(t);
      }
    }
    if (filtered.length === 0) return 'void';
    if (filtered.length === 1) {
      const inner = translateType(filtered[0], checker, aliases, context);
      return hasNullish ? `optional<${inner}>` : inner;
    }
    const parts = filtered.map((t) => translateType(t, checker, aliases, context));
    const u = `union<${parts.join(',')}>`;
    return hasNullish ? `optional<${u}>` : u;
  }

  // Array (T[] / Array<T>): TypeChecker exposes via getTypeArguments
  // when the type has an `arrayElementType`-like shape. Easiest:
  // consult the symbol or use the typeStr regex.
  const symbol = type.getSymbol();
  const symbolName = symbol ? symbol.getName() : '';

  // Generic instantiations: Array<T>, ReadonlyArray<T>, Map<K,V>,
  // Record<K,V>, Promise<T>, ReturnType<...>, etc.
  const typeArgs = (type as any).typeArguments as ts.Type[] | undefined;
  if (typeArgs && typeArgs.length > 0) {
    if (symbolName === 'Array' || symbolName === 'ReadonlyArray') {
      return `list<${translateType(typeArgs[0], checker, aliases, context)}>`;
    }
    if (symbolName === 'Map' || symbolName === 'ReadonlyMap') {
      const k = translateType(typeArgs[0], checker, aliases, context);
      const v = translateType(typeArgs[1], checker, aliases, context);
      return `dict<${k},${v}>`;
    }
    if (symbolName === 'Set' || symbolName === 'ReadonlySet') {
      return `list<${translateType(typeArgs[0], checker, aliases, context)}>`;
    }
    if (symbolName === 'Record') {
      const k = translateType(typeArgs[0], checker, aliases, context);
      const v = translateType(typeArgs[1], checker, aliases, context);
      return `dict<${k},${v}>`;
    }
    if (symbolName === 'Iterable' || symbolName === 'AsyncIterable' || symbolName === 'IterableIterator' || symbolName === 'AsyncIterableIterator') {
      return `list<${translateType(typeArgs[0], checker, aliases, context)}>`;
    }
    if (symbolName === 'Awaited') {
      return translateType(typeArgs[0], checker, aliases, context);
    }
    if (symbolName === 'Promise') {
      // Unwrap Promise<T> → T (matches Python async return convention).
      return translateType(typeArgs[0], checker, aliases, context);
    }
    if (symbolName === 'Partial' || symbolName === 'Required' || symbolName === 'Readonly') {
      return translateType(typeArgs[0], checker, aliases, context);
    }
  }

  // Tuple
  if (checker.isTupleType(type)) {
    const elements = (type as any).typeArguments as ts.Type[] | undefined;
    if (elements && elements.length > 0) {
      const parts = elements.map((t) => translateType(t, checker, aliases, context));
      return `tuple<${parts.join(',')}>`;
    }
  }

  // Function type: emit callable<list<args>,ret>
  const callSigs = type.getCallSignatures();
  if (callSigs.length > 0) {
    const sig = callSigs[0];
    const params = sig.getParameters().map((p) => {
      const pType = checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration ?? p.declarations![0]);
      return translateType(pType, checker, aliases, context);
    });
    const ret = translateType(sig.getReturnType(), checker, aliases, context);
    return `callable<list<${params.join(',')}>,${ret}>`;
  }

  // Object literal type / anonymous object: treat as dict<string,any>
  if (type.flags & ts.TypeFlags.Object) {
    // If it's a class/interface from the SDK, emit class:<canonical>
    const decls = symbol?.getDeclarations() ?? [];
    for (const d of decls) {
      const sf = d.getSourceFile();
      const rel = path.relative(REPO_ROOT, sf.fileName);
      if (rel.startsWith('src/')) {
        const mod = TS_MODULE_ALIASES[rel] ?? fallbackModuleName(rel);
        const cls = CLASS_NAME_ALIASES[symbolName] ?? symbolName;
        return `class:${mod}.${cls}`;
      }
    }
    // Anonymous record / Record<string,unknown> → dict<string,any>
    if (symbolName === '__type' || typeStr.startsWith('{') || typeStr === 'object' || typeStr === 'Object' || /^Record<.+>$/.test(typeStr)) {
      return 'dict<string,any>';
    }
  }
  // ``this`` type — fluent-API return. Symbol may not be set in a way the
  // visit above handles; fall through to typeStr lookup or class ref by
  // walking up to the enclosing class via the context.
  if (typeStr === 'this') {
    return 'any'; // best effort; caller's class context can be expressed via PORT_SIGNATURE_OMISSIONS
  }

  // Intersection types (A & B) — typically used for object-extension. Treat
  // as dict<string,any> since the canonical vocabulary doesn't have a
  // dedicated intersection form and the SDK uses these for "object with
  // extra fields" patterns (e.g. ``{ event?: string } & Record<string, unknown>``).
  if (type.isIntersection()) {
    return 'dict<string,any>';
  }

  // Final fallback by string lookup of the simplified name
  const last = typeStr.split('.').pop()?.split('<')[0];
  if (last && aliases[last] !== undefined) return aliases[last];
  // Symbol-name fallback (e.g. ``Hono`` resolves even when typeStr is the
  // full ``import("...")`` form).
  if (symbolName && aliases[symbolName] !== undefined) return aliases[symbolName];

  // node_modules-resolved third-party types: treat as `any`. The SDK can
  // type its public API in terms of an external dep (Hono, OpenAI, etc.)
  // and the canonical inventory sees them as opaque. PORT_SIGNATURE_OMISSIONS
  // documents specific divergences; this fallback covers the bulk.
  const decls = symbol?.getDeclarations() ?? [];
  for (const d of decls) {
    if (d.getSourceFile().fileName.includes('/node_modules/')) {
      return 'any';
    }
  }

  // Fail loud — this should be an SDK-defined type we can't translate.
  throw new TypeTranslationError(
    context,
    `unknown TS type '${typeStr}' (symbol=${symbolName}); add to porting-sdk/type_aliases.yaml under aliases.typescript or extend translateType`,
  );
}

// ---------------------------------------------------------------------------
// Walking
// ---------------------------------------------------------------------------

interface CanonicalParam {
  name: string;
  kind?: 'self' | 'positional' | 'keyword' | 'var_positional' | 'var_keyword';
  type?: string;
  required?: boolean;
  default?: unknown;
}

interface CanonicalSignature {
  params: CanonicalParam[];
  returns: string;
}

interface ModuleEntry {
  classes?: Record<string, { methods: Record<string, CanonicalSignature> }>;
  functions?: Record<string, CanonicalSignature>;
}

interface SigDoc {
  version: '2';
  generated_from: string;
  modules: Record<string, ModuleEntry>;
}

function inferParamKind(p: ts.ParameterDeclaration): CanonicalParam['kind'] {
  if (p.dotDotDotToken) return 'var_positional';
  return undefined; // default 'positional'; omit for compactness
}

function rawDefault(p: ts.ParameterDeclaration): unknown {
  if (!p.initializer) return undefined;
  const init = p.initializer;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isNumericLiteral(init)) {
    const n = Number(init.text);
    return Number.isInteger(n) ? n : n;
  }
  if (init.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (init.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (init.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(init) && init.elements.length === 0) return [];
  if (ts.isObjectLiteralExpression(init) && init.properties.length === 0) return {};
  return init.getText();
}

function collectClass(
  cls: ts.ClassDeclaration,
  rel: string,
  checker: ts.TypeChecker,
  aliases: Record<string, string>,
  doc: SigDoc,
  failures: TypeTranslationError[],
): void {
  if (!cls.name) return;
  const className = cls.name.text;
  const canonClass = CLASS_NAME_ALIASES[className] ?? className;
  const mod = TS_MODULE_ALIASES[rel] ?? fallbackModuleName(rel);

  const methods: Record<string, CanonicalSignature> = {};

  for (const m of cls.members) {
    if (ts.isConstructorDeclaration(m)) {
      try {
        methods['__init__'] = signatureFromMethod(m, checker, aliases, true, false, `${mod}.${canonClass}.__init__`);
      } catch (e) {
        if (e instanceof TypeTranslationError) failures.push(e);
        else throw e;
      }
      continue;
    }
    // Property declarations (e.g. `readonly fabric: FabricNamespace`)
    // mirror Python's instance-attribute composition pattern. Project as
    // zero-arg accessor methods iff the property's type is an SDK class
    // reference (skip primitive state). Matches Python adapter's
    // _is_sdk_class_type rule and Go adapter's field projection.
    if (ts.isPropertyDeclaration(m)) {
      if (!m.name || !ts.isIdentifier(m.name)) continue;
      const nativeProp = m.name.text;
      if (nativeProp.startsWith('_')) continue;
      const propMods = ts.getCombinedModifierFlags(m as ts.Declaration);
      if (propMods & ts.ModifierFlags.Private) continue;
      const propIsStatic = !!(propMods & ts.ModifierFlags.Static);
      const snakeProp = camelToSnake(nativeProp);
      if (methods[snakeProp] !== undefined) continue;
      try {
        const sig = signatureFromProperty(m, checker, aliases, propIsStatic, `${mod}.${canonClass}.${snakeProp}`);
        if (sig !== null) methods[snakeProp] = sig;
      } catch (e) {
        if (e instanceof TypeTranslationError) failures.push(e);
        else throw e;
      }
      continue;
    }
    if (!ts.isMethodDeclaration(m) && !ts.isGetAccessor(m) && !ts.isSetAccessor(m)) continue;
    if (!m.name || !ts.isIdentifier(m.name)) continue;
    const native = m.name.text;
    if (native.startsWith('_')) continue;
    if (SKIP_METHOD_NAMES.has(native)) continue;
    const mods = ts.getCombinedModifierFlags(m as ts.Declaration);
    if (mods & ts.ModifierFlags.Private) continue;
    const isStatic = !!(mods & ts.ModifierFlags.Static);

    const snake = camelToSnake(native);
    if (methods[snake] !== undefined) continue; // already emitted (overload or get/set pair)

    try {
      methods[snake] = signatureFromMethod(m, checker, aliases, false, isStatic, `${mod}.${canonClass}.${snake}`);
    } catch (e) {
      if (e instanceof TypeTranslationError) failures.push(e);
      else throw e;
    }
  }

  if (Object.keys(methods).length === 0) return;
  if (!doc.modules[mod]) doc.modules[mod] = {};
  if (!doc.modules[mod].classes) doc.modules[mod].classes = {};
  doc.modules[mod].classes![canonClass] = {
    methods: Object.fromEntries(Object.entries(methods).sort()),
  };
}

function signatureFromProperty(
  m: ts.PropertyDeclaration,
  checker: ts.TypeChecker,
  aliases: Record<string, string>,
  isStatic: boolean,
  ctx: string,
): CanonicalSignature | null {
  let propType: ts.Type;
  if (m.type) {
    propType = checker.getTypeFromTypeNode(m.type);
  } else {
    propType = checker.getTypeAtLocation(m);
  }
  const canon = translateType(propType, checker, aliases, ctx);
  // Only project SDK class references; primitive-typed state fields
  // are excluded (matches Python adapter's _is_sdk_class_type rule).
  const isSdkClass = canon.startsWith('class:') ||
    canon.startsWith('optional<class:') ||
    canon.startsWith('list<class:') ||
    (canon.startsWith('union<') && canon.includes('class:'));
  if (!isSdkClass) return null;
  const params: CanonicalParam[] = [];
  if (!isStatic) params.push({ name: 'self', kind: 'self' });
  return { params, returns: canon };
}

function signatureFromMethod(
  m: ts.ConstructorDeclaration | ts.MethodDeclaration | ts.GetAccessorDeclaration | ts.SetAccessorDeclaration | ts.FunctionDeclaration,
  checker: ts.TypeChecker,
  aliases: Record<string, string>,
  isCtor: boolean,
  isStatic: boolean,
  ctx: string,
): CanonicalSignature {
  const params: CanonicalParam[] = [];
  const isMethod = !isCtor && (ts.isMethodDeclaration(m) || ts.isGetAccessor(m) || ts.isSetAccessor(m));
  if (isMethod && !isStatic) {
    params.push({ name: 'self', kind: 'self' });
  } else if (isCtor) {
    params.push({ name: 'self', kind: 'self' });
  }

  for (const p of m.parameters) {
    if (!p.name || !ts.isIdentifier(p.name)) continue;
    const native = p.name.text;
    const snake = camelToSnake(native);
    const tsType = checker.getTypeAtLocation(p);
    const canon = translateType(tsType, checker, aliases, `${ctx}[${snake}]`);
    const param: CanonicalParam = { name: snake, type: canon };
    if (p.dotDotDotToken) param.kind = 'var_positional';
    if (p.questionToken || p.initializer) {
      param.required = false;
      if (p.initializer) {
        param.default = rawDefault(p);
      } else {
        param.default = null;
      }
    } else {
      param.required = true;
    }
    params.push(param);
  }

  let returns: string;
  if (isCtor) {
    returns = 'void';
  } else if (ts.isSetAccessor(m)) {
    returns = 'void';
  } else {
    let retType: ts.Type;
    if (m.type) {
      retType = checker.getTypeFromTypeNode(m.type);
    } else {
      const sig = checker.getSignatureFromDeclaration(m as ts.SignatureDeclaration);
      retType = sig ? sig.getReturnType() : checker.getAnyType();
    }
    returns = translateType(retType, checker, aliases, `${ctx}[->]`);
  }

  return { params, returns };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function findTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'tests') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findTsFiles(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

function main(): number {
  const args = process.argv.slice(2);
  const stdoutFlag = args.includes('--stdout');
  const strict = args.includes('--strict');
  const outIdx = args.indexOf('--out');
  const outputPath = outIdx >= 0 ? args[outIdx + 1] : path.join(REPO_ROOT, 'port_signatures.json');

  const aliases = loadAliases();
  const srcDir = path.join(REPO_ROOT, 'src');
  const files = findTsFiles(srcDir);

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: false,                  // we only need typing data, not strictness
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    allowJs: false,
    declaration: false,
    forceConsistentCasingInFileNames: true,
  };

  const program = ts.createProgram(files, compilerOptions);
  const checker = program.getTypeChecker();

  const doc: SigDoc = {
    version: '2',
    generated_from: 'signalwire-typescript via ts.TypeChecker',
    modules: {},
  };
  const failures: TypeTranslationError[] = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.fileName.includes('node_modules')) continue;
    const rel = path.relative(REPO_ROOT, sourceFile.fileName);
    if (!rel.startsWith('src/')) continue;

    ts.forEachChild(sourceFile, function visit(node) {
      if (ts.isClassDeclaration(node) && node.name) {
        const mods = ts.getCombinedModifierFlags(node);
        if (mods & ts.ModifierFlags.Export) {
          collectClass(node, rel, checker, aliases, doc, failures);
        }
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        const mods = ts.getCombinedModifierFlags(node);
        if (mods & ts.ModifierFlags.Export) {
          const native = node.name.text;
          if (native.startsWith('_')) return;
          const snake = camelToSnake(native);
          const projected = FREE_FN_NAME_OVERRIDES[snake] ?? snake;
          const mod = TS_MODULE_ALIASES[rel] ?? fallbackModuleName(rel);
          try {
            const sig = signatureFromMethod(node, checker, aliases, false, true, `${mod}.${projected}`);
            // Strip `self` from free functions
            sig.params = sig.params.filter((p) => p.kind !== 'self');
            if (!doc.modules[mod]) doc.modules[mod] = {};
            if (!doc.modules[mod].functions) doc.modules[mod].functions = {};
            doc.modules[mod].functions![projected] = sig;
          } catch (e) {
            if (e instanceof TypeTranslationError) failures.push(e);
            else throw e;
          }
        }
      }
      ts.forEachChild(node, visit);
    });
  }

  // Mixin projection: TS flattens AgentBase mixins onto AgentBase class.
  // Project the canonical Python-mixin methods onto their mixin module.
  // Methods may live on AgentBase OR on SWMLService (its parent), since
  // many tool/auth helpers are declared on SWMLService and inherited.
  const abEntry = doc.modules['signalwire.core.agent_base']?.classes?.AgentBase;
  const svcEntry = doc.modules['signalwire.core.swml_service']?.classes?.SWMLService;
  if (abEntry || svcEntry) {
    const abMethods = abEntry?.methods ?? {};
    const svcMethods = svcEntry?.methods ?? {};
    // AgentBase wins on conflict (it overrides SWMLService).
    const combined: Record<string, CanonicalSignature> = { ...svcMethods, ...abMethods };
    const projected = new Set<string>();
    for (const [, [targetMod, expected]] of Object.entries(MIXIN_PROJECTIONS)) {
      const targetCls = Object.keys(MIXIN_PROJECTIONS).find(k => MIXIN_PROJECTIONS[k][0] === targetMod) ?? '';
      const present: Record<string, CanonicalSignature> = {};
      for (const m of expected) {
        if (combined[m]) present[m] = combined[m];
      }
      if (Object.keys(present).length === 0) continue;
      if (!doc.modules[targetMod]) doc.modules[targetMod] = {};
      if (!doc.modules[targetMod].classes) doc.modules[targetMod].classes = {};
      if (!doc.modules[targetMod].classes![targetCls]) doc.modules[targetMod].classes![targetCls] = { methods: {} };
      Object.assign(doc.modules[targetMod].classes![targetCls].methods, present);
      Object.keys(present).forEach(m => projected.add(m));
    }
    // Drop projected methods only from AgentBase (SWMLService keeps its own).
    if (abEntry) {
      for (const m of projected) delete abEntry.methods[m];
      if (Object.keys(abEntry.methods).length === 0) {
        delete doc.modules['signalwire.core.agent_base'].classes!['AgentBase'];
        if (Object.keys(doc.modules['signalwire.core.agent_base'].classes ?? {}).length === 0) {
          delete doc.modules['signalwire.core.agent_base'];
        }
      }
    }
  }

  // Sort modules + functions deterministically
  const sortedModules: Record<string, ModuleEntry> = {};
  for (const k of Object.keys(doc.modules).sort()) {
    const m = doc.modules[k];
    const out: ModuleEntry = {};
    if (m.classes && Object.keys(m.classes).length > 0) {
      out.classes = Object.fromEntries(Object.entries(m.classes).sort());
    }
    if (m.functions && Object.keys(m.functions).length > 0) {
      out.functions = Object.fromEntries(Object.entries(m.functions).sort());
    }
    sortedModules[k] = out;
  }
  doc.modules = sortedModules;

  if (failures.length > 0) {
    console.error(`enumerate-signatures: ${failures.length} translation failure(s)`);
    for (const f of failures.slice(0, 30)) {
      console.error(`  - ${f.message}`);
    }
    if (failures.length > 30) console.error(`  ... (${failures.length - 30} more)`);
    if (strict) process.exit(1);
  }

  const rendered = JSON.stringify(doc, null, 2) + '\n';
  if (stdoutFlag) {
    process.stdout.write(rendered);
  } else {
    fs.writeFileSync(outputPath, rendered);
    const nMods = Object.keys(doc.modules).length;
    let nMethods = 0, nFuncs = 0, nClasses = 0;
    for (const m of Object.values(doc.modules)) {
      nClasses += Object.keys(m.classes ?? {}).length;
      for (const c of Object.values(m.classes ?? {})) nMethods += Object.keys(c.methods).length;
      nFuncs += Object.keys(m.functions ?? {}).length;
    }
    console.log(`enumerate-signatures: wrote ${outputPath} (${nMods} modules, ${nClasses} classes, ${nMethods} methods, ${nFuncs} functions)`);
  }
  return 0;
}

main();
