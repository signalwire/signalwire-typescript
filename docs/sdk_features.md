# SignalWire AI Agents SDK: Why the SDK, Not Raw SWML

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const agent: import('@signalwire/sdk').AgentBase;
  const FunctionResult: typeof import('@signalwire/sdk').FunctionResult;
  const MyAgent: any; // illustrative user-defined AgentBase subclass
  const SalesAgent: any;
  const SupportAgent: any;
  const TriageAgent: any;
  const loadTenantConfig: (tenant: string) => any;
}
```

## The Problem with Raw SWML

SWML (SignalWire Markup Language) is a JSON document format that defines how an agent behaves during a call -- 30+ verbs, an AI verb with dozens of parameters, SWAIG (SignalWire AI Gateway) function definitions with JSON Schema, post-prompt URLs, webhook authentication, language arrays, pronunciation rules, hints, global data, contexts, steps, gather configs. Writing it by hand means constructing deeply nested JSON, manually building authenticated webhook URLs, hand-coding parameter schemas, and deploying separate webhook servers for your tools. Every agent becomes a bespoke JSON engineering project.

The SDK eliminates all of this. You write TypeScript. The SDK generates correct SWML, serves it over HTTP, and handles its own webhook callbacks -- all in one process, deployable to any platform.

---

## The Self-Referencing Pipeline

The SDK's core architectural insight is that the agent is both the **SWML generator** and the **SWAIG webhook handler** in a single stateless microservice.

```
SignalWire requests SWML → Agent generates document
  ↓
SWML contains webhook URLs → URLs point back to the agent itself
  ↓
AI calls a function → SignalWire POSTs to agent's /swaig endpoint
  ↓
Agent executes function locally → Returns result to AI
  ↓
Call ends → SignalWire POSTs analytics to agent's /post_prompt endpoint
```

The agent auto-detects its own public URL -- including behind ngrok, load balancers, API Gateway, or any reverse proxy (via `X-Forwarded-Host`, `Forwarded` header, or the `SWML_PROXY_URL_BASE` env var). It embeds Basic Auth credentials directly into the webhook URLs. It generates per-call security tokens for each secure function. The developer writes none of this:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port) — collides under the concurrent gate and cannot run standalone -->
```typescript
import { AgentBase, FunctionResult } from '@signalwire/sdk';

class WeatherAgent extends AgentBase {
  constructor() {
    super({ name: 'weather', route: '/weather' });
    this.promptAddSection('Role', { body: 'You help with weather.' });
  }

  protected override defineTools(): void {
    this.defineTool({
      name: 'get_weather',
      description: 'Get weather',
      parameters: {
        city: { type: 'string', description: 'City name' },
      },
      required: ['city'],
      handler: async (args) => {
        const city = args.city as string;
        // ... fetch weather ...
        return new FunctionResult(`72°F and sunny in ${city}`);
      },
    });
  }
}

const agent = new WeatherAgent();
await agent.run();
```

That's a complete agent: HTTP server, SWML generation, authenticated webhook routing, function execution, and response formatting. The generated SWML contains the full AI configuration, function schemas, and webhook URLs pointing back to the running process -- all computed automatically.

---

## Prompt Object Model (POM)

Raw SWML prompts are flat strings. The SDK provides structured prompt building:

```typescript
agent.promptAddSection('Role', { body: 'You are a travel booking assistant.' });
agent.promptAddSection('Rules', {
  bullets: [
    'Never make up flight information',
    'Always confirm before booking',
    'Use the search tool for real data',
  ],
});
agent.promptAddSection('Personality', { body: 'Friendly but professional.' });
```

POM sections are rendered into a format the LLM understands with proper hierarchy. You can add subsections (`promptAddSubsection`), append to existing sections (`promptAddToSection`), check if sections exist (`promptHasSection`), and compose prompts programmatically -- including from skills that inject their own sections.

---

## Tools: Three Ways

### 1. `defineTool` (Local Execution)

<!-- snippet: no-compile fragment from inside a subclass defineTools(); uses `this` and an illustrative `db` -->
```typescript
this.defineTool({
  name: 'lookup_order',
  description: 'Look up an order',
  parameters: {
    order_id: { type: 'string', description: 'Order identifier' },
  },
  required: ['order_id'],
  handler: async (args) => {
    const order = await db.get(args.order_id as string);
    const result = new FunctionResult(`Order ${order.id}: ${order.status}`);
    result.updateGlobalData({ current_order: order });
    return result;
  },
});
```

The SDK converts this into a SWAIG function definition with JSON Schema parameters, creates a secure webhook URL, routes inbound POST requests to the handler, parses arguments, and formats the response -- including the 40+ SWAIG actions (transfer, hold, context switch, toggle functions, etc.) that tools can return via `FunctionResult`.

When the `parameters` are written as a flat inline map (as above), TypeScript infers the
handler's `args` precisely -- `args.order_id` is typed `string`, required keys are present,
and an `enum` property narrows to its literal union. You can also register a typed handler
that receives named parameters with `defineTypedTool()`, which infers the schema from the
handler signature when no explicit `parameters` are provided.

### 2. DataMap (Server-Side Execution)

```typescript
import { DataMap, FunctionResult } from '@signalwire/sdk';

