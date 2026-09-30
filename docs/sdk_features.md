# SignalWire AI Agents SDK: Why the SDK, Not Raw SWML

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const agent: import('@signalwire/sdk').AgentBase;
  const AgentBase: typeof import('@signalwire/sdk').AgentBase;
  const FunctionResult: typeof import('@signalwire/sdk').FunctionResult;
  const MyAgent: any; // illustrative user-defined AgentBase subclass
  const SalesAgent: any;
  const SupportAgent: any;
  const TriageAgent: any;
  const loadTenantConfig: (tenant: string) => any;
}
```

## The Problem with Raw SWML

SWML (SignalWire Markup Language) is a JSON document format that defines what happens during a call. The bundled SWML schema defines 39 verbs, and the `ai` verb alone has dozens of parameters. An AI agent's document also carries SWAIG (SignalWire AI Gateway) function definitions with JSON Schema, post-prompt URLs, webhook credentials and language arrays. It can also hold pronunciation rules, hints, global data, contexts, steps and gather configurations.

Writing it by hand means building nested JSON, assembling authenticated webhook URLs, writing parameter schemas, and running a separate webhook server for your tools. With the SDK, you write TypeScript. The SDK generates the SWML, serves it over HTTP, and handles its own webhook callbacks, all in one process.

---

## The Self-Referencing Pipeline

The agent is both the **SWML generator** and the **SWAIG webhook handler**, in a single microservice. A call moves through the pipeline in five steps:

1. SignalWire requests the SWML, and the agent generates the document.
2. The document's webhook URLs point back to the agent.
3. When the AI calls a function, SignalWire posts to the agent's `/swaig` endpoint.
4. The agent runs the function and returns the result to the AI.
5. When the call ends, SignalWire posts the post-prompt result to the agent's `/post_prompt` endpoint.

The agent builds its own public URL for the webhooks. Behind a proxy or tunnel, set `SWML_PROXY_URL_BASE`. Or set `SWML_TRUST_PROXY_HEADERS=true`, and the agent reads `X-Forwarded-Host`, `Forwarded` or `X-Original-Host`. It puts the basic-auth credentials in the webhook URLs, and a per-call token in the URL of each secure function. This agent needs none of that code:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
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

The class is a complete agent: an HTTP server, SWML generation, authenticated webhook routing and function execution. The generated SWML holds the AI configuration, the function schemas, and webhook URLs that point back to the running process.

---

## Prompt Object Model (POM)

Raw SWML prompts are strings. The SDK builds structured prompts from sections:

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

You can add subsections (`promptAddSubsection`), append to a section (`promptAddToSection`), and check whether a section exists (`promptHasSection`). Skills add their own sections the same way.

---

## Tools: Three Ways

### 1. `defineTool` (Local Execution)

`defineTool()` registers a handler that runs in the agent's process:

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

The SDK turns this into a SWAIG function definition with JSON Schema parameters. Tools are secure by default, so each one's webhook URL carries a per-call token. The SDK routes the POST requests to the handler, parses the arguments, and formats the response. A `FunctionResult` can also carry actions for the platform, such as a transfer, a hold, a context switch or a change to the active functions.

When `parameters` is a flat inline map, as in the example, TypeScript infers the handler's `args`. `args.order_id` is typed `string`, required keys are present, and an `enum` property narrows to its literal union. `defineTypedTool()` registers a handler that takes named parameters. Without explicit `parameters`, it infers the schema from the handler's source: its parameter names and default values.

### 2. DataMap (Server-Side Execution)

A DataMap tool declares an API call, and SignalWire's servers make it:

```typescript
import { DataMap, FunctionResult } from '@signalwire/sdk';

const dataMap = new DataMap('check_stock')
  .purpose('Check product stock levels')
  .parameter('sku', 'string', 'Product SKU', { required: true })
  .webhook('GET', 'https://api.warehouse.com/stock/${args.sku}')
  .output(new FunctionResult('Stock for ${input.args.sku}: ${quantity} units'));

agent.registerSwaigFunction(dataMap.toSwaigFunction());
```

The agent never receives a callback for a DataMap tool. The SDK writes the `data_map` structure into the SWML, and the platform expands its templates. `${args.*}` reads the arguments in the URL and params, and `${input.args.*}` in the webhook's output, where the response's fields are read from the root, such as `${quantity}`. The SDK also supports foreach iteration, expression matching and error keys. For the full builder API, see the [DataMap Guide](datamap-guide.md).

### 3. Skills (Packaged Integrations)

A skill packages tools, prompt sections and hints behind one `addSkill()` call:

```typescript
import { WebSearchSkill, DateTimeSkill, MathSkill } from '@signalwire/sdk';

