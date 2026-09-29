/**
 * DataSphere Serverless Environment Demo
 *
 * Loads the DataSphere Serverless skill with configuration from environment
 * variables, showing best practices for production deployment.
 *
 * Required env vars:
 *   SIGNALWIRE_SPACE, SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN,
 *   DATASPHERE_DOCUMENT_ID
 *
 * Optional env vars:
 *   DATASPHERE_COUNT, DATASPHERE_DISTANCE, DATASPHERE_TAGS, DATASPHERE_LANGUAGE
 *
 * Run: npx tsx examples/datasphere-serverless-env.ts
 */

import { AgentBase, DataSphereServerlessSkill, DateTimeSkill, MathSkill } from '@signalwire/sdk';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: Required environment variable ${name} is not set.`);
    console.error(
      'Required: SIGNALWIRE_SPACE, SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, DATASPHERE_DOCUMENT_ID',
    );
    process.exit(1);
  }
  return value;
}

// The serverless skill builds https://<space_name>.signalwire.com itself, so
// it takes the space name, not the host.
const spaceName = requireEnv('SIGNALWIRE_SPACE').replace(/\.signalwire\.com$/, '');
const projectId = requireEnv('SIGNALWIRE_PROJECT_ID');
const token = requireEnv('SIGNALWIRE_API_TOKEN');
const documentId = requireEnv('DATASPHERE_DOCUMENT_ID');
const count = parseInt(process.env['DATASPHERE_COUNT'] ?? '3', 10);
const distance = parseFloat(process.env['DATASPHERE_DISTANCE'] ?? '4.0');
const tags = process.env['DATASPHERE_TAGS']
  ?.split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const language = process.env['DATASPHERE_LANGUAGE'];

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

// The serverless skill renders the search as a DataMap tool, which the
// SignalWire platform runs without a webhook to this agent. It reads its
// credentials from these parameters only, not from the environment.
await agent.addSkill(
  new DataSphereServerlessSkill({
    space_name: spaceName,
    project_id: projectId,
    token,
    document_id: documentId,
    count,
    distance,
    ...(tags ? { tags } : {}),
    ...(language ? { language } : {}),
  }),
);

console.log(`DataSphere Serverless Environment Demo`);
console.log(`  Document: ${documentId}`);
console.log(`  Max results: ${count}`);
console.log(`  Distance threshold: ${distance}`);
if (tags) console.log(`  Tags: ${tags.join(', ')}`);
if (language) console.log(`  Language: ${language}`);

agent.serve();
