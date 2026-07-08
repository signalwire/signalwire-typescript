/**
 * Quickstart: a minimal AI voice agent.
 *
 * This is the canonical README quickstart, kept as a real, gate-compiled example so
 * the README code block can be included from it byte-for-byte (README-INCLUDE gate).
 *
 * Run: npx tsx examples/quickstart-agent.ts
 */

// region: construct
import { AgentBase, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({
  name: 'my-agent',
  route: '/agent',
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'inworld.Mark' });
agent.promptAddSection('Role', { body: 'You are a helpful assistant.' });

agent.defineTool({
  name: 'get_time',
  description: 'Get the current time',
  parameters: {},
  handler: () => new FunctionResult(`The time is ${new Date().toLocaleTimeString()}`),
});

agent.run(); // Starts HTTP server on port 3000
// endregion: construct