const dataMap = new DataMap('check_stock')
  .purpose('Check product stock levels')
  .parameter('sku', 'string', 'Product SKU', { required: true })
  .webhook('GET', 'https://api.warehouse.com/stock/${args.sku}')
  .output(new FunctionResult('Stock for ${args.sku}: ${response.quantity} units'));

agent.registerSwaigFunction(dataMap.toSwaigFunction());
```

DataMap tools execute on SignalWire's servers -- no webhook needed. The SDK generates the `data_map` structure in the SWML with variable expansion (`${args.*}`, `${response.*}`, `${global_data.*}`), foreach iteration, expression matching, and error handling. Your agent never receives the callback; SignalWire handles the entire API call. See the [DataMap Guide](datamap-guide.md) for the full builder API.

### 3. Skills (Packaged Integrations)

```typescript
import { WebSearchSkill, DateTimeSkill, MathSkill } from '@signalwire/sdk';

await agent.addSkill(new WebSearchSkill({ num_results: 5 }));
await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());
```

One call per skill. The skill auto-registers its tools, injects prompt sections, adds speech hints, and validates dependencies. No manual wiring. `addSkill()` takes a skill **instance** and is **async**.

---

## The Skills System

Skills are self-contained modules that package tools, prompts, hints, and configuration into a single `addSkill()` call. Each skill:

- Extends `SkillBase` and implements `getTools()` (and optional `setup()` for async init)
- Declares `REQUIRED_PACKAGES` and `REQUIRED_ENV_VARS` for dependency validation
- Returns SWAIG tool definitions from `getTools()`
- Can inject prompt sections via `getPromptSections()`
- Can provide speech hints via `getHints()`
- Can contribute global data via `getGlobalData()`
- Can support multiple instances with different configs (e.g., two search skills)

The SDK ships with **17 built-in skills** (matching the Python reference set): `DateTimeSkill`, `MathSkill`, `JokeSkill`, `WeatherApiSkill`, `PlayBackgroundFileSkill`, `SwmlTransferSkill`, `ApiNinjasTriviaSkill`, `InfoGathererSkill`, `WebSearchSkill`, `WikipediaSearchSkill`, `GoogleMapsSkill`, `DataSphereSkill`, `DataSphereServerlessSkill`, `NativeVectorSearchSkill`, `SpiderSkill`, `ClaudeSkillsSkill`, and `McpGatewaySkill`. Two additional TS-specific helper skills — `CustomSkillsSkill` and `AskClaudeSkill` — are also registered (see `PORT_ADDITIONS.md`).

The elegance is composability: skills don't know about each other, but they all register cleanly into the same agent. A single agent can combine web search, datetime, a custom booking tool, and a DataMap stock checker -- all declared up front, all generating correct SWML, all routed to the right handler. See the [Skills System Guide](skills-guide.md) for the full reference.

---

## Contexts and Steps: Priming the State Machine

The contexts/steps system lets you define structured workflows declaratively. Instead of hoping the LLM follows instructions about conversation flow, you mechanically enforce it:

```typescript
const ctx = agent.defineContexts();

const greeting = ctx.addContext('default');

greeting
  .addStep('welcome')
  .setText('Greet the user and ask how you can help.')
  .setValidSteps(['collect_info'])
  .setFunctions(['check_hours']); // Only this tool available here

greeting
  .addStep('collect_info')
  .setText("Collect the user's name and email.")
  .setStepCriteria('User has provided both name and email')
  .setValidSteps(['confirm']);

greeting
  .addStep('confirm')
  .setText('Confirm the information and say goodbye.')
  .setFunctions([]); // No tools -- just confirm and end
