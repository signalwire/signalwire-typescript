# FunctionResult Reference

Complete API reference for the `FunctionResult` class in the SignalWire AI Agents TypeScript SDK.

SWAIG (SignalWire AI Gateway) is the platform's AI tool-calling system -- it connects the AI's decisions to actions like call transfers, SMS, recordings, and API calls, with native access to the media stack. This document provides a complete reference for all methods available in the `FunctionResult` class.

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
import { AgentBase, FunctionResult } from '@signalwire/sdk';

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

```typescript
const result = new FunctionResult()
  .setResponse('Your balance is $42.50');
```

---

### setPostProcess

Enable or disable post-processing of actions. When enabled, actions execute **after** the AI has formulated its spoken response.

```typescript
setPostProcess(postProcess: boolean): this
```

```typescript
const result = new FunctionResult('Goodbye!')
  .setPostProcess(true)
  .hangup();
// The AI says "Goodbye!" first, then the hangup executes.
```

---

### addAction

Append a single named action to the action list.

```typescript
addAction(name: string, data: unknown): this
```

```typescript
const result = new FunctionResult('Done')
  .addAction('custom_action', { key: 'value' });
// action: [{ custom_action: { key: "value" } }]
```

---

### addActions

Append multiple action objects at once.

```typescript
addActions(actions: Record<string, unknown>[]): this
```

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

**Behavior:**

- If `response` is non-empty, it is included as `response`.
- If `action` has entries, they are included as `action`.
- If `postProcess` is `true` and there are actions, `post_process: true` is included.
- If both `response` and `action` are empty, the result falls back to `{ response: "Action completed." }`.

```typescript
const result = new FunctionResult('Hello').say('Welcome!');
console.log(result.toDict());
// { response: "Hello", action: [{ say: "Welcome!" }] }
```

---

## Call Control

### connect

Connect (transfer) the call to another destination using SWML.

```typescript
connect(destination: string, final?: boolean, fromAddr?: string): this
```

| Parameter     | Type      | Default | Description                                              |
|---------------|-----------|---------|----------------------------------------------------------|
| `destination` | `string`  | --      | Phone number or SIP URI to connect to.                   |
| `final`       | `boolean` | `true`  | If `true`, the AI session ends after the transfer.       |
| `fromAddr`    | `string`  | --      | Optional caller ID for the outbound leg.                 |

```typescript
// Simple transfer
const result = new FunctionResult('Connecting you to support.')
  .connect('+15559876543');

// Transfer with custom caller ID, non-final
const result2 = new FunctionResult('Warm transfer initiated.')
  .connect('sip:support@company.com', false, '+15551234567');
```

---

### swmlTransfer

Transfer the call using a complete SWML document.

```typescript
swmlTransfer(swml: string | Record<string, unknown>): this
```

```typescript
const swmlDoc = {
  version: '1.0.0',
  sections: { main: [{ connect: { to: '+15559876543' } }] },
};
const result = new FunctionResult('Transferring.').swmlTransfer(swmlDoc);
```

---

### hangup

Hang up the call.

```typescript
hangup(): this
```

```typescript
const result = new FunctionResult('Goodbye!').hangup();
// action: [{ hangup: true }]
```

---

### hold

Place the call on hold.

```typescript
hold(timeout?: number): this
```

| Parameter | Type     | Default | Description                           |
|-----------|----------|---------|---------------------------------------|
| `timeout` | `number` | --      | Hold duration in seconds (0-900).     |

```typescript
const result = new FunctionResult('Please hold.')
  .hold(60);
```

---

### waitForUser

Wait for user input before continuing the AI conversation.

```typescript
waitForUser(opts?: Record<string, unknown>): this
```

```typescript
const result = new FunctionResult('Take your time, I am here when you are ready.')
  .waitForUser();
```

---

### stop

Stop the AI session.

```typescript
stop(): this
```

```typescript
const result = new FunctionResult('Session ending.').stop();
```

---

## Audio

### say

Speak text via TTS.

```typescript
say(text: string): this
```

```typescript
const result = new FunctionResult('Processing.')
  .say('Your request has been submitted.');
```

---

### playBackgroundFile

Play an audio file in the background during the call.

```typescript
playBackgroundFile(url: string, wait?: boolean): this
```

```typescript
const result = new FunctionResult('Playing music.')
  .playBackgroundFile('https://cdn.example.com/hold-music.mp3');
```

