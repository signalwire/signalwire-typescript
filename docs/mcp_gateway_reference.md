# MCP to SWAIG Gateway

<!-- snippet-setup -->

```ts
export {}; // treat each example as a module (top-level await)
declare global {
  const agent: import('@signalwire/sdk').AgentBase;
  const McpGatewaySkill: typeof import('@signalwire/sdk').McpGatewaySkill;
}
```

## Overview

The MCP-SWAIG gateway lets a SignalWire AI agent call tools on Model Context Protocol (MCP) servers that run as local processes, through SWAIG functions.

There are two pieces:

1. **The gateway service**: a standalone HTTP server that starts MCP server processes, keeps a session per call, and translates between the two protocols. The TypeScript SDK doesn't include one. The Python SDK ships one as the `mcp-gateway` command (`pip install "signalwire-sdk[mcp-gateway]"`). Deploy it once and point your agents at it.
2. **`McpGatewaySkill`**: a built-in skill in the TypeScript SDK that connects an agent to a running gateway, lists each service's tools, and registers them as SWAIG functions.

This page covers the skill's configuration and behavior, and the gateway endpoints the skill calls. To give a call the tools of an MCP server that speaks HTTP, you don't need a gateway: see [MCP Integration](mcp_integration.md).

## Installation (SDK Side)

`McpGatewaySkill` ships with the SDK, so no extra package is required:

```bash
npm install @signalwire/sdk
```

Add it to an agent like any other built-in skill. `addSkill()` runs the skill's setup, which contacts the gateway, so it needs a gateway that's running:

<!-- snippet: no-run instantiating the `mcp_gateway` builtin requires live credentials/network at setup — cannot run standalone -->

```typescript
import { AgentBase, McpGatewaySkill } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'mcp-agent' });

await agent.addSkill(
  new McpGatewaySkill({
    gateway_url: 'https://mcp-gateway.example.com',
    auth_user: 'admin',
    auth_password: process.env.MCP_GATEWAY_AUTH_PASSWORD,
    services: [{ name: 'todo' }],
  }),
);
```

`agent.addSkillByName('mcp_gateway', { ... })` takes the same configuration.

## Architecture

### Components

The gateway and the skill divide the work this way:

1. **MCP gateway service** (standalone server)
   - HTTP or HTTPS server with basic or bearer-token authentication
   - Starts and manages MCP server processes
   - Keeps a session per SignalWire call
   - Translates between SWAIG and MCP

2. **`McpGatewaySkill`** (`src/skills/builtin/mcp_gateway.ts`)
   - Checks the gateway's health and lists each service's tools during setup
   - Registers each MCP tool as a SWAIG function named `<tool_prefix><service>_<tool>` (default prefix `mcp_`)
   - Registers an internal `_mcp_gateway_hangup` tool, marked `is_hangup_hook`, that closes the call's MCP session

## Protocol Flow

A tool call passes through these steps between the agent, the gateway and the MCP server:

```text
SignalWire Agent                 Gateway Service              MCP Server
      |                                |                          |
      |---(1) Add Skill--------------->|                          |
      |<--(2) Query Tools--------------|                          |
      |                                |---(3) List Tools-------->|
      |                                |<--(4) Tool List----------|
      |---(5) Call SWAIG Function----->|                          |
      |                                |---(6) Spawn Session----->|
      |                                |---(7) Call MCP Tool----->|
      |                                |<--(8) MCP Response-------|
      |<--(9) SWAIG Response-----------|                          |
      |                                |                          |
      |---(10) Hangup Hook------------>|                          |
      |                                |---(11) Close Session---->|
```

## Message Envelope Format

When a registered tool runs, the skill POSTs this body to the gateway's `/services/<name>/call` endpoint. The service name is part of the URL, not the body:

