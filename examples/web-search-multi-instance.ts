/**
 * Web Search Multiple Instance Demo
 *
 * Loads the web search skill multiple times with different configurations and
 * custom tool names (general search, news search, quick search).
 *
 * Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX environment variables.
 * Run: npx tsx examples/web-search-multi-instance.ts
 */

import {
  AgentBase,
  WebSearchSkill,
  WikipediaSkill,
  DateTimeSkill,
  MathSkill,
} from '../src/index.js';

export const agent = new AgentBase({
  name: 'multi-search',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a research assistant with access to multiple search tools. ' +
  'Use the most appropriate search tool for each query: ' +
  'general web search, news search, quick search, or Wikipedia.',
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.addHints(['search', 'look up', 'find', 'news', 'Wikipedia']);

// Utility skills
await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());

// Wikipedia search
await agent.addSkill(new WikipediaSkill({ max_results: 2 }));

// Instance 1: General web search (default tool name)
await agent.addSkill(
  new WebSearchSkill({
    max_results: 3,
    safe_search: 'medium',
  }),
);

// Instance 2: News-focused search
await agent.addSkill(
  new WebSearchSkill({
    tool_name: 'search_news',
    max_results: 5,
    safe_search: 'medium',
  }),
);

// Instance 3: Quick single-result search
await agent.addSkill(
  new WebSearchSkill({
    tool_name: 'quick_search',
    max_results: 1,
  }),
);

console.log('Loaded skills:', agent.listSkills().map(s => s.name));
console.log('Search tools: web_search (general), search_news, quick_search, search_wiki');

agent.run();
