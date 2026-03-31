/**
 * DataSphere Serverless Environment Demo
 *
 * Loads the DataSphere Serverless skill with configuration from environment
 * variables, showing best practices for production deployment.
 *
 * Required env vars:
 *   SIGNALWIRE_SPACE, SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN,
 *   DATASPHERE_DOCUMENT_ID
 *
 * Optional env vars:
 *   DATASPHERE_COUNT, DATASPHERE_DISTANCE, DATASPHERE_TAGS, DATASPHERE_LANGUAGE
 *
 * Run: npx tsx examples/datasphere-serverless-env.ts
 */

import { AgentBase, DataSphereSkill, DateTimeSkill, MathSkill } from '../src/index.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: Required environment variable ${name} is not set.`);
    console.error('Required: SIGNALWIRE_SPACE, SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN, DATASPHERE_DOCUMENT_ID');
    process.exit(1);
  }
  return value;
}

const documentId = requireEnv('DATASPHERE_DOCUMENT_ID');
const count = parseInt(process.env['DATASPHERE_COUNT'] ?? '3', 10);
const distance = parseFloat(process.env['DATASPHERE_DISTANCE'] ?? '4.0');
const tags = process.env['DATASPHERE_TAGS']?.split(',').map(t => t.trim()).filter(Boolean);

export const agent = new AgentBase({
  name: 'datasphere-env',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a knowledge assistant with access to a document library. ' +
  'Search the knowledge base to answer user questions. Always cite the source.',
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());

await agent.addSkill(
  new DataSphereSkill({
    document_id: documentId,
    max_results: count,
    distance_threshold: distance,
    ...(tags ? { tags } : {}),
  }),
);

console.log(`DataSphere Serverless Environment Demo`);
console.log(`  Document: ${documentId}`);
console.log(`  Max results: ${count}`);
console.log(`  Distance threshold: ${distance}`);
if (tags) console.log(`  Tags: ${tags.join(', ')}`);

agent.run();