---

### stopBackgroundFile

Stop the currently playing background audio.

```typescript
stopBackgroundFile(): this
```

```typescript
const result = new FunctionResult('Music stopped.')
  .stopBackgroundFile();
```

---

## Speech

### addDynamicHints

Add speech recognition hints at runtime.

```typescript
addDynamicHints(hints: string[]): this
```

```typescript
const result = new FunctionResult('I see you mentioned ACME Corp.')
  .addDynamicHints(['ACME', 'Widget Pro', 'Widget Basic']);
```

---

### clearDynamicHints

Remove all dynamic speech hints.

```typescript
clearDynamicHints(): this
```

---

### setEndOfSpeechTimeout

Set the end-of-speech timeout in milliseconds.

```typescript
setEndOfSpeechTimeout(ms: number): this
```

---

### setSpeechEventTimeout

Set the speech event timeout in milliseconds.

```typescript
setSpeechEventTimeout(ms: number): this
```

---

## Data Management

### updateGlobalData

Merge key-value pairs into the shared global data store.

```typescript
updateGlobalData(data: Record<string, unknown>): this
```

```typescript
const result = new FunctionResult('Account verified.')
  .updateGlobalData({ verified: true, customer_id: '12345' });
// action: [{ set_global_data: { verified: true, customer_id: "12345" } }]
```

---

### removeGlobalData

Remove keys from the global data store.

```typescript
removeGlobalData(keys: string[]): this
```

```typescript
const result = new FunctionResult('Cleared.')
  .removeGlobalData(['temp_token', 'session_flag']);
```

---

### setMetadata

Set call metadata.

```typescript
setMetadata(data: Record<string, unknown>): this
```

```typescript
const result = new FunctionResult('Metadata set.')
  .setMetadata({ category: 'billing', priority: 'high' });
```

---

### removeMetadata

Remove keys from call metadata.

```typescript
removeMetadata(keys: string[]): this
```

---

## SWML Actions

### executeSwml

Execute arbitrary SWML content.

```typescript
executeSwml(swml: string | Record<string, unknown>, transfer?: boolean): this
```

```typescript
// Execute SWML as a string
const result = new FunctionResult('Executing.')
  .executeSwml('{"version":"1.0.0","sections":{"main":[{"say":"Hello"}]}}');

// Execute SWML as an object
const swmlDoc = { version: '1.0.0', sections: { main: [{ say: 'Hello' }] } };
const result2 = new FunctionResult('Executing.').executeSwml(swmlDoc, true);
```

---

### switchContext

Switch the AI context with optional prompt changes.

```typescript
switchContext(opts: Record<string, unknown>): this
```

```typescript
const result = new FunctionResult('Switching to billing.')
  .switchContext({
    systemPrompt: 'You are now a billing specialist.',
    context: 'billing',
  });
```

---

### swmlChangeStep

Navigate to a specific step within the current context.

```typescript
swmlChangeStep(step: string): this
```

```typescript
const result = new FunctionResult('Moving to verification.')
  .swmlChangeStep('verify_identity');
```

---

### swmlChangeContext

Navigate to a different context, optionally starting at a specific step.

```typescript
swmlChangeContext(context: string, step?: string): this
```

```typescript
const result = new FunctionResult('Transferring to support.')
  .swmlChangeContext('support', 'initial_triage');
```

---

### swmlUserEvent

Fire a user event.

```typescript
swmlUserEvent(event: Record<string, unknown>): this
```

---

## Function Control

### toggleFunctions

Enable or disable specific SWAIG functions.

```typescript
toggleFunctions(toggles: Record<string, boolean>): this
```

```typescript
const result = new FunctionResult('Payment mode activated.')
  .toggleFunctions({
    process_payment: true,
    browse_products: false,
  });
// action: [{ toggle_functions: [{ function: "process_payment", active: true }, ...] }]
```

---

### enableFunctionsOnTimeout

Re-enable functions after a specified timeout.

```typescript
enableFunctionsOnTimeout(functions: string[], timeout: number): this
```

---

### updateSettings

Update AI settings dynamically.

```typescript
updateSettings(settings: Record<string, unknown>): this
```

---

## User Input and History

### simulateUserInput

Inject simulated user input into the conversation.

```typescript
simulateUserInput(text: string): this
```

