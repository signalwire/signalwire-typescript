# Contexts & Steps Guide

This guide covers the Contexts & Steps system in the SignalWire AI Agents TypeScript SDK, which builds multi-step conversation workflows.

<!-- snippet-setup -->
```ts
export {}; // treat each example as a module so top-level `await` is allowed
declare global {
  // Shared context the fragments on this page assume (constructed in the prose examples).
  const agent: import('@signalwire/sdk').AgentBase;
  const AgentBase: typeof import('@signalwire/sdk').AgentBase;
  const ContextBuilder: typeof import('@signalwire/sdk').ContextBuilder;
  const createSimpleContext: typeof import('@signalwire/sdk').createSimpleContext;
  const cb: import('@signalwire/sdk').ContextBuilder;
  const ctx: import('@signalwire/sdk').Context;
  const step: import('@signalwire/sdk').Step;
}
```

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

Contexts and steps structure a conversation as a state machine. Instead of one flat prompt, you define **contexts**, and each context holds ordered **steps**. The platform moves through the steps by the rules you set. Those rules are completion criteria, the steps and contexts each step may move to, and the tools each step allows. Customer intake, troubleshooting trees and routing between departments fit this model.

The system has three parts:

- **Context**: a named group of ordered steps. It can have its own prompt, system prompt, navigation rules and history settings.
- **Step**: one stage within a context. It has instruction text (raw text or POM sections), completion criteria, a tool list, and the steps or contexts it may move to.
- **ContextBuilder**: the container for all contexts. It validates cross-references and serializes everything to SWML.

These classes are involved:

| Class | Role |
|---|---|
| `ContextBuilder` | Holds and validates all contexts |
| `Context` | A named context with steps, prompts, fillers and navigation rules |
| `Step` | A single step within a context, with text, criteria and function control |
| `GatherInfo` | Structured data collection attached to a step |
| `GatherQuestion` | A single question within a GatherInfo operation |

The package exports all of them from `@signalwire/sdk`.

The contexts don't replace the agent's prompt. The SDK sends the agent's prompt, or `You are <name>, a helpful AI assistant.` when there's none, together with the contexts. The contexts go in the `ai` verb's prompt object, as `ai.prompt.contexts`.

---

## Creating Contexts

### Using `agent.defineContexts()`

`defineContexts()` on `AgentBase` returns a `ContextBuilder` that you add contexts to:

```typescript
import { AgentBase } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent' });

// Create and get the ContextBuilder
const cb = agent.defineContexts();

// Add contexts to the builder
const greeting = cb.addContext('default');
const support = cb.addContext('support');
const farewell = cb.addContext('farewell');
```

You can also build a `ContextBuilder` first and pass it in:

```typescript
import { ContextBuilder } from '@signalwire/sdk';

const cb = new ContextBuilder();
cb.addContext('default');
// ... configure ...

agent.defineContexts(cb);
```

`agent.resetContexts()` removes every context, for example in a dynamic config callback that rebuilds them for one request. `agent.getContexts()` returns the serialized contexts.

### Using `ContextBuilder.addContext()`

`addContext()` returns the new `Context`:

```typescript
const cb = new ContextBuilder();

// Returns the new Context instance for chaining
const ctx = cb.addContext('intake');
```

Context names must be unique within a builder, and a builder holds at most 50 contexts. `addContext()` throws for a duplicate name or a 51st context.

### Retrieving a Context

`getContext()` returns a context by name, or `undefined`:

<!-- snippet: no-run illustrative fragment: references the assumed `cb` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const ctx = cb.getContext('intake');
if (ctx) {
  // configure further
}
```

### The `default` Context

The SWML schema requires a context named `default`, and describes it as the context the conversation starts in. The SDK enforces the name only when there's one context:

```typescript
// Valid: single context named "default"
const cb = new ContextBuilder();
cb.addContext('default');

// Invalid: single context with any other name
const bad = new ContextBuilder();
bad.addContext('main'); // validate() will throw
```

With several contexts, the SDK accepts a set without `default`, but the schema doesn't. Name the context the call starts in `default`.

### Helper: `createSimpleContext()`

`createSimpleContext()` creates a standalone `Context`, named `default` unless you pass a name:

```typescript
import { createSimpleContext } from '@signalwire/sdk';

