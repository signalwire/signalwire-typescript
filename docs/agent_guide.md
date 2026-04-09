# SignalWire AI Agents TypeScript SDK -- Agent Guide

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
- [Skills System](#skills-system)
- [Multi-Agent Server](#multi-agent-server)
- [Subclassing AgentBase](#subclassing-agentbase)
- [HTTP Endpoints](#http-endpoints)
- [State Management](#state-management)
- [SIP Routing](#sip-routing)
- [Environment Variables](#environment-variables)

---

## Introduction

The SignalWire AI Agents TypeScript SDK lets you build AI-powered voice agents as HTTP microservices. Each agent is a lightweight HTTP server built on the [Hono](https://hono.dev/) framework that serves **SWML** (SignalWire Markup Language) documents and handles **SWAIG** (SignalWire AI Gateway) function callbacks.

When SignalWire receives an inbound call (or an outbound call is placed), it requests a SWML document from your agent's HTTP endpoint. The SWML document describes the entire call flow: answering, playing audio, launching the AI engine with a prompt, registering tools the AI can invoke, and handling post-call summaries. The agent SDK automates all of this -- you configure the prompt, define tools, and the SDK handles SWML rendering, webhook routing, authentication, and session management.

```
Caller --> SignalWire Platform --> GET/POST your-agent/ --> SWML document
                                  POST your-agent/swaig --> tool execution
                                  POST your-agent/post_prompt --> call summary
```

### Architecture Overview

```
+-------------------+
|    Your Agent     |  (Extends AgentBase with your specific functionality)
+--------+----------+
         |
+--------+----------+
|    AgentBase       |  (HTTP server, SWML rendering, tool dispatch, auth)
+--------+----------+
         |
+--------+----------+
|  Hono HTTP Server  |  (Routes, middleware, CORS, rate limiting)
+--------------------+
```

### Installation

```bash
npm install @signalwire/sdk
```

### Quick Start

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

The `AgentBase` constructor accepts an `AgentOptions` object:

```typescript
import { AgentBase } from '@signalwire/sdk';

const agent = new AgentBase({
  name: 'support-bot',
  route: '/',
  host: '0.0.0.0',
  port: 3000,
  basicAuth: ['admin', 's3cretP@ss'],
  usePom: true,
  tokenExpirySecs: 3600,
  autoAnswer: true,
  recordCall: false,
  recordFormat: 'mp4',
  recordStereo: true,
  nativeFunctions: [],
  suppressLogs: false,
});
```

### AgentOptions Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | **(required)** | Display name; also used as the default basic-auth username when credentials are auto-generated. |
| `route` | `string` | `"/"` | HTTP route path this agent listens on. |
| `host` | `string` | `"0.0.0.0"` | Hostname the server binds to. |
| `port` | `number` | `PORT` env or `3000` | Port number for the HTTP server. |
| `basicAuth` | `[string, string]` | auto-generated | Explicit `[username, password]` pair; if omitted, reads from env vars or generates random credentials. |
| `usePom` | `boolean` | `true` | Use Prompt Object Model for structured prompts. |
| `tokenExpirySecs` | `number` | `3600` | Session token validity in seconds for secure tools. |
| `autoAnswer` | `boolean` | `true` | Automatically insert an `answer` verb in the SWML call flow. |
| `recordCall` | `boolean` | `false` | Whether to record the call. |
| `recordFormat` | `string` | `"mp4"` | Recording format (e.g., `"mp4"`, `"wav"`). |
| `recordStereo` | `boolean` | `true` | Whether to record in stereo. |
| `defaultWebhookUrl` | `string` | `null` | Override the default SWAIG function webhook URL. |
| `nativeFunctions` | `string[]` | `[]` | List of built-in platform function names to include. |
| `agentId` | `string` | random hex | Unique identifier for this agent instance. |
| `suppressLogs` | `boolean` | `false` | Suppress all log output. |

### Basic Auth

Authentication credentials are resolved in this order:

1. **Provided** -- `basicAuth` option in the constructor.
2. **Environment** -- `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD` environment variables.
3. **Generated** -- A random password is generated, using the agent name as the username. Credentials are logged at startup so you can retrieve them.

```typescript
// Explicit credentials
const agent = new AgentBase({
  name: 'my-agent',
  basicAuth: ['admin', 'hunter2'],
});

// Environment-based: set SWML_BASIC_AUTH_USER and SWML_BASIC_AUTH_PASSWORD
const agent2 = new AgentBase({ name: 'my-agent' });

// Auto-generated: credentials are logged at startup
const agent3 = new AgentBase({ name: 'my-agent' });
// Logs: Auth: my-agent:**** (source: generated)
```

### Starting the Server

```typescript
// Start listening
await agent.serve();
// or equivalently:
await agent.run();
```

The server logs its address and auth credentials at startup:

```
Agent 'support-bot' running at http://0.0.0.0:3000/
Auth: support-bot:**** (source: generated)
```

---

## Prompts

The SDK provides two ways to define the system prompt sent to the AI: **raw text** and the **Prompt Object Model (POM)**.

### Raw Text Prompts

The simplest approach -- pass a complete prompt string:

```typescript
agent.setPromptText(`
You are a friendly receptionist for Dr. Smith's office.
You help patients schedule appointments and answer basic questions.
Always be polite and professional.
`);
```

When raw text is set, it is used verbatim as the AI's system prompt. This bypasses POM rendering.

### Prompt Object Model (POM)

POM allows you to build structured prompts from titled sections, body text, bullet points, and nested subsections. The SDK renders them as Markdown headings and lists. POM is enabled by default (`usePom: true`).

#### Adding Sections

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

```typescript
agent.promptAddToSection('Personality', {
  bullet: 'Never make promises about timelines',
});

agent.promptAddToSection('Personality', {
  bullets: ['Speak in simple, non-technical language', 'Confirm understanding before proceeding'],
});

agent.promptAddToSection('Personality', {
  body: 'Remember to always thank the customer at the end of the call.',
});
```

#### Subsections

```typescript
agent.promptAddSubsection('Personality', 'Tone', {
  body: 'Maintain a warm but professional tone throughout the conversation.',
  bullets: ['Avoid slang', 'Do not use jargon'],
});
```

#### Checking for Sections

```typescript
if (!agent.promptHasSection('Escalation')) {
  agent.promptAddSection('Escalation', {
    body: 'If the issue cannot be resolved, transfer to a human agent.',
  });
}
```

#### Numbered Sections and Bullets

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

```typescript
const renderedPrompt: string = agent.getPrompt();
```

### Declarative PROMPT_SECTIONS

When subclassing `AgentBase`, you can define prompt sections declaratively as a static property. They are automatically applied in the constructor:

```typescript
class SupportAgent extends AgentBase {
  static PROMPT_SECTIONS = [
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
    this.defineTools();
  }
}
```

---

## Tools (SWAIG Functions)

Tools (also called SWAIG functions) are actions the AI can invoke during a conversation. When the AI decides to call a tool, SignalWire sends a POST request to your agent's `/swaig` endpoint with the function name and arguments.

### SWAIG functions ARE LLM tools — descriptions matter

Before writing your first SWAIG function, internalize this: a SWAIG function is **exactly the same concept** as a "tool" in native OpenAI / Anthropic tool calling. There is no separate "SWAIG layer" between your function and the model. Each SWAIG function is rendered into the OpenAI tool schema format on every turn:

```json
{
  "type": "function",
  "function": {
    "name":        "your_function_name",
    "description": "your description text",
    "parameters":  { /* your JSON schema */ }
  }
}
```

That schema is sent to the model as part of the same API call that produces the next assistant message. The model reads:

- the **function `description`** to decide WHEN to call this tool
- the **per-parameter `description` strings** inside `parameters` to decide HOW to fill in each argument

This means **descriptions are prompt engineering**, not developer documentation. They are not a comment for the next human reading the code — they are instructions to the LLM that directly determine whether the model picks your tool when the user's request matches it.

Compare:

| Bad (model often misses the tool) | Good (model picks it reliably) |
|---|---|
| `description: 'Lookup function'` | `description: 'Look up a customer's account details by their account number. Use this BEFORE quoting any account-specific information (balance, plan, status, billing date). Don't use it for general product questions.'` |
| `description: 'the id'` (parameter) | `description: 'The customer's 8-digit account number, no dashes or spaces. Ask the user if they don't provide it.'` |

A vague description is the #1 cause of "the model has the right tool but doesn't call it" failures. When you find yourself debugging why the model isn't picking a tool that obviously matches the user's request, the first thing to check is whether the description tells the model — in plain language — when to use it and what makes it the right choice over sibling tools.

**Tool count matters too.** LLM tool selection accuracy degrades noticeably past ~7-8 simultaneously-active tools per call. If you have many tools, partition them across steps using `Step.setFunctions()` so only the relevant subset is active at any moment. See `contexts_guide.md` for the per-step whitelist mechanism.

### Defining Tools

Use `defineTool()` to register a tool:

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
    return new FunctionResult(
      `The weather in ${args.city} is ${weather.temp} degrees and ${weather.condition}.`
    );
  },
});
```

The `handler` function receives two arguments:

| Argument | Type | Description |
|----------|------|-------------|
| `args` | `Record<string, unknown>` | Parsed arguments extracted by the AI from the user's speech. |
| `rawData` | `Record<string, unknown>` | The full raw SWAIG request payload from SignalWire. |

The handler can return:

- A `FunctionResult` instance (recommended)
- A plain object with a `response` key
- A plain string (wrapped automatically)

### Tool Parameters

Parameters follow JSON Schema conventions. You can provide them in shorthand (just the properties) or full schema format:

```typescript
// Shorthand -- properties only, SDK wraps in { type: 'object', properties: ... }
agent.defineTool({
  name: 'lookup',
  description: 'Look up a customer',
  parameters: {
    name: { type: 'string', description: 'Customer name' },
    email: { type: 'string', description: 'Email address' },
  },
  handler: async (args) => new FunctionResult(`Found: ${args.name}`),
});

// Full schema
agent.defineTool({
  name: 'lookup_full',
  description: 'Look up a customer',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Customer name' },
      email: { type: 'string', description: 'Email address' },
    },
    required: ['name'],
  },
  handler: async (args) => new FunctionResult(`Found: ${args.name}`),
});
```

### Secure Tools

Secure tools require a valid HMAC session token for each invocation. The token is bound to the call ID and function name, preventing replay attacks:

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
    await doTransfer(args.amount as number, args.to_account as string);
    return new FunctionResult('Transfer completed successfully.');
  },
});
```

When `secure: true` is set, the SWML document includes a `__token` query parameter in the tool's webhook URL. On each `/swaig` request, the SDK validates the token's HMAC signature, call ID binding, and expiry before executing the handler.

### FunctionResult

`FunctionResult` is a fluent builder for tool responses. It carries response text and an ordered list of actions:

```typescript
import { FunctionResult } from '@signalwire/sdk';

// Simple text response
const result = new FunctionResult('The order has been placed.');

// Response with actions
const transfer = new FunctionResult('Transferring you now.')
  .connect('+15551234567')
  .hangup();

// Update global data from within a tool
const verified = new FunctionResult('Account verified.')
  .updateGlobalData({ verified: true, customer_id: '12345' });

// Context switch
const billing = new FunctionResult('Let me transfer you to billing.')
  .switchContext({ systemPrompt: 'You are now a billing specialist.' });
```

Key `FunctionResult` methods:

| Method | Description |
|--------|-------------|
| `setResponse(text)` | Set the response text. |
| `connect(destination, final?, from?)` | Transfer the call to a destination. |
| `hangup()` | Hang up the call. |
| `hold(timeout?)` | Place the call on hold (0-900 seconds). |
| `say(text)` | Speak text via TTS. |
| `stop()` | Stop the AI session. |
| `updateGlobalData(data)` | Merge data into the shared global store. |
| `setMetadata(data)` | Set call metadata. |
| `switchContext(opts)` | Switch the AI context with optional prompt changes. |
| `toggleFunctions(toggles)` | Enable/disable specific SWAIG functions. |
| `sendSms(opts)` | Send an SMS or MMS. |
| `playBackgroundFile(url, wait?)` | Play background audio. |
| `waitForUser(opts?)` | Wait for user input before continuing. |
| `addDynamicHints(hints)` | Add speech recognition hints at runtime. |
| `executeSwml(swml, transfer?)` | Execute arbitrary SWML content. |
| `pay(opts)` | Initiate a payment collection flow. |

Serialization fallback: if both `response` and `action` are empty, `toDict()` returns `{ response: "Action completed." }`.

### DataMap (Server-Side Tools)

DataMap tools execute entirely on the SignalWire platform without requiring a webhook. They are useful for simple API calls and pattern-matching:

```typescript
import { DataMap, FunctionResult } from '@signalwire/sdk';

const weatherTool = new DataMap('get_weather')
  .purpose('Look up weather for a city')
  .parameter('city', 'string', 'City name', { required: true })
  .webhook('GET', 'https://api.weather.com/v1/current?q=${args.city}', {
    headers: { Authorization: 'Bearer ${ENV.WEATHER_API_KEY}' },
  })
  .output(new FunctionResult('The weather is ${temp}F and ${condition}.'))
  .enableEnvExpansion();

weatherTool.registerWithAgent(agent);
```

Convenience helpers:

```typescript
import { createSimpleApiTool, createExpressionTool } from '@signalwire/sdk';

const tool = createSimpleApiTool({
  name: 'joke',
  url: 'https://api.example.com/joke',
  responseTemplate: 'Here is a joke: ${joke}',
});
tool.registerWithAgent(agent);
```

---

## Speech and Languages

### Hints

Speech recognition hints improve transcription accuracy for domain-specific vocabulary:

```typescript
// Single hint
agent.addHint('SignalWire');

// Multiple hints
agent.addHints(['HIPAA', 'deductible', 'copay', 'pre-authorization']);

// Pattern hint (find and replace in transcription)
agent.addPatternHint({
  pattern: 'signal wire',
  replace: 'SignalWire',
  ignoreCase: true,
});
```

### Languages

Configure supported languages with voice and filler phrases:

```typescript
agent.addLanguage({
  name: 'English',
  code: 'en-US',
  voice: 'en-US-Neural2-F',
  engine: 'google',
  speechModel: 'enhanced',
  fillers: { thinking: ['Let me check on that...', 'One moment please...'] },
  functionFillers: { get_weather: { 'en-US': ['Checking the forecast...'] } },
});

agent.addLanguage({
  name: 'Spanish',
  code: 'es-MX',
  voice: 'es-MX-Neural2-A',
});
```

Replace all languages at once:

```typescript
agent.setLanguages([
  { name: 'English', code: 'en-US', voice: 'en-US-Neural2-F' },
  { name: 'French', code: 'fr-FR', voice: 'fr-FR-Neural2-A' },
]);
```

### Pronunciation

Override how the TTS engine pronounces specific words:

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

Control the AI model's behavior with parameters like temperature and top_p:

```typescript
// Set a single parameter
agent.setParam('temperature', 0.7);
agent.setParam('top_p', 0.9);

// Set multiple parameters at once
agent.setParams({
  temperature: 0.3,
  top_p: 0.85,
  confidence: 0.5,
  barge_confidence: 0.3,
  presence_penalty: 0.2,
  frequency_penalty: 0.5,
});
```

### Prompt-Specific LLM Parameters

Set LLM parameters that apply specifically to the main prompt or post-prompt:

```typescript
// Main prompt LLM params (e.g., model selection, temperature override)
agent.setPromptLlmParams({
  model: 'gpt-4',
  temperature: 0.2,
});

// Post-prompt LLM params
agent.setPostPromptLlmParams({
  model: 'gpt-3.5-turbo',
  temperature: 0.1,
});
```

---

## Global Data

Global data is a key-value store shared across all tool invocations within a call. Tools can read from it and update it:

```typescript
// Replace the entire global data object
agent.setGlobalData({
  company: 'Acme Corp',
  support_hours: '9am-5pm EST',
  max_refund: 500,
});

// Merge additional entries into existing global data
agent.updateGlobalData({
  promo_code: 'SUMMER2025',
});
```

Within a tool handler, you can update global data dynamically:

```typescript
handler: async (args) => {
  return new FunctionResult('Customer verified.')
    .updateGlobalData({ customer_verified: true, customer_name: args.name });
}
```

---

## Call Flow (5 Phases)

The SWML document is assembled from five sequential phases. Each phase adds verbs to the document's `main` section:

| Phase | Method | Description |
|-------|--------|-------------|
| **1. Pre-Answer** | `addPreAnswerVerb(verb, config)` | Verbs executed before answering the call (e.g., playing a ring tone). |
| **2. Answer** | `addAnswerVerb(config?)` | The `answer` verb that picks up the call. Automatic when `autoAnswer: true`. |
| **3. Post-Answer** | `addPostAnswerVerb(verb, config)` | Verbs after answering but before the AI starts (e.g., `record_call`, `play`). |
| **4. AI** | *(automatic)* | The `ai` verb containing the prompt, tools, hints, languages, and all AI configuration. |
| **5. Post-AI** | `addPostAiVerb(verb, config)` | Verbs executed after the AI session ends (e.g., `hangup`, `connect`). |

### Example

```typescript
const agent = new AgentBase({ name: 'ivr-bot', autoAnswer: true, recordCall: true });

// Phase 1: Play hold music before answering
agent.addPreAnswerVerb('play', {
  url: 'https://cdn.example.com/hold-music.mp3',
});

// Phase 3: Play a greeting after answering, before AI starts
agent.addPostAnswerVerb('play', {
  url: 'https://cdn.example.com/greeting.wav',
});

// Phase 5: Hang up after the AI session ends
agent.addPostAiVerb('hangup', {});
```

Note: When `recordCall: true`, a `record_call` verb is automatically inserted at the start of Phase 3.

### Clearing Verbs

```typescript
agent.clearPreAnswerVerbs();
agent.clearPostAnswerVerbs();
agent.clearPostAiVerbs();
```

---

## Dynamic Configuration

Dynamic configuration lets you modify the agent's settings per-request. On each SWML request, the SDK creates an **ephemeral copy** of the agent, passes it to your callback, and renders SWML from the modified copy. The original agent is never mutated.

```typescript
agent.setDynamicConfigCallback(async (queryParams, bodyParams, headers, ephemeralAgent) => {
  const agent = ephemeralAgent as AgentBase;

  // Customize based on query parameters
  const lang = queryParams['lang'];
  if (lang === 'es') {
    agent.setPromptText('Eres un asistente de servicio al cliente amable.');
    agent.addLanguage({ name: 'Spanish', code: 'es-MX', voice: 'es-MX-Neural2-A' });
  }

  // Customize based on request headers
  const tier = headers['x-customer-tier'];
  if (tier === 'premium') {
    agent.updateGlobalData({ premium: true, max_refund: 1000 });
  }

  // Customize based on body data
  const callerId = bodyParams['caller_id_number'] as string;
  if (callerId) {
    const customer = await lookupCustomer(callerId);
    agent.updateGlobalData({ customer_name: customer.name });
  }
});
```

The callback signature:

```typescript
type DynamicConfigCallback = (
  queryParams: Record<string, string>,   // URL query parameters
  bodyParams: Record<string, unknown>,    // Parsed request body
  headers: Record<string, string>,        // HTTP headers
  agent: unknown,                         // Ephemeral AgentBase copy (cast as needed)
) => void | Promise<void>;
```

### SWAIG Query Parameters

Append custom query parameters to all SWAIG webhook URLs:

```typescript
agent.addSwaigQueryParams({ tenant: 'acme', region: 'us-east' });
```

---

## Post-Prompt and Summaries

The **post-prompt** is a separate prompt evaluated after the call ends. It is typically used to generate a structured summary of the conversation.

### Setting the Post-Prompt

```typescript
agent.setPostPrompt(`
Summarize this conversation as JSON with the following fields:
- "resolution": whether the issue was resolved (true/false)
- "category": the type of issue (billing, technical, general)
- "summary": a one-sentence summary of the call
`);
```

### Handling Summaries

Override the `onSummary` lifecycle hook to process the summary when it arrives:

```typescript
class MyAgent extends AgentBase {
  constructor() {
    super({ name: 'my-agent' });
  }

  async onSummary(
    summary: Record<string, unknown> | null,
    rawData: Record<string, unknown>,
  ): Promise<void> {
    if (summary) {
      console.log('Call summary:', summary);
      await saveToDatabase(summary);
    }
  }
}
```

### Post-Prompt LLM Parameters

You can use a different (often cheaper/faster) model for the post-prompt evaluation:

```typescript
agent.setPostPromptLlmParams({
  model: 'gpt-3.5-turbo',
  temperature: 0.0,
});
```

---

## Skills System

Skills are modular bundles of tools, prompt sections, hints, and global data that can be added to an agent with a single call:

```typescript
import { AgentBase, DateTimeSkill, MathSkill, WebSearchSkill } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'assistant' });

// Add skills with one-liners
await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());

// Add skills with custom parameters
await agent.addSkill(new WebSearchSkill({
  max_results: 3,
  safe_search: 'active',
}));
```

When `addSkill()` is called, the `SkillManager` validates environment variables, calls `setup()`, registers tools, merges hints and prompt sections, and merges global data.

See [skills_system.md](skills_system.md) for the full skills architecture reference.

---

## Multi-Agent Server

`AgentServer` hosts multiple `AgentBase` instances on a single HTTP server, each mounted at its own route prefix:

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

- **Agent listing**: If no agent is mounted at `/`, a GET to `/` returns a JSON listing of all registered agents and their routes.
- **Health endpoints**: `/health` and `/ready` return `{ "status": "ok" }` and `{ "status": "ready" }` respectively.
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, and `Referrer-Policy` are set on all responses.
- **CORS**: Enabled globally with `origin: *`.

### API

| Method | Description |
|--------|-------------|
| `register(agent, route?)` | Mount an agent at a route prefix. Throws if the route is already in use. |
| `unregister(route)` | Remove an agent registration. |
| `getAgents()` | Returns a `Map<string, AgentBase>` of all registered agents. |
| `getAgent(route)` | Look up an agent by route. |
| `getApp()` | Returns the underlying Hono application. |
| `run(host?, port?)` | Start the HTTP server. |

---

## Subclassing AgentBase

For reusable, self-contained agents, extend `AgentBase`:

```typescript
import { AgentBase, FunctionResult } from '@signalwire/sdk';

class RestaurantBot extends AgentBase {
  // Declarative prompt sections
  static PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a helpful restaurant reservation assistant for Bella Italia.',
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
    this.setParams({ temperature: 0.6 });

    // Must be called explicitly at the end of the constructor
    this.defineTools();
  }

  // Override to register tools
  protected defineTools(): void {
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
          `Confirmation number: ${id}.`,
        );
      },
    });
  }

  // Override the post-prompt summary hook
  async onSummary(summary: Record<string, unknown> | null): Promise<void> {
    if (summary) {
      await logReservationSummary(summary);
    }
  }

  // Override pre-execution hook for all tools
  async onFunctionCall(name: string, args: Record<string, unknown>): Promise<void> {
    console.log(`Tool invoked: ${name}`, args);
  }

  // Override basic auth validation
  validateBasicAuth(username: string, password: string): boolean {
    return username === 'admin' && password === process.env['ADMIN_PASSWORD']!;
  }
}
```

### Extension Points

| Method / Property | Purpose |
|-------------------|---------|
| `static PROMPT_SECTIONS` | Declarative prompt sections applied in the constructor. |
| `defineTools()` | Override to register tools. Call explicitly at the end of your constructor. |
| `onSummary(summary, rawData)` | Called when a post-prompt summary is received. |
| `onFunctionCall(name, args, rawData)` | Called before each tool handler executes. |
| `onSwmlRequest(rawData)` | Called on every SWML request before rendering. |
| `onDebugEvent(event)` | Called when a debug event webhook is received. |
| `validateBasicAuth(username, password)` | Override to add custom auth validation logic. |

---

## HTTP Endpoints

Each agent exposes the following HTTP endpoints (all relative to the agent's `route`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET / POST | `/` | Basic Auth | Returns the rendered SWML document. Triggers proxy detection and dynamic config callback. |
| GET / POST | `/swaig` | Basic Auth | SWAIG function dispatcher. Validates tokens for secure tools, calls `onFunctionCall`, executes the handler. |
| GET / POST | `/post_prompt` | Basic Auth | Receives post-prompt summary data. Extracts the summary and calls `onSummary`. |
| POST | `/debug_events` | Basic Auth | Receives debug event webhooks (when `enableDebugEvents()` is active). |
| GET | `/health` | None | Returns `{ "status": "ok" }`. |
| GET | `/ready` | None | Returns `{ "status": "ready" }`. |

---

## State Management

### Global Data

Global data is shared across all tool invocations within a call. Set initial data on the agent and update it dynamically from tool handlers:

```typescript
// Initial data
agent.setGlobalData({ company: 'Acme', tier: 'standard' });

// In a tool handler -- update data during the call
handler: async (args) => {
  return new FunctionResult('Verified.')
    .updateGlobalData({ verified: true });
}
```

### Session Metadata

The `SessionManager` provides per-session in-memory metadata storage:

```typescript
import { SessionManager } from '@signalwire/sdk';

const sm = new SessionManager();
sm.setSessionMetadata('session-1', { userId: 'u-42', plan: 'pro' });
const meta = sm.getSessionMetadata('session-1');
sm.deleteSessionMetadata('session-1');
```

---

## SIP Routing

Enable SIP-based routing to direct calls to specific agents based on the SIP username:

```typescript
const server = new AgentServer({ host: '0.0.0.0', port: 4000 });

// Register agents
server.register(salesAgent);
server.register(supportAgent);

// Map SIP usernames to agent routes
server.registerSipUsername('sales-line', '/sales');
server.registerSipUsername('support-line', '/support');
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port (used when `port` is not specified in `AgentOptions`). |
| `SWML_BASIC_AUTH_USER` | *(none)* | Basic auth username. Used when `basicAuth` is not provided in options. |
| `SWML_BASIC_AUTH_PASSWORD` | *(none)* | Basic auth password. Used when `basicAuth` is not provided in options. |
| `SWML_PROXY_URL_BASE` | *(none)* | External-facing base URL for webhook URLs (e.g., `https://agents.example.com`). |
| `SWML_PROXY_DEBUG` | `"false"` | Set to `"true"` to enable verbose logging of proxy/header detection. |
| `SWML_CORS_ORIGINS` | `"*"` | Comma-separated list of allowed CORS origins. |
| `SWML_ALLOWED_HOSTS` | *(none)* | Comma-separated list of allowed `Host` header values. |
| `SWML_MAX_REQUEST_SIZE` | `1048576` | Maximum request body size in bytes (default 1 MB). |
| `SWML_RATE_LIMIT` | *(none)* | Maximum requests per minute per IP address. |
| `SWML_REQUEST_TIMEOUT` | `30000` | Request timeout in milliseconds. |
| `SIGNALWIRE_LOG_LEVEL` | `"info"` | Logging level: `"debug"`, `"info"`, `"warn"`, `"error"`. |
| `SIGNALWIRE_LOG_MODE` | `"pretty"` | Log output format: `"pretty"` for human-readable, `"json"` for structured JSON. |
