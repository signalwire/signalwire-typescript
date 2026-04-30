/**
 * SignalWire AI Agents SDK for TypeScript / Node.js.
 *
 * Build AI voice agents as HTTP microservices that serve
 * [SWML](https://developer.signalwire.com/sdks/reference/swml/) documents
 * and handle SWAIG function callbacks from the SignalWire platform.
 *
 * @example Minimal agent
 * ```ts
 * import { AgentBase, FunctionResult } from '@signalwire/sdk';
 *
 * const agent = new AgentBase({ name: 'simple', route: '/' });
 *
 * agent.setPromptText("You are a helpful assistant.");
 *
 * agent.defineTool({
 *   name: 'get_time',
 *   description: 'Return the current server time.',
 *   parameters: { type: 'object', properties: {} },
 *   handler: () => new FunctionResult(`Time is ${new Date().toISOString()}`),
 * });
 *
 * await agent.serve({ port: 3000 });
 * ```
 *
 * @example Pre-built agent (prefab)
 * ```ts
 * import { ReceptionistAgent } from '@signalwire/sdk';
 *
 * const receptionist = new ReceptionistAgent({
 *   name: 'front-desk',
 *   departments: [
 *     { name: 'sales', description: 'New customers', number: '+15551112222' },
 *     { name: 'support', description: 'Existing customers', number: '+15553334444' },
 *   ],
 * });
 *
 * await receptionist.serve({ port: 3000 });
 * ```
 *
 * @example REST API client
 * ```ts
 * import { RestClient } from '@signalwire/sdk';
 *
 * const client = new RestClient(); // reads SIGNALWIRE_* env vars
 * const calls = await client.compat.calls.list();
 * ```
 *
 * @see {@link AgentBase} — core agent class
 * @see {@link FunctionResult} — fluent builder for SWAIG tool responses
 * @see {@link ContextBuilder} — multi-step conversation workflows
 * @see {@link DataMap} — server-side tools (no webhook infrastructure required)
 * @see {@link SkillBase} — base class for writing custom skills
 * @see {@link RelayClient} — real-time WebSocket call/message control
 * @see {@link RestClient} — typed HTTP access to SignalWire platform APIs
 *
 * @packageDocumentation
 */

// Core agent
export { AgentBase } from './AgentBase.js';
export type { RoutingCallback } from './AgentBase.js';
export { AgentServer } from './AgentServer.js';

// SWML Service (non-AI call flows)
export { SWMLService, SecurityConfig } from './SWMLService.js';
export type { OnRequestCallback, SWMLServiceOptions } from './SWMLService.js';

// Web Service (static file serving)
export { WebService } from './WebService.js';
export type { WebServiceOptions } from './WebService.js';

// Tool results & functions
export { FunctionResult } from './FunctionResult.js';
/** @deprecated Use {@link FunctionResult} instead. */
export { FunctionResult as SwaigFunctionResult } from './FunctionResult.js';
export type { PaymentPrompt, PaymentAction, PaymentParameter } from './FunctionResult.js';
export { SwaigFunction } from './SwaigFunction.js';
export type { SwaigHandler, SwaigFunctionOptions } from './SwaigFunction.js';

// DataMap (server-side tools)
export { DataMap, createSimpleApiTool, createExpressionTool, setAllowedEnvPrefixes, getAllowedEnvPrefixes } from './DataMap.js';

// Prompt Object Model
export { PomBuilder, PomSection } from './PomBuilder.js';
export type { PomSectionData } from './PomBuilder.js';

// SWML builder
export { SwmlBuilder } from './SwmlBuilder.js';
export type { SwmlBuilderOptions } from './SwmlBuilder.js';
import './SwmlVerbMethods.generated.js';

// SWML Verb Handlers
export { SWMLVerbHandler, AIVerbHandler, VerbHandlerRegistry } from './SWMLHandler.js';
export type { AIVerbBuildOptions } from './SWMLHandler.js';

// Prompt management
export { PromptManager } from './PromptManager.js';

// Contexts & Steps
export {
  ContextBuilder,
  Context,
  Step,
  GatherInfo,
  GatherQuestion,
  createSimpleContext,
} from './ContextBuilder.js';

// Security
export { SessionManager } from './SessionManager.js';
export type { DebugTokenResult } from './SessionManager.js';

// SSL
export { SslConfig } from './SslConfig.js';
export type { SslOptions } from './SslConfig.js';

// Schema Validation
export { SchemaUtils } from './SchemaUtils.js';
export type { ValidationResult } from './SchemaUtils.js';

// Auth
export { AuthHandler } from './AuthHandler.js';
export type { AuthConfig } from './AuthHandler.js';