await agent.addSkill(new WebSearchSkill({ num_results: 5 }));
await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());
```

The skill registers its tools, adds its prompt sections and speech hints, and checks its dependencies. `addSkill()` takes a skill **instance** and is **async**. `WebSearchSkill` reads its Google credentials from `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` when you don't pass `api_key` and `search_engine_id`.

---

## The Skills System

Skills are modules that package tools, prompt sections, hints and configuration. A skill has these parts:

- It extends `SkillBase`, and returns its tools from `getTools()` or registers them with `defineTool()`. An optional async `setup()` runs when the skill loads.
- It declares `REQUIRED_PACKAGES` and `REQUIRED_ENV_VARS`, which the skill manager checks at load time.
- It can add prompt sections by overriding `_getPromptSections()`.
- It can provide speech hints with `getHints()`, and global data with `getGlobalData()`.
- With `SUPPORTS_MULTIPLE_INSTANCES`, it can load more than once with different configurations, such as two search skills.

The SDK registers 19 built-in skills. Seventeen match the Python reference set: `DateTimeSkill`, `MathSkill`, `JokeSkill`, `WeatherApiSkill`, `PlayBackgroundFileSkill`, `SwmlTransferSkill`, `ApiNinjasTriviaSkill`, `InfoGathererSkill`, `WebSearchSkill`, `WikipediaSearchSkill`, `GoogleMapsSkill`, `DataSphereSkill`, `DataSphereServerlessSkill`, `NativeVectorSearchSkill`, `SpiderSkill`, `ClaudeSkillsSkill` and `McpGatewaySkill`. The other two, `CustomSkillsSkill` and `AskClaudeSkill`, are TypeScript additions (see `PORT_ADDITIONS.md`).

Skills don't know about each other, and they register into the same agent. One agent can combine web search, datetime, a custom booking tool and a DataMap stock checker. For the full reference, see the [Skills System Guide](skills-guide.md).

---

## Contexts and Steps: Priming the State Machine

Contexts and steps define a conversation's workflow declaratively. Each step lists the tools the model can use and the steps it can move to:

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
  .setFunctions('none') // Without this, the step keeps check_hours
  .setValidSteps(['confirm']);

greeting
  .addStep('confirm')
  .setText('Confirm the information and say goodbye.')
  .setFunctions([]); // No tools in this step
```

The SDK renders this as the SWML contexts structure. The platform offers the model only the tools and transitions each step lists. The model can't call a tool the step doesn't list, or move where the step doesn't allow. Those tools and transitions aren't offered to it. This is PGI (Programmatically Governed Inference) in practice. For the full API, see the [Contexts Guide](contexts-guide.md).

**Multi-context** agents can define separate conversation modes, such as `sales` and `support`, each with its own tools, and control switching with `setValidContexts()`.

---

## Programmatically Governed Inference (PGI)

Contexts and steps are the SDK's implementation of a broader discipline: **Programmatically Governed Inference**. PGI starts from one design rule: *don't tell the AI anything it doesn't need to know.*

Current AI models handle language well. They understand loosely phrased input, map intent onto structured actions, and turn system decisions back into natural speech. They're also inconsistent, non-deterministic and prone to confident error. These are properties of probabilistic inference, not bugs a later model generation will fix. A common response is to write longer prompts and hope the model follows them ("prompt and pray"). That treats the model as the brain of the system. PGI treats the model as one participant inside a deterministic system that stays in charge.

### The Four Layers

PGI works through four layers of constraint, each independent of the others. Only the first depends on the model's cooperation. The other three are mechanical.

**Layer 1: Semantic Constraints**. The model receives a prompt that describes its role and how to behave. This is the weakest layer, because it depends on the model complying. PGI treats it as guidance, not enforcement.

**Layer 2: Schema Constraints**. At each step, the model sees only the tools listed for that step. Tools that belong to other steps aren't in its function schema, so it can't call them.

**Layer 3: Transition Constraints**. Each step defines which steps the model may move to, and the platform offers the model only those. The model can't skip phases or jump to unreachable states. Trusted code can still move the conversation: a tool handler's `swmlChangeStep()` isn't limited by the list, so the application decides when a phase ends.

**Layer 4: Execution Authority**. A tool call from the model is a request. The tool handler reads authoritative state, applies business logic, and returns a response for the model and a set of actions for the platform to run. The model doesn't update state; the handler and the platform do.

### PGI in Practice: Blackjack

A blackjack dealer agent gives each phase of the game its own step and its own tools:

