/**
 * Joke Agent Example
 *
 * A fun agent that uses the built-in Joke skill to tell jokes.
 * Run: npx tsx examples/joke-agent.ts
 */

import { AgentBase, JokeSkill, DateTimeSkill } from '../src/index.js';

export const agent = new AgentBase({
  name: 'joke-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a friendly comedian named Chuckles. Your job is to make people laugh! ' +
  'Tell jokes when asked, and try to keep the mood light and fun. ' +
  'You can also tell the time if someone asks.',
);

// Add the joke skill — injects the tell_joke tool, prompt sections, and hints
await agent.addSkill(new JokeSkill());

// Also add datetime so we can answer "what time is it?" questions
await agent.addSkill(new DateTimeSkill());

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.addHints(['joke', 'funny', 'comedy', 'laugh', 'punchline']);

agent.run();