```

This generates SWML with a complete contexts/steps structure. The platform enforces navigation rules, restricts which functions are available at each step, and tracks transitions. The LLM can't skip steps, can't call restricted tools, and can't navigate to disallowed contexts -- not because it was told not to, but because the mechanisms don't exist in its world. This is PGI (Programmatically Governed Inference) in practice. See the [Contexts Guide](contexts-guide.md) for the full API.

**Multi-context** agents can define separate conversation modes (e.g., "sales" and "support") with isolated function sets, and control switching with valid-context rules.

---

## Programmatically Governed Inference (PGI)

The contexts/steps system is the SDK's implementation of a broader architectural discipline: **Programmatically Governed Inference**. PGI starts from a single design rule: *do not tell the AI anything it does not need to know.*

Current AI models are extraordinarily good at language -- understanding loosely phrased human input, mapping intent onto structured actions, and rendering system decisions back into natural speech. They are also inconsistent, non-deterministic, and prone to confident error. These are not bugs that will be fixed in the next model generation. They are properties of probabilistic inference itself. The industry's dominant response -- prompt harder and hope ("prompt and pray") -- treats the model as the brain of the system. PGI rejects this entirely. The model is not the brain. It is a controlled participant inside a deterministic system that was always in charge.

### The Four Layers

PGI is enforced through four layers of constraint, each operating independently. Only the first depends on the model's cooperation. The remaining three are mechanical.

**Layer 1: Semantic Constraints** -- The model receives a prompt describing its role and instructions for how to behave. This is the weakest layer; it depends on probabilistic compliance. PGI treats it as guidance, not enforcement.

**Layer 2: Schema Constraints** -- At each step, the model sees only the tools registered for that step. Tools belonging to other steps do not exist in its function schema. This is the difference between telling someone not to open a door and removing the door from the building.

**Layer 3: Transition Constraints** -- Each step defines which steps it can transition to. The platform validates every transition against this whitelist. The model cannot skip phases, loop back to completed steps, or jump to unreachable states.

**Layer 4: Execution Authority** -- When the model calls a tool, it is making a request, not issuing a command. The tool handler accesses authoritative state, applies business logic, and returns both a response for the model to speak and a set of actions for the platform to execute. The model does not update state. The platform does.

### PGI in Practice: Blackjack

<!-- snippet: no-compile illustrative step wiring with pseudo variables (betting/playing/lost/ctx) -->
```typescript
ctx.addContext('default'); // contexts/steps omitted for brevity

betting.setFunctions(['place_bet']).setValidSteps(['playing']);
playing.setFunctions(['hit', 'stand', 'double_down']).setValidSteps(['hand_complete']);
lost.setFunctions([]).setValidSteps([]);
```

During the betting step, the model can only call `place_bet`. It cannot deal cards, draw cards, or resolve hands because those functions are not in its schema. When the tool handler transitions to the playing step, `place_bet` disappears and `hit`, `stand`, `double_down` appear. The model's capabilities change not because it was told to behave differently, but because the available operations were mechanically replaced.

The `you_lost` step has zero functions and zero valid transitions. The game is over. The interaction is structurally complete.

The tool handler demonstrates execution authority -- the model has no idea a step change is about to happen:

<!-- snippet: no-compile fragment from inside a subclass defineTools(); uses `this`, `GameState`, `calculateHand` -->
```typescript
this.defineTool({
  name: 'hit',
  description: 'Draw a card.',
  parameters: {},
  handler: (args, rawData) => {
    const globalData = rawData.global_data as Record<string, unknown>;
    const game = globalData.game_state as GameState;
    const card = game.deck.pop()!;
    game.player_hand.push(card);
    const score = calculateHand(game.player_hand);

    const result = new FunctionResult(`You drew ${formatCard(card)}. Your total is ${score}.`);
    result.updateGlobalData({ game_state: game });

    if (score > 21) {
      result.swmlChangeStep('you_lost');
    }
    return result;
  },
});
```

The model speaks the result. The platform changes the step. The model's world changes without its participation.

### Why PGI, Not Guardrails

PGI produces a property that makes it fundamentally different from guardrails or output filtering: **the model does not know it is being governed.** It does not know that other tools exist elsewhere in the system. It sees its current world -- a prompt, a set of functions, a conversation history -- and operates within it. There is nothing to reason around, nothing to game, nothing to circumvent. The model makes the interaction natural. The software makes it correct.

---

## Deployment: One `run()` Call

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port) — collides under the concurrent gate and cannot run standalone -->
```typescript
const agent = new MyAgent();
await agent.run();
```

That single call auto-detects the environment and does the right thing:

| Environment | Detection | What Happens |
|-------------|-----------|--------------|
| **Standalone** | Default | Starts the Hono HTTP server via `@hono/node-server` |
| **AWS Lambda** | `AWS_LAMBDA_FUNCTION_NAME` / `_HANDLER` | Returns a Lambda-formatted response |
| **Google Cloud Functions** | `K_SERVICE` / `FUNCTION_TARGET` | Returns a GCF-compatible response |
| **Azure Functions** | `FUNCTIONS_WORKER_RUNTIME` | Returns an Azure HttpResponse |
| **CGI** | `GATEWAY_INTERFACE` | Reads stdin, writes stdout |

When a serverless environment (or an explicit `event`) is detected, `run()` dispatches to `runServerless(event, context, platform)`; otherwise it starts the HTTP server via `serve()`. For deterministic behavior, call `serve()` or `runServerless()` directly. You write one agent, deploy it anywhere.

For standalone mode, the SDK provides:
- Kubernetes health (`/health`) and readiness (`/ready`) probes
- SSL/TLS support via `SWML_SSL_ENABLED`, `SWML_SSL_CERT_PATH`, `SWML_SSL_KEY_PATH`
- CORS configuration via `SWML_CORS_ORIGINS`
- Optional debug events (`/debug_events`) via `enableDebugEvents()`

---

## Multi-Agent Hosting

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port) — collides under the concurrent gate and cannot run standalone -->
```typescript
import { AgentServer } from '@signalwire/sdk';

