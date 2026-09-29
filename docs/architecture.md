# SignalWire AI Agents TypeScript SDK Architecture

This page explains how the TypeScript SDK is put together. It covers the classes an agent is built from, how it renders SWML, and what happens to each request SignalWire sends it.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const agent: import('@signalwire/sdk').AgentBase;
  const FunctionResult: typeof import('@signalwire/sdk').FunctionResult;
}
```

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
  - [AgentBase](#agentbase)
  - [PromptManager and PomBuilder](#promptmanager-and-pombuilder)
  - [SwmlBuilder](#swmlbuilder)
  - [SwaigFunction](#swaigfunction)
  - [FunctionResult](#functionresult)
  - [SessionManager](#sessionmanager)
  - [ContextBuilder](#contextbuilder)
  - [DataMap](#datamap)
- [Composition Architecture](#composition-architecture)
- [SWML Rendering Pipeline](#swml-rendering-pipeline)
- [Request Flow](#request-flow)
  - [SWML Request (GET/POST /)](#swml-request-getpost-)
  - [SWAIG Function Dispatch (POST /swaig)](#swaig-function-dispatch-post-swaig)
  - [Post-Prompt Handler (POST /post_prompt)](#post-prompt-handler-post-post_prompt)
- [Tool System](#tool-system)
  - [SwaigFunction Wrapper](#swaigfunction-wrapper)
  - [Handler Signature](#handler-signature)
  - [Result Serialization](#result-serialization)
  - [DataMap Tools](#datamap-tools)
- [Session Management](#session-management)
  - [Token Format](#token-format)
  - [Token Generation](#token-generation)
  - [Token Validation](#token-validation)
- [Proxy Detection](#proxy-detection)
- [Security Layers](#security-layers)
  - [Basic Authentication](#basic-authentication)
  - [CORS](#cors)
  - [Security Headers](#security-headers)
  - [Rate Limiting](#rate-limiting)
  - [Allowed Hosts](#allowed-hosts)
  - [Request Size Limits](#request-size-limits)
  - [Webhook Signatures and TLS](#webhook-signatures-and-tls)
- [Extension Points](#extension-points)

---

## Overview

Each agent is an HTTP service. It serves a SWML document, the JSON call-flow instructions SignalWire runs. It also answers the SWAIG requests SignalWire sends when the model on the call uses a tool. The SDK builds on the [Hono](https://hono.dev/) web framework and uses Node.js `crypto` for its per-call tokens.

The diagram shows the parts of an agent and the requests of one call:

```text
                     +--------------------------------------------------+
                     |          AgentBase (extends SWMLService)         |
                     |                                                  |
                     |  +----------------+    +---------------------+   |
                     |  | PromptManager  |    | SessionManager      |   |
                     |  |  +----------+  |    | (per-call HMAC      |   |
                     |  |  |PomBuilder|  |    |  tokens)            |   |
                     |  |  +----------+  |    +---------------------+   |
                     |  +----------------+                              |
                     |                                                  |
                     |  +----------------+    +---------------------+   |
                     |  | SwmlBuilder    |    | Tool registry       |   |
                     |  | (the SWML      |    | Map<name,           |   |
                     |  |  document)     |    |  SwaigFunction or   |   |
                     |  +----------------+    |  DataMap object>    |   |
                     |                        +---------------------+   |
                     |  +----------------+    +---------------------+   |
                     |  | ContextBuilder |    | SkillManager        |   |
                     |  | (optional)     |    |                     |   |
                     |  +----------------+    +---------------------+   |
                     |                                                  |
                     |  +--------------------------------------------+  |
                     |  | Hono app                                   |  |
                     |  |   GET/POST {route}        -> SWML          |  |
                     |  |   POST {route}/swaig      -> tool handler  |  |
                     |  |   POST {route}/post_prompt -> onSummary()  |  |
                     |  |   GET {route}/health, /ready (no auth)     |  |
                     |  +--------------------------------------------+  |
                     +--------------------------------------------------+

    Inbound call
         |
         v
  SignalWire  --POST-->  {route}              (returns the SWML)
         |
         v
  The platform runs the SWML; its ai verb starts the model
         |
         v
  Model uses a tool  --POST-->  {route}/swaig        (runs the handler)
         |
         v
  Call ends  --POST-->  {route}/post_prompt   (delivers the summary)
