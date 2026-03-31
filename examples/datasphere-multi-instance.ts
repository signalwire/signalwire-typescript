/**
 * DataSphere Multiple Instance Demo
 *
 * Loads the DataSphere skill multiple times with different knowledge bases
 * and custom tool names. Each instance searches a different document.
 * Run: npx tsx examples/datasphere-multi-instance.ts
 */

import { AgentBase, DataSphereSkill, DateTimeSkill, MathSkill } from '../src/index.js';

export const agent = new AgentBase({
  name: 'multi-datasphere',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are an assistant with access to multiple knowledge bases. ' +
  'Use the appropriate search tool depending on the topic.',
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

// Add utility skills
await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());

// Instance 1: Drinks knowledge base
await agent.addSkill(
  new DataSphereSkill({
    document_id: 'drinks-doc-123',
    tool_name: 'search_drinks_knowledge',
    max_results: 2,
    distance_threshold: 5.0,
  }),
);

// Instance 2: Food knowledge base
await agent.addSkill(
  new DataSphereSkill({
    document_id: 'food-doc-456',
    tool_name: 'search_food_knowledge',
    max_results: 3,
    distance_threshold: 4.0,
  }),
);

// Instance 3: General knowledge (default tool name)
await agent.addSkill(
  new DataSphereSkill({
    document_id: 'general-doc-789',
    max_results: 1,
    distance_threshold: 3.0,
  }),
);

console.log('Loaded skills:', agent.listSkills().map(s => s.name));
console.log('Note: Replace document IDs with your actual DataSphere documents.');

agent.run();