// Type inference for typed tool handlers
export { inferSchema, createTypedHandlerWrapper, parseFunctionParams } from './TypeInference.js';
export type { InferredSchema, ParsedParam } from './TypeInference.js';

// Security utilities
export { safeAssign, filterSensitiveHeaders, redactUrl, MAX_SKILL_INPUT_LENGTH, validateUrl, isServerlessMode } from './SecurityUtils.js';

// Config
export { ConfigLoader } from './ConfigLoader.js';

// Logging
export { Logger, getLogger, setGlobalLogLevel, suppressAllLogs, setGlobalLogFormat, setGlobalLogColor, setGlobalLogStream, resetLoggingConfiguration, getExecutionMode, stripControlChars } from './Logger.js';

// Serverless
export { ServerlessAdapter } from './ServerlessAdapter.js';
export type { ServerlessPlatform, ServerlessEvent, ServerlessResponse } from './ServerlessAdapter.js';

// Skills
export { SkillBase, SkillManager, SkillRegistry } from './skills/index.js';
export type { SkillConfig, SkillToolDefinition, SkillPromptSection, ParameterSchemaEntry, SkillSchemaInfo } from './skills/index.js';

// Built-in Skills
export { registerBuiltinSkills } from './skills/builtin/index.js';
export {
  DateTimeSkill, MathSkill, JokeSkill,
  WeatherApiSkill, PlayBackgroundFileSkill, SwmlTransferSkill,
  ApiNinjasTriviaSkill, InfoGathererSkill, CustomSkillsSkill,
  WebSearchSkill, WikipediaSearchSkill, GoogleMapsSkill,
  DataSphereSkill, DataSphereServerlessSkill, NativeVectorSearchSkill,
  SpiderSkill, ClaudeSkillsSkill, AskClaudeSkill, McpGatewaySkill,
} from './skills/builtin/index.js';

// Prefab Agents
export {
  InfoGathererAgent, SurveyAgent, FAQBotAgent,
  ConciergeAgent, ReceptionistAgent,
} from './prefabs/index.js';
export type {
  InfoGathererConfig, InfoGathererQuestion, InfoGathererQuestionCallback,
  SurveyConfig, SurveyQuestion, FAQBotConfig, FAQEntry,
  ConciergeConfig, ReceptionistConfig, ReceptionistDepartment,
} from './prefabs/index.js';

// Types
export type {
  AgentOptions,
  LanguageConfig,
  PronunciationRule,
  FunctionInclude,
  DynamicConfigCallback,
  SummaryCallback,
} from './types.js';

// RELAY Client (real-time call/message control over WebSocket)
export * from './relay/index.js';

// REST Client (typed HTTP access to all SignalWire platform APIs)
export * from './rest/index.js';

// LiveWire (LiveKit-compatible agents powered by SignalWire)
export * as livewire from './livewire/index.js';

// CLI helpers — convenience wrappers matching Python's start_agent / run_agent API
import type { AgentBase as _AgentBase } from './AgentBase.js';
import { SkillRegistry as _SkillRegistry } from './skills/SkillRegistry.js';
import type { SkillSchemaInfo as _SkillSchemaInfo } from './skills/SkillRegistry.js';
import type { SkillBase as _SkillBase } from './skills/SkillBase.js';
import { RestClient as _RestClient } from './rest/index.js';
import type { ClientOptions as _ClientOptions } from './rest/types.js';