```

SignalWire requests the SWML with a `POST` whose body describes the call. The agent route also answers `GET`, which is useful for testing with a browser or `curl`. `GET {route}/swaig` and `GET {route}/post_prompt` return the SWML too; only a `POST` runs a tool or delivers a summary.

### AgentServer (Multi-Agent)

`AgentServer` hosts several agents on one port. `register(agent)` mounts the agent's route-relative router (`agent.asRouter()`) at the agent's route, so each agent's paths are its route plus the agent's own paths:

```text
  AgentServer (Hono)
    |-- /sales, /sales/swaig, /sales/post_prompt      -> sales agent
    |-- /support, /support/swaig, /support/post_prompt -> support agent
    |-- /health    -> server health check
    |-- /ready     -> server readiness check
    |-- /          -> agent listing (if no agent is registered at /)
```

`register()` copies the agent's routes when it's called. `setupSipRouting()` and `registerGlobalRoutingCallback()` can be called before or after it: called afterwards, they mount each registered agent's routes again, so the callback is served at the agent's route, such as `/sales/sip`.

---

## Core Components

### AgentBase

**File**: `src/AgentBase.ts`

`AgentBase` extends `SWMLService` and holds the other components as fields. It's responsible for:

- **HTTP**: building the Hono app, its middleware and routes, and starting the server.
- **SWML rendering**: assembling the document from the call-flow verbs, the prompt, the tools and the AI settings.
- **Tool dispatch**: running the handler for a SWAIG request, after checking its per-call token.
- **Proxy detection**: finding the external URL for the webhook URLs in the SWML.
- **Per-request configuration**: making a per-request copy of the agent for a dynamic config callback.
- **Lifecycle hooks**: `onSummary`, `onFunctionCall`, `onSwmlRequest`, `onDebugEvent`, `onCallEnd` and `onError`.

`SWMLService` supplies the `SwmlBuilder`, the tool registry, basic-auth resolution, routing callbacks and `handleRequest()`, the framework-free request handler that the agent's SWML routes call.

### PromptManager and PomBuilder

**Files**: `src/PromptManager.ts`, `src/PomBuilder.ts`

`PromptManager` holds the agent's prompt and post-prompt. The prompt has two forms:

1. **Raw text**: a string set with `setPromptText()`. When set, it takes precedence over sections.
2. **Sections (POM)**: a `PomBuilder` of sections added with `promptAddSection()`, used when the `usePom` option is `true` (the default).

Each section has a `title`, a `body`, `bullets` (optionally `numbered`) and `subsections`. The rendered SWML carries sections as a structured `prompt.pom` array. Raw text goes in `prompt.text`.

`PromptManager.getPrompt()` returns:
1. The raw text, if set.
2. The sections rendered as Markdown, if sections exist.
3. An empty string otherwise.

### SwmlBuilder

**File**: `src/SwmlBuilder.ts`

`SwmlBuilder` holds a SWML document:

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      { "ai": { "prompt": { "text": "You are a support agent." } } },
      { "hangup": {} }
    ]
  }
}
```

It has these methods:

| Method | Description |
|--------|-------------|
| `reset()` | Replaces the document with an empty `{ version, sections: { main: [] } }`. |
| `addVerb(verbName, config)` | Validates the verb against the bundled schema, then appends `{ [verbName]: config }` to `main`. |
| `addVerbToSection(section, verb, config)` | Validates, then appends to a named section, creating it if needed. |
| `addSection(section)` | Adds an empty section. |
| `build()` | Returns the document object. |
| `render()` | Returns `JSON.stringify(document)`. |

The constructor also adds a method for each verb in the bundled schema, such as `answer()`, `play()` and `connect()`, which call `addVerb()` and return the builder. `SWML_SKIP_SCHEMA_VALIDATION=true` turns validation off.

`AgentBase.renderSwml()` calls `reset()`, adds every phase's verbs, and returns `render()`, so the builder holds only the latest render.

### SwaigFunction

**File**: `src/SwaigFunction.ts`

`SwaigFunction` wraps a tool handler with the metadata SWAIG needs. Its main fields are:

<!-- snippet: no-compile field-shape reference for SwaigFunction; abbreviated types, not runnable -->
```typescript
class SwaigFunction {
  name: string;              // Tool name, read by the model
  handler: SwaigHandler;     // The callback function
  description: string;       // Tells the model when to use the tool
  parameters: Record;        // JSON Schema for the arguments
  secure: boolean;           // Requires a per-call token (default true)
  fillers?: Record;          // Per-language filler phrases
  waitFile?: string;         // Audio to play while the tool runs
  waitFileLoops?: number;    // Loop count for the wait file
  webhookUrl?: string;       // External webhook, rendered in place of the agent's /swaig
  required: string[];        // Required parameter names
  extraFields: Record;       // Additional SWAIG fields, merged into the definition
  onError?: SwaigErrorHandler; // Per-tool error hook
  errorMessage?: string;     // Response when the handler throws
}
```