const server = new AgentServer({ host: '0.0.0.0', port: 3000 });
server.register(new SalesAgent(), '/sales');
server.register(new SupportAgent(), '/support');
server.register(new TriageAgent(), '/triage');
await server.run();
```

One process, multiple agents, route-based dispatch. Each agent gets its own SWML endpoint and SWAIG callback routing. SIP routing can map usernames to specific agents.

---

## Dynamic Configuration and Multi-Tenancy

```typescript
agent.setDynamicConfigCallback((queryParams, bodyParams, headers, ephemeralAgent) => {
  const tenant = headers['x-tenant-id'] ?? 'default';
  const config = loadTenantConfig(tenant);
  ephemeralAgent.promptAddSection('Company', { body: config.companyInfo });
  ephemeralAgent.setGlobalData({ tenant_id: tenant, tier: config.tier });
});
```

Each inbound request creates an **ephemeral copy** of the agent. The callback customizes it per-request -- different prompts, skills, global data, languages, tools. The original agent is unchanged. This enables multi-tenancy from a single deployment: one agent instance serves hundreds of tenants with tailored behavior.

---

## Document Search Skills

For in-process knowledge lookup, the SDK ships skills that index documents at runtime:

```typescript
import { NativeVectorSearchSkill } from '@signalwire/sdk';

await agent.addSkill(
  new NativeVectorSearchSkill({
    documents: [
      { id: 'faq-1', text: 'To reset your password, go to Settings > Security.' },
      { id: 'faq-2', text: 'Business hours are Monday-Friday, 9am-5pm EST.' },
    ],
  }),
);
```

`NativeVectorSearchSkill` performs in-memory TF-IDF-style word-overlap scoring over documents supplied via configuration -- no external dependencies or API keys. For platform-hosted semantic search, `DataSphereSkill` and `DataSphereServerlessSkill` query SignalWire DataSphere; `WikipediaSearchSkill` and `WebSearchSkill` cover web sources. See the [Skills System Guide](skills-guide.md).

---

## Prefab Agents

Production-ready patterns for common use cases:

```typescript
import { InfoGathererAgent, ReceptionistAgent } from '@signalwire/sdk';

// Collect structured data
const gatherer = new InfoGathererAgent({
  questions: [
    { key_name: 'name', question_text: 'What is your name?' },
    { key_name: 'issue', question_text: 'Describe your issue', confirm: true },
  ],
});

// Route calls to departments
const receptionist = new ReceptionistAgent({
  departments: [
    { name: 'Sales', number: '+15551234567', description: 'Product inquiries' },
    { name: 'Support', number: '+15559876543', description: 'Technical help' },
  ],
});
```

Five prefabs: **InfoGatherer**, **Survey**, **Receptionist**, **FAQ** (`FAQBotAgent`), and **Concierge**. Each generates complete SWML with appropriate prompts, tools, and workflows. You instantiate, customize, and deploy. See the [Prefabs Guide](prefabs-guide.md).

---

## AI Configuration

Everything the platform supports, the SDK exposes as methods:

```typescript
// LLM tuning
agent.setPromptLlmParams({ temperature: 0.3, top_p: 0.9, barge_confidence: 0.7 });

