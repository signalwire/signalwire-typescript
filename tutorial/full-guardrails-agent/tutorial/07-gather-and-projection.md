# Lesson 7: Gather Mode and Projection

This lesson covers two techniques. **Gather mode** collects structured details one question at a time, without the model skipping, reordering or inventing answers. **Projection** puts exactly the facts a step needs into its instructions, and nothing else.

## Table of Contents

1. [Why Use Gather Mode](#why-use-gather-mode)
2. [The Booking Gather](#the-booking-gather)
3. [What Gather Mode Locks Down](#what-gather-mode-locks-down)
4. [Gathered Answers Are Still Caller Input](#gathered-answers-are-still-caller-input)
5. [Projecting Facts Per Call](#projecting-facts-per-call)
6. [Projecting Facts Into a Step](#projecting-facts-into-a-step)
7. [How Much History the Model Sees](#how-much-history-the-model-sees)

---

## Why Use Gather Mode

A step that says "get the party size, date, time and name" invites trouble. The model might ask all four at once, skip one it thinks it can infer, or fill in "tonight" because the caller mentioned dinner. Each answer would also arrive as a tool call, cluttering the history the model reasons from.

Gather mode avoids these problems. The platform presents one question at a time, and the model submits each answer with a built-in `gather_submit` tool before it sees the next question.

## The Booking Gather

This is the `collect` step from `workflow.ts`:

<!-- include: tutorial/full-guardrails-agent/workflow.ts#collect --> <!-- snippet: no-compile an excerpt of addBooking in workflow.ts -->
```typescript
// Gather mode asks one question at a time and stores the answers under
// global_data.booking_request. While it runs, the only tools are
// gather_submit and the tools each question lists.
const collect = scoped(ctx.addStep('collect'), 'Take the reservation details.', []);
collect.setGatherInfo({
  outputKey: 'booking_request',
  completionAction: 'search',
  prompt: "You're taking a reservation. Ask each question in turn, briefly.",
});
collect.addGatherQuestion({
  key: 'party_size',
  question: 'How many people will be dining?',
  type: 'integer',
  functions: LOOKUPS,
});
collect.addGatherQuestion({
  key: 'date',
  question: 'What date would you like?',
  functions: LOOKUPS,
  prompt:
    "Submit the caller's own words for the date, such as 'Friday' or " +
    "'the 26th'. Do not turn it into a calendar date yourself.",
});
collect.addGatherQuestion({
  key: 'time',
  question: 'What time would you like?',
  functions: LOOKUPS,
  prompt: "Submit the time in digits, such as '7:30 PM'.",
});
collect.addGatherQuestion({
  key: 'name',
  question: 'What name should the reservation be under?',
  confirm: true,
  functions: LOOKUPS,
});
```

Six settings do the work:

- **`outputKey`**: the answers are stored in `global_data.booking_request`, where `find_tables` reads them
- **`completionAction`**: when the last answer is in, the platform moves to the `search` step. No tool is needed and the model doesn't choose.
- **`type: 'integer'`**: the party size is submitted as a number
- **`prompt` on a question**: extra instruction for that question only. The date question tells the model to pass along the caller's own words, and code resolves them (Lesson 3).
- **`confirm: true`**: the model must read the name back and get a yes before submitting it
- **`functions`**: the only tools available *during* that question

In a live test, the model asked these four questions one at a time and read the name back ("You said Daniel Chen, is that correct?"). It then called `find_tables` on its own as soon as `search` became the active step.

## What Gather Mode Locks Down

While a question is being asked, the platform turns off every other tool on the step, and navigation too. The model can submit the answer, or use the tools that question lists. That's why each question lists the tools a caller may need partway through:

- In `collect`, every question offers `house_info` and `request_human`, so "What time do you close?" or "Can I talk to someone?" still work mid-gather
- In `take_message` (Lesson 9), each question offers `finish`, for a caller who decides not to leave a message after all

A tool listed on the step but not on the question is unavailable during the question. If a question needs a tool, list it on that question.

## Gathered Answers Are Still Caller Input

Gather mode structures the conversation, but what gets submitted is still what the caller said, typed in by the model. So `find_tables` treats it exactly like tool arguments:

- The party size is checked to be a positive number within policy
- The date is resolved and checked against the calendar, the booking window and closed days
- The time must parse and land near a real seating
- The name is cleaned and length-limited

If an answer fails a check, the refusal's `ask` tells the model what to ask again. The correction comes back as an argument to `find_tables`, which updates that one detail of the request (Lesson 6). Gather mode has already finished, so a correction never restarts it.

## Projecting Facts Per Call

Some facts depend on when the call arrives. Is anyone at the host stand right now? Penny works that out each time the platform requests its SWML, using a per-call configuration callback:

<!-- include: tutorial/full-guardrails-agent/penny.ts#project-call-facts --> <!-- snippet: no-compile a method of Penny, excerpted from penny.ts -->
```typescript
/**
 * Per call, on a per-request copy of the agent: facts the triage step may mention.
 *
 * `agent` is that copy. Changing `this` here would leak one caller's
 * values into the next caller's call.
 */
private projectCallFacts(agent: AgentBase): void {
  agent.updateGlobalData({
    host_stand: this.store.hostStandOpen() ? 'open' : 'closed',
  });
}
```

The constructor (Lesson 4) registers it with `addPerCallConfig()`, which runs a callback on every SWML request. The SDK passes the callback the request's query parameters, body and headers, and a per-request copy of the agent. Penny's callback passes only the copy to `projectCallFacts`.

The important detail is the `agent` argument. It's a per-request copy of Penny, made for this one request. Writing to `agent` affects only this call. Writing to `this` would change the shared agent that every caller uses, and one caller's values would leak into the next caller's conversation. `addPerCallConfig()` also composes: a second callback adds to the first instead of replacing it. `setDynamicConfigCallback()`, the other form, replaces every callback set before it.

## Projecting Facts Into a Step

The triage step's text includes `${global_data.host_stand}`, and the platform fills it in when the step runs. In the live test, which ran in the early afternoon, the model's instructions read "The host stand is closed right now."

The same technique carries the confirmation code into the `booked` step: `confirm_booking` writes `booking.code_spoken` and `booking.summary` (Lesson 6), and the step's text includes both. In the live test, the `booked` step's instructions began: "The reservation is confirmed: a table for 4 on Friday, October 2 at 7:30 PM, under Daniel Chen." The next sentence gave the code as "6 A Q N C K". Whatever happens to the conversation history, the step's own instructions contain the code.

A projection is a single, finished fact. It isn't the reservation record, the customer file, or everything the model might conceivably need. Every field you project is a field the model can repeat, so project what the step needs and nothing more.

## How Much History the Model Sees

Each step chooses how much of the earlier conversation the model keeps:

| Mode | Earlier instructions | Earlier dialogue |
|---|---|---|
| `keep` | Kept | Kept |
| `default` | Hidden | Kept |
| `hide` | Hidden | Hidden. Bring facts back with a projection. |

Most of Penny's steps use `default`: each step starts with fresh instructions, and the caller doesn't have to repeat themselves. One step uses `hide`, deliberately, and Lesson 8 explains why. Hidden turns disappear only from the model's view. The call log still has every word.

## Key Takeaways

- Use gather mode for structured details: one question at a time, typed, optionally confirmed
- List the tools a caller may need mid-question on the question itself
- Treat gathered answers as caller input, and accept corrections as tool arguments
- Project per-call facts onto the per-request copy, never onto `this`
- Project single, finished facts into step text, and only the ones the step needs

## Review Questions

1. Why does `find_tables` still validate the party size when gather mode typed it as an integer?
2. What would happen if `projectCallFacts` wrote to `this` instead of `agent`?
3. During the date question, why can the model call `house_info` but not `find_tables`?

## Next Steps

Projection carries facts forward from one step to the next. Next, `hide` and projection work together in the most important guardrail in Penny. Continue with [Lesson 8: The Verification Gate](08-the-verification-gate.md).

---

[Previous: Tools That Decide](06-tools-that-decide.md) | [Overview](README.md) | [Next: The Verification Gate](08-the-verification-gate.md)