`execute(args, rawData)` runs the handler and returns the result as a SWAIG response object. [Result Serialization](#result-serialization) lists how each return type is converted.

### FunctionResult

**File**: `src/FunctionResult.ts`

`FunctionResult` is a builder for a tool's response. It carries:

- `response`: text returned to the model. It's context for the model, not speech: the model decides what to say.
- `action`: an ordered list of actions for the platform to run.
- `postProcess`: when `true`, the model gets one more turn to respond before the actions run.

A `FunctionResult` can also carry a structured response, `{ tool_result, tool_prompt }`, set with the constructor option or `setToolResponse()`. It separates the facts from the instructions for the model. `toDict()` serializes it:

<!-- snippet: no-compile method-body excerpt shown outside its class, not a standalone module -->
```typescript
toDict(): SwaigResultDict {
  const result: SwaigResultDict = {};
  if (this._toolResponse && Object.keys(this._toolResponse).length > 0) {
    result.response = { ...this._toolResponse };
  } else if (this.response) {
    result.response = this.response;
  }
  if (this.action.length > 0) result.action = this.action;
  if (this.postProcess && this.action.length > 0) result.post_process = true;
  if (Object.keys(result).length === 0) result.response = 'Action completed.';
  return result;
}
```

The fallback `"Action completed."` keeps the response from being empty.

The action methods fall into these groups:

| Category | Methods |
|----------|---------|
| Call control | `connect()`, `hangup()`, `hold()`, `stop()`, `waitForUser()` |
| Audio | `say()`, `playBackgroundFile()`, `stopBackgroundFile()` |
| Speech | `addDynamicHints()`, `clearDynamicHints()`, `setEndOfSpeechTimeout()` |
| Data | `updateGlobalData()`, `removeGlobalData()`, `setMetadata()`, `removeMetadata()` |
| SWML | `executeSwml()`, `swmlChangeStep()`, `swmlChangeContext()`, `swmlUserEvent()` |
| Context | `switchContext()` |
| Functions | `toggleFunctions()`, `enableFunctionsOnTimeout()`, `updateSettings()` |
| Comms | `sendSms()`, `recordCall()`, `stopRecordCall()`, `tap()`, `stopTap()`, `sipRefer()` |
| Rooms | `joinRoom()`, `joinConference()` |
| RPC | `executeRpc()`, `rpcDial()`, `rpcAiMessage()`, `rpcAiUnhold()` |
| Payments | `pay()` |

### SessionManager

**File**: `src/SessionManager.ts`

`SessionManager` creates and checks the HMAC-SHA256 tokens that protect secure tools and the post-prompt URL. It stores nothing for a token: everything it needs is in the token. See [Session Management](#session-management).

### ContextBuilder

**File**: `src/ContextBuilder.ts`

`ContextBuilder` defines multi-step conversations. It holds named contexts, each an ordered list of steps. A step has prompt content, completion criteria, the functions it allows, and the steps and contexts it can move to:

```text
ContextBuilder
  |-- Context "greeting"
  |     |-- Step "welcome" (text, criteria, functions)
  |     |-- Step "identify" (gather_info questions)
  |
  |-- Context "support"
        |-- Step "diagnose" (POM sections, valid_steps)
        |-- Step "resolve" (end: true)
```

`defineContexts()` returns the agent's builder, creating it on first use. `renderSwml()` puts the contexts inside the `ai` verb's prompt object, as `prompt.contexts`.

### DataMap

**File**: `src/DataMap.ts`

`DataMap` builds a tool that the SignalWire platform runs itself, without a request to the agent. A DataMap tool can have:

- **Webhooks**: HTTP requests to external APIs, with templates for the request and the output.
- **Expressions**: patterns matched against template values, each with its output.
- **Outputs**: `FunctionResult` objects, serialized as the tool's response.

DataMap tools are stored in the tool registry as plain objects, not `SwaigFunction` instances. For the template syntax, see the DataMap guide.

---

## Composition Architecture

The Python SDK builds `AgentBase` from several mixin classes. The TypeScript SDK has one level of inheritance, `AgentBase extends SWMLService`, and holds the rest as fields:

```text
Python SDK                              TypeScript SDK
--------------------------              ---------------------------------------
class AgentBase(                        class SWMLService {
  AuthMixin, WebMixin,                    swmlBuilder: SwmlBuilder
  SWMLService, PromptMixin,               toolRegistry: Map<...>
  SkillMixin, AIConfigMixin,              _app: Hono
  ServerlessMixin, StateMixin,            _routingCallbacks: Map<...>
  MCPServerMixin)                       }
                                        class AgentBase extends SWMLService {
                                          _promptManager: PromptManager
                                          sessionManager: SessionManager
                                          _skillManager: SkillManager
                                          contextsBuilder: ContextBuilder | null
                                          perCallConfigs: DynamicConfigCallback[]
                                        }
```

The public methods on `AgentBase` delegate to these fields. For example, `setPromptText()` sets the prompt on the `PromptManager`. You configure an agent through its methods, and don't need to reach the fields.

The tool registry holds two kinds of entries: `SwaigFunction` instances for tools with a handler, and plain objects for DataMap tools.

A dynamic config callback, or one added with `addPerCallConfig()`, receives a per-request copy of the agent. The copy has its own prompt, tools, hints, languages, pronunciations, params, global data, call-flow verbs, contexts and routing callbacks. The callback's changes stay on that request. Skills the agent loaded are shared with the copy without running their setup again. The SWML is rendered from the copy, `/swaig` and `/post_prompt` requests run on it, and the original agent isn't modified.

---

## SWML Rendering Pipeline

`renderSwml(callId?, modifications?)` builds the SWML document for one call in five phases:

```text
renderSwml(callId?, modifications?)
  |
  |-- defineTools() (once per agent), swmlBuilder.reset()
  |-- callId: the argument, or a new random ID
  |
  |-- Build webhook URLs
  |      - base: external URL + route, with the basic-auth credentials in it
  |      - {base}/swaig with the SWAIG query params (defaults.web_hook_url)
  |      - a secure tool's URL adds __token, a token for that tool and call
  |      - {base}/post_prompt with a post_prompt token, if a post-prompt is set
  |
  |-- Build the SWAIG object
  |      - native_functions, includes, internal_fillers
  |      - functions[] from the tool registry:
  |          SwaigFunction: function, description, parameters,
  |            fillers, wait_file, wait_file_loops, web_hook_url, extra fields
  |          DataMap object: copied as it is
  |      - defaults.web_hook_url (when there are functions)
  |      - mcp_servers
  |
  |-- PHASE 1: pre-answer verbs (addPreAnswerVerb)
  |-- PHASE 2: answer, if autoAnswer
  |-- PHASE 3: record_call, if recordCall; post-answer verbs (addPostAnswerVerb)
  |-- PHASE 4: the ai verb
  |      prompt: { pom: [...] } or { text: ... }, plus prompt LLM params,
  |              and contexts, if contexts are defined
  |      post_prompt, post_prompt_url
  |      SWAIG, hints, languages, multilingual, pronounce, params, global_data
  |      debug_webhook_url, debug_webhook_level, if debug events are on
  |      modifications from onSwmlRequest: global_data merged, other keys replaced
  |-- PHASE 5: post-AI verbs (addPostAiVerb)
  |
  |-- Return swmlBuilder.render() (a JSON string)
```

Verbs you add are validated against the bundled schema. The `answer`, `record_call` and `ai` verbs the agent builds itself aren't.

A document with every phase looks like this:

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "play": { "url": "https://example.com/ring.wav" } },
      { "answer": {} },
      { "record_call": { "format": "mp4", "stereo": true } },
      {
        "ai": {
          "prompt": { "text": "..." },
          "post_prompt": { "text": "..." },
          "post_prompt_url": "https://user:pass@agents.example.com/support/post_prompt?__token=...",
          "SWAIG": {
            "functions": [ ... ],
            "defaults": { "web_hook_url": "https://user:pass@agents.example.com/support/swaig" }
          },
          "hints": [ "SignalWire", "HIPAA" ],
          "params": { "temperature": 0.7 },
          "global_data": { "company": "Acme" }
        }
      },
      { "hangup": {} }
    ]
  }
}
```

---

## Request Flow

### SWML Request (GET/POST /)

A request for the SWML goes through these steps:

```text
Request from SignalWire (POST) or a browser (GET)
  |
  v
