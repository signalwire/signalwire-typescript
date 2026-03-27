# MCP Integration

The SDK supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) in two ways:

1. **MCP Client** -- Connect to external MCP servers and use their tools in your agent
2. **MCP Server** -- Expose your agent's tools as an MCP endpoint for other clients

These features are independent and can be used separately or together.

## Adding External MCP Servers

Use `addMcpServer()` to connect your agent to remote MCP servers. Tools are discovered at call start via the MCP protocol and added to the AI's tool list alongside your defined tools.

```typescript
import { AgentBase } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent', route: '/agent' });

agent.addMcpServer('https://mcp.example.com/tools', {
  headers: { Authorization: 'Bearer sk-xxx' },
});
```

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `url` | string | MCP server HTTP endpoint URL |
| `opts.headers` | Record<string, string> | Optional HTTP headers for authentication |
| `opts.resources` | boolean | Fetch resources into `global_data` (default: false) |
| `opts.resourceVars` | Record<string, string> | Variables for URI template substitution |

### With Resources

```typescript
agent.addMcpServer('https://mcp.example.com/crm', {
  headers: { Authorization: 'Bearer sk-xxx' },
  resources: true,
  resourceVars: { caller_id: '${caller_id_number}' },
});
```

### Multiple Servers

```typescript
agent.addMcpServer('https://mcp-search.example.com/tools', {
  headers: { Authorization: 'Bearer search-key' },
});
agent.addMcpServer('https://mcp-crm.example.com/tools', {
  headers: { Authorization: 'Bearer crm-key' },
});
```

## Exposing Tools as MCP Server

Use `enableMcpServer()` to add an MCP endpoint at `/mcp` on your agent's server.

```typescript
const agent = new AgentBase({ name: 'my-agent', route: '/agent' });
agent.enableMcpServer();

agent.defineTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: { location: { type: 'string', description: 'City' } },
  handler: (args) => new FunctionResult(`72F sunny in ${args.location}`),
});
```

The `/mcp` endpoint handles:
- `initialize` -- protocol version and capability negotiation
- `notifications/initialized` -- ready signal
- `tools/list` -- returns all tools in MCP format
- `tools/call` -- invokes the handler and returns the result
- `ping` -- keepalive

### Connecting from Claude Desktop

```json
{
    "mcpServers": {
        "my-agent": {
            "url": "https://your-server.com/agent/mcp"
        }
    }
}
```

## Using Both Together

```typescript
agent.enableMcpServer();
agent.addMcpServer('https://mcp.example.com/crm', {
  headers: { Authorization: 'Bearer sk-xxx' },
  resources: true,
});
```

## MCP vs SWAIG Webhooks

| | SWAIG Webhooks | MCP Tools |
|---|---|---|
| Response format | JSON with `response`, `action`, `SWML` | Text content only |
| Call control | Can trigger hold, transfer, SWML | Response only |
| Discovery | Defined in SWML config | Auto-discovered via protocol |
| Auth | `web_hook_auth_user/password` | `headers` dict |

MCP tools are best for data retrieval. Use tool handlers with SWAIG webhooks when you need call control actions.
