# API Reference

This page lists the classes, functions and types you use to build agents with the SignalWire AI Agents TypeScript SDK. Every name on it is exported from `@signalwire/sdk`. The RELAY client and the REST client have their own references: see [relay/docs/client-reference.md](../relay/docs/client-reference.md) and [rest/docs/client-reference.md](../rest/docs/client-reference.md). For non-AI call flows, see the [SWMLService guide](swml_service_guide.md).

The examples on this page share a setup block that declares the agents they use:

<!-- snippet-setup -->
```ts
export {}; // treat each runnable example as a module
// Shared instances the runnable fragments on this page assume.
// Ambient import()-types avoid clashing with the per-section `import { ... }` blocks.
declare const agent: import('@signalwire/sdk').AgentBase;
declare const agent1: import('@signalwire/sdk').AgentBase;
declare const agent2: import('@signalwire/sdk').AgentBase;
```

---

## Table of Contents

The page covers these classes, functions and types:

- [AgentBase](#agentbase)
  - [Constructor](#agentbase-constructor)
  - [Static Members](#agentbase-static-members)
  - [Public Properties](#agentbase-public-properties)
  - [Prompt Methods](#prompt-methods)
  - [Tool Methods](#tool-methods)
  - [Speech and Language Methods](#speech-and-language-methods)
  - [AI Configuration Methods](#ai-configuration-methods)
  - [Call Flow Methods](#call-flow-methods)
  - [Context Methods](#context-methods)
  - [Skill Methods](#skill-methods)
  - [Per-Request Configuration Methods](#per-request-configuration-methods)
  - [SIP Routing and MCP Methods](#sip-routing-and-mcp-methods)
  - [URL and Proxy Methods](#url-and-proxy-methods)
  - [Server Methods](#server-methods)
  - [Utility Methods](#utility-methods)
  - [Lifecycle Hooks](#lifecycle-hooks)
- [AgentServer](#agentserver)
- [FunctionResult](#functionresult)
  - [Constructor](#functionresult-constructor)
  - [Core Methods](#functionresult-core-methods)
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
  - [Static Helpers](#functionresult-static-helpers)
  - [Serialization](#functionresult-serialization)
- [SwaigFunction](#swaigfunction)
- [DataMap](#datamap)
  - [Constructor](#datamap-constructor)
  - [Configuration Methods](#datamap-configuration-methods)
  - [Webhook Methods](#datamap-webhook-methods)
  - [Output Methods](#datamap-output-methods)
  - [Registration and Serialization](#datamap-registration-and-serialization)
  - [Module Functions](#datamap-module-functions)
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
- [Capability Helpers](#capability-helpers)
- [Post-Prompt Helpers](#post-prompt-helpers)
- [AI Chat Gateway and Handoff](#ai-chat-gateway-and-handoff)
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
  - [Skill Types](#skill-types)
  - [Payment Types](#payment-types)

---

## AgentBase

Import the class from the package root:

```ts
import { AgentBase } from '@signalwire/sdk';
```

`AgentBase` is one HTTP-servable voice agent. It extends `SWMLService` and holds a prompt manager, a session manager for tool tokens, a SWAIG tool registry and a skill manager. It renders the SWML document in five phases and serves it, along with the SWAIG and post-prompt endpoints, from a Hono app.

### AgentBase Constructor

The constructor takes one options object:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(opts: AgentOptions)
```

[AgentOptions](#agentoptions) lists every option and its default. The constructor throws when the resolved port is outside 1 to 65535.

**Example:**

```ts
import { AgentBase } from '@signalwire/sdk';

const myAgent = new AgentBase({ name: 'MyAgent', route: '/agent' });
```

### AgentBase Static Members

#### `PROMPT_SECTIONS`

Subclasses can declare prompt sections on the class:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
static PROMPT_SECTIONS?: { title: string; body?: string; bullets?: string[]; numbered?: boolean }[]
```

The constructor adds each entry with `promptAddSection()`.

**Example:**

```ts
import { AgentBase } from '@signalwire/sdk';

class MyAgent extends AgentBase {
  static override PROMPT_SECTIONS = [
    { title: 'Role', body: 'You are a helpful assistant.' },
    { title: 'Rules', bullets: ['Be concise.', 'Be polite.'] },
  ];
}
```

#### `SUPPORTED_INTERNAL_FILLER_NAMES`

The set of internal function names that accept fillers:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
static readonly SUPPORTED_INTERNAL_FILLER_NAMES: ReadonlySet<string>
```

It holds `hangup`, `check_time`, `wait_for_user`, `wait_seconds`, `adjust_response_latency`, `next_step`, `change_context`, `get_visual_input` and `get_ideal_strategy`. `setInternalFillers()` and `addInternalFiller()` log a warning for any other name.

#### `extractSipUsername(requestBody)`

This static method reads the SIP username from a request body:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
static extractSipUsername(requestBody: SwmlRequestData): string | null
```

It reads `call.to`. For a `sip:` or `sips:` URI it returns the part before `@`, and for a `tel:` URI it removes the scheme. Otherwise it returns `call.to` as is. It returns `null` when `call.to` is missing.

#### `setupGracefulShutdown(opts?)`

This static method registers `SIGTERM` and `SIGINT` handlers once per process:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
static setupGracefulShutdown(opts?: { timeout?: number }): void
```

On a signal, the handler logs, waits `timeout` milliseconds (default `5000`) and calls `process.exit(0)`. It doesn't close the HTTP server or wait for requests in flight.

### AgentBase Public Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` (readonly) | Display name of this agent |
| `route` | `string` (readonly) | HTTP route path, without a trailing slash (`/` for the root) |
| `host` | `string` (readonly) | Hostname the HTTP server binds to |
| `port` | `number` (readonly) | Port the HTTP server listens on |
| `agentId` | `string` | Identifier for this agent instance |
| `signingKey` | `string \| null` (getter) | The resolved webhook signing key, or `null` when signature validation is off |
| `promptManager` | `PromptManager` (getter) | The agent's [PromptManager](#promptmanager) |
| `pom` | `PromptObjectModel \| null` (getter) | A new `PromptObjectModel` built from the current POM sections, or `null` when POM mode is off. Changing it doesn't change the agent. |
| `nativeFunctions` | `string[]` (getter and setter) | Native SWAIG function names |
| `skillManager` | `SkillManager` (getter) | The agent's [SkillManager](#skillmanager) |
| `schemaUtils` | `SchemaUtils` (readonly) | A [SchemaUtils](#schemautils) built from the `schemaPath` and `schemaValidation` options |
| `log` | `Logger` | The agent's logger |

### Prompt Methods

#### `setPromptText(text)`

Set the main prompt as raw text. A raw prompt takes precedence over POM sections when the SWML is rendered.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setPromptText(text: string): this
```

#### `setPostPrompt(text)`

Set the post-prompt text. When it's set, the rendered AI verb carries a `post_prompt` and a `post_prompt_url` that points at this agent's `/post_prompt` endpoint, with a per-call token.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setPostPrompt(text: string): this
```

#### `promptAddSection(title, opts?)`

Add a section to the POM prompt.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
promptAddSection(title: string, opts?: {
  body?: string;
  bullets?: string[];
  numbered?: boolean;
  numberedBullets?: boolean;
  subsections?: { title: string; body?: string; bullets?: string[] }[];
}): this
```

#### `promptAddToSection(title, opts?)`

Append body text or bullets to a section. The section is created if it doesn't exist.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
promptAddToSection(title: string, opts?: {
  body?: string;
  bullet?: string;
  bullets?: string[];
}): this
```

#### `promptAddSubsection(parentTitle, title, opts?)`

Add a subsection under a section. The parent section is created if it doesn't exist.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
promptAddSubsection(parentTitle: string, title: string, opts?: {
  body?: string;
  bullets?: string[];
}): this
```

#### `promptHasSection(title)`

Check whether a top-level prompt section with the given title exists.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
promptHasSection(title: string): boolean
```

#### `getPrompt()`

Get the prompt as text: the raw prompt when one is set, otherwise the POM sections rendered as Markdown.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getPrompt(): string
```

#### `getPromptPom()`

Get the POM sections as plain objects, or `null` when POM mode is off or there are no sections.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getPromptPom(): Record<string, unknown>[] | null
```

#### `getRawPrompt()`

Get the text stored by `setPromptText()`, or `null` when none is set.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getRawPrompt(): string | null
```

#### `setPromptPom(pom)`

Replace every POM section with the given list. Each entry has a `title` and optionally `body`, `bullets`, `numbered`, `numberedBullets` and `subsections`. Throws when the agent was created with `usePom: false`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setPromptPom(pom: Record<string, unknown>[]): this
```

#### `getPostPrompt()`

Get the post-prompt text, or `null` when none is set.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getPostPrompt(): string | null
```

### Tool Methods

#### `defineTool(opts)`

`defineTool()` registers a SWAIG function that the model can call. Its signature is generic over the `parameters` map:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
defineTool<P extends ToolParameters, R extends readonly PropertyKey[]>(
  opts: Omit<SwaigFunctionOptions, 'parameters' | 'required' | 'handler'> & {
    parameters?: P;
    required?: R;
    handler: (
      args: ToolArgs<P, R>,
      rawData: SwaigRequest,
      agent?: AgentBase,
    ) => FunctionResult | Record<string, unknown> | string
       | Promise<FunctionResult | Record<string, unknown> | string>;
  },
): this
```

When `parameters` is a flat map of property definitions written inline, TypeScript infers the type of `args` from it. A full JSON Schema object (`{ type: 'object', properties }`) is also accepted; `args` is then an open record. The options are those of [SwaigFunctionOptions](#swaigfunctionoptions):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | (required) | Tool name |
| `description` | `string` | (required) | Description the model reads to decide when to call the tool |
| `parameters` | `Record<string, unknown>` | `{}` | Property definitions, or a full JSON Schema object |
| `handler` | function | (required) | Called with `(args, rawData, agent)` |
| `secure` | `boolean` | `true` | Require a per-call token. The rendered SWML gives the tool its own `web_hook_url` with a `__token` for that function and call. Pass `false` to let the tool run without a token. |
| `fillers` | `Record<string, string[]>` | none | Filler phrases by language code, emitted as the function's `fillers` |
| `waitFile` | `string` | none | Audio URL, emitted as `wait_file` |
| `waitFileLoops` | `number` | none | Emitted as `wait_file_loops` |
| `required` | `string[]` | `[]` | Required parameter names, used when `parameters` is a flat map |
| `webhookUrl` | `string` | none | An external URL that runs the tool instead of this agent |
| `extraFields` | `Record<string, unknown>` | `{}` | Extra keys merged into the function definition |
| `onError` | `SwaigErrorHandler` | none | Called when the handler throws; may return a `FunctionResult` to use as the response |
| `errorMessage` | `string` | A generic apology | Response used when the handler throws and no error hook returns one |
| `isTypedHandler` | `boolean` | `false` | Marks a handler that takes named parameters; `defineTypedTool()` sets it |

The handler's third argument is the agent the request was configured on. With a dynamic config callback or `addPerCallConfig()`, that's the per-request copy. The handler's return value is the tool's response: context for the model, which decides what to say. See [SwaigHandler](#swaighandler) for how each return type is serialized.

**Example:**

```ts
import { FunctionResult } from '@signalwire/sdk';

agent.defineTool({
  name: 'get_weather',
  description: 'Get the current weather for a city',
  parameters: { city: { type: 'string', description: 'City name' } },
  required: ['city'],
  handler: async (args, rawData, running) => {
    const units = running?.getName() === 'metric-weather' ? 'C' : 'F';
    return new FunctionResult(`Weather in ${args.city}: sunny, 22 ${units}. Call ${rawData.call_id}.`);
  },
});
```

#### `defineTypedTool(opts)`

Register a tool whose handler takes the arguments as named positional parameters instead of an `args` object. When `parameters` is omitted, the SDK infers a schema from the handler's parameter names and default values.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
defineTypedTool(opts: {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  handler: TypedToolHandler;
  secure?: boolean;
  fillers?: Record<string, string[]>;
  waitFile?: string;
  waitFileLoops?: number;
  required?: string[];
}): this
```

#### `getTools()`

Get every registered `SwaigFunction`. DataMap and other raw function definitions aren't included. Calls `defineTools()` first if it hasn't run.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getTools(): SwaigFunction[]
```

#### `getRegisteredTools()`

Get a summary of every registered tool. For a raw definition such as a DataMap tool, `description` is read from its `purpose` key and `parameters` from its `argument` key.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getRegisteredTools(): { name: string; description: string; parameters: Record<string, unknown> }[]
```

#### `getTool(name)`

Look up a registered `SwaigFunction` by name. Returns `undefined` for a raw definition.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getTool(name: string): SwaigFunction | undefined
```

#### `registerSwaigFunction(fn)`

Register a `SwaigFunction`, or a raw function definition such as the output of `DataMap.toSwaigFunction()`. A raw definition is registered under its `function` key and rendered as is.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
registerSwaigFunction(fn: SwaigFunction | Record<string, unknown>): this
```

#### Tool Registry Methods

`AgentBase` inherits these registry methods from `SWMLService`:

| Method | Signature | Description |
|--------|-----------|-------------|
| `hasTool` | `(name: string): boolean` | Whether a tool with the name is registered |
| `hasFunction` | `(name: string): boolean` | Same as `hasTool` |
| `getFunction` | `(name: string): SwaigFunction \| Record<string, unknown> \| undefined` | The registered entry, including raw definitions |
| `getAllFunctions` | `(): Record<string, SwaigFunction \| Record<string, unknown>>` | Every registered entry, keyed by name |
| `removeFunction` | `(name: string): boolean` | Remove a tool; returns `false` when it wasn't registered |
| `listToolNames` | `(): string[]` | Registered names in registration order |

#### `onError(handler)`

Set an agent-level hook that runs when a tool handler throws, after the tool's own `onError`. It receives `(error, { functionName, args, rawData })` and may return a `FunctionResult` to use as the response. Pass `undefined` to clear it. The error never reaches the HTTP layer.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
onError(handler: SwaigErrorHandler | undefined): this
```

#### `validateToolToken(functionName, token, callId)`

Check a token for a tool. Returns `false` for an unknown tool and `true` for a tool registered with `secure: false`. A raw definition counts as secure.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
validateToolToken(functionName: string, token: string, callId: string): boolean
```

#### `createToolToken(toolName, callId)`

Mint a token for a tool and call with the agent's session manager. Returns `''` on failure.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
createToolToken(toolName: string, callId: string): string
```

### Speech and Language Methods

#### `addHint(hint)`

Add a speech-recognition hint, emitted in the AI verb's `hints`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addHint(hint: string): this
```

#### `addHints(hints)`

Add several hints at once.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addHints(hints: string[]): this
```

#### `addPatternHint(opts)`

Add a pattern hint, emitted in `hints` as `{ hint, pattern, replace, ignore_case }`. `ignore_case` is emitted only when `ignoreCase` is `true`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addPatternHint(opts: { hint: string; pattern: string; replace: string; ignoreCase?: boolean }): this
```

#### `addLanguage(config)`

Add a language to the AI verb's `languages`. `speechModel` and `functionFillers` are emitted as `speech_model` and `function_fillers`, and `params` only when it isn't empty. See [LanguageConfig](#languageconfig).

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addLanguage(config: LanguageConfig): this
```

#### `setLanguages(languages)`

Replace every configured language.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setLanguages(languages: LanguageConfig[]): this
```

#### `setMultilingual(config)`

Set a top-level `multilingual` object on the AI verb. The SDK passes the object through as given.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setMultilingual(config: Record<string, unknown>): this
```

#### `setLanguageParams(code, params)`

Set the `params` of a language added earlier. An empty object removes the key, and an unknown code does nothing.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setLanguageParams(code: string, params: Record<string, unknown>): this
```

#### `getLanguageParams(code)`

Get a language's `params`, or `undefined` when the code is unknown or has none.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getLanguageParams(code: string): Record<string, unknown> | undefined
```

#### `addPronunciation(rule)`

Add a pronunciation rule, emitted in `pronounce`. See [PronunciationRule](#pronunciationrule).

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addPronunciation(rule: PronunciationRule): this
```

#### `setPronunciations(rules)`

Replace every pronunciation rule.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setPronunciations(rules: PronunciationRule[]): this
```

### AI Configuration Methods

#### `setParam(key, value)`

Set one entry in the AI verb's `params`, such as `temperature` or `end_of_speech_timeout`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setParam(key: string, value: unknown): this
```

#### `setParams(params)`

Merge entries into `params`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setParams(params: Record<string, unknown>): this
```

#### `setGlobalData(data)`

Merge entries into `global_data`. Existing keys, including those a skill added, are kept unless `data` has the same key. To clear the object first, use `replaceGlobalData()`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setGlobalData(data: Record<string, unknown>): this
```

#### `updateGlobalData(data)`

Merge entries into `global_data`, like `setGlobalData()`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
updateGlobalData(data: Record<string, unknown>): this
```

#### `replaceGlobalData(data)`

Replace `global_data` with a shallow copy of `data`, removing every earlier key, including skill-added ones.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
replaceGlobalData(data: Record<string, unknown>): this
```

#### `setNativeFunctions(funcs)`

Set the names emitted in `SWAIG.native_functions`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setNativeFunctions(funcs: string[]): this
```

#### `setInternalFillers(internalFillers)`

Merge fillers for internal functions, keyed by function name and then language code. They're emitted in `SWAIG.internal_fillers`. A name outside `SUPPORTED_INTERNAL_FILLER_NAMES` logs a warning.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setInternalFillers(internalFillers: Record<string, Record<string, string[]>>): this
```

#### `addInternalFiller(functionName, languageCode, fillers)`

Set the fillers for one internal function and language. An unsupported name logs a warning and is still stored.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addInternalFiller(functionName: string, languageCode: string, fillers: string[]): this
```

#### `addFunctionInclude(url, functions, metaData?)`

Add an entry to `SWAIG.includes`, naming functions served by another endpoint.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addFunctionInclude(url: string, functions: string[], metaData?: Record<string, unknown>): this
```

#### `setFunctionIncludes(includes)`

Replace every include. Entries without a `url` or a `functions` array are dropped.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setFunctionIncludes(includes: FunctionInclude[]): this
```

#### `setPromptLlmParams(params)`

Merge keys into the AI verb's `prompt` object, beside `text` or `pom`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setPromptLlmParams(params: Record<string, unknown>): this
```

#### `setPostPromptLlmParams(params)`

Merge keys into the `post_prompt` object.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setPostPromptLlmParams(params: Record<string, unknown>): this
```

#### `enableDebugEvents(level?)`

Emit `debug_webhook_url` (this agent's `/debug_events` endpoint) and `debug_webhook_level` (default `1`) on the AI verb.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
enableDebugEvents(level?: number): this
```

### Call Flow Methods

`renderSwml()` builds the `main` section in five phases:

1. Pre-answer verbs
2. The `answer` verb, when `autoAnswer` is `true`
3. A `record_call` verb when `recordCall` is `true`, then the post-answer verbs
4. The `ai` verb
5. Post-AI verbs

When the SWML is rendered, verbs added through these methods are checked against the bundled SWML schema, unless `SWML_SKIP_SCHEMA_VALIDATION=true`. `renderSwml()` throws a `SchemaValidationError` for an unknown verb or an invalid config.

#### `addPreAnswerVerb(verbName, config)`

Add a verb to phase 1. A number is for verbs that take one, such as `sleep`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addPreAnswerVerb(verbName: string, config: Record<string, unknown> | number): this
```

#### `addAnswerVerb(config?)`

Set the configuration of the phase 2 `answer` verb.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addAnswerVerb(config?: Record<string, unknown>): this
```

#### `addPostAnswerVerb(verbName, config)`

Add a verb to phase 3.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addPostAnswerVerb(verbName: string, config: Record<string, unknown> | number): this
```

#### `addPostAiVerb(verbName, config)`

Add a verb to phase 5.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addPostAiVerb(verbName: string, config: Record<string, unknown>): this
```

#### `clearPreAnswerVerbs()`, `clearPostAnswerVerbs()`, `clearPostAiVerbs()`

Remove every verb in that phase.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
clearPreAnswerVerbs(): this
clearPostAnswerVerbs(): this
clearPostAiVerbs(): this
```

### Context Methods

#### `defineContexts(contexts?)`

Set the agent's contexts and return the active `ContextBuilder`. Pass a `ContextBuilder` to use it. With no argument, or with a plain object, the method creates an empty `ContextBuilder`; a plain object's contents aren't used. See [ContextBuilder](#contextbuilder).

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
defineContexts(contexts?: ContextBuilder | Record<string, unknown>): ContextBuilder
```

#### `resetContexts()`

Remove every context from the active builder.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
resetContexts(): this
```

#### `getContexts()`

Get the serialized contexts, or `null` when `defineContexts()` hasn't been called. Serializing validates the contexts and throws on an error.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getContexts(): Record<string, unknown> | null
```

### Skill Methods

#### `addSkill(skill)`

Add a skill instance. The skill manager validates it and runs its `setup()`. The agent then registers the skill's tools and DataMap tools, adds its prompt sections and hints, and merges its global data. See [SkillBase](#skillbase).

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
async addSkill(skill: SkillBase): Promise<this>
```

#### `addSkillByName(skillName, params?)`

Create a skill from the global `SkillRegistry` and add it. Throws when the name isn't registered.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
async addSkillByName(skillName: SkillNameOrString, params?: SkillConfig): Promise<this>
```

#### `removeSkill(instanceId)`

Remove a skill by instance key or instance ID, running its `cleanup()`. Returns `false` when no skill matches. The skill's tools, prompt sections and hints stay registered.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
async removeSkill(instanceId: string): Promise<boolean>
```

#### `removeSkillByName(skillName)`

Remove the first loaded skill with the given name.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
async removeSkillByName(skillName: string): Promise<boolean>
```

#### `listSkills()`

List the loaded skills.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
listSkills(): { name: string; instanceId: string; initialized: boolean }[]
```

#### `hasSkill(skillName)`

Check whether a skill with the given name is loaded.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
hasSkill(skillName: SkillNameOrString): boolean
```

### Per-Request Configuration Methods

A per-request configuration callback lets one agent serve different configurations to different calls. The SDK makes a per-request copy of the agent for each request that renders SWML, runs a SWAIG function or delivers a summary. It runs the callbacks on that copy. The SWML is rendered from the copy, and `/swaig` and `/post_prompt` requests run on the copy. The original agent isn't modified.

The SDK copies these settings, so changing them on the copy affects only that request:

- The prompt, tools, hints, languages and pronunciations
- The params, global data, function includes, LLM params and fillers
- The call-flow verbs, SWAIG query params and native functions
- The MCP servers, SIP usernames, routing callbacks and contexts

Skills the agent loaded are shared with the copy, and their `setup()` doesn't run again. Anything else, such as a field a subclass adds, is shared with the agent and every request in flight. Assign a new value to such a field on the copy rather than changing a shared object in place.

A handler that captured the original agent (an arrow function that refers to it, or a method bound with `.bind(this)`) still sees the original. Read per-call configuration from the handler's third argument. A subclass's JavaScript `#private` fields aren't on the copy, so methods that read them throw there; use TypeScript `private` fields instead.

#### `setDynamicConfigCallback(cb)`

Set the per-request configuration callback. It replaces every callback registered so far, including those from `addPerCallConfig()`. The callback receives `(queryParams, bodyParams, headers, agent)`, where `agent` is the per-request copy; credential-bearing headers are removed first. See [DynamicConfigCallback](#dynamicconfigcallback).

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setDynamicConfigCallback(cb: DynamicConfigCallback): this
```

#### `addPerCallConfig(cb)`

Add a per-request configuration callback, keeping the ones already registered. The callbacks run in registration order on the same copy, so a later one sees what an earlier one set. When a callback throws, the error is logged, the later callbacks are skipped, and the request continues with the copy as configured so far.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addPerCallConfig(cb: DynamicConfigCallback): this
```

**Example:**

```ts
import { AgentBase, hasCapability } from '@signalwire/sdk';

const support = new AgentBase({ name: 'support' });
support.setPromptText('You are a support agent.');

support.addPerCallConfig((query, body, headers, copy) => {
  if (query['tier'] === 'gold') copy.updateGlobalData({ tier: 'gold' });
});
support.addPerCallConfig((query, body, headers, copy) => {
  if (hasCapability(body, 'display_content')) {
    copy.promptAddSection('Screen', { body: 'The caller can see content you show.' });
  }
});
```

#### `onCallEnd(handler)`

Register a handler that runs when the call ends, and return it. The first registration defines a tool named `hangup_hook` and sets the `swaig_post_conversation` param to `true`, unless that param is explicitly `false`, which logs a warning. Handlers run in registration order with the call log (`call_log`, or `raw_call_log` when that's empty) and the whole SWAIG request. Return values are ignored, and an exception is logged without stopping the other handlers.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
onCallEnd(
  handler: (callLog: Record<string, unknown>[], rawData: SwaigRequest) => void | Promise<void>,
): (callLog: Record<string, unknown>[], rawData: SwaigRequest) => void | Promise<void>
```

**Example:**

```ts
import { AgentBase } from '@signalwire/sdk';

const archiver = new AgentBase({ name: 'archiver' });
archiver.onCallEnd((callLog, rawData) => {
  console.log(`call ${rawData.call_id} ended after ${callLog.length} log entries`);
});
```

#### `addSwaigQueryParams(params)`

Add query parameters to the SWAIG and post-prompt webhook URLs the agent renders. Entries with an empty value are left out.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addSwaigQueryParams(params: Record<string, string>): this
```

#### `clearSwaigQueryParams()`

Remove every SWAIG query parameter.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
clearSwaigQueryParams(): this
```

### SIP Routing and MCP Methods

#### `enableSipRouting(autoMap?, path?)`

Register a routing callback at `path` (default `/sip`) that reads the SIP username from each request. With `autoMap` (default `true`), it also calls `autoMapSipUsernames()`. The agent's own callback never redirects; it serves the agent's SWML.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
enableSipRouting(autoMap?: boolean, path?: string): this
```

#### `registerSipUsername(username)`

Map a SIP username (stored in lowercase) to this agent's route.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
registerSipUsername(username: string): this
```

#### `autoMapSipUsernames()`

Register usernames derived from the agent's name and route: each lowercased with characters other than letters, digits and `_` removed. For a name longer than three characters, a form without vowels is also registered.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
autoMapSipUsernames(): this
```

#### `registerRoutingCallback(callback, path?)`

Serve a routing endpoint at `path` (default `/sip`). On a POST with a body, the callback receives `(body, headers)`. When it returns a route, the endpoint responds `307` with that route in `Location`; when it returns `null` or `undefined`, the endpoint serves the agent's SWML.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
registerRoutingCallback(callback: RoutingCallback, path?: string): this
```

#### `addMcpServer(url, opts?)`

Add an entry to `SWAIG.mcp_servers` in the rendered SWML, with `headers`, `resources` and `resource_vars` when set.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addMcpServer(url: string, opts?: {
  headers?: Record<string, string>;
  resources?: boolean;
  resourceVars?: Record<string, string>;
}): this
```

#### `enableMcpServer()`

Serve the agent's tools as an MCP server (JSON-RPC 2.0) at `POST {route}/mcp`. The endpoint requires the agent's basic auth. It lists and calls only tools the agent runs itself, not DataMap tools or tools with a `webhookUrl`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
enableMcpServer(): this
```

#### `isMcpServerEnabled()` and `getMcpServers()`

Report whether the `/mcp` endpoint is on, and get a copy of the list added with `addMcpServer()`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
isMcpServerEnabled(): boolean
getMcpServers(): Record<string, unknown>[]
```

### URL and Proxy Methods

#### `manualSetProxyUrl(url)`

Set the public base URL used to build webhook URLs, with trailing slashes removed. It replaces the value from `SWML_PROXY_URL_BASE` and stops proxy headers from changing it.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
manualSetProxyUrl(url: string): this
```

#### `setWebHookUrl(url)`

Set the URL emitted as `SWAIG.defaults.web_hook_url`. A secure tool still gets its own `web_hook_url` with its token.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setWebHookUrl(url: string): this
```

#### `setPostPromptUrl(url)`

Set the URL emitted as `post_prompt_url`, replacing the agent's own `/post_prompt` URL and its token.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setPostPromptUrl(url: string): this
```

#### `getFullUrl(includeAuth?)`

Get the agent's public URL, including its route. The base is the proxy URL when one is set. Otherwise, in a serverless environment (and before `serve()` runs), it's the platform's function URL; otherwise it's `http://host:port`, with `localhost` for `0.0.0.0` and `https` when `SWML_ENFORCE_HTTPS=true`. With `includeAuth` (default `false`), the basic-auth credentials are embedded in the URL.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getFullUrl(includeAuth?: boolean): string
```

### Server Methods

#### `getApp()`

Get the Hono app that serves the agent, building it on first use. It calls `defineTools()` first if it hasn't run.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getApp(): Hono
```

The app serves these routes under the agent's route:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `{route}` | GET, POST | Renders the SWML. A GET reads `call_id` from the query string, and a POST from the body. |
| `{route}/swaig` | POST | Runs a SWAIG function. A secure function needs a valid `__token` for that function and call. |
| `{route}/swaig` | GET | Renders the SWML |
| `{route}/post_prompt` | POST | Delivers the call summary to `onSummary`. Needs the post-prompt token for the call. |
| `{route}/post_prompt` | GET | Renders the SWML |
| `{route}/debug_events` | POST | Passes the body to `onDebugEvent` |
| `{route}/mcp` | POST | MCP endpoint, when `enableMcpServer()` was called |
| `{route}/post_prompt_override` | POST | Replaces the post-prompt text, when `enablePostPromptOverride` is set |
| `{route}/check_for_input` | GET, POST | Echoes the body, when `checkForInputOverride` is set |
| `{route}{path}` | GET, POST | A routing callback registered with `registerRoutingCallback()` |
| `{route}/health` | GET | Returns `{ status: 'ok' }` |
| `{route}/ready` | GET | Returns `{ status: 'ready' }` |

Every route except `/health` and `/ready` requires the agent's basic auth. When a signing key is set, a POST to the root, `/swaig`, `/post_prompt` or a routing-callback path also needs a valid webhook signature. An unsigned or mis-signed request gets `403`. The middleware checks `X-SignalWire-Sha256-Signature` first, then `X-SignalWire-Signature` (SHA-1). For more information, see [Security](security.md).

#### `asRouter()`

Get a Hono app with the agent's routes relative to its root (`/`, `/swaig`, `/post_prompt` and the rest), for mounting in a host app: `hostApp.route(agent.route, agent.asRouter())`. `HostAppRouter` is an alias for `Hono`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
asRouter(): HostAppRouter
```

#### `mount(appOrRouter, opts?)`

Serve another Hono app, or a fetch handler, beside the agent's routes. `prefix` is the path from the host root (default the root), with a trailing slash removed; `name` has no effect. The agent's routes take precedence. A mounted app isn't behind the agent's basic auth, CORS, CSRF check or security headers, so it applies its own. Call `mount()` before `serve()`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
mount(
  appOrRouter: Hono | ((req: Request) => Response | Promise<Response>),
  opts?: { prefix?: string; name?: string },
): this
```

**Example:**

```ts
import { AgentBase } from '@signalwire/sdk';

const withStatus = new AgentBase({ name: 'with-status', route: '/agent' });
withStatus.mount(() => new Response('ok'), { prefix: '/status' });
```

#### `serve(opts?)`

Start an HTTP server with `@hono/node-server`, using the constructor's host and port unless `opts` overrides them. It does nothing when `SWAIG_CLI_MODE=true`, which `swaig-test` sets.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
async serve(opts?: { host?: string; port?: number }): Promise<void>
```

#### `run(opts?)`

Call `runServerless()` when `opts.event` is given or a serverless environment is detected (`AWS_LAMBDA_FUNCTION_NAME`, `_HANDLER`, `K_SERVICE`, `FUNCTION_TARGET`, `FUNCTIONS_WORKER_RUNTIME` or `GATEWAY_INTERFACE` is set). Otherwise call `serve()`. For predictable behavior, call `serve()` or `runServerless()` directly.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
async run(opts?: {
  host?: string;
  port?: number;
  event?: ServerlessEvent;
  context?: unknown;
  platform?: 'lambda' | 'gcf' | 'azure' | 'cgi' | 'auto';
}): Promise<void | ServerlessResponse>
```

#### `runServerless(event, context?, platform?)`

Handle one serverless invocation through the agent's app with a [ServerlessAdapter](#serverlessadapter). In CGI mode with an empty event, the request is read from the environment and standard input, and the response is written to standard output.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
async runServerless(
  event: ServerlessEvent,
  context?: unknown,
  platform?: 'lambda' | 'gcf' | 'azure' | 'cgi' | 'auto',
): Promise<ServerlessResponse>
```

#### `renderSwml(callId?, modifications?)`

Render the SWML document as a JSON string. `callId` is used for the per-call tokens; a random ID is generated when it's omitted. `modifications` is merged into the AI verb: `global_data` is merged key by key, and every other key replaces the AI verb's value.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
renderSwml(callId?: string, modifications?: Record<string, unknown>): string
```

#### `handleRequest(method, url, headers, body?)`

Handle a SWML request without Hono and return `[status, headers, body]`. It checks basic auth (`401`), runs a routing callback (`307`), calls `onSwmlRequest()` and renders the SWML from the per-request copy when callbacks are registered. It doesn't check webhook signatures.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
async handleRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: Record<string, unknown> | null,
): Promise<[number, Record<string, string>, string]>
```

### Utility Methods

#### `getName()`

Get the agent's name.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getName(): string
```

#### `getBasicAuthCredentials(includeSource?)`

Get the basic-auth username and password. With `includeSource: true`, a third element says where they came from.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getBasicAuthCredentials(includeSource?: false): [string, string]
getBasicAuthCredentials(includeSource: true): [string, string, 'provided' | 'environment' | 'config file' | 'generated']
```

#### `enableDebugRoutes()`

Does nothing. It exists for code written for the Python SDK; `getApp()` always serves `/health`, `/ready` and `/debug_events`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
enableDebugRoutes(): this
```

### Lifecycle Hooks

Override these methods in a subclass.

#### `defineTools()`

Register the subclass's tools here with `this.defineTool()`. The agent calls it once, the first time tools are needed: from `renderSwml()`, `getTools()`, `getApp()`, `asRouter()` or SWAIG dispatch. Calling it yourself from a constructor is safe, since it runs only once. The default does nothing.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
protected defineTools(): void
```

#### `onSummary(summary, rawData)`

Called for each POST to `/post_prompt` that carries a valid post-prompt token. `summary` is the body's `summary`, else `post_prompt_data.parsed[0]`, else `post_prompt_data.raw` parsed as JSON (or the raw string when it isn't JSON), else `null`. With per-request configuration, it runs on the per-request copy. For a request whose `action` is `fetch_conversation`, a returned object is sent back as the response instead of `{ success: true }`. To read the body in one shape across voice and chat, see [Post-Prompt Helpers](#post-prompt-helpers).

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
onSummary(
  summary: PostPromptData | null,
  rawData: PostPrompt,
): void | Record<string, unknown> | Promise<void | Record<string, unknown>>
```

#### `onSwmlRequest(rawData, callbackPath?, context?)`

Called on the agent before each SWML render. `context` is the Hono context of a served request, and `undefined` from `handleRequest()`. A returned object is passed to `renderSwml()` as `modifications`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
onSwmlRequest(
  rawData: SwmlRequestData,
  callbackPath?: string,
  context?: Context,
): Record<string, unknown> | void | Promise<Record<string, unknown> | void>
```

#### `onRequest(requestData?, callbackPath?)`

Calls `onSwmlRequest()` and returns its result. Override `onSwmlRequest()` instead.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
onRequest(
  requestData?: SwmlRequestData | null,
  callbackPath?: string | null,
): Record<string, unknown> | void | Promise<Record<string, unknown> | void>
```

#### `onDebugEvent(event)`

Called with the body of each POST to `/debug_events`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
onDebugEvent(event: Record<string, unknown>): void | Promise<void>
```

#### `onFunctionCall(name, args, rawData)`

Called after the token check and before a SWAIG function runs, on the agent the request runs on. A returned object is sent as the response, and the function doesn't run.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
onFunctionCall(
  name: string,
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
): Record<string, unknown> | void | Promise<Record<string, unknown> | void>
```

#### `validateBasicAuth(username, password)`

Every route that requires basic auth calls it with the request's credentials. The default compares them with the configured pair in constant time. An override replaces that comparison, so call `super.validateBasicAuth()` to keep it and add your own check.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
validateBasicAuth(username: string, password: string): boolean | Promise<boolean>
```

---

## AgentServer

Import the class from the package root:

```ts
import { AgentServer } from '@signalwire/sdk';
```

`AgentServer` serves several agents from one HTTP server, each under its own route prefix.

### Constructor

The constructor takes an optional options object:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(opts?: { host?: string; port?: number; logLevel?: string })
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | `string` | `'0.0.0.0'` | Hostname to bind to |
| `port` | `number` | `PORT` env, else `3000` | Port to listen on |
| `logLevel` | `string` | `'info'` | Passed to `setGlobalLogLevel()`, except under `swaig-test` |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(agent: AgentBase, route?: string): void` | Mount the agent's `asRouter()` at `route` (default the agent's route). Throws when the route is taken. |
| `unregister` | `(route: string): boolean` | Remove an agent from the server's list; returns `false` when none was registered there. Its routes stay mounted in the app. |
| `getAgents` | `(): Map<string, AgentBase>` | Registered agents keyed by route |
| `getAgent` | `(route: string): AgentBase \| undefined` | The agent at a route |
| `serveStaticFiles` | `(directory: string, route?: string): void` | Serve files from a directory, rejecting paths with `..` |
| `setupSipRouting` | `(route?: string, autoMap?: boolean): void` | Route SIP requests to agents by username at `route` (default `/sip`) |
| `registerSipUsername` | `(username: string, route: string): void` | Map a SIP username to an agent's route |
| `registerGlobalRoutingCallback` | `(callbackFn: RoutingCallback, path: string): void` | Register a routing callback on every agent, including agents registered later |
| `getApp` | `(): Hono` | The server's Hono app. Adds a `GET /` listing of the agents unless an agent is registered at `/`. |
| `run` | `(host?: string, port?: number): Promise<void>` | Start the HTTP server. Does nothing when `SWAIG_CLI_MODE=true`. |

**Example:**

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port): it collides under the concurrent gate and cannot run standalone -->
```ts
import { AgentServer } from '@signalwire/sdk';

const server = new AgentServer({ port: 8080 });
server.register(agent1, '/sales');
server.register(agent2, '/support');
await server.run();
```

---

## FunctionResult

Import the class from the package root:

```ts
import { FunctionResult } from '@signalwire/sdk';
```

`FunctionResult` builds a SWAIG function's response: a response for the model and an ordered list of actions for the platform. The response is context for the model, not speech: the model reads it and decides what to say. Every method that changes the result returns `this`. `SwaigFunctionResult` is a deprecated alias.

### FunctionResult Constructor

The constructor takes the response and optional settings:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(
  response?: string | { tool_result?: string; tool_prompt?: string },
  postProcess?: boolean,
  toolResult?: string,
  toolPrompt?: string,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `response` | `string \| { tool_result?, tool_prompt? }` | `''` | The response text, or the structured form |
| `postProcess` | `boolean` | `false` | Whether the model takes one more turn before the actions run |
| `toolResult` | `string` | none | Sets the structured response's `tool_result`, as `setToolResponse()` does |
| `toolPrompt` | `string` | none | Sets the structured response's `tool_prompt` |

### Public Properties

| Property | Type | Description |
|----------|------|-------------|
| `response` | `string` | The response text. It's `''` while a structured response is set. |
| `action` | `Record<string, unknown>[]` | Ordered list of actions |
| `postProcess` | `boolean` | Whether post-processing is on |

### FunctionResult Core Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setResponse` | `(response: string): this` | Set the response text, clearing a structured response |
| `setToolResponse` | `(toolResult?: string, toolPrompt?: string): this` | Set the structured response `{ tool_result, tool_prompt }` |
| `setPostProcess` | `(postProcess: boolean): this` | Turn post-processing on or off |
| `addAction` | `(name: string, data: unknown): this` | Append `{ [name]: data }` |
| `addActions` | `(actions: Record<string, unknown>[]): this` | Append several actions |

The structured response separates what the tool did from what the model should say next. `tool_result` is a factual status line for the model to reason from, and `tool_prompt` is an instruction. Splitting them keeps a status line from being read aloud as speech, and keeps an instruction from being taken as data.

**Example:**

```ts
import { FunctionResult } from '@signalwire/sdk';

const result = new FunctionResult().setToolResponse(
  'payment declined: insufficient funds',
  'Tell the caller the card was declined and ask for another card.',
);
console.log(JSON.stringify(result.toDict()));
```

### Call Control Actions

| Method | Signature | Emits |
|--------|-----------|-------|
| `connect` | `(destination: string, final?: boolean, fromAddr?: string): this` | A `SWML` action with a `connect` verb (`to`, and `from` when `fromAddr` is set), and `transfer: 'true'` or `'false'` from `final` (default `true`) |
| `swmlTransfer` | `(dest: string, aiResponse: string, final?: boolean): this` | A `SWML` action that sets `ai_response` and then runs `transfer` to `dest`, with `transfer` from `final` (default `true`) |
| `hangup` | `(): this` | `{ hangup: true }` |
| `hold` | `(prompt?: string \| number, timeout?: number, step?: string, timeoutStep?: string): this` | `{ hold: timeout }`, or `{ hold: { timeout, step, timeout_step } }` when a step is given. See [`hold()`](#hold). |
| `waitForUser` | `(opts?: { enabled?: boolean; timeout?: number; answerFirst?: boolean }): this` | `{ wait_for_user: value }`, where value is `'answer_first'`, the timeout, `enabled` or `true`, in that order of precedence |
| `stop` | `(): this` | `{ stop: true }` |

#### `hold()`

`hold()` puts the call on hold, and can announce it and route the call when the hold ends:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
hold(prompt?: string | number, timeout?: number, step?: string, timeoutStep?: string): this
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | `string \| number` | none | Instruction for the model to deliver before the hold. A number here is read as `timeout`, so `hold(120)` still works. |
| `timeout` | `number` | `300` | Hold length in seconds, clamped to 0 to 900 |
| `step` | `string` | none | Step to move to when the call is taken off hold |
| `timeoutStep` | `string` | none | Step to move to when the hold times out |

Speech detection pauses during a hold, so the caller has to hear anything important before it starts. A string `prompt` sets the structured response to `{ tool_result: 'status: on hold', tool_prompt: prompt }`. It also turns on `postProcess`, so the model speaks before the hold runs. `step` and `timeoutStep` take effect when the hold ends. `swmlChangeStep()` applies at once, which would move the caller before the hold begins.

**Example:**

```ts
import { FunctionResult } from '@signalwire/sdk';

const result = new FunctionResult().hold(
  'Tell the caller you are checking whether the manager is available.',
  300,
  'back_with_manager',
  'take_a_message',
);
console.log(JSON.stringify(result.toDict()));
```

### Audio Actions

| Method | Signature | Emits |
|--------|-----------|-------|
| `say` | `(text: string): this` | `{ say: text }` |
| `playBackgroundFile` | `(filename: string, wait?: boolean): this` | `{ playback_bg: filename }`, or `{ playback_bg: { file, wait: true } }` when `wait` is `true` |
| `stopBackgroundFile` | `(): this` | `{ stop_playback_bg: true }` |

### Speech Actions

| Method | Signature | Emits |
|--------|-----------|-------|
| `addDynamicHints` | `(hints: (string \| { pattern: string; replace: string; ignore_case?: boolean })[]): this` | `{ add_dynamic_hints: hints }` |
| `clearDynamicHints` | `(): this` | `{ clear_dynamic_hints: {} }` |
| `setEndOfSpeechTimeout` | `(milliseconds: number): this` | `{ end_of_speech_timeout: milliseconds }` |
| `setSpeechEventTimeout` | `(milliseconds: number): this` | `{ speech_event_timeout: milliseconds }` |

### Data Actions

| Method | Signature | Emits |
|--------|-----------|-------|
| `updateGlobalData` | `(data: Record<string, unknown>): this` | `{ set_global_data: data }` |
| `removeGlobalData` | `(keys: string \| string[]): this` | `{ unset_global_data: keys }` |
| `setMetadata` | `(data: Record<string, unknown>): this` | `{ set_meta_data: data }` |
| `removeMetadata` | `(keys: string \| string[]): this` | `{ unset_meta_data: keys }` |

### SWML Actions

| Method | Signature | Emits |
|--------|-----------|-------|
| `executeSwml` | `(swmlContent: string \| Record<string, unknown> \| { toDict(): Record<string, unknown> }, transfer?: boolean): this` | `{ SWML: document }`, with `transfer: 'true'` when `transfer` is `true`. A string that isn't JSON becomes `{ raw_swml: string }`; any other value throws. |
| `swmlChangeStep` | `(stepName: string): this` | `{ change_step: stepName }` |
| `swmlChangeContext` | `(contextName: string): this` | `{ change_context: contextName }` |
| `swmlUserEvent` | `(eventData: Record<string, unknown>): this` | A `SWML` action with a `user_event` verb |
| `switchContext` | `(opts?: { systemPrompt?: string; userPrompt?: string; consolidate?: boolean; fullReset?: boolean }): this` | `{ context_switch: systemPrompt }` when only `systemPrompt` is set, otherwise an object with `system_prompt`, `user_prompt`, `consolidate` and `full_reset` |

### Function Actions

| Method | Signature | Emits |
|--------|-----------|-------|
| `toggleFunctions` | `(toggles: { function: string; active: boolean }[]): this` | `{ toggle_functions: toggles }` |
| `enableFunctionsOnTimeout` | `(enabled?: boolean): this` | `{ functions_on_speaker_timeout: enabled }` (default `true`) |
| `updateSettings` | `(settings: Record<string, unknown>): this` | `{ settings: settings }` |

### Communication Actions

| Method | Signature | Emits |
|--------|-----------|-------|
| `simulateUserInput` | `(text: string): this` | `{ user_input: text }` |
| `enableExtensiveData` | `(enabled?: boolean): this` | `{ extensive_data: enabled }` (default `true`) |
| `replaceInHistory` | `(text?: string \| boolean): this` | `{ replace_in_history: text }` (default `true`) |
| `sendSms` | `(opts: { toNumber: string; fromNumber: string; body?: string; media?: string[]; tags?: string[]; region?: string }): this` | A `SWML` action with a `send_sms` verb. Throws when neither `body` nor `media` is given. |
| `recordCall` | `(opts?: { controlId?, stereo?, format?, direction?, terminators?, beep?, inputSensitivity?, initialTimeout?, endSilenceTimeout?, maxLength?, statusUrl? }): this` | A `SWML` action with a `record_call` verb. Defaults: `stereo: false`, `format: 'wav'`, `direction: 'both'`, `beep: false`, `input_sensitivity: 44`. |
| `stopRecordCall` | `(controlId?: string): this` | A `SWML` action with a `stop_record_call` verb |
| `tap` | `(opts: { uri: string; controlId?: string; direction?: 'speak' \| 'listen' \| 'both'; codec?: 'PCMU' \| 'PCMA'; rtpPtime?: number; statusUrl?: string }): this` | A `SWML` action with a `tap` verb. `direction` defaults to `'both'` and is always sent. Throws on an invalid `direction` or `codec`, or an `rtpPtime` that isn't positive. |
| `stopTap` | `(controlId?: string): this` | A `SWML` action with a `stop_tap` verb |

### Room and Conference Actions

| Method | Signature | Emits |
|--------|-----------|-------|
| `joinRoom` | `(name: string): this` | A `SWML` action with `join_room: { name }` |
| `sipRefer` | `(toUri: string): this` | A `SWML` action with `sip_refer: { to_uri }` |
| `joinConference` | `(name: string, opts?): this` | A `SWML` action with a `join_conference` verb: the name alone when every option is at its default, otherwise an object. Throws on an empty name, or a `maxParticipants` outside 1 to 250. |

The `joinConference()` options are `muted`, `beep`, `startOnEnter`, `endOnExit`, `waitUrl`, `maxParticipants`, `record`, `region`, `trim`, `coach`, `statusCallbackEvent`, `statusCallback`, `statusCallbackMethod`, `recordingStatusCallback`, `recordingStatusCallbackMethod`, `recordingStatusCallbackEvent` and `result`. Each is emitted in snake case.

### RPC Actions

| Method | Signature | Emits |
|--------|-----------|-------|
| `executeRpc` | `(opts: { method: string; params?: Record<string, unknown>; callId?: string; nodeId?: string }): this` | A `SWML` action with an `execute_rpc` verb. An empty `params` is left out. |
| `rpcDial` | `(toNumber: string, fromNumber: string, destSwml: string, deviceType?: string): this` | `execute_rpc` with method `dial` (`deviceType` defaults to `'phone'`) |
| `rpcAiMessage` | `(callId: string, messageText?: string \| null, role?: string, globalData?: Record<string, unknown>): this` | `execute_rpc` with method `ai_message` |
| `rpcAiGlobalData` | `(callId: string, data: Record<string, unknown>): this` | `execute_rpc` with method `ai_message` and only `global_data` |
| `rpcAiUnhold` | `(callId: string): this` | `execute_rpc` with method `ai_unhold` |

`rpcAiMessage()` sends a message, global data or both to the AI agent on another call. `messageText` is sent with `role` (default `'system'`) as a turn in that conversation. `globalData` is merged into that call's global data, where a prompt reads it with `${global_data.key}`. The method throws when neither is given.

**Example:**

```ts
import { FunctionResult } from '@signalwire/sdk';

const result = new FunctionResult('Tell the caller the agent has their notes.')
  .rpcAiGlobalData('b6f1c2d4-call-id', { caller_notes: 'Wants a refund for order 1234.' });
console.log(JSON.stringify(result.toDict()));
```

### Payment Actions

#### `pay(opts)`

`pay()` starts a payment collection:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
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

It emits a `SWML` action that sets `ai_response` and runs the `pay` verb. Numbers and booleans are sent as strings, and `inputMethod` is sent as `input`. The default `aiResponse` is `'The payment status is ${pay_result}, do not mention anything else about collecting payment if successful.'`

### FunctionResult Static Helpers

| Method | Signature | Returns |
|--------|-----------|---------|
| `createPaymentPrompt` | `(forSituation: string, actions: PaymentAction[], cardType?: string, errorType?: string)` | `PaymentPrompt` |
| `createPaymentAction` | `(actionType: string, phrase: string)` | `PaymentAction` |
| `createPaymentParameter` | `(name: string, value: string)` | `PaymentParameter` |

### FunctionResult Serialization

#### `toDict()`

Serialize the result for the SWAIG response. `response` is the structured form when it has a field, otherwise the text when it isn't empty. `action` is present when there are actions, and `post_process: true` when post-processing is on and there are actions. An otherwise empty result serializes as `{ response: 'Action completed.' }`. `toJSON()` returns the same object, so `JSON.stringify(result)` emits it.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
toDict(): SwaigResultDict
```

---

## SwaigFunction

Import the class from the package root:

```ts
import { SwaigFunction } from '@signalwire/sdk';
```

`SwaigFunction` wraps a tool handler with the metadata SWAIG needs. `defineTool()` creates one for you.

### Constructor

The constructor takes one options object:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(opts: SwaigFunctionOptions)
```

See [SwaigFunctionOptions](#swaigfunctionoptions) for the options.

### Public Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Tool name |
| `handler` | `SwaigHandler` | Handler function |
| `description` | `string` | Description the model reads |
| `parameters` | `Record<string, unknown>` | Property definitions or a full JSON Schema object |
| `secure` | `boolean` | Whether a per-call token is required |
| `fillers` | `Record<string, string[]> \| undefined` | Filler phrases by language code |
| `waitFile` | `string \| undefined` | Wait audio URL |
| `waitFileLoops` | `number \| undefined` | Wait audio loop count |
| `webhookUrl` | `string \| undefined` | External webhook URL |
| `required` | `string[]` | Required parameter names |
| `extraFields` | `Record<string, unknown>` | Extra keys merged into the definition |
| `isTypedHandler` | `boolean` | Whether the handler takes named parameters |
| `isExternal` | `boolean` | Whether `webhookUrl` was given |
| `onError` | `SwaigErrorHandler \| undefined` | Per-tool error hook |
| `errorMessage` | `string \| undefined` | Per-tool error response |

### Methods

#### `validateArgs(args)`

Validate arguments against the parameter schema with Ajv. Returns `[true, []]` when the schema has no properties.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
validateArgs(args: Record<string, unknown>): [boolean, string[]]
```

#### `execute(args, rawData?, agentOnError?)`

Run the handler and return the serialized result. The handler's third argument is `undefined` here. When the handler throws, the tool's `onError`, then `agentOnError`, may supply a `FunctionResult`; otherwise the result carries `errorMessage` or the default error message.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
async execute(
  args: Record<string, unknown>,
  rawData?: SwaigRequest,
  agentOnError?: SwaigErrorHandler,
): Promise<SwaigResultDict>
```

#### `toSwaig(baseUrl, token?, callId?)`

Serialize the function for SWML: `function`, `description`, `parameters`, `web_hook_url` (`{baseUrl}/swaig`, with `?token=...&call_id=...` when both are given), the filler and wait-file keys when set, and `extraFields`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
toSwaig(baseUrl: string, token?: string, callId?: string): Record<string, unknown>
```

---

## DataMap

Import the class and helpers from the package root:

```ts
import { DataMap, createSimpleApiTool, createExpressionTool } from '@signalwire/sdk';
```

`DataMap` builds a SWAIG function with a `data_map`, which SignalWire runs on its servers. The platform calls the webhooks and evaluates the expressions without a request to your agent. The SDK only serializes the definition.

Templates in URLs, bodies and outputs are expanded by the platform. A webhook's JSON response is read from the root of the template data (`${total}`, `${results[0].title}`), and an array response is under `array`. Arguments are `${args.name}`. For the template reference, see the [DataMap guide](datamap-guide.md).

### DataMap Constructor

The constructor takes the function name:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(functionName: string)
```

The name is stored in the public `functionName` property.

### DataMap Configuration Methods

#### `enableEnvExpansion(enabled?)`

Turn on `${ENV.NAME}` expansion (the argument defaults to `true`; expansion is off until you call it). The SDK expands the variables in the whole definition when `toSwaigFunction()` runs, from the process environment. Only names with an allowed prefix are expanded, `SIGNALWIRE_`, `SWML_` or `SW_` by default; any other reference, or an unset variable, becomes an empty string. The expanded values are part of the SWML that SignalWire receives.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
enableEnvExpansion(enabled?: boolean): this
```

#### `setAllowedEnvPrefixes(prefixes)`

Set the allowed prefixes for this DataMap, overriding the global list. An empty array allows every variable.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
setAllowedEnvPrefixes(prefixes: string[]): this
```

#### `purpose(description)` and `description(description)`

Set the tool description the model reads. Without one, the description is `Execute {functionName}`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
purpose(description: string): this
description(description: string): this  // alias
```

#### `parameter(name, paramType, description, opts?)`

Add a parameter. The description is also read by the model.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
parameter(name: string, paramType: string, description: string, opts?: {
  required?: boolean;
  enum?: string[];
}): this
```

#### `expression(testValue, pattern, output, nomatchOutput?)`

Add an entry to `data_map.expressions`: `{ string, pattern, output, 'nomatch-output' }`. A `RegExp` is sent as its `source`, so its flags (such as `i`) are dropped.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
expression(
  testValue: string,
  pattern: string | RegExp,
  output: FunctionResult,
  nomatchOutput?: FunctionResult,
): this
```

### DataMap Webhook Methods

#### `webhook(method, url, opts?)`

Add a webhook, with `method` in upper case. The options are emitted as `headers`, `form_param`, `input_args_as_params` and `require_args`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
webhook(method: string, url: string, opts?: {
  headers?: Record<string, string>;
  formParam?: string;
  inputArgsAsParams?: boolean;
  requireArgs?: string[];
}): this
```

The next five methods apply to the most recently added webhook, and throw when there is none:

| Method | Signature | Sets |
|--------|-----------|------|
| `webhookExpressions` | `(expressions: Record<string, unknown>[]): this` | The webhook's `expressions` |
| `body` | `(data: Record<string, unknown>): this` | The webhook's `body` |
| `params` | `(data: Record<string, unknown>): this` | The webhook's `params` |
| `foreach` | `(config: { input_key: string; output_key: string; append: string; max?: number }): this` | The webhook's `foreach` |
| `output` | `(result: FunctionResult): this` | The webhook's `output` |

In a `foreach`, `append` is a template where `${this.field}` is the current element; the built text is stored under `output_key`.

### DataMap Output Methods

#### `fallbackOutput(result)`

Set the top-level `data_map.output`, the response the platform uses when every webhook fails.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
fallbackOutput(result: FunctionResult): this
```

#### `errorKeys(keys)`

Set `error_keys` on the most recently added webhook, or on the `data_map` when there's no webhook.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
errorKeys(keys: string[]): this
```

#### `globalErrorKeys(keys)`

Set `error_keys` on the `data_map`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
globalErrorKeys(keys: string[]): this
```

### DataMap Registration and Serialization

#### `registerWithAgent(agent)`

Pass `toSwaigFunction()` to the agent's `registerSwaigFunction()`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
registerWithAgent(agent: { registerSwaigFunction(fn: Record<string, unknown>): unknown }): this
```

#### `toSwaigFunction()`

Serialize to `{ function, description, parameters, data_map }`, expanding `${ENV.*}` references when expansion is on.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
toSwaigFunction(): Record<string, unknown>
```

**Example:**

```ts
import { AgentBase, DataMap, FunctionResult } from '@signalwire/sdk';

const weatherAgent = new AgentBase({ name: 'weather' });
new DataMap('get_weather')
  .purpose('Get the current weather for a city')
  .parameter('city', 'string', 'City name', { required: true })
  .webhook('GET', 'https://api.example.com/weather?q=${lc:enc:args.city}')
  .output(new FunctionResult('It is ${temp} degrees and ${condition} in ${args.city}.'))
  .fallbackOutput(new FunctionResult('The weather service is unavailable.'))
  .registerWithAgent(weatherAgent);
```

### DataMap Module Functions

#### `createSimpleApiTool(opts)`

Build a DataMap with one webhook whose output is `responseTemplate`. A parameter's type defaults to `'string'`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
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

#### `createExpressionTool(opts)`

Build a DataMap with one expression per entry: each key is the test value, and each value is `[pattern, result]`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
function createExpressionTool(opts: {
  name: string;
  patterns: Record<string, [string, FunctionResult]>;
  parameters?: Record<string, { type?: string; description?: string; required?: boolean }>;
}): DataMap
```

#### `setAllowedEnvPrefixes(prefixes)` and `getAllowedEnvPrefixes()`

Set or read the global list of prefixes allowed in `${ENV.*}` expansion. The default is `['SIGNALWIRE_', 'SWML_', 'SW_']`, and an empty array allows every variable.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
function setAllowedEnvPrefixes(prefixes: string[]): void
function getAllowedEnvPrefixes(): string[]
```

---

## ContextBuilder

Import the classes and helpers from the package root:

```ts
import { ContextBuilder, Context, Step, GatherInfo, GatherQuestion, createSimpleContext, HISTORY_MODES } from '@signalwire/sdk';
```

Contexts hold ordered steps. Each step has prompt text, completion criteria, the functions it allows and the steps and contexts it can move to. `agent.defineContexts()` attaches a builder to an agent, and the rendered AI verb carries the result as `contexts`. For a walkthrough, see the [contexts guide](contexts-guide.md).

### ContextBuilder Class

#### `addContext(name)`

Add a context and return it. Throws when the name exists or when there are already 50 contexts. A flow with one context must name it `default`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
addContext(name: string): Context
```

#### `getContext(name)`

Get a context by name.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
getContext(name: string): Context | undefined
```

#### `reset()`

Remove every context.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
reset(): this
```

#### `validate()`

Check the contexts and throw on the first problem. It requires at least one context, the name `default` for a single context, and at least one step in each context. It checks that every `initial_step`, `valid_steps`, `valid_contexts` and gather `completion_action` names something that exists, and that gather question keys are unique. On an agent, it also rejects tools named `next_step`, `change_context` or `gather_submit`, and `functions` lists that name unregistered tools.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
validate(): void
```

#### `toDict()`

Validate, then serialize every context in the order it was added.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
toDict(): Record<string, ContextDict>
```

### Context Class

A `Context` is a named set of ordered steps with its own prompt settings.

#### Constructor

The constructor has this signature:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(name: string)
```

#### Step Management

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `addStep` | `(name: string, opts?)` | `Step` | Add a step. Throws when the name exists or the context has 100 steps. |
| `getStep` | `(name: string)` | `Step \| undefined` | Get a step by name |
| `removeStep` | `(name: string)` | `this` | Remove a step |
| `moveStep` | `(name: string, position: number)` | `this` | Move a step to a zero-based position. Throws for an unknown step. |

The `addStep()` options are shortcuts:

| Option | Type | Description |
|--------|------|-------------|
| `task` | `string` | Calls `addSection('Task', task)` |
| `bullets` | `string[]` | Calls `addBullets('Process', bullets)` |
| `criteria` | `string` | Calls `setStepCriteria(criteria)` |
| `functions` | `string \| string[]` | Calls `setFunctions(functions)` |
| `validSteps` | `string[]` | Calls `setValidSteps(validSteps)` |

#### Navigation and Configuration

| Method | Signature | Description |
|--------|-----------|-------------|
| `setValidContexts` | `(contexts: string[]): this` | Contexts the model can move to |
| `setValidSteps` | `(steps: string[]): this` | Steps the model can move to |
| `setInitialStep` | `(stepName: string): this` | Step the context starts on, instead of the first |
| `setPostPrompt` | `(postPrompt: string): this` | Context `post_prompt` |
| `setSystemPrompt` | `(systemPrompt: string): this` | Raw `system_prompt`. Throws when system POM sections exist. |
| `setConsolidate` | `(consolidate: boolean): this` | Emits `consolidate: true` |
| `setFullReset` | `(fullReset: boolean): this` | Emits `full_reset: true` |
| `setUserPrompt` | `(userPrompt: string): this` | Emits `user_prompt` |
| `setIsolated` | `(isolated: boolean): this` | Emits `isolated: true` |
| `setPrompt` | `(prompt: string): this` | Raw `prompt`. Throws when prompt POM sections exist. |
| `setHistory` | `(history: string): this` | Default history mode for the context's steps: `keep`, `default` or `hide`. Throws on any other value. |

#### POM Sections

| Method | Signature | Description |
|--------|-----------|-------------|
| `addSystemSection` | `(title: string, body: string): this` | Section rendered into `system_prompt`. Throws after `setSystemPrompt()`. |
| `addSystemBullets` | `(title: string, bullets: string[]): this` | Bullet section rendered into `system_prompt` |
| `addSection` | `(title: string, body: string): this` | Section emitted in the context's `pom`. Throws after `setPrompt()`. |
| `addBullets` | `(title: string, bullets: string[]): this` | Bullet section emitted in `pom` |

#### Fillers

| Method | Signature | Description |
|--------|-----------|-------------|
| `setEnterFillers` | `(fillers: Record<string, string[]>): this` | `enter_fillers`, by language code |
| `setExitFillers` | `(fillers: Record<string, string[]>): this` | `exit_fillers`, by language code |
| `addEnterFiller` | `(languageCode: string, fillers: string[]): this` | Enter fillers for one language |
| `addExitFiller` | `(languageCode: string, fillers: string[]): this` | Exit fillers for one language |

#### `toDict()`

Serialize the context and its steps. Throws when it has no steps.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
toDict(): ContextDict
```

### Step Class

A `Step` is one stage of a context.

#### Constructor

The constructor has this signature:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(name: string)
```

#### Content Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setText` | `(text: string): this` | Raw step text. Throws when sections exist. |
| `addSection` | `(title: string, body: string): this` | Section rendered into the step text. Throws after `setText()`. |
| `addBullets` | `(title: string, bullets: string[]): this` | Bullet section rendered into the step text |
| `clearSections` | `(): this` | Remove every section and the raw text |

#### Configuration Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setStepCriteria` | `(criteria: string): this` | Emits `step_criteria` |
| `setFunctions` | `(functions: string \| string[]): this` | Emits `functions`: a list of allowed tools, or `[]` or `'none'` for none. A step that doesn't set it keeps the previous step's functions. |
| `setValidSteps` | `(steps: string[]): this` | Emits `valid_steps` |
| `setValidContexts` | `(contexts: string[]): this` | Emits `valid_contexts` |
| `setEnd` | `(end: boolean): this` | Emits `end: true`, which leaves step mode after this step. It doesn't end the call. |
| `setSkipUserTurn` | `(skip: boolean): this` | Emits `skip_user_turn: true` |
| `setSkipToNextStep` | `(skip: boolean): this` | Emits `skip_to_next_step: true` |
| `setHistory` | `(history: string): this` | History mode when the step is entered: `keep`, `default` or `hide`. Throws on any other value. |

#### Gather Info Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setGatherInfo` | `(opts?: { outputKey?: string; completionAction?: string; prompt?: string; isolated?: boolean }): this` | Start a `gather_info` for the step |
| `addGatherQuestion` | `(opts: { key: string; question: string; type?: string; confirm?: boolean; prompt?: string; functions?: string[]; isolated?: boolean }): this` | Add a question. Throws when `setGatherInfo()` hasn't been called. |

`completionAction` is `'next_step'` or the name of a step in the same context. `isolated` on the gather is the default for its questions, and a question's own `isolated` overrides it. A question's `false` is emitted, so it can override an isolated gather.

#### Reset Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setResetSystemPrompt` | `(systemPrompt: string): this` | Emits `reset.system_prompt` |
| `setResetUserPrompt` | `(userPrompt: string): this` | Emits `reset.user_prompt` |
| `setResetConsolidate` | `(consolidate: boolean): this` | Emits `reset.consolidate: true` |
| `setResetFullReset` | `(fullReset: boolean): this` | Emits `reset.full_reset: true` |

#### `toDict()`

Serialize the step. Throws when it has neither text nor sections.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
toDict(): StepDict
```

### GatherInfo Class

`GatherInfo` collects answers to a series of questions.

#### Constructor

The constructor has this signature:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(opts?: { outputKey?: string; completionAction?: string; prompt?: string; isolated?: boolean })
```

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addQuestion` | `(opts: { key; question; type?; confirm?; prompt?; functions?; isolated? }): this` | Add a question |
| `getQuestions` | `(): GatherQuestion[]` | Get the questions |
| `toDict` | `(): GatherInfoDict` | Serialize. Throws when there are no questions. |

### GatherQuestion Class

A `GatherQuestion` is one question in a gather.

#### Constructor

The constructor has this signature:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(opts: {
  key: string;
  question: string;
  type?: string;       // default 'string'
  confirm?: boolean;   // default false
  prompt?: string;
  functions?: string[];
  isolated?: boolean;
})
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | Key the answer is stored under |
| `question` | `string` | Question text |
| `type` | `string` | Answer type; emitted only when it isn't `'string'` |
| `confirm` | `boolean` | Whether the answer needs confirmation |
| `prompt` | `string \| undefined` | Extra prompt text for this question |
| `functions` | `string[] \| undefined` | Tools available while this question is asked |
| `isolated` | `boolean \| undefined` | Overrides the gather's `isolated` for this question |

#### `toDict()`

Serialize the question.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
toDict(): Record<string, unknown>
```

### ContextBuilder Helper Functions

#### `createSimpleContext(name?)`

Create a `Context` without a builder. The name defaults to `'default'`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
function createSimpleContext(name?: string): Context
```

#### `HISTORY_MODES`

The accepted history modes:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
const HISTORY_MODES: readonly ['keep', 'default', 'hide']
type HistoryMode = 'keep' | 'default' | 'hide'
```

---

## PomBuilder

Import the classes from the package root:

```ts
import { PomBuilder, PomSection } from '@signalwire/sdk';
```

The Prompt Object Model structures a prompt as sections, each with a title, body, bullets and nested subsections.

### PomSection Class

A `PomSection` is one section.

#### Constructor

The constructor has this signature:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
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
| `subsections` | `PomSection[]` | Nested sections |
| `numbered` | `boolean \| null` | Whether the section is numbered |
| `numberedBullets` | `boolean` | Whether bullets are numbered |

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `addSubsection` | `(opts: { title, body?, bullets?, numbered?, numberedBullets? })` | `PomSection` | Add a nested section |
| `toDict` | `()` | `PomSectionData` | Serialize |
| `renderMarkdown` | `(level?: number, sectionNumber?: number[])` | `string` | Render as Markdown, starting at heading level 2 |
| `renderXml` | `(indent?: number, sectionNumber?: number[])` | `string` | Render as XML |

### PomBuilder Class

A `PomBuilder` holds the top-level sections.

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `addSection` | `(title, opts?)` | `this` | Add a top-level section |
| `addToSection` | `(title, opts?)` | `this` | Append body text or bullets, creating the section if needed |
| `addSubsection` | `(parentTitle, title, opts?)` | `this` | Add a subsection, creating the parent if needed |
| `hasSection` | `(title: string)` | `boolean` | Whether a top-level section exists |
| `getSection` | `(title: string)` | `PomSection \| undefined` | Top-level section by title |
| `findSection` | `(title: string)` | `PomSection \| undefined` | Search every depth |
| `addPomAsSubsection` | `(target: string \| PomSection, pomToAdd: PomBuilder)` | `this` | Append another builder's sections as subsections. Throws for an unknown title. |
| `reset` | `()` | `this` | Remove every section |
| `toDict` | `()` | `PomSectionData[]` | Serialize every section |
| `toJson` | `()` | `string` | Serialize to a JSON string |
| `renderMarkdown` | `()` | `string` | Render every section as Markdown |
| `renderXml` | `()` | `string` | Render every section as XML under a `<prompt>` root |
| `pom` | (getter) | `PromptObjectModel` | A new `PromptObjectModel` built from the sections |
| `fromSections` | (static) `(sections: PomSectionData[])` | `PomBuilder` | Build a builder from serialized sections |

---

## SwmlBuilder

Import the class from the package root:

```ts
import { SwmlBuilder } from '@signalwire/sdk';
```

`SwmlBuilder` builds a SWML document, `{ version: '1.0.0', sections: { main: [...] } }`. Its constructor also installs one method per verb in the bundled SWML schema, such as `answer()`, `play()` and `hangup()`, each returning `this`.

### Constructor

The constructor takes optional settings:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(opts?: SwmlBuilderOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialDocument` | `{ version?: string; sections?: Record<string, unknown[]> }` | An empty document | Document to start from |
| `enableValidation` | `boolean` | `true` unless `SWML_SKIP_SCHEMA_VALIDATION=true` | Validate verbs against the schema |
| `schemaPath` | `string` | The bundled schema | Path to another SWML schema file |
| `service` | `{ name: string; route: string }` | none | The service the builder belongs to, kept in `service` |

### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `addVerb` | `(verbName: string, config: unknown, opts?: { skipValidation?: boolean })` | `void` | Append a verb to `main`. Throws `SchemaValidationError` for an unknown verb or invalid config when validation is on. |
| `addVerbToSection` | `(sectionName: string, verbName: string, config: unknown, opts?: { skipValidation?: boolean })` | `void` | Append a verb to a section, creating it. Validates like `addVerb()`. |
| `addSection` | `(sectionName: string)` | `this` | Create an empty section if it doesn't exist |
| `say` | `(text: string, opts?: { voice?: string; language?: string; gender?: 'male' \| 'female'; volume?: number })` | `this` | Append a `play` verb with a `say:` URL |
| `reset` | `()` | `this` | Start over with an empty document |
| `setValidation` | `(enabled: boolean)` | `void` | Turn validation on or off |
| `build` | `()` | `Record<string, unknown>` | The document object |
| `render` | `()` | `string` | The document as JSON |
| `document` | (getter) | `{ version: string; sections: Record<string, unknown[]> }` | The document being built |
| `getSchemaUtils` | (static) `()` | `SchemaUtils` | The shared `SchemaUtils` for the bundled schema |

---

## PromptManager

Import the class from the package root:

```ts
import { PromptManager } from '@signalwire/sdk';
```

`PromptManager` holds an agent's raw prompt text, post-prompt and POM sections.

### Constructor

The constructor takes the POM setting and an optional agent:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(usePom?: boolean, agent?: AgentBase)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `usePom` | `boolean` | `true` | Create a `PomBuilder` for sections |
| `agent` | `AgentBase` | none | Owning agent, kept in the readonly `agent` property |

### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `setPromptText` | `(text: string)` | `void` | Set raw prompt text, which takes precedence over sections |
| `setPostPrompt` | `(text: string)` | `void` | Set the post-prompt text |
| `addSection` | `(title, opts?)` | `void` | Add a POM section, creating the builder if needed |
| `addToSection` | `(title, opts?)` | `void` | Append to a section, creating it if needed |
| `addSubsection` | `(parentTitle, title, opts?)` | `void` | Add a subsection, creating the parent if needed |
| `hasSection` | `(title: string)` | `boolean` | Whether a section exists |
| `getPrompt` | `()` | `string` | The raw prompt, or the sections rendered as Markdown |
| `getRawPrompt` | `()` | `string \| null` | The raw prompt text |
| `getPostPrompt` | `()` | `string \| null` | The post-prompt text |
| `getPomBuilder` | `()` | `PomBuilder \| null` | The underlying builder |

---

## SessionManager

Import the class from the package root:

```ts
import { SessionManager } from '@signalwire/sdk';
```

`SessionManager` creates and checks the per-call tokens that secure SWAIG functions. A token is base64url of `callId.functionName.expiry.nonce.signature`, where the signature is an HMAC-SHA256 of the other fields. Validation needs no stored state, only the secret. It also keeps an in-memory metadata map per session.

### Constructor

The constructor takes the token lifetime and the secret:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(tokenExpirySecs?: number, secretKey?: string)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tokenExpirySecs` | `number` | `900` | Token lifetime in seconds. `AgentBase` passes its `tokenExpirySecs` option, which defaults to `3600`. |
| `secretKey` | `string` | 32 random bytes, hex-encoded | HMAC secret. `AgentBase` passes `swaigSecret`, then `SIGNALWIRE_SWAIG_SECRET`. |

A random secret exists only in its process. Tokens it signs stop validating after a restart and on other replicas, so set `swaigSecret` or `SIGNALWIRE_SWAIG_SECRET` to the same value on every replica.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `tokenExpirySecs` | `number` | Token lifetime in seconds |
| `secretKey` | `string` | HMAC secret |
| `debugMode` | `boolean` | Whether `debugToken()` decodes tokens (default `false`) |

### Methods

#### `createSession(callId?)`

Return `callId`, or a random identifier when it's omitted.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
createSession(callId?: string): string
```

#### `generateToken(functionName, callId)` and `createToolToken(functionName, callId)`

Create a token for a function and call. The two methods are equivalent.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
generateToken(functionName: string, callId: string): string
createToolToken(functionName: string, callId: string): string
```

#### `validateToken(callId, functionName, token)`

Return `true` when the token is for this function and call, hasn't expired and carries a valid signature. An empty `callId` fails. The signature is compared in constant time.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
validateToken(callId: string, functionName: string, token: string): boolean
```

#### `validateToolToken(functionName, token, callId)`

The same check as `validateToken()`, with the arguments in a different order.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
validateToolToken(functionName: string, token: string, callId: string): boolean
```

#### `debugToken(token)`

Decode a token without checking its signature. When `debugMode` is `false`, it returns `{ valid_format: false, error: 'debug mode not enabled' }`. Otherwise it returns `{ valid_format, components, status }`. `components` holds `call_id`, `function`, `expiry`, `expiry_date`, `nonce` and `signature`, with `call_id` and `signature` shortened to eight characters. `status` holds `current_time`, `is_expired` and `expires_in_seconds`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
debugToken(token: string): DebugTokenResult
```

#### Metadata Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `getSessionMetadata` | `(sessionId: string)` | `Record<string, unknown>` | The session's metadata, or `{}` |
| `setSessionMetadata` | `(sessionId: string, metadata: Record<string, unknown>)` | `void` | Merge metadata into the session |
| `setSessionMetadata` | `(sessionId: string, key: string, value: unknown)` | `boolean` | Set one key; returns `true` |
| `deleteSessionMetadata` | `(sessionId: string)` | `boolean` | Delete the session's metadata |
| `cleanup` | `(maxAgeMs?: number)` | `void` | Delete metadata older than `maxAgeMs` (default the token lifetime). It also runs when the map passes 1,000 sessions. |
| `activateSession` | `(callId: string)` | `boolean` | Does nothing; returns `true` |
| `endSession` | `(callId: string)` | `boolean` | Does nothing; returns `true` |

---

## Skills

Import the skill classes from the package root:

```ts
import { SkillBase, SkillManager, SkillRegistry } from '@signalwire/sdk';
```

### SkillBase

`SkillBase` is the abstract base class for skills. A skill adds tools, prompt sections, hints and global data to an agent.

#### Constructor

Throws when the subclass doesn't set `SKILL_NAME` or `SKILL_DESCRIPTION`. The `swaig_fields` config key is moved to `swaigFields`.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(config?: SkillConfig)
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `skillName` | `string` (readonly) | The class's `SKILL_NAME` |
| `instanceId` | `string` (readonly) | `{SKILL_NAME}-{timestamp}-{random hex}` |
| `swaigFields` | `Record<string, unknown>` (readonly) | Extra SWAIG fields merged into each of the skill's tools |
| `params` | `Readonly<SkillConfig>` (getter) | The configuration, without `swaig_fields` |
| `agent` | `AgentBase \| undefined` | The agent the skill was added to |
| `config` | `SkillConfig` (protected) | The configuration |
| `logger` | `Logger` (protected) | Logger named `signalwire.skills.{SKILL_NAME}` |

#### Static Members

| Member | Type | Description |
|--------|------|-------------|
| `SKILL_NAME` | `string` | Unique skill name. Required. |
| `SKILL_DESCRIPTION` | `string` | Description. Required. |
| `SKILL_VERSION` | `string` | Defaults to `'1.0.0'` |
| `REQUIRED_ENV_VARS` | `readonly string[]` | Environment variables checked when the skill is added |
| `REQUIRED_PACKAGES` | `readonly string[]` | npm packages checked with `import()` when the skill is added |
| `SUPPORTS_MULTIPLE_INSTANCES` | `boolean` | Whether several instances can load, told apart by `tool_name` (default `false`) |
| `getParameterSchema()` | `() => Record<string, ParameterSchemaEntry>` | Configuration schema. The base returns `swaig_fields` and `skip_prompt`, plus `tool_name` for multi-instance skills. |

#### Overridable Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `setup` | `()` | `Promise<boolean>` | Runs when the skill is added. Returning `false` makes adding it fail. |
| `getTools` | `()` | `SkillToolDefinition[]` | The skill's tools. The default returns those added with the protected `defineTool()`. |
| `getDataMapTools` | `()` | `Record<string, unknown>[]` | Raw function definitions to register (default `[]`) |
| `getPromptSections` | `()` | `SkillPromptSection[]` | Prompt sections; returns `[]` when `skip_prompt` is set. Override `_getPromptSections()` instead. |
| `getHints` | `()` | `string[]` | Speech-recognition hints |
| `getGlobalData` | `()` | `Record<string, unknown>` | Global data to merge |
| `getInstanceKey` | `()` | `string` | The skill name, or `{skillName}_{tool_name}` for a multi-instance skill |
| `cleanup` | `()` | `Promise<void>` | Runs when the skill is removed |

#### Utility Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `validateEnvVars` | `()` | `string[]` | Missing required environment variables |
| `hasAllEnvVars` | `()` | `boolean` | Whether none are missing |
| `validatePackages` | `()` | `Promise<string[]>` | Required packages that can't be imported |
| `hasAllPackages` | `()` | `Promise<boolean>` | Whether every package can be imported |
| `isInitialized` | `()` | `boolean` | Whether setup completed |
| `markInitialized` | `()` | `void` | Mark setup complete (the skill manager calls it) |
| `getConfig` | `<T>(key: string, defaultValue?: T)` | `T` | A configuration value, or the default |
| `setAgent` | `(agent: AgentBase)` | `void` | Set `agent` |
| `getSkillNamespace` | `()` | `string` | Key for the skill's data in global data, such as `skill:datetime` |
| `getSkillData` | `(rawData: SwaigRequest)` | `Record<string, unknown>` | The skill's data from a request's global data |
| `updateSkillData` | `(result: FunctionResult, data: Record<string, unknown>)` | `FunctionResult` | Add a `set_global_data` action for the skill's namespace |

### SkillManager

`SkillManager` loads and removes an agent's skills.

#### Constructor

The constructor has this signature:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(agent?: AgentBase)
```

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `addSkill` | `(skill: SkillBase)` | `Promise<void>` | Validate and set up a skill. Throws for a duplicate single-instance skill, missing environment variables or packages, or a failed `setup()`. |
| `loadSkill` | `(skillClass: typeof SkillBase, config?: SkillConfig)` | `Promise<[boolean, string]>` | Create and add a skill; returns `[false, message]` instead of throwing |
| `loadSkillByName` | `(skillName: string, config?: SkillConfig)` | `Promise<[boolean, string]>` | Create a skill from the registry and add it |
| `removeSkill` | `(keyOrId: string)` | `Promise<boolean>` | Remove by instance key or instance ID |
| `removeSkillByName` | `(skillName: string)` | `Promise<number>` | Remove every instance with the name; returns the count |
| `hasSkill` | `(skillName: string)` | `boolean` | Whether an instance with the name is loaded |
| `hasSkillByKey` | `(instanceKey: string)` | `boolean` | Whether an instance with the key is loaded |
| `getSkill` | `(keyOrId: string)` | `SkillBase \| undefined` | By instance key or instance ID |
| `listSkills` | `()` | `{ name, instanceId, initialized }[]` | Loaded skills |
| `listSkillKeys` | `()` | `string[]` | Loaded instance keys |
| `getAllTools` | `()` | `SkillToolDefinition[]` | Every skill's tools |
| `getAllPromptSections` | `()` | `SkillPromptSection[]` | Every skill's prompt sections |
| `getAllHints` | `()` | `string[]` | Every skill's hints |
| `getMergedGlobalData` | `()` | `Record<string, unknown>` | Every skill's global data, merged |
| `clear` | `()` | `Promise<void>` | Remove every skill |
| `loadedSkills` | (getter) | `ReadonlyMap<string, SkillBase>` | Loaded skills by instance key |
| `size` | (getter) | `number` | Number of loaded skills |

### SkillRegistry

`SkillRegistry` maps skill names to classes. It's a process-wide singleton; `SIGNALWIRE_SKILL_PATHS` (colon-separated) sets its initial search paths.

#### Static Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `getInstance` | `()` | `SkillRegistry` | The singleton |
| `resetInstance` | `()` | `void` | Drop the singleton, for tests |

#### Instance Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `register` | `(SkillClass: typeof SkillBase)` | `void` | Register a class under its `SKILL_NAME`. Throws when the name or parameter schema is empty; a locked name is kept and a warning logged. |
| `lock` | `(names?: string[])` | `void` | Stop names (default: all registered) from being overwritten |
| `unregister` | `(name: string)` | `boolean` | Remove a registration |
| `create` | `(name: string, config?: SkillConfig)` | `SkillBase \| null` | Create an instance |
| `getSkillClass` | `(name: string)` | `typeof SkillBase \| undefined` | The registered class |
| `has` | `(name: string)` | `boolean` | Whether the name is registered |
| `listRegistered` | `()` | `string[]` | Registered names |
| `listSkills` | `()` | `SkillSchemaInfo[]` | Registered skills with metadata |
| `getSkillSchema` | `(name: string)` | `SkillSchemaInfo \| undefined` | One skill's metadata |
| `getAllSkillsSchema` | `()` | `Record<string, SkillSchemaInfo>` | Every skill's metadata |
| `addSearchPath` | `(path: string)` | `void` | Add a discovery directory |
| `addSkillDirectory` | `(path: string)` | `void` | Add a discovery directory; throws when it doesn't exist or isn't a directory |
| `getSearchPaths` | `()` | `string[]` | Search paths |
| `getExternalPaths` | `()` | `string[]` | Directories added with `addSkillDirectory()` |
| `discoverFromDirectory` | `(dirPath: string)` | `Promise<string[]>` | Import skill files from a directory and register them. Does nothing unless `SWML_SKILL_DISCOVERY_ENABLED=true`. |
| `discoverAll` | `()` | `Promise<string[]>` | Discover from every search path |
| `listAllSkillSources` | `()` | `Record<string, string[]>` | Registered names grouped by source |
| `clear` | `()` | `void` | Remove every registration |
| `size` | (getter) | `number` | Number of registered skills |

The package root also exports functions that use the singleton: `listSkills()`, `listSkillsWithParams()`, `registerSkill(skillClass)` and `addSkillDirectory(path)`. `addSkillDirectory()` calls `addSearchPath()`.

---

## Prefab Agents

Prefab agents are `AgentBase` subclasses with their own prompt sections and tools. Each takes a config object; `agentOptions` is passed to `AgentBase`. For examples, see the [prefabs guide](prefabs-guide.md). `BedrockAgent`, which renders an `amazon_bedrock` verb instead of `ai`, has its own guide: [Bedrock Agent](bedrock_agent.md).

### InfoGathererAgent

Import the class from the package root:

```ts
import { InfoGathererAgent } from '@signalwire/sdk';
```

`InfoGathererAgent` asks the caller a list of questions, one at a time. In static mode, the questions come from the config. In dynamic mode, a callback supplies them for each request.

#### InfoGathererConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'info_gatherer'` | Agent name |
| `route` | `string` | `'/info_gatherer'` | HTTP route |
| `questions` | `InfoGathererQuestion[]` | none | Questions to ask (static mode). Omit for dynamic mode. |
| `questionCallback` | `InfoGathererQuestionCallback` | none | Supplies the questions for each request (dynamic mode) |
| `agentOptions` | `Partial<AgentOptions>` | none | Passed to `AgentBase` |

#### InfoGathererQuestion

| Property | Type | Description |
|----------|------|-------------|
| `key_name` | `string` | Key the answer is stored under |
| `question_text` | `string` | Question to ask |
| `confirm` | `boolean` | Whether the caller must confirm the answer before it's submitted |

Built-in tools: `start_questions` and `submit_answer`.

In dynamic mode, call `setQuestionCallback(cb)` or pass `questionCallback`. The callback receives `(queryParams, bodyParams, headers)` and returns the questions for that request. When no callback is registered, or it throws, the agent asks for a name and a message.

### SurveyAgent

Import the class from the package root:

```ts
import { SurveyAgent } from '@signalwire/sdk';
```

`SurveyAgent` runs a survey with typed questions, branching and scoring.

#### SurveyConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'survey'` | Agent name |
| `route` | `string` | `'/survey'` | HTTP route |
| `surveyName` | `string` | (required) | Survey name used in the prompt and global data |
| `questions` | `SurveyQuestion[]` | (required) | Survey questions in order |
| `introduction` | `string` | `` `Welcome to our ${surveyName}. We appreciate your participation.` `` | Opening message, also installed as a non-bargeable static greeting |
| `conclusion` | `string` | `'Thank you for completing our survey. Your feedback is valuable to us.'` | Closing message |
| `brandName` | `string` | `'Our Company'` | Company the agent represents |
| `maxRetries` | `number` | `2` | Retries for an invalid answer |
| `onComplete` | `(responses, score) => void \| Promise<void>` | none | Called when the survey is finished |
| `agentOptions` | `Partial<AgentOptions>` | none | Passed to `AgentBase` |

#### SurveyQuestion

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Question identifier |
| `text` | `string` | Question text |
| `type` | `'multiple_choice' \| 'open_ended' \| 'rating' \| 'yes_no'` | Question type |
| `options` | `string[]` | Choices for `multiple_choice` |
| `scale` | `number` | Upper bound of a `rating` scale from 1 (default `5`) |
| `required` | `boolean` | Whether an answer is required (default `true`) |
| `nextQuestion` | `string \| Record<string, string>` | Next question ID, or a map from answer to next question ID |
| `points` | `number \| Record<string, number>` | Points for any answer, or per answer |

Built-in tools: `validate_response`, `log_response`, `answer_question`, `get_current_question` and `get_survey_progress`.

### FAQBotAgent

Import the class from the package root:

```ts
import { FAQBotAgent } from '@signalwire/sdk';
```

`FAQBotAgent` answers questions from a list of FAQs. Its `search_faqs` tool scores the FAQs by word overlap with the query and returns up to three matching questions; the answers are in the agent's prompt.

#### FAQBotConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'faq_bot'` | Agent name |
| `route` | `string` | `'/faq'` | HTTP route |
| `faqs` | `FAQEntry[]` | (required) | The FAQs |
| `suggestRelated` | `boolean` | `true` | Add a related-questions prompt section and instruction |
| `persona` | `string` | A helpful FAQ bot description | Text of the "Personality" prompt section |
| `threshold` | `number` | `0.5` | Minimum match score, from 0 to 1 |
| `escalationMessage` | `string` | An apology that offers a transfer | Message used when nothing matches |
| `escalationNumber` | `string` | none | Transfer number; the `escalate` tool is registered only when it's set |
| `agentOptions` | `Partial<AgentOptions>` | none | Passed to `AgentBase` |

#### FAQEntry

| Property | Type | Description |
|----------|------|-------------|
| `question` | `string` | Question text |
| `answer` | `string` | Answer |
| `keywords` | `string[]` | Extra words for matching |
| `categories` | `string[]` | Categories, used by the `category` argument of `search_faqs` |

Built-in tools: `search_faqs`, and `escalate` when `escalationNumber` is set.

### ConciergeAgent

Import the class from the package root:

```ts
import { ConciergeAgent } from '@signalwire/sdk';
```

`ConciergeAgent` answers questions about a venue's services, amenities, hours and directions.

#### ConciergeConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'concierge'` | Agent name |
| `route` | `string` | `'/concierge'` | HTTP route |
| `venueName` | `string` | (required) | Venue or business name |
| `services` | `string[]` | (required) | Services offered |
| `amenities` | `Record<string, Record<string, string>>` | (required) | Amenities, each with detail pairs |
| `hoursOfOperation` | `Record<string, string>` | `{ default: '9 AM - 5 PM' }` | Hours by category |
| `specialInstructions` | `string[]` | `[]` | Extra instruction bullets |
| `welcomeMessage` | `string` | none | When set, installed as a non-bargeable static greeting |
| `agentOptions` | `Partial<AgentOptions>` | none | Passed to `AgentBase` |

Built-in tools: `check_availability` and `get_directions`.

### ReceptionistAgent

Import the class from the package root:

```ts
import { ReceptionistAgent } from '@signalwire/sdk';
```

`ReceptionistAgent` greets callers, collects their details and transfers them to a department.

#### ReceptionistConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | `'receptionist'` | Agent name |
| `route` | `string` | `'/receptionist'` | HTTP route |
| `departments` | `ReceptionistDepartment[]` | (required) | Departments to transfer to |
| `greeting` | `string` | `'Thank you for calling. How can I help you today?'` | Initial greeting |
| `voice` | `string` | `'rime.spore'` | Voice passed to `addLanguage()` |
| `companyName` | `string` | none | Added to the greeting when set |
| `checkInEnabled` | `boolean` | `false` | Register the `check_in_visitor` tool |
| `onVisitorCheckIn` | `(visitor: Record<string, string>) => void \| Promise<void>` | none | Called when a visitor checks in |
| `agentOptions` | `Partial<AgentOptions>` | none | Passed to `AgentBase` |

#### ReceptionistDepartment

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Department identifier |
| `description` | `string` | Description the model reads |
| `number` | `string` | Phone number or SIP address `transfer_call` connects to |

Built-in tools: `collect_caller_info`, `transfer_call`, and `check_in_visitor` when `checkInEnabled` is set.

---

## Capability Helpers

A browser client, such as the SignalWire address widget, declares what it can render in the user variables it sends when it dials: `vars.userVariables.capabilities`. These functions read those declarations from a SWML request body. A declaration is a hint for deciding what to offer, not a permission: the caller controls its own user variables. Missing or malformed data counts as not declared.

Import the helpers from the package root:

```ts
import { userVariables, declaredCapabilities, hasCapability } from '@signalwire/sdk';
```

| Function | Signature | Returns |
|----------|-----------|---------|
| `userVariables` | `(bodyParams: unknown): Record<string, unknown>` | `vars.userVariables` from a request body, or `{}` |
| `declaredCapabilities` | `(bodyParams: unknown): ReadonlySet<string>` | Names declared with a truthy value. Accepts a request body or user variables that are already extracted. An empty array or object counts as false. |
| `hasCapability` | `(bodyParams: unknown, name: string): boolean` | Whether `name` is declared truthy |

The [`addPerCallConfig()` example](#addpercallconfigcb) uses `hasCapability()` in a per-request callback.

---

## Post-Prompt Helpers

The voice and chat engines deliver the post-prompt in different shapes. These helpers read either one into the same structure. None of them throws: data they can't use becomes an empty value.

Import the helpers from the package root:

```ts
import {
  normalizePostPrompt,
  parsePostPromptData,
  dialogueTurns,
  stripJsonFence,
  NormalizedPostPrompt,
  DIALOGUE_ROLES,
} from '@signalwire/sdk';
```

| Name | Signature | Description |
|------|-----------|-------------|
| `normalizePostPrompt` | `(body: unknown): NormalizedPostPrompt` | Normalize a whole post-prompt body. The result is frozen. |
| `parsePostPromptData` | `(data: unknown): Record<string, unknown>` | Read `post_prompt_data` in any shape: an object inside `parsed`, flat keys, or a `raw` string (with or without a code fence). Prose that isn't JSON becomes `{ summary: text }`. |
| `dialogueTurns` | `(callLog: unknown, opts?: { roles?: readonly string[]; dropEcho?: string \| null }): DialogueTurn[]` | The turns with the given roles (default `DIALOGUE_ROLES`) and non-empty content, without entries that carry `tool_calls`. A turn whose content equals `dropEcho` is dropped. |
| `stripJsonFence` | `(text: string): string` | Remove a surrounding code fence, such as one labeled `json` |
| `DIALOGUE_ROLES` | `readonly string[]` | `['user', 'assistant']` |

`DialogueTurn` is `{ role: string; content: string }`. A `NormalizedPostPrompt` has these readonly properties:

| Property | Type | Description |
|----------|------|-------------|
| `medium` | `string` | The body's `conversation_type`, or `''` |
| `conversationId` | `string \| null` | The body's `conversation_id`, or `null` |
| `summary` | `Record<string, unknown>` | `parsePostPromptData(body.post_prompt_data)` |
| `dialogue` | `readonly DialogueTurn[]` | Dialogue from `call_log`, `raw_call_log` or `raw_messages`, the first that isn't empty, without the chat engine's copy of the summary |
| `callId` | `string \| null` | The body's `call_id`, or `null` |
| `raw` | `Record<string, unknown>` | The whole body |

**Example:**

```ts
import { AgentBase, normalizePostPrompt } from '@signalwire/sdk';

class SummaryAgent extends AgentBase {
  override onSummary(summary: unknown, rawData: unknown): void {
    const leg = normalizePostPrompt(rawData);
    console.log(leg.medium, leg.conversationId ?? leg.callId, leg.summary, leg.dialogue.length);
  }
}

const summaries = new SummaryAgent({ name: 'summaries' });
summaries.setPostPrompt('Summarize the call as JSON with keys "topic" and "outcome".');
```

---

## AI Chat Gateway and Handoff

The package root also exports the AI Chat client and two classes that let a browser chat with an agent:

- `AIChatClient`: a client for the SignalWire AI Chat service
- `ChatGateway`: a proxy you mount in your app, so a browser widget can chat with an agent using a publishable key, not your API token
- `HandoffRouter`: routes that move a conversation between a phone call and chat, and let a browser type into a live call

For a guide to all three, see [AI Chat](ai_chat.md).

### ChatGateway

The constructor takes a `ChatGatewayOptions` object:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(options: ChatGatewayOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `configUrl` | `string` | (required) | The agent config the key reaches. It's sent on every call and never taken from the request. |
| `key` | `string` | `SIGNALWIRE_CHAT_GATEWAY_KEY`, else a generated key | The publishable key the browser presents as a bearer token |
| `allowedOrigins` | `readonly string[]` | `[]` | Origins allowed to use the key; localhost is always allowed |
| `client` | `AIChatClient` | Built from the environment | The client that forwards requests |
| `secret` | `string \| Uint8Array` | `SIGNALWIRE_CHAT_GATEWAY_SECRET`, else random per process | Key that signs conversation handles. Set it when you run several replicas or restart often. |
| `handleTtl` | `number` | 86400 | Seconds a handle stays valid |
| `conversationTimeout` | `number \| null` | The service default | Idle seconds before the service ends a conversation |
| `maxNewConversations` | `number` | 60 | New conversations per window |
| `maxTurns` | `number` | 200 | Turns per conversation |
| `windowSeconds` | `number` | 60 | Window for `maxNewConversations`, in seconds |

`router()` returns a Hono app that answers `POST /` with the JSON-RPC methods `start`, `chat`, `log` and `end`. The caps are counted in the process, so behind several replicas each keeps its own count. The origin check stops a key pasted into another page, since the browser sends that page's origin. It doesn't stop a client that sends no origin or a false one. The gateway forwards the browser's `user_meta_data` (up to `MAX_USER_METADATA_BYTES`, 8 KiB), which is the visitor's claim about itself, not a verified value. `close()` closes a client the gateway created.

### HandoffRouter

The constructor takes a `HandoffRouterOptions` object:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(options: HandoffRouterOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gateway` | `ChatGateway` | (required) | Issues and reads handles and checks origins |
| `captureLeg` | `(conversationId: string, medium: string) => boolean \| Promise<boolean>` | none | Ends a leg and writes its record; returns `true` once the record is written |
| `endCall` | `(callId: string) => void \| Promise<void>` | none | Hangs up a call |
| `sendMessage` | `(callId: string, text: string) => boolean \| Promise<boolean>` | none | Delivers typed text into a call. Without it, `/say` returns 404. |
| `nextConversationId` | `(conversationId: string) => string` | Appends or increments `.N` | The ID of the next leg |
| `nonceTtl` | `number` | 3600 | Seconds a nonce can be redeemed |
| `maxMessagesPerCall` | `number` | 200 | Typed messages allowed per call |
| `captureTimeout` | `number` | 8 | Seconds to wait for `captureLeg` |
| `registry` | `Map<string, NonceEntry>` | A new `Map` | The nonce table. Supply shared storage to run more than one replica. |

Your application puts a random `handoff_nonce` in the user variables of a dial. From that call's per-request callback, it calls `register(nonce, { conversationId, callId })` with the call ID from the platform's request. The browser later presents the nonce, never a call ID.

`router()` returns a Hono app with three routes:

- `POST /handoff` takes `{ nonce }` and returns `{ handle }`, once per nonce.
- `POST /escalate` takes `{ handle }` and returns `{ ok: true }`.
- `POST /say` takes `{ nonce, text }` and returns `{ ok: true }`.

A nonce or handle that doesn't verify gets 404, and a refused origin gets 403.

Mount both routers at the same prefix, because the browser derives every path from the gateway's URL:

<!-- snippet: no-run constructs an AIChatClient, which needs SignalWire credentials in the environment -->
```ts
import { AgentBase, ChatGateway, HandoffRouter } from '@signalwire/sdk';

const shop = new AgentBase({ name: 'shop', route: '/agent' });
const gateway = new ChatGateway({
  configUrl: 'https://shop.example.com/agent',
  allowedOrigins: ['https://shop.example.com'],
});
const handoff = new HandoffRouter({ gateway });
shop.mount(gateway.router(), { prefix: '/chat' });
shop.mount(handoff.router(), { prefix: '/chat' });
```

---

## Utility Classes

### AuthHandler

Import the class from the package root:

```ts
import { AuthHandler } from '@signalwire/sdk';
```

`AuthHandler` checks a request's headers against a bearer token, an API key, basic auth or a custom validator. Credentials are compared in constant time.

#### Constructor

See [AuthConfig](#authconfig). The configuration is kept in the readonly `config` property.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(config: AuthConfig)
```

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `validate` | `(headers: Record<string, string>)` | `Promise<boolean>` | `true` when any configured method accepts the request. With no method configured, it allows the request and logs a warning, unless `allowUnauthenticated` is `false`. |
| `verifyBasicAuth` | `(username: string, password: string)` | `boolean` | Check basic-auth credentials |
| `verifyBearerToken` | `(token: string)` | `boolean` | Check a bearer token |
| `verifyApiKey` | `(key: string)` | `boolean` | Check an API key |
| `middleware` | `(optional?: boolean)` | Hono middleware | Reject with `401` unless `optional` is `true` |
| `expressMiddleware` | `(optional?: boolean)` | Express middleware | The same check for Express or Connect |
| `getAuthInfo` | `()` | `{ basic?, bearer?, apiKey? }` | Which methods are configured |
| `hasBearerAuth` | `()` | `boolean` | Whether a bearer token is configured |
| `hasApiKeyAuth` | `()` | `boolean` | Whether an API key is configured |
| `hasBasicAuth` | `()` | `boolean` | Whether basic auth is configured |

The custom validator receives `{ headers, method, url }`; `validate()` passes `''` for `method` and `url`.

### ConfigLoader

Import the class from the package root:

```ts
import { ConfigLoader } from '@signalwire/sdk';
```

`ConfigLoader` loads a JSON file after replacing `${VAR}` and `${VAR|default}` with environment values. An unset variable with no default becomes an empty string.

#### Constructor

A single path is loaded at once and throws when the file doesn't exist. From an array, the first file that exists is loaded, and none existing isn't an error.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(filePaths?: string | string[])
```

#### Static Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `search` | `(filename: string, additionalPaths?: string[], serviceName?: string)` | `ConfigLoader \| null` | Load the first match. The search covers service-specific names, then `additionalPaths`, then the current directory, `./config`, `~/.signalwire`, `./.swml`, `~/.swml` and `/etc/swml`. |
| `findConfigFile` | `(serviceName?: string, additionalPaths?: string[])` | `string \| null` | The path of the first config file found, without loading it |

#### Instance Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `load` | `(filePath: string)` | `this` | Load a file. Throws when it doesn't exist. |
| `loadFromObject` | `(obj: Record<string, unknown>)` | `this` | Use an object as the configuration |
| `get` | `<T>(path: string, defaultValue?: T)` | `T` | Value at a dotted path, such as `'server.port'` |
| `set` | `(path: string, value: unknown)` | `this` | Set a value at a dotted path |
| `has` | `(path: string)` | `boolean` | Whether a dotted path exists |
| `getSection` | `(section: string)` | `Record<string, unknown>` | A top-level section with variables substituted, or `{}` |
| `substituteVars` | `(value: unknown, maxDepth?: number)` | `unknown` | Substitute variables in any value |
| `mergeWithEnv` | `(envPrefix?: string)` | `Record<string, unknown>` | The configuration plus environment variables with the prefix (default `'SWML_'`) that aren't already set |
| `interpolateEnvVars` | `(input: string)` | `string` | Substitute variables in a string |
| `getConfig` | `()` | `Record<string, unknown>` | A shallow copy of the configuration |
| `getConfigFile` | `()` | `string \| null` | Absolute path of the loaded file |
| `hasConfig` | `()` | `boolean` | Whether a file or object was loaded |
| `configPaths` | (getter) | `string[]` | The paths passed to the constructor |

`get()` and `set()` ignore paths that contain `__proto__`, `constructor` or `prototype`.

### Logger

Import the logger and its functions from the package root:

```ts
import { Logger, getLogger, setGlobalLogLevel, suppressAllLogs, setGlobalLogFormat, setGlobalLogColor, setGlobalLogStream, resetLoggingConfiguration } from '@signalwire/sdk';
```

The SDK logs through `Logger` instances that share one global configuration, read from the environment.

#### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `SIGNALWIRE_LOG_LEVEL` | `debug`, `info`, `warn`, `error` | `info` | Minimum level. Case doesn't matter; an unknown value means `info`. |
| `SIGNALWIRE_LOG_MODE` | `off`, `stderr`, `auto` | `auto` | `off` silences all SDK logging. `auto` turns logging off under CGI and writes to standard error on Lambda. |
| `SIGNALWIRE_LOG_FORMAT` | `text`, `json` | `text` | Output format |
| `SIGNALWIRE_LOG_COLOR` | `true`, `false` | On when standard output is a terminal | ANSI colors in text output |

#### Logger Constructor

The constructor has this signature:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(name: string, context?: Record<string, unknown>)
```

#### Logger Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `debug` | `(msg: string, data?: Record<string, unknown>)` | `void` | Log at debug level |
| `info` | `(msg: string, data?: Record<string, unknown>)` | `void` | Log at info level |
| `warn` | `(msg: string, data?: Record<string, unknown>)` | `void` | Log at warn level |
| `error` | `(msg: string, data?: Record<string, unknown>)` | `void` | Log at error level |
| `bind` | `(context: Record<string, unknown>)` | `Logger` | A logger with the context added to every entry |

#### Module Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `getLogger` | `(name: string): Logger` | The logger for a name, created once and cached |
| `setGlobalLogLevel` | `(level: LogLevel): void` | Set the minimum level for every logger |
| `suppressAllLogs` | `(suppress?: boolean): void` | Silence (default) or restore every logger |
| `setGlobalLogFormat` | `(format: 'text' \| 'json'): void` | Set the output format |
| `setGlobalLogColor` | `(enabled: boolean): void` | Turn ANSI colors on or off |
| `setGlobalLogStream` | `(stream: 'stdout' \| 'stderr'): void` | Set the output stream |
| `resetLoggingConfiguration` | `(): void` | Read the configuration from the environment again |
| `getExecutionMode` | `(): string` | `'cgi'`, `'lambda'`, `'google_cloud_function'`, `'azure_function'` or `'server'`, from the environment |
| `stripControlChars` | `<T>(data: T): T` | A copy of a record with control characters removed from its strings |

### SslConfig

Import the class from the package root:

```ts
import { SslConfig } from '@signalwire/sdk';
```

`SslConfig` holds TLS settings from explicit options or the environment.

#### Environment Variables

| Variable | Description |
|----------|-------------|
| `SWML_SSL_ENABLED` | `true` to enable TLS |
| `SWML_SSL_CERT_PATH` | Path to the PEM certificate |
| `SWML_SSL_KEY_PATH` | Path to the PEM private key |
| `SWML_SSL_DOMAIN` | Domain name |

#### Constructor

See [SslOptions](#ssloptions).

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(opts?: SslOptions)
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether TLS is enabled |
| `certPath` | `string \| null` | PEM certificate path |
| `keyPath` | `string \| null` | PEM private key path |
| `domain` | `string \| null` | Domain name |
| `hsts` | `boolean` | Whether to send HSTS headers |
| `hstsMaxAge` | `number` | HSTS `max-age` in seconds |

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `isConfigured` | `()` | `boolean` | Enabled, with both files present |
| `getCert` | `()` | `string \| null` | The certificate file's contents |
| `getKey` | `()` | `string \| null` | The key file's contents |
| `getHstsHeader` | `()` | `string \| null` | `max-age={hstsMaxAge}; includeSubDomains`, or `null` when HSTS or TLS is off |
| `getServerOptions` | `()` | `{ cert, key } \| null` | Options for `https.createServer()` |
| `hstsMiddleware` | `()` | Hono middleware | Adds `Strict-Transport-Security` to responses |

### SchemaUtils

Import the class from the package root:

```ts
import { SchemaUtils, SchemaValidationError } from '@signalwire/sdk';
```

`SchemaUtils` reads the SWML schema and validates verbs and documents. `SwmlBuilder` uses it to check each verb.

#### Constructor

The constructor has this signature:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(opts?: { skipValidation?: boolean; maxCacheSize?: number; schemaPath?: string })
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `skipValidation` | `boolean` | `true` when `SWML_SKIP_SCHEMA_VALIDATION=true` | Make `validate()` and `validateVerb()` accept everything |
| `maxCacheSize` | `number` | `100` | Cached `validate()` results |
| `schemaPath` | `string` | The bundled schema | Schema file to read |

#### Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `validateVerb` | `(verbName: string, config: unknown)` | `ValidationResult` | Check one verb's config against the schema; an unknown verb is invalid |
| `validate` | `(swml: string \| Record<string, unknown>)` | `ValidationResult` | Structural checks of a document: `version`, `sections.main`, arrays, and the AI verb's prompt and SWAIG functions |
| `getVerbNames` | `()` | `string[]` | Verbs in the schema |
| `hasVerb` | `(verbName: string)` | `boolean` | Whether the schema defines a verb |
| `getVerbProperties` | `(verbName: string)` | `Record<string, unknown>` | A verb's schema definition |
| `getVerbParameters` | `(verbName: string)` | `Record<string, unknown>` | A verb's parameter properties |
| `getVerbRequiredProperties` | `(verbName: string)` | `string[]` | A verb's required properties |
| `getVerbDescription` | `(verbName: string)` | `string` | A verb's description |
| `loadSchema` | `()` | `Record<string, unknown> \| null` | Load the schema |
| `clearCache` | `()` | `void` | Clear the `validate()` cache |
| `getCacheSize` | `()` | `number` | Cached entries |
| `schemaPath` | (getter) | `string \| null` | The schema path, or `null` for the bundled schema |
| `fullValidationAvailable` | (getter) | `boolean` | Whether a schema is loaded |

`SchemaValidationError` extends `Error` with readonly `verbName` and `errors` properties. `SwmlBuilder.addVerb()` throws it.

### ServerlessAdapter

Import the class from the package root:

```ts
import { ServerlessAdapter } from '@signalwire/sdk';
```

`ServerlessAdapter` runs a Hono app on a serverless platform: it turns the platform's event into a `Request`, and the app's `Response` into the platform's response.

#### Constructor

`ServerlessPlatform` is `'lambda' | 'gcf' | 'azure' | 'cgi' | 'auto'`. With `'auto'` (the default), the platform is detected from the environment.

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
constructor(platform?: ServerlessPlatform)
```

#### Instance Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `detectPlatform` | `()` | `ServerlessPlatform` | Detect from environment variables; `'lambda'` when nothing matches |
| `getPlatform` | `()` | `ServerlessPlatform` | The platform in use |
| `handleRequest` | `(app, event: ServerlessEvent)` | `Promise<ServerlessResponse>` | Route an event through the app. The app receives the URL the platform was called on, for the webhook signature check. |
| `generateUrl` | `(opts?: { region?, projectId?, functionName?, stage?, apiId? })` | `string` | A platform-style URL built from the options and environment |

#### Static Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `createLambdaHandler` | `(app)` | `(event) => Promise<ServerlessResponse>` | AWS Lambda handler |
| `createGcfHandler` | `(app)` | `(req, res) => Promise<void>` | Google Cloud Functions handler |
| `createAzureHandler` | `(app)` | `(context, req) => Promise<void>` | Azure Functions handler; sets `context.res` |
| `createCgiHandler` | `(app)` | `() => Promise<void>` | Runs one CGI request from the environment and standard input |
| `buildCgiEvent` | `(env?, body?)` | `ServerlessEvent` | An event built from CGI environment variables |

**Example (AWS Lambda):**

```ts
import { AgentBase, ServerlessAdapter } from '@signalwire/sdk';

const lambdaAgent = new AgentBase({ name: 'MyAgent' });
export const handler = ServerlessAdapter.createLambdaHandler(lambdaAgent.getApp());
```

---

## Types and Interfaces

### AgentOptions

The options accepted by the `AgentBase` constructor:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface AgentOptions
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | (required) | Agent name. Also the basic-auth username when the SDK generates the credentials and `SWML_BASIC_AUTH_USER` isn't set. |
| `route` | `string` | `'/'` | HTTP route; trailing slashes are removed |
| `host` | `string` | `'0.0.0.0'` | Hostname to bind |
| `port` | `number` | `PORT` env, else `3000` | Port. Must be 1 to 65535. |
| `basicAuth` | `[string, string]` | See the note after this table | `[username, password]` for every route except `/health` and `/ready` |
| `usePom` | `boolean` | `true` | Keep prompt sections as a POM, rendered as `prompt.pom` |
| `tokenExpirySecs` | `number` | `3600` | Lifetime of per-call tool tokens, in seconds |
| `swaigSecret` | `string` | `SIGNALWIRE_SWAIG_SECRET`, else random per process | Secret that signs per-call tool tokens. Set the same value on every replica and keep it across restarts, or tokens minted by one process fail on another. |
| `signingKey` | `string` | `SIGNALWIRE_SIGNING_KEY` | SignalWire signing key. When set, POSTs to the root, `/swaig`, `/post_prompt` and routing-callback paths need a valid webhook signature (`403` otherwise). When neither is set, signatures aren't checked and a warning is logged. |
| `webhookTrustProxy` | `boolean` | `false` | Use `X-Forwarded-Proto` and `X-Forwarded-Host` to rebuild the signed URL. These headers can be forged, so enable it only behind a proxy you control. `SWML_PROXY_URL_BASE` takes precedence. |
| `autoAnswer` | `boolean` | `true` | Add the `answer` verb |
| `recordCall` | `boolean` | `false` | Add a `record_call` verb after `answer` |
| `recordFormat` | `string` | `'mp4'` | `record_call` format |
| `recordStereo` | `boolean` | `true` | `record_call` stereo setting |
| `defaultWebhookUrl` | `string` | none | Stored by the constructor; `renderSwml()` doesn't read it. Use `setWebHookUrl()`. |
| `nativeFunctions` | `string[]` | `[]` | Native function names |
| `agentId` | `string` | 16 random hex characters | Agent instance ID |
| `suppressLogs` | `boolean` | `false` | Call `suppressAllLogs(true)`, which silences every SDK logger in the process, not only this agent's. Warnings logged earlier in the constructor still appear. |
| `schemaPath` | `string` | The bundled schema | Schema file for the agent's `schemaUtils`. `renderSwml()` still checks verbs against the bundled schema. |
| `schemaValidation` | `boolean` | `true` | When `false`, the agent's `schemaUtils` accepts every verb and document. It doesn't stop `renderSwml()` from checking verbs; only `SWML_SKIP_SCHEMA_VALIDATION=true` does. |
| `enablePostPromptOverride` | `boolean` | `false` | Serve `POST {route}/post_prompt_override`, which replaces the post-prompt text |
| `checkForInputOverride` | `boolean` | `false` | Serve `{route}/check_for_input`, which echoes the request body |
| `configFile` | `string` | none | JSON config file. Its `service` section supplies `route`, `host` and `port` when the options omit them, and its `security` section supplies basic auth and TLS settings. |

When `basicAuth` isn't given, the credentials come from the config file's `security.auth.basic` (or `security.basicAuth`), then from `SWML_BASIC_AUTH_PASSWORD` with `SWML_BASIC_AUTH_USER` (default user `signalwire`). When no password is configured, the SDK generates a random password that exists only in this process, and logs a warning. The username is then `SWML_BASIC_AUTH_USER` or the agent's name.

### LanguageConfig

The configuration passed to `addLanguage()`:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface LanguageConfig
```

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Language name, such as `"English"` |
| `code` | `string` | Language code, such as `"en-US"` |
| `voice` | `string` | Voice identifier (optional) |
| `engine` | `string` | TTS engine (optional) |
| `model` | `string` | TTS model (optional) |
| `fillers` | `Record<string, string[]>` | Filler phrases (optional) |
| `speechModel` | `string` | Speech recognition model, emitted as `speech_model` (optional) |
| `functionFillers` | `Record<string, Record<string, string[]>>` | Per-function fillers, emitted as `function_fillers` (optional) |
| `params` | `Record<string, unknown>` | Engine-specific settings, emitted only when not empty (optional) |

### PronunciationRule

A rule passed to `addPronunciation()`:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface PronunciationRule
```

| Property | Type | Description |
|----------|------|-------------|
| `replace` | `string` | Text to match |
| `with` | `string` | Replacement pronunciation |
| `ignoreCase` | `boolean` | Case-insensitive match, emitted as `ignore_case` when `true` (optional) |

### FunctionInclude

An entry in `SWAIG.includes`:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface FunctionInclude
```

| Property | Type | Description |
|----------|------|-------------|
| `url` | `string` | URL of the remote SWAIG endpoint |
| `functions` | `string[]` | Function names at the endpoint |
| `meta_data` | `Record<string, unknown>` | Metadata (optional) |

### DynamicConfigCallback

The type of a per-request configuration callback:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
type DynamicConfigCallback<TAgent = AgentBase> = (
  queryParams: Record<string, string>,
  bodyParams: SwmlRequestData,
  headers: Record<string, string>,
  agent: TAgent,
) => void | Promise<void>;
```

`agent` is the per-request copy; configure it, not the original agent. `headers` has credential-bearing headers removed. See [Per-Request Configuration Methods](#per-request-configuration-methods).

### SummaryCallback

The type of a summary callback:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
type SummaryCallback = (
  summary: PostPromptData | null,
  rawData: PostPrompt,
) => void | Promise<void>;
```

### SwaigHandler

The type of a tool handler:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
type SwaigHandler = (
  args: Record<string, unknown>,
  rawData: SwaigRequest,
  agent?: AgentBase,
) => FunctionResult | Record<string, unknown> | string
   | Promise<FunctionResult | Record<string, unknown> | string>;
```

`args` holds the arguments the model supplied. `rawData` is the whole SWAIG request, with `call_id`, `global_data` and the rest. `agent` is the agent the request was configured on: the per-request copy when per-request configuration is in use, and `undefined` when you call `SwaigFunction.execute()` yourself.

The return value is serialized as follows:

- A `FunctionResult` is serialized with `toDict()`.
- An object with a `response` key is sent as is.
- An object without a `response` key is replaced by `{ response: 'Function completed successfully' }`.
- Any other value is converted to a string and wrapped in a `FunctionResult`, and the SDK logs a warning.

A synchronous or CPU-bound handler blocks Node's event loop, and with it every other request, until it returns.

### SwaigFunctionOptions

The options accepted by the `SwaigFunction` constructor and by `defineTool()`:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface SwaigFunctionOptions
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | `string` | (required) | Tool name |
| `handler` | `SwaigHandler` | (required) | Handler function |
| `description` | `string` | (required) | Description the model reads |
| `parameters` | `Record<string, unknown>` | `{}` | Property definitions or a full JSON Schema object |
| `secure` | `boolean` | `true` | Require a per-call token; `false` lets the tool run without one |
| `fillers` | `Record<string, string[]>` | none | Filler phrases by language code |
| `waitFile` | `string` | none | Wait audio URL |
| `waitFileLoops` | `number` | none | Wait audio loop count |
| `webhookUrl` | `string` | none | External URL that runs the tool |
| `required` | `string[]` | `[]` | Required parameter names |
| `extraFields` | `Record<string, unknown>` | `{}` | Extra keys merged into the definition |
| `isTypedHandler` | `boolean` | `false` | Whether the handler takes named parameters |
| `onError` | `SwaigErrorHandler` | none | Per-tool error hook |
| `errorMessage` | `string` | A generic apology | Response when the handler throws and no hook returns one |

### AuthConfig

The configuration accepted by `AuthHandler`:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface AuthConfig
```

| Property | Type | Description |
|----------|------|-------------|
| `bearerToken` | `string` | Token matched against `Authorization: Bearer` |
| `apiKey` | `string` | Key matched against the API key header |
| `apiKeyHeader` | `string` | Header for the API key (default `X-Api-Key`) |
| `basicAuth` | `[string, string]` | Basic-auth `[username, password]` |
| `customValidator` | `(request: { headers, method, url }) => boolean \| Promise<boolean>` | Custom check |
| `allowUnauthenticated` | `boolean` | When `false`, deny requests when no method is configured |

### SslOptions

The options accepted by `SslConfig`:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface SslOptions
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean` | `SWML_SSL_ENABLED` env | Whether TLS is enabled |
| `certPath` | `string` | `SWML_SSL_CERT_PATH` env | Path to the PEM certificate |
| `keyPath` | `string` | `SWML_SSL_KEY_PATH` env | Path to the PEM private key |
| `domain` | `string` | `SWML_SSL_DOMAIN` env | Domain name |
| `hsts` | `boolean` | `true` | Send HSTS headers |
| `hstsMaxAge` | `number` | `31536000` | HSTS `max-age` in seconds |

### ValidationResult

The result of a validation:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface ValidationResult
```

| Property | Type | Description |
|----------|------|-------------|
| `valid` | `boolean` | Whether validation passed |
| `errors` | `string[]` | Error messages, empty when valid |

### ServerlessEvent

The event a serverless platform passes in:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface ServerlessEvent
```

Every property is optional.

| Property | Type | Description |
|----------|------|-------------|
| `httpMethod` | `string` | HTTP method (AWS Lambda style) |
| `method` | `string` | HTTP method (Google Cloud Functions and Azure style) |
| `headers` | `Record<string, string>` | Request headers |
| `body` | `string \| Record<string, unknown>` | Request body |
| `path` | `string` | Request path |
| `rawPath` | `string` | Request path (API Gateway HTTP API) |
| `queryStringParameters` | `Record<string, string>` | Query parameters |
| `multiValueQueryStringParameters` | `Record<string, string[]>` | Repeated query parameters |
| `rawQueryString` | `string` | Query string as received |
| `pathParameters` | `Record<string, string>` | Path parameters |
| `requestContext` | `Record<string, unknown>` | Platform-specific context |

### ServerlessResponse

The response returned to a serverless platform:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface ServerlessResponse
```

| Property | Type | Description |
|----------|------|-------------|
| `statusCode` | `number` | HTTP status code |
| `headers` | `Record<string, string>` | Response headers |
| `body` | `string` | Response body |

### PomSectionData

The serialized form of a POM section:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface PomSectionData
```

Every property is optional, and a key is present only when it has a value.

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Section heading |
| `body` | `string` | Body text |
| `bullets` | `string[]` | Bullet points |
| `numbered` | `boolean` | Whether the section is numbered |
| `numberedBullets` | `boolean` | Whether bullets are numbered |
| `subsections` | `PomSectionData[]` | Nested sections |

### Skill Types

#### SkillConfig

The configuration passed to a skill:

<!-- snippet: no-compile API signature / type reference, not runnable code -->
```ts
interface SkillConfig { [key: string]: unknown }
```

#### SkillToolDefinition

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Tool name |
| `description` | `string` | Description the model reads |
| `parameters` | `Record<string, unknown>` | Parameter definitions (optional) |
| `handler` | `SwaigHandler` | Handler function |
| `secure` | `boolean` | Require a per-call token (optional; `true` when omitted) |
| `fillers` | `Record<string, string[]>` | Filler phrases by language code (optional) |
| `required` | `string[]` | Required parameter names (optional) |
| `wait_for_fillers` | `boolean` | Emitted as `wait_for_fillers` (optional) |
| `skip_fillers` | `boolean` | Emitted as `skip_fillers` (optional) |
| `isHangupHook` | `boolean` | Emitted as `is_hangup_hook: true` (optional) |

`defineSkillTool(toolDef)` returns a `SkillToolDefinition` with `args` typed from its `parameters`, as `defineTool()` does.

#### SkillPromptSection

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Section heading |
| `body` | `string` | Body text (optional) |
| `bullets` | `string[]` | Bullet points (optional) |
| `numbered` | `boolean` | Whether the section is numbered (optional) |

#### ParameterSchemaEntry

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'string' \| 'number' \| 'integer' \| 'boolean' \| 'object' \| 'array'` | Value type |
| `description` | `string` | Description |
| `default` | `unknown` | Default value (optional) |
| `required` | `boolean` | Whether it's required (optional) |
| `hidden` | `boolean` | Whether to hide it from user-facing output, such as an API key (optional) |
| `env_var` | `string` | Environment variable that can supply it (optional) |
| `enum` | `unknown[]` | Allowed values (optional) |
| `min` | `number` | Minimum (optional) |
| `max` | `number` | Maximum (optional) |
| `items` | `Record<string, unknown>` | Schema of array items (optional) |

#### SkillSchemaInfo

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Skill name |
| `description` | `string` | Description |
| `version` | `string` | Version |
| `supportsMultipleInstances` | `boolean` | Whether several instances can load |
| `requiredEnvVars` | `string[]` | Required environment variables |
| `requiredPackages` | `string[]` | Required npm packages |
| `parameters` | `Record<string, ParameterSchemaEntry>` | Configuration schema |
| `source` | `string` | Where the skill came from (optional) |

### Payment Types

#### PaymentPrompt

| Property | Type | Description |
|----------|------|-------------|
| `for` | `string` | Situation the prompt applies to |
| `actions` | `PaymentAction[]` | Actions for the prompt |
| `card_type` | `string` | Card type filter (optional) |
| `error_type` | `string` | Error type (optional) |

#### PaymentAction

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | Action type, such as `"say"` or `"play"` |
| `phrase` | `string` | Phrase or URL |

#### PaymentParameter

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Parameter name |
| `value` | `string` | Parameter value |
