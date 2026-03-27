# FunctionResult Reference

Complete API reference for the `FunctionResult` class in the SignalWire AI Agents TypeScript SDK.

---

## Table of Contents

- [Overview](#overview)
- [Core Methods](#core-methods)
  - [constructor](#constructor)
  - [setResponse](#setresponse)
  - [setPostProcess](#setpostprocess)
  - [addAction](#addaction)
  - [addActions](#addactions)
  - [toDict](#todict)
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
- [Speech](#speech)
  - [addDynamicHints](#adddynamichints)
  - [clearDynamicHints](#cleardynamichints)
  - [setEndOfSpeechTimeout](#setendofspeechtimeout)
  - [setSpeechEventTimeout](#setspeecheventtimeout)
- [Data Management](#data-management)
  - [updateGlobalData](#updateglobaldata)
  - [removeGlobalData](#removeglobaldata)
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
  - [rpcAiUnhold](#rpcaiunhold)
- [Payments](#payments)
  - [pay](#pay)
  - [createPaymentPrompt (static)](#createpaymentprompt-static)
  - [createPaymentAction (static)](#createpaymentaction-static)
  - [createPaymentParameter (static)](#createpaymentparameter-static)
- [Fluent Chaining](#fluent-chaining)

---

## Overview

`FunctionResult` is the return type for SWAIG tool handlers. It carries two pieces of information back to the SignalWire AI engine:

1. **Response text** -- A string the AI uses as the tool's output. The AI reads this text and incorporates it into its conversation with the caller.
2. **Actions** -- An ordered list of structured commands (hangup, connect, play audio, send SMS, etc.) that the platform executes as side effects.

When a tool handler runs, it constructs a `FunctionResult`, optionally adds actions, and returns it. The SDK serializes it via `toDict()` and sends it back to SignalWire.

### Basic usage

```typescript
import { AgentBase, FunctionResult } from '@anthropic/@signalwire/sdk';

const agent = new AgentBase({ name: 'my-agent', basicAuth: ['user', 'pass'] });

agent.defineTool({
  name: 'transfer_call',
  description: 'Transfer the caller to a human agent',
  parameters: {},
  handler: () => {
    return new FunctionResult('Transferring you now.')
      .connect('+15551234567');
  },
});
```

### How serialization works

When the handler returns, the SDK calls `toDict()` to produce a plain object:

```typescript
const result = new FunctionResult('Done').hangup();
console.log(result.toDict());
// { response: "Done", action: [{ hangup: true }] }
```

If both `response` and `action` are empty, `toDict()` returns `{ response: "Action completed." }` as a fallback so the AI always receives a valid response.

### Properties

| Property      | Type                        | Description                                                  |
|---------------|-----------------------------|--------------------------------------------------------------|
| `response`    | `string`                    | Text returned to the AI engine.                              |
| `action`      | `Record<string, unknown>[]` | Ordered list of action objects to execute.                    |
| `postProcess` | `boolean`                   | When `true`, actions execute after the AI formulates its reply. |

---

## Core Methods

### constructor

Create a new `FunctionResult`.

```typescript
constructor(response?: string, postProcess?: boolean)
```

| Parameter     | Type      | Default | Description                                    |
|---------------|-----------|---------|------------------------------------------------|
| `response`    | `string`  | `''`    | Initial response text for the AI.              |
| `postProcess` | `boolean` | `false` | Whether actions should be post-processed.      |

**Returns:** A new `FunctionResult` instance.

```typescript
// Empty result (will serialize as "Action completed.")
const r1 = new FunctionResult();

// With response text
const r2 = new FunctionResult('Order placed successfully.');

// With post-processing enabled
const r3 = new FunctionResult('Processing payment...', true);
```

---

### setResponse

Set or replace the response text.

```typescript
setResponse(response: string): this
```

| Parameter  | Type     | Description               |
|------------|----------|---------------------------|
| `response` | `string` | The new response text.    |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult()
  .setResponse('Your balance is $42.50');
```

---

### setPostProcess

Enable or disable post-processing of actions.

When post-processing is enabled, the actions are executed **after** the AI has formulated its spoken response to the caller, rather than before. This is useful when you want the AI to speak first and then perform side effects (like hanging up).

```typescript
setPostProcess(postProcess: boolean): this
```

| Parameter     | Type      | Description                              |
|---------------|-----------|------------------------------------------|
| `postProcess` | `boolean` | Whether to enable post-processing.       |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Goodbye!')
  .setPostProcess(true)
  .hangup();
// The AI says "Goodbye!" first, then the hangup executes.
```

---

### addAction

Append a single named action to the action list. This is the low-level method used internally by most other methods. You can use it directly for custom or undocumented actions.

```typescript
addAction(name: string, data: unknown): this
```

| Parameter | Type      | Description                             |
|-----------|-----------|-----------------------------------------|
| `name`    | `string`  | The action name (e.g., `"hangup"`).     |
| `data`    | `unknown` | The action payload.                     |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Done')
  .addAction('custom_action', { key: 'value' });
// action: [{ custom_action: { key: "value" } }]
```

---

### addActions

Append multiple action objects at once. Each object in the array should be a single-key record mapping an action name to its payload.

```typescript
addActions(actions: Record<string, unknown>[]): this
```

| Parameter | Type                        | Description                        |
|-----------|-----------------------------|------------------------------------|
| `actions` | `Record<string, unknown>[]` | Array of action objects to append. |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Multi-step')
  .addActions([
    { say: 'Step one complete.' },
    { say: 'Step two complete.' },
    { hangup: true },
  ]);
```

---

### toDict

Serialize the result to a plain object for the SWAIG response wire format.

```typescript
toDict(): Record<string, unknown>
```

**Returns:** A dictionary with `response`, `action`, and optionally `post_process` fields.

**Behavior:**
- If `response` is non-empty, it is included as `response`.
- If `action` has entries, they are included as `action`.
- If `postProcess` is `true` and there are actions, `post_process: true` is included.
- If both `response` and `action` are empty, the result falls back to `{ response: "Action completed." }`.

```typescript
const result = new FunctionResult('Hello').say('Welcome!');
console.log(result.toDict());
// {
//   response: "Hello",
//   action: [{ say: "Welcome!" }]
// }

const empty = new FunctionResult();
console.log(empty.toDict());
// { response: "Action completed." }
```

---

## Call Control

### connect

Connect (transfer) the call to another destination using SWML. This generates an inline SWML document with a `connect` verb.

```typescript
connect(destination: string, final?: boolean, fromAddr?: string): this
```

| Parameter     | Type      | Default | Description                                              |
|---------------|-----------|---------|----------------------------------------------------------|
| `destination` | `string`  | --      | Phone number or SIP URI to connect to.                   |
| `final`       | `boolean` | `true`  | If `true`, the AI session ends after the transfer.       |
| `fromAddr`    | `string`  | --      | Optional caller ID for the outbound leg.                 |

**Returns:** `this` for chaining.

```typescript
// Simple transfer
const result = new FunctionResult('Connecting you to support.')
  .connect('+15551234567');

// Non-final transfer (AI continues after the connected call ends)
const result2 = new FunctionResult('Let me conference in my manager.')
  .connect('+15559876543', false);

// Transfer with custom caller ID
const result3 = new FunctionResult('Transferring...')
  .connect('+15551234567', true, '+15550001111');
```

---

### swmlTransfer

Transfer the call to a SWML destination with a custom AI response set before transferring. Unlike `connect`, this uses the SWML `transfer` verb with a `set` verb to inject an AI response.

```typescript
swmlTransfer(dest: string, aiResponse: string, final?: boolean): this
```

| Parameter    | Type      | Default | Description                                        |
|--------------|-----------|---------|----------------------------------------------------|
| `dest`       | `string`  | --      | The transfer destination.                          |
| `aiResponse` | `string`  | --      | AI response text to set before transferring.       |
| `final`      | `boolean` | `true`  | Whether this is a final transfer.                  |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Transfer initiated.')
  .swmlTransfer('sip:support@example.com', 'Call is being transferred to support.');
```

---

### hangup

Hang up the call. Adds a `{ hangup: true }` action.

```typescript
hangup(): this
```

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Thank you for calling. Goodbye!')
  .setPostProcess(true)
  .hangup();
```

---

### hold

Place the call on hold for a specified duration. The timeout is clamped between 0 and 900 seconds (15 minutes).

```typescript
hold(timeout?: number): this
```

| Parameter | Type     | Default | Description                          |
|-----------|----------|---------|--------------------------------------|
| `timeout` | `number` | `300`   | Hold duration in seconds (0--900).   |

**Returns:** `this` for chaining.

```typescript
// Hold for default 5 minutes
const result = new FunctionResult('Please hold.').hold();

// Hold for 60 seconds
const result2 = new FunctionResult('Brief hold.').hold(60);
```

---

### waitForUser

Wait for user input before continuing. Supports multiple modes: simple enable/disable, a timeout, or an "answer first" mode.

```typescript
waitForUser(opts?: {
  enabled?: boolean;
  timeout?: number;
  answerFirst?: boolean;
}): this
```

| Parameter          | Type      | Default | Description                                      |
|--------------------|-----------|---------|--------------------------------------------------|
| `opts.enabled`     | `boolean` | --      | Enable or disable waiting for user input.        |
| `opts.timeout`     | `number`  | --      | Timeout in seconds to wait for user input.       |
| `opts.answerFirst` | `boolean` | --      | If `true`, wait for the call to be answered first. |

**Priority:** `answerFirst` > `timeout` > `enabled`. If no options are provided, `wait_for_user` is set to `true`.

**Returns:** `this` for chaining.

```typescript
// Simple wait
const r1 = new FunctionResult('Go ahead.').waitForUser();

// Wait with timeout
const r2 = new FunctionResult('I will wait 10 seconds.')
  .waitForUser({ timeout: 10 });

// Answer-first mode
const r3 = new FunctionResult('Waiting for answer.')
  .waitForUser({ answerFirst: true });

// Disable waiting
const r4 = new FunctionResult('Continuing.')
  .waitForUser({ enabled: false });
```

---

### stop

Stop the AI session entirely. Adds a `{ stop: true }` action.

```typescript
stop(): this
```

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Session ended.').stop();
```

---

## Audio

### say

Speak text to the caller via text-to-speech (TTS).

```typescript
say(text: string): this
```

| Parameter | Type     | Description              |
|-----------|----------|--------------------------|
| `text`    | `string` | The text to speak.       |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Info retrieved.')
  .say('Your order number is 12345.');
```

---

### playBackgroundFile

Play an audio file in the background during the call. The AI conversation continues while the file plays.

```typescript
playBackgroundFile(filename: string, wait?: boolean): this
```

| Parameter  | Type      | Default | Description                                        |
|------------|-----------|---------|----------------------------------------------------|
| `filename` | `string`  | --      | URL or path of the audio file.                     |
| `wait`     | `boolean` | `false` | If `true`, block until playback completes.         |

**Returns:** `this` for chaining.

```typescript
// Play background music (non-blocking)
const result = new FunctionResult('Playing hold music.')
  .playBackgroundFile('https://example.com/hold-music.mp3');

// Play and wait for completion
const result2 = new FunctionResult('Listen to this announcement.')
  .playBackgroundFile('https://example.com/announcement.wav', true);
```

---

### stopBackgroundFile

Stop any currently playing background audio file.

```typescript
stopBackgroundFile(): this
```

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Stopping music.')
  .stopBackgroundFile();
```

---

## Speech

### addDynamicHints

Add dynamic speech recognition hints to improve transcription accuracy for specific words or phrases. Hints can be plain strings or pattern-replacement objects.

```typescript
addDynamicHints(
  hints: (string | { pattern: string; replace: string; ignore_case?: boolean })[]
): this
```

| Parameter | Type                                                                              | Description                                    |
|-----------|-----------------------------------------------------------------------------------|------------------------------------------------|
| `hints`   | `(string \| { pattern: string; replace: string; ignore_case?: boolean })[]` | Array of hint strings or pattern objects.       |

**Returns:** `this` for chaining.

```typescript
// Simple word hints
const result = new FunctionResult('Ready.')
  .addDynamicHints(['SignalWire', 'SWML', 'SWAIG']);

// Pattern-replacement hints
const result2 = new FunctionResult('Ready.')
  .addDynamicHints([
    { pattern: 'signal wire', replace: 'SignalWire', ignore_case: true },
    { pattern: 'swiggy', replace: 'SWAIG' },
  ]);
```

---

### clearDynamicHints

Remove all previously added dynamic speech recognition hints.

```typescript
clearDynamicHints(): this
```

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Hints cleared.')
  .clearDynamicHints();
```

---

### setEndOfSpeechTimeout

Set the silence duration that marks the end of a user's speech. A shorter timeout makes the AI respond more quickly after the user stops talking; a longer timeout allows for natural pauses.

```typescript
setEndOfSpeechTimeout(milliseconds: number): this
```

| Parameter      | Type     | Description                       |
|----------------|----------|-----------------------------------|
| `milliseconds` | `number` | Timeout in milliseconds.          |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Adjusted speech timeout.')
  .setEndOfSpeechTimeout(500);  // 500ms of silence = end of speech
```

---

### setSpeechEventTimeout

Set the timeout for speech event detection.

```typescript
setSpeechEventTimeout(milliseconds: number): this
```

| Parameter      | Type     | Description                       |
|----------------|----------|-----------------------------------|
| `milliseconds` | `number` | Timeout in milliseconds.          |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Event timeout set.')
  .setSpeechEventTimeout(3000);
```

---

## Data Management

### updateGlobalData

Merge key-value pairs into the global data store. The global data store is shared across all SWAIG functions during a call and persists for the call's lifetime.

```typescript
updateGlobalData(data: Record<string, unknown>): this
```

| Parameter | Type                       | Description                        |
|-----------|----------------------------|------------------------------------|
| `data`    | `Record<string, unknown>`  | Key-value pairs to set or update.  |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Data saved.')
  .updateGlobalData({ customer_id: 'C-123', tier: 'premium' });
```

---

### removeGlobalData

Remove one or more keys from the global data store.

```typescript
removeGlobalData(keys: string | string[]): this
```

| Parameter | Type                 | Description                              |
|-----------|----------------------|------------------------------------------|
| `keys`    | `string \| string[]` | A single key or array of keys to remove. |

**Returns:** `this` for chaining.

```typescript
// Remove a single key
const r1 = new FunctionResult('Removed.')
  .removeGlobalData('temp_token');

// Remove multiple keys
const r2 = new FunctionResult('Cleaned up.')
  .removeGlobalData(['temp_token', 'session_cache']);
```

---

### setMetadata

Set metadata key-value pairs on the current call. Metadata is attached to the call record and can be used for reporting, billing tags, or downstream processing.

```typescript
setMetadata(data: Record<string, unknown>): this
```

| Parameter | Type                       | Description                   |
|-----------|----------------------------|-------------------------------|
| `data`    | `Record<string, unknown>`  | Metadata key-value pairs.     |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Metadata set.')
  .setMetadata({ department: 'sales', priority: 'high' });
```

---

### removeMetadata

Remove metadata keys from the current call.

```typescript
removeMetadata(keys: string | string[]): this
```

| Parameter | Type                 | Description                              |
|-----------|----------------------|------------------------------------------|
| `keys`    | `string \| string[]` | A single key or array of keys to remove. |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Metadata removed.')
  .removeMetadata(['temp_flag', 'debug_info']);
```

---

## SWML Actions

### executeSwml

Execute arbitrary SWML content as an action. Accepts either a JSON string or an object. If the string is not valid JSON, it is wrapped in a `{ raw_swml: ... }` object.

```typescript
executeSwml(
  swmlContent: string | Record<string, unknown>,
  transfer?: boolean
): this
```

| Parameter     | Type                                    | Default | Description                                       |
|---------------|-----------------------------------------|---------|---------------------------------------------------|
| `swmlContent` | `string \| Record<string, unknown>` | --      | SWML as a JSON string or object.                  |
| `transfer`    | `boolean`                               | `false` | If `true`, the SWML execution transfers the call. |

**Returns:** `this` for chaining.

```typescript
// Execute SWML from an object
const result = new FunctionResult('Executing custom flow.')
  .executeSwml({
    version: '1.0.0',
    sections: {
      main: [{ play: { url: 'https://example.com/audio.mp3' } }],
    },
  });

// Execute with transfer
const result2 = new FunctionResult('Transferring via SWML.')
  .executeSwml({
    version: '1.0.0',
    sections: {
      main: [{ connect: { to: '+15551234567' } }],
    },
  }, true);
```

---

### switchContext

Switch the AI context at runtime. This can change the system prompt, inject a user prompt, consolidate conversation history, or perform a full reset of the AI context.

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
| `opts.systemPrompt` | `string`  | New system prompt to switch to.                                   |
| `opts.userPrompt`   | `string`  | User prompt to inject into the new context.                       |
| `opts.consolidate`  | `boolean` | If `true`, summarize and carry over conversation history.         |
| `opts.fullReset`    | `boolean` | If `true`, completely reset the AI context (clear all history).   |

**Behavior:** If only `systemPrompt` is provided (no other options), the action uses a simple string value. Otherwise, it builds an object with the specified fields.

**Returns:** `this` for chaining.

```typescript
// Simple context switch -- just change the system prompt
const r1 = new FunctionResult('Switching to billing mode.')
  .switchContext({ systemPrompt: 'You are a billing specialist.' });

// Switch with consolidation (carry over conversation summary)
const r2 = new FunctionResult('Escalating to supervisor.')
  .switchContext({
    systemPrompt: 'You are a supervisor handling an escalated call.',
    consolidate: true,
  });

// Full reset
const r3 = new FunctionResult('Starting fresh.')
  .switchContext({
    systemPrompt: 'You are a general assistant.',
    fullReset: true,
  });
```

---

### swmlChangeStep

Change the current SWML step. Steps are named blocks within a SWML document that control call flow.

```typescript
swmlChangeStep(stepName: string): this
```

| Parameter  | Type     | Description                        |
|------------|----------|------------------------------------|
| `stepName` | `string` | The name of the step to switch to. |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Moving to verification.')
  .swmlChangeStep('verify_identity');
```

---

### swmlChangeContext

Change the current SWML context. Contexts are separate AI configurations that can be switched during a call.

```typescript
swmlChangeContext(contextName: string): this
```

| Parameter     | Type     | Description                           |
|---------------|----------|---------------------------------------|
| `contextName` | `string` | The name of the context to switch to. |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Switching to Spanish.')
  .swmlChangeContext('spanish_support');
```

---

### swmlUserEvent

Emit a custom user event via SWML. User events can be consumed by external systems listening to the call's event stream.

```typescript
swmlUserEvent(eventData: Record<string, unknown>): this
```

| Parameter   | Type                       | Description          |
|-------------|----------------------------|----------------------|
| `eventData` | `Record<string, unknown>`  | The event payload.   |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Event emitted.')
  .swmlUserEvent({
    type: 'order_placed',
    order_id: 'ORD-456',
    total: 29.99,
  });
```

---

## Function Control

### toggleFunctions

Enable or disable SWAIG functions by name at runtime. This allows dynamic control over which tools the AI can call based on the conversation state.

```typescript
toggleFunctions(toggles: { function: string; active: boolean }[]): this
```

| Parameter          | Type      | Description                              |
|--------------------|-----------|------------------------------------------|
| `toggles[].function` | `string`  | The name of the SWAIG function.        |
| `toggles[].active`   | `boolean` | `true` to enable, `false` to disable. |

**Returns:** `this` for chaining.

```typescript
// After authentication, enable account-specific tools
const result = new FunctionResult('Identity verified.')
  .toggleFunctions([
    { function: 'check_balance', active: true },
    { function: 'make_payment', active: true },
    { function: 'verify_identity', active: false },
  ]);
```

---

### enableFunctionsOnTimeout

Control whether SWAIG functions can fire automatically when the speaker timeout triggers (i.e., when the caller is silent).

```typescript
enableFunctionsOnTimeout(enabled?: boolean): this
```

| Parameter | Type      | Default | Description                                          |
|-----------|-----------|---------|------------------------------------------------------|
| `enabled` | `boolean` | `true`  | Whether to enable function execution on timeout.     |

**Returns:** `this` for chaining.

```typescript
// Enable functions on speaker timeout
const r1 = new FunctionResult('Monitoring silence.')
  .enableFunctionsOnTimeout();

// Disable functions on speaker timeout
const r2 = new FunctionResult('Waiting patiently.')
  .enableFunctionsOnTimeout(false);
```

---

### updateSettings

Update AI engine settings at runtime. This allows dynamic modification of parameters like temperature, top_p, or any other engine setting.

```typescript
updateSettings(settings: Record<string, unknown>): this
```

| Parameter  | Type                       | Description                          |
|------------|----------------------------|--------------------------------------|
| `settings` | `Record<string, unknown>`  | Key-value pairs of settings.         |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Settings updated.')
  .updateSettings({ temperature: 0.3, top_p: 0.9 });
```

---

## User Input and History

### simulateUserInput

Inject text as if the user had spoken it. This is useful for programmatically driving the conversation flow.

```typescript
simulateUserInput(text: string): this
```

| Parameter | Type     | Description                        |
|-----------|----------|------------------------------------|
| `text`    | `string` | The simulated user input text.     |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Proceeding with default.')
  .simulateUserInput('Yes, please go ahead.');
```

---

### enableExtensiveData

Enable or disable extensive data reporting in function calls. When enabled, SWAIG function invocations include additional metadata about the call state.

```typescript
enableExtensiveData(enabled?: boolean): this
```

| Parameter | Type      | Default | Description                              |
|-----------|-----------|---------|------------------------------------------|
| `enabled` | `boolean` | `true`  | Whether to enable extensive data.        |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Extensive data enabled.')
  .enableExtensiveData();
```

---

### replaceInHistory

Replace the function call output in the conversation history. This controls what the AI "remembers" about this function invocation.

```typescript
replaceInHistory(text?: string | boolean): this
```

| Parameter | Type                  | Default | Description                                               |
|-----------|-----------------------|---------|-----------------------------------------------------------|
| `text`    | `string \| boolean` | `true`  | Replacement text, or `true` to replace with the response. |

**Returns:** `this` for chaining.

```typescript
// Replace with the response text
const r1 = new FunctionResult('Sensitive data redacted.')
  .replaceInHistory();

// Replace with custom text
const r2 = new FunctionResult('SSN verified.')
  .replaceInHistory('Identity verification completed.');
```

---

## Communication

### sendSms

Send an SMS or MMS message from within the call flow. At least one of `body` or `media` must be provided.

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
| `opts.toNumber`  | `string`   | Recipient phone number.                        |
| `opts.fromNumber` | `string`  | Sender phone number (must be a number you own).|
| `opts.body`      | `string`   | SMS text body.                                 |
| `opts.media`     | `string[]` | Array of media URLs for MMS.                   |
| `opts.tags`      | `string[]` | Optional tags for the message.                 |
| `opts.region`    | `string`   | Optional region for message routing.           |

**Throws:** `Error` if neither `body` nor `media` is provided.

**Returns:** `this` for chaining.

```typescript
// Send a text SMS
const result = new FunctionResult('Confirmation sent.')
  .sendSms({
    toNumber: '+15551234567',
    fromNumber: '+15559876543',
    body: 'Your appointment is confirmed for tomorrow at 2pm.',
  });

// Send an MMS with an image
const result2 = new FunctionResult('Receipt sent.')
  .sendSms({
    toNumber: '+15551234567',
    fromNumber: '+15559876543',
    body: 'Here is your receipt:',
    media: ['https://example.com/receipt.png'],
  });
```

---

### recordCall

Start recording the call with configurable options.

```typescript
recordCall(opts?: {
  controlId?: string;
  stereo?: boolean;
  format?: 'wav' | 'mp3';
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
| `opts.controlId`        | `string`                        | --       | Identifier for this recording (for stop/status).|
| `opts.stereo`           | `boolean`                       | `false`  | Record in stereo (separate channels).            |
| `opts.format`           | `'wav' \| 'mp3'`             | `'wav'`  | Recording file format.                           |
| `opts.direction`        | `'speak' \| 'listen' \| 'both'` | `'both'` | Which audio direction to record.               |
| `opts.terminators`      | `string`                        | --       | DTMF keys that stop the recording.              |
| `opts.beep`             | `boolean`                       | `false`  | Play a beep when recording starts.               |
| `opts.inputSensitivity` | `number`                        | `44.0`   | Sensitivity for voice activity detection.        |
| `opts.initialTimeout`   | `number`                        | --       | Seconds to wait for initial speech.              |
| `opts.endSilenceTimeout`| `number`                        | --       | Seconds of silence before stopping.              |
| `opts.maxLength`        | `number`                        | --       | Maximum recording length in seconds.             |
| `opts.statusUrl`        | `string`                        | --       | Webhook URL for recording status callbacks.      |

**Returns:** `this` for chaining.

```typescript
// Simple recording
const result = new FunctionResult('Recording started.')
  .recordCall();

// Stereo MP3 recording with a control ID
const result2 = new FunctionResult('Recording...')
  .recordCall({
    controlId: 'main-recording',
    stereo: true,
    format: 'mp3',
    maxLength: 3600,
    statusUrl: 'https://example.com/recording-status',
  });
```

---

### stopRecordCall

Stop an active call recording.

```typescript
stopRecordCall(controlId?: string): this
```

| Parameter   | Type     | Description                                      |
|-------------|----------|--------------------------------------------------|
| `controlId` | `string` | Optional control ID of the recording to stop.    |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Recording stopped.')
  .stopRecordCall('main-recording');
```

---

### tap

Start a media tap to stream audio to an external URI (e.g., for real-time transcription or monitoring).

```typescript
tap(opts: {
  uri: string;
  controlId?: string;
  direction?: 'speak' | 'hear' | 'both';
  codec?: 'PCMU' | 'PCMA';
  rtpPtime?: number;
  statusUrl?: string;
}): this
```

| Parameter        | Type                             | Default  | Description                                  |
|------------------|----------------------------------|----------|----------------------------------------------|
| `opts.uri`       | `string`                         | --       | Destination URI for the media stream.        |
| `opts.controlId` | `string`                         | --       | Identifier for this tap (for stop/status).   |
| `opts.direction` | `'speak' \| 'hear' \| 'both'` | `'both'` | Which audio direction to tap.                |
| `opts.codec`     | `'PCMU' \| 'PCMA'`            | `'PCMU'` | Audio codec for the stream.                  |
| `opts.rtpPtime`  | `number`                         | `20`     | RTP packetization time in milliseconds.      |
| `opts.statusUrl` | `string`                         | --       | Webhook URL for tap status callbacks.        |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Tap started.')
  .tap({
    uri: 'wss://transcription.example.com/stream',
    controlId: 'realtime-tap',
    direction: 'both',
  });
```

---

### stopTap

Stop an active media tap.

```typescript
stopTap(controlId?: string): this
```

| Parameter   | Type     | Description                                 |
|-------------|----------|---------------------------------------------|
| `controlId` | `string` | Optional control ID of the tap to stop.     |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Tap stopped.')
  .stopTap('realtime-tap');
```

---

## Rooms and Conferencing

### joinRoom

Join a SignalWire room by name.

```typescript
joinRoom(name: string): this
```

| Parameter | Type     | Description           |
|-----------|----------|-----------------------|
| `name`    | `string` | The room name.        |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Joining the meeting room.')
  .joinRoom('team-standup');
```

---

### sipRefer

Send a SIP REFER to transfer the call to another SIP endpoint.

```typescript
sipRefer(toUri: string): this
```

| Parameter | Type     | Description                           |
|-----------|----------|---------------------------------------|
| `toUri`   | `string` | The SIP URI to refer the call to.     |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Transferring via SIP.')
  .sipRefer('sip:agent@pbx.example.com');
```

---

### joinConference

Join a conference by name with optional configuration parameters.

```typescript
joinConference(name: string, opts?: {
  muted?: boolean;
  beep?: 'true' | 'false' | 'onEnter' | 'onExit';
  startOnEnter?: boolean;
  endOnExit?: boolean;
  waitUrl?: string;
  maxParticipants?: number;
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
| `name`                                 | `string`                                    | --                  | Conference name.                                     |
| `opts.muted`                           | `boolean`                                   | --                  | Join muted.                                          |
| `opts.beep`                            | `'true' \| 'false' \| 'onEnter' \| 'onExit'` | `'true'`         | When to play the beep sound.                         |
| `opts.startOnEnter`                    | `boolean`                                   | `true`              | Start the conference when this participant joins.    |
| `opts.endOnExit`                       | `boolean`                                   | --                  | End the conference when this participant leaves.     |
| `opts.waitUrl`                         | `string`                                    | --                  | URL to play while waiting for the conference to start.|
| `opts.maxParticipants`                 | `number`                                    | `250`               | Maximum number of participants.                      |
| `opts.record`                          | `'do-not-record' \| 'record-from-start'`  | `'do-not-record'`   | Recording mode.                                      |
| `opts.region`                          | `string`                                    | --                  | Region for the conference.                           |
| `opts.trim`                            | `'trim-silence' \| 'do-not-trim'`         | `'trim-silence'`    | Silence trimming mode for recordings.                |
| `opts.coach`                           | `string`                                    | --                  | Call SID of participant to coach (whisper to).        |
| `opts.statusCallbackEvent`             | `string`                                    | --                  | Events to trigger status callback.                   |
| `opts.statusCallback`                  | `string`                                    | --                  | URL for status callback.                             |
| `opts.statusCallbackMethod`            | `'GET' \| 'POST'`                         | `'POST'`            | HTTP method for status callback.                     |
| `opts.recordingStatusCallback`         | `string`                                    | --                  | URL for recording status callback.                   |
| `opts.recordingStatusCallbackMethod`   | `'GET' \| 'POST'`                         | `'POST'`            | HTTP method for recording status callback.           |
| `opts.recordingStatusCallbackEvent`    | `string`                                    | `'completed'`       | Events to trigger recording status callback.         |
| `opts.result`                          | `unknown`                                   | --                  | Custom result data.                                  |

**Behavior:** When only the `name` is provided (or all options are at their defaults), the `join_conference` action uses the name as a simple string value. When non-default options are specified, it uses an object with all the configured parameters.

**Returns:** `this` for chaining.

```typescript
// Simple conference join
const result = new FunctionResult('Joining conference.')
  .joinConference('support-queue');

// Conference with options
const result2 = new FunctionResult('Joining as listener.')
  .joinConference('all-hands', {
    muted: true,
    record: 'record-from-start',
    maxParticipants: 50,
    beep: 'onEnter',
  });
```

---

## RPC

### executeRpc

Execute a SignalWire RPC method via SWML. This is the low-level RPC method; convenience wrappers like `rpcDial`, `rpcAiMessage`, and `rpcAiUnhold` are built on top of it.

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
| `opts.params` | `Record<string, unknown>`  | Optional parameters for the method. |
| `opts.callId` | `string`                   | Optional target call ID.            |
| `opts.nodeId` | `string`                   | Optional target node ID.            |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('RPC executed.')
  .executeRpc({
    method: 'calling.play',
    callId: 'call-abc-123',
    params: {
      url: 'https://example.com/notification.mp3',
    },
  });
```

---

### rpcDial

Dial a number via RPC. This creates an outbound call using the SignalWire RPC mechanism.

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
| `toNumber`   | `string` | --        | Destination phone number.                |
| `fromNumber` | `string` | --        | Caller ID number.                        |
| `destSwml`   | `string` | --        | SWML destination for the dialed call.    |
| `deviceType` | `string` | `'phone'` | Device type for the outbound leg.        |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Dialing out.')
  .rpcDial('+15551234567', '+15559876543', 'https://example.com/swml');
```

---

### rpcAiMessage

Send an AI message to another call via RPC. This injects a message into the target call's AI conversation.

```typescript
rpcAiMessage(callId: string, messageText: string, role?: string): this
```

| Parameter     | Type     | Default    | Description                          |
|---------------|----------|------------|--------------------------------------|
| `callId`      | `string` | --         | The target call ID.                  |
| `messageText` | `string` | --         | The message text to inject.          |
| `role`        | `string` | `'system'` | The message role.                    |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Message sent to other call.')
  .rpcAiMessage('call-abc-123', 'The customer has been verified.');
```

---

### rpcAiUnhold

Unhold a call that was previously placed on hold, via RPC.

```typescript
rpcAiUnhold(callId: string): this
```

| Parameter | Type     | Description                    |
|-----------|----------|--------------------------------|
| `callId`  | `string` | The target call ID to unhold.  |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Resuming the held call.')
  .rpcAiUnhold('call-abc-123');
```

---

## Payments

### pay

Initiate a payment collection flow on the call. The payment is collected via DTMF or speech and processed by the specified payment connector.

```typescript
pay(opts: {
  paymentConnectorUrl: string;
  inputMethod?: string;
  statusUrl?: string;
  paymentMethod?: string;
  timeout?: number;
  maxAttempts?: number;
  securityCode?: boolean;
  postalCode?: boolean | string;
  minPostalCodeLength?: number;
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
| `opts.paymentConnectorUrl` | `string`             | --                                    | URL of the payment connector endpoint.                          |
| `opts.inputMethod`         | `string`             | `'dtmf'`                             | Input method (`'dtmf'` or `'speech'`).                          |
| `opts.statusUrl`           | `string`             | --                                    | Webhook URL for payment status callbacks.                       |
| `opts.paymentMethod`       | `string`             | `'credit-card'`                      | Payment method type.                                            |
| `opts.timeout`             | `number`             | `5`                                   | Timeout in seconds for each input step.                         |
| `opts.maxAttempts`         | `number`             | `1`                                   | Maximum number of retry attempts.                               |
| `opts.securityCode`        | `boolean`            | `true`                                | Whether to collect the security code (CVV).                     |
| `opts.postalCode`          | `boolean \| string` | `true`                                | Whether to collect postal code, or a fixed postal code string.  |
| `opts.minPostalCodeLength` | `number`             | `0`                                   | Minimum length for postal code input.                           |
| `opts.tokenType`           | `string`             | `'reusable'`                         | Token type for tokenized payments.                              |
| `opts.chargeAmount`        | `string`             | --                                    | Amount to charge (e.g., `'29.99'`).                             |
| `opts.currency`            | `string`             | `'usd'`                              | Currency code.                                                  |
| `opts.language`            | `string`             | `'en-US'`                            | Language for payment prompts.                                   |
| `opts.voice`               | `string`             | `'woman'`                            | Voice for payment prompts.                                      |
| `opts.description`         | `string`             | --                                    | Description of the payment.                                     |
| `opts.validCardTypes`      | `string`             | `'visa mastercard amex'`             | Space-separated list of accepted card types.                    |
| `opts.parameters`          | `PaymentParameter[]` | --                                    | Custom parameters for the payment connector.                    |
| `opts.prompts`             | `PaymentPrompt[]`    | --                                    | Custom prompts for payment steps.                               |
| `opts.aiResponse`          | `string`             | Template referencing `${pay_result}` | AI response set after payment completes.                        |

**Returns:** `this` for chaining.

```typescript
const result = new FunctionResult('Collecting payment.')
  .pay({
    paymentConnectorUrl: 'https://payments.example.com/connector',
    chargeAmount: '49.99',
    currency: 'usd',
    maxAttempts: 3,
    timeout: 10,
  });
```

---

### createPaymentPrompt (static)

Create a `PaymentPrompt` configuration object for use with the `pay()` method.

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
| `forSituation` | `string`          | The situation this prompt applies to.              |
| `actions`      | `PaymentAction[]` | Actions to perform for this prompt.                |
| `cardType`     | `string`          | Optional card type filter (e.g., `'visa'`).        |
| `errorType`    | `string`          | Optional error type this prompt handles.           |

**Returns:** A `PaymentPrompt` object.

```typescript
const prompt = FunctionResult.createPaymentPrompt(
  'payment-card-number',
  [FunctionResult.createPaymentAction('say', 'Please enter your card number.')],
);
```

---

### createPaymentAction (static)

Create a `PaymentAction` for use within a `PaymentPrompt`.

```typescript
static createPaymentAction(actionType: string, phrase: string): PaymentAction
```

| Parameter    | Type     | Description                              |
|--------------|----------|------------------------------------------|
| `actionType` | `string` | The action type (e.g., `'say'`, `'play'`). |
| `phrase`     | `string` | The phrase or URL for this action.       |

**Returns:** A `PaymentAction` object.

```typescript
const action = FunctionResult.createPaymentAction(
  'say',
  'Please enter your credit card number followed by the pound sign.',
);
```

---

### createPaymentParameter (static)

Create a custom `PaymentParameter` for the payment connector.

```typescript
static createPaymentParameter(name: string, value: string): PaymentParameter
```

| Parameter | Type     | Description            |
|-----------|----------|------------------------|
| `name`    | `string` | The parameter name.    |
| `value`   | `string` | The parameter value.   |

**Returns:** A `PaymentParameter` object.

```typescript
const param = FunctionResult.createPaymentParameter('merchant_id', 'MERCH-001');
```

---

### Full payment example

```typescript
const prompts = [
  FunctionResult.createPaymentPrompt(
    'payment-card-number',
    [FunctionResult.createPaymentAction('say', 'Please enter your card number.')],
  ),
  FunctionResult.createPaymentPrompt(
    'payment-expiration-date',
    [FunctionResult.createPaymentAction('say', 'Enter the expiration date.')],
  ),
  FunctionResult.createPaymentPrompt(
    'payment-security-code',
    [FunctionResult.createPaymentAction('say', 'Enter the CVV on the back of your card.')],
  ),
];

const params = [
  FunctionResult.createPaymentParameter('merchant_id', 'MERCH-001'),
];

const result = new FunctionResult('Starting payment collection.')
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

---

## Fluent Chaining

Every mutating method on `FunctionResult` returns `this`, enabling fluent method chaining. You can compose complex multi-action responses in a single expression.

```typescript
agent.defineTool({
  name: 'complete_order',
  description: 'Complete an order and send confirmation',
  parameters: {
    order_id: { type: 'string', description: 'The order ID' },
  },
  handler: (args) => {
    const orderId = args.order_id as string;

    return new FunctionResult(`Order ${orderId} completed.`)
      .setPostProcess(true)
      // Store data for other tools
      .updateGlobalData({ last_order: orderId, order_status: 'complete' })
      // Tag the call
      .setMetadata({ order_id: orderId })
      // Send SMS confirmation
      .sendSms({
        toNumber: '+15551234567',
        fromNumber: '+15559876543',
        body: `Your order ${orderId} has been confirmed!`,
      })
      // Speak a confirmation
      .say(`Your order ${orderId} is confirmed.`)
      // Emit a tracking event
      .swmlUserEvent({ type: 'order_complete', order_id: orderId })
      // Disable the order tool, enable the feedback tool
      .toggleFunctions([
        { function: 'complete_order', active: false },
        { function: 'submit_feedback', active: true },
      ]);
  },
});
```

The chained calls produce an `action` array in the order they were called. SignalWire executes them sequentially:

```json
{
  "response": "Order ORD-789 completed.",
  "action": [
    { "set_global_data": { "last_order": "ORD-789", "order_status": "complete" } },
    { "set_meta_data": { "order_id": "ORD-789" } },
    { "SWML": { "version": "1.0.0", "sections": { "main": [{ "send_sms": { "to_number": "+15551234567", "from_number": "+15559876543", "body": "Your order ORD-789 has been confirmed!" } }] } } },
    { "say": "Your order ORD-789 is confirmed." },
    { "SWML": { "version": "1.0.0", "sections": { "main": [{ "user_event": { "event": { "type": "order_complete", "order_id": "ORD-789" } } }] } } },
    { "toggle_functions": [{ "function": "complete_order", "active": false }, { "function": "submit_feedback", "active": true }] }
  ],
  "post_process": true
}
```
