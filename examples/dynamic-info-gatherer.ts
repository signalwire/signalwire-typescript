/**
 * Dynamic InfoGatherer Example
 *
 * Shows how to use InfoGathererAgent in dynamic mode with a callback
 * function that chooses the question set based on the request's query
 * string.
 *
 * Run: npx tsx examples/dynamic-info-gatherer.ts
 * Test:
 *   curl http://user:pass@localhost:3000/?set=support
 *   curl http://user:pass@localhost:3000/?set=medical
 */

import { InfoGathererAgent } from '../src/index.js';
import type { InfoGathererQuestion } from '../src/index.js';

const questionSets: Record<string, InfoGathererQuestion[]> = {
  default: [
    { key_name: 'name', question_text: 'What is your full name?' },
    { key_name: 'phone', question_text: 'What is a good callback number?' },
    { key_name: 'reason', question_text: 'How can I help you today?' },
  ],
  support: [
    { key_name: 'customer_name', question_text: 'What is your name?' },
    { key_name: 'account_number', question_text: 'What is your account number?', confirm: true },
    { key_name: 'issue', question_text: 'Describe the issue you are experiencing.' },
    { key_name: 'priority', question_text: 'Is this low, medium, or high priority?' },
  ],
  medical: [
    { key_name: 'patient_name', question_text: 'What is the patient\'s full name?' },
    { key_name: 'symptoms', question_text: 'What are the current symptoms?' },
    { key_name: 'duration', question_text: 'How long have these symptoms been present?' },
    { key_name: 'medications', question_text: 'Is the patient taking any medications?' },
  ],
  onboarding: [
    { key_name: 'full_name', question_text: 'What is your full name?' },
    { key_name: 'email', question_text: 'What is your email address?', confirm: true },
    { key_name: 'company', question_text: 'What company do you work for?' },
    { key_name: 'department', question_text: 'What department will you be working in?' },
    { key_name: 'start_date', question_text: 'What is your start date?' },
  ],
};

export const agent = new InfoGathererAgent({
  name: 'dynamic-intake',
  // No `questions` → dynamic mode. Callback resolves them per request.
  questionCallback: (queryParams) => {
    const set = queryParams['set'] ?? 'default';
    console.log(`Dynamic question set: ${set}`);
    return questionSets[set] ?? questionSets['default'];
  },
  agentOptions: {
    route: '/',
    basicAuth: [
      process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
      process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
    ],
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

console.log('Dynamic InfoGatherer Agent');
console.log('  /?set=default    (name, phone, reason)');
console.log('  /?set=support    (customer support intake)');
console.log('  /?set=medical    (medical intake)');
console.log('  /?set=onboarding (employee onboarding)');

agent.run();
