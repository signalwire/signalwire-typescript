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
| `name`            | `string`   | Parameter name. A URL, `params`, the top-level expressions and the fallback output read it as `${args.name}`; a webhook's `output`, `expressions` and `foreach` read it as `${input.args.name}`. See [Template data](#template-data). |
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

This method adds an HTTP request for SignalWire to make when the tool is called. You can add more than one. The platform tries them in order and skips a webhook when none of its `require_args` is among the arguments. The first webhook it requests decides the result: if that webhook fails, the [fallback output](#fallbackoutput) answers, and later webhooks aren't tried.

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
| `method`                 | `string`                 | `method`               | HTTP method, uppercased. The SWML schema allows `GET`, `POST`, `PUT` and `DELETE`. The platform sends a `POST` when the method is `POST` or the webhook has `params`, and a `GET` for any other method. |
| `url`                    | `string`                 | `url`                  | The request URL. The platform expands templates in it, such as `${enc:args.city}`. |
| `opts.headers`           | `Record<string, string>` | `headers`              | HTTP headers for the request, sent as written. The platform expands no templates in them. |
| `opts.formParam`         | `string`                 | `form_param`           | The SWML schema's webhook object doesn't define this key. |
| `opts.inputArgsAsParams` | `boolean`                | `input_args_as_params` | If `true`, the platform merges the function's arguments into `params`. With no `params`, the arguments are the whole request body. |
| `opts.requireArgs`       | `string[]`               | `require_args`         | Arguments that decide whether the platform makes this request. It skips the webhook, and tries the next one, unless at least one of them is present. The SWML schema and the platform name the key `require_args`, and SignalWire's reference page lists it as `required_args`. |

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

This method sets the `params` object of the most recently added webhook. The platform sends `params` as the request's JSON body, and expands templates in its values first. A webhook with `params` is a `POST`, whatever its method. A webhook with no `params` sends no body, even as a `POST`.

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

This method sets the request body of the most recently added webhook. It does the same as [params](#params): the platform reads a webhook's body from its `params` field, so `body()` writes `params`, and a later `params()` or `body()` call replaces it.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
body(data: Record<string, unknown>): this
```

| Parameter | Type                       | Description                |
|-----------|----------------------------|----------------------------|
| `data`    | `Record<string, unknown>`  | The request body object, written as the webhook's `params`. Values can contain templates. |

**Throws:** `Error` if no webhook has been added yet.

**Returns:** `this` for chaining.

`createSimpleApiTool()` uses `body()` for its `body` option.

> **Upgrading:** before this release, `body()` wrote a `body` key, which the platform doesn't read, so the webhook was sent without a request body (and as a `GET` unless its method was `POST`). It now writes `params`, so the body is sent and the request is a `POST`. If a tool called both `body()` and `params()`, only the later call's object is sent now; merge them into one object. A hand-written `body` key in a `data_map` is still not sent.

---

### Webhook Headers

You set headers through the `opts.headers` parameter of `webhook()`. The platform sends each header value as written: it expands templates in `url` and `params`, not in headers, so `${args.id}` in a header is sent as that text. The SDK expands `${ENV.*}` in header values when environment expansion is on, before the SWML is sent. This tool sends a token from the environment:

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
| `pattern`       | `string \| RegExp`    | The regular expression, written as `pattern`. It matches case-insensitively unless written as `/pattern/`. For a `RegExp`, only `.source` is kept: its flags are dropped. |
| `output`        | `FunctionResult`      | The result when the pattern matches. Written as `output`. |
| `nomatchOutput` | `FunctionResult`      | The result when the pattern doesn't match. Written as `nomatch-output`, which the platform reads. The SWML schema's expression object doesn't define this key. |

**Returns:** `this` for chaining.

The platform wraps a pattern that doesn't start with `/` as `/pattern/i`, so matching is case-insensitive by default: `'star\\s*wars'` matches "Star Wars". To match case-sensitively, write the pattern as `'/pattern/'`, such as `'/^[A-Z]{3}$/'`. A pattern written as `/pattern/flags` takes only its own `i` and `s` flags.

Expressions are tried in order, and the first match's output ends the function. An expression with a `nomatchOutput` also ends it when its pattern doesn't match, so later expressions aren't tried. For an answer when nothing matches, add a last expression with a catch-all pattern, or a [fallbackOutput](#fallbackoutput). This tool classifies input with a final catch-all:

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

The platform matches case-insensitively, so "What time is it" counts as a question. The `lc` helper lowercases the input as well, so the match doesn't depend on that.

---

## Response Processing

### output

This method sets the output of the most recently added webhook. The output's templates read the webhook's JSON response from the root of the template data, such as `${temp}`, and the arguments as `${input.args.name}`. An array response is under `array`. `${args.name}` expands to nothing here. See [Template data](#template-data).

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
      'Weather in ${input.args.city}: ' +
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

The SDK writes the objects without converting them, so call `toDict()` on each output yourself. Like the output, the expressions read the response from the root and the arguments as `${input.args.name}`. This tool answers differently for each order status, and falls back to the webhook's output:

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
        'Order ${input.args.order_id} has shipped. Tracking: ${tracking_number}'
      ).toDict(),
    },
    {
      string: '${status}',
      pattern: 'processing',
      output: new FunctionResult(
        'Order ${input.args.order_id} is being processed. Estimated ship date: ${est_ship_date}'
      ).toDict(),
    },
    {
      string: '${status}',
      pattern: 'delivered',
      output: new FunctionResult(
        'Order ${input.args.order_id} was delivered on ${delivery_date}.'
      ).toDict(),
    },
  ])
  .output(
    new FunctionResult('Order ${input.args.order_id} status: ${status}'),
  );
```

---

## Error Handling

### fallbackOutput

This method sets the `data_map`'s own `output`. The platform uses it when no expression matched and no webhook produced a result: the webhook it requested failed, it requested none, or the webhook's expressions didn't match and it has no output. Without one, the AI gets the generic "There was an error processing this request."

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
fallbackOutput(result: FunctionResult): this
```

| Parameter | Type             | Description                                   |
|-----------|------------------|-----------------------------------------------|
| `result`  | `FunctionResult` | The fallback result.                          |

**Returns:** `this` for chaining.

The fallback's templates read the arguments as `${args.name}`, and no response exists when it runs. This tool reports the price, or says the lookup failed:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('get_price')
  .purpose('Get the price of a product')
  .parameter('product', 'string', 'Product name', { required: true })
  .webhook('GET', 'https://api.store.example.com/price/${enc:args.product}')
  .output(new FunctionResult('${input.args.product} costs $${price}'))
  .fallbackOutput(
    new FunctionResult('The price lookup for ${args.product} failed. Offer to try again later.'),
  );
```

In `$${price}`, the first `$` is a literal dollar sign and `${price}` is the template.

---

### errorKeys

This method sets `error_keys` on the most recently added webhook. If the JSON response has any of these keys, the webhook counts as failed, whatever the key's value: `"errors": []` fails it. The platform then uses the fallback output, and doesn't try the next webhook. A response that isn't JSON, or a request that doesn't complete, fails the webhook the same way. An HTTP status outside 200-299 doesn't fail it by itself: the platform adds an `http_code` key to such a response, which the output can read as `${http_code}`, so `'http_code'` in the list fails the webhook on any such status.

If no webhook has been added yet, the keys are set on the `data_map` itself, as `globalErrorKeys()` does, and the platform ignores them there.

<!-- snippet: no-compile API signature / illustrative fragment, not runnable -->
```typescript
errorKeys(keys: string[]): this
```

| Parameter | Type       | Description                                        |
|-----------|------------|----------------------------------------------------|
| `keys`    | `string[]` | Response keys whose presence marks the response as a failure. |

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
| `keys`    | `string[]` | Response keys whose presence marks a response as a failure. |

**Returns:** `this` for chaining.

The SWML schema defines `error_keys` only on a webhook. Its `data_map` object has `expressions`, `webhooks` and `output`, and the platform reads `error_keys` only on a webhook, so a top-level `error_keys` has no effect. Set the keys on each webhook with [errorKeys](#errorkeys) instead. This example sets them on each webhook of a two-webhook chain, where `requireArgs` picks the webhook for the arguments the caller gave:

<!-- snippet: no-run illustrative fragment: references the assumed `DataMap` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const tool = new DataMap('find_store')
  .purpose('Find the nearest store by ZIP code or by city')
  .parameter('zip', 'string', 'ZIP code')
  .parameter('city', 'string', 'City name')
  .webhook('GET', 'https://api.stores.example.com/near?zip=${enc:args.zip}', {
    requireArgs: ['zip'],
  })
  .errorKeys(['error', 'err'])
  .output(new FunctionResult('The nearest store is ${name}.'))
  .webhook('GET', 'https://api.stores.example.com/near?city=${enc:args.city}', {
    requireArgs: ['city'],
  })
  .errorKeys(['error', 'err'])
  .output(new FunctionResult('The nearest store is ${name}.'))
  .fallbackOutput(new FunctionResult('The store lookup failed.'));
```

With a ZIP code, the platform requests the first webhook. With only a city, it skips the first webhook and requests the second. If the webhook it requests fails, the fallback output answers.

---

## Iteration

### foreach

This method sets the `foreach` of the most recently added webhook. The platform walks an array in the response, expands a template once per element, and joins the results into one string for the output. It skips a `foreach` that lacks `input_key`, `output_key` or `append`.

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
| `config.input_key`  | `string` | The path to the array in the webhook's template data, such as `"orders"` or `"data.items"`. It's a path, not a template. |
| `config.output_key` | `string` | Where the built text is stored. The output reads it as `${output_key}`. |
| `config.append`     | `string` | The template added once per element. `${this.field}` reads a field of an object element, and `${this}` is a string or number element itself. It can also read the response and `${input.args.name}`. |
| `config.max`        | `number` | Optional. The most elements to use, from the start of the array. With no `max`, or 0, every element is used. |

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
    new FunctionResult('Recent orders for customer ${input.args.customer_id}:\n${order_list}'),
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

`toSwaigFunction()` always writes `expressions` and `webhooks` as lists. A `data_map` you write by hand can give either one as a single object instead. The platform runs a single expression object as a one-element list. A single webhook object runs differently from a list: the platform doesn't check its `require_args` or its `error_keys`, and a response that isn't JSON or a request that doesn't complete doesn't fail it. Its `foreach`, `expressions` and `output` then read the error response: `${parse_error}` is `true`, `${raw_response}` is the body, and `${http_code}` is the status, or `0` when the request didn't complete. Like a webhook in a list, it needs an `output` or `expressions`. `swaig-test --exec` runs both forms as the platform does.

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
| `opts.responseTemplate` | `string`                   | None      | The output's response text. Response fields are read from the root, as `${field}`, and arguments as `${input.args.name}`. |
| `opts.parameters`       | `Record<string, {...}>`    | None      | Parameter definitions. A missing `type` is `string`. |
| `opts.method`           | `string`                   | `'GET'`   | HTTP method. The platform sends a `GET` unless it's `POST` or the tool has a `body`. |
| `opts.headers`          | `Record<string, string>`   | None      | Request headers.                                  |
| `opts.body`             | `Record<string, unknown>`  | None      | The request body, written as the webhook's `params` with `body()`. A tool with a body is sent as a `POST`. See [params](#params). |
| `opts.errorKeys`        | `string[]`                 | None      | Response keys that mark a failure.                |

**Returns:** A configured `DataMap` instance, ready for registration.

These two tools call a joke API and a document search API:

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

Every template reads from a JSON object, the template data, which the platform builds for each call of the function. A template names a path from its root: `${args.city}` reads `city` inside `args`. Which object that is depends on the stage the template is in.

The first object is the call data. Its root holds these values:

- `args`: the arguments the AI extracted for this call, by parameter name. Example: `${args.city}`.
- `global_data`: the application's global data. Example: `${global_data.account_tier}`.
- `meta_data`: the function's metadata. Example: `${meta_data.table.sales}`.
- The prompt variables, at the root.
- Details of the call: `call_id`, `ai_session_id`, `conversation_id`, `function`, `caller_id_name`, `caller_id_num`, `project_id`, `space_id` and `app_name`.

When a webhook responds, its `foreach`, `expressions` and `output` read a second object, built from the response. An object response's fields are at its root: a response of `{"total": 25, "results": [...]}` gives `${total}` and `${results[0].title}`. There is no `response.` prefix, and `${response.total}` expands to nothing. An array response is under `array`, as in `${array[0].joke}`. The call data is under `input`, so the arguments are `${input.args.city}`, and `${args.city}` expands to nothing. The object also has `global_data` and `prompt_vars`. A status outside 200-299 is under `http_code`.

Each stage reads these values:

| Where the template is | What it reads | The arguments |
|---|---|---|
| A webhook's `url` and `params` | The call data. The response doesn't exist yet. | `${args.name}` |
| A webhook's `headers` | Nothing: the platform sends header values as written | None |
| The top-level `expressions` | The call data | `${args.name}` |
| A webhook's `foreach`, `expressions` and `output` | The response's fields (or `array`), `input` (the call data), `global_data`, `prompt_vars`, and `http_code` for a status outside 200-299 | `${input.args.name}` |
| A `foreach` `append` template | The same as the webhook's output, plus `this`, the current element | `${input.args.name}` |
| The `data_map`'s own `output` (the fallback) | The call data, plus `global_data` and `prompt_vars` | `${args.name}` |

During a `foreach`, `this` is the current element: `${this.title}` for a field of an object, and `${this}` for a string or number. The text it builds is stored under its `output_key`, as in `${order_list}`, which the webhook's `expressions` and `output` read.

### Template syntax

`${path}` is replaced by the value at `path` in the template data, and `%{path}` means the same. A path uses dots for object fields and zero-based `[n]` for array elements, as in `${args.filters.category}` and `${results[0].title}`. A negative index counts from the end: `${results[-1].title}` is the last element. A path whose value isn't set becomes an empty string.

Inside `${...}`, a helper name and a colon before the path transform the value. The platform has three helpers, and matches their names in any case:

| Helper | What it does | Example |
|---|---|---|
| `lc` | Lowercases the value | `${lc:args.department}` |
| `enc` | URL-encodes the value: spaces, control and non-ASCII characters, and ``"#%&+:;<=>?@[\]^`{\|}`` become `%XX`. Other characters, such as `/`, `,` and `$`, stay as they are, and a `%` that already starts an uppercase `%XX` isn't encoded again. | `${enc:args.query}` |
| `fmt_ph` | Formats a phone number in national format, as it is dialed within its country. A number without a country code is read as a US number, and a value that isn't a valid number becomes `INVALID NUMBER`. | `${fmt_ph:args.phone}` |

Helpers combine, as in `${lc:enc:args.city}`. The platform applies them in a fixed order, whatever order you write them in: `fmt_ph`, then `lc`, then `enc`. So `${lc:enc:args.city}` and `${enc:lc:args.city}` both lowercase the city, then URL-encode it.

There is no uppercase helper, and `enc` takes no encoding name. Any other name before a colon is part of the path: in `${enc:url:args.query}`, the platform reads the path `url:args.query`, which doesn't resolve, so it writes nothing.

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

The simulator follows the platform's stage template data and webhook rules, described in [Template data](#template-data) and [errorKeys](#errorkeys). It differs from the platform in several ways:

- A path that doesn't resolve shows as `<MISSING:path>`, where the platform writes an empty string. When the missing path starts with `response.`, the simulator prints a note that response fields are read from the root. When `${args.name}` is missing in a webhook's output, expressions or `foreach`, it prints a note to write `${input.args.name}`.
- It builds the arguments and the function name, but not global data, metadata, prompt variables or the call details. A template that reads them shows as missing.
- It matches keys exactly, where the platform matches them case-insensitively.
- It leaves `@{...}` functions as they are, and doesn't evaluate an expression's `expr`.
- It matches patterns with JavaScript regular expressions, where the platform uses PCRE. Like the platform, it matches case-insensitively unless the pattern is written `/pattern/flags`, and it accepts a leading `(?i)`. Other PCRE-only syntax is reported as an invalid pattern.
- When nothing produces a result and there is no fallback output, it returns an error object and `swaig-test` exits with status 1. The platform answers "There was an error processing this request."
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
