/**
 * Declarative Agent Example
 *
 * Demonstrates creating an agent using class inheritance with static
 * PROMPT_SECTIONS and the defineTools() lifecycle method, instead of
 * the imperative new AgentBase() + method-chaining approach.
 * Run: npx tsx examples/declarative.ts
 */

import { AgentBase, FunctionResult } from '../src/index.js';
import type { AgentOptions } from '../src/index.js';

class HelpDeskAgent extends AgentBase {
  // Declarative prompt sections — applied automatically in the constructor
  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a help desk agent for Acme Software Inc.',
    },
    {
      title: 'Personality',
      body: 'You are professional, patient, and solution-oriented.',
      bullets: [
        'Always greet the user warmly.',
        'Ask clarifying questions before troubleshooting.',
        'Summarize the solution at the end of each interaction.',
      ],
    },
    {
      title: 'Knowledge',
      bullets: [
        'Acme Software sells a project management tool called AcmePM.',
        'Common issues: login problems, slow performance, missing data.',
        'Tier 1 support can reset passwords and clear caches.',
        'Tier 2 issues should be escalated to a supervisor.',
      ],
    },
  ];

  constructor(opts: AgentOptions) {
    super(opts);
    this.defineTools();
  }

  protected override defineTools(): void {
    this.defineTool({
      name: 'reset_password',
      description: 'Reset a user password by their email address',
      parameters: {
        email: { type: 'string', description: 'User email address' },
      },
      handler: (args) => {
        return new FunctionResult(
          `Password reset email sent to ${args.email}. It will arrive within 5 minutes.`,
        );
      },
    });

    this.defineTool({
      name: 'check_system_status',
      description: 'Check the current system status of AcmePM',
      parameters: {},
      handler: () => {
        return new FunctionResult(
          'AcmePM system status: All services operational. No known outages.',
        );
      },
    });

    this.defineTool({
      name: 'escalate_ticket',
      description: 'Escalate an issue to Tier 2 support',
      parameters: {
        issue: { type: 'string', description: 'Description of the issue' },
      },
      handler: (args) => {
        const result = new FunctionResult(
          `Issue escalated to Tier 2: "${args.issue}". A specialist will follow up within 2 hours.`,
        );
        return result;
      },
    });
  }
}

export const agent = new HelpDeskAgent({
  name: 'help-desk',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.setPostPrompt(
  'Summarize this support call as JSON: { issue_type, resolution, escalated, follow_up_needed }',
);

agent.run();
