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
import { DataMap, FunctionResult } from '@signalwire/sdk';

const tool = new DataMap('get_weather');
```

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

Set the tool description shown to the AI. Both methods are aliases.

```typescript
purpose(desc: string): this
description(desc: string): this
```

```typescript
const tool = new DataMap('get_weather')
  .purpose('Look up current weather conditions for a location');
```

---

### parameter

Add a parameter the AI should extract from the conversation.

```typescript
parameter(
  name: string,
  type: string,
  description: string,
  opts?: { required?: boolean; enum?: string[] },
): this
```

| Argument | Type | Description |
|----------|------|-------------|
| `name` | `string` | Parameter name. |
| `type` | `string` | JSON Schema type (`string`, `number`, `boolean`, etc.). |
| `description` | `string` | Description shown to the AI. |
| `opts.required` | `boolean` | Whether the parameter is required. |
| `opts.enum` | `string[]` | Allowed values. |

```typescript
const tool = new DataMap('classify_ticket')
  .parameter('description', 'string', 'Ticket description', { required: true })
  .parameter('priority', 'string', 'Priority level', {
    enum: ['low', 'medium', 'high', 'critical'],
  });
```

---

## Webhooks

### webhook

Configure an HTTP request that SignalWire will make when the tool is invoked.

```typescript
webhook(
  method: string,
  url: string,
  opts?: { headers?: Record<string, string> },
): this
```

| Argument | Type | Description |
|----------|------|-------------|
| `method` | `string` | HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`). |
| `url` | `string` | URL with template variable expansion. |
| `opts.headers` | `Record<string, string>` | Request headers. |

```typescript
// Simple GET
const tool = new DataMap('lookup_order')
  .webhook('GET', 'https://api.example.com/orders/${args.order_id}');

// POST with headers
const tool2 = new DataMap('create_ticket')
  .webhook('POST', 'https://api.example.com/tickets', {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${ENV.API_TOKEN}',
    },
  });
```

---

### body

Set the request body for POST/PUT/PATCH webhooks.

```typescript
body(body: Record<string, unknown>): this
```

```typescript
const tool = new DataMap('create_ticket')
  .webhook('POST', 'https://api.example.com/tickets')
  .body({
    title: '${args.title}',
    description: '${args.description}',
    priority: '${args.priority}',
  });
```

---

### params

Set query parameters appended to the webhook URL.

```typescript
params(params: Record<string, string>): this
```

```typescript
const tool = new DataMap('search')
  .webhook('GET', 'https://api.example.com/search')
  .params({
    q: '${args.query}',
    limit: '10',
  });
```

---

### Webhook Headers

Headers can include template variables:

```typescript
const tool = new DataMap('secure_lookup')
  .webhook('GET', 'https://api.example.com/data/${args.id}', {
    headers: {
      'Authorization': 'Bearer ${ENV.API_KEY}',
      'X-Request-ID': '${meta_data.call_id}',
    },
  })
  .enableEnvExpansion();
```

---

## Expressions

### expression

Add a pattern-matching expression evaluated against template variables. Expressions are evaluated in order; the first match wins.

```typescript
expression(testValue: string, pattern: string, output: FunctionResult): this
```

| Argument | Type | Description |
|----------|------|-------------|
| `testValue` | `string` | Template string to evaluate (e.g., `${args.input}`). |
| `pattern` | `string` | Regular expression pattern to match against. |
| `output` | `FunctionResult` | Result to return when the pattern matches. |

```typescript
const tool = new DataMap('classify')
  .parameter('sentiment', 'string', 'User sentiment')
  .expression('${args.sentiment}', '(happy|satisfied|great)', new FunctionResult('Positive sentiment detected.'))
  .expression('${args.sentiment}', '(angry|upset|frustrated)', new FunctionResult('Negative sentiment detected.'))
  .expression('${args.sentiment}', '.*', new FunctionResult('Neutral sentiment.'));
```

---

## Response Processing

### output

Set the output template for successful webhook responses. Template variables like `${response.field}` are expanded from the webhook response JSON.

```typescript
output(result: FunctionResult): this
```

```typescript
const tool = new DataMap('get_weather')
  .webhook('GET', 'https://api.weather.com/current?q=${args.city}')
  .output(new FunctionResult(
    'The weather in ${args.city} is ${response.temp}F and ${response.condition}.',
  ));
```

---

### webhookExpressions

Add pattern-matching expressions evaluated against the webhook response.

