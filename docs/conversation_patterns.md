# Conversation Patterns

Each pattern here keeps a decision in your code that the model would otherwise make from the conversation. The helpers are exported from the package root, `@signalwire/sdk`.

## Table of Contents

- [Confirming a Change](#confirming-a-change)
- [Read-Backs Callers Can Interrupt](#read-backs-callers-can-interrupt)
- [Recording What Was Done](#recording-what-was-done)
- [Questions That Carry Content](#questions-that-carry-content)
- [The Caller's Own Words](#the-callers-own-words)
- [Numbers the Way a Voice Should Say Them](#numbers-the-way-a-voice-should-say-them)
- [Tool Outcomes the Model Can Trust](#tool-outcomes-the-model-can-trust)
- [Requests to Come Back To](#requests-to-come-back-to)
- [What a Caller Spelled](#what-a-caller-spelled)
- [Testing a Call Flow](#testing-a-call-flow)

Several of these patterns use semantic gate keys, params and actions (`dialogue`, `history`, `since`, `unclear`, `on_unclear`, `semantic_gate_dialogue`, `unavailable_function_response`, `semantic_gate_mark` and `expected_answer`) that need a platform release that has them. A release with semantic gates but without one of the gate keys refuses the whole function. See [Semantic gates](api-reference.md#semantic-gates).

## Confirming a Change

A change the caller must agree to, such as placing an order or cancelling an account, needs a yes to that change, not a yes somewhere in the call. The platform's confirm pattern does this with semantic gates:

1. A function proposes the change. It reads the change back and records it in `semantic_state`, in one action object, so the proposal's dialogue starts with the read-back.
2. The tool that carries out the change has three gates, each judged on the proposal's dialogue: the caller's latest turn is an answer, the answer is a yes, and what they answered was a read-back of this change.

`Proposal` builds both halves. The gates' questions are the platform's own, which were replayed against logged confirmation checks.

```ts
import { AgentBase, Proposal, current } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'orders', route: '/orders' });
const order = new Proposal('place_order', { declineTool: 'change_order' });

agent.defineTool({
  name: 'review_order',
  description: 'Read the order back to the caller',
  parameters: { item: { type: 'string', description: 'The item, with its size' } },
  required: ['item'],
  handler: (args, rawData) =>
    order.propose(`That's ${args.item} for pickup. Is that right?`, {
      rawData,
      details: { item: args.item },
    }),
});

agent.defineTool({
  name: 'place_order',
  description: 'Place the order the caller said yes to',
  handler: (_args, rawData) => {
    const item = String(current(rawData)?.['item']);
    return order.complete(`The order for ${item} is placed.`);
  },
  gates: order.confirmGates(),
});
```

`propose()` says the read-back word for word, records `{ proposal: readBack, revision: n }` with your details, and has the model wait for the caller's answer. `current(rawData)` reads the proposal back from a request's `global_data.semantic_state`. When a gate blocks the confirm tool, the model is told why, with the proposal quoted from `semantic_state`, and chaining is turned off for the call (`backToBackFunctions(false)`), so it answers in words before it calls a tool again. To read the same change back again, use `askAgain(rawData)`: the platform marks a new proposal only when `semantic_state` changes, so it records the next revision.

`new Proposal(confirmTool, { unclear: true, threshold: 0.6 })` lets the gates answer unclear as well, where the gate provider can, which asks the caller again. Give the confirm step only the confirm tool, the decline tool and a tool that notes other requests, so a "yes, and also..." becomes two calls.

## Read-Backs Callers Can Interrupt

A caller often answers before a read-back ends. Order it so the part they must hear comes first:

1. The change itself: "That's a large tea, not a small one."
2. The details of the change: "for pickup at five, on the card ending in one two three four."
3. What was already settled, last: "at the Main Street store."

A caller who cuts it off has heard the change. The confirm gates count a yes once the caller has heard what the change is, so a read-back that leads with it confirms sooner.

## Recording What Was Done

After the change is carried out, write a `semantic_state` that records it, rather than clearing it with `{}`. `Proposal.complete(summary)` does this. A state that changes starts the next proposal's dialogue there, so a later confirmation isn't judged on what was said before this one, and the model and the gates see what's settled.

## Questions That Carry Content

A one-word answer is hard to judge: "yes" may answer something else the agent said. Ask questions whose answers carry content. "Which size would you like, small or large?" gets "large", which a gate, the recognizer and your code can check. "Do you want a large?" gets "yes".

## The Caller's Own Words

A tool can check that an argument is something the caller said, rather than something the model inferred.

`defineTool({ ..., vouched: true })` asks the model. The tool gets a required boolean, `data_supplied_by_user`, and runs only when the model sets it to `true`. Otherwise the model is told to get the answer from the caller first.

`callerTurns(rawData)` reads what the caller said from the request's conversation. A request carries the conversation only with `swaig_post_conversation` on, and `needsConversation: true` on the tool turns it on.

```ts
import { AgentBase, FunctionResult, callerTurns } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'stores', route: '/stores' });

agent.defineTool({
  name: 'find_store',
  description: 'Find the store nearest a ZIP code',
  parameters: { zip: { type: 'string', description: "The caller's ZIP code" } },
  required: ['zip'],
  needsConversation: true,
  handler: (args, rawData) => {
    const said = callerTurns(rawData, undefined, { last: 3 }).join(' ');
    if (!said.replaceAll(' ', '').includes(args.zip)) {
      return new FunctionResult().setToolResponse(
        'find_store was not run.',
        'Ask the caller for their ZIP code.',
      );
    }
    return new FunctionResult().setToolResponse(
      `The nearest store to ${args.zip} is on Main Street.`,
    );
  },
});
```

The conversation has the recognizer's final text, after hearing hints and number formatting. For the words as the recognizer heard them, with a confidence for each, call `agent.recordSpeechFinals()` and read `agent.speechFinals(rawData.call_id)`. The finals come from the platform's `ai.speech_detect` events, which the agent receives at its own `/ai_events` endpoint. A handler can ask the caller again about a word the recognizer wasn't sure of, such as a letter of a spelled name. `agent.onAiEvent(handler)` receives every AI event the platform posts. Set both on the agent itself, not in a dynamic config callback: the `/ai_events` endpoint runs on the agent, not on a per-request copy. See [AI Event Methods](api-reference.md#ai-event-methods).

## Numbers the Way a Voice Should Say Them

The platform normalizes text before its pronunciation rules run, so a bare number is already words by then. A ZIP code given as "10001" can be read "ten thousand one", and `addPronunciation()` can't change that. Give the words to say instead:

```ts
import { sayDigits, sayLastDigits, sayMoney } from '@signalwire/sdk';

sayDigits('415-555-0192'); // "four one five, five five five, zero one nine two"
sayDigits('10001', undefined, { zero: 'oh' }); // "one oh oh oh one"
sayLastDigits('4111111111111234'); // "one two three four"
sayMoney(14.5); // "fourteen dollars and fifty cents"
```

Use them in a `say` action, or in the tool result the model reads back. They're English. `sayDigits(text, group?)` takes a group size, or a list of sizes such as `[3, 3, 4]`, in place of the text's own groups. `sayMoney(amount, currency?)` takes a number, a `bigint` or a decimal string such as `'14.50'`, and rounds half up from the amount's decimal text, so `sayMoney(2.675)` is "two dollars and sixty-eight cents". It knows USD, CAD, AUD, NZD, EUR, GBP, MXN, INR and JPY. `numberWords(n)` takes a safe integer or a `bigint` below a quadrillion: `numberWords(1405)` is "one thousand four hundred five".

When a step asks for a number with a known length, `step.setExpectedAnswer(5)` tells the recognizer to end its wait once the caller has said that many digits. See the [Contexts and Steps Guide](contexts-guide.md#expected-answers).

## Tool Outcomes the Model Can Trust

The model reads a tool's result as what happened, so the result must not claim more than the handler knows.

- Throw `new ToolRefusal(toolResult, toolPrompt)` to decline a call with an outcome you know, such as an item out of stock.
- Any other error tells the model the function failed before it finished, so whether it took effect is unknown, and not to tell the caller it worked or that it didn't. The error is logged, not sent. A tool's `onError` hook or `errorMessage` still takes its place when you give one.
- An object without a `response` or an `action` is the handler's data, and the model gets it as JSON.

SignalWire sends a tool request again after a timeout, a failed connection or a 5xx, so a slow tool could run twice. The agent answers such a retry with the first attempt's result, and one that arrives while the first is still running waits for it. `agent.setToolResendDedupe(false)` turns this off. The dedupe is the first [tool middleware](api-reference.md#addtoolmiddlewaremiddleware) around every call.

## Requests to Come Back To

A caller in the middle of one task often asks for another: "and can you also check my balance?" Taking it up at once loses the first task, and ignoring it loses the second. `RequestList` keeps such requests in the call's `global_data`. A tool notes each one, and the model tells the caller it's noted for right after this. The step text shows the list, so the agent takes the requests up when the current task is done.

```ts
import { AgentBase, RequestList } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'support', route: '/support' });
const later = new RequestList('later', {
  openers: { balance: 'You also asked about your balance.' },
});
agent.setGlobalData(later.defaults());

agent.defineTool({
  name: 'note_request',
  description: 'Note something the caller asked to do later',
  parameters: {
    kind: { type: 'string', enum: ['balance', 'question'] },
    about: { type: 'string', description: 'What the caller asked, in a few words' },
  },
  required: ['kind', 'about'],
  handler: (args, rawData) => later.note(rawData, args.kind, args.about),
});

const ctx = agent.defineContexts().addContext('default');
ctx.addStep('take_order').setText('Take the order.\n\n${global_data.later_text}');
```

`later.next(rawData)` gives the oldest request with its opener, and `later.done(rawData)` removes it once it's taken up. The kinds and their openers are yours; an opener's `{about}` is replaced by what the request is about. A step's text is expanded when the step is entered, so return `refreshStep()` with a note to show the new list at once.

## What a Caller Spelled

A caller spells a name, a code or an email address in many ways: letter by letter, with letter names, with "S as in Sam", with the NATO alphabet, or with "double l". `readSpelled`, `spokenEmail` and `spellingVariants` read them all from the recognizer's text.

```ts
import { readSpelled, spellingVariants, spokenEmail } from '@signalwire/sdk';

readSpelled('S as in Sam, m i t h'); // ['S', 'M', 'I', 'T', 'H']
readSpelled('sierra mike india tango hotel'); // ['S', 'M', 'I', 'T', 'H']
readSpelled('one two oh four', { ohIsZero: true }); // ['1', '2', '0', '4']
spokenEmail('john dot smith at example dot com'); // 'john.smith@example.com'
spellingVariants(['S', 'M', 'I', 'T', 'H'], { S: 'F', M: 'N' });
// ['SMITH', 'FMITH', 'SNITH', 'FNITH']
```

The recognizer confuses some letters, and which ones depends on the recognizer and the voice, so `spellingVariants` takes confusion groups you measure on your own calls; none are built in. A group is a string of units or a list of them, and the groups may be a plain object or a `Map`. Its `positions` option limits the changes to the letters the recognizer was least sure of, which `agent.speechFinals()` gives a confidence for, and `limit` (default 50) caps the spellings. Look each variant up in your records, in order: the first that matches is the likeliest.

## Testing a Call Flow

`swaig-test` runs one tool call. To test a flow, such as a confirmation across steps, `CallSimulator` runs the agent's tools through a simulated call. It reads the agent's rendered SWML as the platform would, and checks each call as the platform does: a tool the current step doesn't offer doesn't run, and a gated tool runs only when your gate callback lets it. Each result's actions change the call: global data and `semantic_state`, the step and context, the functions turned on, `say`, and the end of the call. A tool runs as the agent's `/swaig` route runs it: through the `onFunctionCall` hook, then the tool with its middleware and the outcome rules above.

`call()` and `replay()` are async, so await them. This runs as a script; in a test, the same calls go inside the test function.

```ts
import assert from 'node:assert/strict';
import { AgentBase, CallSimulator, Proposal } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'orders', route: '/orders' });
const order = new Proposal('place_order');

agent.defineTool({
  name: 'review_order',
  description: 'Read the order back to the caller',
  parameters: { item: { type: 'string', description: 'The item' } },
  required: ['item'],
  handler: (args, rawData) =>
    order
      .propose(`That's ${args.item}. Is that right?`, { rawData, details: { item: args.item } })
      .swmlChangeStep('confirm'),
});
agent.defineTool({
  name: 'place_order',
  description: 'Place the order the caller said yes to',
  handler: () => order.complete('The order is placed.'),
  gates: order.confirmGates(),
});
const ctx = agent.defineContexts().addContext('default');
ctx.addStep('take_order').setText('Take the order.').setFunctions(['review_order']);
ctx.addStep('confirm').setText('Confirm it.').setFunctions(['place_order']);

const sim = new CallSimulator(agent, { gates: () => true });
sim.caller('A large tea, please.');
assert.equal((await sim.call('place_order')).ran, false); // not offered until the read-back
await sim.call('review_order', { item: 'a large tea' });
sim.caller('Yes.');
assert.equal((await sim.call('place_order')).ran, true);
assert.deepEqual(sim.semanticState, { done: 'The order is placed.' });
```

The gate callback gets each gate, the simulator and the call's arguments, and returns `true`, `false`, a probability compared with the gate's threshold, or `'unclear'`, or a promise of one. A blocked call's `blockedBy` is `'step'` or the id of the gate that blocked it. Give `stubs` for DataMap tools, which run on the platform. `sim.marks` is a `Map` from each gate mark's name to its place in `sim.callLog`.

The simulator renders and runs tools on the agent itself: it doesn't make the per-request copy a dynamic config callback configures. It doesn't run a model, gather questions, or the gates' decision model.

To check changed code against real calls, record tool requests with `RequestRecorder`, which is tool middleware, and run them again with `replay()`:

<!-- snippet: no-run writes a recording file next to the snippet; illustrative -->
```ts
import { AgentBase, CallSimulator, RequestRecorder } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'orders', route: '/orders' });
const recorder = new RequestRecorder('tool_requests.jsonl');
agent.addToolMiddleware(recorder.middleware);

// Later, against changed code:
const outcomes = await new CallSimulator(agent).replay(RequestRecorder.load('tool_requests.jsonl'));
console.log(outcomes.map((o) => o.response));
```

The recorder appends each request to the file, one JSON object a line, in the order they came, and keeps the newest `limit` (default 1000) in `recorder.requests`. The requests carry what callers said, so keep a recording where you'd keep call recordings.

## Related Documentation

- [API Reference](api-reference.md#semantic-gates): semantic gates and every tool option
- [SWAIG Reference](swaig-reference.md): every `FunctionResult` action
- [Contexts and Steps Guide](contexts-guide.md): steps, their function lists and expected answers
