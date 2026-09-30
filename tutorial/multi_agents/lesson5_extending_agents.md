# Lesson 5: Extending Your Agents

This lesson adds capabilities to an agent: a skill of your own, state, multi-step workflows, and connections to other services. The examples are one agent, `tutorial/multi_agents/extending_agents.ts`, and its tests are in `tests/tutorial/multi_agents-lessons.test.ts`.

## Table of Contents

1. [Creating custom skills](#creating-custom-skills)
2. [State management](#state-management)
3. [Complex conversation flows](#complex-conversation-flows)
4. [External service integration](#external-service-integration)
5. [Custom voice personas](#custom-voice-personas)
6. [Advanced prompt engineering](#advanced-prompt-engineering)
7. [Common patterns](#common-patterns)
8. [Summary](#summary)

---

## Creating custom skills

A skill packages tools, prompt sections, speech hints and setup into one class that any agent can add. The built-in skills, such as `native_vector_search` and `swml_transfer`, are written the same way.

### Basic skill structure

A skill extends `SkillBase`, and sets a name and a description. This one looks up the weather with the WeatherAPI.com service:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#weather-skill -->
```typescript
/** Current weather and forecasts from WeatherAPI.com. */
export class WeatherSkill extends SkillBase {
  static override SKILL_NAME = 'weather_lookup';
  static override SKILL_DESCRIPTION = 'Provides weather information and forecasts';
  static override SKILL_VERSION = '1.0.0';
  static override REQUIRED_ENV_VARS = ['WEATHER_API_KEY'] as const;

  private apiKey = '';
  private baseUrl = '';

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      base_url: {
        type: 'string',
        description: 'Base URL of the weather API',
        default: 'https://api.weatherapi.com/v1',
        required: false,
      },
    };
  }

  // Runs once when the skill is added. Returning false refuses the skill.
  override async setup(): Promise<boolean> {
    this.apiKey = process.env['WEATHER_API_KEY'] ?? '';
    this.baseUrl = this.getConfig<string>('base_url', 'https://api.weatherapi.com/v1');
    return this.apiKey !== '';
  }

  /** GET a path of the weather API, or null when it fails. */
  private async get(path: string, params: Record<string, string>): Promise<unknown> {
    const query = new URLSearchParams({ key: this.apiKey, ...params });
    const res = await fetch(`${this.baseUrl}${path}?${query}`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? res.json() : null;
  }

  override getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          location: { type: 'string', description: 'City or location name' },
        },
        required: ['location'],
        handler: async (args) => {
          const location = String(args['location']);
          const data = (await this.get('/current.json', { q: location })) as {
            current: { temp_f: number; condition: { text: string } };
          } | null;
          if (!data) return new FunctionResult(`Could not get weather for ${location}`);
          return new FunctionResult(
            `Current weather in ${location}: ${data.current.temp_f}°F, ${data.current.condition.text}`,
          );
        },
      },
      {
        name: 'get_forecast',
        description: 'Get weather forecast',
        parameters: {
          location: { type: 'string', description: 'City or location name' },
          days: { type: 'integer', description: 'Number of days to forecast (default 3)' },
        },
        required: ['location'],
        handler: async (args) => {
          const location = String(args['location']);
          const days = String(args['days'] ?? 3);
          const data = (await this.get('/forecast.json', { q: location, days })) as {
            forecast: {
              forecastday: {
                date: string;
                day: { maxtemp_f: number; mintemp_f: number; condition: { text: string } };
              }[];
            };
          } | null;
          if (!data) return new FunctionResult(`Could not get a forecast for ${location}`);
          const lines = data.forecast.forecastday.map(
            (d) => `${d.date}: ${d.day.condition.text}, ${d.day.mintemp_f}-${d.day.maxtemp_f}°F`,
          );
          return new FunctionResult(`Forecast for ${location}:\n${lines.join('\n')}`);
        },
      },
    ];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Weather',
        body: 'You can look up current weather and forecasts.',
        bullets: ['Use get_weather for current conditions, and get_forecast for the coming days'],
      },
    ];
  }
}
```

The parts do these jobs:

- `SKILL_NAME` and `SKILL_DESCRIPTION` are required, and the constructor throws without them.
- `REQUIRED_ENV_VARS` lists variables that must be set. Adding the skill fails when one is missing.
- `getParameterSchema()` describes the options the skill accepts. `getConfig()` reads them, with a default.
- `setup()` runs once, when the skill is added. Returning `false` refuses the skill.
- `getTools()` returns the tools, in the same shape `defineTool()` takes.
- `_getPromptSections()` returns prompt sections the skill adds to the agent's prompt.

### Using custom skills

Add a custom skill the same way as a built-in one, with an instance:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#use-skill -->
```typescript
// The skill refuses to load without WEATHER_API_KEY, so add it only when the key is set
if (process.env['WEATHER_API_KEY']) {
  await agent.addSkill(new WeatherSkill());
} else {
  log.warn('WEATHER_API_KEY not set; the weather tools are not available');
}
```

`addSkill()` rejects when a required variable is missing, so the file checks first. With `WEATHER_API_KEY` set, the tool answers from the live service:

```bash
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/extending_agents.ts --route / \
  --exec get_weather --location Austin
```

The result is the current weather:

```text
RESULT:
Response: Current weather in Austin: 88.2°F, Patchy rain nearby
```

To add a skill by name, register its class once with `SkillRegistry.getInstance().register(WeatherSkill)`, then call `agent.addSkillByName('weather_lookup')`. For more information, see [Creating Custom Skills](../../docs/skills-guide.md#creating-custom-skills) in the skills guide.

### Skill configuration

A skill that sets `SUPPORTS_MULTIPLE_INSTANCES` can be added more than once, with different options. `native_vector_search` tells its instances apart by `tool_name`:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#multiple-instances -->
```typescript
// Two instances of one skill, told apart by tool_name
const here = (name: string) => fileURLToPath(new URL(`./${name}`, import.meta.url));

await agent.addSkill(
  new NativeVectorSearchSkill({
    tool_name: 'search_products',
    description: 'Search product and build information',
    documents: loadKnowledge(here('sales_knowledge.md')),
    count: 3,
  }),
);
await agent.addSkill(
  new NativeVectorSearchSkill({
    tool_name: 'search_troubleshooting',
    description: 'Search troubleshooting guides',
    documents: loadKnowledge(here('support_knowledge.md')),
    count: 3,
  }),
);
```

The agent gets two tools, `search_products` and `search_troubleshooting`, each over its own documents.

## State management

An agent serves many calls at once, so state must be keyed by call, or stored where every process can reach it.

### Per-call state

Every SWAIG request carries the call's ID in `rawData.call_id`. Key per-call state by it, not by an argument the model fills in:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#call-state -->
```typescript
// Preferences for each call, keyed by the call ID SignalWire sends with every
// function call. This lives in one process's memory: a restart loses it.
const preferences = new Map<string, Map<string, string>>();

agent.defineTool({
  name: 'remember_preference',
  description: 'Remember a preference the customer states',
  parameters: {
    key: { type: 'string', description: 'Preference name, such as budget or color' },
    value: { type: 'string', description: 'Preference value' },
  },
  required: ['key', 'value'],
  handler: ({ key, value }, rawData) => {
    const callId = rawData.call_id ?? 'unknown';
    if (!preferences.has(callId)) preferences.set(callId, new Map());
    preferences.get(callId)!.set(key, value);
    return new FunctionResult(`I'll remember that your ${key} is ${value}`);
  },
});

agent.defineTool({
  name: 'recall_preference',
  description: 'Recall a preference the customer stated earlier in this call',
  parameters: {
    key: { type: 'string', description: 'Preference name to recall' },
  },
  required: ['key'],
  handler: ({ key }, rawData) => {
    const value = preferences.get(rawData.call_id ?? 'unknown')?.get(key);
    return new FunctionResult(
      value === undefined ? `I don't have your ${key} on record` : `Your ${key} is ${value}`,
    );
  },
});
```

The map lives in one process. It's lost on a restart, and a second replica can't see it. It also grows with every call, so a production version deletes a call's entry when the call ends. `agent.onCallEnd()` registers a handler that runs at hangup.

### Persistent state with a database

State that must outlive the process belongs in a database. Node's built-in `node:sqlite` needs no package. It needs Node.js 22.13 or later, or the `--experimental-sqlite` flag on 22.5 through 22.12:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#persistent-state -->
```typescript
// Interactions that outlive the process, in a SQLite file
const db = new DatabaseSync(process.env['INTERACTIONS_DB'] ?? 'interactions.db');
db.exec(`CREATE TABLE IF NOT EXISTS interactions (
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL
)`);

agent.defineTool({
  name: 'save_interaction',
  description: 'Save an interaction to the customer history',
  parameters: {
    customer_id: { type: 'string', description: 'Customer identifier' },
    interaction_type: { type: 'string', description: 'Type of interaction' },
    details: { type: 'string', description: 'Interaction details' },
  },
  required: ['customer_id', 'interaction_type', 'details'],
  handler: ({ customer_id, interaction_type, details }) => {
    db.prepare('INSERT INTO interactions VALUES (?, ?, ?, ?)').run(
      customer_id,
      interaction_type,
      details,
      new Date().toISOString(),
    );
    return new FunctionResult('Interaction saved successfully');
  },
});

agent.defineTool({
  name: 'get_history',
  description: 'Get customer interaction history',
  parameters: {
    customer_id: { type: 'string', description: 'Customer identifier' },
    limit: { type: 'integer', description: 'Max number of records (default 5)' },
  },
  required: ['customer_id'],
  handler: ({ customer_id, limit = 5 }) => {
    const rows = db
      .prepare(
        `SELECT type, details, timestamp FROM interactions
         WHERE customer_id = ? ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(customer_id, limit) as { type: string; details: string; timestamp: string }[];
    if (rows.length === 0) return new FunctionResult('No previous interactions found');
    const history = rows.map((r) => `- ${r.type} on ${r.timestamp}: ${r.details}`).join('\n');
    return new FunctionResult(`Previous interactions:\n${history}`);
  },
});
```

The `?` placeholders pass the arguments as parameters, so a caller's words can't change the SQL. `DatabaseSync` runs each query synchronously. That's fine for small, indexed queries. A slow query blocks every call the process is serving, so use a server database with an async client for heavy work. SQLite is a file on one machine: for several replicas, use a shared database.

The history survives between processes. Save an interaction, then read it back with a second run of `swaig-test`:

```bash
export INTERACTIONS_DB=/tmp/interactions.db
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/extending_agents.ts --route / \
  --exec save_interaction --customer_id C1 --interaction_type quote --details 'Quoted a $2000 gaming build'
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/extending_agents.ts --route / \
  --exec get_history --customer_id C1
```

The second run finds the row the first one wrote:

```text
RESULT:
Response: Previous interactions:
- quote on 2026-09-29T17:44:27.731Z: Quoted a $2000 gaming build
```

### Global data between function calls

Global data belongs to the call, and SignalWire keeps it. A result sets it with `updateGlobalData()`, and every later SWAIG request in the call carries it in `rawData.global_data`:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#global-data -->
```typescript
agent.defineTool({
  name: 'set_customer_data',
  description: 'Store a customer detail for the rest of the call',
  parameters: {
    key: { type: 'string', description: 'Detail name, such as name or email' },
    value: { type: 'string', description: 'Detail value' },
  },
  required: ['key', 'value'],
  handler: ({ key, value }) =>
    new FunctionResult(`Stored ${key}`).updateGlobalData({ [`customer_${key}`]: value }),
});

// A later function call receives the global data with its request
agent.defineTool({
  name: 'get_customer_data',
  description: 'Read a customer detail stored earlier in the call',
  parameters: {
    key: { type: 'string', description: 'Detail name' },
  },
  required: ['key'],
  handler: ({ key }, rawData) => {
    const value = rawData.global_data?.[`customer_${key}`];
    return new FunctionResult(value === undefined ? `No ${key} stored` : `${key}: ${value}`);
  },
});
```

Global data needs no storage of your own, and every replica sees it, because it arrives with the request.

## Complex conversation flows

Some tasks take several tool calls, in order.

### Multi-step workflows

An order starts, collects items, and is confirmed. Each step checks the state the one before it left:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#workflow -->
```typescript
// An order built over several function calls, one per call ID
interface Order {
  state: 'awaiting_items' | 'ready_to_confirm';
  items: { name: string; quantity: number; price: number }[];
}
const orders = new Map<string, Order>();
const PRICES: Record<string, number> = { 'RTX 4070': 549, 'Ryzen 7 7700X': 299, '32GB DDR5': 99 };

agent.defineTool({
  name: 'start_order',
  description: 'Start a new order',
  handler: (_args, rawData) => {
    orders.set(rawData.call_id ?? 'unknown', { state: 'awaiting_items', items: [] });
    return new FunctionResult('Order started. Ask the customer which items they want.');
  },
});

agent.defineTool({
  name: 'add_item',
  description: 'Add an item to the current order',
  parameters: {
    item: { type: 'string', enum: Object.keys(PRICES), description: 'Item name' },
    quantity: { type: 'integer', description: 'Quantity (default 1)' },
  },
  required: ['item'],
  handler: ({ item, quantity = 1 }, rawData) => {
    const order = orders.get(rawData.call_id ?? 'unknown');
    if (!order) return new FunctionResult('No active order. Start a new order first.');
    order.items.push({ name: item, quantity, price: PRICES[item] ?? 0 });
    order.state = 'ready_to_confirm';
    const list = order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    return new FunctionResult(`Added ${quantity}x ${item}. Current order: ${list}.`);
  },
});

agent.defineTool({
  name: 'confirm_order',
  description: 'Confirm and submit the current order',
  handler: (_args, rawData) => {
    const callId = rawData.call_id ?? 'unknown';
    const order = orders.get(callId);
    if (!order) return new FunctionResult('No active order');
    if (order.state !== 'ready_to_confirm') {
      return new FunctionResult('Add items before confirming');
    }
    const total = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    orders.delete(callId);
    return new FunctionResult(`Order confirmed. Total: $${total.toFixed(2)}`);
  },
});
```

The `enum` on `item` limits the model to products with a price. Each tool refuses to run out of order, and says why, so the model can recover. For workflows where the model must not skip a step, the SDK's contexts and steps limit which tools each step offers. For more information, see the [contexts guide](../../docs/contexts-guide.md).

### Conditional flows

A tool can report a fact that the prompt already says how to handle. The status goes to the model in the response, and into global data for later tools:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#conditional -->
```typescript
agent.promptAddSection('Conditional Responses', {
  body: 'Adapt your behavior based on context:',
  bullets: [
    'For new customers: Be extra welcoming and explain our services',
    'For VIP customers: Acknowledge their status and offer premium options',
    'For support issues: Show empathy and urgency',
    'For sales inquiries: Be enthusiastic and helpful',
  ],
});

const STATUSES: Record<string, string> = { C100: 'platinum', C200: 'standard' };

agent.defineTool({
  name: 'check_customer_status',
  description: 'Check customer status',
  parameters: {
    customer_id: { type: 'string', description: 'Customer identifier' },
  },
  required: ['customer_id'],
  handler: ({ customer_id }) => {
    const status = STATUSES[customer_id] ?? 'new';
    // The response tells the model the status, and the Conditional Responses
    // section says what to do with it. Global data keeps it for later tools.
    return new FunctionResult(`Customer status: ${status}`).updateGlobalData({
      customer_status: status,
      is_vip: status === 'platinum',
    });
  },
});
```

## External service integration

An agent often fronts other systems: an inventory service, an order system, a queue.

### REST API integration

A tool can call any HTTP API. Read the address and key from the environment, give the request a timeout, and turn every failure into a result the model can use:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#rest-api -->
```typescript
agent.defineTool({
  name: 'check_availability',
  description: 'Check product availability in the inventory service',
  parameters: {
    product_sku: { type: 'string', description: 'Product SKU to check' },
  },
  required: ['product_sku'],
  handler: async ({ product_sku }) => {
    const base = process.env['INVENTORY_API_URL'];
    const key = process.env['INVENTORY_API_KEY'];
    if (!base || !key) return new FunctionResult('The inventory service is not configured.');
    try {
      const res = await fetch(`${base}/inventory/${encodeURIComponent(product_sku)}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return new FunctionResult('Unable to check availability');
      const data = (await res.json()) as {
        in_stock: boolean;
        quantity: number;
        restock_date?: string;
      };
      return new FunctionResult(
        data.in_stock
          ? `Product ${product_sku} is in stock. Available quantity: ${data.quantity}`
          : `Product ${product_sku} is out of stock. Expected restock: ${data.restock_date ?? 'unknown'}`,
      );
    } catch (err) {
      log.error('inventory request failed', { error: String(err) });
      return new FunctionResult('Unable to check availability');
    }
  },
});
```

### Webhook integration

Other services can call the agent too. Mount a Hono app for their webhooks. A mounted app isn't behind the agent's basic auth, so check a shared secret of your own:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#webhook -->
```typescript
// Order updates from another service, on a route beside the agent's.
// A mounted app isn't behind the agent's basic auth: check a secret of your own.
const webhooks = new Hono();
webhooks.post('/order_update', async (c) => {
  const secret = process.env['ORDER_WEBHOOK_SECRET'];
  if (!secret || c.req.header('x-webhook-secret') !== secret) {
    return c.json({ error: 'forbidden' }, 403);
  }
  const { order_id, status } = await c.req.json<{ order_id: string; status: string }>();
  // Answer now, and do the work after the response is sent
  setImmediate(() => processOrderUpdate(order_id, status));
  return c.json({ status: 'received' });
});
agent.mount(webhooks, { prefix: '/webhook' });

export const orderUpdates: { order_id: string; status: string }[] = [];
function processOrderUpdate(orderId: string, status: string): void {
  log.info('order updated', { order_id: orderId, status });
  orderUpdates.push({ order_id: orderId, status });
}
```

`setImmediate()` runs the work after the response is sent, so the sender isn't kept waiting. The route answers `403` without the secret.

### Background work queue

Work that doesn't need to finish during the call, such as emailing a quote, can go on a queue. The tool returns as soon as the task is queued:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#work-queue -->
```typescript
// Work that should happen outside the call: a function queues it and returns,
// and a worker drains the queue. A deployment with several processes uses a
// shared queue (Redis, SQS) the same way.
interface Task {
  type: string;
  data: string;
  timestamp: string;
}
const taskQueue: Task[] = [];
export const completedTasks: Task[] = [];

agent.defineTool({
  name: 'queue_task',
  description: 'Queue a follow-up task, such as sending a quote by email',
  parameters: {
    task_type: { type: 'string', description: 'Type of task to queue' },
    data: { type: 'string', description: 'Task details' },
  },
  required: ['task_type', 'data'],
  handler: ({ task_type, data }) => {
    taskQueue.push({ type: task_type, data, timestamp: new Date().toISOString() });
    return new FunctionResult('Task queued for processing');
  },
});

const worker = setInterval(() => {
  const task = taskQueue.shift();
  if (!task) return;
  try {
    completedTasks.push(task); // do the real work here
  } catch (err) {
    log.error('task failed', { type: task.type, error: String(err) });
  }
}, 1000);
worker.unref(); // the worker alone doesn't keep the process running
```

An in-memory queue loses its tasks on a restart. When a task must not be lost, use a queue service that stores it.

## Custom voice personas

A persona is a voice and a speaking style. The same agent can take a different persona per call.

### Choosing a persona per request

A per-call configuration callback sets the voice and adds a style section on the request's copy of the agent. The SWML URL chooses the persona, for example `https://agents.example.com/?persona=professional`:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#personas -->
```typescript
// A persona per request, chosen by a query parameter: ?persona=professional
const PERSONAS = {
  professional: { voice: 'rime.cove', style: 'formal and precise', pace: 'measured' },
  friendly: { voice: 'rime.marsh', style: 'warm and conversational', pace: 'relaxed' },
  energetic: { voice: 'rime.spore', style: 'enthusiastic and upbeat', pace: 'quick' },
};
type PersonaName = keyof typeof PERSONAS;

agent.addPerCallConfig((query, _body, _headers, copy) => {
  const name: PersonaName =
    query['persona'] && query['persona'] in PERSONAS
      ? (query['persona'] as PersonaName)
      : 'friendly';
  const persona = PERSONAS[name];
  copy.setLanguages([{ name: 'English', code: 'en-US', voice: persona.voice }]);
  copy.promptAddSection('Voice Style', {
    body: `Speak in a ${persona.style} manner at a ${persona.pace} pace`,
  });
});
```

`setLanguages()` replaces the language list instead of adding to it, and the copy is discarded after the request. Calling `addLanguage()` and `promptAddSection()` on the agent itself each time would add a second English entry and a second style section to every later call.

### Multilingual support

Call `addLanguage()` once for each language the agent speaks:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#multilingual -->
```typescript
export const multilingual = new AgentBase({ name: 'Multilingual Agent', route: '/multilingual' });

multilingual.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.marsh' });
multilingual.addLanguage({ name: 'Spanish', code: 'es-MX', voice: 'rime.marsh' });
multilingual.addLanguage({ name: 'French', code: 'fr-FR', voice: 'rime.marsh' });

multilingual.promptAddSection('Language Instructions', {
  body: 'Adapt your communication style to the selected language:',
  bullets: [
    'English: Professional but friendly American business style',
    'Spanish: Warm and personable Latin American style',
    'French: Polite and formal French business etiquette',
  ],
});
```

This second agent is at `/multilingual`, so `swaig-test --route /multilingual` selects it.

## Advanced prompt engineering

Prompt structure changes how reliably the model follows it.

### Structured reasoning

A section can lay out the steps for the model to follow. `numberedBullets` numbers them in the prompt:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#reasoning -->
```typescript
agent.promptAddSection('Reasoning Framework', {
  body: 'Follow this structured approach for complex requests:',
  bullets: [
    'Understand: Clarify what the customer is asking for',
    'Analyze: Break down the request into components',
    'Plan: Determine the best approach to help',
    'Execute: Take action using available tools',
    'Verify: Confirm the solution meets their needs',
  ],
  numberedBullets: true,
});

agent.promptAddSection('Decision Criteria', {
  body: 'When making recommendations, consider:',
  bullets: [
    "Customer's stated requirements",
    'Budget constraints',
    'Technical compatibility',
    'Future scalability',
    'Best value proposition',
  ],
});
```

### Changing the prompt during a call

`switchContext()` replaces the system prompt from a tool result, for the rest of the call. It replaces the whole prompt, so pass all of it, not only the part that changes:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#switch-context -->
```typescript
agent.defineTool({
  name: 'set_explanation_mode',
  description: 'Change how the agent explains things for the rest of the call',
  parameters: {
    mode: {
      type: 'string',
      enum: ['technical', 'simple', 'sales'],
      description: 'Explanation mode',
    },
  },
  required: ['mode'],
  handler: ({ mode }) => {
    const base = 'You are a helpful assistant for our PC products.';
    const modes = {
      technical: 'Provide detailed technical explanations.',
      simple: 'Explain everything in simple, non-technical terms.',
      sales: 'Focus on benefits and value proposition.',
    };
    // switchContext replaces the whole system prompt, so pass all of it
    return new FunctionResult(`Switching to ${mode} mode`).switchContext({
      systemPrompt: `${base} ${modes[mode]}`,
    });
  },
});
```

With only a system prompt, the action is `{ "context_switch": "<the prompt>" }`. `switchContext()` also takes `userPrompt`, `consolidate` and `fullReset`. For more information, see the [SWAIG reference](../../docs/swaig-reference.md).

## Common patterns

These helpers make calls to other services more robust. The tests exercise both.

### Retry pattern

Retry a failure that may be temporary, with a delay that doubles each time:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#retry -->
```typescript
/** Run `fn`, retrying a failure with a delay that doubles each time. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  initialDelayMs = 1000,
): Promise<T> {
  let delay = initialDelayMs;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      log.warn('attempt failed, retrying', { attempt, delay_ms: delay, error: String(err) });
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}
```

Keep the total wait short in a tool. The caller is waiting on the line.

### Circuit breaker pattern

When a dependency keeps failing, stop calling it for a while, so each call fails fast instead of waiting for a timeout:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#circuit-breaker -->
```typescript
/** Stops calling a failing dependency until `resetTimeoutMs` has passed. */
export class CircuitBreaker {
  private failureCount = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 60_000,
  ) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.openedAt !== null) {
      if (Date.now() - this.openedAt < this.resetTimeoutMs) {
        throw new Error('Circuit breaker is open');
      }
      this.openedAt = null; // try the dependency again
      this.failureCount = 0;
    }
    try {
      const result = await fn();
      this.failureCount = 0;
      return result;
    } catch (err) {
      this.failureCount += 1;
      if (this.failureCount >= this.failureThreshold) {
        this.openedAt = Date.now();
        log.error('circuit breaker opened after repeated failures');
      }
      throw err;
    }
  }
}
```

Wrap a call as `await breaker.call(() => fetch(url))`, and turn the error into a result that tells the model the service is down.

### Factory pattern for agents

A factory builds agents from a plain configuration, which can come from a file or a database:

<!-- snippet: no-compile a region of tutorial/multi_agents/extending_agents.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/extending_agents.ts#factory -->
```typescript
/** The kinds of agent the factory can build, and what makes each one different. */
const AGENT_TYPES = {
  sales: { name: 'Sales Agent', route: '/sales', role: 'You are Morgan, a PC sales specialist.' },
  support: {
    name: 'Support Agent',
    route: '/support',
    role: 'You are Sam, a PC support specialist.',
  },
  triage: { name: 'Triage Agent', route: '/', role: 'You are Alex, the front desk assistant.' },
};

interface AgentConfig {
  skills?: SkillBase[];
  languages?: { name: string; code: string; voice?: string }[];
}

/** Build and configure an agent of one of the known types. */
export async function createAgent(type: string, config: AgentConfig = {}): Promise<AgentBase> {
  if (!(type in AGENT_TYPES)) throw new Error(`Unknown agent type: ${type}`);
  const spec = AGENT_TYPES[type as keyof typeof AGENT_TYPES];

  const created = new AgentBase({ name: spec.name, route: spec.route });
  created.promptAddSection('AI Role', { body: spec.role });
  for (const skill of config.skills ?? []) await created.addSkill(skill);
  for (const language of config.languages ?? []) created.addLanguage(language);
  return created;
}
```

`createAgent('sales', { skills: [...], languages: [...] })` returns a configured agent, ready to register on an `AgentServer`.

## Summary

This tutorial went from a single agent to a multi-agent system with search, custom tools, and now custom skills and state. This lesson covered these topics:

- Creating custom skills with options, setup and required variables
- Keeping per-call state by call ID, persistent state in SQLite, and call state in global data
- Building workflows that span several tool calls
- Calling external APIs, and accepting webhooks and queued work
- Choosing personas per request, and speaking several languages
- Structuring prompts, and replacing the prompt during a call
- Retries, circuit breakers and agent factories

### Where to go next

These steps build on what you have:

1. **Build your own agent**: start with one use case and a few tools, and grow it.
2. **Share a skill**: package a skill for other agents. For more information, see [Third-Party Skills](../../docs/third_party_skills.md).
3. **Measure**: time your tools, and fix the slowest first.
4. **Deploy**: put the agents in production with Lesson 4's checklist.
5. **Iterate**: listen to real calls, and improve the prompts and tools.

### Resources for continued learning

These resources cover the SDK and the platform:

- [SignalWire documentation](https://signalwire.com/docs)
- The SDK's guides, starting with the [agent guide](../../docs/agent-guide.md)
- The SDK's runnable examples, in [`examples/`](../../examples/README.md)

### Final tips

Keep these in mind as you build:

- Start small and iterate
- Test tools before you place a call
- Monitor agents in production
- Keep your dependencies up to date
- Document the skills you write

This completes the tutorial. Build on Morgan, Alex and Sam, or start a new agent from what you've learned.

---

[Previous: Lesson 4 - Advanced Features](lesson4_advanced_features.md) | [Tutorial Overview](README.md)
