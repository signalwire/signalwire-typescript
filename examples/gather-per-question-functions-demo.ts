/**
 * Per-Question Function Whitelist Demo (gather_info)
 *
 * This example exists to teach one specific gotcha: while a step's gather_info
 * is asking questions, ALL of the step's other functions are forcibly
 * deactivated. The only callable tools during a gather question are:
 *
 *   - `gather_submit` (the native answer-submission tool, always active)
 *   - Whatever names you list in that question's `functions` option
 *
 * `next_step` and `change_context` are also filtered out — the model literally
 * cannot navigate away until the gather completes. This is by design: it
 * forces a tight ask → submit → next-question loop.
 *
 * If a question needs to call out to a tool — for example, to validate an
 * email format, geocode a ZIP, or look up something from an external service
 * — you must list that tool name in the question's `functions` option. The
 * function is active ONLY for that question.
 *
 * Below: a customer-onboarding gather flow where each question unlocks a
 * different validation tool, and where the step's own non-gather tools
 * (escalate_to_human, lookup_existing_account) are LOCKED OUT during gather
 * because they aren't whitelisted on any question.
 *
 * Run this file to see the resulting SWML.
 */

import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

class GatherPerQuestionFunctionsAgent extends AgentBase {
  constructor() {
    super({ name: 'gather_per_question_functions_demo', route: '/' });

    // Tools that the step would normally have available — but during
    // gather questioning, they're all locked out unless they appear in
    // a question's `functions` whitelist.
    this.defineTool({
      name: 'validate_email',
      description: 'Validate that an email address is well-formed and deliverable',
      parameters: { email: { type: 'string' } },
      handler: async () => new FunctionResult('valid'),
    });
    this.defineTool({
      name: 'geocode_zip',
      description: 'Look up the city/state for a US ZIP code',
      parameters: { zip: { type: 'string' } },
      handler: async () => new FunctionResult('{"city":"...","state":"..."}'),
    });
    this.defineTool({
      name: 'check_age_eligibility',
      description: 'Verify the customer is old enough for the product',
      parameters: { age: { type: 'integer' } },
      handler: async () => new FunctionResult('eligible'),
    });
    // These tools are NOT whitelisted on any gather question. They are
    // registered on the agent and active outside the gather, but during
    // the gather they cannot be called — gather mode locks them out.
    this.defineTool({
      name: 'escalate_to_human',
      description: 'Transfer the conversation to a live agent',
      parameters: {},
      handler: async () => new FunctionResult('transferred'),
    });
    this.defineTool({
      name: 'lookup_existing_account',
      description: 'Search for an existing account by email',
      parameters: { email: { type: 'string' } },
      handler: async () => new FunctionResult('not found'),
    });

    // Build a single-context agent with one onboarding step.
    const contexts = this.defineContexts();
    const ctx = contexts.addContext('default');

    ctx
      .addStep('onboard')
      .setText(
        'Onboard a new customer by collecting their details. Use ' +
          'gather_info to ask one question at a time. Each question ' +
          'may unlock a specific validation tool — only that tool ' +
          'and gather_submit are callable while answering it.',
      )
      .setFunctions([
        // Outside of the gather (which is the entire step here),
        // these would be available. During the gather they are
        // forcibly hidden in favor of the per-question whitelists.
        'escalate_to_human',
        'lookup_existing_account',
      ])
      .setGatherInfo({
        outputKey: 'customer',
        completionAction: 'next_step',
        prompt:
          "I'll need to collect a few details to set up your " +
          "account. I'll ask one question at a time.",
      })
      .addGatherQuestion({
        key: 'email',
        question: "What's your email address?",
        confirm: true,
        // Only validate_email + gather_submit are callable here.
        functions: ['validate_email'],
      })
      .addGatherQuestion({
        key: 'zip',
        question: "What's your ZIP code?",
        // Only geocode_zip + gather_submit are callable here.
        functions: ['geocode_zip'],
      })
      .addGatherQuestion({
        key: 'age',
        question: 'How old are you?',
        type: 'integer',
        // Only check_age_eligibility + gather_submit are callable here.
        functions: ['check_age_eligibility'],
      })
      .addGatherQuestion({
        key: 'referral_source',
        question: 'How did you hear about us?',
        // No functions option → only gather_submit is callable.
        // The model cannot validate, lookup, escalate — nothing.
        // This is the right pattern when a question needs no tools.
      });

    // A simple confirmation step the gather auto-advances into.
    ctx
      .addStep('confirm')
      .setText(
        'Read the collected info back to the customer and ' +
          'confirm everything is correct.',
      )
      .setFunctions([])
      .setEnd(true);
  }
}

const agent = new GatherPerQuestionFunctionsAgent();
const swml = agent.renderSwml();
console.log(JSON.stringify(JSON.parse(swml), null, 2));
