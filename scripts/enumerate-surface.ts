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
  // Generated REST modules follow the Python file-naming idiom in the oracle:
  // ``video.resources.generated`` ≡ ``video_resources_generated`` and
  // ``video.types.generated`` ≡ ``video_types_generated`` (dotted TS filename →
  // underscored Python module). Fold the trailing ``.resources.generated`` /
  // ``.types.generated`` to one underscored segment so the class module path
  // lines up with the reference oracle (mirrors enumerate-signatures.ts).
  rel = rel.replace(/\.resources\.generated$/, '_resources_generated');
  rel = rel.replace(/\.types\.generated$/, '_types_generated');
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
  pythonFunctionsByModule: Map<string, Set<string>>; // module → free-function names
} {
  if (!fs.existsSync(pythonSurfacePath)) {
    return {
      classToModules: new Map(),
      methodToOwners: new Map(),
      pythonModules: new Set(),
      pythonClasses: new Map(),
      pythonMethodsByOwner: new Map(),
      pythonFunctionsByModule: new Map(),
    };
  }
  const data: PythonSurface = JSON.parse(fs.readFileSync(pythonSurfacePath, 'utf-8'));
  const classToModules = new Map<string, string[]>();
  const methodToOwners = new Map<string, Array<{ mod: string; cls: string }>>();
  const pythonModules = new Set<string>();
  const pythonClasses = new Map<string, { mod: string; cls: string }[]>();
  const pythonMethodsByOwner = new Map<string, Set<string>>();
  const pythonFunctionsByModule = new Map<string, Set<string>>();
  for (const [mod, entry] of Object.entries(data.modules)) {
    pythonModules.add(mod);
    pythonFunctionsByModule.set(mod, new Set(entry.functions ?? []));
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
    pythonFunctionsByModule,
  };
}

/** Score how closely a Python module matches a TS file path. Higher = better.
 *  Used to disambiguate when one class name appears under multiple Python
 *  modules. */
