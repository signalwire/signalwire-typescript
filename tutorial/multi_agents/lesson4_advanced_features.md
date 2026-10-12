# Lesson 4: Advanced Features and Best Practices

This lesson covers what an agent needs before it takes real calls: SWAIG functions that do real work, error handling, logging, testing, deployment, performance and security. Its examples are the tools of one agent, `tutorial/multi_agents/advanced_agent.ts`, and the deployment files for the Lesson 3 system.

## Table of Contents

1. [Custom SWAIG functions](#custom-swaig-functions)
2. [Error handling and results](#error-handling-and-results)
3. [Logging and debugging](#logging-and-debugging)
4. [Production deployment](#production-deployment)
5. [Testing strategies](#testing-strategies)
6. [Performance optimization](#performance-optimization)
7. [Security best practices](#security-best-practices)
8. [Summary](#summary)

---

## Custom SWAIG functions

A SWAIG function is a tool the AI can call during a call. SignalWire sends the call to the agent's `/swaig` route with the arguments the model chose, and the agent runs the tool's handler. The handler can call an API, query a database or calculate, and returns a `FunctionResult` that tells the model what happened.

### Basic function structure

The file starts with the agent and a logger:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#setup -->
```typescript
import { pathToFileURL } from 'node:url';
import { Hono } from 'hono';
import { AgentBase, FunctionResult, getLogger } from '@signalwire/sdk';

const log = getLogger('advanced_agent');

export const agent = new AgentBase({ name: 'Advanced Features Agent', route: '/' });
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.marsh' });
```

`defineTool()` registers a tool with a name, a description, its parameters and a handler. This one calculates a price with tax:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#calculate-price -->
```typescript
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
```

The model reads the description and the parameter descriptions to decide when to call the tool and what to pass, so write them for the model. The handler receives the arguments as its first parameter, and TypeScript infers their types from `parameters` and `required`. `amount` is a `number`. `tax_rate` is a `number` or `undefined`, so the default applies when the model leaves it out.

### Required parameters

List the parameters the model must always pass in `required`. An `enum` limits a string to the values you list:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#create-order -->
```typescript
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
```

### Parameter types

A parameter's `type` is a JSON Schema type. These four cover most tools:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#parameter-types -->
```typescript
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
```

`integer` and `number` arrive as JavaScript numbers, and `boolean` as `true` or `false`. The model produces the arguments, so a handler that needs a value in a range should still check it.

### Results with actions

A `FunctionResult` carries the text the model reads, and optionally actions for SignalWire to run. `updateGlobalData()` adds a `set_global_data` action, which stores values for the rest of the call:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#check-inventory -->
```typescript
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
```

Every later SWAIG request in the call carries the stored values in its `global_data`. For the full list of actions, see the [SWAIG reference](../../docs/swaig-reference.md).

### Async and sync handlers

A handler can be `async`, and the SDK awaits it. Use `async` for I/O, such as an HTTP request. Keep synchronous handlers for quick work, because a long synchronous calculation blocks every other call the process is serving:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#async-and-sync -->
```typescript
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
```

`AbortSignal.timeout()` stops a request that hangs. The model is waiting on the caller's behalf, so give external calls a short timeout.

## Error handling and results

A tool that fails should still tell the model what happened, so the model can tell the caller.

### Function error handling

Catch the errors you expect, and describe them in the result. Log the ones you don't:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#process-order -->
```typescript
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
```

A handler that throws doesn't take the agent down. The SDK logs the error and answers the model with "Sorry, I couldn't complete that action. Please try again or contact support if the issue persists." A result you write says more about what went wrong.

### Agent-level error handling

The prompt can tell the model how to talk about a failure:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#error-prompt -->
```typescript
agent.promptAddSection('Error Handling', {
  body: 'How to handle errors gracefully:',
  bullets: [
    'If a function returns an error, acknowledge it politely',
    'Offer alternative solutions when possible',
    'Never expose technical error details to customers',
    'Always maintain a helpful, professional tone',
  ],
});
```

### Validation patterns

Collect every validation problem, then report them together, so the model can ask for all the corrections at once:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#update-customer -->
```typescript
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
```

Called with an invalid email and a short phone number, the tool reports all three problems:

```bash
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/advanced_agent.ts \
  --exec update_customer --email nope --phone 555
```

The result lists them in one sentence:

```text
RESULT:
Response: Validation failed: Customer ID is required, Invalid email format, Phone number must be at least 10 digits
```

## Logging and debugging

Logs are how you find out what an agent did on a call you weren't on.

### Using the logger

`getLogger(name)` returns the SDK's structured logger. Each call takes a message and an object of fields, and the fields are printed as `key=value`. A handler's second parameter, `rawData`, is the whole SWAIG request, with the call ID:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#logging -->
```typescript
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
```

### Log levels

The SDK reads `SIGNALWIRE_LOG_LEVEL`: `debug`, `info` (the default), `warn` or `error`. Set it when you start the agent:

```bash
SIGNALWIRE_LOG_LEVEL=debug npx tsx tutorial/multi_agents/advanced_agent.ts
```

Set `SIGNALWIRE_LOG_MODE=off` to turn logging off, as tests often do. `new AgentServer()` sets the level from its `logLevel` option, so `pc_builder.ts` passes `SIGNALWIRE_LOG_LEVEL` through to it.

### Debugging techniques

These four techniques cover most debugging.

**1. Request logging.** A per-call configuration callback sees every request before the agent handles it:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#request-logging -->
```typescript
// Runs on every request, on that request's copy of the agent. It logs names,
// not values: the query can carry a SWAIG token, and the body caller data.
agent.addPerCallConfig((query, body, headers) => {
  log.debug('request', {
    query_keys: Object.keys(query),
    body_keys: Object.keys(body ?? {}),
    user_agent: headers['user-agent'],
  });
});
```

**2. SWML and tool inspection.** `swaig-test` prints the SWML, and runs a tool with the arguments you give it:

```bash
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/advanced_agent.ts --dump-swml
npx tsx src/cli/swaig-test.ts tutorial/multi_agents/advanced_agent.ts --exec calculate_price --amount 100
```

Put `swaig-test`'s own options, such as `--verbose`, before `--exec`. Everything after the tool name is an argument to the tool. With `SIGNALWIRE_LOG_LEVEL=debug` and `--verbose`, the part-number tool shows the request logging and the tool's own lines:

```bash
SIGNALWIRE_LOG_LEVEL=debug npx tsx src/cli/swaig-test.ts tutorial/multi_agents/advanced_agent.ts \
  --verbose --exec normalize_part_number --part_number 'cx 4090 b'
```

This excerpt shows the lines the file logs. The SDK's own lines, and the full request, are left out:

```text
[DEBUG] [advanced_agent] request query_keys=["__token"] body_keys=["call_id","call","vars","params",...]
[DEBUG] [advanced_agent] normalize_part_number called call_id=82c4c94d-a7dd-4a07-9a5b-9b9edb33e3a0 part_number="cx 4090 b"
[INFO] [advanced_agent] part number normalized normalized=CX-4090-B
```

**3. Agent state.** A handler's third parameter is the agent handling the request. With a per-call configuration callback, that's the request's configured copy:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#debug-state -->
```typescript
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
```

**4. The SWML itself.** Request it with curl, as SignalWire does, and read the prompt and tools it carries. [Lesson 3](lesson3_multi_agent_systems.md#testing-individual-agents) shows how with `jq`.

## Production deployment

Configure a deployed agent through the environment, and keep secrets out of the code.

### Environment variables

These are the variables a production deployment sets:

```bash
# Credentials SignalWire uses to fetch the SWML and call the tools
export SWML_BASIC_AUTH_USER=pcbuilder
export SWML_BASIC_AUTH_PASSWORD=a-long-random-password

# Verifies that requests come from SignalWire
export SIGNALWIRE_SIGNING_KEY=your-signing-key

# Signs tool tokens, so they stay valid across restarts and replicas
export SIGNALWIRE_SWAIG_SECRET=another-long-random-value

export SIGNALWIRE_LOG_LEVEL=info

# HTTPS, or SWML_PROXY_URL_BASE when a proxy terminates TLS
export SWML_SSL_ENABLED=true
export SWML_SSL_CERT_PATH=/etc/ssl/certs/agent.crt
export SWML_SSL_KEY_PATH=/etc/ssl/private/agent.key
export SWML_SSL_DOMAIN=agents.example.com
```

Each tool call carries a token that the agent signed when it served the SWML. Without `SIGNALWIRE_SWAIG_SECRET`, each process generates its own secret, so a restart or a second replica rejects the tokens the first one issued. For more information, see the [security guide](../../docs/security.md).

### Docker deployment

This `Dockerfile` runs the Lesson 3 system. It builds from a project whose `package.json` depends on `@signalwire/sdk` and `tsx`, with a `package-lock.json`. List `tsx` under `dependencies`, not `devDependencies`: `npm ci --omit=dev` leaves dev dependencies out, and the image runs `tsx`.

```dockerfile
# PC Builder Pro multi-agent service (Lesson 4).
# Build context: a project whose package.json depends on @signalwire/sdk and tsx,
# with package-lock.json, pc_builder.ts, knowledge.ts and the two knowledge files.
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Install the locked dependencies first, so a code change reuses this layer
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the application
COPY pc_builder.ts knowledge.ts sales_knowledge.md support_knowledge.md ./

# Run as the image's unprivileged user
USER node

EXPOSE 3001

# Node has fetch built in, and the slim image has no curl
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["./node_modules/.bin/tsx", "pc_builder.ts"]
```

The health check uses Node's built-in `fetch`, because the slim image has no `curl`, and it fails on any status but 2xx. Build and run the image with the credentials:

```bash
docker build -t pc-builder .
docker run -d -p 3001:3001 \
  -e SWML_BASIC_AUTH_USER=pcbuilder -e SWML_BASIC_AUTH_PASSWORD=a-long-random-password \
  pc-builder
```

`docker ps` shows the container as `healthy` once `/health` answers.

### systemd service

On a Linux host without Docker, a systemd unit keeps the service running and restarts it when it fails. This unit expects the project in `/opt/pc-builder`, and the secrets in `/etc/pc-builder/env`:

```ini
[Unit]
Description=PC Builder Pro voice agents
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pcbuilder
WorkingDirectory=/opt/pc-builder
# The basic auth credentials, the signing key and the SSL paths, readable only by root
EnvironmentFile=/etc/pc-builder/env
Environment=PORT=3001
Environment=SIGNALWIRE_LOG_LEVEL=info
ExecStart=/opt/pc-builder/node_modules/.bin/tsx pc_builder.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Save it as `/etc/systemd/system/pc-builder.service`, then run `sudo systemctl enable --now pc-builder`.

### Health monitoring

An agent and an `AgentServer` answer `/health` without credentials. For a status page with details of your own, mount a Hono app beside the agent's routes. A mounted app isn't behind the agent's basic auth, so return nothing secret from it:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#status-route -->
```typescript
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
```

The route answers with the agent's status:

```bash
curl http://localhost:3000/status
```

The output has the values the route computes:

```json
{"status":"healthy","timestamp":"2026-09-29T17:41:42.221Z","tools":15,"uptime_seconds":6}
```

Hono is the web framework the SDK is built on. Add it to your project's dependencies to import it.

## Testing strategies

Test the tools directly, then the agent over HTTP. These examples use vitest, and come from `tests/tutorial/multi_agents-lessons.test.ts`.

### Unit testing functions

`agent.getTool(name)` returns a registered tool, and `execute()` runs its handler as the SWAIG endpoint does:

<!-- snippet: no-compile a region of tests/tutorial/multi_agents-lessons.test.ts; the test file itself is type-checked and run --> <!-- include: tests/tutorial/multi_agents-lessons.test.ts#unit-test -->
```typescript
it('calculates the price with tax', async () => {
  const fn = advanced.getTool('calculate_price')!;
  const result = await fn.execute({ amount: 100, tax_rate: 0.08 });
  expect(result['response']).toBe('The total price is $108.00 ($100.00 + $8.00 tax)');

  // The tax rate is optional, and defaults to 8%
  const noRate = await fn.execute({ amount: 50 });
  expect(noRate['response']).toContain('$54.00');
});
```

`execute()` returns the response the agent would send, with `response`, and `action` when the result has actions.

### Integration testing

`agent.getApp()` returns the agent's HTTP app, and its `request()` sends a request without a server or a port. This test checks the credentials and the SWML:

<!-- snippet: no-compile a region of tests/tutorial/multi_agents-lessons.test.ts; the test file itself is type-checked and run --> <!-- include: tests/tutorial/multi_agents-lessons.test.ts#integration-test -->
```typescript
it('serves SWML that lists calculate_price, and refuses a request without credentials', async () => {
  const app = advanced.getApp();
  expect((await app.request('/')).status).toBe(401);

  const res = await app.request('/', { headers: AUTH });
  expect(res.status).toBe(200);
  const swml = (await res.json()) as Swml;
  const ai = swml.sections.main.find((verb) => verb.ai)!.ai!;
  const names = ai.SWAIG.functions.map((f) => f.function);
  expect(names).toContain('calculate_price');
});
```

To call a tool over HTTP as SignalWire does, read the tool's `web_hook_url` from the SWML, and POST to it with the token it carries. `tests/tutorial/multi_agents.test.ts` does that for every agent in this tutorial.

A test can also run `swaig-test` itself, as `tests/tutorial/multi_agents-lessons.test.ts` does with `execFileSync`.

### Load testing

Apache Bench sends concurrent requests to the SWML route. Pass the credentials with `-A`:

```bash
ab -n 1000 -c 10 -A devuser:devpassword http://localhost:3000/
```

On a development machine, the agent served all 1000 requests. These are the lines of the report that matter:

```text
Complete requests:      1000
Failed requests:        0
Requests per second:    480.98 [#/sec] (mean)
Time per request:       20.791 [ms] (mean)
```

Load-test the tools that call slow services too, because those set how many calls one process can serve.

## Performance optimization

Most of a tool's time goes to the services it calls, so start there.

### Caching strategies

Cache a slow lookup in a `Map`, with an expiry time on each entry:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#caching -->
```typescript
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
```

The cache is per process. With several replicas, each has its own. Use a shared cache such as Redis when the replicas must agree.

### Running independent work concurrently

`Promise.all()` runs independent lookups at the same time, so the tool takes as long as the slowest one, not the sum of all three:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#concurrent -->
```typescript
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
```

Awaiting them one after another would add up the three wait times.

### Memory management

A few habits keep a long-running agent's memory flat:

- Keep search results small. Lesson 2's `count: 3` returns three sections, not the whole knowledge base.
- Give per-call state an end. Lesson 5 deletes an order when it's confirmed.
- Put an expiry on caches, as the product cache does, and a size limit if the key space is large.

## Security best practices

Tool arguments come from the model, which takes them from what the caller said. Treat them as untrusted input.

### Input sanitization

Strip the characters a query doesn't need, and cap the length, before you use caller-supplied text:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#sanitize -->
```typescript
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
```

For a database, use parameterized queries, as Lesson 5's SQLite example does, instead of building SQL from strings.

### Secrets management

Read secrets from the environment, and never log them or put them in a prompt:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#secrets -->
```typescript
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
```

### Rate limiting

Limit how often one caller can run an expensive tool. Key the limit by the caller's number from the request, not by an argument, because the model fills in arguments:

<!-- snippet: no-compile a region of tutorial/multi_agents/advanced_agent.ts; the file itself is type-checked --> <!-- include: tutorial/multi_agents/advanced_agent.ts#rate-limit -->
```typescript
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
```

To limit requests per client address on all of the agent's routes as well, set `SWML_RATE_LIMIT` to the number of requests a minute to allow. SignalWire's own requests count too, so set it well above your call volume.

### Request verification

Set `SIGNALWIRE_SIGNING_KEY` in production. With it, the agent checks the signature SignalWire puts on each request, and refuses a request that doesn't have a valid one. Without it, the agent logs a warning at startup.

## Summary

This lesson covered what an agent needs before production. The main points:

- `defineTool()` takes parameters as JSON Schema, and infers the handler's argument types from them
- A `FunctionResult` tells the model what happened, and carries actions such as `updateGlobalData()`
- Handle expected errors in the handler, and let the SDK's generic message cover the rest
- `getLogger()` gives structured logs, and `swaig-test` runs tools without a call
- The environment carries the credentials, the signing key, the token secret and the SSL settings
- `getTool().execute()` and `getApp().request()` test an agent without a server

### Practice exercises

Try these before you move on:

1. **Build a calculator agent**: add, subtract, multiply and divide tools, with a clear result for division by zero.
2. **Add caching**: cache the review service's answers in `fetch_product_reviews`.
3. **Extend the status route**: report whether the knowledge base loaded, and how many sections it has.
4. **Review an agent**: find every place a tool uses an argument without checking it.

### Production checklist

Check each item before the agent takes real calls:

- [ ] Credentials, signing key and token secret set from the environment
- [ ] HTTPS served by the agent, or by a proxy with `SWML_PROXY_URL_BASE` set
- [ ] Log level set, and no secrets in the logs
- [ ] Every tool returns a useful result on failure
- [ ] Health checks point at `/health`
- [ ] Monitoring and alerts set up
- [ ] Load tested, including the slow tools
- [ ] Tool arguments validated
- [ ] Tests pass

### Next steps

Next, write a skill of your own, and keep state across a call. Continue with [Lesson 5: Extending Your Agents](lesson5_extending_agents.md).

---

[Previous: Lesson 3 - Building Multi-Agent Systems](lesson3_multi_agent_systems.md) | [Tutorial Overview](README.md) | [Next: Lesson 5 - Extending Your Agents](lesson5_extending_agents.md)