```json
{
  "tool": "add_todo",
  "arguments": { "text": "Buy milk" },
  "session_id": "call_xyz123",
  "timeout": 300,
  "metadata": {
    "agent_id": "mcp-agent",
    "timestamp": "2026-09-28T10:30:00Z",
    "call_id": "call_xyz123"
  }
}
```

The fields come from these sources:

- `session_id`: `global_data.mcp_call_id` when it's a string, otherwise the SWAIG request's `call_id`, otherwise `unknown`.
- `timeout`: the `session_timeout` setting.
- `metadata.agent_id`: the agent's name. `metadata.timestamp` and `metadata.call_id` are copied from the SWAIG request, and left out when it has none.

## Skill Configuration

`McpGatewaySkill` takes these configuration keys, in `snake_case` like every skill's configuration:

```typescript
await agent.addSkill(
  new McpGatewaySkill({
    gateway_url: 'https://mcp-gateway.example.com', // required
    auth_user: 'admin', // basic auth (or use auth_token)
    auth_password: process.env.MCP_GATEWAY_AUTH_PASSWORD,
    // auth_token: process.env.MCP_GATEWAY_AUTH_TOKEN, // bearer token instead of basic auth
    services: [
      { name: 'todo', tools: ['add_todo', 'list_todos'] }, // these tools only
      { name: 'calculator', tools: '*' }, // all tools
    ],
    session_timeout: 300, // sent to the gateway as each call's timeout, in seconds
    tool_prefix: 'mcp_', // prefix for SWAIG function names
    retry_attempts: 3, // attempts per tool call
    request_timeout: 30, // per-request timeout in seconds
    verify_ssl: true, // TLS certificate verification
  }),
);
```

| Key                  | Type    | Default                     | Description                                                                                              |
| -------------------- | ------- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| `gateway_url`        | string  | (required)                  | URL of the gateway service. A trailing slash is removed.                                                 |
| `auth_token`         | string  | `MCP_GATEWAY_AUTH_TOKEN`    | Bearer token. When set, it's used instead of basic auth.                                                 |
| `auth_user`          | string  | `MCP_GATEWAY_AUTH_USER`     | Basic auth username. Required when there's no token.                                                     |
| `auth_password`      | string  | `MCP_GATEWAY_AUTH_PASSWORD` | Basic auth password. Required when there's no token.                                                     |
| `services`           | array   | `[]`                        | Services to connect to, each `{ name, tools? }`. `tools` is `'*'` (the default) or a list of tool names. |
| `session_timeout`    | integer | `300`                       | Session timeout in seconds, sent in each call's envelope                                                 |
| `tool_prefix`        | string  | `mcp_`                      | Prefix for registered SWAIG function names                                                               |
| `retry_attempts`     | integer | `3`                         | Attempts per tool call, the first one included                                                           |
| `request_timeout`    | integer | `30`                        | Timeout for each request to the gateway, in seconds                                                      |
| `verify_ssl`         | boolean | `true`                      | Verify the gateway's TLS certificate. `false` has an effect only with `allow_insecure_tls`.              |
| `allow_insecure_tls` | boolean | `false`                     | Second switch needed to turn verification off. Both must be set to accept any certificate.               |

The Default column names the environment variable the skill reads when a credential key is missing.

When `services` is empty, the skill requests the gateway's `/services` endpoint and connects to every service it lists.

### Safe Defaults

The skill's defaults refuse the two riskiest configurations:

- **Private addresses**: the skill refuses a `gateway_url` that resolves to a private, loopback or link-local address, including `localhost`. A configuration value can't point it at an internal service. Every request to the gateway is checked the same way, including each redirect, and connects only to an address it checked. This holds with `allow_insecure_tls` on too: it skips only the certificate check. For a gateway on the same host or a private network, set `SWML_ALLOW_PRIVATE_URLS=true` in the agent's environment. [Security](security.md#outbound-url-protection-ssrf) lists the refused ranges.
- **Certificate verification**: `verify_ssl: false` alone leaves verification on and logs a warning. To accept a self-signed certificate, also set `allow_insecure_tls: true`. The agent then accepts any certificate from the gateway, so a machine in the network path can read and change the traffic. The address checks on every request and redirect still apply.

The skill sends the credentials on every request to the gateway, including the health check. Use an `https://` gateway URL outside a private network.

## What the Skill Registers

After setup, the skill adds these items to the agent:

- **One SWAIG function per MCP tool**, named `<tool_prefix><service>_<tool>`, with the description `[<service>] <tool description>`. Each top-level property of the tool's input schema becomes a parameter with its `type` (default `string`), `description`, `enum` and, for optional parameters, `default`. Nested schemas (`properties` of an object, `items` of an array) aren't copied.
- **The `_mcp_gateway_hangup` tool**, marked `is_hangup_hook`, which sends `DELETE /sessions/<session_id>` when the call ends.
- **Global data**: `mcp_gateway_url`, `mcp_services` and `mcp_session_id` (always `null`).
- **A prompt section** titled "MCP Gateway Integration" that lists the gateway URL and the services.
- **Speech hints**: `MCP`, `gateway` and each service name.

When setup succeeds but finds no tool, for example because `/services` failed, the skill registers a single `mcp_invoke` tool. Its response says the gateway isn't configured.

## Gateway Service Configuration

The gateway service reads its own configuration file, whose format depends on the gateway you deploy. The Python SDK's gateway reads a `config.json` that substitutes environment variables with `${VAR_NAME|default}` syntax. This is an example of that format:

```json
{
  "server": {
    "host": "${MCP_HOST|0.0.0.0}",
    "port": "${MCP_PORT|8080}",
    "auth_user": "${MCP_AUTH_USER|admin}",
    "auth_password": "${MCP_AUTH_PASSWORD}",
    "auth_token": "${MCP_AUTH_TOKEN}"
  },
  "services": {
    "todo": {
      "command": ["node", "./test/todo_mcp.js"],
      "description": "Simple todo list for testing",
      "enabled": true
    },
    "calculator": {
      "command": ["node", "/path/to/calculator.js"],
      "description": "Math calculations",
      "enabled": true
    }
  },
  "session": {
    "default_timeout": 300,
    "max_sessions_per_service": 100,
    "cleanup_interval": 60
  }
}
```

## API Endpoints (Gateway Service)

The skill calls these endpoints on the gateway, with its credentials on each request.

#### GET /health

Health check. The skill calls it during setup, and setup fails unless it returns a 2xx status:

```bash
curl https://mcp-gateway.example.com/health
```

#### GET /services

Lists the available services as an object keyed by service name. The skill calls it when `services` is empty:

```bash
curl -u "admin:$MCP_GATEWAY_AUTH_PASSWORD" https://mcp-gateway.example.com/services
```

#### GET /services/{serviceName}/tools

Returns a service's tools as `{ "tools": [...] }`, each with a `name`, a `description` and an `inputSchema`:

```bash
curl -u "admin:$MCP_GATEWAY_AUTH_PASSWORD" https://mcp-gateway.example.com/services/todo/tools
```

#### POST /services/{serviceName}/call

Calls a tool on a service. This request uses basic auth:

```bash
curl -u "admin:$MCP_GATEWAY_AUTH_PASSWORD" -X POST https://mcp-gateway.example.com/services/todo/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "add_todo",
    "arguments": {"text": "Test item"},
    "session_id": "test-123",
    "timeout": 300
  }'
```

This request uses a bearer token:

```bash
curl -X POST https://mcp-gateway.example.com/services/todo/call \
  -H "Authorization: Bearer $MCP_GATEWAY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "add_todo",
    "arguments": {"text": "Test item"},
    "session_id": "test-123"
  }'
```

The skill reads the `result` field of a `200` response. A string is used as the tool's response, another value is sent as its JSON, and a missing field becomes `No response`.

#### DELETE /sessions/{sessionId}

Closes a session. The skill's hangup hook calls it, and treats `200` and `404` as success:

```bash
curl -u "admin:$MCP_GATEWAY_AUTH_PASSWORD" -X DELETE https://mcp-gateway.example.com/sessions/test-123
```

## Testing

### Testing with the swaig-test CLI

`swaig-test` loads the agent file, which runs the skill's setup against the gateway. Put `--call-id` before `--exec`, since everything after the function name is an argument to the function. Using the same call ID for each call keeps the calls in one gateway session:

```bash
# List the registered MCP tools
npx tsx src/cli/swaig-test.ts test/test-agent.ts --list-tools

# Call two tools in the same session
npx tsx src/cli/swaig-test.ts test/test-agent.ts --call-id test-session --exec mcp_todo_add_todo --text "Buy milk"
npx tsx src/cli/swaig-test.ts test/test-agent.ts --call-id test-session --exec mcp_todo_list_todos

# Print the SWML document
npx tsx src/cli/swaig-test.ts test/test-agent.ts --dump-swml
```

### End-to-End Test Agent

This agent connects to a gateway on the same machine, so its environment needs `SWML_ALLOW_PRIVATE_URLS=true` for setup to accept the `localhost` URL:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port) — collides under the concurrent gate and cannot run standalone -->

