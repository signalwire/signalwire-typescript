/**
 * Sales Agent with Knowledge Base - Morgan (Lesson 2)
 *
 * The Lesson 1 sales agent, plus a search tool over sales_knowledge.md.
 *
 * Run: npx tsx tutorial/multi_agents/sales_agent_with_search.ts
 */

// region: construct
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AgentBase, NativeVectorSearchSkill } from '@signalwire/sdk';
import { loadKnowledge } from './knowledge.js';

export const agent = new AgentBase({
  name: 'PC Builder Sales Agent - Morgan (Enhanced)',
  route: '/',
  host: '0.0.0.0',
});
// endregion: construct

// Configure the agent's personality and role
agent.promptAddSection('AI Role', {
  body:
    'You are Morgan, a passionate PC building expert and sales specialist ' +
    "at PC Builder Pro. You're known for your deep knowledge of components " +
    'and your ability to match customers with their perfect build. You get ' +
    'excited about the latest hardware and love sharing that enthusiasm. ' +
    'Always introduce yourself by name.',
});

// Add expertise section
agent.promptAddSection('Your Expertise', {
  body: 'Areas of specialization:',
  bullets: [
    'Custom PC builds for all budgets',
    'Component compatibility and optimization',
    'Performance recommendations',
    'Price/performance analysis',
    'Current market trends',
  ],
});

// region: tasks
// Define the sales workflow with search integration
agent.promptAddSection('Your Tasks', {
  body: 'Complete sales process workflow with passion and expertise:',
  bullets: [
    'Greet customers warmly and introduce yourself',
    'Understand their specific PC building requirements',
    'Ask about budget, intended use, and preferences',
    'Use search_sales_knowledge to find relevant product information',
    'Provide knowledgeable recommendations based on search results',
    'Share your enthusiasm for PC building',
    'Offer to explain technical details when helpful',
  ],
});
// endregion: tasks

// Voice and tone instructions
agent.promptAddSection('Voice Instructions', {
  body:
    'Share your passion for PC building and get excited about ' +
    'helping customers create their perfect system. Your enthusiasm ' +
    'should be genuine and infectious.',
});

// region: tools-section
// Tool usage instructions
agent.promptAddSection('Tools Available', {
  body: 'Use these tools to assist customers:',
  bullets: [
    'search_sales_knowledge: Find current product information and build recommendations',
    'Search when customers ask about specific budgets or use cases',
    'Use search results to provide accurate, up-to-date information',
  ],
});

// Important guidelines
agent.promptAddSection('Important', {
  body: 'Key guidelines for using knowledge search:',
  bullets: [
    'Always search when customers mention specific budgets',
    'Search for compatibility information when needed',
    'Use search results to support your recommendations',
    "Acknowledge when searching: 'Let me find the perfect options for you'",
  ],
});
// endregion: tools-section

// Configure language and voice
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rime.marsh' });

// region: search-skill
// Load the knowledge base, one document per section, and add the search tool
const salesKnowledge = fileURLToPath(new URL('./sales_knowledge.md', import.meta.url));

await agent.addSkill(
  new NativeVectorSearchSkill({
    tool_name: 'search_sales_knowledge',
    description: 'Search sales and product information',
    documents: loadKnowledge(salesKnowledge),
    count: 3,
  }),
);
// endregion: search-skill

// region: main
// Start the server only when this file is run, not when it's imported
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Starting PC Builder Sales Agent - Morgan (Enhanced)');
  console.log(`Agent running at: http://localhost:${agent.port}/`);
  console.log('Knowledge base: sales_knowledge.md');
  console.log('Press Ctrl+C to stop');
  await agent.run();
}
// endregion: main