function moduleMatchScore(pythonMod: string, tsFileRelPath: string): number {
  const fileSlug = camelToSnake(
    tsFileRelPath
      .replace(/^src\//, '')
      .replace(/\.ts$/, '')
      .split('/')
      .pop() ?? '',
  );
  const pyTail = pythonMod.split('.').pop() ?? '';
  if (pyTail === fileSlug) return 100;
  // Match by dir hint: "rest" in TS path → "rest" in Python module.
  const tsDirs = tsFileRelPath
    .replace(/^src\//, '')
    .split('/')
    .slice(0, -1);
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
  // AI Chat client — Python keeps AIChatClient + its errors + response models
  // in signalwire/ai_chat/client.py; the TS file is AIChatClient.ts, so map it
  // to the reference module ``signalwire.ai_chat.client`` (else it falls back
  // to ``signalwire.ai_chat.ai_chat_client``).
  'src/ai-chat/AIChatClient.ts': 'signalwire.ai_chat.client',
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
  // Generated payload modules: the reference emits these under `signalwire.core.*`
  // (python's `signalwire/core/<name>.py`); TS keeps them at `src/<name>.ts`, so
  // fold the module path to match (the surface analog of the signature diff's
  // gen-payload module fold). Their type names then compare 1:1 cross-port.
  'src/swml_verbs_generated.ts': 'signalwire.core.swml_verbs_generated',
  'src/SwaigActions.generated.ts': 'signalwire.core.swaig_actions_generated',
  // The SWML/SWAIG webhook payload types the reference generates under
  // `signalwire.rest.namespaces.swml_webhooks_types_generated`.
  'src/PlatformContracts.generated.ts': 'signalwire.rest.namespaces.swml_webhooks_types_generated',
  'src/TypeInference.ts': 'signalwire.core.agent.tools.type_inference',
  'src/WebhookMiddleware.ts': 'signalwire.core.security.webhook_middleware',
  'src/WebhookValidator.ts': 'signalwire.core.security.webhook_validator',
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
  // RequestOptions envelope (plan 4.2): the reference keeps it in its own
  // module `signalwire/rest/_request_options.py`; map the TS file to match so
  // RequestOptions + resolve/status_is_retryable compare 1:1 with the oracle.
  'src/rest/RequestOptions.ts': 'signalwire.rest._request_options',
  'src/rest/callHandler.ts': 'signalwire.rest.call_handler',
  'src/rest/pagination.ts': 'signalwire.rest._pagination',
  'src/rest/base/BaseResource.ts': 'signalwire.rest._base',
  'src/rest/base/CrudResource.ts': 'signalwire.rest._base',
  'src/rest/base/CrudWithAddresses.ts': 'signalwire.rest._base',
  'src/rest/base/ReadResource.ts': 'signalwire.rest._base',
  'src/rest/base/FabricResource.ts': 'signalwire.rest._base',
  // Skills
  'src/skills/SkillBase.ts': 'signalwire.core.skill_base',
  'src/skills/SkillManager.ts': 'signalwire.core.skill_manager',
  'src/skills/SkillRegistry.ts': 'signalwire.skills.registry',
  // Agents
  'src/agents/BedrockAgent.ts': 'signalwire.agents.bedrock',
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
  // Skill class casing aligned with the Python reference (camelCase initialism
  // in TS ↔ SCREAMING initialism in Python). Kept in sync with the signatures
  // enumerator's CLASS_NAME_ALIASES.
  //
  // McpGatewaySkill USED to be deliberately excluded here, on the premise that it
  // "belongs to the py-only mcp_gateway subsystem … handled separately via
  // PORT_OMISSIONS/PORT_ADDITIONS under its TS name". That premise was FALSE: this
  // port SHIPS the skill (`src/skills/builtin/mcp_gateway.ts:90`, an exported
  // `class McpGatewaySkill extends SkillBase`). Withholding the alias did not
  // record a real gap — it split ONE class across TWO spellings so that BOTH
  // ledgers excused it at once: 6 PORT_OMISSIONS entries under `MCPGatewaySkill`
  // ("intentionally not ported to any SDK") and 6 PORT_ADDITIONS entries under
  // `McpGatewaySkill` ("TS-specific skill helper method or class"), for the SAME
  // five members. A spelling difference is a RENAME (AGENT_RULES §5), never an
  // omission plus an addition, and neither rationale survived the source.
  McpGatewaySkill: 'MCPGatewaySkill',
  SwmlTransferSkill: 'SWMLTransferSkill',
  // Note: SWMLService, SWMLVerbHandler, AIVerbHandler keep their ALL-CAPS
  // spelling on both sides.
  // REST error class — Python uses ``SignalWireRestError`` to disambiguate
  // from the standard library; TS shortens to ``RestError`` since it's
  // already namespaced under the rest module.
  RestError: 'SignalWireRestError',
  // Same rationale as RestError above, for the transport-failure subclass.
  RestTransportError: 'SignalWireRestTransportError',
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
    add_skill: 'load_skill', // TS addSkill(SkillInstance) ~ Python load_skill
    remove_skill: 'unload_skill', // TS removeSkill(instanceId) ~ Python unload_skill
    list_skills: 'list_loaded_skills', // TS listSkills ~ Python list_loaded_skills
  },

  // Call: Python spells `pass_` (trailing underscore) because `pass` is a
  // reserved word; TS has no keyword clash and spells it `pass`. Same verb.
  'signalwire.relay.call.Call': { pass: 'pass_' },

  // Section: `numberedBullets` is a WIRE KEY, not a Python name — it round-trips
  // through the POM dict verbatim (reference `pom.py:345,361,371`), so the oracle
  // records the camelCase spelling as-is. The TS field is spelled identically in
  // source; `camelToSnake` at collection turns it into `numbered_bullets`, so undo
  // that here. Same member, same wire key. (Measured fleet-wide: only four
  // camelCase members exist in the whole oracle and all four are wire keys.)
  'signalwire.pom.pom.Section': { numbered_bullets: 'numberedBullets' },

  // AuthHandler: TS `readonly config: AuthConfig` is the reference's public
  // `self.security_config` (`core/auth_handler.py:63`) — one value object naming the
  // configured auth methods, passed whole at construction in both and readable back
  // in both. Pure spelling of the same slot; matches the signature enumerator's
  // CONSTRUCTION_PARAM_RENAMES entry for the same class.
  'signalwire.core.auth_handler.AuthHandler': { config: 'security_config' },

  // (SkillBase `config`→`params` is NOT a surface rename: SkillBase now ships a
  // public `params` GETTER returning the whole config map under the reference's own
  // spelling, so the member is collected verbatim by the accessor walk. The
  // signature enumerator still renames the CONSTRUCTION PARAM, where the TS ctor
  // argument really is spelled `config`.)

  // AIChatError / RelayError: the RAW, undecorated server message — the
  // reference's public `self.message` (ai_chat/client.py:68, relay/client.py:1332)
  // set alongside a DECORATED `super().__init__(f"[{code}] {message}")`. In JS the
  // `message` property is owned by `Error` and holds that decorated string, so the
  // undecorated value is stored under `serverMessage` and folded onto the
  // reference's `message` here. Same precedent as java's `getServerMessage()`.
  'signalwire.ai_chat.client.AIChatError': { server_message: 'message' },
  'signalwire.relay.client.RelayError': { server_message: 'message' },

  // SchemaUtils: TS idiom names map to the reference's spelling. The
  // capability is identical (schema verb introspection / document validation);
  // only the method name differs.
  'signalwire.utils.schema_utils.SchemaUtils': {
    get_verb_names: 'get_all_verb_names', // TS getVerbNames ~ Python get_all_verb_names
    validate: 'validate_document', // TS validate(doc) ~ Python validate_document
  },

  // (AgentServer `log` → `logger` rename REMOVED 2026-07-25: the reference no longer
  // records the per-instance `logger` accessor at all. Logging is a MODULE-LEVEL
  // capability — see PER_INSTANCE_LOGGER_MEMBERS below, which drops the port's mirror
  // so neither side carries it.)

  // WebService: TS exposes the SslConfig via an `ssl_config` accessor; the reference
  // names it `security`. Same exposed member, different name → rename.
  'signalwire.web.web_service.WebService': { ssl_config: 'security' },

  // SkillRegistry: TS singleton-style names map to Python methods.
  'signalwire.skills.registry.SkillRegistry': {
    register: 'register_skill', // TS register(cls) ~ Python register_skill
    add_search_path: 'add_skill_directory', // TS addSearchPath ~ Python add_skill_directory
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

/** MIXIN_PROJECTIONS — the SURFACE analog of enumerate-signatures.ts's table.
 *  TS folds Python's AgentBase mixins / the ToolRegistry into direct methods on
 *  AgentBase (or its parent SWMLService, which AgentBase inherits). Python
 *  factors the same capability onto separate mixin/registry classes. To make the
 *  surfaces compare EQUAL (idiom is never an omission), project the canonical
 *  method NAMES onto their Python-owning module+class when the TS AgentBase /
 *  SWMLService surface actually has them. The SOURCE member (possibly under a
 *  different TS-idiom name) is given in the value map: `pythonName -> tsSurfaceName`.
 *  A `null` tsSurfaceName means "no source member required" (the CLASS itself is
 *  the only symbol, e.g. an empty mixin class). Kept in lock-step with the
 *  signatures enumerator's MIXIN_PROJECTIONS. */
const MIXIN_PROJECTIONS: Record<
  string,
  { module: string; methods: Record<string, string | null> }
> = {
  // Python's tool registry: TS folds every accessor onto SWMLService (the tool
  // registry is a `toolRegistry` Map field on SWMLService). Same capability.
  ToolRegistry: {
    module: 'signalwire.core.agent.tools.registry',
    methods: {
      define_tool: 'define_tool',
      register_swaig_function: 'register_swaig_function',
      has_function: 'has_function',
      get_function: 'get_function',
      get_all_functions: 'get_all_functions',
      remove_function: 'remove_function',
    },
  },
  // Python's ToolMixin: the tool-definition/registration entrypoints TS puts on
  // SWMLService (inherited by AgentBase).
  ToolMixin: {
    module: 'signalwire.core.mixins.tool_mixin',
    methods: {
      define_tool: 'define_tool',
      register_swaig_function: 'register_swaig_function',
    },
  },
  // Python's MCPServerMixin is a class with no public methods (the MCP helpers
  // live on AgentBase in TS as get_mcp_servers/handle_mcp_request/…). The only
  // reference symbol is the bare class; surface it as an empty class.
  MCPServerMixin: {
    module: 'signalwire.core.mixins.mcp_server_mixin',
    methods: {},
  },
  // Python's ServerlessMixin.handle_serverless_request ≡ TS AgentBase.runServerless.
  ServerlessMixin: {
    module: 'signalwire.core.mixins.serverless_mixin',
    methods: { handle_serverless_request: 'run_serverless' },
  },
  // Python's PromptMixin.contexts (a property) ≡ TS AgentBase.getContexts().
  // (PromptMixin's other members already reconcile verbatim; only the property
  // spelling differs from TS's get_contexts.)
  PromptMixin: {
    module: 'signalwire.core.mixins.prompt_mixin',
    methods: { contexts: 'get_contexts' },
  },
};

/** Function-name aliases on a per-module basis. */
const FUNCTION_NAME_ALIASES: Record<string, Record<string, string>> = {
  // TS's `tool` is Python's `function_tool` (LiveKit compat shim).
  'signalwire.livewire': { tool: 'function_tool' },
};

/** ── Logging idiom fold (owner ruling 2026-07-24, ALLOWLIST_DISCIPLINE §8) ──────
 *
 *  "Logging is a MODULE-LEVEL capability that ports may reach however their
 *  language does." The contract is exactly the five free functions the reference
 *  records in `signalwire.core.logging_config`: get_logger, configure_logging,
 *  get_execution_mode, reset_logging_configuration, strip_control_chars.
 *
 *  TS reaches the SAME capability with a different SHAPE, so it folds at the
 *  emitter (§0: idiom is never an addition) rather than being ledgered:
 *
 *  1. The `Logger` CLASS is the object `get_logger(name)` RETURNS. Python's is
 *     structlog's `BoundLogger` — a third-party type the oracle does not enumerate
 *     as SDK surface. TS has no structlog, so the SDK must declare the returned
 *     type itself; `bind`/`debug`/`info`/`warn`/`error` are exactly structlog's
 *     bound-logger verbs. Same capability, port-owned return type → fold onto
 *     `get_logger` and drop the class.
 *
 *  2. `setGlobalLogLevel` / `setGlobalLogFormat` / `setGlobalLogColor` /
 *     `setGlobalLogStream` / `suppressAllLogs` are the individual setters for
 *     exactly the state Python's `configure_logging()` derives from the env vars
 *     SIGNALWIRE_LOG_MODE / _LEVEL / _FORMAT (verified: python
 *     logging_config.configure_logging reads those three and dispatches to
 *     _configure_off_mode / _configure_stderr_mode / _configure_default_mode;
 *     TS resetLoggingConfiguration reads the same three). This is the §7
 *     "one flagged method split into typed methods" row — the split exists
 *     because TS wants a programmatic knob per setting. Fold onto
 *     `configure_logging` and drop the setters.
 */
const LOGGING_CONFIG_MOD = 'signalwire.core.logging_config';

/** Port-only classes in `logging_config` that fold onto a reference free function.
 *  Keyed class → the reference function whose capability it expresses. */
const LOGGING_CLASS_FOLDS: Record<string, string> = { Logger: 'get_logger' };

/** Port-only free functions in `logging_config` that fold onto a reference free
 *  function. Keyed (snake_case) port name → reference function. */
const LOGGING_FUNCTION_FOLDS: Record<string, string> = {
  set_global_log_level: 'configure_logging',
  set_global_log_format: 'configure_logging',
  set_global_log_color: 'configure_logging',
  set_global_log_stream: 'configure_logging',
  suppress_all_logs: 'configure_logging',
};

/** Per-instance logger MEMBERS the port mirrors from Python's structlog idiom.
 *  The owner ruling (ALLOWLIST_DISCIPLINE §8, 2026-07-24) removed these from the
 *  reference as a marked, curated exclusion: the per-instance `logger`/`log`
 *  attribute is NOT contract on either side — it is Python's structlog idiom
 *  leaking into the enumerated surface. Drop the port's mirror symmetrically so
 *  neither ledger carries it. `${mod}.${Class}` → member names to drop.
 *
 *  Per-member GUARDED on the reference: a member is dropped only while the SURFACE
 *  oracle does not declare it. (The two oracles can disagree mid-rollout — measured
 *  2026-07-25, the signature oracle still recorded these five — so each enumerator
 *  guards on its OWN gate's authority; see loadReferenceSignatureIndex in
 *  enumerate-signatures.ts.) If the oracle records one again, the port keeps its
 *  copy and the gate resumes comparing them. */
const PER_INSTANCE_LOGGER_MEMBERS: Record<string, string[]> = {
  'signalwire.agent_server.AgentServer': ['logger', 'log'],
  'signalwire.core.skill_base.SkillBase': ['logger', 'log'],
  'signalwire.core.skill_manager.SkillManager': ['logger', 'log'],
  'signalwire.skills.registry.SkillRegistry': ['logger', 'log'],
  // NOTE deliberately NOT `signalwire.ai_chat.client.AIChatClient`. Despite the
  // name, `AIChatClient.log` is NOT a logger: it takes `conversation_id` and
  // returns `ChatLog` — chat-history retrieval, a real capability recorded by BOTH
  // oracles. The owner ruling covers the per-instance LOGGER attribute only. This
  // is why the porting-sdk exclusion keys on the return type + zero-arity rather
  // than the member NAME (see enumerate_python.py::_enrich_composition_attributes);
  // a name-keyed drop would delete the capability. Listing it here was inert only
  // because TS does not currently emit the member and the per-member guard
  // suppresses the drop while the oracle declares it — i.e. a latent trap that
  // would fire the moment TS implements `log()`. Removed 2026-07-25.
};

/** Per-symbol module overrides for free functions. ``src/SecurityUtils.ts`` is a
 *  single TS file whose exports map to TWO canonical Python modules: the three
 *  credential-hygiene helpers were extracted into Python's
 *  ``signalwire.core.security.security_utils`` (modeled on TS's SecurityUtils),
 *  while the rest (safeAssign, isPrivateIp, validateUrl, …) stay TS port-only
 *  helpers under ``signalwire.utils`` (see PORT_ADDITIONS.md). A file-level
 *  TS_MODULE_ALIASES entry can't split one file across two modules, so route the
 *  three by canonical (snake_case) name here. Keyed by the projected free-fn name.
 *  Kept in sync with enumerate-signatures.ts FREE_FN_MODULE_OVERRIDES. */
const FREE_FN_MODULE_OVERRIDES: Record<string, string> = {
  filter_sensitive_headers: 'signalwire.core.security.security_utils',
  redact_url: 'signalwire.core.security.security_utils',
  is_valid_hostname: 'signalwire.core.security.security_utils',
  // ``validateUrl`` lives in TS's SecurityUtils.ts (module ``signalwire.utils``)
  // but is the port of Python's ``signalwire.utils.url_validator.validate_url``.
  // Route it to that canonical module so it compares equal. (``resolve_and_validate_url``
  // stays in ``signalwire.utils`` — it is a TS-only helper; see PORT_ADDITIONS.)
  validate_url: 'signalwire.utils.url_validator',
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
  /** Public readonly/instance data FIELDS (PropertyDeclarations), snake_cased.
   *  Kept separate from `methods` because a field is only surfaced when the
   *  Python reference @dataclass declares it on the same class — otherwise it
   *  would flood the surface with port-internal struct members. */
  fields?: string[];
  /** Set on a PRIVATE (`_`-prefixed) class: its public composition property
   *  names, snake_cased. Such a class is not itself surface — it is skipped as
   *  an implementation detail, exactly as griffe skips Python's
   *  `_GeneratedResourceTree` — but the members it DECLARES are surface on
   *  whatever public class extends it. See `wiredBaseAccessors` below. */
  privateWiringFields?: string[];
}

interface FileSurface {
  classes: ClassInfo[];
  functions: string[];
}

/** Parse a source file and return, per exported `interface`, its public property
 *  member names (snake_cased). Used to surface @dataclass-style DTO fields the
 *  reference records for a TS interface (the class walk skips interfaces).
 *  Method signatures and index signatures are ignored — only data fields. */
function collectInterfaceFields(file: string): Map<string, Set<string>> {
  const text = fs.readFileSync(file, 'utf-8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
  const out = new Map<string, Set<string>>();
  ts.forEachChild(sf, (node) => {
    if (!ts.isInterfaceDeclaration(node)) return;
    const name = node.name.text;
    const fields = new Set<string>();
    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        const fName = member.name.text;
        if (!fName.startsWith('_')) fields.add(camelToSnake(fName));
      }
    }
    out.set(name, fields);
  });
  return out;
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
    // Private classes (leading `_`) mirror Python's griffe convention of skipping
    // underscore-prefixed members: the generated `_GeneratedResourceTree` wiring
    // base is an implementation detail (Python's `_GeneratedResourceTree` is
    // likewise absent from the reference surface).
    //
    // The CLASS is not surface — but the members it DECLARES are, on whatever
    // public class extends it. `RestClient extends _GeneratedResourceTree`, and
    // that base declares all 22 resource-tree accessors (`calling`, `fabric`,
    // `video`, every flat resource + namespace container). Returning outright
    // here recorded them nowhere, so the surface oracle could not see a single
    // one. Record them under `privateWiringFields` for the lifting pass; the
    // class itself is still never emitted. (Reachability verified at runtime by
    // tests/rest/resource_tree_mock.test.ts.)
    if (rawName.startsWith('_')) {
      const wiring: string[] = [];
      for (const member of node.members) {
        if (!ts.isPropertyDeclaration(member) || !member.name || !ts.isIdentifier(member.name)) {
          continue;
        }
        const fName = member.name.text;
        if (fName.startsWith('_')) continue;
        const mods = ts.getCombinedModifierFlags(member);
        // `private`/`protected` members are internal plumbing, not caller surface.
        if (mods & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) continue;
        wiring.push(camelToSnake(fName));
      }
      if (wiring.length > 0) {
        classes.push({
          name: rawName,
          methods: [],
          fields: [],
          privateWiringFields: wiring.sort(),
        });
      }
      return;
    }
    const methods = new Set<string>();
    const fields = new Set<string>();
    for (const member of node.members) {
      // Public data field (PropertyDeclaration) — e.g. a relay Event's
      // `readonly callId: string`. Collected separately from methods; a
      // reconcile pass later surfaces only the fields the Python reference
      // @dataclass declares on the same class (camelCase → snake_case).
      if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
        const fName = member.name.text;
        if (!fName.startsWith('_')) {
          const mods = ts.getCombinedModifierFlags(member);
          if (!(mods & ts.ModifierFlags.Private)) fields.add(camelToSnake(fName));
        }
      }
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
      if (
        (ts.isGetAccessor(member) || ts.isSetAccessor(member)) &&
        member.name &&
        ts.isIdentifier(member.name)
      ) {
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
    classes.push({
      name: rawName,
      methods: Array.from(methods).sort(),
      extendsName,
      fields: Array.from(fields).sort(),
    });
  }

  // Generated type modules (`*.types.generated.ts`, the relay `protocol.types.generated.ts`,
  // the SWAIG/SWML payload contracts, and `PlatformContracts.generated.ts` = the reference's
  // `swml_webhooks_types_generated`) export the spec-derived type DEFINITIONS as
  // `interface`/`type` declarations. The Python reference surfaces each such type as a
  // top-level symbol under its `*_types_generated` module, so we must emit them too — as
  // zero-method "classes" (a bare type definition has no callable surface). Scoped to the
  // GENERATED files ONLY: a blanket interface walk would flood the surface with every
  // internal interface (the HAND-written `PlatformContracts.ts`, `types.ts`, …) the reference
  // doesn't carry — hence the `.generated.` qualifier below.
  const isGeneratedTypeFile =
    /\.types\.generated\.ts$/.test(file) ||
    /SwaigContracts\.generated\.ts$/.test(file) ||
    /SwaigActions\.generated\.ts$/.test(file) ||
    /PlatformContracts\.generated\.ts$/.test(file) ||
    /swml_verbs_generated\.ts$/.test(file);

  // Generated type names the TS emitter suffixes with `_` to avoid colliding with a
  // TS built-in type (`Record<>`/`Set<>`); the reference (Python, no such collision)
  // names them bare. Map back so they compare equal — the type analog of the
  // reserved-word field rename (Python `from`→`from_`).
  const BUILTIN_COLLISION_RENAME: Record<string, string> = { Record_: 'Record', Set_: 'Set' };

  function collectTypeDefinition(name: string): void {
    if (name.startsWith('_')) return;
    const canon = BUILTIN_COLLISION_RENAME[name] ?? name;
    // A generated type carries no methods; record it as a bare class symbol so it
    // flattens to `<module>.<TypeName>` exactly like the reference's TypedDict surface.
    classes.push({ name: canon, methods: [] });
  }

  // A type alias whose RHS is a single primitive keyword (`string`, `number`,
  // `boolean`, `null`, `unknown`, `any`) — a pure format alias with no structural
  // surface. The reference emits these too but its surface enumerator drops them.
  function isBareScalarAlias(typeNode: ts.TypeNode): boolean {
    switch (typeNode.kind) {
      case ts.SyntaxKind.StringKeyword:
      case ts.SyntaxKind.NumberKeyword:
      case ts.SyntaxKind.BooleanKeyword:
      case ts.SyntaxKind.NullKeyword:
      case ts.SyntaxKind.UnknownKeyword:
      case ts.SyntaxKind.AnyKeyword:
        return true;
      default:
        return false;
    }
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
        const nm =
          nsPath.length > 0
            ? `${nsPath.join('')}${node.name.text}` // namespace-prefixed (e.g. "Inference" + "STT")
            : node.name.text;
        collectClass(node, nm);
      } else if (
        isGeneratedTypeFile &&
        (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
        isExported(node)
      ) {
        // Generated spec types (interface/type) — surface each as a bare symbol so
        // it matches the reference's `*_types_generated.<TypeName>` entry. Only in
        // generated-type files (see isGeneratedTypeFile).
        //
        // EXCEPT a bare-scalar format alias (`type uuid = string`, `docid = string`,
        // `jwt = string`, `SWMLVar = string`): the reference GENERATES these too
        // (`uuid: TypeAlias = "str"`) but its surface enumerator (griffe) does NOT
        // record a module-level scalar TypeAlias as a class — so they're absent from
        // python_surface.json. They carry no structural surface (a `type X = string`
        // is just `string`), so skip them to match the reference's surfacing policy.
        // Union/enum aliases (`type CallDirection = 'inbound' | ...`) and aliases to
        // NAMED types are kept — those are real surface.
        if (ts.isTypeAliasDeclaration(node) && isBareScalarAlias(node.type)) {
          // skip — matches the reference surface (griffe drops scalar TypeAliases)
        } else {
          collectTypeDefinition(node.name.text);
        }
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
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
            collectFunction(decl.name.text);
          }
        }
      } else if (
        ts.isModuleDeclaration(node) &&
        isExported(node) &&
        node.body &&
        ts.isModuleBlock(node.body)
      ) {
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
              classes.push({
                name: `__NS__${nsName}__${stmt.name.text}`,
                methods: collectMethodsFor(stmt),
              });
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
      if (ts.isConstructorDeclaration(member)) {
        methods.add('__init__');
        continue;
      }
      if (
        (ts.isMethodDeclaration(member) || ts.isGetAccessor(member) || ts.isSetAccessor(member)) &&
        member.name &&
        ts.isIdentifier(member.name)
      ) {
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

  // Class-name candidates from the reference come FIRST: a class the reference
  // knows (e.g. `SecurityConfig`, declared in TS's SWMLService.ts but placed by the
  // reference in `security_config`) must route to the reference's module, NOT to the
  // file's alias for its primary class. The file alias (TS_MODULE_ALIASES) is the
  // FALLBACK for classes the reference doesn't know. (The POM builder `Section`/
  // `DataMap` name-collision leak — builder methods spraying onto the same-named
  // SWML-schema interface — is fixed separately by the empty-method generated-type
  // guard in the method-augmentation loop, not by reordering this precedence.)
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

// ---------------------------------------------------------------------------
// Composition-attribute enrichment (surface class B1). The surface walker is
// AST-only and records methods/getters/setters — it does NOT resolve a
// class-typed FIELD (`readonly addresses: FabricAddresses`, an interface member
// `params?: AIParams`) to the SDK class it holds. The griffe-typed SIGNATURE
// oracle (`port_signatures.json`) already emits these as self-only members that
// RETURN an SDK class, so we import them here — the exact mirror of the Python
// reference's `enumerate_python._enrich_composition_attributes`, keeping the two
// oracles consistent by construction. A member is a composition attribute iff its
// signature is self-only (no non-self params) AND its return is an SDK class-ref
// (`class:signalwire.…`), bare or wrapped in `optional<…>` / `list<…>`. A
// `union<…>` return is EXCLUDED (those are the auto-vivified SWML verb SETTERS, a
// different idiom class). Keyed by CLASS NAME (union across signature modules);
// the enrich only lands an attr where the Python reference ALSO declares it on
// that exact (module, class), so a re-declared method-less copy (calling/fabric
// types) stays folded and never gains phantom members.
// ---------------------------------------------------------------------------
function resolvePortSignaturesPath(repoRoot: string): string {
  const envPath = process.env['PORT_SIGNATURES_PATH'];
  if (envPath && fs.existsSync(envPath)) return envPath;
  return path.join(repoRoot, 'port_signatures.json');
}

interface PortSigMethodSig {
  params?: Array<{ kind?: string }>;
  returns?: unknown;
}
interface PortSigClass {
  methods?: Record<string, PortSigMethodSig>;
}
interface PortSigModule {
  classes?: Record<string, PortSigClass>;
}

/** Build `className -> Set<composition-attr member name>` from the signature
 *  oracle, applying the same self-only + class-ref-return rule as Python's
 *  `_is_composition_return`. Empty map if the oracle is absent (the enrich then
 *  no-ops — surface never hard-depends on the signature oracle). */
function loadCompositionAttrs(repoRoot: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const sigPath = resolvePortSignaturesPath(repoRoot);
  if (!fs.existsSync(sigPath)) return out;
  let data: { modules?: Record<string, PortSigModule> };
  try {
    data = JSON.parse(fs.readFileSync(sigPath, 'utf-8'));
  } catch {
    return out;
  }
  const isCompositionReturn = (ret: unknown): boolean => {
    if (typeof ret !== 'string') return false;
    if (ret.startsWith('union<')) return false; // verb-setter union — not composition.
    return ret.includes('class:signalwire.');
  };
  for (const entry of Object.values(data.modules ?? {})) {
    for (const [cls, cd] of Object.entries(entry.classes ?? {})) {
      const methods = cd.methods;
      if (!methods || typeof methods !== 'object') continue;
      for (const [mn, sig] of Object.entries(methods)) {
        if (!sig || typeof sig !== 'object') continue;
        const nonSelf = (sig.params ?? []).filter((p) => p.kind !== 'self');
        if (nonSelf.length !== 0) continue;
        if (!isCompositionReturn(sig.returns)) continue;
        if (!out.has(cls)) out.set(cls, new Set());
        out.get(cls)!.add(mn);
      }
    }
  }
  return out;
}

function getGitSha(repoRoot: string): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'N/A';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  const argv = process.argv.slice(2);

  // Reject unknown flags. This parser used to silently IGNORE anything it did not
  // recognise — the exact hole enumerate-signatures.ts closed in 722932e, still open
  // here. The two enumerators spell their output flag DIFFERENTLY (`--output` here,
  // `--out` there), so `--out <path>` passed to this script fell through to the
  // default path and OVERWROTE the committed port_surface.json at exit 0, with no
  // warning: the caller thinks it wrote a scratch file, and the working tree is
  // silently mutated instead. (Observed live, 2026-07-30.) An unrecognised flag is a
  // caller error, not a no-op.
  const KNOWN = new Set(['--stdout', '--output']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a || !a.startsWith('--')) continue;
    if (!KNOWN.has(a)) {
      console.error(
        `enumerate-surface: unknown flag '${a}'\n` +
          `usage: enumerate-surface [--output <path>] [--stdout]`,
      );
      return 2;
    }
    if (a === '--output') i++; // consume its value
  }

  const writeStdout = argv.includes('--stdout');
  const outputArgIdx = argv.indexOf('--output');
  if (outputArgIdx >= 0 && argv[outputArgIdx + 1] === undefined) {
    console.error('enumerate-surface: --output requires a path argument');
    return 2;
  }
  const repoRoot = path.resolve(__dirname, '..');
  const outputPath =
    outputArgIdx >= 0
      ? path.resolve(argv[outputArgIdx + 1]!)
      : path.join(repoRoot, 'port_surface.json');

  const srcDir = path.join(repoRoot, 'src');
  const files = findSourceFiles(srcDir);

  const pythonSurfacePath = resolvePythonSurfacePath(repoRoot);
  const { classToModules, methodToOwners, pythonMethodsByOwner, pythonFunctionsByModule } =
    loadPythonReference(pythonSurfacePath);

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
    fields?: string[];
    privateWiringFields?: string[];
  }
  const rawClasses: RawClass[] = [];
  const rawFunctions: Array<{ fileRel: string; fns: string[] }> = [];
  for (const abs of files) {
    const rel = path.relative(repoRoot, abs).replace(/\\/g, '/');
    const fs2 = enumerateFile(abs);
    for (const c of fs2.classes) {
      rawClasses.push({
        fileRel: rel,
        name: c.name,
        methods: c.methods,
        extendsName: c.extendsName,
        fields: c.fields,
        privateWiringFields: c.privateWiringFields,
      });
    }
    if (fs2.functions.length > 0) rawFunctions.push({ fileRel: rel, fns: fs2.functions });
  }

  // Name → composition accessors declared on a PRIVATE wiring base. Keyed by the
  // raw TS class name so the `extends` chain (which is name-keyed here — this
  // enumerator parses per-file with no type checker) can look it up. The private
  // class is never emitted itself; only these member names, lifted onto the
  // public subclass that extends it. See the `_`-prefix branch of collectClass.
  const privateWiring = new Map<string, Set<string>>();
  for (const c of rawClasses) {
    if (!c.privateWiringFields || c.privateWiringFields.length === 0) continue;
    if (!privateWiring.has(c.name)) privateWiring.set(c.name, new Set());
    for (const f of c.privateWiringFields) privateWiring.get(c.name)!.add(f);
  }

  // Build a name → methods map for inheritance lookups (TS-class-name keyed).
  const classMethods = new Map<string, Set<string>>();
  for (const c of rawClasses) {
    // A private wiring base contributes through `privateWiring` only — never as a
    // name-keyed entry `resolveInherited` could pick up.
    if (c.privateWiringFields) continue;
    const cleanName = c.name.startsWith('__NS__') ? c.name.split('__').pop()! : c.name;
    if (!classMethods.has(cleanName)) classMethods.set(cleanName, new Set());
    for (const m of c.methods) classMethods.get(cleanName)!.add(m);
  }

  // Build a name → public-DATA-FIELD map, snake_cased. Used by the
  // field-emission reconcile pass below to surface the relay Event @dataclass
  // fields (and AI-Chat DTO / RequestOptions fields) the AST walk collected but
  // that are gated on the reference declaring them.
  //
  // KEYED BY THE **EMITTED** (alias-resolved) CLASS NAME, not the raw TS name.
  // The reconcile pass iterates the emitted `modules` tree, so its lookup key is
  // the canonical reference spelling. Keying this map by the TS spelling silently
  // dropped every public field of a class whose name is aliased —
  // `SwaigFunction`→`SWAIGFunction` (11 fields) and `RestError`→
  // `SignalWireRestError` (5) never emitted, which read as 16 construction params
  // a TS caller could set but not read back (CONSTRUCTION-READBACK).
  const classFields = new Map<string, Set<string>>();
  for (const c of rawClasses) {
    if (c.privateWiringFields) continue;
    if (!c.fields || c.fields.length === 0) continue;
    const cleanName = c.name.startsWith('__NS__') ? c.name.split('__').pop()! : c.name;
    const emitKey = CLASS_NAME_ALIASES[cleanName] ?? cleanName;
    if (!classFields.has(emitKey)) classFields.set(emitKey, new Set());
    for (const f of c.fields) classFields.get(emitKey)!.add(f);
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
    if (c.privateWiringFields) continue; // not surface; only a source of lifted members
    const cleanName = c.name.startsWith('__NS__') ? c.name.split('__').pop()! : c.name;
    const emitName = CLASS_NAME_ALIASES[cleanName] ?? cleanName;
    const moduleGuess = pickModule(emitName, c.fileRel, classToModules);

    // WIRED-BASE composition: lift the accessors declared on a PRIVATE base this
    // class extends (`RestClient extends _GeneratedResourceTree`). Those members
    // are surface — reachable, spec-derived, and recorded by the reference oracle
    // on the SUBCLASS — but they live on a base that is itself an implementation
    // detail, so neither the per-class member walk nor the public-base
    // `resolveInherited` pass could see them. Walks the private-base chain so a
    // multi-level wiring base resolves too. Unlike `resolveInherited` below, this
    // is NOT filtered against the reference's method set: the base is generated
    // from `porting-sdk/rest-apis/*/openapi.yaml`, so its accessors track the
    // specs by construction and a genuinely port-only accessor would be a real
    // ADDITION the gate should report, not something to silently drop.
    {
      const lifted = new Set<string>();
      const seenBase = new Set<string>();
      let baseName = c.extendsName;
      while (baseName && privateWiring.has(baseName) && !seenBase.has(baseName)) {
        seenBase.add(baseName);
        for (const f of privateWiring.get(baseName)!) lifted.add(f);
        baseName = rawClasses.find((r) => r.name === baseName)?.extendsName;
      }
      if (lifted.size > 0) {
        c.methods = Array.from(new Set([...c.methods, ...lifted])).sort();
      }
    }

    // A generated-type interface (recorded method-less from a *.types.generated /
    // swml_verbs_generated / SwaigContracts.generated file) is a pure data shape — it
    // must NOT absorb inherited/Python methods from a same-named BUILDER class in
    // another module (the POM `Section`/`DataMap` builders collide by name with the
    // SWML-schema `Section`/`DataMap` interfaces). `resolveInherited` is name-keyed, so
    // without this guard those builder methods spray onto the schema interface. Skip the
    // whole augmentation for these — they have, and should keep, zero methods.
    if (
      c.methods.length === 0 &&
      /\.types\.generated\.ts$|swml_verbs_generated\.ts$|SwaigContracts\.generated\.ts$/.test(
        c.fileRel,
      )
    ) {
      continue;
    }
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
    const skillCtx =
      moduleGuess === 'signalwire.core.skill_base' || moduleGuess.startsWith('signalwire.skills.');
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
    // A private wiring base is not surface — it was recorded ONLY so its declared
    // accessors could be lifted onto the public class that extends it.
    if (cls.privateWiringFields) continue;
    const rel = cls.fileRel;

    // Handle nested-namespace marker: "__NS__plugins__DeepgramSTT" → class
    // "DeepgramSTT" under `signalwire.livewire.plugins` when the file is
    // the livewire index.
    const nsMatch = cls.name.match(/^__NS__([A-Za-z0-9_]+)__(.+)$/);
    if (nsMatch) {
      const [, nsName, realName] = nsMatch;
      const mod =
        rel === 'src/livewire/index.ts' && nsName === 'plugins'
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
          if (!ownerMod.includes('.mixins.') && !ownerMod.startsWith('signalwire.core.agent.'))
            continue;
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
    const fileMod = pickModuleForFunction(f.fileRel);
    for (const fn of f.fns) {
      // A per-symbol override can route a single file's function to a
      // different canonical module than its file-level home.
      const mod = FREE_FN_MODULE_OVERRIDES[fn] ?? fileMod;
      const aliases = FUNCTION_NAME_ALIASES[mod] ?? {};
      const entry = ensureModule(mod);
      const existing = new Set(entry.functions);
      existing.add(aliases[fn] ?? fn);
      entry.functions = Array.from(existing).sort();
    }
  }

  // Reconcile: MIXIN_PROJECTIONS. TS folds Python's mixin / ToolRegistry methods
  // onto AgentBase (or its parent SWMLService). Project the canonical method
  // names onto their Python-owning module+class so the surfaces compare equal —
  // the same reconciliation the signatures enumerator performs. The source member
  // may be spelled under a TS idiom name (value of the methods map); we look for
  // it on AgentBase first (it overrides), then SWMLService.
  {
    const abEntry = new Set(modules['signalwire.core.agent_base']?.classes?.['AgentBase'] ?? []);
    const svcEntry = new Set(
      modules['signalwire.core.swml_service']?.classes?.['SWMLService'] ?? [],
    );
    // PromptManager is a distinct TS class Python's PromptMixin delegates to;
    // some PromptMixin members (e.g. the `contexts` property ≡ getContexts) live
    // there rather than on AgentBase/SWMLService.
    const pmEntry = new Set(
      modules['signalwire.core.agent.prompt.manager']?.classes?.['PromptManager'] ?? [],
    );
    const hasMember = (name: string): boolean =>
      abEntry.has(name) || svcEntry.has(name) || pmEntry.has(name);
    for (const [targetCls, spec] of Object.entries(MIXIN_PROJECTIONS)) {
      const present: string[] = [];
      for (const [pyName, tsName] of Object.entries(spec.methods)) {
        if (tsName === null || hasMember(tsName)) present.push(pyName);
      }
      // An empty mixin class (no methods to project) is still surfaced as a bare
      // class if the reference declares it method-less.
      const refMethods = pythonMethodsByOwner.get(`${spec.module}.${targetCls}`);
      if (present.length === 0 && !(refMethods && refMethods.size === 0)) continue;
      const entry = ensureModule(spec.module);
      const existing = new Set(entry.classes[targetCls] ?? []);
      for (const m of present) existing.add(m);
      entry.classes[targetCls] = Array.from(existing).sort();
    }

    // `ToolRegistry.agent` — the reference constructs the registry with a
    // back-reference to its owning agent (`ToolRegistry(self)`, stored as public
    // `self.agent`, `core/agent/tools/registry.py:32`; a ctor param the oracle's
    // class-B2 rule records, so CONSTRUCTION-READBACK demands it).
    //
    // TS does not extract the registry as a separate OBJECT at all: its methods are
    // declared directly on SWMLService (a `toolRegistry` Map field), which is exactly
    // what the projection above encodes. When the registry and its agent are the SAME
    // object the back-reference is `this` — reaching the agent from the registry is as
    // available in TS as in Python, it is simply already in hand. Same fold cpp
    // applies for the same reason (`signalwire-cpp/scripts/enumerate_surface.py`).
    //
    // Gated on the projection having actually produced members, so this can never
    // surface a member for a class the port does not present. `PromptManager` is NOT
    // in this list: TS ships it as a real distinct class and it carries a real `agent`
    // back-reference field, collected by the ordinary walk.
    {
      const key = 'signalwire.core.agent.tools.registry';
      const members = modules[key]?.classes?.['ToolRegistry'];
      if (members && members.length > 0) {
        modules[key]!.classes['ToolRegistry'] = Array.from(new Set([...members, 'agent'])).sort();
      }
    }
  }

  // Reconcile: skill `register_tools`. TS skills use the declarative getTools()
  // contract (emitted as `get_tools`); Python's SkillBase + every concrete skill
  // declares the imperative `register_tools`. They are the same capability (surface
  // the skill's tools), so where TS emits `get_tools` and the reference class
  // declares `register_tools`, ADD `register_tools` (keeping `get_tools`, which the
  // four skills that also declare it in Python match verbatim; for the rest it is a
  // recorded TS addition). This is a duplication mapping, not a rename — nothing is
  // removed, so no reference symbol goes missing.
  for (const [mod, entry] of Object.entries(modules)) {
    if (mod !== 'signalwire.core.skill_base' && !mod.startsWith('signalwire.skills.')) continue;
    for (const [cls, methods] of Object.entries(entry.classes)) {
      const refMethods = pythonMethodsByOwner.get(`${mod}.${cls}`);
      if (!refMethods || !refMethods.has('register_tools')) continue;
      if (!methods.includes('get_tools')) continue;
      if (!methods.includes('register_tools')) {
        entry.classes[cls] = Array.from(new Set([...methods, 'register_tools'])).sort();
      }
    }
  }

  // Reconcile: abstract RELAY action mixin bases. Python factors the call-action
  // controls into an abstract mixin chain (StoppableAction → PausableAction →
  // VolumeAction → concrete PlayAction/RecordAction/…), so the control methods
  // live on those abstract bases. TS flattens the hierarchy: every concrete action
  // `extends Action` with the control methods inlined (surfaced per concrete action,
  // e.g. PlayAction.stop/pause/resume/volume — recorded in PORT_ADDITIONS). The
  // abstract bases therefore have no TS class, but the CAPABILITY is present. Surface
  // the three bases (with their control methods) so they compare equal to the
  // reference; the signature gate already excuses them via _is_abstract_action_base_method.
  {
    const RELAY_CALL = 'signalwire.relay.call';
    const callClasses = modules[RELAY_CALL]?.classes ?? {};
    const anyConcreteHas = (method: string): boolean =>
      Object.entries(callClasses).some(
        ([cls, ms]) => cls.endsWith('Action') && ms.includes(method),
      );
    const bases: Record<string, string[]> = {
      StoppableAction: ['stop'],
      PausableAction: ['pause', 'resume'],
      VolumeAction: ['volume'],
    };
    const entry = ensureModule(RELAY_CALL);
    for (const [baseCls, controls] of Object.entries(bases)) {
      // Only surface the base if the reference declares it AND a concrete TS
      // action actually carries at least one of its control methods.
      const refMethods = pythonMethodsByOwner.get(`${RELAY_CALL}.${baseCls}`);
      if (!refMethods) continue;
      const present = controls.filter((m) => anyConcreteHas(m));
      if (present.length === 0) continue;
      const existing = new Set(entry.classes[baseCls] ?? []);
      for (const m of present) existing.add(m);
      entry.classes[baseCls] = Array.from(existing).sort();
    }
  }

  // Reconcile: SWMLBuilder verb convenience methods. Python hand-writes `ai`,
  // `answer`, `hangup`, `play` as explicit convenience wrappers on SWMLBuilder
  // (plus `__getattr__` for the rest). TS installs EVERY schema verb dynamically
  // in the constructor (`_installVerbMethods`) and declares them via a generated
  // declaration-merge interface (SwmlVerbMethods.generated.ts) — so ai/answer/
  // hangup/play are provably present, callable, typed members of SwmlBuilder, just
  // not literal class-body methods the AST walker sees. Surface exactly the four
  // the reference declares explicitly so they compare equal. (`say` is already a
  // real class method and is enumerated normally; the config-object vs positional
  // param-shape difference is recorded in PORT_SIGNATURE_OMISSIONS.)
  {
    const SWML_BUILDER = 'signalwire.core.swml_builder';
    const builderEntry = modules[SWML_BUILDER]?.classes?.['SWMLBuilder'];
    if (builderEntry) {
      const refMethods = pythonMethodsByOwner.get(`${SWML_BUILDER}.SWMLBuilder`);
      const dynamicVerbs = ['ai', 'answer', 'hangup', 'play'];
      const existing = new Set(builderEntry);
      for (const v of dynamicVerbs) {
        if (refMethods?.has(v)) existing.add(v);
      }
      modules[SWML_BUILDER]!.classes['SWMLBuilder'] = Array.from(existing).sort();
    }
  }

  // Reconcile: SWMLService.on_request. Python declares the default no-op
  // `on_request` hook on BOTH SWMLService (the base) AND WebMixin. TS declares
  // the single overridable `onRequest` hook on AgentBase (which extends
  // SWMLService); the AgentBase-folding loop above already projected it onto
  // WebMixin (where it now lives, having been moved off AgentBase). Project the
  // same member onto SWMLService too so the surface records the base-class
  // declaration — same capability, reachable via `agent.onRequest(...)`. Kept in
  // lock-step with the signatures enumerator's SWMLService.on_request projection.
  // Guarded on WebMixin actually carrying on_request so a rename fails loud.
  {
    const webMixinHasOnRequest = (
      modules['signalwire.core.mixins.web_mixin']?.classes?.['WebMixin'] ?? []
    ).includes('on_request');
    if (webMixinHasOnRequest) {
      const entry = ensureModule('signalwire.core.swml_service');
      const existing = new Set(entry.classes['SWMLService'] ?? []);
      existing.add('on_request');
      entry.classes['SWMLService'] = Array.from(existing).sort();
    }
  }

  // Reconcile: PhoneCallHandler (the `call_handler` value enum). The reference
  // GENERATES it as a method-less enum class under
  // `signalwire.rest.namespaces.relay_rest_types_generated`. TS expresses the same
  // value set as the idiomatic `const PhoneCallHandler = {…} as const` + companion
  // union type in `src/rest/callHandler.ts` (named PhoneCallHandler to avoid
  // colliding with the RELAY inbound-call-handler callback). An `export const`
  // object literal is not a class or a callable, so the AST walk above does not
  // collect it — but the CAPABILITY (the enum surface) is present. Surface it as a
  // bare (method-less) class under the reference's generated-type module so it
  // compares equal. Guarded on the file actually exporting the const so a rename
  // fails loud rather than silently keeping a phantom symbol.
  {
    const callHandlerAbs = path.join(srcDir, 'rest', 'callHandler.ts');
    if (fs.existsSync(callHandlerAbs)) {
      const src = fs.readFileSync(callHandlerAbs, 'utf-8');
      if (/export\s+const\s+PhoneCallHandler\b/.test(src)) {
        const mod = 'signalwire.rest.namespaces.relay_rest_types_generated';
        const entry = ensureModule(mod);
        if (!entry.classes['PhoneCallHandler']) entry.classes['PhoneCallHandler'] = [];
      }
    }
  }

  // Reconcile: AI-Chat client lifecycle + response models (signalwire.ai_chat.client).
  // The python reference exposes the async context-manager lifecycle on
  // AIChatClient — `__aenter__`/`__aexit__` (`async with client:`). The TS port
  // expresses the same lifecycle idiomatically: a real `close()` method (already
  // enumerated) plus `Symbol.asyncDispose` (`await using client`, a computed-name
  // member the identifier-only walk does not surface). Inject the two dunders so
  // the lifecycle CAPABILITY compares equal — the same reconciliation the .NET port
  // did mapping IDisposable onto `__aenter__`/`__aexit__`/`close`. Guarded on the
  // client actually carrying `close` so a rename fails loud.
  //
  // The three response models (ConversationInfo / ChatResponse / ChatLog) are TS
  // `interface`s (structural records), not classes, so the class walk does not emit
  // them. The reference records each as a @dataclass whose public FIELDS are surface
  // (`ChatResponse.text`/`conversation_id`/`user_event`, etc.). Surface each as a
  // class carrying exactly the fields the reference declares (camelCase→snake_case),
  // gated on the reference member set so a port-internal field never leaks. Guarded
  // on the source file actually declaring each interface so a rename fails loud.
  {
    const AICHAT_MOD = 'signalwire.ai_chat.client';
    const clientEntry = modules[AICHAT_MOD]?.classes?.['AIChatClient'];
    if (clientEntry && clientEntry.includes('close')) {
      const withDunders = new Set(clientEntry);
      withDunders.add('__aenter__');
      withDunders.add('__aexit__');
      modules[AICHAT_MOD]!.classes['AIChatClient'] = Array.from(withDunders).sort();
    }
    const aiChatSrc = path.join(srcDir, 'ai-chat', 'AIChatClient.ts');
    if (fs.existsSync(aiChatSrc)) {
      const ifaceFields = collectInterfaceFields(aiChatSrc);
      for (const model of ['ConversationInfo', 'ChatResponse', 'ChatLog']) {
        const declared = ifaceFields.get(model);
        if (!declared) continue; // interface not present — rename fails loud.
        const entry = ensureModule(AICHAT_MOD);
        const refMembers = pythonMethodsByOwner.get(`${AICHAT_MOD}.${model}`);
        const emit = new Set(entry.classes[model] ?? []);
        for (const f of declared) {
          if (!refMembers || refMembers.has(f)) emit.add(f);
        }
        entry.classes[model] = Array.from(emit).sort();
      }
    }
  }

  // Public-data-FIELD emission (@dataclass parity). The AST walk collects each
  // class's public data fields (relay Event structs carry the deserialized
  // payload as `readonly callId`/`callState`/… ; AI-Chat DTOs + RequestOptions
  // carry their record fields). The reference oracle now enumerates a
  // @dataclass's public annotated fields as surface. Emit exactly the fields the
  // reference declares on this (module, class) — gated on `pythonMethodsByOwner`
  // so we surface the reference field set and never over-emit port-internal
  // struct members. camelCase→snake_case already applied at collection. Only
  // lands where the reference declares the class (a port-only class has no
  // reference member set to gate on and is left untouched).
  //
  // METHOD_NAME_ALIASES applies to FIELDS too, for the same reason it applies to
  // methods: a field is a member, and a member whose TS spelling differs from the
  // reference's is a RENAME (ALLOWLIST_DISCIPLINE §7 row 2), never a divergence.
  // Two live cases: `Section.numbered_bullets` (the reference records the WIRE KEY
  // `numberedBullets` verbatim — it round-trips through the POM dict, so
  // camelToSnake must be undone) and `AIChatError.server_message` (the raw
  // undecorated server text; the `message` spelling is taken by JS `Error.message`,
  // which carries the DECORATED string).
  {
    for (const [mod, entry] of Object.entries(modules)) {
      for (const [cls, methods] of Object.entries(entry.classes)) {
        const candFields = classFields.get(cls);
        if (!candFields) continue;
        const refMembers = pythonMethodsByOwner.get(`${mod}.${cls}`);
        if (!refMembers) continue; // port-only class — no reference gate.
        const fieldAliases = METHOD_NAME_ALIASES[`${mod}.${cls}`] ?? {};
        const merged = new Set(methods);
        for (const f of candFields) {
          const canon = fieldAliases[f] ?? f;
          if (refMembers.has(canon)) merged.add(canon);
        }
        entry.classes[cls] = Array.from(merged).sort();
      }
    }
  }

  // Composition-attribute enrichment (class B1): add class-typed FIELD members the
  // AST walk missed, imported from the signature oracle. Only lands an attr where
  // the Python reference ALSO declares it on this exact (module, class), so a
  // method-less re-declared copy never gains phantom members. Mirrors the
  // reference oracle's `_enrich_composition_attributes`.
  {
    const compositionAttrs = loadCompositionAttrs(repoRoot);
    if (compositionAttrs.size > 0) {
      for (const [mod, entry] of Object.entries(modules)) {
        for (const [cls, methods] of Object.entries(entry.classes)) {
          const cand = compositionAttrs.get(cls);
          if (!cand) continue;
          const refMembers = pythonMethodsByOwner.get(`${mod}.${cls}`);
          if (!refMembers) continue; // port-only class — no reference member set to gate on.
          const merged = new Set(methods);
          for (const attr of cand) {
            if (refMembers.has(attr)) merged.add(attr);
          }
          entry.classes[cls] = Array.from(merged).sort();
        }
      }
    }
  }

  // Reconcile: the LOGGING idiom fold (see LOGGING_CLASS_FOLDS /
  // LOGGING_FUNCTION_FOLDS / PER_INSTANCE_LOGGER_MEMBERS above for the ruling and
  // the evidence). Each fold is GUARDED on its reference target actually being
  // present, so a rename on either side fails LOUD (the port symbol stays and the
  // gate flags it) rather than silently vanishing.
  {
    const logEntry = modules[LOGGING_CONFIG_MOD];
    if (logEntry) {
      const refFns = new Set(pythonFunctionsByModule.get(LOGGING_CONFIG_MOD) ?? []);
      const haveFns = new Set(logEntry.functions);

      // 1. Port-only classes fold onto their reference free function.
      for (const [cls, target] of Object.entries(LOGGING_CLASS_FOLDS)) {
        if (!logEntry.classes[cls]) continue;
        // Fold only if the reference declares the target AND the port emits it.
        if (!refFns.has(target) || !haveFns.has(target)) continue;
        delete logEntry.classes[cls];
      }

      // 2. Port-only setters fold onto their reference free function.
      const keptFns = logEntry.functions.filter((fn) => {
        const target = LOGGING_FUNCTION_FOLDS[fn];
        if (target === undefined) return true;
        if (!refFns.has(target) || !haveFns.has(target)) return true; // fail loud
        return false;
      });
      logEntry.functions = keptFns.sort();
    }

    // 3. Per-instance logger members: dropped on BOTH sides per the owner ruling.
    //    Guarded on the reference NOT declaring the member — if the oracle ever
    //    records it again, the port keeps its copy and the gate compares them.
    for (const [key, members] of Object.entries(PER_INSTANCE_LOGGER_MEMBERS)) {
      const idx = key.lastIndexOf('.');
      const mod = key.slice(0, idx);
      const cls = key.slice(idx + 1);
      const entry = modules[mod];
      const current = entry?.classes?.[cls];
      if (!entry || !current) continue;
      const refMembers = pythonMethodsByOwner.get(key);
      const drop = new Set(members.filter((m) => !(refMembers?.has(m) ?? false)));
      if (drop.size === 0) continue;
      entry.classes[cls] = current.filter((m) => !drop.has(m));
    }
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
  return 0;
}

// `process.exit(main())`, not a bare `main()`: a non-zero return must reach the
// shell. A bare call discards the code and the process exits 0, which is how a
// rejected flag would still read as success to every caller. Mirrors
// enumerate-signatures.ts (722932e).
process.exit(main());
