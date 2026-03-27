# Contexts & Steps Guide

Complete guide to building multi-step conversation workflows using the Contexts & Steps system in the SignalWire AI Agents TypeScript SDK.

---

## Table of Contents

1. [Overview](#overview)
2. [Creating Contexts](#creating-contexts)
3. [Steps](#steps)
4. [Step Navigation](#step-navigation)
5. [Function Control](#function-control)
6. [End States](#end-states)
7. [GatherInfo](#gatherinfo)
8. [Context Settings](#context-settings)
9. [Isolation and Reset](#isolation-and-reset)
10. [Fillers](#fillers)
11. [Validation](#validation)
12. [Real-World Example](#real-world-example)

---

## Overview

The Contexts & Steps system provides a **state machine** for structuring multi-step AI conversations. Instead of a single flat prompt, you define a graph of **contexts** that each contain ordered **steps**. The AI navigates through these steps based on completion criteria, enabling complex branching workflows such as customer intake, troubleshooting trees, or multi-department routing.

**Key concepts:**

- **Context** -- A named group of ordered steps with its own prompt, system prompt, navigation rules, and isolation settings. Think of it as a "page" or "scene" in the conversation.
- **Step** -- A single stage within a context. Each step has prompt text (raw text or POM sections), completion criteria, function restrictions, and rules about which steps or contexts the AI can move to next.
- **ContextBuilder** -- The top-level builder that holds all contexts, validates cross-references, and serializes everything to SWML output.

The classes involved are:

| Class | Role |
|---|---|
| `ContextBuilder` | Top-level container; holds and validates all contexts |
| `Context` | A named context with steps, prompts, fillers, and navigation rules |
| `Step` | A single step within a context, with text, criteria, and function control |
| `GatherInfo` | Structured data collection attached to a step |
| `GatherQuestion` | A single question within a GatherInfo operation |

All classes are exported from `src/ContextBuilder.ts`.

---

## Creating Contexts

### Using `agent.defineContexts()`

The primary entry point is the `defineContexts()` method on `AgentBase`. It returns a `ContextBuilder` that you use to add contexts.

```typescript
import { AgentBase } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent' });

// Create and get the ContextBuilder
const cb = agent.defineContexts();

// Add contexts to the builder
const greeting = cb.addContext('greeting');
const support = cb.addContext('support');
const farewell = cb.addContext('farewell');
```

You can also pass an existing `ContextBuilder` instance:

```typescript
import { ContextBuilder } from '@signalwire/sdk';

const cb = new ContextBuilder();
cb.addContext('default');
// ... configure ...

agent.defineContexts(cb);
```

### Using `ContextBuilder.addContext()`

```typescript
const cb = new ContextBuilder();

// Returns the new Context instance for chaining
const ctx = cb.addContext('intake');
```

Context names must be unique within a builder. Adding a duplicate name throws an error.

### Retrieving a Context

```typescript
const ctx = cb.getContext('intake');
if (ctx) {
  // configure further
}
```

### Single-Context Rule

When using only one context, it **must** be named `'default'`. The validator enforces this:

```typescript
// Valid: single context named "default"
const cb = new ContextBuilder();
cb.addContext('default');

// Invalid: single context with any other name
const bad = new ContextBuilder();
bad.addContext('main'); // validate() will throw
```

### Helper: `createSimpleContext()`

For the common single-context case, a standalone helper is available:

```typescript
import { createSimpleContext } from '@signalwire/sdk';

const ctx = createSimpleContext(); // name defaults to 'default'
const step = ctx.addStep('welcome');
step.setText('Welcome to our service!');
```

---

## Steps

Steps are the building blocks of a context. They are ordered -- the AI processes them in the order they were added.

### Adding a Step

```typescript
const ctx = cb.addContext('intake');

// Basic: returns the Step for further configuration
const step1 = ctx.addStep('greet');
step1.setText('Greet the customer warmly.');

// Shorthand: pass options inline
const step2 = ctx.addStep('collect_info', {
  task: 'Collect the customer name and account number.',
  bullets: ['Ask for full name first', 'Then ask for account number'],
  criteria: 'Customer has provided both name and account number.',
  functions: ['lookup_account'],
  validSteps: ['verify'],
});
```

The shorthand options map to:

| Option | Effect |
|---|---|
| `task` | Calls `step.addSection('Task', task)` |
| `bullets` | Calls `step.addBullets('Process', bullets)` |
| `criteria` | Calls `step.setStepCriteria(criteria)` |
| `functions` | Calls `step.setFunctions(functions)` |
| `validSteps` | Calls `step.setValidSteps(validSteps)` |

Step names must be unique within a context. Adding a duplicate throws an error.

### Step Content: `setText()` vs POM Sections

There are two mutually exclusive ways to define step content:

**Raw text:**

```typescript
step.setText('You are greeting the customer. Be friendly and professional.');
```

**POM (Prompt Object Model) sections:**

```typescript
step.addSection('Task', 'Help the customer with their billing inquiry.');
step.addBullets('Guidelines', [
  'Be empathetic and patient',
  'Verify identity before sharing account details',
  'Offer to escalate if needed',
]);
```

You cannot mix `setText()` with `addSection()`/`addBullets()` on the same step -- doing so throws an error.

POM sections render as markdown:

```
## Task
Help the customer with their billing inquiry.

## Guidelines
- Be empathetic and patient
- Verify identity before sharing account details
- Offer to escalate if needed
```

### Managing Steps

```typescript
// Retrieve a step by name
const step = ctx.getStep('greet');

// Remove a step
ctx.removeStep('greet');

// Move a step to a new position (zero-indexed)
ctx.moveStep('verify', 0); // Move "verify" to the beginning

// Clear all content from a step (sections + text)
step.clearSections();
```

---

## Step Navigation

Navigation rules control which steps and contexts the AI can move to from a given step.

### `setValidSteps()`

Restricts the AI to navigating only to the listed steps within the current context:

```typescript
step.setValidSteps(['collect_info', 'verify', 'escalate']);
```

### `setValidContexts()`

Allows the AI to switch to a different context entirely:

```typescript
step.setValidContexts(['billing', 'technical_support', 'farewell']);
```

### `setStepCriteria()`

Defines a natural-language description of what must happen before the AI considers this step complete:

```typescript
step.setStepCriteria(
  'The customer has confirmed their name, account number, and the nature of their issue.'
);
```

The AI uses this text to judge when it should advance to the next step.

### Context-Level Navigation

Contexts themselves can also define navigation rules:

```typescript
const billing = cb.addContext('billing');
billing.setValidContexts(['technical_support', 'farewell']);
billing.setValidSteps(['step_a', 'step_b']);
```

---

## Function Control

Each step can restrict which SWAIG functions (tools) are available during that step. This prevents the AI from calling tools that are irrelevant or potentially harmful at that stage.

### `setFunctions()`

```typescript
// Only specific functions are available
step.setFunctions(['lookup_account', 'get_balance']);

// All functions are available (explicit wildcard)
step.setFunctions('*');

// No functions available (disable all tools for this step)
step.setFunctions('none');
```

When not set (null), the step inherits whatever functions are available from the agent's global configuration.

---

## End States

### `setEnd()`

Marks a step as a terminal step. When the AI reaches this step, the conversation is considered complete:

```typescript
const goodbye = ctx.addStep('goodbye');
goodbye.setText('Thank the customer and end the call.');
goodbye.setEnd(true);
```

### `setSkipUserTurn()`

When set to `true`, the AI does not wait for user input when entering this step. Useful for automatic transitions:

```typescript
const transition = ctx.addStep('auto_transfer');
transition.setText('Transfer the call to the billing department.');
transition.setSkipUserTurn(true);
```

### `setSkipToNextStep()`

When set to `true`, the AI automatically advances to the next step in order after completing the current one:

```typescript
const intro = ctx.addStep('intro');
intro.setText('Provide a brief introduction.');
intro.setSkipToNextStep(true);

const main = ctx.addStep('main');
main.setText('Now handle the main request.');
```

---

## GatherInfo

The `GatherInfo` system provides structured data collection within a step. It defines a series of questions with typed answers, optional confirmation, and per-question function access.

### Setting Up GatherInfo

First initialize the gather operation on a step, then add questions:

```typescript
const step = ctx.addStep('collect_details');
step.setText('Collect the customer contact details.');

step.setGatherInfo({
  outputKey: 'customer_info',
  completionAction: 'proceed_to_verify',
  prompt: 'Please collect the following information from the customer.',
});

step.addGatherQuestion({
  key: 'full_name',
  question: 'What is your full name?',
  type: 'string',
  confirm: true,
});

step.addGatherQuestion({
  key: 'email',
  question: 'What is your email address?',
  type: 'string',
  confirm: true,
  prompt: 'Please spell out the email address carefully.',
});

step.addGatherQuestion({
  key: 'phone',
  question: 'What is your phone number?',
  type: 'string',
  confirm: false,
  functions: ['validate_phone'],
});
```

You **must** call `setGatherInfo()` before calling `addGatherQuestion()`, or an error is thrown.

### GatherInfo Options

| Option | Type | Description |
|---|---|---|
| `outputKey` | `string` | Key under which the gathered data is stored |
| `completionAction` | `string` | Action name to execute after all questions are answered |
| `prompt` | `string` | Additional prompt context for the gather operation |

### GatherQuestion Options

| Option | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | (required) | Unique key for storing the answer |
| `question` | `string` | (required) | The question text presented to the user |
| `type` | `string` | `'string'` | Expected answer type (e.g., `'string'`, `'number'`) |
| `confirm` | `boolean` | `false` | Whether to ask the user to confirm their answer |
| `prompt` | `string` | -- | Additional prompt context for this specific question |
| `functions` | `string[]` | -- | SWAIG function names available during this question |

### GatherInfo Serialization

The `GatherInfo.toDict()` method produces SWML output like:

```json
{
  "questions": [
    { "key": "full_name", "question": "What is your full name?", "confirm": true },
    { "key": "email", "question": "What is your email address?", "confirm": true, "prompt": "Please spell out the email address carefully." },
    { "key": "phone", "question": "What is your phone number?", "functions": ["validate_phone"] }
  ],
  "output_key": "customer_info",
  "completion_action": "proceed_to_verify",
  "prompt": "Please collect the following information from the customer."
}
```

Note: `type` defaults to `'string'` and is omitted from serialization when it has the default value. `confirm` is only emitted when `true`.

---

## Context Settings

### Prompt Configuration

Contexts have their own prompt layer, separate from step-level prompts. Like steps, you can use either raw text or POM sections.

**Raw prompt text:**

```typescript
const ctx = cb.addContext('billing');
ctx.setPrompt('You are handling a billing inquiry. Be precise with numbers.');
```

**POM prompt sections:**

```typescript
ctx.addSection('Role', 'You are a billing specialist for Acme Corp.');
ctx.addBullets('Guidelines', [
  'Always verify the account before discussing charges',
  'Be transparent about fees and credits',
  'Offer payment plan options when appropriate',
]);
```

Raw text and POM sections are mutually exclusive at the context level.

### System Prompt

Override or extend the system prompt for a specific context:

**Raw system prompt:**

```typescript
ctx.setSystemPrompt('You are a helpful billing assistant. Be concise.');
```

**POM system prompt sections:**

```typescript
ctx.addSystemSection('Identity', 'You are Acme Corp billing support.');
ctx.addSystemBullets('Rules', [
  'Never disclose internal pricing formulas',
  'Always confirm before processing refunds',
]);
```

Raw system prompt and POM system sections are mutually exclusive.

### Post-Prompt

Set text appended after the main prompt for a context:

```typescript
ctx.setPostPrompt('Remember: always confirm before making account changes.');
```

### User Prompt

Set the initial user message when entering this context:

```typescript
ctx.setUserPrompt('I need help with my billing.');
```

---

## Isolation and Reset

These settings control how conversation history is handled when switching between contexts.

### `setIsolated()`

When `true`, this context does not share conversation history with other contexts. The AI starts fresh when entering this context:

```typescript
const secureCtx = cb.addContext('payment');
secureCtx.setIsolated(true);
```

### `setConsolidate()` (Context-Level)

When `true`, conversation history is summarized/consolidated when entering this context:

```typescript
ctx.setConsolidate(true);
```

### `setFullReset()` (Context-Level)

When `true`, conversation history is completely cleared when entering this context:

```typescript
ctx.setFullReset(true);
```

### Step-Level Reset Options

Individual steps can also trigger resets:

```typescript
const step = ctx.addStep('fresh_start');

// Replace the system prompt when entering this step
step.setResetSystemPrompt('You are now handling a refund request.');

// Replace the user prompt when entering this step
step.setResetUserPrompt('The customer wants a refund.');

// Consolidate conversation history at this step
step.setResetConsolidate(true);

// Perform a full conversation reset at this step
step.setResetFullReset(true);
```

The step-level reset options are serialized under a `reset` key in the SWML output:

```json
{
  "name": "fresh_start",
  "text": "...",
  "reset": {
    "system_prompt": "You are now handling a refund request.",
    "user_prompt": "The customer wants a refund.",
    "consolidate": true,
    "full_reset": true
  }
}
```

---

## Fillers

Filler phrases are spoken by the AI during context transitions to provide a natural conversational feel while the system processes the switch.

### Enter Fillers

Spoken when the AI enters this context:

```typescript
// Set all enter fillers at once (keyed by language code)
ctx.setEnterFillers({
  'en-US': ['One moment please...', 'Let me connect you...'],
  'es-ES': ['Un momento por favor...'],
});

// Add fillers for a single language
ctx.addEnterFiller('en-US', [
  'Just a moment while I pull that up.',
  'Let me check on that for you.',
]);
```

### Exit Fillers

Spoken when the AI leaves this context:

```typescript
ctx.setExitFillers({
  'en-US': ['Alright, moving on...', 'Let me transfer you now.'],
});

ctx.addExitFiller('fr-FR', ['Un instant s\'il vous plait...']);
```

Fillers are serialized as `enter_fillers` and `exit_fillers` in the SWML output.

---

## Validation

The `ContextBuilder.validate()` method performs structural checks before serialization:

1. **At least one context must exist** -- throws if the builder is empty.
2. **Single-context naming** -- if only one context is defined, it must be named `'default'`.
3. **Steps required** -- every context must have at least one step.
4. **Cross-context references** -- any context name referenced in `setValidContexts()` must actually exist in the builder.

```typescript
const cb = new ContextBuilder();
const ctx = cb.addContext('default');
ctx.addStep('welcome').setText('Hello!');

// Explicit validation
cb.validate(); // throws if invalid

// Implicit validation on serialization
const swml = cb.toDict(); // calls validate() internally
```

### Common Validation Errors

| Error | Cause |
|---|---|
| `At least one context must be defined` | No contexts were added |
| `When using a single context, it must be named 'default'` | One context exists but is not named `'default'` |
| `Context 'X' must have at least one step` | A context has no steps |
| `Context 'X' references unknown context 'Y'` | `setValidContexts()` refers to a context name that does not exist |
| `Step 'X' has no text or POM sections defined` | A step has neither `setText()` nor `addSection()`/`addBullets()` |

---

## Real-World Example

A complete customer service agent with three contexts: greeting, troubleshooting, and resolution.

```typescript
import { AgentBase, ContextBuilder } from '@signalwire/sdk';

const agent = new AgentBase({
  name: 'customer-service',
  prompt: { text: 'You are a helpful customer service agent for TechCo.' },
});

// Define the tools
agent.defineTool({
  name: 'lookup_account',
  description: 'Look up a customer account by account number.',
  parameters: {
    account_number: { type: 'string', description: 'The customer account number.' },
  },
  handler: async (args) => {
    // ... account lookup logic
    return { response: `Account found: ${args.account_number}` };
  },
});

agent.defineTool({
  name: 'create_ticket',
  description: 'Create a support ticket for the customer.',
  parameters: {
    issue: { type: 'string', description: 'Description of the issue.' },
    priority: { type: 'string', description: 'Ticket priority: low, medium, high.' },
  },
  handler: async (args) => {
    return { response: `Ticket created: ${args.issue} (${args.priority})` };
  },
});

agent.defineTool({
  name: 'process_refund',
  description: 'Process a refund for a customer.',
  parameters: {
    amount: { type: 'number', description: 'Refund amount in dollars.' },
    reason: { type: 'string', description: 'Reason for the refund.' },
  },
  handler: async (args) => {
    return { response: `Refund of $${args.amount} processed.` };
  },
});

// Build the conversation flow
const cb = agent.defineContexts();

// ── Context 1: Greeting ──────────────────────────────────────────────
const greeting = cb.addContext('greeting');
greeting.addEnterFiller('en-US', [
  'Welcome! Let me help you today.',
]);
greeting.setValidContexts(['troubleshooting', 'resolution']);

const welcome = greeting.addStep('welcome', {
  task: 'Greet the customer warmly and ask how you can help today.',
  criteria: 'The customer has stated the nature of their issue.',
  functions: 'none',
  validSteps: ['identify'],
});

const identify = greeting.addStep('identify', {
  task: 'Verify the customer identity by asking for their account number.',
  criteria: 'Account has been looked up and verified.',
  functions: ['lookup_account'],
  validSteps: ['route'],
});

const route = greeting.addStep('route');
route.addSection('Task', 'Determine the appropriate department for the customer issue.');
route.addBullets('Routing Rules', [
  'Technical issues (connectivity, hardware, software) -> troubleshooting context',
  'Billing, refunds, or account changes -> resolution context',
  'If unclear, ask a clarifying question before routing',
]);
route.setStepCriteria('The issue category has been determined.');
route.setValidContexts(['troubleshooting', 'resolution']);
route.setFunctions('none');

// ── Context 2: Troubleshooting ───────────────────────────────────────
const troubleshooting = cb.addContext('troubleshooting');
troubleshooting.setConsolidate(true);
troubleshooting.addEnterFiller('en-US', [
  'Let me look into that technical issue for you.',
  'One moment while I pull up our troubleshooting guide.',
]);
troubleshooting.setExitFillers({
  'en-US': ['Let me get you to the right place.'],
});
troubleshooting.setValidContexts(['resolution']);

troubleshooting.addSystemSection('Role', 'You are a technical support specialist.');
troubleshooting.addSystemBullets('Approach', [
  'Start with the simplest solution first',
  'Ask the customer to confirm each step',
  'Escalate to a ticket if three attempts fail',
]);

const diagnose = troubleshooting.addStep('diagnose');
diagnose.setText('Ask the customer to describe their technical issue in detail.');
diagnose.setStepCriteria('The specific technical problem is understood.');
diagnose.setValidSteps(['guided_fix', 'escalate']);

const guidedFix = troubleshooting.addStep('guided_fix');
guidedFix.addSection('Task', 'Walk the customer through step-by-step troubleshooting.');
guidedFix.addBullets('Steps', [
  'Have the customer restart their device',
  'Check network connectivity',
  'Verify software is up to date',
  'Try clearing the cache',
]);
guidedFix.setStepCriteria('The issue is resolved OR three troubleshooting steps have been attempted.');
guidedFix.setFunctions('none');
guidedFix.setValidSteps(['escalate']);
guidedFix.setValidContexts(['resolution']);

const escalate = troubleshooting.addStep('escalate');
escalate.addSection('Task', 'Create a support ticket for the unresolved issue.');
escalate.setStepCriteria('A support ticket has been created.');
escalate.setFunctions(['create_ticket']);
escalate.setValidContexts(['resolution']);

// ── Context 3: Resolution ────────────────────────────────────────────
const resolution = cb.addContext('resolution');
resolution.setIsolated(true);
resolution.addEnterFiller('en-US', [
  'Let me wrap things up for you.',
]);

const summarize = resolution.addStep('summarize');
summarize.setText('Summarize what was accomplished during this call.');
summarize.setStepCriteria('A summary has been provided to the customer.');
summarize.setFunctions('none');
summarize.setValidSteps(['refund_check', 'goodbye']);

const refundCheck = resolution.addStep('refund_check');
refundCheck.addSection('Task', 'Determine if a refund or credit is appropriate.');
refundCheck.addBullets('Policy', [
  'Refunds up to $50 can be issued immediately',
  'Refunds over $50 require manager approval -- create a ticket instead',
  'Always confirm the refund amount with the customer before processing',
]);
refundCheck.setStepCriteria('Refund has been processed or determined not applicable.');
refundCheck.setFunctions(['process_refund', 'create_ticket']);
refundCheck.setValidSteps(['goodbye']);

// Gather customer satisfaction info before ending
const goodbye = resolution.addStep('goodbye');
goodbye.setText('Thank the customer and collect feedback.');
goodbye.setGatherInfo({
  outputKey: 'satisfaction',
  prompt: 'Before we end, we would appreciate your feedback.',
});
goodbye.addGatherQuestion({
  key: 'rating',
  question: 'On a scale of 1-5, how would you rate your experience today?',
  type: 'number',
  confirm: true,
});
goodbye.addGatherQuestion({
  key: 'comments',
  question: 'Do you have any additional comments or suggestions?',
  type: 'string',
  confirm: false,
});
goodbye.setEnd(true);

// Start the server
agent.start();
```

### How This Flow Works

1. The conversation begins in the **greeting** context. The AI welcomes the customer, identifies them via account lookup, and routes them to the appropriate department.
2. Technical issues go to the **troubleshooting** context, which consolidates prior conversation history. The AI walks through diagnostic steps and can escalate by creating a ticket.
3. All paths eventually lead to the **resolution** context, which is isolated (fresh conversation history). It summarizes the call, optionally processes a refund, then collects satisfaction feedback before ending.

The `setValidContexts()` and `setValidSteps()` calls create explicit navigation boundaries, ensuring the AI cannot jump to inappropriate stages. Function restrictions via `setFunctions()` prevent the AI from calling tools at the wrong time -- for example, `process_refund` is only available during the `refund_check` step.
