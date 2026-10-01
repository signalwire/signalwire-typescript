/**
 * Gather Info with Steps Example
 *
 * Uses the ContextBuilder's gather info mode (setGatherInfo and
 * addGatherQuestion) to collect a patient's details and reason for visit one
 * question at a time, then confirms the answers and calls submit_intake.
 * Run: npx tsx examples/gather-info.ts
 */

import { AgentBase, FunctionResult } from '@signalwire/sdk';

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
    return new FunctionResult(
      `Intake form submitted for ${args.patient_name}. Reason: ${args.reason}. ` +
        'A nurse will be with you shortly.',
    );
  },
});

// Define the intake flow. The first two steps run in gather info mode: the
// AI asks each question in turn and stores the answers in global_data under
// the step's output key. The last step is a normal step that confirms the
// answers and calls submit_intake.
const ctx = agent.defineContexts();
const intake = ctx.addContext('default');

// Step 1: Gather the patient's details
intake
  .addStep('demographics')
  .setText("Collect the patient's basic information.")
  .setGatherInfo({
    outputKey: 'patient_demographics',
    prompt: 'Welcome the patient, then collect the following information.',
  })
  .addGatherQuestion({ key: 'full_name', question: 'What is your full name?' })
  .addGatherQuestion({ key: 'date_of_birth', question: 'What is your date of birth?' })
  .addGatherQuestion({
    key: 'phone_number',
    question: 'What is your phone number?',
    confirm: true,
  })
  .setValidSteps(['reason']);

// Step 2: Gather the reason for the visit
intake
  .addStep('reason')
  .setText("Ask about the patient's reason for visiting today.")
  .setGatherInfo({
    outputKey: 'visit_reason',
    prompt: 'Now ask why the patient is visiting today.',
  })
  .addGatherQuestion({
    key: 'reason_for_visit',
    question: 'What is the main reason for your visit today?',
  })
  .addGatherQuestion({
    key: 'symptom_duration',
    question: 'How long have you been experiencing these symptoms?',
  })
  .setValidSteps(['confirm']);

// Step 3: Confirm and submit (normal mode, not gather)
intake
  .addStep('confirm', {
    task: 'Confirm the collected information with the patient and submit the intake form.',
  })
  .setStepCriteria('Patient has confirmed the information and the form is submitted')
  .setFunctions(['submit_intake'])
  .setEnd(true);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.serve();
