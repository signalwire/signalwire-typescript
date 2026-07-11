# SignalWire AI Agents - Cloud Functions Deployment Guide

This guide covers deploying SignalWire AI Agents (TypeScript SDK) to Google Cloud Functions and Azure Functions. For the full serverless reference, including AWS Lambda and CGI, see the [Serverless Guide](serverless-guide.md).

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const MyAgent: any; // the AgentBase subclass defined in the entry-file example above
}
```

## Overview

SignalWire AI Agents support deployment to major serverless platforms:

- **Google Cloud Functions** - Serverless compute on Google Cloud (`gcf`)
- **Azure Functions** - Serverless compute on Microsoft Azure (`azure`)
- **AWS Lambda** - `lambda` (see the [Serverless Guide](serverless-guide.md))

Each platform has a dedicated static helper on `ServerlessAdapter` that wraps the agent's
Hono app into the platform's handler shape. You can also call `agent.runServerless(event,
context, platform)` directly, or `agent.run()` to auto-detect the platform.

## Google Cloud Functions

### Environment Detection

The agent auto-detects Google Cloud Functions using these environment variables:
- `FUNCTION_TARGET` - The function entry point
- `K_SERVICE` - Knative service name (Cloud Run / Functions)

### Deployment Steps

1. **Create your agent entry file** (`index.ts`):

```typescript
import { AgentBase, FunctionResult, ServerlessAdapter } from '@signalwire/sdk';

class MyAgent extends AgentBase {
  constructor() {
    super({ name: 'my-agent' });
    this.setPromptText('You are a helpful assistant.');
  }
}

const agent = new MyAgent();

// HTTP Cloud Function entry point (Functions Framework)
export const agentHandler = ServerlessAdapter.createGcfHandler(agent.getApp());
```

2. **Add the dependency** to `package.json`:

```json
{
  "type": "module",
  "engines": { "node": ">=22" },
  "dependencies": {
    "@google-cloud/functions-framework": "^3",
    "@signalwire/sdk": "^2"
  }
}
```

3. **Deploy using gcloud** (Node.js 22 runtime):

```bash
gcloud functions deploy my-agent \
    --runtime nodejs22 \
    --trigger-http \
    --entry-point agentHandler \
    --allow-unauthenticated
```

### Environment Variables

Set these for your function:

```bash
# SignalWire credentials
export SIGNALWIRE_PROJECT_ID="your-project-id"
export SIGNALWIRE_API_TOKEN="your-token"

# Agent auth
export SWML_BASIC_AUTH_USER="your-username"
export SWML_BASIC_AUTH_PASSWORD="your-password"
```

### URL Format

Google Cloud Functions URLs follow this pattern:
```
https://{region}-{project-id}.cloudfunctions.net/{function-name}
```

With authentication:
```
https://username:password@{region}-{project-id}.cloudfunctions.net/{function-name}
```

## Azure Functions

### Environment Detection

The agent auto-detects Azure Functions using these environment variables:
- `FUNCTIONS_WORKER_RUNTIME` - Runtime language (node, etc.)
- `AZURE_FUNCTIONS_ENVIRONMENT` - Azure Functions runtime environment

### Deployment Steps

1. **Create your function entry file** (e.g. `src/functions/agent.ts`):

<!-- snippet: no-compile deployment example importing the external `@azure/functions` runtime package (not a dependency of this SDK) -->
```typescript
import { app } from '@azure/functions';
import { AgentBase, ServerlessAdapter } from '@signalwire/sdk';

class MyAgent extends AgentBase {
  constructor() {
    super({ name: 'my-agent' });
    this.setPromptText('You are a helpful assistant.');
  }
}

const agent = new MyAgent();
const azureHandler = ServerlessAdapter.createAzureHandler(agent.getApp());

app.http('agent', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: azureHandler,
});
```

2. **Add the dependencies** to `package.json`:

```json
{
  "type": "module",
  "engines": { "node": ">=22" },
  "dependencies": {
    "@azure/functions": "^4",
    "@signalwire/sdk": "^2"
  }
}
```

3. **Deploy using Azure CLI**:

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

Set these in your Azure Function App settings:

```bash
# SignalWire credentials
SIGNALWIRE_PROJECT_ID="your-project-id"
SIGNALWIRE_API_TOKEN="your-token"

# Agent auth
SWML_BASIC_AUTH_USER="your-username"
SWML_BASIC_AUTH_PASSWORD="your-password"
```

### URL Format

Azure Functions URLs follow this pattern:
```
https://{function-app-name}.azurewebsites.net/api/{function-name}
```

With authentication:
```
https://username:password@{function-app-name}.azurewebsites.net/api/{function-name}
```

## Authentication

Both platforms support HTTP Basic Authentication. Credentials are resolved from the
constructor `basicAuth` option or the `SWML_BASIC_AUTH_USER` / `SWML_BASIC_AUTH_PASSWORD`
environment variables:

<!-- snippet: no-run illustrative fragment: references the assumed `MyAgent` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const agent = new MyAgent(); // reads SWML_BASIC_AUTH_* from the environment
```

### Authentication Flow
1. Client sends a request with an `Authorization: Basic <credentials>` header.
2. The agent validates credentials against the configured username/password.
3. If invalid, it returns 401 with a `WWW-Authenticate` header.
4. If valid, it processes the request normally.

## Testing

### swaig-test CLI

The `swaig-test` CLI can simulate serverless environments before deployment. Run it with
`npx tsx`:

```bash
# List available tools
npx tsx src/cli/swaig-test.ts examples/my-agent.ts --list-tools

# Dump generated SWML
npx tsx src/cli/swaig-test.ts examples/my-agent.ts --dump-swml

# Execute a specific tool
npx tsx src/cli/swaig-test.ts examples/my-agent.ts --exec my_function --param value
```

See the [CLI Guide](cli-guide.md) for the full set of flags.

### Local Testing

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

```bash
# Test without auth (should return 401)
curl https://your-function-url/

# Test with valid auth
curl -u username:password https://your-function-url/

# Test a SWAIG function call
curl -u username:password \
  -H "Content-Type: application/json" \
  -d '{"call_id": "test", "function": "your_function_name", "argument": {"parsed": [{"param": "value"}]}}' \
  https://your-function-url/swaig
```

## Best Practices

### Performance
- Minimize cold-start times with smaller deployment packages.
- Reuse the agent instance across invocations (construct it at module scope, not per request).
- Implement caching where appropriate.

### Security
- Always use HTTPS endpoints.
- Use environment variables (or cloud secret management) for sensitive data.
- Set explicit `SWML_BASIC_AUTH_*` credentials in production.

### Monitoring
- Enable cloud platform logging.
- Monitor function execution times and set up error/timeout alerts.

## Troubleshooting

### Environment Detection

```typescript
import { getExecutionMode } from '@signalwire/sdk';

// Returns a [mode, logMode] tuple
const [mode] = getExecutionMode();
console.log(`Detected mode: ${mode}`);
```

### URL Generation

<!-- snippet: no-run illustrative fragment: references the assumed `MyAgent` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const agent = new MyAgent();
console.log(`Base URL: ${agent.getFullUrl()}`);
console.log(`Auth URL: ${agent.getFullUrl(true)}`);
```

### Authentication Issues
- Verify the username/password are set correctly.
- Check that the `Authorization` header is being sent.
- Ensure credentials match exactly (case-sensitive).

### Debugging

Enable debug logging:
```bash
export SIGNALWIRE_LOG_LEVEL=debug
```

## Examples

See the [Serverless Guide](serverless-guide.md) for complete AWS Lambda, GCF, Azure, and CGI deployment examples.
