# SignalWire AI Agents - Cloud Functions Deployment Guide

This guide covers deploying SignalWire AI Agents (TypeScript SDK) to Google Cloud Functions and Azure Functions. For the full serverless reference, including AWS Lambda and CGI, see the [Serverless Guide](serverless-guide.md).

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const MyAgent: any; // the AgentBase subclass defined in the entry-file example
}
```

## Overview

The SDK runs on these serverless platforms, each with its identifier:

- **Google Cloud Functions** (`gcf`)
- **Azure Functions** (`azure`)
- **AWS Lambda** (`lambda`, see the [Serverless Guide](serverless-guide.md))

Each platform has a static helper on `ServerlessAdapter` that wraps the agent's Hono app in the platform's handler shape. You can also call `agent.runServerless(event, context, platform)` with a Lambda-style event.

Build the agent once, at module scope, so warm invocations reuse it. Set its basic auth credentials: a password the SDK generates changes with every cold start, and SignalWire can't use it.

## Google Cloud Functions

### Environment Detection

The SDK detects Google Cloud Functions from these environment variables:

- `FUNCTION_TARGET`: the function's entry point
- `K_SERVICE`: the service name, which Cloud Run also sets
- `GOOGLE_CLOUD_PROJECT`: the project ID, which `getExecutionMode()` also checks

Cloud Run sets `K_SERVICE` but not `FUNCTION_TARGET`, so `run()` starts the agent's HTTP server there. On Cloud Functions, the Functions Framework sets `FUNCTION_TARGET`, and `run()` handles the request instead.

### Deployment Steps

1. **Create your agent entry file** (`index.ts`). It builds the agent and exports the handler:

```typescript
import { AgentBase, ServerlessAdapter } from '@signalwire/sdk';

class MyAgent extends AgentBase {
  constructor() {
    super({
      name: 'my-agent',
      basicAuth: [process.env.AGENT_USER ?? 'admin', process.env.AGENT_PASSWORD ?? 'a-long-random-password'],
    });
    this.setPromptText('You are a helpful assistant.');
  }
}

const agent = new MyAgent();

// HTTP Cloud Function entry point (Functions Framework)
export const agentHandler = ServerlessAdapter.createGcfHandler(agent.getApp());
```

2. **Add the dependencies** to `package.json`:

```json
{
  "type": "module",
  "engines": { "node": ">=22" },
  "dependencies": {
    "@google-cloud/functions-framework": "^3",
    "@signalwire/sdk": "^3"
  }
}
```

3. **Deploy using gcloud** with the Node.js 22 runtime:

```bash
gcloud functions deploy my-agent \
    --runtime nodejs22 \
    --trigger-http \
    --entry-point agentHandler \
    --allow-unauthenticated
```

`--allow-unauthenticated` lets SignalWire reach the function without Google credentials. The agent's basic auth still applies.

### Environment Variables

Set these variables for the function:

```bash
# Agent auth
SWML_BASIC_AUTH_USER="your-username"
SWML_BASIC_AUTH_PASSWORD="a-long-random-password"

# Check SignalWire's signatures on incoming requests
SIGNALWIRE_SIGNING_KEY="your-signing-key"

# The same secret on every instance, so tool tokens validate on any of them
SIGNALWIRE_SWAIG_SECRET="a-long-random-secret"
```

The example's constructor reads its own `AGENT_USER` and `AGENT_PASSWORD`, and a `basicAuth` option wins over `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD`. Use one pair or the other. Set `SIGNALWIRE_PROJECT_ID` and `SIGNALWIRE_API_TOKEN` only if your tool handlers use the REST client.

### Webhook URLs

The agent builds its webhook URLs from the request's host. A `cloudfunctions.net` host gets the function's name (`K_SERVICE`, or `FUNCTION_TARGET`) added, so the URL follows this pattern:

```text
https://{region}-{project-id}.cloudfunctions.net/{function-name}/swaig
```

Any other host, such as a Cloud Run URL, is used as it is. `FUNCTION_URL`, when set, replaces the host-based URL, and `SWML_PROXY_URL_BASE` replaces both. The agent puts its basic auth credentials in the URL:

```text
https://username:password@{region}-{project-id}.cloudfunctions.net/{function-name}/swaig
```

## Azure Functions

### Environment Detection

The SDK detects Azure Functions from these environment variables:

- `FUNCTIONS_WORKER_RUNTIME`: the runtime language, such as `node`
- `AZURE_FUNCTIONS_ENVIRONMENT`: the Azure Functions environment

### Programming Model

`ServerlessAdapter.createAzureHandler()` returns a handler with the programming model v3 signature, `(context, req)`, which sets `context.res`. The v4 model's `app.http()` calls a handler with `(request, context)` and expects a returned response, so the handler doesn't fit it. Deploy the agent with the v3 model and a `function.json` file.

### Deployment Steps

1. **Create your function entry file** (`agent/index.ts`). It builds the agent and exports the handler:

```typescript
import { AgentBase, ServerlessAdapter } from '@signalwire/sdk';

