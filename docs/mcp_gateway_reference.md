# MCP to SWAIG Gateway

## Overview

The MCP-SWAIG Gateway bridges Model Context Protocol (MCP) servers with SignalWire AI Gateway (SWAIG) functions, letting SignalWire AI agents call MCP-based tools.

There are two pieces:

1. **The gateway service** — a standalone HTTP server that manages MCP server processes,
   sessions, and protocol translation. It is a separate component (not part of the
   TypeScript SDK); deploy it once and point your agents at it.
2. **The `McpGatewaySkill`** — a built-in skill in the TypeScript SDK that connects an agent
   to a running gateway, discovers each service's tools, and registers them as SWAIG
   functions.

This document covers both: the SDK-side skill (what you configure in TypeScript) and the
gateway service it talks to.

## Installation (SDK side)

`McpGatewaySkill` ships with the SignalWire AI Agents SDK — no extra package is required:

```bash
npm install @signalwire/sdk
```

Add it to an agent like any other built-in skill:

```typescript
import { AgentBase, McpGatewaySkill } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'mcp-agent' });

await agent.addSkill(
  new McpGatewaySkill({
    gateway_url: 'https://localhost:8080',
    auth_user: 'admin',
    auth_password: 'changeme',
    services: [{ name: 'todo' }],
  }),
);
```

## Architecture

### Components

1. **MCP Gateway Service** (standalone server)
   - HTTP/HTTPS server with Basic or Bearer-token authentication
   - Manages multiple MCP server instances
   - Handles session lifecycle per SignalWire call
   - Translates between SWAIG and MCP protocols

2. **`McpGatewaySkill`** (`src/skills/builtin/mcp_gateway.ts`)
   - SignalWire skill that connects an agent to the gateway
   - Discovers MCP services, then registers each MCP tool as a SWAIG function named
     `<tool_prefix><service>_<tool>` (default prefix `mcp_`)
   - Registers an internal hangup-hook tool that closes the MCP session when the call ends

## Protocol Flow