const ctx = createSimpleContext(); // name defaults to 'default'
const step = ctx.addStep('welcome');
step.setText('Welcome the caller to the service.');
```

---

## Steps

Steps are the stages of a context, kept in the order you add them. A context holds at most 100 steps.

### Adding a Step

`addStep()` returns the new `Step`, and takes optional shorthand settings:

<!-- snippet: no-run illustrative fragment: references the assumed `cb` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
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

Each shorthand option calls a `Step` method:

| Option | Effect |
|---|---|
| `task` | Calls `step.addSection('Task', task)` |
| `bullets` | Calls `step.addBullets('Process', bullets)` |
| `criteria` | Calls `step.setStepCriteria(criteria)` |
| `functions` | Calls `step.setFunctions(functions)` |
| `validSteps` | Calls `step.setValidSteps(validSteps)` |

Step names must be unique within a context. Adding a duplicate throws an error.

### Step Content: `setText()` vs POM Sections

A step's content is either raw text or POM sections, not both. This is the raw-text form:

```typescript
step.setText('You are greeting the customer. Be friendly and professional.');
```

This is the POM form, with a body section and a bullet section:

```typescript
step.addSection('Task', 'Help the customer with their billing inquiry.');
step.addBullets('Guidelines', [
  'Be empathetic and patient',
  'Verify identity before sharing account details',
  'Offer to escalate if needed',
]);
```

Calling `setText()` on a step with sections, or adding a section to a step with text, throws an error.

The SDK renders POM sections as Markdown text in the step's `text` field:

```markdown
## Task
Help the customer with their billing inquiry.

## Guidelines
- Be empathetic and patient
- Verify identity before sharing account details
- Offer to escalate if needed
```

### Managing Steps

These methods find, remove, reorder and clear steps:

```typescript
// Retrieve a step by name
const step = ctx.getStep('greet');

// Remove a step
ctx.removeStep('greet');

// Move a step to a new position (zero-indexed)
ctx.moveStep('verify', 0); // Move "verify" to the beginning

// Clear all content from a step (sections and text)
step!.clearSections();
```

---

## Step Navigation

Navigation rules control which steps and contexts the conversation can move to from a step.

### `setValidSteps()`

`setValidSteps()` lists the steps of the current context the conversation may move to. The name `next` stands for the following step:

```typescript
step.setValidSteps(['collect_info', 'verify', 'escalate']);
```

The schema says that without `valid_steps`, or with an empty list, the conversation proceeds to the next step in the context.

### `setValidContexts()`

`setValidContexts()` lists the contexts the conversation may switch to from this step:

```typescript
step.setValidContexts(['billing', 'technical_support', 'farewell']);
```

When a step or its context sets `valid_steps` or `valid_contexts`, the platform gives the model the `next_step` and `change_context` tools to move. You don't define those tools, and you can't register tools with those names while contexts are in use.

### `setStepCriteria()`

`setStepCriteria()` describes, in plain language, what must happen before the step is complete:

```typescript
step.setStepCriteria(
  'The customer has confirmed their name, account number, and the nature of their issue.'
);
```

The criteria is an instruction to the model, which uses it to decide when to move on.

### Context-Level Navigation

A context can set navigation rules for all its steps:

<!-- snippet: no-run illustrative fragment: references the assumed `cb` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const billing = cb.addContext('billing');
billing.setValidContexts(['technical_support', 'farewell']);
billing.setValidSteps(['step_a', 'step_b']);
```

### `setInitialStep()`

A context starts on its first step. `setInitialStep()` starts it on another step, for example to skip a greeting when the conversation comes back to the context:

<!-- snippet: no-run illustrative fragment: references the assumed `cb` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const support = cb.addContext('support');
support.addStep('greeting').setText('Introduce the support team.');
support.addStep('help').setText('Help with the issue.');
support.setInitialStep('help');
```

The step must exist in the context, or `validate()` throws.

---

## Function Control

Each step can limit which SWAIG functions (tools) the model can call during that step.

### `setFunctions()`

`setFunctions()` takes a list of function names, or `'none'`:

```typescript
// Only these functions are available
step.setFunctions(['lookup_account', 'get_balance']);

