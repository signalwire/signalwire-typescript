# Serverless Deployment Guide

## Table of Contents

- [Overview](#overview)
- [ServerlessAdapter](#serverlessadapter)
- [AWS Lambda](#aws-lambda)
- [Google Cloud Functions](#google-cloud-functions)
- [Azure Functions](#azure-functions)
- [CGI Mode](#cgi-mode)
- [Platform Detection](#platform-detection)
- [URL Generation](#url-generation)
- [CLI Testing](#cli-testing)

---

## Overview

The SignalWire AI Agents TypeScript SDK can be deployed to serverless platforms using the `ServerlessAdapter` class (`src/ServerlessAdapter.ts`). The adapter converts platform-specific event formats into standard `Request` objects, routes them through the Hono application, and returns normalized responses.

Supported platforms:

| Platform | Identifier | Factory Method |
|---|---|---|
| AWS Lambda | `lambda` | `ServerlessAdapter.createLambdaHandler()` |
| Google Cloud Functions | `gcf` | `ServerlessAdapter.createGcfHandler()` |
| Azure Functions | `azure` | `ServerlessAdapter.createAzureHandler()` |
| CGI | `cgi` | Manual via `handleRequest()` |

---

## ServerlessAdapter

### Constructor

```typescript
import { ServerlessAdapter } from '@anthropic/@signalwire/sdk';

// Auto-detect platform from environment variables
const adapter = new ServerlessAdapter();
// or: new ServerlessAdapter('auto')

// Explicit platform selection
const lambdaAdapter = new ServerlessAdapter('lambda');
const gcfAdapter = new ServerlessAdapter('gcf');
const azureAdapter = new ServerlessAdapter('azure');
const cgiAdapter = new ServerlessAdapter('cgi');
```

The `platform` parameter accepts `'lambda' | 'gcf' | 'azure' | 'cgi' | 'auto'`. When set to `'auto'` (the default), the platform is detected from environment variables (see [Platform Detection](#platform-detection)).

### Core Types

**`ServerlessEvent`** -- Normalized incoming event:

```typescript
interface ServerlessEvent {
  httpMethod?: string;                         // HTTP method (AWS Lambda style)
  method?: string;                             // HTTP method (GCF/Azure style)
  headers?: Record<string, string>;            // Request headers
  body?: string | Record<string, unknown>;     // Raw or parsed request body
  path?: string;                               // Request path
  rawPath?: string;                            // Raw path (AWS API Gateway v2)
  queryStringParameters?: Record<string, string>; // Query parameters
  requestContext?: Record<string, unknown>;     // Platform-specific context
}
```

**`ServerlessResponse`** -- Normalized outgoing response:

```typescript
interface ServerlessResponse {
  statusCode: number;                  // HTTP status code
  headers: Record<string, string>;     // Response headers
  body: string;                        // Response body as string
}
```

### handleRequest()

The core method that processes any serverless event through a Hono app:

```typescript
const adapter = new ServerlessAdapter('lambda');
const agent = new AgentBase({ name: 'my-agent' });
const app = agent.getApp();

const response = await adapter.handleRequest(app, event);
// response: { statusCode: 200, headers: {...}, body: '...' }
```

**Processing steps:**

1. Extract HTTP method from `event.httpMethod` (Lambda) or `event.method` (GCF/Azure), defaulting to `POST`.
2. Extract path from `event.rawPath` (API Gateway v2) or `event.path`, defaulting to `/`.
3. Build a full URL from the `host` and `x-forwarded-proto` headers.
4. Append query string parameters if present.
5. Create a standard `Request` object and route it through `app.fetch()`.
6. Convert the `Response` back into a `ServerlessResponse`.

---

## AWS Lambda

Use `ServerlessAdapter.createLambdaHandler()` to create a Lambda-compatible handler function.

### Example: Lambda Handler

```typescript
// handler.ts
import { AgentBase, ServerlessAdapter } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'lambda-agent',
  basicAuth: ['admin', process.env.AGENT_PASSWORD!],
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
  handler: async (args) => {
    const { FunctionResult } = await import('@anthropic/@signalwire/sdk');
    const result = new FunctionResult();
    result.setResponse(`System ${args.system} is operational.`);
    return result;
  },
});

const app = agent.getApp();

// Export the Lambda handler
export const handler = ServerlessAdapter.createLambdaHandler(app);
```

### How It Works

`createLambdaHandler()` creates a new `ServerlessAdapter` instance with `platform: 'lambda'` and returns a function with the signature:

```typescript
(event: ServerlessEvent) => Promise<ServerlessResponse>
```

This matches the AWS Lambda handler contract. The event object maps directly to API Gateway proxy integration events (both v1 and v2):

- `event.httpMethod` -- HTTP method (v1)
- `event.rawPath` -- Request path (v2, preferred)
- `event.path` -- Request path (v1 fallback)
- `event.headers` -- Request headers
- `event.body` -- Request body (string)
- `event.queryStringParameters` -- Query parameters

### Deployment

```bash
# Build and package
npm run build
zip -r function.zip dist/ node_modules/ package.json

# Deploy via AWS CLI
aws lambda create-function \
  --function-name my-agent \
  --runtime nodejs20.x \
  --handler dist/handler.handler \
  --zip-file fileb://function.zip \
  --environment "Variables={AGENT_PASSWORD=s3cret}"
```

---

## Google Cloud Functions

Use `ServerlessAdapter.createGcfHandler()` to create a GCF-compatible handler.

### Example: Cloud Function Handler

```typescript
// index.ts
import { AgentBase, ServerlessAdapter } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'gcf-agent',
  basicAuth: ['admin', process.env.AGENT_PASSWORD!],
});

agent.setPromptText('You are a helpful assistant on Google Cloud Functions.');

const app = agent.getApp();

// Export the GCF handler
export const agentHandler = ServerlessAdapter.createGcfHandler(app);
```

### How It Works

`createGcfHandler()` returns a function with the signature:

```typescript
(req: any, res: any) => Promise<void>
```

This matches the Google Cloud Functions HTTP function contract. The adapter:

1. Constructs a `ServerlessEvent` from the GCF `req` object:
   - `req.method` -- HTTP method
   - `req.headers` -- Request headers
   - `req.body` -- Request body (already parsed by GCF)
   - `req.path` or `req.url` -- Request path
2. Routes through the Hono app via `handleRequest()`.
3. Writes the response to `res` using `res.status()`, `res.set()`, and `res.send()`.

### Deployment

```bash
# Deploy via gcloud CLI
gcloud functions deploy agentHandler \
  --runtime nodejs20 \
  --trigger-http \
  --entry-point agentHandler \
  --set-env-vars AGENT_PASSWORD=s3cret \
  --allow-unauthenticated
```

---

## Azure Functions

Use `ServerlessAdapter.createAzureHandler()` to create an Azure Functions-compatible handler.

### Example: Azure Function Handler

```typescript
// index.ts
import { AgentBase, ServerlessAdapter } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'azure-agent',
  basicAuth: ['admin', process.env.AGENT_PASSWORD!],
});

agent.setPromptText('You are a helpful assistant on Azure Functions.');

const app = agent.getApp();

// Export the Azure handler
const azureHandler = ServerlessAdapter.createAzureHandler(app);
export default azureHandler;
```

### How It Works

`createAzureHandler()` returns a function with the signature:

```typescript
(context: any, req: any) => Promise<void>
```

This matches the Azure Functions HTTP trigger contract. The adapter:

1. Constructs a `ServerlessEvent` from the Azure `req` object:
   - `req.method` -- HTTP method
   - `req.headers` -- Request headers
   - `req.body` -- Request body
   - `req.url` -- Request path
2. Routes through the Hono app via `handleRequest()`.
3. Sets `context.res` with `status`, `headers`, and `body`.

### Deployment

```bash
# Deploy via Azure CLI
func azure functionapp publish my-agent-app \
  --typescript
```

### function.json

```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

---

## CGI Mode

For traditional CGI environments, use the `ServerlessAdapter` with `platform: 'cgi'`:

```typescript
import { AgentBase, ServerlessAdapter } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({ name: 'cgi-agent' });
agent.setPromptText('You are a CGI-deployed assistant.');

const adapter = new ServerlessAdapter('cgi');
const app = agent.getApp();

// Read CGI environment and stdin to build a ServerlessEvent
const event = {
  method: process.env.REQUEST_METHOD ?? 'GET',
  headers: {
    'content-type': process.env.CONTENT_TYPE ?? 'application/json',
    host: process.env.HTTP_HOST ?? 'localhost',
    authorization: process.env.HTTP_AUTHORIZATION ?? '',
  },
  path: process.env.PATH_INFO ?? '/',
  body: await readStdin(),
};

const response = await adapter.handleRequest(app, event);

// Write CGI response
process.stdout.write(`Status: ${response.statusCode}\r\n`);
for (const [key, value] of Object.entries(response.headers)) {
  process.stdout.write(`${key}: ${value}\r\n`);
}
process.stdout.write('\r\n');
process.stdout.write(response.body);
```

CGI mode is auto-detected when the `GATEWAY_INTERFACE` environment variable is present (e.g., `GATEWAY_INTERFACE=CGI/1.1`).

---

## Platform Detection

When the `ServerlessAdapter` is created with `platform: 'auto'` (the default), the platform is detected by checking for well-known environment variables in the following order:

| Order | Environment Variables Checked | Detected Platform |
|---|---|---|
| 1 | `AWS_LAMBDA_FUNCTION_NAME` or `_HANDLER` | `lambda` |
| 2 | `FUNCTION_TARGET` or `K_SERVICE` | `gcf` |
| 3 | `FUNCTIONS_WORKER_RUNTIME` or `AZURE_FUNCTIONS_ENVIRONMENT` | `azure` |
| 4 | `GATEWAY_INTERFACE` | `cgi` |
| 5 | *(none matched)* | `lambda` (default fallback) |

```typescript
const adapter = new ServerlessAdapter('auto');
console.log(adapter.getPlatform());
// 'lambda', 'gcf', 'azure', or 'cgi'
```

The `detectPlatform()` method can also be called explicitly:

```typescript
const adapter = new ServerlessAdapter('auto');
const platform = adapter.detectPlatform();
```

---

## URL Generation

The `generateUrl()` method constructs the expected invocation URL for a deployed function on each platform:

```typescript
const adapter = new ServerlessAdapter('lambda');
const url = adapter.generateUrl({
  region: 'us-west-2',
  apiId: 'abc123xyz',
  stage: 'prod',
});
// "https://abc123xyz.execute-api.us-west-2.amazonaws.com/prod"
```

### URL Formats by Platform

**AWS Lambda (API Gateway)**

```typescript
const adapter = new ServerlessAdapter('lambda');
adapter.generateUrl({
  region: 'us-east-1',     // default: AWS_REGION env or 'us-east-1'
  apiId: 'abc123',         // default: 'API_ID'
  stage: 'prod',           // default: 'prod'
});
// "https://abc123.execute-api.us-east-1.amazonaws.com/prod"
```

**Google Cloud Functions**

```typescript
const adapter = new ServerlessAdapter('gcf');
adapter.generateUrl({
  projectId: 'my-project', // default: GCLOUD_PROJECT env or 'PROJECT'
  region: 'us-central1',   // default: FUNCTION_REGION env or 'us-central1'
  functionName: 'agent',   // default: AWS_LAMBDA_FUNCTION_NAME env or 'agent'
});
// "https://us-central1-my-project.cloudfunctions.net/agent"
```

**Azure Functions**

```typescript
const adapter = new ServerlessAdapter('azure');
adapter.generateUrl({
  functionName: 'my-agent', // default: 'agent'
});
// "https://my-agent.azurewebsites.net/api/my-agent"
```

**CGI**

```typescript
const adapter = new ServerlessAdapter('cgi');
adapter.generateUrl({
  functionName: 'my-agent',
});
// "http://localhost/cgi-bin/my-agent"
```

### generateUrl() Options

| Option | Type | Default | Description |
|---|---|---|---|
| `region` | `string` | Platform-specific env var or default | Cloud region for the function. |
| `projectId` | `string` | `GCLOUD_PROJECT` env or `"PROJECT"` | GCP project ID (GCF only). |
| `functionName` | `string` | `AWS_LAMBDA_FUNCTION_NAME` env or `"agent"` | Name of the deployed function. |
| `stage` | `string` | `"prod"` | API Gateway stage (Lambda only). |
| `apiId` | `string` | `"API_ID"` | API Gateway ID (Lambda only). |

---

## CLI Testing

You can test serverless deployments locally using the `swaig-test` CLI tool. While there is no dedicated `--simulate-serverless` flag, you can test agent functionality locally before deploying:

### Testing Tools Locally

```bash
# List all registered tools
npx swaig-test --file handler.ts --list-tools

# Dump the SWML document the agent generates
npx swaig-test --file handler.ts --dump-swml

# Execute a specific tool with arguments
npx swaig-test --file handler.ts --exec get_status --args '{"system": "production"}'
```

### Local Development Pattern

For local development and testing before deploying to a serverless platform, run the agent as a standard HTTP server:

```typescript
// local-dev.ts
import { AgentBase } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({
  name: 'my-agent',
  port: 3000,
});

agent.setPromptText('You are a helpful assistant.');

// In development, run as an HTTP server
if (process.env.NODE_ENV !== 'production') {
  agent.serve();
}

// Export the app for serverless deployment
export const app = agent.getApp();
```

### Simulating Serverless Events

You can manually test the `ServerlessAdapter` with constructed events:

```typescript
import { AgentBase, ServerlessAdapter } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({ name: 'test-agent', basicAuth: ['admin', 'test'] });
agent.setPromptText('Hello!');

const adapter = new ServerlessAdapter('lambda');
const app = agent.getApp();

// Simulate a Lambda event
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