/**
 * Construct a {@link _RestClient | RestClient} instance.
 *
 * Equivalent to Python's top-level `signalwire.RestClient(*args, **kwargs)`
 * factory — a thin wrapper that lazy-imports `signalwire.rest.RestClient`
 * and instantiates it. The TS class is also exported directly at module
 * scope (`new RestClient(...)`); this function provides parity with the
 * Python-style factory call.
 *
 * Note: TypeScript exports the class `RestClient` at the same name from
 * `./rest/index.js`. The function below is named `restClient` (camelCase)
 * to avoid shadowing the class. The audit adapter remaps the emitted
 * surface entry from `signalwire.rest_client` to `signalwire.RestClient`
 * via the FREE_FN_NAME_OVERRIDES table in enumerate-signatures.ts.
 *
 * The signature accepts a positional `args` rest parameter and a trailing
 * `kwargs` record. This mirrors Python's `(*args, **kwargs)` shape so the
 * cross-language signature audit recognizes them as compatible. In
 * practice callers pass either the `kwargs` object alone or nothing.
 *
 * @param args - Positional credentials (compat shim for ports that pass
 *   project/token/host positionally). Usually empty in TS.
 * @param kwargs - Keyword-style credentials. When omitted, reads
 *   `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`, and
 *   `SIGNALWIRE_SPACE` from the environment.
 * @returns A new {@link _RestClient} instance bound to the supplied (or
 *   environment-derived) credentials.
 *
 * @example
 * ```ts
 * import { restClient } from '@signalwire/sdk';
 *
 * const client = restClient([], { project: 'p', token: 't', host: 'h.signalwire.com' });
 * await client.compat.calls.list();
 *
 * // Or using just the options form:
 * const env = restClient();  // reads env vars
 * ```
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function restClient(args?: string[], kwargs?: Record<string, unknown>): _RestClient {
  // `args` is a positional placeholder for cross-language parity (mirrors
  // Python's ``*args``). `kwargs` carries the actual credentials object —
  // this preserves ``**kwargs`` shape for the audit while still letting
  // TS callers use the natural ``restClient([], { project, token, host })``
  // form. When the first arg is an object (legacy callers passing options
  // directly), we treat it as the kwargs.
  let opts: _ClientOptions | undefined;
  if (args !== undefined && !Array.isArray(args) && typeof args === 'object') {
    opts = args as _ClientOptions;
  } else if (kwargs !== undefined) {
    opts = kwargs as _ClientOptions;
  }
  return new _RestClient(opts);
}

/**
 * List metadata for all registered skills.
 *
 * Equivalent to Python's `list_skills()` — proxies to the singleton
 * {@link SkillRegistry}. Python's version returns a plain dict keyed by
 * skill name; this returns an array of {@link _SkillSchemaInfo} entries
 * (the TS shape is richer and includes the name field).
 *
 * @returns Array of skill metadata entries.
 */
export function listSkills(): _SkillSchemaInfo[] {
  return _SkillRegistry.getInstance().listSkills();
}

/**
 * Get full schema for all registered skills, including parameter metadata.
 *
 * Equivalent to Python's `list_skills_with_params()`. Useful for GUI
 * configuration tools, API documentation, and programmatic skill discovery.
 *
 * @returns Map of skill name to {@link _SkillSchemaInfo | schema info}.
 */
export function listSkillsWithParams(): Record<string, _SkillSchemaInfo> {
  return _SkillRegistry.getInstance().getAllSkillsSchema();
}

/**
 * Register a custom skill class with the global {@link SkillRegistry}.
 *
 * Equivalent to Python's `register_skill(skill_class)`. Allows third-party
 * code to register skills directly, bypassing the built-in directory scan.
 *
 * @param skillClass - Skill class to register (a subclass of {@link SkillBase}).
 */
export function registerSkill(skillClass: typeof _SkillBase): void {
  _SkillRegistry.getInstance().register(skillClass);
}

/**
 * Register a directory to search for additional skill modules.
 *
 * Equivalent to Python's `add_skill_directory(path)`. Proxies to
 * `SkillRegistry.addSearchPath()`. Callers who want on-disk dynamic
 * discovery can pair this with `SkillRegistry.discoverFromDirectory()`.
 *
 * @param path - Absolute path to a directory containing skill files.
 */
export function addSkillDirectory(path: string): void {
  _SkillRegistry.getInstance().addSearchPath(path);
}

/**
 * Start an agent's HTTP server.
 *
 * Equivalent to Python's `start_agent(agent)`. Delegates to `agent.serve(options)`.
 *
 * @param agent - The {@link AgentBase} instance to start.
 * @param options - Optional host / port overrides. When omitted, values come
 *   from the agent's constructor options or the `PORT` environment variable.
 * @returns Resolves once the HTTP server has begun listening.
 *
 * @example
 * ```ts
 * import { AgentBase, startAgent } from '@signalwire/sdk';
 *
 * const agent = new AgentBase({ name: 'demo' });
 * await startAgent(agent, { port: 3000 });
 * ```
 */
export async function startAgent(
  agent: _AgentBase,
  options?: { port?: number; host?: string },
): Promise<void> {
  return agent.serve(options);
}

/**
 * Run an agent's HTTP server.
 *
 * Alias for {@link startAgent} — equivalent to Python's `run_agent(agent)`.
 * Delegates to `agent.serve(options)`.
 *
 * @param agent - The {@link AgentBase} instance to run.
 * @param options - Optional host / port overrides. When omitted, values come
 *   from the agent's constructor options or the `PORT` environment variable.
 * @returns Resolves once the HTTP server has begun listening.
 *
 * @see {@link startAgent}
 */
export async function runAgent(
  agent: _AgentBase,
  options?: { port?: number; host?: string },
): Promise<void> {
  return agent.serve(options);
}
