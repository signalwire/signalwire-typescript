/**
 * Wikipedia Skill Example
 *
 * Agent with the Wikipedia search skill for encyclopedic knowledge.
 * No API key required — uses the public Wikipedia REST API.
 * Run: npx tsx examples/wikipedia.ts
 */

import { AgentBase, WikipediaSearchSkill, DateTimeSkill } from '../src/index.js';

export const agent = new AgentBase({
  name: 'wiki-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a knowledgeable assistant with access to Wikipedia. ' +
  'When the user asks about a topic, person, place, or concept, ' +
  'search Wikipedia to provide accurate encyclopedic information. ' +
  'Summarize the information naturally rather than reading it verbatim.',
);

// Add Wikipedia search skill — no API key needed
await agent.addSkill(new WikipediaSearchSkill());

// Also add datetime for general utility
await agent.addSkill(new DateTimeSkill());

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.addHints(['Wikipedia', 'encyclopedia', 'article']);

agent.run();
