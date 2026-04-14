# API Reference

Complete reference for every exported class, interface, type, and function in the SignalWire AI Agents TypeScript SDK.

---

## Table of Contents

- [AgentBase](#agentbase)
  - [Constructor](#agentbase-constructor)
  - [Static Properties](#agentbase-static-properties)
  - [Public Properties](#agentbase-public-properties)
  - [Prompt Methods](#prompt-methods)
  - [Tool Methods](#tool-methods)
  - [Speech and Language Methods](#speech-and-language-methods)
  - [AI Configuration Methods](#ai-configuration-methods)
  - [Call Flow Methods](#call-flow-methods)
  - [Context Methods](#context-methods)
  - [Skill Methods](#skill-methods)
  - [Dynamic Configuration Methods](#dynamic-configuration-methods)
  - [URL and Proxy Methods](#url-and-proxy-methods)
  - [Server Methods](#server-methods)
  - [Utility Methods](#utility-methods)
  - [Protected Hooks](#protected-hooks)
- [AgentServer](#agentserver)
- [FunctionResult](#swaigfunctionresult)
  - [Constructor](#swaigfunctionresult-constructor)
  - [Core Methods](#swaigfunctionresult-core-methods)
  - [Call Control Actions](#call-control-actions)
  - [Audio Actions](#audio-actions)
  - [Speech Actions](#speech-actions)
  - [Data Actions](#data-actions)
  - [SWML Actions](#swml-actions)
  - [Function Actions](#function-actions)
  - [Communication Actions](#communication-actions)
  - [Room and Conference Actions](#room-and-conference-actions)
  - [RPC Actions](#rpc-actions)
  - [Payment Actions](#payment-actions)
  - [Static Helpers](#swaigfunctionresult-static-helpers)
  - [Serialization](#swaigfunctionresult-serialization)
- [SwaigFunction](#swaigfunction)
- [DataMap](#datamap)
  - [Constructor](#datamap-constructor)
  - [Configuration Methods](#datamap-configuration-methods)
  - [Webhook Methods](#datamap-webhook-methods)
  - [Output Methods](#datamap-output-methods)
  - [Registration and Serialization](#datamap-registration-and-serialization)
  - [Factory Functions](#datamap-factory-functions)
- [ContextBuilder](#contextbuilder)
  - [ContextBuilder Class](#contextbuilder-class)
  - [Context Class](#context-class)
  - [Step Class](#step-class)
  - [GatherInfo Class](#gatherinfo-class)
  - [GatherQuestion Class](#gatherquestion-class)
  - [Helper Functions](#contextbuilder-helper-functions)
- [PomBuilder](#pombuilder)
  - [PomSection Class](#pomsection-class)
  - [PomBuilder Class](#pombuilder-class)
- [SwmlBuilder](#swmlbuilder)
- [PromptManager](#promptmanager)
- [SessionManager](#sessionmanager)
- [Skills](#skills)
  - [SkillBase](#skillbase)
  - [SkillManager](#skillmanager)
  - [SkillRegistry](#skillregistry)
- [Prefab Agents](#prefab-agents)
  - [InfoGathererAgent](#infogathereragent)
  - [SurveyAgent](#surveyagent)
  - [FAQBotAgent](#faqbotagent)
  - [ConciergeAgent](#conciergeagent)
  - [ReceptionistAgent](#receptionistagent)
- [Utility Classes](#utility-classes)
  - [AuthHandler](#authhandler)
  - [ConfigLoader](#configloader)
  - [Logger](#logger)
  - [SslConfig](#sslconfig)
  - [SchemaUtils](#schemautils)
  - [ServerlessAdapter](#serverlessadapter)
- [Types and Interfaces](#types-and-interfaces)
  - [AgentOptions](#agentoptions)
  - [LanguageConfig](#languageconfig)
  - [PronunciationRule](#pronunciationrule)
  - [FunctionInclude](#functioninclude)
  - [DynamicConfigCallback](#dynamicconfigcallback)
  - [SummaryCallback](#summarycallback)
  - [SwaigHandler](#swaighandler)
  - [SwaigFunctionOptions](#swaigfunctionoptions)
  - [AuthConfig](#authconfig)
  - [SslOptions](#ssloptions)
  - [ValidationResult](#validationresult)
  - [ServerlessEvent](#serverlessevent)
  - [ServerlessResponse](#serverlessresponse)
  - [PomSectionData](#pomsectiondata)

---

## AgentBase

```ts
import { AgentBase } from '@anthropic/@signalwire/sdk';
```

Core agent class that composes an HTTP server, prompt management, session handling, SWAIG tool registry, and 5-phase SWML rendering into a single deployable unit.

### AgentBase Constructor

```ts
constructor(opts: AgentOptions)
```

Creates a new agent. See [AgentOptions](#agentoptions) for the full options table.

**Example:**
```ts
const agent = new AgentBase({ name: 'MyAgent', route: '/agent' });
```

### AgentBase Static Properties

#### `PROMPT_SECTIONS`

```ts
static PROMPT_SECTIONS?: { title: string; body?: string; bullets?: string[]; numbered?: boolean }[]
```

Declarative prompt sections applied automatically by the constructor via `promptAddSection()`. Subclasses override this to define default prompt structure.

**Example:**
```ts
class MyAgent extends AgentBase {
  static override PROMPT_SECTIONS = [
    { title: 'Role', body: 'You are a helpful assistant.' },
    { title: 'Rules', bullets: ['Be concise.', 'Be polite.'] },
  ];
}
```

### AgentBase Public Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Display name of this agent |
| `route` | `string` | HTTP route path this agent listens on |
| `host` | `string` | Hostname the HTTP server binds to |
| `port` | `number` | Port number the HTTP server listens on |
| `agentId` | `string` | Unique identifier for this agent instance |

### Prompt Methods

#### `setPromptText(text)`

```ts
setPromptText(text: string): this
```

Set the main system prompt text. Bypasses POM rendering when set.

#### `setPostPrompt(text)`

```ts
setPostPrompt(text: string): this
```

Set the post-prompt text evaluated after the call ends. Used for call summarization.

#### `promptAddSection(title, opts?)`

```ts
promptAddSection(title: string, opts?: {
  body?: string;
  bullets?: string[];
  numbered?: boolean;
  numberedBullets?: boolean;
  subsections?: { title: string; body?: string; bullets?: string[] }[];
}): this
```

Add a new section to the POM prompt. Sections render as Markdown headings with body text, bullet points, and nested subsections.

#### `promptAddToSection(title, opts?)`

```ts
promptAddToSection(title: string, opts?: {
  body?: string;
  bullet?: string;
  bullets?: string[];
}): this
```

Append content to an existing prompt section. Creates the section if it does not exist.

#### `promptAddSubsection(parentTitle, title, opts?)`

```ts
promptAddSubsection(parentTitle: string, title: string, opts?: {
  body?: string;
  bullets?: string[];
}): this
```

Add a subsection under an existing prompt section.

#### `promptHasSection(title)`

```ts
promptHasSection(title: string): boolean
```

Check whether a prompt section with the given title exists.

#### `getPrompt()`

```ts
getPrompt(): string
```

Get the fully rendered main prompt text.

#### `getPostPrompt()`

```ts
getPostPrompt(): string | null
```

Get the post-prompt text, or `null` if not configured.

### Tool Methods

#### `defineTool(opts)`

```ts
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

Register a SWAIG tool (function) the AI can invoke during a call.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | -- | Unique tool name |
| `description` | `string` | -- | Description shown to the AI |
| `parameters` | `Record<string, unknown>` | `{}` | JSON Schema properties for the tool's parameters |
| `handler` | `SwaigHandler` | -- | Callback invoked when the tool is called |
| `secure` | `boolean` | `false` | Require session token authentication |
| `fillers` | `Record<string, string[]>` | -- | Language-keyed filler phrases spoken during execution |
| `waitFile` | `string` | -- | Audio file URL to play while waiting |
| `waitFileLoops` | `number` | -- | Number of times to loop the wait file |
| `required` | `string[]` | `[]` | List of required parameter names |

**Example:**
```ts
agent.defineTool({
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: { city: { type: 'string', description: 'City name' } },
  handler: async (args) => new FunctionResult(`Weather in ${args.city}: sunny`),
});
```

#### `getRegisteredTools()`

```ts
getRegisteredTools(): { name: string; description: string; parameters: Record<string, unknown> }[]
```

Get a summary of all registered tools.

#### `getTool(name)`

```ts
getTool(name: string): SwaigFunction | undefined
```

Look up a registered SwaigFunction by name.

#### `registerSwaigFunction(fn)`

```ts
registerSwaigFunction(fn: SwaigFunction | Record<string, unknown>): this
```

Register a pre-built SwaigFunction instance or a raw function descriptor (e.g., from DataMap).

### Speech and Language Methods

#### `addHint(hint)`

```ts
addHint(hint: string): this
```

Add a single speech-recognition hint word or phrase.

#### `addHints(hints)`

```ts
addHints(hints: string[]): this
```

Add multiple speech-recognition hints at once.

#### `addPatternHint(opts)`

```ts
addPatternHint(opts: { pattern: string; replace: string; ignoreCase?: boolean }): this
```

Add a pattern-based speech-recognition hint with find-and-replace behavior.

#### `addLanguage(config)`

```ts
addLanguage(config: LanguageConfig): this
```

Add a supported language to the AI configuration. See [LanguageConfig](#languageconfig).

#### `setLanguages(languages)`

```ts
setLanguages(languages: LanguageConfig[]): this
```

Replace all configured languages with a new list.

#### `addPronunciation(rule)`

```ts
addPronunciation(rule: PronunciationRule): this
```

Add a pronunciation override rule for the TTS engine. See [PronunciationRule](#pronunciationrule).

### AI Configuration Methods

#### `setParam(key, value)`

```ts
setParam(key: string, value: unknown): this
```

Set a single AI parameter (e.g., `"temperature"`, `"top_p"`).

#### `setParams(params)`

```ts
setParams(params: Record<string, unknown>): this
```

Merge multiple AI parameters into the existing params object.

#### `setGlobalData(data)`

```ts
setGlobalData(data: Record<string, unknown>): this
```

Replace the entire `global_data` object passed into the AI configuration.

#### `updateGlobalData(data)`

```ts
updateGlobalData(data: Record<string, unknown>): this
```

Merge additional entries into the existing `global_data` object.

#### `setNativeFunctions(funcs)`

```ts
setNativeFunctions(funcs: string[]): this
```

Set the list of native SWAIG function names (built-in platform functions).

#### `addInternalFiller(functionName, languageCode, fillers)`

```ts
addInternalFiller(functionName: string, languageCode: string, fillers: string[]): this
```

Add filler phrases spoken while a specific function is executing.

#### `addFunctionInclude(url, functions, metaData?)`

```ts
addFunctionInclude(url: string, functions: string[], metaData?: Record<string, unknown>): this
```

Add a remote SWAIG function include reference.

#### `setPromptLlmParams(params)`

```ts
setPromptLlmParams(params: Record<string, unknown>): this
```

Merge LLM-specific parameters into the main prompt configuration (e.g., `model`, `temperature`).

#### `setPostPromptLlmParams(params)`

```ts
setPostPromptLlmParams(params: Record<string, unknown>): this
```

Merge LLM-specific parameters into the post-prompt configuration.

#### `enableDebugEvents(level?)`

```ts
enableDebugEvents(level?: number): this
```

Enable debug event webhooks. `level` defaults to `1`.

### Call Flow Methods

The SWML document is rendered in 5 phases:

1. **Pre-answer** verbs
2. **Answer** verb
3. **Post-answer** verbs (including optional `record_call`)
4. **AI** verb
5. **Post-AI** verbs

#### `addPreAnswerVerb(verbName, config)`

```ts
addPreAnswerVerb(verbName: string, config: Record<string, unknown>): this
```

Add a SWML verb to execute before the answer phase (phase 1).

#### `addAnswerVerb(config?)`

```ts
addAnswerVerb(config?: Record<string, unknown>): this
```

Configure the answer verb (phase 2).

#### `addPostAnswerVerb(verbName, config)`

```ts
addPostAnswerVerb(verbName: string, config: Record<string, unknown>): this
```

Add a verb after the answer but before the AI verb (phase 3).

#### `addPostAiVerb(verbName, config)`

```ts
addPostAiVerb(verbName: string, config: Record<string, unknown>): this
```

Add a verb after the AI verb (phase 5).

#### `clearPreAnswerVerbs()`

```ts
clearPreAnswerVerbs(): this
```

Remove all pre-answer verbs.

#### `clearPostAnswerVerbs()`

```ts
clearPostAnswerVerbs(): this
```

Remove all post-answer verbs.

#### `clearPostAiVerbs()`

```ts
clearPostAiVerbs(): this
```

Remove all post-AI verbs.

### Context Methods

#### `defineContexts(contexts?)`

```ts
defineContexts(contexts?: ContextBuilder | Record<string, unknown>): ContextBuilder
```

Define or replace the contexts configuration for the AI verb. Returns the active ContextBuilder. See [ContextBuilder](#contextbuilder).

### Skill Methods

#### `addSkill(skill)`

```ts
async addSkill(skill: SkillBase): Promise<this>
```

Add a skill to this agent, registering its tools, prompt sections, hints, and global data. See [SkillBase](#skillbase).

#### `removeSkill(instanceId)`

```ts
async removeSkill(instanceId: string): Promise<boolean>
```

Remove a previously added skill by its instance ID. Returns `true` if found and removed.

#### `listSkills()`

```ts
listSkills(): { name: string; instanceId: string; initialized: boolean }[]
```

List all registered skills.

#### `hasSkill(skillName)`

```ts
hasSkill(skillName: string): boolean
```

Check whether a skill with the given name is registered.

### Dynamic Configuration Methods

#### `setDynamicConfigCallback(cb)`

```ts
setDynamicConfigCallback(cb: DynamicConfigCallback): this
```

Set a callback invoked on each SWML request to dynamically modify an ephemeral agent copy. The original agent is never mutated. See [DynamicConfigCallback](#dynamicconfigcallback).

#### `addSwaigQueryParams(params)`

```ts
addSwaigQueryParams(params: Record<string, string>): this
```

Add extra query parameters appended to all SWAIG webhook URLs.

### URL and Proxy Methods

#### `manualSetProxyUrl(url)`

```ts
manualSetProxyUrl(url: string): this
```

Manually set the external-facing proxy base URL used for webhook URL generation. Overrides auto-detection but not the `SWML_PROXY_URL_BASE` environment variable.

#### `setWebHookUrl(url)`

```ts
setWebHookUrl(url: string): this
```

Override the default SWAIG webhook URL.

#### `setPostPromptUrl(url)`

```ts
setPostPromptUrl(url: string): this
```

Override the default post-prompt webhook URL.

#### `getFullUrl(includeAuth?)`

```ts
getFullUrl(includeAuth?: boolean): string
```

Get the full external URL of this agent. When `includeAuth` is `true`, basic-auth credentials are embedded in the URL.

### Server Methods

#### `getApp()`

```ts
getApp(): Hono
```

Get or lazily create the Hono HTTP application with all routes, middleware, auth, and CORS. Routes created:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `{route}` | GET/POST | Returns rendered SWML |
| `{route}/swaig` | GET/POST | SWAIG function dispatcher |
| `{route}/post_prompt` | GET/POST | Post-prompt handler |
| `{route}/debug_events` | POST | Debug event handler |
| `{route}/health` | GET | Health check (`{ status: 'ok' }`) |
| `{route}/ready` | GET | Readiness check (`{ status: 'ready' }`) |

#### `asRouter()`

```ts
asRouter(): Hono
```

Return this agent's Hono app for mounting as a sub-router in an AgentServer.

#### `serve()`

```ts
async serve(): Promise<void>
```

Start the HTTP server and begin listening for requests.

#### `run()`

```ts
async run(): Promise<void>
```

Alias for `serve()`.

#### `renderSwml(callId?)`

```ts
renderSwml(callId?: string): string
```

Render the complete SWML document as a JSON string. Assembles all 5 phases.

### Utility Methods

#### `getName()`

```ts
getName(): string
```

Get the agent's display name.

#### `getBasicAuthCredentials(includeSource?)`

```ts
getBasicAuthCredentials(): [string, string]
getBasicAuthCredentials(includeSource: true): [string, string, 'provided' | 'environment' | 'generated']
```

Get the basic-auth credentials. When `includeSource` is `true`, appends the source as a third element.

### Protected Hooks

Override these in subclasses to customize agent behavior.

#### `defineTools()`

```ts
protected defineTools(): void
```

Lifecycle method for subclasses to register tools. Called explicitly by subclass constructors (not automatic). Default is a no-op.

#### `onSummary(summary, rawData)`

```ts
onSummary(summary: Record<string, unknown> | null, rawData: Record<string, unknown>): void | Promise<void>
```

Called when a post-prompt summary is received at the end of a call.

#### `onSwmlRequest(rawData)`

```ts
onSwmlRequest(rawData: Record<string, unknown>): void | Promise<void>
```

Called on every SWML request before rendering.

#### `onDebugEvent(event)`

```ts
onDebugEvent(event: Record<string, unknown>): void | Promise<void>
```

Called when a debug event webhook is received.

#### `validateBasicAuth(username, password)`

```ts
validateBasicAuth(username: string, password: string): boolean | Promise<boolean>
```

Override to add custom basic-auth validation logic. Return `true` to allow, `false` to reject. Default returns `true`.

#### `onFunctionCall(name, args, rawData)`

```ts
onFunctionCall(name: string, args: Record<string, unknown>, rawData: Record<string, unknown>): void | Promise<void>
```

Pre-execution hook called before each SWAIG function.

---

## AgentServer

```ts
import { AgentServer } from '@anthropic/@signalwire/sdk';
```

Multi-agent HTTP server that hosts multiple AgentBase instances on distinct route prefixes.

### Constructor

```ts
constructor(opts?: { host?: string; port?: number })
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | `string` | `'0.0.0.0'` | Hostname to bind to |
| `port` | `number` | `PORT` env or `3000` | Port to listen on |

### Methods

#### `register(agent, route?)`

```ts
register(agent: AgentBase, route?: string): void
```

Register an agent at the given route prefix. Defaults to the agent's own route. Throws if the route is already occupied.

#### `unregister(route)`

```ts
unregister(route: string): void
```

Remove an agent registration by route.

#### `getAgents()`

```ts
getAgents(): Map<string, AgentBase>
```

Get all registered agents keyed by route prefix.

#### `getAgent(route)`

```ts
getAgent(route: string): AgentBase | undefined
```

Look up a registered agent by route prefix.

#### `getApp()`

```ts
getApp(): Hono
```

Build and return the Hono application with all registered agents and a root listing endpoint (unless an agent is mounted at `/`).

#### `run(host?, port?)`

```ts
async run(host?: string, port?: number): Promise<void>
```

Start the HTTP server. Optional host/port overrides the constructor values.

**Example:**
```ts
const server = new AgentServer({ port: 8080 });
server.register(agent1, '/sales');
server.register(agent2, '/support');
await server.run();
```

---

## FunctionResult

```ts
import { FunctionResult } from '@anthropic/@signalwire/sdk';
```

Builder for SWAIG function responses. Carries response text and an ordered list of structured actions. Every mutating method returns `this` for fluent chaining.

### FunctionResult Constructor

```ts
constructor(response?: string, postProcess?: boolean)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `response` | `string` | `''` | Initial response text |
| `postProcess` | `boolean` | `false` | Whether actions are post-processed after the AI responds |

### Public Properties

| Property | Type | Description |
|----------|------|-------------|
| `response` | `string` | The text response returned to the AI |
| `action` | `Record<string, unknown>[]` | Ordered list of actions |
| `postProcess` | `boolean` | Whether post-processing is enabled |

### FunctionResult Core Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setResponse` | `(response: string): this` | Set the response text |
| `setPostProcess` | `(postProcess: boolean): this` | Enable/disable post-processing |
| `addAction` | `(name: string, data: unknown): this` | Append a named action |
| `addActions` | `(actions: Record<string, unknown>[]): this` | Append multiple actions |

### Call Control Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `connect` | `(destination: string, final?: boolean, fromAddr?: string): this` | Connect to another destination via SWML transfer |
| `swmlTransfer` | `(dest: string, aiResponse: string, final?: boolean): this` | Transfer with a custom AI response |
| `hangup` | `(): this` | Hang up the call |
| `hold` | `(timeout?: number): this` | Place on hold (0-900 seconds, default 300) |
| `waitForUser` | `(opts?: { enabled?: boolean; timeout?: number; answerFirst?: boolean }): this` | Wait for user input |
| `stop` | `(): this` | Stop the AI session |

### Audio Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `say` | `(text: string): this` | Speak text via TTS |
| `playBackgroundFile` | `(filename: string, wait?: boolean): this` | Play background audio |
| `stopBackgroundFile` | `(): this` | Stop background audio |

### Speech Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `addDynamicHints` | `(hints: (string \| { pattern: string; replace: string; ignore_case?: boolean })[]): this` | Add dynamic speech hints |
| `clearDynamicHints` | `(): this` | Remove all dynamic hints |
| `setEndOfSpeechTimeout` | `(milliseconds: number): this` | Set silence duration marking end of speech |
| `setSpeechEventTimeout` | `(milliseconds: number): this` | Set speech event detection timeout |

### Data Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `updateGlobalData` | `(data: Record<string, unknown>): this` | Merge into global data store |
| `removeGlobalData` | `(keys: string \| string[]): this` | Remove keys from global data |
| `setMetadata` | `(data: Record<string, unknown>): this` | Set call metadata |
| `removeMetadata` | `(keys: string \| string[]): this` | Remove call metadata keys |

### SWML Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `executeSwml` | `(swmlContent: string \| Record<string, unknown>, transfer?: boolean): this` | Execute arbitrary SWML |
| `swmlChangeStep` | `(stepName: string): this` | Change the current SWML step |
| `swmlChangeContext` | `(contextName: string): this` | Change the current SWML context |
| `swmlUserEvent` | `(eventData: Record<string, unknown>): this` | Emit a custom user event |
| `switchContext` | `(opts?: { systemPrompt?: string; userPrompt?: string; consolidate?: boolean; fullReset?: boolean }): this` | Switch AI context with optional new prompts |

### Function Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `toggleFunctions` | `(toggles: { function: string; active: boolean }[]): this` | Enable/disable functions by name |
| `enableFunctionsOnTimeout` | `(enabled?: boolean): this` | Control function fire on speaker timeout |
| `updateSettings` | `(settings: Record<string, unknown>): this` | Update AI engine settings at runtime |

### Communication Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `simulateUserInput` | `(text: string): this` | Inject text as if the user had spoken it |
| `enableExtensiveData` | `(enabled?: boolean): this` | Enable extensive data reporting |
| `replaceInHistory` | `(text: string \| boolean): this` | Replace function output in conversation history |
| `sendSms` | `(opts: { toNumber, fromNumber, body?, media?, tags?, region? }): this` | Send an SMS/MMS message |
| `recordCall` | `(opts?): this` | Start recording the call |
| `stopRecordCall` | `(controlId?: string): this` | Stop an active call recording |
| `tap` | `(opts: { uri, controlId?, direction?, codec?, rtpPtime?, statusUrl? }): this` | Start a media tap |
| `stopTap` | `(controlId?: string): this` | Stop a media tap |

### Room and Conference Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `joinRoom` | `(name: string): this` | Join a SignalWire room |
| `sipRefer` | `(toUri: string): this` | Send a SIP REFER |
| `joinConference` | `(name: string, opts?): this` | Join a conference with optional settings |

### RPC Actions

| Method | Signature | Description |
|--------|-----------|-------------|
| `executeRpc` | `(opts: { method, params?, callId?, nodeId? }): this` | Execute a SignalWire RPC method |
| `rpcDial` | `(toNumber, fromNumber, destSwml, deviceType?): this` | Dial a number via RPC |
| `rpcAiMessage` | `(callId, messageText, role?): this` | Send an AI message to another call |
| `rpcAiUnhold` | `(callId: string): this` | Unhold a call via RPC |

### Payment Actions

#### `pay(opts)`

```ts
pay(opts: {
  paymentConnectorUrl: string;
  inputMethod?: string;        // default 'dtmf'
  statusUrl?: string;
  paymentMethod?: string;      // default 'credit-card'
  timeout?: number;            // default 5
  maxAttempts?: number;        // default 1
  securityCode?: boolean;      // default true
  postalCode?: boolean | string; // default true
  minPostalCodeLength?: number;  // default 0
  tokenType?: string;          // default 'reusable'
  chargeAmount?: string;
  currency?: string;           // default 'usd'
  language?: string;           // default 'en-US'
  voice?: string;              // default 'woman'
  description?: string;
  validCardTypes?: string;     // default 'visa mastercard amex'
  parameters?: PaymentParameter[];
  prompts?: PaymentPrompt[];
  aiResponse?: string;
}): this
```

Initiate a payment collection flow.

### FunctionResult Static Helpers

| Method | Signature | Returns |
|--------|-----------|---------|
| `createPaymentPrompt` | `(forSituation, actions, cardType?, errorType?)` | `PaymentPrompt` |
| `createPaymentAction` | `(actionType, phrase)` | `PaymentAction` |
| `createPaymentParameter` | `(name, value)` | `PaymentParameter` |

### FunctionResult Serialization

#### `toDict()`

```ts
toDict(): Record<string, unknown>
```

Serialize to a plain object for the SWAIG response. Returns `{ response, action, post_process }`. Falls back to `{ response: "Action completed." }` when empty.

---

## SwaigFunction

```ts
import { SwaigFunction } from '@anthropic/@signalwire/sdk';
```

Wraps a tool handler function with metadata for SWAIG registration.

### Constructor

```ts
constructor(opts: SwaigFunctionOptions)
```

See [SwaigFunctionOptions](#swaigfunctionoptions) for the options table.

### Public Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique tool name |
| `handler` | `SwaigHandler` | Handler function |
| `description` | `string` | Description shown to the AI |
| `parameters` | `Record<string, unknown>` | JSON Schema properties |
| `secure` | `boolean` | Whether session token auth is required |
| `fillers` | `Record<string, string[]>` | Language-keyed filler phrases |
| `waitFile` | `string \| undefined` | Audio file URL played while waiting |
| `waitFileLoops` | `number \| undefined` | Wait file loop count |
| `webhookUrl` | `string \| undefined` | External webhook URL |
| `required` | `string[]` | Required parameter names |
| `extraFields` | `Record<string, unknown>` | Additional SWAIG definition fields |
| `isExternal` | `boolean` | Whether this is externally hosted |

### Methods

#### `execute(args, rawData?)`

```ts
async execute(args: Record<string, unknown>, rawData?: Record<string, unknown>): Promise<Record<string, unknown>>
```

Invoke the handler and return a serialized result dictionary. On error, returns a user-friendly error message.

#### `toSwaig(baseUrl, token?, callId?)`

```ts
toSwaig(baseUrl: string, token?: string, callId?: string): Record<string, unknown>
```

Serialize to the SWAIG wire format for inclusion in SWML. Returns an object with `function`, `description`, `parameters`, `web_hook_url`, and optional fields.

---

## DataMap

```ts
import { DataMap, createSimpleApiTool, createExpressionTool } from '@anthropic/@signalwire/sdk';
```

Fluent builder for SWAIG `data_map` configurations. Creates server-side tool definitions that execute on SignalWire without requiring webhook endpoints.

### DataMap Constructor

```ts
constructor(functionName: string)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `functionName` | `string` | Unique name for this data map tool |

### DataMap Configuration Methods

#### `enableEnvExpansion(enabled?)`

```ts
enableEnvExpansion(enabled?: boolean): this
```

Enable `${ENV.*}` variable expansion in URLs, bodies, and outputs. Default `true`.

#### `purpose(description)` / `description(description)`

```ts
purpose(description: string): this
description(description: string): this  // alias
```

Set the tool description shown to the AI.

#### `parameter(name, paramType, description, opts?)`

```ts
parameter(name: string, paramType: string, description: string, opts?: {
  required?: boolean;
  enum?: string[];
}): this
```

Define a parameter for this data map tool.

#### `expression(testValue, pattern, output, nomatchOutput?)`

```ts
expression(
  testValue: string,
  pattern: string | RegExp,
  output: FunctionResult,
  nomatchOutput?: FunctionResult,
): this
```

Add a pattern-matching expression that evaluates a test value against a regex.

### DataMap Webhook Methods

#### `webhook(method, url, opts?)`

```ts
webhook(method: string, url: string, opts?: {
  headers?: Record<string, string>;
  formParam?: string;
  inputArgsAsParams?: boolean;
  requireArgs?: string[];
}): this
```

Add a webhook called when this data map tool is invoked.

#### `webhookExpressions(expressions)`

```ts
webhookExpressions(expressions: Record<string, unknown>[]): this
```

Set expressions on the most recently added webhook.

#### `body(data)`

```ts
body(data: Record<string, unknown>): this
```

Set the JSON body for the most recently added webhook.

#### `params(data)`

```ts
params(data: Record<string, unknown>): this
```

Set query/form parameters for the most recently added webhook.

#### `foreach(config)`

```ts
foreach(config: { input_key: string; output_key: string; append: string; max?: number }): this
```

Configure iteration over an array in the webhook response.

### DataMap Output Methods

#### `output(result)`

```ts
output(result: FunctionResult): this
```

Set the output template for the most recently added webhook.

#### `fallbackOutput(result)`

```ts
fallbackOutput(result: FunctionResult): this
```

Set a fallback output used when no webhook or expression matches.

#### `errorKeys(keys)`

```ts
errorKeys(keys: string[]): this
```

Set error keys on the most recently added webhook (or globally if no webhook exists).

#### `globalErrorKeys(keys)`

```ts
globalErrorKeys(keys: string[]): this
```

Set error keys at the top-level data map scope.

### DataMap Registration and Serialization

#### `registerWithAgent(agent)`

```ts
registerWithAgent(agent: { registerSwaigFunction(fn: Record<string, unknown>): unknown }): this
```

Register this DataMap tool with an AgentBase instance.

#### `toSwaigFunction()`

```ts
toSwaigFunction(): Record<string, unknown>
```

Serialize to a SWAIG function definition object suitable for SWML.

### DataMap Factory Functions

#### `createSimpleApiTool(opts)`

```ts
function createSimpleApiTool(opts: {
  name: string;
  url: string;
  responseTemplate: string;
  parameters?: Record<string, { type?: string; description?: string; required?: boolean }>;
  method?: string;         // default 'GET'
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  errorKeys?: string[];
}): DataMap
```

Create a DataMap tool that calls a single API endpoint and formats the response.

#### `createExpressionTool(opts)`

```ts
function createExpressionTool(opts: {
  name: string;
  patterns: Record<string, [string, FunctionResult]>;
  parameters?: Record<string, { type?: string; description?: string; required?: boolean }>;
}): DataMap
```

Create a DataMap tool that evaluates expressions against patterns without making HTTP calls.

---

## ContextBuilder

```ts
import { ContextBuilder, Context, Step, GatherInfo, GatherQuestion, createSimpleContext } from '@anthropic/@signalwire/sdk';
```

Contexts and Steps workflow system. Contexts contain ordered Steps, each with prompt content, completion criteria, function restrictions, and navigation rules.

### ContextBuilder Class

Builds and validates a collection of named contexts for multi-step AI workflows.

#### `addContext(name)`

```ts
addContext(name: string): Context
```

Add a new named context. Returns the created Context for further configuration. Throws if the name already exists.

#### `getContext(name)`

```ts
getContext(name: string): Context | undefined
```

Retrieve a context by name.

#### `validate()`

```ts
validate(): void
```

Validate all contexts: at least one must exist, single contexts must be named `'default'`, all contexts must have steps, and cross-context references must be valid. Throws on failure.

#### `toDict()`

```ts
toDict(): Record<string, unknown>
```

Validate and serialize all contexts to a plain object for SWML output.

### Context Class

A named context containing ordered steps, prompt configuration, and navigation rules.

#### Constructor

```ts
constructor(name: string)
```

#### Step Management

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `addStep` | `(name, opts?)` | `Step` | Add a new step with optional shorthand config |
| `getStep` | `(name: string)` | `Step \| undefined` | Retrieve a step by name |
| `removeStep` | `(name: string)` | `this` | Remove a step by name |
| `moveStep` | `(name: string, position: number)` | `this` | Move a step to a new position |

The `addStep` options shorthand:

| Option | Type | Description |
|--------|------|-------------|
| `task` | `string` | Shorthand for `addSection('Task', task)` |
| `bullets` | `string[]` | Shorthand for `addBullets('Process', bullets)` |
| `criteria` | `string` | Shorthand for `setStepCriteria(criteria)` |
| `functions` | `string \| string[]` | Shorthand for `setFunctions(functions)` |
| `validSteps` | `string[]` | Shorthand for `setValidSteps(validSteps)` |

#### Navigation and Configuration

| Method | Signature | Description |
|--------|-----------|-------------|
| `setValidContexts` | `(contexts: string[]): this` | Set allowed context navigation targets |
| `setValidSteps` | `(steps: string[]): this` | Set allowed step navigation targets |
| `setPostPrompt` | `(postPrompt: string): this` | Set context post-prompt text |
| `setSystemPrompt` | `(systemPrompt: string): this` | Set raw system prompt (mutually exclusive with POM sections) |
| `setConsolidate` | `(consolidate: boolean): this` | Consolidate conversation history on entry |
| `setFullReset` | `(fullReset: boolean): this` | Fully reset conversation history on entry |
| `setUserPrompt` | `(userPrompt: string): this` | Set user prompt text |
| `setIsolated` | `(isolated: boolean): this` | Isolate from other contexts' history |
| `setPrompt` | `(prompt: string): this` | Set raw prompt text (mutually exclusive with POM sections) |

#### POM Sections

| Method | Signature | Description |
|--------|-----------|-------------|
| `addSystemSection` | `(title: string, body: string): this` | Add POM section to system prompt |
| `addSystemBullets` | `(title: string, bullets: string[]): this` | Add POM bullet section to system prompt |
| `addSection` | `(title: string, body: string): this` | Add POM section to context prompt |
| `addBullets` | `(title: string, bullets: string[]): this` | Add POM bullet section to context prompt |

#### Fillers

| Method | Signature | Description |
|--------|-----------|-------------|
| `setEnterFillers` | `(fillers: Record<string, string[]>): this` | Set all enter fillers by language |
| `setExitFillers` | `(fillers: Record<string, string[]>): this` | Set all exit fillers by language |
| `addEnterFiller` | `(languageCode: string, fillers: string[]): this` | Add enter fillers for one language |
| `addExitFiller` | `(languageCode: string, fillers: string[]): this` | Add exit fillers for one language |

#### `toDict()`

```ts
toDict(): Record<string, unknown>
```

Serialize this context and all its steps to SWML output. Throws if no steps are defined.

### Step Class

A single step within a context.

#### Constructor

```ts
constructor(name: string)
```

#### Content Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setText` | `(text: string): this` | Set raw text (mutually exclusive with POM sections) |
| `addSection` | `(title: string, body: string): this` | Add a POM section with body |
| `addBullets` | `(title: string, bullets: string[]): this` | Add a POM section with bullets |
| `clearSections` | `(): this` | Remove all sections and raw text |

#### Configuration Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setStepCriteria` | `(criteria: string): this` | Set completion criteria |
| `setFunctions` | `(functions: string \| string[]): this` | Restrict available functions |
| `setValidSteps` | `(steps: string[]): this` | Set allowed step navigation |
| `setValidContexts` | `(contexts: string[]): this` | Set allowed context navigation |
| `setEnd` | `(end: boolean): this` | Mark as terminal step |
| `setSkipUserTurn` | `(skip: boolean): this` | Skip waiting for user input |
| `setSkipToNextStep` | `(skip: boolean): this` | Auto-advance to next step |

#### Gather Info Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setGatherInfo` | `(opts?: { outputKey?; completionAction?; prompt? }): this` | Initialize a gather info operation |
| `addGatherQuestion` | `(opts: { key; question; type?; confirm?; prompt?; functions? }): this` | Add a question to the gather |

#### Reset Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setResetSystemPrompt` | `(systemPrompt: string): this` | System prompt for context reset |
| `setResetUserPrompt` | `(userPrompt: string): this` | User prompt for context reset |
| `setResetConsolidate` | `(consolidate: boolean): this` | Consolidate on reset |
| `setResetFullReset` | `(fullReset: boolean): this` | Full reset on step entry |

#### `toDict()`

```ts
toDict(): Record<string, unknown>
```

Serialize this step to SWML output.

### GatherInfo Class

Collects structured information through a series of questions.

#### Constructor

```ts
constructor(opts?: { outputKey?: string; completionAction?: string; prompt?: string })
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addQuestion` | `(opts: { key; question; type?; confirm?; prompt?; functions? }): this` | Add a question |
| `getQuestions` | `(): GatherQuestion[]` | Return all questions |
| `toDict` | `(): Record<string, unknown>` | Serialize to SWML output |

### GatherQuestion Class

A single question within a gather operation.

#### Constructor

```ts
constructor(opts: {
  key: string;
  question: string;
  type?: string;       // default 'string'
  confirm?: boolean;   // default false
  prompt?: string;
  functions?: string[];
})
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | Unique answer storage key |
| `question` | `string` | Question text |
| `type` | `string` | Expected answer type |
| `confirm` | `boolean` | Whether confirmation is required |
| `prompt` | `string \| undefined` | Additional prompt context |
| `functions` | `string[] \| undefined` | Available functions during this question |

#### `toDict()`

```ts
toDict(): Record<string, unknown>
```

### ContextBuilder Helper Functions

#### `createSimpleContext(name?)`

```ts
function createSimpleContext(name?: string): Context
```

Create a standalone Context without a ContextBuilder. Name defaults to `'default'`.

---

## PomBuilder

```ts
import { PomBuilder, PomSection } from '@anthropic/@signalwire/sdk';
```

Prompt Object Model for structured prompt sections. Sections have a title, body, bullets (optionally numbered), and nested subsections.

### PomSection Class

A single section in a POM.

#### Constructor

```ts
constructor(opts?: {
  title?: string | null;
  body?: string;
  bullets?: string[];
  numbered?: boolean | null;
  numberedBullets?: boolean;
})
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string \| null` | Section heading |
| `body` | `string` | Body text |
| `bullets` | `string[]` | Bullet points |
| `subsections` | `PomSection[]` | Nested child sections |
| `numbered` | `boolean \| null` | Whether this section is numbered |
| `numberedBullets` | `boolean` | Whether bullets are numbered |

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `addSubsection` | `(opts: { title, body?, bullets?, numbered?, numberedBullets? })` | `PomSection` | Add a nested subsection |
| `toDict` | `()` | `PomSectionData` | Serialize to plain object |
| `renderMarkdown` | `(level?, sectionNumber?)` | `string` | Render as Markdown |

### PomBuilder Class

Builds a structured prompt by composing named POM sections.

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `addSection` | `(title, opts?)` | `this` | Add a top-level section |
| `addToSection` | `(title, opts?)` | `this` | Append to an existing section |
| `addSubsection` | `(parentTitle, title, opts?)` | `this` | Add subsection under a parent |
| `hasSection` | `(title: string)` | `boolean` | Check if section exists |
| `getSection` | `(title: string)` | `PomSection \| undefined` | Get section by title |
| `findSection` | `(title: string)` | `PomSection \| undefined` | Recursive deep search |
| `toDict` | `()` | `PomSectionData[]` | Serialize all sections |
| `renderMarkdown` | `()` | `string` | Render all sections as Markdown |

---

## SwmlBuilder

```ts
import { SwmlBuilder } from '@anthropic/@signalwire/sdk';
```

Builds SWML (SignalWire Markup Language) documents: `{ version: "1.0.0", sections: { main: [...verbs] } }`.

### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `reset` | `()` | `void` | Reset to empty document |
| `addVerb` | `(verbName: string, config: unknown)` | `void` | Append verb to the `main` section |
| `addVerbToSection` | `(sectionName, verbName, config)` | `void` | Append verb to a named section |
| `getDocument` | `()` | `Record<string, unknown>` | Get the raw document object |
| `renderDocument` | `()` | `string` | Serialize to JSON string |

---

## PromptManager

```ts
import { PromptManager } from '@anthropic/@signalwire/sdk';
```

Manages agent prompt text, supporting both raw text and structured POM-based prompts.

### Constructor

```ts
constructor(usePom?: boolean)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `usePom` | `boolean` | `true` | Whether to use POM sections |

### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `setPromptText` | `(text: string)` | `void` | Set raw prompt text, bypassing POM |
| `setPostPrompt` | `(text: string)` | `void` | Set post-prompt text |
| `addSection` | `(title, opts?)` | `void` | Add a POM section |
| `addToSection` | `(title, opts?)` | `void` | Append to a POM section |
| `addSubsection` | `(parentTitle, title, opts?)` | `void` | Add a POM subsection |
| `hasSection` | `(title: string)` | `boolean` | Check if section exists |
| `getPrompt` | `()` | `string` | Get rendered prompt text |
| `getPostPrompt` | `()` | `string \| null` | Get post-prompt text |
| `getPomBuilder` | `()` | `PomBuilder \| null` | Get underlying PomBuilder |

---

## SessionManager

```ts
import { SessionManager } from '@anthropic/@signalwire/sdk';
```

Stateless HMAC-SHA256 token manager for SWAIG function call authentication and per-session metadata storage. Tokens encode `callId.functionName.expiry.nonce.hmacSignature` in base64url format.

### Constructor

```ts
constructor(tokenExpirySecs?: number, secretKey?: string)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tokenExpirySecs` | `number` | `3600` | Token validity in seconds |
| `secretKey` | `string` | Random 32 bytes | HMAC signing secret |

### Methods

#### `createSession(callId?)`

```ts
createSession(callId?: string): string
```

Return the given callId or generate a new random session identifier.

#### `generateToken(functionName, callId)`

```ts
generateToken(functionName: string, callId: string): string
```

Generate a signed, base64url-encoded token binding a function name to a call ID.

#### `createToolToken(functionName, callId)`

```ts
createToolToken(functionName: string, callId: string): string
```

Alias for `generateToken()`.

#### `validateToken(callId, functionName, token)`

```ts
validateToken(callId: string, functionName: string, token: string): boolean
```

Validate a token against the expected call ID and function name. Returns `true` if valid and not expired.

#### `validateToolToken(functionName, token, callId)`

```ts
validateToolToken(functionName: string, token: string, callId: string): boolean
```

Alias for `validateToken()` with reordered parameters.

#### `debugToken(token)`

```ts
debugToken(token: string): {
  callId: string;
  functionName: string;
  expiry: number;
  nonce: string;
  signature: string;
  expired: boolean;
} | null
```

Decode token components for debugging without validating the signature. Returns `null` if malformed.

#### Metadata Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `getSessionMetadata` | `(sessionId: string)` | `Record<string, unknown> \| undefined` | Get session metadata |
| `setSessionMetadata` | `(sessionId, metadata)` | `void` | Merge metadata into session |
| `deleteSessionMetadata` | `(sessionId: string)` | `boolean` | Delete all session metadata |

---

## Skills

```ts
import { SkillBase, SkillManager, SkillRegistry } from '@anthropic/@signalwire/sdk';
```

### SkillBase

Abstract base class for agent skills. Skills are modular capabilities that provide tools, prompt sections, hints, and global data.

#### Constructor

```ts
constructor(skillName: string, config?: SkillConfig)
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `skillName` | `string` (readonly) | Registered skill type name |
| `instanceId` | `string` (readonly) | Unique instance ID (includes timestamp + random bytes) |
| `config` | `SkillConfig` (protected) | Configuration options |

#### Abstract Methods (must be implemented)

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `getManifest` | `()` | `SkillManifest` | Return skill metadata and requirements |
| `getTools` | `()` | `SkillToolDefinition[]` | Return SWAIG tool definitions |

#### Overridable Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `setup` | `()` | `Promise<void>` | Initialization hook (called when added to agent) |
| `cleanup` | `()` | `Promise<void>` | Teardown hook (called when removed) |
| `getPromptSections` | `()` | `SkillPromptSection[]` | Prompt sections to inject |
| `getHints` | `()` | `string[]` | Speech recognition hints |
| `getGlobalData` | `()` | `Record<string, unknown>` | Global data to merge |

#### Utility Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `validateEnvVars` | `()` | `string[]` | List missing required env vars |
| `isInitialized` | `()` | `boolean` | Check initialization state |
| `markInitialized` | `()` | `void` | Mark as initialized (called by SkillManager) |
| `getConfig` | `<T>(key, defaultValue?)` | `T` | Get a config value with fallback |

### SkillManager

Manages the lifecycle of skills attached to an agent.

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `addSkill` | `(skill: SkillBase)` | `Promise<void>` | Add, validate, and setup a skill |
| `removeSkill` | `(instanceId: string)` | `Promise<boolean>` | Remove by instance ID |
| `removeSkillByName` | `(skillName: string)` | `Promise<number>` | Remove all instances of a skill name |
| `hasSkill` | `(skillName: string)` | `boolean` | Check if any instance with name exists |
| `getSkill` | `(instanceId: string)` | `SkillBase \| undefined` | Get by instance ID |
| `listSkills` | `()` | `{ name, instanceId, initialized }[]` | List all loaded skills |
| `getAllTools` | `()` | `SkillToolDefinition[]` | Aggregate all skill tools |
| `getAllPromptSections` | `()` | `SkillPromptSection[]` | Aggregate all prompt sections |
| `getAllHints` | `()` | `string[]` | Aggregate all hints |
| `getMergedGlobalData` | `()` | `Record<string, unknown>` | Merge all skill global data |
| `clear` | `()` | `Promise<void>` | Remove and cleanup all skills |
| `size` | (getter) | `number` | Count of loaded skills |

### SkillRegistry

Global singleton registry for discovering and instantiating skills. Supports the `SIGNALWIRE_SKILL_PATHS` environment variable for custom skill directories.

#### Static Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `getInstance` | `()` | `SkillRegistry` | Get the global singleton |
| `resetInstance` | `()` | `void` | Reset the singleton (for testing) |

#### Instance Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `register` | `(name, factory, manifest?)` | `void` | Register a skill factory |
| `unregister` | `(name: string)` | `boolean` | Remove a registration |
| `create` | `(name, config?)` | `SkillBase \| null` | Create instance from registry |
| `has` | `(name: string)` | `boolean` | Check if name is registered |
| `getManifest` | `(name: string)` | `SkillManifest \| undefined` | Get skill manifest |
| `listRegistered` | `()` | `string[]` | List registered names |
| `listRegisteredWithManifests` | `()` | `{ name, manifest? }[]` | List with manifests |
| `addSearchPath` | `(path: string)` | `void` | Add a discovery directory |
| `getSearchPaths` | `()` | `string[]` | Get all search paths |
| `discoverFromDirectory` | `(dirPath: string)` | `Promise<string[]>` | Discover skills from a directory |
| `discoverAll` | `()` | `Promise<string[]>` | Discover from all search paths |
| `clear` | `()` | `void` | Clear all registrations |
| `size` | (getter) | `number` | Count of registered skills |

#### SkillFactory Type

```ts
type SkillFactory = (config?: SkillConfig) => SkillBase;
```

---

## Prefab Agents

Pre-built agent templates with declarative configuration, built-in tools, and prompt sections.

### InfoGathererAgent

```ts
import { InfoGathererAgent, createInfoGathererAgent } from '@anthropic/@signalwire/sdk';
```

Asks the caller a sequence of questions one at a time. Supports static mode (questions provided at construction) and dynamic mode (questions resolved per request via a callback).

#### InfoGathererConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'info_gatherer'` | Agent display name |
| `route` | `string` | `'/info_gatherer'` | HTTP route for this agent |
| `questions` | `InfoGathererQuestion[]` | -- | Questions to ask (static mode). Omit for dynamic mode. |
| `questionCallback` | `InfoGathererQuestionCallback` | -- | Resolves questions per request (dynamic mode). |
| `agentOptions` | `Partial<AgentOptions>` | -- | Passed to `AgentBase` |

#### InfoGathererQuestion

| Property | Type | Description |
|----------|------|-------------|
| `key_name` | `string` | Identifier used as the key when storing the caller's answer |
| `question_text` | `string` | Question text spoken to the caller |
| `confirm` | `boolean` | When true, the agent insists on confirmation before submitting |

**Built-in tools:** `start_questions`, `submit_answer`

**Dynamic mode:** call `agent.setQuestionCallback(cb)` or pass `questionCallback` in the config. The callback receives `(queryParams, bodyParams, headers)` and returns the list of questions for that request. When no callback is registered, a default two-question fallback is used.

**Factory:** `createInfoGathererAgent(config: InfoGathererConfig): InfoGathererAgent`

### SurveyAgent

```ts
import { SurveyAgent, createSurveyAgent } from '@anthropic/@signalwire/sdk';
```

Conducts surveys with branching logic, answer scoring, and conditional question flow.

#### SurveyConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'survey'` | Agent display name |
| `route` | `string` | `'/survey'` | HTTP route |
| `surveyName` | `string` | -- | Survey name used in prompts and global data (required) |
| `questions` | `SurveyQuestion[]` | -- | Ordered list of survey questions (required) |
| `introduction` | `string` | Welcome message | Opening message (also used as a non-bargeable static greeting) |
| `conclusion` | `string` | Thank-you message | Closing message |
| `brandName` | `string` | `'Our Company'` | Brand or company name the agent represents |
| `maxRetries` | `number` | `2` | Maximum retries for invalid answers |
| `onComplete` | `(responses, score) => void \| Promise<void>` | -- | Completion callback |
| `agentOptions` | `Partial<AgentOptions>` | -- | Passed to `AgentBase` |

#### SurveyQuestion

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique question identifier |
| `text` | `string` | Question text to ask |
| `type` | `'multiple_choice' \| 'open_ended' \| 'rating' \| 'yes_no'` | Question type |
| `options` | `string[]` | Options for `multiple_choice` |
| `scale` | `number` | For `rating`, upper bound of the 1..scale range (default `5`) |
| `required` | `boolean` | Whether the question requires an answer (default `true`) |
| `nextQuestion` | `string \| Record<string, string>` | Branching logic: fixed next or answer-based map |
| `points` | `number \| Record<string, number>` | Scoring: fixed or per-answer |

**Built-in tools:** `validate_response`, `log_response`, `answer_question`, `get_current_question`, `get_survey_progress`

**Factory:** `createSurveyAgent(config: SurveyConfig): SurveyAgent`

### FAQBotAgent

```ts
import { FAQBotAgent, createFAQBotAgent } from '@anthropic/@signalwire/sdk';
```

Answers frequently asked questions using keyword/word-overlap matching with optional escalation.

#### FAQBotConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'FAQBot'` | Agent display name |
| `faqs` | `FAQEntry[]` | -- | FAQ entries (required) |
| `threshold` | `number` | `0.5` | Minimum match score (0-1) |
| `escalationMessage` | `string` | Generic apology | No-match message |
| `escalationNumber` | `string` | -- | Phone number for escalation transfer |
| `agentOptions` | `Partial<AgentOptions>` | -- | Passed to `AgentBase` |

#### FAQEntry

| Property | Type | Description |
|----------|------|-------------|
| `question` | `string` | Representative question text |
| `answer` | `string` | Answer to provide |
| `keywords` | `string[]` | Additional matching keywords |

**Built-in tools:** `search_faq`, `escalate` (if `escalationNumber` is set)

**Factory:** `createFAQBotAgent(config: FAQBotConfig): FAQBotAgent`

### ConciergeAgent

```ts
import { ConciergeAgent, createConciergeAgent } from '@anthropic/@signalwire/sdk';
```

Virtual concierge for a venue or business. Provides information about services, amenities, hours of operation, and answers availability and directions questions.

#### ConciergeConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'concierge'` | Agent display name |
| `route` | `string` | `'/concierge'` | HTTP route |
| `venueName` | `string` | -- | Name of the venue or business (required) |
| `services` | `string[]` | -- | List of services offered (required) |
| `amenities` | `Record<string, Record<string, string>>` | -- | Amenities with per-amenity detail pairs (required) |
| `hoursOfOperation` | `Record<string, string>` | `{ default: '9 AM - 5 PM' }` | Hours of operation by category |
| `specialInstructions` | `string[]` | `[]` | Extra instruction bullets to append |
| `welcomeMessage` | `string` | -- | When set, installed as a non-bargeable static greeting |
| `agentOptions` | `Partial<AgentOptions>` | -- | Passed to `AgentBase` |

**Built-in tools:** `check_availability`, `get_directions`

**Factory:** `createConciergeAgent(config: ConciergeConfig): ConciergeAgent`

### ReceptionistAgent

```ts
import { ReceptionistAgent, createReceptionistAgent } from '@anthropic/@signalwire/sdk';
```

Front-desk agent that greets callers, collects basic info, and transfers them to the appropriate department.

#### ReceptionistConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'receptionist'` | Agent display name |
| `route` | `string` | `'/receptionist'` | HTTP route |
| `departments` | `ReceptionistDepartment[]` | -- | Departments (required) |
| `greeting` | `string` | `'Thank you for calling. How can I help you today?'` | Initial greeting |
| `voice` | `string` | `'rime.spore'` | Voice identifier passed to `addLanguage` |
| `companyName` | `string` | -- | Optional company name appended to the greeting |
| `checkInEnabled` | `boolean` | `false` | Register the optional `check_in_visitor` tool |
| `onVisitorCheckIn` | `(visitor: Record<string, string>) => void \| Promise<void>` | -- | Check-in callback |
| `agentOptions` | `Partial<AgentOptions>` | -- | Passed to `AgentBase` |

#### ReceptionistDepartment

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Department identifier |
| `description` | `string` | Description (shown to the AI) |
| `number` | `string` | Phone number or SIP address dialed on transfer |

**Built-in tools:** `collect_caller_info`, `transfer_call`, `check_in_visitor` (when `checkInEnabled`)

**Factory:** `createReceptionistAgent(config: ReceptionistConfig): ReceptionistAgent`

---

## Utility Classes

### AuthHandler

```ts
import { AuthHandler } from '@anthropic/@signalwire/sdk';
```

Multi-method authentication handler with timing-safe credential comparison. Supports Bearer token, API key, Basic auth, and custom validators.

#### Constructor

```ts
constructor(config: AuthConfig)
```

See [AuthConfig](#authconfig).

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `validate` | `(headers: Record<string, string>)` | `Promise<boolean>` | Validate against all configured methods |
| `middleware` | `()` | Hono middleware | Create middleware rejecting with 401 |
| `hasBearerAuth` | `()` | `boolean` | Check if Bearer is configured |
| `hasApiKeyAuth` | `()` | `boolean` | Check if API key is configured |
| `hasBasicAuth` | `()` | `boolean` | Check if Basic auth is configured |

### ConfigLoader

```ts
import { ConfigLoader } from '@anthropic/@signalwire/sdk';
```

JSON configuration file loader with `${VAR|default}` environment variable interpolation and dot-notation access.

#### Constructor

```ts
constructor(filePath?: string)
```

Optionally loads a JSON file immediately on construction.

#### Static Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `search` | `(filename: string)` | `ConfigLoader \| null` | Search CWD, `./config`, `$HOME/.signalwire` |

#### Instance Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `load` | `(filePath: string)` | `this` | Load from a JSON file with env interpolation |
| `loadFromObject` | `(obj: Record<string, unknown>)` | `this` | Load from a plain object |
| `get` | `<T>(path: string, defaultValue?: T)` | `T` | Dot-notation access (e.g., `'server.port'`) |
| `set` | `(path: string, value: unknown)` | `this` | Set a value at a dot-notation path |
| `has` | `(path: string)` | `boolean` | Check if a path exists |
| `getAll` | `()` | `Record<string, unknown>` | Shallow copy of all config |
| `getFilePath` | `()` | `string \| null` | Path of loaded config file |

### Logger

```ts
import { Logger, getLogger, setGlobalLogLevel, suppressAllLogs, setGlobalLogFormat, setGlobalLogColor, resetLoggingConfiguration } from '@anthropic/@signalwire/sdk';
```

Structured logger configurable via environment variables.

#### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `SIGNALWIRE_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` | Minimum log level |
| `SIGNALWIRE_LOG_MODE` | `off` | -- | Set to `off` to suppress all logging |
| `SIGNALWIRE_LOG_FORMAT` | `text`, `json` | `text` | Output format |
| `SIGNALWIRE_LOG_COLOR` | `true`, `false` | auto (TTY) | ANSI color codes in text format |

#### Logger Constructor

```ts
constructor(name: string, context?: Record<string, unknown>)
```

#### Logger Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `debug` | `(msg: string, data?)` | `void` | Log at debug level |
| `info` | `(msg: string, data?)` | `void` | Log at info level |
| `warn` | `(msg: string, data?)` | `void` | Log at warn level |
| `error` | `(msg: string, data?)` | `void` | Log at error level |
| `bind` | `(context: Record<string, unknown>)` | `Logger` | Create child logger with merged context |

#### Module Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `getLogger` | `(name: string): Logger` | Create a new Logger instance |
| `setGlobalLogLevel` | `(level: LogLevel): void` | Set minimum level for all loggers |
| `suppressAllLogs` | `(suppress?: boolean): void` | Suppress/unsuppress all output |
| `setGlobalLogFormat` | `(format: 'text' \| 'json'): void` | Set output format |
| `setGlobalLogColor` | `(enabled: boolean): void` | Enable/disable ANSI colors |
| `resetLoggingConfiguration` | `(): void` | Reset to env-var defaults |

### SslConfig

```ts
import { SslConfig } from '@anthropic/@signalwire/sdk';
```

SSL/TLS configuration sourced from explicit options or environment variables.

#### Environment Variables

| Variable | Description |
|----------|-------------|
| `SWML_SSL_ENABLED` | Set to `true` to enable SSL |
| `SWML_SSL_CERT_PATH` | Path to PEM certificate |
| `SWML_SSL_KEY_PATH` | Path to PEM private key |
| `SWML_SSL_DOMAIN` | Domain for HSTS headers |

#### Constructor

```ts
constructor(opts?: SslOptions)
```

See [SslOptions](#ssloptions).

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether SSL is enabled |
| `certPath` | `string \| null` | PEM certificate path |
| `keyPath` | `string \| null` | PEM private key path |
| `domain` | `string \| null` | HSTS domain |
| `hsts` | `boolean` | Whether to emit HSTS headers |
| `hstsMaxAge` | `number` | HSTS max-age in seconds |

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `isConfigured` | `()` | `boolean` | Check if SSL is fully configured with valid files |
| `getCert` | `()` | `string \| null` | Read PEM certificate from disk |
| `getKey` | `()` | `string \| null` | Read PEM private key from disk |
| `getHstsHeader` | `()` | `string \| null` | Build HSTS header value |
| `getServerOptions` | `()` | `{ cert, key } \| null` | Options for `https.createServer()` |
| `hstsMiddleware` | `()` | Hono middleware | Middleware that appends HSTS header |

### SchemaUtils

```ts
import { SchemaUtils } from '@anthropic/@signalwire/sdk';
```

Validates SWML documents against structural rules with an LRU-style result cache.

#### Constructor

```ts
constructor(opts?: { skipValidation?: boolean; maxCacheSize?: number })
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skipValidation` | `boolean` | `SWML_SKIP_SCHEMA_VALIDATION` env | Skip all validation |
| `maxCacheSize` | `number` | `100` | Maximum cached results |

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `validate` | `(swml: string \| Record<string, unknown>)` | `ValidationResult` | Validate a SWML document |
| `clearCache` | `()` | `void` | Clear the validation cache |
| `getCacheSize` | `()` | `number` | Get current cache entry count |

### ServerlessAdapter

```ts
import { ServerlessAdapter } from '@anthropic/@signalwire/sdk';
```

Adapts a Hono application for deployment on serverless platforms. Auto-detects platform from environment variables.

#### Constructor

```ts
constructor(platform?: ServerlessPlatform)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `platform` | `ServerlessPlatform` | `'auto'` | Target platform or auto-detect |

#### Instance Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `detectPlatform` | `()` | `ServerlessPlatform` | Detect platform from env vars |
| `getPlatform` | `()` | `ServerlessPlatform` | Get resolved platform |
| `handleRequest` | `(app, event)` | `Promise<ServerlessResponse>` | Route event through Hono app |
| `generateUrl` | `(opts?)` | `string` | Generate platform-specific invocation URL |

#### Static Factory Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `createLambdaHandler` | `(app)` | `(event) => Promise<ServerlessResponse>` | AWS Lambda handler |
| `createGcfHandler` | `(app)` | `(req, res) => Promise<void>` | Google Cloud Functions handler |
| `createAzureHandler` | `(app)` | `(context, req) => Promise<void>` | Azure Functions handler |

**Example (AWS Lambda):**
```ts
const agent = new AgentBase({ name: 'MyAgent' });
export const handler = ServerlessAdapter.createLambdaHandler(agent.getApp());
```

---

## Types and Interfaces

### AgentOptions

```ts
interface AgentOptions
```

Configuration options for constructing an AgentBase instance.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | -- | Display name (required); also used as default basic-auth username |
| `route` | `string` | `'/'` | HTTP route path |
| `host` | `string` | `'0.0.0.0'` | Hostname to bind |
| `port` | `number` | `PORT` env or `3000` | Port number |
| `basicAuth` | `[string, string]` | Auto-generated | Explicit `[username, password]` credentials |
| `usePom` | `boolean` | `true` | Use POM-based prompt rendering |
| `tokenExpirySecs` | `number` | `3600` | Session token expiry in seconds |
| `autoAnswer` | `boolean` | `true` | Insert an "answer" verb in SWML |
| `recordCall` | `boolean` | `false` | Record the call |
| `recordFormat` | `string` | `'mp4'` | Recording format |
| `recordStereo` | `boolean` | `true` | Stereo recording |
| `defaultWebhookUrl` | `string` | -- | Default SWAIG webhook URL |
| `nativeFunctions` | `string[]` | `[]` | Native function names |
| `agentId` | `string` | Random hex | Unique agent instance ID |
| `suppressLogs` | `boolean` | `false` | Suppress all log output |

### LanguageConfig

```ts
interface LanguageConfig
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Human-readable name (e.g., `"English"`) |
| `code` | `string` | BCP-47 code (e.g., `"en-US"`) |
| `voice` | `string` | Voice identifier |
| `engine` | `string` | TTS engine identifier |
| `fillers` | `Record<string, string[]>` | Filler phrases by category |
| `speechModel` | `string` | Speech recognition model |
| `functionFillers` | `Record<string, Record<string, string[]>>` | Per-function fillers by language |

### PronunciationRule

```ts
interface PronunciationRule
```

| Property | Type | Description |
|----------|------|-------------|
| `replace` | `string` | Text pattern to match |
| `with` | `string` | Replacement pronunciation |
| `ignoreCase` | `boolean` | Case-insensitive matching |

### FunctionInclude

```ts
interface FunctionInclude
```

| Property | Type | Description |
|----------|------|-------------|
| `url` | `string` | URL of the remote SWAIG endpoint |
| `functions` | `string[]` | Function names at the endpoint |
| `meta_data` | `Record<string, unknown>` | Optional metadata |

### DynamicConfigCallback

```ts
type DynamicConfigCallback = (
  queryParams: Record<string, string>,
  bodyParams: Record<string, unknown>,
  headers: Record<string, string>,
  agent: unknown,   // Ephemeral AgentBase copy
) => void | Promise<void>;
```

Callback invoked on each SWML request to dynamically modify an ephemeral copy of the agent. The original agent is never mutated.

### SummaryCallback

```ts
type SummaryCallback = (
  summary: Record<string, unknown> | null,
  rawData: Record<string, unknown>,
) => void | Promise<void>;
```

Callback invoked when a post-prompt summary is received.

### SwaigHandler

```ts
type SwaigHandler = (
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
) => FunctionResult | Record<string, unknown> | string | Promise<FunctionResult | Record<string, unknown> | string>;
```

Handler function for a SWAIG tool invocation. Can return:
- A `FunctionResult` instance
- A plain object with a `response` key
- A plain string (wrapped into a FunctionResult)
- A `Promise` of any of the above

### SwaigFunctionOptions

```ts
interface SwaigFunctionOptions
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | -- | Unique tool name (required) |
| `handler` | `SwaigHandler` | -- | Handler function (required) |
| `description` | `string` | -- | Description shown to AI (required) |
| `parameters` | `Record<string, unknown>` | `{}` | JSON Schema parameter properties |
| `secure` | `boolean` | `false` | Require session token auth |
| `fillers` | `Record<string, string[]>` | -- | Language-keyed filler phrases |
| `waitFile` | `string` | -- | Audio file URL for waiting |
| `waitFileLoops` | `number` | -- | Wait file loop count |
| `webhookUrl` | `string` | -- | External webhook URL |
| `required` | `string[]` | `[]` | Required parameter names |
| `extraFields` | `Record<string, unknown>` | `{}` | Additional SWAIG definition fields |

### AuthConfig

```ts
interface AuthConfig
```

| Property | Type | Description |
|----------|------|-------------|
| `bearerToken` | `string` | Bearer token for Authorization header |
| `apiKey` | `string` | API key for X-Api-Key header |
| `basicAuth` | `[string, string]` | Basic auth `[username, password]` |
| `customValidator` | `(request: { headers, method, url }) => boolean \| Promise<boolean>` | Custom validation function |

### SslOptions

```ts
interface SslOptions
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean` | `SWML_SSL_ENABLED` env | Whether SSL is enabled |
| `certPath` | `string` | `SWML_SSL_CERT_PATH` env | Path to PEM certificate |
| `keyPath` | `string` | `SWML_SSL_KEY_PATH` env | Path to PEM private key |
| `domain` | `string` | `SWML_SSL_DOMAIN` env | Domain for HSTS |
| `hsts` | `boolean` | `true` | Send HSTS headers |
| `hstsMaxAge` | `number` | `31536000` | HSTS max-age in seconds |

### ValidationResult

```ts
interface ValidationResult
```

| Property | Type | Description |
|----------|------|-------------|
| `valid` | `boolean` | Whether the document passed validation |
| `errors` | `string[]` | Human-readable error messages (empty when valid) |

### ServerlessEvent

```ts
interface ServerlessEvent
```

Normalized incoming event from a serverless platform.

| Property | Type | Description |
|----------|------|-------------|
| `httpMethod` | `string` | HTTP method (AWS Lambda style) |
| `method` | `string` | HTTP method (GCF/Azure style) |
| `headers` | `Record<string, string>` | Request headers |
| `body` | `string \| Record<string, unknown>` | Request body |
| `path` | `string` | Request path |
| `rawPath` | `string` | Raw request path (API Gateway v2) |
| `queryStringParameters` | `Record<string, string>` | Query parameters |
| `requestContext` | `Record<string, unknown>` | Platform-specific context |

### ServerlessResponse

```ts
interface ServerlessResponse
```

| Property | Type | Description |
|----------|------|-------------|
| `statusCode` | `number` | HTTP status code |
| `headers` | `Record<string, string>` | Response headers |
| `body` | `string` | Response body |

### PomSectionData

```ts
interface PomSectionData
```

Serializable representation of a POM section for JSON export.

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Section heading |
| `body` | `string` | Body text |
| `bullets` | `string[]` | Bullet points |
| `numbered` | `boolean` | Whether subsections are numbered |
| `numberedBullets` | `boolean` | Whether bullets are rendered as a numbered list |
| `subsections` | `PomSectionData[]` | Nested child sections |

### Skill Types

#### SkillConfig

```ts
interface SkillConfig { [key: string]: unknown }
```

#### SkillToolDefinition

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique tool name |
| `description` | `string` | Description shown to AI |
| `parameters` | `Record<string, unknown>` | Parameter schema |
| `handler` | `SwaigHandler` | Handler function |
| `secure` | `boolean` | Require secure invocation |
| `fillers` | `Record<string, string[]>` | Filler phrases by language |
| `required` | `string[]` | Required parameter names |

#### SkillPromptSection

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Section heading |
| `body` | `string` | Body text |
| `bullets` | `string[]` | Bullet points |
| `numbered` | `boolean` | Render bullets as numbered list |

#### SkillManifest

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique skill name |
| `description` | `string` | Human-readable description |
| `version` | `string` | Semantic version |
| `author` | `string` | Author or organization |
| `tags` | `string[]` | Categorization tags |
| `requiredEnvVars` | `string[]` | Required environment variables |
| `requiredPackages` | `string[]` | Required npm packages |
| `configSchema` | `Record<string, unknown>` | JSON-schema config description |

### Payment Types

#### PaymentPrompt

| Property | Type | Description |
|----------|------|-------------|
| `for` | `string` | Situation this prompt applies to |
| `actions` | `PaymentAction[]` | Actions for this prompt |
| `card_type` | `string` | Optional card type filter |
| `error_type` | `string` | Optional error type |

#### PaymentAction

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | Action type (e.g., `"say"`, `"play"`) |
| `phrase` | `string` | Phrase or URL |

#### PaymentParameter

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Parameter name |
| `value` | `string` | Parameter value |
