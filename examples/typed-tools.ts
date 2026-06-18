/**
 * Typed Tools Example
 *
 * `defineTool` is generic over its `parameters` schema: write the parameter map
 * inline and the handler's `args` is inferred precisely — no annotation, no
 * casts. `args.<name>` is typed from the schema, an `enum` narrows to its
 * literal union, and `required` decides which keys are present vs optional.
 *
 * This is the recommended way to define tools. The runtime is unchanged — the
 * model still extracts arguments at call time; the types are an authoring
 * convenience that catch typos and wrong-type usage at compile time.
 *
 * Run: npx tsx examples/typed-tools.ts
 * Test: curl http://user:pass@localhost:3000/
 */

import { AgentBase, FunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'typed-tools',
  route: '/',
});

agent.setPromptText('You help users book and check appointments.');
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

// Inline schema → fully inferred args. `required` makes those keys present;
// the rest are optional. Hover `args` in your editor to see the inferred type.
agent.defineTool({
  name: 'book_appointment',
  description: 'Book an appointment for the caller.',
  parameters: {
    service: {
      type: 'string',
      description: 'What to book',
      enum: ['haircut', 'massage', 'consultation'] as const,
    },
    party_size: { type: 'integer', description: 'How many people' },
    notes: { type: 'string', description: 'Optional notes for the booking' },
  },
  required: ['service', 'party_size'],
  handler: (args) => {
    // args.service: 'haircut' | 'massage' | 'consultation'   (enum → literal union, required)
    // args.party_size: number                                (integer, required)
    // args.notes: string | undefined                         (optional)
    const note = args.notes ? ` (${args.notes})` : '';
    return new FunctionResult(
      `Booked a ${args.service} for ${args.party_size}${note}. See you soon!`,
    );
  },
});

// The second handler argument is the raw SWAIG webhook body (SwaigRequestData)
// when you need call context alongside the typed args.
agent.defineTool({
  name: 'check_status',
  description: 'Check the status of the current call by its ID.',
  parameters: {
    verbose: { type: 'boolean', description: 'Include extra detail' },
  },
  handler: (args, rawData) => {
    // args.verbose: boolean | undefined; rawData.call_id is the typed webhook field.
    const detail = args.verbose ? ` (session ${rawData.ai_session_id})` : '';
    return new FunctionResult(`Call ${rawData.call_id} is active${detail}.`);
  },
});

agent.serve();
