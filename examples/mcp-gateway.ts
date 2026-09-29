/**
 * MCP Gateway Skill Example
 *
 * Connects the agent to an MCP (Model Context Protocol) gateway with the
 * mcp_gateway skill. At startup the skill checks the gateway's /health
 * endpoint, lists the tools of each configured service, and registers each
 * one as a SWAIG tool named mcp_<service>_<tool>. Tool calls are forwarded
 * to the gateway.
 *
 * Environment variables:
 *   MCP_GATEWAY_URL            URL of the running MCP gateway (required)
 *   MCP_GATEWAY_AUTH_TOKEN     Bearer token, or instead:
 *   MCP_GATEWAY_AUTH_USER      Basic auth user name
 *   MCP_GATEWAY_AUTH_PASSWORD  Basic auth password
 *   MCP_GATEWAY_SERVICES       Comma-separated services to expose (default: all)
 *
 * The skill refuses a gateway on a private or loopback address, such as
 * http://localhost:8080, unless SWML_ALLOW_PRIVATE_URLS=true is set.
 *
 * Without MCP_GATEWAY_URL the agent starts with no MCP tools and prints how
 * to configure the gateway.
 * Run: npx tsx examples/mcp-gateway.ts
 */

import { AgentBase, McpGatewaySkill } from '@signalwire/sdk';

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

const gatewayUrl = process.env['MCP_GATEWAY_URL'];
const authToken = process.env['MCP_GATEWAY_AUTH_TOKEN'];
const authUser = process.env['MCP_GATEWAY_AUTH_USER'];
const authPassword = process.env['MCP_GATEWAY_AUTH_PASSWORD'];
const services = (process.env['MCP_GATEWAY_SERVICES'] ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)
  .map((name) => ({ name }));

if (!gatewayUrl || !(authToken || (authUser && authPassword))) {
  console.error(
    'MCP gateway not configured, so the agent starts without MCP tools.\n' +
      'Set MCP_GATEWAY_URL and either MCP_GATEWAY_AUTH_TOKEN or ' +
      'MCP_GATEWAY_AUTH_USER and MCP_GATEWAY_AUTH_PASSWORD. ' +
      'A private or localhost gateway URL also needs SWML_ALLOW_PRIVATE_URLS=true.',
  );
} else {
  try {
    await agent.addSkill(
      new McpGatewaySkill({
        gateway_url: gatewayUrl,
        ...(authToken
          ? { auth_token: authToken }
          : { auth_user: authUser, auth_password: authPassword }),
        services,
      }),
    );
  } catch (err) {
    console.error(
      `Could not load the mcp_gateway skill for ${gatewayUrl}. Check that the gateway ` +
        'is running and the credentials are right. A private or localhost URL needs ' +
        'SWML_ALLOW_PRIVATE_URLS=true.',
    );
    throw err;
  }
}

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.serve();