Hono middleware:
  1. Security headers (added to the response)
  2. Request size limit (SWML_MAX_REQUEST_SIZE)
  3. Allowed hosts (SWML_ALLOWED_HOSTS, if set)
  4. Rate limit (SWML_RATE_LIMIT, if set)
  5. CORS (SWML_CORS_ORIGINS)
  6. CSRF origin check (SWML_CSRF_PROTECTION, if set)
  7. Basic auth
  8. Webhook signature, for a POST (if a signing key is set)
  |
  v
Route handler:
  1. Proxy detection from the request headers (see Proxy Detection)
  2. Parse the JSON body (none for a GET)
  |
  v
handleRequest(method, url, headers, body):
  1. call_id: body.call_id or body.call.call_id for a POST; ?call_id= for a GET
  2. For a POST to a routing-callback path: run the callback;
     a returned route is sent as a 307 redirect
  3. modifications = await onSwmlRequest(body, callbackPath, context)
  4. The agent to render from: a per-request copy configured by the
     dynamic config callbacks, or this agent when there are none
  5. renderSwml(callId, modifications)
  6. Return 200 with the SWML
```

### SWAIG Function Dispatch (POST /swaig)

A tool request from SignalWire goes through these steps:

```text
Request from SignalWire
  |
  v
Middleware (as for the SWML request; signature check when a signing key is set)
  |
  v