class MyAgent extends AgentBase {
  constructor() {
    super({
      name: 'my-agent',
      basicAuth: [process.env.AGENT_USER ?? 'admin', process.env.AGENT_PASSWORD ?? 'a-long-random-password'],
    });
    this.setPromptText('You are a helpful assistant.');
  }
}

const agent = new MyAgent();

export default ServerlessAdapter.createAzureHandler(agent.getApp());
```

2. **Create `agent/function.json`**. The catch-all route lets the one function receive `/api/agent`, `/api/agent/swaig` and `/api/agent/post_prompt`:

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

3. **Add the dependency** to `package.json`:

```json
{
  "type": "module",
  "engines": { "node": ">=22" },
  "dependencies": {
    "@signalwire/sdk": "^3"
  }
}
```

4. **Deploy using the Azure CLI**:

```bash
# Create function app (Node.js 22)
az functionapp create \
    --resource-group myResourceGroup \
    --consumption-plan-location westus \
    --runtime node \
    --runtime-version 22 \
    --functions-version 4 \
    --name my-agent-function \
    --storage-account mystorageaccount

# Deploy code
func azure functionapp publish my-agent-function
```

### Environment Variables

Set the same variables as for Google Cloud Functions in your Function App settings:

```bash
SWML_BASIC_AUTH_USER="your-username"
SWML_BASIC_AUTH_PASSWORD="a-long-random-password"
SIGNALWIRE_SIGNING_KEY="your-signing-key"
SIGNALWIRE_SWAIG_SECRET="a-long-random-secret"
```

### Webhook URLs

The agent builds its webhook URLs from the URL of the request it's answering, up to `/api/<function>`:

```text
https://{function-app-name}.azurewebsites.net/api/{function-name}/swaig
```

Before the first request, it uses `AZURE_FUNCTION_URL`, or `https://<WEBSITE_SITE_NAME>.azurewebsites.net/api/<AZURE_FUNCTION_NAME>`. `SWML_PROXY_URL_BASE` replaces all of these. The agent puts its basic auth credentials in the URL:

```text
https://username:password@{function-app-name}.azurewebsites.net/api/{function-name}/swaig
```

## Authentication

Both platforms use the agent's HTTP basic auth. The credentials come from the constructor's `basicAuth` option, or from `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD`:

<!-- snippet: no-run illustrative fragment: references the assumed `MyAgent` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const agent = new MyAgent(); // uses its basicAuth option, or SWML_BASIC_AUTH_USER and SWML_BASIC_AUTH_PASSWORD
```

### Authentication Flow

The agent handles each request in these steps:

1. The client sends a request with an `Authorization: Basic <credentials>` header.
2. The agent compares the credentials with its configured username and password.
3. If they don't match, it returns `401` with `WWW-Authenticate: Basic realm="Secure Area"` and `{"error":"Unauthorized"}`.
4. If a signing key is set, a POST to the SWML, `/swaig` or `/post_prompt` route must also carry a valid SignalWire signature. Without one, it gets `403`.
5. Otherwise, it handles the request.

`/health` and `/ready` need no credentials.

### Signatures on Each Platform

With `SIGNALWIRE_SIGNING_KEY` set, the agent checks each POST's signature against the URL the platform received it on. On Google Cloud Functions, that's the webhook base URL, which includes the function's name, plus `req.originalUrl`. On Azure, it's `req.url`. If SignalWire's requests are refused with `403`, set `SWML_PROXY_URL_BASE` to the function's public URL. For more information, see [Webhook URLs and Signatures](serverless-guide.md#webhook-urls-and-signatures).

## Testing

### swaig-test CLI

`swaig-test` can run the agent file with each platform's environment before you deploy. These commands print the SWML, whose webhook URLs are the platform's, and call a function:

```bash
# Google Cloud Functions
npx tsx src/cli/swaig-test.ts index.ts --simulate-serverless gcf \
  --gcp-function-url https://us-central1-my-project.cloudfunctions.net/my-agent --dump-swml