```typescript
// test/test-agent.ts
import { AgentBase, McpGatewaySkill } from '@signalwire/sdk';

class TestMcpAgent extends AgentBase {
  static async create(): Promise<TestMcpAgent> {
    const agent = new TestMcpAgent({ name: 'MCP Test Agent' });
    await agent.addSkill(
      new McpGatewaySkill({
        gateway_url: 'http://localhost:8080',
        auth_user: 'admin',
        auth_password: process.env.MCP_GATEWAY_AUTH_PASSWORD,
        services: [{ name: 'todo' }],
      }),
    );
    return agent;
  }
}

const agent = await TestMcpAgent.create();
await agent.run();
```

## Implementation Details

### Session Management

The gateway, not the skill, keeps session state. The skill's part is to send a stable `session_id`:

1. **Session creation**: the first tool call with a new `session_id` creates a session on the gateway.
2. **Session persistence**: later tool calls in the same call send the same `session_id`, so they reach the same session.
3. **Session cleanup**: the hangup hook sends `DELETE /sessions/{id}` when the call ends.
4. **State isolation**: each session gets its own MCP server process on the gateway.

### Error Handling

A tool call makes up to `retry_attempts` attempts, the first one included:

1. **Server errors (5xx)**: retried.
2. **Client errors (4xx)**: returned without a retry.
3. **Timeouts and network errors**: retried. Other exceptions stop the attempts.
4. **Final failure**: the tool's response is `Failed to call <service>.<tool>: <error>`. The error is the gateway's `error` field, or the status and the start of the body.

## Troubleshooting

1. **`Failed to setup skill 'mcp_gateway'`**: `addSkill()` throws this when setup fails. The log gives the reason: a missing `gateway_url` or credentials, a URL refused as private, a health check that didn't return 2xx, or a connection error.
2. **`gateway_url rejected by SSRF protection`**: the URL resolves to a private or loopback address. Set `SWML_ALLOW_PRIVATE_URLS=true` if the gateway is on a private network.
3. **Authentication failures**: check that `auth_user` and `auth_password`, or `auth_token`, match the gateway's configuration.
4. **TLS certificate errors**: give the gateway a certificate from a trusted CA. For a self-signed certificate on a private network, set both `verify_ssl: false` and `allow_insecure_tls: true`.
5. **Lost session state**: check that the gateway keeps the MCP process alive between tool calls, and that each call sends the same `session_id`.

## Related Pages

For MCP servers that SignalWire can reach over HTTP, which need no gateway, see [MCP Integration](mcp_integration.md). For the address ranges the skill refuses, see [Security](security.md#outbound-url-protection-ssrf).
