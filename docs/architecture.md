# SignalWire AI Agents TypeScript SDK -- Architecture

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
  - [AgentBase](#agentbase)
  - [PromptManager and PomBuilder](#promptmanager-and-pombuilder)
  - [SwmlBuilder](#swmlbuilder)
  - [SwaigFunction](#swaigfunction)
  - [FunctionResult](#swaigfunctionresult)
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
- [Extension Points](#extension-points)

---

## Overview

The SignalWire AI Agents TypeScript SDK implements an agent-as-microservice architecture. Each agent is an HTTP server that serves SWML documents and handles SWAIG tool callbacks. The SDK is built on the [Hono](https://hono.dev/) web framework and uses Node.js crypto for session management.

```
                     +--------------------------------------------------+
                     |                   AgentBase                       |
                     |                                                  |
                     |  +----------------+    +---------------------+   |
                     |  | PromptManager  |    | SessionManager      |   |
                     |  |  +----------+  |    | (HMAC tokens,       |   |
                     |  |  |PomBuilder|  |    |  session metadata)  |   |
                     |  |  +----------+  |    +---------------------+   |
                     |  +----------------+                              |
                     |                                                  |
                     |  +----------------+    +---------------------+   |
                     |  | SwmlBuilder    |    | Tool Registry       |   |
                     |  | (5-phase SWML  |    | Map<string,         |   |
                     |  |  document)     |    |   SwaigFunction |   |   |
                     |  +----------------+    |   Record<>>     |   |   |
                     |                        +---------------------+   |
                     |                                                  |
                     |  +----------------+    +---------------------+   |
                     |  | ContextBuilder |    | SkillManager        |   |
                     |  | (optional)     |    | (optional)          |   |
                     |  +----------------+    +---------------------+   |
                     |                                                  |
                     |  +--------------------------------------------+  |
                     |  | Hono HTTP App                              |  |
                     |  |   GET/POST /        -> renderSwml()        |  |
                     |  |   POST    /swaig    -> tool dispatch       |  |
                     |  |   POST    /post_prompt -> onSummary()      |  |
                     |  |   GET     /health   -> { status: ok }      |  |
                     |  |   GET     /ready    -> { status: ready }   |  |
                     |  +--------------------------------------------+  |
                     +--------------------------------------------------+

    Inbound Call
         |
         v
  SignalWire Platform  --GET/POST-->  AgentBase /   (returns SWML)
         |
         v
  AI engine processes call using SWML config
         |
         v
  AI invokes tool  --POST-->  AgentBase /swaig   (executes handler)
         |
         v
  Call ends  --POST-->  AgentBase /post_prompt   (delivers summary)
```

### AgentServer (Multi-Agent)

For hosting multiple agents on a single port, `AgentServer` mounts each agent's Hono app at its route prefix:

```
  AgentServer (Hono)
    |-- /sales     -> SalesAgent.getApp()
    |-- /support   -> SupportAgent.getApp()
    |-- /health    -> global health check
    |-- /ready     -> global readiness check
    |-- /          -> agent listing (if no agent mounted at /)
```

---

## Core Components

### AgentBase

**File**: `src/AgentBase.ts` (~1280 lines)

The central class that composes all other components. It is responsible for:

- **HTTP server lifecycle**: Creating and configuring the Hono app, binding middleware, registering routes, starting the server.
- **SWML rendering**: Assembling the 5-phase SWML document from all configured verbs, prompts, tools, and AI parameters.
- **Tool dispatch**: Routing incoming SWAIG function calls to the correct handler, validating secure tokens.
- **Proxy detection**: Auto-detecting reverse proxy configurations from request headers.
- **Dynamic configuration**: Creating ephemeral copies and invoking the dynamic config callback per-request.
- **Lifecycle hooks**: Providing `onSummary`, `onFunctionCall`, `onSwmlRequest`, `onDebugEvent`, and `validateBasicAuth` for subclass customization.

Key internal state:

```typescript
// Managers (composition)
private promptManager: PromptManager;
private sessionManager: SessionManager;
private swmlBuilder: SwmlBuilder;
private toolRegistry: Map<string, SwaigFunction | Record<string, unknown>>;

// AI configuration
private hints: string[];
private languages: LanguageConfig[];
private pronounce: PronunciationRule[];
private params: Record<string, unknown>;
private globalData: Record<string, unknown>;
private promptLlmParams: Record<string, unknown>;
private postPromptLlmParams: Record<string, unknown>;

// Call flow verbs (5 phases)
private preAnswerVerbs: [string, Record<string, unknown>][];
private answerConfig: Record<string, unknown>;
private postAnswerVerbs: [string, Record<string, unknown>][];
private postAiVerbs: [string, Record<string, unknown>][];

// Dynamic config
private dynamicConfigCallback: DynamicConfigCallback | null;
```

### PromptManager and PomBuilder

**Files**: `src/PromptManager.ts`, `src/PomBuilder.ts`

`PromptManager` is a facade that manages the agent's prompt text. It supports two modes:

1. **Raw text mode** -- A plain string set via `setPromptText()`. When set, it takes precedence over POM.
2. **POM mode** -- A `PomBuilder` instance that assembles structured sections into Markdown.

`PomBuilder` maintains an ordered list of `PomSection` objects. Each section has:

- `title` -- Rendered as a Markdown heading (e.g., `## Title`).
- `body` -- Paragraph text below the heading.
- `bullets` -- Rendered as `- item` or `1. item` (numbered).
- `subsections` -- Nested `PomSection` instances rendered at a deeper heading level.

The rendering pipeline:

```
PomBuilder.renderMarkdown()
  -> for each PomSection:
       PomSection.renderMarkdown(level=2, sectionNumber=[])
         -> heading: "## [N.] Title"
         -> body paragraph
         -> bullet list (- or 1.)
         -> recurse into subsections at level+1
```

`PromptManager.getPrompt()` returns:
1. `rawText` if set (bypasses POM).
2. `pom.renderMarkdown()` if POM sections exist.
3. Empty string otherwise.

### SwmlBuilder

**File**: `src/SwmlBuilder.ts` (~62 lines)

A minimal builder that assembles SWML documents. A SWML document has the structure:

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "answer": {} },
      { "ai": { ... } },
      { "hangup": {} }
    ]
  }
}
```

Key methods:

| Method | Description |
|--------|-------------|
| `reset()` | Clears the document back to an empty `{ version, sections: { main: [] } }`. |
| `addVerb(verbName, config)` | Appends `{ [verbName]: config }` to the `main` section. |
| `addVerbToSection(section, verb, config)` | Appends to a named section (creates if absent). |
| `renderDocument()` | Returns `JSON.stringify(document)`. |

`SwmlBuilder` is stateless between render cycles. `AgentBase.renderSwml()` calls `reset()` at the start, builds the 5 phases by calling `addVerb()`, then calls `renderDocument()`.

### SwaigFunction

**File**: `src/SwaigFunction.ts` (~168 lines)

Wraps a tool handler with metadata for SWAIG registration:

```typescript
class SwaigFunction {
  name: string;              // Tool name
  handler: SwaigHandler;     // The callback function
  description: string;       // Shown to the AI
  parameters: Record;        // JSON Schema for arguments
  secure: boolean;           // Requires HMAC token
  fillers?: Record;          // Per-language filler phrases
  waitFile?: string;         // Audio to play while executing
  waitFileLoops?: number;    // Loop count for wait file
  webhookUrl?: string;       // External webhook (bypasses local handler)
  required: string[];        // Required parameter names
  extraFields: Record;       // Additional SWAIG fields
}
```

Two primary operations:

1. **`execute(args, rawData)`** -- Invokes the handler and normalizes the result:
   - `FunctionResult` -> `result.toDict()`
   - Object with `response` key -> returned as-is
   - Plain object -> wrapped with "Function completed successfully" message
   - String -> wrapped in `FunctionResult`
   - Exception -> returns a generic error message

2. **`toSwaig(baseUrl, token?, callId?)`** -- Serializes to the SWAIG wire format for SWML.

### FunctionResult

**File**: `src/FunctionResult.ts` (~864 lines)

A fluent builder for SWAIG function responses. Carries:

- `response: string` -- Text returned to the AI.
- `action: Record<string, unknown>[]` -- Ordered list of actions.
- `postProcess: boolean` -- Whether actions run after the AI responds.

The `toDict()` serialization:

```typescript
toDict(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (this.response) result['response'] = this.response;
  if (this.action.length > 0) result['action'] = this.action;
  if (this.postProcess && this.action.length > 0) result['post_process'] = true;
  if (Object.keys(result).length === 0) result['response'] = 'Action completed.';
  return result;
}
```

The fallback `"Action completed."` ensures the response is never empty.

Action categories:

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

**File**: `src/SessionManager.ts` (~161 lines)

Stateless HMAC-SHA256 token manager. See [Session Management](#session-management) for details.

### ContextBuilder

**File**: `src/ContextBuilder.ts` (~797 lines)

Builds multi-context, multi-step conversation workflows. A `ContextBuilder` contains named `Context` objects, each containing ordered `Step` objects. Steps have prompt content, completion criteria, function restrictions, and navigation rules.

```
ContextBuilder
  |-- Context "greeting"
  |     |-- Step "welcome" (text, criteria, functions)
  |     |-- Step "identify" (gather_info questions)
  |
  |-- Context "support"
        |-- Step "diagnose" (POM sections, valid_steps)
        |-- Step "resolve" (end: true)
```

Contexts are serialized into the `contexts` key of the `ai` verb in SWML.

### DataMap

**File**: `src/DataMap.ts` (~365 lines)

Fluent builder for server-side SWAIG tools that execute on SignalWire without webhook callbacks. A DataMap can include:

- **Webhooks**: HTTP calls to external APIs with response template interpolation.
- **Expressions**: Pattern-matching rules evaluated against template variables.
- **Output templates**: `FunctionResult` instances serialized for response formatting.

DataMap tools are registered as raw dictionary objects in the tool registry (not `SwaigFunction` instances).

---

## Composition Architecture

The Python SDK uses 8 mixins to compose agent behavior. The TypeScript SDK replaces this with **internal composition** -- `AgentBase` holds manager instances as private fields:

```
Python SDK (Mixins)                    TypeScript SDK (Composition)
--------------------------             ---------------------------------
AgentBase(                             class AgentBase {
  PromptMixin,                           private promptManager: PromptManager;
  SwaigMixin,                            private toolRegistry: Map<...>;
  SessionMixin,                          private sessionManager: SessionManager;
  SwmlMixin,                             private swmlBuilder: SwmlBuilder;
  HttpMixin,                             private _app: Hono;
  ConfigMixin,                           private dynamicConfigCallback: ...;
  HintsMixin,                            private hints: string[];
  LanguageMixin                          private languages: LanguageConfig[];
)                                      }
```

Design decisions:

1. **No multiple inheritance**: TypeScript does not natively support mixins in the same way Python does. Composition provides cleaner encapsulation.
2. **Private managers**: `PromptManager`, `SessionManager`, and `SwmlBuilder` are private. Public methods on `AgentBase` delegate to them (e.g., `setPromptText()` delegates to `promptManager.setPromptText()`).
3. **Tool registry is a Map**: Supports both `SwaigFunction` instances (handler-based tools) and plain `Record<string, unknown>` objects (DataMap/raw definitions).
4. **Single public surface**: All configuration happens through `AgentBase` methods. Users do not need to interact with internal managers directly.
5. **Ephemeral copies**: The `createEphemeralCopy()` method shallow-copies the agent, then deep-copies all mutable collections (hints, languages, params, verbs, tool registry, etc.) and creates fresh `PromptManager` and `SwmlBuilder` instances.

---

## SWML Rendering Pipeline

The `renderSwml(callId?)` method on `AgentBase` assembles the complete SWML document in five sequential phases:

```
renderSwml(callId?)
  |
  |-- 1. swmlBuilder.reset()
  |
  |-- 2. Build webhook URLs (swaig, post_prompt)
  |      - Combine proxy base URL + route + endpoint
  |      - Embed basic auth credentials in URL
  |      - Append query params (swaigQueryParams, __token)
  |
  |-- 3. Build SWAIG object
  |      - native_functions[]
  |      - includes[]
  |      - internal_fillers{}
  |      - functions[] (iterate toolRegistry)
  |          For each SwaigFunction:
  |            - name, description, parameters (ensure schema structure)
  |            - fillers, wait_file, wait_file_loops
  |            - web_hook_url (with token for secure tools)
  |          For each raw dict (DataMap):
  |            - spread as-is with function name
  |      - defaults.web_hook_url
  |
  |-- PHASE 1: Pre-Answer Verbs
  |      for [verb, config] of preAnswerVerbs:
  |        swmlBuilder.addVerb(verb, config)
  |
  |-- PHASE 2: Answer Verb
  |      if autoAnswer:
  |        swmlBuilder.addVerb('answer', answerConfig)
  |
  |-- PHASE 3: Post-Answer Verbs
  |      if recordCall:
  |        swmlBuilder.addVerb('record_call', { format, stereo })
  |      for [verb, config] of postAnswerVerbs:
  |        swmlBuilder.addVerb(verb, config)
  |
  |-- PHASE 4: AI Verb
  |      Build aiConfig object:
  |        prompt: { text: ..., ...promptLlmParams }
  |        post_prompt: { text: ..., ...postPromptLlmParams }
  |        post_prompt_url: ...
  |        SWAIG: swaigObj
  |        contexts: contextsBuilder.toDict() (if defined)
  |        hints: [...]
  |        languages: [...]
  |        pronounce: [...]
  |        params: {...}
  |        global_data: {...}
  |        debug_webhook_url / debug_webhook_level (if enabled)
  |      swmlBuilder.addVerb('ai', aiConfig)
  |
  |-- PHASE 5: Post-AI Verbs
  |      for [verb, config] of postAiVerbs:
  |        swmlBuilder.addVerb(verb, config)
  |
  |-- Return swmlBuilder.renderDocument() (JSON string)
```

The resulting SWML document structure:

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "play": { "url": "..." } },
      { "answer": {} },
      { "record_call": { "format": "mp4", "stereo": true } },
      {
        "ai": {
          "prompt": { "text": "..." },
          "post_prompt": { "text": "..." },
          "post_prompt_url": "https://...",
          "SWAIG": {
            "functions": [ ... ],
            "defaults": { "web_hook_url": "https://..." }
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

```
Client Request
  |
  v
Hono Middleware Stack:
  1. Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
  2. Request size limit check (SWML_MAX_REQUEST_SIZE)
  3. Allowed hosts check (SWML_ALLOWED_HOSTS)
  4. Rate limiter (SWML_RATE_LIMIT)
  5. CORS (SWML_CORS_ORIGINS)
  6. Basic Auth (credential validation)
  |
  v
handleSwml():
  1. Parse request body (JSON, or empty for GET)
  2. detectProxyFromRequest(c) -- inspect headers for proxy info
  3. await onSwmlRequest(body) -- lifecycle hook
  4. If dynamicConfigCallback is set:
     a. createEphemeralCopy() -- deep-copy mutable state
     b. Extract queryParams, headers from request
     c. await dynamicConfigCallback(queryParams, body, headers, copy)
     d. Use copy for rendering
  5. Extract call_id from body (if present)
  6. agentToUse.renderSwml(callId) -- 5-phase rendering
  7. Return JSON response
```

### SWAIG Function Dispatch (POST /swaig)

```
Client Request (from SignalWire platform)
  |
  v
Middleware Stack (same as above)
  |
  v
handleSwaig():
  1. Parse request body
  2. Extract function name from body["function"]
  3. Look up in toolRegistry
     - Not found -> 404 { error: "Unknown function: ..." }
     - Not a SwaigFunction -> 404
  4. If fn.secure:
     a. Extract __token from URL query params
     b. Extract call_id from body
     c. sessionManager.validateToken(callId, fnName, token)
     d. Invalid -> 403 { error: "Invalid or expired token" }
  5. Extract args from body["argument"]
  6. await onFunctionCall(fnName, args, body) -- lifecycle hook
  7. result = await fn.execute(args, body)
  8. Return JSON response (result dict)
```

### Post-Prompt Handler (POST /post_prompt)

```
Client Request (from SignalWire platform, end of call)
  |
  v
Middleware Stack
  |
  v
handlePostPrompt():
  1. Parse request body
  2. findSummary(body):
     a. Check body["summary"]
     b. Check body["post_prompt_data"]["parsed"][0]
     c. Try JSON.parse(body["post_prompt_data"]["raw"])
     d. Return raw value as fallback
     e. Return null if nothing found
  3. await onSummary(summary, body) -- lifecycle hook
  4. Return { ok: true }
```

---

## Tool System

### SwaigFunction Wrapper

Each tool registered via `defineTool()` creates a `SwaigFunction` instance stored in the `toolRegistry` Map. The registry also supports raw dictionary entries (DataMap tools registered via `registerSwaigFunction()`).

```typescript
// Handler-based tool
toolRegistry.set('get_weather', new SwaigFunction({ name, handler, description, ... }));

// DataMap (raw dict)
toolRegistry.set('lookup_zip', { function: 'lookup_zip', description: '...', data_map: {...} });
```

During SWML rendering, the registry is iterated. `SwaigFunction` instances are serialized with their schema, webhook URLs, and optional tokens. Raw dicts are spread as-is.

### Handler Signature

```typescript
type SwaigHandler = (
  args: Record<string, unknown>,      // AI-extracted arguments
  rawData: Record<string, unknown>,    // Full request payload
) => FunctionResult | Record<string, unknown> | string
   | Promise<FunctionResult | Record<string, unknown> | string>;
```

The handler is intentionally flexible in its return type. The `execute()` method normalizes all return types into a consistent dict format.

### Result Serialization

The `execute()` method in `SwaigFunction` handles all return type normalization:

```
Handler returns:
  |
  |-- FunctionResult  -->  result.toDict()
  |-- { response: "..." }  -->  returned as-is
  |-- { ... } (no response) --> FunctionResult("Function completed successfully").toDict()
  |-- "string"              --> FunctionResult(string).toDict()
  |-- throws Error          --> FunctionResult("Sorry, I couldn't...").toDict()
```

`FunctionResult.toDict()` produces:

```json
{
  "response": "The weather is 72F and sunny.",
  "action": [
    { "set_global_data": { "last_city": "Austin" } }
  ],
  "post_process": false
}
```

If both `response` and `action` are empty, the fallback `"Action completed."` is used.

### DataMap Tools

DataMap tools differ from handler-based tools in that they execute entirely on the SignalWire platform. They are serialized as raw dictionaries with a `data_map` key instead of a `web_hook_url`:

```json
{
  "function": "check_status",
  "description": "Check order status",
  "parameters": { "type": "object", "properties": { ... } },
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

---

## Session Management

The `SessionManager` provides stateless HMAC-SHA256 token generation and validation. No server-side session state is stored for tokens -- all information is encoded within the token itself.

### Token Format

Tokens are base64url-encoded strings containing five dot-separated fields:

```
base64url( callId . functionName . expiry . nonce . hmacSignature )
```

| Field | Description |
|-------|-------------|
| `callId` | The call ID this token is bound to. |
| `functionName` | The SWAIG function name this token authorizes. |
| `expiry` | Unix timestamp (seconds) when the token expires. |
| `nonce` | Random 4-byte hex string for uniqueness. |
| `hmacSignature` | First 16 hex chars of HMAC-SHA256 over `callId:functionName:expiry:nonce`. |

### Token Generation

```typescript
generateToken(functionName: string, callId: string): string {
  const expiry = Math.floor(Date.now() / 1000) + this.tokenExpirySecs;
  const nonce = randomBytes(4).toString('hex');
  const message = `${callId}:${functionName}:${expiry}:${nonce}`;
  const signature = createHmac('sha256', this.secretKey)
    .update(message)
    .digest('hex')
    .slice(0, 16);
  const token = `${callId}.${functionName}.${expiry}.${nonce}.${signature}`;
  return Buffer.from(token).toString('base64url');
}
```

The secret key is a random 32-byte hex string generated at startup (per `SessionManager` instance). Tokens are generated during SWML rendering and embedded in the `__token` query parameter of each secure tool's webhook URL.

### Token Validation

On each `/swaig` POST for a secure tool:

1. Decode the base64url token.
2. Split into 5 parts; reject if not exactly 5.
3. Verify `functionName` matches the requested function.
4. Verify `expiry` has not passed.
5. Recompute HMAC-SHA256 over the same message format.
6. Compare the first 16 hex chars of the computed signature to the token's signature.
7. Verify `callId` matches the request's call ID.

All checks must pass. Any failure returns a `403 Forbidden` response.

### Session Metadata

`SessionManager` also provides an in-memory metadata store keyed by session ID:

```typescript
setSessionMetadata(sessionId: string, metadata: Record<string, unknown>): void;
getSessionMetadata(sessionId: string): Record<string, unknown> | undefined;
deleteSessionMetadata(sessionId: string): boolean;
```

This is used for storing per-session state that persists across multiple tool invocations within the same call.

---

## Proxy Detection

When running behind a reverse proxy (nginx, Cloudflare, AWS ALB, etc.), the agent needs to know its external URL to generate correct webhook URLs in SWML. The proxy detection system checks multiple sources in priority order:

### Detection Priority

1. **Environment variable** (`SWML_PROXY_URL_BASE`) -- Highest priority. Once set, header-based detection is disabled.
2. **Manual override** (`manualSetProxyUrl()`) -- Programmatic override.
3. **X-Forwarded-Host + X-Forwarded-Proto** headers.
4. **Forwarded** header (RFC 7239) -- Parses `host=` and `proto=` directives.
5. **X-Original-Host + X-Forwarded-Proto** headers.
6. **X-Forwarded-For** -- Detected but cannot determine host; logs a warning suggesting manual configuration.
7. **Fallback** -- Uses `http://localhost:{port}{route}`.

The detection runs on every SWML request (`detectProxyFromRequest()`). Once the environment variable is set, it is never overridden by header detection.

### Webhook URL Building

```typescript
buildWebhookUrl(endpoint: string, extraParams?: Record<string, string>): string
```

This method:

1. Calls `getFullUrl(includeAuth=true)` to get the base URL with embedded basic auth credentials.
2. Appends the endpoint path (e.g., `/swaig`, `/post_prompt`).
3. Appends query parameters (SWAIG query params, `__token` for secure tools).

Example generated URL:
```
https://admin:s3cret@agents.example.com/support/swaig?__token=abc123&tenant=acme
```

---

## Security Layers

The SDK implements multiple security layers, all configured through the Hono middleware stack.

### Basic Authentication

All endpoints except `/health` and `/ready` require HTTP Basic Authentication. Credentials are resolved in priority order:

1. `basicAuth` constructor option.
2. `SWML_BASIC_AUTH_USER` / `SWML_BASIC_AUTH_PASSWORD` environment variables.
3. Auto-generated (agent name as username, random 8-byte hex as password).

The `validateBasicAuth(username, password)` hook can be overridden in subclasses to add custom validation logic (e.g., checking against a database).

Credentials are embedded in webhook URLs so that SignalWire can authenticate when calling back to the agent.

### CORS

Controlled by `SWML_CORS_ORIGINS`:

```typescript
// Default: allow all origins
cors({ origin: '*', credentials: true })

// Restricted:  SWML_CORS_ORIGINS=https://app.example.com,https://admin.example.com
cors({ origin: ['https://app.example.com', 'https://admin.example.com'], credentials: true })
```

### Security Headers

Applied to all responses via middleware:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

### Rate Limiting

When `SWML_RATE_LIMIT` is set (requests per minute per IP):

- IP is extracted from `X-Forwarded-For` (first entry), `X-Real-IP`, or falls back to `"unknown"`.
- An in-memory Map tracks `{ count, resetAt }` per IP.
- The window resets every 60 seconds.
- Exceeding the limit returns `429 Too Many Requests`.

### Allowed Hosts

When `SWML_ALLOWED_HOSTS` is set (comma-separated hostnames):

- The `Host` header is extracted (port stripped, lowercased).
- If the host is not in the allowed set, returns `403 Forbidden`.

### Request Size Limits

When `SWML_MAX_REQUEST_SIZE` is set (bytes, default 1 MB):

- The `Content-Length` header is checked.
- Requests exceeding the limit return `413 Request Too Large`.

---

## Extension Points

The SDK provides multiple mechanisms for customizing agent behavior without modifying the core:

### Lifecycle Hooks (Override in Subclass)

| Hook | Signature | When Called |
|------|-----------|------------|
| `defineTools()` | `protected defineTools(): void` | Called explicitly by the subclass constructor to register tools. |
| `onSummary(summary, rawData)` | `void \| Promise<void>` | When a post-prompt summary is received at `/post_prompt`. |
| `onFunctionCall(name, args, rawData)` | `void \| Promise<void>` | Before each SWAIG function handler executes at `/swaig`. |
| `onSwmlRequest(rawData)` | `void \| Promise<void>` | On every SWML request at `/` before rendering. |
| `onDebugEvent(event)` | `void \| Promise<void>` | When a debug event webhook is received at `/debug_events`. |
| `validateBasicAuth(username, password)` | `boolean \| Promise<boolean>` | Called during auth middleware to add custom validation. |

### Dynamic Configuration Callback

```typescript
agent.setDynamicConfigCallback(async (queryParams, bodyParams, headers, ephemeralAgent) => {
  // Mutate ephemeralAgent -- original agent is unaffected
});
```

The callback receives an ephemeral copy created by `createEphemeralCopy()`. This copy has:

- Fresh `PromptManager` and `SwmlBuilder` instances.
- Shallow copies of all mutable arrays and objects (hints, languages, params, globalData, verbs, toolRegistry).
- The same prototype chain as the original (so subclass methods are available).

### Declarative PROMPT_SECTIONS

```typescript
static PROMPT_SECTIONS?: {
  title: string;
  body?: string;
  bullets?: string[];
  numbered?: boolean;
}[];
```

Applied automatically in the `AgentBase` constructor via `promptAddSection()` for each entry.

### Skills System

Skills are modular bundles of tools, prompt sections, hints, and global data:

```typescript
await agent.addSkill(new WeatherSkill({ apiKey: '...' }));
```

`addSkill()` iterates the skill's contributed tools, prompt sections, hints, and global data, registering each with the agent.

### Webhook URL Overrides

```typescript
agent.setWebHookUrl('https://custom-swaig-endpoint.example.com/swaig');
agent.setPostPromptUrl('https://custom-endpoint.example.com/post_prompt');
```

These override the auto-generated webhook URLs in the rendered SWML document.

### Debug Events

```typescript
agent.enableDebugEvents(2);  // level 1-3
```

When enabled, the SWML document includes `debug_webhook_url` and `debug_webhook_level` in the AI configuration. SignalWire posts debug events to `/debug_events`, which calls `onDebugEvent()`.
