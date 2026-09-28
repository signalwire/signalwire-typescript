# Serverless Deployment Guide

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const ServerlessAdapter: typeof import('@signalwire/sdk').ServerlessAdapter;
  const AgentBase: typeof import('@signalwire/sdk').AgentBase;
}
```

This guide shows how to run an agent on AWS Lambda, Google Cloud Functions, Azure Functions or as a CGI script. It also covers how the agent builds its webhook URLs and checks signatures on each platform.

## Table of Contents

- [Overview](#overview)
- [ServerlessAdapter](#serverlessadapter)
- [AWS Lambda](#aws-lambda)
- [Google Cloud Functions](#google-cloud-functions)
- [Azure Functions](#azure-functions)
- [CGI Mode](#cgi-mode)
- [Webhook URLs and Signatures](#webhook-urls-and-signatures)
- [Platform Detection](#platform-detection)
- [URL Generation](#url-generation)
- [CLI Testing](#cli-testing)

---

## Overview

`ServerlessAdapter` (`src/ServerlessAdapter.ts`) turns a platform's request into a standard `Request`, routes it through the agent's Hono app, and turns the `Response` back into the platform's format. The agent's routes, basic auth, signature check and other protections work as they do on a server.

Each platform has a factory method that returns a handler in that platform's shape:

| Platform | Identifier | Factory Method |
|---|---|---|
| AWS Lambda | `lambda` | `ServerlessAdapter.createLambdaHandler(app)` |
| Google Cloud Functions | `gcf` | `ServerlessAdapter.createGcfHandler(app)` |
| Azure Functions | `azure` | `ServerlessAdapter.createAzureHandler(app)` |
| CGI | `cgi` | `ServerlessAdapter.createCgiHandler(app)`, or `agent.run()` |

`app` is the agent's `getApp()`. `agent.runServerless(event, context, platform)` routes one Lambda-style event, and `agent.run()` calls it when it detects a serverless environment.

Build the agent once, at module scope, so each warm invocation reuses it. Set `basicAuth` or `SWML_BASIC_AUTH_PASSWORD`: a generated password changes with every cold start, and SignalWire can't use it.

---

## ServerlessAdapter

### Constructor

The constructor takes the platform, or `'auto'` to detect it from the environment:

```typescript
import { ServerlessAdapter } from '@signalwire/sdk';

// Detect the platform from environment variables
const adapter = new ServerlessAdapter();
// or: new ServerlessAdapter('auto')

// Choose the platform
const lambdaAdapter = new ServerlessAdapter('lambda');
const gcfAdapter = new ServerlessAdapter('gcf');
const azureAdapter = new ServerlessAdapter('azure');
const cgiAdapter = new ServerlessAdapter('cgi');
```

The `platform` parameter accepts `'lambda' | 'gcf' | 'azure' | 'cgi' | 'auto'`. [Platform Detection](#platform-detection) lists the variables `'auto'` checks.

### Core Types

`ServerlessEvent` is the Lambda-style event that `handleRequest()` accepts:

```typescript
interface ServerlessEvent {
  httpMethod?: string;                          // HTTP method (API Gateway REST)
  method?: string;                              // HTTP method (other callers)
  headers?: Record<string, string>;             // Request headers
  body?: string | Record<string, unknown>;      // Raw or parsed request body
  isBase64Encoded?: boolean;                    // body is base64-encoded
  path?: string;                                // Request path
  rawPath?: string;                             // Raw path (HTTP API and function URLs)
  queryStringParameters?: Record<string, string>;        // Decoded query parameters
  multiValueQueryStringParameters?: Record<string, string[]>; // Repeated parameters (REST)
  rawQueryString?: string;                      // Raw query (HTTP API and function URLs)
  pathParameters?: Record<string, string>;      // `proxy` holds the path below a {proxy+} resource
  requestContext?: Record<string, unknown>;     // Platform context: domainName, stage, http.method
}
```

`ServerlessResponse` is what every handler produces:

```typescript
interface ServerlessResponse {
  statusCode: number;                  // HTTP status code
  headers: Record<string, string>;     // Response headers
  body: string;                        // Response body as string
}
```

### handleRequest()

`handleRequest(app, event)` routes one Lambda-style event through a Hono app:

<!-- snippet: no-run illustrative fragment: references the assumed `ServerlessAdapter` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const adapter = new ServerlessAdapter('lambda');
const agent = new AgentBase({ name: 'my-agent' });
const app = agent.getApp();

const event: any = {}; // the platform-specific event passed to your handler
const response = await adapter.handleRequest(app, event);
// response: { statusCode: 200, headers: {...}, body: '...' }
```

