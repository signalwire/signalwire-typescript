# DataMap Guide

Comprehensive guide to the `DataMap` class in the SignalWire AI Agents TypeScript SDK.

---

## Table of Contents

- [Overview](#overview)
- [Creating a DataMap](#creating-a-datamap)
- [Configuration](#configuration)
  - [purpose / description](#purpose--description)
  - [parameter](#parameter)
- [Webhooks](#webhooks)
  - [webhook](#webhook)
  - [body](#body)
  - [params](#params)
  - [Webhook Headers](#webhook-headers)
- [Expressions](#expressions)
  - [expression](#expression)
- [Response Processing](#response-processing)
  - [output](#output)
  - [webhookExpressions](#webhookexpressions)
- [Error Handling](#error-handling)
  - [fallbackOutput](#fallbackoutput)
  - [errorKeys](#errorkeys)
  - [globalErrorKeys](#globalerrorkeys)
- [Iteration](#iteration)
  - [foreach](#foreach)
- [Environment Variables](#environment-variables)
  - [enableEnvExpansion](#enableenvexpansion)
- [Registration](#registration)
  - [registerWithAgent](#registerwithagent)
  - [toSwaigFunction](#toswaigfunction)
- [Helper Functions](#helper-functions)
  - [createSimpleApiTool](#createsimpleapitool)
  - [createExpressionTool](#createexpressiontool)
- [Template Variables Reference](#template-variables-reference)
- [Complete Examples](#complete-examples)

---

## Overview

`DataMap` creates server-side tool definitions that execute entirely on the SignalWire platform without requiring your own webhook endpoints for the tool handler. Instead of writing a handler function that runs on your server, you describe what HTTP call to make (or what expression to evaluate), how to process the response, and what to return to the AI -- all as configuration.

### When to use DataMap vs. defineTool

| Feature            | `defineTool()`                             | `DataMap`                                      |
|--------------------|--------------------------------------------|-------------------------------------------------|
| Execution location | Your server                                | SignalWire platform                             |
| Custom logic       | Full TypeScript/JavaScript                 | Template variables and pattern matching          |
| External API calls | You make them in your handler              | SignalWire makes them for you                    |
| Webhook required   | Yes (your agent server must be reachable)  | No (the data_map config is embedded in SWML)     |
| Best for           | Complex logic, database access, auth flows | Simple API lookups, pattern matching, transforms |

### How it works

1. You define a `DataMap` with a name, parameters, and either webhooks or expressions.
2. You register it with an agent via `registerWithAgent()` or `toSwaigFunction()`.
3. When the AI decides to call this tool, SignalWire executes the data_map configuration directly:
   - For **webhooks**: SignalWire makes the HTTP request, processes the response through your output template, and returns the result to the AI.
   - For **expressions**: SignalWire evaluates the test value against the regex pattern and returns the matching output.

### Architecture

```
Caller <-> SignalWire AI <-> DataMap (runs on SignalWire)
                                |
                                +--> External API (optional webhook call)
```

No traffic flows to your server for DataMap tool invocations. Your server only serves the initial SWML document that contains the data_map configuration.

---

## Creating a DataMap

The `DataMap` constructor takes a single argument: the function name.

```typescript
import { DataMap, FunctionResult } from '@anthropic/@signalwire/sdk';

const tool = new DataMap('get_weather');
```

| Parameter      | Type     | Description                              |
|----------------|----------|------------------------------------------|
| `functionName` | `string` | Unique name for this data map tool.      |

All subsequent configuration is done via fluent method chaining:

```typescript
const tool = new DataMap('get_weather')
  .purpose('Get current weather for a city')
  .parameter('city', 'string', 'The city name', { required: true })
  .webhook('GET', 'https://wttr.in/${lc:args.city}?format=j1')
  .output(new FunctionResult('Temperature: ${response.temp_F}F'))
  .fallbackOutput(new FunctionResult('Weather data unavailable.'));
```

---

## Configuration

### purpose / description

Set the tool description that the AI sees. The AI uses this description to decide when to call the tool. `description()` is an alias for `purpose()`.

```typescript
purpose(description: string): this
description(description: string): this
```

| Parameter     | Type     | Description                                        |
|---------------|----------|----------------------------------------------------|
| `description` | `string` | Human-readable description of what the tool does.  |

If not set, the description defaults to `"Execute <functionName>"`.

```typescript
const tool = new DataMap('lookup_order')
  .purpose('Look up an order by its ID and return the status');

// Equivalent:
const tool2 = new DataMap('lookup_order')
  .description('Look up an order by its ID and return the status');
```

---

### parameter

Define a parameter that the AI should extract from the conversation and pass to this tool.

```typescript
parameter(
  name: string,
  paramType: string,
  description: string,
  opts?: { required?: boolean; enum?: string[] }
): this
```

| Parameter         | Type       | Description                                              |
|-------------------|------------|----------------------------------------------------------|
| `name`            | `string`   | Parameter name (used in `${args.name}` templates).       |
| `paramType`       | `string`   | JSON Schema type: `"string"`, `"number"`, `"boolean"`, `"integer"`, `"array"`, `"object"`. |
| `description`     | `string`   | Description shown to the AI to explain what this parameter is.  |
| `opts.required`   | `boolean`  | If `true`, the AI must provide this parameter.           |
| `opts.enum`       | `string[]` | Restrict the parameter to a fixed set of allowed values. |

Multiple calls to `parameter()` define multiple parameters. Required parameters are tracked internally via a `_required` array in the parameter schema.

```typescript
const tool = new DataMap('search_products')
  .purpose('Search for products in the catalog')
  .parameter('query', 'string', 'Search query text', { required: true })
  .parameter('category', 'string', 'Product category filter', {
    enum: ['electronics', 'clothing', 'home', 'sports'],
  })
  .parameter('max_results', 'integer', 'Maximum number of results to return');
```

The generated parameter schema:

```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "Search query text" },
    "category": {
      "type": "string",
      "description": "Product category filter",
      "enum": ["electronics", "clothing", "home", "sports"]
    },
    "max_results": { "type": "integer", "description": "Maximum number of results to return" }
  },
  "required": ["query"]
}
```

---

## Webhooks

### webhook

Add a webhook that SignalWire calls when the tool is invoked. You can add multiple webhooks to a single DataMap.

```typescript
webhook(
  method: string,
  url: string,
  opts?: {
    headers?: Record<string, string>;
    formParam?: string;
    inputArgsAsParams?: boolean;
    requireArgs?: string[];
  }
): this
```

| Parameter              | Type                     | Description                                                |
|------------------------|--------------------------|------------------------------------------------------------|
| `method`               | `string`                 | HTTP method (`"GET"`, `"POST"`, `"PUT"`, etc.). Automatically uppercased. |
| `url`                  | `string`                 | The webhook URL. Supports template variables like `${args.city}`. |
| `opts.headers`         | `Record<string, string>` | Custom HTTP headers for the request.                       |
| `opts.formParam`       | `string`                 | Name of the form parameter to send the body as.            |
| `opts.inputArgsAsParams` | `boolean`              | If `true`, pass all input arguments as query/form parameters. |
| `opts.requireArgs`     | `string[]`               | Arguments that must be present for this webhook to fire.   |

**Returns:** `this` for chaining.

```typescript
// Simple GET request with URL template
const tool = new DataMap('get_stock_price')
  .purpose('Get the current stock price')
  .parameter('symbol', 'string', 'Stock ticker symbol', { required: true })
  .webhook('GET', 'https://api.stocks.example.com/v1/price/${uc:args.symbol}');

// POST with authentication header
const tool2 = new DataMap('create_ticket')
  .purpose('Create a support ticket')
  .parameter('subject', 'string', 'Ticket subject', { required: true })
  .parameter('description', 'string', 'Ticket description', { required: true })
  .webhook('POST', 'https://api.helpdesk.example.com/tickets', {
    headers: {
      'Authorization': 'Bearer ${ENV.HELPDESK_API_KEY}',
      'Content-Type': 'application/json',
    },
  });
```

---

### body

Set the JSON body for the most recently added webhook. Must be called after `webhook()`.

```typescript
body(data: Record<string, unknown>): this
```

| Parameter | Type                       | Description                |
|-----------|----------------------------|----------------------------|
| `data`    | `Record<string, unknown>`  | The request body object.   |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

```typescript
const tool = new DataMap('create_ticket')
  .purpose('Create a support ticket')
  .parameter('subject', 'string', 'Ticket subject', { required: true })
  .parameter('priority', 'string', 'Priority level', { enum: ['low', 'medium', 'high'] })
  .webhook('POST', 'https://api.helpdesk.example.com/tickets', {
    headers: { 'Authorization': 'Bearer my-api-key' },
  })
  .body({
    subject: '${args.subject}',
    priority: '${args.priority}',
    source: 'phone-call',
  });
```

---

### params

Set query or form parameters for the most recently added webhook. Must be called after `webhook()`.

```typescript
params(data: Record<string, unknown>): this
```

| Parameter | Type                       | Description              |
|-----------|----------------------------|--------------------------|
| `data`    | `Record<string, unknown>`  | The parameters object.   |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

```typescript
const tool = new DataMap('search_kb')
  .purpose('Search the knowledge base')
  .parameter('query', 'string', 'Search query', { required: true })
  .webhook('GET', 'https://api.kb.example.com/search')
  .params({
    q: '${args.query}',
    limit: 5,
    format: 'json',
  });
```

---

### Webhook Headers

Headers are set via the `opts.headers` parameter of `webhook()`. Template variables are supported in header values.

```typescript
const tool = new DataMap('authenticated_lookup')
  .purpose('Look up data from an authenticated API')
  .parameter('id', 'string', 'Record ID', { required: true })
  .enableEnvExpansion()
  .webhook('GET', 'https://api.example.com/records/${args.id}', {
    headers: {
      'Authorization': 'Bearer ${ENV.API_TOKEN}',
      'X-Request-Source': 'signalwire-agent',
    },
  });
```

---

## Expressions

### expression

Add a pattern-matching expression that evaluates a test value against a regex pattern. Expressions work without making any HTTP calls -- they are evaluated entirely on the SignalWire platform.

```typescript
expression(
  testValue: string,
  pattern: string | RegExp,
  output: FunctionResult,
  nomatchOutput?: FunctionResult
): this
```

| Parameter       | Type                       | Description                                              |
|-----------------|----------------------------|----------------------------------------------------------|
| `testValue`     | `string`                   | The string or template variable to test (e.g., `"${args.input}"`). |
| `pattern`       | `string \| RegExp`       | Regex pattern to match against. If a `RegExp`, the `.source` is used. |
| `output`        | `FunctionResult`      | Result returned when the pattern matches.                |
| `nomatchOutput` | `FunctionResult`      | Optional result returned when the pattern does not match.|

**Returns:** `this` for chaining.

You can add multiple expressions. They are evaluated in order; the first match wins.

```typescript
const tool = new DataMap('validate_email')
  .purpose('Validate an email address format')
  .parameter('email', 'string', 'The email address to validate', { required: true })
  .expression(
    '${args.email}',
    /^[^@]+@[^@]+\.[^@]+$/,
    new FunctionResult('The email address ${args.email} is valid.'),
    new FunctionResult('The email address ${args.email} is not valid. Please ask for a correct email.'),
  );
```

Multiple expressions for different test values:

```typescript
const tool = new DataMap('classify_input')
  .purpose('Classify user input as a question or command')
  .parameter('input', 'string', 'The user input to classify', { required: true })
  .expression(
    '${args.input}',
    '^(what|how|why|when|where|who|is|are|can|do|does)',
    new FunctionResult('The input is a question.'),
  )
  .expression(
    '${args.input}',
    '^(please|set|change|update|delete|create|send)',
    new FunctionResult('The input is a command.'),
    new FunctionResult('The input type could not be determined.'),
  );
```

---

## Response Processing

### output

Set the output template for the most recently added webhook. The template uses `${response.*}` variables to reference fields in the webhook's JSON response and `${args.*}` to reference the tool's input arguments.

```typescript
output(result: FunctionResult): this
```

| Parameter | Type                  | Description                                          |
|-----------|-----------------------|------------------------------------------------------|
| `result`  | `FunctionResult` | The result template. Use template variables in the response text. |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

```typescript
const tool = new DataMap('get_weather')
  .purpose('Get current weather')
  .parameter('city', 'string', 'City name', { required: true })
  .webhook('GET', 'https://wttr.in/${lc:args.city}?format=j1')
  .output(
    new FunctionResult(
      'Weather in ${args.city}: ' +
      'Temperature: ${response.current_condition[0].temp_F}F, ' +
      'Conditions: ${response.current_condition[0].weatherDesc[0].value}, ' +
      'Humidity: ${response.current_condition[0].humidity}%'
    ),
  );
```

The `output()` method calls `toDict()` on the `FunctionResult`, so you can also include actions:

```typescript
const tool = new DataMap('urgent_alert')
  .purpose('Send an urgent alert')
  .parameter('message', 'string', 'Alert message', { required: true })
  .webhook('POST', 'https://api.alerts.example.com/send')
  .body({ message: '${args.message}' })
  .output(
    new FunctionResult('Alert sent: ${response.alert_id}')
      .setMetadata({ alert_id: '${response.alert_id}' }),
  );
```

---

### webhookExpressions

Set pattern-matching expressions on the most recently added webhook. These expressions are evaluated against the webhook's response, allowing conditional output based on the response content.

```typescript
webhookExpressions(expressions: Record<string, unknown>[]): this
```

| Parameter     | Type                        | Description                                                    |
|---------------|-----------------------------|----------------------------------------------------------------|
| `expressions` | `Record<string, unknown>[]` | Array of expression objects with `string`, `pattern`, and `output` fields. |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

```typescript
const tool = new DataMap('check_order_status')
  .purpose('Check the status of an order')
  .parameter('order_id', 'string', 'Order ID', { required: true })
  .webhook('GET', 'https://api.store.example.com/orders/${args.order_id}')
  .webhookExpressions([
    {
      string: '${response.status}',
      pattern: 'shipped',
      output: new FunctionResult(
        'Order ${args.order_id} has shipped! Tracking: ${response.tracking_number}'
      ).toDict(),
    },
    {
      string: '${response.status}',
      pattern: 'processing',
      output: new FunctionResult(
        'Order ${args.order_id} is being processed. Estimated ship date: ${response.est_ship_date}'
      ).toDict(),
    },
    {
      string: '${response.status}',
      pattern: 'delivered',
      output: new FunctionResult(
        'Order ${args.order_id} was delivered on ${response.delivery_date}.'
      ).toDict(),
    },
  ])
  .output(
    new FunctionResult('Order ${args.order_id} status: ${response.status}'),
  );
```

---

## Error Handling

### fallbackOutput

Set a fallback output used when no webhook succeeds or no expression matches. This ensures the AI always gets a response even when the tool encounters an error.

```typescript
fallbackOutput(result: FunctionResult): this
```

| Parameter | Type                  | Description                                   |
|-----------|-----------------------|-----------------------------------------------|
| `result`  | `FunctionResult` | The fallback result.                          |

**Returns:** `this` for chaining.

```typescript
const tool = new DataMap('get_price')
  .purpose('Get the price of a product')
  .parameter('product', 'string', 'Product name', { required: true })
  .webhook('GET', 'https://api.store.example.com/price/${args.product}')
  .output(new FunctionResult('${args.product} costs $${response.price}'))
  .fallbackOutput(
    new FunctionResult('Sorry, I could not look up the price for ${args.product}. Please try again later.'),
  );
```

---

### errorKeys

Set error keys on the most recently added webhook. If the webhook response contains any of these keys, the response is treated as an error and the fallback output is used instead.

If no webhook has been added, the error keys are set globally (same as `globalErrorKeys`).

```typescript
errorKeys(keys: string[]): this
```

| Parameter | Type       | Description                                        |
|-----------|------------|----------------------------------------------------|
| `keys`    | `string[]` | Response keys that indicate an error occurred.     |

**Returns:** `this` for chaining.

```typescript
const tool = new DataMap('api_lookup')
  .purpose('Look up data from an API')
  .parameter('id', 'string', 'Record ID', { required: true })
  .webhook('GET', 'https://api.example.com/data/${args.id}')
  .errorKeys(['error', 'error_message', 'fault'])
  .output(new FunctionResult('Found: ${response.name}'))
  .fallbackOutput(new FunctionResult('Lookup failed. Please try again.'));
```

---

### globalErrorKeys

Set error keys at the top-level data map scope, regardless of webhook context. These apply to all webhooks in the DataMap.

```typescript
globalErrorKeys(keys: string[]): this
```

| Parameter | Type       | Description                                        |
|-----------|------------|----------------------------------------------------|
| `keys`    | `string[]` | Response keys that indicate an error occurred.     |

**Returns:** `this` for chaining.

```typescript
const tool = new DataMap('multi_api')
  .purpose('Call multiple APIs')
  .globalErrorKeys(['error', 'err'])
  .webhook('GET', 'https://api1.example.com/data')
  .output(new FunctionResult('API 1: ${response.value}'))
  .webhook('GET', 'https://api2.example.com/data')
  .output(new FunctionResult('API 2: ${response.value}'))
  .fallbackOutput(new FunctionResult('Both APIs failed.'));
```

---

## Iteration

### foreach

Configure iteration over an array in the webhook response. This allows you to loop over a list of items and build a composite response string.

```typescript
foreach(config: {
  input_key: string;
  output_key: string;
  append: string;
  max?: number;
}): this
```

| Parameter          | Type     | Description                                                  |
|--------------------|----------|--------------------------------------------------------------|
| `config.input_key` | `string` | Dot-path to the array in the response (e.g., `"results"`).  |
| `config.output_key`| `string` | Variable name that holds the concatenated output.            |
| `config.append`    | `string` | Template string appended for each item in the array.         |
| `config.max`       | `number` | Optional maximum number of items to iterate over.            |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

The `append` template has access to the current item's fields. After iteration, the concatenated result is available via `${output_key}` in the output template.

```typescript
const tool = new DataMap('list_orders')
  .purpose('List recent orders for a customer')
  .parameter('customer_id', 'string', 'Customer ID', { required: true })
  .webhook('GET', 'https://api.store.example.com/customers/${args.customer_id}/orders')
  .foreach({
    input_key: 'orders',
    output_key: 'order_list',
    append: 'Order #${id}: ${status} - $${total}\n',
    max: 5,
  })
  .output(
    new FunctionResult('Recent orders for customer ${args.customer_id}:\n${order_list}'),
  )
  .fallbackOutput(
    new FunctionResult('Could not retrieve orders for customer ${args.customer_id}.'),
  );
```

In this example, if the API returns:

```json
{
  "orders": [
    { "id": "1001", "status": "shipped", "total": "29.99" },
    { "id": "1002", "status": "processing", "total": "49.50" },
    { "id": "1003", "status": "delivered", "total": "15.00" }
  ]
}
```

The `${order_list}` variable becomes:

```
Order #1001: shipped - $29.99
Order #1002: processing - $49.50
Order #1003: delivered - $15.00
```

---

## Environment Variables

### enableEnvExpansion

Enable `${ENV.*}` variable expansion in URLs, bodies, headers, and outputs. When enabled, all `${ENV.VARIABLE_NAME}` references are replaced with the corresponding `process.env` values at the time `toSwaigFunction()` is called.

```typescript
enableEnvExpansion(enabled?: boolean): this
```

| Parameter | Type      | Default | Description                             |
|-----------|-----------|---------|-----------------------------------------|
| `enabled` | `boolean` | `true`  | Whether to enable environment expansion.|

**Returns:** `this` for chaining.

This is useful for embedding API keys or configuration values without hardcoding them:

```typescript
// Set environment variables (typically via .env file or deployment config)
// API_KEY=sk-abc123
// API_BASE_URL=https://api.example.com

const tool = new DataMap('secure_lookup')
  .purpose('Look up data from a secure API')
  .parameter('query', 'string', 'Search query', { required: true })
  .enableEnvExpansion()
  .webhook('GET', '${ENV.API_BASE_URL}/search?q=${args.query}', {
    headers: {
      'Authorization': 'Bearer ${ENV.API_KEY}',
    },
  })
  .output(new FunctionResult('Result: ${response.data}'));
```

When `toSwaigFunction()` is called, `${ENV.API_KEY}` is replaced with the value of `process.env.API_KEY`. If the environment variable is not set, it is replaced with an empty string.

**Important:** The expansion happens at serialization time (when `toSwaigFunction()` is called), not at runtime. The resolved values are baked into the SWML document.

---

## Registration

### registerWithAgent

Register this DataMap tool with an `AgentBase` instance. This is a convenience method that calls `toSwaigFunction()` internally and passes the result to the agent's `registerSwaigFunction()` method.

```typescript
registerWithAgent(agent: {
  registerSwaigFunction(fn: Record<string, unknown>): unknown
}): this
```

| Parameter | Type     | Description                                        |
|-----------|----------|----------------------------------------------------|
| `agent`   | `object` | An object with a `registerSwaigFunction` method.   |

**Returns:** `this` for chaining.

```typescript
import { AgentBase, DataMap, FunctionResult } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent', basicAuth: ['user', 'pass'] });

new DataMap('get_time')
  .purpose('Get the current time in a timezone')
  .parameter('timezone', 'string', 'IANA timezone', { required: true })
  .webhook('GET', 'https://worldtimeapi.org/api/timezone/${args.timezone}')
  .output(new FunctionResult('Current time: ${response.datetime}'))
  .fallbackOutput(new FunctionResult('Could not get time for that timezone.'))
  .registerWithAgent(agent);

agent.run();
```

---

### toSwaigFunction

Serialize the DataMap to a SWAIG function definition object suitable for inclusion in a SWML document. This is the terminal method that produces the wire format.

```typescript
toSwaigFunction(): Record<string, unknown>
```

**Returns:** A plain object with `function`, `description`, `parameters`, and `data_map` fields.

```typescript
const tool = new DataMap('echo')
  .purpose('Echo back the input')
  .parameter('text', 'string', 'Text to echo', { required: true })
  .expression(
    '${args.text}',
    '.*',
    new FunctionResult('You said: ${args.text}'),
  );

const swaigDef = tool.toSwaigFunction();
console.log(JSON.stringify(swaigDef, null, 2));
```

Output:

```json
{
  "function": "echo",
  "description": "Echo back the input",
  "parameters": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "description": "Text to echo" }
    },
    "required": ["text"]
  },
  "data_map": {
    "expressions": [
      {
        "string": "${args.text}",
        "pattern": ".*",
        "output": { "response": "You said: ${args.text}" }
      }
    ]
  }
}
```

You can then register this definition manually:

```typescript
agent.registerSwaigFunction(tool.toSwaigFunction());
```

---

## Helper Functions

### createSimpleApiTool

Create a DataMap tool that calls a single API endpoint and formats the response. This is a convenience function for the most common DataMap pattern: one GET/POST request with a response template.

```typescript
import { createSimpleApiTool } from '@anthropic/@signalwire/sdk';

createSimpleApiTool(opts: {
  name: string;
  url: string;
  responseTemplate: string;
  parameters?: Record<string, {
    type?: string;
    description?: string;
    required?: boolean;
  }>;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  errorKeys?: string[];
}): DataMap
```

| Parameter               | Type                       | Default   | Description                                       |
|-------------------------|----------------------------|-----------|---------------------------------------------------|
| `opts.name`             | `string`                   | --        | Tool name.                                        |
| `opts.url`              | `string`                   | --        | Webhook URL (supports template variables).        |
| `opts.responseTemplate` | `string`                   | --        | Response template with `${response.*}` variables. |
| `opts.parameters`       | `Record<string, {...}>`    | --        | Parameter definitions.                            |
| `opts.method`           | `string`                   | `'GET'`   | HTTP method.                                      |
| `opts.headers`          | `Record<string, string>`   | --        | Request headers.                                  |
| `opts.body`             | `Record<string, unknown>`  | --        | Request body (for POST/PUT).                      |
| `opts.errorKeys`        | `string[]`                 | --        | Response keys indicating errors.                  |

**Returns:** A configured `DataMap` instance ready for registration.

```typescript
import { createSimpleApiTool } from '@anthropic/@signalwire/sdk';

// Minimal: a single GET endpoint
const jokeTool = createSimpleApiTool({
  name: 'get_joke',
  url: 'https://official-joke-api.appspot.com/random_joke',
  responseTemplate: 'Here is a joke: ${response.setup} ... ${response.punchline}',
});

agent.registerSwaigFunction(jokeTool.toSwaigFunction());

// With parameters and POST
const searchTool = createSimpleApiTool({
  name: 'search_docs',
  url: 'https://api.docs.example.com/search',
  method: 'POST',
  responseTemplate: 'Found ${response.total} results. Top result: ${response.results[0].title}',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
    limit: { type: 'integer', description: 'Max results' },
  },
  headers: {
    'Authorization': 'Bearer my-token',
  },
  body: {
    q: '${args.query}',
    max: '${args.limit}',
  },
  errorKeys: ['error'],
});

agent.registerSwaigFunction(searchTool.toSwaigFunction());
```

---

### createExpressionTool

Create a DataMap tool that evaluates expressions against patterns without making any HTTP calls. Useful for validation, classification, and simple lookups.

```typescript
import { createExpressionTool } from '@anthropic/@signalwire/sdk';

createExpressionTool(opts: {
  name: string;
  patterns: Record<string, [string, FunctionResult]>;
  parameters?: Record<string, {
    type?: string;
    description?: string;
    required?: boolean;
  }>;
}): DataMap
```

| Parameter        | Type                                                  | Description                                            |
|------------------|-------------------------------------------------------|--------------------------------------------------------|
| `opts.name`      | `string`                                              | Tool name.                                             |
| `opts.patterns`  | `Record<string, [string, FunctionResult]>`       | Map of test values to `[pattern, output]` tuples.      |
| `opts.parameters`| `Record<string, {...}>`                               | Parameter definitions.                                 |

The `patterns` object maps test values (template strings) to tuples of `[regexPattern, result]`:

```typescript
import { createExpressionTool, FunctionResult } from '@anthropic/@signalwire/sdk';

const validator = createExpressionTool({
  name: 'validate_phone',
  patterns: {
    '${args.phone}': [
      '^\\+?1?\\d{10,15}$',
      new FunctionResult('The phone number ${args.phone} is valid.'),
    ],
  },
  parameters: {
    phone: { type: 'string', description: 'Phone number to validate', required: true },
  },
});

agent.registerSwaigFunction(validator.toSwaigFunction());
```

---

## Template Variables Reference

Template variables are strings enclosed in `${}` that are evaluated by the SignalWire platform at runtime.

### Argument Variables

| Variable          | Description                                              | Example                |
|-------------------|----------------------------------------------------------|------------------------|
| `${args.<name>}`  | Value of an input argument passed by the AI.             | `${args.city}`         |
| `${lc:args.<name>}` | Argument value converted to lowercase.                | `${lc:args.city}`      |
| `${uc:args.<name>}` | Argument value converted to uppercase.                | `${uc:args.symbol}`    |

### Response Variables

| Variable                    | Description                                           | Example                                     |
|-----------------------------|-------------------------------------------------------|---------------------------------------------|
| `${response.<key>}`         | Top-level field from the webhook JSON response.       | `${response.name}`                          |
| `${response.<key>.<subkey>}` | Nested field from the response.                      | `${response.address.city}`                  |
| `${response.<key>[N]}`      | Array element by index.                              | `${response.results[0].title}`              |
| `${response.<key>[N].<sub>}` | Field within an array element.                      | `${response.current_condition[0].temp_F}`   |

### Environment Variables

| Variable          | Description                                                        | Example                |
|-------------------|--------------------------------------------------------------------|------------------------|
| `${ENV.<name>}`   | Value of `process.env.<name>`. Requires `enableEnvExpansion()`.    | `${ENV.API_KEY}`       |

### Foreach Variables

Inside a `foreach` `append` template, you can reference fields of the current item directly:

| Variable   | Description                                | Example        |
|------------|--------------------------------------------|----------------|
| `${<field>}` | Field of the current item in the array.  | `${id}`, `${name}` |

### Case Transformation

The `${lc:...}` and `${uc:...}` prefixes can be applied to argument variables to transform them to lowercase or uppercase respectively. This is particularly useful in URL templates:

```typescript
// Lowercase city name for URL-friendly paths
.webhook('GET', 'https://api.example.com/cities/${lc:args.city_name}')

// Uppercase stock ticker symbol
.webhook('GET', 'https://api.example.com/stocks/${uc:args.symbol}')
```

---

## Complete Examples

### Example 1: Weather lookup with DataMap builder

```typescript
import { AgentBase, DataMap, FunctionResult } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'weather-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText('You are a weather assistant. Help users check the weather.');

const weatherTool = new DataMap('get_weather')
  .purpose('Get current weather for a city')
  .parameter('city', 'string', 'The city name', { required: true })
  .webhook('GET', 'https://wttr.in/${lc:args.city}?format=j1')
  .output(
    new FunctionResult(
      'Weather in ${args.city}: ${response.current_condition[0].temp_F}F, ' +
      '${response.current_condition[0].weatherDesc[0].value}'
    ),
  )
  .fallbackOutput(
    new FunctionResult('Sorry, could not fetch weather for that city.'),
  );

agent.registerSwaigFunction(weatherTool.toSwaigFunction());
agent.run();
```

### Example 2: Expression-only tool (no HTTP)

```typescript
import { AgentBase, DataMap, FunctionResult } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'validator-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText('You help validate user data like emails and phone numbers.');

const emailValidator = new DataMap('validate_email')
  .purpose('Check if an email address is valid')
  .parameter('email', 'string', 'Email address to validate', { required: true })
  .expression(
    '${args.email}',
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    new FunctionResult('The email ${args.email} is valid.'),
    new FunctionResult('The email ${args.email} is invalid. Please provide a correct email address.'),
  );

emailValidator.registerWithAgent(agent);
agent.run();
```

### Example 3: API tool with POST body and error handling

```typescript
import { AgentBase, DataMap, FunctionResult } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'ticket-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText('You are a support agent. Create tickets for customer issues.');

const ticketTool = new DataMap('create_ticket')
  .purpose('Create a support ticket for the customer')
  .parameter('subject', 'string', 'Brief description of the issue', { required: true })
  .parameter('priority', 'string', 'Urgency level', {
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
  })
  .parameter('description', 'string', 'Detailed description of the issue')
  .enableEnvExpansion()
  .webhook('POST', '${ENV.HELPDESK_URL}/api/tickets', {
    headers: {
      'Authorization': 'Bearer ${ENV.HELPDESK_TOKEN}',
      'Content-Type': 'application/json',
    },
  })
  .body({
    subject: '${args.subject}',
    priority: '${args.priority}',
    description: '${args.description}',
    source: 'phone',
  })
  .errorKeys(['error', 'message'])
  .output(
    new FunctionResult(
      'Ticket #${response.ticket_id} created successfully with ${args.priority} priority.'
    ),
  )
  .fallbackOutput(
    new FunctionResult('Failed to create the ticket. Please try again or contact support via email.'),
  );

ticketTool.registerWithAgent(agent);
agent.run();
```

### Example 4: Iteration over array responses

```typescript
import { AgentBase, DataMap, FunctionResult } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'store-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText('You help customers find products and check orders.');

const ordersTool = new DataMap('list_orders')
  .purpose('List recent orders for the caller')
  .parameter('email', 'string', 'Customer email address', { required: true })
  .webhook('GET', 'https://api.store.example.com/orders?email=${args.email}')
  .foreach({
    input_key: 'orders',
    output_key: 'order_summary',
    append: '- Order #${id}: ${status}, Total: $${total}\n',
    max: 10,
  })
  .output(
    new FunctionResult('Here are your recent orders:\n${order_summary}'),
  )
  .fallbackOutput(
    new FunctionResult('No orders found for ${args.email}.'),
  );

ordersTool.registerWithAgent(agent);
agent.run();
```

### Example 5: Quick setup with createSimpleApiTool

```typescript
import { AgentBase, createSimpleApiTool } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'fun-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText('You tell jokes and fun facts.');

// One-liner API integration
const jokeTool = createSimpleApiTool({
  name: 'get_joke',
  url: 'https://official-joke-api.appspot.com/random_joke',
  responseTemplate: '${response.setup} ... ${response.punchline}',
});

const factTool = createSimpleApiTool({
  name: 'get_fact',
  url: 'https://uselessfacts.jsph.pl/random.json?language=en',
  responseTemplate: 'Fun fact: ${response.text}',
});

agent.registerSwaigFunction(jokeTool.toSwaigFunction());
agent.registerSwaigFunction(factTool.toSwaigFunction());
agent.run();
```

### Example 6: Expression tool with createExpressionTool

```typescript
import {
  AgentBase,
  createExpressionTool,
  FunctionResult,
} from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'validator-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText('You validate user inputs like zip codes and phone numbers.');

const zipValidator = createExpressionTool({
  name: 'validate_zip',
  patterns: {
    '${args.zip}': [
      '^\\d{5}(-\\d{4})?$',
      new FunctionResult('${args.zip} is a valid US zip code.'),
    ],
  },
  parameters: {
    zip: { type: 'string', description: 'Zip code to validate', required: true },
  },
});

agent.registerSwaigFunction(zipValidator.toSwaigFunction());
agent.run();
```