// No functions available
step.setFunctions('none');

// Same as 'none'
step.setFunctions([]);
```

Functions not in the list are inactive during the step. Internal functions, such as `hangup_hook` and `gather_submit`, stay active, and so do `next_step` and `change_context`. Don't list those in `functions`.

### Inheritance Between Steps

A step without `setFunctions()` emits no `functions` key. The platform then keeps the function set of the previous step, or of the previous context's last step. It changes the active set only when a step declares `functions`. On the first step of the conversation, with no earlier set to keep, every registered function is active.

A later step that leaves out `setFunctions()` therefore keeps the tools of the step before it. Call `setFunctions()` on every step whose tools differ from the previous step's.

The SDK checks every name in a `functions` list, and in each gather question's `functions`, against the agent's registered tools. `validate()` throws for a name that isn't a registered tool or one of the reserved native tools.

---

## End States

### `setEnd()`

`setEnd(true)` marks the last step of the step flow:

```typescript
const wrapUp = ctx.addStep('wrap_up');
wrapUp.setText('Thank the customer and ask if there is anything else.');
wrapUp.setEnd(true);
```

It doesn't end the call. After the step runs, the platform leaves step mode: it clears the steps, `valid_steps` and `valid_contexts`, and stops offering `next_step`. The model then works from the base prompt and the context prompt. To end the call, have a tool return `FunctionResult.hangup()`.

### `setSkipUserTurn()`

`setSkipUserTurn(true)` doesn't wait for the caller to speak when the step starts:

```typescript
const transition = ctx.addStep('auto_transfer');
transition.setText('Transfer the call to the billing department.');
transition.setSkipUserTurn(true);
```

### `setSkipToNextStep()`

`setSkipToNextStep(true)` moves to the next step in order when this one completes:

```typescript
const intro = ctx.addStep('intro');
intro.setText('Provide a brief introduction.');
intro.setSkipToNextStep(true);

const main = ctx.addStep('main');
main.setText('Now handle the main request.');
```

### `setHistory()`

`setHistory()` controls what the model still sees of earlier steps when this step starts. Nothing is removed from the call log:

```typescript
step.setHistory('hide');
```

The three modes are these:

- `keep`: hide nothing. Earlier steps' instructions and dialogue stay visible.
- `default`: hide earlier step instructions, and keep the dialogue. This is the behavior when `history` isn't set.
- `hide`: hide earlier instructions and the earlier dialogue. A `${step_history.*}` reference in this step's text brings back what you choose.

`Context.setHistory()` sets the default for every step in the context, and a step's own `setHistory()` overrides it. Any other value throws.

---

## GatherInfo

`GatherInfo` collects structured answers within a step, one question at a time. Each question has a key, an answer type, and optional confirmation and tools.

### Setting Up GatherInfo

Call `setGatherInfo()` on a step, then add questions:

```typescript
const step = ctx.addStep('collect_details');
step.setText('Collect the customer contact details.');

step.setGatherInfo({
  outputKey: 'customer_info',
  completionAction: 'next_step',
  prompt: 'Explain that you need a few contact details.',
});

step.addGatherQuestion({
  key: 'full_name',
  question: 'What is your full name?',
  confirm: true,
});

step.addGatherQuestion({
  key: 'email',
  question: 'What is your email address?',
  confirm: true,
  prompt: 'Ask the caller to spell the address.',
});

step.addGatherQuestion({
  key: 'phone',
  question: 'What is your phone number?',
  functions: ['validate_phone'],
});

