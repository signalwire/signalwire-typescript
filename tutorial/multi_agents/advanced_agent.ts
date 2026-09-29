/**
 * Advanced features (Lesson 4)
 *
 * One agent with the tools Lesson 4 walks through: parameters and required
 * arguments, results with actions, async handlers, error handling and
 * validation, logging, caching, input sanitization, secrets and rate limiting.
 *
 * Run: npx tsx tutorial/multi_agents/advanced_agent.ts
 */

// region: setup
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import { AgentBase, FunctionResult, getLogger } from '@signalwire/sdk';

const log = getLogger('advanced_agent');

export const agent = new AgentBase({ name: 'Advanced Features Agent', route: '/' });
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.marsh' });
// endregion: setup

// region: calculate-price
agent.defineTool({
  name: 'calculate_price',
  description: 'Calculate total price with tax',
  parameters: {
    amount: { type: 'number', description: 'Base price in dollars' },
    tax_rate: { type: 'number', description: 'Tax rate as a decimal (default 0.08)' },
  },
  required: ['amount'],
  handler: ({ amount, tax_rate = 0.08 }) => {
    const tax = amount * tax_rate;
    const total = amount + tax;
    return new FunctionResult(
      `The total price is $${total.toFixed(2)} ($${amount.toFixed(2)} + $${tax.toFixed(2)} tax)`,
    );
  },
});
// endregion: calculate-price

// region: create-order
agent.defineTool({
  name: 'create_order',
  description: 'Create a new order',
  parameters: {
    customer_name: { type: 'string', description: "Customer's full name" },
    items: { type: 'string', description: 'Items to order' },
    priority: {
      type: 'string',
      enum: ['normal', 'rush'],
      description: 'Order priority (default normal)',
    },
  },
  required: ['customer_name', 'items'],
  handler: ({ customer_name, items, priority = 'normal' }) =>
    new FunctionResult(`Order for ${customer_name} created: ${items} (${priority} priority)`),
});
// endregion: create-order

// region: parameter-types
agent.defineTool({
  name: 'quote_upgrade',
  description: 'Quote a component upgrade',
  parameters: {
    component: { type: 'string', description: 'The component to upgrade' },
    quantity: { type: 'integer', description: 'How many to install' },
    unit_price: { type: 'number', description: 'Price of one, in dollars' },
    installation: { type: 'boolean', description: 'Whether the store installs it' },
  },
  required: ['component', 'quantity', 'unit_price', 'installation'],
  handler: ({ component, quantity, unit_price, installation }) => {
    const labor = installation ? 50 : 0;
    const total = quantity * unit_price + labor;
    return new FunctionResult(`${quantity} x ${component}: $${total.toFixed(2)}`);
  },
});
// endregion: parameter-types

// region: check-inventory
agent.defineTool({
  name: 'check_inventory',
  description: 'Check product availability',
  parameters: {
    product_id: { type: 'string', description: 'The product ID to check' },
  },
  required: ['product_id'],
  handler: ({ product_id }) => {
    const inStock = product_id.startsWith('GPU') ? 5 : 0; // stands in for a real lookup
    if (inStock === 0) {
      return new FunctionResult(`Product ${product_id} is out of stock`);
    }
    // Keep the result in global data, where later function calls can read it
    return new FunctionResult(
      `Product ${product_id} is in stock (${inStock} units)`,
    ).updateGlobalData({ last_checked_product: product_id, stock_level: inStock });
  },
});
// endregion: check-inventory