// Multi-language
agent.addLanguage({
  name: 'Spanish',
  code: 'es',
  voice: 'google.es-ES-Neural2-A',
  fillers: { thinking: ['Un momento...'] },
  functionFillers: { search: { es: ['Buscando...'] } },
});

// Speech recognition
agent.addHints(['SignalWire', 'SWML', 'SWAIG']);
agent.addPronunciation({ replace: 'SignalWire', with: 'Signal Wire' });

// Vision, thinking
agent.setParams({ enable_vision: true });
agent.setParams({ enable_thinking: true });

// Interruption control
agent.setParams({
  barge_match_string: '^(stop|cancel|nevermind)$',
  barge_min_words: 2,
  barge_confidence: 0.8,
});

// Native functions with custom fillers
agent.setNativeFunctions(['check_time', 'wait_for_user']);
agent.addInternalFiller('check_time', 'en-US', ['Let me check the time...']);

// Call flow verbs
agent.addPreAnswerVerb('play', { url: 'ringback.wav' });
agent.addPostAiVerb('hangup', {});
```

Call recording is configured via the constructor (`recordCall`, `recordFormat`, `recordStereo`):

<!-- snippet: no-run illustrative fragment: references the assumed `MyAgent` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const agent = new MyAgent({ name: 'recorded', recordCall: true, recordFormat: 'wav', recordStereo: true });
```

Each of these would otherwise require manually constructing the correct SWML JSON. The SDK provides named methods with proper defaults.

---

## swaig-test CLI

Test without deploying. The CLI lives at `src/cli/swaig-test.ts`; run it with `npx tsx`:

```bash
# List available tools
npx tsx src/cli/swaig-test.ts examples/my-agent.ts --list-tools

# Execute a specific tool
npx tsx src/cli/swaig-test.ts examples/my-agent.ts --exec get_weather --city "San Francisco"

# Dump generated SWML for inspection
npx tsx src/cli/swaig-test.ts examples/my-agent.ts --dump-swml
```

See the [CLI Guide](cli-guide.md) for the full set of flags.

---

## Authentication

The SDK handles auth automatically:

- **Auto-generated credentials:** If no env vars are set and none are passed, generates a random password that exists only in the process and logs a warning.
- **Environment variables:** `SWML_BASIC_AUTH_USER` / `SWML_BASIC_AUTH_PASSWORD`.
- **Constructor:** `basicAuth: [user, pass]`.
- **Embedded in URLs:** Webhook URLs include `user:pass@host` automatically.
- **Per-function tokens:** Secure functions get a `__token=...` query param with HMAC-signed expiry.

---

## What You'd Have to Build Without the SDK

| Capability | Without SDK | With SDK |
|-----------|-------------|----------|
| SWML document | Hand-craft JSON | Auto-generated from TypeScript |
| Webhook server | Build and deploy separately | Built into the agent process |
| URL routing | Manual Hono/Express setup | Automatic route registration |
| Auth tokens | Manual token system | Auto-generated per call/function |
| Proxy detection | Parse headers yourself | Automatic (ngrok, LB, CDN) |
| Tool schemas | Write JSON Schema by hand | `defineTool()` / `defineTypedTool()` |
| Serverless deploy | Platform-specific handler code | `agent.run()` auto-detects |
| Multi-language | Manually construct language arrays | `addLanguage()` one-liner |
| State machine | Manually build contexts JSON | Fluent `defineContexts()` API |
| Search/RAG | Build entire pipeline | `addSkill(new NativeVectorSearchSkill(...))` |
| Multi-agent | Separate deployments + router | `AgentServer` with route registration |
| Dynamic config | Custom middleware | `setDynamicConfigCallback()` |
| Post-call analytics | Parse raw webhook payload | `onSummary()` callback |
| Health checks | Manual endpoints | Built-in `/health` and `/ready` |
| Call recording | Manual SWML verb insertion | `recordCall: true` constructor option |
| SSL/TLS | Manual cert configuration | Env var driven |

The SDK turns what would be a multi-file infrastructure project into a single TypeScript class. The SWML is correct by construction. The webhooks route themselves. The auth is automatic. The deployment is universal. The developer focuses on what the agent should *do*, not how to wire it together.
