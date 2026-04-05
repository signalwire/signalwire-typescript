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
13. [Best Practices](#best-practices)

---

## Overview

The Contexts & Steps system provides a **state machine** for structuring multi-step AI conversations. Instead of a single flat prompt, you define a graph of **contexts** that each contain ordered **steps**. The AI navigates through these steps based on completion criteria, enabling complex branching workflows such as customer intake, troubleshooting trees, or multi-department routing.

**Key concepts:**

- **Context** -- A named group of ordered steps with its own prompt, system prompt, navigation rules, and isolation settings. Think of it as a "page" or "scene" in the conversation.
- **Step** -- A single stage within a context. Each step has prompt text (raw text or POM sections), completion criteria, function restrictions, and rules about which steps or contexts the AI can move to next.
- **ContextBuilder** -- The top-level builder that holds all contexts, validates cross-references, and serializes everything to SWML output.

### When to Use Contexts vs Traditional Prompts

**Use Contexts and Steps when:**
- Building multi-step workflows (onboarding, support tickets, applications)
- Need explicit navigation control between conversation states
- Want to restrict function access based on conversation stage
- Building complex customer service or troubleshooting flows
- Creating guided experiences with clear progression

**Use Traditional Prompts when:**
- Building simple, freeform conversational agents
- Want maximum flexibility in conversation flow
- Creating general-purpose assistants
- Prototyping or building simple proof-of-concepts

### Classes

| Class | Role |
|---|---|
| `ContextBuilder` | Top-level container; holds and validates all contexts |
| `Context` | A named context with steps, prompts, fillers, and navigation rules |
| `Step` | A single step within a context, with text, criteria, and function control |
| `GatherInfo` | Structured data collection attached to a step |
| `GatherQuestion` | A single question within a GatherInfo operation |

All classes are exported from `@signalwire/sdk`.

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

When only one context is defined, it must be named `"default"`. The validation method enforces this:

```typescript
const cb = new ContextBuilder();
cb.addContext('default'); // OK -- single context named "default"

const cb2 = new ContextBuilder();
cb2.addContext('intake'); // Will fail validation (single context must be "default")
```

---

## Steps

Each context contains ordered steps. Steps are added via `context.addStep()`:

```typescript
const ctx = cb.addContext('intake');

const welcome = ctx.addStep('welcome');
welcome.setText('Welcome! I will help you get set up today.');

const info = ctx.addStep('collect_info');
info.setText('I need to collect some information from you.');
info.setCriteria('The user has provided their name, email, and phone number.');
```

### Step Methods

| Method | Description |
|--------|-------------|
| `setText(text)` | Set the step's prompt text (raw string). |
| `addSection(title, opts?)` | Add a POM section to the step. |
| `setCriteria(criteria)` | Set the completion criteria string. |
| `setFunctions(fns)` | Restrict which SWAIG functions are available. |
| `setValidSteps(steps)` | Define which steps the AI can navigate to next. |
| `setValidContexts(contexts)` | Define which contexts the AI can switch to. |
| `setEnd(end)` | Mark this step as an end state. |
| `setGatherInfo(info)` | Attach structured data collection. |
| `setResetOnEntry(reset)` | Reset step state when re-entered. |
| `setFillers(fillers)` | Set step-level filler phrases. |

### Step Prompt Text

Steps support two modes for prompt content:

```typescript
// Raw text mode
const step = ctx.addStep('greeting');
step.setText('Hello! Welcome to our service.');

// POM section mode
const step2 = ctx.addStep('troubleshoot');
step2.addSection('Instructions', {
  body: 'Follow these troubleshooting steps:',
  bullets: [
    'Ask the user to restart the device',
    'Check if the issue persists',
    'If yes, escalate to a technician',
  ],
});
```

---

## Step Navigation

Control how the AI moves between steps within and across contexts.

### Valid Steps (Within a Context)

```typescript
const welcome = ctx.addStep('welcome');
welcome.setValidSteps(['verify_identity', 'skip_to_support']);

const verify = ctx.addStep('verify_identity');
verify.setCriteria('User has provided their account number.');
verify.setValidSteps(['account_details']);

const skip = ctx.addStep('skip_to_support');
skip.setValidSteps(['account_details']);
```

### Valid Contexts (Cross-Context Navigation)

```typescript
const welcome = ctx.addStep('welcome');
welcome.setValidContexts(['support', 'billing']);
```

When the AI determines the step criteria are met (or the user requests a context change), it can navigate to one of the valid contexts.

### Navigation with FunctionResult

Tool handlers can trigger navigation programmatically:

```typescript
import { FunctionResult } from '@signalwire/sdk';

// Navigate to a step
const result = new FunctionResult('Moving to verification.')
  .swmlChangeStep('verify_identity');

// Navigate to a context
const result2 = new FunctionResult('Transferring to billing.')
  .swmlChangeContext('billing', 'initial');
```

---

## Function Control

Restrict which SWAIG functions are available at each step:

```typescript
// Only allow these functions during the payment step
const paymentStep = ctx.addStep('process_payment');
paymentStep.setFunctions(['validate_card', 'process_payment', 'check_balance']);

// No function restrictions (all agent functions available)
const generalStep = ctx.addStep('general_help');
// Don't call setFunctions() -- all functions remain available
```

This is useful for security (preventing payment functions during greeting) and for guiding the AI's behavior (limiting distractions during focused steps).

---

## End States

Mark a step as the terminal state of a workflow:

```typescript
const farewell = ctx.addStep('goodbye');
farewell.setText('Thank you for calling. Goodbye!');
farewell.setEnd(true);
```

When the AI reaches an end step and its criteria are met (or it has no criteria), the conversation flow for that context is considered complete.

---

## GatherInfo

`GatherInfo` provides structured data collection at a step. It defines a set of questions the AI asks, with optional validation rules.

```typescript
import { GatherInfo, GatherQuestion } from '@signalwire/sdk';

const gather = new GatherInfo()
  .addQuestion(
    new GatherQuestion('full_name')
      .setQuestion('What is your full name?')
      .setDescription('Customer legal name'),
  )
  .addQuestion(
    new GatherQuestion('email')
      .setQuestion('What is your email address?')
      .setDescription('Primary contact email')
      .setValidation('^[^@]+@[^@]+\\.[^@]+$'),
  )
  .addQuestion(
    new GatherQuestion('phone')
      .setQuestion('What is your phone number?')
      .setDescription('Contact phone number'),
  );

const infoStep = ctx.addStep('collect_info');
infoStep.setText('I need to collect some information from you.');
infoStep.setGatherInfo(gather);
```

### GatherQuestion Methods

| Method | Description |
|--------|-------------|
| `setQuestion(text)` | The question to ask the user. |
| `setDescription(desc)` | Description of the expected answer (for the AI). |
| `setValidation(regex)` | Regex pattern for answer validation. |

When a step has a `GatherInfo`, the AI systematically asks each question in order, validates answers against the regex patterns (if provided), and collects all responses before marking the step as complete.

---

## Context Settings

### Context-Level Prompts

Each context can have its own prompt text and system prompt:

```typescript
const support = cb.addContext('support');
support.setPrompt('You are now helping the user with a technical issue.');
support.setSystemPrompt('You are a level-2 technical support specialist.');
```

### Context Entry Behavior

When the AI switches to a new context, the context-level prompt supplements the agent's base prompt. The system prompt (if set) can override aspects of the agent's personality or role for that specific context.

---

## Isolation and Reset

### Reset on Entry

Steps can be configured to reset their state when the AI returns to them:

```typescript
const verifyStep = ctx.addStep('verify');
verifyStep.setResetOnEntry(true);
// If the user navigates back to this step, all gathered data and progress are cleared
```

This is useful for steps that should always start fresh, such as identity verification or payment collection.

---

## Fillers

Set filler phrases that the AI speaks while processing or transitioning.

### Context-Level Fillers

```typescript
const support = cb.addContext('support');
support.setFillers({
  'en-US': ['Let me look into that...', 'One moment please...'],
  'es-MX': ['Un momento por favor...', 'Dejame revisar...'],
});
```

### Step-Level Fillers

```typescript
const searchStep = ctx.addStep('search');
searchStep.setFillers({
  'en-US': ['Searching our database...', 'This may take a moment...'],
});
```

Step-level fillers override context-level fillers for that specific step.

---

## Validation

Call `validate()` on the `ContextBuilder` to check for configuration errors:

```typescript
try {
  cb.validate();
} catch (err) {
  console.error('Context configuration error:', err);
}
```

Validation rules:
- If only one context exists, it must be named `"default"`.
- Context names must be unique.
- Step names must be unique within a context.
- References in `validSteps` must point to existing steps in the same context.
- References in `validContexts` must point to existing contexts.

---

## Real-World Example

### Customer Support Workflow

```typescript
import { AgentBase, ContextBuilder, GatherInfo, GatherQuestion, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'support-agent' });
agent.setPromptText('You are a customer support agent for TechCorp.');

const cb = agent.defineContexts();

// --- Greeting Context ---
const greeting = cb.addContext('greeting');

const welcome = greeting.addStep('welcome');
welcome.setText('Welcome to TechCorp support! How can I help you today?');
welcome.setValidSteps(['identify']);
welcome.setValidContexts(['technical', 'billing']);

const identify = greeting.addStep('identify');
identify.setText('Let me verify your identity first.');
identify.setGatherInfo(
  new GatherInfo()
    .addQuestion(
      new GatherQuestion('account_number')
        .setQuestion('What is your account number?')
        .setDescription('8-digit account number')
        .setValidation('^\\d{8}$'),
    )
    .addQuestion(
      new GatherQuestion('name')
        .setQuestion('What is the name on the account?')
        .setDescription('Account holder name'),
    ),
);
identify.setCriteria('User has provided a valid account number and name.');
identify.setFunctions(['verify_account']);
identify.setValidContexts(['technical', 'billing']);

// --- Technical Support Context ---
const technical = cb.addContext('technical');
technical.setPrompt('The user needs technical assistance.');

const diagnose = technical.addStep('diagnose');
diagnose.setText('Let me help diagnose your issue.');
diagnose.addSection('Troubleshooting', {
  body: 'Follow this diagnostic flow:',
  bullets: [
    'Ask what device or service is affected',
    'Ask when the issue started',
    'Check if the user has tried restarting',
  ],
});
diagnose.setFunctions(['check_service_status', 'run_diagnostics']);
diagnose.setValidSteps(['resolve', 'escalate']);

const resolve = technical.addStep('resolve');
resolve.setText('Based on the diagnosis, apply the appropriate fix.');
resolve.setFunctions(['apply_fix', 'schedule_technician']);
resolve.setEnd(true);

const escalate = technical.addStep('escalate');
escalate.setText('I will escalate this to our engineering team.');
escalate.setFunctions(['create_ticket']);
escalate.setEnd(true);

// --- Billing Context ---
const billing = cb.addContext('billing');
billing.setPrompt('The user has a billing question.');

const reviewBill = billing.addStep('review');
reviewBill.setText('Let me pull up your billing information.');
reviewBill.setFunctions(['get_billing_summary', 'get_recent_charges']);
reviewBill.setValidSteps(['adjust']);

const adjustBill = billing.addStep('adjust');
adjustBill.setText('I can help with billing adjustments.');
adjustBill.setFunctions(['apply_credit', 'process_refund']);
adjustBill.setEnd(true);

// Define tools
agent.defineTool({
  name: 'verify_account',
  description: 'Verify a customer account by number and name',
  parameters: {
    account_number: { type: 'string', description: 'Account number' },
    name: { type: 'string', description: 'Account holder name' },
  },
  handler: async (args) => {
    const verified = await verifyAccount(
      args.account_number as string,
      args.name as string,
    );
    if (verified) {
      return new FunctionResult('Account verified successfully.')
        .updateGlobalData({ account_verified: true });
    }
    return new FunctionResult('Account verification failed. Please try again.');
  },
});

agent.defineTool({
  name: 'check_service_status',
  description: 'Check the status of a service',
  parameters: {
    service: { type: 'string', description: 'Service name' },
  },
  handler: async (args) => {
    return new FunctionResult(`Service ${args.service} is operational.`);
  },
});

agent.serve();
```

---

## Best Practices

1. **Name contexts and steps descriptively** -- Use names like `"billing_review"` instead of `"step1"`.
2. **Always set completion criteria** -- Without criteria, the AI may not know when to advance.
3. **Use function restrictions** -- Limit available tools per step to prevent the AI from calling irrelevant functions.
4. **Validate before serving** -- Call `cb.validate()` during development to catch configuration errors early.
5. **Use GatherInfo for structured collection** -- When you need specific fields from the user, GatherInfo provides better structure than freeform prompting.
6. **Set fillers for long operations** -- Filler phrases keep the conversation natural during processing.
7. **Design for re-entry** -- Use `setResetOnEntry(true)` on steps that should always start fresh.
8. **Limit context depth** -- Keep the context graph shallow; deeply nested contexts can confuse the AI.
