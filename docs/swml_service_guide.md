# SignalWire SWML Service Guide

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const SWMLService: typeof import('@signalwire/sdk').SWMLService;
  const SwmlBuilder: typeof import('@signalwire/sdk').SwmlBuilder;
  const service: import('@signalwire/sdk').SWMLService;
}
```

## Table of Contents
- [Introduction](#introduction)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Logging](#logging)
- [SWML Document Creation](#swml-document-creation)
- [Verb Handling](#verb-handling)
- [Web Service Features](#web-service-features)
- [Custom Routing Callbacks](#custom-routing-callbacks)
- [Advanced Usage](#advanced-usage)
- [API Reference](#api-reference)
- [Examples](#examples)

## Introduction

The `SWMLService` class is a foundation for creating and serving SignalWire Markup Language (SWML) documents. It is the base class for `AgentBase` and handles common tasks such as:

- SWML document creation and manipulation
- Schema validation
- HTTP serving (built on [Hono](https://hono.dev/))
- Authentication
- Structured logging

Use `SWMLService` when you need a SignalWire call flow but don't need AI — plain call
routing, IVR-style trees, recording workflows, static playback, etc. For AI-powered voice
agents, use [`AgentBase`](agent-guide.md) instead.

## Installation

The `SWMLService` class is part of the SignalWire AI Agents SDK:

```bash
npm install @signalwire/sdk
```

It requires Node.js >= 22.

## Basic Usage

Here's a simple SWML service that subclasses `SWMLService` and builds a static document:

```typescript
import { SWMLService } from '@signalwire/sdk';

class SimpleVoiceService extends SWMLService {
  constructor() {
    super({ name: 'voice-service', route: '/voice', port: 3000 });
    this.buildDocument();
  }

  buildDocument(): void {
    // Reset the document to start fresh
    this.resetDocument();

    // Add verbs to the main section
    this.addVerb('answer', {});
    this.addVerb('play', { url: 'say:Hello, thank you for calling our service.' });
    this.addVerb('hangup', {});
  }
}

// Create and start the service
const service = new SimpleVoiceService();
await service.serve();
```

You can also build documents with the fluent `SwmlBuilder` returned by `getBuilder()`:

```typescript
const service = new SWMLService({ name: 'greeter', route: '/', port: 3000 });
service
  .getBuilder()
  .answer()
  .play({ url: 'https://cdn.example.com/welcome.mp3' })
  .hangup();

await service.serve();
```

## Logging

Every `SWMLService` instance exposes a structured logger on the public `log` property.
Logging is configured globally by the SDK's `Logger` module.

### Using the Logger

<!-- snippet: no-compile fragment from inside an SWMLService subclass method; uses `this.log` / `document` -->
```typescript
// Basic logging
this.log.info('service_started');

// Logging with context
this.log.debug('document_created', { size: document.length });

// Error logging
try {
  // Some operation
} catch (e) {
  this.log.error('operation_failed', { error: String(e) });
}
```

### Log Levels

The following log levels are available (in increasing order of severity):
- `debug`: Detailed information for debugging
- `info`: General information about operation
- `warn`: Warning about potential issues
- `error`: Error information when operations fail

### Controlling Log Output

Logging is configured via environment variables and the `Logger` helper functions:

```bash
export SIGNALWIRE_LOG_LEVEL=warn   # debug | info | warn | error
export SIGNALWIRE_LOG_MODE=off     # set to "off" to suppress all logging
```

```typescript
import { setGlobalLogLevel, suppressAllLogs } from '@signalwire/sdk';

setGlobalLogLevel('warn');  // Only show warnings and above
suppressAllLogs(true);      // Suppress everything
```

## SWML Document Creation

`SWMLService` provides methods for creating and manipulating SWML documents.

### Document Structure

SWML documents have the following basic structure (output keys are `snake_case`, the
platform format):

```json
{
  "version": "1.0.0",
  "sections": {
    "main": [
      { "verb1": { } },
      { "verb2": { } }
    ],
    "section1": [
      { "verb3": { } }
    ]
  }
}
```

### Document Methods

- `resetDocument()`: Reset the document to an empty state
- `addVerb(verbName, config)`: Add a verb to the main section
- `addSection(sectionName)`: Add a new section
- `addVerbToSection(sectionName, verbName, config)`: Add a verb to a specific section
- `getDocument()`: Get the current document as an object
- `renderDocument()`: Get the current document as a JSON string
- `getBuilder()`: Get the underlying `SwmlBuilder` for fluent verb methods

## Verb Handling

`SWMLService` validates SWML verbs against the bundled SignalWire schema.

### Verb Validation

When you add a verb, the service validates it against the schema to ensure it has the
correct structure and parameters. An invalid config throws an error:

<!-- snippet: no-compile fragment from inside an SWMLService subclass method; uses `this.addVerb` -->
```typescript
// This validates the configuration against the schema
this.addVerb('play', { url: 'say:Hello, world!', volume: 5 });

