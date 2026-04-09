/**
 * Step Function Inheritance Demo
 *
 * This example exists to teach one specific gotcha: the per-step `functions`
 * whitelist INHERITS from the previous step when omitted.
 *
 * Why this matters
 * ----------------
 * A common mistake when building multi-step agents is to assume each step
 * starts with a fresh tool set. It does not. The runtime only resets the
 * active set when a step explicitly declares its `functions` field. If you
 * forget setFunctions() on a later step, the previous step's tools quietly
 * remain available.
 *
 * This file shows four step-shaped patterns side by side:
 *
 *   1. step_lookup    — explicitly whitelists `lookup_account`
 *   2. step_inherit   — has NO setFunctions() call. Inherits step_lookup's
 *                       whitelist, so `lookup_account` is still callable here.
 *                       This is rarely what you want.
 *   3. step_explicit  — explicitly whitelists `process_payment`. The previously
 *                       inherited `lookup_account` is now disabled, and only
 *                       `process_payment` is active.
 *   4. step_disabled  — explicitly disables ALL user functions with []
 *                       (or 'none'). Internal tools like next_step still work.
 *
 * Best practice
 * -------------
 * Call setFunctions() on EVERY step that should differ from the previous one.
 * Treat omission as an explicit decision to inherit, not a default.
 *
 * Run this file just to see the rendered SWML — there are no real webhook
 * endpoints behind the tools, this is purely a documentation example.
 */

import { AgentBase } from '../src/AgentBase.js';
import { FunctionResult } from '../src/FunctionResult.js';

class StepFunctionInheritanceAgent extends AgentBase {
  constructor() {
    super({ name: 'step_function_inheritance_demo', route: '/' });

    // Register three SWAIG tools so we have something to whitelist.
    // In a real agent these would call out to webhooks; here they're stubs.
    this.defineTool({
      name: 'lookup_account',
      description: 'Look up customer account details by account number',
      parameters: { account_number: { type: 'string' } },
      handler: async () => new FunctionResult('looked up'),
    });
    this.defineTool({
      name: 'process_payment',
      description: 'Process a payment for the current customer',
      parameters: { amount: { type: 'number' } },
      handler: async () => new FunctionResult('payment processed'),
    });
    this.defineTool({
      name: 'send_receipt',
      description: 'Email a receipt to the customer',
      parameters: { email: { type: 'string' } },
      handler: async () => new FunctionResult('sent'),
    });

    // Build the contexts.
    const contexts = this.defineContexts();
    const ctx = contexts.addContext('default');

    // ── Step 1: explicit whitelist ─────────────────────────────────
    // `lookup_account` is the only tool active in this step.
    ctx
      .addStep('step_lookup')
      .setText(
        'Greet the customer and ask for their account number. ' +
          'Use lookup_account to fetch their details.',
      )
      .setFunctions(['lookup_account'])
      .setValidSteps(['step_inherit']);

    // ── Step 2: NO setFunctions() call → inheritance ──────────────
    // Because we didn't call setFunctions(), this step inherits the
    // active set from step_lookup. `lookup_account` is STILL callable
    // here, even though we never asked for it. Most of the time this
    // is a bug. To break the inheritance, call setFunctions() with an
    // explicit list (even if it's empty).
    ctx
      .addStep('step_inherit')
      .setText(
        "Confirm the customer's identity. (No setFunctions() here, " +
          'so lookup_account is still active — this is the inheritance ' +
          'trap.)',
      )
      .setValidSteps(['step_explicit']);

    // ── Step 3: explicit replacement ───────────────────────────────
    // Whitelist replaces the inherited set. lookup_account is now
    // inactive; only process_payment is active.
    ctx
      .addStep('step_explicit')
      .setText(
        "Take the customer's payment. Use process_payment. " +
          'lookup_account is no longer available.',
      )
      .setFunctions(['process_payment'])
      .setValidSteps(['step_disabled']);

    // ── Step 4: explicit disable-all ───────────────────────────────
    // Pass [] (or 'none') to lock out every user-defined tool.
    // Internal navigation tools (next_step) are unaffected.
    ctx
      .addStep('step_disabled')
      .setText(
        'Thank the customer and wrap up. No tools are needed here, ' +
          'so we lock everything down with setFunctions([]).',
      )
      .setFunctions([])
      .setEnd(true);
  }
}

const agent = new StepFunctionInheritanceAgent();
// Render and pretty-print the resulting SWML so you can see exactly
// which steps have a `functions` key in the output and which don't.
const swml = agent.renderSwml();
console.log(JSON.stringify(JSON.parse(swml), null, 2));
