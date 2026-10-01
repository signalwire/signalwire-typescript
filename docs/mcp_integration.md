# MCP Integration

The SDK supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) in two ways:

1. **MCP client**: connect to external MCP servers and use their tools in your agent
2. **MCP server**: expose your agent's tools as an MCP endpoint for other clients

These features are independent and can be used separately or together.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
declare global {
  // Shared context the fragments below assume (constructed in earlier examples).
  const agent: import('@signalwire/sdk').AgentBase;
  const AgentBase: typeof import('@signalwire/sdk').AgentBase;
  const FunctionResult: typeof import('@signalwire/sdk').FunctionResult;
}
```

## Adding External MCP Servers

Use `addMcpServer()` to connect your agent to remote MCP servers. The SDK adds each server to the SWML's `SWAIG.mcp_servers` list. SignalWire discovers the servers' tools through the MCP protocol when the call starts, and adds them to the AI's tool list alongside your own tools. This example adds one server with a bearer token:

```typescript
import { AgentBase } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent', route: '/agent' });

agent.addMcpServer('https://mcp.example.com/tools', {
  headers: { Authorization: 'Bearer sk-xxx' },
});
```

### Parameters

`addMcpServer(url, opts)` takes these parameters, and writes each option into the server's entry under the SWML key shown:

| Parameter | Type | SWML key | Description |
|---|---|---|---|
| `url` | `string` | `url` | The MCP server's HTTP endpoint |
| `opts.headers` | `Record<string, string>` | `headers` | HTTP headers SignalWire sends to the server, such as `Authorization` |
| `opts.resources` | `boolean` | `resources` | Fetch the server's resources into `global_data` (default: `false`) |
| `opts.resourceVars` | `Record<string, string>` | `resource_vars` | Variables for resource URI template substitution |

The headers, including any token in them, are part of the SWML the agent serves.

### With Resources

MCP servers can expose read-only data as resources. With `resources: true`, SignalWire fetches them when the session starts and merges them into `global_data`, where prompts can read them as `${global_data.key}`. This example also sets a `caller_id` variable for the resource URIs:

```typescript
agent.addMcpServer('https://mcp.example.com/crm', {
  headers: { Authorization: 'Bearer sk-xxx' },
  resources: true,
  resourceVars: { caller_id: '${caller_id_number}' },
});
```

### Multiple Servers

Call `addMcpServer()` once per server. SignalWire merges the tools of every server into one list:

```typescript
agent.addMcpServer('https://mcp-search.example.com/tools', {
  headers: { Authorization: 'Bearer search-key' },
});
agent.addMcpServer('https://mcp-crm.example.com/tools', {
  headers: { Authorization: 'Bearer crm-key' },
});
```

## Exposing Tools as MCP Server

Use `enableMcpServer()` to add an MCP endpoint at `/mcp` under your agent's route. This example exposes one tool at `/agent/mcp`:

```typescript
const agent = new AgentBase({ name: 'my-agent', route: '/agent' });
agent.enableMcpServer();

agent.defineTool({
  name: 'get_weather',
  description: 'Get weather for a location',
  parameters: { location: { type: 'string', description: 'City' } },
  handler: (args: Record<string, unknown>) => new FunctionResult(`72F sunny in ${args.location}`),
});
```

The endpoint takes JSON-RPC 2.0 requests as POSTs. It answers `404` to a GET, since it doesn't offer a server-to-client stream. It handles these methods:

- `initialize`: protocol version (`2025-06-18`) and capability negotiation
- `notifications/initialized`: ready signal
- `tools/list`: returns the agent's tools in MCP format
- `tools/call`: invokes the handler and returns the result
- `ping`: keepalive

The endpoint lists and calls only the tools the agent runs itself. DataMap tools run on SignalWire, and external webhook tools (a `webhookUrl` on the tool) run on another server. `/mcp` doesn't list them, and `tools/call` answers `Unknown tool` for them.

A `tools/call` result carries the tool's `response` text as MCP text content. A structured `{ tool_result, tool_prompt }` response is sent as its JSON. Actions in the result, such as a transfer, have no meaning outside a call and aren't sent. A handler that throws gets the same result a SWAIG call gets: its `onError` hook's result, its `errorMessage`, or a generic apology, with `isError: false`. The exception's message doesn't reach the client.

Requests to `/mcp` run on the agent itself, not on a per-request copy. A dynamic config callback or `addPerCallConfig()` doesn't run for them, so tools those callbacks register aren't available. The handler's `rawData` holds only `function` and `argument`, with no `call_id` or `global_data`.

This is the response to a `tools/list` request for the example agent:

```json
{"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"get_weather","description":"Get weather for a location","inputSchema":{"type":"object","properties":{"location":{"type":"string","description":"City"}}}}]}}
```

### Authentication

The `/mcp` endpoint runs your agent's tools, so it requires the agent's basic auth credentials, the same ones `/swaig` uses. A request without them gets `401`. The credentials come from the `basicAuth` option or the `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD` environment variables. If you set neither, the agent generates a password that exists only in its process, so set your own for MCP clients to use.

Basic auth is the only check. `tools/call` runs a tool whether or not it's secure, because MCP requests carry no per-call token and no SignalWire signature. Anyone with the credentials can run every tool the endpoint lists. Enable the endpoint only on an agent whose tools you're willing to expose that way. For more information, see [Security](security.md).

### Connecting an MCP client

Give your MCP client the endpoint's URL and an `Authorization: Basic` header built from the agent's credentials. Many clients that support remote HTTP servers accept a configuration like this one; your client's documentation gives its file and exact format:

```json
{
    "mcpServers": {
        "my-agent": {
            "type": "http",
            "url": "https://your-server.com/agent/mcp",
            "headers": {
                "Authorization": "Basic dXNlcjpwYXNzd29yZA=="
            }
        }
    }
}
```

The header value is `Basic` followed by the base64 encoding of `user:password`, which this command prints:

```bash
printf '%s' 'user:password' | base64
```

## Using Both Together

The two features are independent. This agent exposes its own tools at `/mcp` and also gives its calls the tools of an external CRM server:

```typescript
agent.enableMcpServer();
agent.addMcpServer('https://mcp.example.com/crm', {
  headers: { Authorization: 'Bearer sk-xxx' },
  resources: true,
});
```

## MCP vs SWAIG Webhooks

The two ways of giving a call tools differ in what a tool can return and how it's found:

| | SWAIG Webhooks | MCP Tools |
|---|---|---|
| Response format | JSON with `response`, `action`, `SWML` | Text content only |
| Call control | Can trigger hold, transfer, SWML | Response only |
| Discovery | Defined in SWML config | Auto-discovered via protocol |
| Auth | Basic auth credentials in the webhook URL | `headers` in the server's entry |

MCP tools suit data retrieval. Use tool handlers with SWAIG webhooks when you need call control actions.