```typescript
webhookExpressions(
  expressions: Array<{ pattern: string; output: FunctionResult }>,
): this
```

```typescript
const tool = new DataMap('check_status')
  .webhook('GET', 'https://api.example.com/status/${args.id}')
  .webhookExpressions([
    {
      pattern: 'shipped',
      output: new FunctionResult('Your order has been shipped!'),
    },
    {
      pattern: 'processing',
      output: new FunctionResult('Your order is still being processed.'),
    },
  ]);
```

---

## Error Handling

### fallbackOutput

Set the output to return when all webhooks fail or return errors.

```typescript
fallbackOutput(result: FunctionResult): this
```

```typescript
const tool = new DataMap('lookup')
  .webhook('GET', 'https://api.example.com/data/${args.id}')
  .output(new FunctionResult('Result: ${response.value}'))
  .fallbackOutput(new FunctionResult('Sorry, I could not look that up right now.'));
```

---

### errorKeys

Specify keys in the response that indicate an error condition. If any of these keys are present and truthy, the fallback output is used.

```typescript
errorKeys(keys: string[]): this
```

```typescript
const tool = new DataMap('api_call')
  .webhook('GET', 'https://api.example.com/data')
  .errorKeys(['error', 'err_msg'])
  .output(new FunctionResult('${response.data}'))
  .fallbackOutput(new FunctionResult('API returned an error.'));
```

---

### globalErrorKeys

Specify global error keys checked across all webhook responses.

```typescript
globalErrorKeys(keys: string[]): this
```

---

## Iteration

### foreach

Iterate over an array in the webhook response and format each element.

```typescript
foreach(arrayPath: string, template: string): this
```

| Argument | Type | Description |
|----------|------|-------------|
| `arrayPath` | `string` | Dot-path to the array in the response (e.g., `response.items`). |
| `template` | `string` | Template string applied to each element. |

```typescript
const tool = new DataMap('list_orders')
  .webhook('GET', 'https://api.example.com/orders?customer=${args.customer_id}')
  .foreach('response.orders', 'Order ${this.id}: ${this.status} - $${this.total}')
  .output(new FunctionResult('Your orders: ${foreach_output}'));
```

---

## Environment Variables

### enableEnvExpansion

Enable `${ENV.VAR_NAME}` expansion in template strings. This allows webhook URLs, headers, and body templates to reference server-side environment variables that are expanded at SWML rendering time.

```typescript
enableEnvExpansion(): this
```

```typescript
const tool = new DataMap('secure_api')
  .webhook('GET', 'https://api.example.com/data', {
    headers: { 'Authorization': 'Bearer ${ENV.API_KEY}' },
  })
  .enableEnvExpansion();
```

**Security:** Use `setAllowedEnvPrefixes()` to restrict which environment variable prefixes can be expanded:

```typescript
import { setAllowedEnvPrefixes } from '@signalwire/sdk';

// Only allow env vars starting with MY_APP_ or API_
setAllowedEnvPrefixes(['MY_APP_', 'API_']);
```

---

## Registration

### registerWithAgent

Register this DataMap tool with an `AgentBase` instance. The tool is serialized as a raw dictionary in the agent's tool registry.

```typescript
registerWithAgent(agent: AgentBase): void
```

```typescript
const tool = new DataMap('get_weather')
  .purpose('Look up weather')
  .parameter('city', 'string', 'City name')
  .webhook('GET', 'https://api.weather.com/current?q=${args.city}')
  .output(new FunctionResult('${response.temp}F'));

tool.registerWithAgent(agent);
```

---

### toSwaigFunction

Serialize the DataMap to the SWAIG wire format as a plain object. This is called internally by `registerWithAgent()` but can be used directly for custom registration.

```typescript
toSwaigFunction(): Record<string, unknown>
```

```typescript
const rawDef = tool.toSwaigFunction();
agent.registerSwaigFunction(rawDef);
```

---

## Helper Functions

### createSimpleApiTool

Create a DataMap tool that makes a single GET request and formats the response.

```typescript
import { createSimpleApiTool } from '@signalwire/sdk';

const tool = createSimpleApiTool({
  name: 'get_joke',
  description: 'Get a random joke',
  url: 'https://api.example.com/joke',
  responseTemplate: 'Here is a joke: ${joke}',
  fallbackTemplate: 'Sorry, I could not find a joke.',
  parameters: {
    category: { type: 'string', description: 'Joke category' },
  },
});
tool.registerWithAgent(agent);
```

---

### createExpressionTool

Create a DataMap tool that evaluates expressions without making any HTTP calls.

