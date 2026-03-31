/**
 * DataSphere Webhook Environment Demo
 *
 * Loads the traditional webhook-based DataSphere skill with environment variable
 * configuration. Compare with datasphere-serverless-env.ts for the serverless approach.
 *
 * Required env vars:
 *   SIGNALWIRE_SPACE, SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN,
 *   DATASPHERE_DOCUMENT_ID
 *
 * Run: npx tsx examples/datasphere-webhook-env.ts
 */

import { AgentBase, DataSphereSkill, DateTimeSkill, MathSkill } from '../src/index.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: Required environment variable ${name} is not set.`);
    process.exit(1);
  }
  return value;
}

const documentId = requireEnv('DATASPHERE_DOCUMENT_ID');
const count = parseInt(process.env['DATASPHERE_COUNT'] ?? '3', 10);
const distance = parseFloat(process.env['DATASPHERE_DISTANCE'] ?? '4.0');

export const agent = new AgentBase({
  name: 'datasphere-webhook',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a knowledge assistant with access to a document library via webhook. ' +
  'Use the search tool to find answers from the knowledge base.',
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());

// Webhook-based DataSphere skill (traditional approach)
await agent.addSkill(
  new DataSphereSkill({
    document_id: documentId,
    max_results: count,
    distance_threshold: distance,
    mode: 'webhook',
  }),
);

console.log('DataSphere Webhook Environment Demo');
console.log(`  Document: ${documentId}`);
console.log(`  Execution: Webhook-based (traditional)`);
console.log('');
console.log('WEBHOOK vs SERVERLESS:');
console.log('  Webhook: Full control over request/response, custom error handling');
console.log('  Serverless: No webhook infrastructure, lower latency, executes on SignalWire');

agent.run();
