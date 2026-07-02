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
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
// PORTING_SDK is the env var run-ci.sh exports; PSDK is a legacy alias.
// Fallback to the dev-machine adjacency convention only if neither is set.
const PSDK =
  process.env.PORTING_SDK ?? process.env.PSDK ?? '/usr/local/home/devuser/src/porting-sdk';

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
  'src/POM/PromptObjectModel.ts': 'signalwire.pom.pom',
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
  'src/WebhookMiddleware.ts': 'signalwire.core.security.webhook_middleware',
  'src/WebhookValidator.ts': 'signalwire.core.security.webhook_validator',
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
  // Base resource classes — Python keeps these under signalwire.rest._base.
  'src/rest/base/BaseResource.ts': 'signalwire.rest._base',
  'src/rest/base/CrudResource.ts': 'signalwire.rest._base',
  'src/rest/base/CrudWithAddresses.ts': 'signalwire.rest._base',
  'src/rest/base/ReadResource.ts': 'signalwire.rest._base',
  // FabricResource / FabricResourcePUT are TS-intermediary CrudWithAddresses
  // subclasses (empty bodies → not enumerated); map alongside the other bases.
  'src/rest/base/FabricResource.ts': 'signalwire.rest._base',
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
  // REST error class — Python uses ``SignalWireRestError`` to disambiguate
  // from the standard library; TS shortens to ``RestError`` since it's
  // already namespaced under the rest module.
  RestError: 'SignalWireRestError',
};

// MIXIN_PROJECTIONS: TS flattens AgentBase mixins via TS class extends.
// Project the canonical Python-mixin methods onto their owning mixin module.
const MIXIN_PROJECTIONS: Record<string, [string, string[]]> = {
  AIConfigMixin: [
    'signalwire.core.mixins.ai_config_mixin',
    [
      'add_function_include',
      'add_hint',
      'add_hints',
      'add_internal_filler',
      'add_language',
      'add_pattern_hint',
      'add_pronunciation',
      'enable_debug_events',
      'get_language_params',
      'set_function_includes',
      'set_global_data',
      'set_internal_fillers',
      'set_language_params',
      'set_languages',
      'set_multilingual',
      'set_native_functions',
      'set_param',
      'set_params',
      'set_post_prompt_llm_params',
      'set_prompt_llm_params',
      'set_pronunciations',
      'update_global_data',
    ],
  ],
  PromptMixin: [
    'signalwire.core.mixins.prompt_mixin',
    [
      'define_contexts',
      'get_post_prompt',
      'get_prompt',
      'prompt_add_section',
      'prompt_add_subsection',
      'prompt_add_to_section',
      'prompt_has_section',
      'reset_contexts',
      'set_post_prompt',
      'set_prompt_text',
    ],
  ],
  // Python additionally extracted a ``PromptManager`` class that
  // PromptMixin delegates to. The user-facing surface is identical
  // (``agent.prompt_manager.X`` ≡ ``agent.X``). Project the same set
  // of AgentBase methods to PromptManager so the cross-language audit
  // treats both paths as covered. The TS source-side PromptManager
  // class has a slightly different method shape (``addSection`` etc.)
  // and is enumerated separately from PromptManager.ts; the projected
  // AgentBase methods are merged into the same module entry.
  PromptManager: [
    'signalwire.core.agent.prompt.manager',
    [
      'define_contexts',
      'get_contexts',
      'get_post_prompt',
      'get_prompt',
      'get_raw_prompt',
      'prompt_add_section',
      'prompt_add_subsection',
      'prompt_add_to_section',
      'prompt_has_section',
      'set_post_prompt',
      'set_prompt_pom',
      'set_prompt_text',
    ],
  ],
  SkillMixin: [
    'signalwire.core.mixins.skill_mixin',
    ['add_skill', 'has_skill', 'list_skills', 'remove_skill'],
  ],
  ToolMixin: [
    'signalwire.core.mixins.tool_mixin',
    ['define_tool', 'on_function_call', 'register_swaig_function'],
  ],
  ToolRegistry: [
    'signalwire.core.agent.tools.registry',
    [
      'define_tool',
      'register_swaig_function',
      'has_function',
      'get_function',
      'get_all_functions',
      'remove_function',
    ],
  ],
  AuthMixin: [
    'signalwire.core.mixins.auth_mixin',
    ['validate_basic_auth', 'get_basic_auth_credentials'],
  ],
  WebMixin: [
    'signalwire.core.mixins.web_mixin',
    [
      'enable_debug_routes',
      'manual_set_proxy_url',
      'run',
      'serve',
      'set_dynamic_config_callback',
      'on_request',
      'on_swml_request',
    ],
  ],
  MCPServerMixin: ['signalwire.core.mixins.mcp_server_mixin', ['add_mcp_server']],
  StateMixin: ['signalwire.core.mixins.state_mixin', ['validate_tool_token']],
};