<!-- snippet: no-run illustrative fragment: references the assumed `agent` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const game = agent.defineContexts().addContext('default');

const betting = game.addStep('betting').setText("Take the player's bet.");
betting.setFunctions(['place_bet']).setValidSteps(['playing']);

const playing = game.addStep('playing').setText('Play the hand.');
playing.setFunctions(['hit', 'stand', 'double_down']).setValidSteps(['betting']);

const lost = game.addStep('you_lost').setText('Tell the player the game is over.');
lost.setFunctions('none');
```

During the betting step, the model can call only `place_bet`. It can't deal, draw or resolve hands, because those functions aren't in its schema. When the conversation moves to the playing step, `place_bet` goes away and `hit`, `stand` and `double_down` appear.

The `you_lost` step has no functions, and nothing in the flow leads out of it. A tool handler moves the conversation there, and the model has no part in that decision:

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

    const result = new FunctionResult(`The player drew ${formatCard(card)}. The total is ${score}.`);
    result.updateGlobalData({ game_state: game });

    if (score > 21) {
      result.swmlChangeStep('you_lost');
    }
    return result;
  },
});
```

The model gets the result as context and decides what to say. The platform changes the step.

### Why PGI, Not Guardrails

Under PGI, the model has no view of the governance. It isn't told that other tools exist elsewhere in the system. It sees its current prompt, its current functions and the conversation history, and works within them. There is no hidden rule for it to reason around. The model makes the interaction natural, and the software makes it correct.

---

## Deployment: One `run()` Call

`run()` picks the mode from the environment:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
const agent = new MyAgent();
await agent.run();
```

These are the environments it detects:

| Environment | Detection | What Happens |
|-------------|-----------|--------------|
| **Standalone** | Default | Starts the Hono HTTP server via `@hono/node-server` |
| **AWS Lambda** | `AWS_LAMBDA_FUNCTION_NAME` / `_HANDLER` | Returns a Lambda-formatted response |
| **Google Cloud Functions** | `K_SERVICE` / `FUNCTION_TARGET` | Returns a GCF-compatible response |
| **Azure Functions** | `FUNCTIONS_WORKER_RUNTIME` | Returns an Azure HTTP response |
| **CGI** | `GATEWAY_INTERFACE` | Reads stdin, writes stdout |

When it detects a serverless environment, or you pass an `event`, `run()` calls `runServerless(event, context, platform)`. Otherwise it starts the HTTP server with `serve()`. For a fixed mode, call `serve()` or `runServerless()` directly.

In standalone mode, the agent provides these:

- Health (`/health`) and readiness (`/ready`) endpoints, without auth
- CORS configuration through `SWML_CORS_ORIGINS`
- Debug events at `/debug_events`, after `enableDebugEvents()`

`AgentBase.serve()` serves HTTPS when `SWML_SSL_ENABLED`, `SWML_SSL_CERT_PATH` and `SWML_SSL_KEY_PATH` are set, and plain HTTP otherwise. A TLS-terminating proxy in front of the agent works too.

---

## Multi-Agent Hosting

`AgentServer` hosts several agents in one process:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
import { AgentServer } from '@signalwire/sdk';

const server = new AgentServer({ host: '0.0.0.0', port: 3000 });
server.register(new SalesAgent(), '/sales');
server.register(new SupportAgent(), '/support');
server.register(new TriageAgent(), '/triage');
await server.run();
```

Each agent gets its own SWML endpoint and SWAIG routes under its route. SIP routing can map usernames to specific agents.

---

## Dynamic Configuration and Multi-Tenancy

A dynamic config callback configures the agent for each request, for example per tenant:

```typescript
agent.setDynamicConfigCallback((queryParams, bodyParams, headers, copy) => {
  const tenant = headers['x-tenant-id'] ?? 'default';
  const config = loadTenantConfig(tenant);
  copy.promptAddSection('Company', { body: config.companyInfo });
  copy.setGlobalData({ tenant_id: tenant, tier: config.tier });
});
```

For each request, the SDK makes a per-request copy of the agent and passes it to the callback. The callback can give the copy its own prompt, global data, languages and tools. The SWML is rendered from the copy, and the `/swaig` and `/post_prompt` requests of the call run on it. The original agent isn't modified. One deployment can serve many tenants this way. `addPerCallConfig()` registers more callbacks that run on the same copy.

---

## Document Search Skills

`NativeVectorSearchSkill` indexes documents in the agent's process:

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

It scores the documents supplied in its configuration with in-memory TF-IDF, and needs no external service or API key. For search hosted by SignalWire, `DataSphereSkill` and `DataSphereServerlessSkill` query SignalWire DataSphere. `WikipediaSearchSkill` and `WebSearchSkill` search the web. For more, see the [Skills System Guide](skills-guide.md).