It reads the event in these steps:

1. The method comes from `httpMethod`, `method` or `requestContext.http.method`. Without one, it's `POST` when the event has a body and `GET` otherwise.
2. The path comes from `rawPath` (with a non-default stage removed), then `pathParameters.proxy`, then `path`, then `/`.
3. The query is `rawQueryString` when present. Otherwise it's built from `multiValueQueryStringParameters` or `queryStringParameters`.
4. A base64-encoded body is decoded, and a parsed body is serialized to JSON.
5. The request is routed through `app.fetch()`, which also receives the URL the platform was called on, for the signature check.
6. The `Response` becomes a `ServerlessResponse`.

---

## AWS Lambda

`ServerlessAdapter.createLambdaHandler(app)` returns a Lambda handler, `(event) => Promise<ServerlessResponse>`. It accepts events from a Lambda function URL, an API Gateway HTTP API and an API Gateway REST API.

### Example: Lambda Handler

This handler file builds the agent once and exports the Lambda handler:

```typescript
// handler.ts
import { AgentBase, FunctionResult, ServerlessAdapter } from '@signalwire/sdk';

export const agent = new AgentBase({
  name: 'lambda-agent',
  basicAuth: ['admin', process.env.AGENT_PASSWORD ?? 'a-long-random-password'],
  signingKey: process.env.SIGNALWIRE_SIGNING_KEY,
  swaigSecret: process.env.SIGNALWIRE_SWAIG_SECRET,
});

agent.setPromptText('You are a helpful assistant deployed on AWS Lambda.');

agent.defineTool({
  name: 'get_status',
  description: 'Get the current system status',
  parameters: {
    type: 'object',
    properties: {
      system: { type: 'string', description: 'System name' },
    },
  },
  handler: async (args) => new FunctionResult(`System ${args.system} is operational.`),
});

export const handler = ServerlessAdapter.createLambdaHandler(agent.getApp());
```

