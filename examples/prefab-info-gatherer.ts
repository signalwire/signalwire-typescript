/**
 * InfoGatherer Prefab Example
 *
 * Collects information from callers by asking a sequence of questions.
 * Each question has a `key_name` used to store the answer and a
 * `question_text` spoken to the caller. The `confirm` flag forces the AI
 * to verify the answer before submitting.
 *
 * Run: npx tsx examples/prefab-info-gatherer.ts
 */

import { InfoGathererAgent } from '../src/index.js';

export const agent = new InfoGathererAgent({
  name: 'intake-agent',
  questions: [
    { key_name: 'full_name', question_text: 'What is your full name?' },
    { key_name: 'email', question_text: 'What is your email address?', confirm: true },
    { key_name: 'phone', question_text: 'What is a good callback number?', confirm: true },
    { key_name: 'reason', question_text: 'How can we help you today?' },
  ],
  agentOptions: {
    route: '/',
    basicAuth: [
      process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
      process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
    ],
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