handleSwaig():
  1. Parse the JSON body
  2. Function name from body.function
     - missing -> 400; longer than 128 characters or not an identifier -> 400
  3. The agent to run on: the per-request copy, when there are dynamic config callbacks
  4. Look the name up in that agent's tool registry
     - not found, or not a SwaigFunction (a DataMap tool) -> 404 { error: "Unknown function: ..." }
  5. If the tool is secure: check __token (or token) from the URL against the
     function name and body.call_id. A missing or invalid token gets a 200 response
     whose text says the token is invalid or expired; the handler doesn't run.
  6. Arguments from body.argument.parsed[0], body.argument.raw, or body.arguments
  7. onFunctionCall(name, args, body): a returned value is sent instead of running the handler
  8. Run the handler with (args, body, agent), and send its result
```

### Post-Prompt Handler (POST /post_prompt)

The end-of-call summary goes through these steps:

```text
Request from SignalWire at the end of the call
  |
  v
Middleware (as for the SWML request)
  |
  v
handlePostPrompt():
  1. Parse the JSON body
  2. call_id from the body, or the URL's ?call_id=; if both are present and differ -> 400
  3. Check __token for the post_prompt function and that call; missing or invalid -> 403
  4. The agent to run on: the per-request copy, when there are dynamic config callbacks
  5. findSummary(body): body.summary, else post_prompt_data.parsed[0],
     else post_prompt_data.raw parsed as JSON, else the raw text, else null
  6. await onSummary(summary, body); an error it throws is logged
  7. Return { "success": true }, or onSummary's return value for a
     fetch_conversation request
```

---

## Tool System

### SwaigFunction Wrapper

Each tool registered with `defineTool()` is a `SwaigFunction` in the tool registry, a `Map` keyed by name. `registerSwaigFunction()` stores a `SwaigFunction`, or a plain object for a DataMap tool:

<!-- snippet: no-compile registry illustration with `...` elision, not runnable -->
```typescript
// Handler-based tool
toolRegistry.set('get_weather', new SwaigFunction({ name, handler, description, ... }));

// DataMap tool (plain object)
toolRegistry.set('lookup_zip', { function: 'lookup_zip', description: '...', data_map: {...} });
```

Rendering walks the registry. A `SwaigFunction` becomes a definition with its schema and webhook URL. A plain object is copied as it is.

### Handler Signature

A handler receives the arguments, the whole request body, and the agent the request runs on:

<!-- snippet: no-compile handler type-alias reference, not runnable code -->
```typescript
type SwaigHandler = (
  args: Record<string, unknown>,   // Arguments the model supplied
  rawData: SwaigRequest,           // The full SWAIG request body
  agent?: AgentBase,               // The per-request copy, or the agent itself
) => FunctionResult | Record<string, unknown> | string
   | Promise<FunctionResult | Record<string, unknown> | string>;
