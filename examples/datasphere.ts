/**
 * DataSphere Skill Example
 *
 * Uses the DataSphere skill to search a document in a SignalWire DataSphere
 * knowledge base. Set DATASPHERE_DOCUMENT_ID to the document to search, and
 * SIGNALWIRE_SPACE, SIGNALWIRE_PROJECT_ID and SIGNALWIRE_API_TOKEN to the
 * credentials the skill uses. Without them the agent starts with no search
 * tool and prints what to set.
 * Run: npx tsx examples/datasphere.ts
 */

import { AgentBase, DataSphereSkill } from '@signalwire/sdk';

export const agent = new AgentBase({
  name: 'knowledge-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a knowledge assistant with access to a document library. ' +
    'Use the search tool to find answers to user questions from the knowledge base. ' +
    'Always cite the source when providing information from the knowledge base.',
);

const documentId = process.env['DATASPHERE_DOCUMENT_ID'];
const missing = [
  'DATASPHERE_DOCUMENT_ID',
  'SIGNALWIRE_SPACE',
  'SIGNALWIRE_PROJECT_ID',
  'SIGNALWIRE_API_TOKEN',
].filter((name) => !process.env[name]);

if (documentId && missing.length === 0) {
  // count is the number of results to return, and distance the largest
  // distance a result may have (lower is more relevant).
  await agent.addSkill(
    new DataSphereSkill({
      document_id: documentId,
      count: 3,
      distance: 4.0,
    }),
  );
} else {
  console.error(
    `DataSphere not configured, so the agent starts without the search tool. Set ${missing.join(', ')}.`,
  );
}

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.addHints(['DataSphere', 'knowledge base', 'documentation']);

agent.serve();
