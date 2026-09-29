# DataMap Guide

This page is the reference for the `DataMap` class in the SignalWire AI Agents TypeScript SDK, and for the `data_map` definition it builds.

<!-- snippet-setup -->
```ts
export {}; // treat each runnable example as a module
// Shared context the examples assume: `DataMap`/`FunctionResult` (imported once and
// reused), `agent` (an AgentBase), and `tool` (the DataMap built in the current example).
// Declared as ambient globals so each fragment resolves without repeating the boilerplate.
// A block that constructs or imports its own `const tool`/`DataMap` shadows these.
declare global {
  const DataMap: typeof import('@signalwire/sdk').DataMap;
  const FunctionResult: typeof import('@signalwire/sdk').FunctionResult;
  const agent: import('@signalwire/sdk').AgentBase;
  const tool: import('@signalwire/sdk').DataMap;
}
```

---

## Table of Contents

The page has these sections:

- [Overview](#overview)
  - [What the SDK does and what the platform does](#what-the-sdk-does-and-what-the-platform-does)
- [Creating a DataMap](#creating-a-datamap)
- [Configuration](#configuration)
  - [purpose / description](#purpose--description)
  - [parameter](#parameter)
- [Webhooks](#webhooks)
  - [webhook](#webhook)
  - [params](#params)
  - [body](#body)
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
  - [Allowed prefixes](#allowed-prefixes)
- [Registration](#registration)
  - [registerWithAgent](#registerwithagent)
  - [toSwaigFunction](#toswaigfunction)
- [Helper Functions](#helper-functions)
  - [createSimpleApiTool](#createsimpleapitool)
  - [createExpressionTool](#createexpressiontool)
- [Template Reference](#template-reference)
  - [Template data](#template-data)
  - [Template syntax](#template-syntax)
  - [Template functions](#template-functions)
- [Testing a DataMap](#testing-a-datamap)
- [Complete Example](#complete-example)

---

## Overview

`DataMap` builds a SWAIG function that runs on the SignalWire platform instead of in your agent. You describe the HTTP request to make, or the pattern to match, and how to turn the result into the function's response. The definition goes into the SWML document as the function's `data_map`, and the platform runs it when the AI calls the function.

The two kinds of tool differ in where they run:

| Feature            | `defineTool()`                             | `DataMap`                                      |
|--------------------|--------------------------------------------|------------------------------------------------|
| Execution location | Your server                                | SignalWire platform                            |
| Custom logic       | Full TypeScript/JavaScript                 | Template variables and pattern matching        |
| External API calls | You make them in your handler              | SignalWire makes them for you                  |
| Webhook required   | Yes (your agent server must be reachable)  | No (the `data_map` definition is in the SWML)  |
| Best for           | Complex logic, database access, auth flows | API lookups, pattern matching, formatting      |

### How it works

A DataMap tool goes from definition to call in three steps:

1. You define a `DataMap` with a name, parameters, and webhooks or expressions.
2. You register it with an agent through `registerWithAgent()` or `toSwaigFunction()`.
3. When the AI calls the function, SignalWire runs the `data_map` definition:
   - For **webhooks**, SignalWire makes the HTTP request and expands the output template with the response. The result goes back to the AI.
   - For **expressions**, SignalWire expands the test value, matches it against the pattern, and returns the matching output.

The request path looks like this:

```text
Caller <-> SignalWire AI <-> DataMap (runs on SignalWire)
                                |
                                +--> External API (optional webhook call)
```

A DataMap function call sends no request to your server. Your server only serves the SWML document that contains the `data_map` definition.

### What the SDK does and what the platform does

The SDK builds the definition. `toSwaigFunction()` serializes the builder's settings into a SWAIG function object with a `data_map` key. The one template the SDK expands itself is `${ENV.NAME}`, when you turn on [environment expansion](#environment-variables). Every other `${...}` is written into the SWML as text.

The platform does the rest during a call. It fetches each webhook, expands the templates, evaluates the expressions and builds the output. [Template Reference](#template-reference) describes the platform's side. SignalWire's own reference is the [data_map page](https://signalwire.com/docs/swml/reference/calling/ai/swaig/functions/data-map) and the [template functions page](https://signalwire.com/docs/swml/reference/template-functions).

`swaig-test --exec` runs a DataMap function locally in a simulator of the platform's processing. See [Testing a DataMap](#testing-a-datamap).

---

## Creating a DataMap

The `DataMap` constructor takes a single argument: the function name.

```typescript
import { DataMap, FunctionResult } from '@signalwire/sdk';

const tool = new DataMap('get_weather');
```

| Parameter      | Type     | Description                              |
|----------------|----------|------------------------------------------|
| `functionName` | `string` | Unique name for this data map tool.      |

You configure the rest through method chaining. This tool calls the wttr.in weather API and reads the temperature from its JSON response:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('get_weather')
  .purpose('Get current weather for a city')
  .parameter('city', 'string', 'The city name', { required: true })
  .webhook('GET', 'https://wttr.in/${lc:enc:args.city}?format=j1')
  .output(new FunctionResult('Temperature: ${current_condition[0].temp_F}F'))
  .fallbackOutput(new FunctionResult('Weather data unavailable.'));
```

The output reads `current_condition[0].temp_F` from the root of the response, with no `response.` prefix. [Template data](#template-data) explains why.

---

## Configuration

### purpose / description

These methods set the tool description that the AI reads to decide when to call the tool. `description()` is an alias for `purpose()`.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
purpose(description: string): this
description(description: string): this
```

| Parameter     | Type     | Description                                        |
|---------------|----------|----------------------------------------------------|
| `description` | `string` | Human-readable description of what the tool does.  |

If you don't set one, the description is `"Execute <functionName>"`. Both calls in this example set the same description:

```typescript
const tool = new DataMap('lookup_order')
  .purpose('Look up an order by its ID and return the status');

// Equivalent:
const tool2 = new DataMap('lookup_order')
  .description('Look up an order by its ID and return the status');
```

---

### parameter

This method defines a parameter that the AI extracts from the conversation and passes to the tool.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
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
| `name`            | `string`   | Parameter name, read in templates as `${args.name}`.     |
| `paramType`       | `string`   | JSON Schema type: `"string"`, `"number"`, `"boolean"`, `"integer"`, `"array"`, `"object"`. |
| `description`     | `string`   | Description the AI reads to decide how to fill in the value. |
| `opts.required`   | `boolean`  | If `true`, the parameter is listed in the schema's `required` array. |
| `opts.enum`       | `string[]` | Restrict the parameter to a fixed set of allowed values. |

The options are an object: write `{ required: true }`, not `true`. Each call to `parameter()` adds one parameter:

```typescript
const tool = new DataMap('search_products')
  .purpose('Search for products in the catalog')
  .parameter('query', 'string', 'Search query text', { required: true })
  .parameter('category', 'string', 'Product category filter', {
    enum: ['electronics', 'clothing', 'home', 'sports'],
  })
  .parameter('max_results', 'integer', 'Maximum number of results to return');
```

`toSwaigFunction()` turns those calls into this parameter schema:

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

This method adds an HTTP request for SignalWire to make when the tool is called. You can add more than one, and they form a fallback chain.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
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

| Parameter                | Type                     | Written as             | Description |
|--------------------------|--------------------------|------------------------|-------------|
| `method`                 | `string`                 | `method`               | HTTP method, uppercased. The SWML schema allows `GET`, `POST`, `PUT` and `DELETE`. |
| `url`                    | `string`                 | `url`                  | The request URL. The platform expands templates in it, such as `${enc:args.city}`. |
| `opts.headers`           | `Record<string, string>` | `headers`              | HTTP headers for the request. |
| `opts.formParam`         | `string`                 | `form_param`           | The SWML schema's webhook object doesn't define this key. |
| `opts.inputArgsAsParams` | `boolean`                | `input_args_as_params` | If `true`, the platform merges the function's arguments into `params`. With no `params`, the arguments are the whole request body. |
| `opts.requireArgs`       | `string[]`               | `require_args`         | Arguments that must be present for the platform to make this request. The SWML schema names the key `require_args`, and SignalWire's reference page lists it as `required_args`. |

**Returns:** `this` for chaining.

A webhook's other settings (`params()`, `foreach()`, `output()`, `errorKeys()`, `webhookExpressions()`) apply to the most recently added webhook. This example builds two tools, one with a URL template and one with an authentication header:

```typescript
// GET request with the argument URL-encoded into the path
const tool = new DataMap('get_stock_price')
  .purpose('Get the current stock price')
  .parameter('symbol', 'string', 'Stock ticker symbol', { required: true })
  .webhook('GET', 'https://api.stocks.example.com/v1/price/${enc:args.symbol}');

// POST with an authentication header read from the environment
const tool2 = new DataMap('create_ticket')
  .purpose('Create a support ticket')
  .parameter('subject', 'string', 'Ticket subject', { required: true })
  .parameter('description', 'string', 'Ticket description', { required: true })
  .enableEnvExpansion()
  .webhook('POST', 'https://api.helpdesk.example.com/tickets', {
    headers: {
      'Authorization': 'Bearer ${ENV.SW_HELPDESK_API_KEY}',
      'Content-Type': 'application/json',
    },
  })
  .params({ subject: '${args.subject}', description: '${args.description}' });
```

`${ENV.SW_HELPDESK_API_KEY}` is expanded by the SDK, and only because the name starts with an allowed prefix. See [Environment Variables](#environment-variables).

---

### params

This method sets the `params` object of the most recently added webhook. The platform sends `params` as the request's JSON body when `params` is set or the method is `POST`, and expands templates in its values first. A request with no `params` and a method other than `POST` has no body.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
params(data: Record<string, unknown>): this
```

| Parameter | Type                       | Description              |
|-----------|----------------------------|--------------------------|
| `data`    | `Record<string, unknown>`  | The request body object. Values can contain templates. |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

This tool posts a search to a knowledge base API, with the caller's query in the body:

```typescript
const tool = new DataMap('search_kb')
  .purpose('Search the knowledge base')
  .parameter('query', 'string', 'Search query', { required: true })
  .webhook('POST', 'https://api.kb.example.com/search')
  .params({
    q: '${args.query}',
    limit: 5,
    format: 'json',
  });
```

The request body is `{"q": "<the query>", "limit": 5, "format": "json"}`. Because `params` becomes a body, put query-string values for a `GET` request in the URL instead: `https://api.kb.example.com/search?q=${enc:args.query}`. The built-in `datasphere_serverless` skill sends its search request with `params()`.

---

### body

This method sets a `body` key on the most recently added webhook.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
body(data: Record<string, unknown>): this
```

| Parameter | Type                       | Description                |
|-----------|----------------------------|----------------------------|
| `data`    | `Record<string, unknown>`  | The object to store under `body`. |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

The SWML schema's webhook object has no `body` field, and SignalWire's `data_map` reference documents `params` as the request body. Use [params](#params) to set a request body. `createSimpleApiTool()` uses `body()` for its `body` option.

---

### Webhook Headers

You set headers through the `opts.headers` parameter of `webhook()`. The SDK expands `${ENV.*}` in header values when environment expansion is on. SignalWire's reference names `url` and `params` as the fields where the platform expands templates, and doesn't say whether it expands header values. This tool sends a token from the environment:

```typescript
const tool = new DataMap('authenticated_lookup')
  .purpose('Look up data from an authenticated API')
  .parameter('id', 'string', 'Record ID', { required: true })
  .enableEnvExpansion()
  .webhook('GET', 'https://api.example.com/records/${enc:args.id}', {
    headers: {
      'Authorization': 'Bearer ${ENV.SW_RECORDS_API_TOKEN}',
      'X-Request-Source': 'signalwire-agent',
    },
  });
```

A header value is written into the SWML document, so a token in it is readable by anyone who can fetch the agent's SWML. [Environment Variables](#environment-variables) covers what that means for secrets.

---

## Expressions

### expression

This method adds a pattern-matching expression. The platform expands the test value, matches it against a regular expression, and returns the output of the first expression that matches. Expressions make no HTTP request.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
expression(
  testValue: string,
  pattern: string | RegExp,
  output: FunctionResult,
  nomatchOutput?: FunctionResult
): this
```

| Parameter       | Type                  | Description                                              |
|-----------------|-----------------------|----------------------------------------------------------|
| `testValue`     | `string`              | The text to test, usually a template such as `"${args.input}"`. Written as `string`. |
| `pattern`       | `string \| RegExp`    | The regular expression, written as `pattern`. For a `RegExp`, only `.source` is kept: flags such as `/i` are dropped. |
| `output`        | `FunctionResult`      | The result when the pattern matches. Written as `output`. |
| `nomatchOutput` | `FunctionResult`      | Written as `nomatch-output`. The SWML schema's expression object doesn't define this key. |

**Returns:** `this` for chaining.

Because flags are dropped, write case-insensitive matching into the pattern string. SignalWire's reference uses the inline `(?i)` modifier, as in `'(?i)star\\s*wars'`.

Expressions are tried in order, and the first match's output ends the function. For an answer when nothing matches, add a last expression with a catch-all pattern, or a [fallbackOutput](#fallbackoutput). This tool classifies input with a final catch-all:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('classify_input')
  .purpose('Classify user input as a question or command')
  .parameter('input', 'string', 'The user input to classify', { required: true })
  .expression(
    '${lc:args.input}',
    '^(what|how|why|when|where|who|is|are|can|do|does)',
    new FunctionResult('The input is a question.'),
  )
  .expression(
    '${lc:args.input}',
    '^(set|change|update|delete|create|send)',
    new FunctionResult('The input is a command.'),
  )
  .expression(
    '${args.input}',
    '.*',
    new FunctionResult('The input type could not be determined.'),
  );
```

The `lc` helper lowercases the input before the match, so "What time is it" counts as a question.

---

## Response Processing

### output

This method sets the output of the most recently added webhook. The output's templates read the webhook's JSON response from the root of the template data, such as `${temp}`, and the arguments as `${args.name}`. An array response is under `array`. See [Template data](#template-data).

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
output(result: FunctionResult): this
```

| Parameter | Type             | Description                                          |
|-----------|------------------|------------------------------------------------------|
| `result`  | `FunctionResult` | The result template. Templates can appear in the response text and in action values. |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

The output's response text goes back to the AI as context for its reply. The AI decides what to say. This tool formats three fields of the wttr.in response:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('get_weather')
  .purpose('Get current weather')
  .parameter('city', 'string', 'City name', { required: true })
  .webhook('GET', 'https://wttr.in/${lc:enc:args.city}?format=j1')
  .output(
    new FunctionResult(
      'Weather in ${args.city}: ' +
      'Temperature: ${current_condition[0].temp_F}F, ' +
      'Conditions: ${current_condition[0].weatherDesc[0].value}, ' +
      'Humidity: ${current_condition[0].humidity}%'
    ),
  );
```

`output()` stores `result.toDict()`, so the output can carry actions as well as text. This tool records the alert's ID in the function's metadata:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('urgent_alert')
  .purpose('Send an urgent alert')
  .parameter('message', 'string', 'Alert message', { required: true })
  .webhook('POST', 'https://api.alerts.example.com/send')
  .params({ message: '${args.message}' })
  .output(
    new FunctionResult('Alert sent: ${alert_id}')
      .setMetadata({ alert_id: '${alert_id}' }),
  );
```

---

### webhookExpressions

This method sets the `expressions` array of the most recently added webhook. The platform evaluates a webhook's `foreach`, then its `expressions`, then its `output`, so the expressions can test fields of the response.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
webhookExpressions(expressions: Record<string, unknown>[]): this
```

| Parameter     | Type                        | Description                                                    |
|---------------|-----------------------------|----------------------------------------------------------------|
| `expressions` | `Record<string, unknown>[]` | Expression objects with `string`, `pattern` and `output` fields, written as given. |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

The SDK writes the objects without converting them, so call `toDict()` on each output yourself. This tool answers differently for each order status, and falls back to the webhook's output:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('check_order_status')
  .purpose('Check the status of an order')
  .parameter('order_id', 'string', 'Order ID', { required: true })
  .webhook('GET', 'https://api.store.example.com/orders/${enc:args.order_id}')
  .webhookExpressions([
    {
      string: '${status}',
      pattern: 'shipped',
      output: new FunctionResult(
        'Order ${args.order_id} has shipped. Tracking: ${tracking_number}'
      ).toDict(),
    },
    {
      string: '${status}',
      pattern: 'processing',
      output: new FunctionResult(
        'Order ${args.order_id} is being processed. Estimated ship date: ${est_ship_date}'
      ).toDict(),
    },
    {
      string: '${status}',
      pattern: 'delivered',
      output: new FunctionResult(
        'Order ${args.order_id} was delivered on ${delivery_date}.'
      ).toDict(),
    },
  ])
  .output(
    new FunctionResult('Order ${args.order_id} status: ${status}'),
  );
```

---

## Error Handling

### fallbackOutput

This method sets the `data_map`'s own `output`. The platform uses it when no expression matched and no webhook produced an output. Without one, the AI gets a generic error.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
fallbackOutput(result: FunctionResult): this
```

| Parameter | Type             | Description                                   |
|-----------|------------------|-----------------------------------------------|
| `result`  | `FunctionResult` | The fallback result.                          |

**Returns:** `this` for chaining.

The fallback's templates can read the arguments, but no response exists when it runs. This tool reports the price, or says the lookup failed:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('get_price')
  .purpose('Get the price of a product')
  .parameter('product', 'string', 'Product name', { required: true })
  .webhook('GET', 'https://api.store.example.com/price/${enc:args.product}')
  .output(new FunctionResult('${args.product} costs $${price}'))
  .fallbackOutput(
    new FunctionResult('The price lookup for ${args.product} failed. Offer to try again later.'),
  );
```

In `$${price}`, the first `$` is a literal dollar sign and `${price}` is the template.

---

### errorKeys

This method sets `error_keys` on the most recently added webhook. If the response contains any of these keys, the webhook counts as failed. The platform then moves on to the next webhook, then to the fallback output.

If no webhook has been added yet, the keys are set on the `data_map` itself, as `globalErrorKeys()` does.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
errorKeys(keys: string[]): this
```

| Parameter | Type       | Description                                        |
|-----------|------------|----------------------------------------------------|
| `keys`    | `string[]` | Response keys that mark the response as a failure. |

**Returns:** `this` for chaining.

This tool treats a response with an `error`, `error_message` or `fault` key as a failure:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('api_lookup')
  .purpose('Look up data from an API')
  .parameter('id', 'string', 'Record ID', { required: true })
  .webhook('GET', 'https://api.example.com/data/${enc:args.id}')
  .errorKeys(['error', 'error_message', 'fault'])
  .output(new FunctionResult('Found: ${name}'))
  .fallbackOutput(new FunctionResult('The lookup failed.'));
```

---

### globalErrorKeys

This method sets `error_keys` on the `data_map` object itself, whether or not a webhook has been added.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
globalErrorKeys(keys: string[]): this
```

| Parameter | Type       | Description                                        |
|-----------|------------|----------------------------------------------------|
| `keys`    | `string[]` | Response keys that mark a response as a failure.   |

**Returns:** `this` for chaining.

The SWML schema defines `error_keys` only on a webhook. Its `data_map` object has `expressions`, `webhooks` and `output`. SignalWire's reference doesn't describe a top-level `error_keys` either. To be sure a webhook checks a key, set it on that webhook with [errorKeys](#errorkeys). This example sets the keys on each webhook in a two-webhook chain:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('multi_api')
  .purpose('Call multiple APIs')
  .webhook('GET', 'https://api1.example.com/data')
  .errorKeys(['error', 'err'])
  .output(new FunctionResult('API 1: ${value}'))
  .webhook('GET', 'https://api2.example.com/data')
  .errorKeys(['error', 'err'])
  .output(new FunctionResult('API 2: ${value}'))
  .fallbackOutput(new FunctionResult('Both APIs failed.'));
```

---

## Iteration

### foreach

This method sets the `foreach` of the most recently added webhook. The platform walks an array in the response, expands a template once per element, and joins the results into one string for the output.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
foreach(config: {
  input_key: string;
  output_key: string;
  append: string;
  max?: number;
}): this
```

| Parameter           | Type     | Description                                                  |
|---------------------|----------|--------------------------------------------------------------|
| `config.input_key`  | `string` | The key in the response whose value is the array, such as `"orders"`. It's a key name, not a template. |
| `config.output_key` | `string` | Where the built text is stored. The output reads it as `${output_key}`. |
| `config.append`     | `string` | The template added once per element. `${this.field}` reads a field of the current element. |
| `config.max`        | `number` | Optional. The most elements to use, from the start of the array. |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

Inside `append`, the current element is `this`. After the loop, the text is stored under the `output_key` name, and the webhook's output reads it there. This tool lists a customer's recent orders:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('list_orders')
  .purpose('List recent orders for a customer')
  .parameter('customer_id', 'string', 'Customer ID', { required: true })
  .webhook('GET', 'https://api.store.example.com/customers/${enc:args.customer_id}/orders')
  .foreach({
    input_key: 'orders',
    output_key: 'order_list',
    append: 'Order #${this.id}: ${this.status} - $${this.total}\n',
    max: 5,
  })
  .output(
    new FunctionResult('Recent orders for customer ${args.customer_id}:\n${order_list}'),
  )
  .fallbackOutput(
    new FunctionResult('Could not retrieve orders for customer ${args.customer_id}.'),
  );
```

Suppose the API returns this response:

```json
{
  "orders": [
    { "id": "1001", "status": "shipped", "total": "29.99" },
    { "id": "1002", "status": "processing", "total": "49.50" },
    { "id": "1003", "status": "delivered", "total": "15.00" }
  ]
}
```

`${order_list}` then holds one line per order:

```text
Order #1001: shipped - $29.99
Order #1002: processing - $49.50
Order #1003: delivered - $15.00
```

---

## Environment Variables

### enableEnvExpansion

This method turns on `${ENV.NAME}` expansion for this DataMap. Expansion is a TypeScript SDK feature, not a platform one: the SDK replaces the template with a value from `process.env` before the definition reaches the SWML. It's off by default.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
enableEnvExpansion(enabled?: boolean): this
```

| Parameter | Type      | Default | Description                             |
|-----------|-----------|---------|-----------------------------------------|
| `enabled` | `boolean` | `true`  | Whether to turn expansion on. Calling the method with no argument turns it on. |

**Returns:** `this` for chaining.

With expansion on, `toSwaigFunction()` replaces every `${ENV.NAME}` in every string of the function definition. That includes the URL, headers, `params`, outputs, expressions and the description. Each replacement follows these rules:

- A name that starts with an [allowed prefix](#allowed-prefixes) becomes the variable's value, or an empty string if the variable isn't set.
- A name without an allowed prefix becomes an empty string. The SDK logs no warning.
- With expansion off, the SDK leaves `${ENV.NAME}` as text. The platform's template data has no `ENV` object.

Expansion runs when `toSwaigFunction()` is called. `registerWithAgent()` calls it at once, so the values are fixed at registration, not read again for each call. This tool reads its base URL and key from variables with the `SW_` prefix:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
// Set in the environment, for example through deployment config:
// SW_LOOKUP_BASE_URL=https://api.example.com
// SW_LOOKUP_API_KEY=a-long-random-key

const tool = new DataMap('secure_lookup')
  .purpose('Look up data from a secure API')
  .parameter('query', 'string', 'Search query', { required: true })
  .enableEnvExpansion()
  .webhook('GET', '${ENV.SW_LOOKUP_BASE_URL}/search?q=${enc:args.query}', {
    headers: {
      'Authorization': 'Bearer ${ENV.SW_LOOKUP_API_KEY}',
    },
  })
  .output(new FunctionResult('Result: ${data}'));
```

The expanded values are written into the SWML document. Anyone who can fetch the agent's SWML, which the agent's basic auth credentials allow, can read them, and SignalWire receives them with every call. Expansion keeps a secret out of your source code, not out of the SWML.

### Allowed prefixes

Only variables whose names start with an allowed prefix are expanded. The default prefixes are `SIGNALWIRE_`, `SWML_` and `SW_`.

The allowlist limits which variables a template can put into the SWML. Without it, a template such as `${ENV.DATABASE_PASSWORD}`, from a typo or from a definition someone else wrote, would publish any variable in the process. It doesn't protect variables that match a prefix: `${ENV.SIGNALWIRE_API_TOKEN}` is expanded like any other `SIGNALWIRE_` name.

Two functions set the list:

| Function | Scope |
|---|---|
| `setAllowedEnvPrefixes(prefixes)`, exported from the package | The default for every DataMap that has no list of its own. It's read when each DataMap's `toSwaigFunction()` runs. |
| `tool.setAllowedEnvPrefixes(prefixes)`, a `DataMap` method | This DataMap only, replacing the default. |

`getAllowedEnvPrefixes()` returns a copy of the default list. An empty array allows every variable, which removes the protection. Prefer adding a prefix to allowing everything. This example lets one DataMap read variables that start with `WEATHER_`:

```typescript
import { DataMap, FunctionResult } from '@signalwire/sdk';

const weather = new DataMap('get_weather')
  .purpose('Get current weather for a city')
  .parameter('city', 'string', 'The city name', { required: true })
  .enableEnvExpansion()
  .setAllowedEnvPrefixes(['WEATHER_'])
  .webhook('GET', 'https://api.weatherapi.com/v1/current.json?key=${ENV.WEATHER_API_KEY}&q=${lc:enc:args.city}')
  .output(new FunctionResult('${current.condition.text}, ${current.temp_f} degrees'));
```

The per-DataMap list replaces the default, so this DataMap no longer expands `SIGNALWIRE_`, `SWML_` or `SW_` names.

---

## Registration

### registerWithAgent

This method registers the DataMap tool with an agent. It calls `toSwaigFunction()` and passes the result to the agent's `registerSwaigFunction()` method.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
registerWithAgent(agent: {
  registerSwaigFunction(fn: Record<string, unknown>): unknown
}): this
```

| Parameter | Type     | Description                                        |
|-----------|----------|----------------------------------------------------|
| `agent`   | `object` | An object with a `registerSwaigFunction` method, such as an `AgentBase`. |

**Returns:** `this` for chaining.

This agent registers a time lookup and starts serving:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port): collides under the concurrent gate and cannot run standalone -->
```typescript
import { AgentBase, DataMap, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent', basicAuth: ['user', 'pass'] });

new DataMap('get_time')
  .purpose('Get the current time in a timezone')
  .parameter('timezone', 'string', 'IANA timezone, such as America/Chicago', { required: true })
  .webhook('GET', 'https://worldtimeapi.org/api/timezone/${args.timezone}')
  .output(new FunctionResult('Current time: ${datetime}'))
  .fallbackOutput(new FunctionResult('Could not get time for that timezone.'))
  .registerWithAgent(agent);

agent.run();
```

The timezone isn't URL-encoded, because its `/` is part of the URL path.

---

### toSwaigFunction

This method serializes the DataMap to the SWAIG function object that goes into the SWML document.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
toSwaigFunction(): Record<string, unknown>
```

**Returns:** A plain object with `function`, `description`, `parameters`, and `data_map` fields.

This example builds an expression tool and prints its definition:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
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

The script prints this definition:

```json
{
  "function": "echo",
  "description": "Echo back the input",
  "parameters": {
    "type": "object",
    "properties": {
      "text": {
        "type": "string",
        "description": "Text to echo"
      }
    },
    "required": [
      "text"
    ]
  },
  "data_map": {
    "expressions": [
      {
        "string": "${args.text}",
        "pattern": ".*",
        "output": {
          "response": "You said: ${args.text}"
        }
      }
    ]
  }
}
```

You can then register the definition yourself:

```typescript
agent.registerSwaigFunction(tool.toSwaigFunction());
```

---

## Helper Functions

### createSimpleApiTool

This function creates a DataMap tool with one webhook and one output template.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
import { createSimpleApiTool } from '@signalwire/sdk';

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
| `opts.name`             | `string`                   | None      | Tool name.                                        |
| `opts.url`              | `string`                   | None      | Webhook URL, with templates.                      |
| `opts.responseTemplate` | `string`                   | None      | The output's response text. Response fields are read from the root, as `${field}`. |
| `opts.parameters`       | `Record<string, {...}>`    | None      | Parameter definitions. A missing `type` is `string`. |
| `opts.method`           | `string`                   | `'GET'`   | HTTP method.                                      |
| `opts.headers`          | `Record<string, string>`   | None      | Request headers.                                  |
| `opts.body`             | `Record<string, unknown>`  | None      | Written with `body()`, as the webhook's `body` key. See [body](#body). |
| `opts.errorKeys`        | `string[]`                 | None      | Response keys that mark a failure.                |

**Returns:** A configured `DataMap` instance, ready for registration.

For a request body, build the tool with `DataMap` and [params](#params) instead of the `body` option. These two tools call a joke API and a document search API:

```typescript
import { createSimpleApiTool } from '@signalwire/sdk';

// A single GET endpoint that returns a JSON object
const jokeTool = createSimpleApiTool({
  name: 'get_joke',
  url: 'https://official-joke-api.appspot.com/random_joke',
  responseTemplate: 'Here is a joke: ${setup} ... ${punchline}',
});

agent.registerSwaigFunction(jokeTool.toSwaigFunction());

// With parameters, a header and error keys
const searchTool = createSimpleApiTool({
  name: 'search_docs',
  url: 'https://api.docs.example.com/search?q=${enc:args.query}&limit=${args.limit}',
  responseTemplate: 'Found ${total} results. Top result: ${results[0].title}',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
    limit: { type: 'integer', description: 'Max results' },
  },
  headers: {
    'Authorization': 'Bearer a-long-random-token',
  },
  errorKeys: ['error'],
});

agent.registerSwaigFunction(searchTool.toSwaigFunction());
```

---

### createExpressionTool

This function creates a DataMap tool from expressions alone, with no HTTP request.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
import { createExpressionTool } from '@signalwire/sdk';

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

| Parameter         | Type                                       | Description                                            |
|-------------------|--------------------------------------------|--------------------------------------------------------|
| `opts.name`       | `string`                                   | Tool name.                                             |
| `opts.patterns`   | `Record<string, [string, FunctionResult]>` | Map of test values to `[pattern, output]` tuples.      |
| `opts.parameters` | `Record<string, {...}>`                    | Parameter definitions.                                 |

Each key of `patterns` is a test value, usually a template, and each value is a `[regexPattern, result]` tuple. Because an object's keys are unique, each test value can have only one pattern. This tool checks a phone number's format:

```typescript
import { createExpressionTool, FunctionResult } from '@signalwire/sdk';

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

## Template Reference

SignalWire's platform expands these templates when it runs a `data_map` function. The SDK writes them into the SWML as text. The source is SignalWire's [data_map reference](https://signalwire.com/docs/swml/reference/calling/ai/swaig/functions/data-map) and [template functions reference](https://signalwire.com/docs/swml/reference/template-functions).

### Template data

Every template reads from one JSON object, the template data, which the platform builds for each call of the function. A template names a path from its root: `${args.city}` reads `city` inside `args`. The root holds these values:

- `args`: the arguments the AI extracted for this call, by parameter name. Example: `${args.city}`.
- `global_data`: the application's global data. Example: `${global_data.account_tier}`.
- `meta_data`: the function's metadata. Example: `${meta_data.table.sales}`.
- Details of the call: `call_id`, `ai_session_id`, `conversation_id`, `function`, `caller_id_name`, `caller_id_num`, `project_id`, `space_id` and `app_name`.

When a webhook responds, its JSON response joins the root. An object response's fields are read directly: a response of `{"total": 25, "results": [...]}` gives `${total}` and `${results[0].title}`. There is no `response.` prefix, and `${response.total}` expands to nothing. An array response is under `array`, as in `${array[0].joke}`.

During a `foreach`, `this` is the current element, as in `${this.title}`. The text it builds is stored under its `output_key`, as in `${order_list}`.

Which values exist depends on where the template is:

| Where the template is | What it can read |
|---|---|
| A webhook's `url` and `params` | `args`, `global_data`, `meta_data` and the call details. The response doesn't exist yet. |
| A webhook's `foreach`, `expressions` and `output` | All of those, plus the response's fields (or `array`) |
| A `foreach` `append` template | Also `this`, the current element |
| The `data_map`'s own `output` (the fallback) | `args`, `global_data`, `meta_data` and the call details |

### Template syntax

`${path}` is replaced by the value at `path` in the template data, and `%{path}` means the same. A path uses dots for object fields and zero-based `[n]` for array elements, as in `${args.filters.category}` and `${results[0].title}`. A path whose value isn't set becomes an empty string.

Inside `${...}`, a helper name and a colon before the path transform the value. The platform has two helpers:

| Helper | What it does | Example |
|---|---|---|
| `lc` | Lowercases the value | `${lc:args.department}` |
| `enc` | URL-encodes the value. SignalWire's reference writes it `enc:url`. | `${enc:args.query}` or `${enc:url:args.query}` |

There is no uppercase helper. Helpers chain from left to right: `${lc:enc:args.city}` lowercases the city, then URL-encodes it.

Templates nest, and expand from the inside out. In `${meta_data.contacts.${lc:args.department}}`, the inner template turns "Sales" into `sales`, and the outer one then reads `meta_data.contacts.sales`.

### Template functions

`@{...}` functions take arguments after a space. SignalWire's template functions reference documents these:

| Function | Syntax | What it does |
|---|---|---|
| `strftime_tz` | `@{strftime_tz <timezone> <format>}` | The current date and time in a time zone, with strftime codes: `@{strftime_tz America/Chicago %Y-%m-%d %H:%M:%S}` |
| `fmt_ph` | `@{fmt_ph <format> <number>}` or `@{fmt_ph <format>:sep:<separator> <number>}` | Formats a phone number as `national` (the default), `international`, `RFC3966` or `e164`, optionally with a separator between digit groups: `@{fmt_ph national:sep:- ${caller_id_num}}` |
| `expr` | `@{expr <expression>}` | Arithmetic on literal numbers, with `+ - * /` and parentheses. It can't read variables: `@{expr (100 - 25) / 5}` |
| `echo` | `@{echo <text>}` | Returns its argument, for debugging expansion: `@{echo ${args.input}}` |
| `separate` | `@{separate <text>}` | Puts a space between characters, so text-to-speech reads a code one character at a time: `@{separate ${args.code}}` |
| `sleep` | `@{sleep <seconds>}` | Pauses for that many seconds. A delay can make the function time out. |

Template functions work in SWAIG contexts: `data_map` expressions, webhooks and outputs, responses from SWAIG function webhooks, and AI prompt variable expansion.

---

## Testing a DataMap

`swaig-test --exec` runs a DataMap function locally. It makes the webhook requests and expands the templates the way [Template Reference](#template-reference) describes, so you can check a template before a real call. For the command and its options, see [DataMap Functions](cli-guide.md#datamap-functions) in the CLI guide.

This command runs the weather tool from `examples/datamap-tools.ts` against the real wttr.in API:

```bash
npx tsx src/cli/swaig-test.ts examples/datamap-tools.ts --exec get_weather --city London
```

The command prints the expanded response. The temperature and conditions depend on the day:

```text
RESULT:
Response: Weather in London: 61°F, Overcast
```

The simulator differs from the platform in several ways:

- A path that doesn't resolve shows as `<MISSING:path>`, where the platform writes an empty string. When the missing path starts with `response.`, the simulator prints a note that response fields are read from the root.
- It builds the arguments, but not global data, metadata or the call details. A template that reads them shows as missing.
- It accepts an argument without its `args.` prefix, as `${city}`. Write `${args.city}`, the form the platform documents.
- It leaves `@{...}` functions as they are.
- It matches patterns with JavaScript regular expressions, where the platform uses PCRE. Like the platform, it matches case-insensitively unless the pattern is written `/pattern/flags`, and it accepts a leading `(?i)`. Other PCRE-only syntax is reported as an invalid pattern.
- It sends `PUT`, `PATCH` and `DELETE` requests with that method, and a `POST`, `PUT` or `PATCH` request with a `body()` as its body. The platform sends a `GET`, or a `POST` when the method is `POST` or `params` is set, and its only body is `params`.
- It refuses private and internal addresses, unless `SWML_ALLOW_PRIVATE_URLS` is `true`.

---

## Complete Example

This agent registers the DataMap tools described in the earlier sections: a webhook tool with a `foreach` and error handling, and an expression tool. Each builder call is described in its own section: [webhook](#webhook), [foreach](#foreach), [errorKeys](#errorkeys), [fallbackOutput](#fallbackoutput) and [expression](#expression).

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port): collides under the concurrent gate and cannot run standalone -->
```typescript
import { AgentBase, DataMap, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({
  name: 'store-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'a-long-random-password',
  ],
});

agent.setPromptText('You help customers check their orders and validate their details.');

// A webhook tool: fetch the caller's orders and format them as a list.
new DataMap('list_orders')
  .purpose('List recent orders for the caller. Use when the caller asks about their orders.')
  .parameter('email', 'string', 'Customer email address', { required: true })
  .webhook('GET', 'https://api.store.example.com/orders?email=${enc:args.email}')
  .errorKeys(['error'])
  .foreach({
    input_key: 'orders',
    output_key: 'order_summary',
    append: '- Order #${this.id}: ${this.status}, Total: $${this.total}\n',
    max: 10,
  })
  .output(new FunctionResult('Recent orders:\n${order_summary}'))
  .fallbackOutput(new FunctionResult('No orders were found for ${args.email}.'))
  .registerWithAgent(agent);

// An expression tool: check a ZIP code's format without an HTTP request.
new DataMap('validate_zip')
  .purpose('Check whether a US ZIP code is well formed')
  .parameter('zip', 'string', 'ZIP code to validate', { required: true })
  .expression(
    '${args.zip}',
    '^\\d{5}(-\\d{4})?$',
    new FunctionResult('${args.zip} is a valid US ZIP code.'),
  )
  .expression(
    '${args.zip}',
    '.*',
    new FunctionResult('${args.zip} is not a valid US ZIP code. Ask the caller to repeat it.'),
  )
  .registerWithAgent(agent);

agent.run();
```

For a runnable file, see `examples/datamap-tools.ts` and `examples/advanced-datamap.ts`.
