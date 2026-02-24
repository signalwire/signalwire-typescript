/**
 * SignalWire AI Agents SDK for TypeScript
 *
 * Build AI voice agents as HTTP microservices that serve SWML documents
 * and handle SWAIG function callbacks.
 */

// Core agent
export { AgentBase } from './AgentBase.js';
export { AgentServer } from './AgentServer.js';

// Tool results & functions
export { SwaigFunctionResult } from './SwaigFunctionResult.js';
export type { PaymentPrompt, PaymentAction, PaymentParameter } from './SwaigFunctionResult.js';
export { SwaigFunction } from './SwaigFunction.js';
export type { SwaigHandler, SwaigFunctionOptions } from './SwaigFunction.js';

// DataMap (server-side tools)
export { DataMap, createSimpleApiTool, createExpressionTool } from './DataMap.js';

// Prompt Object Model
export { PomBuilder, PomSection } from './PomBuilder.js';
export type { PomSectionData } from './PomBuilder.js';

// SWML builder
export { SwmlBuilder } from './SwmlBuilder.js';

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

// Logging
export { Logger, getLogger, setGlobalLogLevel, suppressAllLogs } from './Logger.js';

// Types
export type {
  AgentOptions,
  LanguageConfig,
  PronunciationRule,
  FunctionInclude,
  DynamicConfigCallback,
  SummaryCallback,
} from './types.js';