---

## Prefab Agents

Prefab agents package common patterns:

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

The SDK has five prefabs: `InfoGathererAgent`, `SurveyAgent`, `ReceptionistAgent`, `FAQBotAgent` and `ConciergeAgent`. Each generates SWML with its own prompts, tools and workflow. For more, see the [Prefabs Guide](prefabs-guide.md).

---

## AI Configuration

The SDK has methods for the `ai` verb's settings:

```typescript
// LLM sampling for the main prompt
agent.setPromptLlmParams({ temperature: 0.3, top_p: 0.9 });

// Multi-language
agent.addLanguage({
  name: 'Spanish',
  code: 'es',
  voice: 'google.es-ES-Neural2-A',
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
});

// Native functions with custom fillers
agent.setNativeFunctions(['check_time', 'wait_for_user']);
agent.addInternalFiller('check_time', 'en-US', ['Let me check the time...']);

// Call flow verbs
agent.addPreAnswerVerb('play', { url: 'https://cdn.example.com/ringback.wav', auto_answer: false });
agent.addPostAiVerb('hangup', {});
```

The constructor options `recordCall`, `recordFormat` and `recordStereo` add a `record_call` verb after the answer:

```typescript
const agent = new AgentBase({ name: 'recorded', recordCall: true, recordFormat: 'wav', recordStereo: true });
```

Without the SDK, each of these means writing the matching SWML JSON by hand.

---

## swaig-test CLI

`swaig-test` inspects and runs an agent without deploying it. In the repository, run it with `npx tsx src/cli/swaig-test.ts`:

```bash
# List available tools
npx tsx src/cli/swaig-test.ts examples/mcp-agent.ts --list-tools

# Execute a specific tool (options go before --exec; the function's arguments after it)
npx tsx src/cli/swaig-test.ts examples/mcp-agent.ts --exec get_weather --location "San Francisco"

# Dump generated SWML for inspection
npx tsx src/cli/swaig-test.ts examples/mcp-agent.ts --dump-swml
```

The `--exec` command prints the tool's result:

```text
RESULT:
Response: Currently 72F and sunny in San Francisco.
```

For the full set of options, see the [CLI Guide](cli-guide.md).

---

## Authentication

The SDK sets up authentication and request checks for you:

- **Basic auth**: from the `basicAuth` constructor option, a config file, or `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD`. With none of those, the SDK generates a password that exists only in the process, and logs a warning.
- **Credentials in URLs**: the webhook URLs include `user:password@host`, so SignalWire can call back.
- **Per-function tokens**: each secure function's URL gets a `__token` query parameter, an HMAC over the call, the function and an expiry. Set `SIGNALWIRE_SWAIG_SECRET` so tokens survive restarts and work across replicas.
- **Webhook signatures**: with a Signing Key (`signingKey` or `SIGNALWIRE_SIGNING_KEY`), the agent rejects POST requests without a valid SignalWire signature.

---

## What You'd Have to Build Without the SDK

This table compares the work with and without the SDK:

| Capability | Without SDK | With SDK |
|-----------|-------------|----------|
| SWML document | Hand-craft JSON | Generated from TypeScript |
| Webhook server | Build and deploy separately | Built into the agent process |
| URL routing | Manual Hono/Express setup | Automatic route registration |
| Auth tokens | Manual token system | Generated per call and function |
| Proxy URL | Build webhook URLs yourself | `SWML_PROXY_URL_BASE`, or trusted proxy headers |
| Tool schemas | Write JSON Schema by hand | `defineTool()` / `defineTypedTool()` |
| Serverless deploy | Platform-specific handler code | `agent.run()` detects the platform |
| Multi-language | Build language arrays by hand | `addLanguage()` |
| State machine | Build contexts JSON by hand | Fluent `defineContexts()` API |
| Search | Build the pipeline | `addSkill(new NativeVectorSearchSkill(...))` |
| Multi-agent | Separate deployments and a router | `AgentServer` with route registration |
| Dynamic config | Custom middleware | `setDynamicConfigCallback()` and `addPerCallConfig()` |
| Post-call analytics | Parse the raw webhook payload | `onSummary()` hook |
| Health checks | Manual endpoints | Built-in `/health` and `/ready` |
| Call recording | Insert the SWML verb by hand | `recordCall: true` constructor option |

With the SDK, an agent is one TypeScript class. You write what the agent does, and the SDK generates the SWML, routes the webhooks, and handles authentication and deployment.
