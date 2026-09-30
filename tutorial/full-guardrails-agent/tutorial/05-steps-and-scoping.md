# Lesson 5: Steps and Scoping

This lesson gives Penny's conversation its shape. `workflow.ts` turns the table from Lesson 2 into contexts and steps, and it enforces the two rules every step must follow.

## Table of Contents

1. [Contexts and Steps](#contexts-and-steps)
2. [One Helper for Every Step](#one-helper-for-every-step)
3. [Triage: Where Every Call Starts](#triage-where-every-call-starts)
4. [The Booking Steps](#the-booking-steps)
5. [The Inheritance Trap](#the-inheritance-trap)
6. [Why No Step Criteria, and No `setEnd`](#why-no-step-criteria-and-no-setend)
7. [Checking the Contract](#checking-the-contract)

---

## Contexts and Steps

A **context** is a mode of work: triage, booking, managing a reservation, taking a message. A **step** is the one task that's active inside it. Penny has four contexts:

| Context | Steps | Entered by |
|---|---|---|
| `default` | triage | The start of every call |
| `booking` | collect, search, choose, review, booked | `start_booking` |
| `manage` | verify, details, confirm_cancel, cancelled, locked | `manage_booking` |
| `help` | take_message, save_message, message_saved | `request_human` when nobody is at the host stand |

Tools are registered once, on the agent (you did that in Lesson 4). Each step then decides which of them the model can see while that step is active.

## One Helper for Every Step

Every step goes through this function, so neither rule can be forgotten:

<!-- include: tutorial/full-guardrails-agent/workflow.ts#scoped --> <!-- snippet: no-compile an excerpt of workflow.ts, which imports Step as a type only -->
```typescript
/** Give a step its task, its tools, and no way to leave on its own. */
export function scoped(step: Step, text: string, tools: string[], history = 'default'): Step {
  return step
    .setText(text)
    .setFunctions(tools)
    .setValidSteps([])
    .setValidContexts([])
    .setHistory(history);
}
```

Besides the step's text, the helper sets three things on every step:

- `setFunctions()` names the step's tools, and `[]` means none
- `setValidSteps([])` and `setValidContexts([])` give the model nowhere to go. The only way out of a step is a tool handler returning `swmlChangeStep()` or `swmlChangeContext()` after it has checked the real state.
- `setHistory()` chooses how much of the earlier conversation the model still sees. Lesson 7 explains the options.

## Triage: Where Every Call Starts

Every call starts in the `default` context, whose only step is `triage`:

<!-- include: tutorial/full-guardrails-agent/workflow.ts#triage --> <!-- snippet: no-compile a function in workflow.ts that calls scoped and LOOKUPS -->
```typescript
function addTriage(builder: ContextBuilder): void {
  const ctx = builder.addContext('default');
  scoped(
    ctx.addStep('triage'),
    "The greeting has already been played; don't repeat it. The host stand is " +
      '${global_data.host_stand} right now. As soon as the caller says what they want, ' +
      'act on it without asking again: for a new reservation call start_booking; to ' +
      'check, change or cancel one they already have, call manage_booking. Answer ' +
      'general questions with house_info. If they ask for a person, call ' +
      "request_human. If they're done, call finish.",
    ['start_booking', 'manage_booking', ...LOOKUPS, 'finish'],
  );
  ctx.setInitialStep('triage');
}
```

`start_booking` and `manage_booking` are **router tools**. They don't book or cancel anything. They move the conversation, and because they're tools, code performs the move and can reset state on the way (Lesson 6). The model can't drift into the manage context on its own.

`${global_data.host_stand}` is filled in by the platform when the step runs. It sits in an ordinary string, not a template literal, so TypeScript leaves it alone. Lesson 7 shows where the value comes from.

> **A wording fix from a live test.** The first version of this text told the model to ask whether the call was about a new reservation. The Python edition of this tutorial tested that version live. A caller opened with "I'd like to book a table", and Penny still asked "new or existing?". The wording now says to act as soon as the caller has said what they want. In this edition's live test, the same opening went straight to the first booking question.
>
> PGI doesn't make prompt wording irrelevant. It makes wording low-stakes. A clumsy instruction here costs one extra question. It can't book the wrong table, because triage has no tool that books anything.

## The Booking Steps

The `collect` step uses gather mode, which is the next lesson. Here is the chain after it:

<!-- include: tutorial/full-guardrails-agent/workflow.ts#booking-steps --> <!-- snippet: no-compile an excerpt of addBooking in workflow.ts -->
```typescript
scoped(
  ctx.addStep('search'),
  'The details are collected. Call find_tables now. Say nothing about ' +
    'availability until it returns. If the caller changes a detail, pass only ' +
    'that detail to find_tables.',
  ['find_tables', ...LOOKUPS],
);
scoped(
  ctx.addStep('choose'),
  'Offer the options from the last find_tables result by number, and nothing ' +
    'else. When the caller picks one, call hold_table with its number. If they ' +
    'want a different time, date or party size, call find_tables with only what ' +
    'changed.',
  ['hold_table', 'find_tables', ...LOOKUPS],
);
scoped(
  ctx.addStep('review'),
  'A table is on hold. Read the proposal back as the last tool result gave it ' +
    'and ask the caller to confirm. Only if they clearly say yes, call ' +
    "confirm_booking with the proposal's revision number. If they want a change, " +
    'call find_tables with only what changed.',
  ['confirm_booking', 'find_tables', ...LOOKUPS],
);
scoped(
  ctx.addStep('booked'),
  'The reservation is confirmed: ${global_data.booking.summary}. The ' +
    'confirmation code is ${global_data.booking.code_spoken}. Make sure the caller ' +
    'has the code, offer to text the details with send_confirmation_text, and ' +
    "answer last questions with house_info. When they're done, call finish.",
  ['send_confirmation_text', 'house_info', 'finish'],
);
ctx.setInitialStep('collect');
```

Read the tools on each step against the design table from Lesson 2:

- `search` can only look up availability. It can't hold anything.
- `choose` can hold one of the options the search offered.
- `review` is the **only** step with `confirm_booking`, and it's only reached after `hold_table` has created a proposal.
- `booked` has no booking tools at all, so a confused model can't book twice.

Every step has at most five tools. The model chooses more reliably from a short, specific list.

`setInitialStep('collect')` names the entry step. The step is also listed first, and each context is built the same way, so the entry point is unambiguous however the context is entered.

## The Inheritance Trap

Tool inheritance is a common bug in multi-step agents, so it gets its own test:

<!-- include: tests/tutorial/penny-workflow.test.ts#test-trap --> <!-- snippet: no-compile an excerpt of penny-workflow.test.ts, which vitest runs -->
```typescript
it('treats leaving out tools differently from no tools', () => {
  expect(new Step('omitted').setText('Ask.').toDict()).not.toHaveProperty('functions');
  expect(new Step('empty').setText('Ask.').setFunctions([]).toDict().functions).toEqual([]);
});
```

A step with no `functions` key doesn't mean "no tools". It means "keep whatever the last step had". If `booked` left out its list, the model could still call `confirm_booking` from `review`. The `scoped` helper makes the mistake impossible: every step gets an explicit list, even when it's `[]`.

## Why No Step Criteria, and No `setEnd`

Penny deliberately doesn't use two methods from the contexts API:

- **`setStepCriteria()`** tells the model when a step is done, so the model can decide to move on. Penny's model never decides to move on. Code moves it, after checking. Criteria would be guidance on a decision the model doesn't make.
- **`setEnd(true)`** leaves step mode after the step. It does **not** hang up. It would leave the model outside step mode, with no step limiting its tools, which is the opposite of a locked-down ending. Penny's final steps keep explicit, short tool lists, and `finish` hangs up with a real action (Lesson 9).

## Checking the Contract

The tests fetch the SWML over HTTP from the app Penny serves, as SignalWire does. They check the design there, rather than in the TypeScript that built it. Two checks do most of the work. Each throws on the first step that breaks the contract. A test can also feed it a broken workflow and expect it to throw (Lesson 10):

<!-- include: tests/tutorial/penny-workflow.test.ts#checks --> <!-- snippet: no-compile an excerpt of penny-workflow.test.ts, which vitest runs -->
```typescript
/** Throws unless every step names its tools and gives the model nowhere to go. */
function checkScoping(steps: Steps): void {
  for (const [where, step] of Object.entries(steps)) {
    if (!Array.isArray(step.functions)) {
      throw new Error(`${where} names no tools, so it inherits the last step's`);
    }
    if (JSON.stringify([step.valid_steps, step.valid_contexts]) !== '[[],[]]') {
      throw new Error(`${where} lets the model navigate`);
    }
    if (step.end !== undefined) throw new Error(`${where} ends step mode`);
  }
}

/** Each consequential tool, and the one step that may offer it. */
const HOMES: Record<string, string> = {
  hold_table: 'booking/choose',
  confirm_booking: 'booking/review',
  send_confirmation_text: 'booking/booked',
  verify_reservation: 'manage/verify',
  request_cancel: 'manage/details',
  confirm_cancel: 'manage/confirm_cancel',
  save_message: 'help/save_message',
};

/** Throws unless each consequential tool lives in exactly one step. */
function checkHomes(steps: Steps): void {
  for (const [tool, home] of Object.entries(HOMES)) {
    const where = Object.keys(steps).filter((w) => steps[w]!.functions?.includes(tool));
    if (JSON.stringify(where) !== JSON.stringify([home])) {
      throw new Error(`${tool} is offered in ${where.join(', ')}, not only ${home}`);
    }
  }
}
```

Three tests run the checks against the steps Penny serves, keyed `context/step`:

<!-- include: tests/tutorial/penny-workflow.test.ts#test-scoping --> <!-- snippet: no-compile an excerpt of penny-workflow.test.ts, which vitest runs -->
```typescript
it('every step names its tools and cannot navigate', () => {
  expect(Object.keys(steps)).toHaveLength(14);
  expect(() => checkScoping(steps)).not.toThrow();
});

it('every tool a step names is registered', () => {
  const registered = (ai['SWAIG'] as { functions: Json[] }).functions.map((f) => f['function']);
  for (const step of Object.values(steps)) {
    const gathered = (step.gather_info?.questions ?? []).flatMap((q) => q.functions ?? []);
    for (const tool of [...step.functions!, ...gathered]) expect(registered).toContain(tool);
  }
});

it('consequential tools live in exactly one step', () => {
  expect(() => checkHomes(steps)).not.toThrow();
});
```

The third test is the tool-scoping contract in one line per tool: each consequential tool lives in exactly one step. Add `confirm_booking` to `choose` by mistake and it fails.

You can look at the rendered steps yourself:

```bash
npx tsx src/cli/swaig-test.ts tutorial/full-guardrails-agent/penny.ts --dump-swml
```

Find the `contexts` object inside the `ai` verb's `prompt`. Every step has a `functions` list and empty `valid_steps` and `valid_contexts`.

## Key Takeaways

- Register tools once, then expose a few per step
- Give the model nowhere to navigate. Tool handlers move the conversation after checking.
- An omitted tool list inherits the last one. Write `[]`, and let a helper enforce it.
- Test the SWML the agent serves, not the builder code

## Review Questions

1. What would the model be able to do if the `booked` step had no `functions` key?
2. Why are `start_booking` and `manage_booking` tools instead of allowed context changes?
3. What's the difference between `setEnd(true)` and hanging up?

## Next Steps

The steps decide what the model can ask for. Next, write the handlers that decide what actually happens. Continue with [Lesson 6: Tools That Decide](06-tools-that-decide.md).

---

[Previous: The Agent Shell](04-the-shell.md) | [Overview](README.md) | [Next: Tools That Decide](06-tools-that-decide.md)
