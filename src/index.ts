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

// Host-app router type — the named cross-port return type of asRouter().
export type { HostAppRouter } from './web.js';

// Tool results & functions
export { FunctionResult } from './FunctionResult.js';
/** @deprecated Use {@link FunctionResult} instead. */
export { FunctionResult as SwaigFunctionResult } from './FunctionResult.js';
export type { PaymentPrompt, PaymentAction, PaymentParameter } from './FunctionResult.js';
export { SwaigFunction } from './SwaigFunction.js';
export type { SwaigHandler, SwaigFunctionOptions } from './SwaigFunction.js';

// Typed SWAIG tool-parameter builder (Tier-2 flagship affordance for the
// explicit-params path; byte-identical to the untyped `parameters` blob).
export {
  ParameterSchema,
  paramSchema,
  RECORD_FORMATS,
  RECORD_DIRECTIONS,
  TAP_DIRECTIONS,
  TAP_CODECS,
} from './ParameterSchema.js';
export type {
  ParameterType,
  ParameterProperty,
  ParameterSchemaObject,
  RecordFormat,
  RecordDirection,
  TapDirection,
  TapCodec,
} from './ParameterSchema.js';

// DataMap (server-side tools)
export {
  DataMap,
  createSimpleApiTool,
  createExpressionTool,
  setAllowedEnvPrefixes,
  getAllowedEnvPrefixes,
} from './DataMap.js';

// Prompt Object Model
export { PomBuilder, PomSection } from './PomBuilder.js';
export type { PomSectionData } from './PomBuilder.js';
export { PromptObjectModel, Section } from './POM/PromptObjectModel.js';
export type { SectionData } from './POM/PromptObjectModel.js';

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
  HISTORY_MODES,
} from './ContextBuilder.js';
export type { HistoryMode } from './ContextBuilder.js';

// Security
export { SessionManager } from './SessionManager.js';
export type { DebugTokenResult } from './SessionManager.js';

// SSL
export { SslConfig } from './SslConfig.js';
export type { SslOptions } from './SslConfig.js';

// Schema Validation
export { SchemaUtils, SchemaValidationError } from './SchemaUtils.js';
export type { ValidationResult } from './SchemaUtils.js';

// Auth
export { AuthHandler } from './AuthHandler.js';
export type { AuthConfig } from './AuthHandler.js';

// Type inference for typed tool handlers
export { inferSchema, createTypedHandlerWrapper, parseFunctionParams } from './TypeInference.js';
export type { InferredSchema, ParsedParam, TypedToolHandler } from './TypeInference.js';

// Security utilities
export {
  safeAssign,
  filterSensitiveHeaders,
  redactUrl,
  MAX_SKILL_INPUT_LENGTH,
  validateUrl,
  isServerlessMode,
} from './SecurityUtils.js';

// Webhook signature validation
export { validateWebhookSignature, validateRequest } from './WebhookValidator.js';
export type { FormParams, FormParamValue } from './WebhookValidator.js';
export {
  webhookValidationMiddleware,
  validate,
  SIGNALWIRE_SIGNATURE_HEADER,
  TWILIO_COMPAT_SIGNATURE_HEADER,
} from './WebhookMiddleware.js';
export type { WebhookValidationOptions, WebhookRejection } from './WebhookMiddleware.js';

// Config
export { ConfigLoader } from './ConfigLoader.js';

// Logging
export {
  Logger,
  getLogger,
  setGlobalLogLevel,
  suppressAllLogs,
  setGlobalLogFormat,
  setGlobalLogColor,
  setGlobalLogStream,
  resetLoggingConfiguration,
  getExecutionMode,
  stripControlChars,
} from './Logger.js';
export type { LogLevel } from './Logger.js';

// Serverless
export { ServerlessAdapter } from './ServerlessAdapter.js';
export type {
  ServerlessPlatform,
  ServerlessEvent,
  ServerlessResponse,
} from './ServerlessAdapter.js';

// Skills
export { SkillBase, SkillManager, SkillRegistry, defineSkillTool } from './skills/index.js';
export type {
  SkillConfig,
  SkillToolDefinition,
  SkillPromptSection,
  ParameterSchemaEntry,
  SkillSchemaInfo,
} from './skills/index.js';
export type { SkillName, SkillNameOrString } from './skills/index.js';

