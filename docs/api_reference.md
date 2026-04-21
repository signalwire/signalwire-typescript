# SignalWire AI Agents TypeScript SDK -- Complete API Reference

This document provides a comprehensive reference for all public APIs in the SignalWire AI Agents TypeScript SDK.

---

## Table of Contents

1. [AgentBase Class](#agentbase-class)
2. [AgentServer Class](#agentserver-class)
3. [FunctionResult Class](#functionresult-class)
4. [SwaigFunction Class](#swaigfunction-class)
5. [DataMap Class](#datamap-class)
6. [Context System](#context-system)
7. [PomBuilder Class](#pombuilder-class)
8. [SessionManager Class](#sessionmanager-class)
9. [Skills System](#skills-system)
10. [Prefab Agents](#prefab-agents)
11. [Utility Classes](#utility-classes)
12. [Types and Interfaces](#types-and-interfaces)

---

## AgentBase Class

```typescript
import { AgentBase } from '@signalwire/sdk';
```

Core agent class that composes an HTTP server, prompt management, session handling, SWAIG tool registry, and 5-phase SWML rendering into a single deployable unit.

### Constructor

```typescript
constructor(opts: AgentOptions)
```

Creates a new agent. See [AgentOptions](#agentoptions) for the full options table.

**Example:**

```typescript
const agent = new AgentBase({ name: 'MyAgent', route: '/agent' });
```

### Static Properties

#### `PROMPT_SECTIONS`

```typescript
static PROMPT_SECTIONS?: { title: string; body?: string; bullets?: string[]; numbered?: boolean }[]
```

Declarative prompt sections applied automatically by the constructor via `promptAddSection()`. Subclasses override this to define default prompt structure.

### Public Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Display name of this agent |
| `route` | `string` | HTTP route path this agent listens on |
| `host` | `string` | Hostname the HTTP server binds to |
| `port` | `number` | Port number the HTTP server listens on |
| `agentId` | `string` | Unique identifier for this agent instance |

### Prompt Methods

#### `setPromptText(text)`

```typescript
setPromptText(text: string): this
```

Set the main system prompt text. Bypasses POM rendering when set.

#### `setPostPrompt(text)`

```typescript
setPostPrompt(text: string): this
```

Set the post-prompt text evaluated after the call ends.

#### `promptAddSection(title, opts?)`

```typescript
promptAddSection(title: string, opts?: {
  body?: string;
  bullets?: string[];
  numbered?: boolean;
  numberedBullets?: boolean;
  subsections?: { title: string; body?: string; bullets?: string[] }[];
}): this
```

Add a new section to the POM prompt.

#### `promptAddToSection(title, opts?)`

```typescript
promptAddToSection(title: string, opts?: {
  body?: string;
  bullet?: string;
  bullets?: string[];
}): this
```

Append content to an existing prompt section.

#### `promptAddSubsection(parentTitle, title, opts?)`

```typescript
promptAddSubsection(parentTitle: string, title: string, opts?: {
  body?: string;
  bullets?: string[];
}): this
```

Add a subsection under an existing prompt section.

#### `promptHasSection(title)`

```typescript
promptHasSection(title: string): boolean
```

Check whether a prompt section with the given title exists.

#### `getPrompt()`

```typescript
getPrompt(): string
```

Get the fully rendered main prompt text.

#### `getPostPrompt()`

```typescript
getPostPrompt(): string | null
```

Get the post-prompt text, or `null` if not configured.

### Tool Methods

#### `defineTool(opts)`

```typescript
defineTool(opts: {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  handler: SwaigHandler;
  secure?: boolean;
  fillers?: Record<string, string[]>;
  waitFile?: string;
  waitFileLoops?: number;
  required?: string[];
}): this
```

Register a SWAIG tool the AI can invoke during a call.

**Example:**

```typescript
agent.defineTool({
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: { city: { type: 'string', description: 'City name' } },
  handler: async (args) => new FunctionResult(`Weather in ${args.city}: sunny`),
});
```

#### `getRegisteredTools()`

```typescript
getRegisteredTools(): { name: string; description: string; parameters: Record<string, unknown> }[]
```

Get a summary of all registered tools.

#### `getTool(name)`

```typescript
getTool(name: string): SwaigFunction | undefined
```

Look up a registered SwaigFunction by name.

#### `registerSwaigFunction(fn)`

```typescript
registerSwaigFunction(fn: SwaigFunction | Record<string, unknown>): this
```

Register a pre-built SwaigFunction instance or a raw function descriptor (e.g., from DataMap).

### Speech and Language Methods

#### `addHint(hint)`

```typescript
addHint(hint: string): this
```

Add a single speech recognition hint.

#### `addHints(hints)`

```typescript
addHints(hints: string[]): this
```

Add multiple speech recognition hints.

#### `addPatternHint(pattern)`

```typescript
addPatternHint(pattern: { pattern: string; replace: string; ignoreCase?: boolean }): this
```

Add a pattern-based hint for ASR post-processing.

#### `addLanguage(config)`

```typescript
addLanguage(config: LanguageConfig): this
```

Add a supported language. See [LanguageConfig](#languageconfig).

#### `setLanguages(configs)`

```typescript
setLanguages(configs: LanguageConfig[]): this
```

Replace all configured languages.

#### `addPronunciation(rule)`

```typescript
addPronunciation(rule: PronunciationRule): this
```

Add a TTS pronunciation override rule.

### AI Configuration Methods

#### `setParam(key, value)`

```typescript
setParam(key: string, value: unknown): this
```

Set a single AI parameter (e.g., `temperature`, `top_p`).

#### `setParams(params)`

```typescript
setParams(params: Record<string, unknown>): this
```

Set multiple AI parameters at once.

#### `setGlobalData(data)`

```typescript
setGlobalData(data: Record<string, unknown>): this
```

Replace the entire global data object.

#### `updateGlobalData(data)`

```typescript
updateGlobalData(data: Record<string, unknown>): this
```

Merge entries into the existing global data.

#### `addFunctionInclude(include)`

```typescript
addFunctionInclude(include: FunctionInclude): this
```

Add a remote SWAIG function include reference.

#### `setNativeFunctions(functions)`

```typescript
setNativeFunctions(functions: string[]): this
```

Set the list of native function names.

#### `setPromptLlmParams(params)`

```typescript
setPromptLlmParams(params: Record<string, unknown>): this
```

Set LLM parameters specific to the main prompt.

#### `setPostPromptLlmParams(params)`

```typescript
setPostPromptLlmParams(params: Record<string, unknown>): this
```

Set LLM parameters specific to the post-prompt.

#### `addFillers(fillers)`

```typescript
addFillers(fillers: Record<string, string[]>): this
```

Add internal filler phrases keyed by language code.

#### `enableDebugEvents(level?)`

```typescript
enableDebugEvents(level?: number): this
```

Enable debug event webhooks. Level ranges from 1-3 (default: 1).

### Call Flow Methods

#### `addPreAnswerVerb(verb, config)`

```typescript
addPreAnswerVerb(verb: string, config: Record<string, unknown>): this
```

Add a verb to Phase 1 (before answering).

#### `addAnswerVerb(config?)`

```typescript
addAnswerVerb(config?: Record<string, unknown>): this
```

Set the answer verb configuration for Phase 2.

#### `addPostAnswerVerb(verb, config)`

```typescript
addPostAnswerVerb(verb: string, config: Record<string, unknown>): this
```

Add a verb to Phase 3 (after answering, before AI).

#### `addPostAiVerb(verb, config)`

```typescript
addPostAiVerb(verb: string, config: Record<string, unknown>): this
```

Add a verb to Phase 5 (after the AI session).

#### `clearPreAnswerVerbs()`

```typescript
clearPreAnswerVerbs(): this
```

Remove all Phase 1 verbs.

#### `clearPostAnswerVerbs()`

```typescript
clearPostAnswerVerbs(): this
```

Remove all Phase 3 verbs.

#### `clearPostAiVerbs()`

```typescript
clearPostAiVerbs(): this
```

Remove all Phase 5 verbs.

### Context Methods

#### `defineContexts(contexts?)`

```typescript
defineContexts(contexts?: ContextBuilder | Record<string, unknown>): ContextBuilder
```

Define or replace the contexts configuration. Returns the active `ContextBuilder`.

### Skill Methods

#### `addSkill(skill)`

```typescript
addSkill(skill: SkillBase): Promise<this>
```

Add a skill to the agent. Validates environment variables, calls `setup()`, and registers all skill tools, hints, prompt sections, and global data.

#### `removeSkill(name)`

```typescript
removeSkill(name: string): this
```

Remove a loaded skill by name.

#### `listSkills()`

```typescript
listSkills(): Array<{ name: string; version: string; description: string }>
```

List metadata for all loaded skills.

#### `hasSkill(name)`

```typescript
hasSkill(name: string): boolean
```

Check whether a skill is currently loaded.

### Dynamic Configuration Methods

#### `setDynamicConfigCallback(callback)`

```typescript
setDynamicConfigCallback(callback: DynamicConfigCallback): this
```

Set a callback invoked on each SWML request with an ephemeral agent copy.

#### `addSwaigQueryParams(params)`

```typescript
addSwaigQueryParams(params: Record<string, string>): this
```

Append custom query parameters to all SWAIG webhook URLs.

### URL and Proxy Methods

#### `setWebHookUrl(url)`

```typescript
setWebHookUrl(url: string): this
```

Override the auto-generated SWAIG webhook URL.

#### `setPostPromptUrl(url)`

```typescript
setPostPromptUrl(url: string): this
```

Override the auto-generated post-prompt webhook URL.

#### `manualSetProxyUrl(url)`

```typescript
manualSetProxyUrl(url: string): this
```

Manually set the external proxy URL for webhook generation.

#### `getFullUrl(includeAuth?)`

```typescript
getFullUrl(includeAuth?: boolean): string
```

Get the full URL including route, optionally with embedded auth credentials.

### Server Methods

#### `serve(host?, port?)`

```typescript
serve(host?: string, port?: number): Promise<void>
```

Start the HTTP server. Alias: `run()`.

#### `run(host?, port?)`

```typescript
run(host?: string, port?: number): Promise<void>
```

Start the HTTP server. Same as `serve()`.

#### `getApp()`

```typescript
getApp(): Hono
```

Get the underlying Hono application instance. Useful for testing or custom middleware.

### Utility Methods

#### `getBasicAuthCredentials(includeSource?)`

```typescript
getBasicAuthCredentials(includeSource?: boolean):
  [string, string] | [string, string, 'provided' | 'environment' | 'generated']
```

Get the current basic auth credentials and optionally the credential source.

#### `renderSwml(callId?)`

```typescript
renderSwml(callId?: string): string
```

Render the complete SWML document as a JSON string.

### Protected Hooks

These methods can be overridden in subclasses.

#### `defineTools()`

```typescript
protected defineTools(): void
```

Called explicitly by the subclass constructor to register tools.

#### `onSummary(summary, rawData)`

```typescript
protected onSummary(
  summary: Record<string, unknown> | null,
  rawData: Record<string, unknown>,
): void | Promise<void>
```

Called when a post-prompt summary is received.

#### `onFunctionCall(name, args, rawData)`

```typescript
protected onFunctionCall(
  name: string,
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
): void | Promise<void>
```

Called before each SWAIG function handler executes.

#### `onSwmlRequest(rawData)`

```typescript
protected onSwmlRequest(
  rawData: Record<string, unknown>,
): void | Promise<void>
```

Called on every SWML request before rendering.

#### `onDebugEvent(event)`

```typescript
protected onDebugEvent(
  event: Record<string, unknown>,
): void | Promise<void>
```

Called when a debug event webhook is received.

#### `validateBasicAuth(username, password)`

```typescript
protected validateBasicAuth(
  username: string,
  password: string,
): boolean | Promise<boolean>
```

Override to add custom auth validation logic.

---

## AgentServer Class

```typescript
import { AgentServer } from '@signalwire/sdk';
```

Hosts multiple `AgentBase` instances on a single HTTP server.

### Constructor

```typescript
constructor(opts?: { host?: string; port?: number })
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `register(agent: AgentBase, route?: string): void` | Mount an agent at a route. Throws if route is in use. |
| `unregister` | `unregister(route: string): void` | Remove an agent by route. |
| `getAgents` | `getAgents(): Map<string, AgentBase>` | All registered agents. |
| `getAgent` | `getAgent(route: string): AgentBase \| undefined` | Look up agent by route. |
| `getApp` | `getApp(): Hono` | The underlying Hono application. |
| `run` | `run(host?: string, port?: number): Promise<void>` | Start the server. |
| `registerSipUsername` | `registerSipUsername(username: string, route: string): void` | Map a SIP username to an agent route. |

---

## FunctionResult Class

```typescript
import { FunctionResult } from '@signalwire/sdk';
```

Fluent builder for SWAIG function responses.

### Constructor

```typescript
constructor(response?: string, postProcess?: boolean)
```

### Core Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setResponse` | `(text: string): this` | Set response text. |
| `setPostProcess` | `(val: boolean): this` | Enable/disable post-processing. |
| `addAction` | `(name: string, data: unknown): this` | Append a named action. |
| `addActions` | `(actions: Record<string, unknown>[]): this` | Append multiple actions. |
| `toDict` | `(): Record<string, unknown>` | Serialize to wire format. |

### Call Control Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `connect` | `(dest: string, final?: boolean, from?: string): this` | Transfer the call. |
| `swmlTransfer` | `(swml: unknown): this` | Transfer via SWML document. |
| `hangup` | `(): this` | Hang up the call. |
| `hold` | `(timeout?: number): this` | Place call on hold (0-900s). |
| `waitForUser` | `(opts?: Record<string, unknown>): this` | Wait for user input. |
| `stop` | `(): this` | Stop the AI session. |

### Audio Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `say` | `(text: string): this` | Speak text via TTS. |
| `playBackgroundFile` | `(url: string, wait?: boolean): this` | Play background audio. |
| `stopBackgroundFile` | `(): this` | Stop background audio. |

### Speech Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `addDynamicHints` | `(hints: string[]): this` | Add runtime ASR hints. |
| `clearDynamicHints` | `(): this` | Remove all dynamic hints. |
| `setEndOfSpeechTimeout` | `(ms: number): this` | Set end-of-speech timeout. |
| `setSpeechEventTimeout` | `(ms: number): this` | Set speech event timeout. |

### Data Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `updateGlobalData` | `(data: Record<string, unknown>): this` | Merge into global data. |
| `removeGlobalData` | `(keys: string[]): this` | Remove keys from global data. |
| `setMetadata` | `(data: Record<string, unknown>): this` | Set call metadata. |
| `removeMetadata` | `(keys: string[]): this` | Remove metadata keys. |

### SWML Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `executeSwml` | `(swml: unknown, transfer?: boolean): this` | Execute SWML content. |
| `switchContext` | `(opts: Record<string, unknown>): this` | Switch AI context. |
| `swmlChangeStep` | `(step: string): this` | Navigate to a step. |
| `swmlChangeContext` | `(context: string, step?: string): this` | Navigate to a context. |
| `swmlUserEvent` | `(event: Record<string, unknown>): this` | Fire a user event. |

### Function Control Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `toggleFunctions` | `(toggles: Record<string, boolean>): this` | Enable/disable functions. |
| `enableFunctionsOnTimeout` | `(fns: string[], timeout: number): this` | Re-enable functions after timeout. |
| `updateSettings` | `(settings: Record<string, unknown>): this` | Update AI settings. |

### Communication Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `sendSms` | `(opts: Record<string, unknown>): this` | Send SMS/MMS. |
| `recordCall` | `(opts?: Record<string, unknown>): this` | Start recording. |
| `stopRecordCall` | `(): this` | Stop recording. |
| `tap` | `(opts: Record<string, unknown>): this` | Start call tapping. |
| `stopTap` | `(): this` | Stop call tapping. |
| `sipRefer` | `(to: string): this` | SIP REFER transfer. |

### Room and Conference Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `joinRoom` | `(opts: Record<string, unknown>): this` | Join a video room. |
| `joinConference` | `(opts: Record<string, unknown>): this` | Join a conference. |

### RPC Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `executeRpc` | `(method: string, params?: Record<string, unknown>): this` | Execute a JSON-RPC call. |
| `rpcDial` | `(opts: Record<string, unknown>): this` | RPC-based dialing. |
| `rpcAiMessage` | `(message: string): this` | Inject an AI message. |
| `rpcAiUnhold` | `(): this` | Unhold via RPC. |

### Payment Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `pay` | `(opts: Record<string, unknown>): this` | Initiate payment flow. |

### Static Helpers

```typescript
static createPaymentPrompt(opts: PaymentPrompt): string
static createPaymentAction(opts: PaymentAction): Record<string, unknown>
static createPaymentParameter(opts: PaymentParameter): Record<string, unknown>
```

---

## SwaigFunction Class

```typescript
import { SwaigFunction } from '@signalwire/sdk';
```

Wraps a tool handler with metadata for SWAIG registration.

### Constructor

```typescript
constructor(opts: SwaigFunctionOptions)
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Tool name. |
| `handler` | `SwaigHandler` | The callback function. |
| `description` | `string` | Description shown to the AI. |
| `parameters` | `Record<string, unknown>` | JSON Schema for arguments. |
| `secure` | `boolean` | Whether HMAC token is required. |
| `fillers` | `Record<string, string[]>` | Per-language filler phrases. |
| `waitFile` | `string` | Audio file URL to play while executing. |
| `waitFileLoops` | `number` | Loop count for wait file. |
| `required` | `string[]` | Required parameter names. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `execute` | `(args: Record<string, unknown>, rawData: Record<string, unknown>): Promise<Record<string, unknown>>` | Invoke the handler and normalize the result. |
| `toSwaig` | `(baseUrl: string, token?: string, callId?: string): Record<string, unknown>` | Serialize to SWAIG wire format for SWML. |

---

## DataMap Class

```typescript
import { DataMap } from '@signalwire/sdk';
```

Fluent builder for server-side SWAIG tools that execute on SignalWire without webhook callbacks.

### Constructor

```typescript
constructor(functionName: string)
```

### Configuration Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `purpose` | `(desc: string): this` | Set the tool description. |
| `description` | `(desc: string): this` | Alias for `purpose()`. |
| `parameter` | `(name: string, type: string, desc: string, opts?: { required?: boolean; enum?: string[] }): this` | Add a parameter. |

### Webhook Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `webhook` | `(method: string, url: string, opts?: { headers?: Record<string, string> }): this` | Configure an HTTP webhook call. |
| `body` | `(body: Record<string, unknown>): this` | Set the webhook request body. |
| `params` | `(params: Record<string, string>): this` | Set webhook query parameters. |
| `webhookExpressions` | `(expressions: Array<{ pattern: string; output: FunctionResult }>): this` | Add response-matching expressions. |
| `foreach` | `(arrayPath: string, template: string): this` | Iterate over an array in the response. |

### Output Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `output` | `(result: FunctionResult): this` | Set the success output template. |
| `fallbackOutput` | `(result: FunctionResult): this` | Set the fallback output when webhooks fail. |
| `errorKeys` | `(keys: string[]): this` | Keys that indicate an error in the response. |
| `globalErrorKeys` | `(keys: string[]): this` | Global error indicator keys. |

### Expression Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `expression` | `(testValue: string, pattern: string, output: FunctionResult): this` | Add a pattern-matching expression. |

### Environment and Registration

| Method | Signature | Description |
|--------|-----------|-------------|
| `enableEnvExpansion` | `(): this` | Allow `${ENV.VAR}` expansion in templates. |
| `registerWithAgent` | `(agent: AgentBase): void` | Register this DataMap tool with an agent. |
| `toSwaigFunction` | `(): Record<string, unknown>` | Serialize to SWAIG wire format. |

### Factory Functions

```typescript
import { createSimpleApiTool, createExpressionTool } from '@signalwire/sdk';

const apiTool = createSimpleApiTool({
  name: 'get_joke',
  url: 'https://api.example.com/joke',
  responseTemplate: 'Here is a joke: ${joke}',
});

const exprTool = createExpressionTool({
  name: 'classify_input',
  testValue: '${args.input}',
  expressions: [
    { pattern: 'urgent|emergency', output: new FunctionResult('High priority') },
    { pattern: '.*', output: new FunctionResult('Normal priority') },
  ],
});
```

---

## Context System

```typescript
import { ContextBuilder, Context, Step, GatherInfo, GatherQuestion, createSimpleContext } from '@signalwire/sdk';
```

### ContextBuilder

| Method | Signature | Description |
|--------|-----------|-------------|
| `addContext` | `(name: string): Context` | Create and return a new context. |
| `getContext` | `(name: string): Context \| undefined` | Look up a context by name. |
| `validate` | `(): void` | Validate all cross-references and rules. |
| `toDict` | `(): Record<string, unknown>[]` | Serialize all contexts to SWML format. |

### Context

| Method | Signature | Description |
|--------|-----------|-------------|
| `addStep` | `(name: string): Step` | Add a new step to this context. |
| `getStep` | `(name: string): Step \| undefined` | Look up a step by name. |
| `removeStep` | `(name: string): void` | Remove a step. |
| `moveStep` | `(name: string, newIndex: number): void` | Reorder a step. |
| `setPrompt` | `(text: string): this` | Set the context-level prompt. |
| `setSystemPrompt` | `(text: string): this` | Set the system prompt for this context. |
| `setFillers` | `(fillers: Record<string, string[]>): this` | Set filler phrases. |
| `toDict` | `(): Record<string, unknown>` | Serialize to SWML format. |

### Step

| Method | Signature | Description |
|--------|-----------|-------------|
| `setText` | `(text: string): this` | Set step prompt text. |
| `addSection` | `(title: string, opts?: { body?: string; bullets?: string[] }): this` | Add a POM section. |
| `setCriteria` | `(criteria: string): this` | Set completion criteria. |
| `setFunctions` | `(fns: string[]): this` | Restrict available functions. |
| `setValidSteps` | `(steps: string[]): this` | Set allowed next steps. |
| `setValidContexts` | `(contexts: string[]): this` | Set allowed next contexts. |
| `setEnd` | `(end: boolean): this` | Mark as an end state. |
| `setGatherInfo` | `(info: GatherInfo): this` | Attach structured data collection. |
| `setResetOnEntry` | `(reset: boolean): this` | Reset step state on re-entry. |
| `setFillers` | `(fillers: Record<string, string[]>): this` | Set step-level fillers. |
| `toDict` | `(): Record<string, unknown>` | Serialize to SWML format. |

### GatherInfo / GatherQuestion

```typescript
const gather = new GatherInfo()
  .addQuestion(
    new GatherQuestion('name')
      .setQuestion('What is your name?')
      .setDescription('Customer full name')
  )
  .addQuestion(
    new GatherQuestion('email')
      .setQuestion('What is your email address?')
      .setDescription('Customer email')
      .setValidation('^[^@]+@[^@]+$')
  );

step.setGatherInfo(gather);
```

### createSimpleContext

```typescript
const cb = createSimpleContext({
  name: 'default',
  steps: [
    { name: 'greeting', text: 'Welcome! How can I help?' },
    { name: 'resolve', text: 'I will resolve your issue.', end: true },
  ],
});
```

---

## PomBuilder Class

```typescript
import { PomBuilder, PomSection } from '@signalwire/sdk';
```

Builds structured Markdown prompts from titled sections.

### PomBuilder Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addSection` | `(title: string, opts?: PomSectionData): void` | Add a top-level section. |
| `addToSection` | `(title: string, opts?: { body?: string; bullet?: string; bullets?: string[] }): void` | Append to a section. |
| `addSubsection` | `(parentTitle: string, title: string, opts?: { body?: string; bullets?: string[] }): void` | Add a nested subsection. |
| `hasSection` | `(title: string): boolean` | Check for a section. |
| `renderMarkdown` | `(): string` | Render all sections as Markdown. |

---

## SessionManager Class

```typescript
import { SessionManager } from '@signalwire/sdk';
```

Stateless HMAC-SHA256 token manager for secure tool invocations.

### Constructor

```typescript
constructor(tokenExpirySecs?: number)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `generateToken` | `(functionName: string, callId: string): string` | Generate a base64url-encoded HMAC token. |
| `validateToken` | `(callId: string, functionName: string, token: string): boolean` | Validate a token's signature, expiry, and bindings. |
| `debugToken` | `(token: string): Record<string, unknown>` | Decode a token without validation (for debugging). |
| `setSessionMetadata` | `(sessionId: string, metadata: Record<string, unknown>): void` | Store per-session metadata. |
| `getSessionMetadata` | `(sessionId: string): Record<string, unknown> \| undefined` | Retrieve session metadata. |
| `deleteSessionMetadata` | `(sessionId: string): boolean` | Remove session metadata. |

---

## Skills System

```typescript
import { SkillBase, SkillManager, SkillRegistry } from '@signalwire/sdk';
```

### SkillBase

Abstract base class for skills. Key methods:

| Method | Returns | Description |
|--------|---------|-------------|
| `registerTools()` | `SkillToolRegistration[]` | Define the tools this skill provides. |
| `getHints()` | `string[]` | Speech recognition hints. |
| `getPromptSections()` | Section array | Prompt sections for the agent. |
| `getGlobalData()` | `Record<string, unknown>` | Global data to merge. |
| `setup()` | `Promise<void>` | Async initialization. |
| `teardown()` | `Promise<void>` | Cleanup on shutdown. |

### SkillRegistry

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(name: string, factory: SkillFactory): void` | Register a skill factory. |
| `listSkills` | `(): SkillSchemaInfo[]` | List all registered skills. |
| `getParameterSchema` | `(name: string): Record<string, ParameterSchemaEntry>` | Get a skill's config schema. |

### Built-in Skills

| Skill | Tool(s) | Required Env Vars |
|-------|---------|-------------------|
| `DateTimeSkill` | `get_current_time`, `get_current_date` | -- |
| `MathSkill` | `calculate` | -- |
| `JokeSkill` | `tell_joke` | -- |
| `WeatherApiSkill` | `get_weather` | `WEATHER_API_KEY` |
| `WebSearchSkill` | `web_search` | `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID` |
| `WikipediaSearchSkill` | `search_wiki` | -- |
| `GoogleMapsSkill` | `lookup_address`, `compute_route` | `GOOGLE_MAPS_API_KEY` |
| `SpiderSkill` | `scrape_url` | -- |
| `DataSphereSkill` | `search_datasphere` | `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN` |
| `DataSphereServerlessSkill` | `search_datasphere` | `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN` |
| `SwmlTransferSkill` | `transfer_call` | -- |
| `PlayBackgroundFileSkill` | `play_background_file`, `stop_background_file` | -- |
| `ApiNinjasTriviaSkill` | `get_trivia` | `API_NINJAS_KEY` |
| `NativeVectorSearchSkill` | `search_knowledge` | -- |
| `InfoGathererSkill` | `start_questions`, `submit_answer` | -- |
| `ClaudeSkillsSkill` | *(from SKILL.md)* | -- |
| `McpGatewaySkill` | *(MCP bridge)* | -- |
| `CustomSkillsSkill` | *(from config)* | -- |

---

## Prefab Agents

```typescript
import {
  InfoGathererAgent, SurveyAgent, FAQBotAgent,
  ConciergeAgent, ReceptionistAgent,
} from '@signalwire/sdk';
```

### InfoGathererAgent

```typescript
const agent = new InfoGathererAgent({
  name: 'info-gatherer',
  questions: [
    { key_name: 'name', question_text: 'What is your name?' },
    { key_name: 'email', question_text: 'What is your email?', confirm: true },
  ],
});
```

### SurveyAgent

```typescript
const agent = new SurveyAgent({
  name: 'survey',
  questions: [
    { text: 'Rate our service 1-10', field: 'rating', type: 'number', min: 1, max: 10 },
  ],
});
```

### FAQBotAgent

```typescript
const agent = new FAQBotAgent({
  name: 'faq',
  faqs: [
    { question: 'What are your hours?', answer: 'We are open 9am-5pm EST.' },
    { question: 'How do I return an item?', answer: 'Visit our returns page.' },
  ],
});
```

### ConciergeAgent

```typescript
const agent = new ConciergeAgent({
  name: 'concierge',
  venueName: 'Grand Hotel',
  services: ['room service', 'spa', 'restaurant reservations'],
  amenities: {
    pool: { hours: '7 AM - 10 PM', location: '2nd Floor' },
    gym: { hours: '24 hours', location: '3rd Floor' },
  },
});
```

### ReceptionistAgent

```typescript
const agent = new ReceptionistAgent({
  name: 'receptionist',
  departments: [
    { name: 'Sales', number: '+15551001000' },
    { name: 'Support', number: '+15551002000' },
  ],
});
```

---

## Utility Classes

### AuthHandler

```typescript
import { AuthHandler } from '@signalwire/sdk';

const auth = new AuthHandler({
  bearerToken: 'my-token',
  apiKey: 'my-api-key',
  basicAuth: ['admin', 'password'],
  customValidator: async (req) => req.headers['x-internal'] === 'trusted',
});
```

### ConfigLoader

```typescript
import { ConfigLoader } from '@signalwire/sdk';

const config = ConfigLoader.load('agent-config.json');
```

### Logger

```typescript
import { getLogger, setGlobalLogLevel } from '@signalwire/sdk';

setGlobalLogLevel('debug');
const log = getLogger('MyComponent');
log.info('Hello');
log.debug('Debug info');
log.warn('Warning');
log.error('Error occurred');
```

### SslConfig

```typescript
import { SslConfig } from '@signalwire/sdk';

const ssl = new SslConfig({
  enabled: true,
  certPath: '/etc/ssl/certs/agent.pem',
  keyPath: '/etc/ssl/private/agent-key.pem',
  domain: 'agent.example.com',
});
```

### ServerlessAdapter

```typescript
import { ServerlessAdapter } from '@signalwire/sdk';

const adapter = new ServerlessAdapter(agent);
// AWS Lambda
export const handler = adapter.toLambdaHandler();
// Google Cloud Functions
export const handler = adapter.toGcfHandler();
```

---

## Types and Interfaces

### AgentOptions

```typescript
interface AgentOptions {
  name: string;
  route?: string;            // default: "/"
  host?: string;             // default: "0.0.0.0"
  port?: number;             // default: env PORT or 3000
  basicAuth?: [string, string];
  usePom?: boolean;          // default: true
  tokenExpirySecs?: number;  // default: 3600
  autoAnswer?: boolean;      // default: true
  recordCall?: boolean;      // default: false
  recordFormat?: string;     // default: "mp4"
  recordStereo?: boolean;    // default: true
  defaultWebhookUrl?: string;
  nativeFunctions?: string[];
  agentId?: string;
  suppressLogs?: boolean;    // default: false
}
```

### LanguageConfig

```typescript
interface LanguageConfig {
  name: string;
  code: string;
  voice?: string;
  engine?: string;
  fillers?: Record<string, string[]>;
  speechModel?: string;
  functionFillers?: Record<string, Record<string, string[]>>;
}
```

### PronunciationRule

```typescript
interface PronunciationRule {
  replace: string;
  with: string;
  ignoreCase?: boolean;
}
```

### FunctionInclude

```typescript
interface FunctionInclude {
  url: string;
  functions: string[];
  meta_data?: Record<string, unknown>;
}
```

### DynamicConfigCallback

```typescript
type DynamicConfigCallback = (
  queryParams: Record<string, string>,
  bodyParams: Record<string, unknown>,
  headers: Record<string, string>,
  agent: unknown,
) => void | Promise<void>;
```

### SummaryCallback

```typescript
type SummaryCallback = (
  summary: Record<string, unknown> | null,
  rawData: Record<string, unknown>,
) => void | Promise<void>;
```

### SwaigHandler

```typescript
type SwaigHandler = (
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
) => FunctionResult | Record<string, unknown> | string
   | Promise<FunctionResult | Record<string, unknown> | string>;
```

### SwaigFunctionOptions

```typescript
interface SwaigFunctionOptions {
  name: string;
  description: string;
  handler: SwaigHandler;
  parameters?: Record<string, unknown>;
  secure?: boolean;
  fillers?: Record<string, string[]>;
  waitFile?: string;
  waitFileLoops?: number;
  required?: string[];
}
```

### AuthConfig

```typescript
interface AuthConfig {
  bearerToken?: string;
  apiKey?: string;
  basicAuth?: [string, string];
  customValidator?: (req: unknown) => boolean | Promise<boolean>;
}
```

### SslOptions

```typescript
interface SslOptions {
  enabled?: boolean;
  certPath?: string;
  keyPath?: string;
  domain?: string;
  hsts?: boolean;          // default: true
  hstsMaxAge?: number;     // default: 31536000
}
```
