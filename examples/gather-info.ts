/**
 * Gather Info with Steps Example
 *
 * Uses the ContextBuilder with GatherInfo to collect structured
 * information from the caller through a guided conversation flow.
 * Run: npx tsx examples/gather-info.ts
 */

import { AgentBase, SwaigFunctionResult, GatherInfo, GatherQuestion } from '../src/index.js';

export const agent = new AgentBase({
  name: 'intake-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a medical office intake assistant. Collect patient information ' +
  'step by step. Be polite and professional.',
);

// Define a tool for final submission
agent.defineTool({
  name: 'submit_intake',
  description: 'Submit the completed intake form',
  parameters: {
    patient_name: { type: 'string', description: 'Full name of the patient' },
    reason: { type: 'string', description: 'Reason for visit' },
  },
  handler: (args) => {
    return new SwaigFunctionResult(
      `Intake form submitted for ${args.patient_name}. Reason: ${args.reason}. ` +
      'A nurse will be with you shortly.',
    );
  },
});

// Define structured conversation flow with steps
const ctx = agent.defineContexts();
const intake = ctx.addContext('default');

// Step 1: Welcome and collect name
intake
  .addStep('welcome', { task: 'Welcome the patient and ask for their full name.' })
  .setStepCriteria('Patient has provided their full name')
  .setFunctions('none')
  .setValidSteps(['reason']);

// Step 2: Collect reason for visit
intake
  .addStep('reason', {
    task: 'Ask the patient about their reason for visiting today.',
  })
  .setStepCriteria('Patient has described their reason for the visit')
  .setFunctions('none')
  .setValidSteps(['confirm']);

// Step 3: Confirm and submit
intake
  .addStep('confirm', {
    task: 'Confirm the collected information with the patient and submit the intake form.',
  })
  .setFunctions(['submit_intake'])
  .setEnd(true);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