// Built-in Skills
export { registerBuiltinSkills } from './skills/builtin/index.js';
export {
  DateTimeSkill,
  MathSkill,
  JokeSkill,
  WeatherApiSkill,
  PlayBackgroundFileSkill,
  SwmlTransferSkill,
  ApiNinjasTriviaSkill,
  InfoGathererSkill,
  CustomSkillsSkill,
  WebSearchSkill,
  WikipediaSearchSkill,
  GoogleMapsSkill,
  DataSphereSkill,
  DataSphereServerlessSkill,
  NativeVectorSearchSkill,
  SpiderSkill,
  ClaudeSkillsSkill,
  AskClaudeSkill,
  McpGatewaySkill,
} from './skills/builtin/index.js';

// Agents
export { BedrockAgent, createBedrockAgent } from './agents/BedrockAgent.js';
export type { BedrockAgentConfig } from './agents/BedrockAgent.js';

// Prefab Agents
export {
  InfoGathererAgent,
  SurveyAgent,
  FAQBotAgent,
  ConciergeAgent,
  ReceptionistAgent,
} from './prefabs/index.js';
export type {
  InfoGathererConfig,
  InfoGathererQuestion,
  InfoGathererQuestionCallback,
  SurveyConfig,
  SurveyQuestion,
  FAQBotConfig,
  FAQEntry,
  ConciergeConfig,
  ReceptionistConfig,
  ReceptionistDepartment,
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

// Platform-contract types — the webhook bodies the backend POSTs, referenced by
// the public callback signatures above (DynamicConfigCallback → SwmlRequestData)
// so a subclass/override can name them.
export type { SwmlRequestData, SwmlRequestCall, SignalWireErrorBody } from './PlatformContracts.js';

// Typed SWAIG wire payloads (SWAIG_PIPELINE §4), generated from the authoritative
// porting-sdk/swaig-specs/ engine specs: SWAIG handlers receive `SwaigRequest`;
// `onSummary` / `SummaryCallback` receives the `PostPrompt` tree (its summary
// envelope is `PostPromptData`). Matches the Python reference's
// swaig_request_generated / post_prompt_generated modules.
export type { SwaigRequest, SwaigArgument, PostPrompt, PostPromptData } from './SwaigContracts.js';

// RELAY Client (real-time call/message control over WebSocket)
export * from './relay/index.js';

// REST Client (typed HTTP access to all SignalWire platform APIs)
export * from './rest/index.js';

// AI Chat Client (async JSON-RPC client for the SignalWire AI Chat service)
export * from './ai-chat/index.js';

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
 * scope (`new RestClient(...)`); this function offers the same factory-call
 * style as Python for users porting code across the two SDKs.
 *
 * Note: TypeScript exports the class `RestClient` at the same name from
 * `./rest/index.js`. The function below is named `restClient` (camelCase)
 * to avoid shadowing the class — use either `new RestClient(opts)` or
 * `restClient(opts)`; both construct the same client.
 *
 * The declared signature is the idiomatic TS form: a single, fully-typed
 * options object. This gives real compile-time safety on the credential
 * fields, unlike Python's untyped `(*args, **kwargs)`. For back-compat,
 * the legacy `restClient([], { project, token, host })` call form (a leading
 * positional array followed by the options) is still accepted at runtime.
 *
 * @param opts - Credentials/configuration. When omitted, reads
 *   `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_API_TOKEN`, and
 *   `SIGNALWIRE_SPACE` from the environment.
 * @returns A new {@link _RestClient} instance bound to the supplied (or
 *   environment-derived) credentials.
 *
 * @example
 * ```ts
 * import { restClient } from '@signalwire/sdk';
 *
 * const client = restClient({ project: 'p', token: 't', host: 'h.signalwire.com' });
 *
 * // Or using env vars:
 * const env = restClient();  // reads env vars
 * ```
 */

export function restClient(opts?: _ClientOptions): _RestClient {
  // Runtime back-compat: tolerate the legacy ``restClient([], { ...opts })``
  // shape (a leading positional array, with the real options as the second
  // argument). The DECLARED signature is the clean single-options form above;
  // this just keeps old call sites working.
  if (Array.isArray(opts)) {
    // eslint-disable-next-line prefer-rest-params
    const legacyKwargs = arguments[1] as _ClientOptions | undefined;
    return new _RestClient(legacyKwargs);
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