ctx.addStep('verify').setText('Read back ${customer_info} and confirm it.');
```

`addGatherQuestion()` throws if `setGatherInfo()` wasn't called first.

While a question is asked, the platform deactivates the step's other functions. The model can call only `gather_submit`, which records the answer, and the tools listed in that question's `functions`. It can't move to another step or context until the gather completes. The answers go into the call's global data, under `outputKey` when it's set.

### GatherInfo Options

`setGatherInfo()` takes these options:

| Option | Type | Default | Description |
|---|---|---|---|
| `outputKey` | `string` | none | Key in global data that holds the answers. Without it, each answer is stored at the top level. |
| `completionAction` | `string` | none | Where to go when every question is answered: `'next_step'` for the following step, or the name of a step in the same context. Without it, the step returns to its normal text. |
| `prompt` | `string` | none | Text the platform adds once, when the first question starts. |
| `isolated` | `boolean` | `false` | Default for every question. When `true`, a question is asked with the other questions and answers hidden from the model, so it must ask rather than work out the answer from an earlier one. The hidden turns stay in the call log. |

`validate()` throws when `completionAction` is `'next_step'` on the last step of a context, or names a step that isn't in the context.

### GatherQuestion Options

`addGatherQuestion()` takes these options:

| Option | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | (required) | Key the answer is stored under. Keys must be unique within a step. |
| `question` | `string` | (required) | The question for the model to ask. |
| `type` | `string` | `'string'` | JSON Schema type of the answer, such as `'string'`, `'integer'`, `'number'` or `'boolean'`. |
| `confirm` | `boolean` | `false` | The model must read the answer back and get the caller's confirmation before it submits. |
| `prompt` | `string` | none | Extra instruction for this question. |
| `functions` | `string[]` | none | Functions available during this question only. |
| `isolated` | `boolean` | inherits the gather's setting | `true` hides the other questions and answers while this one is asked. `false` keeps them visible, even in an isolated gather. |

### GatherInfo Serialization

`GatherInfo.toDict()` produces the SWML `gather_info` object. For a gather with `isolated: true` whose `email` question sets `isolated: false`, the output is:

```json
{
  "questions": [
    { "key": "full_name", "question": "What is your full name?", "confirm": true },
    { "key": "email", "question": "What is your email address?", "confirm": true, "prompt": "Ask the caller to spell the address.", "isolated": false },
    { "key": "phone", "question": "What is your phone number?", "functions": ["validate_phone"] }
  ],
  "prompt": "Explain that you need a few contact details.",
  "output_key": "customer_info",
  "completion_action": "next_step",
  "isolated": true
}
```

The SDK leaves `type` out when it's `'string'`, and `confirm` when it's `false`. A question's `isolated` appears whenever you set it, `false` included, so it can override the gather. `toDict()` throws for a gather with no questions.

---

## Context Settings

### Prompt Configuration

A context can have its own prompt, which applies to all its steps. Like a step, it uses either raw text or POM sections. This is the raw-text form:

<!-- snippet: no-run illustrative fragment: references the assumed `cb` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const ctx = cb.addContext('billing');
ctx.setPrompt('You are handling a billing inquiry. Be precise with numbers.');
```

This is the POM form:

```typescript
ctx.addSection('Role', 'You are a billing specialist for Acme Corp.');
ctx.addBullets('Guidelines', [
  'Always verify the account before discussing charges',
  'State every fee and credit on the account',
  'Offer payment plan options when appropriate',
]);
```

Raw text and POM sections can't be mixed in a context's prompt; the second kind throws.

### System Prompt

`setSystemPrompt()` gives the context a new system prompt, used when the conversation enters it. This is the raw-text form:

```typescript
ctx.setSystemPrompt('You are a helpful billing assistant. Be concise.');
```

`addSystemSection()` and `addSystemBullets()` build it from POM sections:

```typescript
ctx.addSystemSection('Identity', 'You are Acme Corp billing support.');
ctx.addSystemBullets('Rules', [
  'Never disclose internal pricing formulas',
  'Always confirm before processing refunds',
]);
```

Raw text and POM sections can't be mixed in a system prompt either.

### Post-Prompt

`setPostPrompt()` replaces the agent's post-prompt while this context is active:

```typescript
ctx.setPostPrompt('Summarize the billing changes made during the call.');
```

### User Prompt

`setUserPrompt()` sets a user message that the platform adds when the conversation enters this context:

```typescript
ctx.setUserPrompt('I need help with my billing.');
```

---

## Isolation and Reset

These settings control what happens to the conversation history when the conversation enters a context or step.

### `setIsolated()`

`setIsolated(true)` clears the conversation history when the conversation enters the context through `change_context`. The model starts with the context's system prompt and step instructions only:

<!-- snippet: no-run illustrative fragment: references the assumed `cb` from the page prelude (declared type-only in the shared snippet-setup), not a standalone program -->
```typescript
const secureCtx = cb.addContext('payment');
secureCtx.setIsolated(true);
```