```

The third argument is the agent the request was configured on: the per-request copy when a dynamic config callback or `addPerCallConfig()` is in use. A handler that closes over the original agent sees the original, not the copy. The route awaits the handler. A synchronous or CPU-bound handler blocks Node's event loop, and every other request, until it returns.

### Result Serialization

`SwaigFunction` converts the handler's result like this:

```text
Handler returns:
  |
  |-- FunctionResult             -->  result.toDict()
  |-- { response: ... }          -->  sent as it is
  |-- object without response    -->  FunctionResult("Function completed successfully").toDict()
  |-- anything else (a string)   -->  FunctionResult(String(value)).toDict()
  |-- throws                     -->  the tool's onError hook, then the agent's onError hook;
                                      a FunctionResult either returns is sent. Otherwise
                                      FunctionResult(errorMessage or the default message).toDict()
```

`FunctionResult.toDict()` produces an object like this one:

```json
{
  "response": "The weather in Austin is 72F and sunny.",
  "action": [
    { "set_global_data": { "last_city": "Austin" } }
  ]
}
```

`post_process` appears only when it's `true` and there are actions. If both `response` and `action` are empty, the response is `"Action completed."`.

### DataMap Tools

The SignalWire platform runs a DataMap tool itself, so it has a `data_map` key and no `web_hook_url`:

```json
{
  "function": "check_status",
  "description": "Check order status",
  "parameters": { "type": "object", "properties": { "order_id": { "type": "string" } } },
  "data_map": {
    "webhooks": [
      {
        "url": "https://api.example.com/orders/${args.order_id}",
        "method": "GET",
        "output": { "response": "Order status: ${status}" }
      }
    ]
  }
}
```

A webhook's JSON response is read from the root of the template data (`${status}`), and the arguments are under `args`. A request for a DataMap tool at the agent's `/swaig` gets `404`, because the agent has no handler for it.

---

## Session Management

`SessionManager` creates and checks the per-call tokens for secure tools and for the post-prompt URL. It stores no state for them: a token carries everything the check needs.

### Token Format

A token is the base64url encoding of five dot-separated fields:

```text
base64url( callId . functionName . expiry . nonce . hmacSignature )
```

| Field | Description |
|-------|-------------|
| `callId` | The call the token is for. |
| `functionName` | The function the token allows (`post_prompt` for the post-prompt URL). |
| `expiry` | Unix time, in seconds, when the token expires. |
| `nonce` | 16 random hex characters. |
| `hmacSignature` | The HMAC-SHA256 hex digest of `callId:functionName:expiry:nonce`. |

### Token Generation

`generateToken()` builds the token:

<!-- snippet: no-compile method-body excerpt shown outside its class, not a standalone module -->
```typescript
generateToken(functionName: string, callId: string): string {
  const expiry = Math.floor(Date.now() / 1000) + this.tokenExpirySecs;
  const nonce = randomBytes(8).toString('hex');
  const message = `${callId}:${functionName}:${expiry}:${nonce}`;
  const signature = createHmac('sha256', this.secretKey).update(message).digest('hex');
  const token = `${callId}.${functionName}.${expiry}.${nonce}.${signature}`;
  return Buffer.from(token).toString('base64url');
}
```

The secret key is the `swaigSecret` option, else `SIGNALWIRE_SWAIG_SECRET`, else 32 random bytes generated when the agent is created. With a random key, tokens stop validating after a restart and on other replicas, so set the same secret on every replica. Tokens last `tokenExpirySecs` seconds, 3600 by default for an agent. `renderSwml()` creates them and puts them in the `__token` query parameter of each secure tool's webhook URL and of the post-prompt URL.

### Token Validation

For each `/swaig` request for a secure tool, and each `/post_prompt` request, the agent checks the token:

1. Decode the base64url token and split it into fields. The last four are the function, expiry, nonce and signature; the rest is the call ID, which can contain dots.
2. Reject it if the request has no call ID.
3. Check that the function name matches the request.
4. Check that the expiry hasn't passed.
5. Recompute the HMAC-SHA256 signature and compare it in constant time.
6. Check that the call ID matches the request's.

A secure tool with a missing or failed token doesn't run. The response is `200` with a response text saying the token is invalid or expired. A `/post_prompt` request with a missing or failed token gets `403`.

### Session Metadata

`SessionManager` also has an in-memory store keyed by session ID, in this process only:

<!-- snippet: no-compile bare method signatures shown for reference, not runnable -->
```typescript
setSessionMetadata(sessionId: string, metadata: Record<string, unknown>): void;
getSessionMetadata(sessionId: string): Record<string, unknown>;
deleteSessionMetadata(sessionId: string): boolean;
```

The token checks don't use it. It isn't shared between replicas, and it's lost on a restart.

---

## Proxy Detection

Behind a reverse proxy (nginx, a load balancer, a tunnel), the agent needs its external URL to build the webhook URLs in its SWML. It chooses the base URL like this:

1. **`SWML_PROXY_URL_BASE`**, read when the agent is created. While it's set, request headers never change the base URL.
2. **`manualSetProxyUrl(url)`**, which replaces the base URL from then on.
3. **Request headers**, only with `SWML_TRUST_PROXY_HEADERS=true` and without `SWML_PROXY_URL_BASE`. On each SWML request, the agent reads, in order:
   - `X-Forwarded-Host`, with `X-Forwarded-Proto` (default `https`)
   - `Forwarded` (RFC 7239), its `host=` and `proto=` values
   - `X-Original-Host`, with `X-Forwarded-Proto`
   - `X-Forwarded-For` alone has no host; with `SWML_PROXY_DEBUG=true`, the agent logs that it can't determine the host.
4. **Serverless**: on a detected serverless platform, the platform's URL for the function.
5. **Fallback**: `http://{host}:{port}`, with `localhost` for the host `0.0.0.0`, and `https` when `SWML_ENFORCE_HTTPS=true`.