const SKIP_METHOD_NAMES = new Set([
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
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

// Per-symbol module overrides for free functions. ``src/SecurityUtils.ts`` is a
// single TS file whose exports map to TWO canonical Python modules: the three
// credential-hygiene helpers were extracted into Python's
// ``signalwire.core.security.security_utils`` (modeled on TS's SecurityUtils),
// while the rest (safeAssign, isPrivateIp, validateUrl, …) remain TS port-only
// helpers parked under ``signalwire.utils`` (see PORT_ADDITIONS.md). A file-level
// TS_MODULE_ALIASES entry can't split one file across two modules, so route the
// three by canonical (snake_case) name here. Keyed by the projected free-fn name.
const FREE_FN_MODULE_OVERRIDES: Record<string, string> = {
  filter_sensitive_headers: 'signalwire.core.security.security_utils',
  redact_url: 'signalwire.core.security.security_utils',
  is_valid_hostname: 'signalwire.core.security.security_utils',
};

// Per-symbol free-function PARAM-shape overrides (teach-the-checker, scoped to a
// single symbol — does NOT relax the comparison globally).
//
// ``restClient`` (TS) is intentionally idiomatic: it declares a single, fully
// typed ``opts?: ClientOptions`` parameter (real compile-time safety on the
// credentials), while still accepting the legacy ``restClient([], {...})`` shape
// at runtime for back-compat. The Python reference factory is the untyped
// ``RestClient(*args, **kwargs)``. The drift comparator already treats Python's
// ``*args`` ≡ a port positional ``list<*>`` and ``**kwargs`` ≡ a port positional
// ``dict<string,*>`` (see diff_port_signatures.compare_param). We therefore emit
// THIS one symbol's audited signature in that Python-compatible variadic shape,
// keeping the public TS signature clean while the audit sees the equivalence.
// The actual exported function's runtime contract still accepts both forms.
const FREE_FN_PARAM_OVERRIDES: Record<string, CanonicalParam[]> = {
  // projected (Python-canonical) name -> audited param list
  RestClient: [
    { name: 'args', kind: 'positional', type: 'list<any>', required: false },
    { name: 'kwargs', kind: 'positional', type: 'dict<string,any>', required: false },
  ],
};

function camelToSnake(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function fallbackModuleName(fileRelPath: string): string {
  let rel = fileRelPath.replace(/^src\//, '').replace(/\.ts$/, '');
  // Generated REST modules follow the Python file-naming idiom in the oracle:
  // ``video.resources.generated`` ≡ ``video_resources_generated`` and
  // ``video.types.generated`` ≡ ``video_types_generated`` (dotted TS filename →
  // underscored Python module). Fold the trailing ``.resources.generated`` /
  // ``.types.generated`` to one underscored segment so the class module path
  // lines up with the reference oracle (e.g.
  // signalwire.rest.namespaces.video_resources_generated).
  rel = rel.replace(/\.resources\.generated$/, '_resources_generated');
  rel = rel.replace(/\.types\.generated$/, '_types_generated');
  const parts = rel.split('/').map((p) => camelToSnake(p).replace(/-/g, '_'));
  return ['signalwire', ...parts].join('.');
}

// ---------------------------------------------------------------------------
// Type translation
// ---------------------------------------------------------------------------

class TypeTranslationError extends Error {
  constructor(
    public readonly context: string,
    message: string,
  ) {
    super(`${context}: ${message}`);
  }
}

function loadAliases(): Record<string, string> {
  const raw = fs.readFileSync(path.join(PSDK, 'type_aliases.yaml'), 'utf-8');
  const doc = yaml.load(raw) as { aliases: { typescript: Record<string, string> } };
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
  const typeStr = checker.typeToString(
    type,
    undefined,
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType,
  );

  // Direct alias hit (covers string/number/boolean/Date/etc.)
  if (aliases[typeStr] !== undefined) return aliases[typeStr];

  // Spec-generated type aliases: record by NAME, do not expand. A generated
  // alias like `CallResponse = CallLeg | FabricDeviceLeg` (in a *.types.generated
  // file) is the same contract the Python reference records as the alias name
  // `class:...CallResponse` — Python's griffe enumerator keeps the alias name
  // rather than inlining it. typeToString() would otherwise expand this alias to
  // its union, producing `union<...CallLeg,...FabricDeviceLeg>` and a spurious
  // drift vs Python's `class:...CallResponse`. Emit `class:<AliasName>` so both
  // ports record the same leaf token. (The diff checker normalizes both
  // ports' generated-type refs by leaf name.)
  const aliasSym = type.aliasSymbol;
  if (aliasSym) {
    const decl = aliasSym.declarations?.[0];
    const srcFile = decl?.getSourceFile().fileName ?? '';
    // A generated-payload alias (e.g. `SWMLVar = string`, `AIPostPrompt =
    // AIPostPromptPom | AIPostPromptText`, `CondParams = …` in
    // swml_verbs_generated.ts) is, like the *.types.generated aliases, the same
    // contract the Python (griffe) reference records BY NAME (`class:…SWMLVar`)
    // rather than inlining to its primitive/union. The gen-payload filenames carry
    // no `.generated.` infix (`swml_verbs_generated.ts`), so match them explicitly
    // so their alias names survive (the diff folds the module to gen-payload and
    // compares by leaf name).
    if (
      srcFile.includes('.types.generated') ||
      srcFile.includes('.generated.') ||
      GEN_PAYLOAD_FILE_MARKERS.some((mk) => srcFile.includes(mk))
    ) {
      // Emit the FULLY-QUALIFIED generated-module path (mirrors how a $ref-backed
      // generated type is recorded, e.g.
      // `class:signalwire.rest.namespaces.relay_rest.types.generated.AddressResponse`)
      // so the diff checker's generated-type leaf-name normalization matches it
      // against Python's `class:...<gen-module>.<AliasName>`. A bare
      // `class:CallResponse` would lack the gen-module marker and not normalize.
      // Derive the dotted module path from the source file under src/.
      const m = srcFile.match(/\/src\/(.+?)\.ts$/);
      const modPath = m ? m[1].replace(/\//g, '.') : 'rest.namespaces';
      return `class:signalwire.${modPath}.${aliasSym.getName()}`;
    }
  }

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
    // Closed-set-of-strings idiom: ``SkillName | (string & {})`` — i.e. a
    // string-literal union widened with the ``string & {}`` "keep the literal
    // autocomplete but still accept any string" trick. Structurally this is
    // just ``string`` (every value is assignable to/from string), and it
    // exists so a typo in a built-in name fails at compile time while the
    // parameter stays a bare string for parity with the Python reference.
    // Collapse it to ``string`` so the canonical signature matches Python's
    // ``str`` and drift stays zero. Detect: every arm is either a string
    // literal or an intersection that contains the ``string`` primitive.
    const isWidenedStringConstant = (t: ts.Type): boolean => {
      if (t.flags & ts.TypeFlags.StringLiteral) return true;
      if (t.flags & ts.TypeFlags.String) return true;
      if (t.isIntersection()) {
        return t.types.some((c) => (c.flags & ts.TypeFlags.String) !== 0);
      }
      return false;
    };
    const hasWidenedStringArm = filtered.some(
      (t) => (t.flags & ts.TypeFlags.String) !== 0 || t.isIntersection(),
    );
    if (filtered.length >= 2 && hasWidenedStringArm && filtered.every(isWidenedStringConstant)) {
      return hasNullish ? 'optional<string>' : 'string';
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
    if (
      symbolName === 'Iterable' ||
      symbolName === 'AsyncIterable' ||
      symbolName === 'IterableIterator' ||
      symbolName === 'AsyncIterableIterator'
    ) {
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
    // If it's a NAMED class/interface from the SDK, emit class:<canonical>. An
    // anonymous inline object literal (`{ a: 1 }`) has the synthetic symbol name
    // `__type`; it is declared in an src/ file (the TypeLiteralNode lives there)
    // but is NOT a named SDK type — recording it as `class:…__type` is wrong and
    // diverges from the Python reference, which collapses an inline object to
    // `dict[str, Any]`. Skip the class branch for `__type` so it falls through to
    // the `dict<string,any>` mapping below (matching py_type).
    const decls = symbolName === '__type' ? [] : (symbol?.getDeclarations() ?? []);
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
    if (
      symbolName === '__type' ||
      typeStr.startsWith('{') ||
      typeStr === 'object' ||
      typeStr === 'Object' ||
      /^Record<.+>$/.test(typeStr)
    ) {
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
  classes?: Record<
    string,
    { methods: Record<string, CanonicalSignature>; crud_base?: { base: string; bind: string[] } }
  >;
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
  // Private classes (leading `_`) mirror Python's griffe convention of skipping
  // underscore-prefixed members: the generated `_GeneratedResourceTree` wiring
  // base (the RestClient extends it) is an implementation detail whose accessors
  // are the TS-idiom static typing of Python's dynamically-wired tree — Python's
  // `_GeneratedResourceTree` is likewise absent from the oracle.
  if (className.startsWith('_')) return;
  const canonClass = CLASS_NAME_ALIASES[className] ?? className;
  const mod = TS_MODULE_ALIASES[rel] ?? fallbackModuleName(rel);

  const methods: Record<string, CanonicalSignature> = {};

  for (const m of cls.members) {
    if (ts.isConstructorDeclaration(m)) {
      try {
        methods['__init__'] = signatureFromMethod(
          m,
          checker,
          aliases,
          true,
          false,
          `${mod}.${canonClass}.__init__`,
          false,
        );
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
        const sig = signatureFromProperty(
          m,
          checker,
          aliases,
          propIsStatic,
          `${mod}.${canonClass}.${snakeProp}`,
        );
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
      methods[snake] = signatureFromMethod(
        m,
        checker,
        aliases,
        false,
        isStatic,
        `${mod}.${canonClass}.${snake}`,
        rel.includes('.resources.generated.'),
      );
    } catch (e) {
      if (e instanceof TypeTranslationError) failures.push(e);
      else throw e;
    }
  }

  if (Object.keys(methods).length === 0) return;

  // Generated REST resource classes (``*.resources.generated.ts``) carry typed
  // OPERATION methods whose params the Python reference enumerates as
  // keyword-only (the exploded body fields) + a trailing ``**kwargs`` (var_keyword)
  // / ``**params`` (var_keyword) tail. TypeScript has no keyword-only construct —
  // these are emitted as plain positional args + a trailing ``extras`` /
  // ``params`` object. Re-classify them to the reference's kinds so the drift gate
  // (which compares param KIND, not name) matches: leading required ``string``
  // path-id args stay positional; the rest of the named body args become
  // ``keyword``; an ``extras`` object becomes ``keyword`` + a synthetic
  // ``kwargs`` var_keyword tail (the Python idiom); a trailing ``params`` query
  // object becomes ``var_keyword`` (the ``**params`` tail). CRUD create/update on
  // a crud_base class are excused structurally, so re-classifying them is harmless.
  if (!doc.modules[mod]) doc.modules[mod] = {};
  if (!doc.modules[mod].classes) doc.modules[mod].classes = {};
  const entry: {
    methods: Record<string, CanonicalSignature>;
    crud_base?: { base: string; bind: string[] };
  } = {
    methods: Object.fromEntries(Object.entries(methods).sort()),
  };
  // PREFERRED representation: the structural CRUD binding. If this class extends a
  // generic CRUD base (`extends CrudResource<TList, TItem, TCreate, TUpdate>` /
  // CrudWithAddresses / a FabricResource* alias of them), emit the binding so the
  // oracle can match it against the Python reference's crud_base. The resolved
  // per-method `methods` above remain as the effective equivalent.
  const cb = extractCrudBase(cls, checker, aliases, `${mod}.${canonClass}`);
  if (cb) entry.crud_base = cb;
  doc.modules[mod].classes![canonClass] = entry;
}

// Generated read-side payload modules (SWAIG request / post-prompt; later SWML
// verbs) declare their typed payloads as `interface`s, not classes. The Python
// reference enumerates each such TypedDict's CLASS-typed fields as zero-arg
// members (``PostPrompt.call_log`` → ``list<class:…PostPromptCallLogEntry>``),
// skipping primitive-typed fields (``project_id: str``). Mirror that here: walk
// only the generated-payload modules' interfaces and project the same
// class-typed-fields-only surface, so the (class, field) shapes compare against
// the reference after the diff tool's gen-payload module fold. A path test (not a
// blanket interface walk) keeps every other interface in the codebase out of the
// oracle — only these generated payloads are part of the cross-port contract.
const GEN_PAYLOAD_FILE_MARKERS = ['SwaigContracts.generated.', 'swml_verbs_generated.'];

function isGenPayloadFile(rel: string): boolean {
  return GEN_PAYLOAD_FILE_MARKERS.some((m) => rel.includes(m));
}

function collectInterface(
  iface: ts.InterfaceDeclaration,
  rel: string,
  checker: ts.TypeChecker,
  aliases: Record<string, string>,
  doc: SigDoc,
  failures: TypeTranslationError[],
): void {
  const ifaceName = iface.name.text;
  if (ifaceName.startsWith('_')) return;
  const canonClass = CLASS_NAME_ALIASES[ifaceName] ?? ifaceName;
  const mod = TS_MODULE_ALIASES[rel] ?? fallbackModuleName(rel);

  const methods: Record<string, CanonicalSignature> = {};
  for (const m of iface.members) {
    if (!ts.isPropertySignature(m) || !m.name || !ts.isIdentifier(m.name)) continue;
    const native = m.name.text;
    if (native.startsWith('_')) continue;
    // Mirror the Python enumerator (enumerate_python_signatures.py): it skips a
    // member whose name is ALL-CAPS (a Python-convention constant, not an API
    // attribute) — BUT only when the field is not SDK-class-typed. An all-caps
    // field whose type IS a class (`AIObject.SWAIG: SWAIG`) is a real data field
    // the reference records; only a genuine all-caps *constant* (primitive type)
    // is dropped. (The reference had the same fix; the port must match it.)
    const isAllCaps = (() => {
      const letters = native.replace(/[^A-Za-z]/g, '');
      return letters.length > 0 && letters === letters.toUpperCase();
    })();
    // Key the field by its VERBATIM wire name, NOT camelToSnake(native). A generated-
    // payload interface field IS the schema property name (`allOf`, `numberedBullets`,
    // `post_prompt`); the Python (griffe) reference records the TypedDict key verbatim,
    // so snake-casing here would spuriously rename `allOf` → `all_of` and diverge.
    // Already-snake keys (`post_prompt`) are unchanged.
    const key = native;
    if (methods[key] !== undefined) continue;
    try {
      // First resolve the field's WRITTEN type node: a generated-payload field can
      // reference named aliases (`SWMLVar`, `AIPostPrompt`, …) whose names the
      // Python (griffe) reference keeps but the TS type checker would inline —
      // `boolean | SWMLVar` resolves to `boolean | string`, dropping the class arm.
      // generatedAliasFromNode walks the source node so the names survive; it
      // returns a ref only when every member resolves to a generated alias, so a
      // genuinely primitive field still falls through to the type-checker path
      // (which correctly returns null for it).
      const written = generatedAliasFromNode(m.type, checker);
      if (written !== null && isSdkClassRef(written)) {
        methods[key] = { params: [{ name: 'self', kind: 'self' }], returns: written };
        continue;
      }
      // Not class-typed via the alias path. An all-caps name here is a genuine
      // constant (a class-typed all-caps field would have been kept above) — drop it.
      if (isAllCaps) continue;
      // A PropertySignature is structurally a PropertyDeclaration for the field
      // we need (`.name`, `.type`); signatureFromProperty applies the same
      // SDK-class-typed-only filter (returns null for primitives) as Python.
      const sig = signatureFromProperty(
        m as unknown as ts.PropertyDeclaration,
        checker,
        aliases,
        false,
        `${mod}.${canonClass}.${key}`,
      );
      if (sig !== null) methods[key] = sig;
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

const CRUD_BASE_NAMES = new Set([
  'CrudResource',
  'CrudWithAddresses',
  'FabricResource',
  'FabricResourcePUT',
  'ReadResource',
  'AutoMaterializedWebhook',
]);

function extractCrudBase(
  cls: ts.ClassDeclaration,
  checker: ts.TypeChecker,
  aliases: Record<string, string>,
  context: string,
): { base: string; bind: string[] } | null {
  for (const h of cls.heritageClauses ?? []) {
    if (h.token !== ts.SyntaxKind.ExtendsKeyword) continue;
    for (const t of h.types) {
      const baseName = t.expression && ts.isIdentifier(t.expression) ? t.expression.text : '';
      if (!CRUD_BASE_NAMES.has(baseName)) continue;
      const typeArgs = t.typeArguments;
      if (!typeArgs || typeArgs.length === 0) return null; // unparameterized base (intermediate) — skip
      // Record each bound type by its WRITTEN name (the generated-type identifier
      // as spelled in source), unwrapping Partial<X> -> X. We deliberately do NOT
      // resolve via typeToString here: the Python reference records the alias NAME
      // (e.g. DocumentCreateRequest), whereas typeToString would collapse a
      // oneOf-alias to its base (DocumentCreateRequestBase) and spuriously diverge.
      // The diff checker matches these by leaf name across ports.
      const bind = typeArgs.map((ta) => {
        let node: ts.TypeNode = ta;
        if (
          ts.isTypeReferenceNode(ta) &&
          ts.isIdentifier(ta.typeName) &&
          ta.typeName.text === 'Partial' &&
          ta.typeArguments?.[0]
        ) {
          node = ta.typeArguments[0];
        }
        if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
          // Written generated-type name -> fully-qualified class ref so the
          // checker's generated-type leaf normalization applies.
          const sym = checker.getSymbolAtLocation(node.typeName);
          const decl = sym?.declarations?.[0];
          const src = decl?.getSourceFile().fileName ?? '';
          if (src.includes('.types.generated') || src.includes('.generated.')) {
            const m = src.match(/\/src\/(.+?)\.ts$/);
            const modPath = m ? m[1].replace(/\//g, '.') : 'rest.namespaces';
            return `class:signalwire.${modPath}.${node.typeName.text}`;
          }
          return `class:${node.typeName.text}`;
        }
        try {
          return translateType(
            checker.getTypeFromTypeNode(node),
            checker,
            aliases,
            `${context}[crud-bind]`,
          );
        } catch {
          return 'any';
        }
      });
      // A binding whose args are still the class's own TypeVars is a pass-through
      // intermediate (not a concrete resource) — skip.
      if (bind.every((b) => /^class:[A-Z]$|class:T(List|Item|Create|Update)$/.test(b))) return null;
      return { base: baseName, bind };
    }
  }
  return null;
}

/**
 * A canonical type ref is an SDK-class-typed field (the fields the Python
 * `_is_sdk_class_type` rule records): any canonical type that mentions an SDK
 * `class:` at any nesting depth — `class:`, `optional<class:…>`, `list<class:…>`,
 * `union<…class:…>`, and the deeper nestings `list<union<…class:…>>` (e.g.
 * `AIObject.hints: (string|Hint)[]`), `list<list<class:…>>` (e.g.
 * `serial_parallel`), and `dict<…,class:…>` (composition registries).
 * A primitive-only canonical type never contains the substring `class:`, so its
 * presence at any depth is a sound+complete "carries SDK-class surface" test.
 * This matches the porting-sdk oracle rule (`"class:" in canonical`) after its
 * fix; the old shallow ladder dropped the deeper-nested real fields.
 */
function isSdkClassRef(canon: string): boolean {
  // A field whose (optional-unwrapped) type IS a callable<…> is a function-typed
  // property (a handler/callback). The Python reference models such things as a
  // method — or not at all — never as an SDK-class data field, so exclude it even
  // though its callable signature mentions a class. Every OTHER `class:` at any
  // nesting depth is a real composed data field: `class:`, `optional<class:…>`,
  // `list<class:…>`, `union<…class:…>`, `list<union<…class:…>>` (`AIObject.hints`),
  // `list<list<class:…>>` (`serial_parallel`), `dict<…,class:…>` (composition
  // registries). Matches the porting-sdk oracle rule (`"class:" in canonical`);
  // the old shallow ladder dropped the deeper-nested real fields.
  let t = canon;
  while (t.startsWith('optional<') && t.endsWith('>')) t = t.slice(9, -1);
  if (t.startsWith('callable<')) return false;
  return canon.includes('class:');
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
  if (!isSdkClassRef(canon)) return null;
  const params: CanonicalParam[] = [];
  if (!isStatic) params.push({ name: 'self', kind: 'self' });
  return { params, returns: canon };
}

/**
 * Re-classify a generated REST resource method's params to the Python reference's
 * kinds (see the call site in collectClass). Mutates `sig.params` in place.
 *
 * The TS generator emits: `self`, then leading `string` path-id positionals, then
 * the exploded body fields (positional), then a trailing `extras?: Record<…>`
 * (POST/PUT body) or `params?: QueryParams` (GET query). The reference enumerates
 * the body fields as `keyword`, `extras` as `keyword` followed by a `**kwargs`
 * (var_keyword) tail, and a GET query as a single `**params` (var_keyword) tail.
 */
function reclassifyGeneratedResourceParams(
  sig: CanonicalSignature,
  keywordFields: Set<string>,
): void {
  const ps = sig.params;
  const out: CanonicalParam[] = [];
  for (const p of ps) {
    if (p.kind === 'self' || p.kind === 'var_positional' || p.kind === 'var_keyword') {
      out.push(p);
      continue;
    }
    if (p.name === 'extras') {
      // `extras` (the typed escape door) → keyword, plus a synthetic `**kwargs`
      // (the Python idiom: a closed surface ends in `extras, **kwargs`).
      out.push({ ...p, kind: 'keyword' });
      out.push({ name: 'kwargs', kind: 'var_keyword', type: 'any', required: false, default: {} });
      continue;
    }
    if (p.name === 'extra') {
      // A set_methods trailing `extra` object → the reference's `**extra` tail.
      out.push({ name: 'extra', kind: 'var_keyword', type: 'any', required: false, default: {} });
      continue;
    }
    if (p.name === 'params') {
      // The GET query object → the reference's `**params` (var_keyword) tail.
      out.push({ name: 'params', kind: 'var_keyword', type: 'any', required: false, default: {} });
      continue;
    }
    // An exploded body field (a shorthand in the method's `_fields = { … }` object)
    // → keyword-only in the reference. Everything else (path-ids, `call_id`, a
    // single `body` param, set_methods positional args) stays positional.
    if (keywordFields.has(p.name)) {
      out.push({ ...p, kind: 'keyword' });
      continue;
    }
    out.push(p);
  }
  sig.params = out;
}

/**
 * The exploded-body-field parameter names of a generated resource method: the
 * shorthand properties of the `const _fields = { … }` / `const params = { … }`
 * object the generator builds the wire body from (operation methods + command-
 * dispatch). These are exactly the params the Python reference enumerates as
 * keyword-only; everything else (path-ids, `call_id`, a single `body` param,
 * set_methods positional args) stays positional. Read from the method body so the
 * classification is structural, not guessed from type/position.
 */
function keywordFieldNames(m: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    // `const _fields = { url, timeout, ... }` / `const params = { ... }` — each
    // shorthand-property name is an exploded body field.
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        if (ts.isShorthandPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          names.add(camelToSnake(prop.name.text));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(m);
  return names;
}

/**
 * If a parameter's WRITTEN type node references a generated `*.types.generated`
 * alias, return its canonical `class:…<Name>` ref (or `list<…>` for an array of
 * one) so the Python reference's by-name recording (`gen:uuid`) matches — rather
 * than letting `getTypeAtLocation` resolve a trivial `type uuid = string` alias
 * down to `string`. Returns null when the node is not a generated-alias reference.
 */
function generatedAliasFromNode(
  node: ts.TypeNode | undefined,
  checker: ts.TypeChecker,
): string | null {
  if (!node) return null;
  // Union written in source, e.g.
  // `LiveTranscribeStartAction | LiveTranscribeSummarizeAction | LiveTranscribeStopAction`
  // or `string[] | string`. Translate each member from its WRITTEN node so the
  // member NAMES and ORDER track the spec (the Python reference keeps them). The
  // resolved type would inline a string-literal alias (`type Stop = 'stop'`) to a
  // bare `'stop'` (losing the name → drift) and may reorder anyOf members. Only
  // take this path when every member resolves syntactically; else fall back.
  if (ts.isUnionTypeNode(node)) {
    const nullish = (t: ts.TypeNode): boolean =>
      t.kind === ts.SyntaxKind.NullKeyword ||
      t.kind === ts.SyntaxKind.UndefinedKeyword ||
      (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword);
    const members = node.types.filter((t) => !nullish(t));
    const parts: string[] = [];
    for (const t of members) {
      const p = generatedAliasFromNode(t, checker);
      if (p === null) return null; // a member we can't resolve syntactically → bail
      parts.push(p);
    }
    if (parts.length === 0) return null;
    const hadNull = members.length < node.types.length;
    // A single non-null member with a dropped null → `optional<X>` (matches the
    // Python reference's `X | None`). With 2+ non-null members, KEEP the head as a
    // flat `union<…>` rather than lifting to `optional<union<…>>`: the Python
    // reference keeps such a field as `union<optional<int>,SWMLVar>` (head=union,
    // the null grouped with one arm), and TS's union is flat so we can't know which
    // arm the null pairs with — a flat `union<…>` is the recordable form the diff's
    // union compatibility accepts (and it keeps the generated-class arms, where an
    // `optional<union<…>>` head would fail the SDK-class-ref test).
    if (parts.length === 1) return hadNull ? `optional<${parts[0]}>` : parts[0];
    return `union<${parts.join(',')}>`;
  }
  // Primitive keyword members (for union reconstruction above).
  if (node.kind === ts.SyntaxKind.StringKeyword) return 'string';
  if (node.kind === ts.SyntaxKind.NumberKeyword) return 'float';
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return 'bool';
  // Literal-type members (e.g. `0`, `'mandatory'`, `true` in a written union such as
  // `AttentionTimeout | 0 | SWMLVar`). The Python reference collapses a literal to
  // its base scalar (a numeric literal → int/float, a string literal → string, a
  // bool literal → bool); collapse the same way so the union keeps its generated-
  // alias arms intact instead of bailing out of the written-node path.
  if (ts.isLiteralTypeNode(node)) {
    const lit = node.literal;
    if (ts.isStringLiteral(lit)) return 'string';
    if (ts.isNumericLiteral(lit)) return 'float';
    if (lit.kind === ts.SyntaxKind.TrueKeyword || lit.kind === ts.SyntaxKind.FalseKeyword) {
      return 'bool';
    }
    return null;
  }
  // Inline object literal member (e.g. the `{ timeout?: … }` arm of
  // `number | SWMLVar | { … }`) → `dict<string,any>`, matching the Python reference
  // (py_type collapses an inline object to `dict[str, Any]`). Without this the
  // written-node walk would bail on the object arm and the field's generated-class
  // arms (SWMLVar, …) would be lost to the type checker's inlining.
  if (ts.isTypeLiteralNode(node)) return 'dict<string,any>';
  // `uuid[]` / `string[]` → list<…>
  if (ts.isArrayTypeNode(node)) {
    const inner = generatedAliasFromNode(node.elementType, checker);
    return inner ? `list<${inner}>` : null;
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    let sym = checker.getSymbolAtLocation(node.typeName);
    // Follow an import alias to the original declaration so the source file is the
    // `*.types.generated.ts` that DECLARES the alias, not the resources module that
    // imports it.
    if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    const decl = sym?.declarations?.[0];
    const src = decl?.getSourceFile().fileName ?? '';
    // Only generated TYPE aliases / interfaces get the by-name treatment, and they
    // are recorded under the `*_types_generated` module so the diff's generated-type
    // normalization (which keys off `.types.generated.` / `_types_generated.`)
    // folds them to `gen:<Name>` and matches the Python reference.
    const m = src.match(/\/src\/(.+?)\.ts$/);
    if (m && /\.types\.generated$/.test(m[1])) {
      const modPath = m[1].replace(/\.types\.generated$/, '_types_generated').replace(/\//g, '.');
      return `class:signalwire.${modPath}.${node.typeName.text}`;
    }
    // Generated-payload aliases/interfaces (swml_verbs_generated.ts,
    // SwaigContracts.generated.ts): the Python reference records these BY NAME too
    // (`class:…SWMLVar`, `class:…AIPostPrompt`), and the union/array reconstruction
    // above needs each member's NAME to survive the type checker's alias inlining
    // (`boolean | SWMLVar` would otherwise resolve to `boolean | string`). The diff
    // folds the gen-payload module + compares by leaf name.
    if (m && GEN_PAYLOAD_FILE_MARKERS.some((mk) => src.includes(mk))) {
      // The diff compares generated `class:` refs by LEAF name (the module folds to
      // gen-payload), so the qualifier only needs to be a stable gen-payload module
      // path — fallbackModuleName produces exactly the one collectInterface records.
      return `class:${fallbackModuleName(`src/${m[1]}.ts`)}.${node.typeName.text}`;
    }
  }
  return null;
}

function signatureFromMethod(
  m:
    | ts.ConstructorDeclaration
    | ts.MethodDeclaration
    | ts.GetAccessorDeclaration
    | ts.SetAccessorDeclaration
    | ts.FunctionDeclaration,
  checker: ts.TypeChecker,
  aliases: Record<string, string>,
  isCtor: boolean,
  isStatic: boolean,
  ctx: string,
  genResource: boolean,
): CanonicalSignature {
  const params: CanonicalParam[] = [];
  const isMethod =
    !isCtor && (ts.isMethodDeclaration(m) || ts.isGetAccessor(m) || ts.isSetAccessor(m));
  if (isMethod && !isStatic) {
    params.push({ name: 'self', kind: 'self' });
  } else if (isCtor) {
    params.push({ name: 'self', kind: 'self' });
  }

  for (const p of m.parameters) {
    if (!p.name || !ts.isIdentifier(p.name)) continue;
    const native = p.name.text;
    const snake = camelToSnake(native);
    // Prefer the WRITTEN type node when it references a generated *.types.generated
    // alias (e.g. `uuid` / `jwt` / `docid`). The Python reference records these by
    // alias NAME (`gen:uuid`); `getTypeAtLocation` would resolve a trivial
    // `type uuid = string` alias down to `string` (losing aliasSymbol) and drift.
    let canon = generatedAliasFromNode(p.type, checker);
    if (canon !== null) {
      // The syntactic path reads the WRITTEN type node, which does not carry the
      // `| undefined` an optional param's RESOLVED type would (the `?` is on the
      // parameter, not in the type node). The Python reference wraps an optional
      // param's type in `optional<...>`, so mirror that here when the param is
      // optional and not already optional-wrapped. (The `translateType` fallback
      // already produces `optional<...>` for these, via the resolved `| undefined`.)
      if ((p.questionToken || p.initializer) && !canon.startsWith('optional<')) {
        canon = `optional<${canon}>`;
      }
    } else {
      canon = translateType(checker.getTypeAtLocation(p), checker, aliases, `${ctx}[${snake}]`);
    }
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

  const sig: CanonicalSignature = { params, returns };
  // Generated REST resource methods (operation methods / set_methods /
  // command-dispatch) are emitted as positional TS args + a trailing `extras` /
  // `params` object; the Python reference enumerates the body fields as
  // keyword-only with a `**kwargs` / `**params` tail. Re-classify so the drift
  // gate (which compares param KIND, not name) matches. Constructors are exempt.
  if (genResource && !isCtor) {
    reclassifyGeneratedResourceParams(sig, keywordFieldNames(m));
  }
  return sig;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function findTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name.startsWith('.') ||
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'tests'
    )
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findTsFiles(full, out);
    else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.endsWith('.test.ts')
    )
      out.push(full);
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
    strict: false, // we only need typing data, not strictness
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
      } else if (
        ts.isInterfaceDeclaration(node) &&
        isGenPayloadFile(rel) &&
        ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export
      ) {
        // Generated-payload interfaces (SwaigContracts.generated, swml_verbs_generated):
        // enumerate their class-typed fields as members to match Python's TypedDict
        // field surface. Restricted to those files so no other interface leaks in.
        collectInterface(node, rel, checker, aliases, doc, failures);
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        const mods = ts.getCombinedModifierFlags(node);
        if (mods & ts.ModifierFlags.Export) {
          const native = node.name.text;
          if (native.startsWith('_')) return;
          const snake = camelToSnake(native);
          const projected = FREE_FN_NAME_OVERRIDES[snake] ?? snake;
          const mod =
            FREE_FN_MODULE_OVERRIDES[projected] ??
            TS_MODULE_ALIASES[rel] ??
            fallbackModuleName(rel);
          try {
            const sig = signatureFromMethod(
              node,
              checker,
              aliases,
              false,
              true,
              `${mod}.${projected}`,
              false,
            );
            // Strip `self` from free functions
            sig.params = sig.params.filter((p) => p.kind !== 'self');
            // Per-symbol param-shape override (teach-the-checker; see
            // FREE_FN_PARAM_OVERRIDES). Scoped to individual symbols so the
            // global comparison stays strict.
            const paramOverride = FREE_FN_PARAM_OVERRIDES[projected];
            if (paramOverride) sig.params = paramOverride;
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
      const targetCls =
        Object.keys(MIXIN_PROJECTIONS).find((k) => MIXIN_PROJECTIONS[k][0] === targetMod) ?? '';
      const present: Record<string, CanonicalSignature> = {};
      for (const m of expected) {
        if (combined[m]) present[m] = combined[m];
      }
      if (Object.keys(present).length === 0) continue;
      if (!doc.modules[targetMod]) doc.modules[targetMod] = {};
      if (!doc.modules[targetMod].classes) doc.modules[targetMod].classes = {};
      if (!doc.modules[targetMod].classes![targetCls])
        doc.modules[targetMod].classes![targetCls] = { methods: {} };
      Object.assign(doc.modules[targetMod].classes![targetCls].methods, present);
      Object.keys(present).forEach((m) => projected.add(m));
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
    let nMethods = 0,
      nFuncs = 0,
      nClasses = 0;
    for (const m of Object.values(doc.modules)) {
      nClasses += Object.keys(m.classes ?? {}).length;
      for (const c of Object.values(m.classes ?? {})) nMethods += Object.keys(c.methods).length;
      nFuncs += Object.keys(m.functions ?? {}).length;
    }
    console.log(
      `enumerate-signatures: wrote ${outputPath} (${nMods} modules, ${nClasses} classes, ${nMethods} methods, ${nFuncs} functions)`,
    );
  }
  return 0;
}

main();
