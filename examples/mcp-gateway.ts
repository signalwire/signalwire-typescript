/**
 * MCP Gateway Skill Example
 *
 * Demonstrates the MCP (Model Context Protocol) gateway skill,
 * which is a placeholder for future MCP server integration.
 * Run: npx tsx examples/mcp-gateway.ts
 */

import { AgentBase, McpGatewaySkill } from '../src/index.js';

export const agent = new AgentBase({
  name: 'mcp-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are an assistant with access to external tools via MCP (Model Context Protocol). ' +
  'Use the available tools to help the caller with their requests.',
);

// Add MCP Gateway skill — currently a stub for future implementation
await agent.addSkill(
  new McpGatewaySkill({
    gateway_url: 'http://localhost:8080/mcp',
    tool_prefix: 'ext',
  }),
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