A base URL found from headers stays in effect for later requests until other headers replace it.

### Webhook URL Building

`buildWebhookUrl(endpoint, extraParams?)` builds each webhook URL:

<!-- snippet: no-compile bare method signature shown for reference, not runnable -->
```typescript
buildWebhookUrl(endpoint: string, extraParams?: Record<string, string>): string
```

It follows these steps:

1. Call `getFullUrl(true)` for the base URL and route, with the basic-auth credentials in it.
2. Append the endpoint (`swaig`, `post_prompt` or `debug_events`).
3. Append the query parameters: the SWAIG query params and, for a secure tool, `__token`.

A generated URL looks like this:

```text
https://admin:a-long-random-password@agents.example.com/support/swaig?tenant=acme&__token=...
```

---

## Security Layers

The agent's security settings are Hono middleware on its app. [Configuration](configuration.md) lists every variable.

### Basic Authentication

Every route except `/health` and `/ready` requires HTTP Basic Authentication. The agent resolves the credentials in this order:

1. The `basicAuth` constructor option.
2. The config file's `security.auth.basic` (or `security.basicAuth`) password.
3. `SWML_BASIC_AUTH_PASSWORD`, with `SWML_BASIC_AUTH_USER` or `signalwire` as the username.
4. Generated: `SWML_BASIC_AUTH_USER` or the agent's name, and 32 random hex characters.

The credentials are in the webhook URLs of the SWML, so SignalWire authenticates when it calls the agent back. The routes check credentials through `validateBasicAuth()`, which compares them with the configured pair in constant time and which a subclass can override.

### CORS

`SWML_CORS_ORIGINS` sets the allowed origins:

<!-- snippet: no-compile illustrative Hono middleware calls, not a standalone program -->
```typescript
// Default: any origin, without credentials
cors({ origin: '*', credentials: false })

// SWML_CORS_ORIGINS=https://app.example.com,https://admin.example.com
cors({ origin: ['https://app.example.com', 'https://admin.example.com'], credentials: true })
```

With `SWML_CSRF_PROTECTION=true` and a `SWML_CORS_ORIGINS` list, a `POST` whose `Origin` header isn't in the list gets `403`.

### Security Headers

Every response from the agent's routes carries these headers:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

An app added with `mount()` sets its own headers and CORS, and isn't behind the agent's basic auth.

### Rate Limiting

When `SWML_RATE_LIMIT` is set, it's the number of requests allowed per minute per client IP:

- With `SWML_TRUST_PROXY_HEADERS=true`, the IP is the first `X-Forwarded-For` entry, else `X-Real-IP`, else the connection's address. Without it, the IP is the connection's address.
- An in-memory `Map` counts requests per IP, in 60-second windows.
- A request over the limit gets `429` `{"error":"Rate limit exceeded"}`.

### Allowed Hosts

When `SWML_ALLOWED_HOSTS` is set to a comma-separated list of host names:

- The agent reads the `Host` header, drops the port and lowercases it.
- A host not in the list gets `403`.

### Request Size Limits

The agent checks each request's `Content-Length` against `SWML_MAX_REQUEST_SIZE`, 1048576 bytes (1 MB) by default:

- A larger or non-numeric value gets `413` `{"error":"Request too large"}`.
- A request without `Content-Length` isn't checked.

### Webhook Signatures and TLS

A signing key comes from the `signingKey` option or `SIGNALWIRE_SIGNING_KEY`. With one, a `POST` to the agent route, `/swaig`, `/post_prompt` or a routing-callback path needs a valid SignalWire signature, or gets `403`. `GET` requests aren't checked.

`AgentBase.serve()` serves HTTPS when `SWML_SSL_ENABLED`, `SWML_SSL_CERT_PATH` and `SWML_SSL_KEY_PATH` are set, and plain HTTP otherwise. Behind a TLS-terminating proxy, set `SWML_PROXY_URL_BASE` to its `https` URL.

---

## Extension Points

### Lifecycle Hooks (Override in Subclass)

A subclass can override these methods:

| Hook | Signature | When Called |
|------|-----------|------------|
| `defineTools()` | `protected defineTools(): void` | Once, the first time tools are needed: `renderSwml()`, `getTools()`, `getApp()`/`serve()` or a SWAIG request. Register tools here with `this.defineTool()`. |
| `onSummary(summary, rawData)` | returns `void`, or a value for `fetch_conversation` | For each valid `/post_prompt` request, on the per-request copy. |
| `onFunctionCall(name, args, rawData)` | returns `void`, or a result to send instead | Before each tool handler runs at `/swaig`. |
| `onSwmlRequest(rawData, callbackPath?, context?)` | returns `void`, or modifications for the `ai` verb | On each SWML request, on the agent itself, before the per-request copy is made. `context` is the Hono context. |
| `onDebugEvent(event)` | `void \| Promise<void>` | For each `POST /debug_events`. |

These methods register handlers instead of being overridden:

- `onError(handler)`: called when a tool handler throws, after the tool's own `onError`. A `FunctionResult` it returns is sent as the response.
- `onCallEnd(handler)`: registers the reserved `hangup_hook` tool and turns on `swaig_post_conversation`, so the handler gets the call log when the call ends.

### Dynamic Configuration Callback

`setDynamicConfigCallback()` registers a callback that configures a per-request copy of the agent:

```typescript
agent.setDynamicConfigCallback(async (queryParams, bodyParams, headers, callAgent) => {
  // Configure callAgent; the original agent is unchanged
  if (queryParams['tier'] === 'gold') {
    callAgent.promptAddSection('Priority', { body: 'This caller has priority support.' });
  }
});
```

The callback receives the request's query parameters, body and headers (with credential-bearing headers removed), and the copy. `addPerCallConfig()` adds another callback to the chain, and `setDynamicConfigCallback()` replaces the chain. [Composition Architecture](#composition-architecture) describes what the copy has of its own.

A field a subclass adds is shared between the copy and the agent. Assigning a new value to it on the copy is safe; changing a shared object in place affects every request.

### Declarative PROMPT_SECTIONS

A subclass can declare its prompt sections as a static field:

<!-- snippet: no-compile bare static-field type signature shown for reference, not runnable -->
```typescript
static PROMPT_SECTIONS?: {
  title: string;
  body?: string;
  bullets?: string[];
  numbered?: boolean;
}[];
```

The `AgentBase` constructor adds each entry with `promptAddSection()`.

### Skills System

Skills are packages of tools, prompt sections, hints and global data:

```typescript
import { DateTimeSkill } from '@signalwire/sdk';

await agent.addSkill(new DateTimeSkill());
```

`addSkill()` runs the skill's setup, which registers its tools, prompt sections, hints and global data on the agent. `addSkillByName(name, params)` creates a skill from the registry first.

### Webhook URL Overrides

Two methods replace the webhook URLs the agent generates:

```typescript
agent.setWebHookUrl('https://custom-swaig-endpoint.example.com/swaig');
agent.setPostPromptUrl('https://custom-endpoint.example.com/post_prompt');
```

`setWebHookUrl()` replaces `defaults.web_hook_url`; a secure tool still gets its own URL with a token. `setPostPromptUrl()` replaces `post_prompt_url`.

### Debug Events

`enableDebugEvents(level)` turns on debug webhooks, with level 1 by default:

```typescript
agent.enableDebugEvents(2);
```

The SWML then has `debug_webhook_url` (the agent's `/debug_events`) and `debug_webhook_level` in the `ai` verb. Each `POST /debug_events` calls `onDebugEvent()`.
