/**
 * Simple Sales Agent - Morgan (Lesson 1)
 *
 * A PC building sales specialist with a structured prompt and a voice.
 *
 * Run: npx tsx tutorial/multi_agents/sales_agent.ts
 */

// region: construct
import { pathToFileURL } from 'node:url';
import { AgentBase } from '@signalwire/sdk';

export const agent = new AgentBase({
  name: 'PC Builder Sales Agent - Morgan',
  route: '/',
  host: '0.0.0.0',
});
// endregion: construct

// region: role
// Configure the agent's personality and role
agent.promptAddSection('AI Role', {
  body:
    'You are Morgan, a passionate PC building expert and sales specialist ' +
    "at PC Builder Pro. You're known for your deep knowledge of components " +
    'and your ability to match customers with their perfect build. You get ' +
    'excited about the latest hardware and love sharing that enthusiasm. ' +
    'Always introduce yourself by name.',
});
// endregion: role

// region: expertise
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
// endregion: expertise

// region: tasks
// Define the sales workflow
agent.promptAddSection('Your Tasks', {
  body: 'Complete sales process workflow with passion and expertise:',
  bullets: [
    'Greet customers warmly and introduce yourself',
    'Understand their specific PC building requirements',
    'Ask about budget, intended use, and preferences',
    'Provide knowledgeable recommendations',
    'Share your enthusiasm for PC building',
    'Offer to explain technical details when helpful',
  ],
});
// endregion: tasks

// region: voice-instructions
// Voice and tone instructions
agent.promptAddSection('Voice Instructions', {
  body:
    'Share your passion for PC building and get excited about ' +
    'helping customers create their perfect system. Your enthusiasm ' +
    'should be genuine and infectious.',
});
// endregion: voice-instructions

// region: language
// Configure language and voice
agent.addLanguage({
  name: 'English',
  code: 'en-US',
  voice: 'rime.marsh', // A friendly, enthusiastic voice
});
// endregion: language

// region: main
// Start the server only when this file is run, not when it's imported
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Starting PC Builder Sales Agent - Morgan');
  console.log(`Agent running at: http://localhost:${agent.port}/`);
  console.log('Press Ctrl+C to stop');
  await agent.run();
}
// endregion: main