// This would throw a validation error (invalid parameter)
this.addVerb('play', { invalid_param: 'value' });
```

Validation can be disabled via the `schemaValidation: false` constructor option or the
`SWML_SKIP_SCHEMA_VALIDATION=true` environment variable.

### Custom Verb Handlers

You can register custom verb handlers for specialized verb processing by implementing the
`SWMLVerbHandler` interface and registering it via `registerVerbHandler()`:

```typescript
import { SWMLVerbHandler } from '@signalwire/sdk';

const customPlayHandler: SWMLVerbHandler = {
  getVerbName: () => 'play',
  validateConfig: (config) => [true, []], // [isValid, errorMessages]
  buildConfig: (kwargs) => kwargs,
};

service.registerVerbHandler(customPlayHandler);
```

## Web Service Features

`SWMLService` includes built-in HTTP serving for SWML documents.

### Endpoints

By default, a service provides the following endpoints:

- `GET /{route}`: Return the SWML document
- `POST /{route}`: Process request data and return the SWML document
- `GET /{route}/swaig` and `POST /{route}/swaig`: SWAIG function dispatch
- `GET /health`, `GET /ready`: Health and readiness checks

Where `{route}` is the route path specified when creating the service.

### Authentication

Basic authentication is available for all endpoints. Provide credentials via the
constructor, or set the environment variables. When credentials are auto-generated
(neither provided nor in the environment), they are available via
`getBasicAuthCredentials()` but not enforced on HTTP requests.

```typescript
const service = new SWMLService({
  name: 'my-service',
  basicAuth: ['username', 'password'],
});
```

Environment variables:
- `SWML_BASIC_AUTH_USER`
- `SWML_BASIC_AUTH_PASSWORD`

### Dynamic SWML Generation

Override the protected `buildSwmlForRequest()` hook to fully replace the document for a
request, or use `setOnRequestCallback()`. The hook returns a `SwmlBuilder` (whose document
is sent), or `null` to fall through to the static document:

```typescript
import { SWMLService, SwmlBuilder } from '@signalwire/sdk';

class DynamicService extends SWMLService {
  protected override buildSwmlForRequest(
    queryParams: Record<string, string>,
    bodyParams: Record<string, unknown>,
    headers: Record<string, string>,
  ): SwmlBuilder | null {
    const builder = new SwmlBuilder();
    builder.answer();

    // Customize the document based on request data
    if (bodyParams['caller_type'] === 'vip') {
      builder.play({ url: 'say:Welcome VIP caller!' });
    } else {
      builder.play({ url: 'say:Welcome caller!' });
    }

    return builder;
  }
}
```

Alternatively, register a per-request callback:

```typescript
service.setOnRequestCallback((queryParams, bodyParams, headers) => {
  const builder = new SwmlBuilder();
  builder.answer().play({ url: 'say:Hello!' }).hangup();
  return builder;
});
```

## Custom Routing Callbacks

`SWMLService` lets you register routing callbacks that examine incoming requests and decide
where they should be routed.

### Registering a Routing Callback

Use `registerRoutingCallback()` to register a function called when a request arrives at a
specific path. If it returns a string, the response is a 307 redirect to that route; if it
returns `null`, normal SWML serving continues:

```typescript
import type { SwmlRequestData } from '@signalwire/sdk';

function myRoutingCallback(body: SwmlRequestData): string | null {
  // Route based on a field in the request body
  if (body['customer_id']) {
    return `/customer/${body['customer_id']}`;
  }
  // Process request normally
  return null;
}

// Register the callback for a specific path
service.registerRoutingCallback(myRoutingCallback, '/customer');
```

### How Routing Works

1. When a request is received at the registered path, the routing callback runs.
2. The callback inspects the request body and decides whether to redirect.
3. If it returns a route string, the request is redirected with HTTP 307 (temporary redirect).
4. If it returns `null`, the request is processed normally and the static SWML is returned.

### Example: Multi-Section Service

Here's a service that uses routing callbacks to handle different types of requests:

```typescript
import { SWMLService } from '@signalwire/sdk';
import type { SwmlRequestData } from '@signalwire/sdk';

class MultiSectionService extends SWMLService {
  constructor() {
    super({ name: 'multi-section', route: '/main' });

    // Build the main document
    this.resetDocument();
    this.addVerb('answer', {});
    this.addVerb('play', { url: 'say:Hello from the main service!' });
    this.addVerb('hangup', {});

    // Register customer and product routes
    this.registerCustomerRoute();
    this.registerProductRoute();
  }

  registerCustomerRoute(): void {
    const customerCallback = (body: SwmlRequestData): string | null => {
      if (body['customer_id']) {
        this.log.info('processing_customer', { customerId: body['customer_id'] });
      }
      return null;
    };
    this.registerRoutingCallback(customerCallback, '/customer');

    // Create the customer SWML section
    this.addSection('customer_section');
    this.addVerbToSection('customer_section', 'answer', {});
    this.addVerbToSection('customer_section', 'play', { url: 'say:Welcome to customer service!' });
    this.addVerbToSection('customer_section', 'hangup', {});
  }

