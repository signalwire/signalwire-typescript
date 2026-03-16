/**
 * Web Search Skill Example
 *
 * Agent with the web search skill for looking up current information.
 * Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX environment variables.
 * Run: npx tsx examples/web-search.ts
 */

import { AgentBase, WebSearchSkill } from '../src/index.js';

export const agent = new AgentBase({
  name: 'search-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a research assistant with access to web search. ' +
  'When the user asks about current events, facts, or anything you are not sure about, ' +
  'use the web_search tool to find up-to-date information. ' +
  'Summarize search results concisely.',
);

// Add web search skill with custom configuration
await agent.addSkill(
  new WebSearchSkill({
    max_results: 5,
    safe_search: 'medium',
  }),
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.addHints(['search', 'look up', 'find out', 'Google']);

agent.run();
