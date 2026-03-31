/**
 * Dynamic InfoGatherer Example
 *
 * Shows how to use InfoGathererAgent with a callback function to dynamically
 * choose questions based on request parameters (query string).
 *
 * Run: npx tsx examples/dynamic-info-gatherer.ts
 * Test:
 *   curl http://user:pass@localhost:3000/?set=support
 *   curl http://user:pass@localhost:3000/?set=medical
 */

import { InfoGathererAgent } from '../src/index.js';

const questionSets: Record<string, Array<{ name: string; description: string; required?: boolean }>> = {
  default: [
    { name: 'name', description: 'Full name', required: true },
    { name: 'phone', description: 'Phone number', required: true },
    { name: 'reason', description: 'How can I help you today?' },
  ],
  support: [
    { name: 'customer_name', description: 'Your name', required: true },
    { name: 'account_number', description: 'Account number', required: true },
    { name: 'issue', description: 'Describe the issue you are experiencing' },
    { name: 'priority', description: 'Urgency level: Low, Medium, or High' },
  ],
  medical: [
    { name: 'patient_name', description: 'Patient full name', required: true },
    { name: 'symptoms', description: 'Current symptoms', required: true },
    { name: 'duration', description: 'How long have you had these symptoms?' },
    { name: 'medications', description: 'Are you taking any medications?' },
  ],
  onboarding: [
    { name: 'full_name', description: 'Your full name', required: true },
    { name: 'email', description: 'Email address', required: true },
    { name: 'company', description: 'Company name' },
    { name: 'department', description: 'Department you will be working in' },
    { name: 'start_date', description: 'Your start date' },
  ],
};

export const agent = new InfoGathererAgent({
  name: 'dynamic-intake',
  fields: [], // dynamic mode: fields resolved per request
  introMessage: 'Hi! I need to collect some information from you.',
  confirmationMessage: 'Thank you, I have everything I need!',
  questionCallback: (queryParams) => {
    const set = queryParams.set ?? 'default';
    console.log(`Dynamic question set: ${set}`);
    return questionSets[set] ?? questionSets.default;
  },
  onComplete: (data) => {
    console.log('All fields collected:', data);
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
