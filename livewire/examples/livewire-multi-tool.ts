/**
 * Example: LiveWire agent with multiple function tools and RunContext.
 *
 * Demonstrates registering several tools on an agent and using RunContext
 * to access session state.  Mirrors a typical @livekit/agents-js pattern.
 *
 * Run:
 *   npx tsx livewire/examples/livewire-multi-tool.ts
 *
 * Then point a SignalWire phone number at http://your-host:3000/
 */

import {
  Agent,
  AgentSession,
  tool,
  defineAgent,
  runApp,
  type RunContext,
  type JobContext,
} from '../../src/livewire/index.js';

// Tool 1: Check order status
const checkOrder = tool({
  description: 'Check the status of a customer order',
  parameters: {
    type: 'object',
    properties: {
      order_id: { type: 'string', description: 'The order ID to check, e.g. ORD-12345' },
    },
    required: ['order_id'],
  },
  execute: (params: { order_id: string }, context: { ctx: RunContext }) => {
    console.log(`[tool] check_order called with: ${params.order_id}`);
    const delivery = new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString();
    return `Order ${params.order_id} is currently in transit. Expected delivery: ${delivery}`;
  },
});

// Tool 2: Product lookup
const lookupProduct = tool({
  description: 'Search for product information',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Product name or keyword to search for' },
    },
    required: ['query'],
  },
  execute: (params: { query: string }) => {
    console.log(`[tool] lookup_product called with: ${params.query}`);
    return (
      `Found 3 products matching '${params.query}': ` +
      '1) Acme Widget Pro ($29.99) ' +
      '2) Acme Widget Lite ($14.99) ' +
      '3) Acme Widget Bundle ($39.99)'
    );
  },
});

// Tool 3: Schedule callback
const scheduleCallback = tool({
  description: 'Schedule a callback from a human agent',
  execute: () => {
    const callbackTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString();
    return `Callback scheduled for ${callbackTime}. An agent will call you back.`;
  },
});

// Tool 4: Escalate to human
const escalate = tool({
  description: 'Escalate the call to a human agent',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Reason for escalation' },
    },
    required: ['reason'],
  },
  execute: (params: { reason: string }) => {
    const reason = params.reason.toLowerCase();
    let department = 'general support';
    if (reason.includes('billing')) department = 'billing';
    else if (reason.includes('technical')) department = 'technical support';
    return `Transferring you to ${department}. Please hold.`;
  },
});

const agentDef = defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const session = new AgentSession({
      llm: 'openai/gpt-4',
    });

    const agent = new Agent({
      instructions:
        'You are a helpful customer support agent for Acme Corp. ' +
        'You can check order status, look up product information, ' +
        'and schedule callbacks. Be concise and helpful.',
      tools: {
        check_order: { ...checkOrder, name: 'check_order' },
        lookup_product: { ...lookupProduct, name: 'lookup_product' },
        schedule_callback: { ...scheduleCallback, name: 'schedule_callback' },
        escalate: { ...escalate, name: 'escalate' },
      },
    });

    await session.start({ agent });
    session.generateReply({
      instructions: 'Welcome the caller to Acme Corp support. Ask how you can help them today.',
    });
  },
});

runApp(agentDef);
