# FunctionResult Reference

This page is the API reference for the `FunctionResult` class in the SignalWire AI Agents TypeScript SDK. `FunctionResult` is what a SWAIG tool handler returns.

The examples on this page assume this import and agent:

<!-- snippet-setup -->
```ts
import { AgentBase, FunctionResult } from '@signalwire/sdk';

const agent = new AgentBase({ name: 'support-agent' });
```

---

## Table of Contents

The reference groups the methods by what they do:

- [Overview](#overview)
  - [Basic usage](#basic-usage)
  - [Writing the response](#writing-the-response)
  - [Returning a result from a handler](#returning-a-result-from-a-handler)
  - [How serialization works](#how-serialization-works)
  - [Properties](#properties)
- [Core Methods](#core-methods)
  - [constructor](#constructor)
  - [setResponse](#setresponse)
  - [setToolResponse](#settoolresponse)
  - [setPostProcess](#setpostprocess)
  - [addAction](#addaction)
  - [addActions](#addactions)
  - [toDict](#todict)
  - [toJSON](#tojson)
- [Call Control](#call-control)
  - [connect](#connect)
  - [swmlTransfer](#swmltransfer)
  - [hangup](#hangup)
  - [hold](#hold)
  - [waitForUser](#waitforuser)
  - [stop](#stop)
- [Audio](#audio)
  - [say](#say)
  - [playBackgroundFile](#playbackgroundfile)
  - [stopBackgroundFile](#stopbackgroundfile)
  - [changeVoice](#changevoice)
- [Speech](#speech)
  - [addDynamicHints](#adddynamichints)
  - [clearDynamicHints](#cleardynamichints)
  - [setEndOfSpeechTimeout](#setendofspeechtimeout)
  - [setSpeechEventTimeout](#setspeecheventtimeout)
- [Data Management](#data-management)
  - [updateGlobalData](#updateglobaldata)
  - [removeGlobalData](#removeglobaldata)
  - [setSemanticState](#setsemanticstate)
  - [setMetadata](#setmetadata)
  - [removeMetadata](#removemetadata)
- [SWML Actions](#swml-actions)
  - [executeSwml](#executeswml)
  - [switchContext](#switchcontext)
  - [swmlChangeStep](#swmlchangestep)
  - [swmlChangeContext](#swmlchangecontext)
  - [swmlUserEvent](#swmluserevent)
- [Function Control](#function-control)
  - [toggleFunctions](#togglefunctions)
  - [enableFunctionsOnTimeout](#enablefunctionsontimeout)
  - [updateSettings](#updatesettings)
- [User Input and History](#user-input-and-history)
  - [simulateUserInput](#simulateuserinput)
  - [enableExtensiveData](#enableextensivedata)
  - [replaceInHistory](#replaceinhistory)
- [Communication](#communication)
  - [sendSms](#sendsms)
  - [recordCall](#recordcall)
  - [stopRecordCall](#stoprecordcall)
  - [tap](#tap)
  - [stopTap](#stoptap)
- [Rooms and Conferencing](#rooms-and-conferencing)
  - [joinRoom](#joinroom)
  - [sipRefer](#siprefer)
  - [joinConference](#joinconference)
- [RPC](#rpc)
  - [executeRpc](#executerpc)
  - [rpcDial](#rpcdial)
  - [rpcAiMessage](#rpcaimessage)
  - [rpcAiGlobalData](#rpcaiglobaldata)
  - [rpcAiUnhold](#rpcaiunhold)
- [Payments](#payments)
  - [pay](#pay)
  - [createPaymentPrompt (static)](#createpaymentprompt-static)
  - [createPaymentAction (static)](#createpaymentaction-static)
  - [createPaymentParameter (static)](#createpaymentparameter-static)
  - [Full payment example](#full-payment-example)
- [Fluent Chaining](#fluent-chaining)

---

## Overview

`FunctionResult` is the return type for SWAIG tool handlers. It carries two things back to SignalWire:

1. **Response**: context for the model. The model reads it and decides what to say next. It isn't played to the caller.
2. **Actions**: an ordered list of structured commands (hangup, connect, send SMS and others) that the platform carries out.

A handler builds a `FunctionResult`, adds any actions, and returns it. The SDK serializes it with `toDict()` and sends it to SignalWire as the response to the `/swaig` request.

### Basic usage

This tool records a transfer reason and connects the caller to a support line:

```typescript
agent.defineTool({
  name: 'transfer_to_support',
  description: 'Transfer the caller to a human support agent',
  parameters: {},
  handler: () => {
    return new FunctionResult('Tell the caller you are connecting them to support.', true)
      .connect('+15551234567');
  },
});
```

The second constructor argument turns on post-processing, so the model gets one more turn to tell the caller before the transfer runs.

### Writing the response

The response is context for the model, not a script. The model reads it, then decides what to say. It can hold facts, an instruction, or both.

The clearest form keeps facts and instruction apart. Pass them as the constructor's `toolResult` and `toolPrompt`, or with [setToolResponse](#settoolresponse), and the SDK sends `{ tool_result, tool_prompt }`:

```typescript
const structured = new FunctionResult(
  undefined,
  false,
  'Order 1234 shipped Tuesday.',
  'Tell the caller when their order shipped.',
);
```

A plain string works too, as facts or as an instruction:

```typescript
const facts = new FunctionResult('Order 1234 shipped Tuesday.');
const instruction = new FunctionResult('Tell the caller their order shipped Tuesday.');
```

Avoid a line written for the caller, such as `'Your order shipped Tuesday.'`. The model tends to repeat it, but it interprets the line rather than speaking it, so the wording can drift or merge with other context. To speak exact words, use [say](#say).

### Returning a result from a handler

A tool handler receives `(args, rawData, agent)`. `args` holds the parsed arguments, and `rawData` is the full SWAIG request body. `agent` is the agent the request was configured on: the per-request copy when a dynamic config callback or `addPerCallConfig()` is in use.

The SDK handles these return values:

- A `FunctionResult`, or a promise that resolves to one: serialized with `toDict()`.
- A plain object with a `response` key: sent as it is.
- A plain object without a `response` key: replaced by `{ response: "Function completed successfully" }`.
- Any other value, such as a string: converted to a string and sent as the response, with a logged warning.

If the handler throws, the SDK logs the error. It then returns the result of the tool's `onError` hook, or of the agent's `onError()` handler, when either returns a `FunctionResult`. Otherwise it returns the tool's `errorMessage`, or a default apology message.

Tools registered with `defineTool()` are secure by default. The SWML the agent renders gives each secure tool a per-call token (`__token`). The agent runs the handler only when a `/swaig` request carries a valid token for that function and call. Otherwise it returns a refusal response. Set `swaigSecret` or `SIGNALWIRE_SWAIG_SECRET` so tokens survive a restart and work across replicas. For details, see [Secure Tools (HMAC Tokens)](security.md#secure-tools-hmac-tokens).

### How serialization works

When the handler returns, the SDK calls `toDict()` to produce a plain object:

```typescript
const result = new FunctionResult('Order 1234 is cancelled.').hangup();
console.log(result.toDict());
// { response: 'Order 1234 is cancelled.', action: [ { hangup: true } ] }
```

If the response is empty and there are no actions, `toDict()` returns `{ response: "Action completed." }`, so the model always receives a response.

### Properties

The class has three public properties:

| Property      | Type                        | Description                                                  |
|---------------|-----------------------------|--------------------------------------------------------------|
| `response`    | `string`                    | The string response. Empty when the structured form is set.  |
| `action`      | `Record<string, unknown>[]` | Ordered list of action objects.                              |
| `postProcess` | `boolean`                   | When `true`, the model takes one more turn before the actions run. |

## Core Methods

### constructor

Create a new `FunctionResult`.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
constructor(
  response?: string | { tool_result?: string; tool_prompt?: string },
  postProcess?: boolean,
  toolResult?: string,
  toolPrompt?: string,
)
```

| Parameter     | Type                                                | Default | Description                                                  |
|---------------|-----------------------------------------------------|---------|--------------------------------------------------------------|
| `response`    | `string \| { tool_result?: string; tool_prompt?: string }` | `''` | The response: a string, or the structured form.     |
| `postProcess` | `boolean`                                           | `false` | Whether the model takes one more turn before the actions run. |
| `toolResult`  | `string`                                            | none    | Sets `tool_result`, as [setToolResponse](#settoolresponse) does. |
| `toolPrompt`  | `string`                                            | none    | Sets `tool_prompt`, as [setToolResponse](#settoolresponse) does. |

When `toolResult` or `toolPrompt` is given, the structured form replaces a string `response`.

**Returns:** A new `FunctionResult` instance.

**Example:**

```typescript
// Empty result (serializes as "Action completed.")
const r1 = new FunctionResult();

// Facts as a string
const r2 = new FunctionResult('Order 1234 was placed.');

// Post-processing on, so the model speaks before the actions run
const r3 = new FunctionResult('Tell the caller the payment is being processed.', true);

// Structured form as the first argument
const r4 = new FunctionResult({
  tool_result: 'Payment declined.',
  tool_prompt: 'Ask the caller for another card.',
});
```

### setResponse

Set or replace the string response. It also clears a structured response set earlier.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
setResponse(response: string): this
```

| Parameter  | Type     | Description                            |
|------------|----------|----------------------------------------|
| `response` | `string` | The new response: facts or an instruction. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult()
  .setResponse('The account balance is $42.50.');
```

### setToolResponse

Set the structured response, which keeps facts and instruction apart. The SDK sends `response` as `{ tool_result, tool_prompt }`, with only the fields you pass. It replaces any string response.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
setToolResponse(toolResult?: string, toolPrompt?: string): this
```

| Parameter    | Type     | Description                                                          |
|--------------|----------|----------------------------------------------------------------------|
| `toolResult` | `string` | What the tool did or found: facts for the model to reason from.     |
| `toolPrompt` | `string` | What the model should do next: an instruction.                      |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult()
  .setToolResponse('3 seats left on the 7:40 flight.', 'Tell the caller how many seats are left.');
console.log(result.toDict());
// {
//   response: {
//     tool_result: '3 seats left on the 7:40 flight.',
//     tool_prompt: 'Tell the caller how many seats are left.'
//   }
// }
```

### setPostProcess

Enable or disable post-processing.

With post-processing on, the model takes one more turn before the actions run. Use it when the caller must hear something before an action takes effect, such as a hangup, hold or transfer. The SDK includes `post_process: true` in the result only when there are actions.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
setPostProcess(postProcess: boolean): this
```

| Parameter     | Type      | Description                              |
|---------------|-----------|------------------------------------------|
| `postProcess` | `boolean` | Whether to enable post-processing.       |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('Tell the caller goodbye.')
  .setPostProcess(true)
  .hangup();
// The model gets one more turn to say goodbye, then the hangup runs.
```

### addAction

Append a single named action to the action list. Most helper methods use it. Use it directly for an action that has no helper.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
addAction(name: string, data: unknown): this
```

| Parameter | Type      | Description                             |
|-----------|-----------|-----------------------------------------|
| `name`    | `string`  | The action name (for example `"say"`).  |
| `data`    | `unknown` | The action payload.                     |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('Order 1234 is confirmed.')
  .addAction('say', 'Your order is confirmed.');
// action: [{ say: "Your order is confirmed." }], the same as .say(...)
```

### addActions

Append several action objects at once. Each object maps an action name to its payload.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
addActions(actions: Record<string, unknown>[]): this
```

| Parameter | Type                        | Description                        |
|-----------|-----------------------------|------------------------------------|
| `actions` | `Record<string, unknown>[]` | Array of action objects to append. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The survey is complete.')
  .addActions([
    { say: 'Thank you for taking the survey.' },
    { hangup: true },
  ]);
```

### toDict

Serialize the result to a plain object in the SWAIG response format.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
toDict(): {
  response?: string | { tool_result?: string; tool_prompt?: string };
  action?: Record<string, unknown>[];
  post_process?: boolean;
}
```

**Returns:** An object with `response`, `action` and `post_process` fields, each present only when it applies.

These rules decide which fields appear:

- A structured response with at least one field is sent as `response`. Otherwise a non-empty string response is.
- A non-empty action list is included as `action`.
- `post_process: true` is included only when `postProcess` is `true` and there are actions.
- When none of these fields is set, the result is `{ response: "Action completed." }`.

**Example:**

```typescript
const result = new FunctionResult('The caller is verified.').say('Thank you, you are verified.');
console.log(result.toDict());
// {
//   response: 'The caller is verified.',
//   action: [ { say: 'Thank you, you are verified.' } ]
// }

const empty = new FunctionResult();
console.log(empty.toDict());
// { response: 'Action completed.' }
```

### toJSON

Return the same object as `toDict()`, so `JSON.stringify(result)` produces the wire format.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
toJSON(): {
  response?: string | { tool_result?: string; tool_prompt?: string };
  action?: Record<string, unknown>[];
  post_process?: boolean;
}
```

**Example:**

```typescript
console.log(JSON.stringify(new FunctionResult('Order 1234 is cancelled.').hangup()));
// {"response":"Order 1234 is cancelled.","action":[{"hangup":true}]}
```

## Call Control

### connect

Connect (transfer) the call to another destination. The SDK emits an inline SWML document with a `connect` verb, and a `transfer` key beside it set to `"true"` or `"false"`.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
connect(destination: string, final?: boolean, fromAddr?: string): this
```

| Parameter     | Type      | Default | Description                                              |
|---------------|-----------|---------|----------------------------------------------------------|
| `destination` | `string`  | none    | Phone number or SIP address to connect to.               |
| `final`       | `boolean` | `true`  | `true` for a permanent transfer: the call leaves the agent. `false` returns the call to the agent when the far end hangs up. |
| `fromAddr`    | `string`  | none    | Caller ID for the outbound leg. Without it, the current call's from address is used. |

**Returns:** `this` for chaining.

**Example:**

```typescript
// Permanent transfer
const result = new FunctionResult('Tell the caller you are connecting them to support.', true)
  .connect('+15551234567');

// Temporary transfer: the call returns to the agent afterwards
const result2 = new FunctionResult('Tell the caller you are bringing in a manager.', true)
  .connect('+15559876543', false);

// Transfer with a custom caller ID
const result3 = new FunctionResult('Tell the caller you are transferring them.', true)
  .connect('+15551234567', true, '+15550001111');
```

The emitted action for the first example has this shape:

```json
{
  "SWML": {
    "sections": { "main": [{ "connect": { "to": "+15551234567" } }] },
    "version": "1.0.0"
  },
  "transfer": "true"
}
```

### swmlTransfer

Transfer the call with an inline SWML document. The document sets `ai_response` with the `set` verb, then runs the `transfer` verb. Like `connect`, the action carries `transfer: "true"` or `"false"` beside the document.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
swmlTransfer(dest: string, aiResponse: string, final?: boolean): this
```

| Parameter    | Type      | Default | Description                                        |
|--------------|-----------|---------|----------------------------------------------------|
| `dest`       | `string`  | none    | The transfer destination, such as a SWML URL or SIP address. |
| `aiResponse` | `string`  | none    | Stored as `ai_response`, for the agent to use when a non-final transfer returns the call. |
| `final`      | `boolean` | `true`  | `true` for a permanent transfer, `false` to return to the agent. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('Tell the caller you are transferring them to billing.', true)
  .swmlTransfer(
    'https://example.com/billing-swml',
    'The billing call is complete. Ask whether the caller needs anything else.',
    false,
  );
```

### hangup

Hang up the call. Adds a `{ hangup: true }` action.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
hangup(): this
```

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('Thank the caller and say goodbye.')
  .setPostProcess(true)
  .hangup();
```

### hold

Put the call on hold. During a hold, speech detection is paused and the agent doesn't respond to the caller. The platform plays hold music while the call waits.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
hold(prompt?: string | number, timeout?: number, step?: string, timeoutStep?: string): this
```

| Parameter     | Type               | Default | Description                                                 |
|---------------|--------------------|---------|-------------------------------------------------------------|
| `prompt`      | `string \| number` | none    | Instruction for the model to act on before the hold. A number here is read as `timeout`. |
| `timeout`     | `number`           | `300`   | Hold duration in seconds, clamped to 0 through 900.         |
| `step`        | `string`           | none    | Step to move to when the call is taken off hold.            |
| `timeoutStep` | `string`           | none    | Step to move to when the hold times out.                    |

**Returns:** `this` for chaining.

The hold action carries no announcement of its own, so say anything the caller needs to hear before the hold takes effect. Passing `prompt` does that for you. It sets the structured response to `tool_result: "status: on hold"` with your prompt as `tool_prompt`, and turns on `postProcess`. The model then takes one more turn, and can tell the caller, before the hold runs.

A number as the first argument is the timeout, so `hold(120)` means a 120-second hold with no prompt:

```typescript
const shortHold = new FunctionResult('The caller is waiting for a supervisor.').hold(120);
// action: [{ hold: 120 }]
```

`step` and `timeoutStep` choose the step the call moves to when the hold ends. `step` applies when someone takes the call off hold, for example with [rpcAiUnhold](#rpcaiunhold). `timeoutStep` applies when the timeout passes with nobody releasing the call. Leave one out, and a hold that ends that way resumes in the current step.

Both transitions wait for the hold to end. [swmlChangeStep](#swmlchangestep) applies at once instead. Returning it with a hold moves the caller before the hold begins.

This example announces the hold and routes the call when the hold ends:

```typescript
const routed = new FunctionResult().hold(
  'Tell the caller you are checking whether someone is available.',
  60,
  'human_available',
  'take_message',
);
console.log(JSON.stringify(routed.toDict(), null, 2));
```

The result carries the prompt, the routing and `post_process`:

```json
{
  "response": {
    "tool_result": "status: on hold",
    "tool_prompt": "Tell the caller you are checking whether someone is available."
  },
  "action": [
    {
      "hold": {
        "timeout": 60,
        "step": "human_available",
        "timeout_step": "take_message"
      }
    }
  ],
  "post_process": true
}
```

Without `step` and `timeoutStep`, the action is the bare timeout, such as `{ hold: 300 }`.

### waitForUser

Emit a `wait_for_user` action, which controls how the agent waits for the caller's input.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
waitForUser(opts?: {
  enabled?: boolean;
  timeout?: number;
  answerFirst?: boolean;
}): this
```

| Parameter          | Type      | Default | Description                                      |
|--------------------|-----------|---------|--------------------------------------------------|
| `opts.enabled`     | `boolean` | none    | Enable or disable waiting for user input. Emits the boolean. |
| `opts.timeout`     | `number`  | none    | Seconds to wait for user input. Emits the number. |
| `opts.answerFirst` | `boolean` | none    | When `true`, emits the string `"answer_first"`.   |

**Priority:** `answerFirst` > `timeout` > `enabled`. With no options, the SDK emits `wait_for_user: true`.

**Returns:** `this` for chaining.

**Example:**

```typescript
// Wait for the caller
const r1 = new FunctionResult('Ask the caller to take their time.').waitForUser();

// Wait up to 10 seconds
const r2 = new FunctionResult('The caller is looking for their account number.')
  .waitForUser({ timeout: 10 });

// answer_first mode
const r3 = new FunctionResult('The caller has not spoken yet.')
  .waitForUser({ answerFirst: true });

// Stop waiting
const r4 = new FunctionResult('Continue with the next question.')
  .waitForUser({ enabled: false });
```

### stop

Stop the AI conversation. Adds a `{ stop: true }` action.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
stop(): this
```

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The session is complete.').stop();
```

## Audio

### say

Speak text to the caller with text-to-speech. Unlike the response, which the model interprets, this text is spoken to the caller. Adds a `{ say: text }` action.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
say(text: string): this
```

| Parameter | Type     | Description              |
|-----------|----------|--------------------------|
| `text`    | `string` | The text to speak.       |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('Order 12345 was found.')
  .say('Your order number is 12345.');
```

### playBackgroundFile

Play an audio file in the background during the call. The AI conversation continues while the file plays.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
playBackgroundFile(filename: string, wait?: boolean): this
```

| Parameter  | Type      | Default | Description                                        |
|------------|-----------|---------|----------------------------------------------------|
| `filename` | `string`  | none    | URL or path of the audio file.                     |
| `wait`     | `boolean` | `false` | When `true`, wait for the file to finish playing before continuing. |

With `wait` false, the action is `{ playback_bg: filename }`. With `wait` true, it's `{ playback_bg: { file: filename, wait: true } }`.

**Returns:** `this` for chaining.

**Example:**

```typescript
// Play background music
const result = new FunctionResult('Hold music is playing.')
  .playBackgroundFile('https://example.com/hold-music.mp3');

// Play and wait for the file to finish
const result2 = new FunctionResult('The announcement is playing.')
  .playBackgroundFile('https://example.com/announcement.wav', true);
```

### stopBackgroundFile

Stop the background audio file that is playing. Adds a `{ stop_playback_bg: true }` action.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
stopBackgroundFile(): this
```

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The music is stopped.')
  .stopBackgroundFile();
```

### changeVoice

Change the AI's voice for the rest of the call (`change_voice`). The voice takes the `engine.voice:model` form a language's voice takes, and may be on another engine. It replaces the current language's voice from the next batch of speech on, never mid-utterance, and stays for that language for the rest of the call. A voice that won't open falls back to the fallback voice.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
changeVoice(voice: string): this
```

| Parameter | Type     | Description                                            |
|-----------|----------|--------------------------------------------------------|
| `voice`   | `string` | The voice as `engine.voice:model`, such as `elevenlabs.rachel`. |

**Returns:** `this` for chaining.

**Throws:** `Error` when `voice` is empty or only whitespace. The platform would ignore it.

**Example:**

```typescript
const result = new FunctionResult('The voice is changed.').changeVoice('elevenlabs.rachel');
```

## Speech

### addDynamicHints

Add speech recognition hints during the call, to improve recognition of specific words or phrases. A hint is a string, or a pattern object that replaces matching recognized text.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
addDynamicHints(
  hints: (string | { pattern: string; replace: string; ignore_case?: boolean })[]
): this
```

| Parameter | Type                                                                              | Description                                    |
|-----------|-----------------------------------------------------------------------------------|------------------------------------------------|
| `hints`   | `(string \| { pattern: string; replace: string; ignore_case?: boolean })[]` | Array of hint strings or pattern objects.       |

**Returns:** `this` for chaining.

**Example:**

```typescript
// Word hints
const result = new FunctionResult('Hints are added.')
  .addDynamicHints(['SignalWire', 'SWML', 'SWAIG']);

// Pattern-replacement hints
const result2 = new FunctionResult('Hints are added.')
  .addDynamicHints([
    { pattern: 'signal wire', replace: 'SignalWire', ignore_case: true },
    { pattern: 'swiggy', replace: 'SWAIG' },
  ]);
```

### clearDynamicHints

Remove all hints added with `addDynamicHints()`. Adds a `{ clear_dynamic_hints: {} }` action.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
clearDynamicHints(): this
```

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('Hints are cleared.')
  .clearDynamicHints();
```

### setEndOfSpeechTimeout

Set how many milliseconds of silence after detected speech finalize speech recognition (`end_of_speech_timeout`). A shorter timeout ends the caller's turn sooner. A longer one allows for pauses.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
setEndOfSpeechTimeout(milliseconds: number): this
```

| Parameter      | Type     | Description                       |
|----------------|----------|-----------------------------------|
| `milliseconds` | `number` | Timeout in milliseconds.          |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The speech timeout is adjusted.')
  .setEndOfSpeechTimeout(500);  // 500 ms of silence ends the caller's turn
```

### setSpeechEventTimeout

Set how many milliseconds after the last speech detection event recognition is finalized (`speech_event_timeout`). It works better than the end-of-speech timeout in noisy environments.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
setSpeechEventTimeout(milliseconds: number): this
```

| Parameter      | Type     | Description                       |
|----------------|----------|-----------------------------------|
| `milliseconds` | `number` | Timeout in milliseconds.          |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The event timeout is set.')
  .setSpeechEventTimeout(3000);
```

## Data Management

### updateGlobalData

Merge key-value pairs into the call's global data (`set_global_data`). Global data lasts for the AI session. Every function can read it, and prompts can expand it with `${global_data.key}`.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
updateGlobalData(data: Record<string, unknown>): this
```

| Parameter | Type                       | Description                        |
|-----------|----------------------------|------------------------------------|
| `data`    | `Record<string, unknown>`  | Key-value pairs to set or update.  |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The customer record is loaded.')
  .updateGlobalData({ customer_id: 'C-123', tier: 'premium' });
```

### setSemanticState

Set the state the call's semantic gates judge, besides the dialogue: `global_data.semantic_state` (sent as `set_global_data`). It replaces the state as a whole: to change one field, send the whole state with that field changed, and send `{}` to reset it. Keep it to what the application has established, such as an order the caller confirmed, rather than what the caller claims. It's the only global data copied into the decision model's state; a gate question can still bring in other global data with a `${global_data.x}` template. See [Semantic gates](api-reference.md#semantic-gates).

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
setSemanticState(state: Record<string, unknown>): this
```

| Parameter | Type                      | Description         |
|-----------|---------------------------|---------------------|
| `state`   | `Record<string, unknown>` | The semantic state. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The order is confirmed.').setSemanticState({
  order: { item: 'large pepperoni', confirmed: true },
});
```

### removeGlobalData

Remove one or more keys from the global data (`unset_global_data`).

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
removeGlobalData(keys: string | string[]): this
```

| Parameter | Type                 | Description                              |
|-----------|----------------------|------------------------------------------|
| `keys`    | `string \| string[]` | A single key or array of keys to remove. |

**Returns:** `this` for chaining.

**Example:**

```typescript
// Remove a single key
const r1 = new FunctionResult('The temporary token is removed.')
  .removeGlobalData('temp_token');

// Remove several keys
const r2 = new FunctionResult('The session cache is cleared.')
  .removeGlobalData(['temp_token', 'session_cache']);
```

### setMetadata

Set metadata (`set_meta_data`) scoped to the current function's `meta_data_token`. Functions that share a token share the metadata. Without a token, the scope is the function.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
setMetadata(data: Record<string, unknown>): this
```

| Parameter | Type                       | Description                   |
|-----------|----------------------------|-------------------------------|
| `data`    | `Record<string, unknown>`  | Metadata key-value pairs.     |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The lookup is saved.')
  .setMetadata({ last_action: 'lookup', retry_count: 2 });
```

### removeMetadata

Remove metadata keys (`unset_meta_data`) from the current function's `meta_data_token` scope.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
removeMetadata(keys: string | string[]): this
```

| Parameter | Type                 | Description                              |
|-----------|----------------------|------------------------------------------|
| `keys`    | `string \| string[]` | A single key or array of keys to remove. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The temporary metadata is removed.')
  .removeMetadata(['temp_flag', 'debug_info']);
```

## SWML Actions

### executeSwml

Run arbitrary SWML content as an action.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
executeSwml(
  swmlContent: string | Record<string, unknown> | { toDict(): Record<string, unknown> },
  transfer?: boolean
): this
```

| Parameter     | Type                                    | Default | Description                                       |
|---------------|-----------------------------------------|---------|---------------------------------------------------|
| `swmlContent` | `string \| Record<string, unknown> \| { toDict() }` | none | SWML as a JSON string, a plain object, or an object with a `toDict()` method. |
| `transfer`    | `boolean`                               | `false` | When `true`, the call leaves the agent for this SWML. |

The SDK normalizes `swmlContent` as follows:

- A JSON string is parsed. A string that isn't valid JSON is sent as `{ raw_swml: <string> }`.
- An object with a `toDict()` method is converted through it.
- A plain object is copied, so the SDK never changes yours.
- Any other value, such as a number, an array or `null`, throws an `Error`.

The action is `{ SWML: <document> }`. With `transfer` set, the SDK adds `transfer: "true"` beside the `SWML` key, not inside the document. That is the same shape `connect()` and `swmlTransfer()` emit.

**Returns:** `this` for chaining.

**Example:**

```typescript
// Run SWML from an object
const result = new FunctionResult('A short announcement is playing.')
  .executeSwml({
    version: '1.0.0',
    sections: {
      main: [{ play: { url: 'https://example.com/audio.mp3' } }],
    },
  });

// Run SWML and leave the agent
const result2 = new FunctionResult('Tell the caller you are transferring them.', true)
  .executeSwml({
    version: '1.0.0',
    sections: {
      main: [{ connect: { to: '+15551234567' } }],
    },
  }, true);
```

The second example emits this action:

```json
{
  "SWML": {
    "version": "1.0.0",
    "sections": { "main": [{ "connect": { "to": "+15551234567" } }] }
  },
  "transfer": "true"
}
```

### switchContext

Replace the agent's prompt during the call (`context_switch`). It can set a new system prompt, add a user prompt, summarize the conversation so far, or reset the context completely.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
switchContext(opts?: {
  systemPrompt?: string;
  userPrompt?: string;
  consolidate?: boolean;
  fullReset?: boolean;
}): this
```

| Parameter           | Type      | Description                                                       |
|---------------------|-----------|-------------------------------------------------------------------|
| `opts.systemPrompt` | `string`  | New system prompt.                                                |
| `opts.userPrompt`   | `string`  | Text added as if the user had said it, to give the new prompt context. |
| `opts.consolidate`  | `boolean` | When `true`, summarize the existing conversation.                 |
| `opts.fullReset`    | `boolean` | When `true`, reset the context completely.                        |

**Behavior:** With only `systemPrompt`, the action value is the prompt string. Otherwise it's an object with the fields that are set.

**Returns:** `this` for chaining.

**Example:**

```typescript
// Change the system prompt only
const r1 = new FunctionResult('The caller has a billing question.')
  .switchContext({ systemPrompt: 'You are a billing specialist.' });

// Change it and summarize the conversation so far
const r2 = new FunctionResult('The call is escalated to a supervisor.')
  .switchContext({
    systemPrompt: 'You are a supervisor handling an escalated call.',
    consolidate: true,
  });

// Full reset
const r3 = new FunctionResult('The caller wants to start over.')
  .switchContext({
    systemPrompt: 'You are a general assistant.',
    fullReset: true,
  });
```

### swmlChangeStep

Move the conversation to another step in the current context (`change_step`). The step must exist in the current context of the agent's contexts, which you define with `defineContexts()`. The change applies at once, and a change from a tool isn't limited by the step's `setValidSteps()` list.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
swmlChangeStep(stepName: string): this
```

| Parameter  | Type     | Description                        |
|------------|----------|------------------------------------|
| `stepName` | `string` | The name of the step to switch to. |

**Returns:** `this` for chaining.

The model reads the response before the new step's instructions, so put the reason for the move there. Pass values the step needs with `updateGlobalData()`, and expand them in the step's text.

**Example:**

```typescript
const result = new FunctionResult('The premium plan is confirmed. Collect payment details next.')
  .updateGlobalData({ plan: 'premium' })
  .swmlChangeStep('collect_payment');
```

### swmlChangeContext

Move the conversation to another context (`change_context`). The context must exist in the agent's contexts, which you define with `defineContexts()`. A change from a tool isn't limited by `setValidContexts()`.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
swmlChangeContext(contextName: string): this
```

| Parameter     | Type     | Description                           |
|---------------|----------|---------------------------------------|
| `contextName` | `string` | The name of the context to switch to. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The caller asked for support in Spanish.')
  .swmlChangeContext('spanish_support');
```

### swmlUserEvent

Send an event to the client connected to the call, such as a browser using the SignalWire browser SDK. The SDK wraps `eventData` in an inline SWML `user_event` verb, and the client receives it as a `user_event` event.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
swmlUserEvent(eventData: Record<string, unknown>): this
```

| Parameter   | Type                       | Description          |
|-------------|----------------------------|----------------------|
| `eventData` | `Record<string, unknown>`  | The event payload.   |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('Order ORD-456 was placed.')
  .swmlUserEvent({
    type: 'order_placed',
    order_id: 'ORD-456',
    total: 29.99,
  });
```

## Function Control

### toggleFunctions

Enable or disable SWAIG functions by name during the call (`toggle_functions`), to control which tools the model can call.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
toggleFunctions(toggles: { function: string; active: boolean }[]): this
```

| Parameter          | Type      | Description                              |
|--------------------|-----------|------------------------------------------|
| `toggles[].function` | `string`  | The name of the SWAIG function.        |
| `toggles[].active`   | `boolean` | `true` to enable, `false` to disable. |

**Returns:** `this` for chaining.

**Example:**

```typescript
// After verification, enable the account tools
const result = new FunctionResult('The caller is verified.')
  .toggleFunctions([
    { function: 'check_balance', active: true },
    { function: 'make_payment', active: true },
    { function: 'verify_identity', active: false },
  ]);
```

### enableFunctionsOnTimeout

Control whether the model can call functions on a speaker timeout, when the caller is silent (`functions_on_speaker_timeout`).

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
enableFunctionsOnTimeout(enabled?: boolean): this
```

| Parameter | Type      | Default | Description                                          |
|-----------|-----------|---------|------------------------------------------------------|
| `enabled` | `boolean` | `true`  | Whether functions can be called on speaker timeout.  |

**Returns:** `this` for chaining.

**Example:**

```typescript
// Allow functions on speaker timeout
const r1 = new FunctionResult('The caller may go quiet while searching.')
  .enableFunctionsOnTimeout();

// Disallow them
const r2 = new FunctionResult('Wait for the caller to answer.')
  .enableFunctionsOnTimeout(false);
```

### updateSettings

Update AI settings during the call (`settings`). The platform validates the keys. The Python SDK's reference lists `temperature`, `top-p`, `max-tokens`, `frequency-penalty`, `presence-penalty`, `confidence` and `barge-confidence`.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
updateSettings(settings: Record<string, unknown>): this
```

| Parameter  | Type                       | Description                          |
|------------|----------------------------|--------------------------------------|
| `settings` | `Record<string, unknown>`  | Key-value pairs of settings.         |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The settings are updated.')
  .updateSettings({ temperature: 0.3, 'top-p': 0.9 });
```

## User Input and History

### simulateUserInput

Queue text as if the caller had said it (`user_input`). Use it to drive the conversation from code.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
simulateUserInput(text: string): this
```

| Parameter | Type     | Description                        |
|-----------|----------|------------------------------------|
| `text`    | `string` | The simulated user input text.     |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The caller accepted the default option.')
  .simulateUserInput('Yes, go ahead with the default.');
```

### enableExtensiveData

Send the full data to the model for this turn only, and a smaller replacement in later turns (`extensive_data`).

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
enableExtensiveData(enabled?: boolean): this
```

| Parameter | Type      | Default | Description                              |
|-----------|-----------|---------|------------------------------------------|
| `enabled` | `boolean` | `true`  | Whether to send extensive data this turn. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The full order history is attached.')
  .enableExtensiveData();
```

### replaceInHistory

After the first send, remove or replace this tool call and its result in the conversation history (`replace_in_history`). Use it when a function call is an implementation detail that would confuse the model if it stayed in context.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
replaceInHistory(text?: string | boolean): this
```

| Parameter | Type                  | Default | Description                                               |
|-----------|-----------------------|---------|-----------------------------------------------------------|
| `text`    | `string \| boolean` | `true`  | A string replaces the pair with an assistant message holding that text. `true` removes the pair. |

**Returns:** `this` for chaining.

**Example:**

```typescript
// Remove the tool call and result from the history
const r1 = new FunctionResult('The answer is saved.')
  .replaceInHistory();

// Replace them with an assistant message
const r2 = new FunctionResult('The identity check passed.')
  .replaceInHistory('Identity verification completed.');
```

## Communication

### sendSms

Send an SMS or MMS message from within the call flow. The SDK emits an inline SWML `send_sms` verb. Provide `body`, `media`, or both.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
sendSms(opts: {
  toNumber: string;
  fromNumber: string;
  body?: string;
  media?: string[];
  tags?: string[];
  region?: string;
}): this
```

| Parameter        | Type       | Description                                    |
|------------------|------------|------------------------------------------------|
| `opts.toNumber`  | `string`   | Recipient phone number, in E.164 format.       |
| `opts.fromNumber` | `string`  | Sender phone number, in E.164 format.          |
| `opts.body`      | `string`   | Message text.                                  |
| `opts.media`     | `string[]` | Media URLs for an MMS.                         |
| `opts.tags`      | `string[]` | Tags for the message.                          |
| `opts.region`    | `string`   | Region to send the message from.               |

**Throws:** `Error` if neither `body` nor `media` is provided.

**Returns:** `this` for chaining.

**Example:**

```typescript
// Send a text message
const result = new FunctionResult('The confirmation text is sent.')
  .sendSms({
    toNumber: '+15551234567',
    fromNumber: '+15559876543',
    body: 'Your appointment is confirmed for tomorrow at 2pm.',
  });

// Send an MMS with an image
const result2 = new FunctionResult('The receipt is sent.')
  .sendSms({
    toNumber: '+15551234567',
    fromNumber: '+15559876543',
    body: 'Here is your receipt:',
    media: ['https://example.com/receipt.png'],
  });
```

### recordCall

Start a background recording of the call. The SDK emits an inline SWML `record_call` verb, and the call continues while it records.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
recordCall(opts?: {
  controlId?: string;
  stereo?: boolean;
  format?: 'wav' | 'mp3' | 'mp4';
  direction?: 'speak' | 'listen' | 'both';
  terminators?: string;
  beep?: boolean;
  inputSensitivity?: number;
  initialTimeout?: number;
  endSilenceTimeout?: number;
  maxLength?: number;
  statusUrl?: string;
}): this
```

| Parameter               | Type                            | Default  | Description                                     |
|-------------------------|---------------------------------|----------|-------------------------------------------------|
| `opts.controlId`        | `string`                        | none     | Identifier for this recording, for `stopRecordCall()`. |
| `opts.stereo`           | `boolean`                       | `false`  | Record in stereo.                               |
| `opts.format`           | `'wav' \| 'mp3' \| 'mp4'`       | `'wav'`  | Recording file format.                          |
| `opts.direction`        | `'speak' \| 'listen' \| 'both'` | `'both'` | Audio to record: what the party says, hears, or both. |
| `opts.terminators`      | `string`                        | none     | DTMF digits that stop the recording.            |
| `opts.beep`             | `boolean`                       | `false`  | Play a beep before recording.                   |
| `opts.inputSensitivity` | `number`                        | `44.0`   | Sensitivity of the voice activity detector to background noise, from 0 to 100. |
| `opts.initialTimeout`   | `number`                        | none     | Seconds to wait for speech to start.            |
| `opts.endSilenceTimeout`| `number`                        | none     | Seconds of silence before the recording ends.   |
| `opts.maxLength`        | `number`                        | none     | Maximum recording length in seconds.            |
| `opts.statusUrl`        | `string`                        | none     | URL that receives recording status events.      |

The SDK always sends `stereo`, `format`, `direction`, `beep` and `input_sensitivity`, and sends the other options only when set.

**Returns:** `this` for chaining.

**Example:**

```typescript
// Record with the defaults
const result = new FunctionResult('The recording has started.')
  .recordCall();

// Stereo MP3 recording with a control ID
const result2 = new FunctionResult('The recording has started.')
  .recordCall({
    controlId: 'main-recording',
    stereo: true,
    format: 'mp3',
    maxLength: 3600,
    statusUrl: 'https://example.com/recording-status',
  });
```

### stopRecordCall

Stop a background recording (SWML `stop_record_call`).

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
stopRecordCall(controlId?: string): this
```

| Parameter   | Type     | Description                                      |
|-------------|----------|--------------------------------------------------|
| `controlId` | `string` | Control ID of the recording to stop. Omit it to stop the most recent recording. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The recording has stopped.')
  .stopRecordCall('main-recording');
```

### tap

Start a background media tap, which streams the call's audio to a WebSocket or RTP destination, for example for real-time transcription or monitoring. The SDK emits an inline SWML `tap` verb.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
tap(opts: {
  uri: string;
  controlId?: string;
  direction?: 'speak' | 'listen' | 'both';
  codec?: 'PCMU' | 'PCMA';
  rtpPtime?: number;
  statusUrl?: string;
}): this
```

| Parameter        | Type                             | Default  | Description                                  |
|------------------|----------------------------------|----------|----------------------------------------------|
| `opts.uri`       | `string`                         | none     | Destination of the stream: `ws://...`, `wss://...` or `rtp://IP:port`. |
| `opts.controlId` | `string`                         | none     | Identifier for this tap, for `stopTap()`.    |
| `opts.direction` | `'speak' \| 'listen' \| 'both'` | `'both'` | `speak` is what the party says, `listen` is what it hears, and `both` is both. |
| `opts.codec`     | `'PCMU' \| 'PCMA'`            | `'PCMU'` | Audio codec for the stream.                  |
| `opts.rtpPtime`  | `number`                         | `20`     | RTP packetization time in milliseconds, for an `rtp://` destination. |
| `opts.statusUrl` | `string`                         | none     | URL that receives tap status events.         |

The SDK always sends `direction`, because the SWML `tap` verb defaults to `speak` when it's missing. It sends `codec` and `rtp_ptime` only when they differ from `PCMU` and 20.

**Throws:** `Error` when `direction` or `codec` isn't one of the listed values, or `rtpPtime` isn't positive.

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The transcription stream has started.')
  .tap({
    uri: 'wss://transcription.example.com/stream',
    controlId: 'realtime-tap',
    direction: 'both',
  });
```

### stopTap

Stop a media tap (SWML `stop_tap`).

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
stopTap(controlId?: string): this
```

| Parameter   | Type     | Description                                 |
|-------------|----------|---------------------------------------------|
| `controlId` | `string` | Control ID of the tap to stop. Omit it to stop the most recent tap. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The transcription stream has stopped.')
  .stopTap('realtime-tap');
```

## Rooms and Conferencing

### joinRoom

Join a RELAY room by name (SWML `join_room`). The platform creates the room if it doesn't exist.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
joinRoom(name: string): this
```

| Parameter | Type     | Description           |
|-----------|----------|-----------------------|
| `name`    | `string` | The room name. Letters, digits, underscores and hyphens are allowed. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The caller is joining the team meeting.')
  .joinRoom('team-standup');
```

### sipRefer

Send a SIP REFER to transfer the call to another SIP endpoint (SWML `sip_refer`).

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
sipRefer(toUri: string): this
```

| Parameter | Type     | Description                           |
|-----------|----------|---------------------------------------|
| `toUri`   | `string` | The SIP URI to send the REFER to.     |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('Tell the caller you are transferring them.', true)
  .sipRefer('sip:agent@pbx.example.com');
```

### joinConference

Join a conference by name (SWML `join_conference`), with optional settings.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
joinConference(name: string, opts?: {
  muted?: boolean;
  beep?: 'true' | 'false' | 'onEnter' | 'onExit';
  startOnEnter?: boolean;
  endOnExit?: boolean;
  waitUrl?: string;
  maxParticipants?: number | string;
  record?: 'do-not-record' | 'record-from-start';
  region?: string;
  trim?: 'trim-silence' | 'do-not-trim';
  coach?: string;
  statusCallbackEvent?: string;
  statusCallback?: string;
  statusCallbackMethod?: 'GET' | 'POST';
  recordingStatusCallback?: string;
  recordingStatusCallbackMethod?: 'GET' | 'POST';
  recordingStatusCallbackEvent?: string;
  result?: unknown;
}): this
```

| Parameter                              | Type                                        | Default             | Description                                          |
|----------------------------------------|---------------------------------------------|---------------------|------------------------------------------------------|
| `name`                                 | `string`                                    | none                | Conference name. Must not be blank.                  |
| `opts.muted`                           | `boolean`                                   | `false`             | Join muted.                                          |
| `opts.beep`                            | `'true' \| 'false' \| 'onEnter' \| 'onExit'` | `'true'`         | When to play the beep.                               |
| `opts.startOnEnter`                    | `boolean`                                   | `true`              | Start the conference when this participant joins.    |
| `opts.endOnExit`                       | `boolean`                                   | `false`             | End the conference when this participant leaves.     |
| `opts.waitUrl`                         | `string`                                    | none                | URL of media to play while the conference is on hold. |
| `opts.maxParticipants`                 | `number \| string`                         | none                | Maximum number of participants, an integer of 2 or more, or a SWML variable reference such as `'${room_size}'`. A numeric string is sent as an integer. Sent whenever it's given. The platform refuses fewer than 2 and sets no upper limit; the schema's cap of 100000 isn't enforced. |
| `opts.record`                          | `'do-not-record' \| 'record-from-start'`  | `'do-not-record'`   | Recording mode.                                      |
| `opts.region`                          | `string`                                    | none                | Region for the conference.                           |
| `opts.trim`                            | `'trim-silence' \| 'do-not-trim'`         | `'trim-silence'`    | Silence trimming for recordings.                     |
| `opts.coach`                           | `string`                                    | none                | Call SID of a call connected to the conference, to coach. |
| `opts.statusCallbackEvent`             | `string`                                    | none                | Space-separated events to send to the status callback. |
| `opts.statusCallback`                  | `string`                                    | none                | URL for status callbacks.                            |
| `opts.statusCallbackMethod`            | `'GET' \| 'POST'`                         | `'POST'`            | HTTP method for status callbacks.                    |
| `opts.recordingStatusCallback`         | `string`                                    | none                | URL for recording status callbacks.                  |
| `opts.recordingStatusCallbackMethod`   | `'GET' \| 'POST'`                         | `'POST'`            | HTTP method for recording status callbacks.          |
| `opts.recordingStatusCallbackEvent`    | `string`                                    | `'completed'`       | Events to send to the recording status callback.     |
| `opts.result`                          | `unknown`                                   | none                | Actions to switch on by result, as the verb's `result` object. |

**Behavior:** The SDK leaves out any option set to its default value, except `maxParticipants`, which is sent whenever it's given. When no option remains, the `join_conference` value is the name string. Otherwise it's an object with `name` and the other options.

**Throws:** `Error` when `name` is blank, or `maxParticipants` isn't an integer of at least 2 or a SWML variable reference.

**Returns:** `this` for chaining.

**Example:**

```typescript
// Join with the defaults
const result = new FunctionResult('The caller is joining the support conference.')
  .joinConference('support-queue');

// Join muted, recorded, and capped at 50 participants
const result2 = new FunctionResult('The caller is joining as a listener.')
  .joinConference('all-hands', {
    muted: true,
    record: 'record-from-start',
    maxParticipants: 50,
    beep: 'onEnter',
  });
```

## RPC

### executeRpc

Run a SignalWire RPC method from an inline SWML `execute_rpc` verb. It's the low-level method under `rpcDial()`, `rpcAiMessage()`, `rpcAiGlobalData()` and `rpcAiUnhold()`, which use the `dial`, `ai_message` and `ai_unhold` methods.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
executeRpc(opts: {
  method: string;
  params?: Record<string, unknown>;
  callId?: string;
  nodeId?: string;
}): this
```

| Parameter     | Type                       | Description                         |
|---------------|----------------------------|-------------------------------------|
| `opts.method` | `string`                   | The RPC method name.                |
| `opts.params` | `Record<string, unknown>`  | Parameters for the method. An empty object is left out. |
| `opts.callId` | `string`                   | Target call ID.                     |
| `opts.nodeId` | `string`                   | Target node ID.                     |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The other caller has been notified.')
  .executeRpc({
    method: 'ai_message',
    callId: 'call-abc-123',
    params: { role: 'system', message_text: 'The customer has been verified.' },
  });
```

### rpcDial

Dial out with the `dial` RPC method. Use it, for example, to hold the caller and dial a person whose call runs the SWML at `destSwml`.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
rpcDial(
  toNumber: string,
  fromNumber: string,
  destSwml: string,
  deviceType?: string
): this
```

| Parameter    | Type     | Default   | Description                              |
|--------------|----------|-----------|------------------------------------------|
| `toNumber`   | `string` | none      | Number to dial, in E.164 format.         |
| `fromNumber` | `string` | none      | Caller ID, in E.164 format.              |
| `destSwml`   | `string` | none      | URL of the SWML that handles the dialed call. |
| `deviceType` | `string` | `'phone'` | Device type for the outbound leg.        |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult()
  .hold('Tell the caller you are checking whether a manager is available.', 120)
  .rpcDial('+15551234567', '+15559876543', 'https://example.com/manager-swml');
```

### rpcAiMessage

Send a message, global data, or both to the AI agent on another call, with the `ai_message` RPC method.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
rpcAiMessage(
  callId: string,
  messageText?: string | null,
  role?: string,
  globalData?: Record<string, unknown>
): this
```

| Parameter     | Type                      | Default    | Description                                     |
|---------------|---------------------------|------------|-------------------------------------------------|
| `callId`      | `string`                  | none       | The target call ID.                             |
| `messageText` | `string \| null`          | none       | Message to add as a turn in the other conversation. |
| `role`        | `string`                  | `'system'` | Role for the message. Sent only with `messageText`. |
| `globalData`  | `Record<string, unknown>` | none       | Object merged into the target call's global data. |

**Throws:** `Error` when neither `messageText` nor `globalData` is given.

**Returns:** `this` for chaining.

The two payloads behave differently. `messageText` arrives as a turn in the other conversation, alongside everything else arriving then. `globalData` is merged into the other call's global data without a turn, and a prompt there reads it with `${global_data.your_key}`. For content that a later step on the other call must say, prefer global data. [rpcAiGlobalData](#rpcaiglobaldata) sends global data only.

**Example:**

```typescript
const result = new FunctionResult('The manager declined the call.')
  .rpcAiMessage('call-abc-123', 'No one is available. Take a message.')
  .rpcAiUnhold('call-abc-123');
```

### rpcAiGlobalData

Merge data into another call's global data, with no conversation turn. It calls `rpcAiMessage(callId, undefined, 'system', data)`.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
rpcAiGlobalData(callId: string, data: Record<string, unknown>): this
```

| Parameter | Type                      | Description                                  |
|-----------|---------------------------|----------------------------------------------|
| `callId`  | `string`                  | The target call ID.                          |
| `data`    | `Record<string, unknown>` | Object merged into that call's global data.  |

**Returns:** `this` for chaining.

This example sends a message for the held caller's agent and then releases the hold:

```typescript
const result = new FunctionResult('The manager declined the call.')
  .rpcAiGlobalData('call-abc-123', {
    decline_message: 'The manager is in a meeting until 3pm.',
  })
  .rpcAiUnhold('call-abc-123');
```

A step on the other call can then use the value, with text such as `Tell the caller: ${global_data.decline_message}`.

### rpcAiUnhold

Take another call off hold, with the `ai_unhold` RPC method. When that call's hold has a `step`, the call moves to that step. For more information, see [hold](#hold).

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
rpcAiUnhold(callId: string): this
```

| Parameter | Type     | Description                    |
|-----------|----------|--------------------------------|
| `callId`  | `string` | The ID of the call to take off hold. |

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('The held caller is being reconnected.')
  .rpcAiUnhold('call-abc-123');
```

## Payments

### pay

Start a payment collection flow on the call. The SDK emits an inline SWML document that sets `ai_response` with the `set` verb and then runs the `pay` verb. The payment connector at `paymentConnectorUrl` processes the payment.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
pay(opts: {
  paymentConnectorUrl: string;
  inputMethod?: string;
  statusUrl?: string;
  paymentMethod?: string;
  timeout?: number | string;
  maxAttempts?: number | string;
  securityCode?: boolean | string;
  postalCode?: boolean | string;
  minPostalCodeLength?: number | string;
  tokenType?: string;
  chargeAmount?: string;
  currency?: string;
  language?: string;
  voice?: string;
  description?: string;
  validCardTypes?: string;
  parameters?: PaymentParameter[];
  prompts?: PaymentPrompt[];
  aiResponse?: string;
}): this
```

| Parameter                  | Type                 | Default                               | Description                                                     |
|----------------------------|----------------------|---------------------------------------|-----------------------------------------------------------------|
| `opts.paymentConnectorUrl` | `string`             | none                                  | URL of the payment connector.                                   |
| `opts.inputMethod`         | `string`             | `'dtmf'`                              | How the caller enters details. The SWML `pay` verb accepts only `'dtmf'`. |
| `opts.statusUrl`           | `string`             | none                                  | URL that receives payment status events.                        |
| `opts.paymentMethod`       | `string`             | `'credit-card'`                       | Payment method. The verb accepts only `'credit-card'`.          |
| `opts.timeout`             | `number \| string`  | `5`                                   | Seconds to wait for the next digit.                             |
| `opts.maxAttempts`         | `number \| string`  | `1`                                   | Number of times the `pay` verb retries collecting the details.  |
| `opts.securityCode`        | `boolean \| string` | `true`                                | Whether to ask for the security code.                           |
| `opts.postalCode`          | `boolean \| string` | `true`                                | Whether to ask for the postal code, or the postal code itself when it's known. |
| `opts.minPostalCodeLength` | `number \| string`  | `0`                                   | Minimum postal code length.                                     |
| `opts.tokenType`           | `string`             | `'reusable'`                          | `'one-time'` or `'reusable'`.                                   |
| `opts.chargeAmount`        | `string`             | none                                  | Amount to charge, as a decimal string (for example `'29.99'`). |
| `opts.currency`            | `string`             | `'usd'`                               | ISO 4217 currency code.                                         |
| `opts.language`            | `string`             | `'en-US'`                             | Language of the payment prompts.                                |
| `opts.voice`               | `string`             | `'woman'`                             | Text-to-speech voice for the payment prompts.                   |
| `opts.description`         | `string`             | none                                  | Description of the payment.                                     |
| `opts.validCardTypes`      | `string`             | `'visa mastercard amex'`              | Space-separated list of accepted card types.                    |
| `opts.parameters`          | `PaymentParameter[]` | none                                  | Name-value pairs for the payment connector.                     |
| `opts.prompts`             | `PaymentPrompt[]`    | none                                  | Custom prompts for payment steps.                               |
| `opts.aiResponse`          | `string`             | Text that references `${pay_result}`  | Set as `ai_response` before the `pay` verb runs.                |

The SDK sends `timeout`, `max_attempts`, `min_postal_code_length`, `security_code` and `postal_code` as strings, as the platform reads them: its SWML validator requires strings for `security_code` and `postal_code`, and the pay request reads all five as strings. The bundled SWML schema types some of them as integers and booleans, but the platform's own checks win. The SDK checks each input first: `timeout`, `maxAttempts` and `minPostalCodeLength` must be integers or numeric strings, and `securityCode` a boolean or `'true'` or `'false'`. A SWML variable reference such as `'${pay_timeout}'` is sent as written. The default `aiResponse` is `The payment status is ${pay_result}, do not mention anything else about collecting payment if successful.`

**Throws:** `Error` when `timeout`, `maxAttempts` or `minPostalCodeLength` isn't an integer, or `securityCode` isn't a boolean, or a SWML variable reference.

**Returns:** `this` for chaining.

**Example:**

```typescript
const result = new FunctionResult('Tell the caller you are starting the card payment.', true)
  .pay({
    paymentConnectorUrl: 'https://payments.example.com/connector',
    chargeAmount: '49.99',
    currency: 'usd',
    maxAttempts: 3,
    timeout: 10,
  });
```

### createPaymentPrompt (static)

Create a `PaymentPrompt` object for the `prompts` option of `pay()`.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
static createPaymentPrompt(
  forSituation: string,
  actions: PaymentAction[],
  cardType?: string,
  errorType?: string
): PaymentPrompt
```

| Parameter      | Type              | Description                                       |
|----------------|-------------------|---------------------------------------------------|
| `forSituation` | `string`          | The payment step the prompt is for, such as `'payment-card-number'`, `'expiration-date'` or `'security-code'`. |
| `actions`      | `PaymentAction[]` | Actions to perform for this prompt.               |
| `cardType`     | `string`          | Space-separated card types the prompt applies to (for example `'visa'`). |
| `errorType`    | `string`          | Space-separated error types the prompt applies to (for example `'invalid-card-number timeout'`). |

**Returns:** A `PaymentPrompt` object.

**Example:**

```typescript
const prompt = FunctionResult.createPaymentPrompt(
  'payment-card-number',
  [FunctionResult.createPaymentAction('Say', 'Enter your card number.')],
);
```

### createPaymentAction (static)

Create a `PaymentAction` for a `PaymentPrompt`.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
static createPaymentAction(actionType: string, phrase: string): PaymentAction
```

| Parameter    | Type     | Description                              |
|--------------|----------|------------------------------------------|
| `actionType` | `string` | `'Say'` to speak the phrase, or `'Play'` to play an audio file. The SWML `pay` verb accepts these two values. |
| `phrase`     | `string` | The text to say, or for `'Play'` the URL of the audio file. |

**Returns:** A `PaymentAction` object.

**Example:**

```typescript
const action = FunctionResult.createPaymentAction(
  'Say',
  'Enter your credit card number, followed by the pound key.',
);
```

### createPaymentParameter (static)

Create a `PaymentParameter`, a name-value pair for the payment connector.

<!-- snippet: no-compile API signature reference, not runnable code -->
```typescript
static createPaymentParameter(name: string, value: string): PaymentParameter
```

| Parameter | Type     | Description            |
|-----------|----------|------------------------|
| `name`    | `string` | The parameter name.    |
| `value`   | `string` | The parameter value.   |

**Returns:** A `PaymentParameter` object.

**Example:**

```typescript
const param = FunctionResult.createPaymentParameter('merchant_id', 'MERCH-001');
```

### Full payment example

This example sets custom prompts for three payment steps and passes a merchant ID to the connector:

```typescript
const prompts = [
  FunctionResult.createPaymentPrompt(
    'payment-card-number',
    [FunctionResult.createPaymentAction('Say', 'Enter your card number.')],
  ),
  FunctionResult.createPaymentPrompt(
    'expiration-date',
    [FunctionResult.createPaymentAction('Say', 'Enter the expiration date.')],
  ),
  FunctionResult.createPaymentPrompt(
    'security-code',
    [FunctionResult.createPaymentAction('Say', 'Enter the security code on the back of your card.')],
  ),
];

const params = [
  FunctionResult.createPaymentParameter('merchant_id', 'MERCH-001'),
];

const result = new FunctionResult('Tell the caller you are starting the payment.', true)
  .pay({
    paymentConnectorUrl: 'https://payments.example.com/connector',
    chargeAmount: '99.95',
    currency: 'usd',
    maxAttempts: 3,
    timeout: 15,
    prompts,
    parameters: params,
    description: 'Annual subscription',
  });
```

## Fluent Chaining

Every mutating method on `FunctionResult` returns `this`, so you can build a result with several actions in one expression. This tool completes an order, stores data, texts a confirmation and switches the available tools:

```typescript
agent.defineTool({
  name: 'complete_order',
  description: 'Complete an order and send confirmation',
  parameters: {
    order_id: { type: 'string', description: 'The order ID' },
  },
  handler: (args) => {
    const orderId = args.order_id as string;

    return new FunctionResult(`Order ${orderId} is complete.`)
      .setPostProcess(true)
      // Store data for other tools
      .updateGlobalData({ last_order: orderId, order_status: 'complete' })
      // Set metadata for this function
      .setMetadata({ order_id: orderId })
      // Send an SMS confirmation
      .sendSms({
        toNumber: '+15551234567',
        fromNumber: '+15559876543',
        body: `Your order ${orderId} has been confirmed.`,
      })
      // Speak a confirmation
      .say(`Your order ${orderId} is confirmed.`)
      // Send an event to the connected client
      .swmlUserEvent({ type: 'order_complete', order_id: orderId })
      // Disable the order tool, enable the feedback tool
      .toggleFunctions([
        { function: 'complete_order', active: false },
        { function: 'submit_feedback', active: true },
      ]);
  },
});
```

For `order_id` `ORD-789`, the handler returns this result. The `action` array keeps the order of the calls:

```json
{
  "response": "Order ORD-789 is complete.",
  "action": [
    { "set_global_data": { "last_order": "ORD-789", "order_status": "complete" } },
    { "set_meta_data": { "order_id": "ORD-789" } },
    { "SWML": { "version": "1.0.0", "sections": { "main": [{ "send_sms": { "to_number": "+15551234567", "from_number": "+15559876543", "body": "Your order ORD-789 has been confirmed." } }] } } },
    { "say": "Your order ORD-789 is confirmed." },
    { "SWML": { "sections": { "main": [{ "user_event": { "event": { "type": "order_complete", "order_id": "ORD-789" } } }] }, "version": "1.0.0" } },
    { "toggle_functions": [{ "function": "complete_order", "active": false }, { "function": "submit_feedback", "active": true }] }
  ],
  "post_process": true
}
```