```
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

When the skill calls a tool, it POSTs an envelope to the gateway's
`/services/<name>/call` endpoint:

```json
{
    "tool": "add_todo",
    "arguments": { "text": "Buy milk" },
    "session_id": "call_xyz123",
    "timeout": 300,
    "metadata": {
        "agent_id": "mcp-agent",
        "call_id": "call_xyz123"
    }
}
```

The `session_id` is derived from `global_data.mcp_call_id` when present, otherwise from the
SWAIG `call_id`.

## Skill Configuration

`McpGatewaySkill` accepts the following configuration keys (skill config keys are
`snake_case`):

```typescript
await agent.addSkill(
  new McpGatewaySkill({
    gateway_url: 'https://localhost:8080', // required
    auth_user: 'admin', // basic auth (or use auth_token)
    auth_password: 'changeme',
    // auth_token: 'bearer-token',          // alternative to basic auth
    services: [
      { name: 'todo', tools: ['add_todo', 'list_todos'] }, // specific tools only
      { name: 'calculator', tools: '*' }, // all tools
    ],
    session_timeout: 300, // session timeout in seconds
    tool_prefix: 'mcp_', // prefix for SWAIG function names
    retry_attempts: 3, // gateway connection retries
    request_timeout: 30, // individual request timeout (seconds)
    verify_ssl: true, // SSL certificate verification
  }),
);
```

Auth credentials and the gateway URL can also come from the environment:
`MCP_GATEWAY_AUTH_TOKEN`, `MCP_GATEWAY_AUTH_USER`, `MCP_GATEWAY_AUTH_PASSWORD`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `gateway_url` | string | (required) | URL of the MCP Gateway service |
| `auth_token` | string | env | Bearer token (alternative to basic auth) |
| `auth_user` | string | env | Basic auth username |
| `auth_password` | string | env | Basic auth password |
| `services` | array | `[]` (all) | Services to connect to; each `{ name, tools? }` |
| `session_timeout` | integer | 300 | Session timeout in seconds |
| `tool_prefix` | string | `mcp_` | Prefix for registered SWAIG function names |
| `retry_attempts` | integer | 3 | Retry attempts for failed requests |
| `request_timeout` | integer | 30 | Per-request timeout in seconds |
| `verify_ssl` | boolean | `true` | Verify SSL certificates |

If `services` is empty, the skill queries the gateway's `/services` endpoint and connects to
all available services.

## Gateway Service Configuration

The gateway service is configured with its own `config.json`. The exact format depends on
the gateway implementation you deploy; a typical config supports environment-variable
substitution using `${VAR_NAME|default}` syntax:

```json
{
    "server": {
        "host": "${MCP_HOST|0.0.0.0}",
        "port": "${MCP_PORT|8080}",
        "auth_user": "${MCP_AUTH_USER|admin}",
        "auth_password": "${MCP_AUTH_PASSWORD|changeme}",
        "auth_token": "${MCP_AUTH_TOKEN|optional-bearer-token}"
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

These are the endpoints the `McpGatewaySkill` calls on the gateway service.

#### GET /health
Health check endpoint (the skill calls this during `setup()`).
```bash
curl http://localhost:8080/health
```

#### GET /services
List available MCP services.
```bash
curl -u admin:changeme http://localhost:8080/services
```

#### GET /services/{serviceName}/tools
Get the tools for a specific service.
```bash
curl -u admin:changeme http://localhost:8080/services/todo/tools
```

#### POST /services/{serviceName}/call
Call a tool on a service.

Using Basic Auth:
```bash
curl -u admin:changeme -X POST http://localhost:8080/services/todo/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "add_todo",
    "arguments": {"text": "Test item"},
    "session_id": "test-123",
    "timeout": 300
  }'
```

Using Bearer Token:
```bash
curl -X POST http://localhost:8080/services/todo/call \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "add_todo",
    "arguments": {"text": "Test item"},
    "session_id": "test-123"
  }'
```

#### DELETE /sessions/{sessionId}
Close a specific session (the skill calls this from its hangup hook).
```bash
curl -u admin:changeme -X DELETE http://localhost:8080/sessions/test-123
```

## Security Features

### Authentication
The skill authenticates to the gateway with either:
- **Basic Auth**: `auth_user` + `auth_password`, or
- **Bearer Token**: `auth_token`.

### SSRF Protection
During `setup()`, the skill validates `gateway_url` and rejects private/loopback/metadata
endpoints in multi-tenant deployments.

### SSL Verification
SSL certificate verification is on by default. Set `verify_ssl: false` to accept
self-signed certificates (development only).

## Testing

### Testing with the swaig-test CLI

```bash
# List the registered MCP tools
npx tsx src/cli/swaig-test.ts test/test-agent.ts --list-tools

# IMPORTANT: --call-id must come BEFORE --exec for session persistence
npx tsx src/cli/swaig-test.ts test/test-agent.ts --call-id test-session --exec mcp_todo_add_todo --text "Buy milk"
npx tsx src/cli/swaig-test.ts test/test-agent.ts --call-id test-session --exec mcp_todo_list_todos

# Generate the SWML document
npx tsx src/cli/swaig-test.ts test/test-agent.ts --dump-swml
```

### End-to-End Test Agent

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
        auth_password: 'changeme',
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

1. **Session Creation**: The first tool call creates a session keyed by `session_id`.
2. **Session Persistence**: Sessions are maintained across multiple tool calls within a call.
3. **Session Cleanup**: The skill's hangup-hook tool issues `DELETE /sessions/{id}` when the call ends.
4. **State Isolation**: Each session gets a separate MCP server instance on the gateway.

### Error Handling

1. **Server errors (5xx)**: The skill retries up to `retry_attempts` times.
2. **Client errors (4xx)**: Returned immediately without retry.
3. **Network/timeout errors**: Retried; other exceptions abort the retry loop.
4. **Failures**: Returned to the AI as a `FunctionResult` describing the error.

## Troubleshooting

1. **Gateway health check fails** — Verify `gateway_url` is reachable and that credentials match. The skill's `setup()` returns `false` if the health check fails.
2. **Authentication failures** — Confirm `auth_user`/`auth_password` (or `auth_token`) match the gateway configuration.
3. **SSL certificate errors** — For self-signed certs, set `verify_ssl: false`.
4. **Session persistence issues** — Ensure the gateway keeps the MCP process alive between calls and that the same `session_id` (call_id) is used.

## Examples

- See `examples/` in the SDK repository for an agent that connects to MCP servers through the `mcp_gateway` skill.
