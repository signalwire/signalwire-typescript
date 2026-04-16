/**
 * SignalWire AI Agents SDK for TypeScript
 *
 * Build AI voice agents as HTTP microservices that serve SWML documents
 * and handle SWAIG function callbacks.
 */

// Core agent
export { AgentBase } from './AgentBase.js';
export type { RoutingCallback } from './AgentBase.js';
export { AgentServer } from './AgentServer.js';

// SWML Service (non-AI call flows)
export { SWMLService, SecurityConfig, VerbHandlerRegistry } from './SWMLService.js';
export type { OnRequestCallback, SWMLServiceOptions, SWMLVerbHandler } from './SWMLService.js';

// Web Service (static file serving)
export { WebService } from './WebService.js';
export type { WebServiceOptions } from './WebService.js';

// Tool results & functions
export { FunctionResult } from './FunctionResult.js';
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
export { safeAssign, filterSensitiveHeaders, redactUrl, MAX_SKILL_INPUT_LENGTH, validateUrl } from './SecurityUtils.js';

// Config
export { ConfigLoader } from './ConfigLoader.js';

// Logging
export { Logger, getLogger, setGlobalLogLevel, suppressAllLogs, setGlobalLogFormat, setGlobalLogColor, setGlobalLogStream, resetLoggingConfiguration, getExecutionMode, stripControlChars } from './Logger.js';

// Serverless
export { ServerlessAdapter } from './ServerlessAdapter.js';
export type { ServerlessPlatform, ServerlessEvent, ServerlessResponse } from './ServerlessAdapter.js';

// Skills
export { SkillBase, SkillManager, SkillRegistry } from './skills/index.js';
export type { SkillConfig, SkillToolDefinition, SkillPromptSection, SkillManifest, SkillFactory, ParameterSchemaEntry, SkillSchemaInfo } from './skills/index.js';

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
  InfoGathererConfig, SurveyConfig, FAQBotConfig,
  ConciergeConfig, ReceptionistConfig,
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

/**
 * Start an agent's HTTP server.
 *
 * Equivalent to Python's `start_agent(agent)`. Delegates to `agent.serve(options)`.
 *
 * @param agent   The AgentBase instance to start.
 * @param options Optional host/port overrides.
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
 * @param agent   The AgentBase instance to run.
 * @param options Optional host/port overrides.
 */
export async function runAgent(
  agent: _AgentBase,
  options?: { port?: number; host?: string },
): Promise<void> {
  return agent.serve(options);
}