# Azure Functions
npx tsx src/cli/swaig-test.ts agent/index.ts --simulate-serverless azure \
  --azure-function-url https://my-agent-function.azurewebsites.net/api/agent --dump-swml

# Call a function (swaig-test's options go before --exec)
npx tsx src/cli/swaig-test.ts index.ts --simulate-serverless gcf --exec my_function --param value
```

The Google options are `--gcp-project`, `--gcp-function-url`, `--gcp-region` and `--gcp-service`. The Azure options are `--azure-env` and `--azure-function-url`. `swaig-test` clears `SWML_PROXY_URL_BASE` for the run. See the [CLI Guide](cli-guide.md#serverless-simulation) for the full set of flags.

### Local Testing

Each platform has a local runtime.

**Google Cloud Functions:**

```bash
# Install the Functions Framework
npm install @google-cloud/functions-framework

# Run locally
npx functions-framework --target=agentHandler
```

**Azure Functions:**

```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Run locally
func start
```

### Testing Authentication

These requests check that the deployed function refuses a request without credentials and accepts one with them:

```bash
# Without credentials: 401
curl -i https://your-function-url/

# With credentials: the SWML document
curl -u username:password https://your-function-url/
```

A secure tool needs the token its call's SWML carries, so a hand-made call to `/swaig` must use the function's URL from the SWML. This script requests the SWML for a test call, takes the function's `web_hook_url`, and calls it with the same `call_id`:

```bash
URL=$(curl -s -u username:password "https://your-function-url/?call_id=test" | node -e '
let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const ai = JSON.parse(s).sections.main.find((v) => v.ai).ai;
  console.log(ai.SWAIG.functions.find((f) => f.function === "your_function_name").web_hook_url);
});')

# The URL includes the credentials and the token
curl -H "Content-Type: application/json" \
  -d '{"function": "your_function_name", "call_id": "test", "argument": {"parsed": [{"param": "value"}]}}' \
  "$URL"
```

With a signing key set, every POST also needs SignalWire's signature, so these hand-made POSTs are refused. Test functions with `swaig-test`, which signs its requests, or through SignalWire.

## Best Practices

### Performance

These practices reduce cold starts and repeated work:

- Keep deployment packages small to shorten cold starts.
- Construct the agent at module scope, not per request.
- Cache data your handlers fetch, where it's safe to.

### Security

These settings protect a deployed function:

- Use the platform's HTTPS URL, and don't expose the function over plain HTTP.
- Keep secrets in environment variables or the platform's secret manager.
- Set explicit basic auth credentials.
- Set `SIGNALWIRE_SIGNING_KEY` so the agent checks SignalWire's signatures.
- Set `SIGNALWIRE_SWAIG_SECRET` to the same value on every instance, so tool tokens validate on any of them. See [Security](security.md#the-signing-secret).

### Monitoring

Use the platform's tools to watch the function:

- Turn on the platform's logging.
- Monitor execution times, and set alerts for errors and timeouts.

## Troubleshooting

### Environment Detection

`getExecutionMode()` returns the environment the SDK detected, as a string: `cgi`, `lambda`, `google_cloud_function`, `azure_function` or `server`:

```typescript
import { getExecutionMode } from '@signalwire/sdk';

console.log(`Detected mode: ${getExecutionMode()}`);
```

### URL Generation

`getFullUrl()` returns the base URL the agent uses for its webhooks, and `getFullUrl(true)` includes the credentials. On Azure and on Google hosts, the URL comes from the request, so the value can change after the first request:

<!-- snippet: no-run illustrative fragment: references the assumed `MyAgent` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const agent = new MyAgent();
console.log(`Base URL: ${agent.getFullUrl()}`);
console.log(`Auth URL: ${agent.getFullUrl(true)}`);
```

### Authentication Issues

If requests get `401`, check these items:

- The username and password are set, and match exactly (they're case-sensitive).
- The client sends the `Authorization` header.
- A `basicAuth` option in the code isn't overriding the environment variables you set.

### Signature Issues

If requests get `403`, the signature check failed. Check that `SIGNALWIRE_SIGNING_KEY` is your space's signing key, and set `SWML_PROXY_URL_BASE` to the function's public URL if the platform's URL differs from the one SignalWire called.

### Debugging

This variable turns on debug logging:

```bash
export SIGNALWIRE_LOG_LEVEL=debug
```

## Examples

See the [Serverless Guide](serverless-guide.md) for AWS Lambda and CGI examples, and for the adapter's details.
