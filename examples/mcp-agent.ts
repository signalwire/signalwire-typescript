/**
 * Example: MCP Integration -- Client and Server
 *
 * This agent demonstrates both MCP features:
 *
 * 1. MCP Server: Exposes tools at /mcp so external MCP clients
 *    (Claude Desktop, other agents) can discover and invoke them.
 *
 * 2. MCP Client: Connects to an external MCP server to pull in additional
 *    tools for voice calls.
 *
 * Run:
 *   npx tsx examples/mcp-agent.ts
 *
 * Then:
 *   - Point a SignalWire phone number at http://your-server:3000/agent
 *   - Connect Claude Desktop to http://your-server:3000/agent/mcp
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

const agent = new AgentBase({
  name: 'mcp-agent',
  route: '/agent',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

// -- MCP Server --
// Adds a /mcp endpoint that speaks JSON-RPC 2.0 (MCP protocol).
agent.enableMcpServer();

// -- MCP Client --
// Connect to an external MCP server. Tools are discovered automatically.
agent.addMcpServer('https://mcp.example.com/tools', {
  headers: { Authorization: 'Bearer sk-your-mcp-api-key' },
});

// -- MCP Client with Resources --
agent.addMcpServer('https://mcp.example.com/crm', {
  headers: { Authorization: 'Bearer sk-your-crm-key' },
  resources: true,
  resourceVars: { caller_id: '${caller_id_number}', tenant: 'acme-corp' },
});

// -- Agent Configuration --
agent.promptAddSection('Role', {
  body: 'You are a helpful customer support agent. '
    + 'You have access to the customer\'s profile via global_data.',
});
agent.promptAddSection('Customer Context', {
  body: 'Customer name: ${global_data.customer_name}\n'
    + 'Account status: ${global_data.account_status}',
});

agent.setParams({ attention_timeout: 15000 });

// -- Local Tools --
agent.defineTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  parameters: { location: { type: 'string', description: 'City name or zip code' } },
  handler: (args: Record<string, unknown>) => {
    const location = (args['location'] as string) || 'unknown';
    return new SwaigFunctionResult(`Currently 72F and sunny in ${location}.`);
  },
});

agent.defineTool({
  name: 'create_ticket',
  description: 'Create a support ticket for the customer',
  parameters: {
    subject: { type: 'string', description: 'Ticket subject' },
    description: { type: 'string', description: 'Detailed description' },
  },
  handler: (args: Record<string, unknown>) => {
    const subject = (args['subject'] as string) || 'No subject';
    return new SwaigFunctionResult(`Ticket created: '${subject}'. Reference: TK-12345.`);
  },
});

agent.run();
