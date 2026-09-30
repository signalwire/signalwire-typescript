/**
 * Extending agents (Lesson 5)
 *
 * A custom skill, per-call and persistent state, multi-step workflows,
 * external services, personas, prompt techniques and resilience helpers.
 * Persistent state uses node:sqlite, which needs Node.js 22.13 or later
 * (22.5 through 22.12 need the --experimental-sqlite flag).
 *
 * Run: npx tsx tutorial/multi_agents/extending_agents.ts
 */

import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import {
  AgentBase,
  FunctionResult,
  NativeVectorSearchSkill,
  SkillBase,
  getLogger,
  type ParameterSchemaEntry,
  type SkillPromptSection,
  type SkillToolDefinition,
} from '@signalwire/sdk';
import { loadKnowledge } from './knowledge.js';

const log = getLogger('extending_agents');

export const agent = new AgentBase({ name: 'Extended Agent', route: '/' });

// region: weather-skill
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
// endregion: weather-skill

// region: use-skill
// The skill refuses to load without WEATHER_API_KEY, so add it only when the key is set
if (process.env['WEATHER_API_KEY']) {
  await agent.addSkill(new WeatherSkill());
} else {
  log.warn('WEATHER_API_KEY not set; the weather tools are not available');
}
// endregion: use-skill

// region: multiple-instances
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
// endregion: multiple-instances

// region: call-state
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
// endregion: call-state

// region: persistent-state
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
// endregion: persistent-state

// region: global-data
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
// endregion: global-data

// region: workflow
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
// endregion: workflow

// region: conditional
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
// endregion: conditional

// region: rest-api
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
// endregion: rest-api

// region: webhook
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
// endregion: webhook

// region: work-queue
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
// endregion: work-queue

// region: personas
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
// endregion: personas

// region: multilingual
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
// endregion: multilingual

// region: reasoning
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
// endregion: reasoning

// region: switch-context
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
// endregion: switch-context

// region: retry
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
// endregion: retry

// region: circuit-breaker
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
// endregion: circuit-breaker

// region: factory
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
// endregion: factory

// Start the server only when this file is run, not when it's imported
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await agent.run();
}
