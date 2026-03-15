/**
 * Custom Path Example
 *
 * Agent running on a custom HTTP path instead of the default '/'.
 * Useful for hosting agents at specific URL paths behind a reverse proxy.
 * Run: npx tsx examples/custom-path.ts
 * Test: curl http://user:pass@localhost:3000/my-custom-agent
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'custom-path-agent',
  route: '/my-custom-agent',
  port: 3000,
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a helpful assistant hosted at a custom URL path. ' +
  'Tell the caller your name and offer to help.',
);

agent.defineTool({
  name: 'get_agent_info',
  description: 'Get information about this agent including its URL path',
  parameters: {},
  handler: () => {
    return new SwaigFunctionResult(
      `This agent is running at the custom path /my-custom-agent on port 3000.`,
    );
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

// When using a proxy, set the external URL so webhooks resolve correctly
if (process.env['SWML_PROXY_URL_BASE']) {
  agent.manualSetProxyUrl(process.env['SWML_PROXY_URL_BASE']);
}

agent.run();