// region: async-and-sync
// An async handler, for I/O: the event loop keeps serving other requests while it waits
agent.defineTool({
  name: 'fetch_product_reviews',
  description: 'Fetch the review count for a product from the review service',
  parameters: {
    product_id: { type: 'string', description: 'The product ID' },
  },
  required: ['product_id'],
  handler: async ({ product_id }) => {
    const base = process.env['REVIEWS_API_URL'];
    if (!base) return new FunctionResult('The review service is not configured.');
    const res = await fetch(`${base}/reviews/${encodeURIComponent(product_id)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return new FunctionResult('The review service is unavailable right now.');
    const reviews = (await res.json()) as unknown[];
    return new FunctionResult(`Found ${reviews.length} reviews for ${product_id}`);
  },
});

// A synchronous handler, for quick calculations
agent.defineTool({
  name: 'add_numbers',
  description: 'Add two numbers',
  parameters: {
    x: { type: 'integer', description: 'First number' },
    y: { type: 'integer', description: 'Second number' },
  },
  required: ['x', 'y'],
  handler: ({ x, y }) => new FunctionResult(`Result: ${x + y}`),
});
// endregion: async-and-sync

// region: process-order
class OrderError extends Error {}

agent.defineTool({
  name: 'process_order',
  description: 'Process customer order',
  parameters: {
    order_id: { type: 'string', description: 'The order ID to process' },
  },
  required: ['order_id'],
  handler: ({ order_id }) => {
    try {
      // Validate input
      if (order_id.length < 5) {
        return new FunctionResult('Invalid order ID format');
      }
      if (order_id.startsWith('TEST')) {
        throw new OrderError('Test orders cannot be processed');
      }
      return new FunctionResult(`Order ${order_id} processed successfully`);
    } catch (err) {
      if (err instanceof OrderError) {
        return new FunctionResult(`Order processing failed: ${err.message}`);
      }
      // Log unexpected errors, and tell the model only that something went wrong
      log.error('unexpected error processing order', { error: String(err) });
      return new FunctionResult('An unexpected error occurred. Please try again.');
    }
  },
});
// endregion: process-order

// region: error-prompt
agent.promptAddSection('Error Handling', {
  body: 'How to handle errors gracefully:',
  bullets: [
    'If a function returns an error, acknowledge it politely',
    'Offer alternative solutions when possible',
    'Never expose technical error details to customers',
    'Always maintain a helpful, professional tone',
  ],
});
// endregion: error-prompt

// region: update-customer
agent.defineTool({
  name: 'update_customer',
  description: 'Update customer information',
  parameters: {
    customer_id: { type: 'string', description: "The customer's ID" },
    email: { type: 'string', description: "Customer's email address" },
    phone: { type: 'string', description: "Customer's phone number" },
  },
  handler: ({ customer_id, email, phone }) => {
    // Collect every problem, and report them together
    const errors: string[] = [];
    if (!customer_id) errors.push('Customer ID is required');
    if (email && !email.includes('@')) errors.push('Invalid email format');
    if (phone && phone.replace(/\D/g, '').length < 10) {
      errors.push('Phone number must be at least 10 digits');
    }
    if (errors.length > 0) {
      return new FunctionResult(`Validation failed: ${errors.join(', ')}`);
    }
    return new FunctionResult('Customer updated successfully');
  },
});
// endregion: update-customer

// region: logging
agent.defineTool({
  name: 'normalize_part_number',
  description: 'Normalize a part number to upper case',
  parameters: {
    part_number: { type: 'string', description: 'The part number as the caller said it' },
  },
  required: ['part_number'],
  handler: ({ part_number }, rawData) => {
    log.debug('normalize_part_number called', { call_id: rawData.call_id, part_number });
    const normalized = part_number.trim().toUpperCase().replace(/\s+/g, '-');
    log.info('part number normalized', { normalized });
    return new FunctionResult(`The part number is ${normalized}`);
  },
});
// endregion: logging

// region: request-logging
// Runs on every request, on that request's copy of the agent. The headers
// arrive with the credential-bearing ones already removed.
agent.addPerCallConfig((query, body, headers) => {
  log.debug('request', {
    query,
    body_keys: Object.keys(body ?? {}),
    user_agent: headers['user-agent'],
  });
});
// endregion: request-logging

// region: debug-state
agent.defineTool({
  name: 'debug_state',
  description: 'Log the agent state',
  handler: (_args, _rawData, current) => {
    const state = {
      agent_name: current?.getName(),
      functions: current?.getTools().map((fn) => fn.name),
    };
    log.info('agent state', state);
    return new FunctionResult('State logged to console');
  },
});
// endregion: debug-state

// region: status-route
// A route of your own beside the agent's, outside its basic auth
const status = new Hono();
status.get('/', (c) =>
  c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    tools: agent.getTools().length,
    uptime_seconds: Math.round(process.uptime()),
  }),
);
agent.mount(status, { prefix: '/status' });
// endregion: status-route

// region: caching
// Stands in for a slow database or API call
async function lookupProduct(productId: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return `Product ${productId}: 16GB DDR5 memory kit`;
}

const productCache = new Map<string, { value: string; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

agent.defineTool({
  name: 'get_product_info',
  description: 'Get product information',
  parameters: {
    product_id: { type: 'string', description: 'The product ID to look up' },
  },
  required: ['product_id'],
  handler: async ({ product_id }) => {
    const cached = productCache.get(product_id);
    if (cached && cached.expires > Date.now()) {
      log.debug('cache hit', { product_id });
      return new FunctionResult(cached.value);
    }
    const info = await lookupProduct(product_id);
    productCache.set(product_id, { value: info, expires: Date.now() + CACHE_TTL_MS });
    return new FunctionResult(info);
  },
});
// endregion: caching

// region: concurrent
// Stand-ins for three independent services
const getOrders = async (id: string) => [`${id}-order-1`, `${id}-order-2`];
const getProfile = async (id: string) => ({ id, tier: 'gold' });
const getPreferences = async (id: string) => ({ id, contact: 'email' });

agent.defineTool({
  name: 'get_full_info',
  description: 'Get complete customer information',
  parameters: {
    customer_id: { type: 'string', description: 'The customer ID' },
  },
  required: ['customer_id'],
  handler: async ({ customer_id }) => {
    // The three lookups run at the same time, not one after another
    const [orders, profile, preferences] = await Promise.all([
      getOrders(customer_id),
      getProfile(customer_id),
      getPreferences(customer_id),
    ]);
    return new FunctionResult(
      `Found ${orders.length} orders for a ${profile.tier} customer who prefers ${preferences.contact}`,
    );
  },
});
// endregion: concurrent

// region: sanitize
const catalog = ['RTX 4070', 'RTX 4090', 'Ryzen 7 7700X', 'Z790 motherboard'];

agent.defineTool({
  name: 'safe_search',
  description: 'Search the product catalog',
  parameters: {
    query: { type: 'string', description: 'Search query' },
  },
  required: ['query'],
  handler: ({ query }) => {
    // Keep letters, digits, spaces and hyphens, and at most 100 characters
    const safeQuery = query
      .replace(/[^\w\s-]/g, '')
      .trim()
      .slice(0, 100);
    if (!safeQuery) return new FunctionResult('Invalid search query');
    const results = catalog.filter((item) => item.toLowerCase().includes(safeQuery.toLowerCase()));
    return new FunctionResult(`Found ${results.length} results: ${results.join(', ')}`);
  },
});
// endregion: sanitize

// region: secrets
// Read secrets from the environment, and never log them
const apiKey = process.env['PARTNER_API_KEY'];
if (!apiKey) log.warn('PARTNER_API_KEY not set');

agent.defineTool({
  name: 'check_partner_stock',
  description: 'Check stock at the partner warehouse',
  parameters: {
    sku: { type: 'string', description: 'The product SKU' },
  },
  required: ['sku'],
  handler: async ({ sku }) => {
    const base = process.env['PARTNER_API_URL'];
    if (!apiKey || !base) return new FunctionResult('The partner API is not configured.');
    log.info('calling partner API', { sku }); // the key stays out of the log
    const res = await fetch(`${base}/stock/${encodeURIComponent(sku)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return new FunctionResult(
      res.ok ? `Partner stock for ${sku}: ${await res.text()}` : 'Unable to check partner stock.',
    );
  },
});
// endregion: secrets

// region: rate-limit
// Calls per caller in the last minute. The caller comes from the request
// SignalWire sends, not from an argument the model fills in.
const callTimes = new Map<string, number[]>();
const LIMIT_PER_MINUTE = 10;

agent.defineTool({
  name: 'limited_function',
  description: 'A function each caller may run 10 times a minute',
  handler: (_args, rawData) => {
    const caller = rawData.caller_id_num ?? rawData.call_id ?? 'unknown';
    const now = Date.now();
    const recent = (callTimes.get(caller) ?? []).filter((t) => t > now - 60_000);
    if (recent.length >= LIMIT_PER_MINUTE) {
      callTimes.set(caller, recent);
      return new FunctionResult('Rate limit exceeded. Please try again later.');
    }
    recent.push(now);
    callTimes.set(caller, recent);
    return new FunctionResult('Function executed successfully');
  },
});
// endregion: rate-limit

// Start the server only when this file is run, not when it's imported
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await agent.run();
}
