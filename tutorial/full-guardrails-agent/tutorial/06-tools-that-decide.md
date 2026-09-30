# Lesson 6: Tools That Decide

The steps decide what the model can ask for. The handlers in `handlers.ts` decide what actually happens. Each one asks the reservation book to do something, then reports back to two different audiences.

## Table of Contents

1. [Tool Descriptions Are Prompts](#tool-descriptions-are-prompts)
2. [Two Audiences: the Model and the Platform](#two-audiences-the-model-and-the-platform)
3. [A Guard Around Every Handler](#a-guard-around-every-handler)
4. [Router Tools](#router-tools)
5. [Finding, Holding and Confirming](#finding-holding-and-confirming)
6. [The Rules for `global_data`](#the-rules-for-global_data)
7. [Try It: a Booking From the Command Line](#try-it-a-booking-from-the-command-line)

---

## Tool Descriptions Are Prompts

Every tool is registered once, in `registerTools` in `penny.ts`:

<!-- include: tutorial/full-guardrails-agent/penny.ts#tools --> <!-- snippet: no-compile a method of Penny, excerpted from penny.ts -->
```typescript
/** Every tool the agent has. Which ones the model sees is decided per step. */
private registerTools(h: PennyHandlers): void {
  const revision = {
    type: 'integer',
    minimum: 1,
    description: 'The revision number from the proposal the caller agreed to.',
  };
  const checking = { 'en-US': ['Let me check the book.', 'One moment while I look.'] };

  this.defineTool({
    name: 'start_booking',
    description: 'Start taking a new reservation.',
    handler: h.startBooking,
  });
  this.defineTool({
    name: 'manage_booking',
    description:
      "Start looking up the caller's existing reservation. It does not " +
      'reveal anything until the caller verifies it.',
    handler: h.manageBooking,
  });
  this.defineTool({
    name: 'house_info',
    description: 'Look up a fact about the restaurant.',
    parameters: { topic: { type: 'string', enum: Object.keys(HOUSE_FACTS).sort() } },
    required: ['topic'],
    handler: h.houseInfo,
  });
  this.defineTool({
    name: 'find_tables',
    description:
      'Check which seatings are free, using the details the caller already gave. ' +
      'Pass only a detail the caller has changed. Holds and books nothing.',
    parameters: {
      party_size: {
        type: 'integer',
        minimum: 1,
        maximum: 20,
        description: 'Only if the caller changed the party size.',
      },
      date: {
        type: 'string',
        description: "Only if the caller changed the date, in their own words, e.g. 'Saturday'.",
      },
      time: {
        type: 'string',
        description: "Only if the caller changed the time, e.g. '8:00 PM'.",
      },
      name: { type: 'string', description: 'Only if the caller changed the name.' },
    },
    fillers: checking,
    handler: h.findTables,
  });
  this.defineTool({
    name: 'hold_table',
    description: 'Hold the option the caller picked for five minutes. Does not book it.',
    parameters: {
      option: {
        type: 'integer',
        minimum: 1,
        maximum: 3,
        description: 'The option number the caller chose.',
      },
    },
    required: ['option'],
    handler: h.holdTable,
  });
  this.defineTool({
    name: 'confirm_booking',
    description:
      'Book the table on hold, only after the caller agreed to the proposal you read back.',
    parameters: { revision },
    required: ['revision'],
    fillers: checking,
    handler: h.confirmBooking,
  });
  this.defineTool({
    name: 'send_confirmation_text',
    description: 'Text the confirmed reservation to the number this call comes from.',
    handler: h.sendConfirmationText,
  });
  this.defineTool({
    name: 'verify_reservation',
    description: 'Check a confirmation code and last name. Only a match unlocks the reservation.',
    parameters: {
      confirmation_code: {
        type: 'string',
        description: 'The six characters the caller read out.',
      },
      last_name: { type: 'string', description: "The caller's last name." },
    },
    required: ['confirmation_code', 'last_name'],
    fillers: checking,
    handler: h.verifyReservation,
  });
  this.defineTool({
    name: 'request_cancel',
    description: 'Prepare to cancel the verified reservation. Cancels nothing yet.',
    handler: h.requestCancel,
  });
  this.defineTool({
    name: 'confirm_cancel',
    description:
      'Cancel the verified reservation, only after the caller said yes to ' +
      'the cancellation you read back.',
    parameters: { revision },
    required: ['revision'],
    handler: h.confirmCancel,
  });
  this.defineTool({
    name: 'keep_reservation',
    description: 'Abandon the cancellation and keep the reservation.',
    handler: h.keepReservation,
  });
  this.defineTool({
    name: 'request_human',
    description:
      'Connect the caller with a person at the host stand, or take a message ' +
      'if nobody is there.',
    handler: h.requestHuman,
  });
  this.defineTool({
    name: 'save_message',
    description:
      'Save the message just taken for the host stand. Pass a detail only to correct it.',
    parameters: {
      name: { type: 'string' },
      callback: { type: 'string' },
      body: { type: 'string' },
    },
    handler: h.saveMessage,
  });
  this.defineTool({
    name: 'finish',
    description: 'Say goodbye and end the call.',
    handler: h.finish,
  });
}
```

Each `defineTool()` call names the tool the model sees, in snake case, and the handler that runs it. `parameters` holds each argument's JSON Schema, and `required` lists the ones the model must pass.

The platform sends each tool's description and parameters to the model on every turn. That makes them prompt text, and three habits keep them accurate:

- **Say what the tool doesn't do.** `find_tables` "holds and books nothing". `hold_table` "does not book it". `request_cancel` "cancels nothing yet". A model that knows a tool is harmless won't hesitate to use it, and won't mistake it for the final step.
- **Constrain arguments in the schema.** `house_info` takes a `topic` from a fixed `enum`, and `hold_table` takes an option from 1 to 3.
- **Cover the wait with fillers.** `find_tables`, `confirm_booking` and `verify_reservation` have short phrases the platform can say while the handler works, so the caller doesn't hear silence.

A schema limit helps the model ask correctly. It is not a check. Every handler validates its arguments again, because schemas are guidance too.

## Two Audiences: the Model and the Platform

A `FunctionResult` reaches two audiences, the model and the platform, through three parts:

| Part | Audience | Penny uses it for |
|---|---|---|
| `tool_result` | The model | What is true: "On hold for five minutes: a table for 4 on Friday, October 2 at 7:30 PM..." |
| `tool_prompt` | The model | What to do now: "Read the proposal back and ask the caller to confirm it." |
| Actions | The platform | What happens regardless of what the model says: change step, update session data, send UI events, say, transfer, hang up |

Penny passes the first two to the constructor as one object, `new FunctionResult({ tool_result, tool_prompt })`, and chains the actions after it. Keeping the parts separate matters. If the facts and the instructions share one string, the model may read the instructions aloud, or treat the facts as a suggestion. Actions don't rely on the model at all: when `confirm_booking` returns `swmlChangeStep('booked')`, the conversation moves whether or not the model mentions it.

## A Guard Around Every Handler

Every handler is wrapped in `guarded`:

<!-- include: tutorial/full-guardrails-agent/handlers.ts#guarded --> <!-- snippet: no-compile an excerpt of handlers.ts that uses its own types and log -->
```typescript
/** Turn refusals into facts for the model, and never let a crash sound like success. */
export function guarded(name: string, handler: Handler): Handler {
  return (args, rawData) => {
    try {
      if (!isObject(args) || !isObject(rawData)) {
        throw new PolicyError('The request was malformed.', 'Ask the caller to say that again.');
      }
      return handler(args, rawData);
    } catch (err) {
      if (err instanceof PolicyError) {
        return new FunctionResult({ tool_result: err.fact, tool_prompt: err.ask });
      }
      if (err instanceof MissingCallContext) {
        return new FunctionResult({
          tool_result: 'Nothing was done: the request had no call context.',
          tool_prompt: 'Apologize and offer to take a message.',
        });
      }
      log.error(`tool ${name} failed: ${err instanceof Error ? err.stack : String(err)}`);
      return new FunctionResult({
        tool_result: "The system couldn't finish that, so the outcome is unknown.",
        tool_prompt: "Don't say it worked. Apologize and offer to try again.",
      });
    }
  };
}
```

It enforces three failure rules:

- **A refusal is a fact, not an error.** A `PolicyError` from the reservation book becomes `tool_result` and `tool_prompt`, with no actions attached.
- **No call context, no action.** A request without a `call_id` can't be tied to a session, so nothing happens.
- **A crash is never success.** Anything unexpected becomes "the outcome is unknown", with the instruction "Don't say it worked." The worst failure for a booking system is an agent telling the caller "you're all set" when nothing was saved.

The SDK catches a handler that throws, too, and answers with a generic apology. `guarded` replaces that with words written for this agent, and logs the stack under the tool's name.

TypeScript has no decorators on plain functions, so `guarded` is a function that takes a handler and returns a guarded one. Each handler is a class field built with it, such as `readonly findTables = guarded('find_tables', ...)`. An arrow function in a class field keeps `this`, so `registerTools` can pass `h.findTables` to `defineTool()` as it is.

## Router Tools

`start_booking` is the router tool for a new reservation:

<!-- include: tutorial/full-guardrails-agent/handlers.ts#start-booking --> <!-- snippet: no-compile a class field of PennyHandlers, excerpted from handlers.ts -->
```typescript
readonly startBooking = guarded('start_booking', (_args, rawData) => {
  this.store.resetRequest(callIdOf(rawData));
  return new FunctionResult({
    tool_result: 'A new reservation has been started.',
    tool_prompt: "Tell the caller you'll take a few details.",
  })
    .updateGlobalData({ booking: {}, booking_request: {} })
    .swmlChangeContext('booking');
});
```

A router tool moves the conversation and resets what the next context depends on. Here, `resetRequest` clears the call's draft, offers and holds in the reservation book. The `updateGlobalData()` action clears the booking projection and the gathered answers, so a new booking starts clean.

## Finding, Holding and Confirming

`find_tables` applies any correction to the call's booking request, then asks the reservation book for numbered options:

<!-- include: tutorial/full-guardrails-agent/handlers.ts#find-tables --> <!-- snippet: no-compile a class field of PennyHandlers, excerpted from handlers.ts -->
```typescript
readonly findTables = guarded('find_tables', (args, rawData) => {
  const callId = callIdOf(rawData);
  // What the caller has asked for: gather's answers, changed by every
  // correction since. A correction passed as an argument changes only
  // that detail, even if the last search was refused.
  const draft = this.store.updateDraft(callId, args, gathered(rawData, 'booking_request'));
  let request, options;
  try {
    [request, options] = this.store.findOptions(
      callId,
      draft.party_size,
      draft.date,
      draft.time,
      draft.name,
    );
  } catch (err) {
    if (!(err instanceof LargePartyError)) throw err;
    return new FunctionResult({ tool_result: err.fact, tool_prompt: err.ask });
  }

  let result: FunctionResult;
  if (options.length > 0) {
    const listed = options.map((option) => option.spoken()).join('; ');
    result = new FunctionResult({
      tool_result: `Open for ${request.partySize} on ${spokenDate(request.day)}: ${listed}.`,
      tool_prompt:
        'Offer these options by number. When the caller picks one, ' +
        'call hold_table with its number.',
    });
  } else {
    result = new FunctionResult({
      tool_result:
        `Nothing is open for ${request.partySize} on ${spokenDate(request.day)} ` +
        `within an hour of ${spokenTime(request.start)}. Seatings run 5 PM to 8:30 PM.`,
      tool_prompt:
        'Say so, and ask whether another time or date would work. ' +
        'Then call find_tables with only what changed.',
    });
  }
  return result
    .updateGlobalData({ booking: { request: request.spoken() } })
    .swmlChangeStep('choose')
    .swmlUserEvent({
      type: 'options_offered',
      day: request.day,
      options: options.map((o) => ({ number: o.number, time: spokenTime(o.start) })),
    });
});
```

Three details matter:

- **A correction changes one detail.** If the caller says "actually, make it 8", the model passes only `time`. Everything else stays as the caller last gave it, even after a refused search.
- **The large-party refusal carries no step change.** The model stays put and offers a person, which is the refusal's `ask`.
- **The model sees option numbers and times, never tables.** The UI event carries the same.

The reservation book keeps the request as a draft for each call:

<!-- include: tutorial/full-guardrails-agent/reservations.ts#update-draft --> <!-- snippet: no-compile a method of ReservationStore, excerpted from reservations.ts -->
```typescript
/**
 * Apply a correction to what this call has asked for, and return the result.
 *
 * The draft is kept whether or not a search passes the rules, so a correction
 * to a refused search isn't lost. The first search starts from `gathered`.
 */
updateDraft(
  callId: string,
  changes: Record<string, unknown>,
  gathered: Record<string, unknown>,
): Draft {
  return this.tx((db) => {
    let draft = JSON.parse(this.session(db, callId).draft) as Draft;
    if (Object.keys(draft).length === 0) {
      draft = Object.fromEntries(DRAFT_KEYS.map((key) => [key, gathered[key] ?? null])) as Draft;
    }
    for (const key of DRAFT_KEYS) {
      if (!isBlank(changes[key])) draft[key] = changes[key];
    }
    db.prepare('UPDATE sessions SET draft=? WHERE call_id=?').run(JSON.stringify(draft), callId);
    return draft;
  });
}
```

The first search starts from the gathered answers, and each correction updates the draft. The draft is saved before the search checks the rules, so a refused search doesn't lose the correction. Suppose gather collected a party of eight for Monday. The caller changes it to four, hears that the restaurant is closed on Mondays, and says "Friday, then". The next search is for four on Friday, not eight.

`hold_table` turns an option into a numbered proposal:

<!-- include: tutorial/full-guardrails-agent/handlers.ts#hold-table --> <!-- snippet: no-compile a class field of PennyHandlers, excerpted from handlers.ts -->
```typescript
readonly holdTable = guarded('hold_table', (args, rawData) => {
  const callId = callIdOf(rawData);
  const proposal = this.store.holdOption(callId, args['option']);
  return new FunctionResult({
    tool_result:
      `On hold for five minutes: ${proposal.spoken()}. ` +
      `This is proposal revision ${proposal.revision}.`,
    tool_prompt:
      'Read the proposal back and ask the caller to confirm it. ' +
      `If they clearly say yes, call confirm_booking with revision ${proposal.revision}. ` +
      'If they want a change, call find_tables with only what changed.',
  })
    .updateGlobalData({
      booking: { proposal: proposal.spoken(), revision: proposal.revision },
    })
    .swmlChangeStep('review')
    .swmlUserEvent({
      type: 'table_held',
      revision: proposal.revision,
      day: proposal.day,
      time: spokenTime(proposal.start),
      party_size: proposal.partySize,
    });
});
```

The revision number goes to the model in both `tool_result` and `tool_prompt`, so it has the exact number to pass to `confirm_booking`.

`confirm_booking` commits the proposal:

<!-- include: tutorial/full-guardrails-agent/handlers.ts#confirm-booking --> <!-- snippet: no-compile a class field of PennyHandlers, excerpted from handlers.ts -->
```typescript
readonly confirmBooking = guarded('confirm_booking', (args, rawData) => {
  const callId = callIdOf(rawData);
  const booking = this.store.confirm(callId, args['revision']);
  const code = spokenCode(booking.code);
  return new FunctionResult({
    tool_result: `Confirmed: ${booking.spoken()}. Confirmation code: ${code}.`,
    tool_prompt:
      "Tell the caller it's booked and read the confirmation code " +
      'slowly, one character at a time. Then offer to text the details.',
  })
    .updateGlobalData({ booking: { summary: booking.spoken(), code_spoken: code } })
    .swmlChangeStep('booked')
    .swmlUserEvent({
      type: 'booking_confirmed',
      code: booking.code,
      day: booking.day,
      time: spokenTime(booking.start),
      party_size: booking.partySize,
    });
});
```

The confirmation code comes from the reservation book. Code spells it out ("K 7 Q P 4 M") so the voice reads one character at a time. The code is also projected into the `booked` step's text, so it's still there after the conversation moves on.

## The Rules for `global_data`

Penny's handlers follow four rules for session data:

1. **It's a projection, not the truth.** The reservation book holds the truth. `global_data` holds the few finished facts a step's text needs, like the booking summary and the spoken code.
2. **Write whole namespaces.** `updateGlobalData()` merges keys at the top level. Each handler writes its whole `booking` or `manage` object, never a piece of one, so the value is always complete and self-consistent.
3. **Gathered answers are caller input.** What gather mode stores is what the caller said, and it's validated like any other input.
4. **Don't rely on another tool's write in the same turn.** Two tools called in one turn start from the same snapshot, so a handler can't see what another tool wrote in that turn.

UI events are another projection, for a screen instead of the model. Penny emits `options_offered`, `table_held`, `booking_confirmed`, `reservation_verified`, `reservation_cancelled` and `message_taken`. A web page can react to them without parsing speech.

## Try It: a Booking From the Command Line

`swaig-test` runs a tool handler directly, with no call. Because Penny keeps its state in the reservation book, keyed by call ID, you can walk through a whole booking in separate commands. Keep the variables from Lesson 4 exported, and put this walkthrough's book in its own file:

```bash
export PENNY_DB_PATH=tutorial/full-guardrails-agent/walkthrough.sqlite3
npx tsx src/cli/swaig-test.ts tutorial/full-guardrails-agent/penny.ts --call-id demo-1 --exec find_tables --party_size 4 --date Friday --time "7:30 PM" --name "Maria Rivera"
npx tsx src/cli/swaig-test.ts tutorial/full-guardrails-agent/penny.ts --call-id demo-1 --exec hold_table --option 1
npx tsx src/cli/swaig-test.ts tutorial/full-guardrails-agent/penny.ts --call-id demo-1 --exec confirm_booking --revision 1
```

Each command prints the response, then the actions. These are the three responses. Your dates will follow your calendar, and your confirmation code will differ:

```text
Response: {"tool_result":"Open for 4 on Friday, October 2: option 1, 7:30 PM; option 2, 7 PM; option 3, 8 PM.","tool_prompt":"Offer these options by number. When the caller picks one, call hold_table with its number."}
Response: {"tool_result":"On hold for five minutes: a table for 4 on Friday, October 2 at 7:30 PM, under Maria Rivera. This is proposal revision 1.","tool_prompt":"Read the proposal back and ask the caller to confirm it. If they clearly say yes, call confirm_booking with revision 1. If they want a change, call find_tables with only what changed."}
Response: {"tool_result":"Confirmed: a table for 4 on Friday, October 2 at 7:30 PM, under Maria Rivera. Confirmation code: Q V C A 4 R.","tool_prompt":"Tell the caller it's booked and read the confirmation code slowly, one character at a time. Then offer to text the details."}
```

Now try the things a confused model might do:

```bash
# Confirm again: the same booking comes back, and no second one is made
npx tsx src/cli/swaig-test.ts tutorial/full-guardrails-agent/penny.ts --call-id demo-1 --exec confirm_booking --revision 1
# Confirm from a different call: that call holds nothing
npx tsx src/cli/swaig-test.ts tutorial/full-guardrails-agent/penny.ts --call-id demo-2 --exec confirm_booking --revision 1
```

The first repeats the confirmation with the same code. The second gets a refusal and no actions:

```text
Response: {"tool_result":"No table is on hold.","tool_prompt":"Check availability again."}
```

A call can only confirm its own proposal.

## Key Takeaways

- Tool descriptions are prompts: say what each tool does *not* do
- Keep facts (`tool_result`), instructions (`tool_prompt`) and actions separate
- Guard every handler: refusals are facts, and failures are never success
- `global_data` is a projection. The reservation book is the truth.

## Review Questions

1. Why does `confirm_booking` change the step with an action instead of telling the model to move on?
2. What does the caller hear if the database is down when they confirm?
3. Why does `find_tables` let arguments override the gathered answers?

## Next Steps

The `search` step expects gathered answers to be waiting. Next, build the step that gathers them, and see how facts reach the model's instructions. Continue with [Lesson 7: Gather Mode and Projection](07-gather-and-projection.md).

---

[Previous: Steps and Scoping](05-steps-and-scoping.md) | [Overview](README.md) | [Next: Gather Mode and Projection](07-gather-and-projection.md)