```typescript
import { createExpressionTool, FunctionResult } from '@signalwire/sdk';

const tool = createExpressionTool({
  name: 'classify_priority',
  description: 'Classify ticket priority',
  testValue: '${args.description}',
  parameters: {
    description: { type: 'string', description: 'Issue description' },
  },
  expressions: [
    {
      pattern: '(crash|down|outage|emergency)',
      output: new FunctionResult('Critical priority. Escalating immediately.'),
    },
    {
      pattern: '(slow|delay|lag)',
      output: new FunctionResult('Medium priority.'),
    },
    {
      pattern: '.*',
      output: new FunctionResult('Low priority.'),
    },
  ],
});
tool.registerWithAgent(agent);
```

---

## Template Variables Reference

Template variables use `${...}` syntax and are expanded by the SignalWire platform at execution time.

| Variable | Description | Example |
|----------|-------------|---------|
| `${args.name}` | Tool argument value | `${args.city}` |
| `${lc:args.name}` | Lowercase argument | `${lc:args.city}` |
| `${uc:args.name}` | Uppercase argument | `${uc:args.city}` |
| `${response.field}` | Webhook response field | `${response.temp}` |
| `${response.array[0].field}` | Array element access | `${response.results[0].name}` |
| `${meta_data.field}` | Call metadata | `${meta_data.call_id}` |
| `${ENV.VAR}` | Environment variable (requires `enableEnvExpansion()`) | `${ENV.API_KEY}` |
| `${foreach_output}` | Concatenated foreach results | `${foreach_output}` |
| `${this.field}` | Current element in foreach | `${this.name}` |

---

## Complete Examples

### Weather Lookup API

```typescript
import { DataMap, FunctionResult } from '@signalwire/sdk';

const weather = new DataMap('get_weather')
  .purpose('Get the current weather for any city')
  .parameter('city', 'string', 'The city to look up', { required: true })
  .parameter('units', 'string', 'Temperature units', { enum: ['fahrenheit', 'celsius'] })
  .webhook('GET', 'https://api.weatherapi.com/v1/current.json?key=${ENV.WEATHER_API_KEY}&q=${args.city}')
  .output(new FunctionResult(
    'The weather in ${args.city} is ${response.current.temp_f}F (${response.current.condition.text}).',
  ))
  .fallbackOutput(new FunctionResult('Sorry, I could not retrieve the weather data.'))
  .enableEnvExpansion();

weather.registerWithAgent(agent);
```

### Order Status Checker

```typescript
const orderStatus = new DataMap('check_order')
  .purpose('Check the status of a customer order')
  .parameter('order_id', 'string', 'Order number', { required: true })
  .webhook('GET', 'https://api.example.com/orders/${args.order_id}', {
    headers: { 'Authorization': 'Bearer ${ENV.ORDERS_API_KEY}' },
  })
  .errorKeys(['error', 'not_found'])
  .output(new FunctionResult(
    'Order ${args.order_id}: Status is ${response.status}. ' +
    'Estimated delivery: ${response.delivery_date}.',
  ))
  .fallbackOutput(new FunctionResult('I could not find that order. Please verify the order number.'))
  .enableEnvExpansion();

orderStatus.registerWithAgent(agent);
```

### Expression-Based Routing

```typescript
const router = new DataMap('route_department')
  .purpose('Determine which department to route to')
  .parameter('issue', 'string', 'Description of the issue', { required: true })
  .expression('${args.issue}', '(bill|charge|payment|invoice)', new FunctionResult('Route to billing department.'))
  .expression('${args.issue}', '(bug|error|crash|broken)', new FunctionResult('Route to technical support.'))
  .expression('${args.issue}', '(cancel|return|refund)', new FunctionResult('Route to customer retention.'))
  .expression('${args.issue}', '.*', new FunctionResult('Route to general support.'));

router.registerWithAgent(agent);
```

### List Processing with Foreach

```typescript
const listOrders = new DataMap('list_recent_orders')
  .purpose('List recent orders for a customer')
  .parameter('customer_id', 'string', 'Customer ID', { required: true })
  .webhook('GET', 'https://api.example.com/customers/${args.customer_id}/orders?limit=5')
  .foreach('response.orders', '- Order #${this.id}: ${this.status} ($${this.total})')
  .output(new FunctionResult('Recent orders:\n${foreach_output}'))
  .fallbackOutput(new FunctionResult('No orders found for this customer.'));

listOrders.registerWithAgent(agent);
```
