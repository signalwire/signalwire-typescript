# SignalWire AI Agents TypeScript SDK: Agent Guide

## Table of Contents

- [Introduction](#introduction)
- [Creating an Agent](#creating-an-agent)
- [Prompts](#prompts)
  - [Raw Text Prompts](#raw-text-prompts)
  - [Prompt Object Model (POM)](#prompt-object-model-pom)
  - [Declarative PROMPT_SECTIONS](#declarative-prompt_sections)
- [Tools (SWAIG Functions)](#tools-swaig-functions)
  - [Defining Tools](#defining-tools)
  - [Tool Parameters](#tool-parameters)
  - [Secure Tools](#secure-tools)
  - [FunctionResult](#functionresult)
  - [DataMap (Server-Side Tools)](#datamap-server-side-tools)
- [Speech and Languages](#speech-and-languages)
  - [Hints](#hints)
  - [Languages](#languages)
  - [Pronunciation](#pronunciation)
- [AI Parameters](#ai-parameters)
- [Global Data](#global-data)
- [Call Flow (5 Phases)](#call-flow-5-phases)
- [Dynamic Configuration](#dynamic-configuration)
- [Post-Prompt and Summaries](#post-prompt-and-summaries)
- [Call End Hook](#call-end-hook)
- [Mounting Extra Routes](#mounting-extra-routes)
- [Multi-Agent Server](#multi-agent-server)
- [Subclassing AgentBase](#subclassing-agentbase)
- [HTTP Endpoints](#http-endpoints)
- [Environment Variables](#environment-variables)

---

## Introduction

The SignalWire AI Agents TypeScript SDK builds voice AI agents as HTTP microservices. Each agent is an HTTP server built on the [Hono](https://hono.dev/) framework. It serves **SWML** (SignalWire Markup Language) documents and handles **SWAIG** (SignalWire AI Gateway) function callbacks.

When a call reaches an agent's number, SignalWire requests a SWML document from the agent's HTTP endpoint. SignalWire requests it with a POST; the route also answers GET, for browsers and testing. The document describes the call flow: answering, playing audio, starting the AI with a prompt, and the tools the AI can call. You configure the prompt and define tools. The SDK renders the SWML, routes the webhooks, and checks authentication and tool tokens.

The agent answers three kinds of requests from SignalWire:

```text
SignalWire --POST /--> agent             returns the SWML document
SignalWire --POST /swaig--> agent        runs a tool handler
SignalWire --POST /post_prompt--> agent  delivers the call summary
```

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
declare global {
  // Shared context the fragments on this page assume (constructed in the prose examples).
  const agent: import('@signalwire/sdk').AgentBase;
  const AgentBase: typeof import('@signalwire/sdk').AgentBase;
  const AgentServer: typeof import('@signalwire/sdk').AgentServer;
  const FunctionResult: typeof import('@signalwire/sdk').FunctionResult;
  const DataMap: typeof import('@signalwire/sdk').DataMap;
  const createSimpleApiTool: typeof import('@signalwire/sdk').createSimpleApiTool;
  const createExpressionTool: typeof import('@signalwire/sdk').createExpressionTool;
  // Illustrative user-supplied helpers referenced by tool handlers on this page.
  const lookupOrder: (id: string) => Promise<string>;
  const fetchWeather: (city: string, units: string) => Promise<{ temp: number; condition: string }>;
  const doTransfer: (amount: number, account: string) => Promise<void>;
  const createReservation: (args: Record<string, unknown>) => Promise<string>;
  const logReservationSummary: (summary: Record<string, unknown>) => Promise<void>;
  const saveToDatabase: (summary: Record<string, unknown>) => Promise<void>;
  const lookupCustomer: (callerId: string) => Promise<{ name: string }>;
  const archiveTranscript: (callId: string, callLog: Record<string, unknown>[]) => Promise<void>;
  // Node globals (tsconfig sets types:[], so declare them here).
}
```

### Installation

Install the package from npm:

```bash
npm install @signalwire/sdk
```

### Quick Start

This agent has a prompt and one tool, and starts an HTTP server:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
import { AgentBase, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent' });

agent.setPromptText('You are a helpful customer service agent for Acme Corp.');

agent.defineTool({
  name: 'check_order_status',
  description: 'Look up the status of a customer order by order number.',
  parameters: {
    order_id: { type: 'string', description: 'The order number to look up' },
  },
  handler: async (args) => {
    const status = await lookupOrder(args.order_id as string);
    return new FunctionResult(`Order ${args.order_id} is ${status}.`);
  },
});

agent.serve();
```

---

## Creating an Agent

The `AgentBase` constructor takes an `AgentOptions` object. This example sets the common options. It passes no secrets, so the SDK reads the basic-auth credentials, the Signing Key and the token secret from the environment:

```typescript
const agent = new AgentBase({
  name: 'support-bot',
  route: '/',
  host: '0.0.0.0',
  port: 3000,
  usePom: true,
  tokenExpirySecs: 3600,
  autoAnswer: true,
  recordCall: false,
});
```

### AgentOptions Reference

Every option except `name` is optional:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | (required) | Display name. It's also the basic-auth username when the SDK generates credentials. |
| `route` | `string` | `"/"` | HTTP route the agent serves. A trailing slash is removed. |
| `host` | `string` | `"0.0.0.0"` | Address the server binds to. |
| `port` | `number` | `PORT` env, else `3000` | Port for the HTTP server. The constructor throws for a value outside 1 to 65535. |
| `basicAuth` | `[string, string]` | from config or env, else generated | Explicit `[username, password]`. See [Basic Auth](#basic-auth). |
| `usePom` | `boolean` | `true` | Render the prompt from POM sections. |
| `tokenExpirySecs` | `number` | `3600` | Lifetime, in seconds, of the per-call tokens for secure tools and the post-prompt URL. |
| `swaigSecret` | `string` | `SIGNALWIRE_SWAIG_SECRET` env, else random per process | Secret that signs the per-call tool tokens. See [Secure Tools](#secure-tools). |
| `signingKey` | `string` | `SIGNALWIRE_SIGNING_KEY` env, else none | SignalWire Signing Key. When set, the agent checks the webhook signature on POST requests. See [Webhook signatures](#webhook-signatures). |
| `webhookTrustProxy` | `boolean` | `false` | Let the signature check use `X-Forwarded-Proto` and `X-Forwarded-Host` to rebuild the URL SignalWire posted to. |
| `autoAnswer` | `boolean` | `true` | Add an `answer` verb to the call flow. |
| `recordCall` | `boolean` | `false` | Add a `record_call` verb after the answer. |
| `recordFormat` | `string` | `"mp4"` | Format for `record_call`, such as `"mp4"` or `"wav"`. |
| `recordStereo` | `boolean` | `true` | Record in stereo. |
| `defaultWebhookUrl` | `string` | none | Accepted, but not used when the SWML is rendered. Use `setWebHookUrl()` to change the tool webhook URL. |
| `nativeFunctions` | `string[]` | `[]` | Platform native functions to enable, emitted as `SWAIG.native_functions`. |
| `agentId` | `string` | 16 random hex characters | Identifier for this agent instance. |
| `suppressLogs` | `boolean` | `false` | Turn off all SDK logging in the process, not only this agent's. |
| `configFile` | `string` | none | Path to a JSON config file. Its `service` section supplies `route`, `host` and `port` when the constructor doesn't. |
| `schemaPath` | `string` | bundled schema | Path to a SWML JSON Schema file that verbs are validated against, in place of the bundled schema. |
| `schemaValidation` | `boolean` | `true` | `false` turns off the validation of verbs, as `SWML_SKIP_SCHEMA_VALIDATION=true` does. |
| `enablePostPromptOverride` | `boolean` | `false` | Add a basic-auth `POST /post_prompt_override` route. Its `post_prompt` field replaces the agent's post-prompt for every later call. |
| `checkForInputOverride` | `boolean` | `false` | Add a basic-auth `/check_for_input` route (GET and POST) that returns `{ ok: true, received: <body> }`. |

### Basic Auth

Every route except `/health` and `/ready` requires HTTP basic auth. The SDK resolves the credentials in this order:

1. **Provided**: the `basicAuth` constructor option.
2. **Config file**: `security.auth.basic.user` and `security.auth.basic.password` in the file named by `configFile`.
3. **Environment**: `SWML_BASIC_AUTH_PASSWORD`, with `SWML_BASIC_AUTH_USER` as the username (`signalwire` when it's unset).
4. **Generated**: a random password. The username is `SWML_BASIC_AUTH_USER` if it's set, otherwise the agent's `name`.

A generated password exists only in the process, and the startup log masks it. The SDK logs a warning when it generates one, because callers outside the process get `401`. Set the environment variables, or pass `basicAuth`, for any agent that SignalWire calls.

The SDK puts the credentials into the webhook URLs it renders (`https://user:password@host/swaig`), so SignalWire can call back. Anyone who can read the SWML can read the password.

### Webhook signatures

When `signingKey` or `SIGNALWIRE_SIGNING_KEY` is set, the agent checks the signature on `POST /`, `POST /swaig`, `POST /post_prompt` and any routing-callback path. It accepts `X-SignalWire-Sha256-Signature` (HMAC-SHA256), and falls back to `X-SignalWire-Signature` (HMAC-SHA1). A request with a missing or wrong signature gets `403`. GET requests aren't checked.

When neither is set, the agent logs a warning at construction and doesn't check where requests come from. Basic auth still applies. If the agent is behind a proxy that changes the URL, set `SWML_PROXY_URL_BASE`, or set `webhookTrustProxy: true` when you control the proxy. The signature covers the URL SignalWire posted to.

### Starting the Server

`serve()` starts the HTTP server. `run()` does the same outside a serverless environment, and handles one serverless request inside one:

```typescript
// Start listening
await agent.serve();
// or, detecting the environment:
await agent.run();
```

The server logs its address and credential source at startup. This is the output of an agent named `support-bot` with no credentials configured:

```text
[WARN] [AgentBase] [signalwire] webhook signature validation is disabled — set signingKey or SIGNALWIRE_SIGNING_KEY to enable
[WARN] [AgentBase] basic_auth_password_autogenerated: username="support-bot". No SWML_BASIC_AUTH_PASSWORD found in environment and no basicAuth passed to the agent constructor. ...
[INFO] [AgentBase] Agent 'support-bot' running at http://0.0.0.0:3000/
[INFO] [AgentBase] Auth: support-bot:**** (source: generated)
```

Each line also starts with a timestamp.

---

## Prompts

The SDK builds the system prompt in one of two ways: **raw text** or the **Prompt Object Model (POM)**.

### Raw Text Prompts

Pass the whole prompt as a string:

```typescript
agent.setPromptText(`
You are a friendly receptionist for Dr. Smith's office.
You help patients schedule appointments and answer basic questions.
Always be polite and professional.
`);
```

When raw text is set, the SDK sends it as the prompt text, and doesn't render POM sections.

### Prompt Object Model (POM)

POM builds a prompt from titled sections, body text, bullets and nested subsections. The SDK renders them as Markdown headings and lists. POM is on by default (`usePom: true`).

#### Adding Sections

`promptAddSection()` adds a section with a body, bullets, or both:

```typescript
agent.promptAddSection('Personality', {
  body: 'You are a cheerful and knowledgeable tech support agent.',
  bullets: [
    'Always greet the customer warmly',
    'Ask clarifying questions before troubleshooting',
    'Offer to escalate if you cannot resolve the issue',
  ],
});
```

#### Appending to Existing Sections

`promptAddToSection()` adds a bullet, several bullets, or more body text to a section:

```typescript
agent.promptAddToSection('Personality', {
  bullet: 'Never make promises about timelines',
});

agent.promptAddToSection('Personality', {
  bullets: ['Speak in plain, non-technical language', 'Confirm understanding before proceeding'],
});

agent.promptAddToSection('Personality', {
  body: 'Remember to always thank the customer at the end of the call.',
});
```

#### Subsections

`promptAddSubsection()` nests a section under a parent section:

```typescript
agent.promptAddSubsection('Personality', 'Tone', {
  body: 'Maintain a warm but professional tone throughout the conversation.',
  bullets: ['Avoid slang', 'Do not use jargon'],
});
```

#### Checking for Sections

`promptHasSection()` reports whether a section exists:

```typescript
if (!agent.promptHasSection('Escalation')) {
  agent.promptAddSection('Escalation', {
    body: 'If the issue cannot be resolved, transfer to a human agent.',
  });
}
```

#### Numbered Sections and Bullets

`numbered` numbers the section, and `numberedBullets` numbers its bullets:

```typescript
agent.promptAddSection('Troubleshooting Steps', {
  numbered: true,
  numberedBullets: true,
  bullets: [
    'Ask the customer to restart the device',
    'Check if the firmware is up to date',
    'Try a factory reset',
  ],
});
```

#### Retrieving the Rendered Prompt

`getPrompt()` returns the prompt rendered as text. In POM mode, the SWML carries the sections as a `pom` array instead:

```typescript
const renderedPrompt = agent.getPrompt();
```

### Declarative PROMPT_SECTIONS

A subclass can declare its prompt sections as a static property. The constructor adds them with `promptAddSection()`. Each entry takes `title`, and optionally `body`, `bullets` and `numbered`:

```typescript
class SupportAgent extends AgentBase {
  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a technical support agent for CloudCo.',
    },
    {
      title: 'Guidelines',
      bullets: [
        'Be concise and helpful',
        'Verify the customer identity before sharing account details',
      ],
    },
  ];

  constructor() {
    super({ name: 'support-agent' });
  }
}
```

---

## Tools (SWAIG Functions)

Tools, also called SWAIG functions, are actions the AI can call during a conversation. When the AI calls a tool, SignalWire sends a POST request to the agent's `/swaig` endpoint with the function name and arguments.

### Defining Tools

`defineTool()` registers a tool:

```typescript
agent.defineTool({
  name: 'get_weather',
  description: 'Get the current weather for a city.',
  parameters: {
    city: { type: 'string', description: 'City name' },
    units: { type: 'string', description: 'Temperature units', enum: ['celsius', 'fahrenheit'] },
  },
  required: ['city'],
  handler: async (args, rawData) => {
    const weather = await fetchWeather(args.city as string, args.units as string);
    return new FunctionResult(`The weather in ${args.city} is ${weather.temp} degrees and ${weather.condition}.`);
  },
});
```

The `handler` function receives three arguments:

| Argument | Type | Description |
|----------|------|-------------|
| `args` | `Record<string, unknown>` | The arguments the AI passed, taken from the request's `argument.parsed[0]`. |
| `rawData` | `SwaigRequest` | The whole SWAIG request body from SignalWire, including `call_id` and `global_data`. |
| `agent` | `AgentBase` | The agent the request was configured on: the per-request copy when a dynamic config callback or `addPerCallConfig()` is in use, otherwise the agent itself. |

A handler that reads the agent's configuration should read it from the third argument. An arrow function that captured `agent` sees the original agent, not the per-request copy.

The handler can return any of these:

- A `FunctionResult` instance
- A plain object with a `response` key
- A string, which the SDK wraps in a `FunctionResult`

A handler runs on Node's event loop. Synchronous or CPU-heavy work in a handler blocks every other request the process is serving, so await asynchronous calls instead.

### Tool Parameters

Parameters follow JSON Schema. You can pass the properties alone, or a full object schema:

<!-- snippet: no-compile bare object-literal property fragment, not a standalone statement -->
```typescript
// Properties only: the SDK wraps them in { type: 'object', properties: ... }
parameters: {
  name: { type: 'string', description: 'Customer name' },
  email: { type: 'string', description: 'Email address' },
}

// Full schema
parameters: {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Customer name' },
    email: { type: 'string', description: 'Email address' },
  },
  required: ['name'],
}
```

### Secure Tools

Tools are secure unless you pass `secure: false`. A secure tool runs only with a valid token minted for that function and that call:

```typescript
agent.defineTool({
  name: 'transfer_funds',
  description: 'Transfer money between accounts.',
  secure: true,
  parameters: {
    amount: { type: 'number', description: 'Amount to transfer' },
    to_account: { type: 'string', description: 'Destination account ID' },
  },
  handler: async (args) => {
    // Runs only when the request carries a valid token for this call
    await doTransfer(args.amount as number, args.to_account as string);
    return new FunctionResult('Transfer completed.');
  },
});
```

When the SDK renders the SWML, it adds a `__token` query parameter to each secure tool's `web_hook_url`. The token is an HMAC over the call ID, the function name and an expiry. On each `/swaig` request, the SDK checks the signature, the call ID and the expiry before it runs the handler. A request with no token, or with no `call_id` in its body, is refused like a wrong token. The refusal is a normal SWAIG response whose text says the token is invalid or expired.

The token proves that the request came from SWML this agent rendered for that call. It doesn't replace basic auth or the webhook signature check.

By default, each process generates its own signing secret at startup. A restart then invalidates the tokens of calls in progress, and two replicas can't check each other's tokens. Set the same `swaigSecret`, or `SIGNALWIRE_SWAIG_SECRET`, on every replica and keep it across restarts.

SignalWire's requests already carry the token. To call a secure tool yourself, for example with `curl`, first fetch the SWML for the call with `GET /?call_id=<id>`. Then take the token from that tool's `web_hook_url`. `swaig-test --exec` runs the handler directly and doesn't need a token.

### FunctionResult

`FunctionResult` builds a tool's response. It carries response text and an ordered list of actions. The response text is context for the model, not speech: the model reads it and decides what to say. These examples show four ways to build one:

<!-- snippet: no-compile four alternative constructions reuse the `result` name for illustration -->
```typescript
import { FunctionResult } from '@signalwire/sdk';

// Text for the model
const result = new FunctionResult('The order has been placed.');

// Text and actions
const result = new FunctionResult('Transferring the caller now.')
  .connect('+15551234567');   // Transfer the call

// Update global data from within a tool
const result = new FunctionResult('Account verified.')
  .updateGlobalData({ verified: true, customer_id: '12345' });

// Separate the facts from the instruction
const result = new FunctionResult().setToolResponse(
  'status: 3 seats left',
  'Tell the caller how many seats are left and ask how many they want.',
);
```

`setToolResponse(toolResult, toolPrompt)`, or a `{ tool_result, tool_prompt }` object passed to the constructor, sends a structured response in place of the text. `tool_result` states what the tool did. `tool_prompt` tells the model what to do next.

These are the `FunctionResult` methods used most often:

| Method | Description |
|--------|-------------|
| `setResponse(text)` | Set the response text. |
| `setToolResponse(toolResult?, toolPrompt?)` | Set the structured `{ tool_result, tool_prompt }` response. |
| `connect(destination, final = true, fromAddr?)` | Transfer the call to a phone number or SIP address. |
| `hangup()` | Hang up the call. |
| `hold(prompt?, timeout = 300, step?, timeoutStep?)` | Put the call on hold. The SDK clamps `timeout` to 0 to 900 seconds. A number as the first argument is taken as the timeout. |
| `say(text)` | Add a `say` action, which speaks the text on the call. |
| `stop()` | Stop the AI session. |
| `updateGlobalData(data)` | Merge data into the call's global data. |
| `setMetadata(data)` | Set metadata (`set_meta_data`) for the function's `meta_data_token`. Functions that share a token share the metadata. |
| `switchContext(opts)` | Replace the system prompt, with `systemPrompt`, `userPrompt`, `consolidate` and `fullReset`. |
| `swmlChangeStep(stepName)` | Move to another step of the current context. |
| `toggleFunctions(toggles)` | Turn functions on or off, as `{ function, active }` pairs. |
| `sendSms(opts)` | Send an SMS or MMS. |
| `playBackgroundFile(filename, wait = false)` | Play an audio file in the background. |
| `waitForUser(opts?)` | Wait for the caller, with `enabled`, `timeout` or `answerFirst`. |
| `addDynamicHints(hints)` | Add speech recognition hints during the call. |
| `executeSwml(swml, transfer = false)` | Run a SWML document. |
| `pay(opts)` | Start a payment collection flow. |

If a result has no response text and no actions, `toDict()` returns `{ response: "Action completed." }`.

### DataMap (Server-Side Tools)

A DataMap tool runs on the SignalWire platform, so the agent receives no webhook for it. It fits a single API call, or pattern matching on the arguments. In this example, the platform reads the webhook's JSON response from the root of the template data, so `${temp}` is the response's `temp` field:

```typescript
import { DataMap, FunctionResult } from '@signalwire/sdk';

const weatherTool = new DataMap('get_weather')
  .purpose('Look up weather for a city')
  .parameter('city', 'string', 'City name', { required: true })
  .webhook('GET', 'https://api.weather.example.com/v1/current?q=${lc:enc:args.city}', {
    headers: { Authorization: 'Bearer ${ENV.WEATHER_API_KEY}' },
  })
  .output(new FunctionResult('The weather is ${temp}F and ${condition}.'))
  .enableEnvExpansion()
  .setAllowedEnvPrefixes(['WEATHER_']);

weatherTool.registerWithAgent(agent);
```

`${args.city}` is the tool's `city` argument, and `lc:enc:` lowercases and URL-encodes it. The SDK expands `${ENV.NAME}` itself, when `toSwaigFunction()` runs (here, inside `registerWithAgent()`). It expands only names with an allowed prefix, by default `SIGNALWIRE_`, `SWML_` or `SW_`. Any other name becomes an empty string. `setAllowedEnvPrefixes()` changes the list for one DataMap, and `setAllowedEnvPrefixes()` from the package changes the default. The expanded value is part of the SWML the agent serves.

`createSimpleApiTool()` builds a one-webhook DataMap from a URL and a response template:

```typescript
import { createSimpleApiTool, createExpressionTool } from '@signalwire/sdk';

const tool = createSimpleApiTool({
  name: 'joke',
  url: 'https://api.example.com/joke',
  responseTemplate: 'Here is a joke: ${joke}',
});
tool.registerWithAgent(agent);
```

For the template syntax and the builder API, see the [DataMap Guide](datamap-guide.md).

---

## Speech and Languages

### Hints

Speech recognition hints help transcription with domain-specific words:

```typescript
// Single hint
agent.addHint('SignalWire');

// Multiple hints
agent.addHints(['HIPAA', 'deductible', 'copay', 'pre-authorization']);

// Pattern hint: a hint with a pattern and its replacement
agent.addPatternHint({
  hint: 'SignalWire',
  pattern: 'signal wire',
  replace: 'SignalWire',
  ignoreCase: true,
});
```

### Languages

`addLanguage()` adds a language, with its voice and TTS engine:

```typescript
agent.addLanguage({
  name: 'English',
  code: 'en-US',
  voice: 'en-US-Neural2-F',
  engine: 'google',
});

agent.addLanguage({
  name: 'Spanish',
  code: 'es-MX',
  voice: 'es-MX-Neural2-A',
});
```

`LanguageConfig` also takes filler phrases. `speechFillers` fill a pause in speech, and `functionFillers` play while a tool runs; both are string arrays. Given both, the SDK emits `speech_fillers` and `function_fillers`; given one, it emits the schema's older `fillers` list, as the Python SDK does. The object forms `fillers` keyed by category and `functionFillers` keyed by function are flattened into lists, with a warning. `speechModel` adds a `speech_model` key, which the bundled schema doesn't define.

`setLanguages()` replaces all the languages at once:

```typescript
agent.setLanguages([
  { name: 'English', code: 'en-US', voice: 'en-US-Neural2-F' },
  { name: 'French', code: 'fr-FR', voice: 'fr-FR-Neural2-A' },
]);
```

### Pronunciation

`addPronunciation()` changes how the TTS engine says a word:

```typescript
agent.addPronunciation({
  replace: 'SQL',
  with: 'sequel',
  ignoreCase: true,
});

agent.addPronunciation({
  replace: 'API',
  with: 'A P I',
});
```

---

## AI Parameters

`setParam()` and `setParams()` set keys of the `ai` verb's `params` object, such as timeouts and barge behavior. The SWML schema lists the keys and their ranges:

```typescript
// Set a single parameter
agent.setParam('end_of_speech_timeout', 700);

// Set several at once
agent.setParams({
  attention_timeout: 15000,
  inactivity_timeout: 600000,
  barge_min_words: 2,
});
```

Sampling settings, such as `temperature`, `top_p` and the penalties, belong to the prompt, not to `params`.

### Prompt-Specific LLM Parameters

`setPromptLlmParams()` and `setPostPromptLlmParams()` merge keys into the `prompt` and `post_prompt` objects:

```typescript
// Main prompt
agent.setPromptLlmParams({
  temperature: 0.3,
  top_p: 0.9,
});

// Post-prompt
agent.setPostPromptLlmParams({
  temperature: 0.1,
});
```

The SDK passes these keys through without checking them. For the keys the schema defines, with their ranges and defaults, see the [LLM Parameters Guide](llm_parameters.md).

---

## Global Data

Global data is a set of key-value pairs the SDK sends as the `ai` verb's `global_data`. SignalWire includes it in each SWAIG request, as `rawData.global_data`:

```typescript
// Replace the global data
agent.setGlobalData({
  company: 'Acme Corp',
  support_hours: '9am-5pm EST',
  max_refund: 500,
});

// Merge more entries into it
agent.updateGlobalData({
  promo_code: 'SUMMER2025',
});
```

A tool handler changes the call's global data by returning an action:

<!-- snippet: no-compile bare handler property fragment, not a standalone statement -->
```typescript
handler: async (args: Record<string, unknown>) => {
  return new FunctionResult('Customer verified.')
    .updateGlobalData({ customer_verified: true, customer_name: args.name });
}
```

---

## Call Flow (5 Phases)

The SDK builds the SWML document's `main` section in five phases:

| Phase | Method | Description |
|-------|--------|-------------|
| 1. Pre-answer | `addPreAnswerVerb(verb, config)` | Verbs that run before the call is answered. |
| 2. Answer | `addAnswerVerb(config?)` | Configures the `answer` verb, which the SDK adds when `autoAnswer` is `true`. |
| 3. Post-answer | `addPostAnswerVerb(verb, config)` | Verbs after the answer and before the AI, such as `play`. |
| 4. AI | (automatic) | The `ai` verb, with the prompt, tools, hints, languages and parameters. |
| 5. Post-AI | `addPostAiVerb(verb, config)` | Verbs that run after the AI session ends, such as `hangup`. |

### Example

This agent plays audio before and after the answer, and hangs up after the AI session:

```typescript
const agent = new AgentBase({ name: 'ivr-bot', autoAnswer: true, recordCall: true });

// Phase 1: play audio as early media, without answering
agent.addPreAnswerVerb('play', {
  url: 'https://cdn.example.com/ringback.mp3',
  auto_answer: false,
});

// Phase 3: play a greeting after answering, before the AI starts
agent.addPostAnswerVerb('play', {
  url: 'https://cdn.example.com/greeting.wav',
});

// Phase 5: hang up after the AI session ends
agent.addPostAiVerb('hangup', {});
```

The SWML schema says a `play` verb answers the call unless `auto_answer` is `false`. When `recordCall` is `true`, the SDK adds a `record_call` verb at the start of phase 3.

### Clearing Verbs

These methods remove the verbs added to a phase:

```typescript
agent.clearPreAnswerVerbs();
agent.clearPostAnswerVerbs();
agent.clearPostAiVerbs();
```

---

## Dynamic Configuration

Dynamic configuration changes the agent for one request. `setDynamicConfigCallback()` registers a callback that runs on each request that renders SWML, runs a SWAIG function or delivers a summary. The SDK makes a per-request copy of the agent, calls the callback with the copy, and handles the request with it:

```typescript
agent.setDynamicConfigCallback(async (queryParams, bodyParams, headers, copy) => {
  // Customize from query parameters
  if (queryParams['lang'] === 'es') {
    copy.setPromptText('Eres un asistente de servicio al cliente amable.');
    copy.addLanguage({ name: 'Spanish', code: 'es-MX', voice: 'es-MX-Neural2-A' });
  }

  // Customize from request headers (names are lowercase)
  if (headers['x-customer-tier'] === 'premium') {
    copy.updateGlobalData({ premium: true, max_refund: 1000 });
  }

  // Customize from the request body
  const callerId = bodyParams.call?.from;
  if (callerId) {
    const customer = await lookupCustomer(callerId);
    copy.updateGlobalData({ customer_name: customer.name });
  }
});
```

The SWML is rendered from the copy. `/swaig` and `/post_prompt` requests run on the copy too, so a tool the callback adds or secures is the one that runs. Tool handlers get the copy as their third argument, and `onSummary` runs on it. The original agent isn't modified.

The copy has its own prompt, tools, hints, languages, pronunciations, params and global data. It also has its own function includes, LLM params, fillers, call-flow verbs, SWAIG query params, native functions, MCP servers, SIP usernames, routing callbacks and contexts. Skills loaded on the agent are shared with the copy, without running their setup again. A field your subclass adds is shared with every request in flight. Assign a new value to such a field on the copy, rather than changing the shared object in place. A subclass's JavaScript `#private` fields aren't on the copy, so use TypeScript `private` fields.

The callback receives these arguments:

<!-- snippet: no-compile type signature excerpt; SwmlRequestData and AgentBase are not imported -->
```typescript
type DynamicConfigCallback = (
  queryParams: Record<string, string>, // URL query parameters
  bodyParams: SwmlRequestData,         // Parsed request body
  headers: Record<string, string>,     // Headers, without credential-bearing ones
  agent: AgentBase,                    // The per-request copy to configure
) => void | Promise<void>;
```

If the callback throws, the SDK logs the error and handles the request with the copy as far as the callback configured it.

### Composing callbacks with addPerCallConfig()

`addPerCallConfig()` takes a callback with the same signature, and adds it to the ones already registered. The callbacks run in registration order on the same copy, so a later one sees what an earlier one set. A base class and a subclass can each register what they own:

```typescript
agent.addPerCallConfig((query, _body, _headers, copy) => {
  copy.updateGlobalData({ tenant: query['tenant'] ?? 'default' });
});

agent.addPerCallConfig((_query, _body, headers, copy) => {
  if (headers['x-debug'] === '1') copy.setParam('verbose_logs', true);
});
```

`setDynamicConfigCallback()` replaces every callback registered so far, including those from `addPerCallConfig()`.

### SWAIG Query Parameters

`addSwaigQueryParams()` appends query parameters to the SWAIG webhook URLs:

```typescript
agent.addSwaigQueryParams({ tenant: 'acme', region: 'us-east' });
```

---

## Post-Prompt and Summaries

The **post-prompt** is a second prompt that the platform runs when the call ends, usually to summarize the conversation. SignalWire posts the result to the agent's `/post_prompt` route.

### Setting the Post-Prompt

`setPostPrompt()` sets the post-prompt text:

```typescript
agent.setPostPrompt(`
Summarize this conversation as JSON with the following fields:
- "resolution": whether the issue was resolved (true/false)
- "category": the type of issue (billing, technical, general)
- "summary": a one-sentence summary of the call
`);
```

### Handling Summaries

Override the `onSummary` hook to process the summary:

```typescript
class MyAgent extends AgentBase {
  constructor() {
    super({ name: 'my-agent' });
  }

  override async onSummary(summary: Record<string, unknown> | null): Promise<void> {
    if (summary) {
      await saveToDatabase(summary);
    }
  }
}
```

The SDK takes the summary from `body.summary`, then `body.post_prompt_data.parsed[0]`, then `body.post_prompt_data.raw` parsed as JSON. The second argument is the whole request body. With a dynamic config callback set, `onSummary` runs on the per-request copy.

A `POST /post_prompt` needs the `__token` that the SDK put in the SWML's `post_prompt_url` for that call. A missing or wrong token gets `403`.

### Post-Prompt LLM Parameters

`setPostPromptLlmParams()` sets sampling parameters for the post-prompt alone:

```typescript
agent.setPostPromptLlmParams({
  temperature: 0.0,
});
```

---

## Call End Hook

`onCallEnd()` registers a handler that runs when the call ends, with the transcript. Handlers run in registration order with `(callLog, rawData)`:

```typescript
agent.onCallEnd(async (callLog, rawData) => {
  await archiveTranscript(rawData.call_id as string, callLog);
});
```

The first registration adds the platform's reserved `hangup_hook` function, which fires on hangup and isn't offered to the model. It also sets the `swaig_post_conversation` parameter to `true`, because without it the hook carries no transcript. If you set that parameter to `false` yourself, the SDK leaves it and logs a warning, and handlers get an empty list.

The SDK ignores a handler's return value. It logs an error a handler throws, and runs the remaining handlers.

---

## Mounting Extra Routes

`mount()` serves another Hono app, or a fetch handler, alongside the agent's routes:

<!-- snippet: no-run illustrative fragment: references the assumed `agent` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
import { Hono } from 'hono';

const status = new Hono();
status.get('/', (c) => c.json({ build: '2026-09-28' }));

agent.mount(status, { prefix: '/status' });
```

Mount before you call `serve()`. The agent replays its mounts each time it rebuilds its app, so a mount survives a routing change. A mounted app isn't behind the agent's basic auth, and it sets its own security headers and answers its own CORS preflights. The `name` option is accepted for code written for the Python SDK, and has no effect.

---

## Multi-Agent Server

`AgentServer` hosts several agents on one HTTP server, each under its own route:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
import { AgentBase, AgentServer } from '@signalwire/sdk';

const salesAgent = new AgentBase({ name: 'sales', route: '/sales' });
salesAgent.setPromptText('You are a sales representative.');

const supportAgent = new AgentBase({ name: 'support', route: '/support' });
supportAgent.setPromptText('You are a technical support agent.');

const server = new AgentServer({ host: '0.0.0.0', port: 4000 });
server.register(salesAgent);
server.register(supportAgent);

await server.run();
```

### AgentServer Features

The server adds these to the agents' own routes:

- **Agent listing**: when no agent is registered at `/`, `GET /` returns `{ "service": "SignalWire AI Agents", "agents": [{ "name", "route" }] }`.
- **Health endpoints**: `/health` and `/ready` return `{ "status": "ok" }` and `{ "status": "ready" }`, without auth.
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy` and `Permissions-Policy`, on every response except a mounted app's.
- **CORS**: the origins in `SWML_CORS_ORIGINS`, or any origin when it's unset.

### API

These methods manage the server:

| Method | Description |
|--------|-------------|
| `register(agent, route?)` | Mount an agent at `route`, or at the agent's own route. Throws if the route is in use. |
| `unregister(route)` | Remove an agent, its routes and its entry in the listing and `getAgents()`. |
| `getAgents()` | Return a `Map<string, AgentBase>` of the registered agents. |
| `getAgent(route)` | Look up an agent by route. |
| `serveStaticFiles(directory, route = '/')` | Serve files from a directory. |
| `getApp()` | Return the Hono application. |
| `run(host?, port?)` | Start the HTTP server. |

---

## Subclassing AgentBase

A subclass keeps an agent's prompt, tools and hooks in one class:

```typescript
import { AgentBase, FunctionResult } from '@signalwire/sdk';

class RestaurantBot extends AgentBase {
  // Declarative prompt sections
  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a restaurant reservation assistant for Bella Italia.',
    },
    {
      title: 'Guidelines',
      bullets: [
        'Be warm and inviting',
        'Always confirm the reservation details before finalizing',
        'Mention daily specials when relevant',
      ],
    },
  ];

  constructor() {
    super({ name: 'restaurant-bot', route: '/restaurant' });

    this.addHints(['Bella Italia', 'risotto', 'tiramisu']);
    this.setPromptLlmParams({ temperature: 0.6 });
  }

  // The SDK calls this once, the first time the tools are needed
  protected override defineTools(): void {
    this.defineTool({
      name: 'make_reservation',
      description: 'Create a restaurant reservation.',
      parameters: {
        date: { type: 'string', description: 'Reservation date (YYYY-MM-DD)' },
        time: { type: 'string', description: 'Reservation time (HH:MM)' },
        party_size: { type: 'number', description: 'Number of guests' },
        name: { type: 'string', description: 'Name for the reservation' },
      },
      required: ['date', 'time', 'party_size', 'name'],
      handler: async (args) => {
        const id = await createReservation(args);
        return new FunctionResult(
          `Reservation confirmed for ${args.party_size} on ${args.date} at ${args.time}. ` +
          `Confirmation number: ${id}.`
        );
      },
    });
  }

  // Post-prompt summary hook
  override async onSummary(summary: Record<string, unknown> | null): Promise<void> {
    if (summary) {
      await logReservationSummary(summary);
    }
  }

  // Runs before each tool handler
  override async onFunctionCall(name: string, args: Record<string, unknown>): Promise<void> {
    console.log(`Tool invoked: ${name}`, args);
  }
}
```

`defineTools()` runs lazily, the first time the tools are needed: on `renderSwml()`, `getTools()`, `getApp()`, `serve()` or a SWAIG request. It runs after the subclass's fields are initialized. Calling `this.defineTools()` from the constructor also works, and the SDK still registers the tools once.

### Extension Points

A subclass can override these members:

| Method / Property | Purpose |
|-------------------|---------|
| `static PROMPT_SECTIONS` | Prompt sections the constructor adds. |
| `defineTools()` | Register tools. The SDK calls it once. |
| `onSummary(summary, rawData)` | Runs when a post-prompt summary arrives. For a `fetch_conversation` request, a returned object is sent back as the response. |
| `onFunctionCall(name, args, rawData)` | Runs before each tool handler. A returned value other than `undefined` or `null` is sent as the result, and the handler doesn't run. |
| `onSwmlRequest(rawData, callbackPath?, context?)` | Runs on each SWML request before rendering. A returned object is merged into the `ai` verb's configuration. |
| `onDebugEvent(event)` | Runs when a debug event arrives at `/debug_events`. |

Every route that requires basic auth calls `validateBasicAuth(username, password)`, which compares the credentials in constant time. Override it to add a check; call `super.validateBasicAuth()` to keep the comparison.

---

## HTTP Endpoints

Each agent serves these routes, relative to its `route`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET, POST | `/` | Basic auth, and the signature on POST when a signing key is set | Returns the SWML document. Runs `onSwmlRequest` and the dynamic config callbacks. |
| GET, POST | `/swaig` | Basic auth, and the signature on POST | POST runs a tool: it reads `function` and `argument` from the body, checks the token of a secure tool, calls `onFunctionCall`, then the handler. GET returns the SWML document. |
| GET, POST | `/post_prompt` | Basic auth, the signature on POST, and the post-prompt token on POST | POST delivers the call's summary and calls `onSummary`. GET returns the SWML document. |
| POST | `/debug_events` | Basic auth | Receives debug events and calls `onDebugEvent`. `enableDebugEvents()` adds the URL to the SWML. |
| POST | `/mcp` | Basic auth | JSON-RPC endpoint for MCP clients, after `enableMcpServer()`. It doesn't list or run DataMap tools or tools with an external webhook URL. |
| POST | `/post_prompt_override` | Basic auth | Only with `enablePostPromptOverride: true`. |
| GET, POST | `/check_for_input` | Basic auth | Only with `checkForInputOverride: true`. |
| GET | `/health` | None | Returns `{ "status": "ok" }`. |
| GET | `/ready` | None | Returns `{ "status": "ready" }`. |

---

## Environment Variables

The agent reads these variables. For the security settings, see the [Security Guide](security.md):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port, when the constructor and config file don't set one. |
| `SWML_BASIC_AUTH_USER` | (none) | Basic-auth username, when `basicAuth` isn't passed. |
| `SWML_BASIC_AUTH_PASSWORD` | (none) | Basic-auth password, when `basicAuth` isn't passed. Without it, the SDK generates one. |
| `SIGNALWIRE_SIGNING_KEY` | (none) | Signing Key for the webhook signature check, when `signingKey` isn't passed. |
| `SIGNALWIRE_SWAIG_SECRET` | (random per process) | Secret for the per-call tool tokens, when `swaigSecret` isn't passed. |
| `SWML_PROXY_URL_BASE` | (none) | Public base URL for the webhook URLs, such as `https://agents.example.com`. It takes priority over detection from headers. |
| `SWML_TRUST_PROXY_HEADERS` | `false` | Set to `true` to build the public URL from `X-Forwarded-Host`, `Forwarded` or `X-Original-Host`, and to rate-limit by `X-Forwarded-For`. |
| `SWML_PROXY_DEBUG` | `false` | Set to `true` to log proxy detection. |
| `SWML_ENFORCE_HTTPS` | `false` | Set to `true` to build webhook URLs with `https` when no proxy base URL is known. |
| `SWML_CORS_ORIGINS` | any origin | Comma-separated list of allowed CORS origins. When set, CORS responses allow credentials. |
| `SWML_CSRF_PROTECTION` | `false` | Set to `true` to refuse a POST whose `Origin` isn't in `SWML_CORS_ORIGINS`, with `403`. |
| `SWML_ALLOWED_HOSTS` | (none) | Comma-separated list of allowed `Host` values. Other hosts get `403`. |
| `SWML_MAX_REQUEST_SIZE` | `1048576` | Largest `Content-Length`, in bytes. A larger request gets `413`. |
| `SWML_RATE_LIMIT` | (none) | Requests per minute. A client over the limit gets `429`. The limit is per client address: the connection's, or the forwarded one with `SWML_TRUST_PROXY_HEADERS=true`. |
| `SWML_SKIP_SCHEMA_VALIDATION` | `false` | Set to `true` to skip SWML schema validation. |
| `SIGNALWIRE_LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. |
| `SIGNALWIRE_LOG_MODE` | `auto` | `off` turns logging off, `stderr` writes to stderr, and `auto` decides from the environment. |
| `SIGNALWIRE_LOG_FORMAT` | `text` | `text` or `json`. |
| `SIGNALWIRE_LOG_COLOR` | on a TTY | `true` or `false`. |