Every instance of the function must sign tool tokens with the same secret, so the example sets `swaigSecret`. Without it, each cold start generates a new secret, and a tool call that reaches another instance is refused. [Security](security.md#the-signing-secret) explains the token secret.

### API Gateway REST APIs

An API Gateway REST API (payload version 1.0) passes the query parameters to Lambda decoded, so the adapter can't always rebuild the exact URL SignalWire signed. It tries the two common encodings, but a URL with several query parameters may still fail the signature check. To check signatures on Lambda, serve the agent from a Lambda function URL or an HTTP API (payload version 2.0), which pass the raw query string.

### Deployment

These commands package the compiled code and create the function. The SDK needs Node.js 22 or later:

```bash
# Build and package
npm run build
zip -r function.zip dist/ node_modules/ package.json

# Create the function
aws lambda create-function \
  --function-name my-agent \
  --runtime nodejs22.x \
  --handler dist/handler.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::123456789012:role/my-agent-role \
  --environment "Variables={AGENT_PASSWORD=a-long-random-password,SIGNALWIRE_SWAIG_SECRET=a-long-random-secret}"
```

---

## Google Cloud Functions

`ServerlessAdapter.createGcfHandler(app)` returns an HTTP function for the Functions Framework, `(req, res) => Promise<void>`.

### Example: Cloud Function Handler

This file exports the handler as the function's entry point:

```typescript
// index.ts
import { AgentBase, ServerlessAdapter } from '@signalwire/sdk';

const agent = new AgentBase({
  name: 'gcf-agent',
  basicAuth: ['admin', process.env.AGENT_PASSWORD ?? 'a-long-random-password'],
});

agent.setPromptText('You are a helpful assistant on Google Cloud Functions.');

export const agentHandler = ServerlessAdapter.createGcfHandler(agent.getApp());
```

### How It Works

The handler reads the Express-style request the Functions Framework passes:

1. `req.method` and `req.headers` give the method and headers.
2. `req.rawBody`, the body as it arrived, is used when present, so the signature check sees the signed bytes. Otherwise `req.body` is used, serialized to JSON when it's parsed.
3. `req.originalUrl` (or `req.url`, or `req.path`) gives the path and query.
4. The response is written with `res.status()`, `res.set()` and `res.send()`.

### Deployment

This command deploys the handler with the Node.js 22 runtime:

```bash
gcloud functions deploy agentHandler \
  --runtime nodejs22 \
  --trigger-http \
  --entry-point agentHandler \
  --set-env-vars AGENT_PASSWORD=a-long-random-password \
  --allow-unauthenticated
```

`--allow-unauthenticated` lets SignalWire reach the function without Google credentials. The agent's basic auth still applies.

---

## Azure Functions

`ServerlessAdapter.createAzureHandler(app)` returns a handler with the Azure Functions programming model v3 signature, `(context, req) => Promise<void>`. It sets `context.res` with the status, headers and body.

The v4 model's `app.http()` calls a handler with `(request, context)` and expects a returned response, so this handler doesn't fit it. Use the v3 model, with a `function.json` file.

### Example: Azure Function Handler

This file exports the handler as the function's entry point:

```typescript
// index.ts
import { AgentBase, ServerlessAdapter } from '@signalwire/sdk';

const agent = new AgentBase({
  name: 'azure-agent',
  basicAuth: ['admin', process.env.AGENT_PASSWORD ?? 'a-long-random-password'],
});

agent.setPromptText('You are a helpful assistant on Azure Functions.');

export default ServerlessAdapter.createAzureHandler(agent.getApp());
```

### How It Works

The handler reads the v3 request object:

1. `req.method` and `req.headers` give the method and headers.
2. `req.rawBody` is used when present, so the signature check sees the signed bytes. Otherwise `req.body` is used.
3. `req.url` is the absolute URL, such as `https://my-app.azurewebsites.net/api/agent/swaig?code=...`. The path below `/api/<function>` is routed, and the whole URL is what the signature covers.

### function.json

The function's `function.json` binds an HTTP trigger for GET and POST:

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"],
      "route": "agent/{*path}"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

The `route` with a catch-all segment lets the one function receive `/api/agent`, `/api/agent/swaig` and `/api/agent/post_prompt`.

### Deployment

This command publishes the function app:

```bash
func azure functionapp publish my-agent-app
```

---

## CGI Mode

In a CGI environment, `agent.run()` handles the request. It detects CGI from `GATEWAY_INTERFACE`, and reads the request from the CGI variables: `REQUEST_METHOD`, `PATH_INFO`, `QUERY_STRING`, `CONTENT_TYPE` and the `HTTP_*` headers. It reads the body from stdin, up to `CONTENT_LENGTH` bytes. It writes a `Status:` line, the headers, a blank line and the body to stdout.

This script is a complete CGI program:

<!-- snippet: no-run a CGI program: reads the request from the CGI environment and stdin -->
```typescript
// agent.cgi.ts
import { AgentBase } from '@signalwire/sdk';

const agent = new AgentBase({
  name: 'cgi-agent',
  basicAuth: ['admin', process.env.AGENT_PASSWORD ?? 'a-long-random-password'],
});
agent.setPromptText('You are a CGI-deployed assistant.');

await agent.run();
```

`ServerlessAdapter.createCgiHandler(app)` returns a function that does the same for any Hono app. The adapter refuses a body over 10 MB (`ServerlessAdapter.MAX_CGI_BODY_SIZE`) and handles the request without it.

In CGI mode the SDK turns logging off by default, since stdout carries the response. The agent's credentials arrive in the `Authorization` header, which some web servers don't pass to CGI scripts by default. Apache passes it with `CGIPassAuth On`.

---

## Webhook URLs and Signatures

The SWML the agent serves tells SignalWire where to send tool calls and the post-prompt summary. On a serverless platform, the agent builds those URLs from the platform, and checks signatures against the URL the platform received the request on.

### Webhook URLs

`SWML_PROXY_URL_BASE`, or a URL set with `manualSetProxyUrl()`, always wins. Without one, each platform's base URL comes from these sources:

| Platform | Base URL |
|---|---|
| Lambda | `AWS_LAMBDA_FUNCTION_URL`. Without it, `https://<AWS_LAMBDA_FUNCTION_NAME>.lambda-url.<AWS_REGION>.on.aws`, which has the function name where a real function URL has its URL ID. Set `AWS_LAMBDA_FUNCTION_URL`, or behind API Gateway set `SWML_PROXY_URL_BASE`. |
| Google Cloud Functions | `FUNCTION_URL` when set. Otherwise the request's host: a `cloudfunctions.net` host gets `/<K_SERVICE>` (or `/<FUNCTION_TARGET>`) added, and any other host, such as Cloud Run's, is used as it is. |
| Azure Functions | The request's URL up to `/api/<function>`. Before the first request, `AZURE_FUNCTION_URL`, or `https://<WEBSITE_SITE_NAME>.azurewebsites.net/api/<AZURE_FUNCTION_NAME>`. |
| CGI | `http://` (or `https://` when `HTTPS=on`) plus `HTTP_HOST` (or `SERVER_NAME`) plus `SCRIPT_NAME`. |

The agent adds its route when it isn't `/`, then `/swaig` or `/post_prompt`, and puts its basic auth credentials in the URL. This is the default webhook URL `swaig-test` prints for `examples/simple-agent.ts` with `--simulate-serverless cgi --cgi-host example.com --cgi-https`:

```text
https://dev:w00t@example.com/cgi-bin/agent.cgi/swaig
```

### Signatures

With a signing key set, the agent checks each POST's signature against the URL the platform received it on:

- **Lambda**: `https://` plus `requestContext.domainName` (or the function URL's host), the path as called (with any API Gateway stage), and the query. [API Gateway REST APIs](#api-gateway-rest-apis) explains the limit on decoded queries.
- **Google Cloud Functions**: the request's protocol and `Host` header, plus `req.originalUrl`.
- **Azure Functions**: `req.url`.
- **CGI**: the scheme, `HTTP_HOST` (or `SERVER_NAME`), and `REQUEST_URI` (or `SCRIPT_NAME`, `PATH_INFO` and `QUERY_STRING`).

When `SWML_PROXY_URL_BASE` is set, the check uses it instead, joined with the path below the function and the query. If SignalWire's requests are refused with `403`, set `SWML_PROXY_URL_BASE` to the function's public base URL, including any stage or function path. [Security](security.md#webhook-signature-validation) describes the signature scheme.

---

## Platform Detection

`new ServerlessAdapter('auto')` (the default) checks for these environment variables, in order:

| Order | Environment Variables Checked | Detected Platform |
|---|---|---|
| 1 | `AWS_LAMBDA_FUNCTION_NAME` or `_HANDLER` | `lambda` |
| 2 | `FUNCTION_TARGET` or `K_SERVICE` | `gcf` |
| 3 | `FUNCTIONS_WORKER_RUNTIME` or `AZURE_FUNCTIONS_ENVIRONMENT` | `azure` |
| 4 | `GATEWAY_INTERFACE` | `cgi` |
| 5 | *(none matched)* | `lambda` (default fallback) |

`getPlatform()` returns the platform the adapter uses:

```typescript
const adapter = new ServerlessAdapter('auto');
console.log(adapter.getPlatform()); // 'lambda', 'gcf', 'azure', or 'cgi'
```

`agent.run()` treats the same variables (except `AZURE_FUNCTIONS_ENVIRONMENT`) as a serverless environment, and calls `runServerless()` instead of starting a server. Cloud Run sets `K_SERVICE`, so an agent that runs its own server there must call `serve()`, not `run()`.

---

## URL Generation

`generateUrl()` returns the usual invocation URL of a function on the adapter's platform. It's a convenience for your own scripts; the agent doesn't use it for webhook URLs. This example builds an API Gateway URL:

```typescript
const adapter = new ServerlessAdapter('lambda');
const url = adapter.generateUrl({
  region: 'us-west-2',
  apiId: 'abc123xyz',
  stage: 'prod',
});
console.log(url); // https://abc123xyz.execute-api.us-west-2.amazonaws.com/prod
```

The other platforms use these options:

```typescript
new ServerlessAdapter('gcf').generateUrl({ projectId: 'my-project', region: 'us-central1', functionName: 'agent' });
// https://us-central1-my-project.cloudfunctions.net/agent

new ServerlessAdapter('azure').generateUrl({ functionName: 'my-agent' });
// https://my-agent.azurewebsites.net/api/my-agent

new ServerlessAdapter('cgi').generateUrl({ functionName: 'my-agent' });
// http://localhost/cgi-bin/my-agent
```

### generateUrl() Options

| Option | Type | Default | Description |
|---|---|---|---|
| `region` | `string` | `AWS_REGION` or `us-east-1` (Lambda); `FUNCTION_REGION` or `us-central1` (GCF) | Cloud region. |
| `projectId` | `string` | `GCLOUD_PROJECT` or `PROJECT` | GCP project ID (GCF only). |
| `functionName` | `string` | `AWS_LAMBDA_FUNCTION_NAME` or `agent` | Function name. Azure uses it for the app name too. |
| `stage` | `string` | `prod` | API Gateway stage (Lambda only). |
| `apiId` | `string` | `API_ID` | API Gateway ID (Lambda only). |

---

## CLI Testing

`swaig-test` runs an agent file with a serverless platform's environment when you pass `--simulate-serverless lambda|cgi|gcf|azure`, so the SWML's webhook URLs are the platform's. It clears `SWML_PROXY_URL_BASE` for the run. Put its options before `--exec`, since everything after the function name is an argument to the function.

### Simulating a Platform

These commands print the SWML, or call a function, with each platform's environment:

```bash
# Lambda, with your function URL
npx tsx src/cli/swaig-test.ts handler.ts --simulate-serverless lambda \
  --aws-function-url https://abc123.lambda-url.us-west-2.on.aws/ --dump-swml

# CGI (--cgi-host is required)
npx tsx src/cli/swaig-test.ts agent.cgi.ts --simulate-serverless cgi \
  --cgi-host example.com --cgi-https --cgi-script-name /cgi-bin/agent.cgi --dump-swml

# Google Cloud Functions
npx tsx src/cli/swaig-test.ts index.ts --simulate-serverless gcf \
  --gcp-project my-project --gcp-function-url https://us-central1-my-project.cloudfunctions.net/agent \
  --exec get_status --system production

# Azure Functions
npx tsx src/cli/swaig-test.ts index.ts --simulate-serverless azure \
  --azure-function-url https://my-app.azurewebsites.net/api/agent --dump-swml
```

The platform options are:

| Platform | Options |
|---|---|
| `lambda` | `--aws-function-name`, `--aws-function-url`, `--aws-region`, `--aws-api-gateway-id`, `--aws-stage` |
| `cgi` | `--cgi-host` (required), `--cgi-script-name`, `--cgi-https`, `--cgi-path-info` |
| `gcf` | `--gcp-project`, `--gcp-function-url`, `--gcp-region`, `--gcp-service` |
| `azure` | `--azure-env`, `--azure-function-url` |

Each simulated platform starts from a preset environment. The Lambda preset includes a function URL, which wins over `--aws-function-name` and `--aws-region`, so pass `--aws-function-url` or `--aws-api-gateway-id` to set the URL. For the details, see the [CLI guide](cli-guide.md#serverless-simulation).

### Testing Tools Locally

Without a simulated platform, `swaig-test` checks the agent's tools before you deploy:

```bash
# List all registered tools
npx tsx src/cli/swaig-test.ts handler.ts --list-tools

# Print the SWML document the agent generates
npx tsx src/cli/swaig-test.ts handler.ts --dump-swml

# Call a tool with an argument
npx tsx src/cli/swaig-test.ts handler.ts --exec get_status --system production
```

### Running as a Server

For development, you can also serve the same agent over HTTP. Export it from the handler module, and call `agent.serve()` from a separate script that imports it. Keep `serve()` out of the handler module itself, since a Lambda, Cloud Functions or Azure handler must not start a server.

### Simulating Serverless Events

You can also pass a hand-built event to the adapter. This example requests the SWML with a Lambda-style event:

```typescript
import { AgentBase, ServerlessAdapter } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'test-agent', basicAuth: ['admin', 'test'] });
agent.setPromptText('Hello!');

const adapter = new ServerlessAdapter('lambda');
const app = agent.getApp();

const event = {
  httpMethod: 'POST',
  path: '/',
  headers: {
    'content-type': 'application/json',
    authorization: 'Basic ' + Buffer.from('admin:test').toString('base64'),
  },
  body: JSON.stringify({ call_id: 'test-call-123' }),
};

const response = await adapter.handleRequest(app, event);
console.log('Status:', response.statusCode);
console.log('Body:', response.body);
```

It prints:

```text
Status: 200
Body: {"version":"1.0.0","sections":{"main":[{"answer":{}},{"ai":{"prompt":{"text":"Hello!"}}}]}}
```

For the platform-specific steps on Google Cloud and Azure, see the [Cloud Functions Deployment Guide](cloud_functions_guide.md).