If the context also sets `consolidate` or `full_reset`, those apply instead of the wipe.

### `setConsolidate()` (Context-Level)

`setConsolidate(true)` summarizes the earlier conversation into the new prompt when the conversation enters this context:

```typescript
ctx.setConsolidate(true);
```

### `setFullReset()` (Context-Level)

`setFullReset(true)` replaces the system prompt completely when the conversation enters this context, instead of adding to it:

```typescript
ctx.setFullReset(true);
```

### Step-Level Reset Options

A step can reset the conversation when the conversation enters it:

```typescript
const step = ctx.addStep('fresh_start');

// Replace the system prompt when entering this step
step.setResetSystemPrompt('You are now handling a refund request.');

// Set the user prompt when entering this step
step.setResetUserPrompt('The customer wants a refund.');

// Consolidate conversation history at this step
step.setResetConsolidate(true);

// Perform a full conversation reset at this step
step.setResetFullReset(true);
```

The SDK serializes the step-level reset options under a `reset` key:

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

Fillers are phrases the platform plays when the conversation enters or leaves a context. Each set is keyed by language code.

### Enter Fillers

Enter fillers play when the conversation enters the context:

```typescript
// Set all enter fillers at once (keyed by language code)
ctx.setEnterFillers({
  'en-US': ['One moment.', 'Let me connect you.'],
  'es-ES': ['Un momento, por favor.'],
});

// Set the fillers for one language
ctx.addEnterFiller('en-US', [
  'One moment while I pull that up.',
  'Let me check on that for you.',
]);
```

`addEnterFiller()` replaces the list for that language.

### Exit Fillers

Exit fillers play when the conversation leaves the context:

```typescript
ctx.setExitFillers({
  'en-US': ['Alright, moving on.', 'Let me transfer you now.'],
});

ctx.addExitFiller('fr-FR', ['Un instant, s\'il vous plait.']);
```

The SDK serializes them as `enter_fillers` and `exit_fillers`.

---

## Validation

`ContextBuilder.validate()` checks the structure before serialization. It throws when any of these fails:

1. At least one context exists.
2. A single context is named `'default'`.
3. Every context has at least one step.
4. Every `initial_step` names a step in its context.
5. Every context in a context's or step's `valid_contexts` exists.
6. Every step in a step's `valid_steps` exists in the context, or is `next`.
7. Gather question keys are unique within a step.
8. Every gather `completion_action` is `next_step` on a step that has a following step, or names a step in the context.
9. No registered tool is named `next_step`, `change_context` or `gather_submit`.
10. Every name in a step's or question's `functions` is a registered tool or a reserved native tool.

The last two checks run when the builder is attached to an agent, which `agent.defineContexts()` does. `toDict()` calls `validate()`, and the agent calls `toDict()` when it renders the SWML:

```typescript
const cb = new ContextBuilder();
const ctx = cb.addContext('default');
ctx.addStep('welcome').setText('Greet the caller.');

// Explicit validation
cb.validate(); // throws if invalid

// Implicit validation on serialization
const swml = cb.toDict(); // calls validate() internally
```

### Common Validation Errors

These are the errors you're most likely to see:

| Error | Cause |
|---|---|
| `At least one context must be defined` | No contexts were added |
| `When using a single context, it must be named 'default'` | One context exists but isn't named `'default'` |
| `Context 'X' must have at least one step` | A context has no steps |
| `Context 'X' references unknown context 'Y'` | A context's `setValidContexts()` names a context that doesn't exist |
| `Step 'X' in context 'C' references unknown step 'Y'` | `setValidSteps()` names a step that isn't in the context |
| `Step 'X' in context 'C' references unknown context 'Y'` | A step's `setValidContexts()` names a context that doesn't exist |
| `Context/step 'functions' whitelist references unknown SWAIG function(s): ...` | A `functions` list names a tool that isn't registered |
| `Step 'X' has no text or POM sections defined` | A step has neither `setText()` nor `addSection()`/`addBullets()`; thrown by `toDict()` |

---

## Real-World Example

This customer service agent has three contexts. It starts in `default`, which greets and routes the caller, then moves to `troubleshooting` or `resolution`:

<!-- snippet: no-run starts a blocking HTTP server (serve/start/run on a fixed port); collides under the concurrent gate and cannot run standalone -->
```typescript
import { AgentBase } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'customer-service' });
agent.setPromptText('You are a customer service agent for TechCo.');

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

// Context 1: greeting and routing (the starting context)
const greeting = cb.addContext('default');
greeting.addEnterFiller('en-US', ['Welcome. Let me help you today.']);
greeting.setValidContexts(['troubleshooting', 'resolution']);

greeting.addStep('welcome', {
  task: 'Greet the customer warmly and ask how you can help today.',
  criteria: 'The customer has stated the nature of their issue.',
  functions: 'none',
  validSteps: ['identify'],
});

greeting.addStep('identify', {
  task: 'Verify the customer identity by asking for their account number.',
  criteria: 'Account has been looked up and verified.',
  functions: ['lookup_account'],
  validSteps: ['route'],
});

const route = greeting.addStep('route');
route.addSection('Task', 'Determine the appropriate department for the customer issue.');
route.addBullets('Routing Rules', [
  'Technical issues (connectivity, hardware, software): troubleshooting context',
  'Billing, refunds, or account changes: resolution context',
  'If unclear, ask a clarifying question before routing',
]);
route.setStepCriteria('The issue category has been determined.');
route.setValidContexts(['troubleshooting', 'resolution']);
route.setFunctions('none');

// Context 2: troubleshooting
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
  'Start with the least disruptive fix first',
  'Ask the customer to confirm each step',
  'Escalate to a ticket if three attempts fail',
]);

const diagnose = troubleshooting.addStep('diagnose');
diagnose.setText('Ask the customer to describe their technical issue in detail.');
diagnose.setStepCriteria('The specific technical problem is understood.');
diagnose.setFunctions('none');
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

// Context 3: resolution
const resolution = cb.addContext('resolution');
resolution.setIsolated(true);
resolution.addEnterFiller('en-US', ['Let me wrap things up for you.']);

const summarize = resolution.addStep('summarize');
summarize.setText('Summarize what was accomplished during this call.');
summarize.setStepCriteria('A summary has been provided to the customer.');
summarize.setFunctions('none');
summarize.setValidSteps(['refund_check', 'goodbye']);

const refundCheck = resolution.addStep('refund_check');
refundCheck.addSection('Task', 'Determine if a refund or credit is appropriate.');
refundCheck.addBullets('Policy', [
  'Refunds up to $50 can be issued immediately',
  'Refunds over $50 require manager approval, so create a ticket instead',
  'Always confirm the refund amount with the customer before processing',
]);
refundCheck.setStepCriteria('Refund has been processed or determined not applicable.');
refundCheck.setFunctions(['process_refund', 'create_ticket']);
refundCheck.setValidSteps(['goodbye']);

// Gather customer satisfaction info before leaving step mode
const goodbye = resolution.addStep('goodbye');
goodbye.setText('Thank the customer and collect feedback.');
goodbye.setFunctions('none');
goodbye.setGatherInfo({
  outputKey: 'satisfaction',
  prompt: 'Ask the caller for brief feedback before the call ends.',
});
goodbye.addGatherQuestion({
  key: 'rating',
  question: 'On a scale of 1-5, how would you rate your experience today?',
  type: 'integer',
  confirm: true,
});
goodbye.addGatherQuestion({
  key: 'comments',
  question: 'Do you have any additional comments or suggestions?',
});
goodbye.setEnd(true);

// Start the server
agent.serve();
```

### How This Flow Works

The flow runs in three stages:

1. The conversation begins in the `default` context. The model greets the customer, looks up the account, and routes the call.
2. Technical issues go to the `troubleshooting` context, which consolidates the earlier conversation. The model walks through diagnostic steps, and can escalate by creating a ticket.
3. Every path ends in the `resolution` context, which is isolated, so its history starts fresh. It summarizes the call, can process a refund, and collects feedback before leaving step mode.

`setValidContexts()` and `setValidSteps()` limit where each step can go. Each step calls `setFunctions()`, so no step inherits the tools of the step before it. `process_refund`, for example, is available only in the `refund_check` step. `setEnd(true)` on `goodbye` doesn't hang up; add a tool that returns `FunctionResult.hangup()` for that.
