/**
 * Simple Static Agent Example
 *
 * The most minimal possible agent: no tools, no dynamic config,
 * just a prompt and a voice. Useful as a starting template.
 * Run: npx tsx examples/simple-static.ts
 * Test: curl http://user:pass@localhost:3000/
 */

import { AgentBase } from '../src/index.js';

export const agent = new AgentBase({
  name: 'greeter',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a friendly greeter. Welcome each caller warmly, ' +
  'ask how their day is going, and make pleasant small talk. ' +
  'Keep responses brief and conversational.',
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
