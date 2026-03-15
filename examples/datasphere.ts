/**
 * DataSphere Skill Example
 *
 * Uses the DataSphere skill to search a SignalWire knowledge base.
 * Requires SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN, and SIGNALWIRE_SPACE env vars.
 * Run: npx tsx examples/datasphere.ts
 */

import { AgentBase, DataSphereSkill } from '../src/index.js';

export const agent = new AgentBase({
  name: 'knowledge-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a knowledge assistant with access to a document library. ' +
  'Use the search tool to find answers to user questions from the knowledge base. ' +
  'Always cite the source when providing information from the knowledge base.',
);

// Add DataSphere skill with custom configuration
await agent.addSkill(
  new DataSphereSkill({
    max_results: 3,
    distance_threshold: 0.6,
  }),
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.addHints(['DataSphere', 'knowledge base', 'documentation']);

agent.run();