---

### enableExtensiveData

Enable extensive data in the SWAIG request payload.

```typescript
enableExtensiveData(): this
```

---

### replaceInHistory

Replace text in the conversation history.

```typescript
replaceInHistory(search: string, replace: string): this
```

---

## Communication

### sendSms

Send an SMS or MMS message.

```typescript
sendSms(opts: { to: string; from: string; body: string; media?: string[] }): this
```

```typescript
const result = new FunctionResult('SMS sent.')
  .sendSms({
    to: '+15551234567',
    from: '+15559876543',
    body: 'Your appointment is confirmed for tomorrow at 2pm.',
  });
```

---

### recordCall

Start recording the call.

```typescript
recordCall(opts?: { format?: string; stereo?: boolean }): this
```

```typescript
const result = new FunctionResult('Recording started.')
  .recordCall({ format: 'mp4', stereo: true });
```

---

### stopRecordCall

Stop an active call recording.

```typescript
stopRecordCall(): this
```

---

### tap

Start call tapping (media stream).

```typescript
tap(opts: Record<string, unknown>): this
```

```typescript
const result = new FunctionResult('Tapping started.')
  .tap({
    uri: 'wss://analytics.example.com/stream',
    direction: 'both',
  });
```

---

### stopTap

Stop call tapping.

```typescript
stopTap(): this
```

---

## Rooms and Conferencing

### joinRoom

Join a video room.

```typescript
joinRoom(opts: Record<string, unknown>): this
```

```typescript
const result = new FunctionResult('Joining room.')
  .joinRoom({ name: 'meeting-room-1' });
```

---

### sipRefer

Perform a SIP REFER transfer.

```typescript
sipRefer(to: string): this
```

---

### joinConference

Join a conference.

```typescript
joinConference(opts: Record<string, unknown>): this
```

```typescript
const result = new FunctionResult('Joining conference.')
  .joinConference({ name: 'team-standup' });
```

---

## RPC

### executeRpc

Execute a JSON-RPC method call.

```typescript
executeRpc(method: string, params?: Record<string, unknown>): this
```

---

### rpcDial

RPC-based dialing.

```typescript
rpcDial(opts: Record<string, unknown>): this
```

---

### rpcAiMessage

Inject an AI message via RPC.

```typescript
rpcAiMessage(message: string): this
```

---

### rpcAiUnhold

Unhold the call via RPC.

```typescript
rpcAiUnhold(): this
```

---

## Payments

### pay

Initiate a payment collection flow.

```typescript
pay(opts: Record<string, unknown>): this
```

```typescript
const result = new FunctionResult('Starting payment.')
  .pay({
    prompts: FunctionResult.createPaymentPrompt({
      cardNumber: 'Please enter your card number.',
      expirationDate: 'What is the expiration date?',
      securityCode: 'What is the CVV?',
    }),
    action: FunctionResult.createPaymentAction({
      url: 'https://payments.example.com/charge',
      method: 'POST',
    }),
    parameters: FunctionResult.createPaymentParameter({
      currency: 'USD',
      amount: 99.99,
    }),
  });
```

---

### createPaymentPrompt (static)

Create a payment prompt configuration object.

```typescript
static createPaymentPrompt(opts: PaymentPrompt): string
```

---

### createPaymentAction (static)

Create a payment action configuration object.

```typescript
static createPaymentAction(opts: PaymentAction): Record<string, unknown>
```

---

### createPaymentParameter (static)

Create a payment parameter configuration object.

```typescript
static createPaymentParameter(opts: PaymentParameter): Record<string, unknown>
```

---

## Fluent Chaining

All action methods return `this`, enabling method chaining:

```typescript
const result = new FunctionResult('Processing your request.')
  .updateGlobalData({ step: 'payment' })
  .toggleFunctions({ browse_products: false, process_payment: true })
  .say('I am now processing your payment.')
  .setPostProcess(true);
```

Actions are serialized in the order they are added. The platform executes them sequentially.

```typescript
// This results in: say first, then hangup
const result = new FunctionResult('Goodbye!')
  .say('Thank you for calling.')
  .setPostProcess(true)
  .hangup();

console.log(result.toDict());
// {
//   response: "Goodbye!",
//   action: [
//     { say: "Thank you for calling." },
//     { hangup: true }
//   ],
//   post_process: true
// }
```
