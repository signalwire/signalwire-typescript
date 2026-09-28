# SignalWire SWML Service Guide

`SWMLService` builds a SWML document from verbs and serves it over HTTP. This guide covers building documents, serving them, authentication, dynamic documents and routing callbacks.

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

`SWMLService` creates and serves SignalWire Markup Language (SWML) documents, the JSON call-flow instructions SignalWire runs on a call. `AgentBase` extends it, so an agent has the same document, serving and routing methods, plus the AI verb and its tools. `SWMLService` handles these tasks:

- SWML document creation and manipulation
- Schema validation of each verb
- HTTP serving (built on [Hono](https://hono.dev/))
- Basic authentication
- Structured logging

Use `SWMLService` for a call flow that doesn't need AI: call routing, IVR-style menus, recording, or playback. For an AI voice agent, use [`AgentBase`](agent-guide.md) instead.

## Installation

The `SWMLService` class is part of the SignalWire SDK package:

```bash
npm install @signalwire/sdk
```

The package requires Node.js 22 or later.

## Basic Usage

This service subclasses `SWMLService` and builds a static document in its constructor:

<!-- snippet: no-run starts a blocking HTTP server via service.serve() -->
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

The service answers `GET` and `POST` on `/voice` with the document. SignalWire requests a document with a `POST`; a `GET` works too, which is handy for testing with a browser or `curl`.

You can also build the document with the `SwmlBuilder` that `getBuilder()` returns. It has a method for each verb in the SWML schema, and each returns the builder:

<!-- snippet: no-run starts a blocking HTTP server via service.serve() -->
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

Every `SWMLService` instance has a logger on its public `log` property. The SDK's `Logger` module configures logging for the whole process.

### Using the Logger

A subclass method logs through `this.log`, with optional data:

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

The logger has four levels, in increasing order of severity:
- `debug`: Detailed information for debugging
- `info`: General information about operation
- `warn`: Warning about potential issues
- `error`: Error information when operations fail

### Controlling Log Output

Environment variables set the level and mode when the process starts:

```bash
export SIGNALWIRE_LOG_LEVEL=warn   # debug | info | warn | error
export SIGNALWIRE_LOG_MODE=off     # off | stderr | auto
```

The `Logger` functions change them at runtime:

```typescript
import { setGlobalLogLevel, suppressAllLogs } from '@signalwire/sdk';

setGlobalLogLevel('warn');  // Only show warnings and errors
suppressAllLogs(true);      // Suppress everything
```

For the log format, colors and the other settings, see [Logging](configuration.md#logging) in the configuration guide.

## SWML Document Creation

`SWMLService` has methods to create and change its SWML document.

### Document Structure

A SWML document has a `version` and named `sections`. The call starts at `main`:

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

A `transfer` or `execute` verb with a section name as its `dest` moves the call to that section. The SWML schema bundled with the SDK (`src/schema.json`) describes both verbs.

### Document Methods

These methods build and read the document:

- `resetDocument()`: Reset the document to an empty `main` section
- `addVerb(verbName, config)`: Add a verb to the main section
- `addSection(sectionName)`: Add an empty section, if it doesn't exist
- `addVerbToSection(sectionName, verbName, config)`: Add a verb to a section, creating the section if needed
- `getDocument()`: Get the current document as an object
- `renderDocument()`: Get the current document as a JSON string
- `getBuilder()`: Get the underlying `SwmlBuilder`, which has a method for each verb

## Verb Handling

`SWMLService` validates each verb against the SWML schema bundled with the SDK.

### Verb Validation

`addVerb()` and `addVerbToSection()` check the verb name and its configuration against the schema. An unknown verb, an unknown property or a wrong type throws a `SchemaValidationError`:

<!-- snippet: no-compile fragment from inside an SWMLService subclass method; uses `this.addVerb` -->
```typescript
// Valid: play takes a url and a volume
this.addVerb('play', { url: 'say:Hello, world!', volume: 5 });

// Throws: play has no invalid_param property
this.addVerb('play', { invalid_param: 'value' });
```

The second call throws with this message:

```text
Schema validation failed for 'play': Schema validation error for 'play': /play unknown property 'invalid_param'
```

Set `SWML_SKIP_SCHEMA_VALIDATION=true` to turn validation off. The `schemaValidation: false` and `schemaPath` constructor options set the service's `schemaUtils` property, but `addVerb()` doesn't read it: it still validates against the bundled schema.

### Custom Verb Handlers

`registerVerbHandler()` stores an object that implements the `SWMLVerbHandler` interface in the service's `verbRegistry`, keyed by verb name:

<!-- snippet: no-run illustrative fragment: references the assumed `service` object established earlier on the page -->
```typescript
import type { SWMLVerbHandler } from '@signalwire/sdk';

const customPlayHandler: SWMLVerbHandler = {
  getVerbName: () => 'play',
  validateConfig: (config) => [true, []], // [isValid, errorMessages]
  buildConfig: (kwargs) => kwargs,
};

service.registerVerbHandler(customPlayHandler);
const handler = service.verbRegistry.getHandler('play');
```

`addVerb()` doesn't consult the registry, so a registered handler doesn't change how verbs are validated or added. Call the handler's methods from your own code.

## Web Service Features

`SWMLService` serves its document over HTTP with a [Hono](https://hono.dev/) app.

### Endpoints

A service answers these requests, where `{route}` is the `route` option (default `/`):

- `GET {route}` and `POST {route}`: Return the SWML document
- `GET {route}/swaig`: Return the SWML document
- `POST {route}/swaig`: Run a SWAIG function registered with `defineTool()`
- `GET /health` and `GET /ready`: Return `{"status":"ok"}` and `{"status":"ready"}`
- Each routing-callback path, at the server root: see [Custom Routing Callbacks](#custom-routing-callbacks)

With the default route `/`, the SWAIG path is `/swaig`. A trailing slash is a different path: `GET /voice/` gets `404` when the route is `/voice`. `serve()` binds to the `host` and `port` options (defaults `0.0.0.0` and `PORT` or `3000`).

Every response carries `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Content-Security-Policy` and `Permissions-Policy` headers. CORS allows the origins in `SWML_CORS_ORIGINS`, or any origin when it's unset.

### SWAIG Functions

A `SWMLService` can register tools with `defineTool()` and run them on `POST {route}/swaig`. The request body names the function in `function`, and its arguments in `argument.parsed[0]` or `arguments`:

<!-- snippet: no-run illustrative fragment: references the assumed `service` object established earlier on the page -->
```typescript
import { FunctionResult } from '@signalwire/sdk';

// Your own asynchronous lookup, such as a database query
async function lookUpHours(day: string): Promise<string> {
  return day.toLowerCase() === 'sunday' ? 'from noon to 5 PM' : 'from 9 AM to 5 PM';
}

service.defineTool({
  name: 'get_hours',
  description: 'Get the office hours for a day of the week.',
  parameters: { day: { type: 'string', description: 'Day of the week' } },
  handler: async (args) => {
    const hours = await lookUpHours(String(args.day));
    return new FunctionResult(`The office is open ${hours} on ${args.day}.`);
  },
});
```

The route awaits the handler, so an `async` handler's result is sent once it resolves. A `FunctionResult` is sent as its `toDict()` form, a string is wrapped in a `FunctionResult`, and an object is sent as it is. The `response` text is context for the model on the call, not speech: the model decides what to say.

These requests don't run a handler:

- A body that isn't JSON gets `400` `{"error":"Invalid JSON"}`.
- A missing function name gets `400`, and a name that isn't a valid identifier gets `400`.
- A function the service doesn't have gets `404` `{"error":"Unknown function: <name>"}`.

`SWMLService` doesn't check per-call tokens. A tool's `secure` setting takes effect on `AgentBase`, which renders the tokens into its SWML and checks them on `/swaig`. On a plain `SWMLService`, basic auth is the only protection for `/swaig`.

### Authentication

`SWMLService` resolves basic-auth credentials in this order:

1. The `basicAuth` constructor option.
2. The config file's `security.auth.basic` (or `security.basicAuth`) password, when you pass `configFile`.
3. `SWML_BASIC_AUTH_PASSWORD`, with `SWML_BASIC_AUTH_USER` or `signalwire` as the username.
4. Generated credentials: the service name as the username and a random password.

The service enforces the first three on every route, including `/health` and `/ready`. It doesn't enforce generated credentials: with no option, config file or environment variable, the service serves every route, `/swaig` included, without authentication. `getBasicAuthCredentials(true)` returns the credentials and their source (`provided`, `config file`, `environment` or `generated`).

This service requires basic auth:

```typescript
const service = new SWMLService({
  name: 'my-service',
  basicAuth: ['username', 'a-long-random-password'],
});
```

The routes compare credentials with the configured pair and don't call `validateBasicAuth()`. Only `handleRequest()`, the framework-free dispatch method, calls it.

### Dynamic SWML Generation

Each request for the document runs the first of these that applies:

1. The protected `buildSwmlForRequest(queryParams, bodyParams, headers)` hook. Return a `SwmlBuilder` to send its document, or `null` to fall through.
2. The callback set with `setOnRequestCallback()`. It returns a `SwmlBuilder`, or a promise of one.
3. The service's own document.

`bodyParams` is the request's JSON body, or an empty object for a `GET`. This subclass builds a different document for each request:

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
    if (queryParams['caller_type'] === 'vip') {
      builder.play({ url: 'say:Welcome, VIP caller.' });
    } else {
      builder.play({ url: 'say:Welcome, caller.' });
    }

    return builder;
  }
}
```

`buildSwmlForRequest()` is synchronous. To build the document with asynchronous work, register a callback instead:

<!-- snippet: no-run illustrative fragment: references the assumed `service` object established earlier on the page -->
```typescript
service.setOnRequestCallback(async (queryParams, bodyParams, headers) => {
  const builder = new SwmlBuilder();
  builder.answer().play({ url: 'say:Hello!' }).hangup();
  return builder;
});
```

## Custom Routing Callbacks

A routing callback inspects a request at a path you choose, and either redirects it or lets the service answer it.

### Registering a Routing Callback

`registerRoutingCallback(callbackFn, path)` adds `GET` and `POST` routes at `path` (default `/sip`). The path is at the server root, not under the service's `route`. The callback receives the request's JSON body and its headers, and returns a route string or `null`:

<!-- snippet: no-run illustrative fragment: references the assumed `service` object established earlier on the page -->
```typescript
import type { SwmlRequestData } from '@signalwire/sdk';

function myRoutingCallback(body: SwmlRequestData): string | null {
  // Route based on a field in the request body
  if (body['customer_id']) {
    return `/customer/${body['customer_id']}`;
  }
  // Serve the service's document
  return null;
}

// Register the callback for a specific path
service.registerRoutingCallback(myRoutingCallback, '/customer');
```

### How Routing Works

A request to a callback path goes through these steps:

1. The route parses the body of a `POST` (an empty object for a `GET`) and calls the callback.
2. If the callback returns a string, the response is a `307` redirect with that string as the `Location`.
3. If it returns `null`, the response is the service's own document. `buildSwmlForRequest()` and the `setOnRequestCallback()` callback don't run on this path.

Return a string or `null` from the callback, synchronously. This route doesn't await the callback, so a `Promise` or `undefined` result is sent as a redirect to `[object Promise]` or `undefined`.

### Example: Routing by SIP Username

This service serves one document at `/main`, and a callback at `/sip` sends calls for the SIP user `sales` to another route:

```typescript
import { SWMLService } from '@signalwire/sdk';
import type { SwmlRequestData } from '@signalwire/sdk';

class FrontDoorService extends SWMLService {
  constructor() {
    super({ name: 'front-door', route: '/main' });

    // The main document: a greeting, then the menu section
    this.addVerb('answer', {});
    this.addVerb('play', { url: 'say:Hello from the main service.' });
    this.addVerb('transfer', { dest: 'menu' });

    // A second section, reached by the transfer verb
    this.addVerbToSection('menu', 'play', { url: 'say:Goodbye.' });
    this.addVerbToSection('menu', 'hangup', {});

    this.registerRoutingCallback((body: SwmlRequestData) => {
      const user = SWMLService.extractSipUsername(body);
      if (user === 'sales') {
        this.log.info('routing_to_sales');
        return '/sales';
      }
      return null;
    }, '/sip');
  }
}
```

A `POST /sip` whose body has `call.to` set to `sip:sales@example.sip.signalwire.com` gets a `307` to `/sales`. Any other request to `/sip` gets the service's document. `SWMLService.extractSipUsername()` returns the user part of a `sip:` or `sips:` address, the number of a `tel:` address, or the `call.to` value as it is.

## Advanced Usage

### Mounting into a Larger App

`getApp()` returns the service's Hono app, so you can mount it in a larger application. `asRouter()` returns the same app:

```typescript
import { Hono } from 'hono';

const app = new Hono();
const service = new SWMLService({ name: 'my-service' });
app.route('/voice', service.getApp());
```

Mounted this way, the service's routes are under `/voice`: its document at `/voice` and its SWAIG route at `/voice/swaig`.

### Serving HTTPS

`serve()` serves HTTPS when SSL is enabled and both a certificate and a key path are set. The paths come from the `serve()` options, then the config file's `security.ssl` keys, then `SWML_SSL_ENABLED`, `SWML_SSL_CERT_PATH` and `SWML_SSL_KEY_PATH`:

<!-- snippet: no-run starts a blocking HTTPS server via service.serve() -->
```typescript
const service = new SWMLService({ name: 'my-service', port: 8443 });
service.addVerb('answer', {});
await service.serve({
  sslEnabled: true,
  sslCert: '/etc/ssl/certs/voice.example.com.pem',
  sslKey: '/etc/ssl/private/voice.example.com.key',
});
```

Without all three, `serve()` serves plain HTTP. HTTPS responses don't carry a `Strict-Transport-Security` header. `AgentBase` overrides `serve()` and doesn't serve HTTPS; see [SSL/TLS](configuration.md#ssltls) in the configuration guide.

## API Reference

### Constructor Options (`SWMLServiceOptions`)

The constructor takes these options:

- `name`: Service name (required)
- `route`: HTTP route path (default `'/'`)
- `host`: Host to bind to (default `'0.0.0.0'`)
- `port`: Port to bind to (default `PORT` or `3000`)
- `basicAuth`: Optional `[username, password]` tuple
- `schemaPath`: Path to a SWML schema file for the service's `schemaUtils` (not used by `addVerb()`)
- `configFile`: Path to a JSON config file; the service reads its `security.ssl` and basic-auth keys
- `schemaValidation`: Sets the service's `schemaUtils` validation (not used by `addVerb()`; default `true`)

### Document Methods

The document methods listed in [Document Methods](#document-methods) are the public API:

- `resetDocument()`
- `addVerb(verbName, config)`
- `addSection(sectionName)`
- `addVerbToSection(sectionName, verbName, config)`
- `getDocument()`
- `renderDocument()`
- `getBuilder()`

### Service Methods

These methods serve, configure and inspect the service:

- `getApp()`: Get the underlying Hono app
- `asRouter()`: Return the same app as `getApp()`, to mount in a host app
- `serve(hostOrOptions?, port?, sslOptions?)`: Start the HTTP or HTTPS server
- `stop()`: Stop the server
- `handleRequest(method, url, headers, body?)`: Answer a request without Hono, returning `[status, headers, body]`
- `getBasicAuthCredentials(includeSource?)`: Get the basic-auth credentials
- `setOnRequestCallback(cb)`: Set a per-request SWML-builder callback
- `defineTool(opts)`: Register a SWAIG function
- `registerVerbHandler(handler)`: Store a custom verb handler in `verbRegistry`
- `registerRoutingCallback(callbackFn, path?)`: Register a request-routing callback
- `manualSetProxyUrl(url)`: Set the external base URL for webhook URLs
- `SWMLService.extractSipUsername(body)`: Get the user part of `call.to`

## Examples

### Basic Voicemail Service

This service answers, plays a greeting and a beep, and records a message:

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
    this.addVerb('play', { url: 'say:Thank you for your message. Goodbye.' });
    this.addVerb('hangup', {});
    this.log.debug('voicemail_document_built');
  }
}
```

### Dynamic Call Routing Service

This service builds a document for each request from a `department` value in the request body. Without one, it returns `null`, and the service sends its own document:

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
      url: "say:We're sorry, but all of our agents are busy. Please try again later.",
    });
    builder.hangup();

    return builder;
  }
}
```

For more examples, see the `examples` directory in the SDK repository.