  registerProductRoute(): void {
    const productCallback = (body: SwmlRequestData): string | null => {
      if (body['product_id']) {
        this.log.info('processing_product', { productId: body['product_id'] });
      }
      return null;
    };
    this.registerRoutingCallback(productCallback, '/product');

    // Create the product SWML section
    this.addSection('product_section');
    this.addVerbToSection('product_section', 'answer', {});
    this.addVerbToSection('product_section', 'play', { url: 'say:Welcome to product support!' });
    this.addVerbToSection('product_section', 'hangup', {});
  }
}
```

## Advanced Usage

### Mounting into a Larger App

`getApp()` returns the underlying Hono app so you can mount the service into a larger
application. `asRouter()` is a cross-SDK-friendly alias that returns the same app:

```typescript
import { Hono } from 'hono';

const app = new Hono();
const service = new SWMLService({ name: 'my-service' });
app.route('/voice', service.getApp());
```

### Schema Path Customization

You can specify a custom path to the SWML schema file:

```typescript
const service = new SWMLService({
  name: 'my-service',
  schemaPath: '/path/to/schema.json',
});
```

## API Reference

### Constructor Options (`SWMLServiceOptions`)

- `name`: Service name/identifier (required)
- `route`: HTTP route path (default `'/'`)
- `host`: Host to bind to (default `'0.0.0.0'`)
- `port`: Port to bind to (default `PORT` env var or 3000)
- `basicAuth`: Optional `[username, password]` tuple
- `schemaPath`: Optional path to a custom SWML schema JSON file
- `configFile`: Optional path to a security configuration file
- `schemaValidation`: Enable schema validation (default `true`)

### Document Methods

- `resetDocument()`
- `addVerb(verbName, config)`
- `addSection(sectionName)`
- `addVerbToSection(sectionName, verbName, config)`
- `getDocument()`
- `renderDocument()`
- `getBuilder()`

### Service Methods

- `getApp()`: Get the underlying Hono app
- `asRouter()`: Alias for `getApp()` (cross-SDK parity)
- `serve(host?, port?, opts?)`: Start the HTTP(S) server
- `stop()`: Stop the server
- `getBasicAuthCredentials(includeSource?)`: Get the basic-auth credentials
- `setOnRequestCallback(cb)`: Set a per-request SWML-builder callback
- `registerVerbHandler(handler)`: Register a custom verb handler
- `registerRoutingCallback(callbackFn, path?)`: Register a request-routing callback
- `manualSetProxyUrl(url)`: Manually set the proxy base URL for webhook URLs

## Examples

### Basic Voicemail Service

```typescript
import { SWMLService } from '@signalwire/sdk';

class VoicemailService extends SWMLService {
  constructor() {
    super({ name: 'voicemail', route: '/voicemail', port: 3000 });
    this.buildVoicemailDocument();
  }

  buildVoicemailDocument(): void {
    this.resetDocument();
    this.addVerb('answer', {});
    this.addVerb('play', {
      url: "say:Hello, you've reached the voicemail service. Please leave a message after the beep.",
    });
    this.addVerb('play', { url: 'https://example.com/beep.wav' });
    this.addVerb('record', {
      format: 'mp3',
      stereo: false,
      max_length: 120, // 2 minutes max
      terminators: '#',
    });
    this.addVerb('play', { url: 'say:Thank you for your message. Goodbye!' });
    this.addVerb('hangup', {});
    this.log.debug('voicemail_document_built');
  }
}
```

### Dynamic Call Routing Service

```typescript
import { SWMLService, SwmlBuilder } from '@signalwire/sdk';

class CallRouterService extends SWMLService {
  protected override buildSwmlForRequest(
    queryParams: Record<string, string>,
    bodyParams: Record<string, unknown>,
  ): SwmlBuilder | null {
    const department = String(bodyParams['department'] ?? '').toLowerCase();
    if (!department) {
      this.log.debug('no_department_using_default');
      return null;
    }

    const builder = new SwmlBuilder();
    builder.answer();
    builder.play({
      url: `say:Thank you for calling our ${department} department. Please hold.`,
    });

    const phoneNumbers: Record<string, string> = {
      sales: '+15551112222',
      support: '+15553334444',
      billing: '+15555556666',
    };
    const toNumber = phoneNumbers[department] ?? '+15559990000';

    builder.connect({ to: toNumber, timeout: 30, answer_on_bridge: true });
    builder.play({
      url: "say:We're sorry, but all of our agents are currently busy. Please try again later.",
    });
    builder.hangup();

    return builder;
  }
}
```

For more examples, see the `examples` directory in the SignalWire AI Agents SDK repository.
